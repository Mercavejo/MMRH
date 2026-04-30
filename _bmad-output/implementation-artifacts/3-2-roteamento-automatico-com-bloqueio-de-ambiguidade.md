# Story 3.2: Roteamento Automatico com Bloqueio de Ambiguidade

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a RH/DP operador,
I want que o sistema roteie documentos por colaborador com seguranca,
so that a maioria do lote avance sem intervencao manual e sem risco de publicacao incorreta.

## Acceptance Criteria

1. Given um lote validado para processamento
   When o motor de roteamento executar
   Then cada documento deve ser associado ao colaborador destino conforme regras de identificacao
   And casos ambiguos devem ser bloqueados automaticamente antes da publicacao.

2. Given acompanhamento do processamento
   When o RH visualizar progresso do lote
   Then deve existir painel de progresso com totais de processados, pendentes e falhas
   And os estados devem refletir transicao em tempo operacional com clareza.

## Tasks / Subtasks

- [x] Task 1 - Modelar dominio de roteamento, correspondencia e bloqueio por ambiguidade (AC: 1)
  - [x] Definir contrato de entrada e saida do motor com batch_id, tenant_id, document_id, employee_identifier, routing_status, ambiguity_reason, correlation_id e processed_at.
  - [x] Implementar validacao com Zod para identificadores de origem, regras de consistencia e classificacao de ambiguidade antes do roteamento.
  - [x] Classificar resultados em matched, ambiguous, pending e failed, sem permitir que itens ambiguos avancem para publicacao.
  - [x] Se a persistencia do estado de roteamento for necessaria, estender src/lib/db/schema/batches.ts com contadores e status operacionais e exportar em src/lib/db/schema/index.ts.

- [x] Task 2 - Expor acompanhamento operacional do lote para o RH (AC: 1, 2)
  - [x] Criar contrato de leitura do progresso por batch_id em src/app/api/v1/rh/batches/[batchId]/route.ts para retornar resumo de roteamento e bloqueios.
  - [x] Criar acao de processamento em src/app/api/v1/rh/batches/[batchId]/process/route.ts caso a execucao do motor precise ser disparada via API.
  - [x] Validar sessao, tenant e papel com validateSession, userTenantMappings, assertTenantAction e RBAC_ACTIONS, mantendo o escopo tenant-bound.
  - [x] Retornar envelope padrao { data, error, meta } com correlation_id no header x-correlation-id e no corpo da resposta.

- [x] Task 3 - Construir Batch Progress Panel e integrar a tela de lotes (AC: 2)
  - [x] Implementar painel com totais de processados, pendentes, falhas e bloqueios por ambiguidade.
  - [x] Exibir estados inicial, processando, com excecoes, bloqueado, concluido e falha critica com linguagem operacional clara.
  - [x] Integrar o painel em src/app/(rh)/lotes/page.tsx preservando uma acao primaria clara por tela e feedback consistente com o UX do produto.
  - [x] Garantir foco visivel, labels compreensiveis e navegacao por teclado no painel e nas acoes de acompanhamento.

- [x] Task 4 - Cobertura de testes e validacao final (AC: 1, 2)
  - [x] Cobrir o motor de roteamento com cenarios de correspondencia unica, ambiguidade, identificador ausente e resumo de contadores.
  - [x] Cobrir a API de progresso e processamento com sucesso, ausencia de sessao, role invalida, tenant mismatch e lote inexistente ou bloqueado.
  - [x] Cobrir a UI do Batch Progress Panel com estados de processamento, bloqueio por ambiguidade e feedback operacional em linha.
  - [x] Executar npm run test:run, npm run lint e npm run build sem regressao.

## Dev Notes

### Contexto do Epic

- Epic 3 entrega a operacao RH de lotes com validacao forte, tratamento de excecoes e publicacao confiavel em escala.
- Esta story cobre diretamente FR18, FR19 e FR20 e habilita visibilidade operacional para FR25 e FR26.
- NFRs diretamente relacionados: NFR4 (volume e tempo de lote), NFR8 (log auditavel), NFR12 (retomada sem duplicacao), NFR15 (escala 10x), NFR18-NFR20 (acessibilidade).

### Story Foundation e Requisitos Tecnicos

- O roteamento deve partir somente de um lote ja validado e nao pode seguir para publicacao quando existir ambiguidade.
- O painel de progresso deve deixar claro quantos itens foram processados, quantos estao pendentes e quantos falharam, incluindo bloqueios por ambiguidade.
- O sistema nao pode inferir tenant por dados da tela; tenant_id deve vir sempre da sessao autenticada.
- Toda transicao operacional relevante precisa ficar rastreavel por correlation_id e trilha auditavel.

