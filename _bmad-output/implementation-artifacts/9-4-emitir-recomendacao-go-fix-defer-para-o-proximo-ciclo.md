---
story_id: "9.4"
story_key: "9-4-emitir-recomendacao-go-fix-defer-para-o-proximo-ciclo"
epic: "9"
title: "Emitir Recomendacao Go / Fix / Defer para o Proximo Ciclo"
status: "review"
created_date: "2026-04-28"
last_updated: "2026-04-28"
---

# Story 9.4: Emitir Recomendacao Go / Fix / Defer para o Proximo Ciclo

**Epic:** Epic 9 - Playtesting Guiado, Triagem de Achados e Consolidacao do MVP  
**Story ID:** 9.4  
**Priority:** High  
**Status:** review  

> Esta story fecha o Epic 9. O objetivo nao e coletar mais dados crus nem abrir mais backlog por intuicao; e transformar a consolidacao da 9.3 em uma decisao de ciclo explicita, auditavel e sem ambiguidade operacional.

---

## Story Statement

As a lider do ciclo,  
I want fechar a rodada com uma recomendacao explicita,  
So that o time saiba se deve seguir para nova implementacao, corrigir antes de continuar ou adiar expansoes.

---

## Acceptance Criteria

### AC 1: Recomendacao final explicita e unica

**Given** o pacote consolidado da Story 9.3 com contagens, lacunas e backlog acionavel  
**When** a rodada for encerrada  
**Then** deve ser emitida exatamente uma recomendacao final entre:
- `go`
- `fix`
- `defer`

**And** a regra de decisao deve ser explicita, deterministica e testavel, nao dependente de interpretacao manual solta.

### AC 2: Decisao referenciada por evidencias reais

**Given** a recomendacao final do ciclo  
**When** ela for registrada  
**Then** a justificativa deve citar evidencias concretas da rodada:
- quantidade de `bloqueadores`
- quantidade de `melhoria_antes_da_proxima_demo`
- quantidade de `futuro_backlog`
- etapas sem evidencia suficiente
- areas/papeis com maior friccao
- backlog item(s) que puxaram a decisao

**And** a decisao nao pode exigir reprocessamento manual dos templates crus de cliente/admin se `playtest-triage-report.md` ja existir.

### AC 3: Proximo ciclo definido sem ambiguidade em artefatos operacionais

**Given** a recomendacao final emitida  
**When** a story terminar  
**Then** o proximo ciclo deve ficar definido de forma objetiva em artefatos operacionais do projeto

**And** isso deve incluir:
- registro da decisao em `_bmad-output/implementation-artifacts/decision-gate-log.md`
- atualizacao de `_bmad-output/implementation-artifacts/sprint-status.yaml` com um bloco explicito `decision_gate`
- apontamento do destino imediato do ciclo (`seguir implementacao`, `corrigir bloqueadores`, ou `adiar expansoes`)

### AC 4: Matriz go / fix / defer preserva semantica do Epic 9

**Given** que o Epic 9 troca expansao por evidencia  
**When** a matriz de decisao for aplicada  
**Then** ela deve seguir uma semantica minima:
- `go`: sem bloqueadores ativos e sem lacuna critica de evidencia que comprometa confianca no MVP atual
- `fix`: existe bloqueador confirmado, ou existe melhoria obrigatoria antes da proxima demo para manter confianca operacional
- `defer`: nao ha bloqueador do MVP atual, mas a proxima expansao deve ser adiada por falta de evidencia suficiente ou porque os itens restantes pertencem a backlog futuro

**And** qualquer ajuste nessa matriz deve ficar documentado junto da justificativa final.

### AC 5: Cobertura de testes garante decisao confiavel

**Given** a implementacao da recomendacao do ciclo  
**When** os testes forem executados  
**Then** deve haver cobertura automatizada para:
- mapeamento deterministico para `go`, `fix` e `defer`
- regressao de prioridade (`bloqueador` > `melhoria_antes_da_proxima_demo` > `futuro_backlog`)
- tratamento de etapas sem evidencia suficiente
- selecao dos backlog items que puxam a recomendacao
- atualizacao do artefato de decisao e do `sprint-status.yaml` sem ambiguidade estrutural

---

## Dependencies and Scope

### Dependencias

- Story 9.1: evidencias cliente e exportacao tecnica inicial.
- Story 9.2: evidencias admin separadas e fronteira negativa estabilizada.
- Story 9.3: consolidacao final em `_bmad-output/implementation-artifacts/playtest-triage-report.md`.
- `docs/PLAYTESTING_GUIDE.md` e `docs/ADMIN_PLAYTESTING_GUIDE.md` como origem operacional da rodada.

