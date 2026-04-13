import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT_ID = "22222222-2222-4222-8222-222222222222";

const {
  BatchPublicationError,
  validateSessionMock,
  dbSelectMock,
  dbFromMock,
  dbWhereMock,
  dbLimitMock,
  publishBatchMock,
} = vi.hoisted(() => ({
  BatchPublicationError: class extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly statusCode: number,
      public readonly details?: Record<string, unknown>,
    ) {
      super(message);
      this.name = "BatchPublicationError";
    }
  },
  validateSessionMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbFromMock: vi.fn(),
  dbWhereMock: vi.fn(),
  dbLimitMock: vi.fn(),
  publishBatchMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ validateSession: validateSessionMock }));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: dbSelectMock.mockReturnValue({
      from: dbFromMock.mockReturnValue({
        where: dbWhereMock.mockReturnValue({
          limit: dbLimitMock,
        }),
      }),
    }),
  },
}));

vi.mock("@/modules/batches/application/publish-batch", () => ({
  BatchPublicationError,
  publishBatch: publishBatchMock,
}));

import { POST } from "@/app/api/v1/rh/batches/[batchId]/publish/route";

describe("rh batch publish api", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    validateSessionMock.mockResolvedValue({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: SESSION_TENANT_ID,
    });

    dbLimitMock.mockResolvedValue([{ role: "rh_operator" }]);

    publishBatchMock.mockResolvedValue({
      batch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenant_id: SESSION_TENANT_ID,
      routing_status: "completed",
      total_documents: 2,
      matched_documents: 2,
      pending_documents: 0,
      failed_documents: 0,
      ambiguous_documents: 0,
      blocked_documents: 0,
      processed_at: "2026-04-13T12:00:00.000Z",
      blocked_reason: null,
      publication_status: "published",
      publication_attempts: 1,
      published_at: "2026-04-13T12:05:00.000Z",
      published_by: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      last_publication_correlation_id: "11111111-1111-4111-8111-111111111111",
      last_publication_idempotency_key: "idem-123456",
      last_publication_error: null,
      total_requested: 2,
      total_published: 2,
      total_skipped: 0,
      total_failed: 0,
    });
  });

  it("publishes a ready batch with tenant scoped success", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/rh/batches/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/publish",
      {
        method: "POST",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
          "x-correlation-id": "11111111-1111-4111-8111-111111111111",
        },
        body: JSON.stringify({ idempotency_key: "idem-123456" }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-correlation-id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.data.publication_status).toBe("published");
    expect(body.data.total_published).toBe(2);
    expect(publishBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        idempotencyKey: "idem-123456",
      }),
    );
  });

  it("rejects requests without session", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/rh/batches/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/publish",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idempotency_key: "idem-123456" }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });

    expect(response.status).toBe(401);
  });

  it("rejects invalid payloads before publish service is called", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/rh/batches/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/publish",
      {
        method: "POST",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ idempotency_key: "short" }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });

    expect(response.status).toBe(400);
    expect(publishBatchMock).not.toHaveBeenCalled();
  });

  it("rejects non-rh operator role", async () => {
    dbLimitMock.mockResolvedValue([{ role: "colaborador" }]);

    const request = new NextRequest(
      "http://localhost/api/v1/rh/batches/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/publish",
      {
        method: "POST",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ idempotency_key: "idem-123456" }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("surfaces batch state conflicts from the publish service", async () => {
    publishBatchMock.mockRejectedValue(
      new BatchPublicationError("INVALID_BATCH_STATE", "Lote nao esta pronto para publicacao.", 409, {
        routing_status: "completed",
        validation_status: "validated",
      }),
    );

    const request = new NextRequest(
      "http://localhost/api/v1/rh/batches/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/publish",
      {
        method: "POST",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ idempotency_key: "idem-123456" }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("INVALID_BATCH_STATE");
  });

  it("surfaces tenant mismatch as forbidden", async () => {
    publishBatchMock.mockRejectedValue(
      new BatchPublicationError("FORBIDDEN", "Acesso negado para lote de outro tenant.", 403),
    );

    const request = new NextRequest(
      "http://localhost/api/v1/rh/batches/cccccccc-cccc-4ccc-8ccc-cccccccccccc/publish",
      {
        method: "POST",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ idempotency_key: "idem-123456" }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ batchId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }),
    });

    expect(response.status).toBe(403);
  });

  it("surfaces missing batch as not found", async () => {
    publishBatchMock.mockRejectedValue(
      new BatchPublicationError("NOT_FOUND", "Lote nao encontrado.", 404),
    );

    const request = new NextRequest(
      "http://localhost/api/v1/rh/batches/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/publish",
      {
        method: "POST",
        headers: {
          cookie: "session_id=token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ idempotency_key: "idem-123456" }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    });

    expect(response.status).toBe(404);
  });
});