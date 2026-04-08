import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  selectResultQueue,
  selectMock,
  fromMock,
  whereMock,
  limitMock,
  verifyPasswordMock,
  createSessionMock,
  writeAuthAuditMock,
} = vi.hoisted(() => ({
  selectResultQueue: [] as unknown[],
  selectMock: vi.fn(),
  fromMock: vi.fn(),
  whereMock: vi.fn(),
  limitMock: vi.fn(),
  verifyPasswordMock: vi.fn(),
  createSessionMock: vi.fn(),
  writeAuthAuditMock: vi.fn(),
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: verifyPasswordMock,
}));

vi.mock("@/lib/auth/session", () => ({
  createSession: createSessionMock,
}));

vi.mock("@/lib/auth/audit", () => ({
  writeAuthAudit: writeAuthAuditMock,
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: selectMock.mockReturnValue({
      from: fromMock.mockReturnValue({
          where: whereMock.mockReturnValue({
            limit: limitMock.mockImplementation(async () => {
              if (selectResultQueue.length > 0) {
                return selectResultQueue.shift();
              }

              return [];
            }),
          }),
      }),
    }),
  },
}));

import { POST } from "@/app/api/v1/auth/login/route";

describe("auth login route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResultQueue.length = 0;

    verifyPasswordMock.mockResolvedValue(true);
    createSessionMock.mockResolvedValue({
      token: "session-token",
      expiresAt: new Date("2026-04-08T18:30:00.000Z"),
    });
  });

  it("logs in a user with a single tenant mapping", async () => {
    selectResultQueue.push([
      {
        id: "user-1",
        email: "user@example.com",
        passwordHash: "hash",
        isActive: true,
      },
    ]);
    selectResultQueue.push([
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        role: "rh_operator",
      },
    ]);

    const request = new NextRequest("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        password: "password123",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.tenantId).toBe("11111111-1111-4111-8111-111111111111");
    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });

  it("rejects ambiguous login when the user belongs to multiple tenants", async () => {
    selectResultQueue.push([
      {
        id: "user-1",
        email: "user@example.com",
        passwordHash: "hash",
        isActive: true,
      },
    ]);
    selectResultQueue.push([
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        role: "rh_operator",
      },
      {
        tenantId: "22222222-2222-4222-8222-222222222222",
        role: "admin_plataforma",
      },
    ]);

    const request = new NextRequest("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        password: "password123",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("CONFLICT");
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("uses the requested tenant mapping when tenant_id is provided", async () => {
    selectResultQueue.push([
      {
        id: "user-1",
        email: "user@example.com",
        passwordHash: "hash",
        isActive: true,
      },
    ]);
    selectResultQueue.push([
      {
        tenantId: "11111111-1111-4111-8111-111111111111",
        role: "rh_operator",
      },
      {
        tenantId: "22222222-2222-4222-8222-222222222222",
        role: "admin_plataforma",
      },
    ]);

    const request = new NextRequest("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "user@example.com",
        password: "password123",
        tenant_id: "22222222-2222-4222-8222-222222222222",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.tenantId).toBe("22222222-2222-4222-8222-222222222222");
    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "22222222-2222-4222-8222-222222222222",
      }),
    );
  });
});