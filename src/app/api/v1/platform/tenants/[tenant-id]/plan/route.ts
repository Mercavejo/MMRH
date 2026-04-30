import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api/response";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { assertTenantAction, RBAC_ACTIONS, type RbacRole } from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema/user-tenant-mappings";
import { CORRELATION_ID_HEADER, resolveCorrelationId } from "@/lib/observability/correlation-id";
import { assignTenantPlan } from "@/modules/plans/application/assign-tenant-plan";
import { CommercialPlanError } from "@/modules/plans/application/create-commercial-plan";
import { getActiveTenantPlan } from "@/modules/plans/application/get-active-tenant-plan";

const paramsSchema = z.object({
  tenantId: z.string().uuid(),
});

const assignPlanSchema = z.object({
  plan_code: z.string().trim().min(2).max(64),
  effective_from: z.string().datetime().optional(),
  change_reason: z.string().trim().max(1024).optional(),
});

async function resolveTenantRole(userId: string, tenantId: string): Promise<RbacRole | undefined> {
  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(and(eq(userTenantMappings.userId, userId), eq(userTenantMappings.tenantId, tenantId)))
    .limit(1);

  return mappings[0]?.role as RbacRole | undefined;
}

function jsonResponse<T>(
  body: ReturnType<typeof errorResponse<T>> | ReturnType<typeof successResponse<T>>,
  correlationId: string,
  init?: ResponseInit,
) {
  const response = NextResponse.json(body, init);
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}

export async function GET(request: NextRequest, context: { params: Promise<{ "tenant-id": string }> }) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return jsonResponse(errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId), correlationId, { status: 401 });
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return jsonResponse(
      errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId),
      correlationId,
      { status: 401 },
    );
  }

  const paramsParsed = paramsSchema.safeParse({ tenantId: (await context.params)["tenant-id"] });
  if (!paramsParsed.success) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Identificador de tenant invalido.", correlationId, {
        issues: paramsParsed.error.issues,
      }),
      correlationId,
      { status: 400 },
    );
  }

  if (paramsParsed.data.tenantId !== session.tenantId) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Acesso cross-tenant nao permitido.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  const role = await resolveTenantRole(session.userId, session.tenantId);
  if (!role) {
    return jsonResponse(errorResponse("FORBIDDEN", "Usuario sem permissao no tenant.", correlationId), correlationId, { status: 403 });
  }

  try {
    assertTenantAction({
      actorRole: role,
      actorTenantId: session.tenantId,
      targetTenantId: paramsParsed.data.tenantId,
      action: RBAC_ACTIONS.platformManage,
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

  if (role !== "admin_plataforma") {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Perfil sem permissao para administrar plano do tenant.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  const activePlan = await getActiveTenantPlan(paramsParsed.data.tenantId);

  return jsonResponse(
    successResponse(
      {
        tenant_id: paramsParsed.data.tenantId,
        active_plan: activePlan,
      },
      correlationId,
      paramsParsed.data.tenantId,
    ),
    correlationId,
  );
}

export async function PUT(request: NextRequest, context: { params: Promise<{ "tenant-id": string }> }) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return jsonResponse(errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId), correlationId, { status: 401 });
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return jsonResponse(
      errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId),
      correlationId,
      { status: 401 },
    );
  }

  const paramsParsed = paramsSchema.safeParse({ tenantId: (await context.params)["tenant-id"] });
  if (!paramsParsed.success) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Identificador de tenant invalido.", correlationId, {
        issues: paramsParsed.error.issues,
      }),
      correlationId,
      { status: 400 },
    );
  }

  if (paramsParsed.data.tenantId !== session.tenantId) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Acesso cross-tenant nao permitido.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  const role = await resolveTenantRole(session.userId, session.tenantId);
  if (!role) {
    return jsonResponse(errorResponse("FORBIDDEN", "Usuario sem permissao no tenant.", correlationId), correlationId, { status: 403 });
  }

  try {
    assertTenantAction({
      actorRole: role,
      actorTenantId: session.tenantId,
      targetTenantId: paramsParsed.data.tenantId,
      action: RBAC_ACTIONS.platformManage,
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

  if (role !== "admin_plataforma") {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Perfil sem permissao para administrar plano do tenant.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  const bodyParsed = assignPlanSchema.safeParse(await request.json().catch(() => null));
  if (!bodyParsed.success) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Payload de atribuicao de plano invalido.", correlationId, {
        issues: bodyParsed.error.issues,
      }),
      correlationId,
      { status: 400 },
    );
  }

  try {
    const assignment = await assignTenantPlan({
      tenantId: paramsParsed.data.tenantId,
      planCode: bodyParsed.data.plan_code,
      actorId: session.userId,
      correlationId,
      effectiveFrom: bodyParsed.data.effective_from,
      changeReason: bodyParsed.data.change_reason,
    });

    return jsonResponse(
      successResponse(
        {
          tenant_id: paramsParsed.data.tenantId,
          assignment,
        },
        correlationId,
        paramsParsed.data.tenantId,
      ),
      correlationId,
      { status: assignment.mode === "create" ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof CommercialPlanError) {
      return jsonResponse(
        errorResponse(error.code, error.message, correlationId, error.details),
        correlationId,
        { status: error.statusCode },
      );
    }

    return jsonResponse(
      errorResponse("INTERNAL_SERVER_ERROR", "Falha ao atribuir plano para tenant.", correlationId),
      correlationId,
      { status: 500 },
    );
  }
}
