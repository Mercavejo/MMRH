# Template de Evidencias de Playtesting Admin

Este arquivo e artefato humano canonico da Story 9.2.

## Regras

- Usar este template apenas para jornada interna/admin.
- Nao misturar evidencias de `gestor cliente` como etapa principal.
- Preencher `papel` com `admin_plataforma`, `suporte`, `rh_gestor` ou `colaborador` apenas quando comparativo.
- Sempre preencher `correlation_id` quando existir resposta tecnica associada.
- Quando a evidencia vier do pacote exportado, copiar tambem `batch_id`, `case_id`, `document_id` ou `user_id` aplicavel.
- Classificar `vazamento_de_escopo` como `bloqueador`.
- Registrar `gap_observabilidade` mesmo quando a tela funcionar mas faltar evento, trilha ou IDs tecnicos.

## Sessao

- data_hora:
- ambiente:
- tenant_slug: `demo-playtesting-tenant`
- papel_principal: `admin_plataforma`
- operador:
- observacoes_gerais:

## Evidencias por etapa

| etapa | papel | resultado_esperado | resultado_observado | nivel_de_friccao | classificacao | correlation_id | links_ids_de_apoio | acao_sugerida |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dashboard_interno | admin_plataforma | Dashboard interno carrega leitura operacional consolidada sem depender do roteiro cliente. |  | none/low/medium/high | ok/melhoria/gap_observabilidade/bloqueador |  | batch_id= / alert_id= |  |
| indicadores_alertas | admin_plataforma | Indicadores e alertas operacionais carregam com filtros e trilha tecnica coerentes. |  | none/low/medium/high | ok/melhoria/gap_observabilidade/bloqueador |  | batch_id= / correlation_extra= |  |
| fila_excecoes | admin_plataforma | Fila de excecoes exibe pendencias operacionais sem entrar na jornada cliente. |  | none/low/medium/high | ok/melhoria/gap_observabilidade/bloqueador |  | batch_id= / exception_id= |  |
| auditoria_operacional | admin_plataforma | Auditoria mostra timeline, filtros e eventos coerentes por tenant. |  | none/low/medium/high | ok/melhoria/gap_observabilidade/bloqueador |  | batch_id= / document_id= / user_id= |  |
| consolidacao_suporte | suporte | Consolidacao tecnica do caso pode ser revisada por `suporte` sem vazar escopo de cliente. |  | none/low/medium/high | ok/melhoria/gap_observabilidade/bloqueador |  | case_id= / batch_id= / document_id= |  |
| fronteira_negativa_gestor | rh_gestor | `rh_gestor` nao visualiza nem acessa areas admin por menu, rota ou payload. |  | none/low/medium/high | ok/melhoria/gap_observabilidade/bloqueador |  | rota_testada= / response_code= |  |
| comparativo_colaborador | colaborador | Se citado, colaborador aparece apenas como comparativo de escopo, nunca como foco da jornada admin. |  | none/low/medium/high | ok/melhoria/gap_observabilidade/bloqueador |  | document_id= / user_id= |  |

## Sessao modelo

| etapa | papel | resultado_esperado | resultado_observado | nivel_de_friccao | classificacao | correlation_id | links_ids_de_apoio | acao_sugerida |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| dashboard_interno | admin_plataforma | Dashboard interno carrega leitura operacional consolidada sem depender do roteiro cliente. | Cards de operacao e CTA de importacao carregaram sem misturar fluxo cliente. | low | ok | `copiar_do_pacote_exportado` | batch_id=`ultimo_lote` | Revisar copy apenas se tester pedir mais contexto. |
| indicadores_alertas | admin_plataforma | Indicadores e alertas operacionais carregam com filtros e trilha tecnica coerentes. | Indicadores responderam com dados e alertas visiveis no mesmo contexto interno. | none | ok | `copiar_do_get_/api/v1/rh/indicators` | correlation_extra=`copiar_do_get_/api/v1/rh/alerts`; batch_id=`opcional` | Nenhuma acao corretiva imediata. |
| fila_excecoes | admin_plataforma | Fila de excecoes exibe pendencias operacionais sem entrar na jornada cliente. | Fila carregou lote com ambiguidades e permitiu leitura das pendencias. | low | ok | `copiar_do_pacote_exportado` | batch_id=`batch_id`; exception_id=`opcional` | Registrar melhoria apenas se faltar contexto visual. |
| auditoria_operacional | admin_plataforma | Auditoria mostra timeline, filtros e eventos coerentes por tenant. | Timeline exibiu eventos do lote e filtros responderam no tenant correto. | none | ok | `copiar_do_get_/api/v1/audit-events` | batch_id=`batch_id`; user_id=`opcional` | Nenhuma acao corretiva imediata. |
| consolidacao_suporte | suporte | Consolidacao tecnica do caso pode ser revisada por `suporte` sem vazar escopo de cliente. | Caso tecnico consolidado com links de lote e documento para investigacao. | low | ok | `copiar_do_get_/api/v1/support/cases/[caseId]` | case_id=`case_id`; batch_id=`batch_id`; document_id=`document_id` | Validar se suporte precisa instrucoes adicionais. |
| fronteira_negativa_gestor | rh_gestor | `rh_gestor` nao visualiza nem acessa areas admin por menu, rota ou payload. | Navegacao ocultou areas internas e acesso direto retornou bloqueio esperado. | none | ok | `copiar_do_teste_negativo` | rota_testada=`/rh/indicadores`; response_code=`403/redirect` | Se qualquer payload admin aparecer, reclassificar para `bloqueador`. |
