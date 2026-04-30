import { describe, expect, it, vi } from "vitest";
import {
  insertEmployeeIdentity,
  updateEmployeeIdentityRecord,
} from "@/modules/employee-identity/infrastructure/employee-identities-repository";

describe("employee identities repository", () => {
  it("translates insert unique violations into duplicate reference error", async () => {
    const dbClient = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue({
            code: "23505",
            constraint_name: "employee_identities_tenant_reference_unique",
          }),
        }),
      }),
    } as never;

    await expect(
      insertEmployeeIdentity(
        {
          tenantId: "11111111-1111-4111-8111-111111111111",
          referenceCode: "REF-001",
          employeeName: "Maria da Silva",
          admissionDate: "2026-04-01",
          status: "pending_activation",
          notes: null,
        },
        dbClient,
      ),
    ).rejects.toMatchObject({
      code: "DUPLICATE_REFERENCE_CODE",
      message: "Codigo de referencia ja cadastrado neste tenant.",
    });
  });

  it("translates update unique violations into duplicate reference error", async () => {
    const dbClient = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: "emp-1",
                  tenantId: "11111111-1111-4111-8111-111111111111",
                  userId: null,
                  referenceCode: "REF-001",
                  employeeName: "Maria da Silva",
                  admissionDate: "2026-04-01",
                  status: "pending_activation",
                  notes: null,
                  createdAt: new Date("2026-04-27T12:00:00.000Z"),
                  updatedAt: new Date("2026-04-27T12:00:00.000Z"),
                },
              ]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue({
              code: "23505",
              constraint: "employee_identities_tenant_reference_unique",
            }),
          }),
        }),
      }),
    } as never;

    await expect(
      updateEmployeeIdentityRecord(
        {
          employeeId: "emp-1",
          tenantId: "11111111-1111-4111-8111-111111111111",
          referenceCode: "REF-002",
          employeeName: "Maria da Silva",
          admissionDate: "2026-04-01",
          status: "pending_activation",
          notes: null,
        },
        dbClient,
      ),
    ).rejects.toMatchObject({
      code: "DUPLICATE_REFERENCE_CODE",
      message: "Codigo de referencia ja cadastrado neste tenant.",
    });
  });
});
