---
story_id: "6.2"
story_key: "6-2-enforcement-de-capacidades-por-plano"
epic: "6"
title: "Enforcement de Capacidades por Plano"
status: "review"
created_date: "2026-04-13"
last_updated: "2026-04-14"
---

# Story 6.2: Enforcement de Capacidades por Plano

**Epic:** Epic 6 - Planos Comerciais e Governança de Capacidades  
**Story ID:** 6.2  
**Priority:** High  
**Status:** review

---

## Story Statement

As a administrador de tenant,
I want que o sistema bloqueie funcionalidades fora do meu plano,
So that o uso respeite o contrato comercial ativo.

---

## Acceptance Criteria

### AC 1: Bloqueio de operação fora do plano com mensagem clara

**Given** um usuário tentando usar recurso não contratado  
**When** acionar a funcionalidade  
**Then** o sistema deve bloquear a operação e informar restrição de plano  
**And** sugerir caminho para atualização comercial quando aplicável.

### AC 2: Permissão transparente para recursos incluídos no plano

**Given** recurso contemplado no plano  
**When** o usuário executar a ação  
**Then** o sistema deve permitir uso normalmente  
**And** manter a mesma experiência funcional sem degradação por regra comercial.

---

## Dependencies and Scope

### Dependências

- **Story 6.1 concluída:** o módulo `src/modules/plans` já existe com schemas Drizzle (`plans`, `tenant_plan_assignments`, `tenant_plan_assignment_history`), aplicação de use cases e contrato de leitura `get-active-tenant-plan` disponível para consumo direto.
- Epic 1 concluído: RBAC, sessão, `validateSession`, `assertTenantAction` e `RBAC_ACTIONS` prontos.
- Epic 4 concluído: trilha de auditoria com `correlation_id` e `tenant_id` consolidada.
- Endpoints administrativos em `/api/v1/platform/plans` e `/api/v1/platform/tenants/[tenant-id]/plan` já expostos pela 6.1.

### Fora de Escopo

- Telemetria agregada de uso por capacidade (Story 6.3).
- Interface de billing, cobrança, pagamento ou integração financeira.
- Criação ou alteração de catálogo de planos (responsabilidade da 6.1).
- Enforcement em nível de banco de dados (triggers/RLS); enforcement permanece na camada de aplicação.

---

## Technical Requirements

### Domain and Data Rules

1. **Definir catálogo de capacidades (capabilities) por plano** dentro do módulo `src/modules/plans/domain/`:
   - Criar arquivo `capabilities.ts` com enum/constante tipada de todas as capacidades controláveis (ex.: `BATCH_INGESTION`, `EXTERNAL_INTEGRATIONS`, `ADVANCED_AUDIT`, `PDF_MULTIPAGE_PROCESSING`, etc.).
   - Criar mapeamento `PLAN_CAPABILITIES: Record<PlanCode, Set<Capability>>` determinando quais capacidades cada plano inclui.
   - Este mapeamento é a fonte única de verdade de enforcement — não duplicar em banco.

2. **Implementar serviço de enforcement** em `src/modules/plans/application/check-tenant-capability.ts`:
   - Função principal: `checkTenantCapability(tenantId: string, capability: Capability): Promise<CapabilityCheckResult>`.
   - Internamente consulta `get-active-tenant-plan` (já existente na 6.1) e resolve contra `PLAN_CAPABILITIES`.
   - Retorna objeto tipado: `{ allowed: boolean; planCode: string; capability: Capability; upgradeRequired?: boolean }`.
   - Em caso de plano inativo ou tenant sem plano: bloquear por default (fail-safe).

3. **Criar guard de enforcement reutilizável** em `src/modules/plans/application/enforce-capability.ts`:
   - Função `enforceCapability(tenantId, capability)` que lança exceção de domínio tipada `CapabilityForbiddenError` quando `allowed === false`.
   - `CapabilityForbiddenError` deve carregar: `capability`, `planCode`, `upgradeHint` (string opcional com instrução de upgrade).

4. **Não duplicar lógica de plano fora do módulo plans:**
   - Outros módulos DEVEM chamar `enforceCapability` ou `checkTenantCapability` — proibido reimplementar regra de capacidade em módulo de batch, integrations ou audit.

