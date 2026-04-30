import { describe, expect, it } from "vitest";
import {
  buildExternalIngestionTimeline,
  classifyExternalIngestionFailure,
  getSupportedContractVersions,
  isValidExternalIngestionStatusTransition,
  normalizeExternalIngestionFilters,
  normalizeExternalIngestionRegistration,
  resolveExternalIdentifierMapping,
  validateExternalIngestionContract,
} from "@/modules/integrations/domain/external-ingestion";

describe("external ingestions domain", () => {
  it("normalizes registration and trims values", () => {
    const normalized = normalizeExternalIngestionRegistration({
      tenantId: "11111111-1111-4111-8111-111111111111",
      sourceSystem: "payroll-api",
      contractVersion: " v1 ",
      sourceReference: " REF-2026-04 ",
      idempotencyKey: " idem-12345678 ",
      payloadSummary: { documents: 10 },
    });

    expect(normalized.tenantId).toBe("11111111-1111-4111-8111-111111111111");
    expect(normalized.sourceSystem).toBe("payroll-api");
    expect(normalized.contractVersion).toBe("v1");
    expect(normalized.sourceReference).toBe("REF-2026-04");
    expect(normalized.idempotencyKey).toBe("idem-12345678");
  });

  it("defaults ambiguous mapping to AMBIGUOUS_ASSOCIATION failure code", () => {
    const normalized = normalizeExternalIngestionRegistration({
      tenantId: "11111111-1111-4111-8111-111111111111",
      sourceSystem: "payroll-api",
      contractVersion: "v1",
      sourceReference: "REF-2026-04",
      idempotencyKey: "idem-12345678",
      mappingStatus: "ambiguous",
    });

    expect(normalized.status).toBe("failed");
    expect(normalized.failureCode).toBe("AMBIGUOUS_ASSOCIATION");
  });

  it("preserves finalized ingestion snapshot without retroactive default rewrites", () => {
    const normalized = normalizeExternalIngestionRegistration({
      tenantId: "11111111-1111-4111-8111-111111111111",
      sourceSystem: "payroll-api",
      contractVersion: "v1",
      sourceReference: "REF-2026-04",
      idempotencyKey: "idem-12345678",
      externalIdentifier: "EXT-0001",
      mappedEmployeeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      mappingVersion: 7,
      mappingStatus: "mapped",
      status: "processed",
      failureCode: null,
    });

    expect(normalized.status).toBe("processed");
    expect(normalized.mappingVersion).toBe(7);
    expect(normalized.externalIdentifier).toBe("EXT-0001");
    expect(normalized.mappedEmployeeId).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(normalized.failureCode).toBeNull();
  });

  it("rejects unauthorized external source", () => {
    expect(() =>
      normalizeExternalIngestionRegistration({
        tenantId: "11111111-1111-4111-8111-111111111111",
        sourceSystem: "erp-x",
        contractVersion: "v1",
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

  it("validates supported contract version with valid payload schema", () => {
    const result = validateExternalIngestionContract({
      sourceSystem: "payroll-api",
      contractVersion: "v1",
      payloadSummary: {
        period: "2026-04",
        documents: 15,
        employee_count: 120,
      },
    });

    expect(result.success).toBe(true);
    expect(result.contract_version).toBe("v1");
    expect(result.validation_result).toBe("success");
    expect(result.failure_code).toBeNull();
  });

  it("rejects unsupported contract version", () => {
    const result = validateExternalIngestionContract({
      sourceSystem: "payroll-api",
      contractVersion: "v999",
      payloadSummary: {
        period: "2026-04",
        documents: 15,
      },
    });

    expect(result.success).toBe(false);
    expect(result.validation_result).toBe("failure");
    expect(result.failure_code).toBe("INVALID_CONTRACT_VERSION");
  });

  it("rejects payload out of schema for active version", () => {
    const result = validateExternalIngestionContract({
      sourceSystem: "payroll-api",
      contractVersion: "v1",
      payloadSummary: {
        period: "2026-04",
      },
    });

    expect(result.success).toBe(false);
    expect(result.validation_result).toBe("failure");
    expect(result.failure_code).toBe("INVALID_PAYLOAD");
  });

  it("exposes controlled compatibility matrix by source", () => {
    expect(getSupportedContractVersions("payroll-api")).toEqual(["v1", "v2"]);
    expect(getSupportedContractVersions("sftp-gateway")).toEqual(["v1"]);
  });

  it("resolves external identifier mapping with deterministic version snapshot", () => {
    const result = resolveExternalIdentifierMapping({
      tenantId: "11111111-1111-4111-8111-111111111111",
      sourceSystem: "payroll-api",
      externalIdentifier: "EMP-0001",
      candidates: [
        {
          tenant_id: "11111111-1111-4111-8111-111111111111",
          source_system: "payroll-api",
          external_identifier: "EMP-0001",
          employee_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          mapping_version: 3,
          is_active: true,
        },
      ],
    });

    expect(result.status).toBe("mapped");
    expect(result.failure_code).toBeNull();
    expect(result.mapped_employee_id).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(result.mapping_version).toBe(3);
  });

  it("blocks ambiguous mappings and returns explicit failure classification", () => {
    const result = resolveExternalIdentifierMapping({
      tenantId: "11111111-1111-4111-8111-111111111111",
      sourceSystem: "payroll-api",
      externalIdentifier: "EMP-0001",
      candidates: [
        {
          tenant_id: "11111111-1111-4111-8111-111111111111",
          source_system: "payroll-api",
          external_identifier: "EMP-0001",
          employee_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          mapping_version: 3,
          is_active: true,
        },
        {
          tenant_id: "11111111-1111-4111-8111-111111111111",
          source_system: "payroll-api",
          external_identifier: "EMP-0001",
          employee_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          mapping_version: 4,
          is_active: true,
        },
      ],
    });

    expect(result.status).toBe("ambiguous");
    expect(result.failure_code).toBe("AMBIGUOUS_ASSOCIATION");
    expect(result.recommended_action).toContain("excecao");
    expect(result.mapped_employee_id).toBeNull();
  });
});
