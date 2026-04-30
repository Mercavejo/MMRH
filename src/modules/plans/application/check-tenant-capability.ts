import type { Capability, CapabilityCheckResult } from "../domain/capabilities";
import { PLAN_CAPABILITIES } from "../domain/capabilities";
import { getActiveTenantPlan } from "./get-active-tenant-plan";

export async function checkTenantCapability(
  tenantId: string,
  capability: Capability,
): Promise<CapabilityCheckResult> {
  const activePlan = await getActiveTenantPlan(tenantId);

  if (!activePlan) {
    return {
      allowed: false,
      planCode: "none",
      capability,
      upgradeRequired: true,
    };
  }

  const planCapabilities = PLAN_CAPABILITIES[activePlan.plan_code as keyof typeof PLAN_CAPABILITIES];
  const allowed = Boolean(planCapabilities && planCapabilities.has(capability));

  return {
    allowed,
    planCode: activePlan.plan_code,
    capability,
    upgradeRequired: !allowed,
  };
}
