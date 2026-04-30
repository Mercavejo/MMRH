import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";
import type { AuditEventRecord, NormalizedAuditFilters } from "../domain/audit-event-filters";

type DbLike = typeof db;

export class AuditEventsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AuditEventsError";
  }
}

type AuditListResult = {
  events: AuditEventRecord[];
  timelineEvents: AuditEventRecord[];
  total: number;
};

function mapAuditEvent(row: {
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

export async function listAuditEventsFromDb(
  input: { tenantId: string; filters: NormalizedAuditFilters },
  dbClient: DbLike = db,
): Promise<AuditListResult> {
  const baseConditions = [eq(auditLogs.tenantId, input.tenantId)];

  if (input.filters.from) {
    baseConditions.push(gte(auditLogs.createdAt, input.filters.from));
  }

  if (input.filters.to) {
    baseConditions.push(lte(auditLogs.createdAt, input.filters.to));
  }

  if (input.filters.userId) {
    baseConditions.push(eq(auditLogs.actorId, input.filters.userId));
  }

  if (input.filters.batchId) {
    baseConditions.push(eq(auditLogs.resourceType, "batch"));
    baseConditions.push(eq(auditLogs.resourceId, input.filters.batchId));
  }

  if (input.filters.documentId) {
    baseConditions.push(eq(auditLogs.resourceType, "document"));
    baseConditions.push(eq(auditLogs.resourceId, input.filters.documentId));
  }

  const countRows = await dbClient
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(and(...baseConditions));

  const total = countRows[0]?.count ?? 0;
  const offset = (input.filters.page - 1) * input.filters.pageSize;

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
    .where(and(...baseConditions))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(input.filters.pageSize)
    .offset(offset);

  const timelineConditions = [eq(auditLogs.tenantId, input.tenantId)];

  if (input.filters.from) {
    timelineConditions.push(gte(auditLogs.createdAt, input.filters.from));
  }

  if (input.filters.to) {
    timelineConditions.push(lte(auditLogs.createdAt, input.filters.to));
  }

  if (input.filters.userId) {
    timelineConditions.push(eq(auditLogs.actorId, input.filters.userId));
  }

  if (input.filters.batchId) {
    timelineConditions.push(eq(auditLogs.resourceType, "batch"));
    timelineConditions.push(eq(auditLogs.resourceId, input.filters.batchId));
  }

  if (input.filters.documentId) {
    timelineConditions.push(eq(auditLogs.resourceType, "document"));
    timelineConditions.push(eq(auditLogs.resourceId, input.filters.documentId));
  }

  const timelineRows =
    input.filters.batchId || input.filters.documentId
      ? await dbClient
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
          .where(and(...timelineConditions))
          .orderBy(auditLogs.createdAt, auditLogs.id)
      : [];

  return {
    events: rows.map(mapAuditEvent),
    timelineEvents: timelineRows.map(mapAuditEvent),
    total,
  };
}
