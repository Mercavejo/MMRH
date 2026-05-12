import { db } from "@/lib/db/client";
import { buildDomainEvent, publishDomainEvent } from "@/lib/events/publisher";
import {
  EmployeeDocumentPublicationError,
  type PublishEmployeeDocumentsResult,
  publishEmployeeDocumentsForBatch,
} from "@/lib/documents/publish-employee-documents";
import { buildBatchRoutingProgressFromRecord } from "@/lib/rh/batches/batch-progress";
import { writeBatchPublicationAudit } from "@/lib/rh/batches/publish-audit";
import {
  countPublishedDocumentsForBatch,
  loadBatchPublicationExceptions,
  loadBatchPublicationSnapshot,
  markBatchPublicationFailed,
  markBatchPublicationStarting,
  markBatchPublicationSucceeded,
  type BatchPublicationSnapshot,
} from "../infrastructure/batch-repository";

export class BatchPublicationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "BatchPublicationError";
  }
}

export type PublishBatchResult = ReturnType<typeof buildBatchRoutingProgressFromRecord> & {
  total_requested: number;
  total_published: number;
  total_skipped: number;
  total_failed: number;
  skipped_reference_codes?: string[];
};

function mapPublicationFailure(error: unknown): BatchPublicationError | null {
  if (error instanceof EmployeeDocumentPublicationError) {
    const statusCode =
      error.code === "PUBLICATION_SOURCE_ARTIFACT_MISSING" ||
      error.code === "PUBLICATION_ARTIFACT_UNAVAILABLE"
        ? 503
        : 409;

    return new BatchPublicationError(error.code, error.message, statusCode, error.details);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    typeof (error as { cause?: unknown }).cause === "object" &&
    (error as { cause?: { code?: string; message?: string } }).cause?.code === "42P01" &&
    (error as { cause?: { message?: string } }).cause?.message?.includes("employee_identities")
  ) {
    return new BatchPublicationError(
      "PUBLICATION_DEPENDENCY_UNAVAILABLE",
      "Cadastro funcional indisponivel para publicar lote.",
      409,
      {
        relation: "employee_identities",
      },
    );
  }

  return null;
}

function buildPublishedResult(
  snapshot: BatchPublicationSnapshot,
  publishedCount: number,
  skippedReferenceCodes: string[] = [],
): PublishBatchResult {
  const routingProgress = buildBatchRoutingProgressFromRecord({
    id: snapshot.id,
    tenantId: snapshot.tenantId,
    routingStatus: snapshot.routingStatus as "pending" | "processing" | "blocked" | "completed" | "failed",
    routingTotalCount: snapshot.routingTotalCount,
    routingMatchedCount: snapshot.routingMatchedCount,
    routingPendingCount: snapshot.routingPendingCount,
    routingFailedCount: snapshot.routingFailedCount,
    routingAmbiguousCount: snapshot.routingAmbiguousCount,
    routingBlockedReason: snapshot.routingBlockedReason,
    routingProcessedAt: snapshot.routingProcessedAt,
    publicationStatus: snapshot.publicationStatus as "pending" | "publishing" | "published" | "failed",
    publicationAttempts: snapshot.publicationAttempts,
    publishedAt: snapshot.publishedAt,
    publishedBy: snapshot.publishedBy,
    lastPublicationCorrelationId: snapshot.lastPublicationCorrelationId,
    lastPublicationIdempotencyKey: snapshot.lastPublicationIdempotencyKey,
    lastPublicationError: snapshot.lastPublicationError,
  });

  return {
    ...routingProgress,
    total_requested: snapshot.routingTotalCount,
    total_published: publishedCount,
    total_skipped: Math.max(0, snapshot.routingTotalCount - publishedCount),
    total_failed: 0,
    published_documents: publishedCount,
    skipped_documents: Math.max(0, snapshot.routingTotalCount - publishedCount),
    skipped_reference_codes: skippedReferenceCodes,
  };
}

