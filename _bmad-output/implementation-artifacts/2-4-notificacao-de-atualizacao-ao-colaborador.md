# Story 2.4: Notificacao de Atualizacao ao Colaborador

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a colaborador,
I want ser notificado quando houver atualizacao de documento ou solicitacao,
so that eu saiba quando retornar ao portal para concluir a acao.

## Acceptance Criteria

1. Given mudanca de status de documento ou contestacao
When o evento for registrado
Then o sistema deve gerar notificacao para o colaborador no canal definido para o MVP
And indicar claramente o status atualizado e a acao recomendada.

2. Given historico de notificacoes
When o colaborador consultar mensagens no portal
Then deve haver registro rastreavel por data e contexto
And o texto deve ser simples, sem jargao tecnico e com consistencia visual do produto.

## Tasks / Subtasks

- [x] Task 1 - Modelar dominio de notificacao e persistencia rastreavel por colaborador (AC: 1, 2)
  - [x] Criar schema de notificacoes com tenant_id, user_id, channel, event_type, context_type, context_id, status_from, status_to, recommended_action, message, created_at, read_at.
  - [x] Exportar schema novo no index central de schema e gerar migracao Drizzle versionada.
  - [x] Definir contrato de dominio para criar notificacao orientada a acao a partir de evento de documento/contestacao.

- [x] Task 2 - Implementar servico de geracao de notificacao no canal MVP (portal/in-app) (AC: 1)
  - [x] Criar servico reutilizavel para traduzir mudancas de status em mensagem simples com acao recomendada.
  - [x] Garantir derivacao de tenant e user por contexto validado (sem aceitar tenant_id vindo de payload nao confiavel).
  - [x] Registrar evento auditavel de criacao de notificacao com correlation_id, tenant_id, actor_id e notification_id.

- [x] Task 3 - Expor APIs de consulta e leitura de notificacoes do colaborador (AC: 2)
  - [x] Implementar GET /api/v1/employee/notifications para listar historico por data/contexto com envelope padrao.
  - [x] Implementar PATCH /api/v1/employee/notifications/[notificationId]/read para marcar leitura mantendo escopo tenant-bound.
  - [x] Aplicar sessao obrigatoria, RBAC colaborador e bloqueio cross-tenant em todas as operacoes.

- [x] Task 4 - Integrar UX de historico de notificacoes no portal com linguagem clara (AC: 1, 2)
  - [x] Adicionar area de notificacoes no portal do colaborador (lista cronologica com contexto e proxima acao).
  - [x] Exibir mensagens sem jargao tecnico para estados de documento/contestacao (ex.: publicado, em tratamento, resolvido, indisponivel).
  - [x] Manter consistencia visual com feedback patterns (estado, severidade e orientacao) e acessibilidade WCAG AA.

- [x] Task 5 - Cobertura completa de testes de dominio, API e UI (AC: 1, 2)
  - [x] Cobrir testes de dominio para geracao de mensagem por tipo de evento e status (incluindo acao recomendada).
  - [x] Cobrir testes de API: sucesso, sessao ausente, sessao invalida, role invalida, tenant mismatch, payload invalido e notificationId inexistente.
  - [x] Cobrir testes de UI para ordenacao por data, marcacao de leitura, mensagem clara e navegacao por teclado.
  - [x] Validar npm run test:run, npm run lint e npm run build sem regressao.

## Dev Notes

### Contexto do Epic

- Epic 2 trata autosservico documental do colaborador (FR10-FR15).
- Story 2.4 implementa diretamente FR15 e fecha o ciclo iniciado pela Story 2.3 (contestacao guiada).
- NFRs diretamente impactados: NFR7 (isolamento tenant/colaborador), NFR8 (auditoria), NFR18-NFR20 (acessibilidade e clareza de feedback).

### Story Foundation e Requisitos Tecnicos

- O canal do MVP para notificacao deve ser no proprio portal (in-app), conforme escopo MVP de notificacao basica no portal.
- Notificacao deve ser gerada quando houver mudanca relevante de status em documento ou contestacao.
- Mensagem deve conter: o que mudou, contexto (documento/contestacao), data/hora e proxima acao recomendada.
- Historico no portal deve ser rastreavel e ordenado por data, sem jargao tecnico.

### Architecture Compliance (Must Follow)

- Manter endpoints em src/app/api/v1/**/route.ts com envelope padrao { data, error, meta } e correlation_id.
- Reutilizar utilitarios centrais de erro/resposta e controles de sessao/RBAC existentes; proibido criar autorizacao ad-hoc.
- Usar apenas db central em src/lib/db/client.ts e exportar schema novo via src/lib/db/schema/index.ts.
- Aplicar escopo tenant-bound em toda leitura/escrita; mismatch deve resultar em FORBIDDEN.

