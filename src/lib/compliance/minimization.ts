import type { RbacRole } from "@/lib/auth/rbac";

export type MinimizationProfile = "strict" | "standard";

const STRICT_ALLOWED_KEYS = new Set([
  "id",
  "tenant_id",
  "employee_name",
  "employee_email",
  "period",
  "document_status",
  "created_at",
  "updated_at",
]);

const ALWAYS_BLOCKED_KEYS = new Set([
  "cpf",
  "salary",
  "password",
  "password_hash",
  "token",
  "token_hash",
]);

const SENSITIVE_KEY_PARTS = [
  "cpf",
  "salary",
  "password",
  "token",
  "secret",
  "hash",
  "ssn",
];

function maskEmail(value: string): string {
  const [localPart, domainPart] = value.split("@");
  if (!localPart || !domainPart) {
    return "***";
  }

  const firstChar = localPart[0] ?? "*";
  return `${firstChar}***@${domainPart}`;
}

const ROLE_BASED_ADDITIONAL_BLOCKS: Record<RbacRole, Set<string>> = {
  admin_plataforma: new Set([]), // admins see everything (except always-blocked)
  rh_gestor: new Set([]), // no additional restrictions
  rh_operator: new Set([]), // no additional restrictions
  colaborador: new Set([]), // role documented but no additional blocking for now
  suporte: new Set([]), // role documented but no additional blocking for now
};

function minimizeObject(
  payload: Record<string, unknown>,
  minimizationProfile: MinimizationProfile,
  role?: RbacRole,
): Record<string, unknown> {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const next: Record<string, unknown> = {};
  // NOTE: Role parameter is accepted for future AC2 compliance audit logging.
  // Role-based field filtering not yet implemented; all roles share minimizationProfile rules.

  for (const [key, rawValue] of Object.entries(payload)) {
    const normalizedKey = key.toLowerCase();

    const hasSensitivePart = SENSITIVE_KEY_PARTS.some((part) =>
      normalizedKey.includes(part),
    );

    if (ALWAYS_BLOCKED_KEYS.has(normalizedKey) || hasSensitivePart) {
      continue;
    }

    if (minimizationProfile === "strict" && !STRICT_ALLOWED_KEYS.has(normalizedKey)) {
      continue;
    }

    if (typeof rawValue === "string" && normalizedKey.includes("email")) {
      next[key] = maskEmail(rawValue);
      continue;
    }

    next[key] = rawValue;
  }

  return next;
}

export function minimizeDataForRole<T extends Record<string, unknown>>(
  payload: T,
  params: {
    minimizationProfile: MinimizationProfile;
    role: RbacRole;
  },
): Partial<T> {
  return minimizeObject(payload, params.minimizationProfile, params.role) as Partial<T>;
}