### API Requirements

1. Expor endpoint de consulta de capacidade em:
   - `GET /api/v1/tenants/me/capabilities` — retorna lista de capacidades habilitadas para o tenant autenticado (útil para feature flags no frontend).
   - Resposta no envelope padrão `{ data: { capabilities: string[] }, error: null, meta: { correlation_id, plan_code } }`.

2. Para endpoints existentes que cobrem funcionalidades controladas (ex.: `/api/v1/batches`, `/api/v1/webhooks/integrations`):
   - Adicionar chamada a `enforceCapability` antes da lógica de domínio.
   - Ao barrar: retornar **HTTP 403** com erro estruturado:
     ```json
     {
       "data": null,
       "error": {
         "code": "CAPABILITY_FORBIDDEN",
         "message": "Esta funcionalidade não está disponível no plano atual.",
         "details": { "capability": "BATCH_INGESTION", "plan_code": "base", "upgrade_hint": "..." }
       },
       "meta": { "correlation_id": "..." }
     }
     ```
   - Manter `correlation_id` no header `x-correlation-id` e no envelope.

3. Validação de entrada continua via Zod `safeParse` — enforcement de capacidade ocorre APÓS validação de sessão/RBAC e ANTES da lógica de domínio.

### Security and Authorization Rules

1. Enforcement de capacidade NÃO substitui RBAC — ambos devem ser aplicados em sequência: sessão → RBAC → capability check → domínio.
2. Somente o `tenant_id` extraído da sessão autenticada deve ser usado para consulta de plano — jamais params de rota ou body.
3. Nunca expor detalhes do catálogo de planos de outros tenants; consulta de capabilities limita-se ao tenant da sessão.
4. Registrar evento de auditoria quando enforcement bloquear operação: `plans.capability.blocked.v1` com `capability`, `tenant_id`, `plan_code`, `actor`, `correlation_id`.

### Capability Catalog (Referência Inicial)

| Capability Enum | Descrição | Planos que Incluem |
|---|---|---|
| `BATCH_INGESTION` | Importação de lotes de documentos | professional, enterprise |
| `EXTERNAL_INTEGRATIONS` | Ingestão via webhook/API externa | enterprise |
| `PDF_MULTIPAGE_PROCESSING` | Processamento de PDF multi-página | professional, enterprise |
| `ADVANCED_AUDIT` | Trilha de auditoria avançada com exportação | enterprise |
| `PORTAL_EMPLOYEE_ACCESS` | Acesso do colaborador ao portal | base, professional, enterprise |
| `COMMERCIAL_GOVERNANCE` | Telemetria de uso e relatórios comerciais | enterprise |

> **Nota para o agente:** Este catálogo pode ser refinado com o PM. O ponto crítico é que o mapeamento viva em `capabilities.ts` e qualquer ajuste de plano/capacidade seja feito apenas nesse arquivo, sem alterar esquemas de banco ou múltiplos módulos.

---

## Architecture Compliance Notes

### Regras Obrigatórias

- Endpoint de consulta de capacidades em `src/app/api/v1/tenants/me/capabilities/route.ts`.
- Enforcement integrado nos handlers existentes — não criar novos middlewares de framework fora do padrão do projeto.
- Banco apenas via `src/lib/db/client.ts`; catálogo de capabilities não requer nova tabela (é configuração em código).
- Resposta e erro obrigatoriamente via `src/lib/api/response.ts` e `src/lib/api/errors.ts`.
- Correlation ID obrigatório em request/response (`x-correlation-id`).
- Schemas Drizzle novos (se necessários) exportados por `src/lib/db/schema/index.ts`.

### Estrutura de Código Alvo

```
src/modules/plans/domain/capabilities.ts          ← enum + mapeamento plano→capabilities
src/modules/plans/application/check-tenant-capability.ts
src/modules/plans/application/enforce-capability.ts
src/app/api/v1/tenants/me/capabilities/route.ts   ← GET capabilities do tenant autenticado
src/lib/api/errors.ts                              ← adicionar CapabilityForbiddenError (se não existir)

Integração em handlers existentes:
src/app/api/v1/batches/route.ts                    ← chamar enforceCapability(BATCH_INGESTION)
src/app/api/v1/batches/[batch-id]/route.ts         ← chamar enforceCapability(BATCH_INGESTION)
src/app/api/v1/webhooks/integrations/route.ts      ← chamar enforceCapability(EXTERNAL_INTEGRATIONS)

Testes:
__tests__/plans-enforcement.test.ts
__tests__/capabilities-api.test.ts
```

