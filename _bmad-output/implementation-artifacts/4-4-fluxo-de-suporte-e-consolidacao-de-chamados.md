---
story_id: "4.4"
story_key: "4-4-fluxo-de-suporte-e-consolidacao-de-chamados"
epic: "4"
title: "Fluxo de Suporte e Consolidacao de Chamados"
status: "done"
created_date: "2026-04-13"
last_updated: "2026-04-13"
---

# Story 4.4: Fluxo de Suporte e Consolidacao de Chamados

**Epic:** Epic 4 - Observabilidade, Auditoria e Suporte Operacional  
**Story ID:** 4.4  
**Priority:** High  
**Status:** done

> Course Correction Note (2026-04-24): suporte e consolidacao de chamados seguem como capacidade interna da Mercavejo. Gestores do cliente apenas abrem o chamado tecnico; a investigacao consolidada fica com suporte/admin.

---

## Story Statement

As a suporte interno,
I want consolidar chamados e executar recuperacao operacional,
So that incidentes recorrentes sejam resolvidos com menor tempo medio de atendimento.

---

## Acceptance Criteria

### AC 1: Consolidacao de historico tecnico e funcional por caso

**Given** chamados relacionados a usuario, documento e lote  
**When** o suporte abrir o caso  
**Then** o sistema deve consolidar historico tecnico e funcional do incidente  
**And** permitir acionar fluxo de recuperacao operacional conforme permissao.

### AC 2: Evidencia auditavel da resolucao de incidente

**Given** conclusao de tratamento de incidente  
**When** o suporte registrar resolucao  
**Then** deve existir evidencia de causa, acao aplicada e resultado  
**And** o registro deve permanecer disponivel para auditoria futura.

---

## Dependencies and Scope

### Dependencias

- Story 4.1 concluida: trilha de auditoria unificada, timeline e filtros por lote/documento/usuario estao disponiveis para consolidacao. [Source: _bmad-output/implementation-artifacts/4-1-trilha-de-auditoria-unificada-por-evento.md]
- Story 4.2 concluida: dashboard e filtros operacionais tenant-bound fornecem padrao de consulta e apresentacao para visao consolidada. [Source: _bmad-output/implementation-artifacts/4-2-dashboard-de-indicadores-e-status-operacional.md]
- Story 4.3 concluida: alertas operacionais com severidade/status e trilha de leitura oferecem gatilho e contexto para abertura do fluxo de suporte. [Source: _bmad-output/implementation-artifacts/4-3-alertas-operacionais-e-escalonamento.md]
- Stories 3.3 e 3.4 concluidas: modulo de excecoes ja possui estado, historico de acoes e reprocessamento idempotente reutilizavel no fluxo de recuperacao. [Source: _bmad-output/implementation-artifacts/3-3-fila-de-excecoes-e-acao-corretiva.md] [Source: _bmad-output/implementation-artifacts/3-4-reprocessamento-seletivo-de-itens-e-lotes.md]

### Fora de Escopo

- Integracao com ferramenta externa de ITSM/help desk (Jira Service Management, Zendesk etc.).
- Automacao de notificacao multicanal de incidentes alem do canal MVP atual.
- Motor de recomendacao baseado em IA para causa-raiz.
- Mudancas globais de modelo RBAC/sessao fora do necessario para a story.

---

## Technical Requirements

### API and Contract Requirements

1. Criar endpoint de consolidacao de caso de suporte em `src/app/api/v1/support/cases/[caseId]/route.ts` para leitura detalhada do incidente por tenant.
2. Criar endpoint de atualizacao de tratamento em `src/app/api/v1/support/cases/[caseId]/resolve/route.ts` para registrar causa, acao e resultado.
3. Manter envelope obrigatorio `{ data, error, meta }` em todas as respostas com `x-correlation-id` e `meta.correlation_id`.
4. Validar filtros e payloads no boundary com Zod `safeParse`, incluindo:
   - query opcional de consolidacao (`batch_id`, `document_id`, `user_id`, `from`, `to`), com `from <= to`
   - payload de resolucao com campos obrigatorios `cause_code`, `action_applied`, `result_status`
   - ids em UUID validos
