import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT_ID = "22222222-2222-4222-8222-222222222222";

const {
  validateSessionMock,
  dbSelectMock,
  dbFromMock,
  dbWhereMock,
  dbLimitMock,
  listEmployeeIdentitiesMock,
  registerEmployeeIdentityMock,
  updateEmployeeIdentityMock,
  writeEmployeeIdentityAuditMock,
} = vi.hoisted(() => ({
  validateSessionMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbFromMock: vi.fn(),
  dbWhereMock: vi.fn(),
  dbLimitMock: vi.fn(),
  listEmployeeIdentitiesMock: vi.fn(),
  registerEmployeeIdentityMock: vi.fn(),
  updateEmployeeIdentityMock: vi.fn(),
  writeEmployeeIdentityAuditMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  validateSession: validateSessionMock,
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: dbSelectMock.mockReturnValue({
      from: dbFromMock.mockReturnValue({
        where: dbWhereMock.mockReturnValue({
          limit: dbLimitMock,
        }),
      }),
    }),
  },
}));

vi.mock("@/modules/employee-identity/application/list-employee-identities", () => ({
  listEmployeeIdentities: listEmployeeIdentitiesMock,
}));

vi.mock("@/modules/employee-identity/application/register-employee-identity", () => ({
  registerEmployeeIdentity: registerEmployeeIdentityMock,
}));

vi.mock("@/modules/employee-identity/application/update-employee-identity", () => ({
  updateEmployeeIdentity: updateEmployeeIdentityMock,
}));

vi.mock("@/modules/employee-identity/application/write-employee-identity-audit", () => ({
  writeEmployeeIdentityAudit: writeEmployeeIdentityAuditMock,
}));

import { EmployeeIdentityServiceError } from "@/modules/employee-identity/application/employee-identity-service-error";
import { GET, POST } from "@/app/api/v1/rh/employees/route";
import { PATCH } from "@/app/api/v1/rh/employees/[employeeId]/route";

