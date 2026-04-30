---
story_id: "5.1"
story_key: "5-1-ingestao-externa-com-monitoramento-operacional"
epic: "5"
title: "Ingestao Externa com Monitoramento Operacional"
status: "done"
created_date: "2026-04-13"
last_updated: "2026-04-13"
---

# Story 5.1: Ingestao Externa com Monitoramento Operacional

**Epic:** Epic 5 - Integracoes Externas e Automacao de Ingestao  
**Story ID:** 5.1  
**Priority:** High  
**Status:** done

---

## Story Statement

As a RH/DP operador,
I want receber lotes por integracao externa e monitorar seu estado,
So that eu reduza dependencia de upload manual e acompanhe falhas rapidamente.

---

## Acceptance Criteria

### AC 1: Intake externo rastreavel e status operacional visivel

**Given** uma origem externa autorizada  
**When** a plataforma receber um lote via integracao externa  
**Then** o sistema deve registrar a ingestao com `ingestion_id`, `tenant_id`, `source_system`, `correlation_id`, `received_at` e `status` rastreavel  
**And** o estado deve estar disponivel no painel de integracoes com atualizacao de lista/detalhe sem recarregar a pagina inteira  
**And** o contrato deve manter o envelope padrao `{ data, error, meta }` em todas as respostas.

### AC 2: Falha classificada, recomendacao explicita e log tecnico

**Given** uma falha de recebimento ou processamento da integracao  
**When** o erro ocorrer  
**Then** o sistema deve classificar a causa com codigo de dominio e sugerir a acao recomendada ao operador  
**And** manter log tecnico com `correlation_id`, `tenant_id`, `event_name`, `event_version`, `occurred_at` e payload minimo para diagnostico  
**And** nao pode haver silencio operacional ou fallback sem rastreio.

---

## Dependencies and Scope

### Dependencias

- Story 1.2 concluida: base de sessao segura, correlation id e criptografia ja estao disponiveis para os fluxos autenticados e para auditoria tecnica.
- Story 1.3 concluida: RBAC por perfil e escopo de tenant ja existe e deve ser reutilizado sem autorizacao ad-hoc.
- Story 4.1 concluida: trilha de auditoria unificada e linha do tempo por evento ja oferecem o padrao de rastreio operacional.
- Story 4.2 concluida: dashboard e filtros operacionais tenant-bound mostram o padrao de consulta de status que esta story deve seguir.
- Story 4.3 concluida: alertas operacionais e escalonamento ja definem severidade, classificacao e linguagem de resposta para falhas.
- Story 3.1 concluida: padrao de envelope, validacao de boundary e importacao em lote estabelecem a base de experiencia e contrato para ingestao.
- Story 3.4 concluida: idempotencia de reprocessamento e tratamento consistente de retries servem como referencia para reenvios externos.
- Story 3.5 concluida: publicacao segura de lote prova o padrao de estado operacional que deve ser reaproveitado no painel de integracoes.

### Fora de Escopo

- Validacao completa de schema e versao de contrato de payload externo, que pertence a Story 5.2.
- Mapeamento de identificadores de origem para colaborador e tenant, que pertence a Story 5.3.
- Publicacao de eventos para consumidores externos autorizados, que pertence a Story 5.4.
- Tratamento amplo de multiplos transportes e orquestracao futura de API/SFTP alem do ponto inicial de intake desta story.

---

## Technical Requirements

### API and Contract Requirements

1. Criar o endpoint de intake externo em `src/app/api/v1/webhooks/integrations/route.ts` para registrar lotes recebidos de origens autorizadas.
2. Expor a leitura de status operacional para o painel de RH dentro do mesmo modulo de integracoes, sem criar namespace paralelo fora de `/api/v1`.
3. Manter o envelope obrigatorio `{ data, error, meta }` em todas as respostas, com `correlation_id` em header e em `meta`.
4. Validar os dados de entrada no boundary com Zod `safeParse`, incluindo idempotency key, origem, referencia do lote e tenant quando aplicavel.
5. Mapear respostas esperadas de forma previsivel:
   - `202` para intake aceito e registrado
   - `200` para leitura de status e listagens
   - `400` para payload invalido
   - `401` para sessao ausente ou invalida no fluxo de painel RH
   - `403` para origem nao autorizada, papel sem permissao ou tenant mismatch
   - `404` para registro de ingestao inexistente no tenant
   - `409` para duplicidade idempotente ou conflito de estado

