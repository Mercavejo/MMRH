import { loadEnvConfig } from "@next/env";
import { inArray } from "drizzle-orm";

loadEnvConfig(process.cwd());

async function main() {
  const { db } = await import("../../src/lib/db/client");
  const {
    batches,
    documentContestations,
    employeeDocuments,
    employeeIdentities,
    employeeNotifications,
    exceptionActions,
    exceptions,
    sessions,
    userTenantMappings,
    users,
  } = await import("../../src/lib/db/schema");

  const existingUsers = await db.select({ id: users.id }).from(users);
  const userIds = existingUsers.map((user) => user.id);

  if (userIds.length === 0) {
    console.log("Nenhum usuario encontrado para limpeza.");
    return;
  }

  await db.delete(sessions).where(inArray(sessions.userId, userIds));
  await db.delete(employeeNotifications).where(inArray(employeeNotifications.userId, userIds));
  await db.delete(documentContestations).where(inArray(documentContestations.userId, userIds));
  const ownedBatches = await db.select({ id: batches.id }).from(batches).where(inArray(batches.uploadedBy, userIds));
  const ownedBatchIds = ownedBatches.map((batch) => batch.id);

  if (ownedBatchIds.length > 0) {
    const ownedExceptions = await db
      .select({ id: exceptions.id })
      .from(exceptions)
      .where(inArray(exceptions.batchId, ownedBatchIds));
    const ownedExceptionIds = ownedExceptions.map((exception) => exception.id);

    if (ownedExceptionIds.length > 0) {
      await db.delete(exceptionActions).where(inArray(exceptionActions.exceptionId, ownedExceptionIds));
      await db.delete(exceptions).where(inArray(exceptions.id, ownedExceptionIds));
    }

    await db.delete(employeeDocuments).where(inArray(employeeDocuments.batchId, ownedBatchIds));
    await db.delete(batches).where(inArray(batches.id, ownedBatchIds));
  }

  await db.delete(employeeDocuments).where(inArray(employeeDocuments.userId, userIds));
  await db.delete(userTenantMappings).where(inArray(userTenantMappings.userId, userIds));
  await db.delete(employeeIdentities).where(inArray(employeeIdentities.userId, userIds));

  const deleted = await db.delete(users).returning({ id: users.id });

  console.log(`Removidos ${deleted.length} usuarios de teste.`);
}

main().catch((error) => {
  console.error("Falha ao remover usuarios de teste:", error);
  process.exit(1);
});
