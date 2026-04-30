# Story 2.1: Lista de Documentos com Filtros e Estados Claros

Status: done

## Story

As a colaborador,
I want ver minha lista de documentos por tipo e periodo com status claro,
so that eu encontre rapidamente o item certo para consulta.

## Acceptance Criteria

1. Given um colaborador autenticado
When acessar a area de documentos
Then o sistema deve exibir lista com tipo, periodo e status de cada documento
And permitir filtro por periodo/tipo preservando contexto ao navegar para detalhes e retornar.

2. Given a necessidade de consistencia visual e acessibilidade
When a lista e os componentes forem renderizados
Then os componentes devem usar hierarquia de botoes e feedback padronizada
And contraste, foco visivel e navegacao por teclado devem atender WCAG 2.1 AA.

## Tasks / Subtasks

- [x] Task 1 - Estruturar dominio de consulta de documentos por colaborador (AC: 1)
  - [x] Definir modelo de leitura para lista de documentos do colaborador com tenant_id, user_id, document_type, period_ref e status.
  - [x] Implementar query server-side com escopo estrito por tenant e colaborador, sem acesso cross-tenant.
  - [x] Mapear status funcionais (published, pending, processing, unavailable, error) para rotulos de exibicao.

- [x] Task 2 - Expor endpoint versionado com filtros e envelope padrao (AC: 1)
  - [x] Criar endpoint REST em /api/v1/employee/documents com filtros de tipo e periodo via query string.
  - [x] Validar entrada com zod e retornar envelope padrao { data, error, meta } com correlation_id.
  - [x] Integrar validacao de sessao e autorizacao de papel colaborador com guardrails existentes de auth/rbac.

- [x] Task 3 - Implementar tela de lista com preservacao de contexto (AC: 1)
  - [x] Criar rota de colaborador para lista de documentos e renderizar colunas minimas: tipo, periodo e status.
  - [x] Implementar filtros por tipo e periodo persistindo estado na URL para suportar retorno de detalhe sem perda de contexto.
  - [x] Implementar estados de loading, empty e error com mensagens orientadas ao proximo passo.

- [x] Task 4 - Aplicar padrao UX de componentes e acessibilidade (AC: 2)
  - [x] Reutilizar tokens de tema e hierarquia de botoes definida para portal do colaborador.
  - [x] Garantir contraste AA, foco visivel, labels compreensiveis e uso de teclado em filtros/lista/acoes.
  - [x] Garantir que status nao dependam apenas de cor (texto + indicacao visual complementar).

- [x] Task 5 - Cobertura de testes e validacao final (AC: 1, 2)
  - [x] Adicionar testes unitarios para mapeamento de status e serializacao de filtros.
  - [x] Adicionar testes de integracao para endpoint de listagem (sucesso, sem sessao, role invalida, tenant mismatch, filtros invalidos).
  - [x] Adicionar teste de interface/acessibilidade basica para navegacao por teclado e preservacao de filtros ao retornar de detalhe.
  - [x] Validar npm run test:run, npm run lint e npm run build sem regressao.

## Dev Notes

### Contexto do Epic

- Epic 2 entrega autosservico do colaborador para consulta e download de documentos.
- Esta story cobre FR10 e FR13 diretamente, e prepara base de UX/estado para FR11, FR12 e FR14.
- NFRs diretamente relacionados: NFR2 (consulta <= 2s em 95%), NFR7 (segregacao por tenant/colaborador), NFR18-NFR20 (acessibilidade).

### Requisitos Tecnicos Obrigatorios

- Toda consulta deve ser escopada por tenant_id e user_id autenticado.
- API deve permanecer em /api/v1 com envelope { data, error, meta }.
- Filtros devem ser validados server-side e refletidos na URL para preservar contexto de navegacao.
- Logs de operacao devem manter correlation_id e tenant_id em leituras sensiveis.

### Architecture Compliance (Must Follow)

- Seguir App Router e Route Handlers no padrao existente em src/app/api/v1.
- Reutilizar utilitarios de sessao, RBAC e resposta padrao ja existentes em src/lib/auth e src/lib/api.
- Manter naming conventions: snake_case no wire externo e camelCase no codigo TS.
- Nao introduzir novo framework de estado global para esta historia; manter abordagem server-first.

### Library / Framework Requirements

- next 16.2.3
- drizzle-orm 0.45.2
- drizzle-kit 0.31.10
- zod 4.3.6
- @upstash/redis 1.37.0 (opcional para cache de leitura em evolucao futura)

### File Structure Requirements

- src/app/(employee)/documents/page.tsx (novo)
- src/app/(employee)/documents/[documentId]/page.tsx (novo ou ajuste, para retorno contextual)
- src/app/api/v1/employee/documents/route.ts (novo)
- src/lib/documents/list-documents.ts (novo)
- src/lib/documents/status-mapping.ts (novo)
- __tests__/employee-documents-api.test.ts (novo)
- __tests__/employee-documents-ui.test.tsx (novo)
- __tests__/documents-status-mapping.test.ts (novo)

### Testing Requirements

- Cobrir filtros validos/invalidos, comportamento sem sessao e bloqueio cross-tenant.
- Cobrir preservacao de contexto de filtro via query string ao navegar e retornar.
- Cobrir estados de UI: loading, empty, success, error.
- Cobrir criterios minimos de acessibilidade: foco por teclado, labels e contraste em componentes criticos.

