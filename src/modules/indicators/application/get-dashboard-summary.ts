import { getOperationalIndicatorsAggregateFromDb } from "../infrastructure/indicators-repository";
import { buildOperationalIndicators } from "../domain/operational-indicators";
import { loadLatestBatch } from "@/modules/batches/infrastructure/batch-repository";
import { listAuditEventsFromDb } from "@/modules/audit/infrastructure/audit-events-repository";
import { normalizeAuditFilters } from "@/modules/audit/domain/audit-event-filters";

export async function getDashboardSummary(input: { tenantId: string }) {
  // 1. Get Operational Indicators (Accuracy, Pending, Totals)
  const aggregate = await getOperationalIndicatorsAggregateFromDb({
    tenantId: input.tenantId,
    filters: {} // No filters to get global tenant summary
  });
  const indicators = buildOperationalIndicators(aggregate);

  // 2. Get Latest Batch Status
  const latestBatch = await loadLatestBatch({ tenantId: input.tenantId });

  // 3. Get Recent Audit Events (Last 5)
  const normalizedAudit = normalizeAuditFilters({ pageSize: 5 });
  const auditResult = await listAuditEventsFromDb({
    tenantId: input.tenantId,
    filters: normalizedAudit
  });

  return {
    summary: {
      totalBatches: indicators.totals.totalBatches,
      publishedBatches: indicators.totals.publishedBatches,
      pendingExceptions: indicators.pendingCount,
      accuracy: indicators.routingAccuracy * 100, // Percentage
      latestBatch: latestBatch ? {
        id: latestBatch.id,
        status: latestBatch.publicationStatus,
        processedAt: latestBatch.routingProcessedAt,
        totalItems: latestBatch.routingTotalCount
      } : null
    },
    recentActivities: auditResult.events.map(event => ({
      id: event.id,
      action: event.action,
      resource: event.resource_type,
      status: event.status,
      timestamp: event.created_at,
      description: event.details?.description as string || `${event.action} on ${event.resource_type}`
    }))
  };
}
