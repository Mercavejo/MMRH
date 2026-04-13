import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";

const {
  validateSessionMock,
  dbSelectMock,
  dbFromMock,
  dbWhereMock,
  dbLimitMock,
  getOperationalAlertsMock,
  OperationalAlertsError,
} = vi.hoisted(() => ({
  validateSessionMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbFromMock: vi.fn(),
  dbWhereMock: vi.fn(),
  dbLimitMock: vi.fn(),
  getOperationalAlertsMock: vi.fn(),
  OperationalAlertsError: class extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly statusCode: number,
      public readonly details?: Record<string, unknown>,
    ) {
      super(message);
      this.name = "OperationalAlertsError";
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
      insert: vi.fn(),
    }),
  },
}));

vi.mock("@/modules/alerts/application/get-operational-alerts", () => ({
  getOperationalAlerts: getOperationalAlertsMock,
  OperationalAlertsError,
}));

import { GET } from "@/app/api/v1/rh/alerts/route";

describe("rh alerts api", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    validateSessionMock.mockResolvedValue({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: SESSION_TENANT_ID,
    });

    dbLimitMock.mockResolvedValue([{ role: "rh_gestor" }]);

    getOperationalAlertsMock.mockResolvedValue({
      alerts: [
        {
          id: "alrt-1",
          batch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          status: "open",
          severity: "critical",
          cause_code: "PUBLICATION_FAILED",
          recommended_action: "Reprocessar lote e publicar novamente.",
          detected_at: "2026-04-13T12:00:00.000Z",
          emitted_at: "2026-04-13T12:02:00.000Z",
          correlation_id: "11111111-1111-4111-8111-111111111111",
          is_sla_breached: false,
        },
      ],
      metadata: {
        total: 1,
        open_count: 1,
        in_treatment_count: 0,
        resolved_count: 0,
      },
      filters: {
        status: null,
        severity: null,
        from: null,
        to: null,
        batch_id: null,
      },
    });
  });

  it("returns alerts with correlation id", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/rh/alerts?status=open&severity=critical&batch_id=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
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
    expect(body.data.alerts).toHaveLength(1);
    expect(getOperationalAlertsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        status: "open",
        severity: "critical",
      }),
    );
  });

  it("returns 400 for invalid query", async () => {
    const request = new NextRequest("http://localhost/api/v1/rh/alerts?status=invalid", {
      method: "GET",
      headers: { cookie: "session_id=token" },
    });

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(getOperationalAlertsMock).not.toHaveBeenCalled();
  });

  it("returns 400 for inconsistent date range", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/rh/alerts?from=2026-04-13T23:59:59.000Z&to=2026-04-13T00:00:00.000Z",
      {
        method: "GET",
        headers: { cookie: "session_id=token" },
      },
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(getOperationalAlertsMock).not.toHaveBeenCalled();
  });

  it("returns 401 when session is missing", async () => {
    const request = new NextRequest("http://localhost/api/v1/rh/alerts", { method: "GET" });

    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns 403 for unauthorized role", async () => {
    dbLimitMock.mockResolvedValue([{ role: "colaborador" }]);

    const request = new NextRequest("http://localhost/api/v1/rh/alerts", {
      method: "GET",
      headers: { cookie: "session_id=token" },
    });

    const response = await GET(request);

    expect(response.status).toBe(403);
    expect(getOperationalAlertsMock).not.toHaveBeenCalled();
  });

  it("maps domain errors", async () => {
    getOperationalAlertsMock.mockRejectedValue(
      new OperationalAlertsError("FORBIDDEN", "Acesso negado para tenant.", 403),
    );

    const request = new NextRequest("http://localhost/api/v1/rh/alerts", {
      method: "GET",
      headers: { cookie: "session_id=token" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("maps forbidden cross-tenant scoped errors", async () => {
    getOperationalAlertsMock.mockRejectedValue(
      new OperationalAlertsError("FORBIDDEN", "Acesso negado para lote de outro tenant.", 403),
    );

    const request = new NextRequest(
      "http://localhost/api/v1/rh/alerts?batch_id=22222222-2222-4222-8222-222222222222",
      {
        method: "GET",
        headers: { cookie: "session_id=token" },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});
