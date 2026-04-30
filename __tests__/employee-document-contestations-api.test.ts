import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const {
  validateSessionMock,
  createDocumentContestationMock,
  writeDocumentContestationAuditMock,
  assertTenantActionMock,
  dbSelectMock,
  dbFromMock,
  dbWhereMock,
  dbLimitMock,
} = vi.hoisted(() => ({
  validateSessionMock: vi.fn(),
  createDocumentContestationMock: vi.fn(),
  writeDocumentContestationAuditMock: vi.fn(),
  assertTenantActionMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbFromMock: vi.fn(),
  dbWhereMock: vi.fn(),
  dbLimitMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  validateSession: validateSessionMock,
}));

vi.mock("@/lib/documents/create-document-contestation", () => ({
  createDocumentContestation: createDocumentContestationMock,
  DocumentContestationError: class DocumentContestationError extends Error {
    code: string;
    statusCode: number;

    constructor(code: string, message: string, statusCode: number) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

vi.mock("@/lib/documents/contestation-audit", () => ({
  writeDocumentContestationAudit: writeDocumentContestationAuditMock,
}));

vi.mock("@/lib/auth/rbac", async () => {
  const actual = await vi.importActual("@/lib/auth/rbac");

  return {
    ...actual,
    assertTenantAction: assertTenantActionMock,
  };
});

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

import { POST } from "@/app/api/v1/employee/documents/contestations/route";

describe("employee document contestations api", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    validateSessionMock.mockResolvedValue({
      userId: USER_ID,
      tenantId: SESSION_TENANT_ID,
    });

    dbLimitMock.mockResolvedValue([{ role: "colaborador" }]);

    createDocumentContestationMock.mockResolvedValue({
      contestation_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      tenant_id: SESSION_TENANT_ID,
      user_id: USER_ID,
      document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      period_ref: "2026-03",
      document_type: "holerite",
      source_status: "pending",
      tracking_status: "open",
      batch_id: null,
      reason: "Documento ainda nao apareceu no portal.",
      created_at: "2026-04-09T10:40:00.000Z",
    });

    writeDocumentContestationAuditMock.mockResolvedValue(undefined);
  });

  it("creates contextual contestation with collaborator scope", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/employee/documents/contestations",
      {
        method: "POST",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          reason: "Documento ainda nao apareceu no portal.",
        }),
      },
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.meta.correlation_id).toEqual(expect.any(String));
    expect(body.data.tracking_status).toBe("open");
    expect(createDocumentContestationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        userId: USER_ID,
        documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    );
  });

  it("rejects request without valid session", async () => {
    validateSessionMock.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/v1/employee/documents/contestations",
      {
        method: "POST",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        }),
      },
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects role different from colaborador", async () => {
    dbLimitMock.mockResolvedValue([{ role: "rh_operator" }]);

    const request = new NextRequest(
      "http://localhost/api/v1/employee/documents/contestations",
      {
        method: "POST",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        }),
      },
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("rejects invalid payload", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/employee/documents/contestations",
      {
        method: "POST",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          document_id: "invalid",
        }),
      },
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
