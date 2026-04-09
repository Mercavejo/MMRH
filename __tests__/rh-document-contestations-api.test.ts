import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";

const {
  validateSessionMock,
  listContestationsForTenantMock,
  updateContestationTrackingStatusMock,
  writeDocumentContestationAuditMock,
  assertTenantActionMock,
  dbSelectMock,
  dbFromMock,
  dbWhereMock,
  dbLimitMock,
} = vi.hoisted(() => ({
  validateSessionMock: vi.fn(),
  listContestationsForTenantMock: vi.fn(),
  updateContestationTrackingStatusMock: vi.fn(),
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

vi.mock("@/lib/documents/contestation-tracking", () => ({
  listContestationsForTenant: listContestationsForTenantMock,
  updateContestationTrackingStatus: updateContestationTrackingStatusMock,
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

import { GET } from "@/app/api/v1/rh/contestations/route";
import { PATCH } from "@/app/api/v1/rh/contestations/[contestationId]/route";

describe("rh contestations api", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    validateSessionMock.mockResolvedValue({
      userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      tenantId: SESSION_TENANT_ID,
    });

    dbLimitMock.mockResolvedValue([{ role: "rh_operator" }]);

    listContestationsForTenantMock.mockResolvedValue([
      {
        contestation_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        tenant_id: SESSION_TENANT_ID,
        user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        document_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        period_ref: "2026-03",
        document_type: "holerite",
        source_status: "pending",
        tracking_status: "open",
        batch_id: null,
        reason: "Documento ainda nao apareceu no portal.",
        created_at: "2026-04-09T10:45:00.000Z",
        updated_at: "2026-04-09T10:45:00.000Z",
      },
    ]);

    updateContestationTrackingStatusMock.mockResolvedValue({
      contestation_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      tracking_status: "resolved",
      resolved_by: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });
  });

  it("lists contestations for rh queue with tenant scope", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/rh/contestations?tracking_status=open&period_ref=2026-03",
      {
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.correlation_id).toEqual(expect.any(String));
    expect(body.data.items).toHaveLength(1);
    expect(listContestationsForTenantMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        trackingStatus: "open",
      }),
    );
  });

  it("updates tracking status for rh operator", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/rh/contestations/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      {
        method: "PATCH",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tracking_status: "resolved",
          resolution_note: "Documento corrigido e publicado no lote final.",
        }),
      },
    );

    const response = await PATCH(
      request,
      { params: Promise.resolve({ contestationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.tracking_status).toBe("resolved");
    expect(updateContestationTrackingStatusMock).toHaveBeenCalled();
  });

  it("blocks rh gestor from updating contestations", async () => {
    dbLimitMock.mockResolvedValue([{ role: "rh_gestor" }]);

    const request = new NextRequest(
      "http://localhost/api/v1/rh/contestations/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      {
        method: "PATCH",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tracking_status: "resolved",
          resolution_note: "Documento corrigido e publicado no lote final.",
        }),
      },
    );

    const response = await PATCH(request, {
      params: Promise.resolve({ contestationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(updateContestationTrackingStatusMock).not.toHaveBeenCalled();
  });

  it("blocks role without rh permission", async () => {
    dbLimitMock.mockResolvedValue([{ role: "colaborador" }]);

    const request = new NextRequest(
      "http://localhost/api/v1/rh/contestations",
      {
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("rejects invalid patch payload", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/rh/contestations/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      {
        method: "PATCH",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tracking_status: "invalid",
        }),
      },
    );

    const response = await PATCH(
      request,
      { params: Promise.resolve({ contestationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
