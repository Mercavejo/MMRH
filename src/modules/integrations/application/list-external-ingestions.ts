import {
  buildExternalIngestionTimeline,
  normalizeExternalIngestionFilters,
  type ExternalIngestionFilterInput,
} from "../domain/external-ingestion";
import {
  ExternalIngestionRepositoryError,
  listExternalIngestionsFromDb,
} from "../infrastructure/external-ingestions-repository";
import { ExternalIngestionError } from "./register-external-ingestion";

export { ExternalIngestionError };

export async function listExternalIngestions(input: {
  tenantId: string;
  status?: string;
  sourceSystem?: string;
  ingestionId?: string;
}) {
  let normalized;

  try {
    normalized = normalizeExternalIngestionFilters({
      status: input.status,
      sourceSystem: input.sourceSystem,
      ingestionId: input.ingestionId,
    } satisfies ExternalIngestionFilterInput);
  } catch (error) {
    throw new ExternalIngestionRepositoryError("INVALID_STATE_TRANSITION", (error as Error).message, 400);
  }

  let result;

  try {
    result = await listExternalIngestionsFromDb({
      tenantId: input.tenantId,
      filters: normalized,
      ingestionId: normalized.ingestionId,
    });
  } catch (error) {
    if (error instanceof ExternalIngestionRepositoryError) {
      if (error.code === "TENANT_MISMATCH") {
        throw new ExternalIngestionError("FORBIDDEN", error.message, 403);
      }

      if (error.code === "NOT_FOUND") {
        throw new ExternalIngestionError("NOT_FOUND", error.message, 404);
      }

      throw new ExternalIngestionError(
        error.code,
        error.message,
        error.statusCode,
        error.details,
      );
    }

    throw new ExternalIngestionError(
      "INTERNAL_SERVER_ERROR",
      "Falha ao consultar integracoes externas.",
      500,
    );
  }

  return {
    ...result,
    ingestions: result.ingestions.map((ingestion) => ({
      ...ingestion,
      timeline: buildExternalIngestionTimeline(ingestion),
    })),
    selectedIngestion: result.selectedIngestion
      ? {
          ...result.selectedIngestion,
          timeline: buildExternalIngestionTimeline(result.selectedIngestion),
        }
      : null,
    filters: {
      status: normalized.status ?? null,
      source_system: normalized.sourceSystem ?? null,
      ingestion_id: normalized.ingestionId ?? null,
    },
  };
}
