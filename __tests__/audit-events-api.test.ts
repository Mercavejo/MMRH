import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";

const {
  validateSessionMock,
  dbSelectMock,
  dbFromMock,
  dbWhereMock,
  dbLimitMock,
  listAuditEventsMock,
  AuditEventsError,
} = vi.hoisted(() => ({
  validateSessionMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbFromMock: vi.fn(),
  dbWhereMock: vi.fn(),
  dbLimitMock: vi.fn(),
  listAuditEventsMock: vi.fn(),
  AuditEventsError: class extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly statusCode: number,
      public readonly details?: Record<string, unknown>,
    ) {
      super(message);
      this.name = "AuditEventsError";
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

vi.mock("@/modules/audit/application/list-audit-events", () => ({
  listAuditEvents: listAuditEventsMock,
  AuditEventsError,
}));

import { GET } from "@/app/api/v1/audit-events/route";

describe("audit events api", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    validateSessionMock.mockResolvedValue({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: SESSION_TENANT_ID,
    });

    dbLimitMock.mockResolvedValue([{ role: "admin_plataforma" }]);

    listAuditEventsMock.mockResolvedValue({
      events: [
        {
          id: "evt-1",
          action: "rh.batch.import.validated.v1",
          status: "success",
          resource_type: "batch",
          resource_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          actor_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          correlation_id: "11111111-1111-4111-8111-111111111111",
          created_at: "2026-04-13T12:00:00.000Z",
          details: { total_rows: 10 },
        },
      ],
      timeline: [
        {
          event_id: "evt-1",
          action: "rh.batch.import.validated.v1",
          status: "success",
          occurred_at: "2026-04-13T12:00:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        page_size: 20,
        total: 1,
        total_pages: 1,
      },
    });
  });

  it("returns tenant-scoped events with correlation id", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/audit-events?from=2026-04-10T00:00:00.000Z&to=2026-04-13T23:59:59.999Z&batch_id=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb&page=1&page_size=20",
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
    expect(body.data.events).toHaveLength(1);
    expect(listAuditEventsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    );
  });

  it("returns 400 when period is invalid", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/audit-events?from=2026-04-13T23:59:59.999Z&to=2026-04-10T00:00:00.000Z",
      {
        method: "GET",
        headers: { cookie: "session_id=token" },
      },
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(listAuditEventsMock).not.toHaveBeenCalled();
  });

  it("returns 401 when session is absent", async () => {
    const request = new NextRequest("http://localhost/api/v1/audit-events", {
      method: "GET",
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns 403 when role is unauthorized", async () => {
    dbLimitMock.mockResolvedValue([{ role: "colaborador" }]);

    const request = new NextRequest("http://localhost/api/v1/audit-events", {
      method: "GET",
      headers: { cookie: "session_id=token" },
    });

    const response = await GET(request);

    expect(response.status).toBe(403);
    expect(listAuditEventsMock).not.toHaveBeenCalled();
  });

  it("surfaces domain errors with correct status", async () => {
    listAuditEventsMock.mockRejectedValue(
      new AuditEventsError("FORBIDDEN", "Acesso negado para trilha de outro tenant.", 403),
    );

    const request = new NextRequest("http://localhost/api/v1/audit-events", {
      method: "GET",
      headers: { cookie: "session_id=token" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("keeps tenant isolation when querying by foreign batch id", async () => {
    listAuditEventsMock.mockRejectedValue(
      new AuditEventsError("FORBIDDEN", "Acesso negado para lote de outro tenant.", 403),
    );

    const request = new NextRequest(
      "http://localhost/api/v1/audit-events?batch_id=22222222-2222-4222-8222-222222222222",
      {
        method: "GET",
        headers: { cookie: "session_id=token" },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(listAuditEventsMock).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: SESSION_TENANT_ID }),
    );
  });
});
