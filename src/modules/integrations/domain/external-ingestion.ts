import { buildAuditTimeline, type AuditTimelineEntry } from "@/modules/audit/domain/audit-event-filters";
import { z } from "zod";

export const EXTERNAL_INGESTION_STATUSES = ["received", "processing", "processed", "failed"] as const;
export const EXTERNAL_INGESTION_FAILURE_CODES = [
  "UNAUTHORIZED_SOURCE",
  "INVALID_PAYLOAD",
  "INVALID_CONTRACT_VERSION",
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
  contractVersion?: string;
  sourceReference?: string;
  idempotencyKey?: string;
  payloadSummary?: Record<string, unknown>;
};

export type NormalizedExternalIngestionRegistration = {
  tenantId: string;
  sourceSystem: AuthorizedExternalSource;
  contractVersion: string;
  sourceReference: string;
  idempotencyKey: string;
  payloadSummary: Record<string, unknown>;
};

export type ExternalContractValidationResult = {
  success: boolean;
  source_system: AuthorizedExternalSource;
  contract_version: string;
  validation_result: "success" | "failure";
  failure_code: ExternalIngestionFailureCode | null;
  details: Record<string, unknown> | null;
};

export type ExternalIngestionResolution = {
  failure_code: ExternalIngestionFailureCode | null;
  recommended_action: string | null;
};

export type ExternalIngestionContractValidation = {
  contract_version: string;
  validation_result: "success" | "failure";
  failure_code: ExternalIngestionFailureCode | null;
  validated_at: string;
};

export type ExternalIngestion = {
  ingestion_id: string;
  tenant_id: string;
  source_system: AuthorizedExternalSource;
  contract_version: string;
  source_reference: string;
  idempotency_key: string;
  status: ExternalIngestionStatus;
  received_at: string;
  processing_started_at: string | null;
  processed_at: string | null;
  failed_at: string | null;
  contract_validation: ExternalIngestionContractValidation;
  resolution: ExternalIngestionResolution;
  correlation_id: string;
  payload_summary: Record<string, unknown>;
  timeline: AuditTimelineEntry[];
};

const payrollApiV1Schema = z.object({
  period: z.string().trim().min(1),
  documents: z.number().int().nonnegative(),
  employee_count: z.number().int().positive().optional(),
});

const payrollApiV2Schema = payrollApiV1Schema.extend({
  batch_id: z.string().trim().min(1),
});

const sftpGatewayV1Schema = z.object({
  file_name: z.string().trim().min(1),
  rows: z.number().int().nonnegative(),
  checksum: z.string().trim().min(8),
});

const CONTRACT_SCHEMA_BY_SOURCE: Record<AuthorizedExternalSource, Record<string, z.ZodType<Record<string, unknown>>>> = {
  "payroll-api": {
    v1: payrollApiV1Schema,
    v2: payrollApiV2Schema,
  },
  "sftp-gateway": {
    v1: sftpGatewayV1Schema,
  },
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
    contractVersion: parseText(input.contractVersion, "contract_version"),
    sourceReference: parseText(input.sourceReference, "source_reference", 3),
    idempotencyKey: parseText(input.idempotencyKey, "idempotency_key", 8),
    payloadSummary: input.payloadSummary ?? {},
  };
}

export function getSupportedContractVersions(sourceSystem: AuthorizedExternalSource): string[] {
  return Object.keys(CONTRACT_SCHEMA_BY_SOURCE[sourceSystem]);
}

export function validateExternalIngestionContract(input: {
  sourceSystem: AuthorizedExternalSource;
  contractVersion: string;
  payloadSummary: Record<string, unknown>;
}): ExternalContractValidationResult {
  const normalizedVersion = input.contractVersion.trim();
  const schema = CONTRACT_SCHEMA_BY_SOURCE[input.sourceSystem][normalizedVersion];

  if (!schema) {
    return {
      success: false,
      source_system: input.sourceSystem,
      contract_version: normalizedVersion,
      validation_result: "failure",
      failure_code: "INVALID_CONTRACT_VERSION",
      details: {
        supported_versions: getSupportedContractVersions(input.sourceSystem),
      },
    };
  }

  const parsed = schema.safeParse(input.payloadSummary);
  if (!parsed.success) {
    return {
      success: false,
      source_system: input.sourceSystem,
      contract_version: normalizedVersion,
      validation_result: "failure",
      failure_code: "INVALID_PAYLOAD",
      details: {
        issues: parsed.error.issues,
      },
    };
  }

  return {
    success: true,
    source_system: input.sourceSystem,
    contract_version: normalizedVersion,
    validation_result: "success",
    failure_code: null,
    details: null,
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

  if (code === "INVALID_CONTRACT_VERSION") {
    return {
      recommended_action: "Confirme a versao de contrato suportada para a origem e reenvie com schema compativel.",
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
