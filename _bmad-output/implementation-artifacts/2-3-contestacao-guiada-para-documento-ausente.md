# Story 2.3: Contestacao Guiada para Documento Ausente

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a colaborador,
I want abrir solicitacao contextual quando um documento nao estiver disponivel,
so that o RH receba informacoes completas para resolver rapidamente.

## Acceptance Criteria

1. Given um documento esperado nao encontrado
When o colaborador abrir contestacao
Then o sistema deve preencher automaticamente contexto de periodo/tipo/status
And exibir mensagem explicativa de pendente, indisponivel ou erro com orientacao objetiva.

2. Given envio da solicitacao contextual
When o RH receber a demanda
Then a solicitacao deve estar vinculada a usuario, documento e lote quando houver
And ficar disponivel para rastreio de tratamento ate resolucao.

## Tasks / Subtasks

- [x] Task 1 - Modelar dominio de contestacao e persistencia rastreavel (AC: 2)
  - [x] Criar schema de contestacoes com tenant_id, user_id, document_id (quando existir), period_ref, document_type, status_origem, lote_id opcional, motivo e status_de_tratamento.
  - [x] Exportar schema novo no index central de schema e gerar migracao Drizzle versionada.
  - [x] Definir contratos de dominio para abertura de contestacao e transicao de rastreio (open, in_progress, resolved).

- [x] Task 2 - Expor endpoint do colaborador para abertura contextual com guardrails de sessao e RBAC (AC: 1, 2)
  - [x] Implementar POST em /api/v1/employee/documents/contestations com validacao Zod de payload e correlation_id.
  - [x] Derivar tenant_id exclusivamente da sessao (nao aceitar tenant_id em query/body) e validar role colaborador.
  - [x] Preencher automaticamente contexto de periodo/tipo/status a partir do documento informado e bloquear abertura para status published.
  - [x] Retornar envelope padrao { data, error, meta } com id da contestacao e status inicial de rastreio.

- [x] Task 3 - Expor rastreio para RH com escopo por tenant e trilha de tratamento (AC: 2)
  - [x] Implementar GET /api/v1/rh/contestations para fila do tenant com filtros de status e periodo.
  - [x] Implementar PATCH /api/v1/rh/contestations/[contestationId] para atualizar status de tratamento com RBAC de RH operador/gestor.
  - [x] Garantir vinculo exibido para usuario, documento e lote quando houver, sem exposicao cross-tenant.

- [x] Task 4 - Integrar UX guiada no portal do colaborador com mensagens orientativas por status (AC: 1)
  - [x] Adicionar CTA Abrir contestacao na lista/detalhe apenas para documentos com status pending, unavailable ou error.
  - [x] Implementar formulario/fluxo com prefill de periodo, tipo e status, incluindo texto orientativo por estado.
  - [x] Preservar filtros de navegacao da Story 2.1 e mensagens consistentes com o padrao de feedback do produto.
  - [x] Garantir acessibilidade: foco visivel, labels claras e feedback nao dependente apenas de cor.

- [x] Task 5 - Auditoria e testes completos de API, dominio e UX (AC: 1, 2)
  - [x] Registrar evento auditavel de abertura/atualizacao de contestacao com correlation_id, tenant_id, actor_id, contestation_id e status.
  - [x] Cobrir testes de API: sucesso, sessao ausente, sessao invalida, role invalida, tenant mismatch, documento inexistente, status published e payload invalido.
  - [x] Cobrir testes de dominio: preenchimento automatico de contexto, vinculo com lote opcional e transicoes de rastreio validas/invalidas.
  - [x] Cobrir testes de UI: exibicao de mensagens pendente/indisponivel/erro e abertura contextual mantendo filtros.
  - [x] Validar npm run test:run, npm run lint e npm run build sem regressao.

## Dev Notes

### Contexto do Epic

- Epic 2 trata autosservico documental do colaborador (FR10-FR15).
- Story 2.3 implementa diretamente FR14 e prepara base para FR15 (notificacao da story 2.4).
- NFRs diretamente impactados: NFR7 (isolamento tenant/colaborador), NFR8 (auditoria), NFR18-NFR20 (acessibilidade).

### Story Foundation e Requisitos Tecnicos

- Abertura de contestacao deve partir de contexto de documento ausente/nao disponivel, com prefill obrigatorio de period_ref, document_type e status_origem.
- Mensagem para o colaborador deve ser objetiva por status:
  - pending: informar que o documento esta em processamento e prazo esperado.
  - unavailable: informar indisponibilidade e orientar abertura de contestacao.
  - error: informar falha operacional e orientar abertura de contestacao imediata.
