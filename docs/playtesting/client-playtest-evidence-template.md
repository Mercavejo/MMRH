# Template de Evidencias de Playtesting Cliente

Este arquivo e artefato humano canonico da Story 9.1.

## Regras

- Usar este template apenas para jornada de cliente.
- Nao misturar evidencias de `admin Mercavejo`.
- Sempre preencher `correlation_id` quando existir resposta tecnica associada.
- Quando a evidencia vier do pacote exportado, copiar tambem `batch_id`, `case_id`, `document_id` ou `user_id` aplicavel.

## Sessao

- data_hora:
- ambiente:
- tenant_slug: `demo-playtesting-tenant`
- papel_principal: `gestor_cliente`
- operador:
- observacoes_gerais:

## Evidencias por etapa

| etapa | papel | resultado_esperado | resultado_observado | nivel_de_friccao | correlation_id | links_ids_de_apoio | acao_sugerida |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dashboard_cliente | gestor_cliente | Dashboard carrega resumo funcional do ultimo envio sem expor areas internas. |  | none/low/medium/high |  | batch_id= / case_id= / document_id= / user_id= |  |
| upload_lote | gestor_cliente | Upload valida e retorna lote com mensagem funcional clara. |  | none/low/medium/high |  | batch_id= |  |
| historico_envio | gestor_cliente | Historico do lote mostra status funcional e proximo passo. |  | none/low/medium/high |  | batch_id= |  |
| suporte | gestor_cliente | Consulta ou registro de suporte funciona sem abrir areas internas. |  | none/low/medium/high |  | case_id= / batch_id= |  |
| troca_para_colaborador | colaborador | Colaborador ve apenas seus proprios documentos. |  | none/low/medium/high |  | document_id= / user_id= |  |

## Sessao modelo

| etapa | papel | resultado_esperado | resultado_observado | nivel_de_friccao | correlation_id | links_ids_de_apoio | acao_sugerida |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dashboard_cliente | gestor_cliente | Dashboard carrega resumo funcional do ultimo envio sem expor areas internas. | Dashboard exibiu ultimo lote publicado e CTA de envio. | low | `copiar_do_pacote_exportado` | batch_id=`copiar_do_pacote_exportado` | Revisar clareza do texto se tester pedir mais contexto. |
| upload_lote | gestor_cliente | Upload valida e retorna lote com mensagem funcional clara. | PDF `exemplomulti.pdf` validado e lote criado. | none | `copiar_do_post_/api/v1/rh/batches` | batch_id=`copiar_do_response` | Nenhuma acao corretiva imediata. |
| historico_envio | gestor_cliente | Historico do lote mostra status funcional e proximo passo. | Painel de lote mostrou status e quantidade processada. | none | `copiar_do_get_/api/v1/rh/batches/[batchId]` | batch_id=`mesmo_do_upload` | Nenhuma acao corretiva imediata. |
| suporte | gestor_cliente | Consulta ou registro de suporte funciona sem abrir areas internas. | Caso tecnico consultado sem acesso a auditoria admin. | low | `copiar_do_get_/api/v1/support/cases/[caseId]` | case_id=`case_id`; batch_id=`batch_id` | Confirmar se linguagem de suporte esta clara para cliente. |
| troca_para_colaborador | colaborador | Colaborador ve apenas seus proprios documentos. | Lista exibiu somente holerites do proprio usuario. | none | `copiar_do_get_/api/v1/employee/documents` | user_id=`colaborador`; document_id=`opcional` | Nenhuma acao corretiva imediata. |
