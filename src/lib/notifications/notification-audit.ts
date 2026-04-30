import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";

function toUuid(value?: string | null): string {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return value && uuidPattern.test(value) ? value : randomUUID();
}

export async function writeEmployeeNotificationAudit(params: {
  tenantId: string;
  actorId?: string;
  notificationId: string;
  correlationId?: string;
  details?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    tenantId: params.tenantId,
    actorId: params.actorId,
    correlationId: toUuid(params.correlationId),
    action: "employee.notification.created.v1",
    resourceType: "employee_notification",
    resourceId: params.notificationId,
    status: "success",
    details: params.details,
  });
}
