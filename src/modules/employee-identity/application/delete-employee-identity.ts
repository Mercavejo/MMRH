import {
  EmployeeIdentityRepositoryError,
  deleteEmployeeIdentityRecord,
} from "../infrastructure/employee-identities-repository";
import { EmployeeIdentityServiceError } from "./employee-identity-service-error";

export async function deleteEmployeeIdentity(input: {
  employeeId: string;
  tenantId: string;
  actorId: string;
}): Promise<{ deleted: boolean; employee_id: string }> {
  try {
    await deleteEmployeeIdentityRecord({
      employeeId: input.employeeId,
      tenantId: input.tenantId,
    });

    return { deleted: true, employee_id: input.employeeId };
  } catch (error) {
    if (error instanceof EmployeeIdentityRepositoryError) {
      if (error.code === "NOT_FOUND") {
        throw new EmployeeIdentityServiceError(error.code, error.message, 404, error.details);
      }
      if (error.code === "FORBIDDEN") {
        throw new EmployeeIdentityServiceError(error.code, error.message, 403, error.details);
      }
      if (error.code === "ALREADY_ACTIVATED") {
        throw new EmployeeIdentityServiceError(error.code, error.message, 409, error.details);
      }
    }

    throw new EmployeeIdentityServiceError(
      "INTERNAL_SERVER_ERROR",
      "Falha ao remover colaborador funcional.",
      500,
    );
  }
}
