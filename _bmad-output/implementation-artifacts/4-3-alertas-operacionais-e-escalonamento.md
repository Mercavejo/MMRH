---
story_id: "4.3"
story_key: "4-3-alertas-operacionais-e-escalonamento"
epic: "4"
title: "Alertas Operacionais e Escalonamento"
status: "done"
created_date: "2026-04-13"
last_updated: "2026-04-13"
---

# Story 4.3: Alertas Operacionais e Escalonamento

**Epic:** Epic 4 - Observabilidade, Auditoria e Suporte Operacional  
**Story ID:** 4.3  
**Priority:** High  
**Status:** done

> Course Correction Note (2026-04-24): alertas operacionais continuam validos, mas agora pertencem exclusivamente a `admin Mercavejo`. O gestor cliente nao deve receber nem acompanhar esse painel.

---

## Story Statement

As a admin Mercavejo,
I want receber alertas quando houver falha critica ou desvio,
So that eu acione rapidamente a correcao interna antes de impacto maior no cliente.

---

## Acceptance Criteria

### AC 1: Emissao de alerta com contexto operacional completo

**Given** deteccao de falha critica na ingestao ou publicacao  
**When** condicao de alerta for atendida  
**Then** o sistema deve emitir alerta com severidade, causa e recomendacao  
**And** registrar o alerta na trilha operacional.

### AC 2: Acompanhamento de ciclo de vida do alerta

**Given** alertas ativos  
**When** o admin revisar o painel  
**Then** deve ser possivel acompanhar status de aberto, em tratamento e resolvido  
**And** o tempo de emissao deve respeitar o objetivo definido nos NFRs.

---

## Dependencies and Scope

### Dependencias

- Story 4.1 concluida: trilha auditavel por evento, filtros e timeline operacional ja disponiveis.
- Story 4.2 concluida: dashboard RH com indicadores e filtros operacionais, base para visualizacao de alertas ativos.
- Stories 3.1, 3.2, 3.4, 3.5 concluidas: pipeline de lote com estados e eventos que alimentam deteccao de falha/desvio.

### Fora de Escopo

- Fluxo completo de suporte e consolidacao de chamados (Story 4.4).
- Notificacao multicanal externa (email, SMS, webhook) fora do canal MVP definido.
- Orquestracao de resposta a incidente com automacao de runbook completo.
- Mudanca de semantica global de RBAC, sessao ou politicas de tenant ja vigentes.

---

## Technical Requirements

### API and Contract Requirements

1. Criar endpoint dedicado em `src/app/api/v1/rh/alerts/route.ts` para leitura de alertas operacionais do tenant.
2. Manter envelope obrigatorio `{ data, error, meta }` com `x-correlation-id` e `meta.correlation_id`.
3. Validar query params no boundary com Zod:
   - `status` opcional: `open | in_treatment | resolved`
   - `severity` opcional: `critical | warning | info`
   - `from` e `to` opcionais (ISO 8601 UTC) com regra `from <= to`
   - `batch_id` opcional (UUID)
4. Respostas esperadas:
   - `200` com lista de alertas e metadados de monitoramento
   - `400` para filtros invalidos
   - `401` para sessao ausente/invalida
   - `403` para falta de permissao ou tenant mismatch

### Domain and Data Rules

1. Deteccao tenant-bound: toda avaliacao e consulta deve usar `tenant_id` da sessao.
2. Cada alerta deve conter no minimo: `severity`, `status`, `cause_code`, `recommended_action`, `detected_at`, `emitted_at`, `correlation_id`.
3. Status permitidos: `open`, `in_treatment`, `resolved` com transicoes auditaveis.
4. `emitted_at` deve ser registrado em UTC e permitir afericao de SLA para NFR14 (ate 5 minutos apos deteccao critica).
5. Alertas de falha critica e desvio devem registrar vinculo com lote/documento quando houver contexto operacional.
6. Nenhum alerta pode ser exibido fora do escopo de tenant e permissao do usuario.

### Security and RBAC Rules

