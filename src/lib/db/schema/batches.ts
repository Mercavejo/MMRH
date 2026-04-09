import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";
import type { BatchRoutingManifestItem } from "@/lib/rh/batches/batch-routing";

export const batchSourceFormatEnum = pgEnum("batch_source_format", ["csv", "json"]);

export const batchValidationStatusEnum = pgEnum("batch_validation_status", [
  "validated",
  "blocked",
]);

export const batchRoutingStatusEnum = pgEnum("batch_routing_status", [
  "pending",
  "processing",
  "blocked",
  "completed",
  "failed",
]);

export const batches = pgTable("batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "restrict" }),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  originalFilename: text("original_filename").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  mimeType: text("mime_type").notNull(),
  sourceFormat: batchSourceFormatEnum("source_format").notNull(),
  validationStatus: batchValidationStatusEnum("validation_status").notNull(),
  validationSummary: jsonb("validation_summary").$type<Record<string, unknown>>().notNull(),
  routingStatus: batchRoutingStatusEnum("routing_status").notNull().default("pending"),
  routingManifest: jsonb("routing_manifest")
    .$type<BatchRoutingManifestItem[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  routingTotalCount: integer("routing_total_count").notNull().default(0),
  routingMatchedCount: integer("routing_matched_count").notNull().default(0),
  routingPendingCount: integer("routing_pending_count").notNull().default(0),
  routingFailedCount: integer("routing_failed_count").notNull().default(0),
  routingAmbiguousCount: integer("routing_ambiguous_count").notNull().default(0),
  routingBlockedReason: text("routing_blocked_reason"),
  routingProcessedAt: timestamp("routing_processed_at", { withTimezone: true }),
  correlationId: uuid("correlation_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});