5. Respostas esperadas:
   - `200` para leitura e resolucao registradas com sucesso
   - `400` para payload/filtros invalidos
   - `401` para sessao ausente/invalida
   - `403` para papel sem permissao ou tenant mismatch
   - `404` para caso inexistente no tenant
   - `409` para transicao invalida do caso

### Domain and Data Rules

1. Consolidacao deve unir contexto de auditoria, alertas e excecoes por `tenant_id`, com chave de correlacao por `correlation_id`.
2. Caso consolidado deve expor no minimo:
   - identificacao: `case_id`, `tenant_id`, `status`, `severity`
   - vinculos: `batch_id`, `document_id`, `user_id`
   - historico: timeline de eventos tecnicos e funcionais
   - suporte: `cause_code`, `action_applied`, `result_status`, `resolved_by`, `resolved_at`
3. Regras de transicao de caso:
   - `open -> in_treatment -> resolved`
   - bloquear transicoes invalidas com erro de dominio `409`
4. Fluxo de recuperacao operacional deve reutilizar semantica de idempotencia do reprocessamento seletivo quando houver acao sobre excecoes/lotes.
5. Evidencias de resolucao devem ser persistidas para consulta futura e exportacao de auditoria.

### Security and RBAC Rules

1. Reusar `validateSession`, `assertTenantAction` e `RBAC_ACTIONS` (sem autorizacao ad-hoc em handler).
2. Perfis permitidos para fluxo de suporte:
   - leitura consolidada: `suporte`, `admin_plataforma`
   - acao de recuperacao/resolucao: `suporte`, `admin_plataforma`
3. Toda operacao deve ser tenant-bound por `session.tenantId` e mismatch deve retornar `403 FORBIDDEN`.
4. Registrar em `audit_logs` eventos de suporte:
   - `support.case.opened.v1`
   - `support.case.recovery.triggered.v1`
   - `support.case.resolved.v1`

### Performance and Reliability Rules

1. Consolidacao de caso deve evitar N+1 em consulta de timeline/eventos (usar agregacao por lote/caso e limites explicitos).
2. Abertura de caso consolidado deve responder dentro do envelope de performance operacional definido para consultas administrativas.
3. Fluxo de recuperacao deve ser idempotente por chave de requisicao para evitar aplicacao duplicada de acao corretiva.
4. Falha de escrita de auditoria nao pode gerar silencio: deve ser logada com correlation id e surface de erro interno quando comprometer evidencia obrigatoria de resolucao.

---

## Architecture Compliance Notes

### Regras Obrigatorias

- Rotas somente em `src/app/api/v1/**/route.ts`.
- Usar utilitarios centrais `src/lib/api/response.ts` e `src/lib/api/errors.ts`.
- Correlation ID via `src/lib/observability/correlation-id.ts`.
- Banco somente via `src/lib/db/client.ts`.
- Schemas Drizzle exportados via `src/lib/db/schema/index.ts`.
- Nao criar trilha paralela fora de `audit_logs`.

### Estrutura de Codigo Alvo

- `src/app/api/v1/support/cases/[caseId]/route.ts`
- `src/app/api/v1/support/cases/[caseId]/resolve/route.ts`
- `src/modules/support/domain/support-case.ts`
- `src/modules/support/application/get-support-case.ts`
- `src/modules/support/application/resolve-support-case.ts`
- `src/modules/support/infrastructure/support-cases-repository.ts`
- `src/components/support/support-case-panel.tsx`
- `src/app/(rh)/auditoria/page.tsx` (extensao de UX para abrir consolidacao de caso)

### Reuso Obrigatorio (Nao Reinventar)