### Reuso Obrigatório (Não Reinventar)

1. `get-active-tenant-plan` da Story 6.1 — consumir diretamente, sem nova query de plano.
2. `validateSession`, `assertTenantAction`, `RBAC_ACTIONS` — manter sequência padrão antes do enforcement.
3. `src/lib/api/response.ts` e `src/lib/api/errors.ts` — envelope e erros padrão.
4. Padrão Vitest com `vi.mock` e `beforeEach` para limpeza de estado nos testes.
5. Padrão de auditoria com `correlation_id` e `tenant_id` já consolidado nos epics anteriores.

---

## Library and Framework Requirements

- Next.js 16.2.3 (App Router + Route Handlers)
- React 19.2.x (server-first, RSC)
- TypeScript 5 strict
- Drizzle ORM 0.45.2 + Drizzle Kit 0.31.10 (sem nova migração obrigatória — catálogo em código)
- Zod 4.x no boundary
- Vitest 4.1.x para testes automatizados

**Sem novas dependências obrigatórias para esta story.**

---

## File Structure Requirements

- Todo código de enforcement deve ficar em `src/modules/plans/` — não vazar para outros módulos.
- O mapeamento `PLAN_CAPABILITIES` em `capabilities.ts` é a única fonte de verdade; não duplicar em banco ou em outros módulos.
- Handlers de rotas existentes devem receber apenas a chamada `enforceCapability(...)` — a lógica de resolução permanece encapsulada no módulo plans.
- Testes devem cobrir enforcement via mock de `get-active-tenant-plan`, não via banco real.

---

## Implementation Tasks / Subtasks

- [x] T1 - Modelar catálogo de capacidades e mapeamento por plano (AC: 1, 2)
  - [x] Criar `src/modules/plans/domain/capabilities.ts` com enum `Capability` e `PLAN_CAPABILITIES`.
  - [x] Definir tipo `CapabilityCheckResult` e exceção de domínio `CapabilityForbiddenError`.

- [x] T2 - Implementar serviço de verificação e guard de enforcement (AC: 1, 2)
  - [x] Criar `check-tenant-capability.ts` consumindo `get-active-tenant-plan` da 6.1.
  - [x] Criar `enforce-capability.ts` lançando `CapabilityForbiddenError` quando bloqueado.
  - [x] Garantir comportamento fail-safe: tenant sem plano ativo → bloquear por default.

- [x] T3 - Expor endpoint de consulta de capabilities do tenant (AC: 2)
  - [x] Criar `GET /api/v1/tenants/me/capabilities` com envelope padrão e `plan_code` em meta.
  - [x] Aplicar sessão + RBAC antes da lógica; retornar array de capabilities habilitadas.

- [x] T4 - Integrar enforcement nos handlers de funcionalidades controladas (AC: 1)
  - [x] Adicionar `enforceCapability(BATCH_INGESTION)` em `/api/v1/batches` (POST e operações de lote).
  - [x] Adicionar `enforceCapability(EXTERNAL_INTEGRATIONS)` em `/api/v1/webhooks/integrations`.
  - [x] Retornar HTTP 403 com `CAPABILITY_FORBIDDEN` e `upgrade_hint` quando barrado.
  - [x] Registrar evento de auditoria `plans.capability.blocked.v1` ao bloquear.

- [x] T5 - Cobertura de testes obrigatória e regressão (AC: 1, 2)
  - [x] `checkTenantCapability` retorna `allowed: true` para capability incluída no plano ativo.
  - [x] `checkTenantCapability` retorna `allowed: false` para capability fora do plano.
  - [x] `enforceCapability` lança `CapabilityForbiddenError` quando `allowed: false`.
  - [x] Endpoint `GET /api/v1/tenants/me/capabilities` retorna lista correta no envelope padrão.
  - [x] Endpoint de batch retorna `403 CAPABILITY_FORBIDDEN` quando tenant sem capability `BATCH_INGESTION`.
  - [x] Endpoint de batch retorna sucesso normal quando tenant tem capability `BATCH_INGESTION`.
  - [x] Tenant sem plano ativo → bloqueado por fail-safe.
  - [x] Acesso sem sessão → `401` (antes do enforcement, pelo padrão existente).
  - [x] Acesso cross-tenant → `403 FORBIDDEN` (garantia de regressão multi-tenant).

