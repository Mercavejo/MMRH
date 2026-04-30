export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const ErrorCode = {
  ValidationError: "VALIDATION_ERROR",
  Unauthorized: "UNAUTHORIZED",
  Forbidden: "FORBIDDEN",
  CapabilityForbidden: "CAPABILITY_FORBIDDEN",
  NotFound: "NOT_FOUND",
  InternalServerError: "INTERNAL_SERVER_ERROR",
} as const;

export function buildCapabilityForbiddenDetails(params: {
  capability: string;
  planCode: string;
  correlationId: string;
  upgradeHint?: string;
}): Record<string, unknown> {
  const details: Record<string, unknown> = {
    capability: params.capability,
    planCode: params.planCode,
    plan_code: params.planCode,
    correlation_id: params.correlationId,
  };

  if (params.upgradeHint) {
    details.upgrade_hint = params.upgradeHint;
  }

  return details;
}
