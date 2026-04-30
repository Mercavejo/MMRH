export const exceptionErrorCategories = [
  "not-found",
  "invalid-format",
  "ambiguous-routing",
  "other",
] as const;

export const exceptionPriorities = ["high", "medium", "low"] as const;

export const exceptionStates = ["pending", "in-treatment", "resolved", "blocked"] as const;

export const exceptionCorrectionResults = [
  "reprocessable",
  "reject",
  "publish-with-evidence",
] as const;

export type ExceptionErrorCategory = (typeof exceptionErrorCategories)[number];
export type ExceptionPriority = (typeof exceptionPriorities)[number];
export type ExceptionState = (typeof exceptionStates)[number];
export type ExceptionCorrectionResult = (typeof exceptionCorrectionResults)[number];

export type ReprocessExceptionItemResult = {
  exception_id: string;
  previous_state: ExceptionState;
  current_state: ExceptionState;
  status: "reprocessed" | "idempotent" | "skipped";
  reason: string | null;
};

export type ReprocessBatchResult = {
  batch_id: string;
  idempotency_key: string;
  total_requested: number;
  total_eligible: number;
  total_reprocessed: number;
  total_resolved: number;
  total_remaining: number;
  total_failed: number;
  items: ReprocessExceptionItemResult[];
  processed_at: string;
};

export type ExceptionQueueItem = {
  id: string;
  batch_id: string;
  batch_name: string;
  document_external_id: string;
  document_filename: string | null;
  associated_employee_id: string | null;
  assoc_employee_external_id: string | null;
  associated_employee_name: string | null;
  associated_employee_email: string | null;
  error_category: ExceptionErrorCategory;
  priority: ExceptionPriority;
  current_state: ExceptionState;
  recommended_action: string | null;
  created_at: string;
};

export type ExceptionActionItem = {
  id: string;
  action_description: string;
  expected_result: ExceptionCorrectionResult | null;
  actor_id: string;
  actor_name: string | null;
  performed_at: string;
};

export type ExceptionDetail = ExceptionQueueItem & {
  error_details: Record<string, unknown> | null;
  correction_applied: string | null;
  correction_result: ExceptionCorrectionResult | null;
  resolved_by: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  updated_at: string;
  actions_history: ExceptionActionItem[];
};

export type ExceptionQueueMetadata = {
  total_count: number;
  pending_count: number;
  in_treatment_count: number;
  resolved_count: number;
  blocked_count: number;
};

const stateTransitions: Record<ExceptionState, readonly ExceptionState[]> = {
  pending: ["pending", "in-treatment", "resolved", "blocked"],
  "in-treatment": ["in-treatment", "resolved", "blocked"],
  resolved: ["resolved"],
  blocked: ["blocked", "in-treatment"],
};

export function isValidExceptionStateTransition(
  currentState: ExceptionState,
  nextState: ExceptionState,
): boolean {
  return stateTransitions[currentState].includes(nextState);
}

export function buildExceptionQueueMetadata(
  items: Array<{ current_state: ExceptionState }>,
): ExceptionQueueMetadata {
  return items.reduce<ExceptionQueueMetadata>(
    (accumulator, item) => {
      accumulator.total_count += 1;
      if (item.current_state === "pending") accumulator.pending_count += 1;
      if (item.current_state === "in-treatment") accumulator.in_treatment_count += 1;
      if (item.current_state === "resolved") accumulator.resolved_count += 1;
      if (item.current_state === "blocked") accumulator.blocked_count += 1;
      return accumulator;
    },
    {
      total_count: 0,
      pending_count: 0,
      in_treatment_count: 0,
      resolved_count: 0,
      blocked_count: 0,
    },
  );
}

export function getExceptionPriorityLabel(priority: ExceptionPriority): string {
  if (priority === "high") return "Alta";
  if (priority === "medium") return "Media";
  return "Baixa";
}

export function getExceptionStateLabel(state: ExceptionState): string {
  if (state === "pending") return "Pendente";
  if (state === "in-treatment") return "Em tratamento";
  if (state === "resolved") return "Resolvido";
  return "Bloqueado";
}

export function getExceptionErrorCategoryLabel(category: ExceptionErrorCategory): string {
  if (category === "not-found") return "Nao encontrado";
  if (category === "invalid-format") return "Formato invalido";
  if (category === "ambiguous-routing") return "Roteamento ambiguo";
  return "Outro";
}

export function isExceptionEligibleForReprocess(input: {
  current_state: ExceptionState;
  correction_result: ExceptionCorrectionResult | null;
}): boolean {
  return input.current_state === "in-treatment" && input.correction_result === "reprocessable";
}

export function hasIdempotencyHit(
  lastIdempotencyKey: string | null,
  currentIdempotencyKey: string,
): boolean {
  return Boolean(lastIdempotencyKey) && lastIdempotencyKey === currentIdempotencyKey;
}