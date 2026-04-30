import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";

const {
  validateSessionMock,
  dbSelectMock,
  dbFromMock,
  dbWhereMock,
  dbLimitMock,
  dbInsertMock,
  dbInsertValuesMock,
  getSupportCaseMock,
  resolveSupportCaseMock,
  SupportCaseError,
  writePlaytestEventMock,
} = vi.hoisted(() => ({
  validateSessionMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbFromMock: vi.fn(),
  dbWhereMock: vi.fn(),
  dbLimitMock: vi.fn(),
  dbInsertMock: vi.fn(),
  dbInsertValuesMock: vi.fn(),
  getSupportCaseMock: vi.fn(),
  resolveSupportCaseMock: vi.fn(),
  writePlaytestEventMock: vi.fn(),
  SupportCaseError: class extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly statusCode: number,
      public readonly details?: Record<string, unknown>,
    ) {
      super(message);
      this.name = "SupportCaseError";
    }
  },
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
    insert: dbInsertMock.mockReturnValue({
      values: dbInsertValuesMock,
    }),
  },
}));

vi.mock("@/modules/support/application/get-support-case", () => ({
  getSupportCase: getSupportCaseMock,
  SupportCaseError,
}));

vi.mock("@/modules/support/application/resolve-support-case", () => ({
  resolveSupportCase: resolveSupportCaseMock,
  SupportCaseError,
}));

vi.mock("@/lib/observability/playtest-audit", () => ({
  writePlaytestEvent: writePlaytestEventMock,
}));

import { GET as getSupportCaseRoute } from "@/app/api/v1/support/cases/[caseId]/route";
import { POST as resolveSupportCaseRoute } from "@/app/api/v1/support/cases/[caseId]/resolve/route";

