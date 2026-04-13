import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLogs, batches, exceptions } from "@/lib/db/schema";
import { reprocessBatchExceptions } from "@/modules/exceptions/infrastructure/exception-repository";
import type { AuditEventRecord } from "@/modules/audit/domain/audit-event-filters";
import {
  buildSupportTimeline,
  deriveSupportCaseSeverity,
  deriveSupportCaseStatus,
  isValidSupportCaseStatusTransition,
  type NormalizedSupportCaseFilters,
  type SupportCase,
  type SupportCaseResolution,
  type SupportResultStatus,
} from "../domain/support-case";

type DbLike = typeof db;

export class SupportCaseRepositoryError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "INVALID_STATE_TRANSITION" | "BATCH_MISMATCH" | "INVALID_IDEMPOTENCY_REPLAY",
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "SupportCaseRepositoryError";
  }
}

function mapAuditRecord(row: {
  id: string;
  action: string;
  status: "success" | "failure";
  resourceType: string;
  resourceId: string;
  actorId: string | null;
  correlationId: string;
  createdAt: Date;
  details: Record<string, unknown> | null;
}): AuditEventRecord {
  return {
    id: row.id,
    action: row.action,
    status: row.status,
    resource_type: row.resourceType,
    resource_id: row.resourceId,
    actor_id: row.actorId,
    correlation_id: row.correlationId,
    created_at: row.createdAt.toISOString(),
    details: row.details,
  };
}

function readStringField(details: Record<string, unknown> | null, field: string): string | null {
  if (!details) {
    return null;
  }

  const value = details[field];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function extractResolution(events: AuditEventRecord[]): SupportCaseResolution | null {
  const resolvedEvent = events.find((event) => event.action === "support.case.resolved.v1");
  if (!resolvedEvent || !resolvedEvent.details) {
    return null;
  }

  const causeCode = readStringField(resolvedEvent.details, "cause_code");
  const actionApplied = readStringField(resolvedEvent.details, "action_applied");
  const resultStatus = readStringField(resolvedEvent.details, "result_status");

  if (!causeCode || !actionApplied || !resultStatus) {
    return null;
  }

  if (resultStatus !== "resolved" && resultStatus !== "partial" && resultStatus !== "failed") {
    return null;
  }

  return {
    cause_code: causeCode,
    action_applied: actionApplied,
    result_status: resultStatus,
    resolved_by: resolvedEvent.actor_id ?? "system",
    resolved_at: resolvedEvent.created_at,
  };
}

export async function getSupportCaseFromDb(
  input: { tenantId: string; caseId: string; filters: NormalizedSupportCaseFilters },
  dbClient: DbLike = db,
): Promise<SupportCase | null> {
  const conditions = [eq(auditLogs.tenantId, input.tenantId), eq(auditLogs.correlationId, input.caseId)];

  if (input.filters.from) {
    conditions.push(gte(auditLogs.createdAt, input.filters.from));
  }

  if (input.filters.to) {
    conditions.push(lte(auditLogs.createdAt, input.filters.to));
  }

  if (input.filters.userId) {
    conditions.push(eq(auditLogs.actorId, input.filters.userId));
  }

  const rows = await dbClient
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      status: auditLogs.status,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      actorId: auditLogs.actorId,
      correlationId: auditLogs.correlationId,
      createdAt: auditLogs.createdAt,
      details: auditLogs.details,
    })
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(200);

  if (!rows.length) {
    return null;
  }

  const events = rows.map(mapAuditRecord);
  const batchLink =
    events.find((event) => event.resource_type === "batch")?.resource_id ??
    (readStringField(events[0]?.details ?? null, "batch_id") ?? null);
  const documentLink =
    events.find((event) => event.resource_type === "document")?.resource_id ??
    (readStringField(events[0]?.details ?? null, "document_id") ?? null);
  const userLink =
    events.find((event) => event.actor_id)?.actor_id ??
    (readStringField(events[0]?.details ?? null, "user_id") ?? null);

  if (input.filters.batchId && (!batchLink || input.filters.batchId !== batchLink)) {
    return null;
  }

  if (input.filters.documentId && (!documentLink || input.filters.documentId !== documentLink)) {
    return null;
  }

  const functionalHistory: SupportCase["functional_history"] = [];

  if (batchLink) {
    const exceptionRows = await dbClient
      .select({
        id: exceptions.id,
        currentState: exceptions.currentState,
        errorCategory: exceptions.errorCategory,
        updatedAt: exceptions.updatedAt,
      })
      .from(exceptions)
      .innerJoin(batches, eq(exceptions.batchId, batches.id))
      .where(and(eq(exceptions.tenantId, input.tenantId), eq(batches.correlationId, input.caseId)))
      .orderBy(desc(exceptions.updatedAt))
      .limit(20);

    for (const exceptionRow of exceptionRows) {
      functionalHistory.push({
        source: "exceptions",
        status: exceptionRow.currentState,
        message: `Excecao ${exceptionRow.errorCategory}`,
        occurred_at: exceptionRow.updatedAt.toISOString(),
      });
    }
  }

  for (const event of events.filter((item) => item.action.startsWith("rh.alerts") || item.action.startsWith("support.case"))) {
    functionalHistory.push({
      source: "alerts",
      status: event.status,
      message: event.action,
      occurred_at: event.created_at,
    });
  }

  return {
    case_id: input.caseId,
    tenant_id: input.tenantId,
    status: deriveSupportCaseStatus(events),
    severity: deriveSupportCaseSeverity(events),
    links: {
      batch_id: batchLink,
      document_id: documentLink,
      user_id: userLink,
    },
    technical_history: events,
    timeline: buildSupportTimeline(events),
    functional_history: functionalHistory,
    resolution: extractResolution(events),
  };
}

