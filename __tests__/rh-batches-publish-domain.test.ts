import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishBatch, BatchPublicationError } from "@/modules/batches/application/publish-batch";

const {
  EmployeeDocumentPublicationError,
  countPublishedDocumentsForBatchMock,
  loadBatchPublicationSnapshotMock,
  loadBatchPublicationExceptionsMock,
  markBatchPublicationStartingMock,
  markBatchPublicationSucceededMock,
  markBatchPublicationFailedMock,
  publishEmployeeDocumentsForBatchMock,
  writeBatchPublicationAuditMock,
  buildDomainEventMock,
  publishDomainEventMock,
} = vi.hoisted(() => ({
  EmployeeDocumentPublicationError: class extends Error {
    constructor(
      public readonly code:
        | "REFERENCE_CODE_REQUIRED"
        | "PUBLICATION_TARGET_NOT_FOUND"
        | "PUBLICATION_SOURCE_ARTIFACT_MISSING"
        | "PUBLICATION_ARTIFACT_UNAVAILABLE",
      message: string,
      public readonly details?: Record<string, unknown>,
    ) {
      super(message);
      this.name = "EmployeeDocumentPublicationError";
    }
  },
  countPublishedDocumentsForBatchMock: vi.fn(),
  loadBatchPublicationSnapshotMock: vi.fn(),
  loadBatchPublicationExceptionsMock: vi.fn(),
  markBatchPublicationStartingMock: vi.fn(),
  markBatchPublicationSucceededMock: vi.fn(),
  markBatchPublicationFailedMock: vi.fn(),
  publishEmployeeDocumentsForBatchMock: vi.fn(),
  writeBatchPublicationAuditMock: vi.fn(),
  buildDomainEventMock: vi.fn((event) => event),
  publishDomainEventMock: vi.fn(async (event) => event),
}));

vi.mock("@/modules/batches/infrastructure/batch-repository", () => ({
  countPublishedDocumentsForBatch: countPublishedDocumentsForBatchMock,
  loadBatchPublicationSnapshot: loadBatchPublicationSnapshotMock,
  loadBatchPublicationExceptions: loadBatchPublicationExceptionsMock,
  markBatchPublicationStarting: markBatchPublicationStartingMock,
  markBatchPublicationSucceeded: markBatchPublicationSucceededMock,
  markBatchPublicationFailed: markBatchPublicationFailedMock,
}));

vi.mock("@/lib/rh/batches/publish-audit", () => ({
  writeBatchPublicationAudit: writeBatchPublicationAuditMock,
}));

