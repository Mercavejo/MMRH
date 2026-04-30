import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RhAuditPageView } from "@/app/rh/auditoria/RhAuditPageView";
import RhAuditLoading from "@/app/rh/auditoria/loading";

vi.mock("@/modules/audit/application/list-audit-events", () => ({
  listAuditEvents: vi.fn().mockResolvedValue({
    events: [],
    timeline: [],
    pagination: { page: 1, page_size: 20, total: 0, total_pages: 1 }
  })
}));

vi.mock("@/modules/support/application/get-support-case", () => ({
  getSupportCase: vi.fn().mockResolvedValue(null)
}));

describe("RH Audit Page View", () => {
  const defaultFilters = {
    from: "",
    to: "",
    batch_id: "",
    document_id: "",
    user_id: "",
    case_id: "",
    page: 1,
    page_size: 20,
  };

  const defaultPagination = {
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 1,
  };

  it("renders with premium layout and headers", () => {
    const html = renderToStaticMarkup(
      <RhAuditPageView
        filters={defaultFilters}
        events={[]}
        timeline={[]}
        pagination={defaultPagination}
        supportCase={null}
      />
    );

    expect(html).toContain("Trilha de Auditoria");
    expect(html).toContain("Filtros de Pesquisa");
    expect(html).toContain("Eventos de Auditoria");
  });

  it("renders event list with chips and data", () => {
    const events = [
      {
        id: "evt-12345678",
        action: "rh.batch.import.validated.v1",
        status: "success",
        resource_type: "batch",
        resource_id: "batch-789",
        actor_id: "admin-1",
        correlation_id: "corr-1",
        created_at: "2026-04-17T10:00:00Z",
        details: {},
      }
    ];

    const html = renderToStaticMarkup(
      <RhAuditPageView
        filters={defaultFilters}
        events={events}
        timeline={[]}
        pagination={{ ...defaultPagination, total: 1 }}
        supportCase={null}
      />
    );

    expect(html).toContain("rh.batch.import.validated.v1");
    expect(html).toContain("SUCCESS");
    expect(html).toContain("batch-789");
    expect(html).toContain("admin-1");
  });

  it("renders error message alert correctly", () => {
    const html = renderToStaticMarkup(
      <RhAuditPageView
        filters={defaultFilters}
        events={[]}
        timeline={[]}
        pagination={defaultPagination}
        supportCase={null}
        errorMessage="Erro crítico ao carregar dados"
      />
    );

    expect(html).toContain("Erro crítico ao carregar dados");
  });

  it("renders SupportCasePanel when case_id is provided", () => {
    const supportCase = {
      case_id: "CASE-001",
      status: "open" as const,
      severity: "high" as const,
      links: { batch_id: "B1" },
      functional_history: [],
      timeline: []
    };

    const html = renderToStaticMarkup(
      <RhAuditPageView
        filters={{ ...defaultFilters, case_id: "CASE-001" }}
        events={[]}
        timeline={[]}
        pagination={defaultPagination}
        supportCase={supportCase}
      />
    );

    expect(html).toContain("Caso de suporte");
    expect(html).toContain("CASE-001");
  });

  it("renders empty state message when no events found", () => {
    const html = renderToStaticMarkup(
      <RhAuditPageView
        filters={defaultFilters}
        events={[]}
        timeline={[]}
        pagination={defaultPagination}
        supportCase={null}
      />
    );

    expect(html).toContain("Nenhum evento encontrado para os filtros atuais");
  });

  it("renders Loading Skeleton without crashing", () => {
    const html = renderToStaticMarkup(<RhAuditLoading />);
    expect(html).toContain("MuiSkeleton");
  });
});
