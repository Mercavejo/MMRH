import {
  buildOperationalIndicators,
  normalizeOperationalIndicatorsFilters,
  type OperationalIndicatorsFilterInput,
} from "../domain/operational-indicators";
import { getOperationalIndicatorsAggregateFromDb } from "../infrastructure/indicators-repository";

export class OperationalIndicatorsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "OperationalIndicatorsError";
  }
}

export async function getOperationalIndicators(input: {
  tenantId: string;
  batchId?: string;
  from?: string;
  to?: string;
  organizationalUnit?: string;
}) {
  let normalized: ReturnType<typeof normalizeOperationalIndicatorsFilters>;

  try {
    normalized = normalizeOperationalIndicatorsFilters({
      batchId: input.batchId,
      from: input.from,
      to: input.to,
      organizationalUnit: input.organizationalUnit,
    } satisfies OperationalIndicatorsFilterInput);
  } catch (error) {
    throw new OperationalIndicatorsError("VALIDATION_ERROR", (error as Error).message, 400);
  }

  const aggregate = await getOperationalIndicatorsAggregateFromDb({
    tenantId: input.tenantId,
    filters: normalized,
  });

  return {
    indicators: buildOperationalIndicators(aggregate),
    filters: {
      batch_id: normalized.batchId ?? null,
      from: normalized.from?.toISOString() ?? null,
      to: normalized.to?.toISOString() ?? null,
      organizational_unit: normalized.organizationalUnit ?? null,
    },
  };
}