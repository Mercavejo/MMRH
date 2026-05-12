import { describe, expect, it } from "vitest";
import {
  buildPlaytestDecisionGate,
  formatPlaytestDecisionGateLogEntry,
  formatPlaytestTriageReportAsMarkdown,
  parsePlaytestTriageReportMarkdown,
  type PlaytestDecisionRecommendation,
  type PlaytestTriageReport,
  upsertDecisionGateLogEntry,
  upsertDecisionGateInSprintStatus,
  validatePlaytestDecisionGateReport,
} from "@/lib/observability/playtest-evidence";

function makeReport(input: {
  counts?: Partial<PlaytestTriageReport["summary"]["counts"]>;
  missingSteps?: PlaytestTriageReport["summary"]["missing_evidence_steps"];
  backlogItems?: PlaytestTriageReport["backlog_items"];
} = {}): PlaytestTriageReport {
  return {
    generated_at: "2026-04-28T23:30:00.000Z",
    round_label: "rodada-9",
    summary: {
      counts: {
        bloqueador: input.counts?.bloqueador ?? 0,
        melhoria_antes_da_proxima_demo: input.counts?.melhoria_antes_da_proxima_demo ?? 0,
        futuro_backlog: input.counts?.futuro_backlog ?? 0,
      },
      missing_evidence_steps: input.missingSteps ?? [],
      top_friction_roles: [{ role: "gestor_cliente", total_findings: 1 }],
    },
    backlog_items:
      input.backlogItems ??
      [
        {
          title: "Upload e processamento inicial do lote: avaliar expansao solicitada",
          final_category: "futuro_backlog",
          work_type: "nova_funcionalidade",
          summary: "Pedido de exportacao CSV.",
          impact_summary: "gestor_cliente em Upload e processamento inicial do lote",
          suggested_next_action: "Avaliar depois do MVP.",
          triage_reason: "Melhoria valida, mas sem impacto bloqueante no MVP atual.",
          source_types: ["human"],
          evidence_sources: ["client-template"],
          affected_roles: ["gestor_cliente"],
          affected_steps: ["upload_lote"],
          correlation_ids: ["corr-future"],
          support_refs: {
            batch_ids: ["batch-1"],
            document_ids: [],
            case_ids: [],
            user_ids: [],
          },
        },
      ],
  };
}

function expectRecommendation(
  recommendation: ReturnType<typeof buildPlaytestDecisionGate>,
  expected: PlaytestDecisionRecommendation,
) {
  expect(recommendation.recommendation).toBe(expected);
  expect(recommendation.executive_summary.length).toBeGreaterThan(0);
  expect(recommendation.decision_factors.length).toBeGreaterThan(0);
}

