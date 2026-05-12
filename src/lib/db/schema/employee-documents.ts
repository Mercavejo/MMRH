import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";
import { batches } from "./batches";

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
  batchId: uuid("batch_id")
    .references(() => batches.id, { onDelete: "set null" }),
  documentType: text("document_type").notNull(),
  periodRef: text("period_ref").notNull(),
  storageKey: text("storage_key"),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  sourcePageIndex: integer("source_page_index"),
  contentBase64: text("content_base64"),
  status: documentStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