export async function publishBatch(input: {
  tenantId: string;
  batchId: string;
  actorId: string;
  correlationId: string;
  idempotencyKey: string;
  skipMissingTargets?: boolean;
}, dbClient = db): Promise<PublishBatchResult> {
  const snapshot = await loadBatchPublicationSnapshot(
    { tenantId: input.tenantId, batchId: input.batchId },
    dbClient,
  );

  if (!snapshot) {
    throw new BatchPublicationError("NOT_FOUND", "Lote nao encontrado.", 404);
  }

  if (snapshot.tenantId !== input.tenantId) {
    throw new BatchPublicationError("FORBIDDEN", "Acesso negado para lote de outro tenant.", 403);
  }

  if (snapshot.publicationStatus === "published") {
    if (snapshot.lastPublicationIdempotencyKey === input.idempotencyKey) {
      const publishedCount = await countPublishedDocumentsForBatch(
        { tenantId: input.tenantId, batchId: input.batchId },
        dbClient,
      );

      return buildPublishedResult(snapshot, publishedCount);
    }

    throw new BatchPublicationError(
      "BATCH_ALREADY_PUBLISHED",
      "O lote ja foi publicado.",
      409,
      {
        publication_status: snapshot.publicationStatus,
        last_publication_idempotency_key: snapshot.lastPublicationIdempotencyKey,
      },
    );
  }

  if (snapshot.publicationStatus === "publishing") {
    if (snapshot.lastPublicationIdempotencyKey === input.idempotencyKey) {
      throw new BatchPublicationError(
        "BATCH_PUBLICATION_IN_PROGRESS",
        "A publicacao deste lote ja esta em andamento.",
        409,
        {
          publication_status: snapshot.publicationStatus,
          last_publication_idempotency_key: snapshot.lastPublicationIdempotencyKey,
        },
      );
    }

    throw new BatchPublicationError(
      "BATCH_PUBLICATION_IN_PROGRESS",
      "A publicacao deste lote ja esta em andamento.",
      409,
      {
        publication_status: snapshot.publicationStatus,
        last_publication_idempotency_key: snapshot.lastPublicationIdempotencyKey,
      },
    );
  }

  if (snapshot.validationStatus !== "validated" || snapshot.routingStatus !== "completed") {
    throw new BatchPublicationError(
      "INVALID_BATCH_STATE",
      "Lote nao esta pronto para publicacao.",
      409,
      {
        validation_status: snapshot.validationStatus,
        routing_status: snapshot.routingStatus,
      },
    );
  }

  const exceptionRows = await loadBatchPublicationExceptions(
    { tenantId: input.tenantId, batchId: input.batchId },
    dbClient,
  );

  const unresolvedStates = exceptionRows.filter(
    (row) => row.currentState !== "resolved",
  );

  if (unresolvedStates.length > 0) {
    throw new BatchPublicationError(
      "INVALID_BATCH_STATE",
      "Lote possui excecoes pendentes, em tratamento ou bloqueadas.",
      409,
      {
        total_exceptions: exceptionRows.length,
        unresolved_exceptions: unresolvedStates.length,
      },
    );
  }

  let reservation: BatchPublicationSnapshot | null;
  let publicationResult: PublishEmployeeDocumentsResult | null = null;

  try {
    reservation = await dbClient.transaction(async (transaction) => {
      const startedSnapshot = await markBatchPublicationStarting(
        {
          tenantId: input.tenantId,
          batchId: input.batchId,
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
          currentPublicationAttempts: snapshot.publicationAttempts,
        },
        transaction,
      );

      if (!startedSnapshot) {
        return null;
      }

      publicationResult = await publishEmployeeDocumentsForBatch(
        {
          tenantId: input.tenantId,
          batchId: input.batchId,
          sourceStorageKey: snapshot.sourceStorageKey,
          sourceStorageFilename: snapshot.sourceStorageFilename,
          sourceStorageMimeType: snapshot.sourceStorageMimeType,
          sourceContentBase64: snapshot.sourceContentBase64,
          routingManifest: snapshot.routingManifest,
          skipMissingTargets: input.skipMissingTargets,
        },
        transaction,
      );

      await markBatchPublicationSucceeded(
        {
          tenantId: input.tenantId,
          batchId: input.batchId,
          actorId: input.actorId,
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
        },
        transaction,
      );

      return startedSnapshot;
    });
  } catch (error) {
    const mappedError = mapPublicationFailure(error);

    if (mappedError) {
      await markBatchPublicationFailed(
        {
          tenantId: input.tenantId,
          batchId: input.batchId,
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
          errorMessage: mappedError.message,
        },
        dbClient,
      );

      throw mappedError;
    }

    throw error;
  }

  if (!reservation) {
    const currentSnapshot = await loadBatchPublicationSnapshot(
      { tenantId: input.tenantId, batchId: input.batchId },
      dbClient,
    );

    if (currentSnapshot?.publicationStatus === "published" && currentSnapshot.lastPublicationIdempotencyKey === input.idempotencyKey) {
      const publishedCount = await countPublishedDocumentsForBatch(
        { tenantId: input.tenantId, batchId: input.batchId },
        dbClient,
      );

      return buildPublishedResult(currentSnapshot, publishedCount);
    }

    throw new BatchPublicationError(
      "BATCH_PUBLICATION_IN_PROGRESS",
      "A publicacao deste lote ja esta em andamento.",
      409,
      {
        publication_status: currentSnapshot?.publicationStatus ?? snapshot.publicationStatus,
        last_publication_idempotency_key:
          currentSnapshot?.lastPublicationIdempotencyKey ?? snapshot.lastPublicationIdempotencyKey,
      },
    );
  }

  const publicationSummary = publicationResult as PublishEmployeeDocumentsResult | null;
  const publishedCount = publicationSummary
    ? publicationSummary.publishedCount
    : await countPublishedDocumentsForBatch(
        { tenantId: input.tenantId, batchId: input.batchId },
        dbClient,
      );
  const totalSkipped = Math.max(0, snapshot.routingTotalCount - publishedCount);

  await writeBatchPublicationAudit(
    {
      tenantId: input.tenantId,
      actorId: input.actorId,
      correlationId: input.correlationId,
      batchId: input.batchId,
      status: "success",
      stage: "started",
      details: {
        total_requested: snapshot.routingTotalCount,
        total_published: publishedCount,
        total_skipped: totalSkipped,
        total_failed: 0,
        idempotency_key: input.idempotencyKey,
        skipped_reference_codes: publicationSummary?.skippedReferenceCodes ?? [],
      },
    },
    dbClient,
  );

  try {
    await publishDomainEvent(
      buildDomainEvent({
        event_name: "rh.batch.published.v1",
        event_version: "v1",
        occurred_at: new Date().toISOString(),
        correlation_id: input.correlationId,
        tenant_id: input.tenantId,
        actor: {
          actor_id: input.actorId,
          actor_role: "rh_operator",
        },
        payload: {
          batch_id: input.batchId,
          publication_status: "published",
          total_requested: snapshot.routingTotalCount,
          total_published: publishedCount,
          total_skipped: totalSkipped,
          idempotency_key: input.idempotencyKey,
        },
      }),
    );
  } catch {
    // Publication state is already durable; event emission is best-effort.
  }

  await writeBatchPublicationAudit(
    {
      tenantId: input.tenantId,
      actorId: input.actorId,
      correlationId: input.correlationId,
      batchId: input.batchId,
      status: "success",
      stage: "finished",
      details: {
        total_requested: snapshot.routingTotalCount,
        total_published: publishedCount,
        total_skipped: totalSkipped,
        total_failed: 0,
        idempotency_key: input.idempotencyKey,
        skipped_reference_codes: publicationSummary?.skippedReferenceCodes ?? [],
      },
    },
    dbClient,
  );

  const refreshed = await loadBatchPublicationSnapshot(
    { tenantId: input.tenantId, batchId: input.batchId },
    dbClient,
  );

  if (!refreshed) {
    throw new BatchPublicationError("NOT_FOUND", "Lote nao encontrado.", 404);
  }

  return buildPublishedResult(
    refreshed,
    publishedCount,
    publicationSummary?.skippedReferenceCodes ?? [],
  );
}
