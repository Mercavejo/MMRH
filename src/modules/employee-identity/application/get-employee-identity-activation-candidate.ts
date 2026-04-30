import { buildEmployeeIdentityActivationDescriptor, EmployeeIdentityDomainError, normalizeAdmissionDate, normalizeReferenceCode } from "../domain/employee-identity";
import { findEmployeeIdentityForActivationInDb } from "../infrastructure/employee-identities-repository";
import { EmployeeIdentityServiceError } from "./employee-identity-service-error";

export async function getEmployeeIdentityActivationCandidate(input: {
  tenantId: string;
  referenceCode: string;
  admissionDate: string;
}) {
  const referenceCode = normalizeReferenceCode(input.referenceCode);
  const admissionDate = normalizeAdmissionDate(input.admissionDate);
  const row = await findEmployeeIdentityForActivationInDb({
    tenantId: input.tenantId,
    referenceCode,
    admissionDate,
  });

  if (!row) {
    throw new EmployeeIdentityServiceError(
      "NOT_FOUND",
      "Pre-cadastro funcional nao encontrado para ativacao.",
      404,
    );
  }

  try {
    return buildEmployeeIdentityActivationDescriptor({
      id: row.id,
      tenantId: row.tenantId,
      referenceCode: row.referenceCode,
      employeeName: row.employeeName,
      admissionDate: row.admissionDate,
      status: row.status,
      userId: row.userId,
      notes: row.notes,
    });
  } catch (error) {
    if (error instanceof EmployeeIdentityDomainError) {
      throw new EmployeeIdentityServiceError("CONFLICT", error.message, 409, error.details);
    }

    throw error;
  }
}
