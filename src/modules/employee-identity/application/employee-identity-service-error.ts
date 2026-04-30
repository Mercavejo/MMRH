export class EmployeeIdentityServiceError extends Error {
  constructor(
    public readonly code:
      | "VALIDATION_ERROR"
      | "DUPLICATE_REFERENCE_CODE"
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "CONFLICT"
      | "INTERNAL_SERVER_ERROR",
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EmployeeIdentityServiceError";
  }
}
