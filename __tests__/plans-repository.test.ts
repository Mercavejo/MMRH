import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditLogs } from "@/lib/db/schema/audit-logs";
import { tenantPlanAssignmentHistory } from "@/lib/db/schema/tenant-plan-assignment-history";
import { tenantPlanAssignments } from "@/lib/db/schema/tenant-plan-assignments";
import { assignTenantPlanInDb } from "@/modules/plans/infrastructure/plans-repository";

const assignmentHistoryInserts: Array<Record<string, unknown>> = [];
const tenantAssignmentInserts: Array<Record<string, unknown>> = [];

function buildQueryResult(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
    orderBy: vi.fn().mockResolvedValue(rows),
  };
}

describe("plans repository", () => {
  beforeEach(() => {
    assignmentHistoryInserts.length = 0;
    tenantAssignmentInserts.length = 0;
  });

  it("writes closure history for the previous assignment when switching plans", async () => {
    const currentRow = {
      assignmentId: "assignment-current",
      tenantId: "tenant-1",
      planId: "plan-base",
      planCode: "base",
      displayName: "Base",
      description: null,
      effectiveFrom: new Date("2026-04-01T00:00:00.000Z"),
      effectiveTo: null,
      changedBy: "actor-1",
      changedAt: new Date("2026-04-01T00:00:00.000Z"),
      correlationId: "corr-1",
      changeReason: null,
    };

    const activeRow = {
      assignmentId: "assignment-next",
      tenantId: "tenant-1",
      planId: "plan-pro",
      planCode: "professional",
      displayName: "Professional",
      description: null,
      effectiveFrom: new Date("2026-04-13T12:00:00.000Z"),
      effectiveTo: null,
      changedBy: "actor-2",
      changedAt: new Date("2026-04-13T12:00:00.000Z"),
      correlationId: "corr-2",
      changeReason: "upgrade",
    };

    const selectResults = [[currentRow], [activeRow]];

    const tx = {
      select: vi.fn(() => buildQueryResult(selectResults.shift() ?? [])),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      })),
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((payload: Record<string, unknown>) => {
          if (table === tenantPlanAssignmentHistory) {
            assignmentHistoryInserts.push(payload);
            return Promise.resolve(undefined);
          }

          if (table === tenantPlanAssignments) {
            tenantAssignmentInserts.push(payload);
            return {
              returning: vi.fn().mockResolvedValue([
                {
                  assignmentId: "assignment-next",
                  tenantId: "tenant-1",
                  planId: "plan-pro",
                  effectiveFrom: new Date("2026-04-13T12:00:00.000Z"),
                  effectiveTo: null,
                  changedBy: "actor-2",
                  changedAt: new Date("2026-04-13T12:00:00.000Z"),
                  correlationId: "corr-2",
                  changeReason: "upgrade",
                },
              ]),
            };
          }

          if (table === auditLogs) {
            return Promise.resolve(undefined);
          }

          return Promise.resolve(undefined);
        }),
      })),
    };

    const dbClient = {
      transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    };

    const result = await assignTenantPlanInDb(
      {
        tenantId: "tenant-1",
        planId: "plan-pro",
        actorId: "actor-2",
        correlationId: "corr-2",
        effectiveFrom: new Date("2026-04-13T12:00:00.000Z"),
        changeReason: "upgrade",
      },
      dbClient as never,
    );

    expect(result.mode).toBe("switch");
    expect(assignmentHistoryInserts).toHaveLength(2);
    expect(assignmentHistoryInserts[0]).toMatchObject({
      assignmentId: "assignment-current",
      tenantId: "tenant-1",
      planId: "plan-base",
      effectiveTo: new Date("2026-04-13T12:00:00.000Z"),
      changedBy: "actor-2",
      correlationId: "corr-2",
    });
    expect(tenantAssignmentInserts).toHaveLength(1);
  });
});