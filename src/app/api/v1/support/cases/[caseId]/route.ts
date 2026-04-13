import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api/response";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { assertTenantAction, RBAC_ACTIONS, type RbacRole } from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { auditLogs, userTenantMappings } from "@/lib/db/schema";
import { CORRELATION_ID_HEADER, resolveCorrelationId } from "@/lib/observability/correlation-id";
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

async function resolveTenantRole(userId: string, tenantId: string): Promise<RbacRole | undefined> {
  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(and(eq(userTenantMappings.userId, userId), eq(userTenantMappings.tenantId, tenantId)))
    .limit(1);

  return mappings[0]?.role as RbacRole | undefined;
}

async function writeCaseOpenedAudit(params: {
  tenantId: string;
  actorId: string;
  correlationId: string;
  caseId: string;
}) {
  await db.insert(auditLogs).values({
    tenantId: params.tenantId,
    actorId: params.actorId,
    correlationId: params.correlationId,
    action: "support.case.opened.v1",
    resourceType: "support_case",
    resourceId: params.caseId,
    status: "success",
    details: { case_id: params.caseId },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> },
) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success) {
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
    return jsonResponse(errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId), correlationId, {
      status: 401,
    });
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return jsonResponse(
      errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId),
      correlationId,
      { status: 401 },
    );
  }

  const role = await resolveTenantRole(session.userId, session.tenantId);
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

  const allowedRoles: RbacRole[] = ["suporte", "rh_gestor", "admin_plataforma"];
  if (!allowedRoles.includes(role)) {
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

    await writeCaseOpenedAudit({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      caseId: parsedParams.data.caseId,
    });

    return jsonResponse(successResponse(supportCase, correlationId, session.tenantId), correlationId);
  } catch (error) {
    if (error instanceof SupportCaseError) {
      return jsonResponse(
        errorResponse(error.code, error.message, correlationId, error.details),
        correlationId,
        { status: error.statusCode },
      );
    }

    return jsonResponse(
      errorResponse("INTERNAL_SERVER_ERROR", "Falha ao consultar caso de suporte.", correlationId),
      correlationId,
      { status: 500 },
    );
  }
}