---

## Testing Requirements Summary

Cobertura mínima obrigatória em `__tests__/**/*.test.ts`:

1. `checkTenantCapability`: plano inclui capability → `allowed: true`.
2. `checkTenantCapability`: plano não inclui capability → `allowed: false` com `upgradeRequired: true`.
3. `checkTenantCapability`: tenant sem plano ativo → `allowed: false` (fail-safe).
4. `enforceCapability`: lança `CapabilityForbiddenError` com `capability` e `planCode` corretos.
5. `GET /api/v1/tenants/me/capabilities`: retorna capabilities do plano no envelope padrão.
6. `POST /api/v1/batches`: tenant sem `BATCH_INGESTION` → `403 CAPABILITY_FORBIDDEN`.
7. `POST /api/v1/batches`: tenant com `BATCH_INGESTION` → execução normal do handler.
8. Mock de `get-active-tenant-plan` via `vi.mock` com limpeza em `beforeEach`.
9. Regressão: enforcement não afeta endpoints de capabilities não controladas.
10. Regressão: correlation_id presente em toda resposta de enforcement (sucesso e bloqueio).

---

## Previous Story Intelligence (Story 6.1)

A Story 6.1 entregou os seguintes artefatos que esta story consome diretamente:

- **Schemas Drizzle:** `plans`, `tenant_plan_assignments`, `tenant_plan_assignment_history` — sem nova migração necessária para 6.2 (catálogo de capabilities vive em código).
- **Use Case pronto:** `get-active-tenant-plan.ts` em `src/modules/plans/application/` — consumir sem modificação.
- **Endpoints 6.1 já expostos:** `/api/v1/platform/plans` e `/api/v1/platform/tenants/[tenant-id]/plan` — não reeditar.
- **Cobertura de testes aprovada:** 273 testes passados com `plans-domain`, `plans-api` e `tenant-plan-assignments`.
- **Padrão estabelecido:** transição atômica de vigência, auditoria por evento, envelope padrão — seguir o mesmo padrão.

**Aprender com 6.1:** a separação domain/application/infrastructure funcionou bem; manter o mesmo padrão para capabilities.

---

## Git Intelligence Summary

Commits recentes relevantes:

1. `535597d` — `feat(plans): add tenant plan assignment flow` — Implementação da 6.1: módulo plans com domain/application/infrastructure, schemas, migrações e APIs de administração. **Base direta desta story.**
2. `1577a61` — `fix(integrations): harden webhook signature validation and migration backfill` — Reforça pattern de validação de boundary e hardening de endpoints; seguir mesma abordagem ao integrar enforcement nos handlers.
3. `798a4a3` — `feat(integrations): validar contrato versionado no intake externo` — Exemplo de guard de validação adicionado em handler existente sem refatoração completa; reusável como modelo de integração de `enforceCapability`.
4. `43bab3b` — `feat(rh): consolidar auditoria, alertas, indicadores e suporte operacional` — Padrão de evento de auditoria consolidado; seguir `domain.entity.action.vN` para o evento `plans.capability.blocked.v1`.
5. `01baec7` — `feat(integrations): implement story 5.1 intake and RH operational monitoring` — Padrão de monitoramento e rastreabilidade operacional; referência para logging estruturado em capability blocked.

---

## Latest Tech Information

- Stack permanece estável: Next.js 16.2.3, TypeScript 5 strict, Drizzle 0.45.2, Zod 4.x, Vitest 4.1.x.
- Nenhuma troca de dependência necessária para esta story.
- O principal risco técnico é acoplamento indevido: outros módulos DEVEM chamar `enforceCapability` do módulo plans. Revisar PR para garantir que nenhum módulo reimplementa a lógica de capacidade.
- Garantir que o catálogo `PLAN_CAPABILITIES` seja o único ponto de alteração para ajuste de capacidades por plano.

