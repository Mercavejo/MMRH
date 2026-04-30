import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusTimeline } from "@/components/audit/status-timeline";
import { RhAuditPageView } from "@/app/rh/auditoria/RhAuditPageView";

describe("audit ui", () => {
  it("renders timeline events in audit detail", () => {
    const html = renderToStaticMarkup(
      <StatusTimeline
        items={[
          {
            event_id: "evt-1",
            action: "rh.batch.import.validated.v1",
            status: "success",
            occurred_at: "2026-04-13T12:00:00.000Z",
          },
        ]}
      />,
    );

    expect(html).toContain("Linha do tempo");
    expect(html).toContain("rh.batch.import.validated.v1");
  });

  it("renders audit filters and events list", () => {
    const html = renderToStaticMarkup(
      <RhAuditPageView
        filters={{
          from: "2026-04-10T00:00:00.000Z",
          to: "2026-04-13T23:59:59.999Z",
          batch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          document_id: "",
          user_id: "",
          case_id: "",
          page: 1,
          page_size: 20,
        }}
        events={[
          {
            id: "evt-1",
            action: "rh.batch.import.validated.v1",
            status: "success",
            resource_type: "batch",
            resource_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            actor_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            correlation_id: "11111111-1111-4111-8111-111111111111",
            created_at: "2026-04-13T12:00:00.000Z",
            details: { total_rows: 10 },
          },
        ]}
        timeline={[]}
        pagination={{ page: 1, page_size: 20, total: 1, total_pages: 1 }}
        supportCase={null}
        supportCaseError={null}
      />,
    );

    expect(html).toContain("Trilha de Auditoria");
    expect(html).toContain("Filtros de Pesquisa");
    expect(html).toContain("rh.batch.import.validated.v1");
  });
});
