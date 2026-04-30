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
import { batches, userTenantMappings } from "@/lib/db/schema";
import { buildBatchRoutingProgressFromRecord } from "@/lib/rh/batches/batch-progress";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";
import { writePlaytestEvent } from "@/lib/observability/playtest-audit";

const paramsSchema = z.object({
  batchId: z.string().uuid(),
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
    console.error("[playtest.batches.history] Falha ao registrar evento", error);
  }
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
  context: { params: Promise<{ batchId: string }> },
) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const paramsParsed = paramsSchema.safeParse(await context.params);

  if (!paramsParsed.success) {
    await recordPlaytestEvent({
      tenantId: "anonymous",
      correlationId,
      action: "playtest.rh.batches.history.friction",
      resourceType: "batches",
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

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    await recordPlaytestEvent({
      tenantId: "anonymous",
      correlationId,
      action: "playtest.rh.batches.history.friction",
      resourceType: "batches",
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
    await writePlaytestEvent({
      tenantId: "anonymous",
      correlationId,
      action: "playtest.rh.batches.history.friction",
      resourceType: "batches",
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
      action: "playtest.rh.batches.history.friction",
      resourceType: "batches",
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
      action: "playtest.rh.batches.history.friction",
      resourceType: "batches",
      status: "failure",
      details: { cause: "forbidden", reason: (error as Error).message },
    });
    return jsonResponse(
      errorResponse("FORBIDDEN", "Acesso negado pelo RBAC.", correlationId, {
        cause: (error as Error).message,
      }),
      correlationId,
      { status: 403 },
    );
  }

  if (role !== "rh_operator" && role !== "rh_gestor") {
    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: "playtest.rh.batches.history.friction",
      resourceType: "batches",
      status: "failure",
      details: { cause: "forbidden", reason: "Perfil sem permissao para historico do lote" },
    });
    return jsonResponse(
      errorResponse(
        "FORBIDDEN",
        "Somente RH operador ou gestor pode consultar progresso de lote.",
        correlationId,
      ),
      correlationId,
      { status: 403 },
    );
  }

  const rows = await db
    .select({
      id: batches.id,
      tenantId: batches.tenantId,
      validationStatus: batches.validationStatus,
      routingStatus: batches.routingStatus,
      routingTotalCount: batches.routingTotalCount,
      routingMatchedCount: batches.routingMatchedCount,
      routingPendingCount: batches.routingPendingCount,
      routingFailedCount: batches.routingFailedCount,
      routingAmbiguousCount: batches.routingAmbiguousCount,
      routingBlockedReason: batches.routingBlockedReason,
      routingProcessedAt: batches.routingProcessedAt,
      publicationStatus: batches.publicationStatus,
      publicationAttempts: batches.publicationAttempts,
      publishedAt: batches.publishedAt,
      publishedBy: batches.publishedBy,
      lastPublicationCorrelationId: batches.lastPublicationCorrelationId,
      lastPublicationIdempotencyKey: batches.lastPublicationIdempotencyKey,
      lastPublicationError: batches.lastPublicationError,
    })
    .from(batches)
    .where(eq(batches.id, paramsParsed.data.batchId))
    .limit(1);

  const batch = rows[0];
  if (!batch) {
    if (role === "rh_gestor") {
      await recordPlaytestEvent({
        tenantId: session.tenantId,
        actorId: session.userId,
        correlationId,
        action: "playtest.rh.batches.history.friction",
        resourceType: "batches",
        resourceId: paramsParsed.data.batchId,
        status: "failure",
        details: { cause: "not_found", batch_id: paramsParsed.data.batchId },
      });
    }
    return jsonResponse(
      errorResponse("NOT_FOUND", "Lote nao encontrado.", correlationId),
      correlationId,
      { status: 404 },
    );
  }

  if (batch.tenantId !== session.tenantId) {
    if (role === "rh_gestor") {
      await recordPlaytestEvent({
        tenantId: session.tenantId,
        actorId: session.userId,
        correlationId,
        action: "playtest.rh.batches.history.friction",
        resourceType: "batches",
        resourceId: paramsParsed.data.batchId,
        status: "failure",
        details: { cause: "forbidden", reason: "Acesso a lote de outro tenant" },
      });
    }
    return jsonResponse(
      errorResponse("FORBIDDEN", "Acesso negado para lote de outro tenant.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  if (role === "rh_gestor") {
    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: "playtest.rh.batches.history.view",
      resourceType: "batches",
      resourceId: batch.id,
      status: "success",
      details: {
        batch_id: batch.id,
        routing_status: batch.routingStatus,
        publication_status: batch.publicationStatus,
        pending_documents: batch.routingPendingCount,
      },
    });
  }

  return jsonResponse(
    successResponse(
      buildBatchRoutingProgressFromRecord(batch),
      correlationId,
      session.tenantId,
    ),
    correlationId,
  );
}
