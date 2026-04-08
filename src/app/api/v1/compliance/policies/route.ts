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
  type RbacRole,
  writeRbacAudit,
} from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { minimizeDataForRole } from "@/lib/compliance/minimization";
import { db } from "@/lib/db/client";
import { complianceEvidence, compliancePolicies, userTenantMappings } from "@/lib/db/schema";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";

const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 3650;

const updatePolicySchema = z.object({
  tenant_id: z.string().uuid(),
  retention_days_documents: z.number().int().min(MIN_RETENTION_DAYS).max(MAX_RETENTION_DAYS),
  retention_days_audit_logs: z.number().int().min(MIN_RETENTION_DAYS).max(MAX_RETENTION_DAYS),
  legal_basis: z.string().min(3),
  minimization_profile: z.enum(["strict", "standard"]),
  enabled: z.boolean(),
});

async function getSessionAndRole(
  request: NextRequest,
  correlationId: string,
): Promise<
  | { userId: string; tenantId: string; role: RbacRole }
  | NextResponse
> {
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

  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(
      and(
        eq(userTenantMappings.userId, session.userId),
        eq(userTenantMappings.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  const mapping = mappings[0];
  if (!mapping) {
    return NextResponse.json(
      errorResponse("FORBIDDEN", "Usuario sem role no tenant.", correlationId),
      { status: 403 },
    );
  }

  return {
    userId: session.userId,
    tenantId: session.tenantId,
    role: mapping.role,
  };
}

export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  const tenantId = request.nextUrl.searchParams.get("tenant_id");
  if (!tenantId) {
    return NextResponse.json(
      errorResponse("VALIDATION_ERROR", "tenant_id e obrigatorio.", correlationId),
      { status: 400 },
    );
  }

  if (!z.string().uuid().safeParse(tenantId).success) {
    return NextResponse.json(
      errorResponse("VALIDATION_ERROR", "tenant_id deve ser UUID valido.", correlationId),
      { status: 400 },
    );
  }

  const auth = await getSessionAndRole(request, correlationId);
  if (auth instanceof NextResponse) {
    return auth;
  }

  if (auth.tenantId !== tenantId) {
    await writeRbacAudit({
      tenantId: auth.tenantId,
      actorId: auth.userId,
      action: "auth.rbac.access.denied.v1",
      status: "failure",
      correlationId,
      details: buildAccessDeniedAuditDetails({
        tenantId: auth.tenantId,
        actorId: auth.userId,
        action: RBAC_ACTIONS.tenantRead,
        reason: "tenant-mismatch",
        targetTenantId: tenantId,
      }),
    });

    return NextResponse.json(
      errorResponse("FORBIDDEN", "Tenant fora do escopo da sessao.", correlationId),
      { status: 403 },
    );
  }

  try {
    assertTenantAction({
      actorRole: auth.role,
      actorTenantId: auth.tenantId,
      targetTenantId: tenantId,
      action: RBAC_ACTIONS.tenantRead,
    });
  } catch (error) {
    const appError = error as AppError;

    await writeRbacAudit({
      tenantId: auth.tenantId,
      actorId: auth.userId,
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

  const policies = await db
    .select()
    .from(compliancePolicies)
    .where(eq(compliancePolicies.tenantId, tenantId))
    .limit(1);

  const policy = policies[0];
  if (!policy) {
    return NextResponse.json(
      successResponse({
        tenant_id: tenantId,
        retention_days_documents: 90,
        retention_days_audit_logs: 365,
        legal_basis: "legitimate_interest",
        minimization_profile: "standard",
        enabled: true,
      }, correlationId, tenantId),
    );
  }

  const minimized = minimizeDataForRole(
    {
      tenant_id: policy.tenantId,
      retention_days_documents: policy.retentionDaysDocuments,
      retention_days_audit_logs: policy.retentionDaysAuditLogs,
      legal_basis: policy.legalBasis,
      minimization_profile: policy.minimizationProfile,
      enabled: policy.enabled,
      updated_at: policy.updatedAt.toISOString(),
    },
    {
      minimizationProfile: policy.minimizationProfile,
      role: auth.role,
    },
  );

  await db.insert(complianceEvidence).values({
    tenantId,
    actorId: auth.userId,
    correlationId,
    action: "compliance.policy.read.minimized.v1",
    legalBasis: policy.legalBasis,
    dataCategory: "policy",
    retentionAppliedDays: policy.retentionDaysDocuments,
    status: "success",
    details: {
      minimization_profile: policy.minimizationProfile,
      role: auth.role,
      fields_returned: Object.keys(minimized),
    },
  });

  return NextResponse.json(successResponse(minimized, correlationId, tenantId));
}

export async function PUT(request: NextRequest) {
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  const auth = await getSessionAndRole(request, correlationId);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await request.json().catch(() => null);
  const parsed = updatePolicySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      errorResponse(
        "VALIDATION_ERROR",
        "Payload de politica de compliance invalido.",
        correlationId,
        { issues: parsed.error.issues },
      ),
      { status: 400 },
    );
  }

  const tenantId = parsed.data.tenant_id;
  if (auth.tenantId !== tenantId) {
    await writeRbacAudit({
      tenantId: auth.tenantId,
      actorId: auth.userId,
      action: "auth.rbac.access.denied.v1",
      status: "failure",
      correlationId,
      details: buildAccessDeniedAuditDetails({
        tenantId: auth.tenantId,
        actorId: auth.userId,
        action: RBAC_ACTIONS.accessManage,
        reason: "tenant-mismatch",
        targetTenantId: tenantId,
      }),
    });

    return NextResponse.json(
      errorResponse("FORBIDDEN", "Tenant fora do escopo da sessao.", correlationId),
      { status: 403 },
    );
  }

  try {
    assertTenantAction({
      actorRole: auth.role,
      actorTenantId: auth.tenantId,
      targetTenantId: tenantId,
      action: RBAC_ACTIONS.accessManage,
    });
  } catch (error) {
    const appError = error as AppError;

    await writeRbacAudit({
      tenantId: auth.tenantId,
      actorId: auth.userId,
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

  await db
    .insert(compliancePolicies)
    .values({
      tenantId,
      retentionDaysDocuments: parsed.data.retention_days_documents,
      retentionDaysAuditLogs: parsed.data.retention_days_audit_logs,
      legalBasis: parsed.data.legal_basis,
      minimizationProfile: parsed.data.minimization_profile,
      enabled: parsed.data.enabled,
      updatedBy: auth.userId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: compliancePolicies.tenantId,
      set: {
        retentionDaysDocuments: parsed.data.retention_days_documents,
        retentionDaysAuditLogs: parsed.data.retention_days_audit_logs,
        legalBasis: parsed.data.legal_basis,
        minimizationProfile: parsed.data.minimization_profile,
        enabled: parsed.data.enabled,
        updatedBy: auth.userId,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json(
    successResponse(
      {
        tenant_id: tenantId,
        retention_days_documents: parsed.data.retention_days_documents,
        retention_days_audit_logs: parsed.data.retention_days_audit_logs,
        legal_basis: parsed.data.legal_basis,
        minimization_profile: parsed.data.minimization_profile,
        enabled: parsed.data.enabled,
      },
      correlationId,
      tenantId,
    ),
  );
}
