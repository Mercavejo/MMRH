export type AuditEventRecord = {
  id: string;
  action: string;
  status: "success" | "failure";
  resource_type: string;
  resource_id: string;
  actor_id: string | null;
  correlation_id: string;
  created_at: string;
  details: Record<string, unknown> | null;
};

export type AuditTimelineEntry = {
  event_id: string;
  action: string;
  status: "success" | "failure";
  occurred_at: string;
};

export type AuditFilterInput = {
  from?: string;
  to?: string;
  batchId?: string;
  documentId?: string;
  userId?: string;
  page?: number;
  pageSize?: number;
};

export type NormalizedAuditFilters = {
  from?: Date;
  to?: Date;
  batchId?: string;
  documentId?: string;
  userId?: string;
  page: number;
  pageSize: number;
};

function parseIsoDate(value: string | undefined, label: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} invalido.`);
  }

  return parsed;
}

export function normalizeAuditFilters(input: AuditFilterInput): NormalizedAuditFilters {
  const from = parseIsoDate(input.from, "from");
  const to = parseIsoDate(input.to, "to");

  if (from && to && from.getTime() > to.getTime()) {
    throw new Error("Periodo invalido.");
  }

  const batchId = input.batchId?.trim() || undefined;
  const documentId = input.documentId?.trim() || undefined;
  if (batchId && documentId) {
    throw new Error("Filtros batch_id e document_id nao podem ser usados juntos.");
  }

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));

  return {
    from,
    to,
    batchId,
    documentId,
    userId: input.userId?.trim() || undefined,
    page,
    pageSize,
  };
}

export function buildAuditTimeline(events: Array<Pick<AuditEventRecord, "id" | "action" | "status" | "created_at">>): AuditTimelineEntry[] {
  return [...events]
    .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
    .map((event) => ({
      event_id: event.id,
      action: event.action,
      status: event.status,
      occurred_at: event.created_at,
    }));
}