### Architecture Compliance (Must Follow)

- Manter endpoints em src/app/api/v1/**/route.ts com envelope padrao e correlation_id em request/response.
- Reutilizar src/lib/api/response.ts, src/lib/api/errors.ts, src/lib/auth/session.ts, src/lib/auth/rbac.ts e src/lib/observability/correlation-id.ts.
- Usar apenas src/lib/db/client.ts como cliente de banco e manter o escopo tenant-bound em toda leitura e escrita.
- Validacao de entrada deve ocorrer com Zod safeParse no boundary da rota ou do servico exposto.
- Se houver schema novo ou ajuste de schema existente, atualizar o index unico de src/lib/db/schema/index.ts e registrar migracao correspondente em drizzle/migrations.

### Library / Framework Requirements

- Next.js 16.2.3 com App Router.
- React 19.2.4.
- TypeScript 5 em strict mode.
- MUI 9.0.0 para painel operacional e feedback.
- Zod 4.3.6 para validacao de entrada.
- Drizzle ORM 0.45.2 e drizzle-kit 0.31.10 para qualquer persistencia de estado adicional.

### File Structure Requirements

- src/lib/rh/batches/batch-routing.ts (novo)
- src/lib/rh/batches/batch-progress.ts (novo)
- src/lib/rh/batches/batch-routing-audit.ts (novo, se a execucao precisar de trilha dedicada)
- src/lib/db/schema/batches.ts (ajuste de status e contadores operacionais, se persistidos no lote)
- src/lib/db/schema/index.ts (update export se o schema mudar)
- src/app/api/v1/rh/batches/[batchId]/route.ts (novo, leitura de progresso)
- src/app/api/v1/rh/batches/[batchId]/process/route.ts (novo, disparo do roteamento se exposto via API)
- src/app/(rh)/lotes/page.tsx (ajuste para exibir o painel de progresso)
- src/app/(rh)/lotes/batch-progress-panel.tsx (novo)
- __tests__/rh-batches-routing-domain.test.ts (novo)
- __tests__/rh-batches-api.test.ts (extensao dos casos de roteamento/progresso)
- __tests__/rh-batches-ui.test.tsx (extensao do painel de progresso)

### Testing Requirements

- Cobrir roteamento com correspondencia unica, ambiguidade, identificador ausente/invalido e resumo de contadores.
- Cobrir bloqueio cross-tenant e sessao invalida com cookie presente.
- Cobrir retorno do envelope padrao e do correlation_id em leitura de progresso e disparo do processamento.
- Cobrir acessibilidade basica do painel de progresso: foco visivel, labels claras e mensagens nao dependentes apenas de cor.

### Reuse and Anti-Reinvention Guardrails

- Reutilizar o contrato ja criado em src/lib/rh/batches/import-validation.ts e src/lib/rh/batches/import-batch.ts para manter o fluxo de lote coerente.
- Reutilizar os padroes de resposta e erro do produto; nao criar formato paralelo de payload ou envelope.
- Reutilizar o padrao de auditoria existente e manter o correlation_id alinhado com o fluxo da Story 3.1.
- Nao criar novo cliente DB, novo mecanismo paralelo de RBAC ou logica de autorizacao ad-hoc.

### Previous Story Intelligence (Story 3.1)

- Story 3.1 consolidou a validacao inicial do lote, a persistencia do batch e a trilha de importacao com correlation_id.
- O melhor ponto de extensao para 3.2 e tratar roteamento e progresso como continuidade do mesmo dominio de lote, sem introduzir uma segunda interpretacao de batch.
- A UI de 3.1 ja estabeleceu o padrao de feedback operacional para o painel RH; 3.2 deve manter a mesma linguagem visual e semantica de estados.
- A persistencia existente em src/lib/db/schema/batches.ts pode ser estendida, se necessario, para refletir status e contadores de processamento.

### Git Intelligence Summary

- 3.1 ja criou a base de importacao validada, rota de upload e teste de UI para o fluxo de lote.
- O dominio de lote deve continuar centralizado em src/lib/rh/batches para evitar dispersao de regras.
- A proxima camada funcional e o roteamento automatico com bloqueio de ambiguidade e visibilidade operacional do processamento.

### Latest Tech Information

- Next.js 16.2.3 com App Router segue usando Route Handlers com Request/Response web; manter handlers assincronos tipados.
- Zod 4 estavel continua sendo a escolha para safeParse no boundary e para mensagens de erro operacionais.
- Drizzle ORM permanece a camada adequada para qualquer extensao de schema de batch, mantendo a fonte unica de verdade em schema/index.

### Project Structure Notes

