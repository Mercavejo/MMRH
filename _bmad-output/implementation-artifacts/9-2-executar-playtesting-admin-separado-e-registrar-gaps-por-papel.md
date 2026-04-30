---
story_id: "9.2"
story_key: "9-2-executar-playtesting-admin-separado-e-registrar-gaps-por-papel"
epic: "9"
title: "Executar Playtesting Admin Separado e Registrar Gaps por Papel"
status: "done"
created_date: "2026-04-28"
last_updated: "2026-04-28"
---

# Story 9.2: Executar Playtesting Admin Separado e Registrar Gaps por Papel

**Epic:** Epic 9 - Playtesting Guiado, Triagem de Achados e Consolidacao do MVP  
**Story ID:** 9.2  
**Priority:** High  
**Status:** done  

> Dependencia direta da Story 9.1: o roteiro cliente e o pacote tecnico ja foram separados. Esta story fecha a metade admin/interna sem reabrir mistura de escopo.

---

## Story Statement

As a responsavel pelo playtesting interno,  
I want validar a jornada admin em roteiro separado,  
So that auditoria, indicadores e investigacao operacional sejam avaliados sem contaminar a experiencia do gestor cliente.

---

## Acceptance Criteria

### AC 1: Roteiro admin executavel com conta interna dedicada

**Given** o ambiente demo seedado com `admin@demo.com` e tenant de playtesting  
**When** o time seguir `docs/ADMIN_PLAYTESTING_GUIDE.md`  
**Then** o roteiro deve poder ser executado integralmente com usuario `admin_plataforma`  
**And** sem depender do roteiro cliente de `docs/PLAYTESTING_GUIDE.md`.

### AC 2: Evidencias separadas por papel e etapa

**Given** a execucao do playtesting interno  
**When** cada etapa relevante da jornada admin for validada  
**Then** deve existir evidencia estruturada separando ao menos `admin_plataforma`, `suporte` quando usado, `rh_gestor` na fronteira negativa e `colaborador` apenas quando citado como comparativo  
**And** cada evidencia deve registrar etapa, papel, resultado esperado, resultado observado, nivel de friccao, `correlation_id` e IDs de apoio quando existirem.

### AC 3: Cobertura minima das capacidades internas

**Given** a jornada interna Mercavejo  
**When** o playtesting for concluido  
**Then** o pacote de evidencias deve cobrir no minimo dashboard interno, indicadores/alertas, fila de excecoes, trilha de auditoria e consolidacao tecnica de suporte  
**And** apontar explicitamente qualquer etapa sem instrumentacao tecnica suficiente.

### AC 4: Vazamento de escopo classificado como bloqueador

**Given** a validacao da fronteira negativa com `rh_gestor`  
**When** qualquer area de observabilidade/admin aparecer na navegacao, API ou UX principal do gestor cliente  
**Then** o achado deve ser classificado como `bloqueador`  
**And** ficar destacado separadamente dos gaps de copy, clareza ou ergonomia interna.

### AC 5: Reuso da base tecnica criada na 9.1

**Given** a infraestrutura de playtest ja criada na Story 9.1  
**When** a Story 9.2 for implementada  
**Then** o time deve evoluir `src/lib/observability/playtest-audit.ts`, `src/lib/observability/playtest-evidence.ts` e `drizzle/scripts/export-playtest-evidence.ts` quando necessario  
**And** nao criar stack paralela de captura/exportacao para admin.

---

## Dependencies and Scope

### Dependencias

- Story 8.5: seed demo, contas de playtesting e guias operacionais base.
- Story 9.1: contrato inicial de evidencia cliente, agregador tecnico e exportador Markdown.
- Epic 4: auditoria, indicadores, alertas, excecoes e suporte operacional ja existem como superficies funcionais.

### Fora de Escopo

- Consolidar e priorizar backlog final da rodada inteira (Story 9.3).
- Emitir recomendacao `go` / `fix` / `defer` do ciclo (Story 9.4).
- Reprojetar UX admin ou construir novos modulos de observabilidade fora dos gaps encontrados.
- Transformar playtesting interno em dashboard analitico permanente.

