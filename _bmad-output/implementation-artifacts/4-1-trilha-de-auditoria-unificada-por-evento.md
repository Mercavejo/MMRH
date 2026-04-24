---
story_id: "4.1"
story_key: "4-1-trilha-de-auditoria-unificada-por-evento"
epic: "4"
title: "Trilha de Auditoria Unificada por Evento"
status: "done"
created_date: "2026-04-13"
last_updated: "2026-04-13"
---

# Story 4.1: Trilha de Auditoria Unificada por Evento

**Epic:** Epic 4 - Observabilidade, Auditoria e Suporte Operacional  
**Story ID:** 4.1  
**Priority:** High  
**Status:** done  

> Course Correction Note (2026-04-24): esta capacidade permanece valida, mas sua exposicao foi reposicionada para `admin Mercavejo` e `suporte interno`. Gestores do cliente nao devem usar auditoria detalhada como parte da jornada principal.

---

## Story Statement

As a admin Mercavejo,
I want consultar trilha auditavel de eventos criticos,
So that eu investigue inconsistencias com evidencia objetiva sem expor diagnostico profundo ao cliente.

---

## Acceptance Criteria

### AC 1: Registro unificado de eventos criticos

**Given** acoes de upload, processamento, publicacao, acesso e reprocessamento  
**When** esses eventos ocorrerem  
**Then** o sistema deve registrar trilha unificada com `timestamp`, `actor`, `tenant_id` e `correlation_id`  
**And** permitir consulta por filtros de lote, documento, usuario e periodo.

### AC 2: Linha do tempo e controle de acesso por RBAC

**Given** necessidade de investigacao operacional  
**When** suporte ou admin abrir detalhe de evento  
**Then** deve existir linha do tempo cronologica de status  
**And** os dados exibidos devem respeitar permissoes RBAC.

---

## Dependencies and Scope

### Dependencias

- Story 3.1: importacao de relatorio e validacao inicial (evento de upload ja auditado).
- Story 3.2: roteamento automatico (evento de processamento ja auditado).
- Story 3.4: reprocessamento seletivo (evento de reprocessamento ja auditado).
- Story 3.5: publicacao segura (evento de publicacao ja auditado).
- Story 2.2: download seguro do colaborador (evento de acesso/download auditavel).

### Fora de Escopo

- Construir dashboard executivo de KPI (Story 4.2).
- Criar motor de alertas e escalonamento (Story 4.3).
- Implementar fluxo completo de suporte/chamados (Story 4.4).
- Alterar semantica de autenticacao/sessao existente.

---

## Technical Requirements

### API and Contract Requirements

1. Implementar endpoint de consulta de auditoria em `src/app/api/v1/audit-events/route.ts`.
2. Manter envelope padrao `{ data, error, meta }` e `x-correlation-id` no request/response.
3. Validar query params com Zod no boundary:
   - `from` e `to` (ISO 8601)
   - `batch_id` opcional
   - `document_id` opcional
   - `user_id` opcional
   - `page` e `page_size` com limites definidos
4. Responder com:
   - `400` para parametros invalidos
   - `401` para sessao ausente/invalida
   - `403` para RBAC ou tenant mismatch
   - `200` para consulta valida

### Domain and Data Rules

1. Toda consulta deve filtrar por `tenant_id` da sessao.
2. Eventos devem manter rastreabilidade minima: `created_at`, `actor_id`, `correlation_id`, `action`, `resource_type`, `resource_id`, `status` e `details`.
3. A listagem deve ser ordenada por tempo desc (`created_at`) com paginação estavel.
4. O detalhe deve permitir montar timeline cronologica para um recurso especifico (lote ou documento) sem expor dados cross-tenant.

### Security and RBAC Rules

1. Reusar `validateSession` + `assertTenantAction` + `RBAC_ACTIONS` para controle de acesso.
2. Permitir leitura apenas para papeis internos/autorizados (`suporte`, `admin_plataforma` e equivalentes internos quando mapeados no tenant).
3. Negar qualquer tentativa de acesso a trilhas de outro tenant com `403`.

### Performance and Reliability Rules

1. Consultas devem ser index-friendly em filtros de tempo, tenant e recurso.
2. Evitar payload excessivo no campo `details` na listagem; manter detalhe completo apenas quando necessario.
3. Preservar consistencia de resposta em caso de falha de parse/query sem vazar stack trace.

---

## Architecture Compliance Notes

### Regras Obrigatorias

