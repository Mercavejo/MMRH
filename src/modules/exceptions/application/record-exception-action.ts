import { recordExceptionAction } from "../infrastructure/exception-repository";

export async function recordCorrectiveExceptionAction(input: {
  tenantId: string;
  exceptionId: string;
  actorId: string;
  actionDescription: string;
  expectedResult: "reprocessable" | "reject" | "publish-with-evidence";
}) {
  return recordExceptionAction(input);
}