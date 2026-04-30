import { createHash } from "node:crypto";
import { buildDomainEvent, type DomainEvent } from "@/lib/events/publisher";

export const EXTERNAL_EVENT_STATES = ["received", "validated", "processed", "published", "exception"] as const;
export const EXTERNAL_EVENT_VERSION = "v1" as const;

export const EXTERNAL_EVENT_DELIVERY_STATUSES = ["pending", "delivering", "delivered", "failed"] as const;
export const EXTERNAL_EVENT_DELIVERY_FAILURE_CODES = [
  "FORBIDDEN_CONSUMER",
  "CONSUMER_CONFIGURATION_MISSING",
  "TRANSPORT_FAILURE",
  "RETRY_EXHAUSTED",
  "INVALID_EVENT_PAYLOAD",
] as const;

export type ExternalEventState = (typeof EXTERNAL_EVENT_STATES)[number];
export type ExternalEventDeliveryStatus = (typeof EXTERNAL_EVENT_DELIVERY_STATUSES)[number];
export type ExternalEventDeliveryFailureCode = (typeof EXTERNAL_EVENT_DELIVERY_FAILURE_CODES)[number];

const EXTERNAL_EVENT_PAYLOAD_KEYS = new Set([
  "event_state",
  "source_reference",
  "ingestion_id",
  "contract_version",
  "validation_result",
  "failure_code",
  "recommended_action",
  "delivery_status",
  "attempt_count",
  "consumer_key",
  "fingerprint",
]);

function parseText(value: string | undefined, fieldName: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${fieldName} invalido.`);
  }

  return normalized;
}

function ensureNoForbiddenPayloadFields(payload: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(payload)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("secret") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("password") ||
      normalizedKey.includes("credential") ||
      normalizedKey.includes("raw") ||
      normalizedKey.includes("cookie") ||
      normalizedKey.includes("session")
    ) {
      throw new Error("payload externo contem campos sensiveis nao permitidos.");
    }

    if (!EXTERNAL_EVENT_PAYLOAD_KEYS.has(key)) {
      throw new Error(`campo nao permitido no payload externo: ${key}`);
    }

    if (value !== null && typeof value === "object") {
      throw new Error(`campo nao permitido no payload externo: ${key}`);
    }
  }
}

export function normalizeExternalEventPayload(payload: Record<string, unknown>): Record<string, unknown> {
  ensureNoForbiddenPayloadFields(payload);
  return payload;
}

export function getExternalEventName(state: ExternalEventState): string {
  return `integrations.external_ingestion.${state}.v1`;
}

export function buildExternalEventPayload(input: {
  state: ExternalEventState;
  sourceReference: string;
  ingestionId?: string;
  contractVersion?: string;
  validationResult?: "success" | "failure";
  failureCode?: string | null;
  recommendedAction?: string | null;
  deliveryStatus?: ExternalEventDeliveryStatus;
  attemptCount?: number;
  consumerKey?: string;
  fingerprint?: string;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    event_state: input.state,
    source_reference: parseText(input.sourceReference, "source_reference"),
  };

  if (input.ingestionId) {
    payload.ingestion_id = parseText(input.ingestionId, "ingestion_id");
  }

  if (input.contractVersion) {
    payload.contract_version = parseText(input.contractVersion, "contract_version");
  }

  if (input.validationResult) {
    payload.validation_result = input.validationResult;
  }

  if (input.failureCode !== undefined) {
    payload.failure_code = input.failureCode;
  }

  if (input.recommendedAction !== undefined) {
    payload.recommended_action = input.recommendedAction;
  }

  if (input.deliveryStatus) {
    payload.delivery_status = input.deliveryStatus;
  }

  if (input.attemptCount !== undefined) {
    if (!Number.isInteger(input.attemptCount) || input.attemptCount < 0) {
      throw new Error("attempt_count invalido.");
    }

    payload.attempt_count = input.attemptCount;
  }

  if (input.consumerKey) {
    payload.consumer_key = parseText(input.consumerKey, "consumer_key");
  }

  if (input.fingerprint) {
    payload.fingerprint = parseText(input.fingerprint, "fingerprint");
  }

  return normalizeExternalEventPayload(payload);
}

export function buildExternalEvent(input: {
  state: ExternalEventState;
  tenantId: string;
  correlationId: string;
  actorId: string;
  actorRole: string;
  sourceReference: string;
  occurredAt?: string;
  payload: Record<string, unknown>;
}): DomainEvent {
  return buildDomainEvent({
    event_name: getExternalEventName(input.state),
    event_version: EXTERNAL_EVENT_VERSION,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    correlation_id: parseText(input.correlationId, "correlation_id"),
    tenant_id: parseText(input.tenantId, "tenant_id"),
    actor: {
      actor_id: parseText(input.actorId, "actor_id"),
      actor_role: parseText(input.actorRole, "actor_role"),
    },
    payload: normalizeExternalEventPayload({
      ...input.payload,
      event_state: input.state,
      source_reference: parseText(input.sourceReference, "source_reference"),
    }),
  });
}

export function computeExternalEventDeliveryFingerprint(input: {
  tenantId: string;
  eventName: string;
  eventVersion: string;
  sourceReference: string;
  consumerKey: string;
}): string {
  return createHash("sha256")
    .update(
      [
        parseText(input.tenantId, "tenant_id"),
        parseText(input.eventName, "event_name"),
        parseText(input.eventVersion, "event_version"),
        parseText(input.sourceReference, "source_reference"),
        parseText(input.consumerKey, "consumer_key"),
      ].join("|"),
    )
    .digest("hex");
}

export function classifyExternalEventDeliveryFailure(code: ExternalEventDeliveryFailureCode): {
  failure_code: ExternalEventDeliveryFailureCode;
  recommended_action: string;
  status: "failed";
} {
  if (code === "FORBIDDEN_CONSUMER") {
    return {
      failure_code: code,
      recommended_action: "Cadastre ou habilite o consumidor autorizado para o tenant e reenvie a publicacao.",
      status: "failed",
    };
  }

  if (code === "CONSUMER_CONFIGURATION_MISSING") {
    return {
      failure_code: code,
      recommended_action: "Revise a configuracao do consumidor autorizado antes de tentar novamente.",
      status: "failed",
    };
  }

  if (code === "INVALID_EVENT_PAYLOAD") {
    return {
      failure_code: code,
      recommended_action: "Remova campos nao permitidos do payload operacional e reenfileire a publicacao.",
      status: "failed",
    };
  }

  if (code === "RETRY_EXHAUSTED") {
    return {
      failure_code: code,
      recommended_action: "Analise o ultimo erro, corrija a causa e reenvie com a mesma fingerprint.",
      status: "failed",
    };
  }

  return {
    failure_code: code,
    recommended_action: "Verifique o adaptador de publicacao e tente novamente com a mesma fingerprint.",
    status: "failed",
  };
}