# Sprint Change Proposal - Separacao entre Gestor Cliente e Admin Mercavejo

**Data:** 2026-04-24
**Projeto:** SISTEMA ADALTO
**Modo assumido:** Batch
**Status:** proposed-and-applied-to-artifacts

## 1. Issue Summary

O planejamento e parte da implementacao ampliaram o papel do gestor do cliente para alem do escopo original do produto. O SISTEMA ADALTO nasceu como facilitador de distribuicao de holerites e cartoes de ponto, mas os artefatos passaram a tratar o gestor como usuario de observabilidade, auditoria, indicadores, fila de excecoes e suporte operacional detalhado.

Essa ampliacao cria ambiguidade entre usuario cliente e operador interno da Mercavejo, complica a UX do gestor e desvia o produto para um painel de governanca operacional que nao faz parte da proposta principal.

## 2. Checklist de Analise

- [x] 1.1 Trigger identificado: conflito revelado pela ampliacao do papel `rh_gestor` em PRD, UX, epics e UI.
- [x] 1.2 Problema definido: misunderstanding do escopo original e contaminacao do papel cliente com capacidades de operacao privilegiada.
- [x] 1.3 Evidencias reunidas: Jornada 4 do PRD, FR6/FR25-FR29/FR37-FR38, Epic 4, UX com indicadores para gestor, RBAC com acesso a auditoria e navegacao `/rh`.
- [x] 2.1 Epic atual afetada: Epic 4 precisava ser reposicionada como operacao interna.
- [x] 2.2 Mudancas em epic: Epic 4 redefinida como observabilidade interna; FR26 movido conceitualmente para o fluxo funcional de lotes.
- [x] 2.3 Impacto em outras epics: Epic 1 (RBAC), Epic 3 (status funcional de envio), Epic 8 (dashboard premium do RH) e navegacao `/rh`.
- [x] 2.4 Novas epics: nao foi necessario criar nova epic; a separacao foi absorvida com redefinicao de escopo.
- [x] 2.5 Prioridade: observabilidade passa a ser interna/admin; jornada do gestor fica simplificada e priorizada.
- [x] 3.1 PRD revisado: jornadas, RBAC matrix, MVP feature set e FRs atualizados.
- [x] 3.2 Arquitetura revisada: authorization pattern ajustado para distinguir gestor cliente e admin privilegiado.
- [x] 3.3 UX revisada: gestor passa a navegar entre lotes, historico e suporte; auditoria/indicadores ficam para admin interno.
- [x] 3.4 Artefatos secundarios revisados: RBAC do codigo, navegacao lateral, guardas de rota e sprint-status.
- [x] 4.1 Direct Adjustment: viavel, baixo risco de produto e medio esforco de realinhamento.
- [ ] 4.2 Potential Rollback: nao recomendado; o ajuste por RBAC e reposicionamento preserva parte relevante da implementacao.
- [x] 4.3 PRD MVP Review: viavel e recomendado; MVP fica mais coerente e disciplinado.
- [x] 4.4 Caminho selecionado: Hybrid = Direct Adjustment + MVP Review.
- [x] 5.1-5.5 Proposta, impacto, recomendacao, plano e handoff consolidados abaixo.

## 3. Impact Analysis

### Epic Impact

- Epic 1: RBAC passa a retirar `audit:read` do gestor e manter foco em acompanhamento funcional.
- Epic 3: gestor cliente continua com envio e acompanhamento do proprio lote; tratamento profundo de excecoes sai da jornada cliente.
- Epic 4: redefinida como observabilidade, auditoria e suporte operacional interno.
- Epic 8: dashboard RH premium deixa de ser experiencia para gestor e passa a exigir alinhamento com area admin.

### Artifact Conflicts

- `prd.md`: conflito direto em Jornada 4, RBAC matrix, MVP feature set e FR6/FR25-FR29/FR37-FR38.
- `epics.md`: conflito em FR inventory, FR coverage map e stories da Epic 4.
- `ux-design-specification.md`: conflito em usuarios-alvo, navegacao e uso de componentes de excecao/auditoria.
- `architecture.md`: conflito no authorization pattern e na separacao semantica de papeis.

### Technical Impact

