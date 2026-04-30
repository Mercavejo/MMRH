import { NextRequest, NextResponse } from "next/server";
import { errorResponse, successResponse } from "@/lib/api/response";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { assertTenantAction, RBAC_ACTIONS, type RbacRole } from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings, auditLogs } from "@/lib/db/schema";

import { CORRELATION_ID_HEADER, resolveCorrelationId } from "@/lib/observability/correlation-id";
import { getActiveTenantPlan } from "@/modules/plans/application/get-active-tenant-plan";
import { PLAN_CAPABILITIES } from "@/modules/plans/domain/capabilities";
import { and, eq } from "drizzle-orm";

function jsonResponse<T>(
  body: ReturnType<typeof errorResponse<T>> | ReturnType<typeof successResponse<T>>,
  correlationId: string,
  init?: ResponseInit,
) {
  const response = NextResponse.json(body, init);
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}

async function resolveTenantRole(userId: string, tenantId: string): Promise<RbacRole | undefined> {
  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(and(eq(userTenantMappings.userId, userId), eq(userTenantMappings.tenantId, tenantId)))
    .limit(1);

  return mappings[0]?.role as RbacRole | undefined;
}

export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return jsonResponse(
      errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId),
      correlationId,
      { status: 401 },
    );
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return jsonResponse(
      errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId),
      correlationId,
      { status: 401 },
    );
  }

  const [role, activePlan] = await Promise.all([
    resolveTenantRole(session.userId, session.tenantId),
    getActiveTenantPlan(session.tenantId),
  ]);

  if (!role) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Usuario sem permissao no tenant.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  try {
    assertTenantAction({
      actorRole: role,
      actorTenantId: session.tenantId,
      targetTenantId: session.tenantId,
      action: RBAC_ACTIONS.tenantRead,
    });
  } catch (error) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Acesso negado pelo RBAC.", correlationId, {
        cause: (error as Error).message,
      }),
      correlationId,
      { status: 403 },
    );
  }

  const planCode = activePlan?.plan_code ?? null;
  const capabilities: string[] = planCode
    ? Array.from(PLAN_CAPABILITIES[planCode as keyof typeof PLAN_CAPABILITIES] ?? [])
    : [];

  // Log success audit
  await db.insert(auditLogs).values({
    tenantId: session.tenantId,
    actorId: session.userId,
    correlationId,
    action: "plans.capabilities.read.v1",
    resourceType: "capability_catalog",
    resourceId: session.tenantId,
    status: "success",
    details: {
      plan_code: planCode,
    },
  }).catch(() => {});

  return jsonResponse(
    successResponse(
      { capabilities },
      correlationId,
      session.tenantId,
      { plan_code: planCode }
    ),
    correlationId,
  );

}
