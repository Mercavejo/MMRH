import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EmployeeDocumentDetailPage from "@/app/(employee)/documents/[documentId]/page";
import { EmployeeDocumentsPageView } from "@/app/(employee)/documents/page";

describe("employee documents download ui", () => {
  it("renders download action in list with accessible label", () => {
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
        activeFilters={{ periodRef: "2026-03", documentType: "holerite" }}
      />,
    );

    expect(html).toContain(
      "/api/v1/employee/documents/doc-1/download?disposition=attachment",
    );
    expect(html).toContain("Baixar holerite 2026-03");
  });

  it("renders detail page with download button and guidance message", async () => {
    const page = await EmployeeDocumentDetailPage({
      params: Promise.resolve({ documentId: "doc-1" }),
      searchParams: Promise.resolve({ from: "period_ref=2026-03", status: "pending" }),
    });

    const html = renderToStaticMarkup(page);

    expect(html).toContain("Baixar documento");
    expect(html).toContain(
      "/api/v1/employee/documents/doc-1/download?disposition=attachment",
    );
    expect(html).toContain("contestacao guiada");
  });
});
