import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT_ID = "22222222-2222-4222-8222-222222222222";

const {
  validateSessionMock,
  dbSelectMock,
  dbFromMock,
  dbWhereMock,
  dbLimitMock,
  dbUpdateMock,
  dbSetMock,
  dbUpdateWhereMock,
  validateBatchImportFileMock,
  persistValidatedBatchImportMock,
  writeBatchImportAuditMock,
  writeBatchRoutingAuditMock,
  writeBatchReprocessAuditMock,
  reprocessExceptionsForBatchMock,
} = vi.hoisted(() => ({
  validateSessionMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbFromMock: vi.fn(),
  dbWhereMock: vi.fn(),
  dbLimitMock: vi.fn(),
  dbUpdateMock: vi.fn(),
  dbSetMock: vi.fn(),
  dbUpdateWhereMock: vi.fn(),
  validateBatchImportFileMock: vi.fn(),
  persistValidatedBatchImportMock: vi.fn(),
  writeBatchImportAuditMock: vi.fn(),
  writeBatchRoutingAuditMock: vi.fn(),
  writeBatchReprocessAuditMock: vi.fn(),
  reprocessExceptionsForBatchMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ validateSession: validateSessionMock }));

vi.mock("@/lib/rh/batches/import-validation", () => ({
  BATCH_DOCUMENT_TYPES: ["holerite", "cartao_ponto"],
  validateBatchImportFile: validateBatchImportFileMock,
}));

vi.mock("@/lib/rh/batches/import-batch", () => ({
  persistValidatedBatchImport: persistValidatedBatchImportMock,
  writeBatchImportAudit: writeBatchImportAuditMock,
}));

vi.mock("@/lib/rh/batches/batch-routing-audit", () => ({
  writeBatchRoutingAudit: writeBatchRoutingAuditMock,
}));

vi.mock("@/lib/rh/batches/reprocess-audit", () => ({
  writeBatchReprocessAudit: writeBatchReprocessAuditMock,
}));

vi.mock("@/modules/exceptions/application/reprocess-exceptions", () => ({
  reprocessExceptionsForBatch: reprocessExceptionsForBatchMock,
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: dbSelectMock.mockReturnValue({
      from: dbFromMock.mockReturnValue({
        where: dbWhereMock.mockReturnValue({
          limit: dbLimitMock,
        }),
      }),
    }),
    update: dbUpdateMock.mockReturnValue({
      set: dbSetMock.mockReturnValue({
        where: dbUpdateWhereMock,
      }),
    }),
  },
}));

import { POST } from "@/app/api/v1/rh/batches/route";
import { POST as PROCESS_BATCH } from "@/app/api/v1/rh/batches/[batchId]/process/route";
import { POST as REPROCESS_BATCH } from "@/app/api/v1/rh/batches/[batchId]/reprocess/route";
import { GET as GET_BATCH_DETAILS } from "@/app/api/v1/rh/batches/[batchId]/route";