- `src/lib/auth/rbac.ts`: gestor perde acesso de auditoria e passa a ter permissao funcional de escrita.
- `src/components/layout/AppShell.tsx`: navegacao agora depende do papel real do tenant.
- `src/app/rh/page.tsx`: dashboard principal bifurcado entre experiencia cliente simplificada e experiencia interna.
- `src/app/rh/indicadores/page.tsx`: restrito a `admin_plataforma`.
- `src/app/rh/auditoria/page.tsx`: restrito a `suporte` e `admin_plataforma`.
- `src/app/rh/excecoes/page.tsx`: restrito a `admin_plataforma`.

## 4. Recommended Approach

### Chosen Path

Hybrid: ajustar artefatos existentes e reduzir o MVP de volta ao escopo original, sem rollback amplo da base ja implementada.

### Rationale

- Preserva investimento tecnico util em auditoria/observabilidade, apenas reposicionando-o como area interna.
- Simplifica a experiencia do cliente sem exigir replanejamento completo do produto.
- Reduz risco de novas implementacoes seguirem um entendimento errado do papel do gestor.
- Melhora coerencia entre narrativa de produto, backlog e guardas reais de acesso.

### Effort / Risk / Timeline

- Esforco: medio
- Risco: baixo a medio
- Impacto de cronograma: pequeno, concentrado em alinhamento de artefatos e UX/RBAC

## 5. Detailed Change Proposals

### PRD

OLD:
- Gestor via metricas, trilhas operacionais, KPIs, indicadores e governanca.

NEW:
- Gestor importa lote, acompanha status funcional, consulta historico e abre chamado tecnico.
- Observabilidade, indicadores, alertas e auditoria detalhada ficam com admin/suporte interno.

Rationale: reposicionar o produto no escopo original e reduzir ambiguidade entre cliente e operacao interna.

### UX

OLD:
- Navegacao RH sugeria transito natural entre lote, excecao, auditoria e indicadores.

NEW:
- Gestor cliente navega entre lotes, historico e suporte.
- Admin interno navega entre excecoes, auditoria e indicadores.

Rationale: simplificacao da experiencia do gestor e consolidacao de observabilidade como area admin.

### Epics / Stories

OLD:
- Epic 4 representava visibilidade operacional para gestor de RH.

NEW:
- Epic 4 representa observabilidade e suporte operacional interno.
- Story 4.1, 4.2 e 4.3 mudam o ator para admin Mercavejo.
- Story 4.4 permanece interna, vinculada a suporte operacional Mercavejo.

Rationale: retirar do cliente o papel de operador privilegiado.

### RBAC / UI

OLD:
- `rh_gestor` tinha acesso a auditoria e visibilidade ampla na area `/rh`.

NEW:
- `rh_gestor` fica com `tenant:read` + `tenant:write`, sem `audit:read`.
- `/rh/indicadores` -> apenas `admin_plataforma`
- `/rh/auditoria` -> `suporte` e `admin_plataforma`
- `/rh/excecoes` -> apenas `admin_plataforma`

Rationale: impedir contradicao entre documentacao e comportamento real do produto.

## 6. MVP Impact and Action Plan

### MVP Impact

O MVP continua viavel e fica mais coerente. O que muda nao e o nucleo tecnico de distribuicao documental, mas a fronteira de quem enxerga operacao privilegiada.

### High-Level Action Plan

1. Tratar gestor e operador cliente como experiencia funcional de envio/publicacao.
2. Consolidar observabilidade, excecoes, auditoria e investigacao como area interna/admin.
3. Revisar telas premium e backlog remanescente para evitar reintroducao do escopo expandido.
4. Continuar implementacao e UX a partir dessa separacao.

## 7. Handoff

### Scope Classification

Moderate

### Recipients

- Product/Planning: continuar backlog e UX sob a nova fronteira entre cliente e operacao interna.
- Developer: manter RBAC e navegacao coerentes com a separacao.
- UX: detalhar dashboard cliente simplificado e area admin interna como experiencias distintas.

### Success Criteria

- Gestor nao enxerga indicadores, auditoria, fila de excecoes ou alertas operacionais.
- Gestor consegue enviar lote, acompanhar resultado funcional, consultar historico e abrir chamado tecnico.
- Admin interno concentra auditoria, excecoes, indicadores e recuperacao operacional.
- PRD, UX, epics e sprint-status contam a mesma historia.
