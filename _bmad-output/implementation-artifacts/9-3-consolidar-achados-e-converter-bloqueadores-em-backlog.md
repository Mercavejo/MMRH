---
story_id: "9.3"
story_key: "9-3-consolidar-achados-e-converter-bloqueadores-em-backlog"
epic: "9"
title: "Consolidar Achados e Converter Bloqueadores em Backlog"
status: "done"
created_date: "2026-04-28"
last_updated: "2026-04-28"
---

# Story 9.3: Consolidar Achados e Converter Bloqueadores em Backlog

**Epic:** Epic 9 - Playtesting Guiado, Triagem de Achados e Consolidacao do MVP  
**Story ID:** 9.3  
**Priority:** High  
**Status:** done  

> Esta story fecha a rodada de coleta iniciada em 9.1 e 9.2. O foco nao e abrir novas features por intuicao; e transformar evidencia real em decisao objetiva de backlog.

---

## Story Statement

As a product owner,  
I want consolidar os achados do playtesting em uma triagem objetiva,  
So that apenas problemas reais e priorizados virem novas stories de implementacao.

---

## Acceptance Criteria

### AC 1: Triagem unica com classificacao final por severidade de decisao

**Given** as evidencias humanas e tecnicas das Stories 9.1 e 9.2  
**When** a consolidacao da rodada for executada  
**Then** todo achado deve terminar classificado em exatamente uma das categorias finais:
- `bloqueador`
- `melhoria antes da proxima demo`
- `futuro backlog`

**And** a classificacao final nao pode deixar itens ambiguos entre categorias.

### AC 2: Cada bloqueador tem reproducao, impacto e destino acionavel

**Given** um achado classificado como `bloqueador`  
**When** ele entrar no backlog resultante  
**Then** o item deve registrar:
- descricao reproduzivel
- papel afetado
- passo/etapa do roteiro
- impacto percebido no MVP
- evidencias de apoio (`correlation_id`, `batch_id`, `case_id`, `document_id`, `user_id` quando existirem)
- destino sugerido

**And** o destino sugerido deve indicar se o item e `bug`, `hardening` ou `nova funcionalidade`.

### AC 3: Backlog resultante separa natureza do trabalho

**Given** a consolidacao final  
**When** os itens priorizados forem apresentados para o proximo ciclo  
**Then** o backlog deve separar claramente:
- correcao de bug
- hardening
- nova funcionalidade

**And** cada item deve indicar por que entrou nessa categoria, evitando backlog genérico.

### AC 4: Consolidacao preserva separacao entre jornada cliente e operacao admin

**Given** os artefatos de cliente e admin gerados nas Stories 9.1 e 9.2  
**When** a triagem for executada  
**Then** a consolidacao deve manter separado o contexto de `gestor_cliente`/`colaborador` do contexto `admin_plataforma`/`suporte`

**And** qualquer vazamento de menu, rota, dado ou payload admin para `rh_gestor` deve subir como `bloqueador`.

### AC 5: Artefato final prepara diretamente a Story 9.4

**Given** o pacote consolidado de achados  
**When** a Story 9.3 terminar  
**Then** deve existir um resumo objetivo suficiente para a Story 9.4 emitir `go`, `fix` ou `defer`

**And** a 9.4 nao deve precisar reprocessar dados crus nem reinterpretar evidencias espalhadas.

---

## Dependencies and Scope

### Dependencias

- Story 8.5: dataset demo, scripts de reset e guias operacionais base.
- Story WS.4: readiness de telemetria de playtesting.
- Story 9.1: pacote cliente de evidencias humanas + exportacao tecnica inicial.
- Story 9.2: pacote admin separado, fronteira negativa e exportacao multi-papel sem regressao.

### Fora de Escopo

- Corrigir tecnicamente os bloqueadores encontrados.
- Emitir decisao final `go` / `fix` / `defer` do ciclo completo (Story 9.4).
- Redesenhar UX ou ampliar superficie funcional antes da triagem final.
- Criar dashboard permanente de analytics para playtesting.

---

## Story Foundation

- O Epic 9 existe para trocar expansao por evidencia. A decisao do proximo ciclo deve nascer dos roteiros executados, nao de suposicao.
- As Stories 9.1 e 9.2 ja deixaram dois insumos canônicos:
  - artefatos humanos em `docs/playtesting/client-playtest-evidence-template.md` e `docs/playtesting/admin-playtest-evidence-template.md`;
  - pacote tecnico derivado de `src/lib/observability/playtest-evidence.ts` e `drizzle/scripts/export-playtest-evidence.ts`.
