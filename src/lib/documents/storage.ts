import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export class DocumentStorageError extends Error {
  constructor(
    public readonly code:
      | "DOCUMENT_STORAGE_ROOT_INVALID"
      | "DOCUMENT_STORAGE_WRITE_FAILED"
      | "DOCUMENT_STORAGE_READ_FAILED"
      | "DOCUMENT_STORAGE_NOT_FOUND"
      | "DOCUMENT_STORAGE_DELETE_FAILED",
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DocumentStorageError";
  }
}

function resolveStorageRoot(): string {
  if (process.env.DOCUMENT_STORAGE_ROOT?.trim()) {
    return process.env.DOCUMENT_STORAGE_ROOT.trim();
  }
  if (process.env.VERCEL) {
    return "/tmp/document-storage";
  }
  return path.join(process.cwd(), ".document-storage");
}

function ensureSafeStoragePath(storageKey: string): string {
  const root = path.resolve(resolveStorageRoot());
  const candidate = path.resolve(root, storageKey);

  if (!candidate.startsWith(root + path.sep) && candidate !== root) {
    throw new DocumentStorageError(
      "DOCUMENT_STORAGE_ROOT_INVALID",
      "Chave de armazenamento invalida para raiz privada.",
      { storage_key: storageKey },
    );
  }

  return candidate;
}

function resolveExtension(fileName: string, mimeType: string): string {
  const ext = path.extname(fileName).trim().toLowerCase();
  if (ext) {
    return ext;
  }

  if (mimeType === "application/pdf") {
    return ".pdf";
  }

  if (mimeType === "text/csv") {
    return ".csv";
  }

  if (mimeType === "application/json") {
    return ".json";
  }

  return ".bin";
}

export function buildBatchSourceStorageKey(params: {
  tenantId: string;
  batchId: string;
  fileName: string;
  mimeType: string;
}): string {
  return path.join(
    "tenants",
    params.tenantId,
    "batches",
    params.batchId,
    "source",
    `batch-${randomUUID()}${resolveExtension(params.fileName, params.mimeType)}`,
  );
}

export function buildEmployeeDocumentStorageKey(params: {
  tenantId: string;
  batchId: string;
  documentId: string;
  pageIndex: number;
  fileName: string;
  mimeType: string;
}): string {
  return path.join(
    "tenants",
    params.tenantId,
    "batches",
    params.batchId,
    "documents",
    params.documentId,
    `page-${params.pageIndex}${resolveExtension(params.fileName, params.mimeType)}`,
  );
}

export async function writeDocumentArtifact(params: {
  storageKey: string;
  content: Buffer | Uint8Array;
}): Promise<void> {
  const target = ensureSafeStoragePath(params.storageKey);

  try {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, params.content);
  } catch (error) {
    throw new DocumentStorageError(
      "DOCUMENT_STORAGE_WRITE_FAILED",
      "Falha ao persistir artefato privado do documento.",
      {
        storage_key: params.storageKey,
        cause: error instanceof Error ? error.message : "unknown_error",
      },
    );
  }
}

export async function readDocumentArtifact(storageKey: string): Promise<Buffer> {
  const target = ensureSafeStoragePath(storageKey);

  try {
    return await readFile(target);
  } catch (error) {
    const causeCode = (error as NodeJS.ErrnoException)?.code;
    if (causeCode === "ENOENT") {
      throw new DocumentStorageError(
        "DOCUMENT_STORAGE_NOT_FOUND",
        "Artefato privado nao encontrado no storage interno.",
        { storage_key: storageKey },
      );
    }

    throw new DocumentStorageError(
      "DOCUMENT_STORAGE_READ_FAILED",
      "Falha ao ler artefato privado do documento.",
      {
        storage_key: storageKey,
        cause: error instanceof Error ? error.message : "unknown_error",
      },
    );
  }
}

export async function deleteDocumentArtifact(storageKey: string): Promise<void> {
  const target = ensureSafeStoragePath(storageKey);

  try {
    await rm(target, { force: true });
  } catch (error) {
    throw new DocumentStorageError(
      "DOCUMENT_STORAGE_DELETE_FAILED",
      "Falha ao remover artefato privado do documento.",
      {
        storage_key: storageKey,
        cause: error instanceof Error ? error.message : "unknown_error",
      },
    );
  }
}