- Rotas em `src/app/api/v1/**/route.ts`.
- Utilitarios obrigatorios: `src/lib/api/response.ts` e `src/lib/api/errors.ts`.
- Correlation ID obrigatorio via `src/lib/observability/correlation-id.ts`.
- Cliente de banco unico: `src/lib/db/client.ts`.
- Schemas exportados por `src/lib/db/schema/index.ts`.

### Estrutura de Codigo Alvo

- `src/app/api/v1/audit-events/route.ts`
- `src/modules/audit/application/list-audit-events.ts`
- `src/modules/audit/infrastructure/audit-events-repository.ts`
- `src/modules/audit/domain/audit-event-filters.ts`
- `src/lib/db/schema/audit-logs.ts`
- `src/lib/db/schema/index.ts`
- `src/app/(rh)/auditoria/page.tsx`
- `src/components/audit/status-timeline.tsx`

### Reuso Obrigatorio (Nao Reinventar)

1. Reusar tabela `audit_logs` ja existente para trilha unificada.
2. Reusar padrao de escrita de auditoria ja aplicado em:
   - `src/lib/rh/batches/import-batch.ts`
   - `src/lib/rh/batches/batch-routing-audit.ts`
   - `src/lib/rh/batches/publish-audit.ts`
3. Reusar padrao de guards e correlation id das rotas RH em `src/app/api/v1/rh/batches/**/route.ts`.

---

## Library and Framework Requirements

- Next.js `16.2.3` (App Router).
- React `19.2.4`.
- TypeScript `^5` strict.
- Zod `^4.3.6` para validacao de query params.
- Drizzle ORM `^0.45.2` para consultas tipadas.
- Vitest `^4.1.3` para testes unitarios/integracao.

Nenhuma biblioteca nova deve ser adicionada para esta story sem necessidade comprovada.

---

## Test Requirements Summary

- Localizacao: `__tests__/**/*.test.ts(x)`.
- Cobertura minima obrigatoria:
  - API sucesso com filtros validos.
  - Erro de validacao (`400`).
  - Sessao ausente/invalida (`401`).
  - Acesso sem permissao (`403`).
  - Isolamento de tenant (nunca retorna evento de outro tenant).
  - Ordenacao cronologica e paginacao.
  - Timeline de detalhe por recurso.
  - Envelope `{ data, error, meta }` com `correlation_id`.

---

## Git Intelligence Summary

Ultimos commits relevantes indicam padrao consolidado para esta story:

1. `b31b68c` adicionou reprocessamento seletivo com idempotencia e auditoria.
2. `97eccbe` reforcou persistencia atomica e rastreabilidade por correlation id.
3. `c17bbdb` consolidou auditoria no download seguro de documentos.

Diretriz: expandir a trilha unificada por consulta e timeline, sem quebrar os contratos ja estabilizados.

---

## Project Context Guardrails

- Nao criar cliente de banco paralelo.
- Nao retornar resposta fora do envelope padrao.
- Nao implementar autorizacao ad-hoc fora de `assertTenantAction`.
- Nao permitir leitura cross-tenant em nenhum cenario.

---

## Tasks / Subtasks

### Task 1: Contrato de consulta de auditoria (AC: 1)

- [x] Definir contrato do endpoint de listagem de eventos com filtros e paginação.
- [x] Implementar validacao Zod dos query params e erros padronizados.
- [x] Garantir envelope padrao e propagacao de correlation id.

### Task 2: Regras de RBAC e isolamento por tenant (AC: 1, 2)

- [x] Aplicar validacao de sessao para leitura de auditoria.
- [x] Aplicar `assertTenantAction` com escopo de leitura de tenant.
- [x] Bloquear qualquer retorno de evento fora do tenant da sessao.

### Task 3: Camada de dominio/repositorio de auditoria (AC: 1, 2)

- [x] Implementar caso de uso para listar eventos com filtros por lote/documento/usuario/periodo.
- [x] Implementar consulta de timeline cronologica por recurso.
- [x] Garantir ordenacao e paginação estavel.

### Task 4: UI de auditoria e timeline (AC: 2)

- [x] Implementar pagina RH de auditoria com filtros operacionais.
- [x] Exibir timeline cronologica de status por recurso.
- [x] Preservar acessibilidade de teclado e leitura sequencial.

### Task 5: Testes de API e dominio (AC: 1, 2)

- [x] Criar testes de API para sucesso, validacao, sessao e RBAC.
- [x] Criar testes de dominio para filtros, ordenacao e timeline.
- [x] Cobrir regressao de isolamento por tenant.

### Task 6: Testes de interface RH (AC: 2)

