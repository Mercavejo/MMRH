import type { ExceptionPriority, ExceptionState } from "../domain/exception";
import { listExceptionsForBatch } from "../infrastructure/exception-repository";

export async function listBatchExceptions(input: {
  tenantId: string;
  batchId: string;
  priority?: ExceptionPriority;
  state?: ExceptionState;
  skip: number;
  take: number;
}) {
  return listExceptionsForBatch(input);
}