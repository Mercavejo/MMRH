import { normalizeTenantPlanAssignmentInput, resolveAssignmentTransition } from "../domain/plans";
import { assignTenantPlanInDb, getActiveTenantPlanInDb, getPlanByCodeInDb } from "../infrastructure/plans-repository";
import { CommercialPlanError } from "./create-commercial-plan";

export async function assignTenantPlan(input: {
  tenantId: string;
  planCode: string;
  actorId: string;
  correlationId: string;
  effectiveFrom?: string;
  changeReason?: string | null;
}) {
  const plan = await getPlanByCodeInDb(input.planCode.trim().toLowerCase());
  if (!plan || !plan.is_active) {
    throw new CommercialPlanError("NOT_FOUND", "Plano comercial nao encontrado ou inativo.", 404, {
      plan_code: input.planCode,
    });
  }

  let normalized;
  try {
    normalized = normalizeTenantPlanAssignmentInput({
      tenantId: input.tenantId,
      planId: plan.id,
      changedBy: input.actorId,
      correlationId: input.correlationId,
      effectiveFrom: input.effectiveFrom,
      changeReason: input.changeReason,
    });
  } catch (error) {
    throw new CommercialPlanError("VALIDATION_ERROR", (error as Error).message, 400);
  }

  const current = await getActiveTenantPlanInDb(normalized.tenant_id);
  const transition = resolveAssignmentTransition({
    activeAssignment: current,
    nextPlanId: plan.id,
  });

  if (transition.mode === "noop" && current) {
    return {
      mode: transition.mode,
      active_plan: current,
    };
  }

  const assigned = await assignTenantPlanInDb({
    tenantId: normalized.tenant_id,
    planId: normalized.plan_id,
    actorId: normalized.changed_by,
    correlationId: normalized.correlation_id,
    effectiveFrom: normalized.effective_from,
    changeReason: normalized.change_reason,
  });

  return {
    mode: assigned.mode,
    active_plan: assigned.active_plan,
  };
}