### UX Requirements Relevantes

- Aplicar UX-DR4 para estrutura de item documental com estado claro.
- Aplicar UX-DR8 e UX-DR9 para hierarquia de botoes e feedback padronizado.
- Aplicar UX-DR11 para preservacao de filtros ao retornar de detalhes.
- Aplicar UX-DR12 e UX-DR13/14/16 para estados de tela, contraste, teclado e semantica de status.
- Aplicar UX-DR17/18 para comportamento responsivo em portal do colaborador (baixa friccao).

### Previous Story Intelligence

- Esta e a primeira story do Epic 2; nao ha story anterior no mesmo epic para reaproveitar learnings diretos.
- Reusar os guardrails de autenticacao/sessao/RBAC consolidados no Epic 1 para evitar duplicacao.

### Git Intelligence Summary

- Nao aplicavel para historia inicial do epic.

### Latest Tech Information

- A stack em uso no repositorio ja esta alinhada com as versoes especificadas na arquitetura; manter sem upgrades nesta historia reduz risco de regressao.

### Project Structure Notes

- O repositorio atual ja possui base de auth/compliance em src/lib; manter novos componentes de documentos em src/lib/documents para isolamento de dominio.
- As pastas app/(employee), app/(rh) e app/(public) existem como placeholders; Story 2.1 deve iniciar concretizacao do fluxo de colaborador em app/(employee).

### References

- Source: _bmad-output/planning-artifacts/epics.md (Epic 2; Story 2.1; FR10, FR13)
- Source: _bmad-output/planning-artifacts/prd.md (Jornada 1 e Journey Requirements Summary; NFR2, NFR7, NFR18-NFR20)
- Source: _bmad-output/planning-artifacts/architecture.md (API /api/v1, envelope padrao, server-first, naming conventions)
- Source: _bmad-output/planning-artifacts/ux-design-specification.md (Design System Foundation, UX patterns, acessibilidade e estados)
- Source: sistema-adalto/src/lib/api/response.ts
- Source: sistema-adalto/src/lib/auth/session.ts
- Source: sistema-adalto/src/lib/auth/rbac.ts

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- N/A (story context creation)

### Completion Notes List

- Story 2.1 criada com contexto consolidado de epics, PRD, arquitetura e UX.
- Tarefas definidas para implementacao incremental com cobertura de testes por AC.
- Guardrails de escopo, seguranca multi-tenant e acessibilidade incluidos para reduzir risco de regressao.
- Task 1 concluida: modelo de documentos do colaborador, query server-side com escopo tenant/usuario e mapeamento semantico de status implementados.
- Validacao Task 1: npm run test:run com 36 testes passando.
- Task 2 concluida: endpoint GET /api/v1/employee/documents com validacao zod, sessao e enforcement de papel colaborador.
- Task 3 concluida: pagina de lista em /documents com filtros via URL, detalhe com retorno contextual e estados loading/empty/error.
- Task 4 concluida: chip de status com texto+icone, labels de acessibilidade e hierarquia de botoes/feedback no padrao do design system.
- Task 5 concluida: testes unitarios, integracao e UI adicionados; validacoes executadas com sucesso (test:run, lint sem erros, build).
- Review findings resolvidos: o fluxo de lista passou a ser session-scoped e o chip de status renderiza icones reais.
- Code review concluido com 2 findings corrigidos e validacao final repetida com sucesso.

### File List

- _bmad-output/implementation-artifacts/2-1-lista-de-documentos-com-filtros-e-estados-claros.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- sistema-adalto/src/lib/db/schema/employee-documents.ts
- sistema-adalto/src/lib/db/schema/index.ts
- sistema-adalto/src/lib/documents/status-mapping.ts
- sistema-adalto/src/lib/documents/list-documents.ts
- sistema-adalto/src/lib/documents/document-status-chip.tsx
- sistema-adalto/src/app/api/v1/employee/documents/route.ts
- sistema-adalto/src/app/(employee)/documents/page.tsx
- sistema-adalto/src/app/(employee)/documents/loading.tsx
- sistema-adalto/src/app/(employee)/documents/[documentId]/page.tsx
- sistema-adalto/vitest.config.ts
- sistema-adalto/__tests__/documents-status-mapping.test.ts
- sistema-adalto/__tests__/employee-documents-list.test.ts
- sistema-adalto/__tests__/employee-documents-api.test.ts
- sistema-adalto/__tests__/employee-documents-ui.test.tsx

### Change Log

- 2026-04-08: Story 2.1 implementada ponta a ponta (dominio de documentos, endpoint de listagem, UI de colaborador com filtros contextuais, acessibilidade e cobertura de testes), status alterado para review.

### Review Findings

- [x] [Review][Patch] Filter submissions drop tenant scope and break the list page flow [sistema-adalto/src/app/(employee)/documents/page.tsx:88] — resolved by making the list page session-scoped and removing the dependency on `tenant_id` in filter submissions.
- [x] [Review][Patch] Status chip renders icon names as literal text instead of icons [sistema-adalto/src/lib/documents/document-status-chip.tsx:30] — resolved by rendering real Material UI icon components in the chip.