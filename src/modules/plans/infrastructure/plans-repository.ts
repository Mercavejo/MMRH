import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema/audit-logs";
import { plans } from "@/lib/db/schema/plans";
import { tenantPlanAssignmentHistory } from "@/lib/db/schema/tenant-plan-assignment-history";
import { tenantPlanAssignments } from "@/lib/db/schema/tenant-plan-assignments";
import type { ActiveTenantPlan, CommercialPlan } from "../domain/plans";

type DbLike = typeof db;

function mapPlanRow(row: {
  id: string;
  planCode: string;
  displayName: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CommercialPlan {
  return {
    id: row.id,
    plan_code: row.planCode,
    display_name: row.displayName,
    description: row.description,
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function mapActiveTenantPlanRow(row: {
  assignmentId: string;
  tenantId: string;
  planId: string;
  planCode: string;
  displayName: string;
  description: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  changedBy: string;
  changedAt: Date;
  correlationId: string;
  changeReason: string | null;
}): ActiveTenantPlan {
  return {
    assignment_id: row.assignmentId,
    tenant_id: row.tenantId,
    plan_id: row.planId,
    plan_code: row.planCode,
    display_name: row.displayName,
    description: row.description,
    effective_from: row.effectiveFrom.toISOString(),
    effective_to: row.effectiveTo ? row.effectiveTo.toISOString() : null,
    changed_by: row.changedBy,
    changed_at: row.changedAt.toISOString(),
    correlation_id: row.correlationId,
    change_reason: row.changeReason,
  };
}

export async function createPlanInDb(input: {
  planCode: string;
  displayName: string;
  description: string | null;
  actorId: string;
  tenantId: string;
  correlationId: string;
}, dbClient: DbLike = db): Promise<CommercialPlan> {
  const now = new Date();
  const existingRows = await dbClient
    .select({
      id: plans.id,
      planCode: plans.planCode,
      displayName: plans.displayName,
      description: plans.description,
      isActive: plans.isActive,
      createdAt: plans.createdAt,
      updatedAt: plans.updatedAt,
    })
    .from(plans)
    .where(eq(plans.planCode, input.planCode))
    .limit(1);

  if (existingRows[0]) {
    return mapPlanRow(existingRows[0]);
  }

  const createdRows = await dbClient
    .insert(plans)
    .values({
      planCode: input.planCode,
      displayName: input.displayName,
      description: input.description,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    })
    .returning({
      id: plans.id,
      planCode: plans.planCode,
      displayName: plans.displayName,
      description: plans.description,
      isActive: plans.isActive,
      createdAt: plans.createdAt,
      updatedAt: plans.updatedAt,
    });

  const created = mapPlanRow(createdRows[0]);

  await dbClient.insert(auditLogs).values({
    tenantId: input.tenantId,
    actorId: input.actorId,
    correlationId: input.correlationId,
    action: "plans.catalog.created.v1",
    resourceType: "plan",
    resourceId: created.id,
    status: "success",
    details: {
      plan_code: created.plan_code,
      display_name: created.display_name,
    },
  });

  return created;
}

export async function listPlansInDb(dbClient: DbLike = db): Promise<CommercialPlan[]> {
  const rows = await dbClient
    .select({
      id: plans.id,
      planCode: plans.planCode,
      displayName: plans.displayName,
      description: plans.description,
      isActive: plans.isActive,
      createdAt: plans.createdAt,
      updatedAt: plans.updatedAt,
    })
    .from(plans)
    .orderBy(asc(plans.planCode));

  return rows.map(mapPlanRow);
}

export async function getPlanByCodeInDb(planCode: string, dbClient: DbLike = db): Promise<CommercialPlan | null> {
  const rows = await dbClient
    .select({
      id: plans.id,
      planCode: plans.planCode,
      displayName: plans.displayName,
      description: plans.description,
      isActive: plans.isActive,
      createdAt: plans.createdAt,
      updatedAt: plans.updatedAt,
    })
    .from(plans)
    .where(eq(plans.planCode, planCode))
    .limit(1);

  const row = rows[0];
  return row ? mapPlanRow(row) : null;
}

export async function getActiveTenantPlanInDb(tenantId: string, dbClient: DbLike = db): Promise<ActiveTenantPlan | null> {
  const rows = await dbClient
    .select({
      assignmentId: tenantPlanAssignments.id,
      tenantId: tenantPlanAssignments.tenantId,
      planId: tenantPlanAssignments.planId,
      planCode: plans.planCode,
      displayName: plans.displayName,
      description: plans.description,
      effectiveFrom: tenantPlanAssignments.effectiveFrom,
      effectiveTo: tenantPlanAssignments.effectiveTo,
      changedBy: tenantPlanAssignments.changedBy,
      changedAt: tenantPlanAssignments.changedAt,
      correlationId: tenantPlanAssignments.correlationId,
      changeReason: tenantPlanAssignments.changeReason,
    })
    .from(tenantPlanAssignments)
    .innerJoin(plans, eq(plans.id, tenantPlanAssignments.planId))
    .where(and(eq(tenantPlanAssignments.tenantId, tenantId), isNull(tenantPlanAssignments.effectiveTo)))
    .limit(1);

  const row = rows[0];
  return row ? mapActiveTenantPlanRow(row) : null;
}

export async function listTenantPlanHistoryInDb(tenantId: string, dbClient: DbLike = db): Promise<ActiveTenantPlan[]> {
  const rows = await dbClient
    .select({
      assignmentId: tenantPlanAssignmentHistory.assignmentId,
      tenantId: tenantPlanAssignmentHistory.tenantId,
      planId: tenantPlanAssignmentHistory.planId,
      planCode: plans.planCode,
      displayName: plans.displayName,
      description: plans.description,
      effectiveFrom: tenantPlanAssignmentHistory.effectiveFrom,
      effectiveTo: tenantPlanAssignmentHistory.effectiveTo,
      changedBy: tenantPlanAssignmentHistory.changedBy,
      changedAt: tenantPlanAssignmentHistory.changedAt,
      correlationId: tenantPlanAssignmentHistory.correlationId,
      changeReason: tenantPlanAssignmentHistory.changeReason,
    })
    .from(tenantPlanAssignmentHistory)
    .innerJoin(plans, eq(plans.id, tenantPlanAssignmentHistory.planId))
    .where(eq(tenantPlanAssignmentHistory.tenantId, tenantId))
    .orderBy(asc(tenantPlanAssignmentHistory.changedAt));

  return rows.map(mapActiveTenantPlanRow);
}

export async function assignTenantPlanInDb(input: {
  tenantId: string;
  planId: string;
  actorId: string;
  correlationId: string;
  effectiveFrom: Date;
  changeReason: string | null;
}, dbClient: DbLike = db): Promise<{ active_plan: ActiveTenantPlan; mode: "create" | "switch" | "noop" }> {
  return dbClient.transaction(async (tx) => {
    const current = await getActiveTenantPlanInDb(input.tenantId, tx as unknown as DbLike);

    if (current && current.plan_id === input.planId) {
      return {
        active_plan: current,
        mode: "noop",
      };
    }

    const now = new Date();

    if (current) {
      await tx.insert(tenantPlanAssignmentHistory).values({
        assignmentId: current.assignment_id,
        tenantId: current.tenant_id,
        planId: current.plan_id,
        effectiveFrom: new Date(current.effective_from),
        effectiveTo: input.effectiveFrom,
        changedBy: input.actorId,
        changedAt: now,
        correlationId: input.correlationId,
        changeReason: current.change_reason,
        createdAt: now,
      });

      await tx
        .update(tenantPlanAssignments)
        .set({
          effectiveTo: input.effectiveFrom,
          updatedAt: now,
        })
        .where(eq(tenantPlanAssignments.id, current.assignment_id));
    }

    const insertedRows = await tx
      .insert(tenantPlanAssignments)
      .values({
        tenantId: input.tenantId,
        planId: input.planId,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: null,
        changedBy: input.actorId,
        changedAt: now,
        correlationId: input.correlationId,
        changeReason: input.changeReason,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        assignmentId: tenantPlanAssignments.id,
        tenantId: tenantPlanAssignments.tenantId,
        planId: tenantPlanAssignments.planId,
        effectiveFrom: tenantPlanAssignments.effectiveFrom,
        effectiveTo: tenantPlanAssignments.effectiveTo,
        changedBy: tenantPlanAssignments.changedBy,
        changedAt: tenantPlanAssignments.changedAt,
        correlationId: tenantPlanAssignments.correlationId,
        changeReason: tenantPlanAssignments.changeReason,
      });

    const inserted = insertedRows[0];

    await tx.insert(tenantPlanAssignmentHistory).values({
      assignmentId: inserted.assignmentId,
      tenantId: inserted.tenantId,
      planId: inserted.planId,
      effectiveFrom: inserted.effectiveFrom,
      effectiveTo: inserted.effectiveTo,
      changedBy: inserted.changedBy,
      changedAt: inserted.changedAt,
      correlationId: inserted.correlationId,
      changeReason: inserted.changeReason,
      createdAt: now,
    });

    await tx.insert(auditLogs).values({
      tenantId: input.tenantId,
      actorId: input.actorId,
      correlationId: input.correlationId,
      action: current ? "plans.tenant.assigned.updated.v1" : "plans.tenant.assigned.created.v1",
      resourceType: "tenant_plan_assignment",
      resourceId: inserted.assignmentId,
      status: "success",
      details: {
        tenant_id: input.tenantId,
        previous_plan_id: current?.plan_id ?? null,
        next_plan_id: input.planId,
        effective_from: input.effectiveFrom.toISOString(),
        change_reason: input.changeReason,
      },
    });

    const active = await getActiveTenantPlanInDb(input.tenantId, tx as unknown as DbLike);
    if (!active) {
      throw new Error("active_plan_not_found_after_assignment");
    }

    return {
      active_plan: active,
      mode: current ? "switch" : "create",
    };
  });
}
