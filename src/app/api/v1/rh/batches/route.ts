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
import { buildCapabilityForbiddenDetails, ErrorCode } from "@/lib/api/errors";
import {
  persistValidatedBatchImport,
  writeBatchImportAudit,
} from "@/lib/rh/batches/import-batch";
import { validateBatchImportFile } from "@/lib/rh/batches/import-validation";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";
import { writePlaytestEvent } from "@/lib/observability/playtest-audit";
import { enforceCapability } from "@/modules/plans/application/enforce-capability";
import { CapabilityForbiddenError, Capability } from "@/modules/plans/domain/capabilities";

const uploadSchema = z.object({
  file: z.instanceof(File),
});

const batchImportRoles: readonly RbacRole[] = ["rh_operator", "rh_gestor", "admin_plataforma"];

function withCorrelationHeader(response: NextResponse, correlationId: string) {
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
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

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    await writePlaytestEvent({ tenantId: "anonymous", correlationId, action: "playtest.rh.batches.friction", resourceType: "batches", status: "failure", details: { cause: "unauthorized" } });
    return withCorrelationHeader(
      NextResponse.json(errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId), { status: 401 }),
      correlationId,
    );
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    await writePlaytestEvent({ tenantId: "anonymous", correlationId, action: "playtest.rh.batches.friction", resourceType: "batches", status: "failure", details: { cause: "unauthorized" } });
    return withCorrelationHeader(
      NextResponse.json(errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId), { status: 401 }),
      correlationId,
    );
  }

  const role = await resolveTenantRole(session.userId, session.tenantId);
  if (!role) {
    await writePlaytestEvent({ tenantId: session.tenantId, actorId: session.userId, correlationId, action: "playtest.rh.batches.friction", resourceType: "batches", status: "failure", details: { cause: "forbidden" } });
    return withCorrelationHeader(
      NextResponse.json(errorResponse("FORBIDDEN", "Usuario sem permissao no tenant.", correlationId), { status: 403 }),
      correlationId,
    );
  }

  if (!batchImportRoles.includes(role)) {
    await writePlaytestEvent({ tenantId: session.tenantId, actorId: session.userId, correlationId, action: "playtest.rh.batches.friction", resourceType: "batches", status: "failure", details: { cause: "forbidden", reason: "role mismatch" } });
    return withCorrelationHeader(
      NextResponse.json(
        errorResponse(
          "FORBIDDEN",
          "Somente RH operador ou gestor pode importar relatorios de lote.",
          correlationId,
        ),
        { status: 403 },
      ),
      correlationId,
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
    await writePlaytestEvent({ tenantId: session.tenantId, actorId: session.userId, correlationId, action: "playtest.rh.batches.friction", resourceType: "batches", status: "failure", details: { cause: "forbidden", reason: "RBAC denied" } });
    return withCorrelationHeader(
      NextResponse.json(
        errorResponse("FORBIDDEN", "Acesso negado pelo RBAC.", correlationId, {
          cause: (error as Error).message,
        }),
        { status: 403 },
      ),
      correlationId,
    );
  }

  if (role !== "rh_gestor") {
    try {
      await enforceCapability(session.tenantId, Capability.BATCH_INGESTION, session.userId, correlationId);
    } catch (error) {
      if (error instanceof CapabilityForbiddenError) {
        await writePlaytestEvent({ tenantId: session.tenantId, actorId: session.userId, correlationId, action: "playtest.rh.batches.friction", resourceType: "batches", status: "failure", details: { cause: "capability_forbidden", cap: error.capability } });
        return withCorrelationHeader(
          NextResponse.json(
            errorResponse(
              ErrorCode.CapabilityForbidden,
              "Esta funcionalidade nao esta disponivel no plano atual.",
              correlationId,
              buildCapabilityForbiddenDetails({
                capability: error.capability,
                planCode: error.planCode,
                correlationId,
                upgradeHint: error.upgradeHint,
              }),
            ),
            { status: 403 },
          ),
          correlationId,
        );
      }
      await writePlaytestEvent({ tenantId: session.tenantId, actorId: session.userId, correlationId, action: "playtest.rh.batches.friction", resourceType: "batches", status: "failure", details: { cause: "internal_error", error: (error as Error).message } });
      return withCorrelationHeader(
        NextResponse.json(
          errorResponse("INTERNAL_SERVER_ERROR", "Falha ao validar capacidade do plano atual.", correlationId),
          { status: 500 },
        ),
        correlationId,
      );
    }
  }

  const formData = await request.formData().catch(() => null);
  const uploadParsed = uploadSchema.safeParse({
    file: formData?.get("file"),
  });

  if (!uploadParsed.success) {
    await writePlaytestEvent({ tenantId: session.tenantId, actorId: session.userId, correlationId, action: "playtest.rh.batches.friction", resourceType: "batches", status: "failure", details: { cause: "validation_error" } });
    return withCorrelationHeader(
      NextResponse.json(
        errorResponse("VALIDATION_ERROR", "Arquivo de lote invalido.", correlationId, {
          issues: uploadParsed.error.issues,
        }),
        { status: 400 },
      ),
      correlationId,
    );
  }

  const validation = await validateBatchImportFile(uploadParsed.data.file);

  if (!validation.is_valid) {
    await writePlaytestEvent({ tenantId: session.tenantId, actorId: session.userId, correlationId, action: "playtest.rh.batches.friction", resourceType: "batches", status: "failure", details: { cause: "file_validation", issues: validation.summary.issues } });
    await writeBatchImportAudit(
      {
        tenantId: session.tenantId,
        actorId: session.userId,
        correlationId,
        status: "failure",
        details: {
          original_filename: validation.original_filename,
          source_format: validation.summary.source_format,
          validation_status: validation.validation_status,
          critical_issue_count: validation.summary.critical_issue_count,
          warning_issue_count: validation.summary.warning_issue_count,
          issues: validation.summary.issues,
        },
      },
      db,
    );

    return withCorrelationHeader(
      NextResponse.json(
        errorResponse("VALIDATION_ERROR", "O relatorio geral nao passou na validacao inicial.", correlationId, {
          validation_status: validation.validation_status,
          summary: validation.summary,
        }),
        { status: 400 },
      ),
      correlationId,
    );
  }

  const batch = await persistValidatedBatchImport(
    {
      tenantId: session.tenantId,
      uploadedBy: session.userId,
      correlationId,
      validation,
    },
    db,
  );

  await writePlaytestEvent({ tenantId: session.tenantId, actorId: session.userId, correlationId, action: "playtest.rh.batches.import", resourceType: "batches", status: "success", details: { batch_id: batch.batchId } });

  return withCorrelationHeader(
    NextResponse.json(
      successResponse(
        {
          batch_id: batch.batchId,
          validation_status: validation.validation_status,
          validation_summary: validation.summary,
          original_filename: validation.original_filename,
        },
        correlationId,
        session.tenantId,
      ),
      { status: 201 },
    ),
    correlationId,
  );
}
