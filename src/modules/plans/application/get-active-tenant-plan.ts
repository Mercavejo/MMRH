import { getActiveTenantPlanInDb } from "../infrastructure/plans-repository";

export async function getActiveTenantPlan(tenantId: string) {
  return getActiveTenantPlanInDb(tenantId);
}
