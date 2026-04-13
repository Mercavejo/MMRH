import { describe, expect, it } from "vitest";
import {
  buildExternalIngestionTimeline,
  classifyExternalIngestionFailure,
  isValidExternalIngestionStatusTransition,
  normalizeExternalIngestionFilters,
  normalizeExternalIngestionRegistration,
} from "@/modules/integrations/domain/external-ingestion";

describe("external ingestions domain", () => {
  it("normalizes registration and trims values", () => {
    const normalized = normalizeExternalIngestionRegistration({
      tenantId: "11111111-1111-4111-8111-111111111111",
      sourceSystem: "payroll-api",
      sourceReference: " REF-2026-04 ",
      idempotencyKey: " idem-12345678 ",
      payloadSummary: { documents: 10 },
    });

    expect(normalized.tenantId).toBe("11111111-1111-4111-8111-111111111111");
    expect(normalized.sourceSystem).toBe("payroll-api");
    expect(normalized.sourceReference).toBe("REF-2026-04");
    expect(normalized.idempotencyKey).toBe("idem-12345678");
  });

  it("rejects unauthorized external source", () => {
    expect(() =>
      normalizeExternalIngestionRegistration({
        tenantId: "11111111-1111-4111-8111-111111111111",
        sourceSystem: "erp-x",
        sourceReference: "REF-2026-04",
        idempotencyKey: "idem-12345678",
      }),
    ).toThrow("origem externa nao autorizada.");
  });

  it("normalizes list filters with only allowed status/source", () => {
    const normalized = normalizeExternalIngestionFilters({
      status: "processed",
      sourceSystem: "sftp-gateway",
      ingestionId: "ing-1",
    });

    expect(normalized.status).toBe("processed");
    expect(normalized.sourceSystem).toBe("sftp-gateway");
    expect(normalized.ingestionId).toBe("ing-1");
  });

  it("validates status transitions", () => {
    expect(isValidExternalIngestionStatusTransition("received", "processing")).toBe(true);
    expect(isValidExternalIngestionStatusTransition("processing", "processed")).toBe(true);
    expect(isValidExternalIngestionStatusTransition("processed", "failed")).toBe(false);
  });

  it("classifies failure and returns actionable recommendation", () => {
    const classification = classifyExternalIngestionFailure("INVALID_PAYLOAD");

    expect(classification.status).toBe("failed");
    expect(classification.recommended_action).toContain("schema");
  });

  it("builds deterministic timeline entries", () => {
    const timeline = buildExternalIngestionTimeline({
      ingestion_id: "ing-1",
      status: "failed",
      received_at: "2026-04-13T12:00:00.000Z",
      processing_started_at: "2026-04-13T12:01:00.000Z",
      processed_at: null,
      failed_at: "2026-04-13T12:02:00.000Z",
    });

    expect(timeline).toHaveLength(3);
    expect(timeline[0]?.action).toBe("integrations.external_ingestion.received.v1");
    expect(timeline[2]?.status).toBe("failure");
  });
});
