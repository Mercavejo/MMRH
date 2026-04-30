import { beforeEach, describe, expect, it, vi } from "vitest";

const { insertMock, selectMock, whereMock, returningMock, onConflictDoUpdateMock, valuesMock } = vi.hoisted(() => {

  const selectFn = vi.fn();
  const whereFn = vi.fn();
  const insertFn = vi.fn();
  const valuesFn = vi.fn();
  const onConflictDoUpdateFn = vi.fn();
  const returningFn = vi.fn();
  
  insertFn.mockReturnValue({ values: valuesFn });
  valuesFn.mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateFn });
  onConflictDoUpdateFn.mockReturnValue({ returning: returningFn });
  
  selectFn.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });

  return {
    insertMock: insertFn,
    selectMock: selectFn,
    whereMock: whereFn,
    onConflictDoUpdateMock: onConflictDoUpdateFn,
    returningMock: returningFn,
    valuesMock: valuesFn,
  };
});


vi.mock("@/lib/db/client", () => ({
  db: {
    insert: insertMock,
    select: selectMock,
  },
}));

import { Capability } from "@/modules/plans/domain/capabilities";
import { logCapabilityUsage } from "@/modules/plans/application/log-capability-usage";
import { getCapabilityTelemetry } from "@/modules/plans/application/get-capability-telemetry";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";

describe("plans-telemetry — application: logCapabilityUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts or updates capability usage for the current period and plan", async () => {
    returningMock.mockResolvedValueOnce([{ id: "uuid", usageCount: 1 }]);
    
    await logCapabilityUsage(SESSION_TENANT_ID, Capability.EXTERNAL_INTEGRATIONS, 1, "enterprise");

    expect(insertMock).toHaveBeenCalled();
    expect(onConflictDoUpdateMock).toHaveBeenCalled();
    expect(valuesMock.mock.calls[0][0].planCode).toBe("enterprise");
    expect(returningMock).toHaveBeenCalled();
  });

  it("isolates usage between different plans in the same period", async () => {
    returningMock.mockResolvedValue([{ id: "uuid", usageCount: 1 }]);
    
    await logCapabilityUsage(SESSION_TENANT_ID, Capability.BATCH_INGESTION, 1, "professional");
    await logCapabilityUsage(SESSION_TENANT_ID, Capability.BATCH_INGESTION, 1, "enterprise");

    expect(valuesMock).toHaveBeenCalledTimes(2);
    expect(valuesMock.mock.calls[1][0].planCode).toBe("enterprise");

  });


});

describe("plans-telemetry — application: getCapabilityTelemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns telemetry grouped by capability for a tenant", async () => {
    whereMock.mockResolvedValueOnce([
      { capability: Capability.BATCH_INGESTION, period: "2026-04", usageCount: 10 },
      { capability: Capability.PORTAL_EMPLOYEE_ACCESS, period: "2026-04", usageCount: 150 },
    ]);

    const result = await getCapabilityTelemetry({ tenantId: SESSION_TENANT_ID, period: "2026-04" });
    expect(whereMock).toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0].usageCount).toBe(10);
  });

  it("requires tenant scope for telemetry", async () => {
    whereMock.mockResolvedValueOnce([
      { capability: Capability.BATCH_INGESTION, period: "2026-04", usageCount: 100 },
    ]);

    const result = await getCapabilityTelemetry({ tenantId: SESSION_TENANT_ID, period: "2026-04" });
    expect(whereMock).toHaveBeenCalled();
    expect(result[0].usageCount).toBe(100);
  });
});
