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
  EmployeeNotificationTrackingError,
  markEmployeeNotificationAsRead,
} from "@/lib/notifications/employee-notification-tracking";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";

const paramsSchema = z.object({
  notificationId: z.string().uuid(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ notificationId: string }> },
) {
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  const paramsParsed = paramsSchema.safeParse(await context.params);
  if (!paramsParsed.success) {
    return NextResponse.json(
      errorResponse(
        "VALIDATION_ERROR",
        "Identificador de notificacao invalido.",
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
        "Somente colaborador pode atualizar leitura de notificacoes pessoais.",
        correlationId,
      ),
      { status: 403 },
    );
  }

  try {
    const updated = await markEmployeeNotificationAsRead({
      tenantId: session.tenantId,
      userId: session.userId,
      notificationId: paramsParsed.data.notificationId,
    });

    return NextResponse.json(
      successResponse(updated, correlationId, session.tenantId),
    );
  } catch (error) {
    if (error instanceof EmployeeNotificationTrackingError) {
      return NextResponse.json(
        errorResponse(error.code, error.message, correlationId, error.details),
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      errorResponse(
        "INTERNAL_SERVER_ERROR",
        "Falha ao atualizar leitura da notificacao.",
        correlationId,
      ),
      { status: 500 },
    );
  }
}