### Domain and Data Rules

1. Criar um modelo de dominio para ingestao externa com ciclo minimo de estados: `received`, `processing`, `processed`, `failed`.
2. Persistir identificacao da ingestao, tenant, origem, referencia externa, status, timestamps, causa da falha e acao recomendada para o operador.
3. Garantir idempotencia por chave de requisicao ou referencia externa para evitar dupla contabilizacao do mesmo lote.
4. Classificar falhas com codigos de dominio claros, por exemplo: `UNAUTHORIZED_SOURCE`, `INVALID_PAYLOAD`, `TENANT_MISMATCH`, `DUPLICATE_INGESTION`, `PROCESSING_FAILURE`.
5. Usar o log de auditoria e observabilidade como fonte principal de rastreio; nao criar trilha paralela fora do padrao do produto.

### Security and RBAC Rules

1. Reusar `validateSession`, `assertTenantAction` e `RBAC_ACTIONS` no painel RH, sem autorizacao ad-hoc em handler.
2. Toda leitura de status no contexto do painel deve ser limitada por `session.tenantId` e negar cross-tenant com `FORBIDDEN`.
3. O intake externo deve aceitar apenas origens autorizadas pelo contrato do modulo, sem expor dados de outros tenants.
4. Registrar eventos com o padrao `domain.entity.action.v1`, incluindo pelo menos evento de intake registrado e evento de falha operacional.

### Performance and Reliability Rules

1. O painel de integracoes deve apresentar status sem polling agressivo desnecessario e sem degradar a experiencia principal do RH.
2. A visualizacao de status precisa ser resiliente a estado vazio, erro temporario e revalidacao sem perder o contexto do tenant.
3. Reenvios do mesmo lote nao podem gerar registros duplicados nem mascarar a situacao real do intake.
4. Falhas tecnicas nao podem ser engolidas por fallback silencioso; a causa e a recomendacao precisam ser visiveis para o operador.

---

## Architecture Compliance Notes

### Regras Obrigatorias

- Rotas somente em `src/app/api/v1/**/route.ts`.
- Usar `src/lib/api/response.ts` e `src/lib/api/errors.ts` como unica forma de envelope e erro de API.
- Propagar `x-correlation-id` com `src/lib/observability/correlation-id.ts`.
- Acesso a dados somente via `src/lib/db/client.ts`.
- Schemas Drizzle exportados por `src/lib/db/schema/index.ts`.
- Nao fazer autorizacao cross-tenant fora de `assertTenantAction` e do contexto de sessao.

### Estrutura de Codigo Alvo

- `src/app/api/v1/webhooks/integrations/route.ts`
- `src/app/(rh)/integracoes/page.tsx`
- `src/app/(rh)/integracoes/loading.tsx`
- `src/components/integrations/integration-status-panel.tsx`
- `src/modules/integrations/domain/external-ingestion.ts`
- `src/modules/integrations/application/register-external-ingestion.ts`
- `src/modules/integrations/application/list-external-ingestions.ts`
- `src/modules/integrations/infrastructure/external-ingestions-repository.ts`
- `src/lib/db/schema/external-ingestions.ts`
- `src/lib/db/schema/index.ts`

### Reuso Obrigatorio (Nao Reinventar)

1. Reusar o padrao visual e de estados do `src/app/(rh)/lotes/batch-progress-panel.tsx` para comunicar progresso, falha e conclusao.
2. Reusar os padroes de auditoria e timeline do `src/modules/audit` e do `src/components/audit/status-timeline.tsx` quando o painel precisar detalhar eventos.
3. Reusar a semantica de alerta e acao recomendada consolidada em `src/modules/alerts` e nas stories 4.2 e 4.3.
4. Reusar a convencao de idempotencia ja usada em fluxo de reprocessamento e publicacao de lote.

---

## Library and Framework Requirements

- Next.js 16.2.3 (App Router e Route Handlers).
- React 19.2.x.
- TypeScript ^5 com `strict` habilitado.
- Zod 4.x para validacao de boundary.
- Drizzle ORM 0.45.2 para persistencia e consulta.
- Vitest 4.1.x para testes de API, dominio e UI.

