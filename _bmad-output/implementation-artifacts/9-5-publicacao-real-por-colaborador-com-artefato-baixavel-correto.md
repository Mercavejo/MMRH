---
story_id: "9.5"
story_key: "9-5-publicacao-real-por-colaborador-com-artefato-baixavel-correto"
epic: "9"
title: "Publicacao Real por Colaborador com Artefato Baixavel Correto"
status: "done"
created_date: "2026-04-30"
last_updated: "2026-04-30"
---

# Story 9.5: Publicacao Real por Colaborador com Artefato Baixavel Correto

**Epic:** Epic 9 - Playtesting Guiado, Triagem de Achados e Consolidacao do MVP  
**Story ID:** 9.5  
**Priority:** High  
**Status:** done  

> Story de correcao gerada a partir do gate `fix` da Story 9.4. O objetivo e fechar lacuna funcional entre publicacao de lote, materializacao do documento do colaborador e entrega do artefato baixavel real.

---

## Story Statement

As a colaborador autenticado,
I want receber e baixar o documento real que foi publicado para mim a partir do lote processado,
So that a plataforma cumpra a promessa central de distribuicao correta, segura e verificavel por colaborador.

---

## Acceptance Criteria

### AC 1: Publicacao persiste ponte real entre lote e artefato baixavel

**Given** um lote PDF multipagina validado, roteado e elegivel para publicacao dentro do tenant autenticado  
**When** o RH/DP publicar o lote  
**Then** cada item roteado deve materializar um registro de documento do colaborador com referencia real ao artefato publicado  
**And** essa referencia deve permitir localizar o arquivo ou segmento correto sem depender de placeholder sintetico  
**And** a publicacao deve manter vinculo rastreavel entre `batch_id`, `document_id`, `page_index` ou intervalo equivalente, `user_id` e chave real de armazenamento.

### AC 2: Cada colaborador recebe somente seu proprio artefato publicado

**Given** um lote com multiplas paginas e multiplos colaboradores  
**When** a publicacao concluir  
**Then** cada registro em `employee_documents` deve apontar para exatamente um colaborador destino e um artefato baixavel correspondente  
**And** o sistema nunca deve compartilhar o mesmo artefato final entre colaboradores diferentes sem segmentacao explicita segura  
**And** qualquer item sem destino ativo, sem referencia de pagina consistente ou sem artefato resolvivel deve bloquear a publicacao com erro operacional rastreavel.

### AC 3: Download entrega arquivo real e nao placeholder

**Given** um colaborador autenticado com documento publicado no proprio tenant  
**When** ele iniciar o download via rota segura existente  
**Then** a resposta final assinada deve servir bytes reais do documento correspondente  
**And** o nome do arquivo, `mime_type` e conteudo servido devem corresponder ao documento publicado  
**And** a trilha de auditoria, `correlation_id`, validacao de assinatura e enforcement de RBAC devem permanecer ativos  
**And** nenhum payload deve expor caminho interno sensivel, storage key bruta ou artefato de outro colaborador.

### AC 4: Fluxo ponta a ponta fica verificavel por teste integrado

**Given** o fluxo principal do produto descrito no PRD  
**When** os testes da story forem executados  
**Then** deve existir cobertura integrada do caminho `upload -> validacao/roteamento -> publicacao -> login colaborador -> /documents -> download`  
**And** o teste deve provar que o colaborador autenticado enxerga o item correto na lista e recebe o artefato correspondente  
**And** deve existir regressao garantindo que placeholder textual ou metadata desacoplada nao passam mais como download valido.

### AC 5: Gate de seguranca e consistencia permanece intacto

**Given** tenant mismatch, sessao invalida, assinatura invalida, documento nao publicado ou artefato ausente/corrompido  
**When** o endpoint de download ou a publicacao forem executados  
**Then** o sistema deve falhar com codigo coerente (`401`, `403`, `404`, `409` ou `503`, conforme o caso)  
**And** deve preservar envelope padrao `{ data, error, meta }`, `x-correlation-id`, tenant-bound e sem escrita parcial silenciosa  
**And** a reexecucao segura de publicacao nao deve duplicar documentos nem artefatos.

---

## Dependencies and Scope

### Dependencias de Historias Anteriores