- [x] Validar renderizacao de lista e filtros.
- [x] Validar timeline cronologica e estados vazios.
- [x] Validar feedback de erro operacional e consistencia visual.

### Review Findings

- [x] [Review][Patch] Timeline ignora filtro de periodo quando batch_id/document_id estao ativos [sistema-adalto/src/modules/audit/infrastructure/audit-events-repository.ts:103]
- [x] [Review][Patch] Filtro por document_id nao restringe resource_type para document e pode gerar colisao de recurso [sistema-adalto/src/modules/audit/infrastructure/audit-events-repository.ts:73]
- [x] [Review][Patch] Falta teste explicito de isolamento cross-tenant na API de auditoria (regressao critica de seguranca) [sistema-adalto/__tests__/audit-events-api.test.ts:97]
- [x] [Review][Patch] Upload UI bloqueia PDF apesar da validacao aceitar PDF [sistema-adalto/src/app/(rh)/lotes/page.tsx:75]

---

## Dev Notes

### Implementation Guidance

1. Comecar pela API (`route.ts`) para travar contrato e testes.
2. Em seguida implementar caso de uso/repositorio em `src/modules/audit/**`.
3. Integrar UI RH em `src/app/(rh)/auditoria/page.tsx` com componente de timeline.
4. Fechar com bateria de testes e ajustes de acessibilidade.

### UX Guidance

- Priorizar leitura rapida: filtros objetivos + lista resumida + detalhe em timeline.
- Evitar dashboard pesado; foco em investigacao operacional.
- Mensagens curtas, acionaveis e sem jargao tecnico excessivo.

### Source References

- Epic e ACs: `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.1).
- Requisitos FR/NFR: `_bmad-output/planning-artifacts/prd.md` (FR24-FR29, NFR8, NFR14, NFR26, NFR27).
- Estrutura e padroes: `_bmad-output/planning-artifacts/architecture.md` (envelope API, correlation_id, estrutura `audit-events`).
- UX timeline e auditoria: `_bmad-output/planning-artifacts/ux-design-specification.md` (Status Timeline, acessibilidade, navegacao RH).
- Regras cross-cutting: `_bmad-output/project-context.md`.

---

## Story Completion Status

- Story context criado com status `ready-for-dev`.
- Nota de conclusao: Ultimate context engine analysis completed - comprehensive developer guide created.

---

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- `npm run test:run -- __tests__/audit-events-api.test.ts __tests__/audit-events-domain.test.ts __tests__/audit-ui.test.tsx`
- `npm run test:run`
- `npm run lint`

### Completion Notes List

- Implementado endpoint `GET /api/v1/audit-events` com envelope padrao, validacao Zod de filtros, correlation id e controle de acesso por sessao/RBAC.
- Implementada camada de dominio/aplicacao/repositorio de auditoria com filtros por periodo, lote, documento e usuario, paginação e ordenacao estavel.
- Implementada timeline cronologica de eventos por recurso e pagina RH de auditoria com formulario de filtros e listagem operacional.
- Adicionados testes de API, dominio e UI para trilha de auditoria.
- Regressao completa validada: 166 testes passando.
- ✅ Resolved review finding [High]: Timeline agora respeita filtros de periodo e ator na consulta cronologica por recurso.
- ✅ Resolved review finding [Medium]: Filtro por `document_id` agora aplica `resource_type = document` em listagem e timeline.
- ✅ Resolved review finding [Medium]: Adicionado teste explicito para garantir isolamento cross-tenant na API de auditoria.
- Regressao apos patches de review: 167 testes passando.

### File List

- `_bmad-output/implementation-artifacts/4-1-trilha-de-auditoria-unificada-por-evento.md`
- `sistema-adalto/src/app/api/v1/audit-events/route.ts`
- `sistema-adalto/src/modules/audit/domain/audit-event-filters.ts`
- `sistema-adalto/src/modules/audit/application/list-audit-events.ts`
- `sistema-adalto/src/modules/audit/infrastructure/audit-events-repository.ts`
- `sistema-adalto/src/components/audit/status-timeline.tsx`
- `sistema-adalto/src/app/(rh)/auditoria/page.tsx`
- `sistema-adalto/__tests__/audit-events-api.test.ts`
- `sistema-adalto/__tests__/audit-events-domain.test.ts`
- `sistema-adalto/__tests__/audit-ui.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-13: Story 4.1 implementada com endpoint de auditoria, modulo de consulta/timeline, pagina RH e cobertura de testes.
- 2026-04-13: Findings do code review (chunk 1) aplicados automaticamente e validados por testes.
