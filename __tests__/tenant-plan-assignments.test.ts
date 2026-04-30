import { describe, expect, it } from "vitest";
import { plans } from "@/lib/db/schema/plans";
import { tenantPlanAssignments } from "@/lib/db/schema/tenant-plan-assignments";
import { tenantPlanAssignmentHistory } from "@/lib/db/schema/tenant-plan-assignment-history";

describe("tenant plan schemas", () => {
  it("defines commercial plan catalog columns", () => {
    expect(plans.id).toBeDefined();
    expect(plans.planCode).toBeDefined();
    expect(plans.displayName).toBeDefined();
    expect(plans.isActive).toBeDefined();
    expect(plans.createdAt).toBeDefined();
    expect(plans.updatedAt).toBeDefined();
  });

  it("defines active assignment with tenant and effective window", () => {
    expect(tenantPlanAssignments.id).toBeDefined();
    expect(tenantPlanAssignments.tenantId).toBeDefined();
    expect(tenantPlanAssignments.planId).toBeDefined();
    expect(tenantPlanAssignments.effectiveFrom).toBeDefined();
    expect(tenantPlanAssignments.effectiveTo).toBeDefined();
    expect(tenantPlanAssignments.changedBy).toBeDefined();
    expect(tenantPlanAssignments.changedAt).toBeDefined();
    expect(tenantPlanAssignments.correlationId).toBeDefined();
  });

  it("defines append-only assignment history columns", () => {
    expect(tenantPlanAssignmentHistory.id).toBeDefined();
    expect(tenantPlanAssignmentHistory.assignmentId).toBeDefined();
    expect(tenantPlanAssignmentHistory.tenantId).toBeDefined();
    expect(tenantPlanAssignmentHistory.planId).toBeDefined();
    expect(tenantPlanAssignmentHistory.effectiveFrom).toBeDefined();
    expect(tenantPlanAssignmentHistory.effectiveTo).toBeDefined();
    expect(tenantPlanAssignmentHistory.changedBy).toBeDefined();
    expect(tenantPlanAssignmentHistory.changedAt).toBeDefined();
    expect(tenantPlanAssignmentHistory.correlationId).toBeDefined();
  });
});
