import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  documentContestations,
  employeeDocuments,
  employeeNotifications,
} from "@/lib/db/schema";
import { mapNotificationMessage } from "@/lib/notifications/message-mapping";
import { writeEmployeeNotificationAudit } from "@/lib/notifications/notification-audit";

export type NotificationChannel = "in_app";
export type NotificationContextType = "document" | "contestation";

export class EmployeeNotificationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EmployeeNotificationError";
  }
}

type ResolveContextResult = {
  tenantId: string;
  userId: string;
};

type MapMessageResult = {
  message: string;
  recommendedAction: string;
};

type InsertNotificationInput = {
  tenantId: string;
  userId: string;
  channel: NotificationChannel;
  eventType: string;
  contextType: NotificationContextType;
  contextId: string;
  statusFrom: string;
  statusTo: string;
  recommendedAction: string;
  message: string;
};

type InsertNotificationResult = {
  id: string;
  createdAt: Date;
  readAt?: Date | null;
};

export type CreateEmployeeNotificationDeps = {
  resolveContext: (params: {
    contextType: NotificationContextType;
    contextId: string;
    tenantId?: string;
    userId?: string;
  }) => Promise<ResolveContextResult | null>;
  mapMessage: (params: {
    contextType: NotificationContextType;
    eventType: string;
    statusFrom: string;
    statusTo: string;
  }) => MapMessageResult;
  insertNotification: (
    input: InsertNotificationInput,
  ) => Promise<InsertNotificationResult>;
  writeAudit?: (params: {
    tenantId: string;
    actorId?: string;
    notificationId: string;
    correlationId?: string;
    details?: Record<string, unknown>;
  }) => Promise<void>;
};

const defaultDeps: CreateEmployeeNotificationDeps = {
  resolveContext: async ({ contextType, contextId, tenantId, userId }) => {
    if (!tenantId || !userId) {
      return null;
    }

    if (contextType === "document") {
      const rows = await db
        .select({
          tenantId: employeeDocuments.tenantId,
          userId: employeeDocuments.userId,
        })
        .from(employeeDocuments)
        .where(
          and(
            eq(employeeDocuments.id, contextId),
            eq(employeeDocuments.tenantId, tenantId),
            eq(employeeDocuments.userId, userId),
          ),
        )
        .limit(1);

      const row = rows[0];
      return row
        ? {
            tenantId: row.tenantId,
            userId: row.userId,
          }
        : null;
    }

    const rows = await db
      .select({
        tenantId: documentContestations.tenantId,
        userId: documentContestations.userId,
      })
      .from(documentContestations)
      .where(
        and(
          eq(documentContestations.id, contextId),
          eq(documentContestations.tenantId, tenantId),
          eq(documentContestations.userId, userId),
        ),
      )
      .limit(1);

    const row = rows[0];
    return row
      ? {
          tenantId: row.tenantId,
          userId: row.userId,
        }
      : null;
  },
  mapMessage: mapNotificationMessage,
  insertNotification: async (input) => {
    const now = new Date();

    const rows = await db
      .insert(employeeNotifications)
      .values({
        tenantId: input.tenantId,
        userId: input.userId,
        channel: input.channel,
        eventType: input.eventType,
        contextType: input.contextType,
        contextId: input.contextId,
        statusFrom: input.statusFrom,
        statusTo: input.statusTo,
        recommendedAction: input.recommendedAction,
        message: input.message,
        readAt: null,
        createdAt: now,
      })
      .onConflictDoNothing({
        target: [
          employeeNotifications.userId,
          employeeNotifications.contextType,
          employeeNotifications.contextId,
          employeeNotifications.eventType,
          employeeNotifications.statusTo,
        ],
      })
      .returning({
        id: employeeNotifications.id,
        createdAt: employeeNotifications.createdAt,
        readAt: employeeNotifications.readAt,
      });

    const created = rows[0];
    if (created) {
      return {
        id: created.id,
        createdAt: created.createdAt,
        readAt: created.readAt,
      };
    }

    const existingRows = await db
      .select({
        id: employeeNotifications.id,
        createdAt: employeeNotifications.createdAt,
        readAt: employeeNotifications.readAt,
      })
      .from(employeeNotifications)
      .where(
        and(
          eq(employeeNotifications.userId, input.userId),
          eq(employeeNotifications.contextType, input.contextType),
          eq(employeeNotifications.contextId, input.contextId),
          eq(employeeNotifications.eventType, input.eventType),
          eq(employeeNotifications.statusTo, input.statusTo),
        ),
      )
      .limit(1);

    const existing = existingRows[0];

    if (!existing) {
      throw new EmployeeNotificationError(
        "NOTIFICATION_INSERT_FAILED",
        "Falha ao persistir notificacao para colaborador.",
        500,
      );
    }

    return {
      id: existing.id,
      createdAt: existing.createdAt,
      readAt: existing.readAt,
    };
  },
  writeAudit: writeEmployeeNotificationAudit,
};

