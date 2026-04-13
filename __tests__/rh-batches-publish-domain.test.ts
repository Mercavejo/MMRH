import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishBatch, BatchPublicationError } from "@/modules/batches/application/publish-batch";

const {
  loadBatchPublicationSnapshotMock,
  loadBatchPublicationExceptionsMock,
  markBatchPublicationStartingMock,
  markBatchPublicationSucceededMock,
  markBatchPublicationFailedMock,
  writeBatchPublicationAuditMock,
  buildDomainEventMock,
  publishDomainEventMock,
} = vi.hoisted(() => ({
  loadBatchPublicationSnapshotMock: vi.fn(),
  loadBatchPublicationExceptionsMock: vi.fn(),
  markBatchPublicationStartingMock: vi.fn(),
  markBatchPublicationSucceededMock: vi.fn(),
  markBatchPublicationFailedMock: vi.fn(),
  writeBatchPublicationAuditMock: vi.fn(),
  buildDomainEventMock: vi.fn((event) => event),
  publishDomainEventMock: vi.fn(async (event) => event),
}));

vi.mock("@/modules/batches/infrastructure/batch-repository", () => ({
  loadBatchPublicationSnapshot: loadBatchPublicationSnapshotMock,
  loadBatchPublicationExceptions: loadBatchPublicationExceptionsMock,
  markBatchPublicationStarting: markBatchPublicationStartingMock,
  markBatchPublicationSucceeded: markBatchPublicationSucceededMock,
  markBatchPublicationFailed: markBatchPublicationFailedMock,
}));

vi.mock("@/lib/rh/batches/publish-audit", () => ({
  writeBatchPublicationAudit: writeBatchPublicationAuditMock,
}));

vi.mock("@/lib/events/publisher", () => ({
  buildDomainEvent: buildDomainEventMock,
  publishDomainEvent: publishDomainEventMock,
}));

