import { beforeEach, describe, expect, it, vi } from "vitest";

const { findEmployeeIdentityForActivationInDbMock } = vi.hoisted(() => ({
  findEmployeeIdentityForActivationInDbMock: vi.fn(),
}));

vi.mock("@/modules/employee-identity/infrastructure/employee-identities-repository", () => ({
  findEmployeeIdentityForActivationInDb: findEmployeeIdentityForActivationInDbMock,
}));

import { EmployeeIdentityServiceError } from "@/modules/employee-identity/application/employee-identity-service-error";
import { getEmployeeIdentityActivationCandidate } from "@/modules/employee-identity/application/get-employee-identity-activation-candidate";

describe("employee identity activation candidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tenant-scoped activation candidate for story 2.5 handoff", async () => {
    findEmployeeIdentityForActivationInDbMock.mockResolvedValue({
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
    });

    const result = await getEmployeeIdentityActivationCandidate({
      tenantId: "11111111-1111-4111-8111-111111111111",
      referenceCode: " ref-001 ",
      admissionDate: "01-04-2026",
    });

    expect(findEmployeeIdentityForActivationInDbMock).toHaveBeenCalledWith({
      tenantId: "11111111-1111-4111-8111-111111111111",
        referenceCode: "REF-001",
        admissionDate: "2026-04-01",
      });
    expect(result).toMatchObject({
      employee_identity_id: "emp-1",
      tenant_id: "11111111-1111-4111-8111-111111111111",
      reference_code: "REF-001",
      activation_status: "pending_activation",
      can_self_activate: true,
      secondary_verifier: {
        admission_date: "01-04-2026",
      },
    });
  });

  it("returns NOT_FOUND when tenant-scoped pre-registration does not exist", async () => {
    findEmployeeIdentityForActivationInDbMock.mockResolvedValue(null);

    await expect(
      getEmployeeIdentityActivationCandidate({
        tenantId: "11111111-1111-4111-8111-111111111111",
        referenceCode: "REF-404",
        admissionDate: "01-04-2026",
      }),
    ).rejects.toMatchObject<EmployeeIdentityServiceError>({
      code: "NOT_FOUND",
      statusCode: 404,
      message: "Pre-cadastro funcional nao encontrado para ativacao.",
    });
  });

  it("returns CONFLICT when pre-registration is no longer activatable", async () => {
    findEmployeeIdentityForActivationInDbMock.mockResolvedValue({
      id: "emp-1",
      tenantId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
      referenceCode: "REF-001",
      employeeName: "Maria da Silva",
      admissionDate: "2026-04-01",
      status: "active",
      notes: null,
      createdAt: new Date("2026-04-27T12:00:00.000Z"),
      updatedAt: new Date("2026-04-27T12:00:00.000Z"),
    });

    await expect(
      getEmployeeIdentityActivationCandidate({
        tenantId: "11111111-1111-4111-8111-111111111111",
        referenceCode: "REF-001",
        admissionDate: "01-04-2026",
      }),
    ).rejects.toMatchObject<EmployeeIdentityServiceError>({
      code: "CONFLICT",
      statusCode: 409,
      message: "Identidade funcional indisponivel para ativacao segura.",
    });
  });
});
