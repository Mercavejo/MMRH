import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { errorResponse, successResponse } from "@/lib/api/response";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import {
  assertTenantAction,
  buildAccessDeniedAuditDetails,
  RBAC_ACTIONS,
  writeRbacAudit,
} from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { executeTenantRetention } from "@/lib/compliance/retention";
import { db } from "@/lib/db/client";
import { compliancePolicies, userTenantMappings } from "@/lib/db/schema";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";

const retentionSchema = z.object({
  tenant_id: z.string().uuid(),
  dry_run: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json(
      errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId),
      { status: 401 },
    );
  }

  const session = await validateSession(token);
  if (!session) {
    return NextResponse.json(
      errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId),
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = retentionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      errorResponse(
        "VALIDATION_ERROR",
        "Payload de retencao invalido.",
        correlationId,
        { issues: parsed.error.issues },
      ),
      { status: 400 },
    );
  }

  const roleRows = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(
      and(
        eq(userTenantMappings.userId, session.userId),
        eq(userTenantMappings.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  const role = roleRows[0]?.role;
  if (!role) {
    return NextResponse.json(
      errorResponse("FORBIDDEN", "Usuario sem role no tenant.", correlationId),
      { status: 403 },
    );
  }

  if (parsed.data.tenant_id !== session.tenantId) {
    await writeRbacAudit({
      tenantId: session.tenantId,
      actorId: session.userId,
      action: "auth.rbac.access.denied.v1",
      status: "failure",
      correlationId,
      details: buildAccessDeniedAuditDetails({
        tenantId: session.tenantId,
        actorId: session.userId,
        action: RBAC_ACTIONS.accessManage,
        reason: "tenant-mismatch",
        targetTenantId: parsed.data.tenant_id,
      }),
    });

    return NextResponse.json(
      errorResponse("FORBIDDEN", "Tenant fora do escopo da sessao.", correlationId),
      { status: 403 },
    );
  }

  try {
    assertTenantAction({
      actorRole: role,
      actorTenantId: session.tenantId,
      targetTenantId: parsed.data.tenant_id,
      action: RBAC_ACTIONS.accessManage,
    });
  } catch (error) {
    const appError = error as AppError;

    await writeRbacAudit({
      tenantId: session.tenantId,
      actorId: session.userId,
      action: "auth.rbac.access.denied.v1",
      status: "failure",
      correlationId,
      details: appError.details,
    });

    return NextResponse.json(
      errorResponse(appError.code, appError.message, correlationId, appError.details),
      { status: appError.statusCode },
    );
  }

  const policyRows = await db
    .select({
      retentionDaysDocuments: compliancePolicies.retentionDaysDocuments,
      retentionDaysAuditLogs: compliancePolicies.retentionDaysAuditLogs,
      legalBasis: compliancePolicies.legalBasis,
      enabled: compliancePolicies.enabled,
    })
    .from(compliancePolicies)
    .where(eq(compliancePolicies.tenantId, parsed.data.tenant_id))
    .limit(1);

  const policy = policyRows[0];
  if (!policy) {
    return NextResponse.json(
      errorResponse(
        "COMPLIANCE_POLICY_REQUIRED",
        "Politica de compliance nao configurada para o tenant.",
        correlationId,
      ),
      { status: 409 },
    );
  }

  if (!policy.enabled) {
    return NextResponse.json(
      errorResponse(
        "COMPLIANCE_POLICY_DISABLED",
        "Politica de compliance desabilitada para o tenant.",
        correlationId,
      ),
      { status: 409 },
    );
  }

  const result = await executeTenantRetention({
    tenantId: parsed.data.tenant_id,
    actorId: session.userId,
    correlationId,
    legalBasis: policy.legalBasis,
    retentionDaysDocuments: policy.retentionDaysDocuments,
    retentionDaysAuditLogs: policy.retentionDaysAuditLogs,
    dryRun: parsed.data.dry_run,
  });

  return NextResponse.json(
    successResponse(
      {
        executed: result.executed,
        dry_run: result.dryRun,
        documents_affected: result.documentsAffected,
        audit_logs_affected: result.auditLogsAffected,
      },
      correlationId,
      parsed.data.tenant_id,
    ),
  );
}
