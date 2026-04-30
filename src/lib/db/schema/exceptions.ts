import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { batches } from "./batches";
import { tenants } from "./tenants";
import { users } from "./users";

export const exceptionErrorCategoryEnum = pgEnum("exception_error_category", [
  "not-found",
  "invalid-format",
  "ambiguous-routing",
  "other",
]);

export const exceptionPriorityEnum = pgEnum("exception_priority", ["high", "medium", "low"]);

export const exceptionStateEnum = pgEnum("exception_state", [
  "pending",
  "in-treatment",
  "resolved",
  "blocked",
]);

export const exceptionCorrectionResultEnum = pgEnum("exception_correction_result", [
  "reprocessable",
  "reject",
  "publish-with-evidence",
]);

export const exceptions = pgTable("exceptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => batches.id, { onDelete: "restrict" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "restrict" }),
  documentExternalId: text("document_external_id").notNull(),
  associatedEmployeeId: uuid("associated_employee_id").references(() => users.id, {
    onDelete: "set null",
  }),
  assocEmployeeExternalId: text("assoc_employee_external_id"),
  routingAmbiguityDetails: jsonb("routing_ambiguity_details").$type<Record<string, unknown> | null>(),
  errorCategory: exceptionErrorCategoryEnum("error_category").notNull().default("other"),
  priority: exceptionPriorityEnum("priority").notNull().default("medium"),
  currentState: exceptionStateEnum("current_state").notNull().default("pending"),
  recommendedAction: text("recommended_action"),
  correctionApplied: text("correction_applied"),
  correctionResult: exceptionCorrectionResultEnum("correction_result"),
  resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  reprocessAttempts: integer("reprocess_attempts").notNull().default(0),
  lastReprocessAt: timestamp("last_reprocess_at", { withTimezone: true }),
  lastReprocessCorrelationId: uuid("last_reprocess_correlation_id"),
  lastReprocessIdempotencyKey: text("last_reprocess_idempotency_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});