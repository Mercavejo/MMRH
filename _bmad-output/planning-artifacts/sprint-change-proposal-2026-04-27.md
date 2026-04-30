# Sprint Change Proposal - Proximo Ciclo Guiado por Playtesting e Consolidacao

**Data:** 2026-04-27
**Projeto:** SISTEMA ADALTO
**Modo assumido:** Batch
**Status:** proposed

## 1. Issue Summary

A correcao de escopo de 2026-04-24 separou com sucesso a jornada do `gestor cliente` da operacao privilegiada de `admin Mercavejo`. Depois disso, o projeto ficou em um estado de transicao: a experiencia principal de playtesting foi implementada, a documentacao passou a recomendar validar o produto com usuarios reais, mas o backlog oficial ainda nao foi reorganizado para refletir esse novo momento.

Hoje o problema nao e falta de implementacao base. O problema e de navegacao do sprint:

- o `sprint-status.yaml` ainda mostra `epic-8: in-progress` apesar de a retrospectiva declarar o epic como concluido;
- a story `ws4-readiness-playtesting` aparece `done` no `sprint-status.yaml`, mas o arquivo da story ainda esta `in-progress`;
- nao existe Epic 9 definida;
- o projeto corre risco de voltar a abrir trabalho de implementacao por inercia antes de colher evidencia real de uso.

Em resumo: a necessidade de mudanca agora e transformar o estado atual de "produto demonstravel" em um ciclo formal de playtesting, evidencia e consolidacao, antes de nova expansao funcional.

## 2. Checklist de Analise

- [x] 1.1 Trigger identificado: pos-realinhamento de 2026-04-24, com Epic 8 funcionalmente encerrado e proximo ciclo indefinido.
- [x] 1.2 Problema definido: mistura entre backlog de implementacao e necessidade atual de validacao com usuarios; tipo de problema = strategic pivot leve / backlog re-sequencing apos aprendizagem de implementacao.
- [x] 1.3 Evidencias reunidas: `epic-8-retro-2026-04-22.md`, `PLAYTESTING_GUIDE.md`, `ws4-readiness-playtesting.md`, `sprint-status.yaml`, ausencia de Epic 9.
- [x] 2.1 Epic atual afetada: Epic 8 pode ser considerada concluida como ciclo de implementacao para playtesting.
- [x] 2.2 Mudancas em epic: encerrar formalmente Epic 8; remover a ambiguidade documental de WS.4; criar um novo ciclo oficial orientado a playtesting.
- [x] 2.3 Impacto em outras epics: Epic 4 permanece valida, mas fora do caminho critico imediato; Epic 7/WS.4 precisa ser reconciliada documentalmente.
- [x] 2.4 Novas epics: recomendado criar uma nova epic focada em evidencia e consolidacao do MVP antes de expansao funcional.
- [x] 2.5 Prioridade: elevar playtesting e backlog consolidation acima de novas features internas/admin.
- [x] 3.1 PRD revisado: sem conflito estrutural; o PRD atual ja suporta a jornada simplificada e a validacao do MVP.
- [x] 3.2 Arquitetura revisada: sem necessidade de mudanca arquitetural imediata; foco do proximo ciclo e validacao operacional e hardening pontual.
- [x] 3.3 UX revisada: sem conflito de direcao; os roteiros de `PLAYTESTING_GUIDE.md` e `ADMIN_PLAYTESTING_GUIDE.md` devem virar fonte de evidencia, nao apenas documentacao.
- [x] 3.4 Artefatos secundarios revisados: `sprint-status.yaml`, story WS.4, retros, guias de playtesting e backlog de proxima epic.
- [x] 4.1 Direct Adjustment: viavel.
- [ ] 4.2 Potential Rollback: nao recomendado.
- [x] 4.3 PRD MVP Review: viavel, mas leve; nao para reduzir escopo, e sim para congelar nova expansao ate coleta de evidencia.
- [x] 4.4 Caminho selecionado: Hybrid = Direct Adjustment + MVP Review + New Validation Epic.
- [x] 5.1-5.5 Proposta, impacto, recomendacao, plano e handoff consolidados abaixo.

## 3. Impact Analysis

### Epic Impact

- **Epic 8**: deve ser encerrada formalmente como entrega de experiencia de playtesting.
- **Epic 7 / WS.4**: precisa de reconciliacao documental, porque a readiness para playtesting foi tratada como concluida no status, mas permanece aberta no arquivo da story.
- **Epic 4**: continua valida como backlog interno/admin, mas nao deve puxar o proximo sprint enquanto o MVP ainda nao foi validado com usuarios.
- **Nova Epic recomendada**: formalizar um ciclo de validacao do MVP com foco em execucao do playtesting, triagem de achados e definicao do proximo backlog.

### Artifact Conflicts

- `sprint-status.yaml`: conflito entre status declarado e estado descrito na retro/artefatos finais.
- `ws4-readiness-playtesting.md`: conflito entre o topo da story (`in-progress`) e o estado consolidado do sprint.
- `epic-8-retro-2026-04-22.md`: deixa claro que o proximo passo deve vir de evidencia de uso, mas isso ainda nao foi transformado em backlog oficial.
- `PLAYTESTING_GUIDE.md`: pronto para execucao, mas ainda sem espelho em planejamento de sprint.

