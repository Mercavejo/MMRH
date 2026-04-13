import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT_ID = "22222222-2222-4222-8222-222222222222";

const {
  validateSessionMock,
  dbSelectMock,
  dbFromMock,
  dbWhereMock,
  dbLimitMock,
  listBatchExceptionsMock,
  getExceptionDetailMock,
  updateExceptionStateMock,
  recordCorrectiveExceptionActionMock,
} = vi.hoisted(() => ({
  validateSessionMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbFromMock: vi.fn(),
  dbWhereMock: vi.fn(),
  dbLimitMock: vi.fn(),
  listBatchExceptionsMock: vi.fn(),
  getExceptionDetailMock: vi.fn(),
  updateExceptionStateMock: vi.fn(),
  recordCorrectiveExceptionActionMock: vi.fn(),
}));

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
  },
}));

vi.mock("@/modules/exceptions/application/list-exceptions", () => ({
  listBatchExceptions: listBatchExceptionsMock,
}));

vi.mock("@/modules/exceptions/infrastructure/exception-repository", () => ({
  getExceptionDetail: getExceptionDetailMock,
  updateExceptionState: updateExceptionStateMock,
}));

vi.mock("@/modules/exceptions/application/record-exception-action", () => ({
  recordCorrectiveExceptionAction: recordCorrectiveExceptionActionMock,
}));

import { GET as GET_BATCH_EXCEPTIONS } from "@/app/api/v1/batches/[batch-id]/exceptions/route";
import { GET as GET_EXCEPTION, PATCH as PATCH_EXCEPTION } from "@/app/api/v1/exceptions/[exception-id]/route";
import { POST as POST_EXCEPTION_ACTION } from "@/app/api/v1/exceptions/[exception-id]/actions/route";