---

## Story Foundation

- `docs/ADMIN_PLAYTESTING_GUIDE.md` ja define os passos operacionais corretos para validacao interna com `admin_plataforma`.
- O PRD e a UX consolidam que `indicadores`, `auditoria`, `alertas`, `excecoes` e investigacao detalhada pertencem a `admin Mercavejo` / `suporte interno`, nunca ao `gestor cliente`.
- A Story 9.1 resolveu o lado cliente e deixou pistas importantes para 9.2:
  - ha exportador tecnico reutilizavel;
  - ha contrato humano em `docs/playtesting/`;
  - ha risco real de misturar papeis se o pacote tecnico continuar modelado apenas para cliente.
- Hoje o projeto ja emite eventos de playtest para partes da trilha interna, especialmente `src/app/api/v1/rh/indicators/route.ts`, mas ainda nao ha pacote canonico admin equivalente ao cliente nem mapeamento completo de passos internos em `src/lib/observability/playtest-evidence.ts`.

---

## Technical Requirements

### Contrato de Evidencia e Separacao por Papel

1. Criar um artefato humano admin em `docs/playtesting/` separado do template cliente.
2. O contrato admin deve distinguir, no minimo:
   - `admin_plataforma` para dashboard interno, indicadores, alertas, excecoes e auditoria;
   - `suporte` quando a consolidacao tecnica do caso for validada com conta compartilhada;
   - `rh_gestor` para a fronteira negativa;
   - `colaborador` apenas como referencia de comparacao, nunca como etapa principal do roteiro admin.
3. `vazamento_de_escopo` ou equivalente deve aparecer como classificacao explicita de bloqueador, nao apenas como observacao narrativa.

### Reuso Obrigatorio da Infraestrutura 9.1

1. Reusar `src/lib/observability/playtest-audit.ts` para qualquer nova trilha tecnica.
2. Evoluir `src/lib/observability/playtest-evidence.ts` para suportar etapas admin sem quebrar o pacote cliente.
3. Evoluir `drizzle/scripts/export-playtest-evidence.ts` para permitir sessao admin separada por papel, ator ou modo, sem duplicar script.
4. Se houver campos novos no pacote, manter formato simples e compatibilidade com o fluxo cliente atual.

### Superficies Minimas a Validar

1. Dashboard interno em `src/app/rh/page.tsx`.
2. Indicadores e alertas em `src/app/api/v1/rh/indicators/route.ts` e `src/app/api/v1/rh/alerts/route.ts`.
3. Fila de excecoes em `src/app/rh/excecoes/page.tsx` e APIs correlatas de `src/app/api/v1/exceptions/**`.
4. Auditoria em `src/app/rh/auditoria/page.tsx` e `src/app/api/v1/audit-events/route.ts`.
5. Consolidacao tecnica de suporte em `src/app/api/v1/support/cases/[caseId]/route.ts`.

### Guardrails de Instrumentacao

1. Falha de escrita em observabilidade de playtest deve continuar `best-effort` e nunca derrubar o fluxo funcional.
2. Eventos tecnicos devem preservar `tenantId`, `actorId`, `correlationId`, `action`, `resourceType`, `status` e `details`.
3. Ao separar papeis, o agrupamento nao pode depender de uma allowlist cliente hardcoded; usar metadados reais de papel/sessao.
4. O agregador admin nao pode repetir o bug da 9.1 em que filtro por ator inviabiliza etapas multi-papel da mesma sessao.

### Classificacao de Gaps

1. Vazamento de navegacao, rota ou dado admin para `rh_gestor` = `bloqueador`.
2. Falta de instrumentacao tecnica suficiente = gap de observabilidade, a ser registrado mesmo sem falha funcional visivel.
3. Problemas de copy, orientacao ou clareza interna = melhoria, salvo se impedirem operacao.

