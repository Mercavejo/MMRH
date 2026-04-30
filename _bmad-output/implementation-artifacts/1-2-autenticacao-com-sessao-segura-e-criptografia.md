# Story 1.2: Autenticacao com Sessao Segura e Criptografia

Status: done

## Story

As a colaborador autenticado,
I want entrar no sistema com sessao segura,
so that eu acesse meus recursos com confianca e protecao de dados sensiveis.

## Acceptance Criteria

1. Given um usuario com credenciais validas
When realizar login
Then o sistema deve emitir sessao segura com cookie HttpOnly e controles de expiracao por inatividade
And deve registrar evento auditavel de autenticacao com correlation_id e tenant_id.

2. Given operacoes com dados sensiveis de documentos e metadados
When dados trafegarem e forem armazenados
Then o sistema deve aplicar criptografia em transito e em repouso
And qualquer tentativa de acesso sem contexto de sessao valida deve ser bloqueada.

## Tasks / Subtasks

- [x] Task 1 - Fundacao de autenticacao segura (AC: 1, 2)
  - [x] Implementar hash e verificacao de senha com bcrypt (salted).
  - [x] Implementar gestao de sessao com token aleatorio, hash no banco e expiracao por inatividade.
  - [x] Definir cookie de sessao HttpOnly, SameSite e Secure por ambiente.

- [x] Task 2 - Endpoints de auth em /api/v1/auth (AC: 1)
  - [x] Implementar POST /api/v1/auth/login com validacao de credenciais, emissao de sessao e auditoria.
  - [x] Implementar POST /api/v1/auth/logout com invalidacao de sessao e limpeza de cookie.
  - [x] Implementar POST /api/v1/auth/refresh com renovacao de expiracao e rotacao de token.

- [x] Task 3 - Bloqueio de acesso sem sessao valida (AC: 2)
  - [x] Aplicar guard para rotas protegidas no proxy/middleware.
  - [x] Garantir retorno padronizado para nao autenticado nas APIs protegidas.

- [x] Task 4 - Testes e validacao final (AC: 1, 2)
  - [x] Criar testes unitarios para hash/verificacao de senha.
  - [x] Criar testes unitarios para envelope/cookie/sessao.
  - [x] Rodar test, lint e build sem regressao.

### Review Findings

- [x] [Review][Patch] Padronizar nome de eventos de auditoria no formato domain.entity.action.v1 [sistema-adalto/src/lib/auth/audit.ts:13]
- [x] [Review][Patch] Registrar falha auditavel para credencial invalida quando tenant for conhecido [sistema-adalto/src/app/api/v1/auth/login/route.ts:80]

## Dev Notes

### Contexto

- Story 1.1 foi concluida com base de schema: users, tenants, user_tenant_mappings, sessions, audit_logs.
- Reaproveitar obrigatoriamente: envelope API em src/lib/api/response.ts, correlation id em src/lib/observability/correlation-id.ts, schema sessions/audit_logs.

### Guardrails

- Nao usar auth provider externo para o MVP.
- Nao salvar token de sessao em texto puro no banco.
- Todas as respostas de API devem manter contrato { data, error, meta }.
- Rotas de auth devem permanecer sob /api/v1/auth.

### References

- Source: _bmad-output/planning-artifacts/epics.md (Story 1.2)
- Source: _bmad-output/planning-artifacts/architecture.md (auth, api envelope, project structure)
- Source: _bmad-output/implementation-artifacts/1-1-set-up-initial-project-from-starter-template.md (patterns ja implementados)

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Dev-story 1.2: npm install bcryptjs, npm run test:run, npm run lint, npm run build.

### Completion Notes List

- Hash de senha com bcryptjs implementado em utilitario dedicado.
- Sessao segura implementada com token aleatorio, hash SHA-256 no banco e expiracao por inatividade (30 min).
- Cookies de sessao aplicam HttpOnly, SameSite=Lax e Secure por ambiente.
- Endpoints criados: /api/v1/auth/login, /api/v1/auth/logout, /api/v1/auth/refresh.
- Login registra evento de auditoria com correlation_id e tenant_id; refresh/logout tambem auditam sucesso.
- Proxy atualizado para bloquear acessos em /api/v1 (exceto auth e health) sem cookie de sessao e retornar envelope padrao 401.
- Testes adicionados para senha e cookies/sessao; suite completa validada sem regressao.
- Validacao final executada com sucesso: npm run test:run, npm run lint, npm run build.
- Review patch aplicado: eventos de auth auditados com sufixo de versao v1.
- Review patch aplicado: tentativa de login com senha invalida agora registra evento de falha auditavel com correlation_id e tenant_id.
- Validacao pos-review executada com sucesso: npm run test:run, npm run lint, npm run build.

### File List

- _bmad-output/implementation-artifacts/1-2-autenticacao-com-sessao-segura-e-criptografia.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- sistema-adalto/package.json
- sistema-adalto/package-lock.json
- sistema-adalto/src/proxy.ts
- sistema-adalto/src/lib/auth/password.ts
- sistema-adalto/src/lib/auth/cookies.ts
- sistema-adalto/src/lib/auth/session.ts
- sistema-adalto/src/lib/auth/audit.ts
- sistema-adalto/src/app/api/v1/auth/login/route.ts
- sistema-adalto/src/app/api/v1/auth/logout/route.ts
- sistema-adalto/src/app/api/v1/auth/refresh/route.ts
- sistema-adalto/__tests__/password.test.ts
- sistema-adalto/__tests__/auth-cookies.test.ts
- sistema-adalto/__tests__/session-expiration.test.ts
