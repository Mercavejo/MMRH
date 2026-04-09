import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";

type ContestationAuditAction =
  | "employee.document.contestation.open.v1"
  | "rh.document.contestation.tracking.updated.v1";

function toUuid(value?: string | null): string {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return value && uuidPattern.test(value) ? value : randomUUID();
}

export async function writeDocumentContestationAudit(params: {
  tenantId: string;
  actorId: string;
  contestationId: string;
  action: ContestationAuditAction;
  status: "success" | "failure";
  correlationId?: string;
  details?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    tenantId: params.tenantId,
    actorId: params.actorId,
    correlationId: toUuid(params.correlationId),
    action: params.action,
    resourceType: "document_contestation",
    resourceId: params.contestationId,
    status: params.status,
    details: params.details,
  });
}
