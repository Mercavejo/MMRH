import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/api/response";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import {
  assertTenantAction,
  RBAC_ACTIONS,
  type RbacRole,
} from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";
import { writePlaytestEvent } from "@/lib/observability/playtest-audit";
import {
  getOperationalIndicators,
  OperationalIndicatorsError,
} from "@/modules/indicators/application/get-operational-indicators";

const querySchema = z
  .object({
    batch_id: z.string().uuid().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    organizational_unit: z.string().trim().min(1).max(200).optional(),
  })
  .superRefine((value, context) => {
    if (value.from && value.to) {
      const from = new Date(value.from).getTime();
      const to = new Date(value.to).getTime();
      if (!Number.isNaN(from) && !Number.isNaN(to) && from > to) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Periodo invalido.",
          path: ["from"],
        });
      }
    }
  });

function withCorrelationHeader(response: NextResponse, correlationId: string) {
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}

function jsonResponse<T>(
  body: ReturnType<typeof errorResponse<T>> | ReturnType<typeof successResponse<T>>,
  correlationId: string,
  startTime: number,
  init?: ResponseInit,
) {
  if (body && body.meta) {
    body.meta.response_time_ms = Math.round(performance.now() - startTime);
  }
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

function playtestDetails(role: RbacRole | undefined, details: Record<string, unknown>) {
  return role ? { actor_role: role, ...details } : details;
}

export async function GET(request: NextRequest) {
  const startTime = performance.now();
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const parsedQuery = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsedQuery.success) {
    const fallbackTenant = request.cookies.get(SESSION_COOKIE_NAME)?.value ? "unknown" : "anonymous";
    await writePlaytestEvent({ tenantId: fallbackTenant, correlationId, action: "playtest.rh.indicators.friction", resourceType: "indicators", status: "failure", details: { cause: "validation_error", issues: parsedQuery.error.issues } });
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Parametros de consulta invalidos.", correlationId, {
        issues: parsedQuery.error.issues,
      }),
      correlationId,
      startTime,
      { status: 400 },
    );
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    await writePlaytestEvent({ tenantId: "anonymous", correlationId, action: "playtest.rh.indicators.friction", resourceType: "indicators", status: "failure", details: { cause: "unauthorized", reason: "Sessao ausente" } });
    return jsonResponse(
      errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId),
      correlationId,
      startTime,
      { status: 401 },
    );
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    await writePlaytestEvent({ tenantId: "anonymous", correlationId, action: "playtest.rh.indicators.friction", resourceType: "indicators", status: "failure", details: { cause: "unauthorized", reason: "Sessao invalida ou expirada" } });
    return jsonResponse(
      errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId),
      correlationId,
      startTime,
      { status: 401 },
    );
  }

  const role = await resolveTenantRole(session.userId, session.tenantId);
  if (!role) {
    await writePlaytestEvent({ tenantId: session.tenantId, actorId: session.userId, correlationId, action: "playtest.rh.indicators.friction", resourceType: "indicators", status: "failure", details: playtestDetails(role, { cause: "forbidden", reason: "Usuario sem permissao no tenant" }) });
    return jsonResponse(
      errorResponse("FORBIDDEN", "Usuario sem permissao no tenant.", correlationId),
      correlationId,
      startTime,
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
    await writePlaytestEvent({ tenantId: session.tenantId, actorId: session.userId, correlationId, action: "playtest.rh.indicators.friction", resourceType: "indicators", status: "failure", details: playtestDetails(role, { cause: "forbidden", reason: "Acesso negado pelo RBAC" }) });
    return jsonResponse(
      errorResponse("FORBIDDEN", "Acesso negado pelo RBAC.", correlationId, {
        cause: (error as Error).message,
      }),
      correlationId,
      startTime,
      { status: 403 },
    );
  }

  const allowedRoles: RbacRole[] = ["admin_plataforma"];
  if (!allowedRoles.includes(role)) {
    await writePlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: role === "rh_gestor" ? "playtest.rh.boundary.gestor.blocked" : "playtest.rh.indicators.friction",
      resourceType: "indicators",
      resourceId: "/api/v1/rh/indicators",
      status: role === "rh_gestor" ? "success" : "failure",
      details: playtestDetails(role, {
        cause: "forbidden",
        reason: "Perfil sem permissao",
        resource_path: "/api/v1/rh/indicators",
      }),
    });
    return jsonResponse(
      errorResponse(
        "FORBIDDEN",
        "Perfil sem permissao para consultar indicadores operacionais.",
        correlationId,
      ),
      correlationId,
      startTime,
      { status: 403 },
    );
  }

  try {
    const result = await getOperationalIndicators({
      tenantId: session.tenantId,
      batchId: parsedQuery.data.batch_id,
      from: parsedQuery.data.from,
      to: parsedQuery.data.to,
      organizationalUnit: parsedQuery.data.organizational_unit,
    });

    await writePlaytestEvent({ tenantId: session.tenantId, actorId: session.userId, correlationId, action: "playtest.rh.indicators.view", resourceType: "indicators", status: "success", details: playtestDetails(role, { period: { from: parsedQuery.data.from, to: parsedQuery.data.to } }) });

    return jsonResponse(successResponse(result, correlationId, session.tenantId), correlationId, startTime);
  } catch (error) {
    if (error instanceof OperationalIndicatorsError) {
      await writePlaytestEvent({ tenantId: session.tenantId, actorId: session.userId, correlationId, action: "playtest.rh.indicators.friction", resourceType: "indicators", status: "failure", details: playtestDetails(role, { cause: "domain_error", code: error.code }) });
      return jsonResponse(
        errorResponse(error.code, error.message, correlationId, error.details),
        correlationId,
        startTime,
        { status: error.statusCode },
      );
    }

    await writePlaytestEvent({ tenantId: session.tenantId, actorId: session.userId, correlationId, action: "playtest.rh.indicators.friction", resourceType: "indicators", status: "failure", details: playtestDetails(role, { cause: "internal_error", error: (error as Error).message }) });
    return jsonResponse(
      errorResponse(
        "INTERNAL_SERVER_ERROR",
        "Falha ao consolidar indicadores operacionais.",
        correlationId,
      ),
      correlationId,
      startTime,
      { status: 500 },
    );
  }
}