1. Reusar padrao de sessao/RBAC/envelope da rota `src/app/api/v1/audit-events/route.ts` e `src/app/api/v1/rh/alerts/route.ts`.
2. Reusar agregacao de auditoria em `src/modules/audit/infrastructure/audit-events-repository.ts` para timeline de eventos.
3. Reusar regras de estado, acao e recuperacao de excecoes em `src/modules/exceptions/infrastructure/exception-repository.ts` quando o caso envolver excecao.
4. Reusar componentes de timeline existentes (`src/components/audit/status-timeline.tsx`) para visualizacao cronologica.

---

## Library and Framework Requirements

- Next.js 16.2.3 (App Router e Route Handlers).
- React 19.2.x.
- TypeScript ^5 com `strict` habilitado.
- Zod 4.x para validacao de input e payload de resolucao.
- Drizzle ORM 0.45.2 para persistencia e consulta relacional.
- Vitest 4.1.x para testes de API/dominio/UI.

Sem novas dependencias obrigatorias para esta story.

---

## Testing Requirements Summary

Cobertura minima obrigatoria em `__tests__/**/*.test.ts(x)`:

1. API de consolidacao retorna `200` com historico tecnico+funcional quando caso existe no tenant.
2. API retorna `400` para filtros invalidos (UUID/data/payload).
3. API retorna `401` para sessao ausente/invalida.
4. API retorna `403` para perfil sem permissao e para tentativa cross-tenant.
5. API retorna `404` para caso inexistente e `409` para transicao de estado invalida.
6. Dominio valida transicoes `open -> in_treatment -> resolved` e bloqueia caminhos invalidos.
7. Dominio exige persistencia de evidencia (`cause_code`, `action_applied`, `result_status`, `resolved_by`, `resolved_at`) no fechamento.
8. Regressao de idempotencia: mesma chave nao reaplica recuperacao operacional.
9. UI de suporte renderiza timeline consolidada e evidencia final com estados `loading`, `empty`, `error`, `success`.
10. Acessibilidade: navegacao por teclado, semantica de headings e feedback nao dependente apenas de cor.

---

## Previous Story Intelligence (4.3)

1. Story 4.3 estabilizou padrao de filtros Zod e tratamento de periodo no endpoint; manter mesmo rigor em payload de suporte.
2. Review da 4.3 mostrou risco de erro mascarado no dashboard; para 4.4 manter fonte unica de erro por estado de tela.
3. Review da 4.3 apontou risco de fallback silencioso de auditoria; em 4.4 evidencia de resolucao nao pode ser opcional.
4. Estrategia de roles permitidas ja consolidada em auditoria/indicadores/alerts e deve ser reutilizada sem divergir nomenclatura.

---

## Git Intelligence Summary

Commits recentes relevantes para orientar implementacao:

1. `b31b68c` - reprocessamento seletivo com idempotencia e auditoria (base para recuperacao operacional de casos).
2. `97eccbe` - validacao robusta + rastreabilidade por correlation id (aplicar no contrato de suporte).
3. `4f949ad` - hardening de resolucao de status (evitar crash por dados incompletos em consolidacao).
4. `c17bbdb` - trilha de auditoria no fluxo de download (padrao de evidencia de acao).
5. `7894beb` - hardening de compliance (preservar minimizacao e segregacao de dados por tenant).

---

## Latest Tech Notes (Web Check)

1. Next.js docs mantem App Router como baseline e versao exibida 16.2.3, alinhada ao projeto.
2. Zod 4 continua estavel e recomenda TypeScript `strict`, ja aderente ao projeto.
3. Vitest guia atual reforca Node >= 20 e convencao `.test/.spec`, compativel com setup existente.
4. Nao ha mudanca obrigatoria de versao para esta story; manter stack atual evita regressao.

---

## Project Context Guardrails