- O sistema ja sabe classificar evidencia tecnica em `ok`, `melhoria`, `gap_observabilidade` e `bloqueador`; a 9.3 precisa elevar isso para decisao de produto/sprint:
  - `bloqueador`
  - `melhoria antes da proxima demo`
  - `futuro backlog`
- O backlog final precisa manter a correcao de escopo de 2026-04-24: observabilidade, auditoria, indicadores, alertas e excecoes continuam contexto interno/admin; jornada do gestor cliente permanece funcional e simplificada.

---

## Technical Requirements

### Consolidacao Canonica da Rodada

1. Reusar os artefatos existentes de 9.1 e 9.2 antes de criar qualquer formato novo:
   - `docs/playtesting/client-playtest-evidence-template.md`
   - `docs/playtesting/admin-playtest-evidence-template.md`
   - `src/lib/observability/playtest-evidence.ts`
   - `drizzle/scripts/export-playtest-evidence.ts`
2. Se surgir logica nova de triagem, ela deve evoluir essa base, nao criar exportador paralelo.
3. A consolidacao deve aceitar sinais humanos e tecnicos no mesmo fluxo, com `correlation_id` como costura principal quando houver evidencia automatica.

### Mapeamento de Classificacao para Decisao

1. Converter `ok`, `melhoria`, `gap_observabilidade` e `bloqueador` em buckets finais de triagem.
2. Regras minimas esperadas:
   - `bloqueador` tecnico ou vazamento de escopo => `bloqueador`
   - `gap_observabilidade` que impede confianca na rodada atual => `melhoria antes da proxima demo` ou `bloqueador`, com justificativa
   - `melhoria` de copy, clareza ou ergonomia => `melhoria antes da proxima demo` ou `futuro backlog`, conforme impacto
   - item sem impacto real no MVP atual => `futuro backlog`
3. A regra de mapeamento deve ser explicita e testavel, nao implícita em texto solto.

### Backlog Acionavel

1. Cada item priorizado deve carregar:
   - titulo curto
   - resumo reproduzivel
   - categoria final
   - tipo de trabalho (`bug`, `hardening`, `nova_funcionalidade`)
   - papel afetado
   - etapa do roteiro
   - impacto no MVP
   - IDs/evidencias de apoio
   - proxima acao sugerida
2. O backlog final deve distinguir problema confirmado de hipotese ou desejo de melhoria.
3. Itens duplicados entre roteiro cliente e admin devem ser consolidados sem apagar evidencias por papel.

### Preparacao para 9.4

1. Gerar um resumo consolidado que informe ao decisor:
   - quantidade de `bloqueadores`
   - quantidade de melhorias antes da proxima demo
   - quantidade de backlog futuro
   - etapas sem evidencia suficiente
   - areas de maior friccao por papel
2. O artefato final deve permitir que a Story 9.4 leia uma fonte unica de verdade.

---

## Architecture Compliance Notes

### Regras Obrigatorias

- Reusar `src/lib/observability/playtest-evidence.ts` para consolidacao tecnica e enriquecer com triagem, se necessario.
- Se houver script operacional novo, mantelo em `drizzle/scripts/` e nao fora desse padrao.
- Se houver endpoint novo, manter em `src/app/api/v1/**/route.ts` com envelope `{ data, error, meta }` e `x-correlation-id`.
- Nenhuma leitura pode ignorar `tenant_id`, RBAC e segregacao de papel.
- Falha de consolidacao operacional nao pode corromper ou reclassificar evidencias originais silenciosamente.

### Estrutura de Codigo Alvo

- `docs/playtesting/client-playtest-evidence-template.md`
- `docs/playtesting/admin-playtest-evidence-template.md`
- `drizzle/scripts/export-playtest-evidence.ts`
- `src/lib/observability/playtest-evidence.ts`
- `_bmad-output/implementation-artifacts/` para o artefato final de triagem consolidada

### Nao Reinventar

1. Nao criar terceiro template humano desconectado dos templates cliente/admin existentes.
2. Nao criar segunda taxonomia de papel ou etapa fora de `PlaytestEvidenceStep` e `PlaytestEvidenceRole` sem motivo comprovado.
3. Nao transformar 9.3 em sistema de backlog completo; o alvo e consolidacao objetiva da rodada atual.

---

## Library and Framework Requirements

- Next.js `16.2.3` (App Router).
- React `19.2.4`.
- TypeScript `5` strict.
- Drizzle ORM `0.45.2`.
- Zod `4.3.6` se houver contrato novo de CLI/API/filtro.
- Vitest `4.1.3`.

Nenhuma biblioteca nova deve ser adicionada para esta story sem necessidade comprovada.

### Latest Technical Information

- Nenhuma pesquisa web adicional e necessaria para esta story. A implementacao deve seguir as versoes fixadas no projeto e reutilizar a stack local ja consolidada.

