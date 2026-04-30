import { integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";

export const externalEventDeliveryStatusEnum = pgEnum("external_event_delivery_status", [
  "pending",
  "delivering",
  "delivered",
  "failed",
]);

export const externalEventDeliveryFailureCodeEnum = pgEnum("external_event_delivery_failure_code", [
  "FORBIDDEN_CONSUMER",
  "CONSUMER_CONFIGURATION_MISSING",
  "TRANSPORT_FAILURE",
  "RETRY_EXHAUSTED",
  "INVALID_EVENT_PAYLOAD",
]);

export const externalEventDeliveries = pgTable(
  "external_event_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    consumerKey: text("consumer_key").notNull(),
    eventName: text("event_name").notNull(),
    eventVersion: text("event_version").notNull().default("v1"),
    sourceReference: text("source_reference").notNull(),
    fingerprint: text("fingerprint").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: externalEventDeliveryStatusEnum("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastError: text("last_error"),
    failureCode: externalEventDeliveryFailureCodeEnum("failure_code"),
    recommendedAction: text("recommended_action"),
    payloadSummary: jsonb("payload_summary").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    correlationId: uuid("correlation_id").notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantConsumerFingerprintUidx: uniqueIndex("external_event_deliveries_tenant_consumer_fingerprint_uidx").on(
      table.tenantId,
      table.consumerKey,
      table.fingerprint,
    ),
    tenantEventIdempotencyUidx: uniqueIndex("external_event_deliveries_tenant_event_idempotency_uidx").on(
      table.tenantId,
      table.eventName,
      table.idempotencyKey,
    ),
  }),
);