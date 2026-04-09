import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { employeeNotifications } from "@/lib/db/schema";
import type {
  NotificationChannel,
  NotificationContextType,
} from "@/lib/notifications/create-employee-notification";

export class EmployeeNotificationTrackingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EmployeeNotificationTrackingError";
  }
}

export async function listEmployeeNotifications(input: {
  tenantId: string;
  userId: string;
  contextType?: NotificationContextType;
  fromDate?: string;
  toDate?: string;
}) {
  const conditions = [
    eq(employeeNotifications.tenantId, input.tenantId),
    eq(employeeNotifications.userId, input.userId),
  ];

  if (input.contextType) {
    conditions.push(eq(employeeNotifications.contextType, input.contextType));
  }

  if (input.fromDate) {
    conditions.push(gte(employeeNotifications.createdAt, new Date(input.fromDate)));
  }

  if (input.toDate) {
    conditions.push(lte(employeeNotifications.createdAt, new Date(input.toDate)));
  }

  const rows = await db
    .select({
      id: employeeNotifications.id,
      tenantId: employeeNotifications.tenantId,
      userId: employeeNotifications.userId,
      channel: employeeNotifications.channel,
      eventType: employeeNotifications.eventType,
      contextType: employeeNotifications.contextType,
      contextId: employeeNotifications.contextId,
      statusFrom: employeeNotifications.statusFrom,
      statusTo: employeeNotifications.statusTo,
      recommendedAction: employeeNotifications.recommendedAction,
      message: employeeNotifications.message,
      readAt: employeeNotifications.readAt,
      createdAt: employeeNotifications.createdAt,
    })
    .from(employeeNotifications)
    .where(and(...conditions))
    .orderBy(desc(employeeNotifications.createdAt));

  return rows.map((row) => ({
    notification_id: row.id,
    tenant_id: row.tenantId,
    user_id: row.userId,
    channel: row.channel as NotificationChannel,
    event_type: row.eventType,
    context_type: row.contextType,
    context_id: row.contextId,
    status_from: row.statusFrom,
    status_to: row.statusTo,
    recommended_action: row.recommendedAction,
    message: row.message,
    read_at: row.readAt ? row.readAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
  }));
}

export async function markEmployeeNotificationAsRead(input: {
  tenantId: string;
  userId: string;
  notificationId: string;
}) {
  const now = new Date();

  const rows = await db
    .update(employeeNotifications)
    .set({
      readAt: now,
    })
    .where(
      and(
        eq(employeeNotifications.id, input.notificationId),
        eq(employeeNotifications.tenantId, input.tenantId),
        eq(employeeNotifications.userId, input.userId),
      ),
    )
    .returning({
      id: employeeNotifications.id,
      readAt: employeeNotifications.readAt,
    });

  const updated = rows[0];
  if (!updated) {
    throw new EmployeeNotificationTrackingError(
      "NOTIFICATION_NOT_FOUND",
      "Notificacao nao encontrada no escopo do colaborador.",
      404,
    );
  }

  return {
    notification_id: updated.id,
    read_at: updated.readAt ? updated.readAt.toISOString() : now.toISOString(),
  };
}