---

## Project Structure Notes

- O módulo `src/modules/plans` foi criado na 6.1 com fronteiras claras. Esta story apenas expande `application/` e `domain/` com dois novos arquivos.
- A integração nos handlers existentes (batches, integrations) deve ser cirúrgica: apenas adicionar a chamada `enforceCapability` antes da lógica de domínio, sem refatoração de estrutura.
- O endpoint `GET /api/v1/tenants/me/capabilities` é um novo endpoint dentro do padrão `/api/v1/**`.

---

## References

- Source: `_bmad-output/planning-artifacts/epics.md` (Epic 6, Story 6.2)
- Source: `_bmad-output/planning-artifacts/prd.md` (FR41 — restrição de capacidades fora do plano; FR39, FR40, FR42 — contexto comercial)
- Source: `_bmad-output/planning-artifacts/architecture.md` (modules/plans, boundaries, /api/v1, envelope padrão, RBAC, correlation_id)
- Source: `_bmad-output/implementation-artifacts/6-1-cadastro-e-atribuicao-de-plano-por-tenant.md` (contratos de leitura, artefatos entregues)
- Source: `_bmad-output/project-context.md` (regras obrigatórias de API, RBAC, DB e testes)

---

## Story Completion Status

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Status: review.

### Review Findings
- [x] [Review][Patch] Integração do Log de Auditoria no Enforcement — Alterar `enforceCapability` para receber `actor` e `correlationId` via injeco de dependencia e disparar o evento de auditoria internamente antes de lancar o erro.
- [x] [Review][Patch] Tipagem e Imutabilidade no PLAN_CAPABILITIES [src/modules/plans/domain/capabilities.ts] — Usar type para `PlanCode` e congelar estruturas (Readonly) para previnir mutações globais acidentais.
- [x] [Review][Patch] Formatação manual em vez de usar successResponse [src/app/api/v1/tenants/me/capabilities/route.ts] — Rota compõe a resposta de sucesso manualmente em vez de chamar a utilidade do sistema.
- [x] [Review][Patch] Mensagem de Fallback para Upgrade Hint [src/modules/plans/application/enforce-capability.ts] — Se a capability nao estiver mapeada em `UPGRADE_HINTS`, a exceção envia undefined. Usar um fallback text.
- [x] [Review][Patch] Otimização (Paralelismo) na recuperação de dados [src/app/api/v1/tenants/me/capabilities/route.ts] — `resolveTenantRole` e `getActiveTenantPlan` devem rodar em `Promise.all` para reduzir latência.

## Dev Agent Record

### Completion Notes
- Padronizado o bloqueio comercial para retornar 403 consistente com `CAPABILITY_FORBIDDEN` e detalhes estruturados contendo `capability`, `planCode`, `plan_code` e `correlation_id`.
- Mantida a semântica atual de auth/tenant nas rotas de batches e integrações; apenas o payload de negação foi harmonizado.
- Auditoria `plans.capability.blocked.v1` continua sendo registrada em toda negação via `enforceCapability`.
- Testes de enforcement e API foram reforçados para validar o novo shape do erro e o evento de auditoria.
- A implementação foi resolvida (os endpoints e checks estavam codificados antes)
- `checkTenantCapability` e `enforceCapability` finalizados com integração de auditoria.
- Adicionado o Mock de `getTenantPlanHistory` no `__tests__/plans-api.test.ts` para resolver teste quebrado.
- Todas as 15 suítes de testes (`__tests__/plans-enforcement.test.ts`) testadas e passando. Suíte global inteiramente verde.

## File List
- `_bmad-output/implementation-artifacts/6-2-enforcement-de-capacidades-por-plano.md`
- `docs/DECISION_GATE_LOG.md`
- `src/lib/api/errors.ts`
- `src/modules/plans/application/enforce-capability.ts`
- `src/app/api/v1/rh/batches/route.ts`
- `src/app/api/v1/webhooks/integrations/route.ts`
- `__tests__/plans-enforcement.test.ts`
- `__tests__/plans-enforcement-api.test.ts`

## Change Log
- 2026-04-13: Story implementation verified and all validation gates passed. Adicionado mock pendente em `__tests__/plans-api.test.ts`. Story status modificado para `review`.
