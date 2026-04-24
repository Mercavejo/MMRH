import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";

const {
  validateSessionMock,
  dbSelectMock,
  dbFromMock,
  dbWhereMock,
  dbLimitMock,
  getOperationalIndicatorsMock,
  writePlaytestEventMock,
  OperationalIndicatorsError,
} = vi.hoisted(() => ({
  validateSessionMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbFromMock: vi.fn(),
  dbWhereMock: vi.fn(),
  dbLimitMock: vi.fn(),
  getOperationalIndicatorsMock: vi.fn(),
  writePlaytestEventMock: vi.fn(),
  OperationalIndicatorsError: class extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly statusCode: number,
      public readonly details?: Record<string, unknown>,
    ) {
      super(message);
      this.name = "OperationalIndicatorsError";
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

vi.mock("@/lib/observability/playtest-audit", () => ({
  writePlaytestEvent: writePlaytestEventMock,
}));

vi.mock("@/modules/indicators/application/get-operational-indicators", () => ({
  getOperationalIndicators: getOperationalIndicatorsMock,
  OperationalIndicatorsError,
}));

import { GET } from "@/app/api/v1/rh/indicators/route";

describe("rh indicators api", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    validateSessionMock.mockResolvedValue({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: SESSION_TENANT_ID,
    });

    dbLimitMock.mockResolvedValue([{ role: "admin_plataforma" }]);
    writePlaytestEventMock.mockResolvedValue(undefined);

    getOperationalIndicatorsMock.mockResolvedValue({
      indicators: {
        deliveryRate: 0.95,
        routingAccuracy: 0.98,
        pendingCount: 3,
        totals: {
          totalBatches: 20,
          publishedBatches: 19,
          routingTotalItems: 1000,
          routingMatchedItems: 980,
        },
      },
      filters: {
        batch_id: null,
        from: null,
        to: null,
        organizational_unit: null,
      },
    });
  });

  it("returns consolidated indicators with correlation id", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/rh/indicators?batch_id=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb&from=2026-04-10T00:00:00.000Z&to=2026-04-13T23:59:59.999Z&organizational_unit=financeiro",
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
    expect(body.data.indicators.pendingCount).toBe(3);
    expect(typeof body.meta.response_time_ms).toBe("number");
    expect(getOperationalIndicatorsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        organizationalUnit: "financeiro",
      }),
    );
    expect(writePlaytestEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "playtest.rh.indicators.view", status: "success" })
    );
  });

  it("returns 400 when period is invalid", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/rh/indicators?from=2026-04-13T23:59:59.999Z&to=2026-04-10T00:00:00.000Z",
      {
        method: "GET",
        headers: { cookie: "session_id=token" },
      },
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(getOperationalIndicatorsMock).not.toHaveBeenCalled();
    expect(writePlaytestEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "playtest.rh.indicators.friction", status: "failure", details: expect.objectContaining({ cause: "validation_error" }) })
    );
  });

  it("returns 400 when batch_id is not a valid UUID", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/rh/indicators?batch_id=invalid-uuid",
      {
        method: "GET",
        headers: { cookie: "session_id=token" },
      },
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(getOperationalIndicatorsMock).not.toHaveBeenCalled();
  });

  it("returns 401 when session is absent", async () => {
    const request = new NextRequest("http://localhost/api/v1/rh/indicators", {
      method: "GET",
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns 403 when role is unauthorized", async () => {
    dbLimitMock.mockResolvedValue([{ role: "suporte" }]);

    const request = new NextRequest("http://localhost/api/v1/rh/indicators", {
      method: "GET",
      headers: { cookie: "session_id=token" },
    });

    const response = await GET(request);

    expect(response.status).toBe(403);
    expect(getOperationalIndicatorsMock).not.toHaveBeenCalled();
  });

  it("surfaces domain validation error with mapped status", async () => {
    getOperationalIndicatorsMock.mockRejectedValue(
      new OperationalIndicatorsError("VALIDATION_ERROR", "Periodo invalido.", 400),
    );

    const request = new NextRequest("http://localhost/api/v1/rh/indicators", {
      method: "GET",
      headers: { cookie: "session_id=token" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("logs playtest friction on internal server error (500)", async () => {
    getOperationalIndicatorsMock.mockRejectedValue(new Error("Database crash"));

    const request = new NextRequest("http://localhost/api/v1/rh/indicators", {
      method: "GET",
      headers: { cookie: "session_id=token" },
    });

    const response = await GET(request);
    
    expect(response.status).toBe(500);
    expect(writePlaytestEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ 
        action: "playtest.rh.indicators.friction", 
        status: "failure", 
        details: expect.objectContaining({ cause: "internal_error", error: "Database crash" }) 
      })
    );
  });
});
