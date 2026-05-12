import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";

function toUuid(value?: string | null): string {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return value && uuidPattern.test(value) ? value : randomUUID();
}

function sanitizeAuditDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(details).filter(([key]) => !key.toLowerCase().includes("cpf")),
  );
}

export async function writeAuthAudit(params: {
  tenantId: string;
  actorId?: string;
  action:
    | "auth.session.login.v1"
    | "auth.session.logout.v1"
    | "auth.session.refresh.v1";
  status: "success" | "failure";
  correlationId?: string;
  ipAddress?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditLogs).values({
    tenantId: params.tenantId,
    actorId: params.actorId,
    correlationId: toUuid(params.correlationId),
    action: params.action,
    resourceType: "session",
    resourceId: params.actorId ?? "anonymous",
    status: params.status,
    details: sanitizeAuditDetails(params.details),
    ipAddress: params.ipAddress,
  });
}
