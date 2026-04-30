import { db as defaultDb } from "@/lib/db/client";
import { auditLogs, tenants } from "@/lib/db/schema";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

const ANONYMOUS_PLAYTEST_TENANT_ID = "00000000-0000-4000-8000-000000000001";

type PlaytestAuditDb = {
  insert: (table: typeof auditLogs | typeof tenants) => {
    values: (
      value: typeof auditLogs.$inferInsert | typeof tenants.$inferInsert,
    ) => PromiseLike<unknown> & {
      onConflictDoNothing?: (config?: unknown) => PromiseLike<unknown>;
    };
  };
};

function resolveAuditTenantId(tenantId: string): {
  auditTenantId: string;
  isReservedTenant: boolean;
} {
  if (UUID_PATTERN.test(tenantId)) {
    return { auditTenantId: tenantId, isReservedTenant: false };
  }

  return {
    auditTenantId: ANONYMOUS_PLAYTEST_TENANT_ID,
    isReservedTenant: true,
  };
}

async function ensureAnonymousPlaytestTenant(dbClient: PlaytestAuditDb) {
  const insert = dbClient.insert(tenants).values({
    id: ANONYMOUS_PLAYTEST_TENANT_ID,
    name: "Playtest Anonymous",
    slug: "playtest-anonymous",
    isActive: true,
  });

  if (insert.onConflictDoNothing) {
    await insert.onConflictDoNothing({ target: tenants.id });
    return;
  }

  await insert;
}

export async function writePlaytestEvent(
  params: {
    tenantId: string;
    correlationId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    actorId?: string;
    status: "success" | "failure";
    details?: Record<string, unknown>;
  },
  dbInstance?: PlaytestAuditDb,
): Promise<void> {
  const dbClient = (dbInstance ?? defaultDb) as PlaytestAuditDb;
  const { auditTenantId, isReservedTenant } = resolveAuditTenantId(params.tenantId);

  try {
    const safeDetails = params.details 
      ? JSON.parse(JSON.stringify(params.details, (_, value) => 
          typeof value === "bigint" ? value.toString() : value
        ))
      : undefined;
    const details = isReservedTenant
      ? { ...(safeDetails ?? {}), originalTenantId: params.tenantId }
      : safeDetails;

    if (isReservedTenant) {
      await ensureAnonymousPlaytestTenant(dbClient);
    }

    await dbClient.insert(auditLogs).values({
      tenantId: auditTenantId,
      actorId: params.actorId,
      correlationId: params.correlationId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId ?? "anonymous",
      status: params.status,
      details,
    });
  } catch (error) {
    // Falhas de logger de playtest não devem quebrar o fluxo da aplicação
    console.error("[Playtest Audit] Falha silenciosa ao registrar evento", error);
  }
}
