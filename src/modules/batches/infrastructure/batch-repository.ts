import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { batches, exceptions } from "@/lib/db/schema";

type DbLike = Pick<typeof db, "select" | "update">;

export type BatchPublicationSnapshot = {
  id: string;
  tenantId: string;
  validationStatus: string;
  routingStatus: string;
  routingTotalCount: number;
  routingMatchedCount: number;
  routingPendingCount: number;
  routingFailedCount: number;
  routingAmbiguousCount: number;
  routingBlockedReason: string | null;
  routingProcessedAt: Date | string | null;
  publicationStatus: string;
  publicationAttempts: number;
  publishedAt: Date | string | null;
  publishedBy: string | null;
  lastPublicationCorrelationId: string | null;
  lastPublicationIdempotencyKey: string | null;
  lastPublicationError: string | null;
};

export async function loadBatchPublicationSnapshot(
  input: { tenantId: string; batchId: string },
  dbClient: DbLike = db,
): Promise<BatchPublicationSnapshot | null> {
  const rows = await dbClient
    .select({
      id: batches.id,
      tenantId: batches.tenantId,
      validationStatus: batches.validationStatus,
      routingStatus: batches.routingStatus,
      routingTotalCount: batches.routingTotalCount,
      routingMatchedCount: batches.routingMatchedCount,
      routingPendingCount: batches.routingPendingCount,
      routingFailedCount: batches.routingFailedCount,
      routingAmbiguousCount: batches.routingAmbiguousCount,
      routingBlockedReason: batches.routingBlockedReason,
      routingProcessedAt: batches.routingProcessedAt,
      publicationStatus: batches.publicationStatus,
      publicationAttempts: batches.publicationAttempts,
      publishedAt: batches.publishedAt,
      publishedBy: batches.publishedBy,
      lastPublicationCorrelationId: batches.lastPublicationCorrelationId,
      lastPublicationIdempotencyKey: batches.lastPublicationIdempotencyKey,
      lastPublicationError: batches.lastPublicationError,
    })
    .from(batches)
    .where(and(eq(batches.id, input.batchId), eq(batches.tenantId, input.tenantId)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return row.tenantId === input.tenantId ? row : null;
}

export async function loadBatchPublicationExceptions(
  input: { tenantId: string; batchId: string },
  dbClient: DbLike = db,
): Promise<Array<{ currentState: string }>> {
  return dbClient
    .select({ currentState: exceptions.currentState })
    .from(exceptions)
    .where(and(eq(exceptions.batchId, input.batchId), eq(exceptions.tenantId, input.tenantId)));
}

export async function markBatchPublicationStarting(
  input: {
    tenantId: string;
    batchId: string;
    correlationId: string;
    idempotencyKey: string;
    currentPublicationAttempts: number;
  },
  dbClient: DbLike = db,
): Promise<BatchPublicationSnapshot | null> {
  const now = new Date();

  const rows = await dbClient
    .update(batches)
    .set({
      publicationStatus: "publishing",
      publicationAttempts: input.currentPublicationAttempts + 1,
      lastPublicationCorrelationId: input.correlationId,
      lastPublicationIdempotencyKey: input.idempotencyKey,
      lastPublicationError: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(batches.id, input.batchId),
        eq(batches.tenantId, input.tenantId),
        inArray(batches.publicationStatus, ["pending", "failed"]),
      ),
    )
    .returning({
      id: batches.id,
      tenantId: batches.tenantId,
      validationStatus: batches.validationStatus,
      routingStatus: batches.routingStatus,
      routingTotalCount: batches.routingTotalCount,
      routingMatchedCount: batches.routingMatchedCount,
      routingPendingCount: batches.routingPendingCount,
      routingFailedCount: batches.routingFailedCount,
      routingAmbiguousCount: batches.routingAmbiguousCount,
      routingBlockedReason: batches.routingBlockedReason,
      routingProcessedAt: batches.routingProcessedAt,
      publicationStatus: batches.publicationStatus,
      publicationAttempts: batches.publicationAttempts,
      publishedAt: batches.publishedAt,
      publishedBy: batches.publishedBy,
      lastPublicationCorrelationId: batches.lastPublicationCorrelationId,
      lastPublicationIdempotencyKey: batches.lastPublicationIdempotencyKey,
      lastPublicationError: batches.lastPublicationError,
    });

  return rows[0] ?? null;
}

export async function markBatchPublicationSucceeded(
  input: {
    tenantId: string;
    batchId: string;
    actorId: string;
    correlationId: string;
    idempotencyKey: string;
  },
  dbClient: DbLike = db,
): Promise<void> {
  const now = new Date();

  await dbClient
    .update(batches)
    .set({
      publicationStatus: "published",
      publishedAt: now,
      publishedBy: input.actorId,
      lastPublicationCorrelationId: input.correlationId,
      lastPublicationIdempotencyKey: input.idempotencyKey,
      lastPublicationError: null,
      updatedAt: now,
    })
    .where(and(eq(batches.id, input.batchId), eq(batches.tenantId, input.tenantId)));
}

export async function markBatchPublicationFailed(
  input: {
    tenantId: string;
    batchId: string;
    correlationId: string;
    idempotencyKey: string;
    errorMessage: string;
  },
  dbClient: DbLike = db,
): Promise<void> {
  const now = new Date();

  await dbClient
    .update(batches)
    .set({
      publicationStatus: "failed",
      lastPublicationCorrelationId: input.correlationId,
      lastPublicationIdempotencyKey: input.idempotencyKey,
      lastPublicationError: input.errorMessage,
      updatedAt: now,
    })
    .where(and(eq(batches.id, input.batchId), eq(batches.tenantId, input.tenantId)));
}

export async function loadLatestBatch(
  input: { tenantId: string },
  dbClient: DbLike = db,
): Promise<BatchPublicationSnapshot | null> {
  const rows = await dbClient
    .select({
      id: batches.id,
      tenantId: batches.tenantId,
      validationStatus: batches.validationStatus,
      routingStatus: batches.routingStatus,
      routingTotalCount: batches.routingTotalCount,
      routingMatchedCount: batches.routingMatchedCount,
      routingPendingCount: batches.routingPendingCount,
      routingFailedCount: batches.routingFailedCount,
      routingAmbiguousCount: batches.routingAmbiguousCount,
      routingBlockedReason: batches.routingBlockedReason,
      routingProcessedAt: batches.routingProcessedAt,
      publicationStatus: batches.publicationStatus,
      publicationAttempts: batches.publicationAttempts,
      publishedAt: batches.publishedAt,
      publishedBy: batches.publishedBy,
      lastPublicationCorrelationId: batches.lastPublicationCorrelationId,
      lastPublicationIdempotencyKey: batches.lastPublicationIdempotencyKey,
      lastPublicationError: batches.lastPublicationError,
    })
    .from(batches)
    .where(eq(batches.tenantId, input.tenantId))
    .orderBy(sql`created_at desc`)
    .limit(1);

  return rows[0] ?? null;
}
