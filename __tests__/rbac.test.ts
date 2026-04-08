import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/api/errors";
import {
  RBAC_ACTIONS,
  assertTenantAction,
  buildAccessDeniedAuditDetails,
  buildPermissionChangeAuditDetails,
  buildTenantPermissionReview,
  canAccessTenantAction,
  getRolePermissions,
} from "@/lib/auth/rbac";

describe("rbac", () => {
  it("allows same-tenant access when role has permission", () => {
    const decision = canAccessTenantAction({
      actorRole: "rh_operator",
      actorTenantId: "tenant-1",
      targetTenantId: "tenant-1",
      action: RBAC_ACTIONS.tenantWrite,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("allowed");
  });

  it("blocks any cross-tenant access regardless of role", () => {
    const decision = canAccessTenantAction({
      actorRole: "admin_plataforma",
      actorTenantId: "tenant-1",
      targetTenantId: "tenant-2",
      action: RBAC_ACTIONS.platformManage,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("tenant-mismatch");
  });

  it("throws a forbidden error for insufficient role permissions", () => {
    expect(() =>
      assertTenantAction({
        actorRole: "colaborador",
        actorTenantId: "tenant-1",
        targetTenantId: "tenant-1",
        action: RBAC_ACTIONS.tenantWrite,
      }),
    ).toThrowError(AppError);
  });

  it("exposes permissions per role", () => {
    expect(getRolePermissions("rh_gestor")).toEqual([
      RBAC_ACTIONS.tenantRead,
      RBAC_ACTIONS.auditRead,
    ]);
  });

  it("builds a tenant permission review snapshot", () => {
    const review = buildTenantPermissionReview("tenant-1", [
      { tenantId: "tenant-1", userId: "user-1", role: "colaborador", userEmail: "a@example.com" },
      { tenantId: "tenant-1", userId: "user-2", role: "colaborador", userEmail: "b@example.com" },
      { tenantId: "tenant-1", userId: "user-3", role: "rh_operator" },
      { tenantId: "tenant-2", userId: "user-4", role: "admin_plataforma" },
    ]);

    expect(review.tenantId).toBe("tenant-1");
    expect(review.roleSummary.find((role) => role.role === "colaborador")?.userCount).toBe(2);
    expect(review.roleSummary.find((role) => role.role === "rh_operator")?.userIds).toEqual([
      "user-3",
    ]);
    expect(review.roleSummary.find((role) => role.role === "admin_plataforma")?.userCount).toBe(0);
  });

  it("builds audit details for permission changes and denied access", () => {
    expect(
      buildPermissionChangeAuditDetails({
        tenantId: "tenant-1",
        actorId: "actor-1",
        targetUserId: "user-2",
        previousRole: "colaborador",
        nextRole: "rh_gestor",
      }),
    ).toEqual({
      tenant_id: "tenant-1",
      actor_id: "actor-1",
      target_user_id: "user-2",
      previous_role: "colaborador",
      next_role: "rh_gestor",
      reason: "permission_updated",
    });

    expect(
      buildAccessDeniedAuditDetails({
        tenantId: "tenant-1",
        actorId: "actor-1",
        action: RBAC_ACTIONS.tenantWrite,
        reason: "tenant-mismatch",
        targetTenantId: "tenant-2",
      }),
    ).toEqual({
      tenant_id: "tenant-1",
      actor_id: "actor-1",
      action: RBAC_ACTIONS.tenantWrite,
      reason: "tenant-mismatch",
      target_tenant_id: "tenant-2",
    });
  });
});