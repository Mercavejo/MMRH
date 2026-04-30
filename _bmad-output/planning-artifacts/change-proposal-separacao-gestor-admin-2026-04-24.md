---
title: "Change Proposal: Separacao de Funcoes entre Gestor e Admin"
date: "2026-04-24"
status: "proposed"
project: "SISTEMA ADALTO"
recommended_skill: "bmad-correct-course"
recommended_followup: "bmad-edit-prd"
---

# Proposta de Correcao de Escopo

## Resumo da Mudanca

O SISTEMA ADALTO deve manter foco disciplinado em seu escopo principal: facilitar a distribuicao segura e organizada de holerites e cartoes de ponto. Ao longo do planejamento e da implementacao, o papel `gestor` foi ampliado para incluir governanca operacional, indicadores, auditoria, suporte e observabilidade. Essa ampliacao conflita com a visao original do produto.

Esta proposta corrige o curso do projeto ao separar claramente dois contextos:

1. **Gestor do cliente/tenant**: usa o sistema para enviar lotes, acompanhar o resultado do envio e, em caso de problema, abrir chamado tecnico para a equipe Mercavejo.
2. **Admin**: papel interno ou privilegiado, responsavel por observabilidade, auditoria, fila de excecoes, indicadores operacionais, status do sistema, acuracia e investigacao.

## Problema Identificado

Os artefatos atuais passaram a tratar o `rh_gestor` como um usuario com acesso a:

- fila de excecoes
- indicadores de entrega e acuracia
- status operacional e status do sistema
- auditoria detalhada
- pendencias operacionais
- fluxo de suporte e consolidacao de chamados
- toda a visao de "Indicadores RH"

Isso desloca o produto de um facilitador de distribuicao documental para um painel mais amplo de governanca operacional de RH, o que nao corresponde ao escopo desejado.

## Decisao de Produto

### Papel `gestor`

O `gestor` deve ter uma experiencia simples, objetiva e restrita ao uso funcional do sistema no tenant:

- enviar/importar lote
- acompanhar status do lote enviado
- conferir se o envio foi concluido com sucesso
- consultar historico de envios do proprio tenant
- visualizar mensagens de erro em nivel funcional, sem diagnostico tecnico profundo
- abrir chamado tecnico para a equipe Mercavejo quando houver problema

### Papel `admin`

O `admin` deve concentrar as funcoes de observabilidade e operacao avancada:

- fila de excecoes
- acuracia de envios
- acuracia de roteamento
- status do sistema
- auditoria
- pendencias operacionais
- alertas operacionais
- consolidacao e tratamento de chamados
- investigacao tecnica
- reprocessamento e acao corretiva avancada
- secao completa de "Indicadores RH"

## Matriz de Permissoes Proposta

| Capacidade | Gestor | Admin |
| --- | --- | --- |
| Enviar lote | Sim | Sim |
| Acompanhar status do proprio envio | Sim | Sim |
| Consultar historico de lotes | Sim | Sim |
| Ver mensagem de erro funcional do lote | Sim | Sim |
| Abrir chamado tecnico para Mercavejo | Sim | Sim |
| Fila de excecoes | Nao | Sim |
| Acuracia de envios | Nao | Sim |
| Acuracia de roteamento | Nao | Sim |
| Status do sistema | Nao | Sim |
| Auditoria detalhada | Nao | Sim |
| Pendencias operacionais | Nao | Sim |
| Alertas operacionais | Nao | Sim |
| Consolidacao de chamados | Nao | Sim |
| Recuperacao operacional | Nao | Sim |
| Reprocessamento tecnico avancado | Nao | Sim |
| Secao "Indicadores RH" | Nao | Sim |

## Experiencia Esperada por Perfil

### Gestor

O gestor nao deve precisar interpretar acuracia, auditoria, fila de excecoes ou saude do sistema. Ele precisa apenas:

- enviar o lote
- ver se o lote foi processado
- saber se houve sucesso, pendencia ou falha
- acionar suporte Mercavejo quando houver problema

### Admin

O admin deve ter uma visao operacional e diagnostica completa, inclusive para agir nos casos em que o gestor so percebe "algo deu errado".

## Redefinicao de Escopo

### Mantido no escopo do produto

- distribuicao de holerites e cartoes de ponto
- envio/importacao de lotes
- acompanhamento funcional do processamento
- publicacao segura por colaborador
- historico de envios
- abertura de chamado tecnico

### Fora do escopo do gestor

- fila de excecoes
- indicadores de performance operacional
- acuracia de envio
- acuracia de roteamento
- status detalhado do sistema
- auditoria detalhada
- pendencias operacionais
- consolidacao de suporte
- investigacao tecnica
- secao completa de indicadores

## Impacto nos Artefatos Atuais

### PRD

Revisar especialmente:

