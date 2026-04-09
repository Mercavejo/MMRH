import { describe, expect, it } from "vitest";
import { listEmployeeDocuments } from "@/lib/documents/list-documents";

function createDbMock(rows: unknown[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(rows),
        }),
      }),
    }),
  };
}

describe("listEmployeeDocuments", () => {
  it("keeps strict tenant and user scope", async () => {
    const result = await listEmployeeDocuments(
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
      createDbMock([
        {
          id: "doc-1",
          tenantId: "11111111-1111-4111-8111-111111111111",
          userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          documentType: "holerite",
          periodRef: "2026-03",
          status: "published",
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
        },
        {
          id: "doc-2",
          tenantId: "11111111-1111-4111-8111-111111111111",
          userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          documentType: "holerite",
          periodRef: "2026-03",
          status: "published",
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
        },
      ]),
    );

    expect(result).toHaveLength(1);
    expect(result[0].document_id).toBe("doc-1");
  });

  it("applies optional period and type filters", async () => {
    const result = await listEmployeeDocuments(
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        periodRef: "2026-03",
        documentType: "holerite",
      },
      createDbMock([
        {
          id: "doc-1",
          tenantId: "11111111-1111-4111-8111-111111111111",
          userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          documentType: "holerite",
          periodRef: "2026-03",
          status: "pending",
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
        },
        {
          id: "doc-2",
          tenantId: "11111111-1111-4111-8111-111111111111",
          userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          documentType: "cartao_ponto",
          periodRef: "2026-02",
          status: "pending",
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
        },
      ]),
    );

    expect(result).toHaveLength(1);
    expect(result[0].document_type).toBe("holerite");
    expect(result[0].period_ref).toBe("2026-03");
  });
});