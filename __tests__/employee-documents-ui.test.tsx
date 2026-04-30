import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EmployeeDocumentsPageView,
  serializeDocumentFilters,
} from "@/app/(employee)/documents/page";

describe("employee documents ui", () => {
  it("serializes filters to URL query params", () => {
    const query = serializeDocumentFilters({
      periodRef: "2026-03",
      documentType: "holerite",
    });

    expect(query).toBe("period_ref=2026-03&document_type=holerite");
  });

  it("preserves filter context in details link", () => {
    const html = renderToStaticMarkup(
      <EmployeeDocumentsPageView
        items={[
          {
            document_id: "doc-1",
            tenant_id: "11111111-1111-4111-8111-111111111111",
            user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            document_type: "holerite",
            period_ref: "2026-03",
            status: "published",
            status_label: "Publicado",
            status_a11y_text: "Publicado: documento disponivel para consulta.",
            created_at: "2026-04-01T10:00:00.000Z",
          },
        ]}
        activeFilters={{
          periodRef: "2026-03",
          documentType: "holerite",
        }}
      />,
    );

    expect(html).toContain("/documents/doc-1?status=published");
    expect(html).toContain("from=period_ref%3D2026-03%26document_type%3Dholerite");
  });

  it("preserves document context in contestation link", () => {
    const html = renderToStaticMarkup(
      <EmployeeDocumentsPageView
        items={[
          {
            document_id: "doc-1",
            tenant_id: "11111111-1111-4111-8111-111111111111",
            user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            document_type: "holerite",
            period_ref: "2026-03",
            status: "pending",
            status_label: "Pendente",
            status_a11y_text: "Pendente: documento ainda nao foi liberado.",
            created_at: "2026-04-01T10:00:00.000Z",
          },
        ]}
        activeFilters={{
          periodRef: "2026-03",
          documentType: "holerite",
        }}
      />,
    );

    expect(html).toContain("/documents/contestacao?document_id=doc-1");
    expect(html).toContain("period_ref=2026-03");
    expect(html).toContain("document_type=holerite");
  });

  it("renders an empty state message when no document exists", () => {
    const html = renderToStaticMarkup(
      <EmployeeDocumentsPageView
        items={[]}
        activeFilters={{
          periodRef: "2026-03",
          documentType: "holerite",
        }}
      />,
    );

    expect(html).toContain("Nenhum documento encontrado para os filtros informados.");
  });
});
