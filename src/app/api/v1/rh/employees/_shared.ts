import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { errorResponse } from "@/lib/api/response";
import { assertTenantAction, RBAC_ACTIONS, type RbacRole } from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userTenantMappings } from "@/lib/db/schema";
import { CORRELATION_ID_HEADER, resolveCorrelationId } from "@/lib/observability/correlation-id";
import { writeEmployeeIdentityAudit } from "@/modules/employee-identity/application/write-employee-identity-audit";

const allowedRoles: RbacRole[] = ["rh_operator", "rh_gestor", "admin_plataforma"];

export function withCorrelationHeader(response: NextResponse, correlationId: string) {
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}

export async function writeEmployeeIdentityAuditSafely(input: Parameters<typeof writeEmployeeIdentityAudit>[0]) {
  try {
    await writeEmployeeIdentityAudit(input);
  } catch (error) {
    console.error(`employee identity audit failed for ${input.action}`, error);
  }
}

export async function resolveRhEmployeeContext(request: NextRequest) {
  const correlationId = resolveCorrelationId(request.headers.get(CORRELATION_ID_HEADER));
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return {
      ok: false as const,
      correlationId,
      response: withCorrelationHeader(
        NextResponse.json(errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId), { status: 401 }),
        correlationId,
      ),
    };
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return {
      ok: false as const,
      correlationId,
      response: withCorrelationHeader(
        NextResponse.json(errorResponse("UNAUTHORIZED", "Sessao invalida ou expirada.", correlationId), { status: 401 }),
        correlationId,
      ),
    };
  }

  const mappings = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(and(eq(userTenantMappings.userId, session.userId), eq(userTenantMappings.tenantId, session.tenantId)))
    .limit(1);

  const role = mappings[0]?.role as RbacRole | undefined;
  if (!role) {
    return {
      ok: false as const,
      correlationId,
      response: withCorrelationHeader(
        NextResponse.json(errorResponse("FORBIDDEN", "Usuario sem permissao no tenant.", correlationId), { status: 403 }),
        correlationId,
      ),
    };
  }

  try {
    assertTenantAction({
      actorRole: role,
      actorTenantId: session.tenantId,
      targetTenantId: session.tenantId,
      action: RBAC_ACTIONS.tenantWrite,
    });
  } catch (error) {
    return {
      ok: false as const,
      correlationId,
      response: withCorrelationHeader(
        NextResponse.json(
          errorResponse("FORBIDDEN", "Acesso negado pelo RBAC.", correlationId, {
            cause: (error as Error).message,
          }),
          { status: 403 },
        ),
        correlationId,
      ),
    };
  }

  if (!allowedRoles.includes(role)) {
    return {
      ok: false as const,
      correlationId,
      response: withCorrelationHeader(
        NextResponse.json(
          errorResponse("FORBIDDEN", "Perfil sem permissao para gerir colaboradores.", correlationId),
          { status: 403 },
        ),
        correlationId,
      ),
    };
  }

  return {
    ok: true as const,
    correlationId,
    session,
    role,
  };
}
