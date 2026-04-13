export type OperationalIndicatorsFilterInput = {
  batchId?: string;
  from?: string;
  to?: string;
  organizationalUnit?: string;
};

export type NormalizedOperationalIndicatorsFilters = {
  batchId?: string;
  from?: Date;
  to?: Date;
  organizationalUnit?: string;
};

export type OperationalIndicatorsAggregate = {
  totalBatches: number;
  publishedBatches: number;
  routingTotalCount: number;
  routingMatchedCount: number;
  pendingItems: number;
  ambiguousItems: number;
};

export type OperationalIndicators = {
  deliveryRate: number;
  routingAccuracy: number;
  pendingCount: number;
  totals: {
    totalBatches: number;
    publishedBatches: number;
    routingTotalItems: number;
    routingMatchedItems: number;
  };
};

function parseIsoDate(value: string | undefined, label: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} invalido.`);
  }

  return parsed;
}

function normalizeString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function normalizeOperationalIndicatorsFilters(
  input: OperationalIndicatorsFilterInput,
): NormalizedOperationalIndicatorsFilters {
  const from = parseIsoDate(input.from, "from");
  const to = parseIsoDate(input.to, "to");

  if (from && to && from.getTime() > to.getTime()) {
    throw new Error("Periodo invalido.");
  }

  return {
    batchId: normalizeString(input.batchId),
    from,
    to,
    organizationalUnit: normalizeString(input.organizationalUnit),
  };
}

function toRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  const value = numerator / denominator;
  return Number.isFinite(value) ? Number(value.toFixed(4)) : 0;
}

export function buildOperationalIndicators(
  aggregate: OperationalIndicatorsAggregate,
): OperationalIndicators {
  const pendingCount = Math.max(0, aggregate.pendingItems + aggregate.ambiguousItems);

  return {
    deliveryRate: toRatio(aggregate.publishedBatches, aggregate.totalBatches),
    routingAccuracy: toRatio(aggregate.routingMatchedCount, aggregate.routingTotalCount),
    pendingCount,
    totals: {
      totalBatches: Math.max(0, aggregate.totalBatches),
      publishedBatches: Math.max(0, aggregate.publishedBatches),
      routingTotalItems: Math.max(0, aggregate.routingTotalCount),
      routingMatchedItems: Math.max(0, aggregate.routingMatchedCount),
    },
  };
}