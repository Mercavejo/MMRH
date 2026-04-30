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
  AuditEventsError,
  listAuditEvents,
} from "@/modules/audit/application/list-audit-events";

const querySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    batch_id: z.string().uuid().optional(),
    document_id: z.string().uuid().optional(),
    user_id: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    page_size: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .superRefine((value, context) => {
    if (value.batch_id && value.document_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "batch_id e document_id nao podem ser usados juntos.",
        path: ["batch_id"],
      });
    }

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

async function recordPlaytestEvent(params: Parameters<typeof writePlaytestEvent>[0]) {
  try {
    await writePlaytestEvent(params);
  } catch (error) {
    console.error("[playtest.rh.audit] Falha ao registrar evento", error);
  }
}

function playtestDetails(role: RbacRole | undefined, details: Record<string, unknown>) {
  return role ? { actor_role: role, ...details } : details;
}

export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const parsedQuery = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));

  if (!parsedQuery.success) {
    await recordPlaytestEvent({
      tenantId: request.cookies.get(SESSION_COOKIE_NAME)?.value ? "unknown" : "anonymous",
      correlationId,
      action: "playtest.rh.audit.friction",
      resourceType: "audit",
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
      action: "playtest.rh.audit.friction",
      resourceType: "audit",
      status: "failure",
      details: { cause: "unauthorized", reason: "Sessao ausente" },
    });
    return jsonResponse(
      errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId),
      correlationId,
      { status: 401 },
    );
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    await recordPlaytestEvent({
      tenantId: "anonymous",
      correlationId,
      action: "playtest.rh.audit.friction",
      resourceType: "audit",
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
      action: "playtest.rh.audit.friction",
      resourceType: "audit",
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
    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: "playtest.rh.audit.friction",
      resourceType: "audit",
      status: "failure",
      details: playtestDetails(role, { cause: "forbidden", reason: "Acesso negado pelo RBAC" }),
    });
    return jsonResponse(
      errorResponse("FORBIDDEN", "Acesso negado pelo RBAC.", correlationId, {
        cause: (error as Error).message,
      }),
      correlationId,
      { status: 403 },
    );
  }

  const allowedRoles: RbacRole[] = ["suporte", "admin_plataforma"];
  if (!allowedRoles.includes(role)) {
    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: role === "rh_gestor" ? "playtest.rh.boundary.gestor.blocked" : "playtest.rh.audit.friction",
      resourceType: "audit",
      resourceId: "/api/v1/audit-events",
      status: role === "rh_gestor" ? "success" : "failure",
      details: playtestDetails(role, {
        cause: "forbidden",
        reason: "Perfil sem permissao para consultar auditoria",
        resource_path: "/api/v1/audit-events",
      }),
    });
    return jsonResponse(
      errorResponse("FORBIDDEN", "Perfil sem permissao para consultar auditoria.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  try {
    const result = await listAuditEvents({
      tenantId: session.tenantId,
      from: parsedQuery.data.from,
      to: parsedQuery.data.to,
      batchId: parsedQuery.data.batch_id,
      documentId: parsedQuery.data.document_id,
      userId: parsedQuery.data.user_id,
      page: parsedQuery.data.page,
      pageSize: parsedQuery.data.page_size,
    });

    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: "playtest.rh.audit.view",
      resourceType: "audit",
      status: "success",
      details: playtestDetails(role, {
        page: parsedQuery.data.page,
        page_size: parsedQuery.data.page_size,
      }),
    });

    return jsonResponse(successResponse(result, correlationId, session.tenantId), correlationId);
  } catch (error) {
    if (error instanceof AuditEventsError) {
      await recordPlaytestEvent({
        tenantId: session.tenantId,
        actorId: session.userId,
        correlationId,
        action: "playtest.rh.audit.friction",
        resourceType: "audit",
        status: "failure",
        details: playtestDetails(role, { cause: "domain_error", code: error.code }),
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
      action: "playtest.rh.audit.friction",
      resourceType: "audit",
      status: "failure",
      details: playtestDetails(role, { cause: "internal_error", error: (error as Error).message }),
    });
    return jsonResponse(
      errorResponse("INTERNAL_SERVER_ERROR", "Falha ao consultar trilha de auditoria.", correlationId),
      correlationId,
      { status: 500 },
    );
  }
}