1. Reusar `validateSession`, `assertTenantAction` e `RBAC_ACTIONS` (sem autorizacao ad-hoc).
2. Perfis autorizados para consulta e acompanhamento: `admin_plataforma`.
3. Falha de escopo (cross-tenant) deve retornar `403 FORBIDDEN`.
4. Registrar leitura/atualizacao de status de alerta como evento auditavel.

### Performance and Reliability Rules

1. Emissao de alerta critica deve acontecer em janela maxima de 5 minutos apos deteccao (NFR14).
2. Evitar N+1 em consolidacao de lista de alertas e status no painel RH.
3. Garantir idempotencia na emissao para evitar duplicidade por reprocessamento do mesmo evento.
4. Garantir consistencia entre trilha de auditoria, status do alerta e visualizacao do painel.

---

## Architecture Compliance Notes

### Regras Obrigatorias

- Rotas somente em `src/app/api/v1/**/route.ts`.
- Usar `src/lib/api/response.ts` e `src/lib/api/errors.ts`.
- Correlation ID via `src/lib/observability/correlation-id.ts` (ou wrapper equivalente do projeto).
- Banco somente via `src/lib/db/client.ts`.
- Schemas via export unico de `src/lib/db/schema/index.ts`.

### Estrutura de Codigo Alvo

- `src/app/api/v1/rh/alerts/route.ts`
- `src/modules/alerts/domain/operational-alert.ts`
- `src/modules/alerts/application/get-operational-alerts.ts`
- `src/modules/alerts/infrastructure/alerts-repository.ts`
- `src/components/alerts/operational-alerts-panel.tsx`
- `src/app/rh/indicadores/page.tsx` (extensao da tela de indicadores admin para bloco de alertas)

### Reuso Obrigatorio (Nao Reinventar)

1. Reusar baseline de sessao/RBAC/envelope da rota `src/app/api/v1/rh/indicators/route.ts` (story 4.2).
2. Reusar padrao de feedback visual da UI RH em `src/components/indicators/operational-indicators-dashboard.tsx` e `src/app/(rh)/lotes/batch-progress-panel.tsx`.
3. Reusar trilha/eventos de auditoria da story 4.1 para evitar nova trilha paralela.
4. Reusar nomenclatura de severidade ja aplicada na validacao de importacao (`critical`, `warning`) em `src/lib/rh/batches/import-validation.ts`.

---

## Library and Framework Requirements

- Next.js `16.2.3` (App Router).
- React `19.2.x` (compativel com stack atual do projeto).
- TypeScript `^5` com `strict` habilitado.
- Zod `^4.3.6` para validacao de filtros e payloads de dominio.
- Drizzle ORM `^0.45.2` para persistencia/consulta.
- Vitest `^4.1.3` para cobertura de API, dominio e UI.

Sem dependencias novas para esta story, salvo aprovacao explicita por necessidade tecnica comprovada.

---

## Testing Requirements Summary

Cobertura minima obrigatoria em `__tests__/**/*.test.ts(x)`:

1. API `GET /api/v1/rh/alerts` com retorno `200` para filtros validos.
2. API com `400` para status/severity invalidos, UUID invalido e periodo inconsistente.
3. API com `401` para sessao ausente/invalida.
4. API com `403` para papel sem permissao e para tentativa cross-tenant.
5. Dominio: regras de classificacao de severidade e transicao de status (`open -> in_treatment -> resolved`).
6. Dominio: verificacao de SLA NFR14 (`emitted_at - detected_at <= 5 min`) para alertas criticos.
7. Regressao de idempotencia: mesmo evento nao cria alerta duplicado.
8. UI RH: render de alertas por status/severidade com mensagens orientadas ao proximo passo.
9. UI RH: estados `loading`, `empty`, `success`, `warning`, `error` sem ambiguidade.
10. Acessibilidade basica: navegacao por teclado, semantica de headings, feedback nao dependente apenas de cor.

---

## Previous Story Intelligence (4.2)

