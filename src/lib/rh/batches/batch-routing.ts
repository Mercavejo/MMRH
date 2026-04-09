import { z } from "zod";
import { BATCH_DOCUMENT_TYPES, type BatchImportRow } from "./import-validation";
import {
  type BatchRoutingProgress,
  type BatchRoutingStatus,
} from "./batch-progress";

export const batchRoutingManifestItemSchema = z.object({
  document_id: z.string().trim().min(1),
  employee_identifier: z.string().trim(),
  document_type: z.enum(BATCH_DOCUMENT_TYPES),
  period_ref: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

export const batchRoutingManifestSchema = z.array(batchRoutingManifestItemSchema);

export const batchRoutingOutcomeStatusValues = [
  "matched",
  "ambiguous",
  "failed",
] as const;

export type BatchRoutingOutcomeStatus =
  (typeof batchRoutingOutcomeStatusValues)[number];

export const batchRoutingOutcomeSchema = batchRoutingManifestItemSchema.extend({
  routing_status: z.enum(batchRoutingOutcomeStatusValues),
  ambiguity_reason: z.string().trim().nullable(),
  processed_at: z.string().datetime(),
});

export type BatchRoutingManifestItem = z.infer<typeof batchRoutingManifestItemSchema>;
export type BatchRoutingOutcome = z.infer<typeof batchRoutingOutcomeSchema>;

export type BatchRoutingResult = BatchRoutingProgress & {
  items: BatchRoutingOutcome[];
};

export class BatchRoutingError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "BatchRoutingError";
  }
}

export function buildBatchRoutingManifest(params: {
  batchId: string;
  rows: BatchImportRow[];
}): BatchRoutingManifestItem[] {
  return params.rows.map((row, index) => ({
    document_id: `${params.batchId}:${index + 1}`,
    employee_identifier: row.employee_identifier,
    document_type: row.document_type,
    period_ref: row.period_ref,
  }));
}

function getManifestKey(item: BatchRoutingManifestItem): string {
  return [
    item.employee_identifier.trim().toLowerCase(),
    item.document_type,
    item.period_ref,
  ].join("|");
}

function normalizeOutcomeStatus(
  item: BatchRoutingManifestItem,
  duplicateCount: number,
): { routing_status: BatchRoutingOutcomeStatus; ambiguity_reason: string | null } {
  if (item.employee_identifier.trim().length === 0) {
    return {
      routing_status: "failed",
      ambiguity_reason: "Identificador do colaborador ausente.",
    };
  }

  if (duplicateCount > 1) {
    return {
      routing_status: "ambiguous",
      ambiguity_reason:
        "Mais de um documento corresponde ao mesmo colaborador, periodo e tipo.",
    };
  }

  return {
    routing_status: "matched",
    ambiguity_reason: null,
  };
}

export function routeBatchManifest(params: {
  batchId: string;
  tenantId: string;
  manifest: BatchRoutingManifestItem[];
  processedAt?: string;
}): BatchRoutingResult {
  const manifestParsed = batchRoutingManifestSchema.safeParse(params.manifest);
  if (!manifestParsed.success) {
    throw new BatchRoutingError(
      "VALIDATION_ERROR",
      "Manifest de roteamento invalido.",
      400,
      { issues: manifestParsed.error.issues },
    );
  }

  if (manifestParsed.data.length === 0) {
    throw new BatchRoutingError(
      "BATCH_EMPTY",
      "O lote nao possui documentos para roteamento.",
      409,
    );
  }

  const processedAt = params.processedAt ?? new Date().toISOString();
  const duplicateCounts = new Map<string, number>();

  for (const item of manifestParsed.data) {
    const key = getManifestKey(item);
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
  }

  const items = manifestParsed.data.map((item) => {
    const duplicateCount = duplicateCounts.get(getManifestKey(item)) ?? 0;
    const outcome = normalizeOutcomeStatus(item, duplicateCount);

    return {
      ...item,
      routing_status: outcome.routing_status,
      ambiguity_reason: outcome.ambiguity_reason,
      processed_at: processedAt,
    };
  });

  const matchedDocuments = items.filter((item) => item.routing_status === "matched").length;
  const ambiguousDocuments = items.filter((item) => item.routing_status === "ambiguous").length;
  const failedDocuments = items.filter((item) => item.routing_status === "failed").length;

  const routingStatus: BatchRoutingStatus = ambiguousDocuments > 0
    ? "blocked"
    : failedDocuments > 0
      ? "failed"
      : matchedDocuments > 0
        ? "completed"
        : "failed";

  return {
    batch_id: params.batchId,
    tenant_id: params.tenantId,
    routing_status: routingStatus,
    total_documents: items.length,
    matched_documents: matchedDocuments,
    pending_documents: 0,
    failed_documents: failedDocuments,
    ambiguous_documents: ambiguousDocuments,
    blocked_documents: ambiguousDocuments,
    processed_at: processedAt,
    blocked_reason:
      ambiguousDocuments > 0
        ? `${ambiguousDocuments} documento(s) bloqueado(s) por ambiguidade.`
        : null,
    items,
  };
}