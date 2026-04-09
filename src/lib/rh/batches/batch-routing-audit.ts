import { randomUUID } from "node:crypto";
import { auditLogs } from "@/lib/db/schema";
import { db } from "@/lib/db/client";

type DbLike = typeof db;

function normalizeUuidOrRandom(value: string): string {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidPattern.test(value) ? value : randomUUID();
}

export async function writeBatchRoutingAudit(
  params: {
    tenantId: string;
    actorId: string;
    correlationId: string;
    status: "success" | "failure";
    batchId: string;
    details: Record<string, unknown>;
  },
  dbClient: DbLike = db,
): Promise<void> {
  await dbClient.insert(auditLogs).values({
    tenantId: params.tenantId,
    actorId: params.actorId,
    correlationId: normalizeUuidOrRandom(params.correlationId),
    action: "rh.batch.routing.processed.v1",
    resourceType: "batch",
    resourceId: params.batchId,
    status: params.status,
    details: params.details,
  });
}