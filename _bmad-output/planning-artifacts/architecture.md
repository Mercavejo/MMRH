---
stepsCompleted:
  - step-01-init
  - step-02-context
  - step-03-starter
  - step-04-decisions
  - step-05-patterns
  - step-06-structure
  - step-07-validation
  - step-08-complete
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-SISTEMA ADALTO.md
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-04-08'
project_name: 'SISTEMA ADALTO'
user_name: 'HIMMLER'
date: '2026-04-08'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
O produto exige dois eixos funcionais principais: experiência do colaborador para consulta/download de documentos e operação RH/DP para ingestão, validação, roteamento e publicação em lote. Arquiteturalmente, isso implica separação clara entre camadas de portal, operações administrativas e pipeline de processamento. Também há requisitos explícitos para reprocessamento seletivo, tratamento de exceções, gestão de planos por tenant e integração externa, indicando necessidade de serviços modulares com fronteiras bem definidas.

**Non-Functional Requirements:**
Os NFRs impõem direções arquiteturais fortes: segurança (TLS + dados em repouso, RBAC, auditoria imutável), confiabilidade (retomada sem duplicação, RTO/RPO), desempenho (consultas rápidas, início de download, lote de alta volumetria), escalabilidade (crescimento 10x, isolamento entre tenants) e acessibilidade (WCAG 2.1 AA). Esses requisitos pedem arquitetura orientada a eventos para lote, observabilidade estruturada e governança de dados por tenant.

**Scale & Complexity:**
A escala operacional de lotes mensais com milhares de documentos, combinada com segregação multi-tenant e compliance, coloca o projeto em nível de complexidade médio-alto.

- Primary domain: full-stack web SaaS com backend de processamento assíncrono
- Complexity level: medium-high
- Estimated architectural components: 10-14 componentes lógicos principais

### Technical Constraints & Dependencies

Restrições técnicas relevantes incluem segregação estrita por tenant e colaborador, idempotência em ingestão/reprocessamento, contratos de integração versionados, criptografia em trânsito e repouso, e trilha auditável de ações críticas. Há dependência futura de integrações com sistemas externos de folha e ponto por API ou SFTP. A UX definida também impõe consistência de estados e feedback em tempo operacional (processando, pendente, erro, publicado), o que depende de uma camada robusta de status e eventos.

### Cross-Cutting Concerns Identified

Os principais concerns transversais são:
- identidade e acesso (autenticação, autorização e segregação multi-tenant),
- segurança e privacidade (LGPD, minimização, retenção/descarte),
- auditoria e rastreabilidade de eventos sensíveis,
- observabilidade de pipeline e diagnóstico operacional,
- resiliência com reprocessamento seguro e idempotente,
- acessibilidade e consistência de interface entre portal e painel RH.

## Starter Template Evaluation

### Primary Technology Domain

Aplicação web full-stack SaaS B2B baseada em Next.js App Router, com backend integrado via Route Handlers e Server Actions.

### Starter Options Considered

1. create-next-app padrão: maior controle arquitetural e melhor aderência para auth própria no MVP.
2. with-supabase: acelera integração com Supabase, porém já vem orientado para Supabase Auth.
3. create-t3-app: excelente DX e typesafety full-stack, mas adiciona mais decisões iniciais do que o necessário para o primeiro ciclo.

### Selected Starter: create-next-app padrão

**Rationale for Selection:**
Escolha alinhada ao equilíbrio entre velocidade de início, controle técnico e menor acoplamento em autenticação. Mantém compatibilidade total com Supabase como banco e deploy em Vercel, sem forçar provedor de auth externo no MVP.

**Initialization Command:**

```bash
npx create-next-app@latest sistema-adalto --ts --tailwind --eslint --app --src-dir --import-alias @/* --use-npm
```

**Architectural Decisions Provided by Starter:**

**Language and Runtime:**
- TypeScript nativo
- Next.js App Router

**Styling Solution:**
- Tailwind CSS pré-configurado
- Base adequada para aplicação de tokens e padrões de design definidos no UX

**Build Tooling:**
- Toolchain oficial do Next.js
- Fluxo otimizado para deploy em Vercel

**Testing Framework:**
- Não impõe framework de testes
- Permite definir estratégia de testes incremental aderente aos NFRs