---

## Architecture Compliance Notes

### Regras Obrigatorias

- Rotas novas ou ajustadas permanecem em `src/app/api/v1/**/route.ts`.
- Respostas HTTP continuam no envelope `{ data, error, meta }` com `x-correlation-id`.
- Reusar `src/lib/api/response.ts`, `src/lib/api/errors.ts`, `src/lib/auth/session.ts`, `src/lib/auth/rbac.ts` e `src/lib/observability/correlation-id.ts`.
- Nenhum acesso cross-tenant e nenhuma autorizacao ad-hoc fora de `assertTenantAction` + `RBAC_ACTIONS`.

### Estrutura de Codigo Alvo

- `docs/ADMIN_PLAYTESTING_GUIDE.md`
- `docs/playtesting/admin-playtest-evidence-template.md`
- `src/lib/observability/playtest-audit.ts`
- `src/lib/observability/playtest-evidence.ts`
- `drizzle/scripts/export-playtest-evidence.ts`
- `src/app/rh/page.tsx`
- `src/app/rh/excecoes/page.tsx`
- `src/app/rh/auditoria/page.tsx`
- `src/app/api/v1/rh/indicators/route.ts`
- `src/app/api/v1/rh/alerts/route.ts`
- `src/app/api/v1/audit-events/route.ts`
- `src/app/api/v1/support/cases/[caseId]/route.ts`

### Nao Reinventar

1. Nao criar segundo exportador ou segundo formato de pacote tecnico so para admin.
2. Nao criar nova tabela apenas para playtesting admin sem necessidade comprovada.
3. Nao misturar evidencias cliente e admin no mesmo template humano.

---

## Library and Framework Requirements

- Next.js `16.2.3` (App Router).
- React `19.2.4`.
- TypeScript `5` strict.
- Zod `4.3.6` para query/body onde houver contrato novo.
- Drizzle ORM `0.45.2`.
- Vitest `4.1.3`.

Nenhuma biblioteca nova deve ser adicionada para esta story sem necessidade comprovada.

---

## Testing Requirements

- Localizacao: `__tests__/**/*.test.ts(x)`.
- Cobertura minima obrigatoria:
  - exportacao/admin package com separacao correta por papel;
  - regressao para sessao multi-papel sem perder evidencias por filtro de ator;
  - eventos/fluxos admin instrumentados com tolerancia a falha de logger;
  - fronteira negativa garantindo que `rh_gestor` nao acessa `indicadores`, `auditoria` e `excecoes`;
  - nenhuma regressao no pacote cliente da Story 9.1.

---

## Previous Story Intelligence (9.1)

- A Story 9.1 ja produziu:
  - `docs/playtesting/client-playtest-evidence-template.md`;
  - `src/lib/observability/playtest-evidence.ts`;
  - `drizzle/scripts/export-playtest-evidence.ts`;
  - eventos para dashboard cliente, historico funcional e suporte do gestor.
- Achados de review da 9.1 que viram guardrail para 9.2:
  - filtro por `--actor-email` pode excluir a troca de papel na mesma sessao;
  - classificacao de papel em dashboard nao pode tratar operador/admin como cliente por heuristica frouxa;
  - observabilidade deve ser resiliente e nao quebrar fluxo funcional;
  - auditoria funcional nao deve ser poluida por eventos semanticos incorretos.

---

## Git Intelligence Summary

Commits recentes reforcam o boundary desta story:

1. `28b16ce` separou gestor cliente da operacao admin.
2. `43bab3b` consolidou auditoria, alertas, indicadores e suporte operacional.

Diretriz: validar e registrar gaps nessa separacao; nao reabrir mistura de escopo.

---

## Project Context Guardrails

- Toda operacao continua limitada por `tenant_id` de sessao.
- Nunca retornar payload fora do envelope padrao.
- Nunca persistir ou expor dados sensiveis desnecessarios no pacote de evidencias.
- Escolher sempre a opcao mais restritiva quando houver duvida de RBAC.

