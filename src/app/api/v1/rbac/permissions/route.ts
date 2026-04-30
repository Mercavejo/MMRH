import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { errorResponse, successResponse } from "@/lib/api/response";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import {
  assertTenantAction,
  buildAccessDeniedAuditDetails,
  buildPermissionChangeAuditDetails,
  buildTenantPermissionReview,
  listTenantPermissionAssignments,
  RBAC_ACTIONS,
  type RbacRole,
  writeRbacAudit,
} from "@/lib/auth/rbac";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userRoleEnum, userTenantMappings } from "@/lib/db/schema";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/observability/correlation-id";

const updatePermissionSchema = z.object({
  tenant_id: z.string().uuid(),
  target_user_id: z.string().uuid(),
  next_role: z.enum(userRoleEnum.enumValues as [RbacRole, ...RbacRole[]]),
  reason: z.string().min(3).optional(),
});

async function writeRbacAuditSafely(input: Parameters<typeof writeRbacAudit>[0]) {
  try {
    await writeRbacAudit(input);
  } catch (error) {
    console.error(`rbac audit failed for ${input.action}`, error);
  }
}

async function getSessionAndRole(
  request: NextRequest,
  correlationId: string,
): Promise<{ userId: string; tenantId: string; role: RbacRole } | NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json(
      errorResponse("UNAUTHORIZED", "Sessao ausente.", correlationId),
      { status: 401 },
    );
  }

  const session = await validateSession(token);
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

  const mapping = mappings[0];
  if (!mapping) {
    return NextResponse.json(
      errorResponse("FORBIDDEN", "Usuario sem role no tenant.", correlationId),
      { status: 403 },
    );
  }

  return {
    userId: session.userId,
    tenantId: session.tenantId,
    role: mapping.role,
  };
}

export async function GET(request: NextRequest) {
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  const auth = await getSessionAndRole(request, correlationId);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const tenantIdParam = request.nextUrl.searchParams.get("tenant_id");
  const tenantId = tenantIdParam ?? auth.tenantId;

  if (tenantIdParam && tenantIdParam !== auth.tenantId) {
    await writeRbacAuditSafely({
      tenantId: auth.tenantId,
      actorId: auth.userId,
      action: "auth.rbac.access.denied.v1",
      status: "failure",
      correlationId,
      details: buildAccessDeniedAuditDetails({
        tenantId: auth.tenantId,
        actorId: auth.userId,
        action: RBAC_ACTIONS.tenantRead,
        reason: "tenant-mismatch",
        targetTenantId: tenantIdParam,
      }),
    });

    return NextResponse.json(
      errorResponse("FORBIDDEN", "Tenant fora do escopo da sessao.", correlationId),
      { status: 403 },
    );
  }

  try {
    assertTenantAction({
      actorRole: auth.role,
      actorTenantId: auth.tenantId,
      targetTenantId: tenantId,
      action: RBAC_ACTIONS.platformManage,
    });
  } catch (error) {
    const appError = error as AppError;

    await writeRbacAuditSafely({
      tenantId: auth.tenantId,
      actorId: auth.userId,
      action: "auth.rbac.access.denied.v1",
      status: "failure",
      correlationId,
      details: appError.details,
    });

    return NextResponse.json(
      errorResponse(appError.code, appError.message, correlationId, appError.details),
      { status: appError.statusCode },
    );
  }

  const assignments = await listTenantPermissionAssignments(tenantId);
  const review = buildTenantPermissionReview(tenantId, assignments);

  return NextResponse.json(
    successResponse(
      {
        tenant_id: tenantId,
        assignments,
        role_summary: review.roleSummary,
      },
      correlationId,
      tenantId,
    ),
  );
}

export async function PATCH(request: NextRequest) {
  const correlationId = resolveCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER),
  );

  const auth = await getSessionAndRole(request, correlationId);
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const parsed = updatePermissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      errorResponse(
        "VALIDATION_ERROR",
        "Payload de permissao invalido.",
        correlationId,
        { issues: parsed.error.issues },
      ),
      { status: 400 },
    );
  }

  if (parsed.data.tenant_id !== auth.tenantId) {
    await writeRbacAuditSafely({
      tenantId: auth.tenantId,
      actorId: auth.userId,
      action: "auth.rbac.access.denied.v1",
      status: "failure",
      correlationId,
      details: buildAccessDeniedAuditDetails({
        tenantId: auth.tenantId,
        actorId: auth.userId,
        action: RBAC_ACTIONS.platformManage,
        reason: "tenant-mismatch",
        targetTenantId: parsed.data.tenant_id,
      }),
    });

    return NextResponse.json(
      errorResponse("FORBIDDEN", "Tenant fora do escopo da sessao.", correlationId),
      { status: 403 },
    );
  }

  try {
    assertTenantAction({
      actorRole: auth.role,
      actorTenantId: auth.tenantId,
      targetTenantId: parsed.data.tenant_id,
      action: RBAC_ACTIONS.platformManage,
    });
  } catch (error) {
    const appError = error as AppError;

    await writeRbacAuditSafely({
      tenantId: auth.tenantId,
      actorId: auth.userId,
      action: "auth.rbac.access.denied.v1",
      status: "failure",
      correlationId,
      details: appError.details,
    });

    return NextResponse.json(
      errorResponse(appError.code, appError.message, correlationId, appError.details),
      { status: appError.statusCode },
    );
  }

  const targetRows = await db
    .select({ role: userTenantMappings.role })
    .from(userTenantMappings)
    .where(
      and(
        eq(userTenantMappings.userId, parsed.data.target_user_id),
        eq(userTenantMappings.tenantId, parsed.data.tenant_id),
      ),
    )
    .limit(1);

  const targetMapping = targetRows[0];
  if (!targetMapping) {
    return NextResponse.json(
      errorResponse(
        "NOT_FOUND",
        "Usuario alvo nao encontrado no tenant.",
        correlationId,
      ),
      { status: 404 },
    );
  }

  await db
    .update(userTenantMappings)
    .set({ role: parsed.data.next_role })
    .where(
      and(
        eq(userTenantMappings.userId, parsed.data.target_user_id),
        eq(userTenantMappings.tenantId, parsed.data.tenant_id),
      ),
    );

  await writeRbacAuditSafely({
    tenantId: parsed.data.tenant_id,
    actorId: auth.userId,
    action: "auth.rbac.permission.changed.v1",
    status: "success",
    correlationId,
    details: buildPermissionChangeAuditDetails({
      tenantId: parsed.data.tenant_id,
      actorId: auth.userId,
      targetUserId: parsed.data.target_user_id,
      previousRole: targetMapping.role,
      nextRole: parsed.data.next_role,
      reason: parsed.data.reason,
    }),
  });

  return NextResponse.json(
    successResponse(
      {
        tenant_id: parsed.data.tenant_id,
        target_user_id: parsed.data.target_user_id,
        previous_role: targetMapping.role,
        next_role: parsed.data.next_role,
      },
      correlationId,
      parsed.data.tenant_id,
    ),
  );
}
