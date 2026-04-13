import {
  normalizeSupportCaseFilters,
  type SupportCaseFilterInput,
} from "../domain/support-case";
import { getSupportCaseFromDb } from "../infrastructure/support-cases-repository";

export class SupportCaseError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "SupportCaseError";
  }
}

export async function getSupportCase(input: {
  tenantId: string;
  caseId: string;
  from?: string;
  to?: string;
  batchId?: string;
  documentId?: string;
  userId?: string;
}) {
  let filters: ReturnType<typeof normalizeSupportCaseFilters>;

  try {
    filters = normalizeSupportCaseFilters({
      from: input.from,
      to: input.to,
      batchId: input.batchId,
      documentId: input.documentId,
      userId: input.userId,
    } satisfies SupportCaseFilterInput);
  } catch (error) {
    throw new SupportCaseError("VALIDATION_ERROR", (error as Error).message, 400);
  }

  const supportCase = await getSupportCaseFromDb({
    tenantId: input.tenantId,
    caseId: input.caseId,
    filters,
  });

  if (!supportCase) {
    throw new SupportCaseError("NOT_FOUND", "Caso de suporte nao encontrado.", 404);
  }

  return supportCase;
}