- Story 2.2: download seguro e trilha de auditoria do portal do colaborador.
- Story 2.5: vinculo seguro do colaborador por codigo de referencia.
- Story 3.5: publicacao segura de lote no portal.
- Story 3.6: processamento de PDF multipagina com itemizacao por pagina.
- Story 8.5: seed/demo/playtesting com troca gestor -> colaborador.
- Stories 9.3 e 9.4: triagem e gate `fix` que puxaram esta correcao como proximo ciclo.

### Evidencia que Disparou a Story

- `decision_gate.recommendation = fix` em `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- `decision-gate-log.md`: continuidade bloqueada ate corrigir falha confirmada no ciclo.
- Review da Story 2.2 registrou explicitamente que `download_url` nao iniciava download real e o fluxo servia placeholder.
- Analise do estado atual mostra `publishBatch` criando `employee_documents`, mas o download ainda depende de `storage_key` sintetica e resposta textual placeholder.

### Fora de Escopo

- Integracao com provedor externo de object storage.
- OCR novo, parser PDF alternativo ou reescrita do pipeline de importacao.
- Nova superficie de UI fora do fluxo atual de lista e download do colaborador.
- Revisao de papeis admin/gestor fora do necessario para preservar isolamento atual.

---

## Technical Requirements

### Problema Atual Confirmado

1. `publishBatch` chama `publishEmployeeDocumentsForBatch`, mas hoje a publicacao materializa apenas metadados minimos do documento em `employee_documents`.
2. `getDownloadableDocument` devolve `storage_key` sintetica, sem garantia de existencia de artefato real.
3. `employee-download-handler` ainda serve corpo placeholder no fluxo assinado, nao bytes reais do documento.
4. O upload/import atual valida e persiste lote, mas nao preserva artefato-fonte reutilizavel para download final por colaborador.

### Resultado Tecnico Obrigatorio

1. Persistir o arquivo-fonte ou artefato derivado de forma controlada no backend no momento apropriado do fluxo de importacao/publicacao.
2. Modelar metadados suficientes para resolver o artefato final de cada `employee_document`:
   - chave/path real do artefato;
   - nome de arquivo final;
   - `mime_type`;
   - referencia de pagina unica ou intervalo;
   - vinculo com `batch_id`.
3. Garantir que a publicacao so conclua quando cada item publicado tiver artefato resolvivel e colaborador ativo associado.
4. Substituir placeholder textual do handler por resposta real de arquivo/stream.

### Direcao de Implementacao Recomendada

1. Reusar o upload de lote existente em `src/app/api/v1/rh/batches/route.ts`; nao criar endpoint paralelo.
2. Introduzir adaptador interno minimo de armazenamento de documentos no backend, preferencialmente em `src/lib/documents/storage.ts` ou modulo equivalente, com raiz configuravel por ambiente.
3. A raiz de armazenamento nao deve depender de `public/` nem expor arquivos por URL publica direta.
4. Para o MVP local, armazenamento em filesystem server-side controlado e aceitavel, desde que:
   - fique fora da arvore publica;
   - seja enderecado por chave opaca;
   - permita leitura segura no download;
   - preserve isolamento por tenant e documento.
5. Nao adicionar nova dependencia se a stack atual (`pdf-parse` / `unpdf` / Node APIs) ja cobrir extração/segmentacao.

### Regras de Publicacao e Segmentacao

1. Cada item do manifest roteado e publicado deve gerar exatamente um artefato final baixavel por colaborador.
2. Se o lote-fonte for PDF multipagina, a implementacao deve preservar pagina correta para o colaborador destino, por:
   - extração de pagina para PDF individual; ou
   - artefato equivalente que mantenha exatamente o conteudo devido ao colaborador.
3. Nao e aceitavel publicar apenas metadado com `document_type` + `period_ref` sem ponte real para bytes recuperaveis.
4. Itens sem `page_index` consistente, sem artefato segmentavel ou com conflito de mapeamento devem falhar antes de `publication_status = published`.

### Regras de Download

1. Manter rota atual `GET /api/v1/employee/documents/[documentId]/download`.
2. Continuar exigindo sessao valida, papel `colaborador`, assinatura HMAC (`sig` + `exp`) e auditoria de sucesso/falha.
3. No caminho assinado final, servir arquivo real com `content-type` e `content-disposition` coerentes.
4. `response=json` pode continuar retornando URL assinada, mas a URL precisa resolver para download real.
5. Falha de leitura do artefato deve retornar erro operacional explicito, auditavel e sem vazar path interno.

### Regras de Persistencia e Schema

1. Avaliar expansao de `employee_documents` com campos adicionais, por exemplo:
   - `storage_key` real;
   - `file_name`;
   - `mime_type`;
   - `source_page_index` ou campo equivalente;
   - hash/checksum opcional se ajudar na consistencia.
2. Se o lote tambem precisar rastrear artefato-fonte, avaliar campos no schema de `batches` ou tabela suporte dedicada, sem duplicar informacao desnecessariamente.
3. Toda mudanca de schema exige migracao Drizzle e export em `src/lib/db/schema/index.ts`.

### Guardrails de Reuso

1. Nao quebrar contrato de listagem do colaborador implementado em `listEmployeeDocuments`.
2. Nao remover trilha de auditoria de download; estender somente se necessario.
3. Nao reimplementar RBAC fora de `assertTenantAction` e resolucao central de sessao.
4. Nao criar segunda rota de download para contornar o handler atual.
5. Nao mascarar placeholder como se fosse artefato real nos testes.

---

## Architecture Compliance Notes

### Regras Obrigatorias do Projeto

- Rotas novas, se forem mesmo necessarias, devem continuar em `src/app/api/v1/**/route.ts`.
- Reusar `src/lib/api/response.ts`, `src/lib/auth/session.ts`, `src/lib/auth/rbac.ts`, `src/lib/observability/correlation-id.ts`.
- Cliente de banco unico: `src/lib/db/client.ts`.
- TypeScript strict, Zod no boundary, tenant scoping em toda leitura/escrita.
- Nenhum download pode expor asset cross-tenant ou cross-user.

### Estrutura de Codigo Alvo

- `src/app/api/v1/rh/batches/route.ts`
- `src/lib/rh/batches/import-batch.ts`
- `src/lib/documents/publish-employee-documents.ts`
- `src/modules/batches/application/publish-batch.ts`
- `src/lib/documents/get-downloadable-document.ts`
- `src/lib/documents/employee-download-handler.ts`
- `src/lib/db/schema/employee-documents.ts`
- `src/lib/db/schema/batches.ts` ou tabela suporte equivalente
- `src/lib/db/schema/index.ts`
- `__tests__/publish-employee-documents.test.ts`
- `__tests__/employee-documents-download-api.test.ts`
- `__tests__/get-downloadable-document.test.ts`
- novo teste integrado do fluxo de publicacao/download

### Arquitetura Relevante Extraida

1. O PRD exige distribuicao correta e segura de documentos por colaborador, download estavel e rastreabilidade ponta a ponta.
2. A arquitetura explicita portal do colaborador separado do pipeline RH/DP, com trilha auditavel e isolamento por tenant.
3. O gate atual e de correcao, nao de expansao; logo a story deve endurecer fluxo existente, nao abrir nova superficie funcional.

---

## Previous Story Intelligence

### Story 2.2

1. Consolidou o endpoint de download, assinatura e auditoria, mas a revisao registrou lacuna critica: URL assinada nao iniciava download real.
2. O contrato de download ja esta coberto por testes de sucesso/erro e deve ser preservado.
3. Qualquer mudanca precisa manter a disciplina de nao expor `storage_key` bruta no payload JSON.

### Story 2.5

1. O vinculo por `referenceCode` ja e a base para resolucao do colaborador ativo.
2. A publicacao real deve continuar usando esse vinculo como precondicao de seguranca.

### Story 3.5

1. Ja existe transacao de publicacao e idempotencia por lote.
2. O novo comportamento deve acontecer dentro do fluxo `publishBatch`, sem abrir etapa paralela apos publicar.

### Story 3.6

1. O PDF multipagina ja foi convertido em itens individuais com `page_index` e match `codigo_colaborador` first.
2. Essa story precisa fechar o ultimo trecho: da pagina roteada ao artefato individual baixavel.

### Story 8.5 e Epic 9

1. O playtesting e o seed validam troca de conta gestor -> colaborador, mas hoje a evidência funcional se apoia em documentos seedados e nao prova download real do lote recem-publicado.
2. Esta story deve permitir que o roteiro cliente deixe de depender de placeholder ou mock implícito.

---

## Git / Code Intelligence Summary

1. Nao existe adaptador real de storage no codigo atual; so `storage_key` sintetica em `getDownloadableDocument`.
2. `persistValidatedBatchImport` persiste metadados do lote e manifest, mas nao o artefato-fonte reutilizavel.
3. `publishEmployeeDocumentsForBatch` hoje insere apenas `tenantId`, `userId`, `batchId`, `documentType`, `periodRef` e `status`.
4. O caminho assinado final em `employee-download-handler` devolve texto placeholder; esse comportamento deve ser eliminado por completo.

---

## Test Requirements Summary

- Framework: Vitest.
- Localizacao principal: `__tests__/**/*.test.ts(x)`.
- Cobertura minima obrigatoria:
  1. publicacao persiste referencia real de artefato por documento;
  2. download assinado serve bytes reais e headers corretos;
  3. falha de artefato ausente/corrompido retorna erro coerente;
  4. idempotencia nao duplica documento nem artefato;
  5. teste integrado `upload -> process -> publish -> login colaborador -> list -> download`;
  6. regressao garantindo que placeholder textual nao e mais retorno valido;
  7. preservacao de tenant isolation e RBAC.

---

## Tasks / Subtasks

### Task 1: Persistencia do Artefato-Fonte e Metadados Minimos (AC: 1, 5)

- [x] Mapear onde o upload atual deve persistir o arquivo-fonte de forma segura.
- [x] Implementar adaptador minimo de armazenamento server-side reaproveitavel.
- [x] Persistir metadata suficiente para reencontrar o lote-fonte e/ou artefatos derivados por documento.
- [x] Cobrir falhas de persistencia sem marcar lote como pronto indevidamente.

### Task 2: Materializacao Real na Publicacao do Lote (AC: 1, 2, 5)

- [x] Estender `publishEmployeeDocumentsForBatch` para gerar referencia real de artefato por colaborador publicado.
- [x] Garantir que cada item publicado tenha pagina/segmento correto e colaborador ativo vinculado.
- [x] Bloquear publicacao quando nao houver artefato resolvivel ou segmentacao segura.
- [x] Preservar transacao e idempotencia do fluxo de publicacao.

### Task 3: Download Real no Portal do Colaborador (AC: 3, 5)

- [x] Atualizar `getDownloadableDocument` para resolver metadata real do artefato publicado.
- [x] Substituir corpo placeholder em `employee-download-handler` por leitura/stream de arquivo real.
- [x] Manter assinatura, auditoria, correlation_id e headers corretos.
- [x] Tratar ausencias/corrupcao do artefato com erro operacional auditavel.

### Task 4: Cobertura Integrada e Regressao (AC: 4, 5)

- [x] Criar teste integrado cobrindo `upload -> process -> publish -> login colaborador -> /documents -> download`.
- [x] Atualizar testes unitarios/dominio/API afetados.
- [x] Adicionar regressao explicita contra placeholder textual.
- [x] Validar que colaborador nao baixa artefato de outro usuario nem do tenant errado.

---

## Matriz Task -> Arquivos -> Testes

- Task 1 -> `src/app/api/v1/rh/batches/route.ts`, `src/lib/rh/batches/import-batch.ts`, novo adaptador `src/lib/documents/storage.ts` ou equivalente -> testes de importacao/storage dedicados
- Task 2 -> `src/lib/documents/publish-employee-documents.ts`, `src/modules/batches/application/publish-batch.ts`, schema(s) Drizzle -> `__tests__/publish-employee-documents.test.ts`, testes de dominio/publicacao
- Task 3 -> `src/lib/documents/get-downloadable-document.ts`, `src/lib/documents/employee-download-handler.ts`, rota de download -> `__tests__/get-downloadable-document.test.ts`, `__tests__/employee-documents-download-api.test.ts`
- Task 4 -> fluxo ponta a ponta em teste integrado novo + regressao de listagem/download -> suite integrada da story

---

## Dev Notes

### Decisoes de Enquadramento

- Esta story e `hardening` corretivo do fluxo central do produto.
- Nao introduz novo papel, nova UI principal nem novo canal de publicacao.
- Fecha gap entre promessa do PRD e implementacao atual do MVP.

### Alertas para o Dev Agent

1. Nao marcar a story pronta so porque a lista mostra item publicado; o gate real e download do artefato correto.
2. Nao usar `public/` como atalho para servir documentos sensiveis.
3. Nao manter fallback para placeholder em producao ou em testes de sucesso.
4. Nao aceitar implementacao que passe nos testes sem provar bytes reais de arquivo.

### Sugestao de Verificacao Manual

1. Resetar ambiente demo.
2. Importar PDF multipagina real do playtesting.
3. Processar e publicar lote.
4. Fazer logout do gestor.
5. Logar como colaborador.
6. Confirmar item novo em `/documents`.
7. Baixar arquivo e validar que corresponde ao documento/pagina correta do colaborador.

---

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Amelia / bmad-agent-dev)

### Debug Log References

- 2026-04-30T00:00:00-03:00 - Story carregada integralmente; workflow `bmad-dev-story` seguido desde `_bmad/bmm/config.yaml`.
- 2026-04-30T00:05:00-03:00 - Contexto tecnico lido: importacao de lote, schema `batches`/`employee_documents`, publicacao, download, testes atuais e `sprint-status.yaml`.
- 2026-04-30T09:27:00-03:00 - Implementado storage privado server-side, metadata real no schema, segmentacao PDF por pagina via `unpdf.extractPages` e download assinado com bytes reais.
- 2026-04-30T09:28:00-03:00 - Validacao concluida: `rtk npm run test:run` = 92 arquivos / 451 testes verdes; `rtk npm run lint` sem erros.
- 2026-04-30T10:04:00-03:00 - Review 9.5 concluida em 3 chunks; achados P1/P2 corrigidos; validacao final: `rtk npm run test:run` = 92 arquivos / 452 testes verdes.

### Completion Notes List

- Artefato-fonte do lote agora e persistido em raiz privada configuravel (`DOCUMENT_STORAGE_ROOT`) via adaptador `src/lib/documents/storage.ts`, com cleanup em falha transacional de importacao.
- `batches` e `employee_documents` passaram a carregar metadata real de storage/arquivo/pagina, com migracao `drizzle/migrations/20260430_document_private_artifacts.sql`.
- `publishEmployeeDocumentsForBatch` agora exige artefato-fonte resolvivel, valida `page_index`, extrai PDF individual por pagina e persiste artefato real por colaborador antes da gravacao do documento publicado.
- `getDownloadableDocument` bloqueia metadata placeholder e `employee-download-handler` passou a servir bytes reais com `content-type`, `content-length`, `content-disposition`, auditoria e erro operacional auditavel para artefato ausente/corrompido.
- Cobertura adicionada/atualizada para importacao com storage, publicacao por pagina, metadata real de download, erro 503 de artefato ausente e fluxo integrado `upload -> publish -> list -> signed download`, incluindo regressao explicita contra placeholder.
- Pos-review, foram corrigidos: registro da migration no journal Drizzle, mapeamento `503` para falhas operacionais de artefato/storage, auditoria de sucesso somente no consumo final da URL assinada e robustez do teste integrado para validar `documentId` real ponta a ponta.

### File List

- `src/lib/documents/storage.ts`
- `src/lib/rh/batches/import-batch.ts`
- `src/app/api/v1/rh/batches/route.ts`
- `src/lib/db/schema/batches.ts`
- `src/lib/db/schema/employee-documents.ts`
- `src/modules/batches/infrastructure/batch-repository.ts`
- `src/modules/batches/application/publish-batch.ts`
- `src/lib/documents/publish-employee-documents.ts`
- `src/lib/documents/get-downloadable-document.ts`
- `src/lib/documents/employee-download-handler.ts`
- `drizzle/migrations/20260430_document_private_artifacts.sql`
- `__tests__/batch-import-storage.test.ts`
- `__tests__/publish-employee-documents.test.ts`
- `__tests__/get-downloadable-document.test.ts`
- `__tests__/employee-documents-download-api.test.ts`
- `__tests__/employee-documents-publication-download-flow.test.ts`

### Change Log

- 2026-04-30 - Implementado fluxo real de artefato privado por colaborador: persistencia do lote-fonte, segmentacao PDF por pagina na publicacao e download assinado com bytes reais.

### Status

- done
