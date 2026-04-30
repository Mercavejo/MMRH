---
story_id: "6.1"
story_key: "6-1-cadastro-e-atribuicao-de-plano-por-tenant"
epic: "6"
title: "Cadastro e Atribuicao de Plano por Tenant"
status: "done"
created_date: "2026-04-13"
last_updated: "2026-04-14"
---

# Story 6.1: Cadastro e Atribuicao de Plano por Tenant

**Epic:** Epic 6 - Planos Comerciais e Governanca de Capacidades  
**Story ID:** 6.1  
**Priority:** High  
**Status:** done

---

## Story Statement

As a administrador de plataforma,
I want criar e atribuir planos comerciais para tenants,
So that cada cliente tenha acesso ao pacote contratado.

---

## Acceptance Criteria

### AC 1: Atribuicao e atualizacao de plano com historico auditavel

**Given** planos comerciais definidos na plataforma  
**When** um tenant for configurado ou alterado  
**Then** o sistema deve permitir atribuicao e atualizacao do plano ativo  
**And** registrar historico auditavel de mudanca de plano.

### AC 2: Consulta clara do plano vigente e vigencia

**Given** consulta de configuracao comercial  
**When** admins visualizarem dados de tenant  
**Then** o plano vigente deve estar claro com data de vigencia  
**And** refletir imediatamente nas regras de capacidade.

---

## Dependencies and Scope

### Dependencias

- Epic 1 concluido: autenticacao, RBAC e escopo multi-tenant estao prontos e devem ser reutilizados.
- Epic 4 concluido: trilha de auditoria por correlation_id/tenant_id ja esta consolidada.
- Epic 5 concluido: padrao de rastreabilidade e persistencia tenant-bound esta estabelecido.
- PRD FR39-FR42 definem a base funcional de planos, enforcement e telemetria; esta historia inicia o epic pelo cadastro/atribuicao.

### Fora de Escopo

- Enforcement de bloqueio de capacidades no runtime de features (Story 6.2).
- Telemetria agregada de uso por capacidade (Story 6.3).
- Interface de billing, cobranca, pagamento ou integracao financeira externa.
- Migracao retroativa de historico legado fora do tenant corrente.

---

## Technical Requirements

### Domain and Data Rules

1. Introduzir um modulo dedicado `src/modules/plans` para encapsular regras de plano por tenant.
2. Modelar entidades minimas:
   - catalogo de planos comerciais (ex.: base/professional/enterprise)
   - atribuicao vigente por tenant (somente uma ativa por tenant)
   - historico de mudancas de plano por tenant
3. Toda atribuicao/alteracao deve persistir:
   - `tenant_id`
   - `plan_code` (ou `plan_id`)
   - `effective_from`
   - `effective_to` (nullable para plano ativo)
   - `changed_by`
   - `changed_at`
   - `correlation_id`
4. Garantir unicidade de plano ativo por tenant (`effective_to is null`) no nivel de schema/indice.
5. Atualizacao de plano deve encerrar vigencia anterior de forma atomica e abrir nova vigencia sem janelas ambiguas.

### API and Contract Requirements

1. Expor endpoints em `src/app/api/v1/**/route.ts` para:
   - criar/manter catalogo de planos (escopo plataforma)
   - atribuir/atualizar plano ativo de tenant
   - consultar plano vigente e historico resumido
2. Toda resposta deve usar envelope padrao `{ data, error, meta }` com `correlation_id`.
3. Validar entrada no boundary com Zod `safeParse` e erros padronizados (`src/lib/api/errors.ts`).
4. Operacoes de escrita devem ser idempotentes por chave de negocio para evitar historico duplicado em retries.

### Security and Authorization Rules

1. Somente perfil autorizado de plataforma pode criar/alterar plano de tenant.
2. Operacoes devem usar `validateSession`, `assertTenantAction` e `RBAC_ACTIONS`; proibido auth ad-hoc.
3. Nunca permitir cross-tenant leakage em consulta de configuracao comercial.
4. Registrar evento de auditoria para cada criacao de plano, atribuicao e atualizacao.

### Capability Reflection Rules

1. Mudanca de plano deve ser refletida imediatamente na leitura de capacidades do tenant.
2. Story 6.1 deve disponibilizar ponto de consulta de plano vigente consumivel por 6.2 (enforcement).
3. Nao duplicar tabela/regra de feature flag fora do modulo plans; criar contrato de leitura unico.

---

## Architecture Compliance Notes

### Regras Obrigatorias

- Endpoints somente em `src/app/api/v1/**/route.ts`.
- Banco apenas via `src/lib/db/client.ts`.
- Schemas novos exportados por `src/lib/db/schema/index.ts`.
- Mudanca de schema exige migracao em `drizzle/migrations`.
- Resposta e erro obrigatoriamente via `src/lib/api/response.ts` e `src/lib/api/errors.ts`.
- Correlation ID obrigatorio em request/response (`x-correlation-id`).

