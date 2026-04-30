import { z } from "zod";

export const BATCH_ROUTING_STATUSES = [
  "pending",
  "processing",
  "blocked",
  "completed",
  "failed",
] as const;

export const BATCH_PUBLICATION_STATUSES = [
  "pending",
  "publishing",
  "published",
  "failed",
] as const;

export type BatchRoutingStatus = (typeof BATCH_ROUTING_STATUSES)[number];
export type BatchPublicationStatus = (typeof BATCH_PUBLICATION_STATUSES)[number];

export const batchRoutingProgressSchema = z.object({
  batch_id: z.string().trim().min(1),
  tenant_id: z.string().trim().min(1),
  routing_status: z.enum(BATCH_ROUTING_STATUSES),
  total_documents: z.number().int().nonnegative(),
  matched_documents: z.number().int().nonnegative(),
  pending_documents: z.number().int().nonnegative(),
  failed_documents: z.number().int().nonnegative(),
  ambiguous_documents: z.number().int().nonnegative(),
  blocked_documents: z.number().int().nonnegative(),
  processed_at: z.string().datetime().nullable(),
  blocked_reason: z.string().trim().nullable(),
  publication_status: z.enum(BATCH_PUBLICATION_STATUSES).nullable().optional(),
  publication_attempts: z.number().int().nonnegative().optional(),
  published_at: z.string().datetime().nullable().optional(),
  published_by: z.string().trim().nullable().optional(),
  last_publication_correlation_id: z.string().trim().nullable().optional(),
  last_publication_idempotency_key: z.string().trim().nullable().optional(),
  last_publication_error: z.string().trim().nullable().optional(),
});

export type BatchRoutingProgress = z.infer<typeof batchRoutingProgressSchema>;

export function buildEmptyBatchRoutingProgress(): BatchRoutingProgress {
  return {
    batch_id: "",
    tenant_id: "",
    routing_status: "pending",
    total_documents: 0,
    matched_documents: 0,
    pending_documents: 0,
    failed_documents: 0,
    ambiguous_documents: 0,
    blocked_documents: 0,
    processed_at: null,
    blocked_reason: null,
    publication_status: "pending",
    publication_attempts: 0,
    published_at: null,
    published_by: null,
    last_publication_correlation_id: null,
    last_publication_idempotency_key: null,
    last_publication_error: null,
  };
}

export function buildPendingBatchRoutingProgress(params: {
  batchId: string;
  tenantId: string;
  totalDocuments: number;
}): BatchRoutingProgress {
  return {
    batch_id: params.batchId,
    tenant_id: params.tenantId,
    routing_status: "pending",
    total_documents: params.totalDocuments,
    matched_documents: 0,
    pending_documents: params.totalDocuments,
    failed_documents: 0,
    ambiguous_documents: 0,
    blocked_documents: 0,
    processed_at: null,
    blocked_reason: null,
    publication_status: "pending",
    publication_attempts: 0,
    published_at: null,
    published_by: null,
    last_publication_correlation_id: null,
    last_publication_idempotency_key: null,
    last_publication_error: null,
  };
}

export function buildBatchRoutingProgressFromRecord(record: {
  id: string;
  tenantId: string;
  routingStatus: BatchRoutingStatus;
  routingTotalCount: number;
  routingMatchedCount: number;
  routingPendingCount: number;
  routingFailedCount: number;
  routingAmbiguousCount: number;
  routingBlockedReason: string | null;
  routingProcessedAt: Date | string | null;
  publicationStatus?: BatchPublicationStatus | null;
  publicationAttempts?: number | null;
  publishedAt?: Date | string | null;
  publishedBy?: string | null;
  lastPublicationCorrelationId?: string | null;
  lastPublicationIdempotencyKey?: string | null;
  lastPublicationError?: string | null;
}): BatchRoutingProgress {
  return {
    batch_id: record.id,
    tenant_id: record.tenantId,
    routing_status: record.routingStatus,
    total_documents: record.routingTotalCount,
    matched_documents: record.routingMatchedCount,
    pending_documents: record.routingPendingCount,
    failed_documents: record.routingFailedCount,
    ambiguous_documents: record.routingAmbiguousCount,
    blocked_documents: record.routingAmbiguousCount,
    processed_at:
      record.routingProcessedAt instanceof Date
        ? record.routingProcessedAt.toISOString()
        : typeof record.routingProcessedAt === "string"
          ? record.routingProcessedAt
          : null,
    blocked_reason: record.routingBlockedReason,
    publication_status: record.publicationStatus ?? "pending",
    publication_attempts: record.publicationAttempts ?? 0,
    published_at:
      record.publishedAt instanceof Date
        ? record.publishedAt.toISOString()
        : typeof record.publishedAt === "string"
          ? record.publishedAt
          : null,
    published_by: record.publishedBy ?? null,
    last_publication_correlation_id: record.lastPublicationCorrelationId ?? null,
    last_publication_idempotency_key: record.lastPublicationIdempotencyKey ?? null,
    last_publication_error: record.lastPublicationError ?? null,
  };
}