describe("rh employee registration api", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    validateSessionMock.mockResolvedValue({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: SESSION_TENANT_ID,
    });

    dbWhereMock.mockReturnValue({
      limit: dbLimitMock,
    });
    dbFromMock.mockReturnValue({
      where: dbWhereMock,
    });
    dbSelectMock.mockReturnValue({
      from: dbFromMock,
    });

    dbLimitMock.mockResolvedValue([{ role: "rh_gestor" }]);
    writeEmployeeIdentityAuditMock.mockResolvedValue(undefined);
    listEmployeeIdentitiesMock.mockResolvedValue({
      items: [
        {
          employee_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          tenant_id: SESSION_TENANT_ID,
          reference_code: "REF-001",
          employee_name: "Maria da Silva",
          admission_date: "01-04-2026",
          status: "pending_activation",
          status_label: "Pendente de ativacao",
          user_id: null,
          notes: null,
          created_at: "2026-04-27T12:00:00.000Z",
          updated_at: "2026-04-27T12:00:00.000Z",
        },
      ],
      total: 1,
    });
    registerEmployeeIdentityMock.mockResolvedValue({
      employee_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenant_id: SESSION_TENANT_ID,
      reference_code: "REF-001",
      employee_name: "Maria da Silva",
      admission_date: "01-04-2026",
      status: "pending_activation",
      status_label: "Pendente de ativacao",
      user_id: null,
      notes: "Primeira carga RH",
      created_at: "2026-04-27T12:00:00.000Z",
      updated_at: "2026-04-27T12:00:00.000Z",
    });
    updateEmployeeIdentityMock.mockResolvedValue({
      employee_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenant_id: SESSION_TENANT_ID,
      reference_code: "REF-001",
      employee_name: "Maria de Souza",
      admission_date: "01-04-2026",
      status: "active",
      status_label: "Ativo",
      user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      notes: null,
      created_at: "2026-04-27T12:00:00.000Z",
      updated_at: "2026-04-27T13:00:00.000Z",
    });
  });

  it("creates pending employee identity for a tenant-scoped RH manager", async () => {
    const request = new NextRequest("http://localhost/api/v1/rh/employees", {
      method: "POST",
      headers: {
        cookie: "session_id=token",
        "content-type": "application/json",
        "x-correlation-id": "11111111-1111-4111-8111-111111111111",
      },
      body: JSON.stringify({
        employee_name: "Maria da Silva",
        reference_code: "ref-001",
        admission_date: "01-04-2026",
        notes: "Primeira carga RH",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.status).toBe("pending_activation");
    expect(body.meta.tenant_id).toBe(SESSION_TENANT_ID);
    expect(registerEmployeeIdentityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        referenceCode: "ref-001",
        actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    );
    expect(writeEmployeeIdentityAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "rh.employee_identity.created.v1",
        status: "success",
      }),
    );
  });

  it("allows admin_plataforma to create employee identities", async () => {
    dbLimitMock.mockResolvedValueOnce([{ role: "admin_plataforma" }]);

    const request = new NextRequest("http://localhost/api/v1/rh/employees", {
      method: "POST",
      headers: {
        cookie: "session_id=token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        employee_name: "Maria da Silva",
        reference_code: "ref-001",
        admission_date: "01-04-2026",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.status).toBe("pending_activation");
    expect(registerEmployeeIdentityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    );
  });

  it("forces pending activation on create even if caller sends another status", async () => {
    const request = new NextRequest("http://localhost/api/v1/rh/employees", {
      method: "POST",
      headers: {
        cookie: "session_id=token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        employee_name: "Maria da Silva",
        reference_code: "ref-001",
        admission_date: "01-04-2026",
        status: "active",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.status).toBe("pending_activation");
    expect(registerEmployeeIdentityMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        status: expect.anything(),
      }),
    );
  });

  it("lists employee identities for RH operations", async () => {
    const request = new NextRequest("http://localhost/api/v1/rh/employees?status=pending_activation", {
      method: "GET",
      headers: { cookie: "session_id=token" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(listEmployeeIdentitiesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        filters: expect.objectContaining({ status: "pending_activation" }),
      }),
    );
  });

  it("blocks duplicate employee code without duplicating the record", async () => {
    registerEmployeeIdentityMock.mockRejectedValueOnce(
      new EmployeeIdentityServiceError(
        "DUPLICATE_REFERENCE_CODE",
        "Codigo de referencia ja cadastrado neste tenant.",
        409,
      ),
    );

    const request = new NextRequest("http://localhost/api/v1/rh/employees", {
      method: "POST",
      headers: {
        cookie: "session_id=token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        employee_name: "Maria da Silva",
        reference_code: "REF-001",
        admission_date: "01-04-2026",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("DUPLICATE_REFERENCE_CODE");
    expect(writeEmployeeIdentityAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "rh.employee_identity.create.rejected.v1",
        status: "failure",
      }),
    );
  });

  it("keeps create success response when audit persistence fails", async () => {
    writeEmployeeIdentityAuditMock.mockRejectedValueOnce(new Error("audit insert failed"));

    const request = new NextRequest("http://localhost/api/v1/rh/employees", {
      method: "POST",
      headers: {
        cookie: "session_id=token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        employee_name: "Maria da Silva",
        reference_code: "REF-001",
        admission_date: "01-04-2026",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.employee_id).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  it("keeps duplicate rejection semantics when failure audit write also fails", async () => {
    registerEmployeeIdentityMock.mockRejectedValueOnce(
      new EmployeeIdentityServiceError(
        "DUPLICATE_REFERENCE_CODE",
        "Codigo de referencia ja cadastrado neste tenant.",
        409,
      ),
    );
    writeEmployeeIdentityAuditMock.mockRejectedValueOnce(new Error("audit insert failed"));

    const request = new NextRequest("http://localhost/api/v1/rh/employees", {
      method: "POST",
      headers: {
        cookie: "session_id=token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        employee_name: "Maria da Silva",
        reference_code: "REF-001",
        admission_date: "01-04-2026",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("DUPLICATE_REFERENCE_CODE");
  });

  it("rejects users without RH or platform permission", async () => {
    dbLimitMock.mockResolvedValueOnce([{ role: "colaborador" }]);

    const request = new NextRequest("http://localhost/api/v1/rh/employees", {
      method: "GET",
      headers: { cookie: "session_id=token" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("rejects cross-tenant update attempts", async () => {
    validateSessionMock.mockResolvedValueOnce({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: OTHER_TENANT_ID,
    });
    updateEmployeeIdentityMock.mockRejectedValueOnce(
      new EmployeeIdentityServiceError(
        "FORBIDDEN",
        "Acesso negado para colaborador funcional de outro tenant.",
        403,
      ),
    );

    const request = new NextRequest(
      "http://localhost/api/v1/rh/employees/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      {
        method: "PATCH",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          employee_name: "Maria de Souza",
          reference_code: "REF-001",
          admission_date: "01-04-2026",
          status: "active",
        }),
      },
    );

    const response = await PATCH(request, {
      params: Promise.resolve({
        employeeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("updates employee identity with audited history and no duplication", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/rh/employees/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      {
        method: "PATCH",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
          "x-correlation-id": "11111111-1111-4111-8111-111111111111",
        },
        body: JSON.stringify({
          employee_name: "Maria de Souza",
          reference_code: "REF-001",
          admission_date: "01-04-2026",
          status: "active",
        }),
      },
    );

    const response = await PATCH(request, {
      params: Promise.resolve({
        employeeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("active");
    expect(updateEmployeeIdentityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        tenantId: SESSION_TENANT_ID,
        actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    );
    expect(writeEmployeeIdentityAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "rh.employee_identity.updated.v1",
        status: "success",
      }),
    );
  });

  it("keeps update success response when audit persistence fails", async () => {
    writeEmployeeIdentityAuditMock.mockRejectedValueOnce(new Error("audit insert failed"));

    const request = new NextRequest(
      "http://localhost/api/v1/rh/employees/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      {
        method: "PATCH",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          employee_name: "Maria de Souza",
          reference_code: "REF-001",
          admission_date: "01-04-2026",
          status: "active",
        }),
      },
    );

    const response = await PATCH(request, {
      params: Promise.resolve({
        employeeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("active");
  });

  it("keeps update business error when failure audit write also fails", async () => {
    updateEmployeeIdentityMock.mockRejectedValueOnce(
      new EmployeeIdentityServiceError(
        "FORBIDDEN",
        "Acesso negado para colaborador funcional de outro tenant.",
        403,
      ),
    );
    writeEmployeeIdentityAuditMock.mockRejectedValueOnce(new Error("audit insert failed"));

    const request = new NextRequest(
      "http://localhost/api/v1/rh/employees/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      {
        method: "PATCH",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          employee_name: "Maria de Souza",
          reference_code: "REF-001",
          admission_date: "2026-04-01",
          status: "active",
        }),
      },
    );

    const response = await PATCH(request, {
      params: Promise.resolve({
        employeeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});
