import { describe, expect, it } from "vitest";
import {
  buildExternalEvent,
  computeExternalEventDeliveryFingerprint,
  getExternalEventName,
} from "@/modules/integrations/domain/external-events";

describe("external events domain", () => {
  it("builds canonical event envelopes for allowed states", () => {
    const event = buildExternalEvent({
      state: "received",
      tenantId: "11111111-1111-4111-8111-111111111111",
      correlationId: "22222222-2222-4222-8222-222222222222",
      actorId: "system",
      actorRole: "integration_pipeline",
      sourceReference: "REF-2026-04",
      payload: {
        ingestion_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        contract_version: "v1",
        validation_result: "success",
      },
    });

    expect(event.event_name).toBe("integrations.external_ingestion.received.v1");
    expect(event.event_version).toBe("v1");
    expect(event.correlation_id).toBe("22222222-2222-4222-8222-222222222222");
    expect(event.payload).toMatchObject({
      event_state: "received",
      source_reference: "REF-2026-04",
      ingestion_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      contract_version: "v1",
      validation_result: "success",
    });
  });

  it("rejects sensitive or non-allowed payload fields", () => {
    expect(() =>
      buildExternalEvent({
        state: "exception",
        tenantId: "11111111-1111-4111-8111-111111111111",
        correlationId: "22222222-2222-4222-8222-222222222222",
        actorId: "system",
        actorRole: "integration_pipeline",
        sourceReference: "REF-2026-04",
        payload: {
          raw_payload: "should-not-leak",
        },
      }),
    ).toThrow("payload externo contem campos sensiveis nao permitidos.");
  });

  it("computes deterministic delivery fingerprints for the same consumer and event", () => {
    const baseInput = {
      tenantId: "11111111-1111-4111-8111-111111111111",
      eventName: getExternalEventName("published"),
      eventVersion: "v1",
      sourceReference: "REF-2026-04",
      consumerKey: "consumer-a",
    };

    const fingerprintA = computeExternalEventDeliveryFingerprint(baseInput);
    const fingerprintB = computeExternalEventDeliveryFingerprint(baseInput);
    const fingerprintC = computeExternalEventDeliveryFingerprint({ ...baseInput, consumerKey: "consumer-b" });

    expect(fingerprintA).toBe(fingerprintB);
    expect(fingerprintA).not.toBe(fingerprintC);
  });
});