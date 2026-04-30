---
story_id: "3.5"
story_key: "3-5-publicacao-segura-de-lote-no-portal"
epic: "3"
title: "Publicacao Segura de Lote no Portal"
status: "done"
created_date: "2026-04-13"
last_updated: "2026-04-13"
---

# Story 3.5: Publicacao Segura de Lote no Portal

**Epic:** Epic 3 - Operacao RH de Lotes e Publicacao  
**Story ID:** 3.5  
**Priority:** High  
**Status:** done  

---

## Story Statement

As a RH/DP operador,
I want publicar lote validado com evidencia de conclusao,
So that os colaboradores acessem documentos corretos no prazo esperado.

---

## Acceptance Criteria

### AC 1: Publicacao somente quando o lote estiver pronto

**Given** um lote do mesmo tenant com `validation_status = validated`, `routing_status = completed` e sem excecoes pendentes, em tratamento ou bloqueadas
**When** o RH/DP operador confirmar a publicacao com uma chave de idempotencia valida
**Then** o sistema deve publicar o lote sem expor documentos de outro tenant
**And** deve registrar o lote como publicado com resumo operacional da execucao
**And** deve tornar o status de publicacao visivel tanto no painel RH quanto na visao do colaborador na proxima leitura da lista.

**Given** um lote ainda nao validado, ainda em roteamento, ou com excecoes nao resolvidas
**When** a publicacao for solicitada
**Then** o sistema deve recusar a operacao com `409 Conflict`
**And** deve informar o motivo operacional do bloqueio com contadores suficientes para diagnostico.

### AC 2: Contrato de API, RBAC e isolamento por tenant

**Given** a requisicao para o endpoint de publicacao
**When** o corpo for invalido, a sessao estiver ausente ou invalida, ou o papel do usuario nao permitir publicacao
**Then** o sistema deve responder com `400`, `401` ou `403` conforme o caso
**And** deve manter o envelope padrao `{ data, error, meta }` com `correlation_id`.

**Given** um lote inexistente ou pertencente a outro tenant
**When** a requisicao for executada
**Then** o sistema deve responder com `404` para lote inexistente ou `403` para mismatch de tenant
**And** nao deve executar nenhuma escrita fora do escopo do tenant autenticado.

### AC 3: Idempotencia e consistencia em falhas parciais

**Given** a mesma `idempotency_key` para o mesmo tenant, lote e escopo de publicacao
**When** a requisicao for repetida
**Then** o sistema deve retornar o mesmo resultado logico sem duplicar publicacao, eventos ou efeitos persistidos
**And** deve preservar o estado consistente mesmo se a primeira execucao tiver falhado apos escrita parcial.

**Given** uma falha recuperavel durante a publicacao
**When** a operacao for reexecutada com a mesma chave de idempotencia
**Then** o sistema deve retomar sem duplicar documentos ja publicados
**And** deve manter rastreabilidade da tentativa original e da tentativa repetida.

### AC 4: Evidencia operacional e feedback de interface

**Given** a publicacao concluida com sucesso
**When** o RH consultar o resultado
**Then** o sistema deve exibir os contadores `total_requested`, `total_published`, `total_skipped` e `total_failed`
**And** deve registrar auditoria com `tenant_id`, `actor_id`, `batch_id`, `correlation_id` e timestamp de inicio e termino.

**Given** a tela de lotes com um lote apto a publicar
**When** o usuario acessar a interface RH
**Then** a acao de publicar deve estar disponivel de forma clara como acao principal do fluxo
**And** deve ficar desabilitada ou indisponivel quando o lote nao atender aos criterios de publicacao.

---

## Dependencies and Scope

### Dependencias de Historias Anteriores

- Story 3.1: importacao de lote e validacao inicial.
- Story 3.2: roteamento automatico e bloqueio por ambiguidade.
- Story 3.3: fila de excecoes e acao corretiva.
- Story 3.4: reprocessamento seletivo de itens e lotes.

### Fora de Escopo

- Mudanca no fluxo de autenticacao ou RBAC basico.
- Nova experiencia de notificacao ao colaborador alem do status de publicacao.
- Reescrita do pipeline de roteamento ou do modelo de excecoes.
- Console administrativo de rollback manual ou reprocessamento de publicacao fora do fluxo de lote.

---

## Technical Requirements

### API and Contract Requirements

1. Implementar `POST /api/v1/rh/batches/[batchId]/publish` em `src/app/api/v1/rh/batches/[batchId]/publish/route.ts`.
2. Manter o envelope padrao `{ data, error, meta }` e propagar `x-correlation-id` em request e response.
3. Validar o payload com Zod no boundary. O contrato minimo deve exigir `idempotency_key`.
4. Responder com:
   - `400` para validacao invalida.
   - `401` para sessao ausente ou invalida.
   - `403` para RBAC ou tenant mismatch.
   - `404` para lote inexistente.
   - `409` para estado de lote incompativel ou bloqueios operacionais.

