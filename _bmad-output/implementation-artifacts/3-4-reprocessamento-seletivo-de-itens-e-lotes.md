---
story_id: "3.4"
story_key: "3-4-reprocessamento-seletivo-de-itens-e-lotes"
epic: "3"
title: "Reprocessamento Seletivo de Itens e Lotes"
status: "done"
created_date: "2026-04-13"
last_updated: "2026-04-13"
---

# Story 3.4: Reprocessamento Seletivo de Itens e Lotes

**Epic:** Epic 3 - Operacao RH de Lotes e Publicacao  
**Story ID:** 3.4  
**Priority:** High  
**Status:** done

---

## Story Statement

As a RH/DP operador,  
I want reprocessar apenas os itens corrigidos,  
So that eu recupere rapidamente o lote sem repetir trabalho desnecessario.

---

## Acceptance Criteria

### AC 1: Reprocessamento Seletivo com Escopo Minimo

**Given** um lote com excecoes em estado elegivel para reprocessamento (ex.: in-treatment com expected_result = reprocessable)  
**When** o RH acionar o reprocessamento seletivo  
**Then** o sistema deve reprocessar apenas os itens selecionados/elegiveis  
**And** nao deve reprocessar itens ja resolvidos ou sem correcao valida registrada.

### AC 2: Idempotencia e Protecao Contra Duplicidade

**Given** tentativas repetidas para o mesmo item e mesmo contexto de correcao  
**When** o reprocessamento for disparado mais de uma vez  
**Then** o sistema deve garantir idempotencia por item e evitar duplicidade de documento/publicacao  
**And** deve manter estado consistente mesmo em falhas parciais.

### AC 3: Resultado Operacional e Rastreabilidade

**Given** conclusao do reprocessamento  
**When** o RH consultar o resultado  
**Then** o sistema deve exibir total reprocessado, resolvido, remanescente e falho com detalhes por item  
**And** registrar trilha auditavel com tenant_id, actor_id, batch_id, correlation_id e timestamp.

### AC 4: Meta de Tempo e Observabilidade

**Given** lote de referencia com ate 1.000 itens elegiveis  
**When** o fluxo de reprocessamento seletivo for executado  
**Then** deve atender o objetivo NFR de ate 15 minutos em condicoes de referencia  
**And** deve expor sinais operacionais para diagnostico (status, progresso e causa de bloqueio).

---

## Dependencies and Scope

### Dependencias de Historias Anteriores

- Story 3.1: base de importacao, validacao e metadados de lote.
- Story 3.2: roteamento, bloqueio de ambiguidade e status de lote.
- Story 3.3: fila de excecoes, acao corretiva e estados (pending, in-treatment, resolved, blocked).

### Fora de Escopo

- Publicacao final do lote no portal (Story 3.5).
- Mudancas de UX nao relacionadas ao fluxo RH de reprocessamento.
- Novo mecanismo de fila externa (usar padrao atual do projeto).

---

## Technical Requirements

### API and Contract Requirements

1. Implementar endpoint de reprocessamento seletivo em namespace RH existente (`/api/v1/rh/batches/[batchId]/reprocess`), mantendo envelope `{ data, error, meta }`.
2. Reusar padrao de autenticacao por sessao e RBAC com `assertTenantAction` e `RBAC_ACTIONS`.
3. Validar payload com Zod no boundary:
   - lista de `exception_ids` (UUIDs), ou modo `reprocess_all_eligible`.
   - `idempotency_key` obrigatoria para operacao de escrita.
4. Retornar `400` para validacao invalida, `401` para sessao ausente/invalida, `403` para tenant/role invalido, `404` para lote inexistente, `409` para estado incompativel.

### Domain and State Rules

1. Somente excecoes do mesmo `tenant_id` e `batch_id` podem entrar no reprocessamento.
2. Somente excecoes elegiveis podem ser processadas (definir regra explicita no dominio e cobrir por teste).
3. Transicoes esperadas:
   - elegivel -> processing-reprocess (estado interno de execucao) -> resolved (sucesso)
   - elegivel -> pending/in-treatment (falha recuperavel com motivo)
4. Nunca promover itens nao elegiveis para estado resolvido.

### Idempotency Rules