---

## Testing Requirements

- Localizacao: `__tests__/**/*.test.ts(x)`.
- Cobertura minima obrigatoria:
  - mapeamento de classificacao tecnica -> categoria final de triagem;
  - consolidacao de itens duplicados por evidencia/papel sem perder `correlation_id` e IDs de apoio;
  - regressao garantindo que vazamento de escopo para `rh_gestor` continua `bloqueador`;
  - separacao entre `bug`, `hardening` e `nova_funcionalidade`;
  - resumo final pronto para a Story 9.4 sem depender de leitura manual dos pacotes crus;
  - preservacao do fluxo atual de exportacao cliente/admin de 9.1 e 9.2.

---

## Previous Story Intelligence (9.2)

- 9.2 ja resolveu tres armadilhas que 9.3 nao pode reabrir:
  - filtro por ator nao pode descartar sessoes multi-papel cedo demais;
  - consolidacao de suporte admin nao pode absorver suporte funcional do `rh_gestor`;
  - dashboard interno nao pode reaparecer para papeis sem acesso real.
- O pacote tecnico atual ja entrega:
  - `covered_steps` e `missing_steps`;
  - classificacao por evidencia;
  - agrupamento por `step`, `role` e `correlation_id`;
  - suporte a `mode=client` e `mode=admin`.
- Portanto, 9.3 deve estender a leitura gerencial da rodada, nao reimplementar a base de observabilidade.

---

## Git Intelligence Summary

Commits recentes reforcam a intencao desta story:

1. `28b16ce fix(scope): separar gestor cliente da operacao admin`
2. `43bab3b feat(rh): consolidar auditoria, alertas, indicadores e suporte operacional`

Diretriz: triar em cima dessa separacao consolidada. Nao reabrir mistura de escopos nem transformar backlog em colecao amorfa de melhorias.

---

## Project Context Guardrails

- Nunca permitir acesso cross-tenant durante consolidacao ou leitura de evidencias.
- Nunca retornar payload fora do envelope padrao em caso de API.
- Nunca fazer autorizacao ad-hoc fora de `assertTenantAction` e `RBAC_ACTIONS`.
- Escolher sempre opcao mais restritiva quando houver duvida sobre escopo de papel.

---

## Tasks / Subtasks

### Task 1: Consolidar evidencias canônicas da rodada (AC: 1, 4, 5)

- [x] Reunir artefatos humanos cliente/admin e pacote tecnico exportado como fonte unica de triagem.
- [x] Garantir que evidencias cliente e admin permaneçam separadas por papel, etapa e correlation id.
- [x] Registrar etapas faltantes ou sem evidencias suficientes para alimentar a Story 9.4.

### Task 2: Definir regra objetiva de triagem final (AC: 1, 2, 3)

- [x] Implementar regra explicita para converter classificacoes tecnicas/humanas nas categorias finais da rodada.
- [x] Documentar quando um `gap_observabilidade` sobe para `bloqueador` versus `melhoria antes da proxima demo`.
- [x] Garantir que vazamento de escopo para `rh_gestor` sempre finalize como `bloqueador`.

### Task 3: Produzir backlog acionavel por natureza do trabalho (AC: 2, 3)

- [x] Estruturar itens priorizados separando `bug`, `hardening` e `nova funcionalidade`.
- [x] Incluir descricao reproduzivel, impacto e destino sugerido em cada bloqueador.
- [x] Consolidar duplicatas entre papeis/etapas sem perder trilha de apoio.

### Task 4: Gerar artefato final pronto para decisao do ciclo (AC: 5)

- [x] Produzir resumo consolidado da rodada em `_bmad-output/implementation-artifacts/`.
- [x] Destacar contagem por bucket, lacunas de evidencia e areas de maior friccao.
- [x] Deixar a entrada pronta para a Story 9.4 decidir `go`, `fix` ou `defer` sem reprocessar dados crus.

### Task 5: Cobertura de testes e regressao (AC: 1, 2, 3, 4, 5)

- [x] Adicionar testes da regra de triagem final.
- [x] Cobrir regressao de separacao cliente/admin e de bloqueador por vazamento de escopo.
- [x] Validar que exportacao existente de 9.1/9.2 continua funcional.

---

## Dev Notes

### Project Structure Notes

- Artefatos humanos existentes permanecem em `docs/playtesting/`.
- Logica tecnica reutilizavel permanece em `src/lib/observability/`.
- Scripts operacionais ficam em `drizzle/scripts/`.
- Artefatos de consolidacao desta rodada devem viver em `_bmad-output/implementation-artifacts/`, porque sao insumos de decisao e sprint, nao documentacao de usuario final.

