import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";

function toUuid(value?: string | null): string {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return value && uuidPattern.test(value) ? value : randomUUID();
}

export async function writeDocumentDownloadAudit(params: {
  tenantId: string;
  actorId: string;
  documentId: string;
  status: "success" | "failure";
  correlationId?: string;
  ipAddress?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditLogs).values({
    tenantId: params.tenantId,
    actorId: params.actorId,
    correlationId: toUuid(params.correlationId),
    action: "employee.document.download.v1",
    resourceType: "employee_document",
    resourceId: params.documentId,
    status: params.status,
    details: params.details,
    ipAddress: params.ipAddress,
  });
}
