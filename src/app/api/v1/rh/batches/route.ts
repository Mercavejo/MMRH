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
  persistValidatedBatchImport,
  writeBatchImportAudit,
} from "@/lib/rh/batches/import-batch";
import { validateBatchImportFile } from "@/lib/rh/batches/import-validation";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";

const uploadSchema = z.object({
  file: z.instanceof(File),
});

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
    return withCorrelationHeader(
      NextResponse.json(errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId), { status: 401 }),
      correlationId,
    );
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return withCorrelationHeader(
      NextResponse.json(errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId), { status: 401 }),
      correlationId,
    );
  }

  const role = await resolveTenantRole(session.userId, session.tenantId);
  if (!role) {
    return withCorrelationHeader(
      NextResponse.json(errorResponse("FORBIDDEN", "Usuario sem permissao no tenant.", correlationId), { status: 403 }),
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

  if (role !== "rh_operator") {
    return withCorrelationHeader(
      NextResponse.json(
        errorResponse(
          "FORBIDDEN",
          "Somente RH operador pode importar relatorios de lote.",
          correlationId,
        ),
        { status: 403 },
      ),
      correlationId,
    );
  }

  const formData = await request.formData().catch(() => null);
  const uploadParsed = uploadSchema.safeParse({
    file: formData?.get("file"),
  });

  if (!uploadParsed.success) {
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