### Domain and State Rules

1. Somente lotes do mesmo `tenant_id` podem ser publicados.
2. Publicacao exige lote validado, roteamento concluido e nenhuma excecao pendente, em tratamento ou bloqueada.
3. O fluxo de estado deve ser explicito e monotono: pronto para publicar -> publicando -> publicado ou falho.
4. Nunca marcar como publicado um lote que ainda tenha bloqueios operacionais ou itens fora do tenant.

### Idempotency Rules

1. Persistir a chave de idempotencia por `tenant_id + batch_id + escopo_de_publicacao`.
2. Requisicoes repetidas com a mesma chave devem devolver o mesmo resultado logico sem duplicar efeitos.
3. Falhas apos escrita parcial devem permitir reexecucao segura sem duplicar eventos ou publicacao.

### Data and Persistence Requirements

1. Avaliar ajuste em schema para registrar:
   - `publication_status`
   - `published_at`
   - `published_by`
   - `publication_attempts`
   - `last_publication_correlation_id`
   - `last_publication_error`
   - ledger de idempotencia por lote, se a implementacao exigir rastreio separado.
2. Qualquer mudanca de schema exige migracao Drizzle em `drizzle/migrations` e export em `src/lib/db/schema/index.ts`.
3. Todas as queries precisam filtrar por `tenant_id`.

### Audit and Observability Requirements

1. Registrar evento auditavel de inicio e termino da publicacao.
2. Incluir `correlation_id` em cabecalho e metadados de resposta.
3. Emitir resumo operacional com contadores:
   - `total_requested`
   - `total_published`
   - `total_skipped`
   - `total_failed`

---

## Architecture Compliance Notes

### Regras Obrigatorias do Projeto

- Rotas novas devem permanecer em `src/app/api/v1/**/route.ts`.
- Reusar utilitarios centrais: `src/lib/api/response.ts`, `src/lib/api/errors.ts`, `src/lib/auth/session.ts`, `src/lib/auth/rbac.ts`.
- Cliente de banco deve ser o `db` central em `src/lib/db/client.ts`.
- Validacao deve usar TypeScript strict e Zod com `safeParse` no boundary.
- Isolamento multi-tenant precisa ser aplicado em todas as leituras e escritas.

### Estrutura de Codigo Alvo

- `src/app/api/v1/rh/batches/[batchId]/publish/route.ts`
- `src/modules/batches/application/publish-batch.ts`
- `src/modules/batches/infrastructure/batch-repository.ts`
- `src/lib/events/publisher.ts`
- `src/lib/db/schema/batches.ts`
- `src/lib/db/schema/index.ts`
- `src/app/(rh)/lotes/batch-progress-panel.tsx`
- `src/app/(rh)/lotes/page.tsx`

### Nota de Implementacao

- A arquitetura ja antecipa o caminho `...[batch-id]/publish/route.ts` e o modulo `publisher.ts`.
- A publicacao deve usar o estado do lote e das excecoes como precondicao, sem criar um fluxo paralelo fora do dominio de batches.

---

## Previous Story Intelligence

1. Story 3.4 ja consolidou a etapa de reprocessamento seletivo e a necessidade de idempotencia por lote.
2. O modulo de excecoes ja existe em `src/modules/exceptions/**` e deve permanecer como dependencia do fluxo de publicacao, nao como alternativa paralela.
3. O painel de lotes ja exibe progresso de roteamento e reprocessamento; a publicacao deve estender esse mesmo fluxo de operacao.
4. A readiness review apontou risco em caminhos de falha parcial e rollback; esta historia precisa tratar explicitamente consistencia apos falhas recuperaveis.

---

## Git Intelligence Summary

Com base nos artefatos recentes:

1. O projeto ja segue o padrao de API versionada em `/api/v1` com envelope e correlation id.
2. O batch schema atual contem validacao e roteamento, mas nao possui ainda o bloco de persistencia de publicacao.
3. A UI de lotes e a fila de excecoes ja existem, entao a historia deve integrar o botao e o feedback de publicacao no fluxo existente.

---

## Test Requirements Summary

- Localizacao: `__tests__/api`, `__tests__/integration`, `__tests__/components`.
- Framework: Vitest.
- Cobertura minima obrigatoria para esta historia:
  - contrato do endpoint de publicacao
  - validacao de payload
  - sessao ausente ou invalida
  - RBAC e tenant mismatch
  - lote inexistente
  - estado de lote incompativel
  - idempotencia
  - auditabilidade e correlation id
  - feedback de interface para publicacao disponivel ou indisponivel

