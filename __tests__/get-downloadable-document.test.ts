import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DownloadEligibilityError,
  getDownloadableDocument,
} from "@/lib/documents/get-downloadable-document";

function makeDbClient(rows: unknown[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => rows,
        }),
      }),
    }),
  };
}

describe("getDownloadableDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns downloadable metadata for published document in scope", async () => {
    const dbClient = makeDbClient([
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        tenantId: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
        documentType: "holerite",
        periodRef: "2026-03",
        status: "published",
      },
    ]);

    const result = await getDownloadableDocument({
      documentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
    }, dbClient as never);

    expect(result).toEqual({
      document_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      document_type: "holerite",
      period_ref: "2026-03",
      mime_type: "application/pdf",
      file_name: "holerite-2026-03.pdf",
      storage_key:
        "documents/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf",
    });
  });

  it.each(["pending", "processing", "unavailable", "error"]) (
    "throws deterministic error when status is %s",
    async (status) => {
      const dbClient = makeDbClient([
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          tenantId: "11111111-1111-4111-8111-111111111111",
          userId: "22222222-2222-4222-8222-222222222222",
          documentType: "holerite",
          periodRef: "2026-03",
          status,
        },
      ]);

      await expect(
        getDownloadableDocument({
          documentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          tenantId: "11111111-1111-4111-8111-111111111111",
          userId: "22222222-2222-4222-8222-222222222222",
        }, dbClient as never),
      ).rejects.toMatchObject<Partial<DownloadEligibilityError>>({
        code: "DOCUMENT_NOT_DOWNLOADABLE",
      });
    },
  );

  it("throws not found when document is outside scope", async () => {
    const dbClient = makeDbClient([]);

    await expect(
      getDownloadableDocument({
        documentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        tenantId: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
      }, dbClient as never),
    ).rejects.toMatchObject<Partial<DownloadEligibilityError>>({
      code: "DOCUMENT_NOT_FOUND",
    });
  });
});
