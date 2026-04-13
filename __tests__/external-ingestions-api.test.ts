import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";

const {
  validateSessionMock,
  dbSelectMock,
  dbFromMock,
  dbWhereMock,
  dbLimitMock,
  registerExternalIngestionMock,
  listExternalIngestionsMock,
  ExternalIngestionError,
} = vi.hoisted(() => ({
  validateSessionMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbFromMock: vi.fn(),
  dbWhereMock: vi.fn(),
  dbLimitMock: vi.fn(),
  registerExternalIngestionMock: vi.fn(),
  listExternalIngestionsMock: vi.fn(),
  ExternalIngestionError: class extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly statusCode: number,
      public readonly details?: Record<string, unknown>,
    ) {
      super(message);
      this.name = "ExternalIngestionError";
    }
  },
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

vi.mock("@/modules/integrations/application/register-external-ingestion", () => ({
  registerExternalIngestion: registerExternalIngestionMock,
  ExternalIngestionError,
}));

vi.mock("@/modules/integrations/application/list-external-ingestions", () => ({
  listExternalIngestions: listExternalIngestionsMock,
  ExternalIngestionError,
}));

import { GET, POST } from "@/app/api/v1/webhooks/integrations/route";

describe("external ingestions api", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    validateSessionMock.mockResolvedValue({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: SESSION_TENANT_ID,
    });

    dbLimitMock.mockResolvedValue([{ role: "rh_operator" }]);

    registerExternalIngestionMock.mockResolvedValue({
      ingestion_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      tenant_id: SESSION_TENANT_ID,
      source_system: "payroll-api",
      source_reference: "REF-2026-04",
      idempotency_key: "idem-12345678",
      status: "received",
      received_at: "2026-04-13T12:00:00.000Z",
      processing_started_at: null,
      processed_at: null,
      failed_at: null,
      resolution: { failure_code: null, recommended_action: null },
      correlation_id: "11111111-1111-4111-8111-111111111111",
      payload_summary: {},
      timeline: [],
    });

    listExternalIngestionsMock.mockResolvedValue({
      ingestions: [],
      selectedIngestion: null,
      metadata: {
        total: 0,
        received_count: 0,
        processing_count: 0,
        processed_count: 0,
        failed_count: 0,
      },
      filters: {
        status: null,
        source_system: null,
        ingestion_id: null,
      },
    });
  });

  it("accepts authorized external intake and returns 202", async () => {
    const request = new NextRequest("http://localhost/api/v1/webhooks/integrations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": "11111111-1111-4111-8111-111111111111",
        "x-integration-source": "payroll-api",
      },
      body: JSON.stringify({
        tenant_id: SESSION_TENANT_ID,
        source_reference: "REF-2026-04",
        idempotency_key: "idem-12345678",
        payload_summary: { documents: 15 },
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(response.headers.get("x-correlation-id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.data.source_system).toBe("payroll-api");
    expect(registerExternalIngestionMock).toHaveBeenCalled();
  });

  it("rejects unauthorized source in intake", async () => {
    const request = new NextRequest("http://localhost/api/v1/webhooks/integrations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-integration-source": "erp-x",
      },
      body: JSON.stringify({
        tenant_id: SESSION_TENANT_ID,
        source_reference: "REF-2026-04",
        idempotency_key: "idem-12345678",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(registerExternalIngestionMock).not.toHaveBeenCalled();
  });

  it("requires session for listing", async () => {
    const request = new NextRequest("http://localhost/api/v1/webhooks/integrations", {
      method: "GET",
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(listExternalIngestionsMock).not.toHaveBeenCalled();
  });

  it("returns tenant-scoped list for authorized RH role", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/webhooks/integrations?status=failed&source_system=payroll-api",
      {
        method: "GET",
        headers: {
          cookie: "session_id=token",
          "x-correlation-id": "11111111-1111-4111-8111-111111111111",
        },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-correlation-id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.data.metadata.total).toBe(0);
    expect(listExternalIngestionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        status: "failed",
        sourceSystem: "payroll-api",
      }),
    );
  });
});