vi.mock("@/lib/documents/publish-employee-documents", () => ({
  EmployeeDocumentPublicationError,
  publishEmployeeDocumentsForBatch: publishEmployeeDocumentsForBatchMock,
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
    dbClient.transaction.mockClear();
    loadBatchPublicationSnapshotMock.mockReset();
    loadBatchPublicationExceptionsMock.mockReset();
    countPublishedDocumentsForBatchMock.mockReset();
    markBatchPublicationStartingMock.mockReset();
    markBatchPublicationSucceededMock.mockReset();
    markBatchPublicationFailedMock.mockReset();
    publishEmployeeDocumentsForBatchMock.mockReset();
    writeBatchPublicationAuditMock.mockReset();
    buildDomainEventMock.mockReset();
    buildDomainEventMock.mockImplementation((event) => event);
    publishDomainEventMock.mockReset();
    publishDomainEventMock.mockImplementation(async (event) => event);

    loadBatchPublicationSnapshotMock
      .mockResolvedValueOnce({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        tenantId: "11111111-1111-4111-8111-111111111111",
        validationStatus: "validated",
        routingStatus: "completed",
        routingManifest: [
          {
            document_id: "doc-1",
            employee_identifier: "REF-001",
            codigo_colaborador: "REF-001",
            nome_normalizado: null,
            match_strategy: "codigo_colaborador",
            document_type: "holerite",
            period_ref: "2026-03",
          },
        ],
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
        routingManifest: [
          {
            document_id: "doc-1",
            employee_identifier: "REF-001",
            codigo_colaborador: "REF-001",
            nome_normalizado: null,
            match_strategy: "codigo_colaborador",
            document_type: "holerite",
            period_ref: "2026-03",
          },
        ],
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
    countPublishedDocumentsForBatchMock.mockResolvedValue(2);
    writeBatchPublicationAuditMock.mockResolvedValue(undefined);
    publishEmployeeDocumentsForBatchMock.mockResolvedValue({
      publishedCount: 2,
      skippedCount: 0,
      skippedReferenceCodes: [],
    });
    markBatchPublicationStartingMock.mockResolvedValue({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantId: "11111111-1111-4111-8111-111111111111",
      validationStatus: "validated",
      routingStatus: "completed",
      routingManifest: [
        {
          document_id: "doc-1",
          employee_identifier: "REF-001",
          codigo_colaborador: "REF-001",
          nome_normalizado: null,
          match_strategy: "codigo_colaborador",
          document_type: "holerite",
          period_ref: "2026-03",
        },
      ],
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
    expect(publishEmployeeDocumentsForBatchMock.mock.invocationCallOrder[0]).toBeLessThan(
      markBatchPublicationSucceededMock.mock.invocationCallOrder[0],
    );
    expect(markBatchPublicationSucceededMock).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "idem-123456" }),
      transactionClient,
    );
    expect(publishEmployeeDocumentsForBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
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

  it("maps publication target failures to controlled batch errors and records failed state", async () => {
    publishEmployeeDocumentsForBatchMock.mockRejectedValue(
      new EmployeeDocumentPublicationError(
        "PUBLICATION_TARGET_NOT_FOUND",
        "Documento nao pode ser publicado sem colaborador ativado e vinculado.",
      ),
    );

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
    ).rejects.toMatchObject({
      name: "BatchPublicationError",
      code: "PUBLICATION_TARGET_NOT_FOUND",
      statusCode: 409,
    });

    expect(markBatchPublicationFailedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        errorMessage: "Documento nao pode ser publicado sem colaborador ativado e vinculado.",
      }),
      dbClient,
    );
  });

  it("publishes partially when missing targets are explicitly allowed", async () => {
    publishEmployeeDocumentsForBatchMock.mockReset();
    publishEmployeeDocumentsForBatchMock.mockResolvedValue({
      publishedCount: 1,
      skippedCount: 1,
      skippedReferenceCodes: ["REF-999"],
    });

    const result = await publishBatch(
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        correlationId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "idem-123456",
        skipMissingTargets: true,
      },
      dbClient as never,
    );

    expect(result.publication_status).toBe("published");
    expect(result.total_published).toBe(1);
    expect(result.total_skipped).toBe(1);
    expect(result.skipped_reference_codes).toEqual(["REF-999"]);
    expect(publishEmployeeDocumentsForBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ skipMissingTargets: true }),
      transactionClient,
    );
  });

  it("maps artifact availability failures to operational 503 errors", async () => {
    loadBatchPublicationSnapshotMock.mockReset();
    loadBatchPublicationSnapshotMock.mockResolvedValueOnce({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantId: "11111111-1111-4111-8111-111111111111",
      validationStatus: "validated",
      routingStatus: "completed",
      routingManifest: [
        {
          document_id: "doc-1",
          employee_identifier: "REF-001",
          codigo_colaborador: "REF-001",
          nome_normalizado: null,
          match_strategy: "codigo_colaborador",
          document_type: "holerite",
          period_ref: "2026-03",
        },
      ],
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
    loadBatchPublicationExceptionsMock.mockReset();
    loadBatchPublicationExceptionsMock.mockResolvedValue([]);
    markBatchPublicationStartingMock.mockReset();
    markBatchPublicationStartingMock.mockResolvedValue({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantId: "11111111-1111-4111-8111-111111111111",
      validationStatus: "validated",
      routingStatus: "completed",
      routingManifest: [
        {
          document_id: "doc-1",
          employee_identifier: "REF-001",
          codigo_colaborador: "REF-001",
          nome_normalizado: null,
          match_strategy: "codigo_colaborador",
          document_type: "holerite",
          period_ref: "2026-03",
        },
      ],
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
    markBatchPublicationFailedMock.mockReset();
    markBatchPublicationFailedMock.mockResolvedValue(undefined);
    publishEmployeeDocumentsForBatchMock.mockReset();
    publishEmployeeDocumentsForBatchMock.mockImplementationOnce(async () => {
      throw new EmployeeDocumentPublicationError(
        "PUBLICATION_ARTIFACT_UNAVAILABLE",
        "Nao foi possivel persistir artefato PDF individual do colaborador.",
      );
    });

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
    ).rejects.toMatchObject({
      name: "BatchPublicationError",
      code: "PUBLICATION_ARTIFACT_UNAVAILABLE",
      statusCode: 503,
    });

    expect(publishEmployeeDocumentsForBatchMock).toHaveBeenCalledTimes(1);
    expect(markBatchPublicationFailedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        errorMessage: "Nao foi possivel persistir artefato PDF individual do colaborador.",
      }),
      dbClient,
    );
  });

  it("returns the same logical result on idempotent hits", async () => {
    loadBatchPublicationSnapshotMock.mockReset();
    loadBatchPublicationSnapshotMock.mockResolvedValueOnce({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantId: "11111111-1111-4111-8111-111111111111",
      validationStatus: "validated",
      routingStatus: "completed",
      routingManifest: [],
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
      routingManifest: [],
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
        routingManifest: [],
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
        routingManifest: [],
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
