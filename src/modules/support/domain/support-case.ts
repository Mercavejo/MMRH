import { buildAuditTimeline, type AuditEventRecord, type AuditTimelineEntry } from "@/modules/audit/domain/audit-event-filters";

export const SUPPORT_CASE_STATUSES = ["open", "in_treatment", "resolved"] as const;
export const SUPPORT_CASE_SEVERITIES = ["critical", "warning", "info"] as const;
export const SUPPORT_RESULT_STATUSES = ["resolved", "partial", "failed"] as const;

export type SupportCaseStatus = (typeof SUPPORT_CASE_STATUSES)[number];
export type SupportCaseSeverity = (typeof SUPPORT_CASE_SEVERITIES)[number];
export type SupportResultStatus = (typeof SUPPORT_RESULT_STATUSES)[number];

export type SupportCaseFilterInput = {
  from?: string;
  to?: string;
  batchId?: string;
  documentId?: string;
  userId?: string;
};

export type NormalizedSupportCaseFilters = {
  from?: Date;
  to?: Date;
  batchId?: string;
  documentId?: string;
  userId?: string;
};

export type SupportCaseResolution = {
  cause_code: string;
  action_applied: string;
  result_status: SupportResultStatus;
  resolved_by: string;
  resolved_at: string;
};

export type SupportCase = {
  case_id: string;
  tenant_id: string;
  status: SupportCaseStatus;
  severity: SupportCaseSeverity;
  links: {
    batch_id: string | null;
    document_id: string | null;
    user_id: string | null;
  };
  technical_history: AuditEventRecord[];
  timeline: AuditTimelineEntry[];
  functional_history: Array<{
    source: "alerts" | "exceptions";
    status: string;
    message: string;
    occurred_at: string;
  }>;
  resolution: SupportCaseResolution | null;
};

function parseUuid(value: string | undefined, field: string): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const normalized = value.trim();
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(normalized)) {
    throw new Error(`${field} invalido.`);
  }

  return normalized;
}

function parseDate(value: string | undefined, field: string): Date | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} invalido.`);
  }

  return parsed;
}

export function normalizeSupportCaseFilters(input: SupportCaseFilterInput): NormalizedSupportCaseFilters {
  const from = parseDate(input.from, "from");
  const to = parseDate(input.to, "to");

  if (from && to && from.getTime() > to.getTime()) {
    throw new Error("Periodo invalido.");
  }

  return {
    from,
    to,
    batchId: parseUuid(input.batchId, "batch_id"),
    documentId: parseUuid(input.documentId, "document_id"),
    userId: parseUuid(input.userId, "user_id"),
  };
}

export function isValidSupportCaseStatusTransition(previous: SupportCaseStatus, next: SupportCaseStatus): boolean {
  if (previous === "open") {
    return next === "in_treatment";
  }

  if (previous === "in_treatment") {
    return next === "resolved";
  }

  return false;
}

export function deriveSupportCaseStatus(events: Array<Pick<AuditEventRecord, "action">>): SupportCaseStatus {
  const hasResolved = events.some((event) => event.action === "support.case.resolved.v1");
  if (hasResolved) {
    return "resolved";
  }

  const hasRecovery = events.some((event) => event.action === "support.case.recovery.triggered.v1");
  if (hasRecovery) {
    return "in_treatment";
  }

  return "open";
}

export function deriveSupportCaseSeverity(events: AuditEventRecord[]): SupportCaseSeverity {
  const severities = events
    .map((event) => {
      const value = event.details && typeof event.details.severity === "string" ? event.details.severity : null;
      if (value === "critical" || value === "warning" || value === "info") {
        return value;
      }

      return null;
    })
    .filter((value): value is SupportCaseSeverity => Boolean(value));

  if (severities.includes("critical")) {
    return "critical";
  }

  if (severities.includes("warning")) {
    return "warning";
  }

  return "info";
}

export function buildSupportTimeline(events: AuditEventRecord[]): AuditTimelineEntry[] {
  return buildAuditTimeline(events);
}
