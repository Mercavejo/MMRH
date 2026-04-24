---
title: 'Playtesting Readiness - MVP 100% Funcional'
type: 'feature'
created: '2026-04-17'
status: 'done'
baseline_commit: 'NO_VCS'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

> Superseded Scope Note (2026-04-24): este spec foi aprovado antes da separacao formal entre gestor cliente e admin Mercavejo. Ele continua relevante como registro do experimento de playtesting que liberou navegacao entre visoes, mas nao deve mais ser usado como instrução atual para dar ao `rh_gestor` acesso a auditoria, indicadores ou excecoes. A fonte de verdade atual e a correcao de escopo registrada em `sprint-change-proposal-2026-04-24.md`.

## Intent

**Problem:** O sistema bloqueava `rh_gestor` ao acessar rotas de colaborador (`/documents`, `/notifications`) com "Acesso permitido somente para colaborador". Botões do Dashboard RH ("Importar Relatório", quick-actions) não navegavam. Resultado: playtesting inviável na fase anterior — metade das telas ficava inacessível.

**Approach:** Permitir que `rh_gestor` navegue entre visões de colaborador para demonstração controlada, injetando dados mock quando não houver documentos/notificações reais. Este documento nao autoriza mais acesso do gestor a auditoria, indicadores ou excecoes internas; esses pontos ficam reservados ao admin/suporte Mercavejo.

## Boundaries & Constraints

**Always:**
- Manter envelope de API `{ data, error, meta }` intacto — alterações são somente em Server Components e UI.
- Dados mock vivem em `src/lib/demo/mock-data.ts`, nunca inline em páginas.
- O badge "Modo Simulação" deve ser visível quando `rh_gestor` navega em rotas `(employee)`.

**Ask First:**
- Se alguma mudança exigir alteração de schema ou migration.

**Never:**
- Alterar lógica de autenticação/sessão (`validateSession`, cookies).
- Remover proteção de tenant-scope.
- Implementar lógica real de processamento de lotes neste spec.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Gestor acessa `/documents` | role=`rh`, sem docs reais | Lista de documentos mock exibida | N/A |
| Colaborador acessa `/documents` | role=`colaborador` | Fluxo normal inalterado — busca DB real | Mensagem de erro se DB falhar |
| Gestor acessa `/notifications` | role=`rh`, sem notif reais | Lista de notificações mock exibida | N/A |
| Gestor clica "Alternar Visão" na visão RH | pathname starts with `/rh` | Navega para `/documents` | N/A |
| Gestor clica "Alternar Visão" na visão Colaborador | pathname starts with `/documents` ou `/notifications` | Navega para `/rh` | N/A |
| Colaborador vê botão "Alternar Visão" | hasAccessToBoth=false | Botão não aparece | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/demo/mock-data.ts` -- [NEW] Dados fictícios de documentos e notificações
- `src/app/(employee)/layout.tsx` -- Layout que bloqueia `rh` no redirect (L48-53)
- `src/app/(employee)/documents/page.tsx` -- Bloqueio `role !== colaborador` (L66-73)
- `src/app/(employee)/notifications/page.tsx` -- Bloqueio `role !== colaborador` (L127-133)
- `src/components/layout/AppShell.tsx` -- Botão "Alternar Visão" sem onClick (L201-213), sem badge de simulação
- `src/app/(rh)/page.tsx` -- Botões sem `href` (L62-68, L157-159)

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/demo/mock-data.ts` -- Criar módulo com arrays tipados de documentos e notificações mock -- Centraliza dados de demonstração
- [x] `src/app/(employee)/layout.tsx` -- Remover redirect de `rh` para `/rh/indicadores`; passar `userRole` real e flag `isSimulating` ao AppShell -- Permite gestor navegar em employee
- [x] `src/app/(employee)/documents/page.tsx` -- Quando `role !== "colaborador"`, retornar lista mock de `mock-data.ts` em vez de mensagem de erro -- Gestor vê documentos de demonstração
- [x] `src/app/(employee)/notifications/page.tsx` -- Mesmo padrão: role não-colaborador recebe notificações mock -- Gestor vê notificações de demonstração
- [x] `src/components/layout/AppShell.tsx` -- Implementar `onClick` no botão "Alternar Visão" com lógica de rota; adicionar Chip "Modo Simulação" no AppBar quando `isSimulating=true`; adicionar prop `isSimulating` -- Navegação funcional entre visões
- [x] `src/app/(rh)/page.tsx` -- Vincular botão "Importar Novo Relatório" a `/rh/lotes`; no modelo atual, quick-actions do gestor devem permanecer restritas a lotes/histórico/suporte -- Navegação funcional preservada

**Acceptance Criteria:**
- Given um `rh_gestor` logado, when ele acessa `/documents`, then vê a lista de documentos mock com holerites e cartões de ponto
- Given um `rh_gestor` logado, when ele acessa `/notifications`, then vê notificações mock sem erro
- Given um `rh_gestor` na visão RH, when clica "Alternar Visão", then navega para `/documents`
- Given um `rh_gestor` na visão Colaborador, when clica "Alternar Visão", then navega para `/rh`
- Given um `rh_gestor` na visão Colaborador, then um badge "Modo Simulação" é visível na barra superior
- Given o Dashboard RH, when clica em qualquer botão de ação, then navega para a rota correspondente sem erro 404
- Given um `colaborador` logado, when acessa `/documents`, then o fluxo normal de DB é executado sem alteração

## Verification

**Commands:**
- `npx vitest run` -- expected: testes existentes passam sem regressão

**Manual checks (browser):**
- Login como admin → validar rotas internas/admin conforme RBAC atual
- Clicar "Alternar Visão" → `/documents` exibe documentos mock com badge "Modo Simulação"
- Clicar "Alternar Visão" novamente → retorna a `/rh`
- Navegar para `/notifications` → exibe notificações mock

## Suggested Review Order

**Dados de Demonstração**

- Módulo centralizado de mock — fonte única de verdade para documentos e notificações fake
  [`mock-data.ts:1`](../../sistema-adalto/src/lib/demo/mock-data.ts#L1)

**RBAC Relaxation (Employee Layout)**

- Remoção do redirect que bloqueava `rh` nas rotas de colaborador; detecção de `isSimulating`
  [`layout.tsx:46`](../../sistema-adalto/src/app/(employee)/layout.tsx#L46)

**Injeção de Mock nas Pages**

- Documentos: role não-colaborador recebe `MOCK_DOCUMENTS` em vez de error
  [`documents/page.tsx:72`](../../sistema-adalto/src/app/(employee)/documents/page.tsx#L72)

- Notificações: mesmo padrão — `MOCK_NOTIFICATIONS` para gestor simulando
  [`notifications/page.tsx:128`](../../sistema-adalto/src/app/(employee)/notifications/page.tsx#L128)

**Navegação AppShell**

- Botão "Alternar Visão" com onClick e rótulo dinâmico + badge "Modo Simulação"
  [`AppShell.tsx:207`](../../sistema-adalto/src/components/layout/AppShell.tsx#L207)

**Dashboard RH — Botões com href**

- "Importar Relatório" → `/rh/lotes`; quick-actions vinculadas a rotas existentes
  [`page.tsx:62`](../../sistema-adalto/src/app/(rh)/page.tsx#L62)

**Suporte a status `published` no DocumentTile**

- Adicionado `published` ao mapa de ícones e ao check `isAvailable`
  [`DocumentTile.tsx:39`](../../sistema-adalto/src/components/documents/DocumentTile.tsx#L39)
