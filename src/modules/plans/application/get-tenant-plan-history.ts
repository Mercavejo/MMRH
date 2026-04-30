import { listTenantPlanHistoryInDb } from "../infrastructure/plans-repository";

export async function getTenantPlanHistory(tenantId: string) {
  return listTenantPlanHistoryInDb(tenantId);
}
