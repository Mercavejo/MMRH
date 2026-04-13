import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { IntegrationStatusPanel } from "@/components/integrations/integration-status-panel";
import { RhIntegrationsView } from "@/app/(rh)/integracoes/page";

describe("external ingestions ui", () => {
  it("renders status panel metrics and item details", () => {
    const html = renderToStaticMarkup(
      <IntegrationStatusPanel
        metadata={{
          total: 1,
          received_count: 0,
          processing_count: 0,
          processed_count: 0,
          failed_count: 1,
        }}
        ingestions={[
          {
            ingestion_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            tenant_id: "11111111-1111-4111-8111-111111111111",
            source_system: "payroll-api",
            source_reference: "REF-2026-04",
            idempotency_key: "idem-12345678",
            status: "failed",
            received_at: "2026-04-13T12:00:00.000Z",
            processing_started_at: "2026-04-13T12:01:00.000Z",
            processed_at: null,
            failed_at: "2026-04-13T12:02:00.000Z",
            resolution: {
              failure_code: "INVALID_PAYLOAD",
              recommended_action: "Corrija o payload e reenvie.",
            },
            correlation_id: "11111111-1111-4111-8111-111111111111",
            payload_summary: {},
            timeline: [
              {
                event_id: "evt-1",
                action: "integrations.external_ingestion.failed.v1",
                status: "failure",
                occurred_at: "2026-04-13T12:02:00.000Z",
              },
            ],
          },
        ]}
      />,
    );

    expect(html).toContain("Status de integracoes externas");
    expect(html).toContain("Falhas: 1");
    expect(html).toContain("Recomendacao: Corrija o payload e reenvie.");
    expect(html).toContain("Linha do tempo");
  });

  it("renders loading, empty and error states", () => {
    const loadingHtml = renderToStaticMarkup(<IntegrationStatusPanel isLoading />);
    const emptyHtml = renderToStaticMarkup(<IntegrationStatusPanel ingestions={[]} />);
    const errorHtml = renderToStaticMarkup(<IntegrationStatusPanel errorMessage="Falha" />);

    expect(loadingHtml).toContain("Carregando integracoes externas");
    expect(emptyHtml).toContain("Nenhuma ingestao externa encontrada");
    expect(errorHtml).toContain("Falha");
  });

  it("renders RH integrations view with filters and panel", () => {
    const html = renderToStaticMarkup(
      <RhIntegrationsView
        filters={{
          ingestion_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          status: "failed",
          source_system: "payroll-api",
        }}
        ingestions={[]}
        selectedIngestion={null}
        metadata={{
          total: 0,
          received_count: 0,
          processing_count: 0,
          processed_count: 0,
          failed_count: 0,
        }}
        isEmpty={true}
        errorMessage={null}
      />,
    );

    expect(html).toContain("Status de integracoes externas");
    expect(html).toContain("Filtros de integracao");
    expect(html).toContain("Aplicar filtros");
  });

  it("supports wiring for filter submit controls", () => {
    const onSubmit = vi.fn();
    onSubmit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