Sem novas dependencias obrigatorias para esta story.

---

## Testing Requirements Summary

Cobertura minima obrigatoria em `__tests__/**/*.test.ts(x)`:

1. API registra intake com sucesso e retorna envelope padrao com `correlation_id`.
2. API rejeita payload invalido com `400` e detalhes uteis de validacao.
3. API rejeita origem nao autorizada, papel sem permissao e tenant mismatch com `403`.
4. API trata duplicidade idempotente com `409` sem criar registro repetido.
5. API de listagem/status retorna `401` sem sessao e `200` para tenant valido.
6. Dominio valida transicoes de estado e preserva causa e recomendacao de falha.
7. UI renderiza loading, empty, error e success no painel de integracoes.
8. UI expõe semantica acessivel para status, foco visivel e navegacao por teclado.
9. Mock de dependencias externas via `vi.mock` e limpeza de estado com `beforeEach`.

---

## Previous Story Intelligence (4.4)

1. Story 4.4 mostrou que monitoramento operacional precisa de criterios mensuraveis; evitar termos vagos como "monitorar" sem definir o que aparece para o operador.
2. Review de 4.4 reforcou que conflitos de estado, loading e acessibilidade precisam estar explicitados desde o plano da story, nao apenas corrigidos depois.
3. A implementacao de 4.4 consolidou o padrao de tenant-bound, correlation id e evidencia auditavel; esta story deve seguir a mesma rigidez.
4. 4.4 tambem mostrou que respostas silenciosas e fallback implcito geram regressao operacional; 5.1 precisa deixar causa, acao e estado sempre visiveis.

---

## Git Intelligence Summary

Commits recentes relevantes para esta linha de trabalho:

1. `b31b68c` - selective batch reprocessing with idempotency and audit. Insight: reenvio idempotente e rastreio de auditoria devem ser preservados no intake externo.
2. `97eccbe` - validation feedback UI and correlation ID traceability. Insight: validacao no boundary e feedback operacional precisam ser explicitos e testados.
3. `4f949ad` - request-scope crash hardening. Insight: UI e testes nao devem assumir contexto de request inexistente.
4. `c17bbdb` - secure document download with audit trail. Insight: operacoes sensiveis devem gerar evidencia tecnica por padrao.
5. `7894beb` - compliance hardening. Insight: isolamento por tenant e minimizacao de dados continuam obrigatorios.

---

## Latest Tech Information

- O stack ja esta fechado em Next.js 16.2.3, React 19.2.x, TypeScript 5 strict, MUI 9, Drizzle 0.45.2 e Vitest 4.1.x.
- Nao ha necessidade de novas dependencias para esta story; o trabalho e de integracao entre modulo, rota, dominio e UI.
- O padrao de API, correlation id e envelope ja esta estabelecido no projeto e deve ser reutilizado sem variacao.

---

## Project Structure Notes

- A area RH ja possui as paginas `lotes`, `indicadores`, `excecoes` e `auditoria`; a nova area de integracoes deve seguir a mesma logica de organizacao.
- O namespace de webhooks em `src/app/api/v1/webhooks/integrations` e o ponto natural para intake externo, sem criar rotas fora de `/api/v1`.
- O modulo de integracoes deve ficar isolado em `src/modules/integrations` para nao acoplar intake externo a batches, exceptions ou audit diretamente.
- Nao criar cliente de banco paralelo nem bypassar o client central do projeto.

---

## References

- Source: _bmad-output/planning-artifacts/epics.md (Epic 5; Story 5.1; FR43-FR47)
- Source: _bmad-output/planning-artifacts/prd.md (Jornada 6; Integrations & External Exchange; FR43-FR47; NFR21-NFR24)
- Source: _bmad-output/planning-artifacts/architecture.md (API `/api/v1`; `webhooks/integrations/route.ts`; envelope padrao; event naming; module boundaries)
- Source: _bmad-output/planning-artifacts/ux-design-specification.md (Batch Progress Panel; feedback operacional; design system integration)
- Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-04-08.md (scope growth warning for Epic 5 Story 5.4; error-path coverage guidance)
- Source: `_bmad-output/implementation-artifacts/4-4-fluxo-de-suporte-e-consolidacao-de-chamados.md`
- Source: `_bmad-output/implementation-artifacts/4-3-alertas-operacionais-e-escalonamento.md`
- Source: `_bmad-output/implementation-artifacts/3-5-publicacao-segura-de-lote-no-portal.md`
- Source: `_bmad-output/implementation-artifacts/3-4-reprocessamento-seletivo-de-itens-e-lotes.md`
- Source: `_bmad-output/implementation-artifacts/3-1-importacao-de-relatorio-e-validacao-inicial.md`

