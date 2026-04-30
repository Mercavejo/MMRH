# Epic 9: Playtesting Guiado, Triagem de Achados e Consolidacao do MVP

Executar a validacao assistida do MVP em contexto realista, separar achados por papel e transformar apenas os bloqueadores comprovados em backlog de implementacao.

**Objetivo do ciclo:** trocar expansao por evidencia. Antes de abrir novas features, o time deve observar usuarios usando o fluxo cliente e o fluxo admin interno, registrar friccoes e decidir com base em severidade e valor.

## Story 9.1: Executar Playtesting Cliente com Captura Estruturada de Evidencias

As a responsavel pelo playtesting,
I want conduzir o roteiro cliente de ponta a ponta com registro estruturado,
So that possamos validar se a jornada simplificada de envio e acompanhamento realmente funciona para clientes-piloto.

**Acceptance Criteria:**

- O roteiro de `docs/PLAYTESTING_GUIDE.md` e executado integralmente com dataset demo.
- Cada etapa gera registro de evidencia com observacao, resultado esperado, resultado observado e nivel de friccao.
- Ficam registrados pelo menos: clareza do dashboard, upload, historico funcional, suporte e troca de visao para colaborador.

## Story 9.2: Executar Playtesting Admin Separado e Registrar Gaps por Papel

As a responsavel pelo playtesting interno,
I want validar a jornada admin em roteiro separado,
So that auditoria, indicadores e investigacao operacional sejam avaliados sem contaminar a experiencia do gestor cliente.

**Acceptance Criteria:**

- O roteiro de `docs/ADMIN_PLAYTESTING_GUIDE.md` e executado com usuario admin.
- Os achados ficam separados por papel: gestor cliente, colaborador e admin Mercavejo.
- Qualquer vazamento de escopo entre papeis e classificado como bloqueador.

## Story 9.3: Consolidar Achados e Converter Bloqueadores em Backlog

As a product owner,
I want consolidar os achados do playtesting em uma triagem objetiva,
So that apenas problemas reais e priorizados virem novas stories de implementacao.

**Acceptance Criteria:**

- Todos os achados sao classificados em `bloqueador`, `melhoria antes da proxima demo` ou `futuro backlog`.
- Cada bloqueador tem descricao reproduzivel, impacto e sugestao de destino.
- O backlog resultante diferencia claramente correcao de bug, hardening e nova funcionalidade.

## Story 9.4: Emitir Recomendacao Go / Fix / Defer para o Proximo Ciclo

As a lider do ciclo,
I want fechar a rodada com uma recomendacao explicita,
So that o time saiba se deve seguir para nova implementacao, corrigir antes de continuar ou adiar expansoes.

**Acceptance Criteria:**

- E emitida uma recomendacao final entre `go`, `fix` ou `defer`.
- A recomendacao referencia evidencias coletadas e severidade dos achados.
- O proximo ciclo fica definido sem ambiguidade no backlog e no sprint status.

## Criterios de Encerramento da Epic

- Roteiro cliente executado com evidencia registrada.
- Roteiro admin executado separadamente.
- Achados triados e priorizados.
- Recomendacao final emitida para orientar o proximo ciclo.
