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
  BATCH_DOCUMENT_TYPES,
  validateBatchImportFile,
} from "@/lib/rh/batches/import-validation";
import { buildBatchRoutingManifest } from "@/lib/rh/batches/batch-routing";
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
    console.error("[playtest.batches.validate] Falha ao registrar evento", error);
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ batchId: string }> },
) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const paramsParsed = paramsSchema.safeParse(await context.params);

  if (!paramsParsed.success) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Identificador de lote invalido.", correlationId),
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

  const batchRows = await db
    .select({
      id: batches.id,
      tenantId: batches.tenantId,
      validationStatus: batches.validationStatus,
      validationSummary: batches.validationSummary,
      sourceContentBase64: batches.sourceContentBase64,
      sourceFormat: batches.sourceFormat,
      originalFilename: batches.originalFilename,
      mimeType: batches.mimeType,
    })
    .from(batches)
    .where(eq(batches.id, paramsParsed.data.batchId))
    .limit(1);

  const batch = batchRows[0];
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

  const summary = batch.validationSummary as Record<string, unknown> | null;
  if (!summary?.ocr_pending) {
    return jsonResponse(
      successResponse(
        {
          batch_id: batch.id,
          validation_status: batch.validationStatus,
          validation_summary: summary,
          message: "Lote ja validado anteriormente.",
        },
        correlationId,
        session.tenantId,
      ),
      correlationId,
    );
  }

  const sourceBase64 = batch.sourceContentBase64;
  if (!sourceBase64) {
    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: "playtest.rh.batches.validate.friction",
      resourceType: "batches",
      resourceId: batch.id,
      status: "failure",
      details: { cause: "missing_source_content" },
    });

    return jsonResponse(
      errorResponse("PRECONDITION_FAILED", "Conteudo do arquivo original nao encontrado para validacao.", correlationId),
      correlationId,
      { status: 422 },
    );
  }

  try {
    const fileBuffer = Buffer.from(sourceBase64, "base64");
    const file = new File([fileBuffer], batch.originalFilename, {
      type: batch.mimeType || "application/pdf",
    });

    const documentTypeHint = summary.document_type_hint as string | undefined;
    const isValidHint = documentTypeHint && BATCH_DOCUMENT_TYPES.includes(documentTypeHint as (typeof BATCH_DOCUMENT_TYPES)[number])
      ? documentTypeHint as (typeof BATCH_DOCUMENT_TYPES)[number]
      : undefined;

    const validation = await validateBatchImportFile(file, {
      pdfDocumentTypeHint: isValidHint,
    });

    const routingManifest = buildBatchRoutingManifest({
      batchId: batch.id,
      rows: validation.rows,
    });

    const updatedSummary = {
      ...validation.summary,
      document_type_hint: validation.summary.document_type_hint || isValidHint,
      ocr_used: validation.summary.ocr_used,
      ocr_average_confidence: validation.summary.ocr_average_confidence,
      ocr_pending: false,
    };

    await db
      .update(batches)
      .set({
        validationStatus: validation.validation_status,
        validationSummary: updatedSummary,
        routingManifest,
        routingTotalCount: routingManifest.length,
        routingPendingCount: routingManifest.length,
        routingMatchedCount: 0,
        routingFailedCount: 0,
        routingAmbiguousCount: 0,
        routingBlockedReason: null,
        routingProcessedAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(batches.id, batch.id), eq(batches.tenantId, session.tenantId)));

    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: "playtest.rh.batches.validate",
      resourceType: "batches",
      resourceId: batch.id,
      status: validation.is_valid ? "success" : "failure",
      details: {
        is_valid: validation.is_valid,
        total_rows: validation.summary.total_rows,
        valid_rows: validation.summary.valid_rows,
        ocr_used: validation.summary.ocr_used,
      },
    });

    return jsonResponse(
      successResponse(
        {
          batch_id: batch.id,
          validation_status: validation.validation_status,
          validation_summary: validation.summary,
          original_filename: validation.original_filename,
        },
        correlationId,
        session.tenantId,
      ),
      correlationId,
    );
  } catch (error) {
    console.error("[rh.batches.validate] Falha ao validar lote OCR", {
      batchId: batch.id,
      correlationId,
      error,
    });

    await recordPlaytestEvent({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      action: "playtest.rh.batches.validate.friction",
      resourceType: "batches",
      resourceId: batch.id,
      status: "failure",
      details: {
        cause: "validation_error",
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });

    return jsonResponse(
      errorResponse(
        "INTERNAL_SERVER_ERROR",
        "Falha ao processar validacao OCR do lote.",
        correlationId,
      ),
      correlationId,
      { status: 500 },
    );
  }
}
