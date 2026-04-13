import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { batches, exceptionActions, exceptions, users } from "@/lib/db/schema";
import {
  buildExceptionQueueMetadata,
  hasIdempotencyHit,
  isExceptionEligibleForReprocess,
  type ReprocessBatchResult,
  type ReprocessExceptionItemResult,
  isValidExceptionStateTransition,
  type ExceptionCorrectionResult,
  type ExceptionDetail,
  type ExceptionPriority,
  type ExceptionQueueItem,
  type ExceptionQueueMetadata,
  type ExceptionState,
} from "../domain/exception";

export class ExceptionWorkflowError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ExceptionWorkflowError";
  }
}

async function resolveUserProfile(userId: string | null): Promise<{ name: string | null; email: string | null }> {
  if (!userId) {
    return { name: null, email: null };
  }

  const rows = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return rows[0] ?? { name: null, email: null };
}

async function resolveBatchName(batchId: string): Promise<string | null> {
  const rows = await db
    .select({ originalFilename: batches.originalFilename })
    .from(batches)
    .where(eq(batches.id, batchId))
    .limit(1);

  return rows[0]?.originalFilename ?? null;
}

function buildQueueItem(row: {
  id: string;
  batchId: string;
  documentExternalId: string;
  associatedEmployeeId: string | null;
  assocEmployeeExternalId: string | null;
  errorCategory: string;
  priority: string;
  currentState: string;
  recommendedAction: string | null;
  createdAt: Date;
  batchName: string | null;
}): ExceptionQueueItem {
  return {
    id: row.id,
    batch_id: row.batchId,
    batch_name: row.batchName ?? row.batchId,
    document_external_id: row.documentExternalId,
    // Do not reuse batch filename as document filename; this field is unknown in current schema.
    document_filename: null,
    associated_employee_id: row.associatedEmployeeId,
    assoc_employee_external_id: row.assocEmployeeExternalId,
    associated_employee_name: null,
    associated_employee_email: null,
    error_category: row.errorCategory as ExceptionQueueItem["error_category"],
    priority: row.priority as ExceptionPriority,
    current_state: row.currentState as ExceptionState,
    recommended_action: row.recommendedAction,
    created_at: row.createdAt.toISOString(),
  };
}

export async function listExceptionsForBatch(input: {
  tenantId: string;
  batchId: string;
  priority?: ExceptionPriority;
  state?: ExceptionState;
  skip: number;
  take: number;
}): Promise<{ exceptions: ExceptionQueueItem[]; metadata: ExceptionQueueMetadata }> {
  const batchRows = await db
    .select({ id: batches.id, tenantId: batches.tenantId, originalFilename: batches.originalFilename })
    .from(batches)
    .where(eq(batches.id, input.batchId))
    .limit(1);

  const batch = batchRows[0];
  if (!batch) {
    throw new ExceptionWorkflowError("BATCH_NOT_FOUND", "Lote nao encontrado.", 404);
  }

  if (batch.tenantId !== input.tenantId) {
    throw new ExceptionWorkflowError("FORBIDDEN", "Acesso negado para lote de outro tenant.", 403);
  }

  const conditions = [
    eq(exceptions.batchId, input.batchId),
    eq(exceptions.tenantId, input.tenantId),
  ];

  if (input.priority) {
    conditions.push(eq(exceptions.priority, input.priority));
  }

  if (input.state) {
    conditions.push(eq(exceptions.currentState, input.state));
  }

  const rows = await db
    .select({
      id: exceptions.id,
      batchId: exceptions.batchId,
      documentExternalId: exceptions.documentExternalId,
      associatedEmployeeId: exceptions.associatedEmployeeId,
      assocEmployeeExternalId: exceptions.assocEmployeeExternalId,
      errorCategory: exceptions.errorCategory,
      priority: exceptions.priority,
      currentState: exceptions.currentState,
      recommendedAction: exceptions.recommendedAction,
      createdAt: exceptions.createdAt,
    })
    .from(exceptions)
    .where(and(...conditions))
    .orderBy(asc(exceptions.createdAt))
    .limit(input.take)
    .offset(input.skip);

  const metadataRows = await db
    .select({ currentState: exceptions.currentState })
    .from(exceptions)
    .where(and(eq(exceptions.batchId, input.batchId), eq(exceptions.tenantId, input.tenantId)));

  return {
    exceptions: rows.map((row) =>
      buildQueueItem({
        id: row.id,
        batchId: row.batchId,
        documentExternalId: row.documentExternalId,
        associatedEmployeeId: row.associatedEmployeeId,
        assocEmployeeExternalId: row.assocEmployeeExternalId,
        errorCategory: row.errorCategory,
        priority: row.priority,
        currentState: row.currentState,
        recommendedAction: row.recommendedAction,
        createdAt: row.createdAt,
        batchName: batch.originalFilename,
      }),
    ),
    metadata: buildExceptionQueueMetadata(metadataRows),
  };
}