### Technical Impact

- Nenhuma reestruturacao tecnica ampla e necessaria agora.
- O impacto tecnico esperado e localizado:
  - ajustes pequenos de hardening descobertos durante sessoes de playtesting;
  - estabilizacao documental e de status;
  - eventual conversao de achados em stories novas, depois da coleta de evidencia.

## 4. Recommended Approach

### Chosen Path

Hybrid: encerrar formalmente o ciclo de implementacao atual, criar uma nova epic curta de validacao do MVP e congelar expansao funcional nao essencial ate colher evidencia do playtesting.

### Rationale

- Preserva o momento do time: o produto ja esta demonstravel.
- Evita abrir mais escopo sem feedback real.
- Melhora a consistencia entre codigo, retro, guia operacional e backlog.
- Mantem o foco em valor e reduz risco de investir em refinamentos que os usuarios talvez nao precisem.

### Effort / Risk / Timeline

- Esforco: baixo a medio
- Risco: baixo
- Impacto de cronograma: positivo, porque reduz dispersao e cria criterio claro para a proxima rodada de implementacao

## 5. Detailed Change Proposals

### Sprint Status

OLD:
- `epic-8: in-progress`
- `ws4-readiness-playtesting: done` enquanto o arquivo da story permanece `in-progress`

NEW:
- `epic-8: done`
- `ws4-readiness-playtesting: done`, com arquivo da story reconciliado para `done`
- adicionar uma nova epic de validacao em `backlog` apos aprovacao

Rationale: alinhar a fonte de verdade operacional com o estado real dos artefatos e liberar o planejamento do proximo ciclo.

### New Epic Proposal

OLD:
- Nao ha Epic 9 definida.

NEW:
- **Epic 9: Playtesting Guiado, Triagem de Achados e Consolidacao do MVP**

Stories sugeridas:

1. **9.1 Executar roteiro cliente de playtesting com captura estruturada de evidencias**
2. **9.2 Executar roteiro interno/admin separado e registrar gaps por papel**
3. **9.3 Consolidar achados por severidade e converter bloqueadores em backlog acionavel**
4. **9.4 Emitir recomendacao go / fix / defer para o proximo ciclo**

Rationale: transformar a recomendacao da retrospectiva em um backlog real e executavel.

### Story WS.4

OLD:
- `status: in-progress`
- tarefas 2-7 ainda abertas no corpo da story

NEW:
- `status: done`
- adicionar nota de reconciliacao explicando que a readiness foi considerada suficiente para iniciar playtesting controlado
- mover itens tecnicos residuais para backlog ou para a nova Epic 9, se ainda forem necessarios

Rationale: o objetivo da story como gate de readiness foi atingido no plano de sprint, mesmo que existam melhorias futuras possiveis.

### Priority Shift

OLD:
- tendencia implicita de continuar expandindo observabilidade, admin UX e refinamentos tecnicos sem nova evidencia externa

NEW:
- prioridade oficial do proximo sprint:
  1. executar playtesting
  2. registrar evidencias
  3. triar bloqueadores
  4. so entao abrir novas stories de implementacao

Rationale: manter disciplina de MVP e proteger foco do time.

## 6. PRD MVP Impact and High-Level Action Plan

### MVP Impact

O MVP nao precisa ser redefinido. Ele precisa ser **validado**. A fronteira de escopo ja foi corrigida em 2026-04-24; agora o produto esta pronto para um ciclo de evidencia que confirme se a jornada simplificada realmente funciona em sessao assistida.

### High-Level Action Plan

1. Reconciliar status e artefatos abertos do ciclo atual.
2. Formalizar a nova epic de validacao.
3. Rodar o `PLAYTESTING_GUIDE.md` com o dataset demo.
4. Rodar o `ADMIN_PLAYTESTING_GUIDE.md` separadamente para a jornada interna.
5. Registrar achados por severidade:
   - bloqueador
   - melhoria necessaria antes de nova demo
   - melhoria futura / backlog
6. Converter apenas os achados priorizados em novas stories de implementacao.

## 7. Handoff

### Scope Classification

Moderate

### Recipients

- **Product Owner / Planning**: fechar o sprint atual documentalmente e abrir a Epic 9 com stories de validacao.
- **Developer**: reconciliar `sprint-status.yaml`, atualizar a story WS.4 apos aprovacao e tratar bloqueadores que surgirem do playtesting.
- **QA / Playtesting Lead**: executar os roteiros cliente e admin, coletar evidencia e sintetizar achados.

### Success Criteria

- O backlog passa a refletir explicitamente que o proximo ciclo e de validacao, nao de expansao por inercia.
- `epic-8` fica encerrada formalmente.
- `ws4-readiness-playtesting` deixa de conflitar com o estado consolidado.
- Existe uma lista priorizada de achados reais antes da abertura de novas features.

## 8. Proposed Handoff Summary

- **Issue addressed:** falta de definicao formal do proximo ciclo apos a correcao de escopo e conclusao pratica do Epic 8
- **Change scope:** Moderate
- **Artifacts to update after approval:** `sprint-status.yaml`, `ws4-readiness-playtesting.md`, backlog/artefato da nova Epic 9
- **Routed to:** Product Owner / Developer / QA-Playtesting
