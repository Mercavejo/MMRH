import { AUTHORIZED_EXTERNAL_SOURCES, type AuthorizedExternalSource } from "../domain/external-ingestion";
import { upsertExternalIdentifierMappingRuleInDb } from "../infrastructure/external-identifier-mappings-repository";
import { ExternalIngestionError } from "./register-external-ingestion";

function normalizeUuid(value: string, fieldName: string): string {
  const normalized = value.trim();
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(normalized)) {
    throw new ExternalIngestionError("VALIDATION_ERROR", `${fieldName} invalido.`, 400);
  }

  return normalized;
}

export async function upsertExternalIdentifierMappingRule(input: {
  tenantId: string;
  sourceSystem: string;
  externalIdentifier: string;
  employeeId: string | null;
  disable: boolean;
  actorId: string;
  correlationId: string;
}) {
  if (!AUTHORIZED_EXTERNAL_SOURCES.includes(input.sourceSystem as AuthorizedExternalSource)) {
    throw new ExternalIngestionError("VALIDATION_ERROR", "Origem externa nao autorizada.", 400);
  }

  const tenantId = normalizeUuid(input.tenantId, "tenant_id");
  const actorId = normalizeUuid(input.actorId, "actor_id");
  const correlationId = normalizeUuid(input.correlationId, "correlation_id");

  const externalIdentifier = input.externalIdentifier.trim();
  if (!externalIdentifier) {
    throw new ExternalIngestionError("VALIDATION_ERROR", "external_identifier invalido.", 400);
  }

  if (!input.disable && !input.employeeId) {
    throw new ExternalIngestionError("VALIDATION_ERROR", "employee_id obrigatorio quando mapping ativo.", 400);
  }

  const employeeId = input.employeeId ? normalizeUuid(input.employeeId, "employee_id") : null;

  return upsertExternalIdentifierMappingRuleInDb({
    tenantId,
    sourceSystem: input.sourceSystem as AuthorizedExternalSource,
    externalIdentifier,
    employeeId,
    disable: input.disable,
    actorId,
    correlationId,
  });
}
