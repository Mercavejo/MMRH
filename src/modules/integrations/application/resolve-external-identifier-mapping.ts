import { AUTHORIZED_EXTERNAL_SOURCES, resolveExternalIdentifierMapping, type AuthorizedExternalSource } from "../domain/external-ingestion";
import { listActiveExternalIdentifierMappings } from "../infrastructure/external-identifier-mappings-repository";
import { ExternalIngestionError } from "./register-external-ingestion";

function normalizeExternalIdentifier(payloadSummary: Record<string, unknown>): string {
  const candidates = [
    payloadSummary.external_identifier,
    payloadSummary.employee_external_id,
    payloadSummary.collaborator_external_id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return "";
}

export async function resolveExternalIdentifierMappingForIntake(input: {
  tenantId: string;
  sourceSystem: string;
  payloadSummary: Record<string, unknown>;
}) {
  if (!AUTHORIZED_EXTERNAL_SOURCES.includes(input.sourceSystem as AuthorizedExternalSource)) {
    throw new ExternalIngestionError("FORBIDDEN", "Origem externa nao autorizada.", 403);
  }

  const externalIdentifier = normalizeExternalIdentifier(input.payloadSummary);
  if (!externalIdentifier) {
    return {
      status: "not-found" as const,
      failure_code: "MAPPING_NOT_FOUND" as const,
      recommended_action: "Cadastre o mapeamento do identificador externo para o tenant antes de reenviar.",
      mapped_employee_id: null,
      mapping_version: null,
      external_identifier: null,
    };
  }

  const candidates = await listActiveExternalIdentifierMappings({
    tenantId: input.tenantId,
    sourceSystem: input.sourceSystem as AuthorizedExternalSource,
    externalIdentifier,
  });

  const resolution = resolveExternalIdentifierMapping({
    tenantId: input.tenantId,
    sourceSystem: input.sourceSystem as AuthorizedExternalSource,
    externalIdentifier,
    candidates,
  });

  return resolution;
}
