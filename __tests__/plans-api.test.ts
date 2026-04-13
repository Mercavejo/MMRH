import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";

const {
  validateSessionMock,
  dbSelectMock,
  dbFromMock,
  dbWhereMock,
  dbLimitMock,
  listCommercialPlansMock,
  createCommercialPlanMock,
  assignTenantPlanMock,
  getActiveTenantPlanMock,
} = vi.hoisted(() => ({
  validateSessionMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbFromMock: vi.fn(),
  dbWhereMock: vi.fn(),
  dbLimitMock: vi.fn(),
  listCommercialPlansMock: vi.fn(),
  createCommercialPlanMock: vi.fn(),
  assignTenantPlanMock: vi.fn(),
  getActiveTenantPlanMock: vi.fn(),
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

vi.mock("@/modules/plans/application/list-commercial-plans", () => ({
  listCommercialPlans: listCommercialPlansMock,
}));

vi.mock("@/modules/plans/application/create-commercial-plan", () => ({
  createCommercialPlan: createCommercialPlanMock,
  CommercialPlanError: class extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly statusCode: number,
      public readonly details?: Record<string, unknown>,
    ) {
      super(message);
      this.name = "CommercialPlanError";
    }
  },
}));

vi.mock("@/modules/plans/application/assign-tenant-plan", () => ({
  assignTenantPlan: assignTenantPlanMock,
}));

vi.mock("@/modules/plans/application/get-active-tenant-plan", () => ({
  getActiveTenantPlan: getActiveTenantPlanMock,
}));

import { GET as GET_PLATFORM_PLANS, POST as POST_PLATFORM_PLANS } from "@/app/api/v1/platform/plans/route";
import { GET as GET_TENANT_PLAN, PUT as PUT_TENANT_PLAN } from "@/app/api/v1/platform/tenants/[tenant-id]/plan/route";

describe("plans api", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    validateSessionMock.mockResolvedValue({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: SESSION_TENANT_ID,
    });

    dbLimitMock.mockResolvedValue([{ role: "admin_plataforma" }]);

    listCommercialPlansMock.mockResolvedValue([
      {
        id: "plan-base",
        plan_code: "base",
        display_name: "Base",
      },
    ]);

    createCommercialPlanMock.mockResolvedValue({
      mode: "create",
      plan: {
        id: "plan-pro",
        plan_code: "professional",
        display_name: "Professional",
        description: null,
        is_active: true,
        created_at: "2026-04-13T12:00:00.000Z",
        updated_at: "2026-04-13T12:00:00.000Z",
      },
    });

    assignTenantPlanMock.mockResolvedValue({
      mode: "switch",
      active_plan: {
        assignment_id: "assignment-1",
        tenant_id: SESSION_TENANT_ID,
        plan_id: "plan-pro",
        plan_code: "professional",
        display_name: "Professional",
        description: null,
        effective_from: "2026-04-13T12:00:00.000Z",
        effective_to: null,
        changed_by: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        changed_at: "2026-04-13T12:00:00.000Z",
        correlation_id: "11111111-1111-4111-8111-111111111111",
        change_reason: "upgrade",
      },
    });

    getActiveTenantPlanMock.mockResolvedValue(null);
  });

  it("returns 401 when listing plans without session", async () => {
    const request = new NextRequest("http://localhost/api/v1/platform/plans", { method: "GET" });
    const response = await GET_PLATFORM_PLANS(request);

    expect(response.status).toBe(401);
  });

  it("creates plan with envelope and correlation id", async () => {
    const request = new NextRequest("http://localhost/api/v1/platform/plans", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": "11111111-1111-4111-8111-111111111111",
        cookie: "session_id=valid-token",
      },
      body: JSON.stringify({
        plan_code: "professional",
        display_name: "Professional",
      }),
    });

    const response = await POST_PLATFORM_PLANS(request);
    const responseBody = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("x-correlation-id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(responseBody.data.plan.plan_code).toBe("professional");
    expect(createCommercialPlanMock).toHaveBeenCalled();
  });

  it("blocks cross-tenant assignment", async () => {
    const request = new NextRequest("http://localhost/api/v1/platform/tenants/22222222-2222-4222-8222-222222222222/plan", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: "session_id=valid-token",
      },
      body: JSON.stringify({
        plan_code: "professional",
      }),
    });

    const response = await PUT_TENANT_PLAN(request, {
      params: Promise.resolve({ "tenant-id": "22222222-2222-4222-8222-222222222222" }),
    });

    expect(response.status).toBe(403);
    expect(assignTenantPlanMock).not.toHaveBeenCalled();
  });

  it("assigns plan to tenant and returns updated active plan", async () => {
    const request = new NextRequest(`http://localhost/api/v1/platform/tenants/${SESSION_TENANT_ID}/plan`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": "11111111-1111-4111-8111-111111111111",
        cookie: "session_id=valid-token",
      },
      body: JSON.stringify({
        plan_code: "professional",
        change_reason: "upgrade",
      }),
    });

    const response = await PUT_TENANT_PLAN(request, {
      params: Promise.resolve({ "tenant-id": SESSION_TENANT_ID }),
    });
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody.data.assignment.active_plan.plan_code).toBe("professional");
    expect(assignTenantPlanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        planCode: "professional",
      }),
    );
  });

  it("returns active plan in tenant query endpoint", async () => {
    getActiveTenantPlanMock.mockResolvedValueOnce({
      assignment_id: "assignment-1",
      tenant_id: SESSION_TENANT_ID,
      plan_id: "plan-base",
      plan_code: "base",
      display_name: "Base",
      description: null,
      effective_from: "2026-04-13T12:00:00.000Z",
      effective_to: null,
      changed_by: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      changed_at: "2026-04-13T12:00:00.000Z",
      correlation_id: "11111111-1111-4111-8111-111111111111",
      change_reason: null,
    });

    const request = new NextRequest(`http://localhost/api/v1/platform/tenants/${SESSION_TENANT_ID}/plan`, {
      method: "GET",
      headers: {
        cookie: "session_id=valid-token",
      },
    });

    const response = await GET_TENANT_PLAN(request, {
      params: Promise.resolve({ "tenant-id": SESSION_TENANT_ID }),
    });
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody.data.active_plan.plan_code).toBe("base");
  });
});