export async function getExceptionDetail(input: {
  tenantId: string;
  exceptionId: string;
}): Promise<ExceptionDetail | null> {
  const rows = await db
    .select({
      id: exceptions.id,
      batchId: exceptions.batchId,
      documentExternalId: exceptions.documentExternalId,
      associatedEmployeeId: exceptions.associatedEmployeeId,
      assocEmployeeExternalId: exceptions.assocEmployeeExternalId,
      routingAmbiguityDetails: exceptions.routingAmbiguityDetails,
      errorCategory: exceptions.errorCategory,
      priority: exceptions.priority,
      currentState: exceptions.currentState,
      recommendedAction: exceptions.recommendedAction,
      correctionApplied: exceptions.correctionApplied,
      correctionResult: exceptions.correctionResult,
      resolvedBy: exceptions.resolvedBy,
      resolvedAt: exceptions.resolvedAt,
      createdAt: exceptions.createdAt,
      updatedAt: exceptions.updatedAt,
    })
    .from(exceptions)
    .where(and(eq(exceptions.id, input.exceptionId), eq(exceptions.tenantId, input.tenantId)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  const batchName = await resolveBatchName(row.batchId);
  const associatedEmployee = await resolveUserProfile(row.associatedEmployeeId);
  const resolvedBy = await resolveUserProfile(row.resolvedBy);

  const actionRows = await db
    .select({
      id: exceptionActions.id,
      actionDescription: exceptionActions.actionDescription,
      expectedResult: exceptionActions.expectedResult,
      actorId: exceptionActions.actorId,
      performedAt: exceptionActions.performedAt,
    })
    .from(exceptionActions)
    .where(and(eq(exceptionActions.exceptionId, row.id), eq(exceptionActions.tenantId, input.tenantId)))
    .orderBy(desc(exceptionActions.performedAt));

  const actionHistory = await Promise.all(
    actionRows.map(async (action) => {
      const actor = await resolveUserProfile(action.actorId);

      return {
        id: action.id,
        action_description: action.actionDescription,
        expected_result: action.expectedResult as ExceptionCorrectionResult | null,
        actor_id: action.actorId,
        actor_name: actor.name,
        performed_at: action.performedAt.toISOString(),
      };
    }),
  );

  return {
    id: row.id,
    batch_id: row.batchId,
    batch_name: batchName ?? row.batchId,
    document_external_id: row.documentExternalId,
    document_filename: null,
    associated_employee_id: row.associatedEmployeeId,
    assoc_employee_external_id: row.assocEmployeeExternalId,
    associated_employee_name: associatedEmployee.name,
    associated_employee_email: associatedEmployee.email,
    error_category: row.errorCategory as ExceptionDetail["error_category"],
    priority: row.priority as ExceptionDetail["priority"],
    current_state: row.currentState as ExceptionDetail["current_state"],
    recommended_action: row.recommendedAction,
    error_details: row.routingAmbiguityDetails,
    correction_applied: row.correctionApplied,
    correction_result: row.correctionResult as ExceptionCorrectionResult | null,
    resolved_by: row.resolvedBy,
    resolved_by_name: resolvedBy.name,
    resolved_at: row.resolvedAt?.toISOString() ?? null,
    updated_at: row.updatedAt.toISOString(),
    created_at: row.createdAt.toISOString(),
    actions_history: actionHistory,
  };
}

export async function updateExceptionState(input: {
  tenantId: string;
  exceptionId: string;
  nextState: ExceptionState;
  note?: string;
  actorId: string;
}): Promise<{ exception_id: string; previous_state: ExceptionState; new_state: ExceptionState; updated_at: string }> {
  const rows = await db
    .select({ id: exceptions.id, currentState: exceptions.currentState })
    .from(exceptions)
    .where(and(eq(exceptions.id, input.exceptionId), eq(exceptions.tenantId, input.tenantId)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new ExceptionWorkflowError("EXCEPTION_NOT_FOUND", "Excecao nao encontrada.", 404);
  }

  if (!isValidExceptionStateTransition(row.currentState as ExceptionState, input.nextState)) {
    throw new ExceptionWorkflowError(
      "INVALID_STATE_TRANSITION",
      "Transicao de estado de excecao invalida.",
      409,
      { current_state: row.currentState, next_state: input.nextState },
    );
  }

  const updatedAt = new Date();
  await db
    .update(exceptions)
    .set({
      currentState: input.nextState,
      correctionApplied: input.note?.trim() || null,
      resolvedBy: input.nextState === "resolved" ? input.actorId : null,
      resolvedAt: input.nextState === "resolved" ? updatedAt : null,
      updatedAt,
    })
    .where(and(eq(exceptions.id, input.exceptionId), eq(exceptions.tenantId, input.tenantId)));

  return {
    exception_id: input.exceptionId,
    previous_state: row.currentState as ExceptionState,
    new_state: input.nextState,
    updated_at: updatedAt.toISOString(),
  };
}

export async function recordExceptionAction(input: {
  tenantId: string;
  exceptionId: string;
  actorId: string;
  actionDescription: string;
  expectedResult: ExceptionCorrectionResult;
}): Promise<{ action_id: string; exception_id: string; performed_at: string; actor_id: string; message: string }> {
  const rows = await db
    .select({ id: exceptions.id, currentState: exceptions.currentState })
    .from(exceptions)
    .where(and(eq(exceptions.id, input.exceptionId), eq(exceptions.tenantId, input.tenantId)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new ExceptionWorkflowError("EXCEPTION_NOT_FOUND", "Excecao nao encontrada.", 404);
  }

  if (!isValidExceptionStateTransition(row.currentState as ExceptionState, "in-treatment")) {
    throw new ExceptionWorkflowError(
      "INVALID_STATE_TRANSITION",
      "Transicao de estado de excecao invalida.",
      409,
      { current_state: row.currentState, next_state: "in-treatment" },
    );
  }

  const performedAt = new Date();
  const inserted = await db
    .insert(exceptionActions)
    .values({
      exceptionId: input.exceptionId,
      tenantId: input.tenantId,
      actionDescription: input.actionDescription,
      expectedResult: input.expectedResult,
      actorId: input.actorId,
      performedAt,
    })
    .returning({ id: exceptionActions.id });

  await db
    .update(exceptions)
    .set({
      currentState: "in-treatment",
      correctionApplied: input.actionDescription,
      correctionResult: input.expectedResult,
      updatedAt: performedAt,
    })
    .where(and(eq(exceptions.id, input.exceptionId), eq(exceptions.tenantId, input.tenantId)));

  return {
    action_id: inserted[0]?.id ?? input.exceptionId,
    exception_id: input.exceptionId,
    performed_at: performedAt.toISOString(),
    actor_id: input.actorId,
    message: "Acao registrada. Excecao marcada em tratamento.",
  };
}

export async function reprocessBatchExceptions(input: {
  tenantId: string;
  batchId: string;
  actorId: string;
  correlationId: string;
  idempotencyKey: string;
  exceptionIds?: string[];
}): Promise<ReprocessBatchResult> {
  const batchRows = await db
    .select({ id: batches.id, tenantId: batches.tenantId, validationStatus: batches.validationStatus })
    .from(batches)
    .where(eq(batches.id, input.batchId))
    .limit(1);

  const batch = batchRows[0];
  if (!batch) {
    throw new ExceptionWorkflowError("BATCH_NOT_FOUND", "Lote nao encontrado.", 404);
  }

  if (batch.tenantId !== input.tenantId) {
    throw new ExceptionWorkflowError("FORBIDDEN", "Acesso negado para lote de outro tenant.", 403);
  }

  const rows = await db
    .select({
      id: exceptions.id,
      currentState: exceptions.currentState,
      correctionResult: exceptions.correctionResult,
      lastReprocessIdempotencyKey: exceptions.lastReprocessIdempotencyKey,
      reprocessAttempts: exceptions.reprocessAttempts,
    })
    .from(exceptions)
    .where(and(eq(exceptions.batchId, input.batchId), eq(exceptions.tenantId, input.tenantId)));

  const rowsMap = new Map(rows.map((row) => [row.id, row]));
  const uniqueExceptionIds = input.exceptionIds?.length
    ? Array.from(new Set(input.exceptionIds))
    : undefined;

  const selectedRows = uniqueExceptionIds?.length
    ? uniqueExceptionIds
        .map((exceptionId) => rowsMap.get(exceptionId))
        .filter((row): row is (typeof rows)[number] => Boolean(row))
    : rows;

  if (uniqueExceptionIds?.length && selectedRows.length !== uniqueExceptionIds.length) {
    throw new ExceptionWorkflowError(
      "EXCEPTION_NOT_FOUND",
      "Uma ou mais excecoes nao pertencem ao lote informado.",
      404,
    );
  }

  const processedAt = new Date().toISOString();
  const itemResults: ReprocessExceptionItemResult[] = [];
  let totalReprocessed = 0;
  let totalResolved = 0;
  let totalFailed = 0;

  await db.transaction(async (tx) => {
    for (const row of selectedRows) {
      const previousState = row.currentState as ExceptionState;
      const correctionResult = row.correctionResult as ExceptionCorrectionResult | null;

      if (!isExceptionEligibleForReprocess({ current_state: previousState, correction_result: correctionResult })) {
        itemResults.push({
          exception_id: row.id,
          previous_state: previousState,
          current_state: previousState,
          status: "skipped",
          reason: "Item nao elegivel para reprocessamento.",
        });
        if (previousState !== "resolved") {
          totalFailed += 1;
        } else {
          totalResolved += 1;
        }
        continue;
      }

      if (hasIdempotencyHit(row.lastReprocessIdempotencyKey, input.idempotencyKey)) {
        itemResults.push({
          exception_id: row.id,
          previous_state: previousState,
          current_state: previousState,
          status: "idempotent",
          reason: "Requisicao idempotente reaproveitada.",
        });
        if (previousState === "resolved") {
          totalResolved += 1;
        }
        continue;
      }

      const now = new Date();
      await tx
        .update(exceptions)
        .set({
          currentState: "resolved",
          resolvedBy: input.actorId,
          resolvedAt: now,
          updatedAt: now,
          reprocessAttempts: (row.reprocessAttempts ?? 0) + 1,
          lastReprocessAt: now,
          lastReprocessCorrelationId: input.correlationId,
          lastReprocessIdempotencyKey: input.idempotencyKey,
        })
        .where(and(eq(exceptions.id, row.id), eq(exceptions.tenantId, input.tenantId)));

      totalReprocessed += 1;
      totalResolved += 1;
      itemResults.push({
        exception_id: row.id,
        previous_state: previousState,
        current_state: "resolved",
        status: "reprocessed",
        reason: null,
      });
    }
  });

  const totalRequested = selectedRows.length;
  let totalRemaining = 0;
  const totalEligible = selectedRows.filter((row) =>
    isExceptionEligibleForReprocess({
      current_state: row.currentState as ExceptionState,
      correction_result: row.correctionResult as ExceptionCorrectionResult | null,
    }),
  ).length;

  totalRemaining = Math.max(0, totalRequested - totalResolved);

  return {
    batch_id: input.batchId,
    idempotency_key: input.idempotencyKey,
    total_requested: totalRequested,
    total_eligible: totalEligible,
    total_reprocessed: totalReprocessed,
    total_resolved: totalResolved,
    total_remaining: totalRemaining,
    total_failed: totalFailed,
    items: itemResults,
    processed_at: processedAt,
  };
}