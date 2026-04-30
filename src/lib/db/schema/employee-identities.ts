import { pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const employeeIdentityStatusEnum = pgEnum("employee_identity_status", [
  "pending_activation",
  "active",
  "blocked",
  "inactive",
]);

export const employeeIdentities = pgTable(
  "employee_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    referenceCode: text("reference_code").notNull(),
    employeeName: text("employee_name").notNull(),
    admissionDate: text("admission_date").notNull(),
    status: employeeIdentityStatusEnum("status").notNull().default("pending_activation"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("employee_identities_tenant_reference_unique").on(table.tenantId, table.referenceCode)],
);
