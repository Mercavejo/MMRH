import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { batches } from "@/lib/db/schema";
import type { BatchAlertSourceRow, NormalizedOperationalAlertFilters } from "../domain/operational-alert";

type DbLike = typeof db;

export async function listOperationalAlertsSourceRows(
  input: { tenantId: string; filters: NormalizedOperationalAlertFilters },
  dbClient: DbLike = db,
): Promise<BatchAlertSourceRow[]> {
  const conditions = [eq(batches.tenantId, input.tenantId)];

  if (input.filters.batchId) {
    conditions.push(eq(batches.id, input.filters.batchId));
  }

  if (input.filters.from) {
    conditions.push(gte(batches.updatedAt, input.filters.from));
  }

  if (input.filters.to) {
    conditions.push(lte(batches.updatedAt, input.filters.to));
  }

  return dbClient
    .select({
      id: batches.id,
      tenantId: batches.tenantId,
      correlationId: batches.correlationId,
      validationStatus: batches.validationStatus,
      routingStatus: batches.routingStatus,
      routingTotalCount: batches.routingTotalCount,
      routingMatchedCount: batches.routingMatchedCount,
      routingPendingCount: batches.routingPendingCount,
      routingFailedCount: batches.routingFailedCount,
      routingAmbiguousCount: batches.routingAmbiguousCount,
      publicationStatus: batches.publicationStatus,
      createdAt: batches.createdAt,
      updatedAt: batches.updatedAt,
      routingProcessedAt: batches.routingProcessedAt,
      publishedAt: batches.publishedAt,
      organizationalUnit: batches.organizationalUnit,
    })
    .from(batches)
    .where(and(...conditions))
    .limit(200);
}
