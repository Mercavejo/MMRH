import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema/audit-logs";
import { externalIngestions } from "@/lib/db/schema/external-ingestions";
import {
  buildExternalIngestionTimeline,
  classifyExternalIngestionFailure,
  type AuthorizedExternalSource,
  type ExternalIngestion,
  type ExternalIngestionFailureCode,
  type ExternalIngestionStatus,
  type NormalizedExternalIngestionFilters,
  type NormalizedExternalIngestionRegistration,
} from "../domain/external-ingestion";

type DbLike = typeof db;

export class ExternalIngestionRepositoryError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "DUPLICATE_INGESTION"
      | "TENANT_MISMATCH"
      | "INVALID_STATE_TRANSITION"
      | "PROCESSING_FAILURE",
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ExternalIngestionRepositoryError";
  }
}

function mapExternalIngestionRow(row: {
  id: string;
  tenantId: string;
  sourceSystem: string;
  contractVersion: string;
  sourceReference: string;
  idempotencyKey: string;
  status: ExternalIngestionStatus;
  validationResult: "success" | "failure";
  validationFailureCode: ExternalIngestionFailureCode | null;
  validatedAt: Date;
  payloadSummary: Record<string, unknown> | null;
  receivedAt: Date;
  processingStartedAt: Date | null;
  processedAt: Date | null;
  failedAt: Date | null;
  failureCode: ExternalIngestionFailureCode | null;
  recommendedAction: string | null;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
}): ExternalIngestion {
  return {
    ingestion_id: row.id,
    tenant_id: row.tenantId,
    source_system: row.sourceSystem as AuthorizedExternalSource,
    contract_version: row.contractVersion,
    source_reference: row.sourceReference,
    idempotency_key: row.idempotencyKey,
    status: row.status,
    contract_validation: {
      contract_version: row.contractVersion,
      validation_result: row.validationResult,
      failure_code: row.validationFailureCode,
      validated_at: row.validatedAt.toISOString(),
    },
    received_at: row.receivedAt.toISOString(),
    processing_started_at: row.processingStartedAt?.toISOString() ?? null,
    processed_at: row.processedAt?.toISOString() ?? null,
    failed_at: row.failedAt?.toISOString() ?? null,
    resolution: {
      failure_code: row.failureCode,
      recommended_action: row.recommendedAction,
    },
    correlation_id: row.correlationId,
    payload_summary: row.payloadSummary ?? {},
    timeline: buildExternalIngestionTimeline({
      ingestion_id: row.id,
      status: row.status,
      received_at: row.receivedAt.toISOString(),
      processing_started_at: row.processingStartedAt?.toISOString() ?? null,
      processed_at: row.processedAt?.toISOString() ?? null,
      failed_at: row.failedAt?.toISOString() ?? null,
    }),
  };
}

function mapDuplicateDetails(row: {
  id: string;
  status: ExternalIngestionStatus;
  sourceReference: string;
  idempotencyKey: string;
}) {
  return {
    ingestion_id: row.id,
    status: row.status,
    source_reference: row.sourceReference,
    idempotency_key: row.idempotencyKey,
  };
}

