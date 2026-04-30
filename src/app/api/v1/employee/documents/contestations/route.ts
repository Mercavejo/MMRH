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
  createDocumentContestation,
  DocumentContestationError,
} from "@/lib/documents/create-document-contestation";
import { writeDocumentContestationAudit } from "@/lib/documents/contestation-audit";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";

const createSchema = z.object({
  document_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(1000).optional(),
  batch_id: z.string().trim().min(1).max(120).optional(),
});

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.json(
      errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId),
      { status: 401 },
    );
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return NextResponse.json(
      errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId),
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      errorResponse(
        "VALIDATION_ERROR",
        "Payload de contestacao invalido.",
        correlationId,
        { issues: parsed.error.issues },
      ),
      { status: 400 },
    );
  }

  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(
      and(
        eq(userTenantMappings.userId, session.userId),
        eq(userTenantMappings.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  const role = mappings[0]?.role as RbacRole | undefined;
  if (!role) {
    return NextResponse.json(
      errorResponse("FORBIDDEN", "Usuario sem permissao no tenant.", correlationId),
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
    return NextResponse.json(
      errorResponse("FORBIDDEN", "Acesso negado pelo RBAC.", correlationId, {
        cause: (error as Error).message,
      }),
      { status: 403 },
    );
  }

  if (role !== "colaborador") {
    return NextResponse.json(
      errorResponse(
        "FORBIDDEN",
        "Somente colaborador pode abrir contestacao de documento.",
        correlationId,
      ),
      { status: 403 },
    );
  }

  try {
    const created = await createDocumentContestation({
      tenantId: session.tenantId,
      userId: session.userId,
      documentId: parsed.data.document_id,
      reason: parsed.data.reason,
      batchId: parsed.data.batch_id,
    });

    await writeDocumentContestationAudit({
      tenantId: session.tenantId,
      actorId: session.userId,
      contestationId: created.contestation_id,
      action: "employee.document.contestation.open.v1",
      status: "success",
      correlationId,
      details: {
        document_id: created.document_id,
        period_ref: created.period_ref,
        document_type: created.document_type,
        source_status: created.source_status,
      },
    });

    return NextResponse.json(successResponse(created, correlationId, session.tenantId), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof DocumentContestationError) {
      return NextResponse.json(
        errorResponse(error.code, error.message, correlationId, error.details),
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      errorResponse(
        "INTERNAL_SERVER_ERROR",
        "Falha ao abrir contestacao contextual.",
        correlationId,
      ),
      { status: 500 },
    );
  }
}
