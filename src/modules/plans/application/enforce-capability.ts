import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema/audit-logs";
import type { Capability } from "../domain/capabilities";
import { CapabilityForbiddenError } from "../domain/capabilities";
import { checkTenantCapability } from "./check-tenant-capability";

import { logCapabilityUsage } from "./log-capability-usage";

const UPGRADE_HINTS: Partial<Record<Capability, string>> = {
  BATCH_INGESTION:
    "Esta funcionalidade esta disponivel nos planos Professional e Enterprise. Entre em contato com o comercial para fazer upgrade.",
  EXTERNAL_INTEGRATIONS:
    "Esta funcionalidade esta disponivel apenas no plano Enterprise. Entre em contato com o comercial para fazer upgrade.",
  PDF_MULTIPAGE_PROCESSING:
    "Esta funcionalidade esta disponivel nos planos Professional e Enterprise. Entre em contato com o comercial para fazer upgrade.",
  ADVANCED_AUDIT:
    "Esta funcionalidade esta disponivel apenas no plano Enterprise. Entre em contato com o comercial para fazer upgrade.",
  COMMERCIAL_GOVERNANCE:
    "Esta funcionalidade esta disponivel apenas no plano Enterprise. Entre em contato com o comercial para fazer upgrade.",
};

async function writeBlockedCapabilityAudit(params: {
  tenantId: string;
  actorId: string | null;
  correlationId: string;
  capability: Capability;
  planCode: string;
  upgradeHint: string;
}): Promise<void> {
  await db.insert(auditLogs).values({
    tenantId: params.tenantId,
    actorId: params.actorId,
    correlationId: params.correlationId,
    action: "plans.capability.blocked.v1",
    resourceType: "capability",
    resourceId: params.capability,
    status: "failure",
    details: {
      capability: params.capability,
      plan_code: params.planCode,
      upgrade_hint: params.upgradeHint,
    },
  }).catch((error) => {
    console.error(`[Plans] Failed to persist blocked-capability audit for ${params.tenantId}/${params.capability}:`, error);
  });
}

export async function enforceCapability(
  tenantId: string,
  capability: Capability,
  actorId: string | null = null,
  correlationId: string,
): Promise<void> {
  const result = await checkTenantCapability(tenantId, capability);

  if (!result.allowed) {
    const defaultHint = "Esta funcionalidade nao esta disponivel no seu plano atual. Entre em contato com o suporte ou comercial para fazer upgrade.";
    const hint = UPGRADE_HINTS[capability] ?? defaultHint;

    await writeBlockedCapabilityAudit({
      tenantId,
      actorId,
      correlationId,
      capability: result.capability,
      planCode: result.planCode,
      upgradeHint: hint,
    });

    throw new CapabilityForbiddenError({
      capability: result.capability,
      planCode: result.planCode,
      upgradeHint: hint,
    });
  }

  // Success path: Log audit and increment telemetry (safe/best-effort)
  await Promise.allSettled([
    db.insert(auditLogs).values({
      tenantId,
      actorId,
      correlationId,
      action: "plans.capability.used.v1",
      resourceType: "capability",
      resourceId: capability,
      status: "success",
      details: {
        capability: result.capability,
        plan_code: result.planCode,
      },
    }),
    logCapabilityUsage(tenantId, capability, 1, result.planCode).catch(async (err) => {
      console.error(`[Telemetry] Failed to log usage for ${tenantId}/${capability}:`, err);
      // Optional: Log system failure for monitoring
      await db.insert(auditLogs).values({
        tenantId,
        actorId: null,
        correlationId,
        action: "system.telemetry.log_failure.v1",
        resourceType: "capability",
        resourceId: capability,
        status: "failure",
        details: {
          error: String(err),
          plan_code: result.planCode,
        },
      }).catch(() => {}); // Never fail the main request due to observability failures
    }),

  ]);
}
