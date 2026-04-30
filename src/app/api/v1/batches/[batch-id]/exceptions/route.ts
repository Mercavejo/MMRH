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
import { writePlaytestEvent } from "@/lib/observability/playtest-audit";

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

async function recordPlaytestEvent(params: Parameters<typeof writePlaytestEvent>[0]) {
  try {
    await writePlaytestEvent(params);
  } catch (error) {
    console.error("[playtest.rh.exceptions] Falha ao registrar evento", error);
  }
}

function playtestDetails(role: RbacRole | undefined, details: Record<string, unknown>) {
  return role ? { actor_role: role, ...details } : details;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ "batch-id"?: string; batchId?: string }> },
) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const params = await context.params;
  const paramsParsed = paramsSchema.safeParse({ batchId: params.batchId ?? params["batch-id"] });

  if (!paramsParsed.success) {
    await recordPlaytestEvent({
      tenantId: request.cookies.get(SESSION_COOKIE_NAME)?.value ? "unknown" : "anonymous",
      correlationId,
      action: "playtest.rh.exceptions.queue.friction",
      resourceType: "exceptions",
      status: "failure",
      details: { cause: "validation_error", issues: paramsParsed.error.issues },
    });
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
    await recordPlaytestEvent({
      tenantId: request.cookies.get(SESSION_COOKIE_NAME)?.value ? "unknown" : "anonymous",
      correlationId,
      action: "playtest.rh.exceptions.queue.friction",
      resourceType: "exceptions",
      status: "failure",
      details: { cause: "validation_error", issues: queryParsed.error.issues },
    });
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
    await recordPlaytestEvent({
      tenantId: "anonymous",
      correlationId,
      action: "playtest.rh.exceptions.queue.friction",
      resourceType: "exceptions",
      status: "failure",
      details: { cause: "unauthorized", reason: "Sessao ausente" },
    });
    return jsonResponse(errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId), correlationId, { status: 401 });
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    await recordPlaytestEvent({
      tenantId: "anonymous",
      correlationId,
      action: "playtest.rh.exceptions.queue.friction",
      resourceType: "exceptions",
      status: "failure",
      details: { cause: "unauthorized", reason: "Sessao invalida ou expirada" },
    });
    return jsonResponse(errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId), correlationId, { status: 401 });
  }

  const role = await resolveTenantRole(session.userId, session.tenantId);
  if (!role) {
    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: "playtest.rh.exceptions.queue.friction",
      resourceType: "exceptions",
      status: "failure",
      details: { cause: "forbidden", reason: "Usuario sem permissao no tenant" },
    });
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
    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: "playtest.rh.exceptions.queue.friction",
      resourceType: "exceptions",
      status: "failure",
      details: playtestDetails(role, { cause: "forbidden", reason: "Acesso negado pelo RBAC" }),
    });
    return jsonResponse(errorResponse("FORBIDDEN", "Acesso negado pelo RBAC.", correlationId, { cause: (error as Error).message }), correlationId, { status: 403 });
  }

  if (role !== "admin_plataforma") {
    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: role === "rh_gestor" ? "playtest.rh.boundary.gestor.blocked" : "playtest.rh.exceptions.queue.friction",
      resourceType: "exceptions",
      resourceId: "/api/v1/batches/[batch-id]/exceptions",
      status: role === "rh_gestor" ? "success" : "failure",
      details: playtestDetails(role, {
        cause: "forbidden",
        reason: "Somente admin Mercavejo pode consultar excecoes.",
        resource_path: "/api/v1/batches/[batch-id]/exceptions",
        batch_id: paramsParsed.data.batchId,
      }),
    });
    return jsonResponse(
      errorResponse("FORBIDDEN", "Somente admin Mercavejo pode consultar excecoes.", correlationId),
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

    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: "playtest.rh.exceptions.queue.view",
      resourceType: "exceptions",
      resourceId: paramsParsed.data.batchId,
      status: "success",
      details: playtestDetails(role, {
        batch_id: paramsParsed.data.batchId,
        total_count: result.metadata.total_count,
      }),
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
      await recordPlaytestEvent({
        tenantId: session.tenantId,
        actorId: session.userId,
        correlationId,
        action: "playtest.rh.exceptions.queue.friction",
        resourceType: "exceptions",
        resourceId: paramsParsed.data.batchId,
        status: "failure",
        details: playtestDetails(role, { cause: "domain_error", code: error.code, batch_id: paramsParsed.data.batchId }),
      });
      return jsonResponse(errorResponse(error.code, error.message, correlationId, error.details), correlationId, {
        status: error.statusCode,
      });
    }

    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: "playtest.rh.exceptions.queue.friction",
      resourceType: "exceptions",
      resourceId: paramsParsed.data.batchId,
      status: "failure",
      details: playtestDetails(role, { cause: "internal_error", error: (error as Error).message, batch_id: paramsParsed.data.batchId }),
    });
    return jsonResponse(errorResponse("INTERNAL_SERVER_ERROR", "Falha ao consultar fila de excecoes.", correlationId), correlationId, { status: 500 });
  }
}
