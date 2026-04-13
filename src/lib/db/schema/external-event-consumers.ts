import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const externalEventConsumers = pgTable(
  "external_event_consumers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    consumerKey: text("consumer_key").notNull(),
    eventName: text("event_name").notNull(),
    eventVersion: text("event_version").notNull().default("v1"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantConsumerEventUidx: uniqueIndex("external_event_consumers_tenant_consumer_event_uidx").on(
      table.tenantId,
      table.consumerKey,
      table.eventName,
      table.eventVersion,
    ),
  }),
);