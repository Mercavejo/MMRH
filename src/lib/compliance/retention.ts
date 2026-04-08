import { and, eq, lte, sql } from "drizzle-orm";
import { auditLogs, complianceEvidence } from "@/lib/db/schema";

function cutoffDate(days: number): Date {
  const now = Date.now();
  return new Date(now - days * 24 * 60 * 60 * 1000);
}

type ExecuteTenantRetentionParams = {
  tenantId: string;
  actorId: string;
  correlationId: string;
  legalBasis: string;
  retentionDaysDocuments: number;
  retentionDaysAuditLogs: number;
  dryRun: boolean;
};

export type TenantRetentionResult = {
  executed: boolean;
  dryRun: boolean;
  documentsAffected: number;
  auditLogsAffected: number;
};

const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 3650;

function assertRetentionDaysInRange(field: string, value: number): void {
  if (!Number.isInteger(value) || value < MIN_RETENTION_DAYS || value > MAX_RETENTION_DAYS) {
    throw new Error(`${field} out of allowed range (${MIN_RETENTION_DAYS}-${MAX_RETENTION_DAYS}).`);
  }
}

function assertLegalBasis(legalBasis: string): void {
  if (!legalBasis || legalBasis.trim().length < 3) {
    throw new Error("legalBasis must be at least 3 characters.");
  }
}

export async function executeTenantRetention(
  params: ExecuteTenantRetentionParams,
): Promise<TenantRetentionResult> {
  const { db } = await import("@/lib/db/client");

  assertRetentionDaysInRange("retentionDaysDocuments", params.retentionDaysDocuments);
  assertRetentionDaysInRange("retentionDaysAuditLogs", params.retentionDaysAuditLogs);
  assertLegalBasis(params.legalBasis);

  const logsCutoff = cutoffDate(params.retentionDaysAuditLogs);

  const txResult = await db.transaction(async (tx) => {
    const documentsAffected = 0;

    const auditCountRows = await tx
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, params.tenantId),
          lte(auditLogs.createdAt, logsCutoff),
        ),
      );

    const auditLogsAffected = auditCountRows[0]?.count ?? 0;

    if (!params.dryRun) {
      await tx
        .delete(auditLogs)
        .where(
          and(
            eq(auditLogs.tenantId, params.tenantId),
            lte(auditLogs.createdAt, logsCutoff),
          ),
        );
    }

    await tx.insert(complianceEvidence).values([
      {
        tenantId: params.tenantId,
        actorId: params.actorId,
        correlationId: params.correlationId,
        action: "compliance.retention.documents.v1",
        legalBasis: params.legalBasis,
        dataCategory: "documents",
        retentionAppliedDays: params.retentionDaysDocuments,
        status: "success",
        details: {
          dry_run: params.dryRun,
          affected_count: documentsAffected,
          executed: false,
          reason: "documents-source-not-configured",
        },
      },
      {
        tenantId: params.tenantId,
        actorId: params.actorId,
        correlationId: params.correlationId,
        action: "compliance.retention.audit-logs.v1",
        legalBasis: params.legalBasis,
        dataCategory: "audit_logs",
        retentionAppliedDays: params.retentionDaysAuditLogs,
        status: "success",
        details: {
          dry_run: params.dryRun,
          affected_count: auditLogsAffected,
        },
      },
    ]);

    await tx.insert(auditLogs).values({
      tenantId: params.tenantId,
      actorId: params.actorId,
      correlationId: params.correlationId,
      action: "compliance.retention.executed.v1",
      resourceType: "compliance_retention",
      resourceId: params.tenantId,
      status: "success",
      details: {
        dry_run: params.dryRun,
        documents_affected: documentsAffected,
        audit_logs_affected: auditLogsAffected,
        legal_basis: params.legalBasis,
      },
    });

    return {
      documentsAffected,
      auditLogsAffected,
    };
  });

  return {
    executed: true,
    dryRun: params.dryRun,
    documentsAffected: txResult.documentsAffected,
    auditLogsAffected: txResult.auditLogsAffected,
  };
}
