import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmployeeDocumentsPageView } from "@/app/(employee)/documents/page";
import { EmployeeNotificationsPageView } from "@/app/(employee)/notifications/page";

describe("employee notifications ui", () => {
  it("renders notifications history with context and action", () => {
    const html = renderToStaticMarkup(
      <EmployeeNotificationsPageView
        items={[
          {
            notification_id: "99999999-9999-4999-8999-999999999999",
            tenant_id: "11111111-1111-4111-8111-111111111111",
            user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            channel: "in_app",
            event_type: "employee.contestation.status.updated.v1",
            context_type: "contestation",
            context_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            status_from: "open",
            status_to: "resolved",
            recommended_action: "Confira o desfecho da contestacao no portal.",
            message: "Sua contestacao foi resolvida pelo RH.",
            read_at: null,
            created_at: "2026-04-09T12:00:00.000Z",
          },
        ]}
      />,
    );

    expect(html).toContain("Historico de Notificacoes");
    expect(html).toContain("Sua contestacao foi resolvida pelo RH.");
    expect(html).toContain("Confira o desfecho da contestacao no portal.");
    expect(html).toContain("Marcar como lida");
  });

  it("shows consistent empty state guidance", () => {
    const html = renderToStaticMarkup(<EmployeeNotificationsPageView items={[]} />);

    expect(html).toContain("Nenhuma notificacao encontrada");
    expect(html).toContain("Meus Documentos");
  });

  it("renders shortcut from documents page to notifications history", () => {
    const html = renderToStaticMarkup(
      <EmployeeDocumentsPageView
        items={[]}
        activeFilters={{ periodRef: "2026-03", documentType: "holerite" }}
      />,
    );

    expect(html).toContain("/notifications");
    expect(html).toContain("Historico de notificacoes");
  });
});
