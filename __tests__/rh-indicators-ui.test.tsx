import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  OperationalIndicatorsDashboard,
} from "@/components/indicators/operational-indicators-dashboard";
import {
  RhOperationalIndicatorsView,
} from "@/app/rh/indicadores/page";

describe("rh indicators ui", () => {
  it("renders dashboard cards with indicators", () => {
    const html = renderToStaticMarkup(
      <OperationalIndicatorsDashboard
        isEmpty={false}
        indicators={{
          deliveryRate: 0.95,
          routingAccuracy: 0.98,
          pendingCount: 4,
          totals: {
            totalBatches: 20,
            publishedBatches: 19,
            routingTotalItems: 1000,
            routingMatchedItems: 980,
          },
        }}
      />,
    );

    expect(html).toContain("Taxa de entrega");
    expect(html).toContain("Acuracia de roteamento");
    expect(html).toContain("Pendencias operacionais");
  });

  it("renders empty state message", () => {
    const html = renderToStaticMarkup(
      <OperationalIndicatorsDashboard isEmpty indicators={null} />,
    );

    expect(html).toContain("Nenhum lote encontrado para os filtros atuais");
  });

  it("renders RH indicators page with filters", () => {
    const html = renderToStaticMarkup(
      <RhOperationalIndicatorsView
        filters={{
          batch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          from: "2026-04-10T00:00:00.000Z",
          to: "2026-04-13T23:59:59.999Z",
          organizational_unit: "financeiro",
          status: "",
          severity: "",
        }}
        isEmpty={false}
        errorMessage={null}
        indicators={{
          deliveryRate: 0.95,
          routingAccuracy: 0.98,
          pendingCount: 2,
          totals: {
            totalBatches: 12,
            publishedBatches: 11,
            routingTotalItems: 640,
            routingMatchedItems: 627,
          },
        }}
        alerts={[]}
        alertsMetadata={{
          total: 0,
          open_count: 0,
          in_treatment_count: 0,
          resolved_count: 0,
        }}
      />,
    );

    expect(html).toContain("Dashboard de indicadores e status operacional");
    expect(html).toContain("Filtros operacionais");
    expect(html).toContain("Acompanhe entrega, acuracia e pendencias");
  });
});
