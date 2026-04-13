export const ALERT_STATUSES = ["open", "in_treatment", "resolved"] as const;
export const ALERT_SEVERITIES = ["critical", "warning", "info"] as const;

export type OperationalAlertStatus = (typeof ALERT_STATUSES)[number];
export type OperationalAlertSeverity = (typeof ALERT_SEVERITIES)[number];

export type OperationalAlertFilterInput = {
  status?: string;
  severity?: string;
  from?: string;
  to?: string;
  batchId?: string;
};

export type NormalizedOperationalAlertFilters = {
  status?: OperationalAlertStatus;
  severity?: OperationalAlertSeverity;
  from?: Date;
  to?: Date;
  batchId?: string;
};

export type BatchAlertSourceRow = {
  id: string;
  tenantId: string;
  correlationId: string;
  validationStatus: string;
  routingStatus: string;
  routingTotalCount: number;
  routingMatchedCount: number;
  routingPendingCount: number;
  routingFailedCount: number;
  routingAmbiguousCount: number;
  publicationStatus: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  routingProcessedAt: Date | string | null;
  publishedAt: Date | string | null;
  organizationalUnit: string | null;
};

export type OperationalAlert = {
  id: string;
  batch_id: string;
  status: OperationalAlertStatus;
  severity: OperationalAlertSeverity;
  cause_code: string;
  recommended_action: string;
  detected_at: string;
  emitted_at: string;
  correlation_id: string;
  organizational_unit?: string | null;
  is_sla_breached: boolean;
};

function toDate(value: Date | string | null | undefined): Date {
  if (!value) {
    throw new Error("timestamp ausente.");
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("timestamp invalido.");
  }

  return parsed;
}

function toIso(value: Date): string {
  return value.toISOString();
}

function normalizeUuid(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(normalized)) {
    throw new Error("batch_id invalido.");
  }

  return normalized;
}