1. Persistir chave de idempotencia por tenant + batch + escopo de itens.
2. Requisicoes repetidas com mesma chave devem retornar mesmo resultado logico (sem duplicar efeitos).
3. Falha apos escrita parcial deve permitir repeticao segura sem duplicar publicacao/processamento.

### Data and Persistence Requirements

1. Avaliar necessidade de ajuste em schema para armazenar:
   - `last_reprocess_at`
   - `reprocess_attempts`
   - `last_reprocess_correlation_id`
   - tabela/evento de execucao por lote para rastreio fino.
2. Qualquer mudanca de schema exige migracao Drizzle em `drizzle/migrations` e export em `src/lib/db/schema/index.ts`.
3. Todas as queries com filtro obrigatorio por `tenant_id`.

### Audit and Observability Requirements

1. Registrar evento auditavel de inicio e termino de reprocessamento.
2. Incluir `correlation_id` no header `x-correlation-id` e em metadados de resposta.
3. Emitir resumo operacional com contadores:
   - total_requested
   - total_eligible
   - total_reprocessed
   - total_resolved
   - total_remaining
   - total_failed

---

## Architecture Compliance Notes

### Regras Obrigatorias do Projeto

- Rotas novas em `src/app/api/v1/**/route.ts` (project-context).
- Reuso de utilitarios centrais: `src/lib/api/response.ts`, `src/lib/api/errors.ts`, `src/lib/auth/session.ts`, `src/lib/auth/rbac.ts`.
- Cliente DB unico: `src/lib/db/client.ts`.
- TypeScript strict + Zod safeParse no boundary.
- Isolamento multi-tenant em 100% das operacoes de leitura/escrita.

### Estrutura de Codigo Alvo (Realista para o Repositorio Atual)

- `src/app/api/v1/rh/batches/[batchId]/reprocess/route.ts` (novo)
- `src/modules/exceptions/application/reprocess-exceptions.ts` (novo)
- `src/modules/exceptions/infrastructure/exception-repository.ts` (extensao)
- `src/lib/db/schema/exceptions.ts` e/ou nova tabela de execucao (se necessario)
- `src/app/(rh)/lotes/batch-progress-panel.tsx` (ajuste para refletir reprocessamento)
- `src/app/(rh)/excecoes/page.tsx` (acao de reprocessar + feedback)

---

## Previous Story Intelligence (From 3.3)

1. A Story 3.3 consolidou API e repositorio de excecoes em `src/modules/exceptions/**`.
2. Ja existe `POST /api/v1/exceptions/[exception-id]/actions` para registrar correcao e mover para `in-treatment`.
3. Ja existe listagem por lote em `GET /api/v1/batches/[batch-id]/exceptions`.
4. Finding corrigido na 3.3: nao inferir `document_filename` a partir de nome de lote.
5. Padrao de testes vigente cobre validacao, autorizacao, tenant isolation e session boundary; manter mesma profundidade.

Implicacao para 3.4:
- Reprocessamento deve consumir estado e metadados de correcao da 3.3, sem criar fluxo paralelo.
- Evitar duplicar repositorio ou regras de transicao fora do modulo `exceptions`.

---

## Git Intelligence Summary

Com base nos commits recentes:

1. `97eccbe` reforcou foco em rastreabilidade por correlation ID, persistencia atomica e cobertura de testes ampla.
2. Endpoints RH atuais seguem padrao em `src/app/api/v1/rh/batches/[batchId]/process/route.ts`.
3. Testes costumam cobrir API + dominio + UI no mesmo ciclo da story.

Diretriz de implementacao:
- Seguir padrao de endpoint RH ja usado em `process/route.ts`.
- Priorizar consistencia de resposta e auditoria, evitando divergencia de contrato.

---

## Latest Tech Information (Web Research)

1. Next.js App Router (16.2.x): em Route Handlers, `context.params` e `Promise`, e padrao atual favorece tipagem explicita e uso de `NextRequest` para query/cookies.
2. Route Handlers suportam metodos HTTP completos; manter contrato semantico (`POST` para acao de reprocesso).
3. Zod 4 esta estavel e continua exigindo TypeScript strict para inferencia correta; manter schema unico para payload de reprocessamento.
4. Drizzle segue abordagem SQL-like e orientacao de migracoes explicitas; qualquer ajuste de idempotencia deve virar migracao versionada.