### Estrutura de Codigo Alvo

- `src/modules/plans/domain/*`
- `src/modules/plans/application/*`
- `src/modules/plans/infrastructure/*`
- `src/app/api/v1/platform/plans/route.ts`
- `src/app/api/v1/platform/tenants/[tenant-id]/plan/route.ts`
- `src/lib/db/schema/plans.ts`
- `src/lib/db/schema/tenant-plan-assignments.ts`
- `src/lib/db/schema/tenant-plan-assignment-history.ts`
- `src/lib/db/schema/index.ts`
- `drizzle/migrations/*plans*`
- `__tests__/plans-api.test.ts`
- `__tests__/plans-domain.test.ts`
- `__tests__/tenant-plan-assignments.test.ts`

### Reuso Obrigatorio (Nao Reinventar)

1. Reusar padrao tenant-bound, correlation_id e audit trail dos modulos existentes.
2. Reusar utilitarios centrais de API para envelope e erros.
3. Reusar padrao de testes Vitest com `vi.mock` e `beforeEach` para limpar estado.
4. Reusar semantica de controle de acesso baseada em RBAC ja adotada no projeto.

---

## Library and Framework Requirements

- Next.js 16.2.3 (App Router + Route Handlers)
- React 19.2.x
- TypeScript 5 strict
- Drizzle ORM 0.45.2 + Drizzle Kit 0.31.10
- Zod 4.x no boundary
- Vitest 4.1.x para testes automatizados

Sem novas dependencias obrigatorias para esta story.

---

## File Structure Requirements

- Todo codigo de plano deve ficar em `src/modules/plans`.
- Nao criar clients paralelos de banco nem bypass de schema central.
- Contrato de leitura de plano vigente deve ser unico e reutilizavel por 6.2 e 6.3.
- Historico de mudanca deve ser append-only para manter trilha auditavel confiavel.

---

## Implementation Tasks / Subtasks

- [x] T1 - Modelar catalogo de planos e atribuicao vigente por tenant (AC: 1)
  - [x] Criar schemas Drizzle para planos, atribuicao vigente e historico de alteracoes.
  - [x] Adicionar constraints de unicidade de plano ativo por tenant.
  - [x] Gerar migracao e exportar schemas no index central.

- [x] T2 - Implementar regras de dominio e casos de uso de atribuicao (AC: 1)
  - [x] Implementar casos de uso para criar plano, atribuir plano e atualizar plano ativo.
  - [x] Garantir transicao atomica de vigencia (encerra antigo e ativa novo).
  - [x] Registrar auditoria com actor, correlation_id e timestamps.

- [x] T3 - Expor API de administracao comercial (AC: 1, 2)
  - [x] Criar endpoints de catalogo de planos e atribuicao por tenant em /api/v1.
  - [x] Validar payloads com Zod e devolver envelope padrao.
  - [x] Aplicar RBAC de plataforma e bloquear acessos nao autorizados.

- [x] T4 - Expor consulta de plano vigente e vigencia (AC: 2)
  - [x] Disponibilizar endpoint/servico para leitura de plano ativo por tenant.
  - [x] Incluir data de vigencia e dados minimos para consumo por enforcement (6.2).
  - [x] Garantir resposta imediata apos atualizacao de plano.

- [x] T5 - Cobertura de testes obrigatoria e regressao (AC: 1, 2)
  - [x] Dominio: troca de plano encerra vigencia anterior e preserva historico.
  - [x] API: atribuicao valida retorna plano vigente com vigencia no envelope padrao.
  - [x] API: acesso sem permissao retorna 403 com erro padronizado.
  - [x] Regressao: impedir mais de um plano ativo por tenant.
  - [x] Regressao: garantir isolamento tenant-bound em leitura/escrita.

---

## Testing Requirements Summary

Cobertura minima obrigatoria em `__tests__/**/*.test.ts(x)`:

1. Criacao de plano comercial valida persiste catalogo com dados esperados.
2. Atribuicao inicial de plano cria vigencia ativa e historico auditavel.
3. Atualizacao de plano fecha vigencia anterior e ativa nova sem sobreposicao.
4. Consulta administrativa retorna plano vigente com `effective_from` claro.
5. Acesso sem papel autorizado retorna `403`.
6. Tenant mismatch ou acesso cruzado retorna `FORBIDDEN`.
7. Retry idempotente nao duplica historico de mudanca.
8. Dependencias externas mockadas via `vi.mock` com limpeza em `beforeEach`.

---

## Git Intelligence Summary

Commits recentes relevantes:

1. `1577a61` reforca hardening e padrao de seguranca em boundaries de API.
2. `798a4a3` consolida validacao de contrato no intake com foco em erros rastreaveis.
3. `43bab3b` consolida auditoria/alertas/indicadores e padrao operacional.
4. `01baec7` estabelece base de integracoes e monitoramento tenant-bound.
5. `b31b68c` reforca idempotencia e auditoria em fluxos de reprocessamento.

