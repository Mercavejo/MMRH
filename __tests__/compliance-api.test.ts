import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT_ID = "22222222-2222-4222-8222-222222222222";
const selectResultQueue: unknown[] = [];

const {
  validateSessionMock,
  assertTenantActionMock,
  writeRbacAuditMock,
  executeTenantRetentionMock,
} = vi.hoisted(() => ({
  validateSessionMock: vi.fn(),
  assertTenantActionMock: vi.fn(),
  writeRbacAuditMock: vi.fn(),
  executeTenantRetentionMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  validateSession: validateSessionMock,
}));

vi.mock("@/lib/auth/rbac", () => ({
  RBAC_ACTIONS: {
    tenantRead: "tenant:read",
    accessManage: "access:manage",
  },
  assertTenantAction: assertTenantActionMock,
  buildAccessDeniedAuditDetails: vi.fn().mockReturnValue({ reason: "tenant-mismatch" }),
  writeRbacAudit: writeRbacAuditMock,
}));

vi.mock("@/lib/compliance/retention", () => ({
  executeTenantRetention: executeTenantRetentionMock,
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(async () => {
            if (selectResultQueue.length > 0) {
              return selectResultQueue.shift();
            }

            return [{ role: "rh_operator" }];
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: "policy-1" }]),
      }),
    }),
  },
}));

import { GET, PUT } from "@/app/api/v1/compliance/policies/route";
import { POST } from "@/app/api/v1/compliance/retention/execute/route";

describe("compliance api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResultQueue.length = 0;
    validateSessionMock.mockResolvedValue({
      userId: "user-1",
      tenantId: SESSION_TENANT_ID,
    });
  });

  it("blocks cross-tenant policy access", async () => {
    const request = new NextRequest(
      `http://localhost/api/v1/compliance/policies?tenant_id=${OTHER_TENANT_ID}`,
      {
      headers: { cookie: "session_id=token" },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(writeRbacAuditMock).toHaveBeenCalled();
  });

  it("updates tenant policy when authorized", async () => {
    const request = new NextRequest("http://localhost/api/v1/compliance/policies", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: "session_id=token" },
      body: JSON.stringify({
        tenant_id: SESSION_TENANT_ID,
        retention_days_documents: 90,
        retention_days_audit_logs: 365,
        legal_basis: "legal_obligation",
        minimization_profile: "strict",
        enabled: true,
      }),
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.tenant_id).toBe(SESSION_TENANT_ID);
    expect(assertTenantActionMock).toHaveBeenCalled();
  });

  it("executes retention endpoint and returns evidence summary", async () => {
    selectResultQueue.push([{ role: "rh_operator" }]);
    selectResultQueue.push([
      {
        retentionDaysDocuments: 90,
        retentionDaysAuditLogs: 365,
        legalBasis: "legal_obligation",
        enabled: true,
      },
    ]);

    executeTenantRetentionMock.mockResolvedValue({
      executed: true,
      dryRun: false,
      documentsAffected: 2,
      auditLogsAffected: 1,
    });

    const request = new NextRequest("http://localhost/api/v1/compliance/retention/execute", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "session_id=token" },
      body: JSON.stringify({
        tenant_id: SESSION_TENANT_ID,
        dry_run: false,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.executed).toBe(true);
    expect(body.data.documents_affected).toBe(2);
    expect(executeTenantRetentionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        legalBasis: "legal_obligation",
      }),
    );
  });
});