export async function resolveSupportCaseInDb(input: {
  tenantId: string;
  caseId: string;
  actorId: string;
  correlationId: string;
  causeCode: string;
  actionApplied: string;
  resultStatus: SupportResultStatus;
  recovery?: {
    batchId: string;
    exceptionIds?: string[];
    idempotencyKey: string;
  };
}, dbClient: DbLike = db) {
  const correlatedRows = await dbClient
    .select({ correlationId: auditLogs.correlationId, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.tenantId, input.tenantId),
        eq(auditLogs.resourceType, "support_case"),
        eq(auditLogs.resourceId, input.caseId),
        eq(auditLogs.action, "support.case.resolved.v1"),
      ),
    )
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(1);

  const previousResolutionCorrelationId = correlatedRows[0]?.correlationId;
  if (previousResolutionCorrelationId && previousResolutionCorrelationId !== input.correlationId) {
    throw new SupportCaseRepositoryError(
      "INVALID_IDEMPOTENCY_REPLAY",
      "Resolucao ja registrada com outra correlation id.",
      {
        case_id: input.caseId,
      },
    );
  }

  if (previousResolutionCorrelationId && previousResolutionCorrelationId === input.correlationId) {
    const previousResolvedAt = (correlatedRows[0] as { createdAt?: Date } | undefined)?.createdAt;
    return {
      case_id: input.caseId,
      previous_status: "resolved" as const,
      status: "resolved" as const,
      resolved_at: previousResolvedAt ? previousResolvedAt.toISOString() : new Date().toISOString(),
    };
  }

  const supportCase = await getSupportCaseFromDb({
    tenantId: input.tenantId,
    caseId: input.caseId,
    filters: {},
  }, dbClient);

  if (!supportCase) {
    throw new SupportCaseRepositoryError("NOT_FOUND", "Caso de suporte nao encontrado.");
  }

  if (!isValidSupportCaseStatusTransition(supportCase.status, "resolved")) {
    throw new SupportCaseRepositoryError(
      "INVALID_STATE_TRANSITION",
      "Transicao de estado de caso invalida.",
      {
        current_status: supportCase.status,
      },
    );
  }

  let recoveryResult: Record<string, unknown> | null = null;

  if (input.recovery) {
    if (!supportCase.links.batch_id || supportCase.links.batch_id !== input.recovery.batchId) {
      throw new SupportCaseRepositoryError(
        "BATCH_MISMATCH",
        "Batch de recuperacao nao corresponde ao caso.",
        {
          case_batch_id: supportCase.links.batch_id,
          requested_batch_id: input.recovery.batchId,
        },
      );
    }

    const result = await reprocessBatchExceptions({
      tenantId: input.tenantId,
      batchId: input.recovery.batchId,
      actorId: input.actorId,
      correlationId: input.correlationId,
      idempotencyKey: input.recovery.idempotencyKey,
      exceptionIds: input.recovery.exceptionIds,
    });

    recoveryResult = {
      batch_id: result.batch_id,
      total_requested: result.total_requested,
      total_reprocessed: result.total_reprocessed,
      total_resolved: result.total_resolved,
      total_failed: result.total_failed,
    };

    await dbClient.insert(auditLogs).values({
      tenantId: input.tenantId,
      actorId: input.actorId,
      correlationId: input.correlationId,
      action: "support.case.recovery.triggered.v1",
      resourceType: "support_case",
      resourceId: input.caseId,
      status: "success",
      details: {
        case_id: input.caseId,
        batch_id: input.recovery.batchId,
        idempotency_key: input.recovery.idempotencyKey,
        recovery_result: recoveryResult,
      },
    });
  }

  await dbClient.insert(auditLogs).values({
    tenantId: input.tenantId,
    actorId: input.actorId,
    correlationId: input.correlationId,
    action: "support.case.resolved.v1",
    resourceType: "support_case",
    resourceId: input.caseId,
    status: "success",
    details: {
      case_id: input.caseId,
      cause_code: input.causeCode,
      action_applied: input.actionApplied,
      result_status: input.resultStatus,
      recovery_result: recoveryResult,
    },
  });

  return {
    case_id: input.caseId,
    previous_status: supportCase.status,
    status: "resolved" as const,
    resolved_at: new Date().toISOString(),
  };
}