**Code Organization:**
- Estrutura em src com App Router
- Convenções oficiais para rotas, layouts e handlers

**Development Experience:**
- ESLint configurado
- DX moderna com recarga rápida, tipagem e convenções consistentes

**Note:** A inicialização do projeto com este comando deve ser tratada como a primeira história de implementação. Em seguida, configurar integração Supabase SSR e autenticação própria com sessões seguras, RBAC e trilha de auditoria.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- ORM e migrações: Drizzle ORM + drizzle-kit
- Modelo de autenticação/autorização: sessão em cookie HttpOnly + tabela de sessões + RBAC no banco
- Padrão de API: REST via Route Handlers + Server Actions
- Infra inicial: Vercel com deploy baseado em Git, ambientes Preview e Production
- Estratégia de cache: Redis (Upstash) já no MVP

**Important Decisions (Shape Architecture):**
- Frontend state: server-first (RSC) + estado local, sem store global no MVP
- Validação de entrada: Zod no boundary de Server Actions/Route Handlers
- Estratégia de observabilidade: logs estruturados e trilha de auditoria por correlation_id e tenant_id

**Deferred Decisions (Post-MVP):**
- GraphQL/tRPC (não necessário no MVP)
- Store global (Zustand/Redux) apenas se surgirem fluxos com forte estado compartilhado
- Camada avançada de API gateway/rate limit externo (pode evoluir após baseline operacional)

### Data Architecture

- **Banco de dados:** Supabase Postgres (gerenciado), multi-tenant lógico com escopo obrigatório por tenant_id em todas as entidades de domínio.
- **ORM:** drizzle-orm 0.45.2 (verificado)
- **Migrações:** drizzle-kit 0.31.10 (verificado), migração versionada em repositório e aplicada por pipeline.
- **Validação de dados de entrada:** zod 4.3.6 (verificado) no servidor.
- **Caching:** Redis via @upstash/redis 1.37.0 (verificado), com uso inicial para:
  - cache de consultas de leitura de alto tráfego
  - throttling/rate-limit operacional
  - dados efêmeros de sessão auxiliar (não substitui tabela de sessão principal)
- **Rationale:** combina tipagem forte, baixo acoplamento e performance para picos de fechamento mensal.

### Authentication & Security

- **Auth method:** autenticação própria no MVP (credenciais), sem depender de provedor externo.
- **Session model:** cookie HttpOnly, Secure, SameSite=Lax, com rotação e expiração controlada + persistência em tabela de sessões.
- **Authorization pattern:** RBAC no banco (roles por tenant e escopo funcional: colaborador, RH/DP operador, gestor cliente com acesso funcional simplificado, suporte interno e admin plataforma com observabilidade privilegiada).
- **Token/session hardening:** hash de segredo, invalidação server-side por sessão, trilha de login/logout/refresh.
- **Data protection:** TLS em trânsito, criptografia em repouso nos recursos gerenciados, política de mínimo privilégio.
- **Supabase SSR package (quando aplicável):** @supabase/ssr 0.10.0 (verificado) para integração SSR segura.
- **Rationale:** atende LGPD, auditoria e segregação estrita exigidas nos NFRs.

### API & Communication Patterns

- **Primary API pattern:** REST com Route Handlers + Server Actions para mutações próximas da UI.
- **Error handling standard:** envelope padronizado com code, message, details, correlation_id.
- **Idempotência:** obrigatória em endpoints de ingestão/reprocessamento de lote.
- **Versionamento:** prefixo /api/v1 para contratos estáveis.
- **Rate limiting:** Redis (Upstash) por tenant + usuário + rota crítica.
- **Rationale:** simplicidade operacional, boa aderência ao App Router e menor custo cognitivo no MVP.

### Frontend Architecture

- **Rendering strategy:** server-first com React Server Components.
- **State management:** estado local de componente e estado de formulário; sem store global inicialmente.
- **Data fetching:** server-side para dados sensíveis e críticos; cliente apenas para interações incrementais.
- **Component architecture:** design system já definido em MUI themeable + componentes de domínio.
- **Performance:** uso de cache/revalidate por contexto, segmentação de páginas e carregamento progressivo.
- **Rationale:** maximiza segurança e previsibilidade, reduzindo complexidade prematura.

### Infrastructure & Deployment