---

## Tasks / Subtasks

### Task 1: Formalizar pacote humano admin separado (AC: 1, 2)

- [x] Criar template admin em `docs/playtesting/` com etapas, papeis e classificacao de severidade.
- [x] Atualizar `docs/ADMIN_PLAYTESTING_GUIDE.md` com instrucoes de captura de `correlation_id` e preenchimento do template.
- [x] Explicitar no guia onde entra `suporte`, onde entra `admin_plataforma` e onde ocorre a fronteira negativa com `rh_gestor`.

### Task 2: Evoluir pacote tecnico para jornada admin (AC: 2, 3, 5)

- [x] Expandir `src/lib/observability/playtest-evidence.ts` para etapas admin sem quebrar o fluxo cliente.
- [x] Garantir agrupamento e exportacao por papel/sessao sem perder evidencias multi-ator.
- [x] Atualizar `drizzle/scripts/export-playtest-evidence.ts` para exportar sessao admin separada de forma reutilizavel.

### Task 3: Fechar gaps de instrumentacao nas superficies internas (AC: 3, 5)

- [x] Revisar dashboard interno, indicadores/alertas, excecoes, auditoria e consolidacao tecnica de suporte.
- [x] Instrumentar tecnicamente as etapas ainda sem eventos suficientes para o pacote admin.
- [x] Manter todos os eventos em modo `best-effort`, sem derrubar fluxo funcional.

### Task 4: Validar e registrar fronteira negativa por papel (AC: 2, 4)

- [x] Garantir evidencias explicitas para `rh_gestor` sem acesso a `Indicadores RH`, `Fila de Exceções` e `Auditoria`.
- [x] Classificar qualquer vazamento de menu, rota ou dado como `bloqueador`.
- [x] Diferenciar gaps de bloqueio real versus melhorias de UX/copy interna.

### Task 5: Cobertura de testes e regressao (AC: 2, 3, 4, 5)

- [x] Adicionar testes do pacote admin e regressao do exportador multi-papel.
- [x] Adicionar/atualizar testes das rotas ou paginas internas instrumentadas.
- [x] Validar que a Story 9.1 continua intacta para jornada cliente.

### Review Findings

- [x] [Review][Patch] Branch em review nao inclui parte obrigatoria do escopo 9.2 [`_bmad-output/implementation-artifacts/9-2-executar-playtesting-admin-separado-e-registrar-gaps-por-papel.md:102`] — story voltou para `in-progress` ate a proxima rodada revisar tambem `src/lib/observability/playtest-evidence.ts`, `drizzle/scripts/export-playtest-evidence.ts`, `src/app/api/v1/support/cases/[caseId]/route.ts`, excecoes e seus testes no mesmo baseline.
- [x] [Review][Patch] Dashboard interno expoe links admin para papeis sem acesso real [`src/app/rh/page.tsx:105`] — `/rh` agora trata `rh_operator` como jornada cliente e restringe CTAs internos de `suporte` ao que o papel realmente acessa.
- [x] [Review][Patch] Exportador admin ainda recria bug de filtro por ator [`drizzle/scripts/export-playtest-evidence.ts:73`] — em modo `admin`, o exportador agora coleta eventos completos do recorte e, quando `--actor-email` for usado, reduz por `correlation_id` da sessao do ator em vez de remover atores secundarios antes da agregacao.
- [x] [Review][Patch] Agregador admin pode classificar suporte do `rh_gestor` como consolidacao interna [`src/lib/observability/playtest-evidence.ts:344`] — o pacote admin agora ignora `playtest.rh.support.case.*` de papeis cliente (`rh_gestor`/`gestor_cliente`/`colaborador`) e mantem `consolidacao_suporte` apenas para `admin_plataforma` e `suporte`.

---

## References

