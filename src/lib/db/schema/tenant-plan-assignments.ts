import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { plans } from "./plans";
import { tenants } from "./tenants";
import { users } from "./users";

export const tenantPlanAssignments = pgTable(
  "tenant_plan_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    changedBy: uuid("changed_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
    correlationId: uuid("correlation_id").notNull(),
    changeReason: text("change_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    activeByTenantUidx: uniqueIndex("tenant_plan_assignments_active_tenant_uidx")
      .on(table.tenantId)
      .where(sql`${table.effectiveTo} IS NULL`),
    tenantWindowIdx: index("tenant_plan_assignments_tenant_window_idx").on(
      table.tenantId,
      table.effectiveFrom,
      table.effectiveTo,
    ),
  }),
);
