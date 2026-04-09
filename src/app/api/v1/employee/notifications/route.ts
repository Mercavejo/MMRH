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
  listEmployeeNotifications,
} from "@/lib/notifications/employee-notification-tracking";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";

const querySchema = z.object({
  context_type: z.enum(["document", "contestation"]).optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
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
    context_type: request.nextUrl.searchParams.get("context_type") ?? undefined,
    from_date: request.nextUrl.searchParams.get("from_date") ?? undefined,
    to_date: request.nextUrl.searchParams.get("to_date") ?? undefined,
  });

  if (!queryParsed.success) {
    return NextResponse.json(
      errorResponse(
        "VALIDATION_ERROR",
        "Filtros de notificacao invalidos.",
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

  if (role !== "colaborador") {
    return NextResponse.json(
      errorResponse(
        "FORBIDDEN",
        "Somente colaborador pode consultar notificacoes pessoais.",
        correlationId,
      ),
      { status: 403 },
    );
  }

  const items = await listEmployeeNotifications({
    tenantId: session.tenantId,
    userId: session.userId,
    contextType: queryParsed.data.context_type,
    fromDate: queryParsed.data.from_date,
    toDate: queryParsed.data.to_date,
  });

  return NextResponse.json(
    successResponse(
      {
        items,
        filters: {
          context_type: queryParsed.data.context_type ?? null,
          from_date: queryParsed.data.from_date ?? null,
          to_date: queryParsed.data.to_date ?? null,
        },
      },
      correlationId,
      session.tenantId,
    ),
  );
}