---

## Story Completion Status

- Story 5.1 implementada e movida para status `review`.
- Intake externo foi entregue com registro rastreavel, envelope padrao, `x-correlation-id` e classificacao de falha.
- Painel RH de integracoes entregue com filtros, resumo operacional, detalhe e timeline.
- Cobertura de testes adicionada para dominio, API e UI com execucao validada em suite dedicada.

---

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Create-story workflow executado a partir de `.github/skills/bmad-create-story/workflow.md`.
- Config carregada via `bmad-init` para o projeto `SISTEMA ADALTO`.
- Artefatos lidos: `project-context.md`, `epics.md`, `prd.md`, `architecture.md`, `ux-design-specification.md`, `implementation-readiness-report-2026-04-08.md`, `sprint-status.yaml`.
- Historial recente do git analisado com `git log -5 --oneline`.

### Completion Notes List

- Implementado schema `external_ingestions` com estados, classificacao de falhas e indices de idempotencia por tenant/origem.
- Implementado modulo de integracoes (dominio, aplicacao, infraestrutura) para intake externo e listagem operacional tenant-bound.
- Implementada rota `POST/GET /api/v1/webhooks/integrations` com validacao, RBAC para consulta RH e mapeamento consistente de erros.
- Implementada pagina RH `integracoes` com painel de status, filtros e timeline.
- Testes adicionados e executados com sucesso para dominio, API e UI da Story 5.1.

### File List

- `_bmad-output/implementation-artifacts/5-1-ingestao-externa-com-monitoramento-operacional.md`
- `sistema-adalto/src/lib/db/schema/external-ingestions.ts`
- `sistema-adalto/src/lib/db/schema/index.ts`
- `sistema-adalto/src/modules/integrations/domain/external-ingestion.ts`
- `sistema-adalto/src/modules/integrations/application/register-external-ingestion.ts`
- `sistema-adalto/src/modules/integrations/application/list-external-ingestions.ts`
- `sistema-adalto/src/modules/integrations/infrastructure/external-ingestions-repository.ts`
- `sistema-adalto/src/app/api/v1/webhooks/integrations/route.ts`
- `sistema-adalto/src/components/integrations/integration-status-panel.tsx`
- `sistema-adalto/src/app/(rh)/integracoes/page.tsx`
- `sistema-adalto/src/app/(rh)/integracoes/loading.tsx`
- `sistema-adalto/__tests__/external-ingestions-domain.test.ts`
- `sistema-adalto/__tests__/external-ingestions-api.test.ts`
- `sistema-adalto/__tests__/external-ingestions-ui.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Review Findings

- [x] [Review][Patch] Aplicar autenticacao HMAC no intake externo (decisao 1:1) [sistema-adalto/src/app/api/v1/webhooks/integrations/route.ts:63]
- [x] [Review][Patch] Validar autorizacao origem-tenant com tenant_id no payload (decisao 2:2) [sistema-adalto/src/app/api/v1/webhooks/integrations/route.ts:16]
- [x] [Review][Patch] Classificar e registrar falhas operacionais no fluxo de intake (AC2) [sistema-adalto/src/modules/integrations/application/register-external-ingestion.ts:35]
- [x] [Review][Patch] Eliminar fallback generico sem classificacao/recomendacao na API de intake (AC2) [sistema-adalto/src/app/api/v1/webhooks/integrations/route.ts:107]
- [x] [Review][Patch] Completar cobertura de testes negativos obrigatorios da story 5.1 (409 duplicidade e 403 por autorizacao/tenant mismatch) [sistema-adalto/__tests__/external-ingestions-api.test.ts:133]

## Change Log

- 2026-04-13: Story 5.1 criada com status `ready-for-dev` e contexto tecnico completo para implementacao futura.
- 2026-04-13: Story 5.1 implementada com intake externo, monitoramento operacional RH, testes e status atualizado para `review`.
