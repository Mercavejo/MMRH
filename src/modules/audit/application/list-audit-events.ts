import {
  buildAuditTimeline,
  normalizeAuditFilters,
  type AuditFilterInput,
} from "../domain/audit-event-filters";
import {
  AuditEventsError,
  listAuditEventsFromDb,
} from "../infrastructure/audit-events-repository";

export { AuditEventsError };

export async function listAuditEvents(input: {
  tenantId: string;
  from?: string;
  to?: string;
  batchId?: string;
  documentId?: string;
  userId?: string;
  page?: number;
  pageSize?: number;
}) {
  let normalized: ReturnType<typeof normalizeAuditFilters>;

  try {
    normalized = normalizeAuditFilters({
      from: input.from,
      to: input.to,
      batchId: input.batchId,
      documentId: input.documentId,
      userId: input.userId,
      page: input.page,
      pageSize: input.pageSize,
    } satisfies AuditFilterInput);
  } catch (error) {
    throw new AuditEventsError("VALIDATION_ERROR", (error as Error).message, 400);
  }

  const result = await listAuditEventsFromDb({
    tenantId: input.tenantId,
    filters: normalized,
  });

  const totalPages = Math.max(1, Math.ceil(result.total / normalized.pageSize));

  return {
    events: result.events,
    timeline: buildAuditTimeline(result.timelineEvents),
    pagination: {
      page: normalized.page,
      page_size: normalized.pageSize,
      total: result.total,
      total_pages: totalPages,
    },
  };
}