### Library / Framework Requirements

- next 16.2.3 (Route Handlers App Router)
- react 19.2.4
- typescript 5 strict
- zod 4.3.6
- drizzle-orm 0.45.2 / drizzle-kit 0.31.10

### File Structure Requirements

- src/lib/db/schema/employee-notifications.ts (novo)
- src/lib/db/schema/index.ts (update export)
- drizzle/migrations/*_employee_notifications.sql (novo)
- src/lib/notifications/create-employee-notification.ts (novo)
- src/lib/notifications/message-mapping.ts (novo)
- src/app/api/v1/employee/notifications/route.ts (novo)
- src/app/api/v1/employee/notifications/[notificationId]/read/route.ts (novo)
- src/app/(employee)/documents/page.tsx (ajuste para entrada/atalho de notificacoes)
- src/app/(employee)/notifications/page.tsx (novo)
- __tests__/employee-notifications-domain.test.ts (novo)
- __tests__/employee-notifications-api.test.ts (novo)
- __tests__/employee-notifications-ui.test.tsx (novo)

### Testing Requirements

- Cobrir bloqueio cross-tenant em listagem e marcacao de leitura.
- Cobrir sessao invalida com cookie presente (regressao recorrente apontada em reviews anteriores).
- Cobrir idempotencia para evento repetido com mesma chave de negocio (nao duplicar notificacao).
- Cobrir mensagem orientativa para os principais status de documento e contestacao.
- Cobrir acessibilidade basica do historico (foco visivel, labels e mensagens nao dependentes de cor).

### Reuse and Anti-Reinvention Guardrails

- Reutilizar padroes de auditoria existentes em src/lib/auth/audit.ts e trilhas existentes em src/lib/documents/*-audit.ts.
- Reutilizar mapeamento de status e semantica ja consolidada em src/lib/documents/status-mapping.ts.
- Reutilizar padrao de listagem com filtros/contexto da Story 2.1 e fluxo de contestacao da Story 2.3.
- Nao criar novo cliente DB, novo formato de resposta, ou novo mecanismo paralelo de sessao/RBAC.

### Previous Story Intelligence (Story 2.3)

- Story 2.3 consolidou contestacao contextual com trilha de tratamento open -> in_progress -> resolved.
- O principal ganho para 2.4 e acoplar notificacao aos eventos ja existentes de documento e contestacao, sem recriar fluxo paralelo.
- A 2.3 reforcou tenant derivado de sessao e testes para sessao invalida com cookie presente; manter o mesmo hardening.
- A 2.3 estabeleceu mensagens orientativas por status no portal; 2.4 deve manter mesma linguagem e consistencia visual.

### Git Intelligence Summary

- c17bbdb: implementou download seguro com trilha de auditoria e base de UX de orientacao no portal.
- 7894beb e 6147d89: hardening de compliance pos-review, reforcando segregacao e postura de seguranca.
- 7b9b06e: fundacao de auth, RBAC, schema e testes ja consolidada para reuso na story 2.4.

### Latest Tech Information

- Next.js 16.2.3: Route Handlers usam Web Request/Response e suportam GET/POST/PATCH etc.; manter handlers assíncronos tipados.
- Next.js (v15+): params em rotas dinamicas sao Promise; aguardar params explicitamente em rotas com segmento dinamico.
- Zod 4 estavel: manter strict mode no TypeScript e validacao de boundary com parse/safeParse.
- Drizzle ORM: manter abordagem SQL-like com schema TS e migracoes versionadas; evitar frameworks paralelos de acesso a dados.

### Project Structure Notes

- Estrutura atual ja concentra APIs do colaborador em src/app/api/v1/employee/*.
- Dominio de documentos e contestacoes ja existe em src/lib/documents; notificacoes devem integrar por composicao, nao por duplicacao.
- A feature deve preservar consistencia entre lista de documentos e historico de notificacoes no portal do colaborador.

### References

- Source: _bmad-output/planning-artifacts/epics.md (Epic 2, Story 2.4)
- Source: _bmad-output/planning-artifacts/prd.md (FR15, jornada de contestacao e notificacao no portal)
- Source: _bmad-output/planning-artifacts/architecture.md (padroes API, structure boundaries, envelope e eventos)
- Source: _bmad-output/planning-artifacts/ux-design-specification.md (Jornada 2, Feedback Patterns, Accessibility Strategy)
- Source: _bmad-output/project-context.md (regras de envelope, correlation_id, RBAC e tenant scope)
- Source: _bmad-output/implementation-artifacts/2-3-contestacao-guiada-para-documento-ausente.md
- Source: sistema-adalto/src/app/api/v1/employee/documents/route.ts
- Source: sistema-adalto/src/app/api/v1/employee/documents/contestations/route.ts
- Source: sistema-adalto/src/lib/documents/status-mapping.ts
- Source: sistema-adalto/src/lib/documents/contestation-tracking.ts
- Source: sistema-adalto/src/lib/auth/session.ts
- Source: sistema-adalto/src/lib/auth/rbac.ts
- Source: sistema-adalto/src/lib/api/response.ts
- Source: sistema-adalto/src/lib/api/errors.ts

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- npm run test:run -- __tests__/employee-notifications-domain.test.ts
- npm run test:run
- npm run test:run -- __tests__/employee-notifications-domain.test.ts __tests__/employee-notifications-service.test.ts
- npm run test:run
- npm run test:run -- __tests__/employee-notifications-api.test.ts
- npm run test:run
- npm run test:run -- __tests__/employee-notifications-ui.test.tsx
- npm run test:run
- npm run test:run -- __tests__/employee-notifications-domain.test.ts __tests__/employee-notifications-api.test.ts __tests__/employee-notifications-ui.test.tsx
- npm run test:run
- npm run lint
- npm run build

### Completion Notes List

- Task 1 concluida: schema `employee_notifications` criado com enums e chave de deduplicacao por evento/contexto/status.
- Task 1 concluida: export central de schema atualizado e migracao `0004_brown_employee_notifications.sql` registrada no journal.
- Task 1 concluida: contrato de dominio `createEmployeeNotification` implementado com erro tipado e saida padronizada em snake_case.
- Task 2 concluida: mapeador de mensagens de notificacao implementado com linguagem simples e acao recomendada para documento/contestacao.
- Task 2 concluida: servico reutilizavel com derivacao de tenant/user via contexto validado e deduplicacao idempotente na persistencia.
- Task 2 concluida: auditoria de criacao de notificacao adicionada com correlation_id, tenant_id, actor_id e notification_id.
- Task 3 concluida: APIs GET/PATCH de notificacoes implementadas em /api/v1/employee/notifications com envelope padrao, sessao obrigatoria e RBAC colaborador.
- Task 3 concluida: camada de tracking de notificacoes criada com filtros por contexto/data e marcacao de leitura tenant-bound.
- Task 4 concluida: pagina do portal /notifications criada com historico cronologico, contexto, orientacao de acao e estado vazio consistente.
- Task 4 concluida: atalho de navegacao para historico de notificacoes integrado em Meus Documentos com linguagem simples e acessivel.
- Task 5 concluida: cobertura de dominio, API e UI de notificacoes consolidada com testes dedicados e regressao total verde (95/95).
- Task 5 concluida: validacoes finais executadas com lint sem erros (apenas 2 warnings preexistentes em compliance/minimization) e build de producao aprovado.
- Ajuste final aplicado no CTA de leitura para acionar a rota PATCH via componente cliente, preservando a renderizacao SSR da pagina e a navegacao acessivel.

### File List

- _bmad-output/implementation-artifacts/2-4-notificacao-de-atualizacao-ao-colaborador.md
- sistema-adalto/__tests__/employee-notifications-domain.test.ts
- sistema-adalto/src/lib/db/schema/employee-notifications.ts
- sistema-adalto/src/lib/db/schema/index.ts
- sistema-adalto/src/lib/notifications/create-employee-notification.ts
- sistema-adalto/src/lib/notifications/message-mapping.ts
- sistema-adalto/src/lib/notifications/notification-audit.ts
- sistema-adalto/src/lib/notifications/employee-notification-tracking.ts
- sistema-adalto/drizzle/migrations/0004_brown_employee_notifications.sql
- sistema-adalto/drizzle/migrations/meta/_journal.json
- sistema-adalto/__tests__/employee-notifications-service.test.ts
- sistema-adalto/__tests__/employee-notifications-api.test.ts
- sistema-adalto/src/app/api/v1/employee/notifications/route.ts
- sistema-adalto/src/app/api/v1/employee/notifications/[notificationId]/read/route.ts
- sistema-adalto/src/app/(employee)/notifications/page.tsx
- sistema-adalto/src/app/(employee)/notifications/notification-read-button.tsx
- sistema-adalto/src/app/(employee)/documents/page.tsx
- sistema-adalto/__tests__/employee-notifications-ui.test.tsx

### Story Completion Status

- Story implementada ponta a ponta com ACs atendidos, testes e validacoes finais concluidas; pronta para entrega.