Aplicacao para 6.1: manter tenant-bound rigoroso, rastreabilidade completa e semantica de erro consistente.

---

## Latest Tech Information

- A stack alvo do projeto permanece estavel e documentada em arquitetura e contexto de projeto.
- Nao ha necessidade de troca de framework/lib para esta story; foco em aderencia aos padroes ja adotados.
- O principal risco tecnico e consistencia transacional na troca de plano ativo; priorizar constraints + testes de regressao.

---

## Project Structure Notes

- O modulo `src/modules/plans` ainda nao existe no codigo atual e deve ser introduzido com fronteiras claras de domain/application/infrastructure.
- Evitar espalhar regras de plano em modulos nao relacionados (auth, batches, integrations).
- Preparar contratos de leitura para consumo direto por 6.2 (enforcement) e 6.3 (telemetria), sem acoplamento circular.

---

## References

- Source: `_bmad-output/planning-artifacts/epics.md` (Epic 6; Story 6.1)
- Source: `_bmad-output/planning-artifacts/prd.md` (FR39, FR40, FR41, FR42; NFR7; NFR16)
- Source: `_bmad-output/planning-artifacts/architecture.md` (tenant-bound, envelope API, /api/v1, correlation_id, trilha auditavel)
- Source: `_bmad-output/planning-artifacts/ux-design-specification.md` (clareza de status e feedback objetivo)
- Source: `_bmad-output/project-context.md` (regras obrigatorias de API, RBAC, DB e testes)

---

## Story Completion Status

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story implementada e definida para `review`.

---

## Open Questions (registradas apos analise completa)

1. A estrategia de vigencia aceita agendamento futuro de troca de plano ou apenas alteracao imediata?
2. O catalogo de planos deve ser totalmente administravel via API interna ou parcialmente seedado por migracao?
3. O historico comercial exige motivo obrigatorio de alteracao (ex.: upgrade, downgrade, renovacao)?

---

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Workflow executado a partir de `.github/skills/bmad-dev-story/workflow.md` com story `6-1-cadastro-e-atribuicao-de-plano-por-tenant`.
- Status no sprint-status transicionado para in-progress no inicio da execucao.
- RED/GREEN aplicado em testes novos: `__tests__/tenant-plan-assignments.test.ts`, `__tests__/plans-domain.test.ts`, `__tests__/plans-api.test.ts`.
- Validacoes executadas: `npm run lint` e `npm run test:run` (suite completa).

### Completion Notes List

- Implementado modulo `src/modules/plans` com camadas domain/application/infrastructure para catalogo comercial e atribuicao de plano por tenant.
- Adicionados schemas Drizzle de planos, atribuicao vigente e historico append-only, com migracao SQL e constraint de plano ativo unico por tenant.
- Expostos endpoints em `/api/v1/platform/plans` e `/api/v1/platform/tenants/[tenant-id]/plan` com envelope padrao, correlation id, validacao Zod e RBAC.
- Implementada transicao atomica de vigencia no repositorio de atribuicao, com auditoria por evento de criacao/atualizacao.
- Cobertura de testes ampliada para dominio/API/schema de planos e regressao completa aprovada (273 testes passados).

### File List

- `_bmad-output/implementation-artifacts/6-1-cadastro-e-atribuicao-de-plano-por-tenant.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `sistema-adalto/src/lib/db/schema/plans.ts`
- `sistema-adalto/src/lib/db/schema/tenant-plan-assignments.ts`
- `sistema-adalto/src/lib/db/schema/tenant-plan-assignment-history.ts`
- `sistema-adalto/src/lib/db/schema/index.ts`
- `sistema-adalto/drizzle/migrations/20260413_plans.sql`
- `sistema-adalto/src/modules/plans/domain/plans.ts`
- `sistema-adalto/src/modules/plans/infrastructure/plans-repository.ts`
- `sistema-adalto/src/modules/plans/application/create-commercial-plan.ts`
- `sistema-adalto/src/modules/plans/application/assign-tenant-plan.ts`
- `sistema-adalto/src/modules/plans/application/list-commercial-plans.ts`
- `sistema-adalto/src/modules/plans/application/get-active-tenant-plan.ts`
- `sistema-adalto/src/app/api/v1/platform/plans/route.ts`
- `sistema-adalto/src/app/api/v1/platform/tenants/[tenant-id]/plan/route.ts`
- `sistema-adalto/__tests__/tenant-plan-assignments.test.ts`
- `sistema-adalto/__tests__/plans-domain.test.ts`
- `sistema-adalto/__tests__/plans-api.test.ts`

### Change Log

- 2026-04-13: Implementado Epic 6 Story 6.1 com modulo de planos comerciais, persistencia tenant-bound, APIs de administracao e cobertura de testes de dominio/API/schema.