- Source: `_bmad-output/planning-artifacts/epic-9-playtesting-validacao-consolidacao-mvp.md`
- Source: `_bmad-output/implementation-artifacts/9-1-executar-playtesting-cliente-com-captura-estruturada-de-evidencias.md`
- Source: `docs/ADMIN_PLAYTESTING_GUIDE.md`
- Source: `docs/PLAYTESTING_GUIDE.md`
- Source: `_bmad-output/planning-artifacts/prd.md`
- Source: `_bmad-output/planning-artifacts/architecture.md`
- Source: `_bmad-output/planning-artifacts/ux-design-specification.md`
- Source: `_bmad-output/project-context.md`
- Source: `src/lib/observability/playtest-audit.ts`
- Source: `src/lib/observability/playtest-evidence.ts`
- Source: `drizzle/scripts/export-playtest-evidence.ts`
- Source: `src/app/rh/page.tsx`
- Source: `src/app/rh/excecoes/page.tsx`
- Source: `src/app/rh/auditoria/page.tsx`
- Source: `src/app/api/v1/rh/indicators/route.ts`
- Source: `src/app/api/v1/rh/alerts/route.ts`
- Source: `src/app/api/v1/audit-events/route.ts`
- Source: `src/app/api/v1/support/cases/[caseId]/route.ts`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm run test:run -- __tests__/playtest-evidence.test.ts __tests__/rh-dashboard-page.test.tsx __tests__/support-cases-api.test.ts __tests__/rh-indicators-api.test.ts __tests__/rh-alerts-api.test.ts __tests__/audit-events-api.test.ts __tests__/api/exceptions.test.ts`
- `npm run test:run`
- `npm run lint -- .`

### Completion Notes List

- Template humano admin separado criado em `docs/playtesting/admin-playtest-evidence-template.md` e guia admin atualizado com captura de `correlation_id`, papeis e classificacao de gaps.
- Pacote tecnico agora suporta modo `admin`, filtro por papel e agrupamento multi-ator sem quebrar a exportacao cliente da Story 9.1.
- Dashboard interno, indicadores, alertas, auditoria, excecoes e consolidacao de suporte passaram a emitir eventos de playtest reutilizando `writePlaytestEvent` em modo `best-effort`.
- Fronteira negativa do `rh_gestor` passou a gerar eventos explicitos `playtest.rh.boundary.gestor.blocked` para indicadores, auditoria, alertas e excecoes.
- Suite completa validada com `422/422` testes passando e `eslint .` sem erros.

### File List

- `_bmad-output/implementation-artifacts/9-2-executar-playtesting-admin-separado-e-registrar-gaps-por-papel.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/ADMIN_PLAYTESTING_GUIDE.md`
- `docs/playtesting/admin-playtest-evidence-template.md`
- `drizzle/scripts/export-playtest-evidence.ts`
- `src/app/api/v1/audit-events/route.ts`
- `src/app/api/v1/batches/[batch-id]/exceptions/route.ts`
- `src/app/api/v1/rh/alerts/route.ts`
- `src/app/api/v1/rh/indicators/route.ts`
- `src/app/api/v1/support/cases/[caseId]/route.ts`
- `src/app/rh/page.tsx`
- `src/lib/observability/playtest-evidence.ts`
- `__tests__/api/exceptions.test.ts`
- `__tests__/audit-events-api.test.ts`
- `__tests__/playtest-evidence.test.ts`
- `__tests__/rh-alerts-api.test.ts`
- `__tests__/rh-dashboard-page.test.tsx`
- `__tests__/rh-indicators-api.test.ts`
- `__tests__/support-cases-api.test.ts`

### Change Log

- 2026-04-28: Story 9.2 criada e marcada como `ready-for-dev`.
- 2026-04-28: Story 9.2 implementada, validada e movida para `review`.
- 2026-04-28: Review encontrou branch incompleto no baseline `master...HEAD`; story retornou para `in-progress` e `/rh` foi ajustado por papel antes de nova rodada.
- 2026-04-28: Review do working tree completo corrigiu exportacao multi-papel admin e separacao de suporte por papel; story movida para `done`.

## Story Completion Status

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Status: done
