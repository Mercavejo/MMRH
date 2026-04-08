import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { AppError } from "@/lib/api/errors";
import { auditLogs, userTenantMappings, userRoleEnum } from "@/lib/db/schema";

export const RBAC_ACTIONS = {
  tenantRead: "tenant:read",
  tenantWrite: "tenant:write",
  accessManage: "access:manage",
  auditRead: "audit:read",
  supportDiagnose: "support:diagnose",
  platformManage: "platform:manage",
} as const;

export type RbacAction = (typeof RBAC_ACTIONS)[keyof typeof RBAC_ACTIONS];
export type RbacRole = (typeof userRoleEnum.enumValues)[number];

export type AuthorizationDecision = {
  allowed: boolean;
  reason: "allowed" | "tenant-mismatch" | "role-insufficient";
  actorRole: RbacRole;
  actorTenantId: string;
  targetTenantId: string;
  action: RbacAction;
};

export type TenantPermissionAssignment = {
  userId: string;
  tenantId: string;
  role: RbacRole;
  userName?: string;
  userEmail?: string;
};

export type TenantPermissionReview = {
  tenantId: string;
  roleSummary: Array<{
    role: RbacRole;
    userCount: number;
    userIds: string[];
    userEmails: string[];
  }>;
};

const ROLE_PERMISSIONS: Record<RbacRole, readonly RbacAction[]> = {
  colaborador: [RBAC_ACTIONS.tenantRead],
  rh_operator: [
    RBAC_ACTIONS.tenantRead,
    RBAC_ACTIONS.tenantWrite,
    RBAC_ACTIONS.accessManage,
  ],
  rh_gestor: [RBAC_ACTIONS.tenantRead, RBAC_ACTIONS.auditRead],
  suporte: [RBAC_ACTIONS.tenantRead, RBAC_ACTIONS.supportDiagnose],
  admin_plataforma: [
    RBAC_ACTIONS.tenantRead,
    RBAC_ACTIONS.tenantWrite,
    RBAC_ACTIONS.accessManage,
    RBAC_ACTIONS.auditRead,
    RBAC_ACTIONS.platformManage,
  ],
};

function normalizeUuidOrRandom(value?: string | null): string {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return value && uuidPattern.test(value) ? value : randomUUID();
}

export function getRolePermissions(role: RbacRole): readonly RbacAction[] {
  return ROLE_PERMISSIONS[role];
}

export function canAccessTenantAction(params: {
  actorRole: RbacRole;
  actorTenantId: string;
  targetTenantId: string;
  action: RbacAction;
}): AuthorizationDecision {
  if (params.actorTenantId !== params.targetTenantId) {
    return {
      allowed: false,
      reason: "tenant-mismatch",
      actorRole: params.actorRole,
      actorTenantId: params.actorTenantId,
      targetTenantId: params.targetTenantId,
      action: params.action,
    };
  }

  const permissions = getRolePermissions(params.actorRole);

  if (!permissions.includes(params.action)) {
    return {
      allowed: false,
      reason: "role-insufficient",
      actorRole: params.actorRole,
      actorTenantId: params.actorTenantId,
      targetTenantId: params.targetTenantId,
      action: params.action,
    };
  }

  return {
    allowed: true,
    reason: "allowed",
    actorRole: params.actorRole,
    actorTenantId: params.actorTenantId,
    targetTenantId: params.targetTenantId,
    action: params.action,
  };
}

export function assertTenantAction(params: {
  actorRole: RbacRole;
  actorTenantId: string;
  targetTenantId: string;
  action: RbacAction;
}): AuthorizationDecision {
  const decision = canAccessTenantAction(params);

  if (!decision.allowed) {
    throw new AppError("FORBIDDEN", "Acesso negado pelo RBAC.", 403, {
      reason: decision.reason,
      actor_role: decision.actorRole,
      actor_tenant_id: decision.actorTenantId,
      target_tenant_id: decision.targetTenantId,
      action: decision.action,
    });
  }

  return decision;
}

export function buildTenantPermissionReview(
  tenantId: string,
  assignments: TenantPermissionAssignment[],
): TenantPermissionReview {
  const scopedAssignments = assignments.filter(
    (assignment) => assignment.tenantId === tenantId,
  );

  return {
    tenantId,
    roleSummary: (userRoleEnum.enumValues as RbacRole[]).map((role) => {
      const roleAssignments = scopedAssignments.filter(
        (assignment) => assignment.role === role,
      );

      return {
        role,
        userCount: roleAssignments.length,
        userIds: roleAssignments.map((assignment) => assignment.userId),
        userEmails: roleAssignments
          .map((assignment) => assignment.userEmail)
          .filter((email): email is string => Boolean(email)),
      };
    }),
  };
}

export function buildPermissionChangeAuditDetails(params: {
  tenantId: string;
  actorId: string;
  targetUserId: string;
  previousRole: RbacRole;
  nextRole: RbacRole;
  reason?: string;
}) {
  return {
    tenant_id: params.tenantId,
    actor_id: params.actorId,
    target_user_id: params.targetUserId,
    previous_role: params.previousRole,
    next_role: params.nextRole,
    reason: params.reason ?? "permission_updated",
  };
}

export function buildAccessDeniedAuditDetails(params: {
  tenantId: string;
  actorId: string;
  action: RbacAction;
  reason: AuthorizationDecision["reason"];
  targetTenantId: string;
}) {
  return {
    tenant_id: params.tenantId,
    actor_id: params.actorId,
    action: params.action,
    reason: params.reason,
    target_tenant_id: params.targetTenantId,
  };
}

export async function writeRbacAudit(params: {
  tenantId: string;
  actorId?: string;
  action: "auth.rbac.permission.changed.v1" | "auth.rbac.access.denied.v1";
  status: "success" | "failure";
  correlationId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const { db } = await import("@/lib/db/client");

  await db.insert(auditLogs).values({
    tenantId: params.tenantId,
    actorId: params.actorId,
    correlationId: normalizeUuidOrRandom(params.correlationId),
    action: params.action,
    resourceType: "tenant_permission",
    resourceId: params.actorId ?? params.tenantId,
    status: params.status,
    details: params.details,
  });
}

export async function listTenantPermissionAssignments(tenantId: string) {
  const { db } = await import("@/lib/db/client");

  return db
    .select({
      userId: userTenantMappings.userId,
      tenantId: userTenantMappings.tenantId,
      role: userTenantMappings.role,
    })
    .from(userTenantMappings)
    .where(eq(userTenantMappings.tenantId, tenantId))
    .orderBy(userTenantMappings.role, userTenantMappings.userId);
}
