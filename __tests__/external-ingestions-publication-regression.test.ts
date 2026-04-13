import { beforeEach, describe, expect, it, vi } from "vitest";

const { registerExternalIngestionInDbMock, publishExternalEventsMock } = vi.hoisted(() => ({
  registerExternalIngestionInDbMock: vi.fn(),
  publishExternalEventsMock: vi.fn(),
}));

vi.mock("@/modules/integrations/infrastructure/external-ingestions-repository", () => ({
  ExternalIngestionRepositoryError: class extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly statusCode: number,
      public readonly details?: Record<string, unknown>,
    ) {
      super(message);
      this.name = "ExternalIngestionRepositoryError";
    }
  },
  registerExternalIngestionInDb: registerExternalIngestionInDbMock,
}));

vi.mock("@/modules/integrations/application/publish-external-events", () => ({
  publishExternalEvents: publishExternalEventsMock,
}));

import { registerExternalIngestion } from "@/modules/integrations/application/register-external-ingestion";

describe("external ingestion publication regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    registerExternalIngestionInDbMock.mockResolvedValue({
      ingestion_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      tenant_id: "11111111-1111-4111-8111-111111111111",
      source_system: "payroll-api",
      contract_version: "v1",
      source_reference: "REF-2026-04",
      idempotency_key: "idem-12345678",
      status: "received",
      contract_validation: {
        contract_version: "v1",
        validation_result: "success",
        failure_code: null,
        validated_at: "2026-04-13T12:00:00.000Z",
      },
      received_at: "2026-04-13T12:00:00.000Z",
      processing_started_at: null,
      processed_at: null,
      failed_at: null,
      resolution: { failure_code: null, recommended_action: null },
      correlation_id: "22222222-2222-4222-8222-222222222222",
      payload_summary: {},
      timeline: [],
      mapping: {
        status: "not-found",
        external_identifier: null,
        mapped_employee_id: null,
        mapping_version: null,
      },
    });

    publishExternalEventsMock.mockRejectedValue(new Error("consumer down"));
  });

  it("returns the durable ingestion result even if external publication fails", async () => {
    const result = await registerExternalIngestion({
      tenantId: "11111111-1111-4111-8111-111111111111",
      sourceSystem: "payroll-api",
      contractVersion: "v1",
      sourceReference: "REF-2026-04",
      idempotencyKey: "idem-12345678",
      correlationId: "22222222-2222-4222-8222-222222222222",
      payloadSummary: { period: "2026-04", documents: 15 },
    });

    expect(result.ingestion_id).toBe("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
    expect(publishExternalEventsMock).toHaveBeenCalled();
  });

  it("publishes received before validated to preserve causal ordering", async () => {
    publishExternalEventsMock.mockReset();
    publishExternalEventsMock.mockResolvedValue({ status: "delivered" });

    await registerExternalIngestion({
      tenantId: "11111111-1111-4111-8111-111111111111",
      sourceSystem: "payroll-api",
      contractVersion: "v1",
      sourceReference: "REF-2026-04",
      idempotencyKey: "idem-12345678",
      correlationId: "22222222-2222-4222-8222-222222222222",
      payloadSummary: { period: "2026-04", documents: 15 },
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(publishExternalEventsMock).toHaveBeenCalledTimes(2);
    expect(publishExternalEventsMock.mock.calls[0][0]).toMatchObject({ eventState: "received" });
    expect(publishExternalEventsMock.mock.calls[1][0]).toMatchObject({ eventState: "validated" });
  });
});