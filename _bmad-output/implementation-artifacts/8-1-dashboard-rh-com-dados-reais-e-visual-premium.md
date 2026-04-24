# Story 8.1: Dashboard Cliente com Dados Reais e Visual Premium

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a gestor cliente,
I want ver o dashboard principal com dados funcionais reais do meu tenant,
so that eu acompanhe o resultado dos envios sem depender de indicadores operacionais internos.

## Acceptance Criteria

1. **Dados Reais:** O dashboard deve exibir status real do último lote, histórico funcional recente e CTA de suporte, extraídos das APIs existentes de batches. [Source: epics-8-visao-gestor-playtesting.md]
2. **Premium Visual:** Cards e blocos principais devem manter visual premium e leitura imediata do status funcional. [Source: epics-8-visao-gestor-playtesting.md]
3. **Separação de Escopo:** O dashboard do gestor nao deve exibir auditoria detalhada, fila de exceções, acurácia ou indicadores operacionais internos. [Source: sprint-change-proposal-2026-04-24.md]
4. **Resiliência de UI:** Implementar skeleton loading com shimmer effect para cada card e estados vazios com CTAs orientadores (ex: "Importar primeiro lote"). [Source: epics-8-visao-gestor-playtesting.md]
5. **Navegação:** O link "Dashboard" deve estar presente no sidebar e navegar corretamente, respeitando a filtragem por papel. [Source: epics-8-visao-gestor-playtesting.md]

## Tasks / Subtasks

- [x] 8.1.1 Criar função server-side para o dashboard cliente com dados reais (AC: #1)
  - [x] Consolidar dados de `src/modules/batches`
- [x] 8.1.2 Substituir mocks por dados reais no Server Component de `/rh` (AC: #1)
- [x] 8.1.3 Implementar count-up animation nos summary cards usando `framer-motion` (AC: #2)
- [x] 8.1.4 Implementar skeleton loading (`MUI Skeleton`) com shimmer effect (AC: #4)
- [x] 8.1.5 Conectar o resumo do dashboard ao status funcional do lote e ao histórico recente (AC: #1, #3)
- [x] 8.1.6 Implementar Empty States com CTA "Importar primeiro lote" (AC: #4)
- [x] 8.1.7 Atualizar `AppShell.tsx` com novo link "Dashboard" e renomear antigo (AC: #5)
  - [x] Renomear "Dashboard RH" para "Indicadores RH"
  - [x] Adicionar "Dashboard" (link para `/rh`) no topo da seção RH
- [x] 8.1.8 Testes unitários para `getDashboardSummary` e renderização de estados (AC: #1, #4)

## Dev Notes

- **Tecnologias:** Usar `framer-motion` para animações (confirmado pelo usuário).
- **Componentes MUI:** Utilizar `Skeleton`, `Card`, `Typography` e `Box` seguindo os tokens definidos em `src/lib/theme/tokens.ts`.
- **API Envelope:** Garantir que todas as chamadas de API sigam o padrão `{ data, error, meta }`.

### Project Structure Notes

- **AppShell:** O arquivo `src/components/layout/AppShell.tsx` foi modificado para atualizar o array `NAV_ITEMS`.
- **Dashboard Path:** A rota principal de RH agora é `/rh`. A rota de indicadores segue em `/rh/indicadores`, restrita ao admin.

### References

- [Epic 8 Vision](file:///d:/VICTOR/DADOS/SISTEMA%20ADALTO/_bmad-output/planning-artifacts/epics-8-visao-gestor-playtesting.md)
- [Architecture Hub](file:///d:/VICTOR/DADOS/SISTEMA%20ADALTO/_bmad-output/planning-artifacts/architecture.md)
- [UX Design Spec](file:///d:/VICTOR/DADOS/SISTEMA%20ADALTO/_bmad-output/planning-artifacts/ux-design-specification.md)

## Dev Agent Record

### Agent Model Used

Amelia (Gemini 3 Flash)

### Debug Log References

### Completion Notes List

- Lógica de dashboard consolidada em service dedicado.
- Animações premium adicionadas via framer-motion.
- Roteamento corrigido (removido route group do path /rh).

### File List

- `src/modules/indicators/application/get-dashboard-summary.ts`
- `src/modules/batches/infrastructure/batch-repository.ts`
- `src/components/ui/CountUpValue.tsx`
- `src/app/rh/loading.tsx`
- `src/app/rh/page.tsx`
- `src/components/layout/AppShell.tsx`
- `src/app/page.tsx`
- `__tests__/rh-dashboard-summary.test.ts`
