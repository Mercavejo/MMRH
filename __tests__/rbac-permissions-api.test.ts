import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT_ID = "22222222-2222-4222-8222-222222222222";

const {
  selectResultQueue,
  selectMock,
  fromMock,
  whereMock,
  limitMock,
  orderByMock,
  updateMock,
  setMock,
  updateWhereMock,
  insertMock,
  insertValuesMock,
  validateSessionMock,
  listTenantPermissionAssignmentsMock,
  buildTenantPermissionReviewMock,
  writeRbacAuditMock,
} = vi.hoisted(() => ({
  selectResultQueue: [] as unknown[],
  selectMock: vi.fn(),
  fromMock: vi.fn(),
  whereMock: vi.fn(),
  limitMock: vi.fn(),
  orderByMock: vi.fn(),
  updateMock: vi.fn(),
  setMock: vi.fn(),
  updateWhereMock: vi.fn(),
  insertMock: vi.fn(),
  insertValuesMock: vi.fn(),
  validateSessionMock: vi.fn(),
  listTenantPermissionAssignmentsMock: vi.fn(),
  buildTenantPermissionReviewMock: vi.fn(),
  writeRbacAuditMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  validateSession: validateSessionMock,
}));

vi.mock("@/lib/auth/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/rbac")>("@/lib/auth/rbac");

  return {
    ...actual,
    listTenantPermissionAssignments: listTenantPermissionAssignmentsMock,
    buildTenantPermissionReview: buildTenantPermissionReviewMock,
    writeRbacAudit: writeRbacAuditMock,
  };
});

vi.mock("@/lib/db/client", () => ({
  db: {
    select: selectMock.mockReturnValue({
      from: fromMock.mockReturnValue({
        where: whereMock.mockReturnValue({
          limit: limitMock.mockImplementation(async () => {
            if (selectResultQueue.length > 0) {
              return selectResultQueue.shift();
            }

            return [];
          }),
          orderBy: orderByMock.mockImplementation(async () => {
            if (selectResultQueue.length > 0) {
              return selectResultQueue.shift();
            }

            return [];
          }),
        }),
      }),
    }),
    update: updateMock.mockReturnValue({
      set: setMock.mockReturnValue({
        where: updateWhereMock.mockResolvedValue(undefined),
      }),
    }),
    insert: insertMock.mockReturnValue({
      values: insertValuesMock.mockResolvedValue(undefined),
    }),
  },
}));

import { GET, PATCH } from "@/app/api/v1/rbac/permissions/route";

describe("rbac permissions api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResultQueue.length = 0;

    validateSessionMock.mockResolvedValue({
      userId: "user-1",
      tenantId: TENANT_ID,
      expiresAt: new Date("2026-04-08T18:30:00.000Z"),
    });

    listTenantPermissionAssignmentsMock.mockResolvedValue([
      {
        userId: "user-1",
        tenantId: TENANT_ID,
        role: "colaborador",
      },
      {
        userId: "user-2",
        tenantId: TENANT_ID,
        role: "rh_operator",
      },
    ]);
    buildTenantPermissionReviewMock.mockReturnValue({
      tenantId: TENANT_ID,
      roleSummary: [
        { role: "colaborador", userCount: 1, userIds: ["user-1"], userEmails: [] },
        { role: "rh_operator", userCount: 1, userIds: ["user-2"], userEmails: [] },
      ],
    });
    writeRbacAuditMock.mockResolvedValue(undefined);
  });

  it("lists current permissions for the session tenant", async () => {
    selectResultQueue.push([{ role: "admin_plataforma" }]);
    const request = new NextRequest(
      `http://localhost/api/v1/rbac/permissions?tenant_id=${TENANT_ID}`,
      {
        headers: { cookie: "session_id=token" },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.tenant_id).toBe(TENANT_ID);
    expect(body.data.role_summary.find((item: { role: string }) => item.role === "colaborador")?.userCount).toBe(1);
    expect(body.data.assignments).toHaveLength(2);
    expect(listTenantPermissionAssignmentsMock).toHaveBeenCalledWith(TENANT_ID);
  });

  it("updates a tenant permission and writes audit data", async () => {
    selectResultQueue.push([{ role: "admin_plataforma" }]);
    selectResultQueue.push([{ role: "colaborador" }]);

    const request = new NextRequest("http://localhost/api/v1/rbac/permissions", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: "session_id=token" },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        target_user_id: "33333333-3333-4333-8333-333333333333",
        next_role: "rh_gestor",
        reason: "revisao_periodica",
      }),
    });

    const response = await PATCH(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.next_role).toBe("rh_gestor");
    expect(updateMock).toHaveBeenCalled();
    expect(writeRbacAuditMock).toHaveBeenCalled();
  });

  it("blocks cross-tenant permission reviews", async () => {
    selectResultQueue.push([{ role: "admin_plataforma" }]);

    const request = new NextRequest(
      `http://localhost/api/v1/rbac/permissions?tenant_id=${OTHER_TENANT_ID}`,
      {
        headers: { cookie: "session_id=token" },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("blocks permission review for low-privilege tenant readers", async () => {
    selectResultQueue.push([{ role: "colaborador" }]);

    const request = new NextRequest(
      `http://localhost/api/v1/rbac/permissions?tenant_id=${TENANT_ID}`,
      {
        headers: { cookie: "session_id=token" },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(listTenantPermissionAssignmentsMock).not.toHaveBeenCalled();
  });

  it("keeps PATCH success when RBAC audit persistence fails", async () => {
    selectResultQueue.push([{ role: "admin_plataforma" }]);
    selectResultQueue.push([{ role: "colaborador" }]);
    writeRbacAuditMock.mockRejectedValueOnce(new Error("audit insert failed"));

    const request = new NextRequest("http://localhost/api/v1/rbac/permissions", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: "session_id=token" },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        target_user_id: "33333333-3333-4333-8333-333333333333",
        next_role: "rh_gestor",
        reason: "revisao_periodica",
      }),
    });

    const response = await PATCH(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.next_role).toBe("rh_gestor");
    expect(updateMock).toHaveBeenCalled();
  });
});
