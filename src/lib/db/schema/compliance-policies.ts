import { sql } from "drizzle-orm";
import { boolean, check, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const minimizationProfileEnum = pgEnum("minimization_profile", [
  "strict",
  "standard",
]);

export const compliancePolicies = pgTable(
  "compliance_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" })
      .unique(),
    retentionDaysDocuments: integer("retention_days_documents").notNull(),
    retentionDaysAuditLogs: integer("retention_days_audit_logs").notNull(),
    legalBasis: text("legal_basis").notNull(),
    minimizationProfile: minimizationProfileEnum("minimization_profile")
      .notNull()
      .default("standard"),
    enabled: boolean("enabled").notNull().default(true),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "compliance_policies_retention_days_documents_range",
      sql`${table.retentionDaysDocuments} >= 1 and ${table.retentionDaysDocuments} <= 3650`,
    ),
    check(
      "compliance_policies_retention_days_audit_logs_range",
      sql`${table.retentionDaysAuditLogs} >= 1 and ${table.retentionDaysAuditLogs} <= 3650`,
    ),
  ],
);
