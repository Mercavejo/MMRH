import { describe, expect, it } from "vitest";
import {
  createEmployeeNotification,
  EmployeeNotificationError,
} from "@/lib/notifications/create-employee-notification";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("employee notifications domain", () => {
  it("creates in-app notification from status update context", async () => {
    const result = await createEmployeeNotification(
      {
        contextType: "document",
        contextId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        eventType: "employee.document.status.updated.v1",
        statusFrom: "pending",
        statusTo: "published",
      },
      {
        resolveContext: async () => ({
          tenantId: TENANT_ID,
          userId: USER_ID,
        }),
        mapMessage: () => ({
          message: "Seu documento foi publicado e ja pode ser baixado.",
          recommendedAction: "Acesse Meus Documentos e conclua o download.",
        }),
        insertNotification: async () => ({
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          createdAt: new Date("2026-04-09T11:25:00.000Z"),
        }),
      },
    );

    expect(result.notification_id).toBe("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    expect(result.tenant_id).toBe(TENANT_ID);
    expect(result.user_id).toBe(USER_ID);
    expect(result.channel).toBe("in_app");
    expect(result.context_type).toBe("document");
    expect(result.status_from).toBe("pending");
    expect(result.status_to).toBe("published");
    expect(result.read_at).toBeNull();
  });

  it("rejects creation when context cannot be resolved in scope", async () => {
    await expect(
      createEmployeeNotification(
        {
          contextType: "contestation",
          contextId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          eventType: "employee.contestation.status.updated.v1",
          statusFrom: "open",
          statusTo: "resolved",
        },
        {
          resolveContext: async () => null,
          mapMessage: () => ({
            message: "Sua contestacao foi resolvida.",
            recommendedAction: "Confira o historico de notificacoes.",
          }),
          insertNotification: async () => ({
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            createdAt: new Date("2026-04-09T11:25:00.000Z"),
          }),
        },
      ),
    ).rejects.toMatchObject<Partial<EmployeeNotificationError>>({
      code: "NOTIFICATION_CONTEXT_NOT_FOUND",
      statusCode: 404,
    });
  });
});