### Fora de Escopo

- Recoletar evidencias humanas ou tecnicas da rodada.
- Reclassificar manualmente todos os achados da 9.3 a partir de templates crus sem necessidade.
- Corrigir bloqueadores, hardening ou novas funcionalidades encontrados.
- Redesenhar o formato inteiro do backlog do projeto.

---

## Story Foundation

- O Epic 9 existe para substituir intuicao por evidencia. A 9.4 fecha esse loop: ler a consolidacao, decidir, registrar e apontar o proximo movimento do time.
- A Story 9.3 ja deixou pronta a fonte unica de verdade para a rodada:
  - `_bmad-output/implementation-artifacts/playtest-triage-report.md`
  - `src/lib/observability/playtest-evidence.ts`
  - `drizzle/scripts/consolidate-playtest-triage.ts`
- O artefato de 9.3 ja contem:
  - contagem por categoria final;
  - `missing_evidence_steps`;
  - `top_friction_roles`;
  - backlog acionavel com `work_type`, impacto, `correlation_ids` e proxima acao sugerida.
- Portanto, 9.4 deve consumir essa consolidacao gerencial e produzir decisao. Nao deve reabrir parsing disperso dos pacotes cliente/admin como caminho primario.

---

## Technical Requirements

### Fonte Canonica para Decisao

1. Reusar `_bmad-output/implementation-artifacts/playtest-triage-report.md` como fonte primaria da recomendacao.
2. Se for preciso trabalhar com estrutura tipada, evoluir `src/lib/observability/playtest-evidence.ts` para tambem expor um modelo/formatter de decisao, sem duplicar taxonomia.
3. O script existente `drizzle/scripts/consolidate-playtest-triage.ts` deve ser o ponto preferencial de extensao. So criar script novo em `drizzle/scripts/` se ele for fino e reutilizar integralmente o parser/triagem ja existentes.

### Matriz de Decisao Obrigatoria

1. A implementacao deve codificar uma matriz explicita para `go` / `fix` / `defer`.
2. Prioridade minima obrigatoria:
   - qualquer `bloqueador` confirmado puxa `fix`, salvo justificativa documentada para `defer`;
   - ausencia de bloqueador, mas existencia de `melhoria_antes_da_proxima_demo` em etapa critica, puxa `fix`;
   - ausencia de bloqueador e de melhoria obrigatoria, com evidencia suficiente, permite `go`;
   - ausencia de bloqueador, mas com lacunas criticas de evidencia ou backlog apenas exploratorio, permite `defer`.
3. A regra deve produzir nao apenas o rotulo final, mas tambem:
   - resumo executivo curto;
   - lista de fatores que puxaram a decisao;
   - lista de backlog items usados como suporte;
   - proxima acao recomendada para o time.

### Registro Operacional do Gate

1. Atualizar `_bmad-output/implementation-artifacts/decision-gate-log.md` com uma nova entrada datada da rodada.
2. Registrar no log, no minimo:
   - rodada/data;
   - recomendacao final;
   - resumo executivo;
   - evidencias-chave;
   - backlog items determinantes;
   - proximo ciclo recomendado.
3. Atualizar `_bmad-output/implementation-artifacts/sprint-status.yaml` com um bloco top-level `decision_gate`, preservando comentarios e `development_status`.
4. Bloco minimo esperado em `sprint-status.yaml`:
   - `recommendation`
   - `source_story`
   - `source_report`
   - `next_cycle_action`
   - `recorded_at`

### Sem Reinventar Nem Espalhar

1. Nao criar terceiro artefato canonico concorrente ao `playtest-triage-report.md`.
2. Nao mover a logica principal de decisao para componentes UI.
3. Nao criar endpoint HTTP so para escrever log/artefato local; o fluxo e operacional e pode ficar em script/utilitario local.

---

## Architecture Compliance Notes

### Regras Obrigatorias

- Reusar `src/lib/observability/playtest-evidence.ts` para manter uma unica taxonomia de evidencias, triagem e derivacoes.
- Se surgir utilitario novo, mantelo em `drizzle/scripts/` ou `src/lib/observability/`, seguindo padrao ja estabelecido no Epic 9.
- Se algum endpoint for realmente necessario, ele deve permanecer em `src/app/api/v1/**/route.ts` com envelope `{ data, error, meta }` e `x-correlation-id`.
- Nenhuma leitura ou decisao pode ignorar segregacao por papel, `tenant_id` e guardrails de RBAC.

### Estrutura de Codigo Alvo

