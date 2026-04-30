import { integer, pgTable, text, timestamp, uniqueIndex, uuid, check } from "drizzle-orm/pg-core";
import { tenants } from "../tenants";
import { sql } from "drizzle-orm";

export const tenantCapabilityUsage = pgTable(
  "tenant_capability_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    capability: text("capability").notNull(),
    planCode: text("plan_code").notNull(),
    usageCount: integer("usage_count").notNull().default(0),
    period: text("period").notNull(), // Formato: YYYY-MM
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),


  },
  (table) => {
    return {
      tenantCapabilityPeriodIdx: uniqueIndex("idx_tenant_capability_period").on(
        table.tenantId,
        table.capability,
        table.period,
        table.planCode
      ),

      usageCountCheck: check("usage_count_non_negative", sql`${table.usageCount} >= 0`),
      periodFormatCheck: check("period_format_check", sql`${table.period} ~ '^\d{4}-\d{2}$'`),
    };
  }
);
