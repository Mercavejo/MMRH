import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OperationalAlertsPanel } from "@/components/alerts/operational-alerts-panel";

describe("rh alerts ui", () => {
  it("renders alert cards", () => {
    const html = renderToStaticMarkup(
      <OperationalAlertsPanel
        alerts={[
          {
            id: "alrt-1",
            batch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            status: "open",
            severity: "critical",
            cause_code: "PUBLICATION_FAILED",
            recommended_action: "Reprocessar e publicar lote.",
            detected_at: "2026-04-13T12:00:00.000Z",
            emitted_at: "2026-04-13T12:02:00.000Z",
            correlation_id: "11111111-1111-4111-8111-111111111111",
            is_sla_breached: false,
          },
        ]}
        metadata={{ total: 1, open_count: 1, in_treatment_count: 0, resolved_count: 0 }}
      />,
    );

    expect(html).toContain("Alertas operacionais");
    expect(html).toContain("PUBLICATION_FAILED");
    expect(html).toContain("Reprocessar e publicar lote.");
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
    expect(html).toContain("tabindex=\"0\"");
    expect(html).toContain("acessibilidade");
  });

  it("renders empty state", () => {
    const html = renderToStaticMarkup(
      <OperationalAlertsPanel
        alerts={[]}
        metadata={{ total: 0, open_count: 0, in_treatment_count: 0, resolved_count: 0 }}
      />,
    );

    expect(html).toContain("Nenhum alerta encontrado");
  });

  it("renders loading state", () => {
    const html = renderToStaticMarkup(
      <OperationalAlertsPanel
        alerts={[]}
        metadata={{ total: 0, open_count: 0, in_treatment_count: 0, resolved_count: 0 }}
        isLoading
      />,
    );

    expect(html).toContain("Carregando alertas operacionais");
  });

  it("renders error state", () => {
    const html = renderToStaticMarkup(
      <OperationalAlertsPanel
        alerts={[]}
        metadata={{ total: 0, open_count: 0, in_treatment_count: 0, resolved_count: 0 }}
        errorMessage="Falha ao carregar alertas."
      />,
    );

    expect(html).toContain("Falha ao carregar alertas");
  });
});
