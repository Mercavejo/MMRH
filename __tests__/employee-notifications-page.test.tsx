import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookiesMock,
  redirectMock,
  validateSessionMock,
  dbSelectMock,
  dbFromMock,
  dbWhereMock,
  dbLimitMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  redirectMock: vi.fn(),
  validateSessionMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbFromMock: vi.fn(),
  dbWhereMock: vi.fn(),
  dbLimitMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth/session", () => ({
  validateSession: validateSessionMock,
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

vi.mock("@/lib/notifications/employee-notification-tracking", () => ({
  listEmployeeNotifications: vi.fn(),
}));

import EmployeeNotificationsPage from "@/app/(employee)/notifications/page";

describe("employee notifications page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "token" }),
    });
    validateSessionMock.mockResolvedValue({
      userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantId: "11111111-1111-4111-8111-111111111111",
    });
    dbLimitMock.mockResolvedValue([{ role: "colaborador" }]);
  });

  it("redirects RH roles back to /rh instead of rendering colaborador notifications", async () => {
    dbLimitMock.mockResolvedValue([{ role: "rh_gestor" }]);
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(EmployeeNotificationsPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/rh");
  });
});
