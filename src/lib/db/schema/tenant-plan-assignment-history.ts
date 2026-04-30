import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { plans } from "./plans";
import { tenantPlanAssignments } from "./tenant-plan-assignments";
import { tenants } from "./tenants";
import { users } from "./users";

export const tenantPlanAssignmentHistory = pgTable(
  "tenant_plan_assignment_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => tenantPlanAssignments.id, { onDelete: "restrict" }),
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
  },
  (table) => ({
    assignmentChangedAtIdx: index("tenant_plan_assignment_history_assignment_changed_at_idx").on(
      table.assignmentId,
      table.changedAt,
    ),
    tenantChangedAtIdx: index("tenant_plan_assignment_history_tenant_changed_at_idx").on(
      table.tenantId,
      table.changedAt,
    ),
  }),
);