---

## Tasks / Subtasks

### Task 1: Contrato de Publicacao e Regras de Estado (AC: 1, 2, 3)

- [x] Definir payload minimo e formato de resposta do endpoint de publicacao.
- [x] Implementar schema Zod para validacao do corpo e erros padronizados.
- [x] Definir regra de prontidao para publicacao e transicoes de estado.

### Task 2: Endpoint RH e Guards de Sessao/Tenant (AC: 1, 2, 3)

- [x] Criar `POST /api/v1/rh/batches/[batchId]/publish` com validacao de sessao e role RH operador.
- [x] Garantir escopo por tenant e lote em todas as operacoes.
- [x] Propagar `x-correlation-id` em request e response.

### Task 3: Servico de Dominio para Publicacao do Lote (AC: 1, 3, 4)

- [x] Implementar caso de uso `publish-batch` no modulo de batches.
- [x] Publicar apenas lotes elegiveis e bloquear estados incompativeis.
- [x] Implementar idempotencia e protecao contra duplicidade.
- [x] Tratar falhas parciais com consistencia transacional ou logica equivalente.

### Task 4: Persistencia, Eventos e Auditoria (AC: 1, 3, 4)

- [x] Ajustar schema e migracao, se necessario, para rastrear estado de publicacao e idempotencia.
- [x] Registrar evento de auditoria para inicio e fim da publicacao.
- [x] Persistir resumo operacional e evidencias de conclusao.

### Task 5: UX Operacional RH (AC: 1, 4)

- [x] Expor acao de publicacao no fluxo de lotes.
- [x] Mostrar feedback claro de disponibilidade, bloqueio e sucesso.
- [x] Preservar acessibilidade: teclado, foco visivel e semantica nao dependente de cor.

### Task 6: Testes (AC: 1, 2, 3, 4)

- [x] Testes de API: sucesso, validacao invalida, sessao ausente/invalida, forbidden por RBAC, tenant mismatch, not found e estado invalido.
- [x] Testes de idempotencia: mesma chave nao duplica efeitos.
- [x] Testes de regressao de estado: lote nao elegivel nao publica.
- [x] Testes de interface: botao/feedback de publicacao disponivel somente quando o lote estiver apto.

### Review Findings

- [x] [Review][Patch] Tratar excecao de rede/parse no fluxo de publicacao para feedback consistente ao operador [src/app/(rh)/lotes/page.tsx:331]

---

## Dev Agent Record

### Implementation Notes

- Implementado `POST /api/v1/rh/batches/[batchId]/publish` com validacao Zod, guardas de sessao/RBAC, isolamento por tenant e envelope padrao com correlation id.
- Adicionada persistencia de estado de publicacao em `batches` com migration SQL, auditoria de inicio/fim e evento de dominio `rh.batch.published.v1`.
- O painel RH de lotes agora expõe acao de publicacao, status visual de publicacao e feedback de sucesso/falha sem quebrar o fluxo existente de importacao, roteamento e reprocessamento.

### Test Plan

- Vitest completo executado com sucesso: 156 testes passando.
- Cobertura adicionada para contrato do endpoint de publicacao, regras de estado, idempotencia, isolamento por tenant e feedback de interface.

### Decisions

- O estado de publicacao foi persistido diretamente em `batches` para evitar uma ledger adicional desnecessaria nesta historia.
- O fluxo idempotente usa a mesma chave por lote e retorna o mesmo resultado logico quando a publicacao ja foi concluida com a mesma chave.
- Publicacao nao tenta derivar atualizacao de documentos do colaborador, porque o esquema atual nao carrega relacao batch->documento; o contrato operacional fica ancorado no lote e na disponibilidade portal a partir do estado publicado.

---

## Change Log

- 2026-04-13: Implementada publicacao segura de lote no portal com API, servico de dominio, auditoria, migracao, UI e testes.

---

## File List

### Planned Implementation Files

- `src/app/api/v1/rh/batches/[batchId]/publish/route.ts`
- `src/modules/batches/application/publish-batch.ts`
- `src/modules/batches/infrastructure/batch-repository.ts`
- `src/lib/events/publisher.ts`
- `src/lib/db/schema/batches.ts`
- `drizzle/migrations/*`
- `src/app/(rh)/lotes/batch-progress-panel.tsx`
- `src/app/(rh)/lotes/page.tsx`
- `src/app/api/v1/rh/batches/[batchId]/route.ts`
- `src/app/api/v1/rh/batches/[batchId]/process/route.ts`
- `__tests__/rh-batches-publish-api.test.ts`
- `__tests__/rh-batches-publish-domain.test.ts`
- `__tests__/rh-batches-ui.test.tsx`
- `drizzle/migrations/20260413_publication_tracking.sql`