- `_bmad-output/implementation-artifacts/playtest-triage-report.md`
- `_bmad-output/implementation-artifacts/decision-gate-log.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `drizzle/scripts/consolidate-playtest-triage.ts`
- `src/lib/observability/playtest-evidence.ts`

### Nao Reinventar

1. Nao criar parser paralelo dos templates humanos se `parsePlaytestEvidenceMarkdown` e a consolidacao da 9.3 ja resolverem.
2. Nao criar nova taxonomia alem de `bloqueador`, `melhoria_antes_da_proxima_demo` e `futuro_backlog`.
3. Nao usar heuristica opaca de recomendacao; a regra deve ser audivel em codigo e em artefato.

---

## Library and Framework Requirements

- Next.js `16.2.3` (App Router).
- React `19.2.4`.
- TypeScript `5` strict.
- Drizzle ORM `0.45.2`.
- Zod `4.3.6` se houver contrato novo de CLI/opcao.
- Vitest `4.1.3`.

Nenhuma pesquisa web adicional e necessaria para esta story. Implementacao deve seguir as versoes fixadas no projeto e a stack local ja consolidada.

---

## Testing Requirements

- Localizacao: `__tests__/**/*.test.ts(x)`.
- Cobertura minima obrigatoria:
  - `go` quando nao houver bloqueadores nem lacunas criticas;
  - `fix` quando houver bloqueador confirmado;
  - `fix` quando houver melhoria obrigatoria antes da proxima demo em etapa critica;
  - `defer` quando restarem apenas backlog futuro ou quando a rodada nao sustentar expansao por falta de evidencia suficiente;
  - priorizacao correta dos backlog items determinantes;
  - emissao do log em `decision-gate-log.md`;
  - atualizacao do `sprint-status.yaml` preservando estrutura existente.

---

## Previous Story Intelligence (9.3)

- A 9.3 ja resolveu o problema dificil de consolidacao. A 9.4 nao deve reprocessar evidencias dispersas como fluxo principal.
- O report gerado pela 9.3 ja entrega o que a 9.4 precisa para decidir:
  - contagens por bucket;
  - etapas sem evidencia suficiente;
  - areas de maior friccao por papel;
  - backlog com `work_type`, impacto, IDs de apoio e justificativa.
- Guardrails herdados de 9.2/9.3:
  - vazamento de escopo para `rh_gestor` continua `bloqueador`;
  - gaps de observabilidade podem puxar `fix` se comprometerem confianca na proxima demo;
  - backlog futuro nao deve contaminar decisao como se fosse correcao obrigatoria.

---

## Git Intelligence Summary

Commits recentes seguem reforcando o boundary que a decisao precisa respeitar:

1. `28b16ce fix(scope): separar gestor cliente da operacao admin`
2. `43bab3b feat(rh): consolidar auditoria, alertas, indicadores e suporte operacional`

Diretriz: a recomendacao final deve nascer dessa separacao consolidada. Nao reabrir mistura de escopo nem converter wishlist em trabalho obrigatorio.

---

## Project Context Guardrails

- Nunca permitir acesso cross-tenant na leitura ou consolidacao de evidencias.
- Nunca retornar payload fora do envelope padrao se alguma API for criada.
- Nunca fazer autorizacao ad-hoc fora de `assertTenantAction` e `RBAC_ACTIONS`.
- Escolher sempre a opcao mais restritiva quando houver duvida sobre confianca da rodada.

---

## Tasks / Subtasks

### Task 1: Formalizar motor de recomendacao do ciclo (AC: 1, 4)

- [x] Definir tipo/modelo explicito para `go`, `fix` e `defer` em `src/lib/observability/playtest-evidence.ts` ou modulo adjacente.
- [x] Implementar regra deterministica que consuma a consolidacao da 9.3 e gere recomendacao + fatores determinantes.
- [x] Garantir que a recomendacao preserve prioridade entre `bloqueador`, `melhoria_antes_da_proxima_demo` e `futuro_backlog`.

### Task 2: Emitir artefato final de decisao (AC: 1, 2, 3)

- [x] Evoluir `drizzle/scripts/consolidate-playtest-triage.ts` ou adicionar wrapper fino para produzir a recomendacao final a partir do report consolidado.
- [x] Atualizar `_bmad-output/implementation-artifacts/decision-gate-log.md` com entrada padronizada e auditavel da rodada.
- [x] Garantir que a saida aponte claramente `seguir implementacao`, `corrigir bloqueadores` ou `adiar expansoes`.

### Task 3: Atualizar rastreio operacional do sprint (AC: 3)

- [x] Adicionar bloco `decision_gate` em `_bmad-output/implementation-artifacts/sprint-status.yaml`, preservando comentarios e `development_status`.
- [x] Registrar `recommendation`, `source_story`, `source_report`, `next_cycle_action` e `recorded_at`.
- [x] Validar que a atualizacao nao cria ambiguidade com os status existentes das stories.

### Task 4: Cobertura de testes e regressao (AC: 5)

- [x] Adicionar testes unitarios para a matriz `go` / `fix` / `defer`.
- [x] Cobrir cenarios de priorizacao, lacuna de evidencia e backlog determinante.
- [x] Cobrir serializacao/atualizacao dos artefatos operacionais (`decision-gate-log.md` e `sprint-status.yaml`) sem quebrar estrutura existente.

---

## Dev Notes

### Contexto do Epic

- O Epic 9 troca expansao por evidencia. A 9.4 fecha essa disciplina: decidir explicitamente se o time avanca, corrige ou adia.
- O backlog acionavel ja saiu da 9.3; aqui o foco e direcao, nao triagem nova.

### Referencias Tecnicas Principais

- `_bmad-output/planning-artifacts/epic-9-playtesting-validacao-consolidacao-mvp.md`
- `_bmad-output/implementation-artifacts/9-1-executar-playtesting-cliente-com-captura-estruturada-de-evidencias.md`
- `_bmad-output/implementation-artifacts/9-2-executar-playtesting-admin-separado-e-registrar-gaps-por-papel.md`
- `_bmad-output/implementation-artifacts/9-3-consolidar-achados-e-converter-bloqueadores-em-backlog.md`
- `_bmad-output/implementation-artifacts/playtest-triage-report.md`
- `_bmad-output/implementation-artifacts/decision-gate-log.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/project-context.md`
- `docs/PLAYTESTING_GUIDE.md`
- `docs/ADMIN_PLAYTESTING_GUIDE.md`
- `drizzle/scripts/consolidate-playtest-triage.ts`
- `src/lib/observability/playtest-evidence.ts`

### Project Structure Notes

- O caminho seguro e evoluir os artefatos operacionais e a biblioteca de observabilidade ja existentes.
- Nao ha necessidade clara de UI nova, nova tabela ou novo endpoint para concluir esta story.

---

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story criada a partir de analise de Epic 9, PRD, arquitetura, UX, project context, sprint status, guias de playtesting e learnings de 9.1-9.3.
- 2026-04-28T20:20:46-03:00 - `rtk npm run test:run -- __tests__/playtest-decision-gate.test.ts` falhou no red phase porque `buildPlaytestDecisionGate` ainda nao existia.
- 2026-04-28T20:22:14-03:00 - `rtk npm run test:run -- __tests__/playtest-decision-gate.test.ts` falhou no red phase porque parser/upsert de artefatos ainda nao existiam.
- 2026-04-28T20:25:00-03:00 - `rtk npm run test:run` executado com 438 testes passando.
- 2026-04-28T20:25:00-03:00 - `rtk npm run lint -- .` executado sem erros reportados.

### Completion Notes List

- Story criada com fonte canonica apontada para `playtest-triage-report.md` e `decision-gate-log.md`.
- Matriz minima `go` / `fix` / `defer` definida para evitar heuristica opaca na implementacao.
- Atualizacao obrigatoria de `sprint-status.yaml` documentada via bloco `decision_gate` para cumprir AC de rastreio sem criar tracker paralelo.
- Motor de decisao implementado em `src/lib/observability/playtest-evidence.ts` com fatores determinantes, backlog de suporte e proxima acao recomendada.
- Wrapper `drizzle/scripts/emit-playtest-decision-gate.ts` adicionado para consumir o report consolidado da 9.3, registrar recomendacao auditavel e atualizar `sprint-status.yaml`.
- Rodada atual registrada como `fix`, com proximo ciclo `corrigir bloqueadores`, puxado pelo vazamento de escopo `corr-leak`.
- Testes novos cobrem matriz `go/fix/defer`, parsing do report markdown, serializacao do decision log e upsert do bloco `decision_gate`.

### File List

- `_bmad-output/implementation-artifacts/9-4-emitir-recomendacao-go-fix-defer-para-o-proximo-ciclo.md`
- `_bmad-output/implementation-artifacts/decision-gate-log.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `__tests__/playtest-decision-gate.test.ts`
- `drizzle/scripts/emit-playtest-decision-gate.ts`
- `src/lib/observability/playtest-evidence.ts`

### Change Log

- 2026-04-28: implementado gate deterministico `go/fix/defer`, wrapper operacional para registrar decisao final e cobertura automatizada dos artefatos de decisao.
