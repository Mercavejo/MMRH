import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLogs, externalEventDeliveries } from "@/lib/db/schema";
import type {
  ExternalEventDeliveryFailureCode,
  ExternalEventDeliveryStatus,
} from "../domain/external-events";

type DbLike = typeof db;

export type ExternalEventDeliveryRecord = {
  tenant_id: string;
  consumer_key: string;
  event_name: string;
  event_version: string;
  source_reference: string;
  fingerprint: string;
  idempotency_key: string;
  status: ExternalEventDeliveryStatus;
  attempt_count: number;
  last_attempt_at: string | null;
  last_error: string | null;
  failure_code: ExternalEventDeliveryFailureCode | null;
  recommended_action: string | null;
  payload_summary: Record<string, unknown>;
  correlation_id: string;
  delivered_at: string | null;
};

function mapDeliveryRow(row: {
  tenantId: string;
  consumerKey: string;
  eventName: string;
  eventVersion: string;
  sourceReference: string;
  fingerprint: string;
  idempotencyKey: string;
  status: ExternalEventDeliveryStatus;
  attemptCount: number;
  lastAttemptAt: Date | null;
  lastError: string | null;
  failureCode: ExternalEventDeliveryFailureCode | null;
  recommendedAction: string | null;
  payloadSummary: Record<string, unknown> | null;
  correlationId: string;
  deliveredAt: Date | null;
}): ExternalEventDeliveryRecord {
  return {
    tenant_id: row.tenantId,
    consumer_key: row.consumerKey,
    event_name: row.eventName,
    event_version: row.eventVersion,
    source_reference: row.sourceReference,
    fingerprint: row.fingerprint,
    idempotency_key: row.idempotencyKey,
    status: row.status,
    attempt_count: row.attemptCount,
    last_attempt_at: row.lastAttemptAt?.toISOString() ?? null,
    last_error: row.lastError,
    failure_code: row.failureCode,
    recommended_action: row.recommendedAction,
    payload_summary: row.payloadSummary ?? {},
    correlation_id: row.correlationId,
    delivered_at: row.deliveredAt?.toISOString() ?? null,
  };
}

async function writeExternalEventDeliveryAudit(
  input: {
    tenantId: string;
    consumerKey: string;
    correlationId: string;
    fingerprint: string;
    status: ExternalEventDeliveryStatus;
    attemptCount: number;
    failureCode?: ExternalEventDeliveryFailureCode | null;
    recommendedAction?: string | null;
    lastError?: string | null;
  },
  dbClient: DbLike,
) {
  const isSuccess = input.status === "delivered";

  await dbClient.insert(auditLogs).values({
    tenantId: input.tenantId,
    actorId: null,
    correlationId: input.correlationId,
    action: isSuccess
      ? "integrations.external_event_delivery.delivered.v1"
      : "integrations.external_event_delivery.failed.v1",
    resourceType: "external_event_delivery",
    resourceId: input.fingerprint,
    status: isSuccess ? "success" : "failure",
    details: {
      consumer_key: input.consumerKey,
      fingerprint: input.fingerprint,
      attempt_count: input.attemptCount,
      failure_code: input.failureCode ?? null,
      recommended_action: input.recommendedAction ?? null,
      last_error: input.lastError ?? null,
    },
  });
}

