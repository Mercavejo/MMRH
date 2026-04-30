import type { EmployeeIdentityStatus } from "../domain/employee-identity";

export type EmployeeIdentityListItem = {
  employee_id: string;
  tenant_id: string;
  reference_code: string;
  employee_name: string;
  admission_date: string;
  status: EmployeeIdentityStatus;
  status_label: string;
  user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
