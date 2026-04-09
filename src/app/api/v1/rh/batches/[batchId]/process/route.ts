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
import {
  BatchRoutingError,
  batchRoutingManifestSchema,
  routeBatchManifest,
} from "@/lib/rh/batches/batch-routing";
import { buildBatchRoutingProgressFromRecord } from "@/lib/rh/batches/batch-progress";
import { writeBatchRoutingAudit } from "@/lib/rh/batches/batch-routing-audit";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";

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

async function resolveTenantRole(userId: string, tenantId: string): Promise<RbacRole | undefined> {
  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(and(eq(userTenantMappings.userId, userId), eq(userTenantMappings.tenantId, tenantId)))
    .limit(1);

  return mappings[0]?.role as RbacRole | undefined;
}

async function loadBatch(batchId: string) {
  const rows = await db
    .select({
      id: batches.id,
      tenantId: batches.tenantId,
      validationStatus: batches.validationStatus,
      routingStatus: batches.routingStatus,
      routingManifest: batches.routingManifest,
      routingTotalCount: batches.routingTotalCount,
      routingMatchedCount: batches.routingMatchedCount,
      routingPendingCount: batches.routingPendingCount,
      routingFailedCount: batches.routingFailedCount,
      routingAmbiguousCount: batches.routingAmbiguousCount,
      routingBlockedReason: batches.routingBlockedReason,
      routingProcessedAt: batches.routingProcessedAt,
    })
    .from(batches)
    .where(eq(batches.id, batchId))
    .limit(1);

  return rows[0];
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
      errorResponse(
        "FORBIDDEN",
        "Somente RH operador pode executar o roteamento do lote.",
        correlationId,
      ),
      correlationId,
      { status: 403 },
    );
  }

  const batch = await loadBatch(paramsParsed.data.batchId);
  if (!batch) {
    return jsonResponse(
      errorResponse("NOT_FOUND", "Lote nao encontrado.", correlationId),
      correlationId,
      { status: 404 },
    );
  }

  if (batch.tenantId !== session.tenantId) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Acesso negado para lote de outro tenant.", correlationId),
      correlationId,
      { status: 403 },
    );
  }

  if (batch.validationStatus !== "validated") {
    return jsonResponse(
      errorResponse(
        "INVALID_BATCH_STATE",
        "Lote nao esta validado para roteamento.",
        correlationId,
      ),
      correlationId,
      { status: 409 },
    );
  }

  const manifestParsed = batchRoutingManifestSchema.safeParse(batch.routingManifest);
  if (!manifestParsed.success) {
    return jsonResponse(
      errorResponse(
        "VALIDATION_ERROR",
        "Manifest de roteamento invalido.",
        correlationId,
        { issues: manifestParsed.error.issues },
      ),
      correlationId,
      { status: 400 },
    );
  }

  if (manifestParsed.data.length === 0) {
    return jsonResponse(
      errorResponse(
        "BATCH_EMPTY",
        "O lote nao possui documentos para roteamento.",
        correlationId,
      ),
      correlationId,
      { status: 409 },
    );
  }

  await db
    .update(batches)
    .set({
      routingStatus: "processing",
      routingPendingCount: batch.routingTotalCount,
      routingMatchedCount: 0,
      routingFailedCount: 0,
      routingAmbiguousCount: 0,
      routingBlockedReason: null,
      routingProcessedAt: null,
    })
    .where(and(eq(batches.id, batch.id), eq(batches.tenantId, session.tenantId)));

  try {
    const result = routeBatchManifest({
      batchId: batch.id,
      tenantId: session.tenantId,
      manifest: manifestParsed.data,
    });

    await db
      .update(batches)
      .set({
        routingStatus: result.routing_status,
        routingMatchedCount: result.matched_documents,
        routingPendingCount: result.pending_documents,
        routingFailedCount: result.failed_documents,
        routingAmbiguousCount: result.ambiguous_documents,
        routingBlockedReason: result.blocked_reason,
        routingProcessedAt: result.processed_at ? new Date(result.processed_at) : new Date(),
      })
      .where(and(eq(batches.id, batch.id), eq(batches.tenantId, session.tenantId)));

    await writeBatchRoutingAudit(
      {
        tenantId: session.tenantId,
        actorId: session.userId,
        correlationId,
        status: result.routing_status === "completed" ? "success" : "failure",
        batchId: batch.id,
        details: {
          routing_status: result.routing_status,
          total_documents: result.total_documents,
          matched_documents: result.matched_documents,
          pending_documents: result.pending_documents,
          failed_documents: result.failed_documents,
          ambiguous_documents: result.ambiguous_documents,
          blocked_reason: result.blocked_reason,
        },
      },
    );

    return jsonResponse(
      successResponse(result, correlationId, session.tenantId),
      correlationId,
    );
  } catch (error) {
    const failureReason =
      error instanceof BatchRoutingError ? error.message : "Falha ao executar o roteamento do lote.";

    await db
      .update(batches)
      .set({
        routingStatus: "failed",
        routingMatchedCount: 0,
        routingPendingCount: 0,
        routingFailedCount: batch.routingTotalCount,
        routingAmbiguousCount: 0,
        routingBlockedReason: failureReason,
        routingProcessedAt: new Date(),
      })
      .where(and(eq(batches.id, batch.id), eq(batches.tenantId, session.tenantId)));

    await writeBatchRoutingAudit(
      {
        tenantId: session.tenantId,
        actorId: session.userId,
        correlationId,
        status: "failure",
        batchId: batch.id,
        details: {
          routing_status: "failed",
          total_documents: batch.routingTotalCount,
          matched_documents: 0,
          pending_documents: 0,
          failed_documents: batch.routingTotalCount,
          ambiguous_documents: 0,
          blocked_reason: failureReason,
        },
      },
    );

    if (error instanceof BatchRoutingError) {
      return jsonResponse(
        errorResponse(error.code, error.message, correlationId, error.details),
        correlationId,
        { status: error.statusCode },
      );
    }

    return jsonResponse(
      errorResponse(
        "INTERNAL_SERVER_ERROR",
        "Falha ao executar o roteamento do lote.",
        correlationId,
      ),
      correlationId,
      { status: 500 },
    );
  }
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

  if (role !== "rh_operator" && role !== "rh_gestor") {
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

  const batch = await loadBatch(paramsParsed.data.batchId);
  if (!batch) {
    return jsonResponse(
      errorResponse("NOT_FOUND", "Lote nao encontrado.", correlationId),
      correlationId,
      { status: 404 },
    );
  }

  if (batch.tenantId !== session.tenantId) {
    return jsonResponse(
      errorResponse("FORBIDDEN", "Acesso negado para lote de outro tenant.", correlationId),
      correlationId,
      { status: 403 },
    );
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