import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  listAuthorizedExternalEventConsumersMock,
  getExternalEventDeliveryByFingerprintMock,
  upsertExternalEventDeliveryStateMock,
  publishDomainEventMock,
  buildDomainEventMock,
} = vi.hoisted(() => ({
  listAuthorizedExternalEventConsumersMock: vi.fn(),
  getExternalEventDeliveryByFingerprintMock: vi.fn(),
  upsertExternalEventDeliveryStateMock: vi.fn(),
  publishDomainEventMock: vi.fn(async (event) => event),
  buildDomainEventMock: vi.fn((event) => event),
}));

vi.mock("@/lib/events/publisher", () => ({
  buildDomainEvent: buildDomainEventMock,
  publishDomainEvent: publishDomainEventMock,
}));

vi.mock("@/modules/integrations/infrastructure/external-event-consumers-repository", () => ({
  listAuthorizedExternalEventConsumersFromDb: listAuthorizedExternalEventConsumersMock,
}));

vi.mock("@/modules/integrations/infrastructure/external-event-deliveries-repository", () => ({
  getExternalEventDeliveryByFingerprintFromDb: getExternalEventDeliveryByFingerprintMock,
  upsertExternalEventDeliveryStateInDb: upsertExternalEventDeliveryStateMock,
}));

import { publishExternalEvents } from "@/modules/integrations/application/publish-external-events";

