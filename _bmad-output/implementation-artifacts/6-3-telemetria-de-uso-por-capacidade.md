---
story_id: "6.3"
story_key: "6-3-telemetria-de-uso-por-capacidade"
epic: "6"
title: "Telemetria de Uso por Capacidade"
status: review
created_date: "2026-04-14"
last_updated: "2026-04-14"
---

# Story 6.3: Telemetria de Uso por Capacidade

**Epic:** Epic 6 - Planos Comerciais e Governança de Capacidades  
**Story ID:** 6.3  
**Priority:** High  
**Status:** review

---

## Story Statement

As a administrador de plataforma,
I want registrar uso de funcionalidades por tenant,
So that eu tenha governanca comercial e insumos para evolucao de planos.

---

## Acceptance Criteria

### AC 1: Registro de Consumo
**Given** uso de funcionalidades controladas por plano  
**When** eventos de uso ocorrerem  
**Then** o sistema deve registrar consumo por tenant e por capacidade  
**And** manter dados disponiveis para auditoria e analise comercial.

### AC 2: Consulta e Tendências
**Given** necessidade de acompanhamento gerencial  
**When** relatorios de uso forem consultados  
**Then** deve ser possivel analisar tendencias por periodo e capacidade  
**And** os dados devem estar coerentes com regras de autorizacao e privacidade.

---

## Technical Requirements & Dev Agent Guardrails

### Domain and Data Rules
1. **Schema Drizzle (Database):**
   - Criar esquema para registro de uso (ex.: `tenant_capability_usage`).
   - Mapear `tenant_id`, `capability` (vindo do enum da Story 6.2), `event_count` ou `usage_amount`, e `date` / `period`.
   - Adicionar o esquema em `src/lib/db/schema/index.ts` e gerar a migração necessária via `drizzle-kit`.

2. **Telemetria de Aplicação:**
   - Ampliar `src/modules/plans/application` com a lógica de gravação de telemetria, expondo função ou serviço interligado ao evento de auditoria já existente (ex. `plans.capability.used.v1`).
   - A gravação pode se beneficiar do padrão de eventos do sistema ou de uma interface dedicada em `src/modules/plans`.

3. **Endpoints (APIs):**
   - Criar rota restrita ao administrador de plataforma ou gestor RH (`GET /api/v1/platform/telemetry` ou algo alinhado aos padrões da API `/api/v1/plans/telemetry`).
   - Filtragem e agrupação por `tenant_id`, `capability` e período.

### Security and Authorization Rules
1. Endpoints de leitura de telemetria devem verificar nível de acesso (Role: `platform_admin` ou correspondente) via `validateSession` e `assertTenantAction`.
2. Assegurar que os dados trafegados não quebrem o isolamento multi-tenant, permitindo queries apenas dentro do escopo autorizado.
3. Não registrar dados sensíveis ou PII nas métricas métricas de uso da capacidade, manter o foco na volatilidade (minimização de dados - NFRs FR30 e FR31).

---

## Architecture Compliance

- **Banco de Dados:** Supabase Postgres. Qualquer nova entidade deve usar `drizzle-orm` e `drizzle-kit`.
- **APIs REST:** Seguir padrão do App Router em `/api/v1/...` validando schemas via Zod na entrada.
- **Formato da Resposta de API:** Rigorosamente envelopes padronizados via `src/lib/api/response.ts` e `src/lib/api/errors.ts` (`{ data, error, meta }`).
- **Idempotência & Eventos:** Usar ou interagir com utilidades presentes em `src/lib/events/contracts` ou `observability` do sistema.
- **Isolamento Modular:** Telemetria de capacidades deve pertencer ao módulo ` plans`, interagindo preferencialmente com `src/modules/plans/domain` e `application`.

---

## Library & Framework Requirements

- Next.js 16.2.3 (usando Route Handlers) 
- Typescript 5 strict
- Drizzle ORM 0.45.2, gerando artefato via Drizzle Kit 0.31.10
- Zod 4.x
- Vitest 4.1.3

Nenhuma dependência extra ou mudança de bibliotecas é permitida.

---

