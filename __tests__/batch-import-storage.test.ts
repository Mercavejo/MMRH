import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { persistValidatedBatchImport } from "@/lib/rh/batches/import-batch";

describe("persistValidatedBatchImport", () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "adalto-import-"));
    process.env.DOCUMENT_STORAGE_ROOT = tempRoot;
  });

  afterEach(async () => {
    delete process.env.DOCUMENT_STORAGE_ROOT;
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("persists private source artifact metadata together with batch record", async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const transactionMock = vi.fn(async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        insert: vi.fn().mockReturnValue({
          values: valuesMock,
        }),
      }),
    );
    const dbClient = {
      transaction: transactionMock,
      insert: vi.fn(),
    } as never;

    const sourceFileBuffer = Buffer.from("%PDF-source-batch%");
    const result = await persistValidatedBatchImport(
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        uploadedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        correlationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        sourceFileBuffer,
        validation: {
          is_valid: true,
          validation_status: "validated",
          original_filename: "lote-real.pdf",
          mime_type: "application/pdf",
          file_size_bytes: sourceFileBuffer.byteLength,
          rows: [
            {
              employee_identifier: "123",
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
      dbClient,
    );

    expect(result.batchId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const batchInsert = valuesMock.mock.calls[0][0];
    expect(batchInsert.sourceStorageKey).toContain(
      path.join("tenants", "11111111-1111-4111-8111-111111111111", "batches"),
    );
    expect(batchInsert.sourceStorageFilename).toBe("lote-real.pdf");
    expect(batchInsert.sourceStorageMimeType).toBe("application/pdf");

    const storedBuffer = await readFile(path.join(tempRoot, batchInsert.sourceStorageKey));
    expect(storedBuffer.equals(sourceFileBuffer)).toBe(true);
  });

  it("removes private source artifact when batch transaction fails", async () => {
    const dbClient = {
      transaction: vi.fn(async () => {
        throw new Error("db unavailable");
      }),
    } as never;

    await expect(
      persistValidatedBatchImport(
        {
          tenantId: "11111111-1111-4111-8111-111111111111",
          uploadedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          correlationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          sourceFileBuffer: Buffer.from("%PDF-source-batch%"),
          validation: {
            is_valid: true,
            validation_status: "validated",
            original_filename: "lote-real.pdf",
            mime_type: "application/pdf",
            file_size_bytes: 17,
            rows: [],
            summary: {
              source_format: "pdf",
              total_rows: 0,
              valid_rows: 0,
              invalid_rows: 0,
              critical_issue_count: 0,
              warning_issue_count: 0,
              issues: [],
            },
          },
        },
        dbClient,
      ),
    ).rejects.toThrow("db unavailable");

    const tenantFolder = path.join(
      tempRoot,
      "tenants",
      "11111111-1111-4111-8111-111111111111",
      "batches",
    );
    await expect(readFile(tenantFolder)).rejects.toBeDefined();
  });
});