export async function getExternalEventDeliveryByFingerprintFromDb(input: {
  tenantId: string;
  consumerKey: string;
  fingerprint: string;
}, dbClient: DbLike = db): Promise<ExternalEventDeliveryRecord | null> {
  const rows = await dbClient
    .select({
      tenantId: externalEventDeliveries.tenantId,
      consumerKey: externalEventDeliveries.consumerKey,
      eventName: externalEventDeliveries.eventName,
      eventVersion: externalEventDeliveries.eventVersion,
      sourceReference: externalEventDeliveries.sourceReference,
      fingerprint: externalEventDeliveries.fingerprint,
      idempotencyKey: externalEventDeliveries.idempotencyKey,
      status: externalEventDeliveries.status,
      attemptCount: externalEventDeliveries.attemptCount,
      lastAttemptAt: externalEventDeliveries.lastAttemptAt,
      lastError: externalEventDeliveries.lastError,
      failureCode: externalEventDeliveries.failureCode,
      recommendedAction: externalEventDeliveries.recommendedAction,
      payloadSummary: externalEventDeliveries.payloadSummary,
      correlationId: externalEventDeliveries.correlationId,
      deliveredAt: externalEventDeliveries.deliveredAt,
    })
    .from(externalEventDeliveries)
    .where(
      and(
        eq(externalEventDeliveries.tenantId, input.tenantId),
        eq(externalEventDeliveries.consumerKey, input.consumerKey),
        eq(externalEventDeliveries.fingerprint, input.fingerprint),
      ),
    )
    .limit(1);

  const row = rows[0];
  return row ? mapDeliveryRow(row) : null;
}