describe("external events publication", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    listAuthorizedExternalEventConsumersMock.mockResolvedValue([
      {
        tenant_id: "11111111-1111-4111-8111-111111111111",
        consumer_key: "consumer-a",
        event_name: "integrations.external_ingestion.received.v1",
        event_version: "v1",
        is_active: true,
      },
    ]);

    getExternalEventDeliveryByFingerprintMock.mockResolvedValue(null);
    upsertExternalEventDeliveryStateMock.mockImplementation(async (input) => ({
      tenant_id: input.tenantId,
      consumer_key: input.consumerKey,
      event_name: input.eventName,
      event_version: input.eventVersion,
      source_reference: input.sourceReference,
      fingerprint: input.fingerprint,
      idempotency_key: input.idempotencyKey,
      status: input.status,
      attempt_count: input.attemptCount,
      last_attempt_at: input.lastAttemptAt ?? null,
      last_error: input.lastError ?? null,
      failure_code: input.failureCode ?? null,
      recommended_action: input.recommendedAction ?? null,
      payload_summary: input.payloadSummary,
      correlation_id: input.correlationId,
      delivered_at: input.deliveredAt ?? null,
    }));
  });

  it("publishes canonical events and reuses the same fingerprint on idempotent reprocessing", async () => {
    const input = {
      tenantId: "11111111-1111-4111-8111-111111111111",
      correlationId: "22222222-2222-4222-8222-222222222222",
      sourceReference: "REF-2026-04",
      eventState: "received" as const,
      actorId: "system",
      actorRole: "integration_pipeline",
      payload: {
        ingestion_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        contract_version: "v1",
        validation_result: "success" as const,
      },
    };

    const firstResult = await publishExternalEvents(input, {} as never);

    getExternalEventDeliveryByFingerprintMock.mockResolvedValueOnce({
      tenant_id: input.tenantId,
      consumer_key: "consumer-a",
      event_name: "integrations.external_ingestion.received.v1",
      event_version: "v1",
      source_reference: input.sourceReference,
      fingerprint: firstResult.fingerprint,
      idempotency_key: firstResult.idempotency_key,
      status: "delivered",
      attempt_count: 1,
      last_attempt_at: "2026-04-13T12:00:00.000Z",
      last_error: null,
      failure_code: null,
      recommended_action: null,
      payload_summary: {},
      correlation_id: input.correlationId,
      delivered_at: "2026-04-13T12:00:01.000Z",
    });

    const secondResult = await publishExternalEvents(input, {} as never);

    expect(firstResult.event_name).toBe("integrations.external_ingestion.received.v1");
    expect(firstResult.status).toBe("delivered");
    expect(secondResult.idempotency_key).toBe(firstResult.idempotency_key);
    expect(secondResult.fingerprint).toBe(firstResult.fingerprint);
    expect(publishDomainEventMock).toHaveBeenCalledTimes(1);
    expect(upsertExternalEventDeliveryStateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "delivering", attemptCount: 1 }),
      expect.any(Object),
    );
  });

  it("records a forbidden failure when no consumers are authorized", async () => {
    listAuthorizedExternalEventConsumersMock.mockResolvedValueOnce([]);

    const result = await publishExternalEvents(
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        correlationId: "22222222-2222-4222-8222-222222222222",
        sourceReference: "REF-2026-04",
        eventState: "exception",
        actorId: "system",
        actorRole: "integration_pipeline",
        payload: {
          failure_code: "PROCESSING_FAILURE",
          recommended_action: "Revise a causa antes de reenviar.",
        },
      },
      {} as never,
    );

    expect(result.status).toBe("failed");
    expect(result.failure_code).toBe("FORBIDDEN_CONSUMER");
    expect(result.recommended_action).toContain("consumidor autorizado");
    expect(publishDomainEventMock).not.toHaveBeenCalled();
    expect(upsertExternalEventDeliveryStateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", attemptCount: 1 }),
      expect.any(Object),
    );
  });

  it("retries transient delivery failures up to three attempts and then fails clearly", async () => {
    publishDomainEventMock
      .mockRejectedValueOnce(new Error("transient-1"))
      .mockRejectedValueOnce(new Error("transient-2"))
      .mockRejectedValueOnce(new Error("transient-3"));

    const result = await publishExternalEvents(
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        correlationId: "22222222-2222-4222-8222-222222222222",
        sourceReference: "REF-2026-04",
        eventState: "published",
        actorId: "system",
        actorRole: "integration_pipeline",
        payload: {
          ingestion_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          contract_version: "v1",
          validation_result: "success",
        },
      },
      {} as never,
    );

    expect(result.status).toBe("failed");
    expect(result.attempt_count).toBe(3);
    expect(result.failure_code).toBe("RETRY_EXHAUSTED");
    expect(result.last_error).toBe("transient-3");
    expect(publishDomainEventMock).toHaveBeenCalledTimes(3);
    expect(upsertExternalEventDeliveryStateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", attemptCount: 3, failureCode: "RETRY_EXHAUSTED" }),
      expect.any(Object),
    );
  });

  it("retries stale delivering records instead of keeping them locked", async () => {
    getExternalEventDeliveryByFingerprintMock.mockResolvedValueOnce({
      tenant_id: "11111111-1111-4111-8111-111111111111",
      consumer_key: "consumer-a",
      event_name: "integrations.external_ingestion.received.v1",
      event_version: "v1",
      source_reference: "REF-2026-04",
      fingerprint: "fingerprint-a",
      idempotency_key: "fingerprint-a",
      status: "delivering",
      attempt_count: 1,
      last_attempt_at: "2026-04-13T00:00:00.000Z",
      last_error: null,
      failure_code: null,
      recommended_action: null,
      payload_summary: {},
      correlation_id: "22222222-2222-4222-8222-222222222222",
      delivered_at: null,
    });

    const result = await publishExternalEvents(
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        correlationId: "22222222-2222-4222-8222-222222222222",
        sourceReference: "REF-2026-04",
        eventState: "received",
        actorId: "system",
        actorRole: "integration_pipeline",
        payload: {
          ingestion_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          contract_version: "v1",
          validation_result: "success",
        },
      },
      {} as never,
    );

    expect(result.status).toBe("delivered");
    expect(result.attempt_count).toBe(2);
    expect(publishDomainEventMock).toHaveBeenCalledTimes(1);
  });

  it("returns failed aggregate status when any consumer fails", async () => {
    listAuthorizedExternalEventConsumersMock.mockResolvedValueOnce([
      {
        tenant_id: "11111111-1111-4111-8111-111111111111",
        consumer_key: "consumer-a",
        event_name: "integrations.external_ingestion.received.v1",
        event_version: "v1",
        is_active: true,
      },
      {
        tenant_id: "11111111-1111-4111-8111-111111111111",
        consumer_key: "consumer-b",
        event_name: "integrations.external_ingestion.received.v1",
        event_version: "v1",
        is_active: true,
      },
    ]);

    getExternalEventDeliveryByFingerprintMock
      .mockResolvedValueOnce({
        tenant_id: "11111111-1111-4111-8111-111111111111",
        consumer_key: "consumer-a",
        event_name: "integrations.external_ingestion.received.v1",
        event_version: "v1",
        source_reference: "REF-2026-04",
        fingerprint: "fp-a",
        idempotency_key: "fp-a",
        status: "delivered",
        attempt_count: 1,
        last_attempt_at: "2026-04-13T12:00:00.000Z",
        last_error: null,
        failure_code: null,
        recommended_action: null,
        payload_summary: {},
        correlation_id: "22222222-2222-4222-8222-222222222222",
        delivered_at: "2026-04-13T12:00:01.000Z",
      })
      .mockResolvedValueOnce(null);

    publishDomainEventMock
      .mockRejectedValueOnce(new Error("transient-1"))
      .mockRejectedValueOnce(new Error("transient-2"))
      .mockRejectedValueOnce(new Error("transient-3"));

    const result = await publishExternalEvents(
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        correlationId: "22222222-2222-4222-8222-222222222222",
        sourceReference: "REF-2026-04",
        eventState: "received",
        actorId: "system",
        actorRole: "integration_pipeline",
        payload: {
          ingestion_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          contract_version: "v1",
          validation_result: "success",
        },
      },
      {} as never,
    );

    expect(result.delivered_count).toBe(1);
    expect(result.failed_count).toBe(1);
    expect(result.status).toBe("failed");
  });
});