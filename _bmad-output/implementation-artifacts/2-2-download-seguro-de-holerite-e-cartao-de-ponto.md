# Story 2.2: Download Seguro de Holerite e Cartao de Ponto

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a colaborador,
I want baixar holerite e cartao de ponto disponiveis,
so that eu resolva minhas necessidades sem abrir chamado ao RH.

## Acceptance Criteria

1. Given um documento com status publicado para o colaborador
When ele acionar download
Then o sistema deve disponibilizar apenas arquivos vinculados ao proprio perfil
And registrar evento de acesso e download na trilha de auditoria.

2. Given picos de acesso em periodo de fechamento
When multiplos colaboradores realizarem download
Then o inicio do download deve atender os objetivos de desempenho definidos
And falhas devem retornar mensagem clara orientando proximo passo.

## Tasks / Subtasks

- [x] Task 1 - Estruturar dominio de download seguro e regras de elegibilidade (AC: 1)
  - [x] Criar servico de dominio para resolver download apenas de documentos com status published e com escopo estrito por tenant_id + user_id.
  - [x] Definir contrato de retorno com metadados minimos para stream/download (document_id, document_type, period_ref, mime_type, file_name, storage_key).
  - [x] Garantir bloqueio explicito para status pending, processing, unavailable e error com mensagens deterministicas para API.

- [x] Task 2 - Expor endpoint versionado de download com sessao, RBAC e envelope padrao (AC: 1)
  - [x] Implementar endpoint GET /api/v1/employee/documents/[documentId]/download com validacao de entrada (UUID path param e query opcional) e correlation_id.
  - [x] Aplicar validacao de sessao, verificacao de role colaborador e enforcement tenant-bound via guardrails de auth/rbac existentes.
  - [x] Retornar sucesso no envelope padrao com URL assinada curta ou stream seguro (conforme infraestrutura existente) sem expor chave de storage sensivel.

- [x] Task 3 - Registrar trilha de auditoria para acesso e download (AC: 1)
  - [x] Criar writer de auditoria para evento de documento (ex.: employee.document.download.v1) reutilizando tabela de audit logs existente.
  - [x] Registrar status success/failure com correlation_id, tenant_id, actor_id, document_id e motivo de falha quando aplicavel.
  - [x] Garantir que falhas de auditoria nao removam controles de seguranca do download (estrategia fail-safe com erro rastreavel).

- [x] Task 4 - Integrar UX de acao de download e feedback de erro orientado (AC: 2)
  - [x] Adicionar acao primaria de download na listagem e/ou detalhe do documento sem quebrar preservacao de filtros da Story 2.1.
  - [x] Exibir feedback claro para indisponibilidade, expiracao de sessao e erro operacional com proximo passo objetivo.
  - [x] Garantir navegacao por teclado, labels descritivos e contraste AA para controles e mensagens.

- [x] Task 5 - Cobertura de testes de seguranca, auditoria, desempenho de inicio e UX (AC: 1, 2)
  - [x] Adicionar testes de API: sucesso, sem sessao, role invalida, tenant mismatch, documento inexistente, status nao publicado, path param invalido.
  - [x] Adicionar testes de dominio/auditoria: evento de download success/failure e payload minimo esperado.
  - [x] Adicionar teste de UI para acao de download e mensagens de erro orientadas.
  - [x] Validar npm run test:run, npm run lint e npm run build sem regressao.

## Dev Notes

### Contexto do Epic

- Epic 2 consolida o autosservico do colaborador para consulta e download sem dependencia do RH.
- Story 2.2 implementa diretamente FR11 e reforca FR8/FR24 no eixo de auditoria de acesso sensivel.
- NFRs diretamente impactados: NFR3 (inicio de download <= 3s para 95%), NFR7 (segregacao tenant/colaborador), NFR8 (auditoria imutavel), NFR18-NFR20 (acessibilidade).

### Story Foundation e Requisitos Tecnicos

- Download deve ser permitido somente para documento publicado e pertencente ao colaborador autenticado no tenant ativo.
- Endpoint deve permanecer em /api/v1 com envelope padrao { data, error, meta } e correlation_id no ciclo request/response.
- Fluxo deve manter semantica de erro clara para orientar acao (ex.: documento ainda nao publicado, sessao expirada, indisponibilidade temporaria).

