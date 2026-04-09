import { pgEnum, pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const notificationChannelEnum = pgEnum("notification_channel", ["in_app"]);

export const notificationContextTypeEnum = pgEnum("notification_context_type", [
  "document",
  "contestation",
]);

export const employeeNotifications = pgTable(
  "employee_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    channel: notificationChannelEnum("channel").notNull().default("in_app"),
    eventType: text("event_type").notNull(),
    contextType: notificationContextTypeEnum("context_type").notNull(),
    contextId: text("context_id").notNull(),
    statusFrom: text("status_from").notNull(),
    statusTo: text("status_to").notNull(),
    recommendedAction: text("recommended_action").notNull(),
    message: text("message").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("employee_notifications_dedupe_unique").on(
      table.userId,
      table.contextType,
      table.contextId,
      table.eventType,
      table.statusTo,
    ),
  ],
);
