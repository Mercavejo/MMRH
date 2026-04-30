import {
  buildEmployeeIdentityStatusLabel,
  EmployeeIdentityDomainError,
  normalizeEmployeeIdentityInput,
} from "../domain/employee-identity";
import {
  EmployeeIdentityRepositoryError,
  updateEmployeeIdentityRecord,
} from "../infrastructure/employee-identities-repository";
import { EmployeeIdentityServiceError } from "./employee-identity-service-error";
import type { EmployeeIdentityListItem } from "./types";

export async function updateEmployeeIdentity(input: {
  employeeId: string;
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
    const row = await updateEmployeeIdentityRecord({
      employeeId: input.employeeId,
      ...normalized,
    });

    return {
      employee_id: row.id,
      tenant_id: row.tenantId,
      reference_code: row.referenceCode,
      employee_name: row.employeeName,
      admission_date: row.admissionDate,
      status: row.status,
      status_label: buildEmployeeIdentityStatusLabel(row.status),
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

      if (error.code === "NOT_FOUND") {
        throw new EmployeeIdentityServiceError("NOT_FOUND", error.message, 404, error.details);
      }

      if (error.code === "FORBIDDEN") {
        throw new EmployeeIdentityServiceError("FORBIDDEN", error.message, 403, error.details);
      }
    }

    throw new EmployeeIdentityServiceError(
      "INTERNAL_SERVER_ERROR",
      "Falha ao atualizar colaborador funcional.",
      500,
    );
  }
}
