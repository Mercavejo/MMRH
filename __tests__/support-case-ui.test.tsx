import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SupportCasePanel } from "@/components/support/support-case-panel";

describe("support case ui", () => {
  it("renders consolidated support case and resolution form", () => {
    const html = renderToStaticMarkup(
      <SupportCasePanel
        supportCase={{
          case_id: "22222222-2222-4222-8222-222222222222",
          tenant_id: "11111111-1111-4111-8111-111111111111",
          status: "in_treatment",
          severity: "critical",
          links: {
            batch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            document_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          },
          technical_history: [
            {
              id: "evt-1",
              action: "support.case.recovery.triggered.v1",
              status: "success",
              resource_type: "support_case",
              resource_id: "22222222-2222-4222-8222-222222222222",
              actor_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              correlation_id: "22222222-2222-4222-8222-222222222222",
              created_at: "2026-04-13T12:00:00.000Z",
              details: null,
            },
          ],
          timeline: [
            {
              event_id: "evt-1",
              action: "support.case.recovery.triggered.v1",
              status: "success",
              occurred_at: "2026-04-13T12:00:00.000Z",
            },
          ],
          functional_history: [
            {
              source: "alerts",
              status: "warning",
              message: "ROUTING_INCOMPLETE",
              occurred_at: "2026-04-13T12:00:00.000Z",
            },
          ],
          resolution: null,
        }}
      />,
    );

    expect(html).toContain("Caso de suporte");
    expect(html).toContain("Formulario de resolucao");
    expect(html).toContain("cause_code");
    expect(html).toContain("action_applied");
    expect(html).toContain("result_status");
    expect(html).toContain("Linha do tempo");
  });

  it("renders empty and error states", () => {
    const emptyHtml = renderToStaticMarkup(<SupportCasePanel supportCase={null} />);
    expect(emptyHtml).toContain("Nenhum caso de suporte selecionado");

    const loadingHtml = renderToStaticMarkup(<SupportCasePanel supportCase={null} isLoading />);
    expect(loadingHtml).toContain("Carregando caso de suporte");

    const errorHtml = renderToStaticMarkup(<SupportCasePanel supportCase={null} errorMessage="Falha" />);
    expect(errorHtml).toContain("Falha");
  });

  it("renders accessible labels and keyboard-friendly form controls", () => {
    const html = renderToStaticMarkup(
      <SupportCasePanel
        supportCase={{
          case_id: "22222222-2222-4222-8222-222222222222",
          tenant_id: "11111111-1111-4111-8111-111111111111",
          status: "open",
          severity: "warning",
          links: {
            batch_id: null,
            document_id: null,
            user_id: null,
          },
          technical_history: [],
          timeline: [],
          functional_history: [],
          resolution: null,
        }}
      />,
    );

    expect(html).toContain('for="support-cause-code"');
    expect(html).toContain('id="support-cause-code"');
    expect(html).toContain('for="support-action-applied"');
    expect(html).toContain('id="support-action-applied"');
    expect(html).toContain('for="support-result-status"');
    expect(html).toContain('id="support-result-status"');
    expect(html).toContain('type="submit"');
  });

  it("renders final evidence when case is resolved", () => {
    const html = renderToStaticMarkup(
      <SupportCasePanel
        supportCase={{
          case_id: "22222222-2222-4222-8222-222222222222",
          tenant_id: "11111111-1111-4111-8111-111111111111",
          status: "resolved",
          severity: "info",
          links: {
            batch_id: null,
            document_id: null,
            user_id: null,
          },
          technical_history: [],
          timeline: [],
          functional_history: [],
          resolution: {
            cause_code: "ROOT_CAUSE",
            action_applied: "Acao aplicada",
            result_status: "resolved",
            resolved_by: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            resolved_at: "2026-04-13T13:00:00.000Z",
          },
        }}
      />,
    );

    expect(html).toContain("Evidencia de resolucao");
    expect(html).toContain("ROOT_CAUSE");
    expect(html).toContain("Acao aplicada");
  });
});