- O repositorio ja possui o dominio de lote inicial em src/lib/rh/batches e a tela RH em src/app/(rh)/lotes.
- O Batch Progress Panel e o motor de roteamento devem nascer como extensao do mesmo fluxo de lote, nao como feature paralela.
- A validacao de ambiguidade precisa falhar cedo e nao pode depender apenas da camada visual para proteger a publicacao.

### References

- Source: _bmad-output/planning-artifacts/epics.md (Epic 3, Story 3.2, FR18-FR20, FR25-FR26)
- Source: _bmad-output/planning-artifacts/prd.md (Jornada 3, NFR4, NFR8, NFR12, NFR15, NFR18-NFR20)
- Source: _bmad-output/planning-artifacts/architecture.md (pipeline ingestao-validacao-roteamento-publicacao, idempotencia, boundaries de servico e Batch Progress Panel)
- Source: _bmad-output/planning-artifacts/ux-design-specification.md (Jornada 3, Batch Progress Panel, Feedback Patterns, Button Hierarchy)
- Source: _bmad-output/project-context.md (regras de envelope, correlation_id, RBAC e tenant scope)
- Source: _bmad-output/implementation-artifacts/3-1-importacao-de-relatorio-e-validacao-inicial.md
- Source: sistema-adalto/src/lib/rh/batches/import-validation.ts
- Source: sistema-adalto/src/lib/rh/batches/import-batch.ts
- Source: sistema-adalto/src/app/api/v1/rh/batches/route.ts
- Source: sistema-adalto/src/lib/db/schema/batches.ts

## Dev Agent Record

### Agent Model Used

- GPT-5.4 mini

### Debug Log References

- `npm run test:run` - 32 test files, 114 tests passing.
- `npm run lint` - 2 pre-existing warnings in src/lib/compliance/minimization.ts; no errors introduced by this story.
- `npm run build` - Next.js production build completed successfully.

### Completion Notes List

- Task 1 concluida com motor de roteamento, manifesto, progresso e persistencia do lote alinhados ao dominio de batches.
- Task 2 concluida com rotas RH de leitura e processamento, envelope padrao e correlation_id propagado no header e corpo.
- Task 3 concluida com Batch Progress Panel integrado a tela de lotes e estados operacionais claros para RH.
- Task 4 concluida com cobertura de dominio, API e UI validada em Vitest, lint sem erros e build de producao aprovado.

### Review Findings

- [x] [Review][Patch] Batch routing stays in `processing` if the router throws [src/app/api/v1/rh/batches/[batchId]/process/route.ts:188] — fixed by moving the batch to a terminal `failed` state in the error path.
- [x] [Review][Patch] Partial failures are reported as `completed` [src/lib/rh/batches/batch-routing.ts:144] — fixed by prioritizing `failed` when any routed item fails.
- [x] [Review][Patch] Failed routing is audited as success [src/app/api/v1/rh/batches/[batchId]/process/route.ts:223] — fixed by treating any non-`completed` routing outcome as audit failure.
- [x] [Review][Patch] Error responses omit the `x-correlation-id` header [src/app/api/v1/rh/batches/[batchId]/process/route.ts:77] — fixed by reattaching the correlation header to all error responses.

### File List

- _bmad-output/implementation-artifacts/3-2-roteamento-automatico-com-bloqueio-de-ambiguidade.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- sistema-adalto/src/app/(rh)/lotes/page.tsx
- sistema-adalto/src/app/api/v1/rh/batches/[batchId]/process/route.ts
- sistema-adalto/src/app/api/v1/rh/batches/[batchId]/route.ts
- sistema-adalto/src/app/api/v1/rh/batches/route.ts
- sistema-adalto/src/app/(rh)/lotes/batch-progress-panel.tsx
- sistema-adalto/src/lib/rh/batches/batch-progress.ts
- sistema-adalto/src/lib/rh/batches/batch-routing.ts
- sistema-adalto/src/lib/rh/batches/batch-routing-audit.ts
- sistema-adalto/src/lib/rh/batches/import-batch.ts
- sistema-adalto/src/lib/db/schema/batches.ts
- sistema-adalto/src/lib/db/schema/index.ts
- sistema-adalto/__tests__/rh-batches-api.test.ts
- sistema-adalto/__tests__/rh-batches-routing-domain.test.ts
- sistema-adalto/__tests__/rh-batches-ui.test.tsx

## Change Log

- 2026-04-09: Story 3.2 criada com contexto completo para implementacao e status atualizado para ready-for-dev.
- 2026-04-09: Story 3.2 movida para in-progress para inicio da implementacao.
- 2026-04-09: Story 3.2 concluida com roteamento automatico, acompanhamento operacional do lote, Batch Progress Panel e validacao completa.

## Story Completion Status

Concluida.