- FR6: `RH/DP Gestor pode visualizar metricas e trilhas operacionais do tenant`
- FR25: `RH/DP Gestor pode visualizar indicadores de taxa de entrega, acuracia de roteamento e pendencias`
- FR26: `RH/DP Gestor pode acompanhar status por lote, periodo e unidade organizacional`
- FR27: `Sistema pode emitir alertas operacionais quando houver desvio de qualidade ou falha de lote`
- FR28: `Suporte autorizado pode consultar linha do tempo de eventos por usuario, documento e lote`
- FR29: `Sistema pode manter evidencias necessarias para investigacao e resolucao de incidentes operacionais`
- FR37: `Suporte autorizado pode acionar fluxo de recuperacao operacional para incidentes recorrentes`
- FR38: `Sistema pode consolidar chamados relacionados a documento, lote e usuario para analise operacional`

Direcao recomendada:

- mover capacidades operacionais avancadas para `admin`
- redefinir `gestor` como perfil de envio, acompanhamento funcional e abertura de chamado

### Jornadas do PRD

Reescrever especialmente:

- Jornada 4 - RH/DP Gestor

Nova direcao recomendada:

- o gestor envia ou acompanha o lote
- confirma se a publicacao terminou corretamente
- se houver erro ou pendencia, abre chamado tecnico para Mercavejo

Reduzir ou remover:

- dashboard executivo
- KPIs operacionais para gestor
- governanca baseada em indicadores

### UX Design

Revisar:

- mencoes a gestores acompanhando indicadores
- uso de auditoria e suporte como experiencia do tenant
- navegacao RH com densidade orientada a excecoes para gestor

Direcao recomendada:

- gestor com navegacao curta: lotes, historico, status, chamado tecnico
- admin com navegacao operacional avancada: excecoes, auditoria, indicadores, suporte

### Epics

Reclassificar:

- Epic 4 deve deixar de representar uma experiencia do gestor
- Epic 4 deve ser tratado como dominio admin/operacao interna

### Stories ja implementadas ou planejadas que entram em conflito com a nova direcao

- `4.2` Dashboard de Indicadores e Status Operacional
- `4.4` Fluxo de Suporte e Consolidacao de Chamados
- `8.1` Dashboard RH com Dados Reais e Visual Premium
- rotas e paginas ligadas a `/rh/indicadores`
- rotas e paginas ligadas a `/rh/auditoria`

## Diretriz de UX e RBAC a partir desta mudanca

### Gestor

- interface enxuta
- sem acesso a menus de diagnostico
- sem acesso a auditoria
- sem acesso a indicadores de performance operacional
- com acesso a abertura de chamado tecnico

### Admin

- acesso total a observabilidade e operacao
- foco em diagnostico, correcao e rastreabilidade
- permissao para visualizar auditoria, excecoes e indicadores

## Recomendacao de Ajuste no Modelo de Papeis

Se a nomenclatura atual continuar sendo usada no codigo:

- `rh_operator`: pode permanecer ligado a operacao de envio/publicacao
- `rh_gestor`: deve ser simplificado para acompanhamento funcional do envio, sem dashboard operacional avancado
- `admin_plataforma`: deve absorver indicadores, auditoria, excecoes, suporte e observabilidade

Se desejado em etapa futura, pode haver renomeacao semantica para reduzir ambiguidade:

- `gestor_cliente`
- `operador_cliente`
- `admin_mercavejo`

## Decisao Recomendada para o BMad

1. Executar `bmad-correct-course` com esta proposta como base.
2. Atualizar o PRD com `bmad-edit-prd`.
3. Ajustar epics e stories impactadas para refletir a nova separacao.
4. Rever RBAC e navegacao da area RH para esconder itens admin do perfil gestor.

## Texto Curto para Colar no `bmad-correct-course`

Precisamos corrigir o escopo do SISTEMA ADALTO. O produto foi concebido como um facilitador e distribuidor de holerites e cartoes de ponto, mas o planejamento e parte da implementacao ampliaram demais o papel do gestor. Funcoes como fila de excecoes, acuracia de envios, acuracia de roteamento, status do sistema, auditoria, pendencias operacionais e toda a secao de Indicadores RH nao devem ser visiveis para gestores. Essas capacidades devem ficar restritas ao papel de admin, associado a operacao interna/privilegiada da Mercavejo. O gestor deve apenas enviar lotes, acompanhar o resultado do envio, consultar historico funcional do proprio envio e, em caso de problema, abrir chamado tecnico para a equipe Mercavejo. Precisamos atualizar PRD, jornadas, UX, epics, stories e RBAC para refletir essa separacao.

## Resultado Esperado da Correcao

- reposicionamento claro do produto dentro do escopo original
- simplificacao da experiencia do gestor
- consolidacao da observabilidade como area admin
- reducao de ambiguidade entre usuario cliente e operador interno
- base mais coerente para seguir implementacao e UX
