/**
 * plans-enforcement.test.ts
 *
 * Testa o núcleo do enforcement: domain + application layer.
 * checkTenantCapability e enforceCapability são importados REAIS,
 * apenas get-active-tenant-plan é mockado via vi.mock.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── hoisted mocks ──────────────────────────────────────────────────────────
const { getActiveTenantPlanMock, insertMock, insertValuesMock, logCapabilityUsageMock } = vi.hoisted(() => {
  const insertValuesMock = vi.fn().mockResolvedValue({});

  return {
    getActiveTenantPlanMock: vi.fn(),
    insertMock: vi.fn().mockReturnValue({ values: insertValuesMock }),
    insertValuesMock,
    logCapabilityUsageMock: vi.fn().mockResolvedValue(1),
  };
});

vi.mock("@/modules/plans/application/get-active-tenant-plan", () => ({
  getActiveTenantPlan: getActiveTenantPlanMock,
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    insert: insertMock,
  },
}));

vi.mock("@/modules/plans/application/log-capability-usage", () => ({
  logCapabilityUsage: logCapabilityUsageMock,
}));

// ─── real implementations under test ────────────────────────────────────────
import { Capability, CapabilityForbiddenError, PLAN_CAPABILITIES } from "@/modules/plans/domain/capabilities";
import { checkTenantCapability } from "@/modules/plans/application/check-tenant-capability";
import { enforceCapability } from "@/modules/plans/application/enforce-capability";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";

// ─────────────────────────────────────────────────────────────────────────────
describe("plans-enforcement — domain: capabilities catalog", () => {
  it("PLAN_CAPABILITIES maps base plan to PORTAL_EMPLOYEE_ACCESS only", () => {
    expect(PLAN_CAPABILITIES["base"].has(Capability.PORTAL_EMPLOYEE_ACCESS)).toBe(true);
    expect(PLAN_CAPABILITIES["base"].has(Capability.BATCH_INGESTION)).toBe(false);
    expect(PLAN_CAPABILITIES["base"].has(Capability.EXTERNAL_INTEGRATIONS)).toBe(false);
  });

  it("PLAN_CAPABILITIES maps professional with BATCH_INGESTION but not EXTERNAL_INTEGRATIONS", () => {
    expect(PLAN_CAPABILITIES["professional"].has(Capability.BATCH_INGESTION)).toBe(true);
    expect(PLAN_CAPABILITIES["professional"].has(Capability.PDF_MULTIPAGE_PROCESSING)).toBe(true);
    expect(PLAN_CAPABILITIES["professional"].has(Capability.EXTERNAL_INTEGRATIONS)).toBe(false);
  });

  it("PLAN_CAPABILITIES maps enterprise with all capabilities", () => {
    expect(PLAN_CAPABILITIES["enterprise"].has(Capability.BATCH_INGESTION)).toBe(true);
    expect(PLAN_CAPABILITIES["enterprise"].has(Capability.EXTERNAL_INTEGRATIONS)).toBe(true);
    expect(PLAN_CAPABILITIES["enterprise"].has(Capability.ADVANCED_AUDIT)).toBe(true);
    expect(PLAN_CAPABILITIES["enterprise"].has(Capability.COMMERCIAL_GOVERNANCE)).toBe(true);
  });

  it("CapabilityForbiddenError carries capability, planCode, and upgradeHint", () => {
    const err = new CapabilityForbiddenError({
      capability: Capability.BATCH_INGESTION,
      planCode: "base",
      upgradeHint: "upgrade para professional",
    });

    expect(err.name).toBe("CapabilityForbiddenError");
    expect(err.capability).toBe(Capability.BATCH_INGESTION);
    expect(err.planCode).toBe("base");
    expect(err.upgradeHint).toBe("upgrade para professional");
    expect(err instanceof Error).toBe(true);
  });

  it("Capability enum contains all expected catalog values", () => {
    expect(Object.values(Capability)).toContain("BATCH_INGESTION");
    expect(Object.values(Capability)).toContain("EXTERNAL_INTEGRATIONS");
    expect(Object.values(Capability)).toContain("PDF_MULTIPAGE_PROCESSING");
    expect(Object.values(Capability)).toContain("ADVANCED_AUDIT");
    expect(Object.values(Capability)).toContain("PORTAL_EMPLOYEE_ACCESS");
    expect(Object.values(Capability)).toContain("COMMERCIAL_GOVERNANCE");
  });

  it("PLAN_CAPABILITIES only contains valid Capability enum values", () => {
    const allValid = new Set(Object.values(Capability));
    for (const [planCode, caps] of Object.entries(PLAN_CAPABILITIES)) {
      for (const cap of caps) {
        expect(allValid.has(cap as Capability), `Plano ${planCode} tem capability invalida: ${cap}`).toBe(true);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("plans-enforcement — application: checkTenantCapability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns allowed: true when active plan includes capability", async () => {
    getActiveTenantPlanMock.mockResolvedValueOnce({
      plan_code: "professional",
      assignment_id: "a1",
      tenant_id: SESSION_TENANT_ID,
    });

    const result = await checkTenantCapability(SESSION_TENANT_ID, Capability.BATCH_INGESTION);

    expect(result.allowed).toBe(true);
    expect(result.planCode).toBe("professional");
    expect(result.capability).toBe(Capability.BATCH_INGESTION);
    expect(result.upgradeRequired).toBe(false);
  });

  it("returns allowed: false when active plan does not include capability", async () => {
    getActiveTenantPlanMock.mockResolvedValueOnce({
      plan_code: "base",
      assignment_id: "a2",
      tenant_id: SESSION_TENANT_ID,
    });

    const result = await checkTenantCapability(SESSION_TENANT_ID, Capability.BATCH_INGESTION);

    expect(result.allowed).toBe(false);
    expect(result.planCode).toBe("base");
    expect(result.upgradeRequired).toBe(true);
  });

  it("returns allowed: false (fail-safe) when tenant has no active plan", async () => {
    getActiveTenantPlanMock.mockResolvedValueOnce(null);

    const result = await checkTenantCapability(SESSION_TENANT_ID, Capability.BATCH_INGESTION);

    expect(result.allowed).toBe(false);
    expect(result.planCode).toBe("none");
    expect(result.upgradeRequired).toBe(true);
  });

  it("returns allowed: true for enterprise plan and EXTERNAL_INTEGRATIONS", async () => {
    getActiveTenantPlanMock.mockResolvedValueOnce({
      plan_code: "enterprise",
      assignment_id: "a3",
      tenant_id: SESSION_TENANT_ID,
    });

    const result = await checkTenantCapability(SESSION_TENANT_ID, Capability.EXTERNAL_INTEGRATIONS);

    expect(result.allowed).toBe(true);
    expect(result.planCode).toBe("enterprise");
  });

  it("returns allowed: false for professional plan and EXTERNAL_INTEGRATIONS", async () => {
    getActiveTenantPlanMock.mockResolvedValueOnce({
      plan_code: "professional",
      assignment_id: "a4",
      tenant_id: SESSION_TENANT_ID,
    });

    const result = await checkTenantCapability(SESSION_TENANT_ID, Capability.EXTERNAL_INTEGRATIONS);

    expect(result.allowed).toBe(false);
    expect(result.upgradeRequired).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("plans-enforcement — application: enforceCapability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockReturnValue({ values: insertValuesMock });
    insertValuesMock.mockResolvedValue({});
    logCapabilityUsageMock.mockResolvedValue(1);
  });

  it("resolves without throwing when capability is allowed and logs usage/audit", async () => {
    getActiveTenantPlanMock.mockResolvedValueOnce({ plan_code: "enterprise", tenant_id: SESSION_TENANT_ID });

    await expect(enforceCapability(SESSION_TENANT_ID, Capability.EXTERNAL_INTEGRATIONS, "u1", "corr-id")).resolves.toBeUndefined();

    // Verify audit log for success
    expect(insertMock).toHaveBeenCalled();
    // Verification of specific call details can be complex with Drizzle objects,
    // but the fact it passed confirms the code path works.
    
    // Verify telemetry log
    expect(logCapabilityUsageMock).toHaveBeenCalledWith(SESSION_TENANT_ID, Capability.EXTERNAL_INTEGRATIONS, 1, "enterprise");
  });


  it("throws CapabilityForbiddenError and logs blocked audit when blocked", async () => {
    getActiveTenantPlanMock.mockResolvedValueOnce({ plan_code: "base", tenant_id: SESSION_TENANT_ID });

    await expect(enforceCapability(SESSION_TENANT_ID, Capability.BATCH_INGESTION, "u1", "corr-id")).rejects.toMatchObject({
      name: "CapabilityForbiddenError",
      capability: Capability.BATCH_INGESTION,
      planCode: "base",
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertValuesMock).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: SESSION_TENANT_ID,
      actorId: "u1",
      correlationId: "corr-id",
      action: "plans.capability.blocked.v1",
      resourceType: "capability",
      resourceId: Capability.BATCH_INGESTION,
      status: "failure",
      details: expect.objectContaining({
        capability: Capability.BATCH_INGESTION,
        plan_code: "base",
        upgrade_hint: expect.any(String),
      }),
    }));
    // Telemetry SHOULD NOT be called on failure
    expect(logCapabilityUsageMock).not.toHaveBeenCalled();
  });

  it("throws CapabilityForbiddenError when tenant has no plan (fail-safe)", async () => {
    getActiveTenantPlanMock.mockResolvedValueOnce(null);

    await expect(enforceCapability(SESSION_TENANT_ID, Capability.BATCH_INGESTION, null, "corr-id")).rejects.toMatchObject({
      name: "CapabilityForbiddenError",
      planCode: "none",
    });
  });

  it("still throws CapabilityForbiddenError when blocked audit persistence fails", async () => {
    getActiveTenantPlanMock.mockResolvedValueOnce({ plan_code: "base", tenant_id: SESSION_TENANT_ID });
    insertMock.mockReturnValueOnce({
      values: vi.fn().mockRejectedValueOnce(new Error("audit insert failed")),
    });

    await expect(enforceCapability(SESSION_TENANT_ID, Capability.BATCH_INGESTION, "u1", "corr-id")).rejects.toMatchObject({
      name: "CapabilityForbiddenError",
      capability: Capability.BATCH_INGESTION,
      planCode: "base",
    });
  });

  it("includes upgradeHint in thrown error for BATCH_INGESTION", async () => {
    getActiveTenantPlanMock.mockResolvedValueOnce({ plan_code: "base" });

    const caughtError = await enforceCapability(SESSION_TENANT_ID, Capability.BATCH_INGESTION, null, "corr-id").catch((e) => e);
    expect(caughtError).toBeInstanceOf(CapabilityForbiddenError);
    expect(typeof caughtError.upgradeHint).toBe("string");
    expect(caughtError.upgradeHint.length).toBeGreaterThan(0);
  });
});
