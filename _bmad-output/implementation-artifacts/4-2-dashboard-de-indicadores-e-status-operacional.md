---
story_id: "4.2"
story_key: "4-2-dashboard-de-indicadores-e-status-operacional"
epic: "4"
title: "Dashboard de Indicadores e Status Operacional"
status: "done"
created_date: "2026-04-13"
last_updated: "2026-04-13"
---

# Story 4.2: Dashboard de Indicadores e Status Operacional

**Epic:** Epic 4 - Observabilidade, Auditoria e Suporte Operacional  
**Story ID:** 4.2  
**Priority:** High  
**Status:** done

> Course Correction Note (2026-04-24): esta story foi reclassificada como experiencia interna/admin. Gestores do cliente nao devem visualizar indicadores de entrega, acuracia, pendencias ou status operacional detalhado.

---

## Story Statement

As a admin Mercavejo,
I want visualizar indicadores de entrega, acuracia e pendencias,
So that eu acompanhe a operacao interna e aja cedo em desvios sem transferir esse diagnostico ao gestor cliente.

---

## Acceptance Criteria

### AC 1: Indicadores operacionais e segmentacao

**Given** lotes processados no periodo  
**When** o admin acessar dashboard  
**Then** o sistema deve exibir taxa de entrega, acuracia de roteamento e pendencias  
**And** permitir segmentacao por lote, periodo e unidade organizacional.

### AC 2: Atualizacao consistente e leitura rapida

**Given** atualizacao de dados operacionais  
**When** novos eventos forem consolidados  
**Then** os indicadores devem refletir o estado atual com consistencia  
**And** manter clareza visual para leitura rapida de decisao.

---

## Dependencies and Scope

### Dependencias

- Story 4.1 concluida: trilha de auditoria e consulta por filtros disponiveis para suporte ao dashboard.
- Story 3.2 concluida: metadados de roteamento por lote (totais, matched, pendentes, ambiguos).
- Story 3.5 concluida: status de publicacao e marca temporal de publicacao por lote.
- Story 3.4 concluida: reprocessamento seletivo impacta consolidacao de pendencias e acuracia.

### Fora de Escopo

- Emissao e escalonamento de alertas operacionais (Story 4.3).
- Fluxo completo de suporte e consolidacao de chamados (Story 4.4).
- Exportacao de evidencias para auditoria externa (coberta em historias futuras de compliance/operacao).
- Alteracao de semantica de sessao/autenticacao atual.

---

## Technical Requirements

### API and Contract Requirements

1. Criar endpoint dedicado em `src/app/api/v1/rh/indicators/route.ts`.
2. Manter envelope obrigatorio `{ data, error, meta }` com `x-correlation-id`.
3. Validar query params no boundary com Zod:
   - `batch_id` opcional (UUID)
   - `from` e `to` opcionais (ISO 8601) com regra `from <= to`
   - `organizational_unit` opcional (string normalizada)
4. Respostas esperadas:
   - `200` com indicadores consolidados
   - `400` para filtros invalidos
   - `401` para sessao ausente/invalida
   - `403` para falta de permissao ou tenant mismatch

### Domain and Data Rules

1. Consolidacao tenant-bound: toda consulta deve usar `tenant_id` da sessao.
2. KPI de entrega: percentual de lotes publicados no recorte aplicado.
3. KPI de acuracia de roteamento: `routingMatchedCount / routingTotalCount` (quando `routingTotalCount > 0`).
4. KPI de pendencias: somatorio de `routingPendingCount + routingAmbiguousCount` no recorte aplicado.
5. Segmentacao por lote, periodo e unidade deve ser combinavel no mesmo request.
6. Ausencia de dados deve retornar valores zerados consistentes (nao erro) e metadados de periodo aplicado.

### Security and RBAC Rules

1. Reusar `validateSession`, `assertTenantAction` e `RBAC_ACTIONS` (sem autorizacao ad-hoc).
2. Perfis autorizados: `admin_plataforma`.
3. Qualquer tentativa cross-tenant deve falhar com `403 FORBIDDEN`.

### Performance and Reliability Rules

1. Consultas devem usar colunas ja disponiveis em `batches` para evitar processamento pesado em runtime.
2. Nao fazer N+1 para consolidar indicadores de cards e segmentacao.
3. Tratar divisao por zero na acuracia e evitar `NaN` no payload.
4. Garantir consistencia visual de estados `loading`, `vazio`, `sucesso`, `alerta`, `erro` na UI.

---

## Architecture Compliance Notes

### Regras Obrigatorias

- Rotas somente em `src/app/api/v1/**/route.ts`.
- Usar `src/lib/api/response.ts` e `src/lib/api/errors.ts`.
- Correlation ID via `src/lib/observability/correlation-id.ts`.
- Banco somente via `src/lib/db/client.ts`.
- Schemas somente via export de `src/lib/db/schema/index.ts`.

### Estrutura de Codigo Alvo

