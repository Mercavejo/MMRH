import {
  buildEmployeeIdentityStatusLabel,
  normalizeEmployeeIdentityStatus,
} from "../domain/employee-identity";
import type { EmployeeIdentityListItem } from "./types";
import { listEmployeeIdentityRecords } from "../infrastructure/employee-identities-repository";

export async function listEmployeeIdentities(input: {
  tenantId: string;
  filters: {
    status?: string;
  };
}): Promise<{ items: EmployeeIdentityListItem[]; total: number }> {
  const status = input.filters.status
    ? normalizeEmployeeIdentityStatus(input.filters.status)
    : undefined;

  const rows = await listEmployeeIdentityRecords({
    tenantId: input.tenantId,
    status,
  });

  const items = rows.map((row) => ({
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
  }));

  return {
    items,
    total: items.length,
  };
}
