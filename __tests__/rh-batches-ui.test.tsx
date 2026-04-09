import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BatchImportPageView, buildBatchImportFormData } from "@/app/(rh)/lotes/page";
import { BatchProgressPanel } from "@/app/(rh)/lotes/batch-progress-panel";
import { buildPendingBatchRoutingProgress } from "@/lib/rh/batches/batch-progress";

describe("rh batch import ui", () => {
  it("builds a form payload with the selected file", () => {
    const file = new File(["employee_identifier,document_type,period_ref"], "lote-rh.csv", {
      type: "text/csv",
    });

    const formData = buildBatchImportFormData(file);

    expect(formData.get("file")).toBe(file);
  });

  it("renders loading state while submitting", () => {
    const html = renderToStaticMarkup(
      <BatchImportPageView
        selectedFileName={"lote-rh.csv"}
        feedback={{ state: "submitting" }}
        isSubmitDisabled={true}
        onFileChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(html).toContain("Validacao em andamento.");
    expect(html).toContain("Validando lote...");
  });

  it("renders inline success and error feedback", () => {
    const successHtml = renderToStaticMarkup(
      <BatchImportPageView
        selectedFileName={"lote-rh.csv"}
        feedback={{
          state: "success",
          message: "Lote validado com sucesso.",
          batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          summary: {
            source_format: "csv",
            total_rows: 1,
            valid_rows: 1,
            invalid_rows: 0,
            critical_issue_count: 0,
            warning_issue_count: 0,
            issues: [],
          },
        }}
        isSubmitDisabled={false}
        onFileChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const errorHtml = renderToStaticMarkup(
      <BatchImportPageView
        selectedFileName={null}
        feedback={{
          state: "error",
          message: "O relatorio geral nao passou na validacao inicial.",
          issues: [
            {
              code: "missing_column",
              message: "Coluna obrigatoria ausente: period_ref.",
              severity: "critical",
              column: "period_ref",
            },
          ],
        }}
        isSubmitDisabled={false}
        onFileChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(successHtml).toContain("Lote validado com sucesso.");
    expect(successHtml).toContain("Uma acao principal por tela");
    expect(errorHtml).toContain("O relatorio geral nao passou na validacao inicial.");
    expect(errorHtml).toContain("missing_column");
    expect(errorHtml).toContain("period_ref");
  });

  it("renders the batch progress panel with counts and action", () => {
    const html = renderToStaticMarkup(
      <BatchProgressPanel
        summary={buildPendingBatchRoutingProgress({
          batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          tenantId: "11111111-1111-4111-8111-111111111111",
          totalDocuments: 3,
        })}
        statusMessage="Lote validado. Inicie o roteamento para bloquear ambiguidades antes da publicacao."
        statusTone="info"
        onProcess={vi.fn()}
      />,
    );

    expect(html).toContain("Progresso do lote");
    expect(html).toContain("Processados: 0");
    expect(html).toContain("Pendentes: 3");
    expect(html).toContain("Iniciar roteamento");
  });

  it("renders blocked routing guidance", () => {
    const html = renderToStaticMarkup(
      <BatchProgressPanel
        summary={{
          batch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          tenant_id: "11111111-1111-4111-8111-111111111111",
          routing_status: "blocked",
          total_documents: 2,
          matched_documents: 1,
          pending_documents: 0,
          failed_documents: 0,
          ambiguous_documents: 1,
          blocked_documents: 1,
          processed_at: "2026-04-09T12:00:00.000Z",
          blocked_reason: "1 documento(s) bloqueado(s) por ambiguidade.",
        }}
        statusMessage="Roteamento concluido com bloqueios por ambiguidade."
        statusTone="warning"
        onProcess={vi.fn()}
      />,
    );

    expect(html).toContain("bloqueado por ambiguidade");
    expect(html).toContain("Ambiguidades: 1");
    expect(html).toContain("Roteamento concluido com bloqueios por ambiguidade.");
  });
});
