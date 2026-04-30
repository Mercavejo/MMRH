---
title: 'Story 9.4 — Fix code review findings e cobertura de testes'
type: 'bugfix'
created: '2026-04-30'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** O code review adversarial da story 9.4 identificou lacunas de cobertura de teste — branches nao exercitados no decision gate (`criticalMissingEvidence` isolado, `upsertDecisionGateLogEntry` append) e ausencia total de teste para `formatPlaytestTriageReportAsMarkdown`.

**Approach:** Adicionar 3 casos de teste direcionados no arquivo existente `playtest-decision-gate.test.ts`, sem modificar codigo fonte (o bug C1 ja estava corrigido na base atual).

## Suggested Review Order

- Teste de `defer` por missing evidence isolado — exercita `criticalMissingEvidence > 0` com `backlog_items` vazio, verificando que o path nunca confunde com `onlyFutureBacklog`.
  [`playtest-decision-gate.test.ts:362`](../../__tests__/playtest-decision-gate.test.ts#L362)

- Teste de `upsertDecisionGateLogEntry` append — story nova inexistente no log existente, exercita o branch `startIndex < 0`.
  [`playtest-decision-gate.test.ts:382`](../../__tests__/playtest-decision-gate.test.ts#L382)

- Teste roundtrip `formatPlaytestTriageReportAsMarkdown` → `parsePlaytestTriageReportMarkdown` — verifica preservacao de counts, missing_steps, e campos de cada backlog item incluindo `suggested_next_action`.
  [`playtest-decision-gate.test.ts:408`](../../__tests__/playtest-decision-gate.test.ts#L408)
