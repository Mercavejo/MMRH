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
import {
  getOperationalAlerts,
  OperationalAlertsError,
} from "@/modules/alerts/application/get-operational-alerts";

const querySchema = z
  .object({
    status: z.enum(["open", "in_treatment", "resolved"]).optional(),
    severity: z.enum(["critical", "warning", "info"]).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    batch_id: z.string().uuid().optional(),
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

async function writeAlertsReadAudit(params: {
  tenantId: string;
  actorId: string;
  correlationId: string;
  details: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    tenantId: params.tenantId,
    actorId: params.actorId,
    correlationId: params.correlationId,
    action: "rh.alerts.read.v1",
    resourceType: "operational_alert",
    resourceId: params.tenantId,
    status: "success",
    details: params.details,
  });
}

export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
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

  const allowedRoles: RbacRole[] = ["rh_operator", "rh_gestor", "suporte", "admin_plataforma"];
  if (!allowedRoles.includes(role)) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Perfil sem permissao para consultar alertas operacionais.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  try {
    const result = await getOperationalAlerts({
      tenantId: session.tenantId,
      status: parsedQuery.data.status,
      severity: parsedQuery.data.severity,
      from: parsedQuery.data.from,
      to: parsedQuery.data.to,
      batchId: parsedQuery.data.batch_id,
    });

    try {
      await writeAlertsReadAudit({
        tenantId: session.tenantId,
        actorId: session.userId,
        correlationId,
        details: {
          total: result.metadata.total,
          open_count: result.metadata.open_count,
          in_treatment_count: result.metadata.in_treatment_count,
          resolved_count: result.metadata.resolved_count,
        },
      });
    } catch (auditError) {
      // Falha de auditoria nao deve bloquear leitura de alertas, mas precisa ser observavel.
      console.error("rh.alerts.read.v1 audit write failed", auditError);
    }

    return jsonResponse(successResponse(result, correlationId, session.tenantId), correlationId);
  } catch (error) {
    if (error instanceof OperationalAlertsError) {
      return jsonResponse(
        errorResponse(error.code, error.message, correlationId, error.details),
        correlationId,
        { status: error.statusCode },
      );
    }

    return jsonResponse(
      errorResponse("INTERNAL_SERVER_ERROR", "Falha ao consultar alertas operacionais.", correlationId),
      correlationId,
      { status: 500 },
    );
  }
}
