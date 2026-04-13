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
import { CommercialPlanError, createCommercialPlan } from "@/modules/plans/application/create-commercial-plan";
import { listCommercialPlans } from "@/modules/plans/application/list-commercial-plans";

const createPlanSchema = z.object({
  plan_code: z.string().trim().min(2).max(64),
  display_name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1024).optional(),
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

async function requirePlatformAdmin(request: NextRequest, correlationId: string) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return {
      response: jsonResponse(errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId), correlationId, { status: 401 }),
    };
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return {
      response: jsonResponse(
        errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId),
        correlationId,
        { status: 401 },
      ),
    };
  }

  const role = await resolveTenantRole(session.userId, session.tenantId);
  if (!role) {
    return {
      response: jsonResponse(
        errorResponse("FORBIDDEN", "Usuario sem permissao no tenant.", correlationId),
        correlationId,
        { status: 403 },
      ),
    };
  }

  try {
    assertTenantAction({
      actorRole: role,
      actorTenantId: session.tenantId,
      targetTenantId: session.tenantId,
      action: RBAC_ACTIONS.platformManage,
    });
  } catch (error) {
    return {
      response: jsonResponse(
        errorResponse("FORBIDDEN", "Acesso negado pelo RBAC.", correlationId, {
          cause: (error as Error).message,
        }),
        correlationId,
        { status: 403 },
      ),
    };
  }

  if (role !== "admin_plataforma") {
    return {
      response: jsonResponse(
        errorResponse("FORBIDDEN", "Perfil sem permissao para administrar planos.", correlationId),
        correlationId,
        { status: 403 },
      ),
    };
  }

  return {
    session,
    role,
  };
}

export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const auth = await requirePlatformAdmin(request, correlationId);

  if ("response" in auth) {
    return auth.response;
  }

  const plans = await listCommercialPlans();
  return jsonResponse(successResponse({ plans }, correlationId, auth.session.tenantId), correlationId);
}

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const auth = await requirePlatformAdmin(request, correlationId);

  if ("response" in auth) {
    return auth.response;
  }

  const bodyParsed = createPlanSchema.safeParse(await request.json().catch(() => null));
  if (!bodyParsed.success) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Payload de plano comercial invalido.", correlationId, {
        issues: bodyParsed.error.issues,
      }),
      correlationId,
      { status: 400 },
    );
  }

  try {
    const result = await createCommercialPlan({
      planCode: bodyParsed.data.plan_code,
      displayName: bodyParsed.data.display_name,
      description: bodyParsed.data.description,
      actorId: auth.session.userId,
      tenantId: auth.session.tenantId,
      correlationId,
    });

    return jsonResponse(
      successResponse(result, correlationId, auth.session.tenantId),
      correlationId,
      { status: result.mode === "create" ? 201 : 200 },
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
      errorResponse("INTERNAL_SERVER_ERROR", "Falha ao criar plano comercial.", correlationId),
      correlationId,
      { status: 500 },
    );
  }
}