### References

- Source: `_bmad-output/planning-artifacts/epic-9-playtesting-validacao-consolidacao-mvp.md`
- Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-27.md`
- Source: `_bmad-output/planning-artifacts/prd.md`
- Source: `_bmad-output/planning-artifacts/architecture.md`
- Source: `_bmad-output/planning-artifacts/ux-design-specification.md`
- Source: `_bmad-output/project-context.md`
- Source: `_bmad-output/implementation-artifacts/ws4-readiness-playtesting.md`
- Source: `_bmad-output/implementation-artifacts/8-5-seed-data-fluxo-demo-playtesting.md`
- Source: `_bmad-output/implementation-artifacts/9-1-executar-playtesting-cliente-com-captura-estruturada-de-evidencias.md`
- Source: `_bmad-output/implementation-artifacts/9-2-executar-playtesting-admin-separado-e-registrar-gaps-por-papel.md`
- Source: `docs/PLAYTESTING_GUIDE.md`
- Source: `docs/ADMIN_PLAYTESTING_GUIDE.md`
- Source: `docs/playtesting/client-playtest-evidence-template.md`
- Source: `docs/playtesting/admin-playtest-evidence-template.md`
- Source: `src/lib/observability/playtest-evidence.ts`
- Source: `drizzle/scripts/export-playtest-evidence.ts`

## Dev Agent Record

### Review Findings

- [x] [Review][Patch] `missing_evidence_steps` ignora evidencias humanas e pode marcar lacunas falsas para a Story 9.4 [`src/lib/observability/playtest-evidence.ts:1149`]
- [x] [Review][Patch] `sprint-status.yaml` foi regravado com estados regressivos de stories fora do escopo da 9.3, corrompendo rastreamento do sprint [`_bmad-output/implementation-artifacts/sprint-status.yaml:45`]
- [x] [Review][Patch] parser descarta silenciosamente a linha `comparativo_colaborador` do template admin, perdendo evidencia canonica preenchida pelo operador [`src/lib/observability/playtest-evidence.ts:949`]

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `rtk npm run test:run -- __tests__/playtest-round-triage.test.ts`
- `rtk npm run test:run -- __tests__/playtest-round-triage.test.ts __tests__/playtest-evidence.test.ts`
- `npx --yes tsx drizzle/scripts/consolidate-playtest-triage.ts --round-label rodada-9-exemplo --client-technical <tmp>/client-tech.json --admin-technical <tmp>/admin-tech.json --client-human <tmp>/client-human.md --output _bmad-output/implementation-artifacts/playtest-triage-report.md`
- `rtk npm run test:run`
- `rtk npm run lint`

### Completion Notes List

- Story criada com contexto consolidado de 9.1, 9.2, Epic 9, PRD, arquitetura, UX e sprint-change proposal.
- Triagem final explicitamente separada em `bloqueador`, `melhoria antes da proxima demo` e `futuro backlog`.
- Guardrails adicionados para evitar exportador paralelo, mistura cliente/admin e backlog vago.
- Evoluida a base `src/lib/observability/playtest-evidence.ts` com parser de evidencias humanas, mapeamento explicito de triagem final, deduplicacao por trilha de apoio e formatacao do backlog consolidado.
- Adicionado script `drizzle/scripts/consolidate-playtest-triage.ts` para gerar artefato unico de rodada a partir de pacotes tecnicos JSON e templates humanos preenchidos.
- Exportador tecnico existente passou a aceitar `--format json` sem quebrar o fluxo Markdown ja usado em 9.1/9.2.
- Criado `__tests__/playtest-round-triage.test.ts` cobrindo buckets finais, duplicatas humano/tecnico, vazamento para `rh_gestor`, separacao `bug`/`hardening`/`nova_funcionalidade` e parsing de template.
- Gerado `_bmad-output/implementation-artifacts/playtest-triage-report.md` como exemplo canonico de saida pronto para a Story 9.4; como nao ha rodada preenchida persistida no repositorio, o arquivo usa evidencias representativas para validar formato e fluxo.

### File List

- `__tests__/playtest-round-triage.test.ts`
- `_bmad-output/implementation-artifacts/9-3-consolidar-achados-e-converter-bloqueadores-em-backlog.md`
- `_bmad-output/implementation-artifacts/playtest-triage-report.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `drizzle/scripts/consolidate-playtest-triage.ts`
- `drizzle/scripts/export-playtest-evidence.ts`
- `src/lib/observability/playtest-evidence.ts`

## Change Log

- 2026-04-28: Implementada a Story 9.3 com triagem consolidada, parser de evidencias humanas, artefato final para 9.4, JSON opcional no exportador existente e cobertura de regressao completa.