export async function registerExternalIngestionInDb(
  input: NormalizedExternalIngestionRegistration & { correlationId: string },
  dbClient: DbLike = db,
): Promise<ExternalIngestion> {
  const duplicateRows = await dbClient
    .select({
      id: externalIngestions.id,
      status: externalIngestions.status,
      sourceReference: externalIngestions.sourceReference,
      idempotencyKey: externalIngestions.idempotencyKey,
    })
    .from(externalIngestions)
    .where(
      and(
        eq(externalIngestions.tenantId, input.tenantId),
        eq(externalIngestions.sourceSystem, input.sourceSystem),
        or(
          eq(externalIngestions.idempotencyKey, input.idempotencyKey),
          eq(externalIngestions.sourceReference, input.sourceReference),
        ),
      ),
    )
    .limit(1);

  if (duplicateRows[0]) {
    const classification = classifyExternalIngestionFailure("DUPLICATE_INGESTION");

    await dbClient.insert(auditLogs).values({
      tenantId: input.tenantId,
      actorId: null,
      correlationId: input.correlationId,
      action: "integrations.external_ingestion.failed.v1",
      resourceType: "external_ingestion",
      resourceId: duplicateRows[0].id,
      status: "failure",
      details: {
        ingestion_id: duplicateRows[0].id,
        source_reference: duplicateRows[0].sourceReference,
        idempotency_key: duplicateRows[0].idempotencyKey,
        failure_code: "DUPLICATE_INGESTION",
        recommended_action: classification.recommended_action,
      },
    });

    throw new ExternalIngestionRepositoryError(
      "DUPLICATE_INGESTION",
      "Intake duplicado para a mesma origem e referencia.",
      409,
      {
        ...mapDuplicateDetails(duplicateRows[0]),
        failure_code: "DUPLICATE_INGESTION",
        recommended_action: classification.recommended_action,
      },
    );
  }

  const now = new Date();
  const rows = await dbClient
    .insert(externalIngestions)
    .values({
      tenantId: input.tenantId,
      sourceSystem: input.sourceSystem,
      contractVersion: input.contractVersion,
      sourceReference: input.sourceReference,
      idempotencyKey: input.idempotencyKey,
      status: "received",
      validationResult: "success",
      validationFailureCode: null,
      validatedAt: now,
      payloadSummary: input.payloadSummary,
      receivedAt: now,
      correlationId: input.correlationId,
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: externalIngestions.id,
      tenantId: externalIngestions.tenantId,
      sourceSystem: externalIngestions.sourceSystem,
      contractVersion: externalIngestions.contractVersion,
      sourceReference: externalIngestions.sourceReference,
      idempotencyKey: externalIngestions.idempotencyKey,
      status: externalIngestions.status,
      validationResult: externalIngestions.validationResult,
      validationFailureCode: externalIngestions.validationFailureCode,
      validatedAt: externalIngestions.validatedAt,
      payloadSummary: externalIngestions.payloadSummary,
      receivedAt: externalIngestions.receivedAt,
      processingStartedAt: externalIngestions.processingStartedAt,
      processedAt: externalIngestions.processedAt,
      failedAt: externalIngestions.failedAt,
      failureCode: externalIngestions.failureCode,
      recommendedAction: externalIngestions.recommendedAction,
      correlationId: externalIngestions.correlationId,
      createdAt: externalIngestions.createdAt,
      updatedAt: externalIngestions.updatedAt,
    });

  const row = rows[0];
  if (!row) {
    const classification = classifyExternalIngestionFailure("PROCESSING_FAILURE");

    await dbClient.insert(auditLogs).values({
      tenantId: input.tenantId,
      actorId: null,
      correlationId: input.correlationId,
      action: "integrations.external_ingestion.failed.v1",
      resourceType: "external_ingestion",
      resourceId: input.sourceReference,
      status: "failure",
      details: {
        source_reference: input.sourceReference,
        idempotency_key: input.idempotencyKey,
        failure_code: "PROCESSING_FAILURE",
        recommended_action: classification.recommended_action,
      },
    });

    throw new ExternalIngestionRepositoryError(
      "PROCESSING_FAILURE",
      "Falha ao registrar intake externo.",
      500,
      {
        failure_code: "PROCESSING_FAILURE",
        recommended_action: classification.recommended_action,
      },
    );
  }

  await dbClient.insert(auditLogs).values({
    tenantId: input.tenantId,
    actorId: null,
    correlationId: input.correlationId,
    action: "integrations.external_ingestion.received.v1",
    resourceType: "external_ingestion",
    resourceId: row.id,
    status: "success",
    details: {
      ingestion_id: row.id,
      source_system: row.sourceSystem,
      source_reference: row.sourceReference,
      idempotency_key: row.idempotencyKey,
      status: row.status,
    },
  });

  return mapExternalIngestionRow(row);
}