- Contestacao deve ficar rastreavel para RH ate resolucao, com historico minimo de status de tratamento.

### Architecture Compliance (Must Follow)

- Manter endpoints em src/app/api/v1/**/route.ts com envelope padrao e correlation_id em request/response.
- Reutilizar validacao de sessao, RBAC e utilitarios centrais de erro/resposta; nao criar autorizacao ad-hoc.
- Usar apenas db central em src/lib/db/client.ts e exportar novo schema via src/lib/db/schema/index.ts.
- Aplicar escopo tenant-bound em toda leitura/escrita; proibido aceitar tenant_id vindo de UI para decidir escopo.

### Library / Framework Requirements

- next 16.2.3 (Route Handlers App Router)
- react 19.2.4
- typescript 5 strict
- zod 4.3.6
- drizzle-orm 0.45.2 / drizzle-kit 0.31.10

### File Structure Requirements

- src/lib/db/schema/document-contestations.ts (novo)
- src/lib/db/schema/index.ts (update export)
- drizzle/migrations/*_document_contestations.sql (novo)
- src/lib/documents/create-document-contestation.ts (novo)
- src/lib/documents/contestation-tracking.ts (novo)
- src/app/api/v1/employee/documents/contestations/route.ts (novo)
- src/app/api/v1/rh/contestations/route.ts (novo)
- src/app/api/v1/rh/contestations/[contestationId]/route.ts (novo)
- src/app/(employee)/documents/page.tsx (ajuste CTA e feedback)
- src/app/(employee)/documents/[documentId]/page.tsx (ajuste CTA contextual)
- __tests__/employee-document-contestations-api.test.ts (novo)
- __tests__/rh-document-contestations-api.test.ts (novo)
- __tests__/document-contestation-domain.test.ts (novo)
- __tests__/employee-document-contestation-ui.test.tsx (novo)

### Testing Requirements

- Cobrir bloqueio cross-tenant em rotas de colaborador e RH.
- Cobrir bloqueio de contestacao para status published.
- Cobrir sessao invalida com cookie presente (regressao ja apontada em review anterior).
- Cobrir rastreabilidade de status open -> in_progress -> resolved e tentativa invalida de transicao.
- Cobrir acessibilidade de fluxo guiado (teclado, labels, mensagens por status).

### Reuse and Anti-Reinvention Guardrails

- Reutilizar listEmployeeDocuments e mapeamento de status existente em src/lib/documents/status-mapping.ts.
- Reutilizar serializacao de filtros da Story 2.1 para retorno contexto lista/detalhe.
- Reutilizar padrao de auditoria existente (src/lib/auth/audit.ts e audit_logs), criando acoes de contestacao no mesmo trilho.
- Nao criar novo cliente DB, novo formato de resposta, ou novo mecanismo paralelo de RBAC/sessao.

### Previous Story Intelligence (Story 2.2)

- Story 2.2 consolidou regras de download com escopo tenant/user e reforcou mensagens orientativas no portal.
- Review da 2.2 encontrou risco real ao aceitar tenant_id por query em fluxo sensivel; para 2.3, tenant deve vir somente da sessao.
- Review da 2.2 tambem reforcou necessidade de casos de teste para sessao invalida com cookie presente.
- UI ja orienta abrir contestacao quando download falha; 2.3 deve materializar esse fluxo sem quebrar filtros ativos.

### Git Intelligence Summary

- c17bbdb: implementou download seguro com trilha de auditoria e base de UX para orientacao de contestacao.
- 7894beb e 6147d89: hardening de compliance pos-review, reforcando postura de seguranca e escopo.
- 7b9b06e: fundacao de auth, RBAC, schema e testes ja consolidada para reutilizacao nesta story.

### Latest Tech Information

- Next.js Route Handlers (v16.2.3) seguem Web Request/Response e mantem params assincronos em rotas dinamicas; manter tipagem estrita no handler evita regressao.
- Zod 4 estavel com TypeScript strict recomendado; manter safeParse nos boundaries de API.
- Drizzle segue abordagem SQL-like e serverless-ready; manter padrao atual de schema/migrations sem migracao de stack nesta story.

### Project Structure Notes

- Estrutura atual de documentos esta centralizada em src/lib/documents e telas em src/app/(employee)/documents.
- Nao existe modulo previo de contestacao no codigo; story deve criar base minima coerente com padroes existentes.
- Endpoints atuais usam segmento employee (nao employees); seguir convencao implementada no repositorio real.

### References

- Source: _bmad-output/planning-artifacts/epics.md (Epic 2, Story 2.3)
- Source: _bmad-output/planning-artifacts/prd.md (FR14, FR15, NFR7, NFR8, NFR18-NFR20)
- Source: _bmad-output/planning-artifacts/architecture.md (API boundaries, service boundaries, data boundaries)
- Source: _bmad-output/planning-artifacts/ux-design-specification.md (Jornada 2, Feedback Patterns, Accessibility Strategy)
- Source: _bmad-output/project-context.md (regras de API envelope, RBAC e tenant scope)
- Source: _bmad-output/implementation-artifacts/2-2-download-seguro-de-holerite-e-cartao-de-ponto.md
- Source: sistema-adalto/src/app/api/v1/employee/documents/route.ts
- Source: sistema-adalto/src/app/(employee)/documents/page.tsx
- Source: sistema-adalto/src/app/(employee)/documents/[documentId]/page.tsx
- Source: sistema-adalto/src/lib/documents/list-documents.ts
- Source: sistema-adalto/src/lib/db/schema/employee-documents.ts
- Source: sistema-adalto/src/lib/api/response.ts
- Source: sistema-adalto/src/lib/auth/rbac.ts

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- npm run test:run -- __tests__/document-contestation-domain.test.ts __tests__/employee-document-contestations-api.test.ts __tests__/rh-document-contestations-api.test.ts __tests__/employee-document-contestation-ui.test.tsx (RED)
- npm run test:run -- __tests__/document-contestation-domain.test.ts __tests__/employee-document-contestations-api.test.ts __tests__/rh-document-contestations-api.test.ts __tests__/employee-document-contestation-ui.test.tsx (GREEN)
- npm run test:run
- npm run lint
- npm run build

### Completion Notes List

- Task 1 concluida: schema `document_contestations`, enum de rastreio, export central e migration `0002` criados; dominio de abertura e transicao implementado.
- Task 2 concluida: endpoint `POST /api/v1/employee/documents/contestations` implementado com sessao, RBAC, tenant derivado da sessao e contexto automatico do documento.
- Task 3 concluida: endpoints RH `GET /api/v1/rh/contestations` e `PATCH /api/v1/rh/contestations/[contestationId]` implementados com filtros, transicao controlada e escopo tenant-bound.
- Task 4 concluida: CTA de contestacao e mensagens por status adicionadas na lista/detalhe; fluxo de formulario contextual criado em `/documents/contestacao` com preservacao de filtros.
- Task 5 concluida: auditoria de abertura/atualizacao adicionada e suites de testes de dominio/API/UI criadas; regressao total validada com 80 testes passando, lint sem novos erros e build de producao aprovado.

### File List

- _bmad-output/implementation-artifacts/2-3-contestacao-guiada-para-documento-ausente.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- sistema-adalto/src/lib/db/schema/document-contestations.ts
- sistema-adalto/src/lib/db/schema/index.ts
- sistema-adalto/src/lib/documents/create-document-contestation.ts
- sistema-adalto/src/lib/documents/contestation-tracking.ts
- sistema-adalto/src/lib/documents/contestation-audit.ts
- sistema-adalto/src/app/api/v1/employee/documents/contestations/route.ts
- sistema-adalto/src/app/api/v1/rh/contestations/route.ts
- sistema-adalto/src/app/api/v1/rh/contestations/[contestationId]/route.ts
- sistema-adalto/src/app/(employee)/documents/page.tsx
- sistema-adalto/src/app/(employee)/documents/[documentId]/page.tsx
- sistema-adalto/src/app/(employee)/documents/contestacao/page.tsx
- sistema-adalto/drizzle/migrations/0002_soft_document_contestations.sql
- sistema-adalto/drizzle/migrations/meta/_journal.json
- sistema-adalto/__tests__/document-contestation-domain.test.ts
- sistema-adalto/__tests__/employee-document-contestations-api.test.ts
- sistema-adalto/__tests__/rh-document-contestations-api.test.ts
- sistema-adalto/__tests__/employee-document-contestation-ui.test.tsx

### Change Log

- 2026-04-09: Story 2.3 criada com contexto completo para implementacao e status atualizado para ready-for-dev.
- 2026-04-09: Story 2.3 implementada ponta a ponta (schema, APIs colaborador/RH, auditoria, UX guiada e testes), com status movido para review.
- 2026-04-09: Review concluido, issues corrigidas e status final promovido para done.

### Story Completion Status

- Implementacao, review e validacao completas - story concluida.
