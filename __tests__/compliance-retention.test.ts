import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeTenantRetention } from "@/lib/compliance/retention";

const insertMock = vi.fn();
const deleteMock = vi.fn();
const whereMock = vi.fn();
const fromMock = vi.fn();
const selectMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    select: selectMock,
    delete: deleteMock,
    insert: insertMock,
    transaction: transactionMock,
  },
}));

describe("compliance retention", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    transactionMock.mockImplementation(async (handler) =>
      handler({
        select: selectMock,
        delete: deleteMock,
        insert: insertMock,
      }),
    );

    selectMock.mockReturnValue({
      from: fromMock,
    });

    fromMock.mockReturnValue({
      where: whereMock,
    });

    whereMock.mockResolvedValue([{ count: 2 }]);

    deleteMock.mockReturnValue({
      where: vi.fn().mockResolvedValue([{ id: "deleted" }]),
    });

    insertMock.mockReturnValue({
      values: vi.fn().mockResolvedValue([{ id: "ok" }]),
    });
  });

  it("returns only counts when dry-run is enabled", async () => {
    const result = await executeTenantRetention({
      tenantId: "tenant-1",
      correlationId: "11111111-1111-4111-8111-111111111111",
      actorId: "user-1",
      legalBasis: "legitimate_interest",
      retentionDaysDocuments: 90,
      retentionDaysAuditLogs: 365,
      dryRun: true,
    });

    expect(result.documentsAffected).toBe(0);
    expect(result.auditLogsAffected).toBe(2);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("writes compliance evidence and audit when executing retention", async () => {
    const result = await executeTenantRetention({
      tenantId: "tenant-1",
      correlationId: "11111111-1111-4111-8111-111111111111",
      actorId: "user-1",
      legalBasis: "legal_obligation",
      retentionDaysDocuments: 120,
      retentionDaysAuditLogs: 400,
      dryRun: false,
    });

    expect(result.executed).toBe(true);
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalled();
  });

  it("rejects invalid retention days", async () => {
    await expect(
      executeTenantRetention({
        tenantId: "tenant-1",
        correlationId: "11111111-1111-4111-8111-111111111111",
        actorId: "user-1",
        legalBasis: "legal_obligation",
        retentionDaysDocuments: 0,
        retentionDaysAuditLogs: 400,
        dryRun: true,
      }),
    ).rejects.toThrow(/retentionDaysDocuments/);
  });
});