describe("support cases api", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    validateSessionMock.mockResolvedValue({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: SESSION_TENANT_ID,
    });

    dbLimitMock.mockResolvedValue([{ role: "suporte" }]);

    getSupportCaseMock.mockResolvedValue({
      case_id: "22222222-2222-4222-8222-222222222222",
      tenant_id: SESSION_TENANT_ID,
      status: "open",
      severity: "warning",
      links: {
        batch_id: null,
        document_id: null,
        user_id: null,
      },
      technical_history: [],
      functional_history: [],
      resolution: null,
    });

    resolveSupportCaseMock.mockResolvedValue({
      case_id: "22222222-2222-4222-8222-222222222222",
      previous_status: "in_treatment",
      status: "resolved",
      resolved_at: "2026-04-13T12:00:00.000Z",
    });
    writePlaytestEventMock.mockResolvedValue(undefined);
    dbInsertValuesMock.mockResolvedValue(undefined);
  });

  it("returns support case with correlation id", async () => {
    dbLimitMock.mockResolvedValue([{ role: "rh_gestor" }]);

    const request = new NextRequest(
      "http://localhost/api/v1/support/cases/22222222-2222-4222-8222-222222222222?from=2026-04-13T00:00:00.000Z&to=2026-04-13T23:59:59.000Z",
      {
        method: "GET",
        headers: {
          cookie: "session_id=token",
          "x-correlation-id": "33333333-3333-4333-8333-333333333333",
        },
      },
    );

    const response = await getSupportCaseRoute(request, {
      params: Promise.resolve({ caseId: "22222222-2222-4222-8222-222222222222" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-correlation-id")).toBe("33333333-3333-4333-8333-333333333333");
    expect(body.data.case_id).toBe("22222222-2222-4222-8222-222222222222");
    expect(writePlaytestEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "playtest.rh.support.case.view",
        status: "success",
        resourceType: "support_case",
        details: expect.objectContaining({ actor_role: "rh_gestor" }),
      }),
    );
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it("records admin support consolidation for internal playtesting", async () => {
    dbLimitMock.mockResolvedValue([{ role: "admin_plataforma" }]);

    const request = new NextRequest("http://localhost/api/v1/support/cases/22222222-2222-4222-8222-222222222222", {
      method: "GET",
      headers: { cookie: "session_id=token" },
    });

    const response = await getSupportCaseRoute(request, {
      params: Promise.resolve({ caseId: "22222222-2222-4222-8222-222222222222" }),
    });

    expect(response.status).toBe(200);
    expect(writePlaytestEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "playtest.rh.support.case.view",
        details: expect.objectContaining({ actor_role: "admin_plataforma" }),
      }),
    );
  });

  it("returns 400 for invalid support case id", async () => {
    const request = new NextRequest("http://localhost/api/v1/support/cases/invalid", {
      method: "GET",
      headers: { cookie: "session_id=token" },
    });

    const response = await getSupportCaseRoute(request, {
      params: Promise.resolve({ caseId: "invalid" }),
    });

    expect(response.status).toBe(400);
    expect(getSupportCaseMock).not.toHaveBeenCalled();
  });

  it("returns 401 when session is missing", async () => {
    const request = new NextRequest("http://localhost/api/v1/support/cases/22222222-2222-4222-8222-222222222222", {
      method: "GET",
    });

    const response = await getSupportCaseRoute(request, {
      params: Promise.resolve({ caseId: "22222222-2222-4222-8222-222222222222" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 for unauthorized role", async () => {
    dbLimitMock.mockResolvedValue([{ role: "colaborador" }]);

    const request = new NextRequest("http://localhost/api/v1/support/cases/22222222-2222-4222-8222-222222222222", {
      method: "GET",
      headers: { cookie: "session_id=token" },
    });

    const response = await getSupportCaseRoute(request, {
      params: Promise.resolve({ caseId: "22222222-2222-4222-8222-222222222222" }),
    });

    expect(response.status).toBe(403);
  });

  it("maps 404 from support case domain", async () => {
    dbLimitMock.mockResolvedValue([{ role: "rh_gestor" }]);
    getSupportCaseMock.mockRejectedValue(new SupportCaseError("NOT_FOUND", "Caso nao encontrado.", 404));

    const request = new NextRequest("http://localhost/api/v1/support/cases/22222222-2222-4222-8222-222222222222", {
      method: "GET",
      headers: { cookie: "session_id=token" },
    });

    const response = await getSupportCaseRoute(request, {
      params: Promise.resolve({ caseId: "22222222-2222-4222-8222-222222222222" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(writePlaytestEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "playtest.rh.support.case.friction",
        status: "failure",
        details: expect.objectContaining({ cause: "domain_error", code: "NOT_FOUND" }),
      }),
    );
  });

  it("resolves support case", async () => {
    const request = new NextRequest("http://localhost/api/v1/support/cases/22222222-2222-4222-8222-222222222222/resolve", {
      method: "POST",
      headers: {
        cookie: "session_id=token",
        "content-type": "application/json",
        "x-correlation-id": "33333333-3333-4333-8333-333333333333",
      },
      body: JSON.stringify({
        cause_code: "ROUTING_FAILURE",
        action_applied: "Reprocessamento seletivo executado",
        result_status: "resolved",
        recovery: {
          batch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          idempotency_key: "recovery-1",
        },
      }),
    });

    const response = await resolveSupportCaseRoute(request, {
      params: Promise.resolve({ caseId: "22222222-2222-4222-8222-222222222222" }),
    });

    expect(response.status).toBe(200);
    expect(resolveSupportCaseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: "22222222-2222-4222-8222-222222222222",
        tenantId: SESSION_TENANT_ID,
        resultStatus: "resolved",
      }),
    );
  });

  it("returns 400 for invalid resolve payload", async () => {
    const request = new NextRequest("http://localhost/api/v1/support/cases/22222222-2222-4222-8222-222222222222/resolve", {
      method: "POST",
      headers: {
        cookie: "session_id=token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        cause_code: "",
        action_applied: "",
        result_status: "invalid",
      }),
    });

    const response = await resolveSupportCaseRoute(request, {
      params: Promise.resolve({ caseId: "22222222-2222-4222-8222-222222222222" }),
    });

    expect(response.status).toBe(400);
    expect(resolveSupportCaseMock).not.toHaveBeenCalled();
  });

  it("returns 403 for resolve without support role", async () => {
    dbLimitMock.mockResolvedValue([{ role: "rh_gestor" }]);

    const request = new NextRequest("http://localhost/api/v1/support/cases/22222222-2222-4222-8222-222222222222/resolve", {
      method: "POST",
      headers: {
        cookie: "session_id=token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        cause_code: "ROUTING_FAILURE",
        action_applied: "Acao",
        result_status: "resolved",
      }),
    });

    const response = await resolveSupportCaseRoute(request, {
      params: Promise.resolve({ caseId: "22222222-2222-4222-8222-222222222222" }),
    });

    expect(response.status).toBe(403);
  });

  it("maps 409 from resolve domain", async () => {
    resolveSupportCaseMock.mockRejectedValue(
      new SupportCaseError("INVALID_STATE_TRANSITION", "Transicao invalida.", 409),
    );

    const request = new NextRequest("http://localhost/api/v1/support/cases/22222222-2222-4222-8222-222222222222/resolve", {
      method: "POST",
      headers: {
        cookie: "session_id=token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        cause_code: "ROUTING_FAILURE",
        action_applied: "Acao",
        result_status: "resolved",
      }),
    });

    const response = await resolveSupportCaseRoute(request, {
      params: Promise.resolve({ caseId: "22222222-2222-4222-8222-222222222222" }),
    });

    expect(response.status).toBe(409);
  });
});
