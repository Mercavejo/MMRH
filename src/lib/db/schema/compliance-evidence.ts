import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const complianceEvidenceStatusEnum = pgEnum("compliance_evidence_status", [
  "success",
  "failure",
]);

export const complianceEvidence = pgTable("compliance_evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "restrict" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  correlationId: uuid("correlation_id").notNull(),
  action: text("action").notNull(),
  legalBasis: text("legal_basis").notNull(),
  dataCategory: text("data_category").notNull(),
  retentionAppliedDays: integer("retention_applied_days").notNull(),
  status: complianceEvidenceStatusEnum("status").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
