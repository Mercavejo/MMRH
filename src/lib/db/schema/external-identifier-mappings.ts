import { boolean, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { users } from "./users";

export const externalIdentifierMappingChangeTypeEnum = pgEnum("external_identifier_mapping_change_type", [
  "create",
  "update",
  "disable",
]);

export const externalIdentifierMappings = pgTable(
  "external_identifier_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    sourceSystem: text("source_system").notNull(),
    externalIdentifier: text("external_identifier").notNull(),
    employeeId: uuid("employee_id").references(() => users.id, { onDelete: "set null" }),
    mappingVersion: integer("mapping_version").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    changeType: externalIdentifierMappingChangeTypeEnum("change_type").notNull(),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    correlationId: uuid("correlation_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantSourceExternalVersionUidx: uniqueIndex("ext_identifier_map_tenant_source_external_ver_uidx").on(
      table.tenantId,
      table.sourceSystem,
      table.externalIdentifier,
      table.mappingVersion,
    ),
    tenantSourceExternalActiveUidx: uniqueIndex("ext_identifier_map_tenant_source_external_active_uidx")
      .on(table.tenantId, table.sourceSystem, table.externalIdentifier)
      .where(sql`${table.isActive} = true`),
  }),
);