---

## Tasks / Subtasks

### Task 1: Contrato de Reprocessamento e Validacao (AC: 1, 2)

- [x] Definir payload e resposta do endpoint de reprocessamento seletivo.
- [x] Implementar schema Zod para validacao de entrada e erros padronizados.
- [x] Definir regra de elegibilidade de itens para reprocessamento.

### Task 2: Endpoint RH e RBAC/Tenant Guard (AC: 1, 3)

- [x] Criar `POST /api/v1/rh/batches/[batchId]/reprocess` com validacao de sessao e role RH operador.
- [x] Garantir escopo por tenant e lote em todas as operacoes.
- [x] Propagar `x-correlation-id` em request/response.

### Task 3: Servico de Dominio para Reprocessamento Seletivo (AC: 1, 2, 4)

- [x] Implementar caso de uso `reprocess-exceptions` no modulo exceptions.
- [x] Reprocessar apenas itens elegiveis selecionados.
- [x] Implementar idempotencia e protecao contra duplicidade.
- [x] Tratar falhas parciais com consistencia transacional/logica.

### Task 4: Persistencia e Auditoria (AC: 2, 3)

- [x] Ajustar schema/migracao (se necessario) para rastreio de tentativa e idempotencia.
- [x] Registrar evento de auditoria para inicio/fim do reprocessamento.
- [x] Persistir contadores e resultado detalhado por item.

### Task 5: UX Operacional RH (AC: 3, 4)

- [x] Expor acao de reprocessamento no fluxo de excecoes/lotes.
- [x] Mostrar feedback claro de progresso e resultado (resolvidos, remanescentes, falhos).
- [x] Preservar acessibilidade: teclado, foco visivel e semantica nao dependente de cor.

### Task 6: Testes (AC: 1, 2, 3, 4)

- [x] Testes de API: sucesso, validacao invalida, sessao ausente/invalida, forbidden por RBAC, tenant mismatch.
- [x] Testes de idempotencia: mesma chave nao duplica efeitos.
- [x] Testes de regressao de estado: itens nao elegiveis nao sao processados.
- [x] Testes de performance funcional (cenario de referencia) com meta NFR5 documentada.

### Review Findings

- [x] [Review][Patch] Duplicidade em exception_ids permite reprocessar o mesmo item mais de uma vez na mesma requisicao [src/modules/exceptions/infrastructure/exception-repository.ts:397]
- [x] [Review][Patch] Reprocessamento por lote sem transacao permite estado parcial inconsistente em falha no meio do loop [src/modules/exceptions/infrastructure/exception-repository.ts:417]
- [x] [Review][Patch] Payload aceita simultaneamente reprocess_all_eligible=true e exception_ids, gerando comportamento ambiguo [src/app/api/v1/rh/batches/[batchId]/reprocess/route.ts:28]
- [x] [Review][Patch] Caminho idempotent retorna current_state="resolved" sem confirmar estado persistido atual do item [src/modules/exceptions/infrastructure/exception-repository.ts:441]

---

## Test Requirements Summary

- Localizacao: `__tests__/api`, `__tests__/integration`, `__tests__/components`.
- Framework: Vitest.
- Cobertura minima obrigatoria para story:
  - contratos de endpoint
  - regras de estado
  - idempotencia
  - isolamento por tenant
  - rastreabilidade por correlation_id

---

## References

- Source: `_bmad-output/planning-artifacts/epics.md` (Story 3.4)
- Source: `_bmad-output/planning-artifacts/prd.md` (FR22, NFR5, NFR8, NFR12)
- Source: `_bmad-output/planning-artifacts/architecture.md` (idempotencia, API v1, multi-tenant, observabilidade)
- Source: `_bmad-output/planning-artifacts/ux-design-specification.md` (Jornada RH, fila de excecoes, feedback operacional)
- Source: `_bmad-output/project-context.md` (regras de API, DB, testes, RBAC)
- Source: `_bmad-output/implementation-artifacts/3-3-fila-de-excecoes-e-acao-corretiva.md` (estado atual e padroes estabelecidos)
- Source: `sistema-adalto/src/app/api/v1/rh/batches/[batchId]/process/route.ts`
- Source: `sistema-adalto/src/modules/exceptions/infrastructure/exception-repository.ts`