describe("exception api", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    validateSessionMock.mockResolvedValue({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: SESSION_TENANT_ID,
    });

    dbLimitMock.mockResolvedValue([{ role: "rh_operator" }]);

    listBatchExceptionsMock.mockResolvedValue({
      exceptions: [
        {
          id: "exc-1",
          batch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          batch_name: "Lote RH",
          document_external_id: "DOC-001",
          document_filename: "lote-rh.csv",
          associated_employee_id: "emp-1",
          assoc_employee_external_id: "EMP-1",
          associated_employee_name: "Maria",
          associated_employee_email: "maria@empresa.com",
          error_category: "ambiguous-routing",
          priority: "high",
          current_state: "pending",
          recommended_action: "Revisar mapeamento.",
          created_at: "2026-04-09T12:00:00.000Z",
        },
      ],
      metadata: {
        total_count: 1,
        pending_count: 1,
        in_treatment_count: 0,
        resolved_count: 0,
        blocked_count: 0,
      },
    });

    getExceptionDetailMock.mockResolvedValue({
      id: "exc-1",
      batch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      batch_name: "Lote RH",
      document_external_id: "DOC-001",
      document_filename: "lote-rh.csv",
      associated_employee_id: "emp-1",
      assoc_employee_external_id: "EMP-1",
      associated_employee_name: "Maria",
      associated_employee_email: "maria@empresa.com",
      error_category: "ambiguous-routing",
      priority: "high",
      current_state: "pending",
      recommended_action: "Revisar mapeamento.",
      error_details: { matching_employees: [] },
      correction_applied: null,
      correction_result: null,
      resolved_by: null,
      resolved_by_name: null,
      resolved_at: null,
      updated_at: "2026-04-09T12:05:00.000Z",
      created_at: "2026-04-09T12:00:00.000Z",
      actions_history: [],
    });

    updateExceptionStateMock.mockResolvedValue({
      exception_id: "exc-1",
      previous_state: "pending",
      new_state: "in-treatment",
      updated_at: "2026-04-09T12:10:00.000Z",
    });

    recordCorrectiveExceptionActionMock.mockResolvedValue({
      action_id: "act-1",
      exception_id: "exc-1",
      performed_at: "2026-04-09T12:12:00.000Z",
      actor_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      message: "Acao registrada. Excecao marcada em tratamento.",
    });
  });

  it("returns a filtered exception list with metadata", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/batches/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/exceptions?priority=high&state=pending&skip=0&take=20",
      {
        headers: {
          cookie: "session_id=token",
          "x-correlation-id": "11111111-1111-4111-8111-111111111111",
        },
      },
    );

    const response = await GET_BATCH_EXCEPTIONS(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-correlation-id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.data.exceptions).toHaveLength(1);
    expect(body.data.metadata.total_count).toBe(1);
    expect(listBatchExceptionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        priority: "high",
        state: "pending",
        skip: 0,
        take: 20,
      }),
    );
  });

  it("rejects invalid filters before hitting the database", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/batches/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/exceptions?priority=urgent",
      {
        headers: { cookie: "session_id=token" },
      },
    );

    const response = await GET_BATCH_EXCEPTIONS(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects unauthenticated exception list access", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/batches/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/exceptions",
    );

    const response = await GET_BATCH_EXCEPTIONS(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns detail with action history and tenant context", async () => {
    dbLimitMock
      .mockResolvedValueOnce([{ role: "rh_operator" }])
      .mockResolvedValueOnce([{ tenantId: SESSION_TENANT_ID }]);

    const request = new NextRequest("http://localhost/api/v1/exceptions/exc-1", {
      headers: { cookie: "session_id=token" },
    });

    const response = await GET_EXCEPTION(request, {
      params: Promise.resolve({ exceptionId: "11111111-1111-4111-8111-111111111111" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.exception.id).toBe("exc-1");
    expect(getExceptionDetailMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: SESSION_TENANT_ID, exceptionId: "11111111-1111-4111-8111-111111111111" }),
    );
  });

  it("blocks access to exceptions from another tenant", async () => {
    dbLimitMock
      .mockResolvedValueOnce([{ role: "rh_operator" }])
      .mockResolvedValueOnce([{ tenantId: OTHER_TENANT_ID }]);

    const request = new NextRequest("http://localhost/api/v1/exceptions/exc-1", {
      headers: { cookie: "session_id=token" },
    });

    const response = await GET_EXCEPTION(request, {
      params: Promise.resolve({ exceptionId: "11111111-1111-4111-8111-111111111111" }),
    });

    expect(response.status).toBe(403);
  });

  it("updates exception state and returns transition metadata", async () => {
    dbLimitMock
      .mockResolvedValueOnce([{ role: "rh_operator" }])
      .mockResolvedValueOnce([{ tenantId: SESSION_TENANT_ID }]);

    const request = new NextRequest("http://localhost/api/v1/exceptions/exc-1", {
      method: "PATCH",
      headers: {
        cookie: "session_id=token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ new_state: "in-treatment", note: "Iniciando investigacao" }),
    });

    const response = await PATCH_EXCEPTION(request, {
      params: Promise.resolve({ exceptionId: "11111111-1111-4111-8111-111111111111" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.new_state).toBe("in-treatment");
    expect(updateExceptionStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        exceptionId: "11111111-1111-4111-8111-111111111111",
        nextState: "in-treatment",
      }),
    );
  });

  it("records corrective actions with validation", async () => {
    dbLimitMock
      .mockResolvedValueOnce([{ role: "rh_operator" }])
      .mockResolvedValueOnce([{ tenantId: SESSION_TENANT_ID }]);

    const request = new NextRequest("http://localhost/api/v1/exceptions/exc-1/actions", {
      method: "POST",
      headers: {
        cookie: "session_id=token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action_description: "Confirmado com o RH o mapeamento correto do colaborador.",
        expected_result: "reprocessable",
      }),
    });

    const response = await POST_EXCEPTION_ACTION(request, {
      params: Promise.resolve({ exceptionId: "11111111-1111-4111-8111-111111111111" }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.message).toContain("Acao registrada");
    expect(recordCorrectiveExceptionActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        exceptionId: "11111111-1111-4111-8111-111111111111",
        expectedResult: "reprocessable",
      }),
    );
  });

  it("rejects invalid corrective action payloads", async () => {
    const request = new NextRequest("http://localhost/api/v1/exceptions/exc-1/actions", {
      method: "POST",
      headers: {
        cookie: "session_id=token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ action_description: "curto", expected_result: "reject" }),
    });

    const response = await POST_EXCEPTION_ACTION(request, {
      params: Promise.resolve({ exceptionId: "11111111-1111-4111-8111-111111111111" }),
    });

    expect(response.status).toBe(400);
  });
});