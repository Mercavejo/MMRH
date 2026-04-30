/**
 * capabilities-api.test.ts
 *
 * Testa GET /api/v1/tenants/me/capabilities.
 * enforce-capability não é invocado neste endpoint — apenas get-active-tenant-plan.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";

// ─── hoisted mocks ──────────────────────────────────────────────────────────
const {
  validateSessionMock,
  dbSelectMock,
  dbFromMock,
  dbWhereMock,
  dbLimitMock,
  getActiveTenantPlanMock,
} = vi.hoisted(() => ({
  validateSessionMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbFromMock: vi.fn(),
  dbWhereMock: vi.fn(),
  dbLimitMock: vi.fn(),
  getActiveTenantPlanMock: vi.fn(),
}));

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
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        catch: vi.fn().mockResolvedValue({}),
      }),
    }),
  },
}));



vi.mock("@/modules/plans/application/get-active-tenant-plan", () => ({
  getActiveTenantPlan: getActiveTenantPlanMock,
}));

// ─── import under test ──────────────────────────────────────────────────────
import { GET } from "@/app/api/v1/tenants/me/capabilities/route";
import { Capability } from "@/modules/plans/domain/capabilities";

// ─────────────────────────────────────────────────────────────────────────────
describe("capabilities-api — GET /api/v1/tenants/me/capabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    validateSessionMock.mockResolvedValue({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: SESSION_TENANT_ID,
    });

    dbLimitMock.mockResolvedValue([{ role: "rh_operator" }]);
    getActiveTenantPlanMock.mockResolvedValue(null);
  });

  it("returns 401 when no session_id cookie is present", async () => {
    const request = new NextRequest("http://localhost/api/v1/tenants/me/capabilities", {
      method: "GET",
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when session token is invalid", async () => {
    validateSessionMock.mockResolvedValueOnce(null);

    const request = new NextRequest("http://localhost/api/v1/tenants/me/capabilities", {
      method: "GET",
      headers: { cookie: "session_id=invalid-token" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when user has no role in tenant", async () => {
    dbLimitMock.mockResolvedValueOnce([]);

    const request = new NextRequest("http://localhost/api/v1/tenants/me/capabilities", {
      method: "GET",
      headers: { cookie: "session_id=valid-token" },
    });

    const response = await GET(request);
    expect(response.status).toBe(403);
  });

  it("returns professional plan capabilities in envelope padrão", async () => {
    getActiveTenantPlanMock.mockResolvedValueOnce({
      plan_code: "professional",
      tenant_id: SESSION_TENANT_ID,
    });

    const request = new NextRequest("http://localhost/api/v1/tenants/me/capabilities", {
      method: "GET",
      headers: {
        cookie: "session_id=valid-token",
        "x-correlation-id": "11111111-1111-4111-8111-111111111111",
      },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-correlation-id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.data.capabilities).toContain(Capability.BATCH_INGESTION);
    expect(body.data.capabilities).toContain(Capability.PORTAL_EMPLOYEE_ACCESS);
    expect(body.data.capabilities).not.toContain(Capability.EXTERNAL_INTEGRATIONS);
    expect(body.meta.plan_code).toBe("professional");
    expect(body.meta.correlation_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.error).toBeNull();
  });

  it("returns empty capabilities when tenant has no active plan", async () => {
    getActiveTenantPlanMock.mockResolvedValueOnce(null);

    const request = new NextRequest("http://localhost/api/v1/tenants/me/capabilities", {
      method: "GET",
      headers: { cookie: "session_id=valid-token" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.capabilities).toEqual([]);
    expect(body.meta.plan_code).toBeNull();
  });

  it("returns enterprise plan capabilities including EXTERNAL_INTEGRATIONS and ADVANCED_AUDIT", async () => {
    getActiveTenantPlanMock.mockResolvedValueOnce({
      plan_code: "enterprise",
      tenant_id: SESSION_TENANT_ID,
    });

    const request = new NextRequest("http://localhost/api/v1/tenants/me/capabilities", {
      method: "GET",
      headers: { cookie: "session_id=valid-token" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.capabilities).toContain(Capability.EXTERNAL_INTEGRATIONS);
    expect(body.data.capabilities).toContain(Capability.ADVANCED_AUDIT);
    expect(body.meta.plan_code).toBe("enterprise");
  });

  it("returns base plan with only PORTAL_EMPLOYEE_ACCESS", async () => {
    getActiveTenantPlanMock.mockResolvedValueOnce({
      plan_code: "base",
      tenant_id: SESSION_TENANT_ID,
    });

    const request = new NextRequest("http://localhost/api/v1/tenants/me/capabilities", {
      method: "GET",
      headers: { cookie: "session_id=valid-token" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.capabilities).toContain(Capability.PORTAL_EMPLOYEE_ACCESS);
    expect(body.data.capabilities).not.toContain(Capability.BATCH_INGESTION);
    expect(body.meta.plan_code).toBe("base");
  });

  it("uses session tenant_id — ignores any query params", async () => {
    getActiveTenantPlanMock.mockResolvedValueOnce({
      plan_code: "professional",
      tenant_id: SESSION_TENANT_ID,
    });

    const request = new NextRequest(
      "http://localhost/api/v1/tenants/me/capabilities?tenant_id=22222222-2222-4222-8222-222222222222",
      {
        method: "GET",
        headers: { cookie: "session_id=valid-token" },
      },
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(getActiveTenantPlanMock).toHaveBeenCalledWith(SESSION_TENANT_ID);
  });

  it("x-correlation-id header presente na resposta de sucesso", async () => {
    const request = new NextRequest("http://localhost/api/v1/tenants/me/capabilities", {
      method: "GET",
      headers: {
        cookie: "session_id=valid-token",
        "x-correlation-id": "77777777-7777-4777-8777-777777777777",
      },
    });

    const response = await GET(request);
    expect(response.headers.get("x-correlation-id")).toBe("77777777-7777-4777-8777-777777777777");
    const body = await response.json();
    expect(body.meta.correlation_id).toBe("77777777-7777-4777-8777-777777777777");
  });
});
