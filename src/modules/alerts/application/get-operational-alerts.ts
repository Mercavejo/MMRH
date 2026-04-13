import {
  buildOperationalAlerts,
  normalizeOperationalAlertsFilters,
  type OperationalAlert,
  type OperationalAlertFilterInput,
} from "../domain/operational-alert";
import { listOperationalAlertsSourceRows } from "../infrastructure/alerts-repository";

export class OperationalAlertsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "OperationalAlertsError";
  }
}

function buildMetadata(alerts: OperationalAlert[]) {
  return {
    total: alerts.length,
    open_count: alerts.filter((alert) => alert.status === "open").length,
    in_treatment_count: alerts.filter((alert) => alert.status === "in_treatment").length,
    resolved_count: alerts.filter((alert) => alert.status === "resolved").length,
  };
}

export async function getOperationalAlerts(input: {
  tenantId: string;
  status?: string;
  severity?: string;
  from?: string;
  to?: string;
  batchId?: string;
}) {
  let filters: ReturnType<typeof normalizeOperationalAlertsFilters>;

  try {
    filters = normalizeOperationalAlertsFilters({
      status: input.status,
      severity: input.severity,
      from: input.from,
      to: input.to,
      batchId: input.batchId,
    } satisfies OperationalAlertFilterInput);
  } catch (error) {
    throw new OperationalAlertsError("VALIDATION_ERROR", (error as Error).message, 400);
  }

  const rows = await listOperationalAlertsSourceRows({ tenantId: input.tenantId, filters });
  const alerts = buildOperationalAlerts(rows, filters);

  return {
    alerts,
    metadata: buildMetadata(alerts),
    filters: {
      status: filters.status ?? null,
      severity: filters.severity ?? null,
      from: filters.from?.toISOString() ?? null,
      to: filters.to?.toISOString() ?? null,
      batch_id: filters.batchId ?? null,
    },
  };
}
