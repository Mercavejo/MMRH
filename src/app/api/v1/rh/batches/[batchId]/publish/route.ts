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
import {
  BatchPublicationError,
  publishBatch,
} from "@/modules/batches/application/publish-batch";

const paramsSchema = z.object({
  batchId: z.string().uuid(),
});

const payloadSchema = z.object({
  idempotency_key: z.string().trim().min(8).max(128),
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

export async function POST(
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

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return jsonResponse(
      errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId),
      correlationId,
      { status: 401 },
    );
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return jsonResponse(
      errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId),
      correlationId,
      { status: 401 },
    );
  }

  const bodyParsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!bodyParsed.success) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Payload de publicacao invalido.", correlationId, {
        issues: bodyParsed.error.issues,
      }),
      correlationId,
      { status: 400 },
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
      action: RBAC_ACTIONS.tenantWrite,
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

  if (role !== "rh_operator") {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Somente RH operador pode publicar lote.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  try {
    const result = await publishBatch({
      tenantId: session.tenantId,
      batchId: paramsParsed.data.batchId,
      actorId: session.userId,
      correlationId,
      idempotencyKey: bodyParsed.data.idempotency_key,
    });

    return jsonResponse(successResponse(result, correlationId, session.tenantId), correlationId);
  } catch (error) {
    if (error instanceof BatchPublicationError) {
      return jsonResponse(
        errorResponse(error.code, error.message, correlationId, error.details),
        correlationId,
        { status: error.statusCode },
      );
    }

    return jsonResponse(
      errorResponse("INTERNAL_SERVER_ERROR", "Falha ao publicar lote.", correlationId),
      correlationId,
      { status: 500 },
    );
  }
}