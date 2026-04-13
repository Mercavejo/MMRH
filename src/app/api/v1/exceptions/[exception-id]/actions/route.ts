import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api/response";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { assertTenantAction, RBAC_ACTIONS, type RbacRole } from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { exceptions, userTenantMappings } from "@/lib/db/schema";
import { recordCorrectiveExceptionAction } from "@/modules/exceptions/application/record-exception-action";
import { exceptionCorrectionResults } from "@/modules/exceptions/domain/exception";
import { CORRELATION_ID_HEADER, resolveCorrelationId } from "@/lib/observability/correlation-id";

const paramsSchema = z.object({
  exceptionId: z.string().uuid(),
});

const bodySchema = z.object({
  action_description: z.string().trim().min(10).max(4000),
  expected_result: z.enum(exceptionCorrectionResults),
});

async function resolveTenantRole(userId: string, tenantId: string): Promise<RbacRole | undefined> {
  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(and(eq(userTenantMappings.userId, userId), eq(userTenantMappings.tenantId, tenantId)))
    .limit(1);

  return mappings[0]?.role as RbacRole | undefined;
}

function jsonResponse(body: ReturnType<typeof errorResponse> | ReturnType<typeof successResponse>, correlationId: string, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ exceptionId: string }> },
) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const paramsParsed = paramsSchema.safeParse(await context.params);

  if (!paramsParsed.success) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Identificador de excecao invalido.", correlationId, {
        issues: paramsParsed.error.issues,
      }),
      correlationId,
      { status: 400 },
    );
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return jsonResponse(errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId), correlationId, { status: 401 });
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return jsonResponse(errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId), correlationId, { status: 401 });
  }

  const bodyParsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!bodyParsed.success) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Payload de acao corretiva invalido.", correlationId, {
        issues: bodyParsed.error.issues,
      }),
      correlationId,
      { status: 400 },
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
      targetTenantId: session.tenantId,
      action: RBAC_ACTIONS.tenantWrite,
    });
  } catch (error) {
    return jsonResponse(errorResponse("FORBIDDEN", "Acesso negado pelo RBAC.", correlationId, { cause: (error as Error).message }), correlationId, { status: 403 });
  }

  if (role !== "rh_operator") {
    return jsonResponse(errorResponse("FORBIDDEN", "Somente RH operador pode registrar acoes corretivas.", correlationId), correlationId, { status: 403 });
  }

  const ownership = await db
    .select({ tenantId: exceptions.tenantId })
    .from(exceptions)
    .where(eq(exceptions.id, paramsParsed.data.exceptionId))
    .limit(1);

  const existing = ownership[0];
  if (!existing) {
    return jsonResponse(errorResponse("NOT_FOUND", "Excecao nao encontrada.", correlationId), correlationId, { status: 404 });
  }

  if (existing.tenantId !== session.tenantId) {
    return jsonResponse(errorResponse("FORBIDDEN", "Acesso negado para excecao de outro tenant.", correlationId), correlationId, { status: 403 });
  }

  try {
    const result = await recordCorrectiveExceptionAction({
      tenantId: session.tenantId,
      exceptionId: paramsParsed.data.exceptionId,
      actorId: session.userId,
      actionDescription: bodyParsed.data.action_description,
      expectedResult: bodyParsed.data.expected_result,
    });

    return jsonResponse(successResponse(result, correlationId, session.tenantId), correlationId, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) {
      const workflowError = error as Error & { code?: string; statusCode?: number; details?: Record<string, unknown> };
      return jsonResponse(
        errorResponse(workflowError.code ?? "INTERNAL_SERVER_ERROR", workflowError.message, correlationId, workflowError.details),
        correlationId,
        { status: workflowError.statusCode ?? 500 },
      );
    }

    return jsonResponse(errorResponse("INTERNAL_SERVER_ERROR", "Falha ao registrar acao corretiva.", correlationId), correlationId, { status: 500 });
  }
}