describe("rh batch import api", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    dbWhereMock.mockReturnValue({
      limit: dbLimitMock,
    });
    dbFromMock.mockReturnValue({
      where: dbWhereMock,
    });
    dbSelectMock.mockReturnValue({
      from: dbFromMock,
    });
    dbSetMock.mockReturnValue({
      where: dbUpdateWhereMock,
    });
    dbUpdateMock.mockReturnValue({
      set: dbSetMock,
    });

    validateSessionMock.mockResolvedValue({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: SESSION_TENANT_ID,
    });

    dbLimitMock.mockResolvedValue([{ role: "rh_operator" }]);

    validateBatchImportFileMock.mockResolvedValue({
      is_valid: true,
      validation_status: "validated",
      original_filename: "lote-rh.csv",
      mime_type: "text/csv",
      file_size_bytes: 128,
      rows: [
        {
          employee_identifier: "123",
          document_type: "holerite",
          period_ref: "2026-03",
        },
      ],
      summary: {
        source_format: "csv",
        total_rows: 1,
        valid_rows: 1,
        invalid_rows: 0,
        critical_issue_count: 0,
        warning_issue_count: 0,
        issues: [],
      },
    });

    persistValidatedBatchImportMock.mockResolvedValue({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
    dbUpdateWhereMock.mockResolvedValue(undefined);
    writeBatchRoutingAuditMock.mockResolvedValue(undefined);
    writeBatchReprocessAuditMock.mockResolvedValue(undefined);
    reprocessExceptionsForBatchMock.mockResolvedValue({
      batch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      idempotency_key: "idem-key-123",
      total_requested: 1,
      total_eligible: 1,
      total_reprocessed: 1,
      total_resolved: 1,
      total_remaining: 0,
      total_failed: 0,
      items: [
        {
          exception_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          previous_state: "in-treatment",
          current_state: "resolved",
          status: "reprocessed",
          reason: null,
        },
      ],
      processed_at: "2026-04-13T12:00:00.000Z",
    });
  });

  it("imports a valid batch report with tenant scoped success", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new File([
        "employee_identifier,document_type,period_ref\n123,holerite,2026-03",
      ], "lote-rh.csv", { type: "text/csv" }),
    );

    const request = new NextRequest("http://localhost/api/v1/rh/batches", {
      method: "POST",
      headers: {
        cookie: "session_id=token",
        "x-correlation-id": "11111111-1111-4111-8111-111111111111",
      },
      body: formData,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("x-correlation-id")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(body.data.batch_id).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(validateBatchImportFileMock).toHaveBeenCalled();
    expect(persistValidatedBatchImportMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: SESSION_TENANT_ID }),
      expect.anything(),
    );
  });

  it("rejects requests without session", async () => {
    const formData = new FormData();
    formData.append("file", new File(["employee_identifier,document_type,period_ref\n123,holerite,2026-03"], "lote-rh.csv", { type: "text/csv" }));

    const request = new NextRequest("http://localhost/api/v1/rh/batches", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects non-rh operator role", async () => {
    dbLimitMock.mockResolvedValue([{ role: "colaborador" }]);

    const formData = new FormData();
    formData.append("file", new File(["employee_identifier,document_type,period_ref\n123,holerite,2026-03"], "lote-rh.csv", { type: "text/csv" }));

    const request = new NextRequest("http://localhost/api/v1/rh/batches", {
      method: "POST",
      headers: { cookie: "session_id=token" },
      body: formData,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("rejects invalid batch files with validation error", async () => {
    validateBatchImportFileMock.mockResolvedValue({
      is_valid: false,
      validation_status: "blocked",
      original_filename: "lote-rh.csv",
      mime_type: "text/csv",
      file_size_bytes: 120,
      rows: [],
      summary: {
        source_format: "csv",
        total_rows: 0,
        valid_rows: 0,
        invalid_rows: 1,
        critical_issue_count: 1,
        warning_issue_count: 0,
        issues: [
          {
            code: "missing_column",
            message: "Coluna obrigatoria ausente: period_ref.",
            severity: "critical",
          },
        ],
      },
    });

    const formData = new FormData();
    formData.append("file", new File(["employee_identifier,document_type\n123,holerite"], "lote-rh.csv", { type: "text/csv" }));

    const request = new NextRequest("http://localhost/api/v1/rh/batches", {
      method: "POST",
      headers: { cookie: "session_id=token" },
      body: formData,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(writeBatchImportAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failure", tenantId: SESSION_TENANT_ID }),
      expect.anything(),
    );
  });

  it("returns progress for a validated batch", async () => {
    dbLimitMock
      .mockResolvedValueOnce([{ role: "rh_operator" }])
      .mockResolvedValueOnce([
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          tenantId: SESSION_TENANT_ID,
          routingStatus: "pending",
          routingTotalCount: 2,
          routingMatchedCount: 0,
          routingPendingCount: 2,
          routingFailedCount: 0,
          routingAmbiguousCount: 0,
          routingBlockedReason: null,
          routingProcessedAt: null,
        },
      ]);

    const request = new NextRequest(
      "http://localhost/api/v1/rh/batches/bbbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      {
        headers: {
          cookie: "session_id=token",
          "x-correlation-id": "11111111-1111-4111-8111-111111111111",
        },
      },
    );

    const response = await GET_BATCH_DETAILS(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.routing_status).toBe("pending");
    expect(body.data.pending_documents).toBe(2);
    expect(response.headers.get("x-correlation-id")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("processes a batch and blocks ambiguous documents", async () => {
    dbLimitMock
      .mockResolvedValueOnce([{ role: "rh_operator" }])
      .mockResolvedValueOnce([
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          tenantId: SESSION_TENANT_ID,
          validationStatus: "validated",
          routingStatus: "pending",
          routingManifest: [
            {
              document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:1",
              employee_identifier: "123",
              document_type: "holerite",
              period_ref: "2026-03",
            },
            {
              document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:2",
              employee_identifier: "123",
              document_type: "holerite",
              period_ref: "2026-03",
            },
          ],
          routingTotalCount: 2,
          routingMatchedCount: 0,
          routingPendingCount: 2,
          routingFailedCount: 0,
          routingAmbiguousCount: 0,
          routingBlockedReason: null,
          routingProcessedAt: null,
        },
      ]);

    const request = new NextRequest(
      "http://localhost/api/v1/rh/batches/bbbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/process",
      {
        method: "POST",
        headers: { cookie: "session_id=token", "x-correlation-id": "cid-123" },
      },
    );

    const response = await PROCESS_BATCH(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.routing_status).toBe("blocked");
    expect(body.data.ambiguous_documents).toBe(2);
    expect(body.data.items[0].blocked_reason_code).toBeTruthy();
    expect(body.data.items[0].blocked_reason_message).toBeTruthy();
    expect(writeBatchRoutingAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        status: "failure",
      }),
    );
  });

  it("returns correlation header on invalid batch processing request", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/rh/batches/invalid/process",
      {
        method: "POST",
        headers: {
          cookie: "session_id=token",
          "x-correlation-id": "22222222-2222-4222-8222-222222222222",
        },
      },
    );

    const response = await PROCESS_BATCH(request, {
      params: Promise.resolve({ batchId: "invalid" }),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("x-correlation-id")).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
  });

  it("rejects tenant mismatches when reading batch progress", async () => {
    dbLimitMock
      .mockResolvedValueOnce([{ role: "rh_operator" }])
      .mockResolvedValueOnce([
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          tenantId: OTHER_TENANT_ID,
          routingStatus: "pending",
          routingTotalCount: 2,
          routingMatchedCount: 0,
          routingPendingCount: 2,
          routingFailedCount: 0,
          routingAmbiguousCount: 0,
          routingBlockedReason: null,
          routingProcessedAt: null,
        },
      ]);

    const request = new NextRequest(
      "http://localhost/api/v1/rh/batches/bbbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      {
        headers: { cookie: "session_id=token" },
      },
    );

    const response = await GET_BATCH_DETAILS(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });

    expect(response.status).toBe(403);
  });

  it("reprocesses eligible exceptions with idempotency key", async () => {
    dbLimitMock
      .mockResolvedValueOnce([{ role: "rh_operator" }])
      .mockResolvedValueOnce([
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          tenantId: SESSION_TENANT_ID,
          validationStatus: "validated",
        },
      ]);

    const request = new NextRequest(
      "http://localhost/api/v1/rh/batches/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/reprocess",
      {
        method: "POST",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
          "x-correlation-id": "11111111-1111-4111-8111-111111111111",
        },
        body: JSON.stringify({
          exception_ids: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
          reprocess_all_eligible: false,
          idempotency_key: "idem-key-123",
        }),
      },
    );

    const response = await REPROCESS_BATCH(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("x-correlation-id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.data.total_reprocessed).toBe(1);
    expect(reprocessExceptionsForBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        tenantId: SESSION_TENANT_ID,
        idempotencyKey: "idem-key-123",
        exceptionIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
      }),
    );
    expect(writeBatchReprocessAuditMock).toHaveBeenCalled();
  });

  it("rejects invalid reprocess payload when no selection mode is provided", async () => {
    dbLimitMock
      .mockResolvedValueOnce([{ role: "rh_operator" }])
      .mockResolvedValueOnce([
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          tenantId: SESSION_TENANT_ID,
          validationStatus: "validated",
        },
      ]);

    const request = new NextRequest(
      "http://localhost/api/v1/rh/batches/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/reprocess",
      {
        method: "POST",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          idempotency_key: "idem-key-123",
          reprocess_all_eligible: false,
        }),
      },
    );

    const response = await REPROCESS_BATCH(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects reprocess payload when both selection modes are provided", async () => {
    dbLimitMock
      .mockResolvedValueOnce([{ role: "rh_operator" }])
      .mockResolvedValueOnce([
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          tenantId: SESSION_TENANT_ID,
          validationStatus: "validated",
        },
      ]);

    const request = new NextRequest(
      "http://localhost/api/v1/rh/batches/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/reprocess",
      {
        method: "POST",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          exception_ids: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
          reprocess_all_eligible: true,
          idempotency_key: "idem-key-123",
        }),
      },
    );

    const response = await REPROCESS_BATCH(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects reprocess when session is missing", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/rh/batches/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/reprocess",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          exception_ids: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
          idempotency_key: "idem-key-123",
        }),
      },
    );

    const response = await REPROCESS_BATCH(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });

    expect(response.status).toBe(401);
  });

  it("rejects reprocess when role is not rh_operator", async () => {
    dbLimitMock.mockResolvedValue([{ role: "colaborador" }]);

    const request = new NextRequest(
      "http://localhost/api/v1/rh/batches/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/reprocess",
      {
        method: "POST",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          exception_ids: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
          idempotency_key: "idem-key-123",
        }),
      },
    );

    const response = await REPROCESS_BATCH(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });

    expect(response.status).toBe(403);
  });

  it("rejects reprocess for batch from another tenant", async () => {
    dbLimitMock
      .mockResolvedValueOnce([{ role: "rh_operator" }])
      .mockResolvedValueOnce([
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          tenantId: OTHER_TENANT_ID,
          validationStatus: "validated",
        },
      ]);

    const request = new NextRequest(
      "http://localhost/api/v1/rh/batches/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/reprocess",
      {
        method: "POST",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reprocess_all_eligible: true,
          idempotency_key: "idem-key-123",
        }),
      },
    );

    const response = await REPROCESS_BATCH(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });

    expect(response.status).toBe(403);
  });
});