---

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Configuracao BMM carregada de `_bmad/bmm/config.yaml`.
- Story alvo resolvida por argumento direto: `3.4`.
- Contexto tecnico consolidado de epics, arquitetura, PRD, UX, project-context, story 3.3 e git recente.
- RED: adicionados testes para rota de reprocessamento e dominio de elegibilidade/idempotencia, validando falha inicial.
- GREEN: implementada rota `POST /api/v1/rh/batches/[batchId]/reprocess` com Zod, RBAC, tenant guard e correlation id.
- GREEN: implementado servico `reprocess-exceptions` e logica de repositorio com elegibilidade e idempotencia por item.
- GREEN: adicionada auditoria de inicio/fim do reprocessamento e persistencia de campos de rastreio no schema.
- GREEN: exposta acao de reprocessamento seletivo em `excecoes` e `lotes` com feedback operacional.
- VALIDATION: `npm run lint` e `npm run test:run` executados com sucesso (144 testes pass).
- REVIEW-PATCH: ajustes aplicados para deduplicacao de exception_ids, transacao por lote, validacao anti-ambiguidade de payload e consistencia do retorno idempotente.
- REVIEW-VALIDATION: `npx vitest run __tests__/rh-batches-api.test.ts __tests__/exceptions-reprocess-domain.test.ts`, `npm run lint` e `npm run test:run` executados com sucesso (145 testes pass).

### Completion Notes List

- Story context criada com foco em evitar regressao, duplicidade e quebra de isolamento por tenant.
- Arquivo preparado para execucao por dev agent com status `ready-for-dev`.
- Implementacao 3.4 concluida cobrindo AC1-AC4 com rota RH dedicada, idempotencia, auditoria e UX operacional.
- Testes adicionados/atualizados para contrato API, idempotencia e regras de elegibilidade.
- Suite completa do repositorio validada sem regressao.

## File List

- [x] `sistema-adalto/src/app/api/v1/rh/batches/[batchId]/reprocess/route.ts` (new)
- [x] `sistema-adalto/src/modules/exceptions/application/reprocess-exceptions.ts` (new)
- [x] `sistema-adalto/src/modules/exceptions/domain/exception.ts` (update)
- [x] `sistema-adalto/src/modules/exceptions/infrastructure/exception-repository.ts` (update)
- [x] `sistema-adalto/src/lib/rh/batches/reprocess-audit.ts` (new)
- [x] `sistema-adalto/src/lib/db/schema/exceptions.ts` (update)
- [x] `sistema-adalto/drizzle/migrations/20260413_reprocess_tracking.sql` (new)
- [x] `sistema-adalto/src/components/exceptions/ExceptionQueuePage.tsx` (update)
- [x] `sistema-adalto/src/app/(rh)/lotes/batch-progress-panel.tsx` (update)
- [x] `sistema-adalto/src/app/(rh)/lotes/page.tsx` (update)
- [x] `sistema-adalto/__tests__/rh-batches-api.test.ts` (update)
- [x] `sistema-adalto/__tests__/exceptions-reprocess-domain.test.ts` (new)
- [x] `sistema-adalto/__tests__/components/exceptions.test.tsx` (update)
- [x] `sistema-adalto/src/app/api/v1/rh/batches/[batchId]/reprocess/route.ts` (update - review patch)
- [x] `sistema-adalto/src/modules/exceptions/infrastructure/exception-repository.ts` (update - review patch)
- [x] `sistema-adalto/__tests__/rh-batches-api.test.ts` (update - review patch)
- [x] `_bmad-output/implementation-artifacts/3-4-reprocessamento-seletivo-de-itens-e-lotes.md` (update)
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` (update)

---

## Change Log

- 2026-04-13: Story 3.4 criada com contexto completo, inteligencia de story anterior, guardrails de arquitetura e criterios de teste.
- 2026-04-13: Story 3.4 implementada com reprocessamento seletivo, idempotencia por item, auditoria inicio/fim, ajustes de UX RH e validacao completa de qualidade.
- 2026-04-13: Code review aplicado com 4 patches resolvidos e revalidacao completa sem regressao.

---

## Status

**Current Status:** done  
**Last Updated:** 2026-04-13  
**Ready for Developer:** No - story concluida