- `src/app/api/v1/rh/indicators/route.ts`
- `src/modules/indicators/domain/operational-indicators.ts`
- `src/modules/indicators/application/get-operational-indicators.ts`
- `src/modules/indicators/infrastructure/indicators-repository.ts`
- `src/app/rh/indicadores/page.tsx`
- `src/components/indicators/operational-indicators-dashboard.tsx`

### Reuso Obrigatorio (Nao Reinventar)

1. Reusar padrao de rota de `src/app/api/v1/audit-events/route.ts` para sessao/RBAC/correlation envelope.
2. Reusar dados consolidados de `batches` (`routing*`, `publicationStatus`, `publishedAt`) sem criar tabela nova de KPI.
3. Reusar tokens/linguagem visual em `src/lib/theme/tokens.ts` e padroes de cards/listas da area admin interna (`src/components/exceptions/ExceptionQueuePage.tsx`).
4. Reusar estrategia de filtros e pagina de auditoria interna de `src/app/rh/auditoria/page.tsx` como baseline de acessibilidade e consistencia.

---

## Library and Framework Requirements

- Next.js `16.2.3` (App Router).
- React `19.2.4`.
- TypeScript `^5` strict.
- Zod `^4.3.6` para validacao de filtros.
- Drizzle ORM `^0.45.2` para consultas agregadas.
- Vitest `^4.1.3` para cobertura de API, dominio e UI.

Nenhuma dependencia nova deve ser adicionada para esta story sem justificativa tecnica objetiva.

---

## Testing Requirements Summary

- Localizacao: `__tests__/**/*.test.ts(x)`.
- Cobertura minima obrigatoria:
  - API sucesso com segmentacao por lote, periodo e unidade.
  - Validacao invalida (`400`) para periodo inconsistente ou UUID invalido.
  - Sessao ausente/invalida (`401`).
  - Falha RBAC e cross-tenant (`403`).
  - Calculo de entrega/acuracia/pendencias com dados reais e com dataset vazio.
  - Regressao de divisao por zero em acuracia.
  - UI RH: render dos KPIs, estados vazios/loading/erro e legibilidade de status.
  - Acessibilidade basica: navegacao por teclado, semantica de headings e contraste de indicadores.

---

## Previous Story Intelligence (4.1)

- Story 4.1 consolidou contrato de consulta auditavel com filtros e regras de tenant.
- Review de 4.1 corrigiu falhas reais de filtro temporal e isolamento por `document_id`; 4.2 deve herdar essa disciplina de filtros.
- Padrrao validado em 4.1: sempre retornar envelope padrao, correlation id, erro estruturado e sem vazamento de stack.
- Regressao de upload UI (corrigida em 4.1) reforca necessidade de alinhar validacao de backend e mensagens de frontend.

---

## Git Intelligence Summary

Commits recentes relevantes:

1. `b31b68c`: reprocessamento seletivo com idempotencia e auditoria.
2. `97eccbe`: feedback de validacao/UI e rastreabilidade por correlation id.
3. `4f949ad`: hardening de status em pagina de detalhe sem crash por escopo.

Diretriz para 4.2: manter robustez de status operacional, sem cálculos frágeis e sem romper contratos API atuais.

---

## Latest Tech Notes

- Stack atual usada no projeto ja esta em versoes recentes e compativeis com os contratos existentes.
- Para esta story, evitar introduzir libs de charting novas sem necessidade; priorizar composicao com MUI e componentes atuais.
- Se houver necessidade de visualizacao grafica futura, tratar como incremento posterior com impacto de bundle medido.

---

## Project Context Guardrails

- Nunca retornar resposta fora do envelope padrao.
- Nunca criar cliente de banco paralelo.
- Nunca autorizar acesso sem `assertTenantAction` e `RBAC_ACTIONS`.
- Nunca permitir leitura cross-tenant em agregacoes do dashboard.
- Sempre propagar `x-correlation-id` e incluir `meta.correlation_id`.

---

## Tasks / Subtasks

### Task 1: Contrato API de indicadores (AC: 1)

- [x] Criar `GET /api/v1/rh/indicators` com validacao Zod de filtros.
- [x] Aplicar sessao + RBAC + tenant-bound + correlation id.
- [x] Entregar payload no envelope padrao com `data.indicators` e `data.filters`.

### Task 2: Camada de dominio e repositorio de indicadores (AC: 1)

- [x] Implementar caso de uso em `src/modules/indicators/application`.
- [x] Implementar repositorio com agregacao em `batches` para entrega, acuracia e pendencias.
- [x] Garantir segmentacao por lote, periodo e unidade organizacional sem N+1.

### Task 3: Pagina RH de indicadores (AC: 2)

- [x] Implementar `src/app/rh/indicadores/page.tsx` com filtros operacionais.
- [x] Criar componente de dashboard em `src/components/indicators/operational-indicators-dashboard.tsx`.
- [x] Exibir cards com estados claro (vazio/loading/sucesso/alerta/erro) e linguagem de decisao rapida.

### Task 4: Consistencia e clareza visual (AC: 2)

- [x] Aplicar tokens e padrao visual atual (sem dashboard pesado).
- [x] Garantir contraste minimo WCAG AA em status/badges/indicadores.
- [x] Assegurar navegacao por teclado e semantica para leitura assistiva.