1. Story 4.2 consolidou padrao robusto para filtros, tenant-bound, RBAC e correlation id na camada RH.
2. Houve ajuste de review para evitar fonte de filtro inexistente; nesta story, toda coluna/filtro precisa mapear para campo oficial de schema antes de codificar.
3. Houve ajuste de review para evitar feedback duplicado de erro na UI; painel de alertas deve ter unica fonte de erro por estado.
4. Cobertura de validacao deve incluir UUID invalido e casos de borda de filtro no endpoint.

---

## Git Intelligence Summary

Commits recentes relevantes para orientar implementacao:

1. `b31b68c` - reforcou idempotencia e auditoria em reprocessamento seletivo.
2. `97eccbe` - reforcou rastreabilidade por correlation id e consistencia de validacao/UI.
3. `4f949ad` - hardening de resolucao de status para evitar crash por escopo.

Diretriz para 4.3: manter hardening de status e rastreabilidade sem quebrar contratos API existentes.

---

## Latest Tech Notes (Web Check)

1. Next.js docs indicam App Router como baseline atual e versao de referencia `16.2.3`, alinhada ao projeto.
2. React docs exibem serie `19.2`, alinhada com o runtime ja adotado.
3. Vitest guide reforca `Node >= 20` e convencao de testes `.test/.spec`, alinhado ao setup atual.
4. Zod 4 esta estavel e requer TypeScript strict, ja aderente ao projeto.
5. Drizzle segue abordagem SQL-like/headless sem dependencia extra; manter uso do cliente central atual.

Nenhum ajuste de versao e obrigatorio para esta story no estado atual.

---

## Project Context Guardrails

- Nunca retornar resposta fora do envelope padrao.
- Nunca criar cliente de banco paralelo.
- Nunca autorizar acesso sem `assertTenantAction` e `RBAC_ACTIONS`.
- Nunca permitir leitura cross-tenant de alertas/eventos.
- Sempre propagar `x-correlation-id` e incluir `meta.correlation_id`.

---

## Tasks / Subtasks

### Task 1: Contrato API de alertas operacionais (AC: 1)

- [x] Criar `GET /api/v1/rh/alerts` com validacao Zod de filtros.
- [x] Aplicar sessao + RBAC + tenant-bound + correlation id.
- [x] Entregar payload padrao com lista de alertas e metadados de emissao.

### Task 2: Dominio e repositorio de alertas (AC: 1)

- [x] Implementar entidades e regras de severidade/status em `src/modules/alerts/domain`.
- [x] Implementar caso de uso em `src/modules/alerts/application`.
- [x] Implementar repositorio em `src/modules/alerts/infrastructure` com idempotencia de emissao.

### Task 3: Painel RH de acompanhamento de alertas (AC: 2)

- [x] Criar `src/components/alerts/operational-alerts-panel.tsx` para exibir alertas ativos e historico recente.
- [x] Integrar painel na pagina `src/app/(rh)/indicadores/page.tsx` preservando filtros e contexto.
- [x] Exibir estados `open`, `in_treatment`, `resolved` com severidade e recomendacao de acao.

### Task 4: SLA e rastreabilidade operacional (AC: 2)

- [x] Garantir metrica de tempo de emissao para comparacao com NFR14.
- [x] Registrar eventos de ciclo de vida do alerta na trilha operacional.
- [x] Assegurar consistencia entre status de alerta, dashboard e auditoria.

### Task 5: Testes de API e dominio (AC: 1, 2)

- [x] Cobrir sucesso/validacao/sessao/RBAC/cross-tenant na API.
- [x] Cobrir idempotencia, severidade, transicoes de status e SLA NFR14 no dominio.
- [x] Cobrir regressao de filtros invalidos e datas inconsistentes.

### Task 6: Testes de UI RH (AC: 2)

- [x] Validar render de alertas por severidade e status.
- [x] Validar estados vazio/loading/erro e mensagens de proximo passo.
- [x] Validar acessibilidade basica (teclado, contraste, semantica).

### Review Findings

