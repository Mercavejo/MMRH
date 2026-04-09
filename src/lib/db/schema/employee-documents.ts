import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const documentStatusEnum = pgEnum("document_status", [
  "published",
  "pending",
  "processing",
  "unavailable",
  "error",
]);

export const employeeDocuments = pgTable("employee_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "restrict" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  documentType: text("document_type").notNull(),
  periodRef: text("period_ref").notNull(),
  status: documentStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});