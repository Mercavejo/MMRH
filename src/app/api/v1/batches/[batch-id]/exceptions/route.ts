import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api/response";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { assertTenantAction, RBAC_ACTIONS, type RbacRole } from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema";
import { listBatchExceptions } from "@/modules/exceptions/application/list-exceptions";
import { ExceptionWorkflowError } from "@/modules/exceptions/infrastructure/exception-repository";
import { exceptionPriorities, exceptionStates } from "@/modules/exceptions/domain/exception";
import { CORRELATION_ID_HEADER, resolveCorrelationId } from "@/lib/observability/correlation-id";

const paramsSchema = z.object({
  batchId: z.string().uuid(),
});

const querySchema = z.object({
  priority: z.enum(exceptionPriorities).optional(),
  state: z.enum(exceptionStates).optional(),
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(100).default(20),
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ batchId: string }> },
) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const paramsParsed = paramsSchema.safeParse(await context.params);

  if (!paramsParsed.success) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Identificador de lote invalido.", correlationId, {
        issues: paramsParsed.error.issues,
      }),
      correlationId,
      { status: 400 },
    );
  }

  const queryParsed = querySchema.safeParse({
    priority: request.nextUrl.searchParams.get("priority") ?? undefined,
    state: request.nextUrl.searchParams.get("state") ?? undefined,
    skip: request.nextUrl.searchParams.get("skip") ?? undefined,
    take: request.nextUrl.searchParams.get("take") ?? undefined,
  });

  if (!queryParsed.success) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Filtros de excecao invalidos.", correlationId, {
        issues: queryParsed.error.issues,
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

  const role = await resolveTenantRole(session.userId, session.tenantId);
  if (!role) {
    return jsonResponse(errorResponse("FORBIDDEN", "Usuario sem permissao no tenant.", correlationId), correlationId, { status: 403 });
  }

  try {
    assertTenantAction({
      actorRole: role,
      actorTenantId: session.tenantId,
      targetTenantId: session.tenantId,
      action: RBAC_ACTIONS.tenantRead,
    });
  } catch (error) {
    return jsonResponse(errorResponse("FORBIDDEN", "Acesso negado pelo RBAC.", correlationId, { cause: (error as Error).message }), correlationId, { status: 403 });
  }

  if (role !== "rh_operator") {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Somente RH operador pode consultar excecoes.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  try {
    const result = await listBatchExceptions({
      tenantId: session.tenantId,
      batchId: paramsParsed.data.batchId,
      priority: queryParsed.data.priority,
      state: queryParsed.data.state,
      skip: queryParsed.data.skip,
      take: queryParsed.data.take,
    });

    return jsonResponse(
      successResponse(
        {
          batch_id: paramsParsed.data.batchId,
          exceptions: result.exceptions,
          metadata: result.metadata,
          filters: {
            priority: queryParsed.data.priority ?? null,
            state: queryParsed.data.state ?? null,
            skip: queryParsed.data.skip,
            take: queryParsed.data.take,
          },
        },
        correlationId,
        session.tenantId,
      ),
      correlationId,
    );
  } catch (error) {
    if (error instanceof ExceptionWorkflowError) {
      return jsonResponse(errorResponse(error.code, error.message, correlationId, error.details), correlationId, {
        status: error.statusCode,
      });
    }

    return jsonResponse(errorResponse("INTERNAL_SERVER_ERROR", "Falha ao consultar fila de excecoes.", correlationId), correlationId, { status: 500 });
  }
}