### Architecture Compliance (Must Follow)

- Seguir padrao de Route Handlers em src/app/api/v1/**/route.ts.
- Reutilizar validacao de sessao, RBAC e utilitarios centrais de resposta/erro ja existentes; nao criar atalho de autorizacao ad-hoc.
- Nao criar cliente DB paralelo; usar apenas src/lib/db/client.ts e schema central exportado em src/lib/db/schema/index.ts.
- Preservar boundaries: UI chama rota/API; regra de negocio em src/lib ou modulo de dominio; persistencia via Drizzle.

### Library / Framework Requirements

- next 16.2.3
- react 19.2.4
- typescript 5 strict
- zod 4.3.6
- drizzle-orm 0.45.2
- @upstash/redis 1.37.0 (somente se necessario para rate-limit/cache de leitura)

### File Structure Requirements

- src/app/api/v1/employee/documents/[documentId]/download/route.ts (novo)
- src/lib/documents/get-downloadable-document.ts (novo)
- src/lib/documents/download-audit.ts (novo)
- src/app/(employee)/documents/page.tsx (ajuste para acao de download e feedback)
- src/app/(employee)/documents/[documentId]/page.tsx (ajuste para acao de download contextual)
- __tests__/employee-documents-download-api.test.ts (novo)
- __tests__/documents-download-audit.test.ts (novo)
- __tests__/employee-documents-download-ui.test.tsx (novo)

### Testing Requirements

- Cobrir bloqueio cross-tenant e bloqueio por role != colaborador em todos os caminhos de download.
- Cobrir bloqueio de status != published e documento inexistente.
- Cobrir registro de auditoria para sucesso e falha com correlation_id.
- Cobrir mensagens de erro orientadas para usuario final e navegacao por teclado nos controles de download.
- Medir inicio de download em teste de integracao controlado (criterio NFR3 como alvo de observacao).

### Reuse and Anti-Reinvention Guardrails

- Reutilizar listEmployeeDocuments e filtros da Story 2.1 como contexto de navegacao; nao duplicar logica de serializacao de filtros.
- Reutilizar utilitarios de correlation_id (src/lib/observability/correlation-id) e envelope API (src/lib/api/response.ts).
- Reutilizar base de auditoria existente (src/lib/auth/audit.ts + schema audit_logs) criando variante orientada a documentos, nao novo mecanismo paralelo.

### Previous Story Intelligence (Story 2.1)

- Story 2.1 ja implementou escopo estrito tenant/user e filtros contextuais na URL; Story 2.2 deve preservar esse comportamento ao abrir/voltar de detalhe.
- Revisao da Story 2.1 apontou risco real de quebra de escopo por filtros; para 2.2, qualquer parametro de tenant no front deve ser evitado e escopo deve derivar da sessao.
- Chip de status e estados de UI ja existem; acao de download deve respeitar semantica de status e nao depender apenas de cor.

### Git Intelligence Summary

- Commits recentes no repo aplicaram hardening de compliance pos-review e consolidaram base de auth/RBAC/testes.
- Diretriz para 2.2: manter abordagem incremental sobre fundacao existente, sem alterar arquitetura ou stack.

### Latest Tech Information

- Stack atual do projeto ja esta em versoes modernas e coerentes com arquitetura; para esta story, priorizar estabilidade e aderencia a guardrails existentes em vez de upgrades.
- Em Next.js App Router, preferir respostas de download com headers explicitos e tratamento robusto de erro no Route Handler para manter observabilidade.

### Project Structure Notes

- Fluxo de colaborador permanece em src/app/(employee)/documents, com API dedicada em src/app/api/v1/employee/documents.
- Novas funcoes de dominio devem ficar em src/lib/documents para manter isolamento do contexto de documentos.

### References