describe("playtest decision gate", () => {
  it("returns fix when blocker exists and prioritizes blocker backlog items", () => {
    const report = makeReport({
      counts: {
        bloqueador: 1,
        melhoria_antes_da_proxima_demo: 1,
        futuro_backlog: 1,
      },
      backlogItems: [
        {
          title: "Fronteira negativa do gestor: corrigir falha confirmada",
          final_category: "bloqueador",
          work_type: "bug",
          summary: "Payload admin apareceu para rh_gestor em rota interna.",
          impact_summary: "rh_gestor em Fronteira negativa do gestor",
          suggested_next_action: "Bloquear rota e remover payload admin.",
          triage_reason: "Vazamento de escopo para rh_gestor sempre escala para bloqueador.",
          source_types: ["technical"],
          evidence_sources: ["admin::admin"],
          affected_roles: ["rh_gestor"],
          affected_steps: ["fronteira_negativa_gestor"],
          correlation_ids: ["corr-leak"],
          support_refs: {
            batch_ids: [],
            document_ids: [],
            case_ids: [],
            user_ids: ["gestor-1"],
          },
        },
      ],
    });

    const recommendation = buildPlaytestDecisionGate(report);

    expectRecommendation(recommendation, "fix");
    expect(recommendation.next_cycle_action).toBe("corrigir bloqueadores");
    expect(recommendation.supporting_backlog_items).toEqual([
      expect.objectContaining({
        final_category: "bloqueador",
        correlation_ids: ["corr-leak"],
      }),
    ]);
  });

  it("returns fix when mandatory pre-demo improvement exists in critical step", () => {
    const report = makeReport({
      counts: {
        melhoria_antes_da_proxima_demo: 1,
      },
      backlogItems: [
        {
          title: "Abertura ou consulta de suporte: reforcar confianca operacional",
          final_category: "melhoria_antes_da_proxima_demo",
          work_type: "hardening",
          summary: "Tela abriu, mas faltou correlation_id para rastrear caso.",
          impact_summary: "gestor_cliente em Abertura ou consulta de suporte",
          suggested_next_action: "Completar trilha tecnica antes da proxima demo.",
          triage_reason: "Gap de observabilidade exige correcao antes da proxima demo.",
          source_types: ["technical"],
          evidence_sources: ["client::cliente"],
          affected_roles: ["gestor_cliente"],
          affected_steps: ["suporte"],
          correlation_ids: ["corr-support"],
          support_refs: {
            batch_ids: ["batch-1"],
            document_ids: [],
            case_ids: ["case-1"],
            user_ids: [],
          },
        },
      ],
    });

    const recommendation = buildPlaytestDecisionGate(report);

    expectRecommendation(recommendation, "fix");
    expect(recommendation.next_cycle_action).toBe("corrigir bloqueadores");
    expect(recommendation.decision_factors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("melhoria_antes_da_proxima_demo"),
        expect.stringContaining("suporte"),
      ]),
    );
  });

  it("returns defer when only future backlog remains or critical evidence is missing", () => {
    const onlyFutureReport = makeReport({
      counts: {
        futuro_backlog: 2,
      },
    });

    const missingEvidenceReport = makeReport({
      counts: {
        futuro_backlog: 1,
      },
      missingSteps: ["upload_lote"],
    });

    expectRecommendation(buildPlaytestDecisionGate(onlyFutureReport), "defer");
    expectRecommendation(buildPlaytestDecisionGate(missingEvidenceReport), "defer");
    expect(buildPlaytestDecisionGate(missingEvidenceReport).next_cycle_action).toBe(
      "adiar expansoes",
    );
  });

  it("returns go when no blocker, no mandatory fix and no critical evidence gap", () => {
    const report = makeReport({
      backlogItems: [],
    });

    const recommendation = buildPlaytestDecisionGate(report);

    expectRecommendation(recommendation, "go");
    expect(recommendation.next_cycle_action).toBe("seguir implementacao");
    expect(recommendation.supporting_backlog_items).toEqual([]);
  });

  it("parses triage markdown and serializes auditable decision log entry", () => {
    const triageMarkdown = `
# Consolidacao Final de Playtesting

- Rodada: rodada-9-exemplo
- Gerado em: 2026-04-28T22:59:53.848Z
- Bloqueadores: 1
- Melhorias antes da proxima demo: 1
- Futuro backlog: 2

## Etapas sem evidencia suficiente

- Upload e processamento inicial do lote (\`upload_lote\`)

## Areas de maior friccao por papel

- gestor_cliente: 2 achado(s)

## Backlog Acionavel

### Fronteira negativa do gestor: corrigir falha confirmada

- Categoria final: bloqueador
- Tipo de trabalho: bug
- Resumo reproduzivel: Payload admin apareceu para rh_gestor em rota interna.
- Impacto no MVP: rh_gestor em Fronteira negativa do gestor
- Papeis afetados: rh_gestor
- Etapas afetadas: fronteira_negativa_gestor
- Correlation IDs: corr-leak
- Evidencias de apoio: batch=n/a; document=n/a; case=n/a; user=gestor-1
- Origem: admin::admin
- Motivo da triagem: Vazamento de escopo para rh_gestor sempre escala para bloqueador.
- Proxima acao sugerida: Bloquear rota e remover payload admin.
`;

    const report = parsePlaytestTriageReportMarkdown(triageMarkdown);
    const gate = buildPlaytestDecisionGate(report);
    const logEntry = formatPlaytestDecisionGateLogEntry(gate, report, {
      storyId: "9.4",
      storyKey: "9-4-emitir-recomendacao-go-fix-defer-para-o-proximo-ciclo",
      sourceReportPath: "_bmad-output/implementation-artifacts/playtest-triage-report.md",
      recordedAt: "2026-04-28T23:59:00-03:00",
    });

    expect(report.summary.counts).toEqual({
      bloqueador: 1,
      melhoria_antes_da_proxima_demo: 1,
      futuro_backlog: 2,
    });
    expect(report.backlog_items[0]).toEqual(
      expect.objectContaining({
        title: "Fronteira negativa do gestor: corrigir falha confirmada",
        correlation_ids: ["corr-leak"],
      }),
    );
    expect(logEntry).toContain("## Story 9.4 - 9-4-emitir-recomendacao-go-fix-defer-para-o-proximo-ciclo");
    expect(logEntry).toContain("**Recomendacao:** fix");
    expect(logEntry).toContain("corrigir bloqueadores");
    expect(logEntry).toContain("corr-leak");
    expect(logEntry).toContain("- Melhorias antes da proxima demo: 1");
    expect(logEntry).toContain("- Futuro backlog: 2");
    expect(logEntry).toContain("- Etapas sem evidencia suficiente: upload_lote");
    expect(logEntry).toContain("- Areas/papeis com maior friccao: gestor_cliente (2)");
  });

  it("flags example or template-backed reports before emitting decision gate", () => {
    const triageMarkdown = `
# Consolidacao Final de Playtesting

- Rodada: rodada-9-exemplo
- Gerado em: 2026-04-28T22:59:53.848Z
- Bloqueadores: 0
- Melhorias antes da proxima demo: 0
- Futuro backlog: 1

## Etapas sem evidencia suficiente

- Nenhuma etapa pendente.

## Areas de maior friccao por papel

- gestor_cliente: 1 achado(s)

## Backlog Acionavel

### Clareza do dashboard cliente: avaliar expansao solicitada

- Categoria final: futuro_backlog
- Tipo de trabalho: nova_funcionalidade
- Resumo reproduzivel: Tester pediu comparativo CSV entre lotes publicados.
- Impacto no MVP: gestor_cliente em Clareza do dashboard cliente
- Papeis afetados: gestor_cliente
- Etapas afetadas: dashboard_cliente
- Correlation IDs: corr-feature
- Evidencias de apoio: batch=batch-1; document=n/a; case=n/a; user=n/a
- Origem: client-template
- Motivo da triagem: Melhoria valida, mas sem impacto bloqueante no MVP atual.
- Proxima acao sugerida: destino=nova_funcionalidade Adicionar exportacao CSV comparativa.
`;

    const issues = validatePlaytestDecisionGateReport(
      parsePlaytestTriageReportMarkdown(triageMarkdown),
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "example_round_label" }),
        expect.objectContaining({ code: "template_evidence_source" }),
      ]),
    );
  });

  it("upserts top-level decision_gate block without breaking development_status", () => {
    const original = `# generated: 2026-04-27T17:20:03-03:00
# last_updated: 2026-04-28T14:26:00-03:00
last_updated: 2026-04-28T23:59:00-03:00
project: MMRH Gestão de Pessoas
development_status:
  epic-9: in-progress
  9-4-emitir-recomendacao-go-fix-defer-para-o-proximo-ciclo: in-progress
`;

    const gate = buildPlaytestDecisionGate(
      makeReport({
        counts: { futuro_backlog: 1 },
      }),
    );

    const updated = upsertDecisionGateInSprintStatus(original, gate, {
      sourceStory: "9-4-emitir-recomendacao-go-fix-defer-para-o-proximo-ciclo",
      sourceReport: "_bmad-output/implementation-artifacts/playtest-triage-report.md",
      recordedAt: "2026-04-28T23:59:00-03:00",
    });

    expect(updated).toContain("development_status:");
    expect(updated).toContain("9-4-emitir-recomendacao-go-fix-defer-para-o-proximo-ciclo: in-progress");
    expect(updated).toContain("decision_gate:");
    expect(updated).toContain("recommendation: defer");
    expect(updated).toContain("next_cycle_action: adiar expansoes");
    expect(updated).toContain(
      "source_report: _bmad-output/implementation-artifacts/playtest-triage-report.md",
    );
  });

  it("upserts existing decision gate log entry instead of duplicating same story section", () => {
    const original = `# Decision Gate Log

## Story 9.4 - 9-4-emitir-recomendacao-go-fix-defer-para-o-proximo-ciclo
**Data:** 2026-04-28T20:00:00-03:00
**Recomendacao:** defer
**Origem:** _bmad-output/implementation-artifacts/playtest-triage-report.md
**Proximo ciclo:** adiar expansoes

### Resumo Executivo
Versao antiga.
`;
    const replacement = `## Story 9.4 - 9-4-emitir-recomendacao-go-fix-defer-para-o-proximo-ciclo
**Data:** 2026-04-28T23:59:00-03:00
**Recomendacao:** fix
**Origem:** _bmad-output/implementation-artifacts/playtest-triage-report.md
**Proximo ciclo:** corrigir bloqueadores

### Resumo Executivo
Versao nova.
`;

    const updated = upsertDecisionGateLogEntry(original, replacement, {
      storyId: "9.4",
      storyKey: "9-4-emitir-recomendacao-go-fix-defer-para-o-proximo-ciclo",
    });

    expect(updated.match(/## Story 9\.4 - 9-4-emitir-recomendacao-go-fix-defer-para-o-proximo-ciclo/g))
      .toHaveLength(1);
    expect(updated).toContain("Versao nova.");
    expect(updated).not.toContain("Versao antiga.");
  });

  it("returns defer when critical evidence is missing and no backlog items exist (M1 isolation)", () => {
    const report = makeReport({
      counts: { bloqueador: 0, melhoria_antes_da_proxima_demo: 0, futuro_backlog: 0 },
      backlogItems: [],
      missingSteps: ["upload_lote"],
    });

    const recommendation = buildPlaytestDecisionGate(report);

    expectRecommendation(recommendation, "defer");
    expect(recommendation.decision_factors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("upload_lote"),
        expect.stringContaining("Sem bloqueador ativo"),
      ]),
    );
    expect(recommendation.next_cycle_action).toBe("adiar expansoes");
  });

  it("appends decision gate log entry when story does not yet exist in log (M2)", () => {
    const original = `# Decision Gate Log

## Story 9.3 - 9-3-consolidar-achados
**Data:** 2026-04-28T20:00:00-03:00
**Recomendacao:** go
**Origem:** _bmad-output/implementation-artifacts/playtest-triage-report.md
**Proximo ciclo:** seguir implementacao
`;

    const entryForNewStory = `## Story 9.4 - 9-4-emitir-recomendacao-go-fix-defer-para-o-proximo-ciclo
**Data:** 2026-04-28T23:59:00-03:00
**Recomendacao:** defer
**Origem:** _bmad-output/implementation-artifacts/playtest-triage-report.md
**Proximo ciclo:** adiar expansoes
`;

    const updated = upsertDecisionGateLogEntry(original, entryForNewStory, {
      storyId: "9.4",
      storyKey: "9-4-emitir-recomendacao-go-fix-defer-para-o-proximo-ciclo",
    });

    expect(updated).toContain("Story 9.3");
    expect(updated).toContain("Story 9.4");
    expect(updated).toContain("adiar expansoes");
    expect(updated).toContain("seguir implementacao");
  });

  it("roundtrips triage report through markdown formatting and parsing (M3)", () => {
    const report = makeReport({
      counts: { bloqueador: 1, melhoria_antes_da_proxima_demo: 2, futuro_backlog: 3 },
      missingSteps: ["upload_lote", "suporte"],
      backlogItems: [
        {
          title: "Fronteira negativa do gestor: corrigir falha confirmada",
          final_category: "bloqueador",
          work_type: "bug",
          summary: "Payload admin apareceu para rh_gestor em rota interna.",
          impact_summary: "rh_gestor em Fronteira negativa do gestor",
          suggested_next_action: "Bloquear rota e remover payload admin.",
          triage_reason: "Vazamento de escopo para rh_gestor sempre escala para bloqueador.",
          source_types: ["technical"],
          evidence_sources: ["admin::admin"],
          affected_roles: ["rh_gestor"],
          affected_steps: ["fronteira_negativa_gestor"],
          correlation_ids: ["corr-leak"],
          support_refs: {
            batch_ids: [],
            document_ids: [],
            case_ids: [],
            user_ids: ["gestor-1"],
          },
        },
        {
          title: "Exportacao CSV: avaliar expansao",
          final_category: "futuro_backlog",
          work_type: "nova_funcionalidade",
          summary: "Tester pediu exportacao CSV.",
          impact_summary: "gestor_cliente em Dashboard",
          suggested_next_action: "Avaliar depois do MVP.",
          triage_reason: "Feature valida mas fora do escopo critico do MVP.",
          source_types: ["human"],
          evidence_sources: ["client-template"],
          affected_roles: ["gestor_cliente"],
          affected_steps: ["dashboard_cliente"],
          correlation_ids: ["corr-feature"],
          support_refs: {
            batch_ids: ["batch-1"],
            document_ids: [],
            case_ids: [],
            user_ids: [],
          },
        },
      ],
    });

    const markdown = formatPlaytestTriageReportAsMarkdown(report);
    const parsed = parsePlaytestTriageReportMarkdown(markdown);

    expect(parsed.round_label).toBe(report.round_label);
    expect(parsed.summary.counts).toEqual(report.summary.counts);
    expect(parsed.summary.missing_evidence_steps).toEqual(["suporte", "upload_lote"]);
    expect(parsed.summary.top_friction_roles).toEqual(report.summary.top_friction_roles);
    expect(parsed.backlog_items).toHaveLength(2);
    expect(parsed.backlog_items[0]).toMatchObject({
      title: "Fronteira negativa do gestor: corrigir falha confirmada",
      final_category: "bloqueador",
      correlation_ids: ["corr-leak"],
      suggested_next_action: "Bloquear rota e remover payload admin.",
    });
    expect(parsed.backlog_items[1]).toMatchObject({
      title: "Exportacao CSV: avaliar expansao",
      final_category: "futuro_backlog",
      correlation_ids: ["corr-feature"],
      suggested_next_action: "Avaliar depois do MVP.",
    });
  });
});
