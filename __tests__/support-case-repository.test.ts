import { describe, expect, it } from "vitest";
import { resolveSupportCaseInDb } from "@/modules/support/infrastructure/support-cases-repository";

describe("support case repository", () => {
  it("reuses original resolved_at timestamp on idempotent replay", async () => {
    const createdAt = new Date("2026-04-13T12:34:56.000Z");

    const dbClient = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => [
                {
                  correlationId: "33333333-3333-4333-8333-333333333333",
                  createdAt,
                },
              ],
            }),
          }),
        }),
      }),
      insert: () => ({
        values: async () => undefined,
      }),
    } as never;

    const result = await resolveSupportCaseInDb(
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        caseId: "22222222-2222-4222-8222-222222222222",
        actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        correlationId: "33333333-3333-4333-8333-333333333333",
        causeCode: "ROOT_CAUSE",
        actionApplied: "Acao aplicada",
        resultStatus: "resolved",
      },
      dbClient,
    );

    expect(result.status).toBe("resolved");
    expect(result.resolved_at).toBe("2026-04-13T12:34:56.000Z");
  });
});
