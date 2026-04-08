import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbInsertMock, dbValuesMock } = vi.hoisted(() => ({
  dbInsertMock: vi.fn(),
  dbValuesMock: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    insert: dbInsertMock.mockReturnValue({
      values: dbValuesMock,
    }),
  },
}));

import { writeDocumentDownloadAudit } from "@/lib/documents/download-audit";

describe("writeDocumentDownloadAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbValuesMock.mockResolvedValue(undefined);
  });

  it("writes success audit event with expected action and resource", async () => {
    await writeDocumentDownloadAudit({
      tenantId: "11111111-1111-4111-8111-111111111111",
      actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "success",
      correlationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      details: {
        document_type: "holerite",
      },
    });

    expect(dbInsertMock).toHaveBeenCalledOnce();
    expect(dbValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "employee.document.download.v1",
        resourceType: "employee_document",
        resourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        status: "success",
      }),
    );
  });

  it("normalizes invalid correlation id to valid uuid", async () => {
    await writeDocumentDownloadAudit({
      tenantId: "11111111-1111-4111-8111-111111111111",
      actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "failure",
      correlationId: "invalid-correlation",
    });

    const payload = dbValuesMock.mock.calls[0]?.[0] as { correlationId: string };
    expect(payload.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
