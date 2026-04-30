import { describe, expect, it, vi } from "vitest";

const { resolveSupportCaseInDbMock, SupportCaseRepositoryErrorMock } = vi.hoisted(() => ({
  resolveSupportCaseInDbMock: vi.fn(),
  SupportCaseRepositoryErrorMock: class extends Error {
    constructor(
      public readonly code: "NOT_FOUND" | "INVALID_STATE_TRANSITION" | "BATCH_MISMATCH" | "INVALID_IDEMPOTENCY_REPLAY",
      message: string,
      public readonly details?: Record<string, unknown>,
    ) {
      super(message);
      this.name = "SupportCaseRepositoryError";
    }
  },
}));

vi.mock("@/modules/support/infrastructure/support-cases-repository", () => ({
  resolveSupportCaseInDb: resolveSupportCaseInDbMock,
  SupportCaseRepositoryError: SupportCaseRepositoryErrorMock,
}));

import { resolveSupportCase } from "@/modules/support/application/resolve-support-case";
import { SupportCaseError } from "@/modules/support/application/get-support-case";

describe("support case application", () => {
  it("forwards idempotency key to recovery flow", async () => {
    resolveSupportCaseInDbMock.mockResolvedValue({
      case_id: "22222222-2222-4222-8222-222222222222",
      previous_status: "in_treatment",
      status: "resolved",
      resolved_at: "2026-04-13T13:00:00.000Z",
    });

    await resolveSupportCase({
      tenantId: "11111111-1111-4111-8111-111111111111",
      actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      caseId: "22222222-2222-4222-8222-222222222222",
      correlationId: "33333333-3333-4333-8333-333333333333",
      causeCode: "ROOT_CAUSE",
      actionApplied: "Acao aplicada",
      resultStatus: "resolved",
      recovery: {
        batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        idempotencyKey: "idempotency-1",
      },
    });

    expect(resolveSupportCaseInDbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        recovery: expect.objectContaining({
          idempotencyKey: "idempotency-1",
        }),
      }),
    );
  });

  it("maps BATCH_MISMATCH to conflict 409", async () => {
    resolveSupportCaseInDbMock.mockRejectedValue(
      new SupportCaseRepositoryErrorMock("BATCH_MISMATCH", "Batch de recuperacao nao corresponde ao caso."),
    );

    await expect(
      resolveSupportCase({
        tenantId: "11111111-1111-4111-8111-111111111111",
        actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        caseId: "22222222-2222-4222-8222-222222222222",
        correlationId: "33333333-3333-4333-8333-333333333333",
        causeCode: "ROOT_CAUSE",
        actionApplied: "Acao aplicada",
        resultStatus: "resolved",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<SupportCaseError>>({
        code: "CONFLICT",
        statusCode: 409,
      }),
    );
  });
});