- Source: _bmad-output/planning-artifacts/epics.md (Epic 2, Story 2.2)
- Source: _bmad-output/planning-artifacts/prd.md (FR11, FR8, FR24, NFR3, NFR7, NFR8, NFR18-NFR20)
- Source: _bmad-output/planning-artifacts/architecture.md (API boundaries, service boundaries, data boundaries)
- Source: _bmad-output/planning-artifacts/ux-design-specification.md (Jornada 1, Feedback Patterns, Accessibility Strategy)
- Source: _bmad-output/implementation-artifacts/2-1-lista-de-documentos-com-filtros-e-estados-claros.md (learned constraints)
- Source: sistema-adalto/src/app/api/v1/employee/documents/route.ts
- Source: sistema-adalto/src/lib/documents/list-documents.ts
- Source: sistema-adalto/src/lib/api/response.ts
- Source: sistema-adalto/src/lib/auth/audit.ts

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- npm run test:run -- __tests__/get-downloadable-document.test.ts
- npm run test:run -- __tests__/employee-documents-download-api.test.ts
- npm run test:run -- __tests__/get-downloadable-document.test.ts __tests__/employee-documents-download-api.test.ts __tests__/documents-download-audit.test.ts
- npm run test:run -- __tests__/employee-documents-download-ui.test.tsx __tests__/employee-documents-download-api.test.ts __tests__/get-downloadable-document.test.ts __tests__/documents-download-audit.test.ts
- npm run test:run
- npm run lint
- npm run build

### Completion Notes List

- Task 1 concluida: servico de dominio de elegibilidade implementado em get-downloadable-document com escopo tenant/user, contrato de metadata e bloqueio deterministico para status nao publicados.
- Task 2 concluida: endpoint GET /api/v1/employee/documents/[documentId]/download implementado com sessao, RBAC, correlation_id e resposta em envelope padrao sem exposicao de storage_key.
- Task 3 concluida: trilha de auditoria de download implementada com evento employee.document.download.v1 para success/failure e fail-safe retornando AUDIT_LOG_WRITE_FAILED quando persistencia de auditoria falha no caminho de sucesso.
- Task 4 concluida: UX de download adicionada na lista e no detalhe com labels acessiveis e mensagens orientativas de proximo passo.
- Task 5 concluida: testes de API/dominio/auditoria/UI adicionados e validacao completa executada com 61 testes passando, lint sem novos warnings da story e build de producao aprovado.

### File List

- _bmad-output/implementation-artifacts/2-2-download-seguro-de-holerite-e-cartao-de-ponto.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- sistema-adalto/src/lib/documents/get-downloadable-document.ts
- sistema-adalto/src/lib/documents/employee-download-handler.ts
- sistema-adalto/src/lib/documents/download-audit.ts
- sistema-adalto/src/app/api/v1/employee/documents/[documentId]/download/route.ts
- sistema-adalto/src/app/(employee)/documents/page.tsx
- sistema-adalto/src/app/(employee)/documents/[documentId]/page.tsx
- sistema-adalto/__tests__/get-downloadable-document.test.ts
- sistema-adalto/__tests__/employee-documents-download-api.test.ts
- sistema-adalto/__tests__/documents-download-audit.test.ts
- sistema-adalto/__tests__/employee-documents-download-ui.test.tsx

### Change Log

- 2026-04-08: Story 2.2 implementada ponta a ponta (dominio de elegibilidade, endpoint de download seguro, auditoria fail-safe, UX de download e cobertura de testes) com status movido para review.

### Review Findings

- [x] [Review][Decision] Escopo de diff da revisao — resolvido: revisao reorientada para o commit da Story 2.2 (`c17bbdb`).
- [x] [Review][Patch] Assinatura de download usa segredo default inseguro quando `DOWNLOAD_SIGNING_SECRET` nao esta definido [sistema-adalto/src/lib/documents/employee-download-handler.ts:50]
- [x] [Review][Patch] `download_url` retornada aponta para a propria rota JSON e nao existe consumo/validacao de `sig` + `exp` para servir arquivo, impedindo inicio real de download [sistema-adalto/src/lib/documents/employee-download-handler.ts:197]
- [x] [Review][Patch] Endpoint aceita `tenant_id` por query string; escopo deve derivar exclusivamente da sessao para reduzir superficie de erro de autorizacao [sistema-adalto/src/lib/documents/employee-download-handler.ts:35]
- [x] [Review][Patch] Cobertura de teste nao inclui caso de sessao invalida com cookie presente (esperado 401 `Sessao invalida ou expirada.`) [sistema-adalto/__tests__/employee-documents-download-api.test.ts:92]
