import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api/response";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { assertTenantAction, RBAC_ACTIONS, type RbacRole } from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema";
import { CORRELATION_ID_HEADER, resolveCorrelationId } from "@/lib/observability/correlation-id";
import { writePlaytestEvent } from "@/lib/observability/playtest-audit";
import { getSupportCase, SupportCaseError } from "@/modules/support/application/get-support-case";

const paramsSchema = z.object({ caseId: z.string().uuid() });

const querySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    batch_id: z.string().uuid().optional(),
    document_id: z.string().uuid().optional(),
    user_id: z.string().uuid().optional(),
  })
  .superRefine((value, context) => {
    if (value.from && value.to && new Date(value.from).getTime() > new Date(value.to).getTime()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["from"],
        message: "Periodo invalido.",
      });
    }
  });

function withCorrelationHeader(response: NextResponse, correlationId: string) {
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}

function jsonResponse<T>(
  body: ReturnType<typeof errorResponse<T>> | ReturnType<typeof successResponse<T>>,
  correlationId: string,
  init?: ResponseInit,
) {
  return withCorrelationHeader(NextResponse.json(body, init), correlationId);
}

async function recordPlaytestEvent(params: Parameters<typeof writePlaytestEvent>[0]) {
  try {
    await writePlaytestEvent(params);
  } catch (error) {
    console.error("[playtest.support.case] Falha ao registrar evento", error);
  }
}

function playtestDetails(role: RbacRole | undefined, details: Record<string, unknown>) {
  return role ? { actor_role: role, ...details } : details;
}

async function resolveTenantRole(userId: string, tenantId: string): Promise<RbacRole | undefined> {
  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(and(eq(userTenantMappings.userId, userId), eq(userTenantMappings.tenantId, tenantId)))
    .limit(1);

  return mappings[0]?.role as RbacRole | undefined;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> },
) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
    await recordPlaytestEvent({
      tenantId: "anonymous",
      correlationId,
      action: "playtest.rh.support.case.friction",
      resourceType: "support_case",
      status: "failure",
      details: { cause: "validation_error", issues: parsedParams.error.issues },
    });
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "caseId invalido.", correlationId, {
        issues: parsedParams.error.issues,
      }),
      correlationId,
      { status: 400 },
    );
  }

  const parsedQuery = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsedQuery.success) {
    await recordPlaytestEvent({
      tenantId: "anonymous",
      correlationId,
      action: "playtest.rh.support.case.friction",
      resourceType: "support_case",
      status: "failure",
      details: { cause: "validation_error", issues: parsedQuery.error.issues },
    });
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Parametros de consulta invalidos.", correlationId, {
        issues: parsedQuery.error.issues,
      }),
      correlationId,
      { status: 400 },
    );
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    await recordPlaytestEvent({
      tenantId: "anonymous",
      correlationId,
      action: "playtest.rh.support.case.friction",
      resourceType: "support_case",
      status: "failure",
      details: { cause: "unauthorized", reason: "Sessao ausente" },
    });
    return jsonResponse(errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId), correlationId, {
      status: 401,
    });
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    await writePlaytestEvent({
      tenantId: "anonymous",
      correlationId,
      action: "playtest.rh.support.case.friction",
      resourceType: "support_case",
      status: "failure",
      details: { cause: "unauthorized", reason: "Sessao invalida ou expirada" },
    });
    return jsonResponse(
      errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId),
      correlationId,
      { status: 401 },
    );
  }

  const role = await resolveTenantRole(session.userId, session.tenantId);
  if (!role) {
    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: "playtest.rh.support.case.friction",
      resourceType: "support_case",
      status: "failure",
      details: { cause: "forbidden", reason: "Usuario sem permissao no tenant" },
    });
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
    if (role === "rh_gestor") {
      await recordPlaytestEvent({
        tenantId: session.tenantId,
        actorId: session.userId,
        correlationId,
        action: "playtest.rh.support.case.friction",
        resourceType: "support_case",
        resourceId: parsedParams.data.caseId,
        status: "failure",
        details: playtestDetails(role, { cause: "forbidden", reason: (error as Error).message }),
      });
    }
    return jsonResponse(
      errorResponse("FORBIDDEN", "Acesso negado pelo RBAC.", correlationId, {
        cause: (error as Error).message,
      }),
      correlationId,
      { status: 403 },
    );
  }

  const allowedRoles: RbacRole[] = ["suporte", "rh_gestor", "admin_plataforma"];
  if (!allowedRoles.includes(role)) {
    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: role === "rh_gestor" ? "playtest.rh.support.case.view" : "playtest.rh.support.case.friction",
      resourceType: "support_case",
      resourceId: parsedParams.data.caseId,
      status: role === "rh_gestor" ? "success" : "failure",
      details: playtestDetails(role, { cause: "forbidden", reason: "Perfil sem permissao para consultar suporte" }),
    });
    return jsonResponse(
      errorResponse("FORBIDDEN", "Perfil sem permissao para consultar caso de suporte.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  try {
    const supportCase = await getSupportCase({
      tenantId: session.tenantId,
      caseId: parsedParams.data.caseId,
      from: parsedQuery.data.from,
      to: parsedQuery.data.to,
      batchId: parsedQuery.data.batch_id,
      documentId: parsedQuery.data.document_id,
      userId: parsedQuery.data.user_id,
    });

    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: "playtest.rh.support.case.view",
      resourceType: "support_case",
      resourceId: parsedParams.data.caseId,
      status: "success",
      details: playtestDetails(role, {
        case_id: parsedParams.data.caseId,
        batch_id: supportCase.links.batch_id,
        document_id: supportCase.links.document_id,
        user_id: supportCase.links.user_id,
      }),
    });

    return jsonResponse(successResponse(supportCase, correlationId, session.tenantId), correlationId);
  } catch (error) {
    if (error instanceof SupportCaseError) {
      await recordPlaytestEvent({
        tenantId: session.tenantId,
        actorId: session.userId,
        correlationId,
        action: "playtest.rh.support.case.friction",
        resourceType: "support_case",
        resourceId: parsedParams.data.caseId,
        status: "failure",
        details: playtestDetails(role, {
          cause: "domain_error",
          code: error.code,
          case_id: parsedParams.data.caseId,
        }),
      });
      return jsonResponse(
        errorResponse(error.code, error.message, correlationId, error.details),
        correlationId,
        { status: error.statusCode },
      );
    }

    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: "playtest.rh.support.case.friction",
      resourceType: "support_case",
      resourceId: parsedParams.data.caseId,
      status: "failure",
      details: playtestDetails(role, {
        cause: "internal_error",
        case_id: parsedParams.data.caseId,
        error: (error as Error).message,
      }),
    });

    return jsonResponse(
      errorResponse("INTERNAL_SERVER_ERROR", "Falha ao consultar caso de suporte.", correlationId),
      correlationId,
      { status: 500 },
    );
  }
}
