# Story 1.3: Autorizacao RBAC por Perfil e Escopo de Tenant

Status: done

## Story

As a gestor de seguranca da plataforma,
I want controlar permissoes por perfil e tenant,
so that cada usuario execute apenas as acoes permitidas para sua funcao.

## Acceptance Criteria

1. Given usuarios com papeis colaborador, RH operador, gestor cliente, suporte e admin plataforma
When acessarem funcionalidades protegidas
Then o sistema deve autorizar ou negar a acao com base no papel e no tenant
And deve impedir qualquer leitura ou escrita fora do tenant do usuario.

2. Given alteracoes em papeis e politicas de acesso
When um administrador atualizar permissoes
Then o sistema deve manter trilha auditavel da alteracao
And deve permitir revisao periodica das permissoes vigentes.

## Tasks / Subtasks

- [x] Task 1 - Consolidar matriz RBAC centralizada (AC: 1, 2)
  - [x] Reutilizar o enum existente `user_tenant_mappings.role` como fonte unica dos papeis suportados.
  - [x] Implementar `src/lib/auth/rbac.ts` com a matriz de permissoes por papel, tenant e acao protegida.
  - [x] Expor helpers de decisao claros para leitura/escrita, bloqueio por tenant e validacao de escopo administrativo.

- [x] Task 2 - Aplicar autorizacao nos boundaries server-side (AC: 1)
  - [x] Proteger rotas e Server Actions que leem ou escrevem dados sensiveis com o helper central de RBAC.
  - [x] Garantir que toda consulta relevante valide `tenant_id` antes de acessar o banco ou montar resposta.
  - [x] Manter o proxy como guard apenas de sessao; a autorizacao por papel permanece no servidor de dominio/API.

- [x] Task 3 - Auditoria de mudancas e recusas de acesso (AC: 2)
  - [x] Registrar eventos auditaveis para mudancas de permissao, incluindo `correlation_id`, `tenant_id`, ator e resultado.
  - [x] Registrar recusas de acesso relevantes com motivo suficiente para revisao operacional e seguranca.
  - [x] Preparar leitura/listagem de permissoes vigentes por tenant para revisao periodica.

- [x] Task 4 - Testes e validacao final (AC: 1, 2)
  - [x] Criar testes unitarios para a matriz RBAC e para os helpers de autorizacao por papel/tenant.
  - [x] Criar testes para bloqueio de acesso fora do tenant e para recusas de papel insuficiente.
  - [x] Validar a suite completa com `npm run test:run`, `npm run lint` e `npm run build` sem regressao.

## Dev Notes

### Contexto do Epic

- Epic 1 entrega a base de seguranca e governanca multi-tenant para o produto inteiro.
- Esta story cobre principalmente FR3, FR5, FR6, FR8, FR34 e NFR7/NFR16 ao impor RBAC por tenant e escopo funcional.
- Os papeis previstos no produto sao: colaborador, RH/DP operador, gestor cliente, suporte interno e admin plataforma.

### Requisitos Tecnicos Obrigatorios

- Use a fonte de verdade ja existente em `src/lib/db/schema/user-tenant-mappings.ts`; nao crie nova tabela de papeis para este escopo.
- Mantenha a autorizacao no servidor, nao no cliente.
- Toda decisao de acesso sensivel deve considerar papel, tenant e acao, sempre com `correlation_id` e `tenant_id` quando houver auditoria.
- Qualquer mutacao ou leitura protegida deve falhar fechado por padrao se o escopo nao estiver inequívoco.

### Architecture Compliance (Must Follow)

- Seguir o boundary previsto em `src/lib/auth/rbac.ts` para centralizar a politica de autorizacao.
- Nao mover a regra de autorizacao para o proxy; o proxy em `src/proxy.ts` continua sendo apenas gate de sessao.
- Nao permitir leitura ou escrita cruzando tenants, mesmo para papeis elevados.
- Preservar o envelope de API `data/error/meta` e os padroes de observabilidade ja adotados.

### Library / Framework Requirements