export async function createEmployeeNotification(
  input: {
    contextType: NotificationContextType;
    contextId: string;
    eventType: string;
    statusFrom: string;
    statusTo: string;
    channel?: NotificationChannel;
    tenantId?: string;
    userId?: string;
  },
  deps: CreateEmployeeNotificationDeps,
): Promise<{
  notification_id: string;
  tenant_id: string;
  user_id: string;
  channel: NotificationChannel;
  event_type: string;
  context_type: NotificationContextType;
  context_id: string;
  status_from: string;
  status_to: string;
  recommended_action: string;
  message: string;
  read_at: string | null;
  created_at: string;
}> {
  const context = await deps.resolveContext({
    contextType: input.contextType,
    contextId: input.contextId,
    tenantId: input.tenantId,
    userId: input.userId,
  });

  if (!context) {
    throw new EmployeeNotificationError(
      "NOTIFICATION_CONTEXT_NOT_FOUND",
      "Contexto da notificacao nao encontrado no escopo informado.",
      404,
    );
  }

  const content = deps.mapMessage({
    contextType: input.contextType,
    eventType: input.eventType,
    statusFrom: input.statusFrom,
    statusTo: input.statusTo,
  });

  const channel = input.channel ?? "in_app";

  const created = await deps.insertNotification({
    tenantId: context.tenantId,
    userId: context.userId,
    channel,
    eventType: input.eventType,
    contextType: input.contextType,
    contextId: input.contextId,
    statusFrom: input.statusFrom,
    statusTo: input.statusTo,
    recommendedAction: content.recommendedAction,
    message: content.message,
  });

  return {
    notification_id: created.id,
    tenant_id: context.tenantId,
    user_id: context.userId,
    channel,
    event_type: input.eventType,
    context_type: input.contextType,
    context_id: input.contextId,
    status_from: input.statusFrom,
    status_to: input.statusTo,
    recommended_action: content.recommendedAction,
    message: content.message,
    read_at: created.readAt ? created.readAt.toISOString() : null,
    created_at: created.createdAt.toISOString(),
  };
}

export async function createEmployeeNotificationFromStatusEvent(
  input: {
    contextType: NotificationContextType;
    contextId: string;
    eventType: string;
    statusFrom: string;
    statusTo: string;
    actorId?: string;
    correlationId?: string;
    tenantId?: string;
    userId?: string;
  },
  deps: CreateEmployeeNotificationDeps = defaultDeps,
) {
  const created = await createEmployeeNotification(
    {
      contextType: input.contextType,
      contextId: input.contextId,
      eventType: input.eventType,
      statusFrom: input.statusFrom,
      statusTo: input.statusTo,
      channel: "in_app",
      tenantId: input.tenantId,
      userId: input.userId,
    },
    deps,
  );

  if (deps.writeAudit) {
    await deps.writeAudit({
      tenantId: created.tenant_id,
      actorId: input.actorId,
      notificationId: created.notification_id,
      correlationId: input.correlationId,
      details: {
        event_type: created.event_type,
        context_type: created.context_type,
        context_id: created.context_id,
        status_from: created.status_from,
        status_to: created.status_to,
      },
    });
  }

  return created;
}