function normalizeDate(value: string | undefined, fieldName: string): Date | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} invalido.`);
  }

  return parsed;
}

function normalizeStatus(value: string | undefined): OperationalAlertStatus | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const normalized = value.trim() as OperationalAlertStatus;
  if (!ALERT_STATUSES.includes(normalized)) {
    throw new Error("status invalido.");
  }

  return normalized;
}

function normalizeSeverity(value: string | undefined): OperationalAlertSeverity | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const normalized = value.trim() as OperationalAlertSeverity;
  if (!ALERT_SEVERITIES.includes(normalized)) {
    throw new Error("severity invalida.");
  }

  return normalized;
}

export function normalizeOperationalAlertsFilters(
  input: OperationalAlertFilterInput,
): NormalizedOperationalAlertFilters {
  const from = normalizeDate(input.from, "from");
  const to = normalizeDate(input.to, "to");

  if (from && to && from.getTime() > to.getTime()) {
    throw new Error("Periodo invalido.");
  }

  return {
    status: normalizeStatus(input.status),
    severity: normalizeSeverity(input.severity),
    from,
    to,
    batchId: normalizeUuid(input.batchId),
  };
}

export function isValidAlertStatusTransition(
  previousStatus: OperationalAlertStatus,
  nextStatus: OperationalAlertStatus,
): boolean {
  if (previousStatus === "open") {
    return nextStatus === "in_treatment" || nextStatus === "resolved";
  }

  if (previousStatus === "in_treatment") {
    return nextStatus === "open" || nextStatus === "resolved";
  }

  return nextStatus === "open";
}

export function isAlertEmissionWithinSla(alert: Pick<OperationalAlert, "detected_at" | "emitted_at">): boolean {
  const detectedAt = new Date(alert.detected_at);
  const emittedAt = new Date(alert.emitted_at);

  if (Number.isNaN(detectedAt.getTime()) || Number.isNaN(emittedAt.getTime())) {
    return false;
  }

  const deltaMinutes = (emittedAt.getTime() - detectedAt.getTime()) / 60000;
  return deltaMinutes >= 0 && deltaMinutes <= 5;
}

function createAlert(params: {
  row: BatchAlertSourceRow;
  status: OperationalAlertStatus;
  severity: OperationalAlertSeverity;
  causeCode: string;
  recommendedAction: string;
  detectedAt: Date;
  emitDelayMinutes: number;
}): OperationalAlert {
  const emittedAt = new Date(params.detectedAt.getTime() + params.emitDelayMinutes * 60000);

  return {
    id: `${params.row.id}:${params.causeCode}:${params.status}`,
    batch_id: params.row.id,
    status: params.status,
    severity: params.severity,
    cause_code: params.causeCode,
    recommended_action: params.recommendedAction,
    detected_at: toIso(params.detectedAt),
    emitted_at: toIso(emittedAt),
    correlation_id: params.row.correlationId,
    organizational_unit: params.row.organizationalUnit,
    is_sla_breached: !isAlertEmissionWithinSla({
      detected_at: toIso(params.detectedAt),
      emitted_at: toIso(emittedAt),
    }),
  };
}

function buildRowAlerts(row: BatchAlertSourceRow): OperationalAlert[] {
  const detectedAt = toDate(row.routingProcessedAt ?? row.updatedAt ?? row.createdAt);
  const alerts: OperationalAlert[] = [];

  if (row.validationStatus === "blocked") {
    alerts.push(
      createAlert({
        row,
        status: "open",
        severity: "critical",
        causeCode: "VALIDATION_BLOCKED",
        recommendedAction: "Corrigir o arquivo e reenviar o lote para processamento.",
        detectedAt,
        emitDelayMinutes: 2,
      }),
    );
  }

  if (row.publicationStatus === "failed") {
    alerts.push(
      createAlert({
        row,
        status: "open",
        severity: "critical",
        causeCode: "PUBLICATION_FAILED",
        recommendedAction: "Reprocessar itens com falha e executar nova publicacao do lote.",
        detectedAt,
        emitDelayMinutes: 2,
      }),
    );
  }

  if (row.routingStatus === "blocked" || row.routingAmbiguousCount > 0) {
    alerts.push(
      createAlert({
        row,
        status: "in_treatment",
        severity: "warning",
        causeCode: "ROUTING_AMBIGUITY",
        recommendedAction: "Revisar ambiguidades na fila de excecoes e aplicar acao corretiva.",
        detectedAt,
        emitDelayMinutes: 3,
      }),
    );
  }

  if (row.routingFailedCount > 0 || row.routingPendingCount > 0) {
    alerts.push(
      createAlert({
        row,
        status: "in_treatment",
        severity: "warning",
        causeCode: "ROUTING_INCOMPLETE",
        recommendedAction: "Concluir tratamento das pendencias e monitorar o reprocessamento do lote.",
        detectedAt,
        emitDelayMinutes: 3,
      }),
    );
  }

  if (
    row.validationStatus === "validated" &&
    row.routingStatus === "completed" &&
    row.publicationStatus === "published" &&
    row.routingFailedCount === 0 &&
    row.routingPendingCount === 0 &&
    row.routingAmbiguousCount === 0
  ) {
    alerts.push(
      createAlert({
        row,
        status: "resolved",
        severity: "info",
        causeCode: "BATCH_STABLE",
        recommendedAction: "Lote estavel. Manter monitoramento regular de indicadores.",
        detectedAt: toDate(row.publishedAt ?? detectedAt),
        emitDelayMinutes: 1,
      }),
    );
  }

  return alerts;
}

export function buildOperationalAlerts(
  rows: BatchAlertSourceRow[],
  filters: NormalizedOperationalAlertFilters,
): OperationalAlert[] {
  const dedup = new Map<string, OperationalAlert>();

  for (const row of rows) {
    let rowAlerts: OperationalAlert[];

    try {
      rowAlerts = buildRowAlerts(row);
    } catch {
      continue;
    }

    for (const alert of rowAlerts) {
      if (filters.status && alert.status !== filters.status) {
        continue;
      }

      if (filters.severity && alert.severity !== filters.severity) {
        continue;
      }

      if (filters.from && new Date(alert.detected_at).getTime() < filters.from.getTime()) {
        continue;
      }

      if (filters.to && new Date(alert.detected_at).getTime() > filters.to.getTime()) {
        continue;
      }

      dedup.set(alert.id, alert);
    }
  }

  return [...dedup.values()].sort(
    (left, right) => new Date(right.detected_at).getTime() - new Date(left.detected_at).getTime(),
  );
}
