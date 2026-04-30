import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExceptionActionForm } from "@/components/exceptions/ExceptionActionForm";
import { ExceptionDetailPanel } from "@/components/exceptions/ExceptionDetailPanel";
import { ExceptionQueueItem } from "@/components/exceptions/ExceptionQueueItem";
import { ExceptionQueueList } from "@/components/exceptions/ExceptionQueueList";
import { ExceptionQueuePageView } from "@/components/exceptions/ExceptionQueuePage";

const sampleException = {
  id: "exc-1",
  batch_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  batch_name: "Lote RH",
  document_external_id: "DOC-001",
  document_filename: "lote-rh.csv",
  associated_employee_id: "emp-1",
  assoc_employee_external_id: "EMP-1",
  associated_employee_name: "Maria",
  associated_employee_email: "maria@empresa.com",
  error_category: "ambiguous-routing" as const,
  priority: "high" as const,
  current_state: "pending" as const,
  recommended_action: "Revisar mapeamento.",
  created_at: "2026-04-09T12:00:00.000Z",
};

describe("exception ui", () => {
  it("renders queue item badges and accessible summary", () => {
    const html = renderToStaticMarkup(
      <ExceptionQueueItem item={sampleException} onOpen={() => undefined} />,
    );

    expect(html).toContain("DOC-001");
    expect(html).toContain("Prioridade Alta");
    expect(html).toContain("Estado Pendente");
    expect(html).toContain("Abrir detalhe");
  });

  it("renders queue list empty and loaded states", () => {
    const emptyHtml = renderToStaticMarkup(
      <ExceptionQueueList items={[]} onOpen={() => undefined} />,
    );

    const listHtml = renderToStaticMarkup(
      <ExceptionQueueList items={[sampleException]} onOpen={() => undefined} />,
    );

    expect(emptyHtml).toContain("Nenhuma excecao encontrada");
    expect(listHtml).toContain("1 excecao(oes) listada(s)");
    expect(listHtml).toContain("Acao recomendada");
  });

  it("renders the detail panel and action form", () => {
    const html = renderToStaticMarkup(
      <ExceptionDetailPanel
        exception={{
          ...sampleException,
          error_details: { matching_employees: [] },
          correction_applied: null,
          correction_result: null,
          resolved_by: null,
          resolved_by_name: null,
          resolved_at: null,
          updated_at: "2026-04-09T12:05:00.000Z",
          actions_history: [
            {
              id: "act-1",
              action_description: "Validado com RH",
              expected_result: "reprocessable",
              actor_id: "user-1",
              actor_name: "Maria Manager",
              performed_at: "2026-04-09T12:10:00.000Z",
            },
          ],
        }}
        actionDescription="Validado com RH e documento pronto para reprocessamento."
        expectedResult="reprocessable"
        onActionDescriptionChange={() => undefined}
        onExpectedResultChange={() => undefined}
        onSubmitAction={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(html).toContain("Detalhe da excecao");
    expect(html).toContain("Historico de acoes");
    expect(html).toContain("Registrar acao corretiva");
    expect(html).toContain("Validado com RH e documento pronto para reprocessamento.");
  });

  it("renders the standalone action form validation surface", () => {
    const html = renderToStaticMarkup(
      <ExceptionActionForm
        actionDescription="Descricao suficiente para auditoria."
        expectedResult="reject"
        onActionDescriptionChange={() => undefined}
        onExpectedResultChange={() => undefined}
        onSubmit={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(html).toContain("Descricao da correcao");
    expect(html).toContain("Resultado esperado");
    expect(html).toContain("Salvar acao");
  });

  it("renders the queue page view with filters and counts", () => {
    const html = renderToStaticMarkup(
      <ExceptionQueuePageView
        filters={{ batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", priority: "high", state: "pending", skip: 0, take: 20 }}
        metadata={{ total_count: 1, pending_count: 1, in_treatment_count: 0, resolved_count: 0, blocked_count: 0 }}
        items={[sampleException]}
        isLoading={false}
        errorMessage={null}
        selectedException={null}
        actionDescription=""
        expectedResult="reprocessable"
        actionErrorMessage={null}
        actionSuccessMessage={null}
        onFiltersChange={() => undefined}
        onSubmitFilters={() => undefined}
        onOpenException={() => undefined}
        onCloseDetail={() => undefined}
        onPrevious={() => undefined}
        onNext={() => undefined}
        onActionDescriptionChange={() => undefined}
        onExpectedResultChange={() => undefined}
        onSubmitAction={() => undefined}
        onRetry={() => undefined}
        onReprocessException={() => undefined}
        reprocessMessage={null}
        reprocessTone={null}
      />,
    );

    expect(html).toContain("Fila de excecoes e acao corretiva");
    expect(html).toContain("Batch ID");
    expect(html).toContain("Pendentes");
    expect(html).toContain("Prioridade");
  });
});