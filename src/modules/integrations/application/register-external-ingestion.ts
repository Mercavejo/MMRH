import {
  normalizeExternalIngestionRegistration,
  type ExternalIngestionRegistrationInput,
} from "../domain/external-ingestion";
import {
  ExternalIngestionRepositoryError,
  registerExternalIngestionInDb,
} from "../infrastructure/external-ingestions-repository";

export class ExternalIngestionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ExternalIngestionError";
  }
}

export async function registerExternalIngestion(input: ExternalIngestionRegistrationInput & { correlationId: string }) {
  let normalized;

  try {
    normalized = normalizeExternalIngestionRegistration(input);
  } catch (error) {
    throw new ExternalIngestionError("VALIDATION_ERROR", (error as Error).message, 400);
  }

  try {
    return await registerExternalIngestionInDb({ ...normalized, correlationId: input.correlationId });
  } catch (error) {
    if (error instanceof ExternalIngestionRepositoryError) {
      if (error.code === "DUPLICATE_INGESTION") {
        throw new ExternalIngestionError("DUPLICATE_INGESTION", error.message, 409, error.details);
      }

      if (error.code === "PROCESSING_FAILURE") {
        throw new ExternalIngestionError("PROCESSING_FAILURE", error.message, 500, error.details);
      }
    }

    throw new ExternalIngestionError("INTERNAL_SERVER_ERROR", "Falha ao registrar intake externo.", 500);
  }
}
