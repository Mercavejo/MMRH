import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signHmacSha256Hex } from "@/lib/security/hmac-signature";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const PAYLOAD_PATH = "/api/v1/webhooks/integrations";
const INTEGRATION_SECRET = "test-integration-secret";

function buildSignature(params: { method: string; path: string; timestamp: string; body: string }) {
  return signHmacSha256Hex(INTEGRATION_SECRET, [params.method, params.path, params.timestamp, params.body].join("\n"));
}

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

    process.env.PAYROLL_API_EXTERNAL_INGESTION_SECRET = INTEGRATION_SECRET;
    process.env.SFTP_GATEWAY_EXTERNAL_INGESTION_SECRET = INTEGRATION_SECRET;

    validateSessionMock.mockResolvedValue({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: SESSION_TENANT_ID,
    });

    dbLimitMock.mockResolvedValue([{ role: "rh_operator" }]);

    registerExternalIngestionMock.mockResolvedValue({
      ingestion_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      tenant_id: SESSION_TENANT_ID,
      source_system: "payroll-api",
      contract_version: "v1",
      source_reference: "REF-2026-04",
      idempotency_key: "idem-12345678",
      status: "received",
      contract_validation: {
        contract_version: "v1",
        validation_result: "success",
        failure_code: null,
        validated_at: "2026-04-13T12:00:00.000Z",
      },
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
    const timestamp = new Date().toISOString();
    const requestBody = JSON.stringify({
      tenant_id: SESSION_TENANT_ID,
      contract_version: "v1",
      source_reference: "REF-2026-04",
      idempotency_key: "idem-12345678",
      payload_summary: { period: "2026-04", documents: 15 },
    });

    const request = new NextRequest("http://localhost/api/v1/webhooks/integrations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-integration-signature": buildSignature({
          method: "POST",
          path: PAYLOAD_PATH,
          timestamp,
          body: requestBody,
        }),
        "x-integration-timestamp": timestamp,
        "x-correlation-id": "11111111-1111-4111-8111-111111111111",
        "x-integration-source": "payroll-api",
      },
      body: requestBody,
    });

    const response = await POST(request);
    const responseBody = await response.json();

    expect(response.status).toBe(202);
    expect(response.headers.get("x-correlation-id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(responseBody.data.source_system).toBe("payroll-api");
    expect(responseBody.data.contract_version).toBe("v1");
    expect(responseBody.data.contract_validation.validation_result).toBe("success");
    expect(registerExternalIngestionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        sourceSystem: "payroll-api",
        contractVersion: "v1",
      }),
    );
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

  it("rejects tenant mismatch through invalid intake signature", async () => {
    const goodBody = JSON.stringify({
      tenant_id: SESSION_TENANT_ID,
      contract_version: "v1",
      source_reference: "REF-2026-04",
      idempotency_key: "idem-12345678",
    });
    const tamperedBody = JSON.stringify({
      tenant_id: "22222222-2222-4222-8222-222222222222",
      contract_version: "v1",
      source_reference: "REF-2026-04",
      idempotency_key: "idem-12345678",
    });
    const timestamp = new Date().toISOString();

    const request = new NextRequest("http://localhost/api/v1/webhooks/integrations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": "11111111-1111-4111-8111-111111111111",
        "x-integration-source": "payroll-api",
        "x-integration-timestamp": timestamp,
        "x-integration-signature": buildSignature({
          method: "POST",
          path: PAYLOAD_PATH,
          timestamp,
          body: goodBody,
        }),
      },
      body: tamperedBody,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(registerExternalIngestionMock).not.toHaveBeenCalled();
  });

  it("returns 409 for duplicate intake", async () => {
    const timestamp = new Date().toISOString();
    const body = JSON.stringify({
      tenant_id: SESSION_TENANT_ID,
      contract_version: "v1",
      source_reference: "REF-2026-04",
      idempotency_key: "idem-12345678",
      payload_summary: { period: "2026-04", documents: 15 },
    });

    registerExternalIngestionMock.mockRejectedValueOnce(
      new ExternalIngestionError(
        "DUPLICATE_INGESTION",
        "Intake duplicado para a mesma origem e referencia.",
        409,
        {
          failure_code: "DUPLICATE_INGESTION",
          recommended_action: "Use a mesma chave de idempotencia para reenvio controlado ou abra nova referencia.",
        },
      ),
    );

    const request = new NextRequest("http://localhost/api/v1/webhooks/integrations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": "11111111-1111-4111-8111-111111111111",
        "x-integration-source": "payroll-api",
        "x-integration-timestamp": timestamp,
        "x-integration-signature": buildSignature({
          method: "POST",
          path: PAYLOAD_PATH,
          timestamp,
          body,
        }),
      },
      body,
    });

    const response = await POST(request);
    const bodyResponse = await response.json();

    expect(response.status).toBe(409);
    expect(bodyResponse.error.code).toBe("DUPLICATE_INGESTION");
    expect(bodyResponse.error.details.failure_code).toBe("DUPLICATE_INGESTION");
  });

  it("rejects unsupported contract version with structured validation error", async () => {
    const timestamp = new Date().toISOString();
    const body = JSON.stringify({
      tenant_id: SESSION_TENANT_ID,
      contract_version: "v999",
      source_reference: "REF-2026-04",
      idempotency_key: "idem-12345678",
      payload_summary: { period: "2026-04", documents: 15 },
    });

    const request = new NextRequest("http://localhost/api/v1/webhooks/integrations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": "11111111-1111-4111-8111-111111111111",
        "x-integration-source": "payroll-api",
        "x-integration-timestamp": timestamp,
        "x-integration-signature": buildSignature({
          method: "POST",
          path: PAYLOAD_PATH,
          timestamp,
          body,
        }),
      },
      body,
    });

    const response = await POST(request);
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody.error.code).toBe("VALIDATION_ERROR");
    expect(responseBody.error.details.failure_code).toBe("INVALID_CONTRACT_VERSION");
    expect(registerExternalIngestionMock).not.toHaveBeenCalled();
  });

  it("rejects schema-invalid payload with structured validation error", async () => {
    const timestamp = new Date().toISOString();
    const body = JSON.stringify({
      tenant_id: SESSION_TENANT_ID,
      contract_version: "v1",
      source_reference: "REF-2026-04",
      idempotency_key: "idem-12345678",
      payload_summary: { period: "2026-04" },
    });

    const request = new NextRequest("http://localhost/api/v1/webhooks/integrations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": "11111111-1111-4111-8111-111111111111",
        "x-integration-source": "payroll-api",
        "x-integration-timestamp": timestamp,
        "x-integration-signature": buildSignature({
          method: "POST",
          path: PAYLOAD_PATH,
          timestamp,
          body,
        }),
      },
      body,
    });

    const response = await POST(request);
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody.error.code).toBe("VALIDATION_ERROR");
    expect(responseBody.error.details.failure_code).toBe("INVALID_PAYLOAD");
    expect(registerExternalIngestionMock).not.toHaveBeenCalled();
  });

  it("rejects expired integration timestamp", async () => {
    const expiredTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const body = JSON.stringify({
      tenant_id: SESSION_TENANT_ID,
      contract_version: "v1",
      source_reference: "REF-2026-04",
      idempotency_key: "idem-12345678",
      payload_summary: { period: "2026-04", documents: 15 },
    });

    const request = new NextRequest("http://localhost/api/v1/webhooks/integrations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": "11111111-1111-4111-8111-111111111111",
        "x-integration-source": "payroll-api",
        "x-integration-timestamp": expiredTimestamp,
        "x-integration-signature": buildSignature({
          method: "POST",
          path: PAYLOAD_PATH,
          timestamp: expiredTimestamp,
          body,
        }),
      },
      body,
    });

    const response = await POST(request);
    const responseBody = await response.json();

    expect(response.status).toBe(403);
    expect(responseBody.error.code).toBe("FORBIDDEN");
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
