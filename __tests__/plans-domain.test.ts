import { describe, expect, it } from "vitest";
import {
  normalizeCommercialPlanInput,
  normalizeTenantPlanAssignmentInput,
  resolveAssignmentTransition,
} from "@/modules/plans/domain/plans";

describe("plans domain", () => {
  it("normalizes commercial plan input", () => {
    const normalized = normalizeCommercialPlanInput({
      planCode: " Professional ",
      displayName: "Plano Professional",
      description: " Recursos ampliados ",
    });

    expect(normalized).toEqual({
      plan_code: "professional",
      display_name: "Plano Professional",
      description: "Recursos ampliados",
    });
  });

  it("builds assignment transition as noop for same active plan", () => {
    const transition = resolveAssignmentTransition({
      activeAssignment: {
        assignment_id: "a1",
        tenant_id: "t1",
        plan_id: "p1",
        plan_code: "base",
        display_name: "Base",
        description: null,
        effective_from: "2026-04-13T00:00:00.000Z",
        effective_to: null,
        changed_by: "u1",
        changed_at: "2026-04-13T00:00:00.000Z",
        correlation_id: "c1",
        change_reason: null,
      },
      nextPlanId: "p1",
    });

    expect(transition.mode).toBe("noop");
    expect(transition.should_close_previous).toBe(false);
  });

  it("normalizes tenant assignment input with correlation id", () => {
    const normalized = normalizeTenantPlanAssignmentInput({
      tenantId: "11111111-1111-4111-8111-111111111111",
      planId: "22222222-2222-4222-8222-222222222222",
      changedBy: "33333333-3333-4333-8333-333333333333",
      correlationId: "44444444-4444-4444-8444-444444444444",
      changeReason: "upgrade",
    });

    expect(normalized.tenant_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(normalized.plan_id).toBe("22222222-2222-4222-8222-222222222222");
    expect(normalized.change_reason).toBe("upgrade");
  });
});
