import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { batches } from "@/lib/db/schema";
import type {
  NormalizedOperationalIndicatorsFilters,
  OperationalIndicatorsAggregate,
} from "../domain/operational-indicators";

type DbLike = typeof db;

type AggregateRow = {
  totalBatches: number;
  publishedBatches: number;
  routingTotalCount: number;
  routingMatchedCount: number;
  pendingItems: number;
  ambiguousItems: number;
};

export async function getOperationalIndicatorsAggregateFromDb(
  input: { tenantId: string; filters: NormalizedOperationalIndicatorsFilters },
  dbClient: DbLike = db,
): Promise<OperationalIndicatorsAggregate> {
  const conditions = [eq(batches.tenantId, input.tenantId)];

  if (input.filters.batchId) {
    conditions.push(eq(batches.id, input.filters.batchId));
  }

  if (input.filters.from) {
    conditions.push(gte(batches.createdAt, input.filters.from));
  }

  if (input.filters.to) {
    conditions.push(lte(batches.createdAt, input.filters.to));
  }

  if (input.filters.organizationalUnit) {
    conditions.push(eq(batches.organizationalUnit, input.filters.organizationalUnit));
  }

  const rows = await dbClient
    .select({
      totalBatches: sql<number>`count(*)::int`,
      publishedBatches: sql<number>`coalesce(sum(case when ${batches.publicationStatus} = 'published' then 1 else 0 end), 0)::int`,
      routingTotalCount: sql<number>`coalesce(sum(${batches.routingTotalCount}), 0)::int`,
      routingMatchedCount: sql<number>`coalesce(sum(${batches.routingMatchedCount}), 0)::int`,
      pendingItems: sql<number>`coalesce(sum(${batches.routingPendingCount}), 0)::int`,
      ambiguousItems: sql<number>`coalesce(sum(${batches.routingAmbiguousCount}), 0)::int`,
    })
    .from(batches)
    .where(and(...conditions));

  const row = rows[0] as AggregateRow | undefined;

  return {
    totalBatches: row?.totalBatches ?? 0,
    publishedBatches: row?.publishedBatches ?? 0,
    routingTotalCount: row?.routingTotalCount ?? 0,
    routingMatchedCount: row?.routingMatchedCount ?? 0,
    pendingItems: row?.pendingItems ?? 0,
    ambiguousItems: row?.ambiguousItems ?? 0,
  };
}