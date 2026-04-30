import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildExceptionQueueMetadata, isValidExceptionStateTransition } from "@/modules/exceptions/domain/exception";
import { recordExceptionAction, updateExceptionState } from "@/modules/exceptions/infrastructure/exception-repository";

const updateSetMock = vi.fn();
const insertValuesMock = vi.fn();
const insertReturningMock = vi.fn();

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: dbMock,
}));

vi.mock("@/lib/db/schema", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/schema")>("@/lib/db/schema");
  return actual;
});

describe("exception handling integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "exc-1", currentState: "pending" }]),
        }),
      }),
    });

    dbMock.update.mockReturnValue({
      set: updateSetMock.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    dbMock.insert.mockReturnValue({
      values: insertValuesMock.mockReturnValue({
        returning: insertReturningMock.mockResolvedValue([{ id: "act-1" }]),
      }),
    });
  });

  it("builds metadata counts deterministically", () => {
    const metadata = buildExceptionQueueMetadata([
      { current_state: "pending" },
      { current_state: "in-treatment" },
      { current_state: "resolved" },
      { current_state: "blocked" },
      { current_state: "pending" },
    ]);

    expect(metadata.total_count).toBe(5);
    expect(metadata.pending_count).toBe(2);
    expect(metadata.in_treatment_count).toBe(1);
    expect(metadata.resolved_count).toBe(1);
    expect(metadata.blocked_count).toBe(1);
  });

  it("validates the exception state machine", () => {
    expect(isValidExceptionStateTransition("pending", "in-treatment")).toBe(true);
    expect(isValidExceptionStateTransition("blocked", "resolved")).toBe(false);
  });

  it("records a corrective action and marks the exception in treatment", async () => {
    const result = await recordExceptionAction({
      tenantId: "11111111-1111-4111-8111-111111111111",
      exceptionId: "exc-1",
      actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actionDescription: "Confirmado com RH o mapeamento correto.",
      expectedResult: "reprocessable",
    });

    expect(result.action_id).toBe("act-1");
    expect(dbMock.insert).toHaveBeenCalled();
    expect(dbMock.update).toHaveBeenCalled();
  });

  it("rejects invalid state transitions at the repository boundary", async () => {
    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "exc-1", currentState: "resolved" }]),
        }),
      }),
    });

    await expect(
      updateExceptionState({
        tenantId: "11111111-1111-4111-8111-111111111111",
        exceptionId: "exc-1",
        nextState: "pending",
        actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATE_TRANSITION", statusCode: 409 });
  });
});