import { describe, expect, it } from "vitest";
import {
  buildPlaytestTriageReport,
  parsePlaytestEvidenceMarkdown,
  type PlaytestEvidencePackage,
} from "@/lib/observability/playtest-evidence";

describe("playtest round triage", () => {
  it("maps technical evidence into final triage buckets and summary ready for story 9.4", () => {
    const clientPackage: PlaytestEvidencePackage = {
      generated_at: "2026-04-28T12:00:00.000Z",
      mode: "client",
      tenant_id: "tenant-1",
      actor_id: "gestor-1",
      role_filter: null,
      session_label: "cliente",
      total_events: 3,
      covered_steps: ["upload_lote", "suporte"],
      missing_steps: ["dashboard_cliente", "historico_envio", "troca_para_colaborador"],
      evidences: [
        {
          step: "upload_lote",
          role: "gestor_cliente",
          expected_result: "Upload funciona.",
          observed_result: "Fluxo funcionou, mas faltou CTA para novo lote.",
          friction_level: "low",
          classification: "melhoria",
          correlation_id: "corr-upload",
          support_refs: {
            batch_id: "batch-1",
            document_id: null,
            case_id: null,
            user_id: null,
          },
          technical_actions: ["playtest.rh.batches.import"],
          suggested_action: "Ajustar copy do CTA principal.",
        },
        {
          step: "suporte",
          role: "gestor_cliente",
          expected_result: "Suporte funciona.",
          observed_result: "Tela abriu, mas faltou correlation_id para rastrear caso.",
          friction_level: "medium",
          classification: "gap_observabilidade",
          correlation_id: "corr-support",
          support_refs: {
            batch_id: "batch-1",
            document_id: null,
            case_id: "case-1",
            user_id: null,
          },
          technical_actions: ["playtest.rh.support.case.friction"],
          suggested_action: "Completar trilha tecnica antes da proxima demo.",
        },
      ],
    };

    const adminPackage: PlaytestEvidencePackage = {
      generated_at: "2026-04-28T12:00:00.000Z",
      mode: "admin",
      tenant_id: "tenant-1",
      actor_id: "admin-1",
      role_filter: null,
      session_label: "admin",
      total_events: 1,
      covered_steps: ["fronteira_negativa_gestor"],
      missing_steps: [
        "dashboard_interno",
        "indicadores_alertas",
        "fila_excecoes",
        "auditoria_operacional",
        "consolidacao_suporte",
      ],
      evidences: [
        {
          step: "fronteira_negativa_gestor",
          role: "rh_gestor",
          expected_result: "Gestor nao ve admin.",
          observed_result: "Payload admin apareceu para rh_gestor em rota interna.",
          friction_level: "high",
          classification: "bloqueador",
          correlation_id: "corr-leak",
          support_refs: {
            batch_id: null,
            document_id: null,
            case_id: null,
            user_id: "gestor-1",
          },
          technical_actions: ["playtest.rh.boundary.gestor.leak"],
          suggested_action: "Bloquear rota e remover payload admin.",
        },
      ],
    };

    const report = buildPlaytestTriageReport({
      roundLabel: "rodada-9",
      generatedAt: "2026-04-28T12:30:00.000Z",
      technicalPackages: [clientPackage, adminPackage],
    });

    expect(report.summary.counts).toEqual({
      bloqueador: 1,
      melhoria_antes_da_proxima_demo: 1,
      futuro_backlog: 1,
    });
    expect(report.summary.missing_evidence_steps).toEqual(
      expect.arrayContaining(["dashboard_cliente", "dashboard_interno", "troca_para_colaborador"]),
    );
    expect(report.summary.top_friction_roles).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: "rh_gestor", total_findings: 1 })]),
    );
    expect(report.backlog_items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          final_category: "bloqueador",
          work_type: "bug",
          correlation_ids: ["corr-leak"],
        }),
        expect.objectContaining({
          final_category: "melhoria_antes_da_proxima_demo",
          work_type: "hardening",
          support_refs: expect.objectContaining({ case_ids: ["case-1"] }),
        }),
        expect.objectContaining({
          final_category: "futuro_backlog",
          work_type: "hardening",
          support_refs: expect.objectContaining({ batch_ids: ["batch-1"] }),
        }),
      ]),
    );
  });

  it("deduplicates human and technical evidence while preserving traceability", () => {
    const report = buildPlaytestTriageReport({
      roundLabel: "rodada-9",
      technicalPackages: [
        {
          generated_at: "2026-04-28T12:00:00.000Z",
          mode: "admin",
          tenant_id: "tenant-1",
          actor_id: "support-1",
          role_filter: null,
          session_label: "admin",
          total_events: 1,
          covered_steps: ["consolidacao_suporte"],
          missing_steps: [],
          evidences: [
            {
              step: "consolidacao_suporte",
              role: "suporte",
              expected_result: "Suporte investiga caso.",
              observed_result: "Caso abriu sem correlation_id secundario para documento.",
              friction_level: "medium",
              classification: "gap_observabilidade",
              correlation_id: "corr-case",
              support_refs: {
                batch_id: "batch-1",
                document_id: "doc-1",
                case_id: "case-1",
                user_id: null,
              },
              technical_actions: ["playtest.rh.support.case.friction"],
              suggested_action: "Amarrar documento ao caso exportado.",
            },
          ],
        },
      ],
      humanEntries: [
        {
          source: "human",
          source_label: "admin-template",
          mode: "admin",
          step: "consolidacao_suporte",
          role: "suporte",
          expected_result: "Suporte investiga caso.",
          observed_result: "Mesmo caso exigiu busca manual do documento.",
          friction_level: "medium",
          classification: "gap_observabilidade",
          correlation_id: "corr-case",
          support_refs: {
            batch_id: "batch-1",
            document_id: "doc-1",
            case_id: "case-1",
            user_id: null,
          },
          suggested_action: "Amarrar documento ao caso exportado.",
        },
      ],
    });

    expect(report.backlog_items).toHaveLength(1);
    expect(report.backlog_items[0]).toEqual(
      expect.objectContaining({
        source_types: ["human", "technical"],
        correlation_ids: ["corr-case"],
        support_refs: {
          batch_ids: ["batch-1"],
          case_ids: ["case-1"],
          document_ids: ["doc-1"],
          user_ids: [],
        },
      }),
    );
    expect(report.backlog_items[0].evidence_sources).toEqual(
      expect.arrayContaining(["admin-template", "admin::admin"]),
    );
  });

  it("forces rh_gestor scope leak into blocker even when source tries to downplay severity", () => {
    const report = buildPlaytestTriageReport({
      roundLabel: "rodada-9",
      humanEntries: [
        {
          source: "human",
          source_label: "admin-template",
          mode: "admin",
          step: "fronteira_negativa_gestor",
          role: "rh_gestor",
          expected_result: "Gestor nao ve area admin.",
          observed_result: "Menu admin apareceu para rh_gestor durante teste negativo.",
          friction_level: "low",
          classification: "melhoria",
          correlation_id: "corr-boundary",
          support_refs: {
            batch_id: null,
            document_id: null,
            case_id: null,
            user_id: "gestor-1",
          },
          suggested_action: "Esconder melhor o menu.",
        },
      ],
    });

    expect(report.backlog_items).toEqual([
      expect.objectContaining({
        final_category: "bloqueador",
        work_type: "bug",
      }),
    ]);
  });

  it("ignores sessao modelo rows when parsing human evidence templates", () => {
    const markdown = `
## Evidencias por etapa

| etapa | papel | resultado_esperado | resultado_observado | nivel_de_friccao | correlation_id | links_ids_de_apoio | acao_sugerida |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dashboard_cliente | gestor_cliente | Dashboard funcional. | Dashboard real carregou corretamente. | low | corr-real | batch_id=batch-1 | Revisar copy. |

## Sessao modelo

| etapa | papel | resultado_esperado | resultado_observado | nivel_de_friccao | correlation_id | links_ids_de_apoio | acao_sugerida |
| --- | --- | --- | --- | --- | --- | --- | --- |
| upload_lote | gestor_cliente | Upload funcional. | PDF exemplomulti validado e lote criado. | none | copiar_do_post_/api/v1/rh/batches | batch_id=copiar_do_response | Nenhuma acao corretiva imediata. |
`;

    const parsed = parsePlaytestEvidenceMarkdown(markdown, {
      mode: "client",
      sourceLabel: "client-human",
    });

    expect(parsed).toEqual([
      expect.objectContaining({
        step: "dashboard_cliente",
        correlation_id: "corr-real",
      }),
    ]);
  });

  it("keeps missing-step summary for human-only partial rounds", () => {
    const report = buildPlaytestTriageReport({
      roundLabel: "rodada-humana",
      humanEntries: [
        {
          source: "human",
          source_label: "client-human",
          mode: "client",
          step: "upload_lote",
          role: "gestor_cliente",
          expected_result: "Upload funciona.",
          observed_result: "Fluxo funcionou com clareza.",
          friction_level: "none",
          classification: "ok",
          correlation_id: "corr-human",
          support_refs: {
            batch_id: "batch-1",
            document_id: null,
            case_id: null,
            user_id: null,
          },
          suggested_action: "Nenhuma acao corretiva imediata.",
        },
      ],
    });

    expect(report.summary.missing_evidence_steps).toEqual(
      expect.arrayContaining([
        "dashboard_cliente",
        "historico_envio",
        "suporte",
        "troca_para_colaborador",
      ]),
    );
    expect(report.summary.missing_evidence_steps).not.toContain("upload_lote");
  });

  it("separates bug, hardening and nova funcionalidade in actionable backlog", () => {
    const report = buildPlaytestTriageReport({
      roundLabel: "rodada-9",
      humanEntries: [
        {
          source: "human",
          source_label: "client-template",
          mode: "client",
          step: "upload_lote",
          role: "gestor_cliente",
          expected_result: "Upload funciona.",
          observed_result: "Erro bloqueou envio do lote.",
          friction_level: "high",
          classification: "bloqueador",
          correlation_id: "corr-bug",
          support_refs: {
            batch_id: "batch-2",
            document_id: null,
            case_id: null,
            user_id: null,
          },
          suggested_action: "Corrigir validacao do upload.",
        },
        {
          source: "human",
          source_label: "client-template",
          mode: "client",
          step: "suporte",
          role: "gestor_cliente",
          expected_result: "Suporte rastreavel.",
          observed_result: "Faltou correlation_id no caso tecnico.",
          friction_level: "medium",
          classification: "gap_observabilidade",
          correlation_id: "corr-hardening",
          support_refs: {
            batch_id: null,
            document_id: null,
            case_id: "case-2",
            user_id: null,
          },
          suggested_action: "Completar observabilidade do caso.",
        },
        {
          source: "human",
          source_label: "client-template",
          mode: "client",
          step: "dashboard_cliente",
          role: "gestor_cliente",
          expected_result: "Dashboard cobre essencial do MVP.",
          observed_result: "Tester pediu comparativo CSV entre lotes publicados.",
          friction_level: "low",
          classification: "melhoria",
          correlation_id: "corr-feature",
          support_refs: {
            batch_id: null,
            document_id: null,
            case_id: null,
            user_id: null,
          },
          suggested_action: "destino=nova_funcionalidade Adicionar exportacao CSV comparativa.",
        },
      ],
    });

    expect(report.backlog_items.map((item) => item.work_type)).toEqual([
      "bug",
      "hardening",
      "nova_funcionalidade",
    ]);
  });

  it("parses filled markdown evidence rows and ignores empty template placeholders", () => {
    const markdown = `
| etapa | papel | resultado_esperado | resultado_observado | nivel_de_friccao | correlation_id | links_ids_de_apoio | acao_sugerida |
| --- | --- | --- | --- | --- | --- | --- | --- |
| suporte | gestor_cliente | Consulta funciona. | Caso abriu sem correlation_id no retorno. | medium | corr-1 | case_id=case-1 / batch_id=batch-1 | Completar trilha tecnica. |
| upload_lote | gestor_cliente | Upload funciona. |  | none |  | batch_id= |  |
`;

    const entries = parsePlaytestEvidenceMarkdown(markdown, {
      mode: "client",
      sourceLabel: "client-template",
    });

    expect(entries).toEqual([
      expect.objectContaining({
        source: "human",
        step: "suporte",
        role: "gestor_cliente",
        classification: "gap_observabilidade",
        correlation_id: "corr-1",
        support_refs: expect.objectContaining({
          batch_id: "batch-1",
          case_id: "case-1",
        }),
      }),
    ]);
  });

  it("does not keep a step as missing when only human evidence covers it", () => {
    const report = buildPlaytestTriageReport({
      roundLabel: "rodada-9",
      technicalPackages: [
        {
          generated_at: "2026-04-28T12:00:00.000Z",
          mode: "client",
          tenant_id: "tenant-1",
          actor_id: "gestor-1",
          role_filter: null,
          session_label: "cliente",
          total_events: 0,
          covered_steps: [],
          missing_steps: ["dashboard_cliente", "troca_para_colaborador"],
          evidences: [],
        },
      ],
      humanEntries: [
        {
          source: "human",
          source_label: "client-human",
          mode: "client",
          step: "troca_para_colaborador",
          role: "colaborador",
          expected_result: "Comparativo de escopo do colaborador preservado.",
          observed_result: "Colaborador apareceu apenas como comparativo de escopo.",
          friction_level: "low",
          classification: "melhoria",
          correlation_id: "corr-compare",
          support_refs: {
            batch_id: null,
            document_id: "doc-1",
            case_id: null,
            user_id: "user-1",
          },
          suggested_action: "Manter isolamento de escopo.",
        },
      ],
    });

    expect(report.summary.missing_evidence_steps).toEqual(
      expect.arrayContaining(["dashboard_cliente", "historico_envio", "suporte", "upload_lote"]),
    );
    expect(report.summary.missing_evidence_steps).not.toContain("troca_para_colaborador");
  });

  it("maps comparativo_colaborador from admin template into canonical collaborator step", () => {
    const markdown = `
| etapa | papel | resultado_esperado | resultado_observado | nivel_de_friccao | classificacao | correlation_id | links_ids_de_apoio | acao_sugerida |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| comparativo_colaborador | colaborador | Colaborador aparece so como comparativo. | Colaborador apareceu apenas como comparativo de escopo. | low | melhoria | corr-compare | document_id=doc-2 / user_id=user-2 | Manter comparativo sem expandir jornada. |
`;

    const entries = parsePlaytestEvidenceMarkdown(markdown, {
      mode: "admin",
      sourceLabel: "admin-template",
    });

    expect(entries).toEqual([
      expect.objectContaining({
        step: "troca_para_colaborador",
        role: "colaborador",
        correlation_id: "corr-compare",
        support_refs: expect.objectContaining({
          document_id: "doc-2",
          user_id: "user-2",
        }),
      }),
    ]);
  });
});