- [x] [Review][Patch] Aplicar limite fixo de 200 itens na consulta de alertas (decisao tomada em review) [sistema-adalto/src/modules/alerts/infrastructure/alerts-repository.ts:26]
- [x] [Review][Patch] RBAC inconsistente para perfil suporte [sistema-adalto/src/app/(rh)/indicadores/page.tsx:104]
- [x] [Review][Patch] Filtro de data da UI envia formato incompativel com API (`datetime-local` sem timezone) [sistema-adalto/src/app/(rh)/indicadores/page.tsx:211]
- [x] [Review][Patch] Escrita de auditoria pode ser ignorada silenciosamente por type-guard de `db.insert` [sistema-adalto/src/app/api/v1/rh/alerts/route.ts:68]
- [x] [Review][Patch] Fallback para `new Date()` mascara timestamp invalido/ausente e distorce SLA [sistema-adalto/src/modules/alerts/domain/operational-alert.ts:56]
- [x] [Review][Patch] Tratamento de erro generico mascara falha especifica de alertas no dashboard [sistema-adalto/src/app/(rh)/indicadores/page.tsx:164]

---

## Dev Notes

### Sequencia recomendada de implementacao

1. Fechar contrato API com testes (Task 1 + Task 5 parcial).
2. Consolidar dominio/repositorio com idempotencia e SLA (Task 2 + Task 4 + Task 5).
3. Implementar painel RH e integracao na tela de indicadores (Task 3 + Task 6).
4. Rodar suite completa e corrigir regressao antes de mover para review.

### Fontes de verdade

- Escopo e ACs: `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.3).
- FR/NFR: `_bmad-output/planning-artifacts/prd.md` (FR27, FR28, FR29, FR37, NFR14, NFR18, NFR20).
- Arquitetura e padroes: `_bmad-output/planning-artifacts/architecture.md`.
- UX/fundacao de feedback e acessibilidade: `_bmad-output/planning-artifacts/ux-design-specification.md`.
- Guardrails globais: `_bmad-output/project-context.md`.
- Aprendizados anteriores: `_bmad-output/implementation-artifacts/4-2-dashboard-de-indicadores-e-status-operacional.md`.

---

## Story Completion Status

- Story concluida tecnicamente e movida para status `done`.
- Nota de conclusao: Ultimate context engine analysis completed - comprehensive developer guide created.

---

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- N/A (create-story context generation)

### Completion Notes List

- Story 4.3 gerada com contexto completo de implementacao, riscos e guardrails arquiteturais.
- Requisitos FR/NFR, padroes de UX e aprendizados de 4.2 incorporados em tarefas executaveis.
- Reuso de componentes/rotas existentes explicitado para evitar reinvencao e regressao.
- Implementado endpoint `GET /api/v1/rh/alerts` com validacao Zod, sessao, RBAC, tenant-bound, correlation id e envelope padrao.
- Implementados dominio/aplicacao/repositorio de alertas operacionais com classificacao de severidade, status e afericao de SLA NFR14.
- Implementado painel RH de alertas e integracao na pagina de indicadores, com estados de sucesso, vazio e erro.
- Testes alvo de Story 4.3 executados com sucesso: 3 arquivos, 14 testes aprovados.
- Painel de alertas ajustado com semantica de lista, heading explicito e foco por teclado (`tabIndex`) para navegacao basica assistiva.

### File List

- `_bmad-output/implementation-artifacts/4-3-alertas-operacionais-e-escalonamento.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `sistema-adalto/src/app/api/v1/rh/alerts/route.ts`
- `sistema-adalto/src/modules/alerts/domain/operational-alert.ts`
- `sistema-adalto/src/modules/alerts/application/get-operational-alerts.ts`
- `sistema-adalto/src/modules/alerts/infrastructure/alerts-repository.ts`
- `sistema-adalto/src/components/alerts/operational-alerts-panel.tsx`
- `sistema-adalto/src/app/(rh)/indicadores/page.tsx`
- `sistema-adalto/__tests__/rh-alerts-api.test.ts`
- `sistema-adalto/__tests__/rh-alerts-domain.test.ts`
- `sistema-adalto/__tests__/rh-alerts-ui.test.tsx`

## Change Log

- 2026-04-13: Story 4.3 criada com status `ready-for-dev` e contexto tecnico completo para implementacao.
- 2026-04-13: Implementacao inicial de API/dominio/UI de alertas operacionais concluida com testes alvo em verde.
