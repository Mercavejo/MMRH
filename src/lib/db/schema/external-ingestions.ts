import { jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";

export const externalIngestionStatusEnum = pgEnum("external_ingestion_status", [
  "received",
  "processing",
  "processed",
  "failed",
]);

export const externalIngestionFailureCodeEnum = pgEnum("external_ingestion_failure_code", [
  "UNAUTHORIZED_SOURCE",
  "INVALID_PAYLOAD",
  "INVALID_CONTRACT_VERSION",
  "TENANT_MISMATCH",
  "DUPLICATE_INGESTION",
  "PROCESSING_FAILURE",
]);

export const externalIngestionValidationResultEnum = pgEnum("external_ingestion_validation_result", [
  "success",
  "failure",
]);

export const externalIngestions = pgTable(
  "external_ingestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    sourceSystem: text("source_system").notNull(),
    contractVersion: text("contract_version").notNull().default("v1"),
    sourceReference: text("source_reference").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: externalIngestionStatusEnum("status").notNull().default("received"),
    validationResult: externalIngestionValidationResultEnum("validation_result").notNull().default("success"),
    validationFailureCode: externalIngestionFailureCodeEnum("validation_failure_code"),
    validatedAt: timestamp("validated_at", { withTimezone: true }).notNull().defaultNow(),
    payloadSummary: jsonb("payload_summary").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureCode: externalIngestionFailureCodeEnum("failure_code"),
    recommendedAction: text("recommended_action"),
    correlationId: uuid("correlation_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantSourceReferenceUidx: uniqueIndex("external_ingestions_tenant_source_reference_uidx").on(
      table.tenantId,
      table.sourceSystem,
      table.sourceReference,
    ),
    tenantSourceIdempotencyUidx: uniqueIndex("external_ingestions_tenant_source_idempotency_uidx").on(
      table.tenantId,
      table.sourceSystem,
      table.idempotencyKey,
    ),
  }),
);