- Nunca retornar payload fora do envelope padrao de API.
- Nunca criar cliente de banco paralelo por feature.
- Nunca autorizar acesso fora de `assertTenantAction` + `RBAC_ACTIONS`.
- Nunca permitir leitura/escrita cross-tenant de casos/evidencias.
- Sempre propagar `x-correlation-id` e `meta.correlation_id`.
- Sempre registrar evidencia auditavel ao concluir incidente.

---

## Tasks / Subtasks

### Task 1: Contrato API de consolidacao de chamados (AC: 1)

- [x] Criar endpoints de leitura e resolucao de caso de suporte em `/api/v1/support/cases/**`.
- [x] Aplicar sessao + RBAC + tenant-bound + correlation id + envelope padrao.
- [x] Validar query/payload com Zod e mapear erros 400/401/403/404/409.

### Task 2: Dominio e repositorio de caso de suporte (AC: 1, 2)

- [x] Implementar modelo de dominio de caso de suporte com estados e regras de transicao.
- [x] Implementar consolidacao de historico tecnico/funcional a partir de auditoria, alertas e excecoes.
- [x] Implementar comando de resolucao com evidencia obrigatoria e persistencia auditavel.

### Task 3: Fluxo de recuperacao operacional (AC: 1)

- [x] Integrar recuperacao com operacoes existentes de excecao/lote quando aplicavel.
- [x] Garantir idempotencia por chave de requisicao e rastreio por correlation id.
- [x] Registrar evento `support.case.recovery.triggered.v1` com resultado da acao.

### Task 4: UI de consolidacao para suporte (AC: 1, 2)

- [x] Criar painel de caso com contexto consolidado (vinculos, timeline, estado atual, recomendacao).
- [x] Exibir formulario de resolucao com `cause_code`, `action_applied` e `result_status`.
- [x] Exibir evidencia final e historico de alteracoes no mesmo fluxo.

### Task 5: Testes API e dominio (AC: 1, 2)

- [x] Cobrir sucesso, validacao, sessao, RBAC, cross-tenant, not found e conflito de estado.
- [x] Cobrir transicoes de dominio e obrigatoriedade da evidencia de resolucao.
- [x] Cobrir idempotencia do fluxo de recuperacao operacional.

### Task 6: Testes UI e acessibilidade (AC: 1, 2)

- [x] Cobrir render dos estados loading/empty/error/success no painel de suporte.
- [x] Cobrir submissao de resolucao com feedback orientado ao proximo passo.
- [x] Cobrir navegacao por teclado e semantica de leitura da timeline/evidencia.

### Review Findings

- [x] [Review][Patch] Replay idempotente retorna `resolved_at` novo em vez do timestamp original [sistema-adalto/src/modules/support/infrastructure/support-cases-repository.ts:226]
- [x] [Review][Patch] `BATCH_MISMATCH` mapeado para 403, mas o contrato da story exige 409 para conflito de estado [sistema-adalto/src/modules/support/application/resolve-support-case.ts:44]
- [x] [Review][Patch] Estado de loading nao implementado/coberto no painel de suporte [sistema-adalto/src/components/support/support-case-panel.tsx:19]
- [x] [Review][Patch] Requisito de acessibilidade de formulario sem cobertura (labels sem `htmlFor/id` e sem testes de teclado/semantica) [sistema-adalto/src/components/support/support-case-panel.tsx:76]

---

## Dev Notes

### Sequencia recomendada de implementacao

1. Contrato de API + testes de status/seguranca (Task 1 + Task 5 parcial).
2. Dominio/repositorio de consolidacao e resolucao (Task 2 + Task 3 + Task 5).
3. UI de suporte e integracao com auditoria (Task 4 + Task 6).
4. Rodar suite completa antes de mover para `review`.

### Fontes de verdade

