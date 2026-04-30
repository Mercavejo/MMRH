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
import { listContestationsForTenant } from "@/lib/documents/contestation-tracking";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";

const querySchema = z.object({
  tracking_status: z.enum(["open", "in_progress", "resolved"]).optional(),
  period_ref: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
});

export async function GET(request: NextRequest) {
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

  const queryParsed = querySchema.safeParse({
    tracking_status:
      request.nextUrl.searchParams.get("tracking_status") ?? undefined,
    period_ref: request.nextUrl.searchParams.get("period_ref") ?? undefined,
  });

  if (!queryParsed.success) {
    return NextResponse.json(
      errorResponse(
        "VALIDATION_ERROR",
        "Filtros de contestacao invalidos.",
        correlationId,
        { issues: queryParsed.error.issues },
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

  if (role !== "rh_operator" && role !== "rh_gestor") {
    return NextResponse.json(
      errorResponse(
        "FORBIDDEN",
        "Somente RH operador ou gestor pode consultar contestacoes.",
        correlationId,
      ),
      { status: 403 },
    );
  }

  const items = await listContestationsForTenant({
    tenantId: session.tenantId,
    trackingStatus: queryParsed.data.tracking_status,
    periodRef: queryParsed.data.period_ref,
  });

  return NextResponse.json(
    successResponse(
      {
        items,
        filters: {
          tracking_status: queryParsed.data.tracking_status ?? null,
          period_ref: queryParsed.data.period_ref ?? null,
        },
      },
      correlationId,
      session.tenantId,
    ),
  );
}
