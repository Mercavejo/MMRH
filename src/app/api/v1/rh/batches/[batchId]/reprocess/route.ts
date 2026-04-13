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
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";
import { writeBatchReprocessAudit } from "@/lib/rh/batches/reprocess-audit";
import { reprocessExceptionsForBatch } from "@/modules/exceptions/application/reprocess-exceptions";
import { ExceptionWorkflowError } from "@/modules/exceptions/infrastructure/exception-repository";

const paramsSchema = z.object({
  batchId: z.string().uuid(),
});

const payloadSchema = z
  .object({
    exception_ids: z.array(z.string().uuid()).max(1000).optional(),
    reprocess_all_eligible: z.boolean().optional().default(false),
    idempotency_key: z.string().trim().min(8).max(128),
  })
  .superRefine((value, ctx) => {
    if (!value.reprocess_all_eligible && (!value.exception_ids || value.exception_ids.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exception_ids"],
        message: "Informe exception_ids ou habilite reprocess_all_eligible.",
      });
    }
  });

function withCorrelationHeader(response: NextResponse, correlationId: string) {
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}

function jsonResponse(
  body: ReturnType<typeof errorResponse> | ReturnType<typeof successResponse>,
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

  const bodyParsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!bodyParsed.success) {
    return jsonResponse(
      errorResponse("VALIDATION_ERROR", "Payload de reprocessamento invalido.", correlationId, {
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
      errorResponse("FORBIDDEN", "Somente RH operador pode reprocessar lote.", correlationId),
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

  await writeBatchReprocessAudit({
    tenantId: session.tenantId,
    actorId: session.userId,
    correlationId,
    batchId: paramsParsed.data.batchId,
    stage: "started",
    status: "success",
    details: {
      idempotency_key: bodyParsed.data.idempotency_key,
      total_requested: bodyParsed.data.exception_ids?.length ?? null,
      reprocess_all_eligible: bodyParsed.data.reprocess_all_eligible,
    },
  });

  try {
    const result = await reprocessExceptionsForBatch({
      tenantId: session.tenantId,
      batchId: paramsParsed.data.batchId,
      actorId: session.userId,
      correlationId,
      idempotencyKey: bodyParsed.data.idempotency_key,
      exceptionIds: bodyParsed.data.reprocess_all_eligible
        ? undefined
        : bodyParsed.data.exception_ids,
    });

    await writeBatchReprocessAudit({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      batchId: paramsParsed.data.batchId,
      stage: "finished",
      status: "success",
      details: {
        total_requested: result.total_requested,
        total_eligible: result.total_eligible,
        total_reprocessed: result.total_reprocessed,
        total_resolved: result.total_resolved,
        total_remaining: result.total_remaining,
        total_failed: result.total_failed,
      },
    });

    return jsonResponse(successResponse(result, correlationId, session.tenantId), correlationId);
  } catch (error) {
    await writeBatchReprocessAudit({
      tenantId: session.tenantId,
      actorId: session.userId,
      correlationId,
      batchId: paramsParsed.data.batchId,
      stage: "finished",
      status: "failure",
      details: {
        error_message: error instanceof Error ? error.message : "Erro desconhecido",
      },
    });

    if (error instanceof ExceptionWorkflowError) {
      return jsonResponse(
        errorResponse(error.code, error.message, correlationId, error.details),
        correlationId,
        { status: error.statusCode },
      );
    }

    return jsonResponse(
      errorResponse("INTERNAL_SERVER_ERROR", "Falha ao reprocessar lote.", correlationId),
      correlationId,
      { status: 500 },
    );
  }
}
