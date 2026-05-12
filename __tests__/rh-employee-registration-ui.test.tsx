import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RhEmployeesPageView } from "@/app/rh/colaboradores/page";
import {
  RhEmployeesManager,
  shouldShowEditableEmployeeStatus,
} from "@/app/rh/colaboradores/rh-employees-manager";

describe("rh employee registration ui", () => {
  it("renders RH employee registration form and list", () => {
    const html = renderToStaticMarkup(
      <RhEmployeesPageView
        canManage
        errorMessage={null}
        initialItems={[
          {
            employee_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            tenant_id: "11111111-1111-4111-8111-111111111111",
            reference_code: "REF-001",
            employee_name: "Maria da Silva",
            admission_date: "01-04-2026",
            status: "pending_activation",
            status_label: "Pendente de ativacao",
            user_id: null,
            notes: "Primeira carga RH",
            created_at: "2026-04-27T12:00:00.000Z",
            updated_at: "2026-04-27T12:00:00.000Z",
          },
        ]}
      />,
    );

    expect(html).toContain("Cadastro de colaboradores");
    expect(html).toContain("Codigo de referencia");
    expect(html).toContain("Verificador secundario");
    expect(html).toContain("Maria da Silva");
    expect(html).toContain("01-04-2026");
    expect(html).toContain("Pendente de ativacao");
  });

  it("explains that initial registration always starts pending activation", () => {
    const html = renderToStaticMarkup(<RhEmployeesManager initialItems={[]} />);

    expect(html).toContain("Cadastro inicial sempre cria colaborador com status pendente de ativacao.");
    expect(html).not.toContain("auditoria registrada");
    expect(html).not.toContain("Salvar alteracoes");
  });

  it("toggles editable status only in edit mode", () => {
    expect(shouldShowEditableEmployeeStatus(null)).toBe(false);
    expect(shouldShowEditableEmployeeStatus("emp-1")).toBe(true);
  });

  it("renders empty guidance for unauthorized or unavailable data", () => {
    const html = renderToStaticMarkup(
      <RhEmployeesPageView
        canManage={false}
        errorMessage="Perfil sem permissao para gerir colaboradores."
        initialItems={[]}
      />,
    );

    expect(html).toContain("Cadastro de colaboradores");
    expect(html).toContain("Perfil sem permissao para gerir colaboradores.");
  });

  it("renders operational warning when list load fails", () => {
    const html = renderToStaticMarkup(
      <RhEmployeesPageView
        canManage={false}
        errorMessage="Falha ao carregar colaboradores funcionais. Tente novamente em instantes."
        initialItems={[]}
      />,
    );

    expect(html).toContain("Falha ao carregar colaboradores funcionais. Tente novamente em instantes.");
  });
});
