import { describe, expect, it, vi } from "vitest";
import { auditLogs, tenants } from "@/lib/db/schema";
import { writePlaytestEvent } from "@/lib/observability/playtest-audit";

describe("playtest audit", () => {
  it("persists anonymous events through a reserved tenant", async () => {
    const insertedTenants: unknown[] = [];
    const insertedAuditLogs: unknown[] = [];
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);

    const db = {
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((value: unknown) => {
          if (table === tenants) {
            insertedTenants.push(value);
            return Object.assign(Promise.resolve(undefined), {
              onConflictDoNothing,
            });
          }

          if (table === auditLogs) {
            insertedAuditLogs.push(value);
          }

          return Promise.resolve(undefined);
        }),
      })),
    };

    await writePlaytestEvent(
      {
        tenantId: "anonymous",
        correlationId: "11111111-1111-4111-8111-111111111111",
        action: "playtest.rh.indicators.friction",
        resourceType: "indicators",
        status: "failure",
        details: { cause: "unauthorized" },
      },
      db,
    );

    expect(insertedTenants).toEqual([
      expect.objectContaining({
        id: "00000000-0000-4000-8000-000000000001",
        slug: "playtest-anonymous",
      }),
    ]);
    expect(onConflictDoNothing).toHaveBeenCalledWith({ target: tenants.id });
    expect(insertedAuditLogs).toEqual([
      expect.objectContaining({
        tenantId: "00000000-0000-4000-8000-000000000001",
        details: {
          cause: "unauthorized",
          originalTenantId: "anonymous",
        },
      }),
    ]);
  });
});
