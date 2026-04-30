import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";

export async function writeEmployeeIdentityAudit(input: {
  tenantId: string;
  actorId?: string;
  correlationId: string;
  action: string;
  resourceId: string;
  status: "success" | "failure";
  details?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    tenantId: input.tenantId,
    actorId: input.actorId,
    correlationId: input.correlationId,
    action: input.action,
    resourceType: "employee_identity",
    resourceId: input.resourceId,
    status: input.status,
    details: input.details,
  });
}
