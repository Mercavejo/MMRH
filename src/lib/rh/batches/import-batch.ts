import { randomUUID } from "node:crypto";
import { auditLogs, batches } from "@/lib/db/schema";
import { db } from "@/lib/db/client";
import {
  buildBatchSourceStorageKey,
  deleteDocumentArtifact,
  writeDocumentArtifact,
} from "@/lib/documents/storage";
import type { BatchImportValidationResult } from "./import-validation";
import { buildBatchRoutingManifest } from "./batch-routing";

type DbLike = typeof db;
type InsertOnlyDb = Pick<typeof db, "insert">;

function normalizeUuidOrRandom(value: string): string {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidPattern.test(value) ? value : randomUUID();
}

function resolveOrganizationalUnit(summary: Record<string, unknown>): string | null {
  const raw = summary.organizational_unit;
  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function writeBatchImportAudit(params: {
  tenantId: string;
  actorId: string;
  correlationId: string;
  status: "success" | "failure";
  batchId?: string;
  details: Record<string, unknown>;
}, dbClient: InsertOnlyDb = db): Promise<void> {
  await dbClient.insert(auditLogs).values({
    tenantId: params.tenantId,
    actorId: params.actorId,
    correlationId: normalizeUuidOrRandom(params.correlationId),
    action: "rh.batch.import.validated.v1",
    resourceType: "batch",
    resourceId: params.batchId ?? params.correlationId,
    status: params.status,
    details: params.details,
  });
}

export async function persistValidatedBatchImport(params: {
  tenantId: string;
  uploadedBy: string;
  correlationId: string;
  validation: BatchImportValidationResult;
  sourceFileBuffer: Buffer;
}, dbClient: DbLike = db): Promise<{ batchId: string }> {
  const batchId = randomUUID();
  const routingManifest = buildBatchRoutingManifest({
    batchId,
    rows: params.validation.rows,
  });
  const sourceStorageKey = buildBatchSourceStorageKey({
    tenantId: params.tenantId,
    batchId,
    fileName: params.validation.original_filename,
    mimeType: params.validation.mime_type,
  });

  await writeDocumentArtifact({
    storageKey: sourceStorageKey,
    content: params.sourceFileBuffer,
  });

  try {
    await dbClient.transaction(async (transaction) => {
      await transaction.insert(batches).values({
        id: batchId,
        tenantId: params.tenantId,
        uploadedBy: params.uploadedBy,
        originalFilename: params.validation.original_filename,
        fileSizeBytes: params.validation.file_size_bytes,
        mimeType: params.validation.mime_type,
        sourceStorageKey,
        sourceStorageFilename: params.validation.original_filename,
        sourceStorageMimeType: params.validation.mime_type,
        sourceFormat: params.validation.summary.source_format,
        organizationalUnit: resolveOrganizationalUnit(
          params.validation.summary as unknown as Record<string, unknown>,
        ),
        validationStatus: params.validation.validation_status,
        validationSummary: params.validation.summary,
        routingStatus: "pending",
        routingManifest,
        routingTotalCount: routingManifest.length,
        routingMatchedCount: 0,
        routingPendingCount: routingManifest.length,
        routingFailedCount: 0,
        routingAmbiguousCount: 0,
        routingBlockedReason: null,
        routingProcessedAt: null,
        correlationId: normalizeUuidOrRandom(params.correlationId),
      });

      await writeBatchImportAudit(
        {
          tenantId: params.tenantId,
          actorId: params.uploadedBy,
          correlationId: params.correlationId,
          status: "success",
          batchId,
          details: {
            original_filename: params.validation.original_filename,
            source_format: params.validation.summary.source_format,
            total_rows: params.validation.summary.total_rows,
            critical_issue_count: params.validation.summary.critical_issue_count,
            warning_issue_count: params.validation.summary.warning_issue_count,
            source_storage_key: sourceStorageKey,
          },
        },
        transaction,
      );
    });
  } catch (error) {
    await deleteDocumentArtifact(sourceStorageKey).catch(() => undefined);
    throw error;
  }

  return { batchId };
}
