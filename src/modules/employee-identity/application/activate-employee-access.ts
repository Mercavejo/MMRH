import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { employeeIdentities, userTenantMappings, users } from "@/lib/db/schema";
import { maskCpf, normalizeCpf } from "@/lib/validation/cpf";
import {
  EmployeeIdentityDomainError,
  normalizeAdmissionDate,
  normalizeReferenceCode,
} from "../domain/employee-identity";
import { writeEmployeeIdentityAudit } from "./write-employee-identity-audit";

export class EmployeeActivationError extends Error {
  constructor(
    public readonly code:
      | "INVALID_ACTIVATION_CREDENTIALS"
      | "ACTIVATION_UNAVAILABLE"
      | "CPF_ALREADY_IN_USE"
      | "EMAIL_ALREADY_IN_USE"
      | "INTERNAL_ERROR",
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EmployeeActivationError";
  }
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeOptionalEmail(value?: string): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeEmail(value);
  return normalized.length > 0 ? normalized : null;
}

function isCpfUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: string; constraint_name?: string; constraint?: string };
  return (
    candidate.code === "23505" &&
    (candidate.constraint_name === "users_cpf_unique" ||
      candidate.constraint_name === "users_cpf_key" ||
      candidate.constraint === "users_cpf_unique" ||
      candidate.constraint === "users_cpf_key")
  );
}

function isEmailUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: string; constraint_name?: string; constraint?: string };
  return (
    candidate.code === "23505" &&
    (candidate.constraint_name === "users_email_unique" ||
      candidate.constraint_name === "users_email_key" ||
      candidate.constraint === "users_email_unique" ||
      candidate.constraint === "users_email_key")
  );
}

async function auditSafely(input: Parameters<typeof writeEmployeeIdentityAudit>[0]) {
  try {
    await writeEmployeeIdentityAudit(input);
  } catch (error) {
    console.error(`employee activation audit failed for ${input.action}`, error);
  }
}

export async function activateEmployeeAccess(input: {
  tenantId: string;
  referenceCode: string;
  admissionDate: string;
  cpf: string;
  email?: string;
  password: string;
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const tenantId = input.tenantId;
  const referenceCode = normalizeReferenceCode(input.referenceCode);
  const admissionDate = normalizeAdmissionDate(input.admissionDate);
  const cpf = normalizeCpf(input.cpf);
  const email = normalizeOptionalEmail(input.email);

  try {
    const passwordHash = await hashPassword(input.password);

    const activated = await db.transaction(async (transaction) => {
      const matches = await transaction
        .select({
          id: employeeIdentities.id,
          tenantId: employeeIdentities.tenantId,
          referenceCode: employeeIdentities.referenceCode,
          employeeName: employeeIdentities.employeeName,
          admissionDate: employeeIdentities.admissionDate,
          status: employeeIdentities.status,
          userId: employeeIdentities.userId,
        })
        .from(employeeIdentities)
        .where(
          and(
            eq(employeeIdentities.tenantId, tenantId),
            eq(employeeIdentities.referenceCode, referenceCode),
            eq(employeeIdentities.admissionDate, admissionDate),
          ),
        )
        .limit(1);

      const candidate = matches[0];
      if (!candidate) {
        throw new EmployeeActivationError(
          "INVALID_ACTIVATION_CREDENTIALS",
          "Nao foi possivel confirmar seu primeiro acesso com os dados informados.",
          { reference_code: referenceCode },
        );
      }

      if (candidate.status !== "pending_activation" || candidate.userId) {
        throw new EmployeeActivationError(
          "ACTIVATION_UNAVAILABLE",
          "Este cadastro nao esta disponivel para ativacao.",
          {
            employee_identity_id: candidate.id,
            status: candidate.status,
            user_id: candidate.userId,
          },
        );
      }

      let insertedUsers;
      try {
        insertedUsers = await transaction
            .insert(users)
            .values({
              cpf,
              email,
              name: candidate.employeeName,
              passwordHash,
            isActive: true,
            updatedAt: new Date(),
          })
          .returning({
            id: users.id,
            cpf: users.cpf,
            email: users.email,
            name: users.name,
          });
      } catch (error) {
        if (isCpfUniqueViolation(error)) {
          throw new EmployeeActivationError(
            "CPF_ALREADY_IN_USE",
            "Este CPF ja esta em uso. Procure o RH para concluir seu acesso.",
            { cpf_masked: maskCpf(cpf) },
          );
        }

        if (isEmailUniqueViolation(error)) {
          throw new EmployeeActivationError(
            "EMAIL_ALREADY_IN_USE",
            "Este e-mail ja esta em uso. Procure o RH para concluir seu acesso.",
            { email_present: true },
          );
        }

        throw error;
      }

      const createdUser = insertedUsers[0];

      await transaction.insert(userTenantMappings).values({
        userId: createdUser.id,
        tenantId,
        role: "colaborador",
      });

      const updatedIdentities = await transaction
        .update(employeeIdentities)
        .set({
          userId: createdUser.id,
          status: "active",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(employeeIdentities.id, candidate.id),
            eq(employeeIdentities.tenantId, tenantId),
            eq(employeeIdentities.status, "pending_activation"),
          ),
        )
        .returning({
          id: employeeIdentities.id,
        });

      if (!updatedIdentities[0]) {
        throw new EmployeeActivationError(
          "ACTIVATION_UNAVAILABLE",
          "Este cadastro nao esta disponivel para ativacao.",
          {
            employee_identity_id: candidate.id,
          },
        );
      }

      const session = await createSession(
        {
          userId: createdUser.id,
          tenantId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
        transaction,
      );

      return {
        tenant_id: tenantId,
        user_id: createdUser.id,
        cpf: createdUser.cpf,
        email: createdUser.email,
        employee_identity_id: candidate.id,
        employee_name: candidate.employeeName,
        reference_code: candidate.referenceCode,
        role: "colaborador" as const,
        session,
      };
    });

    await auditSafely({
      tenantId,
      actorId: activated.user_id,
      correlationId: input.correlationId,
      action: "employee.activation.completed.v1",
      resourceId: activated.employee_identity_id,
      status: "success",
      details: {
        reference_code: activated.reference_code,
        cpf_masked: maskCpf(activated.cpf),
        email_present: Boolean(activated.email),
      },
    });

    return activated;
  } catch (error) {
    if (error instanceof EmployeeActivationError) {
      await auditSafely({
        tenantId,
        correlationId: input.correlationId,
        action: "employee.activation.rejected.v1",
        resourceId: referenceCode,
        status: "failure",
        details: {
          reason: error.code,
          ...error.details,
        },
      });

      throw error;
    }

    if (error instanceof EmployeeIdentityDomainError) {
      await auditSafely({
        tenantId,
        correlationId: input.correlationId,
        action: "employee.activation.rejected.v1",
        resourceId: referenceCode,
        status: "failure",
        details: {
          reason: error.code,
          ...error.details,
        },
      });

      throw new EmployeeActivationError(
        "INVALID_ACTIVATION_CREDENTIALS",
        "Nao foi possivel confirmar seu primeiro acesso com os dados informados.",
      );
    }

    await auditSafely({
      tenantId,
      correlationId: input.correlationId,
      action: "employee.activation.rejected.v1",
      resourceId: referenceCode,
      status: "failure",
      details: {
        reason: "INTERNAL_ERROR",
      },
    });

    throw new EmployeeActivationError(
      "INTERNAL_ERROR",
      "Falha ao concluir seu primeiro acesso.",
    );
  }
}
