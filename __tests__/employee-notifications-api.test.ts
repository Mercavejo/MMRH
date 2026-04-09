import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const SESSION_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const {
  validateSessionMock,
  assertTenantActionMock,
  dbSelectMock,
  dbFromMock,
  dbWhereMock,
  dbLimitMock,
  listEmployeeNotificationsMock,
  markEmployeeNotificationAsReadMock,
} = vi.hoisted(() => ({
  validateSessionMock: vi.fn(),
  assertTenantActionMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbFromMock: vi.fn(),
  dbWhereMock: vi.fn(),
  dbLimitMock: vi.fn(),
  listEmployeeNotificationsMock: vi.fn(),
  markEmployeeNotificationAsReadMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  validateSession: validateSessionMock,
}));

vi.mock("@/lib/auth/rbac", async () => {
  const actual = await vi.importActual("@/lib/auth/rbac");

  return {
    ...actual,
    assertTenantAction: assertTenantActionMock,
  };
});

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
  listEmployeeNotifications: listEmployeeNotificationsMock,
  markEmployeeNotificationAsRead: markEmployeeNotificationAsReadMock,
  EmployeeNotificationTrackingError: class EmployeeNotificationTrackingError extends Error {
    code: string;
    statusCode: number;

    constructor(code: string, message: string, statusCode: number) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

import { GET } from "@/app/api/v1/employee/notifications/route";
import { PATCH } from "@/app/api/v1/employee/notifications/[notificationId]/read/route";

describe("employee notifications api", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    validateSessionMock.mockResolvedValue({
      userId: USER_ID,
      tenantId: SESSION_TENANT_ID,
    });

    dbLimitMock.mockResolvedValue([{ role: "colaborador" }]);

    listEmployeeNotificationsMock.mockResolvedValue([
      {
        notification_id: "99999999-9999-4999-8999-999999999999",
        tenant_id: SESSION_TENANT_ID,
        user_id: USER_ID,
        channel: "in_app",
        event_type: "employee.contestation.status.updated.v1",
        context_type: "contestation",
        context_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        status_from: "open",
        status_to: "resolved",
        recommended_action: "Consulte a contestacao e valide o resultado.",
        message: "Sua contestacao foi resolvida.",
        read_at: null,
        created_at: "2026-04-09T12:00:00.000Z",
      },
    ]);

    markEmployeeNotificationAsReadMock.mockResolvedValue({
      notification_id: "99999999-9999-4999-8999-999999999999",
      read_at: "2026-04-09T12:05:00.000Z",
    });
  });

  it("lists employee notifications in scoped tenant", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/employee/notifications?context_type=contestation",
      {
        method: "GET",
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].notification_id).toBe(
      "99999999-9999-4999-8999-999999999999",
    );
    expect(listEmployeeNotificationsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        userId: USER_ID,
        contextType: "contestation",
      }),
    );
  });

  it("rejects invalid session on notifications listing", async () => {
    validateSessionMock.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/v1/employee/notifications",
      {
        method: "GET",
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects role different from colaborador", async () => {
    dbLimitMock.mockResolvedValue([{ role: "rh_operator" }]);

    const request = new NextRequest(
      "http://localhost/api/v1/employee/notifications",
      {
        method: "GET",
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("marks notification as read in same tenant", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/employee/notifications/99999999-9999-4999-8999-999999999999/read",
      {
        method: "PATCH",
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const response = await PATCH(request, {
      params: Promise.resolve({
        notificationId: "99999999-9999-4999-8999-999999999999",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.notification_id).toBe(
      "99999999-9999-4999-8999-999999999999",
    );
    expect(markEmployeeNotificationAsReadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: SESSION_TENANT_ID,
        userId: USER_ID,
        notificationId: "99999999-9999-4999-8999-999999999999",
      }),
    );
  });

  it("rejects invalid notification id on mark-read", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/employee/notifications/invalid/read",
      {
        method: "PATCH",
        headers: {
          cookie: "session_id=token",
        },
      },
    );

    const response = await PATCH(request, {
      params: Promise.resolve({
        notificationId: "invalid",
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
