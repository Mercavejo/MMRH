export const CORRELATION_ID_HEADER = "x-correlation-id";

export function resolveCorrelationId(input?: string | null): string {
  return input && input.trim().length > 0 ? input : crypto.randomUUID();
}