- Reusar Next.js App Router, Route Handlers e Server Actions ja presentes no projeto.
- Reusar Drizzle para acesso ao banco e Zod somente se algum payload de atualizacao de permissao for introduzido.
- Reusar os helpers de autenticacao, resposta de API e auditoria ja existentes no projeto.

### File Structure Requirements

- `src/lib/auth/rbac.ts` para decisao e validacao de permissao.
- `src/app/api/v1/**` para aplicacao das verificacoes em boundaries de API.
- `src/modules/**` apenas quando houver regra de negocio de dominio que precise de autorizacao explicita.
- `__tests__/**` para cobertura unitaria e de integracao dos cenarios de autorizacao.

### Testing Requirements

- Cobrir a matriz de permissoes por papel com casos positivos e negativos.
- Cobrir tentativa de acesso entre tenants diferentes e qualquer escrita fora do tenant.
- Cobrir registro de auditoria para alteracao de permissao e para recusas relevantes.
- Reexecutar a suite completa antes de marcar a story como pronta para review.

### Previous Story Intelligence

- Story 1.2 ja estabeleceu sessao segura em cookie HttpOnly, trilha de auditoria e retorno de role no login.
- Reaproveitar o contexto de sessao existente e o campo `role` retornado pelo login; nao duplicar persistencia de perfil.
- O fluxo atual em `src/proxy.ts` bloqueia ausencia de sessao, mas nao substitui RBAC no servidor.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#L259-L270]
- [Source: _bmad-output/planning-artifacts/epics.md#L193-L221]
- [Source: _bmad-output/planning-artifacts/prd.md#L264-L280]
- [Source: _bmad-output/planning-artifacts/prd.md#L382-L389]
- [Source: _bmad-output/planning-artifacts/prd.md#L464-L479]
- [Source: _bmad-output/planning-artifacts/architecture.md#L116-L159]
- [Source: _bmad-output/planning-artifacts/architecture.md#L422-L493]
- [Source: _bmad-output/implementation-artifacts/1-2-autenticacao-com-sessao-segura-e-criptografia.md]

## Dev Agent Record

### Agent Model Used

GPT-5.4 mini

### Debug Log References

### Completion Notes List

- Story criada a partir da Epic 1, PRD, arquitetura e aprendizados da Story 1.2.
- RBAC centralizado em `src/lib/auth/rbac.ts` com matriz por papel e validacao por tenant.
- Helpers adicionados para decisao, review periodico de acessos e auditoria de mudancas/negativas.
- `src/lib/db/client.ts` foi tornado lazy para nao quebrar importacao/build quando `DATABASE_URL` nao estiver presente.
- Suite validada com sucesso apos a implementacao.
- Login passou a exigir tenant deterministico quando o usuario possui multiplas vinculacoes, evitando selecao arbitraria.
- Adicionada rota `src/app/api/v1/rbac/permissions/route.ts` para listagem de permissoes vigentes e atualizacao auditada por tenant.
- Novos testes cobrem login com tenant unico, login ambiguo, selecao explicita de tenant e manutencao/auditoria de permissoes por tenant.
- Revalidacao da story 1.3 executada com sucesso: `npm run test:run` (32/32), `npm run lint` e `npm run build` sem regressao.

### Change Log

- 2026-04-08: Implementado RBAC centralizado por papel e tenant, helpers de auditoria e snapshot de revisao, com testes unitarios e validacao de lint/build/test.
- 2026-04-08: Execucao da skill `bmad-dev-story` para story 1.3 com checklist de conclusao revalidado e status confirmado para review.
- 2026-04-08: Corrigida a selecao de tenant no login para evitar ambiguidade e adicionada rota de manutencao de permissoes com auditoria de alteracao.

### File List

- _bmad-output/implementation-artifacts/1-3-autorizacao-rbac-por-perfil-e-escopo-de-tenant.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- sistema-adalto/__tests__/auth-login.test.ts
- sistema-adalto/__tests__/rbac-permissions-api.test.ts
- sistema-adalto/__tests__/rbac.test.ts
- sistema-adalto/src/app/api/v1/auth/login/route.ts
- sistema-adalto/src/app/api/v1/rbac/permissions/route.ts
- sistema-adalto/src/lib/auth/rbac.ts
- sistema-adalto/src/lib/db/client.ts
