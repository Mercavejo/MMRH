---
project_name: 'SISTEMA ADALTO'
user_name: 'HIMMLER'
date: '2026-04-08'
sections_completed:
  - technology_stack
  - language_rules
  - framework_rules
  - testing_rules
  - quality_rules
  - workflow_rules
  - anti_patterns
existing_patterns_found: 18
status: 'complete'
rule_count: 12
optimized_for_llm: true
---

# Project Context for AI Agents

_Este arquivo registra regras criticas e padroes reais do projeto para evitar implementacoes inconsistentes por agentes de IA._

---

## Technology Stack & Versions

### Plataforma
- Next.js 16.2.3 (App Router)
- React 19.2.4
- TypeScript 5 (strict: true)
- Node runtime com alias `@/* -> ./src/*`

### UI
- MUI 9.0.0 (`@mui/material`, `@mui/icons-material`)
- Emotion (`@emotion/react` 11.14.0, `@emotion/styled` 11.14.1)
- Tailwind CSS 4 (`tailwindcss`, `@tailwindcss/postcss`)

### Backend e Dados
- PostgreSQL via `postgres` 3.4.9
- Drizzle ORM 0.45.2
- Drizzle Kit 0.31.10
- Redis via `@upstash/redis` 1.37.0
- Validacao com Zod 4.3.6
- Criptografia de senha com `bcryptjs` 3.0.3

### Qualidade
- ESLint 9 com `eslint-config-next` 16.2.3 (core-web-vitals + typescript)
- Vitest 4.1.3 com coverage V8 (`@vitest/coverage-v8` 4.1.3)
- Suite de testes em `__tests__/**/*.test.ts(x)`

## Critical Implementation Rules

### Language-Specific Rules

- TypeScript estrito e obrigatorio: manter tipagem explicita em boundaries de API, auth e DB; nao introduzir any implicito.
- Validacao de entrada sempre no boundary com Zod safeParse para body e query.
- Seguir naming atual: arquivos/pastas em kebab-case, simbolos TS em camelCase/PascalCase, schema SQL em snake_case.

### Framework-Specific Rules

- Endpoints devem permanecer em src/app/api/v1/**/route.ts; novas APIs fora de /api/v1 nao sao permitidas.
- Toda rota deve responder com envelope padrao { data, error, meta } incluindo correlation_id.
- Correlation ID no header x-correlation-id e obrigatorio; gerar UUID quando ausente e propagar em request/response.
- Proxy protege todas as rotas /api/v1 exceto auth e health; manter essa semantica ao adicionar novas rotas.

### Testing Rules

- Testes ficam em __tests__ com sufixo .test.ts ou .test.tsx (padrao Vitest do projeto).
- Novas rotas devem cobrir: sucesso, validacao invalida, sessao ausente/invalida e autorizacao negada quando aplicavel.
- Mock de dependencias externas por vi.mock; limpar estado entre casos com beforeEach.

### Code Quality & Style Rules

- Usar somente utilitarios centrais para erros e resposta (src/lib/api/errors.ts e src/lib/api/response.ts).
- Cliente de banco deve ser apenas o db central em src/lib/db/client.ts; proibido criar client paralelo por feature.
- Schemas Drizzle devem ser exportados via src/lib/db/schema/index.ts para manter fonte unica de verdade.

### Development Workflow Rules

- Mudancas de schema exigem ajuste no index de schema + geracao de migracao em drizzle/migrations.
- Para qualquer mudanca funcional, adicionar/atualizar testes na mesma entrega.
- Em regras de acesso, tenant_id de sessao deve sempre limitar o escopo de operacao.

### Critical Don't-Miss Rules

- Nunca persistir token de sessao em claro; armazenar apenas hash SHA-256 e invalidar sessao em expiracao/rotacao.
- Nunca permitir acesso cross-tenant; mismatch de tenant deve resultar em FORBIDDEN.
- Nunca fazer autorizacao ad-hoc em handler; usar assertTenantAction e RBAC_ACTIONS.
- Nunca retornar payload fora do envelope padrao de API.

---

## Usage Guidelines

### For AI Agents

- Leia este arquivo antes de implementar qualquer codigo.
- Siga todas as regras; em duvida, escolha a opcao mais restritiva.
- Se surgir novo padrao recorrente, atualize este documento.

### For Humans

- Mantenha o arquivo enxuto e focado em regras nao obvias para agentes.
- Atualize sempre que stack, auth, API, DB ou padrao de testes mudarem.
- Revise periodicamente para remover regras obsoletas.

Last Updated: 2026-04-08

### Tooling & CLI Rules
- **RTK (Rust Token Killer)**: O prefixo `rtk` é OBRIGATÓRIO em comandos de terminal (ex: `rtk git status`, `rtk ls`). Caso o comando `rtk` não funcione, utilize `wsl rtk`. Isso serve para otimizar e comprimir tokens de console (evita output inflado no LLM).
