import { createPlanInDb, getPlanByCodeInDb } from "../infrastructure/plans-repository";
import { normalizeCommercialPlanInput } from "../domain/plans";

export class CommercialPlanError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CommercialPlanError";
  }
}

export async function createCommercialPlan(input: {
  planCode: string;
  displayName: string;
  description?: string | null;
  actorId: string;
  tenantId: string;
  correlationId: string;
}) {
  let normalized;

  try {
    normalized = normalizeCommercialPlanInput({
      planCode: input.planCode,
      displayName: input.displayName,
      description: input.description,
    });
  } catch (error) {
    throw new CommercialPlanError("VALIDATION_ERROR", (error as Error).message, 400);
  }

  const existing = await getPlanByCodeInDb(normalized.plan_code);
  if (existing) {
    return {
      plan: existing,
      mode: "noop" as const,
    };
  }

  const plan = await createPlanInDb({
    planCode: normalized.plan_code,
    displayName: normalized.display_name,
    description: normalized.description,
    actorId: input.actorId,
    tenantId: input.tenantId,
    correlationId: input.correlationId,
  });

  return {
    plan,
    mode: "create" as const,
  };
}