export async function upsertExternalEventDeliveryStateInDb(input: {
  tenantId: string;
  consumerKey: string;
  eventName: string;
  eventVersion: string;
  sourceReference: string;
  fingerprint: string;
  idempotencyKey: string;
  status: ExternalEventDeliveryStatus;
  attemptCount: number;
  correlationId: string;
  payloadSummary: Record<string, unknown>;
  lastAttemptAt?: string | null;
  lastError?: string | null;
  failureCode?: ExternalEventDeliveryFailureCode | null;
  recommendedAction?: string | null;
  deliveredAt?: string | null;
}, dbClient: DbLike = db): Promise<ExternalEventDeliveryRecord> {
  const now = new Date();
  const existingRows = await dbClient
    .select({
      tenantId: externalEventDeliveries.tenantId,
      consumerKey: externalEventDeliveries.consumerKey,
      eventName: externalEventDeliveries.eventName,
      eventVersion: externalEventDeliveries.eventVersion,
      sourceReference: externalEventDeliveries.sourceReference,
      fingerprint: externalEventDeliveries.fingerprint,
      idempotencyKey: externalEventDeliveries.idempotencyKey,
      status: externalEventDeliveries.status,
      attemptCount: externalEventDeliveries.attemptCount,
      lastAttemptAt: externalEventDeliveries.lastAttemptAt,
      lastError: externalEventDeliveries.lastError,
      failureCode: externalEventDeliveries.failureCode,
      recommendedAction: externalEventDeliveries.recommendedAction,
      payloadSummary: externalEventDeliveries.payloadSummary,
      correlationId: externalEventDeliveries.correlationId,
      deliveredAt: externalEventDeliveries.deliveredAt,
    })
    .from(externalEventDeliveries)
    .where(
      and(
        eq(externalEventDeliveries.tenantId, input.tenantId),
        eq(externalEventDeliveries.consumerKey, input.consumerKey),
        eq(externalEventDeliveries.fingerprint, input.fingerprint),
      ),
    )
    .limit(1);

  const baseValues = {
    tenantId: input.tenantId,
    consumerKey: input.consumerKey,
    eventName: input.eventName,
    eventVersion: input.eventVersion,
    sourceReference: input.sourceReference,
    fingerprint: input.fingerprint,
    idempotencyKey: input.idempotencyKey,
    status: input.status,
    attemptCount: input.attemptCount,
    lastAttemptAt: input.lastAttemptAt ? new Date(input.lastAttemptAt) : now,
    lastError: input.lastError ?? null,
    failureCode: input.failureCode ?? null,
    recommendedAction: input.recommendedAction ?? null,
    payloadSummary: input.payloadSummary,
    correlationId: input.correlationId,
    deliveredAt: input.deliveredAt ? new Date(input.deliveredAt) : null,
    createdAt: now,
    updatedAt: now,
  };

  let row;
  if (existingRows[0]) {
    const updatedRows = await dbClient
      .update(externalEventDeliveries)
      .set({
        status: input.status,
        attemptCount: input.attemptCount,
        lastAttemptAt: input.lastAttemptAt ? new Date(input.lastAttemptAt) : now,
        lastError: input.lastError ?? null,
        failureCode: input.failureCode ?? null,
        recommendedAction: input.recommendedAction ?? null,
        payloadSummary: input.payloadSummary,
        correlationId: input.correlationId,
        deliveredAt: input.deliveredAt ? new Date(input.deliveredAt) : null,
        updatedAt: now,
      })
      .where(
        and(
          eq(externalEventDeliveries.tenantId, input.tenantId),
          eq(externalEventDeliveries.consumerKey, input.consumerKey),
          eq(externalEventDeliveries.fingerprint, input.fingerprint),
        ),
      )
      .returning({
        tenantId: externalEventDeliveries.tenantId,
        consumerKey: externalEventDeliveries.consumerKey,
        eventName: externalEventDeliveries.eventName,
        eventVersion: externalEventDeliveries.eventVersion,
        sourceReference: externalEventDeliveries.sourceReference,
        fingerprint: externalEventDeliveries.fingerprint,
        idempotencyKey: externalEventDeliveries.idempotencyKey,
        status: externalEventDeliveries.status,
        attemptCount: externalEventDeliveries.attemptCount,
        lastAttemptAt: externalEventDeliveries.lastAttemptAt,
        lastError: externalEventDeliveries.lastError,
        failureCode: externalEventDeliveries.failureCode,
        recommendedAction: externalEventDeliveries.recommendedAction,
        payloadSummary: externalEventDeliveries.payloadSummary,
        correlationId: externalEventDeliveries.correlationId,
        deliveredAt: externalEventDeliveries.deliveredAt,
      });

    row = updatedRows[0];
  } else {
    const insertedRows = await dbClient
      .insert(externalEventDeliveries)
      .values(baseValues)
      .returning({
        tenantId: externalEventDeliveries.tenantId,
        consumerKey: externalEventDeliveries.consumerKey,
        eventName: externalEventDeliveries.eventName,
        eventVersion: externalEventDeliveries.eventVersion,
        sourceReference: externalEventDeliveries.sourceReference,
        fingerprint: externalEventDeliveries.fingerprint,
        idempotencyKey: externalEventDeliveries.idempotencyKey,
        status: externalEventDeliveries.status,
        attemptCount: externalEventDeliveries.attemptCount,
        lastAttemptAt: externalEventDeliveries.lastAttemptAt,
        lastError: externalEventDeliveries.lastError,
        failureCode: externalEventDeliveries.failureCode,
        recommendedAction: externalEventDeliveries.recommendedAction,
        payloadSummary: externalEventDeliveries.payloadSummary,
        correlationId: externalEventDeliveries.correlationId,
        deliveredAt: externalEventDeliveries.deliveredAt,
      });

    row = insertedRows[0];
  }

  if (!row) {
    throw new Error("Falha ao registrar entrega de evento externo.");
  }

  if (input.status === "delivered" || input.status === "failed") {
    await writeExternalEventDeliveryAudit(
      {
        tenantId: input.tenantId,
        consumerKey: input.consumerKey,
        correlationId: input.correlationId,
        fingerprint: input.fingerprint,
        status: input.status,
        attemptCount: input.attemptCount,
        failureCode: input.failureCode ?? null,
        recommendedAction: input.recommendedAction ?? null,
        lastError: input.lastError ?? null,
      },
      dbClient,
    );
  }

  return mapDeliveryRow({
    tenantId: row.tenantId,
    consumerKey: row.consumerKey,
    eventName: row.eventName,
    eventVersion: row.eventVersion,
    sourceReference: row.sourceReference,
    fingerprint: row.fingerprint,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    attemptCount: row.attemptCount,
    lastAttemptAt: row.lastAttemptAt,
    lastError: row.lastError,
    failureCode: row.failureCode,
    recommendedAction: row.recommendedAction,
    payloadSummary: row.payloadSummary,
    correlationId: row.correlationId,
    deliveredAt: row.deliveredAt,
  });
}