import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { handleEmployeeDocumentDownload } from "@/lib/documents/employee-download-handler";
import { getDownloadableDocument } from "@/lib/documents/get-downloadable-document";
import { listEmployeeDocuments } from "@/lib/documents/list-documents";
import { publishEmployeeDocumentsForBatch } from "@/lib/documents/publish-employee-documents";
import { persistValidatedBatchImport } from "@/lib/rh/batches/import-batch";
import { readDocumentArtifact } from "@/lib/documents/storage";

const extractPagesMock = vi.fn(async ([pageInfo]: Array<{ includePages?: number[] }>) =>
  Buffer.from(`%PDF-flow-page-${(pageInfo.includePages?.[0] ?? 0) + 1}%`),
);

vi.mock("unpdf", () => ({
  getDocumentProxy: vi.fn(async () => ({
    numPages: 2,
    extractPages: extractPagesMock,
  })),
}));

describe("employee publication download flow", () => {
  let tempRoot: string;
  const documentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "adalto-flow-"));
    process.env.DOCUMENT_STORAGE_ROOT = tempRoot;
    process.env.DOWNLOAD_SIGNING_SECRET = "test-download-secret";
    extractPagesMock.mockClear();
  });

  afterEach(async () => {
    delete process.env.DOCUMENT_STORAGE_ROOT;
    delete process.env.DOWNLOAD_SIGNING_SECRET;
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("covers upload to list to signed real download without placeholder fallback", async () => {
    const insertedBatches: Array<Record<string, unknown>> = [];
    const insertedDocuments: Array<Record<string, unknown>> = [];

    const importDbClient = {
      transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) =>
        callback({
          insert: vi.fn().mockImplementation((table: unknown) => ({
            values: vi.fn(async (value: Record<string, unknown>) => {
              if (String(table).includes("audit_logs")) {
                return;
              }
              insertedBatches.push(value);
            }),
          })),
        }),
      ),
      insert: vi.fn(),
    } as never;

    const persisted = await persistValidatedBatchImport(
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        uploadedBy: "gestor-1",
        correlationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        sourceFileBuffer: Buffer.from("%PDF-multipage-source%"),
        validation: {
          is_valid: true,
          validation_status: "validated",
          original_filename: "lote-playtest.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 24,
          rows: [
            {
              employee_identifier: "REF-001",
              codigo_colaborador: "REF-001",
              document_type: "holerite",
              period_ref: "2026-03",
              page_index: 1,
            },
          ],
          summary: {
            source_format: "pdf",
            total_rows: 1,
            valid_rows: 1,
            invalid_rows: 0,
            critical_issue_count: 0,
            warning_issue_count: 0,
            issues: [],
          },
        },
      },
      importDbClient,
    );

    const batchRecord = insertedBatches[0];

    const publicationDbClient = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: "identity-1",
              referenceCode: "REF-001",
              status: "active",
              userId: "user-1",
            },
          ]),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn(async (values: Array<Record<string, unknown>>) => {
          insertedDocuments.push(...values.map((value) => ({
            id: documentId,
            createdAt: new Date("2026-04-30T12:00:00.000Z"),
            ...value,
          })));
        }),
      }),
    } as never;

    await publishEmployeeDocumentsForBatch(
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        batchId: persisted.batchId,
        sourceStorageKey: batchRecord.sourceStorageKey as string,
        sourceStorageFilename: batchRecord.sourceStorageFilename as string,
        sourceStorageMimeType: batchRecord.sourceStorageMimeType as string,
        routingManifest: [
          {
            document_id: documentId,
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
      publicationDbClient,
    );

    const listedDocuments = await listEmployeeDocuments(
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        userId: "user-1",
      },
      {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: async () => insertedDocuments,
            }),
          }),
        }),
      } as never,
    );

    expect(listedDocuments).toHaveLength(1);
    expect(listedDocuments[0].document_id).toBe(documentId);

    const downloadable = await getDownloadableDocument(
      {
        documentId,
        tenantId: "11111111-1111-4111-8111-111111111111",
        userId: "user-1",
      },
      {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => insertedDocuments,
            }),
          }),
        }),
      } as never,
    );

    const signedInitRequest = new NextRequest(
      `http://localhost/api/v1/employee/documents/${documentId}/download?response=json`,
      {
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const getDownloadableDocumentFn = vi.fn().mockResolvedValue(downloadable);

    const signedInitResponse = await handleEmployeeDocumentDownload(
      signedInitRequest,
      {
        documentId,
      },
      {
        validateSessionFn: vi.fn().mockResolvedValue({
          userId: "user-1",
          tenantId: "11111111-1111-4111-8111-111111111111",
        }),
        getDownloadableDocumentFn,
        readDocumentArtifactFn: readDocumentArtifact,
        assertTenantActionFn: vi.fn(),
        resolveRoleFn: vi.fn().mockResolvedValue("colaborador"),
        writeDocumentDownloadAuditFn: vi.fn().mockResolvedValue(undefined),
      },
    );

    const initBody = await signedInitResponse.json();
    const signedUrl = new URL(initBody.data.download_url as string);

    const signedRequest = new NextRequest(signedUrl.toString(), {
      headers: {
        cookie: "session_id=token",
      },
    });

    const signedResponse = await handleEmployeeDocumentDownload(
      signedRequest,
      {
        documentId,
      },
      {
        validateSessionFn: vi.fn().mockResolvedValue({
          userId: "user-1",
          tenantId: "11111111-1111-4111-8111-111111111111",
        }),
        getDownloadableDocumentFn,
        readDocumentArtifactFn: readDocumentArtifact,
        assertTenantActionFn: vi.fn(),
        resolveRoleFn: vi.fn().mockResolvedValue("colaborador"),
        writeDocumentDownloadAuditFn: vi.fn().mockResolvedValue(undefined),
      },
    );

    const downloadedBytes = Buffer.from(await signedResponse.arrayBuffer()).toString();

    expect(signedResponse.status).toBe(200);
    expect(getDownloadableDocumentFn).toHaveBeenCalledTimes(2);
    expect(getDownloadableDocumentFn).toHaveBeenNthCalledWith(1, {
      documentId,
      tenantId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
    });
    expect(getDownloadableDocumentFn).toHaveBeenNthCalledWith(2, {
      documentId,
      tenantId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
    });
    expect(downloadedBytes).toContain("%PDF-flow-page-1%");
    expect(downloadedBytes).not.toContain("Download placeholder");
    expect(downloadedBytes).not.toContain("storage_key=");
  });
});
