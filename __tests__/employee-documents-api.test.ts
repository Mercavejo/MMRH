import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";

const {
  validateSessionMock,
  listEmployeeDocumentsMock,
  dbSelectMock,
  dbFromMock,
  dbWhereMock,
  dbLimitMock,
  writePlaytestEventMock,
} = vi.hoisted(() => ({
  validateSessionMock: vi.fn(),
  listEmployeeDocumentsMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbFromMock: vi.fn(),
  dbWhereMock: vi.fn(),
  dbLimitMock: vi.fn(),
  writePlaytestEventMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  validateSession: validateSessionMock,
}));

vi.mock("@/lib/documents/list-documents", () => ({
  listEmployeeDocuments: listEmployeeDocumentsMock,
}));

vi.mock("@/lib/observability/playtest-audit", () => ({
  writePlaytestEvent: writePlaytestEventMock,
}));

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

import { GET } from "@/app/api/v1/employee/documents/route";

describe("employee documents api", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    validateSessionMock.mockResolvedValue({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: SESSION_TENANT_ID,
    });

    dbLimitMock.mockResolvedValue([{ role: "colaborador" }]);

    listEmployeeDocumentsMock.mockResolvedValue([
      {
        document_id: "doc-1",
        tenant_id: SESSION_TENANT_ID,
        user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        document_type: "holerite",
        period_ref: "2026-03",
        status: "published",
        status_label: "Publicado",
        status_a11y_text: "Publicado: documento disponivel para consulta.",
        created_at: "2026-04-01T10:00:00.000Z",
      },
    ]);

    writePlaytestEventMock.mockResolvedValue(undefined);
  });

  it("returns employee documents with valid session and filters", async () => {
    const request = new NextRequest(
      `http://localhost/api/v1/employee/documents?tenant_id=${SESSION_TENANT_ID}&period_ref=2026-03&document_type=holerite`,
      {
        headers: { cookie: "session_id=token" },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(typeof body.meta.response_time_ms).toBe("number");
    expect(listEmployeeDocumentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        periodRef: "2026-03",
        documentType: "holerite",
      }),
    );
    expect(writePlaytestEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "playtest.employee.docs.view", status: "success" })
    );
  });

  it("rejects request without session", async () => {
    const request = new NextRequest(
      `http://localhost/api/v1/employee/documents?tenant_id=${SESSION_TENANT_ID}`,
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects non-colaborador role", async () => {
    dbLimitMock.mockResolvedValue([{ role: "rh_operator" }]);

    const request = new NextRequest(
      `http://localhost/api/v1/employee/documents?tenant_id=${SESSION_TENANT_ID}`,
      {
        headers: { cookie: "session_id=token" },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("blocks tenant mismatch", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/employee/documents?tenant_id=22222222-2222-4222-8222-222222222222",
      {
        headers: { cookie: "session_id=token" },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(writePlaytestEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "playtest.employee.docs.friction", status: "failure", details: expect.objectContaining({ cause: "forbidden" }) })
    );
  });

  it("rejects invalid period filter", async () => {
    const request = new NextRequest(
      `http://localhost/api/v1/employee/documents?tenant_id=${SESSION_TENANT_ID}&period_ref=03-2026`,
      {
        headers: { cookie: "session_id=token" },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("logs playtest friction on internal server error (500)", async () => {
    listEmployeeDocumentsMock.mockRejectedValue(new Error("Storage unavailable"));

    const request = new NextRequest(
      `http://localhost/api/v1/employee/documents?tenant_id=${SESSION_TENANT_ID}`,
      {
        headers: { cookie: "session_id=token" },
      },
    );

    const response = await GET(request);
    
    expect(response.status).toBe(500);
    expect(writePlaytestEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ 
        action: "playtest.employee.docs.friction", 
        status: "failure", 
        details: expect.objectContaining({ cause: "internal_error", error: "Storage unavailable" }) 
      })
    );
  });
});