describe("publish batch domain", () => {
  const transactionClient = {};
  const dbClient = {
    transaction: vi.fn(async (callback: (transaction: typeof transactionClient) => Promise<void>) => {
      return callback(transactionClient);
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    loadBatchPublicationSnapshotMock
      .mockResolvedValueOnce({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        tenantId: "11111111-1111-4111-8111-111111111111",
        validationStatus: "validated",
        routingStatus: "completed",
        routingTotalCount: 2,
        routingMatchedCount: 2,
        routingPendingCount: 0,
        routingFailedCount: 0,
        routingAmbiguousCount: 0,
        routingBlockedReason: null,
        routingProcessedAt: "2026-04-13T12:00:00.000Z",
        publicationStatus: "pending",
        publicationAttempts: 0,
        publishedAt: null,
        publishedBy: null,
        lastPublicationCorrelationId: null,
        lastPublicationIdempotencyKey: null,
        lastPublicationError: null,
      })
      .mockResolvedValueOnce({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        tenantId: "11111111-1111-4111-8111-111111111111",
        validationStatus: "validated",
        routingStatus: "completed",
        routingTotalCount: 2,
        routingMatchedCount: 2,
        routingPendingCount: 0,
        routingFailedCount: 0,
        routingAmbiguousCount: 0,
        routingBlockedReason: null,
        routingProcessedAt: "2026-04-13T12:00:00.000Z",
        publicationStatus: "published",
        publicationAttempts: 1,
        publishedAt: "2026-04-13T12:05:00.000Z",
        publishedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        lastPublicationCorrelationId: "11111111-1111-4111-8111-111111111111",
        lastPublicationIdempotencyKey: "idem-123456",
        lastPublicationError: null,
      });

    loadBatchPublicationExceptionsMock.mockResolvedValue([]);
    writeBatchPublicationAuditMock.mockResolvedValue(undefined);
    markBatchPublicationStartingMock.mockResolvedValue({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantId: "11111111-1111-4111-8111-111111111111",
      validationStatus: "validated",
      routingStatus: "completed",
      routingTotalCount: 2,
      routingMatchedCount: 2,
      routingPendingCount: 0,
      routingFailedCount: 0,
      routingAmbiguousCount: 0,
      routingBlockedReason: null,
      routingProcessedAt: "2026-04-13T12:00:00.000Z",
      publicationStatus: "publishing",
      publicationAttempts: 1,
      publishedAt: null,
      publishedBy: null,
      lastPublicationCorrelationId: "11111111-1111-4111-8111-111111111111",
      lastPublicationIdempotencyKey: "idem-123456",
      lastPublicationError: null,
    });
    markBatchPublicationSucceededMock.mockResolvedValue(undefined);
    markBatchPublicationFailedMock.mockResolvedValue(undefined);
  });

  it("publishes a ready batch and records audit events", async () => {
    const result = await publishBatch(
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        correlationId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "idem-123456",
      },
      dbClient as never,
    );

    expect(result.publication_status).toBe("published");
    expect(result.total_published).toBe(2);
    expect(dbClient.transaction).toHaveBeenCalledTimes(1);
    expect(markBatchPublicationStartingMock).toHaveBeenCalledWith(
      expect.objectContaining({ currentPublicationAttempts: 0 }),
      transactionClient,
    );
    expect(markBatchPublicationSucceededMock).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "idem-123456" }),
      transactionClient,
    );
    expect(writeBatchPublicationAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "started", status: "success" }),
      dbClient,
    );
    expect(writeBatchPublicationAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "finished", status: "success" }),
      dbClient,
    );
    expect(publishDomainEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ event_name: "rh.batch.published.v1" }),
    );
  });

  it("returns the same logical result on idempotent hits", async () => {
    loadBatchPublicationSnapshotMock.mockReset();
    loadBatchPublicationSnapshotMock.mockResolvedValueOnce({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantId: "11111111-1111-4111-8111-111111111111",
      validationStatus: "validated",
      routingStatus: "completed",
      routingTotalCount: 2,
      routingMatchedCount: 2,
      routingPendingCount: 0,
      routingFailedCount: 0,
      routingAmbiguousCount: 0,
      routingBlockedReason: null,
      routingProcessedAt: "2026-04-13T12:00:00.000Z",
      publicationStatus: "published",
      publicationAttempts: 1,
      publishedAt: "2026-04-13T12:05:00.000Z",
      publishedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      lastPublicationCorrelationId: "11111111-1111-4111-8111-111111111111",
      lastPublicationIdempotencyKey: "idem-123456",
      lastPublicationError: null,
    });

    const result = await publishBatch(
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        correlationId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "idem-123456",
      },
      dbClient as never,
    );

    expect(result.publication_status).toBe("published");
    expect(dbClient.transaction).not.toHaveBeenCalled();
    expect(markBatchPublicationStartingMock).not.toHaveBeenCalled();
    expect(writeBatchPublicationAuditMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ stage: "started" }),
      dbClient,
    );
  });

  it("blocks batches with unresolved exceptions", async () => {
    loadBatchPublicationSnapshotMock.mockReset();
    loadBatchPublicationSnapshotMock.mockResolvedValueOnce({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantId: "11111111-1111-4111-8111-111111111111",
      validationStatus: "validated",
      routingStatus: "completed",
      routingTotalCount: 2,
      routingMatchedCount: 2,
      routingPendingCount: 0,
      routingFailedCount: 0,
      routingAmbiguousCount: 0,
      routingBlockedReason: null,
      routingProcessedAt: "2026-04-13T12:00:00.000Z",
      publicationStatus: "pending",
      publicationAttempts: 0,
      publishedAt: null,
      publishedBy: null,
      lastPublicationCorrelationId: null,
      lastPublicationIdempotencyKey: null,
      lastPublicationError: null,
    });
    loadBatchPublicationExceptionsMock.mockResolvedValueOnce([
      { currentState: "pending" },
    ]);

    await expect(
      publishBatch(
        {
          tenantId: "11111111-1111-4111-8111-111111111111",
          batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          correlationId: "11111111-1111-4111-8111-111111111111",
          idempotencyKey: "idem-123456",
        },
        dbClient as never,
      ),
    ).rejects.toThrow(BatchPublicationError);

    expect(dbClient.transaction).not.toHaveBeenCalled();
    expect(markBatchPublicationStartingMock).not.toHaveBeenCalled();
  });

  it("does not mark the batch failed when publication is already in progress", async () => {
    loadBatchPublicationSnapshotMock.mockReset();
    loadBatchPublicationSnapshotMock
      .mockResolvedValueOnce({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        tenantId: "11111111-1111-4111-8111-111111111111",
        validationStatus: "validated",
        routingStatus: "completed",
        routingTotalCount: 2,
        routingMatchedCount: 2,
        routingPendingCount: 0,
        routingFailedCount: 0,
        routingAmbiguousCount: 0,
        routingBlockedReason: null,
        routingProcessedAt: "2026-04-13T12:00:00.000Z",
        publicationStatus: "pending",
        publicationAttempts: 0,
        publishedAt: null,
        publishedBy: null,
        lastPublicationCorrelationId: null,
        lastPublicationIdempotencyKey: null,
        lastPublicationError: null,
      })
      .mockResolvedValueOnce({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        tenantId: "11111111-1111-4111-8111-111111111111",
        validationStatus: "validated",
        routingStatus: "completed",
        routingTotalCount: 2,
        routingMatchedCount: 2,
        routingPendingCount: 0,
        routingFailedCount: 0,
        routingAmbiguousCount: 0,
        routingBlockedReason: null,
        routingProcessedAt: "2026-04-13T12:00:00.000Z",
        publicationStatus: "publishing",
        publicationAttempts: 1,
        publishedAt: null,
        publishedBy: null,
        lastPublicationCorrelationId: "11111111-1111-4111-8111-111111111111",
        lastPublicationIdempotencyKey: "idem-123456",
        lastPublicationError: null,
      });
    markBatchPublicationStartingMock.mockResolvedValueOnce(null);

    await expect(
      publishBatch(
        {
          tenantId: "11111111-1111-4111-8111-111111111111",
          batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          correlationId: "11111111-1111-4111-8111-111111111111",
          idempotencyKey: "idem-123456",
        },
        dbClient as never,
      ),
    ).rejects.toMatchObject({ code: "BATCH_PUBLICATION_IN_PROGRESS", statusCode: 409 });

    expect(markBatchPublicationFailedMock).not.toHaveBeenCalled();
  });
});