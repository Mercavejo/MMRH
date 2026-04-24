# Story 8.3: UX Premium para Upload e Processamento de Lotes

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a RH/DP operador,
I want uma experiência de upload de documentos fluida e premium,
so that o processo de importação transmita confiança profissional durante demonstrações para clientes.

## Acceptance Criteria

1. **DropZone Premium:** Área de upload com drag & drop, highlight animation (border pulsante, ícone animado) ao arrastar arquivo sobre a área. [Source: epics-8-visao-gestor-playtesting.md#L106-107]
2. **File Preview:** Preview visual do arquivo selecionado com ícone por tipo (PDF, CSV, JSON), nome e tamanho formatado. [Source: epics-8-visao-gestor-playtesting.md#L108, #123]
3. **Stepper Visual:** Implementar `MUI Stepper` para exibir as etapas do fluxo: Validação → Roteamento → Publicação. [Source: epics-8-visao-gestor-playtesting.md#L114, #124]
4. **Progress Animation:** Barra de progresso suave no `BatchProgressPanel` (transição gradual via CSS no `LinearProgress`) e chips com micro-animação na mudança de valor. [Source: epics-8-visao-gestor-playtesting.md#L112, #125]
5. **Celebration Effect:** Ao publicar com sucesso, disparar animação de celebração (confetti) e exibir resumo final (total publicado, tempo) com orientação para histórico funcional do lote ou abertura de chamado técnico. [Source: sprint-change-proposal-2026-04-24.md]
6. **Test Coverage:** Testes unitários para `DropZone`, transições do `Stepper` e renderização de cada etapa do progresso do lote. [Source: epics-8-visao-gestor-playtesting.md#L128]

## Tasks / Subtasks

- [x] 8.3.1 Instalar dependências autorizadas: `npm install react-dropzone canvas-confetti && npm install -D @types/canvas-confetti` (AC: #1, #5)
- [x] 8.3.2 Implementar componente `DropZone` em `src/components/batches/` (AC: #1, #2)
  - [x] Usar `react-dropzone` para DnD
  - [x] Adicionar `framer-motion` para animação de pulso/highlight no state de hover
  - [x] Renderizar preview com ícone dinâmico por extensões suportadas
- [x] 8.3.3 Implementar `BatchStepper` com `MUI Stepper` (AC: #3)
  - [x] Integrar com o estado atual do processamento de lote
- [x] 8.3.4 Refatorar `BatchProgressPanel` para animações fluidas (AC: #4)
  - [x] Garantir que a `LinearProgress` tenha transições suaves
- [x] 8.3.5 Integrar `canvas-confetti` no estado de conclusão (AC: #5)
  - [x] Criar trigger de celebração no sucesso da publicação
  - [x] Exibir resumo final com orientação para histórico funcional e suporte, sem link para auditoria
- [x] 8.3.6 Suite de Testes (AC: #6)
  - [x] Validar comportamento do DropZone (arrastar/soltar)
  - [x] Validar renderização dos ícones de preview e estados do stepper

### Review Findings

- [x] [Review][Patch] Corrigir erros TypeScript introduzidos por props de motion em componentes MUI [`src/components/batches/drop-zone.tsx`:96]
- [x] [Review][Patch] Corrigir erro TypeScript no Alert animado do painel de progresso [`src/components/batches/batch-progress-panel.tsx`:165]
- [x] [Review][Patch] Implementar pulso real na borda da DropZone durante drag active [`src/components/batches/drop-zone.tsx`:70]
- [x] [Review][Patch] Evitar preview stale quando drop rejeitado mantém arquivo anterior como pronto [`src/components/batches/drop-zone.tsx`:22]
- [x] [Review][Patch] Stepper inicial não deve marcar roteamento como ativo antes de existir lote validado [`src/components/batches/batch-stepper.tsx`:60]

## Dev Notes

- **Bibliotecas:** `react-dropzone` (DnD), `canvas-confetti` (Celebração), `framer-motion` (Animações), `MUI 9` (Layout/Stepper).
- **Design Tokens:** Manter consistência com `statusColors` e tokens definidos em 8.1/8.2.
- **UX:** A transição entre etapas do Stepper deve ser reativa ao backend de processamento de lotes.
- **Idempotência:** O upload deve lidar com tentativas duplicadas conforme os padrões de backend definidos na arquitetura.

## Project Structure Notes

- Componentes devem residir em `sistema-adalto/src/components/batches/`.
- Testes em `sistema-adalto/__tests__/batches/`.

## References

- [Epic 8 Vision](file:///d:/VICTOR/DADOS/SISTEMA%20ADALTO/_bmad-output/planning-artifacts/epics-8-visao-gestor-playtesting.md)
- [UX Design Spec](file:///d:/VICTOR/DADOS/SISTEMA%20ADALTO/_bmad-output/planning-artifacts/ux-design-specification.md)
- [Architecture Hub](file:///d:/VICTOR/DADOS/SISTEMA%20ADALTO/_bmad-output/planning-artifacts/architecture.md)

## Dev Agent Record

### Agent Model Used

Amelia (Gemini 3 Flash)

### Completion Notes List

- Implementação da `DropZone` premium com `react-dropzone` e animações via `framer-motion`.
- Adicionado preview de arquivos com ícones dinâmicos (PDF, CSV, JSON).
- Criado componente `BatchStepper` integrado ao estado de processamento de lotes do backend.
- Refatorado `BatchProgressPanel` com barra de progresso suavizada e micro-interações em chips de status.
- Integrado `canvas-confetti` para celebração automática ao atingir o estado `published`.
- Suíte de testes unitários criada e validada com 100% de sucesso.
- Review 2026-04-22: corrigidos wrappers `framer-motion`/MUI para remover erros TypeScript no escopo da story.
- Review 2026-04-22: adicionado pulso real na borda da DropZone durante drag active.
- Review 2026-04-22: drop rejeitado agora limpa arquivo anterior para evitar preview stale.
- Review 2026-04-22: Stepper sem lote validado inicia com etapas pendentes.

### File List

- `src/components/batches/drop-zone.tsx` [NEW]
- `src/components/batches/batch-stepper.tsx` [NEW]
- `src/components/batches/batch-progress-panel.tsx` [MODIFY]
- `src/app/rh/lotes/page.tsx` [MODIFY]
- `src/app/rh/lotes/batch-progress-panel.tsx` [DELETE]
- `__tests__/batches/drop-zone.test.tsx` [NEW]
- `__tests__/batches/batch-stepper.test.tsx` [NEW]
