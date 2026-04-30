import { NextRequest, NextResponse } from "next/server";
import { errorResponse, successResponse } from "@/lib/api/response";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { validateSession } from "@/lib/auth/session";
import {
  assertTenantAction,
  buildAccessDeniedAuditDetails,
  RBAC_ACTIONS,
  writeRbacAudit,
} from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { userTenantMappings, auditLogs } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { AppError } from "@/lib/api/errors";

import { getCapabilityTelemetry } from "@/modules/plans/application/get-capability-telemetry";
import { CORRELATION_ID_HEADER, resolveCorrelationId } from "@/lib/observability/correlation-id";

function jsonResponse<T>(
  body: ReturnType<typeof errorResponse<T>> | ReturnType<typeof successResponse<T>>,
  correlationId: string,
  init?: ResponseInit,
) {
  const response = NextResponse.json(body, init);
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}

async function getSessionAndRole(request: NextRequest, correlationId: string) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value || request.cookies.get("sid")?.value;
  if (!token) {
    return jsonResponse(errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId), correlationId, { status: 401 });
  }

  const session = await validateSession(token);
  if (!session) {
    return jsonResponse(
      errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId),
      correlationId,
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

  if (!mappings[0]) {
    return jsonResponse(errorResponse("FORBIDDEN", "Usuario sem role no tenant.", correlationId), correlationId, { status: 403 });
  }

  return { userId: session.userId, tenantId: session.tenantId, role: mappings[0].role };
}

export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  const auth = await getSessionAndRole(request, correlationId);
  if (auth instanceof NextResponse) {
    return auth;
  }

  // Hardening: Explicit platform admin check for cross-tenant/global telemetry
  if (auth.role !== "admin_plataforma") {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Apenas administradores de plataforma podem acessar telemetria global.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get("period");
  const tenantIdParam = searchParams.get("tenant_id");

  if (!period) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Parametro 'period' e obrigatorio.", correlationId),
      correlationId,
      { status: 400 },
    );
  }

  const targetTenantId = tenantIdParam ?? auth.tenantId;

  if (tenantIdParam && tenantIdParam !== auth.tenantId) {
    await writeRbacAudit({
      tenantId: auth.tenantId,
      actorId: auth.userId,
      action: "auth.rbac.access.denied.v1",
      status: "failure",
      correlationId,
      details: buildAccessDeniedAuditDetails({
        tenantId: auth.tenantId,
        actorId: auth.userId,
        action: RBAC_ACTIONS.auditRead,
        reason: "tenant-mismatch",
        targetTenantId: tenantIdParam,
      }),
    });

    return jsonResponse(
      errorResponse("FORBIDDEN", "Tenant fora do escopo da sessao.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  try {
    assertTenantAction({
      actorRole: auth.role,
      actorTenantId: auth.tenantId,
      targetTenantId,
      action: RBAC_ACTIONS.auditRead,
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

    return jsonResponse(
      errorResponse(appError.code, appError.message, correlationId, appError.details),
      correlationId,
      { status: appError.statusCode || 403 },
    );
  }



  const telemetry = await getCapabilityTelemetry({
    tenantId: targetTenantId,
    period,
  });

  // Log success audit
  await db.insert(auditLogs).values({
    tenantId: auth.tenantId,
    actorId: auth.userId,
    correlationId,
    action: "plans.telemetry.read.v1",
    resourceType: "capability_telemetry",
    resourceId: targetTenantId,
    status: "success",
    details: {
      period,
      target_tenant_id: targetTenantId,
    },
  }).catch(() => {});

  return jsonResponse(successResponse(telemetry, correlationId, targetTenantId), correlationId);

}
