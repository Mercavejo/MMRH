import { z } from "zod";
import { BATCH_DOCUMENT_TYPES, type BatchImportRow } from "./import-validation";
import {
  type BatchRoutingProgress,
  type BatchRoutingStatus,
} from "./batch-progress";

export const batchRoutingManifestItemSchema = z.object({
  document_id: z.string().trim().min(1),
  employee_identifier: z.string().trim(),
  codigo_colaborador: z.string().trim().nullable().optional(),
  nome_normalizado: z.string().trim().nullable().optional(),
  match_strategy: z.enum(["codigo_colaborador", "nome_normalizado"]).nullable().optional(),
  page_index: z.number().int().positive().optional(),
  blocked_reason_code: z.string().trim().nullable().optional(),
  blocked_reason_message: z.string().trim().nullable().optional(),
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
  blocked_reason_code: z.string().trim().nullable(),
  blocked_reason_message: z.string().trim().nullable(),
  match_strategy: z.enum(["codigo_colaborador", "nome_normalizado"]).nullable(),
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
    codigo_colaborador: row.codigo_colaborador ?? row.employee_identifier ?? null,
    nome_normalizado: row.nome_normalizado ?? null,
    match_strategy: row.codigo_colaborador
      ? "codigo_colaborador"
      : row.nome_normalizado
        ? "nome_normalizado"
        : row.employee_identifier
          ? "codigo_colaborador"
          : null,
    page_index: row.page_index ?? index + 1,
    blocked_reason_code: null,
    blocked_reason_message: null,
    document_type: row.document_type,
    period_ref: row.period_ref,
  }));
}

function getCodeKey(item: BatchRoutingManifestItem): string {
  const codigo = (item.codigo_colaborador ?? item.employee_identifier).trim().toLowerCase();
  return [
    codigo,
    item.document_type,
    item.period_ref,
  ].join("|");
}

function getFallbackNameKey(item: BatchRoutingManifestItem): string {
  const nome = (item.nome_normalizado ?? "").trim().toLowerCase();
  return [nome, item.document_type, item.period_ref].join("|");
}

function normalizeOutcomeStatus(
  item: BatchRoutingManifestItem,
  duplicateCount: number,
  duplicateNameCount: number,
): {
  routing_status: BatchRoutingOutcomeStatus;
  ambiguity_reason: string | null;
  blocked_reason_code: string | null;
  blocked_reason_message: string | null;
  match_strategy: "codigo_colaborador" | "nome_normalizado" | null;
} {
  const codigo = (item.codigo_colaborador ?? item.employee_identifier).trim();
  const nome = (item.nome_normalizado ?? "").trim();

  if (!codigo && !nome) {
    return {
      routing_status: "failed",
      ambiguity_reason: "Identificador do colaborador ausente.",
      blocked_reason_code: "MISSING_EMPLOYEE_CODE",
      blocked_reason_message: "Pagina sem codigo do colaborador e sem nome valido para fallback.",
      match_strategy: null,
    };
  }

  if (codigo && duplicateCount > 1) {
    return {
      routing_status: "ambiguous",
      ambiguity_reason:
        "Mais de um documento corresponde ao mesmo colaborador, periodo e tipo.",
      blocked_reason_code: "AMBIGUOUS_EMPLOYEE_BY_NAME",
      blocked_reason_message: "Documento bloqueado por ambiguidade de identificacao.",
      match_strategy: "codigo_colaborador",
    };
  }

  if (!codigo && nome && duplicateNameCount > 1) {
    return {
      routing_status: "ambiguous",
      ambiguity_reason: "Fallback por nome bloqueado por duplicidade de candidatos.",
      blocked_reason_code: "DUPLICATE_NORMALIZED_NAME",
      blocked_reason_message: "Nome normalizado duplicado para o mesmo periodo.",
      match_strategy: "nome_normalizado",
    };
  }

  if (!codigo && nome) {
    return {
      routing_status: "matched",
      ambiguity_reason: null,
      blocked_reason_code: null,
      blocked_reason_message: null,
      match_strategy: "nome_normalizado",
    };
  }

  if (codigo) {
    return {
      routing_status: "matched",
      ambiguity_reason: null,
      blocked_reason_code: null,
      blocked_reason_message: null,
      match_strategy: "codigo_colaborador",
    };
  }

  return {
    routing_status: "failed",
    ambiguity_reason: "Falha de identificacao de colaborador.",
    blocked_reason_code: "CONFLICTING_IDENTIFIER_SIGNALS",
    blocked_reason_message: "Sinais de identificacao conflitantes.",
    match_strategy: null,
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
  const duplicateNameCounts = new Map<string, number>();

  for (const item of manifestParsed.data) {
    const key = getCodeKey(item);
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);

    const fallbackKey = getFallbackNameKey(item);
    const codigo = (item.codigo_colaborador ?? item.employee_identifier).trim();
    if (!codigo && fallbackKey.trim().length > 2) {
      duplicateNameCounts.set(fallbackKey, (duplicateNameCounts.get(fallbackKey) ?? 0) + 1);
    }
  }

  const items = manifestParsed.data.map((item) => {
    const duplicateCount = duplicateCounts.get(getCodeKey(item)) ?? 0;
    const duplicateNameCount = duplicateNameCounts.get(getFallbackNameKey(item)) ?? 0;
    const outcome = normalizeOutcomeStatus(item, duplicateCount, duplicateNameCount);

    return {
      ...item,
      employee_identifier:
        item.employee_identifier || item.codigo_colaborador || item.nome_normalizado || "",
      routing_status: outcome.routing_status,
      ambiguity_reason: outcome.ambiguity_reason,
      blocked_reason_code: outcome.blocked_reason_code,
      blocked_reason_message: outcome.blocked_reason_message,
      match_strategy: outcome.match_strategy,
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
        : failedDocuments > 0
          ? `${failedDocuments} documento(s) falharam por falta de identificacao.`
          : null,
    items,
  };
}