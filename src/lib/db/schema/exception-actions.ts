import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { exceptionCorrectionResultEnum, exceptions } from "./exceptions";
import { tenants } from "./tenants";
import { users } from "./users";

export const exceptionActions = pgTable("exception_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  exceptionId: uuid("exception_id")
    .notNull()
    .references(() => exceptions.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "restrict" }),
  actionDescription: text("action_description").notNull(),
  expectedResult: exceptionCorrectionResultEnum("expected_result"),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
});