- **Hosting:** Vercel (Git-based deployments), com Preview para validação e Production para release.
- **Environments:** Local, Preview, Production com variáveis segregadas por ambiente.
- **CI/CD baseline:** pipeline orientado a PR com build, lint, testes e promoção por merge.
- **Observability:** logs centralizados, métricas de erro/latência e rastreio de jobs de lote.
- **Scaling strategy:** scale horizontal no app + serviços gerenciados (Supabase + Upstash), mantendo isolamento por tenant.
- **Rationale:** alinhado à stack escolhida, acelera entrega com governança mínima necessária.

### Decision Impact Analysis

**Implementation Sequence:**
1. Bootstrap do projeto Next.js e estrutura base
2. Configuração de banco, Drizzle e migrações iniciais
3. Implementação de autenticação própria + sessões + RBAC
4. Definição dos contratos REST e padrão de erros
5. Pipeline de ingestão e publicação em lote com idempotência
6. Camada de cache/rate-limit com Redis (Upstash)
7. Observabilidade e auditoria fim-a-fim
8. Hardening de segurança e testes de carga dos fluxos críticos

**Cross-Component Dependencies:**
- Sessão/RBAC impacta diretamente API, frontend e auditoria.
- Modelo de dados (Drizzle) impacta ingestão em lote, portal do colaborador e dashboard RH.
- Redis influencia desempenho de consultas, limites de API e estabilidade em picos.
- Estratégia de deploy/ambientes impacta gestão de segredos e segurança operacional.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
5 áreas-chave onde agentes poderiam divergir sem regras explícitas.

### Naming Patterns

**Database Naming Conventions:**
- Tabelas e colunas em snake_case
- Chaves estrangeiras em formato entidade_id
- Índices no padrão idx_tabela_coluna

**API Naming Conventions:**
- Endpoints REST em plural e kebab-case
- Prefixo versionado obrigatório: /api/v1
- Parâmetros de rota textuais em kebab-case; ids numéricos/uuid no campo id

**Code Naming Conventions:**
- Arquivos e pastas em kebab-case
- Tipos/interfaces/classes em PascalCase
- Funções/variáveis em camelCase
- Constantes globais em UPPER_SNAKE_CASE

### Structure Patterns

**Project Organization:**
- Testes unitários e integração em pasta central __tests__
- Organização de código por domínio funcional (feature-first)
- Shared utilities apenas quando reutilizadas por 2 ou mais domínios

**File Structure Patterns:**
- Contratos de API, schemas e mapeadores próximos ao domínio
- Migrations em pasta dedicada e versionada
- Arquivos de configuração em raiz técnica padronizada

### Format Patterns

**API Response Formats:**
- Envelope padrão obrigatório: { data, error, meta }
- Sucesso: data preenchido, error nulo, meta opcional
- Falha: data nulo, error preenchido, meta opcional
- Estrutura de erro padrão: code, message, details, correlation_id

**Data Exchange Formats:**
- Wire format em snake_case
- Datas em ISO 8601 UTC
- Booleanos nativos true/false
- Null explícito para ausência de valor

### Communication Patterns

**Event System Patterns:**
- Nome de evento no padrão domain.entity.action.v1
- Exemplo: payroll.document.published.v1
- Payload com: event_name, event_version, occurred_at, correlation_id, tenant_id, actor, payload

**State Management Patterns:**
- Estratégia server-first com RSC
- Estado local por tela/componente quando possível
- Sem store global no MVP
- Atualizações de estado sempre imutáveis

### Process Patterns

**Error Handling Patterns:**
- Exceções de domínio convertidas para erro de contrato padronizado
- Distinção explícita entre erro de usuário (4xx) e erro interno (5xx)
- Logs técnicos com correlation_id e tenant_id em falhas relevantes

**Loading State Patterns:**
- Nomes padronizados: isLoading, isSubmitting, isRefreshing
- Loading local por ação, evitando bloqueio global da UI
- Estados assíncronos críticos sempre com feedback visual e fallback de erro

### Enforcement Guidelines

**All AI Agents MUST:**
- Respeitar naming conventions de banco, API e código
- Usar envelope de resposta padrão em todos os endpoints
- Emitir logs e eventos com correlation_id e tenant_id quando aplicável
- Versionar eventos com sufixo .vN
- Manter wire format em snake_case para integração externa

