import { db } from "@/lib/db/client";
import { tenantCapabilityUsage } from "@/lib/db/schema/plans/telemetry";

import { and, eq, type SQL } from "drizzle-orm";

export interface GetCapabilityTelemetryQuery {
  tenantId: string;
  period: string;
}

export async function getCapabilityTelemetry(query: GetCapabilityTelemetryQuery) {
  let condition: SQL<unknown> = eq(tenantCapabilityUsage.period, query.period);
  
  const tenantCondition = and(
    condition,
    eq(tenantCapabilityUsage.tenantId, query.tenantId),
  );

  if (tenantCondition) {
    condition = tenantCondition;
  }

  return await db
    .select({
      tenantId: tenantCapabilityUsage.tenantId,
      capability: tenantCapabilityUsage.capability,
      period: tenantCapabilityUsage.period,
      planCode: tenantCapabilityUsage.planCode,
      usageCount: tenantCapabilityUsage.usageCount,

    })
    .from(tenantCapabilityUsage)
    .where(condition);
}
