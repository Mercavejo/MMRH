import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";

type DbLike = typeof db;

function normalizeUuidOrRandom(value: string): string {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidPattern.test(value) ? value : randomUUID();
}

export async function writeBatchPublicationAudit(
  params: {
    tenantId: string;
    actorId: string;
    correlationId: string;
    batchId: string;
    status: "success" | "failure";
    stage: "started" | "finished";
    details: Record<string, unknown>;
  },
  dbClient: DbLike = db,
): Promise<void> {
  const idempotencyKey = typeof params.details.idempotency_key === "string" ? params.details.idempotency_key : null;

  if (idempotencyKey) {
    const existing = await dbClient
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, params.tenantId),
          eq(auditLogs.action, `rh.batch.publication.${params.stage}.v1`),
          eq(auditLogs.resourceType, "batch"),
          eq(auditLogs.resourceId, params.batchId),
          eq(auditLogs.status, params.status),
          sql`${auditLogs.details} ->> 'idempotency_key' = ${idempotencyKey}`,
        ),
      )
      .limit(1);

    if (existing[0]) {
      return;
    }
  }

  await dbClient.insert(auditLogs).values({
    tenantId: params.tenantId,
    actorId: params.actorId,
    correlationId: normalizeUuidOrRandom(params.correlationId),
    action: `rh.batch.publication.${params.stage}.v1`,
    resourceType: "batch",
    resourceId: params.batchId,
    status: params.status,
    details: params.details,
  });
}