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
import { listExternalIngestions, ExternalIngestionError } from "@/modules/integrations/application/list-external-ingestions";
import { registerExternalIngestion } from "@/modules/integrations/application/register-external-ingestion";
import { AUTHORIZED_EXTERNAL_SOURCES } from "@/modules/integrations/domain/external-ingestion";

const intakeSchema = z.object({
  tenant_id: z.string().uuid(),
  source_reference: z.string().trim().min(3).max(255),
  idempotency_key: z.string().trim().min(8).max(128),
  payload_summary: z.record(z.string(), z.unknown()).optional(),
});

const querySchema = z
  .object({
    ingestion_id: z.string().trim().min(1).optional(),
    status: z.enum(["received", "processing", "processed", "failed"]).optional(),
    source_system: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    if (value.source_system && !AUTHORIZED_EXTERNAL_SOURCES.includes(value.source_system as (typeof AUTHORIZED_EXTERNAL_SOURCES)[number])) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Origem externa nao autorizada.",
        path: ["source_system"],
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

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const sourceSystem = request.headers.get("x-integration-source") ?? undefined;
  const parsedBody = intakeSchema.safeParse(await request.json().catch(() => null));

  if (!sourceSystem || !AUTHORIZED_EXTERNAL_SOURCES.includes(sourceSystem as (typeof AUTHORIZED_EXTERNAL_SOURCES)[number])) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Origem externa nao autorizada.", correlationId, {
        source_system: sourceSystem ?? null,
      }),
      correlationId,
      { status: 403 },
    );
  }

  if (!parsedBody.success) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Payload de intake externo invalido.", correlationId, {
        issues: parsedBody.error.issues,
      }),
      correlationId,
      { status: 400 },
    );
  }

  try {
    const record = await registerExternalIngestion({
      tenantId: parsedBody.data.tenant_id,
      sourceSystem,
      sourceReference: parsedBody.data.source_reference,
      idempotencyKey: parsedBody.data.idempotency_key,
      payloadSummary: parsedBody.data.payload_summary,
      correlationId,
    });

    return jsonResponse(successResponse(record, correlationId, record.tenant_id), correlationId, { status: 202 });
  } catch (error) {
    if (error instanceof ExternalIngestionError) {
      return jsonResponse(
        errorResponse(error.code, error.message, correlationId, error.details),
        correlationId,
        { status: error.statusCode },
      );
    }

    return jsonResponse(
      errorResponse("INTERNAL_SERVER_ERROR", "Falha ao registrar intake externo.", correlationId),
      correlationId,
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const parsedQuery = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));

  if (!parsedQuery.success) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Filtros de integracao invalidos.", correlationId, {
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

  const allowedRoles: RbacRole[] = ["rh_operator", "rh_gestor", "admin_plataforma"];
  if (!allowedRoles.includes(role)) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Perfil sem permissao para consultar integracoes externas.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  try {
    const result = await listExternalIngestions({
      tenantId: session.tenantId,
      status: parsedQuery.data.status,
      sourceSystem: parsedQuery.data.source_system,
      ingestionId: parsedQuery.data.ingestion_id,
    });

    return jsonResponse(successResponse(result, correlationId, session.tenantId), correlationId);
  } catch (error) {
    if (error instanceof ExternalIngestionError) {
      return jsonResponse(
        errorResponse(error.code, error.message, correlationId, error.details),
        correlationId,
        { status: error.statusCode },
      );
    }

    return jsonResponse(
      errorResponse("INTERNAL_SERVER_ERROR", "Falha ao consultar integracoes externas.", correlationId),
      correlationId,
      { status: 500 },
    );
  }
}
