import { resolveSupportCaseInDb, SupportCaseRepositoryError } from "../infrastructure/support-cases-repository";
import { SupportCaseError } from "./get-support-case";

export async function resolveSupportCase(input: {
  tenantId: string;
  actorId: string;
  caseId: string;
  correlationId: string;
  causeCode: string;
  actionApplied: string;
  resultStatus: "resolved" | "partial" | "failed";
  recovery?: {
    batchId: string;
    exceptionIds?: string[];
    idempotencyKey: string;
  };
}) {
  try {
    return await resolveSupportCaseInDb({
      tenantId: input.tenantId,
      actorId: input.actorId,
      caseId: input.caseId,
      correlationId: input.correlationId,
      causeCode: input.causeCode,
      actionApplied: input.actionApplied,
      resultStatus: input.resultStatus,
      recovery: input.recovery,
    });
  } catch (error) {
    if (error instanceof SupportCaseRepositoryError) {
      if (error.code === "NOT_FOUND") {
        throw new SupportCaseError("NOT_FOUND", "Caso de suporte nao encontrado.", 404, error.details);
      }

      if (error.code === "INVALID_STATE_TRANSITION") {
        throw new SupportCaseError(
          "INVALID_STATE_TRANSITION",
          "Transicao de estado de caso invalida.",
          409,
          error.details,
        );
      }

      if (error.code === "BATCH_MISMATCH") {
        throw new SupportCaseError("CONFLICT", "Batch de recuperacao nao corresponde ao caso.", 409, error.details);
      }

      if (error.code === "INVALID_IDEMPOTENCY_REPLAY") {
        throw new SupportCaseError("CONFLICT", error.message, 409, error.details);
      }
    }

    throw new SupportCaseError("INTERNAL_SERVER_ERROR", "Falha ao resolver caso de suporte.", 500);
  }
}