**Pattern Enforcement:**
- Checklist em PR para convenções de naming, API format e eventos
- Lint e validação de contrato em pipeline
- Violação de padrão documentada no PR com justificativa e plano de ajuste

### Pattern Examples

**Good Examples:**
- Endpoint: /api/v1/payroll-documents
- Evento: payroll.document.published.v1
- Resposta de sucesso:
  - data: { document_id, status }
  - error: null
  - meta: { correlation_id, timestamp }

**Anti-Patterns:**
- Endpoint singular sem versionamento
- Mistura de camelCase e snake_case no mesmo payload externo
- Erro sem code ou sem correlation_id
- Evento sem versão explícita

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
sistema-adalto/
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── drizzle.config.ts
├── .env.example
├── .env.local
├── .gitignore
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── adr/
│   ├── api/
│   └── runbooks/
├── public/
│   └── assets/
│       ├── icons/
│       └── images/
├── drizzle/
│   ├── migrations/
│   └── seeds/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── recuperar-acesso/
│   │   │       └── page.tsx
│   │   ├── (employee)/
│   │   │   └── documentos/
│   │   │       ├── page.tsx
│   │   │       └── [document-id]/
│   │   │           └── page.tsx
│   │   ├── (rh)/
│   │   │   ├── lotes/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [batch-id]/
│   │   │   │       └── page.tsx
│   │   │   ├── excecoes/
│   │   │   │   └── page.tsx
│   │   │   ├── auditoria/
│   │   │   │   └── page.tsx
│   │   │   └── indicadores/
│   │   │       └── page.tsx
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── auth/
│   │   │       │   ├── login/route.ts
│   │   │       │   ├── logout/route.ts
│   │   │       │   └── refresh/route.ts
│   │   │       ├── employees/
│   │   │       │   ├── route.ts
│   │   │       │   └── [employee-id]/route.ts
│   │   │       ├── payroll-documents/
│   │   │       │   ├── route.ts
│   │   │       │   └── [document-id]/route.ts
│   │   │       ├── timecards/
│   │   │       │   ├── route.ts
│   │   │       │   └── [timecard-id]/route.ts
│   │   │       ├── batches/
│   │   │       │   ├── route.ts
│   │   │       │   ├── [batch-id]/route.ts
│   │   │       │   ├── [batch-id]/publish/route.ts
│   │   │       │   └── [batch-id]/reprocess/route.ts
│   │   │       ├── exceptions/
│   │   │       │   ├── route.ts
│   │   │       │   └── [exception-id]/resolve/route.ts
│   │   │       ├── audit-events/route.ts
│   │   │       └── webhooks/integrations/route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── not-found.tsx
│   │   └── error.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── auth/
│   │   ├── documents/
│   │   ├── batches/
│   │   ├── exceptions/
│   │   ├── audit/
│   │   └── shared/
│   ├── modules/
│   │   ├── auth/{application,domain,infrastructure}/
│   │   ├── employees/{application,domain,infrastructure}/
│   │   ├── payroll-documents/{application,domain,infrastructure}/
│   │   ├── timecards/{application,domain,infrastructure}/
│   │   ├── batches/{application,domain,infrastructure}/
│   │   ├── exceptions/{application,domain,infrastructure}/
│   │   ├── audit/{application,domain,infrastructure}/
│   │   ├── plans/{application,domain,infrastructure}/
│   │   └── integrations/{application,domain,infrastructure}/
│   ├── lib/
│   │   ├── db/
│   │   │   ├── client.ts
│   │   │   ├── schema/
│   │   │   │   ├── auth/
│   │   │   │   ├── employees/
│   │   │   │   ├── payroll-documents/
│   │   │   │   ├── timecards/
│   │   │   │   ├── batches/
│   │   │   │   ├── exceptions/
│   │   │   │   ├── audit/
│   │   │   │   └── plans/
│   │   │   └── repositories/
│   │   ├── auth/
│   │   │   ├── session.ts
│   │   │   ├── cookies.ts
│   │   │   └── rbac.ts
│   │   ├── cache/
│   │   │   ├── redis-client.ts
│   │   │   └── keys.ts
│   │   ├── api/
│   │   │   ├── response.ts
│   │   │   ├── errors.ts
│   │   │   └── validation.ts
│   │   ├── events/
│   │   │   ├── publisher.ts
│   │   │   └── contracts/
│   │   ├── observability/
│   │   │   ├── logger.ts
│   │   │   └── correlation.ts
│   │   ├── config/
│   │   │   ├── env.ts
│   │   │   └── constants.ts
│   │   ├── mappers/
│   │   ├── utils/
│   │   └── types/
│   └── middleware.ts
└── __tests__/
  ├── unit/
  │   ├── modules/
  │   ├── lib/
  │   └── components/
  ├── integration/
  │   ├── api/
  │   ├── auth/
  │   ├── batches/
  │   └── documents/
  ├── e2e/
  │   ├── employee/
  │   └── rh/
  ├── fixtures/
  └── helpers/
