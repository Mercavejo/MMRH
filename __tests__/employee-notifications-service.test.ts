import { describe, expect, it, vi } from "vitest";
import { mapNotificationMessage } from "@/lib/notifications/message-mapping";
import {
  createEmployeeNotificationFromStatusEvent,
  EmployeeNotificationError,
} from "@/lib/notifications/create-employee-notification";

describe("employee notifications service", () => {
  it("maps document status updates to simple user message", () => {
    const mapped = mapNotificationMessage({
      contextType: "document",
      statusFrom: "pending",
      statusTo: "published",
      eventType: "employee.document.status.updated.v1",
    });

    expect(mapped.message).toContain("documento");
    expect(mapped.message).toContain("publicado");
    expect(mapped.recommendedAction).toContain("Meus Documentos");
  });

  it("maps contestation status updates to action-oriented message", () => {
    const mapped = mapNotificationMessage({
      contextType: "contestation",
      statusFrom: "in_progress",
      statusTo: "resolved",
      eventType: "employee.contestation.status.updated.v1",
    });

    expect(mapped.message).toContain("contestacao");
    expect(mapped.message).toContain("resolvida");
    expect(mapped.recommendedAction.length).toBeGreaterThan(10);
  });

  it("creates notification using resolved context and writes audit", async () => {
    const writeAudit = vi.fn().mockResolvedValue(undefined);

    const result = await createEmployeeNotificationFromStatusEvent(
      {
        contextType: "contestation",
        contextId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        eventType: "employee.contestation.status.updated.v1",
        statusFrom: "open",
        statusTo: "resolved",
        actorId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        correlationId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      },
      {
        resolveContext: async () => ({
          tenantId: "11111111-1111-4111-8111-111111111111",
          userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }),
        mapMessage: mapNotificationMessage,
        insertNotification: async () => ({
          id: "99999999-9999-4999-8999-999999999999",
          createdAt: new Date("2026-04-09T11:45:00.000Z"),
          readAt: null,
        }),
        writeAudit,
      },
    );

    expect(result.notification_id).toBe("99999999-9999-4999-8999-999999999999");
    expect(result.tenant_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(result.user_id).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "11111111-1111-4111-8111-111111111111",
        actorId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        notificationId: "99999999-9999-4999-8999-999999999999",
        correlationId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      }),
    );
  });

  it("fails with not found when context is not resolvable", async () => {
    await expect(
      createEmployeeNotificationFromStatusEvent(
        {
          contextType: "document",
          contextId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          eventType: "employee.document.status.updated.v1",
          statusFrom: "pending",
          statusTo: "published",
        },
        {
          resolveContext: async () => null,
          mapMessage: mapNotificationMessage,
          insertNotification: async () => ({
            id: "99999999-9999-4999-8999-999999999999",
            createdAt: new Date("2026-04-09T11:45:00.000Z"),
            readAt: null,
          }),
          writeAudit: async () => undefined,
        },
      ),
    ).rejects.toMatchObject<Partial<EmployeeNotificationError>>({
      code: "NOTIFICATION_CONTEXT_NOT_FOUND",
      statusCode: 404,
    });
  });
});
