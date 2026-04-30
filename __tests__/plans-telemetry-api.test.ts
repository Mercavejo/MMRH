import { describe, expect, it, vi, beforeEach } from "vitest";

// Mocks needed for API test
const { getCapabilityTelemetryMock, validateSessionMock, assertTenantActionMock, limitMock } = vi.hoisted(() => ({
  getCapabilityTelemetryMock: vi.fn(),
  validateSessionMock: vi.fn(),
  assertTenantActionMock: vi.fn(),
  limitMock: vi.fn(),
}));


vi.mock("@/modules/plans/application/get-capability-telemetry", () => ({
  getCapabilityTelemetry: getCapabilityTelemetryMock,
}));

vi.mock("@/lib/auth/session", () => ({
  validateSession: validateSessionMock,
}));

vi.mock("@/lib/auth/rbac", () => ({
  assertTenantAction: assertTenantActionMock,
  RBAC_ACTIONS: { auditRead: "audit:read" },
  writeRbacAudit: vi.fn(),
  buildAccessDeniedAuditDetails: vi.fn(),
}));

vi.mock("@/lib/db/client", () => {
  const m = {
    select: vi.fn(() => m),
    from: vi.fn(() => m),
    where: vi.fn(() => m),
    limit: vi.fn().mockImplementation(() => limitMock()),
    insert: vi.fn(() => m),
    values: vi.fn(() => m),
    catch: vi.fn(() => m),
  };
  return { db: m };
});




import { GET } from "@/app/api/v1/platform/telemetry/capabilities/route";
import { NextRequest } from "next/server";

describe("GET /api/v1/platform/telemetry/capabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if session is missing", async () => {
    const req = new NextRequest("http://localhost/api/v1/platform/telemetry/capabilities?period=2026-04");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(res.headers.get("x-correlation-id")).toBe(body.meta.correlation_id);
  });

  it("returns 403 if user lacks auditRead role", async () => {
    validateSessionMock.mockResolvedValueOnce({ userId: "u1", tenantId: "t1" });
    limitMock.mockResolvedValueOnce([{ role: "colaborador" }]);


    const req = new NextRequest("http://localhost/api/v1/platform/telemetry/capabilities?period=2026-04");
    req.cookies.set("sid", "valid");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns 200 with telemetry data for authorized user", async () => {
    validateSessionMock.mockResolvedValue({ userId: "u1", tenantId: "t1" });
    limitMock.mockResolvedValue([{ role: "admin_plataforma" }]);
    assertTenantActionMock.mockReturnValue(true);
    getCapabilityTelemetryMock.mockResolvedValue([
      { capability: "BATCH_INGESTION", period: "2026-04", usageCount: 42 }
    ]);

    const req = new NextRequest("http://localhost/api/v1/platform/telemetry/capabilities?period=2026-04");
    req.cookies.set("sid", "valid");
    req.headers.set("x-correlation-id", "11111111-1111-4111-8111-111111111111");
    const res = await GET(req);
    
    expect(res.status).toBe(200);
    expect(res.headers.get("x-correlation-id")).toBe("11111111-1111-4111-8111-111111111111");

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].usageCount).toBe(42);
  });


  it("returns 400 if period is missing", async () => {
    validateSessionMock.mockResolvedValueOnce({ userId: "u1", tenantId: "t1" });
    limitMock.mockResolvedValueOnce([{ role: "admin_plataforma" }]);
    assertTenantActionMock.mockReturnValueOnce(true);

    const req = new NextRequest("http://localhost/api/v1/platform/telemetry/capabilities");
    req.cookies.set("sid", "valid");
    const res = await GET(req);
    
    expect(res.status).toBe(400);
  });
});
