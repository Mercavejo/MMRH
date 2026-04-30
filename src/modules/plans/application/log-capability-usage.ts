import { db } from "@/lib/db/client";
import { tenantCapabilityUsage } from "@/lib/db/schema/plans/telemetry";

import { Capability } from "../domain/capabilities";
import { sql } from "drizzle-orm";

export async function logCapabilityUsage(tenantId: string, capability: Capability, amount: number = 1, planCode: string): Promise<number> {
  const date = new Date();
  const period = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; // e.g. 2026-04
  
  const [result] = await db.insert(tenantCapabilityUsage)
    .values({
      tenantId,
      capability,
      planCode,
      period,
      usageCount: amount,
    })
    .onConflictDoUpdate({
      target: [
        tenantCapabilityUsage.tenantId,
        tenantCapabilityUsage.capability,
        tenantCapabilityUsage.period,
        tenantCapabilityUsage.planCode,
      ],
      set: {
        usageCount: sql`${tenantCapabilityUsage.usageCount} + ${amount}`,
        updatedAt: sql`DEFAULT`
      }
    })
    .returning({ usageCount: tenantCapabilityUsage.usageCount });

  return result?.usageCount ?? amount;
}

