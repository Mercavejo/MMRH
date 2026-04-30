---
story_id: "WS.4"
story_key: "ws4-readiness-playtesting"
epic: "7"
title: "Readiness para Playtesting e Observabilidade"
status: done
created_date: "2026-04-16"
last_updated: "2026-04-27"
---

# Story WS.4: Readiness para Playtesting e Observabilidade

> Realignment Note (2026-04-24): esta story continua util para instrumentacao de playtesting, mas o roteiro observado deve respeitar a separacao entre gestor cliente e admin Mercavejo. Telemetria de sucesso/friccao nao implica abrir observabilidade detalhada para o gestor. Para validacao interna/admin, consulte tambem `docs/ADMIN_PLAYTESTING_GUIDE.md`.

**Epic:** Epic 7 - Playtesting e Validação de Experiência  
**Story ID:** WS.4  
**Priority:** Critical  
**Status:** done

---

## Story Statement

As a engenheiro de software,
I want garantir que o sistema está instrumentado com telemetria completa de sucesso e fricção,
So that possamos observar o comportamento dos utilizadores durante o playtesting dentro dos limites corretos de cada papel e identificar pontos de melhoria.

---

## Acceptance Criteria

### AC 1: Instrumentação de Fricção (Erros 4xx)
**Given** um utilizador a interagir com endpoints core permitidos ao seu papel (Documentos, Lotes e, para admin, Indicadores/Auditoria)  
**When** ocorre um erro de validação (400), autenticação (401) ou autorização (403)  
**Then** o sistema deve registar um evento de playtest com status `failure`  
**And** incluir detalhes da causa (ex: `validation_error`, `insufficient_permissions`) no campo `details`.

### AC 2: Instrumentação de Sucesso (2xx)
**Given** uma operação bem-sucedida em endpoints core  
**When** o pedido é processado com sucesso  
**Then** o sistema deve registar um evento de playtest com status `success`  
**And** incluir metadados relevantes do recurso (ex: `batch_id`, `document_type`).

### AC 3: Telemetria Não-Bloqueante
**Given** uma falha no serviço de logs de playtest  
**When** um evento tenta ser gravado  
**Then** o erro deve ser capturado silenciosamente no logger  
**And** a resposta da API para o utilizador final NÃO deve ser interrompida.

### AC 4: Cobertura de Testes para Telemetria
**Given** as novas implementações de telemetria  
**When** a suite de testes for executada  
**Then** deve haver testes unitários/integração garantindo que o `writePlaytestEvent` é chamado com os parâmetros corretos em casos de sucesso e erro.

---

## Technical Requirements & Dev Agent Guardrails

### Observability Patterns
1. **Utilitário Central:** Usar `src/lib/observability/playtest-audit.ts`.
2. **Contexto:** Sempre extrair `tenantId` e `correlationId` da sessão/headers.
3. **Naming Convention:** Seguir padrão de ações: `playtest.[modulo].[recurso].[acao]` (ex: `playtest.rh.indicators.view`, `playtest.employee.documents.download`).

---

## Tasks/Subtasks

- [x] 1. Criar ficheiro de história `ws4-readiness-playtesting.md`
- [x] 2. Auditar cobertura de telemetria em `src/app/api/v1/rh/indicators/route.ts`
- [x] 3. Auditar cobertura de telemetria em `src/app/api/v1/rh/batches/route.ts`
- [x] 4. Auditar cobertura de telemetria em `src/app/api/v1/employee/documents/route.ts`
- [x] 5. Implementar capturas de erros (fricção) em falta nos handlers acima
- [x] 6. Validar resiliência do logger (try/catch interno no `writePlaytestEvent`)
- [x] 7. Adicionar/Atualizar testes para garantir as invocações de telemetria

---

## Dev Agent Record

### Implementation Plan
- Definir story formalmente para alinhar requisitos.
- Verificar o estado atual de cada endpoint core.
- Injetar chamadas de telemetria em blocos de erro (catch) e após validações de schema Zod.

### Completion Notes
- Story reconciliada em 2026-04-27 para refletir o estado consolidado do sprint.
- A readiness foi considerada suficiente para iniciar playtesting controlado com separacao entre jornada cliente e jornada admin.
- Melhorias futuras de telemetria fina devem nascer de achados reais do playtesting e nao impedir o fechamento desta story.

---

## File List
- `_bmad-output/implementation-artifacts/ws4-readiness-playtesting.md`

---

## Change Log
- 2026-04-16: Criação da história para formalizar requisitos de playtesting.
- 2026-04-27: Story reconciliada para `done` apos aprovacao da Sprint Change Proposal focada em playtesting e consolidacao do MVP.