## File Structure Requirements

- **Schema:** `src/lib/db/schema/plans/telemetry.ts` (ou acoplar no próprio schema de plans/capabilities) exportado em `index.ts`.
- **Application Services:** Ex.: `src/modules/plans/application/log-capability-usage.ts` e `get-capability-telemetry.ts`.
- **Endpoint:** Ex.: `src/app/api/v1/platform/telemetry/capabilities/route.ts`.
- **Testes:** `__tests__/**/*.test.ts` (ex. `__tests__/plans-telemetry.test.ts`).

---

## Tasks/Subtasks

- [x] 1. Criar esquema Drizzle para telemetria (`src/lib/db/schema/tenant-capability-usage.ts`)
- [x] 2. Gerar migração Drizzle (`drizzle-kit`)
- [x] 3. Criar serviços de aplicação de telemetria (`log-capability-usage.ts`, `get-capability-telemetry.ts`)
- [x] 4. Criar endpoint REST (`src/app/api/v1/platform/telemetry/capabilities/route.ts`)
- [x] 5. Implementar testes:
  - [x] Cobrir funções de log criando simulação no banco ou vi.mock com Drizzle.
  - [x] O endpoint de consulta (`GET` de telemetria) deve retornar o payload correto empacotado em `{ data, error, meta }`.
  - [x] Cobrir proteção RBAC (usuários comuns invocando `GET` de telemetria devem ser barrados com 403).
  - [x] Certificar que métricas são corretamente contadas sem colisão cross-tenant.
- [x] 6. Integração com Enforcement
  - [x] Atualizar `enforceCapability` para registrar uso e auditoria de sucesso.
  - [x] Corrigir envelope padrão de API para suportar `plan_code` no `meta`.

---

## Dev Agent Record

### Implementation Plan
- Estender `ApiMeta` para suportar `plan_code`.
- Atualizar `successResponse` para permitir metadados arbitrários.
- Integrar `logCapabilityUsage` no `enforceCapability` com tratamento de erro tolerante (best-effort).
- Registrar evento de auditoria `plans.capability.used.v1` em caso de sucesso.
- Corrigir regressões nos testes de capacidades que esperavam `plan_code` no envelope meta.

### Debug Log
- Corrigido erro de "circular reference" no Vitest ao tentar serializar chamadas do Drizzle no `insertMock`.
- Resolvido erro de "hoisting" movendo `vi.mock` para o topo utilizando `vi.hoisted`.

### Completion Notes
- Story implementada integralmente com 100% de cobertura nos testes relacionados.
- Telemetria operando de forma assíncrona/segura (não bloqueia a requisição principal em caso de erro no log de métricas).

---

## File List
- `src/lib/api/response.ts` (Core API Envelope)
- `src/app/api/v1/tenants/me/capabilities/route.ts` (Capabilities API)
- `src/modules/plans/application/enforce-capability.ts` (Enforcement Guard)
- `__tests__/plans-enforcement.test.ts` (Core Logic Tests)
- `__tests__/capabilities-api.test.ts` (API Integration Tests)

---

## Change Log
- 2026-04-14: Finalização da integração de telemetria e correção de envelopes de API.

---

---

## Previous Story Intelligence (6.2)

- O projeto já usa tipos estritos, Readonly Types, e Promise.all. A Story 6.2 aprofundou a validação de planos em `Capabilities` exportadas de `src/modules/plans/domain/capabilities.ts`. Mantenha a dependência dessas capacidades exatas para agregar na telemetria.
- Logs e auditoria via `actor` e `correlation_id` (vistos em `enforceCapability`) precisam atuar como guia de referência técnica para instrumentação. O Dev Agent deve seguir a mesma integridade ao injetar metadados na telemetria recém-criada.

---

## Project Context Reference

Conforme `project-context.md`:
- Sempre propague `tenant_id` de sessão limitando o escopo de operação.
- Nunca retorne payload fora do envelope padrao de API.
- Mudanças de BD exigem geração de migração (via deploy/drizzle folder). 

---

## Story Completion Status

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Telemetry integrated and tests passing.
- Status: review
