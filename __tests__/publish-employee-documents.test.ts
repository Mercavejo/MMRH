import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EmployeeDocumentPublicationError,
  publishEmployeeDocumentsForBatch,
} from "@/lib/documents/publish-employee-documents";
import { writeDocumentArtifact } from "@/lib/documents/storage";

const extractPagesMock = vi.fn(async ([pageInfo]: Array<{ includePages?: number[] }>) =>
  Buffer.from(`%PDF-page-${(pageInfo.includePages?.[0] ?? 0) + 1}%`),
);

vi.mock("unpdf", () => ({
  getDocumentProxy: vi.fn(async () => ({
    numPages: 4,
    extractPages: extractPagesMock,
  })),
}));

describe("publish employee documents", () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "adalto-publish-"));
    process.env.DOCUMENT_STORAGE_ROOT = tempRoot;
    extractPagesMock.mockClear();
  });

  afterEach(async () => {
    delete process.env.DOCUMENT_STORAGE_ROOT;
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("resolves reference codes to active linked collaborators before insert", async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const sourceStorageKey = path.join(
      "tenants",
      "11111111-1111-4111-8111-111111111111",
      "batches",
      "batch-1",
      "source",
      "source.pdf",
    );

    await writeDocumentArtifact({
      storageKey: sourceStorageKey,
      content: Buffer.from("%PDF-source%"),
    });

    const dbClient = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: "emp-1",
              referenceCode: "REF-001",
              status: "active",
              userId: "user-1",
            },
          ]),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: valuesMock,
      }),
    } as never;

    const result = await publishEmployeeDocumentsForBatch(
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        batchId: "batch-1",
        sourceStorageKey,
        sourceStorageFilename: "lote-real.pdf",
        sourceStorageMimeType: "application/pdf",
        routingManifest: [
          {
            document_id: "doc-1",
            employee_identifier: "REF-001",
            codigo_colaborador: "REF-001",
            nome_normalizado: null,
            match_strategy: "codigo_colaborador",
            document_type: "holerite",
            period_ref: "2026-03",
            page_index: 1,
          },
        ],
      },
      dbClient,
    );

    expect(result.publishedCount).toBe(1);
    expect(valuesMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "user-1",
          documentType: "holerite",
          periodRef: "2026-03",
          fileName: "holerite-2026-03.pdf",
          mimeType: "application/pdf",
          sourcePageIndex: 1,
        }),
      ]),
    );

    const insertedDocument = valuesMock.mock.calls[0][0][0];
    const artifactBytes = await readFile(path.join(tempRoot, insertedDocument.storageKey));
    expect(artifactBytes.toString()).toContain("%PDF-page-1%");
  });

  it("fails when batch item has no active linked collaborator target", async () => {
    const sourceStorageKey = path.join(
      "tenants",
      "11111111-1111-4111-8111-111111111111",
      "batches",
      "batch-1",
      "source",
      "source.pdf",
    );

    await writeDocumentArtifact({
      storageKey: sourceStorageKey,
      content: Buffer.from("%PDF-source%"),
    });

    const dbClient = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      insert: vi.fn(),
    } as never;

    await expect(
      publishEmployeeDocumentsForBatch(
        {
          tenantId: "11111111-1111-4111-8111-111111111111",
          batchId: "batch-1",
          sourceStorageKey,
          sourceStorageFilename: "lote-real.pdf",
          sourceStorageMimeType: "application/pdf",
          routingManifest: [
            {
              document_id: "doc-1",
              employee_identifier: "REF-001",
              codigo_colaborador: "REF-001",
              nome_normalizado: null,
              match_strategy: "codigo_colaborador",
              document_type: "holerite",
              period_ref: "2026-03",
              page_index: 1,
            },
          ],
        },
        dbClient,
      ),
    ).rejects.toMatchObject<EmployeeDocumentPublicationError>({
      code: "PUBLICATION_TARGET_NOT_FOUND",
    });
  });

  it("blocks publication when routed item has no resolvable page index", async () => {
    const sourceStorageKey = path.join(
      "tenants",
      "11111111-1111-4111-8111-111111111111",
      "batches",
      "batch-1",
      "source",
      "source.pdf",
    );

    await writeDocumentArtifact({
      storageKey: sourceStorageKey,
      content: Buffer.from("%PDF-source%"),
    });

    const dbClient = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: "emp-1",
              referenceCode: "REF-001",
              status: "active",
              userId: "user-1",
            },
          ]),
        }),
      }),
      insert: vi.fn(),
    } as never;

    await expect(
      publishEmployeeDocumentsForBatch(
        {
          tenantId: "11111111-1111-4111-8111-111111111111",
          batchId: "batch-1",
          sourceStorageKey,
          sourceStorageFilename: "lote-real.pdf",
          sourceStorageMimeType: "application/pdf",
          routingManifest: [
            {
              document_id: "doc-1",
              employee_identifier: "REF-001",
              codigo_colaborador: "REF-001",
              nome_normalizado: null,
              match_strategy: "codigo_colaborador",
              document_type: "holerite",
              period_ref: "2026-03",
            },
          ],
        },
        dbClient,
      ),
    ).rejects.toMatchObject<EmployeeDocumentPublicationError>({
      code: "PUBLICATION_ARTIFACT_PAGE_INVALID",
    });
  });
});
