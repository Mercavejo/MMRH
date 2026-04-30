import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { employeeIdentities } from "@/lib/db/schema";
import type { EmployeeIdentityStatus } from "../domain/employee-identity";

type DbLike = typeof db;

export type EmployeeIdentityPersistenceRecord = {
  id: string;
  tenantId: string;
  userId: string | null;
  referenceCode: string;
  employeeName: string;
  admissionDate: string;
  status: EmployeeIdentityStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class EmployeeIdentityRepositoryError extends Error {
  constructor(
    public readonly code:
      | "DUPLICATE_REFERENCE_CODE"
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "ALREADY_ACTIVATED"
      | "INTERNAL_ERROR",
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EmployeeIdentityRepositoryError";
  }
}

function isDuplicateReferenceCodeViolation(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: string; constraint_name?: string; constraint?: string };
  return (
    candidate.code === "23505" &&
    (candidate.constraint_name === "employee_identities_tenant_reference_unique" ||
      candidate.constraint === "employee_identities_tenant_reference_unique")
  );
}

function mapRecord(row: {
  id: string;
  tenantId: string;
  userId: string | null;
  referenceCode: string;
  employeeName: string;
  admissionDate: string;
  status: EmployeeIdentityStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): EmployeeIdentityPersistenceRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    referenceCode: row.referenceCode,
    employeeName: row.employeeName,
    admissionDate: row.admissionDate,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function findByTenantAndReferenceCode(
  tenantId: string,
  referenceCode: string,
  dbClient: DbLike,
): Promise<EmployeeIdentityPersistenceRecord | null> {
  const rows = await dbClient
    .select({
      id: employeeIdentities.id,
      tenantId: employeeIdentities.tenantId,
      userId: employeeIdentities.userId,
      referenceCode: employeeIdentities.referenceCode,
      employeeName: employeeIdentities.employeeName,
      admissionDate: employeeIdentities.admissionDate,
      status: employeeIdentities.status,
      notes: employeeIdentities.notes,
      createdAt: employeeIdentities.createdAt,
      updatedAt: employeeIdentities.updatedAt,
    })
    .from(employeeIdentities)
    .where(
      and(
        eq(employeeIdentities.tenantId, tenantId),
        eq(employeeIdentities.referenceCode, referenceCode),
      ),
    )
    .limit(1);

  return rows[0] ? mapRecord(rows[0]) : null;
}

export async function insertEmployeeIdentity(
  input: {
    tenantId: string;
    referenceCode: string;
    employeeName: string;
    admissionDate: string;
    status: EmployeeIdentityStatus;
    notes: string | null;
  },
  dbClient: DbLike = db,
): Promise<EmployeeIdentityPersistenceRecord> {
  const duplicate = await findByTenantAndReferenceCode(input.tenantId, input.referenceCode, dbClient);
  if (duplicate) {
    throw new EmployeeIdentityRepositoryError(
      "DUPLICATE_REFERENCE_CODE",
      "Codigo de referencia ja cadastrado neste tenant.",
      {
        employee_identity_id: duplicate.id,
        reference_code: input.referenceCode,
      },
    );
  }

  let rows;
  try {
    rows = await dbClient
      .insert(employeeIdentities)
      .values({
        tenantId: input.tenantId,
        referenceCode: input.referenceCode,
        employeeName: input.employeeName,
        admissionDate: input.admissionDate,
        status: input.status,
        notes: input.notes,
        updatedAt: new Date(),
      })
      .returning({
        id: employeeIdentities.id,
        tenantId: employeeIdentities.tenantId,
        userId: employeeIdentities.userId,
        referenceCode: employeeIdentities.referenceCode,
        employeeName: employeeIdentities.employeeName,
        admissionDate: employeeIdentities.admissionDate,
        status: employeeIdentities.status,
        notes: employeeIdentities.notes,
        createdAt: employeeIdentities.createdAt,
        updatedAt: employeeIdentities.updatedAt,
      });
  } catch (error) {
    if (isDuplicateReferenceCodeViolation(error)) {
      throw new EmployeeIdentityRepositoryError(
        "DUPLICATE_REFERENCE_CODE",
        "Codigo de referencia ja cadastrado neste tenant.",
        {
          reference_code: input.referenceCode,
        },
      );
    }

    throw error;
  }

  return mapRecord(rows[0]);
}

export async function listEmployeeIdentityRecords(
  input: {
    tenantId: string;
    status?: EmployeeIdentityStatus;
  },
  dbClient: DbLike = db,
): Promise<EmployeeIdentityPersistenceRecord[]> {
  const conditions = [eq(employeeIdentities.tenantId, input.tenantId)];

  if (input.status) {
    conditions.push(eq(employeeIdentities.status, input.status));
  }

  const rows = await dbClient
    .select({
      id: employeeIdentities.id,
      tenantId: employeeIdentities.tenantId,
      userId: employeeIdentities.userId,
      referenceCode: employeeIdentities.referenceCode,
      employeeName: employeeIdentities.employeeName,
      admissionDate: employeeIdentities.admissionDate,
      status: employeeIdentities.status,
      notes: employeeIdentities.notes,
      createdAt: employeeIdentities.createdAt,
      updatedAt: employeeIdentities.updatedAt,
    })
    .from(employeeIdentities)
    .where(and(...conditions))
    .orderBy(desc(employeeIdentities.updatedAt), desc(employeeIdentities.createdAt));

  return rows.map(mapRecord);
}

export async function updateEmployeeIdentityRecord(
  input: {
    employeeId: string;
    tenantId: string;
    referenceCode: string;
    employeeName: string;
    admissionDate: string;
    status: EmployeeIdentityStatus;
    notes: string | null;
  },
  dbClient: DbLike = db,
): Promise<EmployeeIdentityPersistenceRecord> {
  const existingRows = await dbClient
    .select({
      id: employeeIdentities.id,
      tenantId: employeeIdentities.tenantId,
      userId: employeeIdentities.userId,
      referenceCode: employeeIdentities.referenceCode,
      employeeName: employeeIdentities.employeeName,
      admissionDate: employeeIdentities.admissionDate,
      status: employeeIdentities.status,
      notes: employeeIdentities.notes,
      createdAt: employeeIdentities.createdAt,
      updatedAt: employeeIdentities.updatedAt,
    })
    .from(employeeIdentities)
    .where(eq(employeeIdentities.id, input.employeeId))
    .limit(1);

  const existing = existingRows[0] ? mapRecord(existingRows[0]) : null;
  if (!existing) {
    throw new EmployeeIdentityRepositoryError("NOT_FOUND", "Colaborador funcional nao encontrado.");
  }

  if (existing.tenantId !== input.tenantId) {
    throw new EmployeeIdentityRepositoryError(
      "FORBIDDEN",
      "Acesso negado para colaborador funcional de outro tenant.",
      {
        employee_identity_id: input.employeeId,
        owner_tenant_id: existing.tenantId,
        actor_tenant_id: input.tenantId,
      },
    );
  }

  const duplicate = await findByTenantAndReferenceCode(input.tenantId, input.referenceCode, dbClient);
  if (duplicate && duplicate.id !== input.employeeId) {
    throw new EmployeeIdentityRepositoryError(
      "DUPLICATE_REFERENCE_CODE",
      "Codigo de referencia ja cadastrado neste tenant.",
      {
        employee_identity_id: duplicate.id,
        reference_code: input.referenceCode,
      },
    );
  }

  let rows;
  try {
    rows = await dbClient
      .update(employeeIdentities)
      .set({
        referenceCode: input.referenceCode,
        employeeName: input.employeeName,
        admissionDate: input.admissionDate,
        status: input.status,
        notes: input.notes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(employeeIdentities.id, input.employeeId),
          eq(employeeIdentities.tenantId, input.tenantId),
        ),
      )
      .returning({
        id: employeeIdentities.id,
        tenantId: employeeIdentities.tenantId,
        userId: employeeIdentities.userId,
        referenceCode: employeeIdentities.referenceCode,
        employeeName: employeeIdentities.employeeName,
        admissionDate: employeeIdentities.admissionDate,
        status: employeeIdentities.status,
        notes: employeeIdentities.notes,
        createdAt: employeeIdentities.createdAt,
        updatedAt: employeeIdentities.updatedAt,
      });
  } catch (error) {
    if (isDuplicateReferenceCodeViolation(error)) {
      throw new EmployeeIdentityRepositoryError(
        "DUPLICATE_REFERENCE_CODE",
        "Codigo de referencia ja cadastrado neste tenant.",
        {
          reference_code: input.referenceCode,
        },
      );
    }

    throw error;
  }

  return mapRecord(rows[0]);
}

export async function deleteEmployeeIdentityRecord(
  input: {
    employeeId: string;
    tenantId: string;
  },
  dbClient: DbLike = db,
): Promise<void> {
  const existingRows = await dbClient
    .select({
      id: employeeIdentities.id,
      tenantId: employeeIdentities.tenantId,
      userId: employeeIdentities.userId,
      status: employeeIdentities.status,
    })
    .from(employeeIdentities)
    .where(eq(employeeIdentities.id, input.employeeId))
    .limit(1);

  const existing = existingRows[0];
  if (!existing) {
    throw new EmployeeIdentityRepositoryError("NOT_FOUND", "Colaborador funcional nao encontrado.");
  }

  if (existing.tenantId !== input.tenantId) {
    throw new EmployeeIdentityRepositoryError(
      "FORBIDDEN",
      "Acesso negado para colaborador funcional de outro tenant.",
      {
        employee_identity_id: input.employeeId,
        owner_tenant_id: existing.tenantId,
        actor_tenant_id: input.tenantId,
      },
    );
  }

  if (existing.userId) {
    throw new EmployeeIdentityRepositoryError(
      "ALREADY_ACTIVATED",
      "Colaborador ja ativado nao pode ser removido. Desative o status primeiro.",
      { employee_identity_id: input.employeeId, user_id: existing.userId },
    );
  }

  await dbClient
    .delete(employeeIdentities)
    .where(
      and(
        eq(employeeIdentities.id, input.employeeId),
        eq(employeeIdentities.tenantId, input.tenantId),
      ),
    );
}

export async function findEmployeeIdentityForActivationInDb(
  input: {
    tenantId: string;
    referenceCode: string;
    admissionDate: string;
  },
  dbClient: DbLike = db,
): Promise<EmployeeIdentityPersistenceRecord | null> {
  const rows = await dbClient
    .select({
      id: employeeIdentities.id,
      tenantId: employeeIdentities.tenantId,
      userId: employeeIdentities.userId,
      referenceCode: employeeIdentities.referenceCode,
      employeeName: employeeIdentities.employeeName,
      admissionDate: employeeIdentities.admissionDate,
      status: employeeIdentities.status,
      notes: employeeIdentities.notes,
      createdAt: employeeIdentities.createdAt,
      updatedAt: employeeIdentities.updatedAt,
    })
    .from(employeeIdentities)
    .where(
      and(
        eq(employeeIdentities.tenantId, input.tenantId),
        eq(employeeIdentities.referenceCode, input.referenceCode),
        eq(employeeIdentities.admissionDate, input.admissionDate),
      ),
    )
    .limit(1);

  return rows[0] ? mapRecord(rows[0]) : null;
}