export async function listExternalIngestionsFromDb(
  input: {
    tenantId: string;
    filters: NormalizedExternalIngestionFilters;
    ingestionId?: string;
  },
  dbClient: DbLike = db,
): Promise<{
  ingestions: ExternalIngestion[];
  selectedIngestion: ExternalIngestion | null;
  metadata: {
    total: number;
    received_count: number;
    processing_count: number;
    processed_count: number;
    failed_count: number;
  };
}> {
  if (input.ingestionId) {
    const detailRows = await dbClient
      .select({
        id: externalIngestions.id,
        tenantId: externalIngestions.tenantId,
        sourceSystem: externalIngestions.sourceSystem,
        contractVersion: externalIngestions.contractVersion,
        sourceReference: externalIngestions.sourceReference,
        idempotencyKey: externalIngestions.idempotencyKey,
        status: externalIngestions.status,
        validationResult: externalIngestions.validationResult,
        validationFailureCode: externalIngestions.validationFailureCode,
        validatedAt: externalIngestions.validatedAt,
        payloadSummary: externalIngestions.payloadSummary,
        receivedAt: externalIngestions.receivedAt,
        processingStartedAt: externalIngestions.processingStartedAt,
        processedAt: externalIngestions.processedAt,
        failedAt: externalIngestions.failedAt,
        failureCode: externalIngestions.failureCode,
        recommendedAction: externalIngestions.recommendedAction,
        correlationId: externalIngestions.correlationId,
        createdAt: externalIngestions.createdAt,
        updatedAt: externalIngestions.updatedAt,
      })
      .from(externalIngestions)
      .where(eq(externalIngestions.id, input.ingestionId))
      .limit(1);

    const detail = detailRows[0];
    if (!detail) {
      return {
        ingestions: [],
        selectedIngestion: null,
        metadata: {
          total: 0,
          received_count: 0,
          processing_count: 0,
          processed_count: 0,
          failed_count: 0,
        },
      };
    }

    if (detail.tenantId !== input.tenantId) {
      throw new ExternalIngestionRepositoryError(
        "TENANT_MISMATCH",
        "Acesso negado para ingestao de outro tenant.",
        403,
      );
    }

    const mapped = mapExternalIngestionRow(detail);
    return {
      ingestions: [mapped],
      selectedIngestion: mapped,
      metadata: {
        total: 1,
        received_count: Number(mapped.status === "received"),
        processing_count: Number(mapped.status === "processing"),
        processed_count: Number(mapped.status === "processed"),
        failed_count: Number(mapped.status === "failed"),
      },
    };
  }

  const conditions = [eq(externalIngestions.tenantId, input.tenantId)];

  if (input.filters.status) {
    conditions.push(eq(externalIngestions.status, input.filters.status));
  }

  if (input.filters.sourceSystem) {
    conditions.push(eq(externalIngestions.sourceSystem, input.filters.sourceSystem));
  }

  const countRows = await dbClient
    .select({
      count: sql<number>`count(*)::int`,
      receivedCount: sql<number>`coalesce(sum(case when ${externalIngestions.status} = 'received' then 1 else 0 end), 0)::int`,
      processingCount: sql<number>`coalesce(sum(case when ${externalIngestions.status} = 'processing' then 1 else 0 end), 0)::int`,
      processedCount: sql<number>`coalesce(sum(case when ${externalIngestions.status} = 'processed' then 1 else 0 end), 0)::int`,
      failedCount: sql<number>`coalesce(sum(case when ${externalIngestions.status} = 'failed' then 1 else 0 end), 0)::int`,
    })
    .from(externalIngestions)
    .where(and(...conditions));

  const rows = await dbClient
    .select({
      id: externalIngestions.id,
      tenantId: externalIngestions.tenantId,
      sourceSystem: externalIngestions.sourceSystem,
      contractVersion: externalIngestions.contractVersion,
      sourceReference: externalIngestions.sourceReference,
      idempotencyKey: externalIngestions.idempotencyKey,
      status: externalIngestions.status,
      validationResult: externalIngestions.validationResult,
      validationFailureCode: externalIngestions.validationFailureCode,
      validatedAt: externalIngestions.validatedAt,
      payloadSummary: externalIngestions.payloadSummary,
      receivedAt: externalIngestions.receivedAt,
      processingStartedAt: externalIngestions.processingStartedAt,
      processedAt: externalIngestions.processedAt,
      failedAt: externalIngestions.failedAt,
      failureCode: externalIngestions.failureCode,
      recommendedAction: externalIngestions.recommendedAction,
      correlationId: externalIngestions.correlationId,
      createdAt: externalIngestions.createdAt,
      updatedAt: externalIngestions.updatedAt,
    })
    .from(externalIngestions)
    .where(and(...conditions))
    .orderBy(desc(externalIngestions.receivedAt), desc(externalIngestions.createdAt))
    .limit(20);

  const firstRow = rows[0] ?? null;

  return {
    ingestions: rows.map(mapExternalIngestionRow),
    selectedIngestion: firstRow ? mapExternalIngestionRow(firstRow) : null,
    metadata: {
      total: countRows[0]?.count ?? 0,
      received_count: countRows[0]?.receivedCount ?? 0,
      processing_count: countRows[0]?.processingCount ?? 0,
      processed_count: countRows[0]?.processedCount ?? 0,
      failed_count: countRows[0]?.failedCount ?? 0,
    },
  };
}
