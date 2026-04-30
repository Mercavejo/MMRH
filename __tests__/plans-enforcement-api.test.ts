/**
 * plans-enforcement-api.test.ts
 *
 * Testa o enforcement de capabilities nos handlers de rota existentes:
 * - POST /api/v1/rh/batches → BATCH_INGESTION
 * - POST /api/v1/webhooks/integrations → EXTERNAL_INTEGRATIONS
 *
 * enforceCapability é mockado; o domínio de enforcement
 * é testado em plans-enforcement.test.ts separadamente.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ErrorCode } from "@/lib/api/errors";
import { signHmacSha256Hex } from "@/lib/security/hmac-signature";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const INTEGRATION_SECRET = "test-integration-secret";
const PAYLOAD_PATH = "/api/v1/webhooks/integrations";

function buildSignature(params: { method: string; path: string; timestamp: string; body: string }) {
  return signHmacSha256Hex(INTEGRATION_SECRET, [params.method, params.path, params.timestamp, params.body].join("\n"));
}

// ─── hoisted mocks ──────────────────────────────────────────────────────────
const {
  validateSessionMock,
  dbSelectMock,
  dbFromMock,
  dbWhereMock,
  dbLimitMock,
  dbInsertMock,
  dbInsertValuesMock,
  enforceCapabilityMock,
  validateBatchImportFileMock,
  persistValidatedBatchImportMock,
  writeBatchImportAuditMock,
  registerExternalIngestionMock,
  resolveExternalIdentifierMappingMock,
  upsertExternalIdentifierMappingMock,
  listExternalIngestionsMock,
  writePlaytestEventMock,
} = vi.hoisted(() => {
  const dbInsertValuesMock = vi.fn().mockResolvedValue(undefined);
  const dbInsertMock = vi.fn().mockReturnValue({ values: dbInsertValuesMock });

  return {
    validateSessionMock: vi.fn(),
    dbSelectMock: vi.fn(),
    dbFromMock: vi.fn(),
    dbWhereMock: vi.fn(),
    dbLimitMock: vi.fn(),
    dbInsertMock,
    dbInsertValuesMock,
    enforceCapabilityMock: vi.fn(),
    validateBatchImportFileMock: vi.fn(),
    persistValidatedBatchImportMock: vi.fn(),
    writeBatchImportAuditMock: vi.fn(),
    registerExternalIngestionMock: vi.fn(),
    resolveExternalIdentifierMappingMock: vi.fn(),
    upsertExternalIdentifierMappingMock: vi.fn(),
    listExternalIngestionsMock: vi.fn(),
    writePlaytestEventMock: vi.fn(),
  };
});

// ─── module mocks ───────────────────────────────────────────────────────────
vi.mock("@/lib/auth/session", () => ({ validateSession: validateSessionMock }));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: dbSelectMock.mockReturnValue({
      from: dbFromMock.mockReturnValue({
        where: dbWhereMock.mockReturnValue({
          limit: dbLimitMock,
        }),
      }),
    }),
    insert: dbInsertMock,
  },
}));

vi.mock("@/modules/plans/application/enforce-capability", () => ({
  enforceCapability: enforceCapabilityMock,
}));

vi.mock("@/lib/observability/playtest-audit", () => ({
  writePlaytestEvent: writePlaytestEventMock,
}));

// Batches mocks
vi.mock("@/lib/rh/batches/import-validation", () => ({
  BATCH_DOCUMENT_TYPES: ["holerite", "cartao_ponto"],
  validateBatchImportFile: validateBatchImportFileMock,
}));

vi.mock("@/lib/rh/batches/import-batch", () => ({
  persistValidatedBatchImport: persistValidatedBatchImportMock,
  writeBatchImportAudit: writeBatchImportAuditMock,
}));

vi.mock("@/lib/rh/batches/batch-routing-audit", () => ({
  writeBatchRoutingAudit: vi.fn(),
}));

vi.mock("@/lib/rh/batches/reprocess-audit", () => ({
  writeBatchReprocessAudit: vi.fn(),
}));

vi.mock("@/modules/exceptions/application/reprocess-exceptions", () => ({
  reprocessExceptionsForBatch: vi.fn(),
}));

// Integrations mocks
vi.mock("@/modules/integrations/application/register-external-ingestion", () => ({
  registerExternalIngestion: registerExternalIngestionMock,
  ExternalIngestionError: class extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly statusCode: number,
      public readonly details?: Record<string, unknown>,
    ) {
      super(message);
      this.name = "ExternalIngestionError";
    }
  },
}));

vi.mock("@/modules/integrations/application/resolve-external-identifier-mapping", () => ({
  resolveExternalIdentifierMappingForIntake: resolveExternalIdentifierMappingMock,
  ExternalIngestionError: class extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "ExternalIngestionError";
    }
  },
}));

vi.mock("@/modules/integrations/application/upsert-external-identifier-mapping", () => ({
  upsertExternalIdentifierMappingRule: upsertExternalIdentifierMappingMock,
  ExternalIngestionError: class extends Error { constructor(code: string, message: string, public statusCode: number) { super(message); this.name = "ExternalIngestionError"; } },
}));

vi.mock("@/modules/integrations/application/list-external-ingestions", () => ({
  listExternalIngestions: listExternalIngestionsMock,
  ExternalIngestionError: class extends Error { constructor(code: string, message: string, public statusCode: number) { super(message); this.name = "ExternalIngestionError"; } },
}));

// ─── imports under test ─────────────────────────────────────────────────────
import { CapabilityForbiddenError, Capability } from "@/modules/plans/domain/capabilities";
import { POST as POST_BATCHES } from "@/app/api/v1/rh/batches/route";
import { POST as POST_INTEGRATIONS } from "@/app/api/v1/webhooks/integrations/route";

// ─────────────────────────────────────────────────────────────────────────────
describe("plans-enforcement-api — POST /api/v1/rh/batches (BATCH_INGESTION)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-configure after clearAllMocks wipes implementations
    dbInsertMock.mockReturnValue({ values: dbInsertValuesMock });
    dbInsertValuesMock.mockResolvedValue(undefined);

    validateSessionMock.mockResolvedValue({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: SESSION_TENANT_ID,
    });

    dbLimitMock.mockResolvedValue([{ role: "rh_operator" }]);
    enforceCapabilityMock.mockResolvedValue(undefined);
    dbInsertValuesMock.mockResolvedValue(undefined);

    validateBatchImportFileMock.mockResolvedValue({
      is_valid: true,
      validation_status: "validated",
      original_filename: "lote.csv",
      mime_type: "text/csv",
      file_size_bytes: 128,
      rows: [{ employee_identifier: "123", document_type: "holerite", period_ref: "2026-04" }],
      summary: { source_format: "csv", total_rows: 1, valid_rows: 1, invalid_rows: 0, critical_issue_count: 0, warning_issue_count: 0, issues: [] },
    });

    persistValidatedBatchImportMock.mockResolvedValue({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
    writeBatchImportAuditMock.mockResolvedValue(undefined);
    writePlaytestEventMock.mockResolvedValue(undefined);
  });

  it("returns 403 CAPABILITY_FORBIDDEN when tenant lacks BATCH_INGESTION", async () => {
    enforceCapabilityMock.mockRejectedValueOnce(
      new CapabilityForbiddenError({
        capability: Capability.BATCH_INGESTION,
        planCode: "base",
        upgradeHint: "upgrade para professional",
      }),
    );

    const formData = new FormData();
    formData.append("file", new File(["emp,doc,period\n123,holerite,2026-04"], "b.csv", { type: "text/csv" }));

    const request = new NextRequest("http://localhost/api/v1/rh/batches", {
      method: "POST",
      headers: {
        cookie: "session_id=valid-token",
        "x-correlation-id": "11111111-1111-4111-8111-111111111111",
      },
      body: formData,
    });

    const response = await POST_BATCHES(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe(ErrorCode.CapabilityForbidden);
    expect(body.error.details.capability).toBe(Capability.BATCH_INGESTION);
    expect(body.error.details.planCode).toBe("base");
    expect(body.error.details.plan_code).toBe("base");
    expect(body.error.details.correlation_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.error.details.upgrade_hint).toBeTruthy();
    expect(response.headers.get("x-correlation-id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(persistValidatedBatchImportMock).not.toHaveBeenCalled();
    expect(writePlaytestEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "playtest.rh.batches.friction", status: "failure", details: expect.objectContaining({ cause: "capability_forbidden" }) })
    );
  });

  it("returns 201 when tenant has BATCH_INGESTION and batch is valid", async () => {
    enforceCapabilityMock.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.append("file", new File(["emp,doc,period\n123,holerite,2026-04"], "b.csv", { type: "text/csv" }));

    const request = new NextRequest("http://localhost/api/v1/rh/batches", {
      method: "POST",
      headers: {
        cookie: "session_id=valid-token",
        "x-correlation-id": "11111111-1111-4111-8111-111111111111",
      },
      body: formData,
    });

    const response = await POST_BATCHES(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.batch_id).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(enforceCapabilityMock).toHaveBeenCalledWith(SESSION_TENANT_ID, Capability.BATCH_INGESTION, expect.any(String), expect.any(String));
  });

  it("returns 401 when no session (enforcement nao chega a ser chamado)", async () => {
    validateSessionMock.mockResolvedValueOnce(null);

    const formData = new FormData();
    formData.append("file", new File(["a"], "b.csv", { type: "text/csv" }));

    const request = new NextRequest("http://localhost/api/v1/rh/batches", {
      method: "POST",
      body: formData,
    });

    const response = await POST_BATCHES(request);
    expect(response.status).toBe(401);
    expect(enforceCapabilityMock).not.toHaveBeenCalled();
  });

  it("correlation_id presente em resposta de bloqueio por capability", async () => {
    enforceCapabilityMock.mockRejectedValueOnce(
      new CapabilityForbiddenError({ capability: Capability.BATCH_INGESTION, planCode: "base" }),
    );

    const formData = new FormData();
    formData.append("file", new File(["a"], "b.csv", { type: "text/csv" }));

    const request = new NextRequest("http://localhost/api/v1/rh/batches", {
      method: "POST",
      headers: {
        cookie: "session_id=valid-token",
        "x-correlation-id": "22222222-2222-4222-8222-222222222222",
      },
      body: formData,
    });

    const response = await POST_BATCHES(request);
    const body = await response.json();

    expect(response.headers.get("x-correlation-id")).toBe("22222222-2222-4222-8222-222222222222");
    expect(body.meta.correlation_id).toBe("22222222-2222-4222-8222-222222222222");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("plans-enforcement-api — POST /api/v1/webhooks/integrations (EXTERNAL_INTEGRATIONS)", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Re-configure after resetAllMocks wipes all implementations
    dbSelectMock.mockReturnValue({ from: dbFromMock });
    dbFromMock.mockReturnValue({ where: dbWhereMock });
    dbWhereMock.mockReturnValue({ limit: dbLimitMock });
    dbInsertMock.mockReturnValue({ values: dbInsertValuesMock });
    dbInsertValuesMock.mockResolvedValue(undefined);

    process.env.PAYROLL_API_EXTERNAL_INGESTION_SECRET = INTEGRATION_SECRET;
    process.env.SFTP_GATEWAY_EXTERNAL_INGESTION_SECRET = INTEGRATION_SECRET;

    enforceCapabilityMock.mockResolvedValue(undefined);

    resolveExternalIdentifierMappingMock.mockResolvedValue({
      status: "mapped",
      failure_code: null,
      recommended_action: null,
      mapped_employee_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      mapping_version: 1,
      external_identifier: "EMP-0001",
    });

    registerExternalIngestionMock.mockResolvedValue({
      ingestion_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      tenant_id: SESSION_TENANT_ID,
      source_system: "payroll-api",
      contract_version: "v1",
      source_reference: "REF-2026-04",
      idempotency_key: "idem-12345678",
      status: "received",
      contract_validation: { contract_version: "v1", validation_result: "success", failure_code: null, validated_at: "2026-04-13T12:00:00.000Z" },
      received_at: "2026-04-13T12:00:00.000Z",
      processing_started_at: null, processed_at: null, failed_at: null,
      resolution: { failure_code: null, recommended_action: null },
      correlation_id: "11111111-1111-4111-8111-111111111111",
      payload_summary: {},
      timeline: [],
    });
  });

  function makeValidIntakeRequest(correlationId = "11111111-1111-4111-8111-111111111111") {
    const timestamp = new Date().toISOString();
    const requestBody = JSON.stringify({
      tenant_id: SESSION_TENANT_ID,
      contract_version: "v1",
      source_reference: "REF-2026-04",
      idempotency_key: "idem-12345678",
      payload_summary: { period: "2026-04", documents: 5 },
    });

    return new NextRequest("http://localhost/api/v1/webhooks/integrations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-integration-signature": buildSignature({ method: "POST", path: PAYLOAD_PATH, timestamp, body: requestBody }),
        "x-integration-timestamp": timestamp,
        "x-correlation-id": correlationId,
        "x-integration-source": "payroll-api",
      },
      body: requestBody,
    });
  }

  it("returns 403 CAPABILITY_FORBIDDEN when tenant lacks EXTERNAL_INTEGRATIONS", async () => {
    enforceCapabilityMock.mockRejectedValueOnce(
      new CapabilityForbiddenError({
        capability: Capability.EXTERNAL_INTEGRATIONS,
        planCode: "professional",
        upgradeHint: "upgrade para enterprise",
      }),
    );

    const response = await POST_INTEGRATIONS(makeValidIntakeRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe(ErrorCode.CapabilityForbidden);
    expect(body.error.details.capability).toBe(Capability.EXTERNAL_INTEGRATIONS);
    expect(body.error.details.planCode).toBe("professional");
    expect(body.error.details.plan_code).toBe("professional");
    expect(body.error.details.correlation_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.error.details.upgrade_hint).toBeTruthy();
    expect(registerExternalIngestionMock).not.toHaveBeenCalled();
  });

  it("allows intake (202) when tenant has EXTERNAL_INTEGRATIONS", async () => {
    enforceCapabilityMock.mockResolvedValue(undefined);

    const response = await POST_INTEGRATIONS(makeValidIntakeRequest());
    expect(response.status).toBe(202);
    expect(registerExternalIngestionMock).toHaveBeenCalled();
    expect(enforceCapabilityMock).toHaveBeenCalledWith(SESSION_TENANT_ID, Capability.EXTERNAL_INTEGRATIONS, null, expect.any(String));
  });

  it("correlation_id presente em resposta de bloqueio por capability", async () => {
    enforceCapabilityMock.mockRejectedValueOnce(
      new CapabilityForbiddenError({ capability: Capability.EXTERNAL_INTEGRATIONS, planCode: "base" }),
    );

    const response = await POST_INTEGRATIONS(makeValidIntakeRequest("55555555-5555-4555-8555-555555555555"));
    const body = await response.json();

    expect(response.headers.get("x-correlation-id")).toBe("55555555-5555-4555-8555-555555555555");
    expect(body.meta.correlation_id).toBe("55555555-5555-4555-8555-555555555555");
  });

  it("enforcement nao afeta rejeicao por assinatura invalida (antes do enforce)", async () => {
    // Invalid signature — should be rejected before enforceCapability is called
    const request = new NextRequest("http://localhost/api/v1/webhooks/integrations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-integration-source": "payroll-api",
        "x-integration-timestamp": new Date().toISOString(),
        "x-integration-signature": "invalid-signature",
      },
      body: JSON.stringify({ tenant_id: SESSION_TENANT_ID, contract_version: "v1", source_reference: "REF", idempotency_key: "idem-12345678" }),
    });

    const response = await POST_INTEGRATIONS(request);
    expect(response.status).toBe(403);
    expect(enforceCapabilityMock).not.toHaveBeenCalled();
  });
});
