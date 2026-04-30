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
import { writeDocumentContestationAudit } from "@/lib/documents/contestation-audit";
import {
  updateContestationTrackingStatus,
} from "@/lib/documents/contestation-tracking";
import { DocumentContestationError } from "@/lib/documents/create-document-contestation";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";

const paramsSchema = z.object({
  contestationId: z.string().uuid(),
});

const bodySchema = z.object({
  tracking_status: z.enum(["open", "in_progress", "resolved"]),
  resolution_note: z.string().trim().min(3).max(1000).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ contestationId: string }> },
) {
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  const paramsParsed = paramsSchema.safeParse(await context.params);
  if (!paramsParsed.success) {
    return NextResponse.json(
      errorResponse(
        "VALIDATION_ERROR",
        "Identificador de contestacao invalido.",
        correlationId,
        { issues: paramsParsed.error.issues },
      ),
      { status: 400 },
    );
  }

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
  const bodyParsed = bodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return NextResponse.json(
      errorResponse(
        "VALIDATION_ERROR",
        "Payload de atualizacao de contestacao invalido.",
        correlationId,
        { issues: bodyParsed.error.issues },
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
      action: RBAC_ACTIONS.tenantWrite,
    });
  } catch (error) {
    return NextResponse.json(
      errorResponse("FORBIDDEN", "Acesso negado pelo RBAC.", correlationId, {
        cause: (error as Error).message,
      }),
      { status: 403 },
    );
  }

  if (role !== "rh_operator") {
    return NextResponse.json(
      errorResponse(
        "FORBIDDEN",
        "Somente RH operador pode atualizar contestacoes.",
        correlationId,
      ),
      { status: 403 },
    );
  }

  try {
    const updated = await updateContestationTrackingStatus({
      tenantId: session.tenantId,
      contestationId: paramsParsed.data.contestationId,
      actorId: session.userId,
      nextStatus: bodyParsed.data.tracking_status,
      resolutionNote: bodyParsed.data.resolution_note,
    });

    await writeDocumentContestationAudit({
      tenantId: session.tenantId,
      actorId: session.userId,
      contestationId: updated.contestation_id,
      action: "rh.document.contestation.tracking.updated.v1",
      status: "success",
      correlationId,
      details: {
        tracking_status: updated.tracking_status,
        resolution_note: bodyParsed.data.resolution_note ?? null,
      },
    });

    return NextResponse.json(
      successResponse(updated, correlationId, session.tenantId),
    );
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
        "Falha ao atualizar status da contestacao.",
        correlationId,
      ),
      { status: 500 },
    );
  }
}
