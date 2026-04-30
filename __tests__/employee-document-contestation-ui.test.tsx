import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EmployeeDocumentDetailPage from "@/app/(employee)/documents/[documentId]/page";
import {
  EmployeeDocumentsPageView,
  getContestationGuidanceByStatus,
} from "@/app/(employee)/documents/page";

describe("employee document contestation ui", () => {
  it("renders contestation CTA for eligible statuses in list", () => {
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
        activeFilters={{ periodRef: "2026-03", documentType: "holerite" }}
      />,
    );

    expect(html).toContain("Abrir contestacao");
    expect(html).toContain("/documents/contestacao?");
    expect(html).toContain("document_id=doc-1");
    expect(html).toContain("from=period_ref%3D2026-03%26document_type%3Dholerite");
  });

  it("does not render contestation CTA for published status", () => {
    const html = renderToStaticMarkup(
      <EmployeeDocumentsPageView
        items={[
          {
            document_id: "doc-2",
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

    expect(html).not.toContain("Abrir contestacao");
  });

  it("shows detail page contestation link preserving back context", async () => {
    const page = await EmployeeDocumentDetailPage({
      params: Promise.resolve({ documentId: "doc-1" }),
      searchParams: Promise.resolve({
        from: "period_ref=2026-03&document_type=holerite",
        status: "pending",
      }),
    });

    const html = renderToStaticMarkup(page);

    expect(html).toContain("Abrir contestacao");
    expect(html).toContain("/documents/contestacao?");
    expect(html).toContain("document_id=doc-1");
    expect(html).toContain("status=pending");
    expect(html).toContain("from=period_ref%3D2026-03%26document_type%3Dholerite");
  });

  it("returns objective guidance by status", () => {
    expect(getContestationGuidanceByStatus("pending")).toContain("processamento");
    expect(getContestationGuidanceByStatus("unavailable")).toContain("indisponivel");
    expect(getContestationGuidanceByStatus("error")).toContain("falha");
  });
});
