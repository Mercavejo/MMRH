export type CommercialPlan = {
  id: string;
  plan_code: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ActiveTenantPlan = {
  assignment_id: string;
  tenant_id: string;
  plan_id: string;
  plan_code: string;
  display_name: string;
  description: string | null;
  effective_from: string;
  effective_to: string | null;
  changed_by: string;
  changed_at: string;
  correlation_id: string;
  change_reason: string | null;
};

export type PlanAssignmentTransition = {
  mode: "create" | "switch" | "noop";
  should_close_previous: boolean;
};

function parseRequiredText(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} invalido.`);
  }

  return normalized;
}

function parseOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizeCommercialPlanInput(input: {
  planCode: string;
  displayName: string;
  description?: string | null;
}) {
  const planCode = parseRequiredText(input.planCode, "plan_code").toLowerCase();
  const displayName = parseRequiredText(input.displayName, "display_name");

  if (planCode.length < 2 || planCode.length > 64) {
    throw new Error("plan_code invalido.");
  }

  if (displayName.length < 2 || displayName.length > 120) {
    throw new Error("display_name invalido.");
  }

  return {
    plan_code: planCode,
    display_name: displayName,
    description: parseOptionalText(input.description),
  };
}

export function normalizeTenantPlanAssignmentInput(input: {
  tenantId: string;
  planId: string;
  changedBy: string;
  correlationId: string;
  effectiveFrom?: string;
  changeReason?: string | null;
}) {
  return {
    tenant_id: parseRequiredText(input.tenantId, "tenant_id"),
    plan_id: parseRequiredText(input.planId, "plan_id"),
    changed_by: parseRequiredText(input.changedBy, "changed_by"),
    correlation_id: parseRequiredText(input.correlationId, "correlation_id"),
    effective_from: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
    change_reason: parseOptionalText(input.changeReason),
  };
}

export function resolveAssignmentTransition(input: {
  activeAssignment: ActiveTenantPlan | null;
  nextPlanId: string;
}): PlanAssignmentTransition {
  if (!input.activeAssignment) {
    return {
      mode: "create",
      should_close_previous: false,
    };
  }

  if (input.activeAssignment.plan_id === input.nextPlanId) {
    return {
      mode: "noop",
      should_close_previous: false,
    };
  }

  return {
    mode: "switch",
    should_close_previous: true,
  };
}
