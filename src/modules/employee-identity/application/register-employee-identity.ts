import {
  EmployeeIdentityDomainError,
  formatAdmissionDate,
  normalizeEmployeeIdentityInput,
} from "../domain/employee-identity";
import {
  EmployeeIdentityRepositoryError,
  insertEmployeeIdentity,
} from "../infrastructure/employee-identities-repository";
import { EmployeeIdentityServiceError } from "./employee-identity-service-error";
import type { EmployeeIdentityListItem } from "./types";

export async function registerEmployeeIdentity(input: {
  tenantId: string;
  actorId: string;
  referenceCode: string;
  employeeName: string;
  admissionDate: string;
  status?: string;
  notes?: string | null;
}): Promise<EmployeeIdentityListItem> {
  try {
    const normalized = normalizeEmployeeIdentityInput(input);
    const row = await insertEmployeeIdentity(normalized);

    return {
      employee_id: row.id,
      tenant_id: row.tenantId,
      reference_code: row.referenceCode,
      employee_name: row.employeeName,
      admission_date: formatAdmissionDate(row.admissionDate),
      status: row.status,
      status_label: row.status === "pending_activation" ? "Pendente de ativacao" : row.status,
      user_id: row.userId,
      notes: row.notes,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof EmployeeIdentityDomainError) {
      throw new EmployeeIdentityServiceError("VALIDATION_ERROR", error.message, 400, error.details);
    }

    if (error instanceof EmployeeIdentityRepositoryError) {
      if (error.code === "DUPLICATE_REFERENCE_CODE") {
        throw new EmployeeIdentityServiceError(error.code, error.message, 409, error.details);
      }
    }

    throw new EmployeeIdentityServiceError(
      "INTERNAL_SERVER_ERROR",
      "Falha ao cadastrar colaborador funcional.",
      500,
    );
  }
}