- Escopo e ACs: `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.4).
- FR/NFR: `_bmad-output/planning-artifacts/prd.md` (FR28, FR29, FR37, FR38; NFR8, NFR14, NFR22, NFR23).
- Arquitetura e padroes: `_bmad-output/planning-artifacts/architecture.md`.
- UX de estados/feedback/acessibilidade: `_bmad-output/planning-artifacts/ux-design-specification.md`.
- Guardrails globais: `_bmad-output/project-context.md`.
- Aprendizados anteriores: `_bmad-output/implementation-artifacts/4-3-alertas-operacionais-e-escalonamento.md`.

---

## Story Completion Status

- Story implementada e movida para status `review`.
- Nota de conclusao: implementacao e validacao completas com ACs cobertos e regressao verde.

---

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- N/A (create-story context generation)

### Completion Notes List

- Story 4.4 criada com contexto completo de implementacao para suporte operacional.
- Requisitos de consolidacao de historico e evidencia de resolucao detalhados em contrato/dominio/UI/testes.
- Reuso explicito de auditoria, alertas e excecoes para evitar duplicacao de logica.
- Guardrails de RBAC, tenant-bound, correlation id e envelope padrao incorporados ao plano.
- Endpoints implementados: `GET /api/v1/support/cases/[caseId]` e `POST /api/v1/support/cases/[caseId]/resolve` com Zod, sessao, RBAC, tenant-bound e correlation id.
- Dominio de support case implementado com normalizacao de filtros, transicoes de estado, severidade e timeline.
- Repositorio de support case implementado com consolidacao de historico tecnico/funcional e persistencia de evidencia de resolucao em `audit_logs`.
- Recuperacao operacional integrada com `reprocessBatchExceptions` com idempotency key e evento `support.case.recovery.triggered.v1`.
- UI de consolidacao integrada na pagina de auditoria com painel de caso, formulario de resolucao e exibicao de evidencia final.
- Testes adicionados e validados: API, dominio, aplicacao e UI de support case.
- Validacao final executada: `npm run test:run` (218/218 testes passando) e `npm run lint` (0 erros, 2 warnings preexistentes).
- Review patch aplicado: idempotencia de `resolved_at` preservada em replay, mapeamento de conflito `BATCH_MISMATCH` ajustado para 409, painel com estado de loading e semantica de acessibilidade reforcada.
- Validacao de review executada: `npm run test:run -- __tests__/support-case-ui.test.tsx __tests__/support-case-application.test.ts __tests__/support-case-repository.test.ts __tests__/support-cases-api.test.ts` (16/16 testes passando).

### File List

- `_bmad-output/implementation-artifacts/4-4-fluxo-de-suporte-e-consolidacao-de-chamados.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `sistema-adalto/src/modules/support/domain/support-case.ts`
- `sistema-adalto/src/modules/support/infrastructure/support-cases-repository.ts`
- `sistema-adalto/src/modules/support/application/get-support-case.ts`
- `sistema-adalto/src/modules/support/application/resolve-support-case.ts`
- `sistema-adalto/src/app/api/v1/support/cases/[caseId]/route.ts`
- `sistema-adalto/src/app/api/v1/support/cases/[caseId]/resolve/route.ts`
- `sistema-adalto/src/components/support/support-case-panel.tsx`
- `sistema-adalto/src/app/(rh)/auditoria/page.tsx`
- `sistema-adalto/__tests__/support-cases-api.test.ts`
- `sistema-adalto/__tests__/support-case-domain.test.ts`
- `sistema-adalto/__tests__/support-case-application.test.ts`
- `sistema-adalto/__tests__/support-case-ui.test.tsx`
- `sistema-adalto/__tests__/support-case-repository.test.ts`

## Change Log

- 2026-04-13: Story 4.4 criada com status `ready-for-dev` e contexto tecnico completo para implementacao.
- 2026-04-13: Story 4.4 implementada e movida para `review` com API, dominio, recuperacao operacional, UI e testes completos.
- 2026-04-13: Code review aplicado com correcoes de idempotencia, contrato HTTP de conflito (409), loading/a11y no painel e testes de regressao; story movida para `done`.
