import { describe, expect, it } from "vitest";
import {
  EmployeeIdentityDomainError,
  buildEmployeeIdentityActivationDescriptor,
  formatAdmissionDate,
  normalizeEmployeeIdentityInput,
  normalizeEmployeeIdentityStatus,
} from "@/modules/employee-identity/domain/employee-identity";

describe("employee identity domain", () => {
  it("normalizes input for pending employee identity registration", () => {
    const result = normalizeEmployeeIdentityInput({
      tenantId: "11111111-1111-4111-8111-111111111111",
      referenceCode: "  ref-001  ",
      employeeName: "  Maria da Silva  ",
      admissionDate: "01-04-2026",
      status: "pending_activation",
      notes: "  Primeira carga RH  ",
    });

    expect(result.referenceCode).toBe("REF-001");
    expect(result.employeeName).toBe("Maria da Silva");
    expect(result.admissionDate).toBe("2026-04-01");
    expect(result.status).toBe("pending_activation");
    expect(result.notes).toBe("Primeira carga RH");
  });

  it("formats canonical admission date to brazilian pattern", () => {
    expect(formatAdmissionDate("2026-04-01")).toBe("01-04-2026");
  });

  it("rejects invalid admission date", () => {
    expect(() =>
      normalizeEmployeeIdentityInput({
        tenantId: "11111111-1111-4111-8111-111111111111",
        referenceCode: "REF-001",
        employeeName: "Maria",
        admissionDate: "01/04/2026",
        status: "pending_activation",
      }),
    ).toThrowError(EmployeeIdentityDomainError);
  });

  it("builds secure activation descriptor for story 2.5 handoff", () => {
    const result = buildEmployeeIdentityActivationDescriptor({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: "11111111-1111-4111-8111-111111111111",
      referenceCode: "ref-001",
      employeeName: "Maria da Silva",
      admissionDate: "2026-04-01",
      status: "pending_activation",
      userId: null,
    });

    expect(result.reference_code).toBe("REF-001");
    expect(result.activation_status).toBe("pending_activation");
    expect(result.can_self_activate).toBe(true);
    expect(result.secondary_verifier.admission_date).toBe("01-04-2026");
  });

  it("blocks activation descriptor when the identity is already linked", () => {
    expect(() =>
      buildEmployeeIdentityActivationDescriptor({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        tenantId: "11111111-1111-4111-8111-111111111111",
        referenceCode: "REF-001",
        employeeName: "Maria da Silva",
        admissionDate: "2026-04-01",
        status: "active",
        userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    ).toThrowError(EmployeeIdentityDomainError);
  });

  it("normalizes allowed statuses", () => {
    expect(normalizeEmployeeIdentityStatus("active")).toBe("active");
    expect(normalizeEmployeeIdentityStatus("blocked")).toBe("blocked");
    expect(normalizeEmployeeIdentityStatus("inactive")).toBe("inactive");
  });
});
