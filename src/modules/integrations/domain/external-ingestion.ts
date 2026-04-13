import { buildAuditTimeline, type AuditTimelineEntry } from "@/modules/audit/domain/audit-event-filters";

export const EXTERNAL_INGESTION_STATUSES = ["received", "processing", "processed", "failed"] as const;
export const EXTERNAL_INGESTION_FAILURE_CODES = [
  "UNAUTHORIZED_SOURCE",
  "INVALID_PAYLOAD",
  "TENANT_MISMATCH",
  "DUPLICATE_INGESTION",
  "PROCESSING_FAILURE",
] as const;

export const AUTHORIZED_EXTERNAL_SOURCES = ["payroll-api", "sftp-gateway"] as const;

export type ExternalIngestionStatus = (typeof EXTERNAL_INGESTION_STATUSES)[number];
export type ExternalIngestionFailureCode = (typeof EXTERNAL_INGESTION_FAILURE_CODES)[number];
export type AuthorizedExternalSource = (typeof AUTHORIZED_EXTERNAL_SOURCES)[number];

export type ExternalIngestionFilterInput = {
  status?: string;
  sourceSystem?: string;
  ingestionId?: string;
};

export type NormalizedExternalIngestionFilters = {
  status?: ExternalIngestionStatus;
  sourceSystem?: AuthorizedExternalSource;
  ingestionId?: string;
};

export type ExternalIngestionRegistrationInput = {
  tenantId?: string;
  sourceSystem?: string;
  sourceReference?: string;
  idempotencyKey?: string;
  payloadSummary?: Record<string, unknown>;
};

export type NormalizedExternalIngestionRegistration = {
  tenantId: string;
  sourceSystem: AuthorizedExternalSource;
  sourceReference: string;
  idempotencyKey: string;
  payloadSummary: Record<string, unknown>;
};

export type ExternalIngestionResolution = {
  failure_code: ExternalIngestionFailureCode | null;
  recommended_action: string | null;
};

export type ExternalIngestion = {
  ingestion_id: string;
  tenant_id: string;
  source_system: AuthorizedExternalSource;
  source_reference: string;
  idempotency_key: string;
  status: ExternalIngestionStatus;
  received_at: string;
  processing_started_at: string | null;
  processed_at: string | null;
  failed_at: string | null;
  resolution: ExternalIngestionResolution;
  correlation_id: string;
  payload_summary: Record<string, unknown>;
  timeline: AuditTimelineEntry[];
};

function parseUuid(value: string | undefined, fieldName: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${fieldName} invalido.`);
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(normalized)) {
    throw new Error(`${fieldName} invalido.`);
  }

  return normalized;
}

function parseText(value: string | undefined, fieldName: string, minLength = 1): string {
  const normalized = value?.trim();
  if (!normalized || normalized.length < minLength) {
    throw new Error(`${fieldName} invalido.`);
  }

  return normalized;
}

function normalizeSourceSystem(value: string | undefined): AuthorizedExternalSource {
  const normalized = parseText(value, "source_system");
  if (!AUTHORIZED_EXTERNAL_SOURCES.includes(normalized as AuthorizedExternalSource)) {
    throw new Error("origem externa nao autorizada.");
  }

  return normalized as AuthorizedExternalSource;
}

export function normalizeExternalIngestionRegistration(
  input: ExternalIngestionRegistrationInput,
): NormalizedExternalIngestionRegistration {
  return {
    tenantId: parseUuid(input.tenantId, "tenant_id"),
    sourceSystem: normalizeSourceSystem(input.sourceSystem),
    sourceReference: parseText(input.sourceReference, "source_reference", 3),
    idempotencyKey: parseText(input.idempotencyKey, "idempotency_key", 8),
    payloadSummary: input.payloadSummary ?? {},
  };
}

export function normalizeExternalIngestionFilters(input: ExternalIngestionFilterInput): NormalizedExternalIngestionFilters {
  const status = input.status?.trim();
  const sourceSystem = input.sourceSystem?.trim();
  const ingestionId = input.ingestionId?.trim();

  return {
    status: status && EXTERNAL_INGESTION_STATUSES.includes(status as ExternalIngestionStatus)
      ? (status as ExternalIngestionStatus)
      : undefined,
    sourceSystem: sourceSystem && AUTHORIZED_EXTERNAL_SOURCES.includes(sourceSystem as AuthorizedExternalSource)
      ? (sourceSystem as AuthorizedExternalSource)
      : undefined,
    ingestionId: ingestionId || undefined,
  };
}

export function isValidExternalIngestionStatusTransition(
  previousStatus: ExternalIngestionStatus,
  nextStatus: ExternalIngestionStatus,
): boolean {
  if (previousStatus === "received") {
    return nextStatus === "processing" || nextStatus === "failed";
  }

  if (previousStatus === "processing") {
    return nextStatus === "processed" || nextStatus === "failed";
  }

  return false;
}

export function classifyExternalIngestionFailure(code: ExternalIngestionFailureCode): {
  recommended_action: string;
  status: ExternalIngestionStatus;
} {
  if (code === "UNAUTHORIZED_SOURCE") {
    return {
      recommended_action: "Verifique o contrato da origem e o mapeamento autorizado antes de reenviar.",
      status: "failed",
    };
  }

  if (code === "INVALID_PAYLOAD") {
    return {
      recommended_action: "Corrija o payload ou o schema de entrada e reenvie a integracao.",
      status: "failed",
    };
  }

  if (code === "TENANT_MISMATCH") {
    return {
      recommended_action: "Confirme o tenant de destino e reenvie apenas para o tenant autorizado.",
      status: "failed",
    };
  }

  if (code === "DUPLICATE_INGESTION") {
    return {
      recommended_action: "Use a mesma chave de idempotencia para reenvio controlado ou abra nova referencia.",
      status: "failed",
    };
  }

  return {
    recommended_action: "Revise a causa tecnica, registre a correcao e tente novamente.",
    status: "failed",
  };
}

export function buildExternalIngestionTimeline(ingestion: {
  ingestion_id: string;
  status: ExternalIngestionStatus;
  received_at: string;
  processing_started_at: string | null;
  processed_at: string | null;
  failed_at: string | null;
}): AuditTimelineEntry[] {
  const items: AuditTimelineEntry[] = [
    {
      event_id: `${ingestion.ingestion_id}-received`,
      action: "integrations.external_ingestion.received.v1",
      status: "success",
      occurred_at: ingestion.received_at,
    },
  ];

  if (ingestion.processing_started_at) {
    items.push({
      event_id: `${ingestion.ingestion_id}-processing`,
      action: "integrations.external_ingestion.processing.v1",
      status: ingestion.status === "failed" ? "failure" : "success",
      occurred_at: ingestion.processing_started_at,
    });
  }

  if (ingestion.processed_at) {
    items.push({
      event_id: `${ingestion.ingestion_id}-processed`,
      action: "integrations.external_ingestion.processed.v1",
      status: "success",
      occurred_at: ingestion.processed_at,
    });
  }

  if (ingestion.failed_at) {
    items.push({
      event_id: `${ingestion.ingestion_id}-failed`,
      action: "integrations.external_ingestion.failed.v1",
      status: "failure",
      occurred_at: ingestion.failed_at,
    });
  }

  return buildAuditTimeline(items);
}
