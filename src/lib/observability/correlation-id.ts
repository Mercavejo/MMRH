export const CORRELATION_ID_HEADER = "x-correlation-id";

export function resolveCorrelationId(input?: string | null): string {
  if (!input || input.trim().length === 0) {
    return crypto.randomUUID();
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidPattern.test(input.trim()) ? input.trim() : crypto.randomUUID();
}