### Task 5: Testes de API e dominio (AC: 1)

- [x] Criar testes de API para sucesso/validacao/sessao/RBAC/cross-tenant.
- [x] Criar testes de dominio para formulas de KPI e casos de dataset vazio.
- [x] Cobrir regressao de divisao por zero e filtros combinados.

### Task 6: Testes de UI RH (AC: 2)

- [x] Validar render dos indicadores e filtros aplicados.
- [x] Validar estados vazios/loading/erro e mensagens operacionais curtas.
- [x] Validar legibilidade e acessibilidade basica dos elementos de status.

### Review Findings

- [x] [Review][Patch] Implementar origem oficial de unidade organizacional no modelo de lote e manter segmentacao ativa (AC 1), substituindo filtro baseado em campo inexistente no `validation_summary`. [sistema-adalto/src/modules/indicators/infrastructure/indicators-repository.ts:21]
- [x] [Review][Patch] UI renderiza erro duplicado na pagina de indicadores (Alert warning na pagina + Alert error no dashboard), causando feedback redundante para o mesmo estado de falha. [sistema-adalto/src/app/(rh)/indicadores/page.tsx:181]
- [x] [Review][Patch] Cobertura de API incompleta para requisito de validacao de UUID invalido em `batch_id` (esperado 400), previsto na propria story em Testing Requirements. [sistema-adalto/__tests__/rh-indicators-api.test.ts:1]

---

## Dev Notes

### Sequencia recomendada de implementacao

1. Fechar contrato API com testes (Task 1 + Task 5 parcial).
2. Consolidar repositorio/dominio de indicadores (Task 2 + Task 5).
3. Implementar tela e componente RH (Task 3 + Task 4 + Task 6).
4. Rodar suite completa e ajustar regressao antes de review.

### Fontes de verdade

- ACs e escopo: `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.2).
- Requisitos FR/NFR: `_bmad-output/planning-artifacts/prd.md` (FR25, FR26, NFR7, NFR18, NFR20).
- Arquitetura e estrutura: `_bmad-output/planning-artifacts/architecture.md`.
- UX de painel operacional: `_bmad-output/planning-artifacts/ux-design-specification.md`.
- Guardrails globais do projeto: `_bmad-output/project-context.md`.
- Inteligencia da story anterior: `_bmad-output/implementation-artifacts/4-1-trilha-de-auditoria-unificada-por-evento.md`.

---

## Story Completion Status

- Story implementada com status `done`.
- Nota de conclusao: implementacao finalizada apos code review e patches aplicados.

---

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- `npm run test:run -- __tests__/rh-indicators-api.test.ts __tests__/rh-indicators-domain.test.ts __tests__/rh-indicators-ui.test.tsx`
- `npm run test:run`
- `npm run lint`

### Completion Notes List

- Implementado endpoint `GET /api/v1/rh/indicators` com validacao Zod, sessao, RBAC tenant-bound e propagacao de correlation id.
- Implementado modulo `indicators` (domain/application/infrastructure) com agregacao tenant-bound de entrega, acuracia e pendencias.
- Implementada pagina RH de indicadores com filtros por lote, periodo e unidade organizacional e cards com estados operacionais.
- Adicionados testes de API, dominio e UI para a story 4.2.
- Regressao completa validada: 188 testes passando.
- Lint executado sem erros (2 warnings preexistentes fora do escopo da story).
- ✅ Resolved review finding [High]: filtro por unidade organizacional agora usa coluna oficial `batches.organizational_unit`.
- ✅ Resolved review finding [Medium]: removido alerta duplicado de erro na pagina de indicadores.
- ✅ Resolved review finding [Medium]: adicionado teste de UUID invalido para `batch_id` com retorno `400`.

### File List

- `_bmad-output/implementation-artifacts/4-2-dashboard-de-indicadores-e-status-operacional.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `sistema-adalto/src/app/api/v1/rh/indicators/route.ts`
- `sistema-adalto/src/modules/indicators/domain/operational-indicators.ts`
- `sistema-adalto/src/modules/indicators/application/get-operational-indicators.ts`
- `sistema-adalto/src/modules/indicators/infrastructure/indicators-repository.ts`
- `sistema-adalto/src/components/indicators/operational-indicators-dashboard.tsx`
- `sistema-adalto/src/app/(rh)/indicadores/page.tsx`
- `sistema-adalto/src/lib/db/schema/batches.ts`
- `sistema-adalto/src/lib/rh/batches/import-batch.ts`
- `sistema-adalto/__tests__/rh-indicators-api.test.ts`
- `sistema-adalto/__tests__/rh-indicators-domain.test.ts`
- `sistema-adalto/__tests__/rh-indicators-ui.test.tsx`

## Change Log

- 2026-04-13: Implementada Story 4.2 com endpoint RH de indicadores, modulo de agregacao operacional, tela de dashboard e cobertura de testes de API/dominio/UI.
- 2026-04-13: Code review concluido com 3 patches aplicados (modelo oficial de unidade organizacional, UI sem erro duplicado e cobertura de UUID invalido).
