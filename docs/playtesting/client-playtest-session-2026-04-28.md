# Evidencias de Playtesting Cliente — Sessao Real 2026-04-28

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
