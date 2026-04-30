import { pgEnum, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { users } from "./users";

export const userRoleEnum = pgEnum("user_role", [
  "colaborador",
  "rh_operator",
  "rh_gestor",
  "suporte",
  "admin_plataforma",
]);

export const userTenantMappings = pgTable(
  "user_tenant_mappings",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.tenantId],
      name: "pk_user_tenant_mappings",
    }),
  ],
);