```

### Architectural Boundaries

**API Boundaries:**
- Toda interface externa entra por src/app/api/v1
- Contrato obrigatório de resposta: { data, error, meta }
- Segurança central com autenticação de sessão e RBAC antes da lógica de domínio

**Component Boundaries:**
- UI em src/components não acessa banco diretamente
- Componentes chamam Server Actions ou rotas em src/app/api/v1
- Reuso visual isolado em components/ui e shared

**Service Boundaries:**
- Regras de negócio em src/modules/*/application e domain
- Infra de acesso em src/modules/*/infrastructure e src/lib
- Cada módulo mantém fronteira explícita para evitar acoplamento lateral

**Data Boundaries:**
- Schema e migrações via Drizzle em src/lib/db/schema e drizzle/migrations
- tenant_id e correlation_id obrigatórios em fluxos operacionais sensíveis
- Redis restrito a cache de leitura, limitação e dados efêmeros

### Requirements to Structure Mapping

**Feature Mapping:**
- Gestão de acesso e sessão: src/modules/auth, src/app/api/v1/auth
- Portal do colaborador (consulta/download): src/modules/payroll-documents, src/modules/timecards, rotas em (employee)
- Processamento em lote RH: src/modules/batches, src/modules/exceptions, rotas em (rh)/lotes e (rh)/excecoes
- Auditoria e rastreabilidade: src/modules/audit, src/app/api/v1/audit-events
- Planos por tenant: src/modules/plans
- Integrações externas: src/modules/integrations, src/app/api/v1/webhooks/integrations

**Cross-Cutting Concerns:**
- Autorização RBAC: src/lib/auth/rbac.ts
- Envelope de API e erros: src/lib/api/response.ts e src/lib/api/errors.ts
- Observabilidade: src/lib/observability
- Validação de entrada: src/lib/api/validation.ts

### Integration Points

**Internal Communication:**
- UI para backend via Route Handlers e Server Actions
- Módulos trocam dados por contratos de aplicação, sem acesso direto cruzado a tabelas
- Eventos internos no padrão domain.entity.action.v1 em src/lib/events/contracts

**External Integrations:**
- Supabase Postgres para persistência principal
- Upstash Redis para cache e rate limiting
- Webhooks/API/SFTP via módulo de integrações

**Data Flow:**
- Entrada: API ou Server Action
- Validação: Zod no boundary
- Autorização: sessão + RBAC
- Domínio: services de módulo
- Persistência: repositórios Drizzle
- Saída: envelope padrão com meta de rastreio

### File Organization Patterns

**Configuration Files:**
- Arquivos de build e lint na raiz
- Configs de domínio e env em src/lib/config
- Pipeline CI em .github/workflows/ci.yml

**Source Organization:**
- Feature-first em src/modules
- Camada de apresentação em src/app e src/components
- Bibliotecas transversais em src/lib

**Test Organization:**
- Estrutura central em __tests__
- Unit, integration e e2e segregados por tipo
- Fixtures e helpers compartilhados

**Asset Organization:**
- Estáticos em public/assets por categoria
- Sem ativos de domínio fora do padrão

### Development Workflow Integration

**Development Server Structure:**
- Rotas App Router segmentadas por contexto público, colaborador e RH
- Separação de áreas reduz conflitos entre agentes

**Build Process Structure:**
- Build usa fronteiras claras por módulo
- Lint e testes em pipeline com gates por PR

**Deployment Structure:**
- Vercel com ambientes Preview e Production
- Segredos por ambiente e isolamento de variáveis

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
- As decisões principais são compatíveis entre si: Next.js full-stack, Supabase Postgres, Drizzle, Redis Upstash, autenticação própria com sessão e RBAC.
- Não há conflito estrutural entre API REST versionada, App Router e boundaries por módulo.
- Versões escolhidas estão atuais e em manutenção ativa.

**Pattern Consistency:**
- Convenções de naming, formato de resposta, eventos e organização de código estão coerentes com a stack definida.
- O padrão snake_case no wire está alinhado com requisitos de integração e padronização de contratos.
- Regras de erro, logging e correlation_id fecham com os requisitos de auditoria.

**Structure Alignment:**
- A estrutura de projeto suporta as decisões de domínio, segurança e processamento em lote.
- Boundaries de módulo e de API estão claros para execução por múltiplos agentes sem conflito.
- Integrações internas e externas possuem pontos de entrada definidos.

### Requirements Coverage Validation ✅

**Epic and Feature Coverage:**
- Portal do colaborador, operação RH/DP, ingestão em lote, exceções, auditoria e integrações estão cobertos por componentes e módulos dedicados.
- Dependências entre fluxos (ex.: lote -> exceções -> publicação -> auditoria) estão representadas na estrutura.

**Functional Requirements Coverage:**
- Requisitos funcionais de autenticação, segregação por tenant, consulta/download, processamento e reprocessamento têm suporte arquitetural explícito.
- Contratos REST e envelope padrão cobrem leitura, comando operacional e integração.

**Non-Functional Requirements Coverage:**
- Segurança: sessão HttpOnly, RBAC, trilha de auditoria e segregação por tenant.
- Escalabilidade/performance: cache Redis, estrutura modular e separação de responsabilidades.
- Confiabilidade: idempotência prevista em ingestão/reprocesso e padrões de erro operacionais.
- Compliance: base para LGPD, rastreabilidade e governança de acesso.

### Implementation Readiness Validation ✅

**Decision Completeness:**
- Decisões críticas documentadas e com direções objetivas para implementação.
- Padrões suficientes para evitar divergência entre agentes.

**Structure Completeness:**
- Árvore de projeto completa para iniciar implementação sem ambiguidade.
- Boundaries técnicos e de domínio definidos.

**Pattern Completeness:**
- Padrões de naming, formato, comunicação e processo estão fechados.
- Regras de enforcement estabelecidas para PR e pipeline.

### Gap Analysis Results

**Critical Gaps:**
- Nenhum gap crítico identificado.

**Important Gaps:**
- Recomenda-se, na implementação, formalizar matriz de permissões RBAC por papel em documento operacional.
- Recomenda-se definir catálogo de códigos de erro de domínio antes de abrir múltiplas frentes de desenvolvimento.

**Nice-to-Have Gaps:**
- Guia curto de convenções para onboarding de novos agentes.
- Catálogo inicial de eventos de domínio com exemplos por contexto.

### Validation Issues Addressed

- Coerência entre autenticação própria e integração Supabase foi mantida: Supabase como plataforma de dados e infraestrutura, sem impor provider externo no MVP.
- Estrutura de testes centralizada foi preservada conforme decisão explícita.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Contexto e restrições analisados
- [x] Complexidade e concerns transversais mapeados

**✅ Architectural Decisions**
- [x] Decisões críticas especificadas
- [x] Stack e padrões de integração definidos

**✅ Implementation Patterns**
- [x] Convenções e formatos padronizados
- [x] Regras de consistência entre agentes documentadas

**✅ Project Structure**
- [x] Estrutura completa de diretórios definida
- [x] Boundaries e pontos de integração mapeados

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** high

**Key Strengths:**
- Alta consistência entre decisões, padrões e estrutura.
- Forte alinhamento com segurança, rastreabilidade e operação em lote.
- Boa base para execução paralela por agentes sem conflito.

**Areas for Future Enhancement:**
- Evoluir catálogo de eventos e códigos de erro.
- Refinar política de SLO/SLI por fluxo crítico no pós-MVP.

### Implementation Handoff

**AI Agent Guidelines:**
- Seguir estritamente decisões e padrões definidos.
- Respeitar boundaries de módulo, API e dados.
- Manter contrato de resposta e rastreabilidade em toda entrega.

**First Implementation Priority:**
- Inicializar base do projeto e estabelecer fundações de autenticação, modelo de dados e contratos de API antes da expansão de features.
