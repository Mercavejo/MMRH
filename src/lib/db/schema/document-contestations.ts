import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { documentStatusEnum, employeeDocuments } from "./employee-documents";
import { tenants } from "./tenants";
import { users } from "./users";

export const contestationTrackingStatusEnum = pgEnum(
  "contestation_tracking_status",
  ["open", "in_progress", "resolved"],
);

export const documentContestations = pgTable("document_contestations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "restrict" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  documentId: uuid("document_id").references(() => employeeDocuments.id, {
    onDelete: "restrict",
  }),
  periodRef: text("period_ref").notNull(),
  documentType: text("document_type").notNull(),
  sourceStatus: documentStatusEnum("source_status").notNull(),
  batchId: text("batch_id"),
  reason: text("reason").notNull(),
  trackingStatus: contestationTrackingStatusEnum("tracking_status")
    .notNull()
    .default("open"),
  resolutionNote: text("resolution_note"),
  resolvedBy: uuid("resolved_by").references(() => users.id, {
    onDelete: "set null",
  }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
