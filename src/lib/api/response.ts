export type ApiErrorBody = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ApiMeta = {
  correlation_id: string;
  timestamp?: string;
  tenant_id?: string;
};

export type ApiResponse<T> = {
  data: T | null;
  error: ApiErrorBody | null;
  meta: ApiMeta;
};

export function successResponse<T>(
  data: T,
  correlationId: string,
  tenantId?: string,
): ApiResponse<T> {
  return {
    data,
    error: null,
    meta: {
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
      tenant_id: tenantId,
    },
  };
}

export function errorResponse<T>(
  code: string,
  message: string,
  correlationId: string,
  details?: Record<string, unknown>,
  tenantId?: string,
): ApiResponse<T> {
  return {
    data: null,
    error: {
      code,
      message,
      details,
    },
    meta: {
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
      tenant_id: tenantId,
    },
  };
}
