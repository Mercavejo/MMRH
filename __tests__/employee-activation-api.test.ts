import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  activateEmployeeAccessMock,
  writeAuthAuditMock,
} = vi.hoisted(() => ({
  activateEmployeeAccessMock: vi.fn(),
  writeAuthAuditMock: vi.fn(),
}));

vi.mock("@/modules/employee-identity/application/activate-employee-access", () => ({
  activateEmployeeAccess: activateEmployeeAccessMock,
  EmployeeActivationError: class EmployeeActivationError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly details?: Record<string, unknown>,
    ) {
      super(message);
      this.name = "EmployeeActivationError";
    }
  },
}));

vi.mock("@/lib/auth/audit", () => ({
  writeAuthAudit: writeAuthAuditMock,
}));

import { POST } from "@/app/api/v1/employee/activation/route";

describe("employee activation api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeAuthAuditMock.mockResolvedValue(undefined);
  });

  it("activates first access and opens a session", async () => {
    activateEmployeeAccessMock.mockResolvedValue({
      tenant_id: "11111111-1111-4111-8111-111111111111",
      user_id: "user-1",
      cpf: "12345678901",
      employee_identity_id: "emp-1",
      employee_name: "Maria da Silva",
      email: "maria@example.com",
      role: "colaborador",
      session: {
        token: "session-token",
        expiresAt: new Date("2026-04-29T12:00:00.000Z"),
      },
    });

    const request = new NextRequest("http://localhost/api/v1/employee/activation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenant_id: "11111111-1111-4111-8111-111111111111",
        reference_code: "REF-001",
        admission_date: "01-04-2026",
        cpf: "123.456.789-01",
        cpf_confirmation: "123.456.789-01",
        email: "maria@example.com",
        password: "password123",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.user_id).toBe("user-1");
    expect(response.headers.get("x-correlation-id")).toBe(body.meta.correlation_id);
    expect(writeAuthAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.session.login.v1",
        status: "success",
      }),
    );
  });

  it("returns standardized validation failure on bad payload", async () => {
    const request = new NextRequest("http://localhost/api/v1/employee/activation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenant_id: "not-a-uuid",
        reference_code: "",
        admission_date: "01/04/2026",
        cpf: "123",
        cpf_confirmation: "456",
        email: "bad-email",
        password: "123",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(response.headers.get("x-correlation-id")).toBe(body.meta.correlation_id);
    expect(activateEmployeeAccessMock).not.toHaveBeenCalled();
  });

  it("keeps activation successful when auth audit logging fails", async () => {
    activateEmployeeAccessMock.mockResolvedValue({
      tenant_id: "11111111-1111-4111-8111-111111111111",
      user_id: "user-1",
      cpf: "12345678901",
      employee_identity_id: "emp-1",
      employee_name: "Maria da Silva",
      email: "maria@example.com",
      role: "colaborador",
      session: {
        token: "session-token",
        expiresAt: new Date("2026-04-29T12:00:00.000Z"),
      },
    });
    writeAuthAuditMock.mockRejectedValue(new Error("audit down"));

    const request = new NextRequest("http://localhost/api/v1/employee/activation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenant_id: "11111111-1111-4111-8111-111111111111",
        reference_code: "REF-001",
        admission_date: "01-04-2026",
        cpf: "123.456.789-01",
        cpf_confirmation: "123.456.789-01",
        email: "maria@example.com",
        password: "password123",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.user_id).toBe("user-1");
  });
});
