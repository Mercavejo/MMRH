import { reprocessBatchExceptions } from "../infrastructure/exception-repository";

export async function reprocessExceptionsForBatch(input: {
  tenantId: string;
  batchId: string;
  actorId: string;
  correlationId: string;
  idempotencyKey: string;
  exceptionIds?: string[];
}) {
  return reprocessBatchExceptions(input);
}
