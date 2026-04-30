import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  transactionMock,
  hashPasswordMock,
  createSessionMock,
  writeEmployeeIdentityAuditMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  hashPasswordMock: vi.fn(),
  createSessionMock: vi.fn(),
  writeEmployeeIdentityAuditMock: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    transaction: transactionMock,
  },
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: hashPasswordMock,
}));

vi.mock("@/lib/auth/session", () => ({
  createSession: createSessionMock,
}));

vi.mock("@/modules/employee-identity/application/write-employee-identity-audit", () => ({
  writeEmployeeIdentityAudit: writeEmployeeIdentityAuditMock,
}));

import {
  activateEmployeeAccess,
  EmployeeActivationError,
} from "@/modules/employee-identity/application/activate-employee-access";

describe("activate employee access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hashPasswordMock.mockResolvedValue("hashed-password");
    createSessionMock.mockResolvedValue({
      token: "session-token",
      expiresAt: new Date("2026-04-29T12:00:00.000Z"),
    });
    writeEmployeeIdentityAuditMock.mockResolvedValue(undefined);
  });

  it("creates colaborador user, tenant mapping and active identity on successful first access", async () => {
    const insertCalls: unknown[] = [];
    const updateCalls: unknown[] = [];

    transactionMock.mockImplementation(async (callback) =>
      callback({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: "emp-1",
                  tenantId: "11111111-1111-4111-8111-111111111111",
                  referenceCode: "REF-001",
                  employeeName: "Maria da Silva",
                  admissionDate: "2026-04-01",
                  status: "pending_activation",
                  userId: null,
                },
              ]),
            }),
          }),
        }),
        insert: vi.fn((table) => {
          insertCalls.push(table);

          if (insertCalls.length === 1) {
            return {
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([
                  {
                    id: "user-1",
                    email: "maria@example.com",
                    name: "Maria da Silva",
                  },
                ]),
              }),
            };
          }

          return {
            values: vi.fn().mockResolvedValue(undefined),
          };
        }),
        update: vi.fn((table) => {
          updateCalls.push(table);

          return {
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: "emp-1" }]),
              }),
            }),
          };
        }),
      }),
    );

    const result = await activateEmployeeAccess({
      tenantId: "11111111-1111-4111-8111-111111111111",
      referenceCode: "ref-001",
      admissionDate: "2026-04-01",
      email: "Maria@example.com",
      password: "password123",
      correlationId: "22222222-2222-4222-8222-222222222222",
    });

    expect(result).toMatchObject({
      tenant_id: "11111111-1111-4111-8111-111111111111",
      user_id: "user-1",
      employee_identity_id: "emp-1",
      email: "maria@example.com",
      role: "colaborador",
      session: {
        token: "session-token",
        expiresAt: new Date("2026-04-29T12:00:00.000Z"),
      },
    });
    expect(hashPasswordMock).toHaveBeenCalledWith("password123");
    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
      expect.anything(),
    );
    expect(writeEmployeeIdentityAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "employee.activation.completed.v1",
        status: "success",
        resourceId: "emp-1",
      }),
    );
  });

  it("fails closed when activation candidate does not exist", async () => {
    transactionMock.mockImplementation(async (callback) =>
      callback({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: vi.fn(),
        update: vi.fn(),
      }),
    );

    await expect(
      activateEmployeeAccess({
        tenantId: "11111111-1111-4111-8111-111111111111",
        referenceCode: "ref-404",
        admissionDate: "2026-04-01",
        email: "maria@example.com",
        password: "password123",
        correlationId: "22222222-2222-4222-8222-222222222222",
      }),
    ).rejects.toMatchObject<EmployeeActivationError>({
      code: "INVALID_ACTIVATION_CREDENTIALS",
    });

    expect(writeEmployeeIdentityAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "employee.activation.rejected.v1",
        status: "failure",
        resourceId: "REF-404",
      }),
    );
  });
});
