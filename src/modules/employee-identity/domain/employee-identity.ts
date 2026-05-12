export const EMPLOYEE_IDENTITY_STATUS_VALUES = [
  "pending_activation",
  "active",
  "blocked",
  "inactive",
] as const;

export const admissionDateInputPattern = /^(?:\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2})$/;

export type EmployeeIdentityStatus = (typeof EMPLOYEE_IDENTITY_STATUS_VALUES)[number];

export type EmployeeIdentityInput = {
  tenantId: string;
  referenceCode: string;
  employeeName: string;
  admissionDate: string;
  status?: string;
  notes?: string | null;
};

export type EmployeeIdentityRecord = {
  id: string;
  tenantId: string;
  referenceCode: string;
  employeeName: string;
  admissionDate: string;
  status: EmployeeIdentityStatus;
  userId: string | null;
  notes?: string | null;
};

export class EmployeeIdentityDomainError extends Error {
  constructor(
    public readonly code:
      | "INVALID_REFERENCE_CODE"
      | "INVALID_EMPLOYEE_NAME"
      | "INVALID_ADMISSION_DATE"
      | "INVALID_STATUS"
      | "ACTIVATION_NOT_ALLOWED",
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EmployeeIdentityDomainError";
  }
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isValidIsoDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function toIsoAdmissionDate(value: string): string | null {
  const normalized = collapseWhitespace(value);

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const numericYear = Number(year);
    const numericMonth = Number(month);
    const numericDay = Number(day);

    return isValidIsoDateParts(numericYear, numericMonth, numericDay)
      ? `${year}-${month}-${day}`
      : null;
  }

  const brMatch = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!brMatch) {
    return null;
  }

  const [, day, month, year] = brMatch;
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);

  return isValidIsoDateParts(numericYear, numericMonth, numericDay)
    ? `${year}-${month}-${day}`
    : null;
}

export function normalizeEmployeeIdentityStatus(value?: string): EmployeeIdentityStatus {
  const normalized = value?.trim() ?? "pending_activation";

  if (
    normalized === "pending_activation" ||
    normalized === "active" ||
    normalized === "blocked" ||
    normalized === "inactive"
  ) {
    return normalized;
  }

  throw new EmployeeIdentityDomainError("INVALID_STATUS", "Status funcional invalido.", {
    status: value,
  });
}

export function normalizeReferenceCode(value: string): string {
  const normalized = collapseWhitespace(value).toUpperCase();
  if (!normalized) {
    throw new EmployeeIdentityDomainError(
      "INVALID_REFERENCE_CODE",
      "Codigo de referencia obrigatorio.",
    );
  }

  return normalized;
}

export function normalizeEmployeeName(value: string): string {
  const normalized = collapseWhitespace(value);
  if (!normalized) {
    throw new EmployeeIdentityDomainError("INVALID_EMPLOYEE_NAME", "Nome do colaborador obrigatorio.");
  }

  return normalized;
}

export function normalizeAdmissionDate(value: string): string {
  const isoDate = toIsoAdmissionDate(value);
  if (!isoDate) {
    throw new EmployeeIdentityDomainError(
      "INVALID_ADMISSION_DATE",
      "Verificador secundario invalido.",
      { admission_date: value },
    );
  }

  return isoDate;
}

export function formatAdmissionDate(value: string): string {
  const normalized = normalizeAdmissionDate(value);
  const [year, month, day] = normalized.split("-");
  return `${day}-${month}-${year}`;
}

export function normalizeEmployeeIdentityInput(input: EmployeeIdentityInput) {
  return {
    tenantId: input.tenantId,
    referenceCode: normalizeReferenceCode(input.referenceCode),
    employeeName: normalizeEmployeeName(input.employeeName),
    admissionDate: normalizeAdmissionDate(input.admissionDate),
    status: normalizeEmployeeIdentityStatus(input.status),
    notes: input.notes ? collapseWhitespace(input.notes) : null,
  };
}

export function buildEmployeeIdentityStatusLabel(status: EmployeeIdentityStatus): string {
  switch (status) {
    case "active":
      return "Ativo";
    case "blocked":
      return "Bloqueado";
    case "inactive":
      return "Inativo";
    default:
      return "Pendente de ativacao";
  }
}

export function buildEmployeeIdentityActivationDescriptor(record: EmployeeIdentityRecord) {
  const status = normalizeEmployeeIdentityStatus(record.status);
  const referenceCode = normalizeReferenceCode(record.referenceCode);
  const admissionDate = normalizeAdmissionDate(record.admissionDate);

  if (status !== "pending_activation" || record.userId) {
    throw new EmployeeIdentityDomainError(
      "ACTIVATION_NOT_ALLOWED",
      "Identidade funcional indisponivel para ativacao segura.",
      {
        employee_identity_id: record.id,
        status,
        user_id: record.userId,
      },
    );
  }

  return {
    employee_identity_id: record.id,
    tenant_id: record.tenantId,
    reference_code: referenceCode,
    employee_name: normalizeEmployeeName(record.employeeName),
    activation_status: status,
    can_self_activate: true,
    secondary_verifier: {
      admission_date: formatAdmissionDate(admissionDate),
    },
  };
}
