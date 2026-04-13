import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLogs, externalIdentifierMappings } from "@/lib/db/schema";
import type { AuthorizedExternalSource, ExternalIdentifierMappingCandidate } from "../domain/external-ingestion";

type DbLike = typeof db;

export async function listActiveExternalIdentifierMappings(input: {
  tenantId: string;
  sourceSystem: AuthorizedExternalSource;
  externalIdentifier: string;
}, dbClient: DbLike = db): Promise<ExternalIdentifierMappingCandidate[]> {
  const rows = await dbClient
    .select({
      tenantId: externalIdentifierMappings.tenantId,
      sourceSystem: externalIdentifierMappings.sourceSystem,
      externalIdentifier: externalIdentifierMappings.externalIdentifier,
      employeeId: externalIdentifierMappings.employeeId,
      mappingVersion: externalIdentifierMappings.mappingVersion,
      isActive: externalIdentifierMappings.isActive,
    })
    .from(externalIdentifierMappings)
    .where(
      and(
        eq(externalIdentifierMappings.tenantId, input.tenantId),
        eq(externalIdentifierMappings.sourceSystem, input.sourceSystem),
        eq(externalIdentifierMappings.externalIdentifier, input.externalIdentifier),
        eq(externalIdentifierMappings.isActive, true),
      ),
    )
    .orderBy(desc(externalIdentifierMappings.mappingVersion));

  return rows
    .filter((row) => Boolean(row.employeeId))
    .map((row) => ({
      tenant_id: row.tenantId,
      source_system: row.sourceSystem as AuthorizedExternalSource,
      external_identifier: row.externalIdentifier,
      employee_id: row.employeeId as string,
      mapping_version: row.mappingVersion,
      is_active: row.isActive,
    }));
}

export async function upsertExternalIdentifierMappingRuleInDb(input: {
  tenantId: string;
  sourceSystem: AuthorizedExternalSource;
  externalIdentifier: string;
  employeeId: string | null;
  disable: boolean;
  actorId: string;
  correlationId: string;
}, dbClient: DbLike = db): Promise<{
  tenant_id: string;
  source_system: AuthorizedExternalSource;
  external_identifier: string;
  employee_id: string | null;
  mapping_version: number;
  change_type: "create" | "update" | "disable";
  changed_at: string;
}> {
  const runUpsert = async (client: DbLike) => {
    const latestRows = await client
      .select({
        mappingVersion: externalIdentifierMappings.mappingVersion,
        isActive: externalIdentifierMappings.isActive,
        employeeId: externalIdentifierMappings.employeeId,
        changeType: externalIdentifierMappings.changeType,
        createdAt: externalIdentifierMappings.createdAt,
      })
      .from(externalIdentifierMappings)
      .where(
        and(
          eq(externalIdentifierMappings.tenantId, input.tenantId),
          eq(externalIdentifierMappings.sourceSystem, input.sourceSystem),
          eq(externalIdentifierMappings.externalIdentifier, input.externalIdentifier),
        ),
      )
      .orderBy(desc(externalIdentifierMappings.mappingVersion))
      .limit(1);

    const latest = latestRows[0] ?? null;
    const requestedEmployeeId = input.disable ? null : input.employeeId;

    if (latest) {
      const isNoOp = latest.isActive === !input.disable && latest.employeeId === requestedEmployeeId;
      if (isNoOp) {
        return {
          tenant_id: input.tenantId,
          source_system: input.sourceSystem,
          external_identifier: input.externalIdentifier,
          employee_id: requestedEmployeeId,
          mapping_version: latest.mappingVersion,
          change_type: latest.changeType,
          changed_at: latest.createdAt.toISOString(),
        };
      }
    }

    const nextVersion = (latest?.mappingVersion ?? 0) + 1;

    await client
      .update(externalIdentifierMappings)
      .set({ isActive: false })
      .where(
        and(
          eq(externalIdentifierMappings.tenantId, input.tenantId),
          eq(externalIdentifierMappings.sourceSystem, input.sourceSystem),
          eq(externalIdentifierMappings.externalIdentifier, input.externalIdentifier),
          eq(externalIdentifierMappings.isActive, true),
        ),
      );

    const changeType: "create" | "update" | "disable" = input.disable
      ? "disable"
      : nextVersion === 1
        ? "create"
        : "update";

    const now = new Date();
    await client.insert(externalIdentifierMappings).values({
      tenantId: input.tenantId,
      sourceSystem: input.sourceSystem,
      externalIdentifier: input.externalIdentifier,
      employeeId: requestedEmployeeId,
      mappingVersion: nextVersion,
      isActive: !input.disable,
      changeType,
      changedBy: input.actorId,
      correlationId: input.correlationId,
      createdAt: now,
    });

    await client.insert(auditLogs).values({
      tenantId: input.tenantId,
      actorId: input.actorId,
      correlationId: input.correlationId,
      action: "integrations.external_mapping.changed.v1",
      resourceType: "external_identifier_mapping",
      resourceId: `${input.sourceSystem}:${input.externalIdentifier}`,
      status: "success",
      details: {
        source_system: input.sourceSystem,
        external_identifier: input.externalIdentifier,
        employee_id: requestedEmployeeId,
        mapping_version: nextVersion,
        change_type: changeType,
      },
    });

    return {
      tenant_id: input.tenantId,
      source_system: input.sourceSystem,
      external_identifier: input.externalIdentifier,
      employee_id: requestedEmployeeId,
      mapping_version: nextVersion,
      change_type: changeType,
      changed_at: now.toISOString(),
    };
  };

  return dbClient.transaction(async (tx) => runUpsert(tx as DbLike));
}
