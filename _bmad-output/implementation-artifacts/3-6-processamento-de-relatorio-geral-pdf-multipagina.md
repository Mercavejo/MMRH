---
story_id: "3.6"
story_key: "3-6-processamento-de-relatorio-geral-pdf-multipagina"
epic: "3"
title: "Processamento de Relatorio Geral PDF Multipagina"
status: "done"
created_date: "2026-04-13"
last_updated: "2026-04-13"
---

# Story 3.6: Processamento de Relatorio Geral PDF Multipagina

Status: done

## Story

As a RH/DP operador,
I want processar relatorio geral PDF multipagina em que cada pagina representa um holerite individual,
so that o lote seja roteado e publicado com seguranca sem risco de associacao incorreta entre colaborador e documento.

## Acceptance Criteria

1. Given um upload de relatorio geral em PDF multipagina dentro do tenant autenticado
   When o processamento extrair os metadados de cada pagina
   Then cada pagina deve ser tratada como item individual de roteamento para holerite
   And o identificador principal deve priorizar codigo do colaborador antes de qualquer estrategia por nome.

2. Given uma pagina sem codigo do colaborador disponivel
   When o sistema precisar identificar destino
   Then deve aplicar fallback por nome normalizado com validacoes auxiliares de contexto
   And o fallback deve ser bloqueado quando houver duplicidade ou insuficiencia de confianca.

3. Given ambiguidade de identificacao em qualquer pagina
   When o lote avancar para roteamento ou publicacao
   Then o sistema deve bloquear a pagina ambigua e impedir publicacao automatica do lote enquanto houver bloqueios
   And deve registrar motivo tecnico e motivo operacional rastreavel por pagina.

4. Given requisicoes de processamento, consulta de progresso e tentativa de publicacao
   When o fluxo executar
   Then todas as operacoes devem permanecer tenant-bound com enforcement de RBAC e anti cross-tenant
   And toda resposta deve manter correlation_id em header e no envelope padrao de API.

5. Given a cobertura de qualidade da historia
   When os testes forem executados
   Then devem existir cenarios cobrindo sucesso, ambiguidade, codigo ausente, nome duplicado, cross-tenant e publicacao bloqueada
   And os testes devem validar tambem persistencia do motivo de bloqueio e propagacao de correlation_id.

## Dependencies and Scope

### Gate de Planejamento

- Story 3.6 registrada em `_bmad-output/planning-artifacts/epics.md` (Epic 3), mantendo rastreabilidade entre planejamento e implementacao.

### Dependencias de Historias Anteriores

- Story 3.1: importacao de relatorio e validacao inicial.
- Story 3.2: roteamento automatico com bloqueio de ambiguidade.
- Story 3.4: reprocessamento seletivo de itens e lotes.
- Story 3.5: publicacao segura de lote no portal.

### Fora de Escopo

- OCR avancado com IA para leitura sem metadados estruturados.
- Mudanca de contrato de autenticacao/sessao fora das rotas RH de lote.
- Novo formato de resposta API fora do envelope padrao do projeto.

## Technical Requirements

### Matriz de Implementacao (Regra, Local, Evidencia)

1. Regra: manter compatibilidade com contrato atual de importacao sem quebrar fluxos anteriores.
   - Local: `src/lib/rh/batches/import-validation.ts`, `src/lib/rh/batches/batch-routing.ts`, `src/app/api/v1/rh/batches/route.ts`.
   - Evidencia: testes de regressao de importacao/roteamento existentes continuam verdes + novos cenarios de PDF multipagina.
2. Regra: cada pagina do PDF deve virar um item individual e nunca compartilhar documento entre colaboradores.
   - Local: `src/lib/rh/batches/import-validation.ts`, `src/lib/rh/batches/batch-routing.ts`, `src/app/api/v1/rh/batches/[batchId]/publish/route.ts`.
   - Evidencia: testes de dominio/API validando 1 pagina -> 1 colaborador -> 1 documento publicado.
3. Regra: bloqueio deve ser rastreavel por pagina com codigo e mensagem estruturados.
   - Local: `src/lib/rh/batches/batch-routing.ts`, `src/lib/db/schema/batches.ts`, `src/app/api/v1/rh/batches/[batchId]/process/route.ts`.
   - Evidencia: testes validando persistencia e retorno por pagina de motivo de bloqueio.

### Do / Don't

- Do: estender contrato atual com retrocompatibilidade, preservando `employee_identifier` como campo aceito no boundary.
- Do: adicionar metadados por pagina para estrategia de match (`codigo_colaborador` ou `nome_normalizado`).
- Do: impedir publicacao do lote quando qualquer pagina estiver bloqueada ou ambigua.
- Don't: criar novo endpoint fora de `/api/v1/rh/batches/**`.
- Don't: substituir fluxo de roteamento existente por implementacao paralela.
- Don't: publicar em lote sem validar vinculacao individual por colaborador.

### Regras de Identificacao de Colaborador

1. Prioridade de chave de identificacao por pagina:
   - Nivel 1: `codigo_colaborador` (obrigatoriamente preferido quando presente).
   - Nivel 2: `nome_normalizado` com validacoes auxiliares.
2. Compatibilidade de contrato obrigatoria:
   - manter aceite de `employee_identifier` no input atual (CSV/JSON);
   - derivar `codigo_colaborador` e/ou `nome_normalizado` no pipeline sem breaking change para historias 3.1-3.5;
   - qualquer migracao de contrato deve ser aditiva e coberta por testes de regressao.
3. `nome_normalizado` deve aplicar no minimo:
   - trim + lowercase,
   - remocao de acentos,
   - colapso de espacos duplos,
   - comparacao deterministica.
4. Validacoes auxiliares obrigatorias no fallback por nome:
   - compatibilidade de tenant,
   - compatibilidade de periodo de referencia quando disponivel,
   - rejeicao em caso de multiplos candidatos.
5. Quando codigo e nome indicarem destinos diferentes, tratar como ambiguidade bloqueante.

### Regras de Entrega Individual de Holerite

1. Cada pagina do PDF multipagina representa um holerite individual e deve resultar em um item de publicacao isolado.
2. Cada item publicado deve vincular exatamente um colaborador destino e um documento destino (proibido fan-out para mais de um colaborador).
3. E proibido publicar documento quando o destino estiver ambiguo, nao resolvido ou em conflito de sinais.
4. O fluxo de publicacao deve garantir que colaboradores recebam apenas seus proprios holerites, sem qualquer compartilhamento cruzado.

### Decisao Tecnica do Parser PDF Multipagina

1. Implementacao obrigatoriamente server-side no runtime Node.
2. Parser padrao definido para esta story: `pdf-parse` (compatibilidade com fluxo atual Next.js/Node).
3. Proibido parse de PDF no cliente (browser) para evitar exposicao de dados sensiveis e variacao de comportamento.
4. Extracao deve produzir por pagina, no minimo: `page_index`, `raw_text`, `codigo_colaborador` (quando encontrado) e `nome_normalizado` (quando derivado).

### Regras Operacionais de Rejeicao de PDF

1. Rejeitar arquivo PDF sem texto extraivel com `blocked_reason_code = PDF_TEXT_NOT_EXTRACTABLE`.
2. Rejeitar PDF protegido por senha/criptografado com `blocked_reason_code = PDF_PASSWORD_PROTECTED`.
3. Rejeitar PDF acima de limite operacional de 500 paginas com `blocked_reason_code = PDF_PAGE_LIMIT_EXCEEDED`.
4. Em qualquer rejeicao, retornar mensagem operacional objetiva e preservar `x-correlation-id` no header e em `meta.correlation_id`.

### Regras de Persistencia por Pagina

1. O manifest/resultado de roteamento deve armazenar, por pagina, campos suficientes para auditoria e replay seguro:
   - `page_index`,
   - `routing_status`,
   - `match_strategy` (`codigo_colaborador` ou `nome_normalizado`),
   - `blocked_reason_code`,
   - `blocked_reason_message`,
   - `correlation_id`.
2. `routing_blocked_reason` agregado de lote pode permanecer como resumo, mas nao substitui a persistencia por pagina.
3. A atualizacao de schema, se necessaria, deve ser acompanhada de migracao Drizzle e exportacao no index de schema.

### Regras de Bloqueio e Motivo

1. Nao permitir publicacao de lote com qualquer pagina em estado ambiguo/bloqueado.
2. Cada bloqueio deve registrar ao menos:
   - `page_index`,
   - `routing_status`,
   - `blocked_reason_code`,
   - `blocked_reason_message`,
   - `correlation_id`.
3. Codigos minimos de bloqueio:
   - `MISSING_EMPLOYEE_CODE`,
   - `AMBIGUOUS_EMPLOYEE_BY_NAME`,
   - `DUPLICATE_NORMALIZED_NAME`,
   - `CROSS_TENANT_MATCH_BLOCKED`,
   - `CONFLICTING_IDENTIFIER_SIGNALS`.

### Tenant-Bound, RBAC e Correlation

1. Todas as operacoes de importacao/processamento/publicacao devem usar `tenant_id` da sessao validada.
2. Todo acesso cross-tenant deve retornar `FORBIDDEN` sem escrita lateral.
3. `x-correlation-id` deve ser lido, normalizado e devolvido em todas as respostas (sucesso e erro).
4. Manter envelope padrao `{ data, error, meta }` com `meta.correlation_id`.

### Contrato e Arquitetura

1. Manter endpoint em `src/app/api/v1/rh/batches/**/route.ts`.
2. Reutilizar utilitarios centrais:
   - `src/lib/api/response.ts`
   - `src/lib/api/errors.ts`
   - `src/lib/auth/session.ts`
   - `src/lib/auth/rbac.ts`
   - `src/lib/observability/correlation-id.ts`
3. Reutilizar dominio de lote e roteamento existente antes de criar novo modulo.
4. Reutilizar cliente de banco unico em `src/lib/db/client.ts`.

## File Structure Requirements

- `src/lib/rh/batches/import-validation.ts` (estender validacao para variante PDF multipagina)
- `src/lib/rh/batches/batch-routing.ts` (estender regras de identificacao e bloqueio por pagina)
- `src/lib/rh/batches/batch-progress.ts` (expor contadores/motivos relacionados ao bloqueio por pagina)
- `src/app/api/v1/rh/batches/route.ts` (aceite de PDF multipagina mantendo guardrails atuais)
- `src/app/api/v1/rh/batches/[batchId]/process/route.ts` (propagacao de motivo e bloqueio)
- `src/app/api/v1/rh/batches/[batchId]/publish/route.ts` (bloqueio de publicacao enquanto houver ambiguidade)
- `src/lib/db/schema/batches.ts` (se necessario, ampliar estrutura de motivo detalhado)
- `src/lib/db/schema/index.ts` (manter exportacao consolidada)
- `__tests__/rh-batches-import-validation.test.ts`
- `__tests__/rh-batches-routing-domain.test.ts`
- `__tests__/rh-batches-api.test.ts`

## Testing Requirements

1. Sucesso: PDF multipagina com codigo de colaborador valido por pagina, sem ambiguidade.
2. Ambiguidade: pagina com multiplos candidatos por nome normalizado.
3. Codigo ausente: fallback por nome aplicado com validacoes auxiliares e bloqueio quando insuficiente.
4. Nome duplicado: dois colaboradores do mesmo tenant com mesmo nome normalizado bloqueiam roteamento automatico.
5. Cross-tenant: tentativa de associacao fora do tenant autenticado deve falhar com `FORBIDDEN`.
6. Publicacao bloqueada: lote com qualquer item ambiguo deve retornar erro de bloqueio operacional na publicacao.
7. Correlation: todas as respostas devem incluir `x-correlation-id` e `meta.correlation_id`.
8. Motivo registrado: validar persistencia e retorno de `blocked_reason_code` e `blocked_reason_message` por pagina.
9. Entrega individual: validar que cada colaborador recebe somente seu proprio holerite e que nao existe publicacao cruzada entre colaboradores.
10. Regressao de contrato: validar compatibilidade com payload atual baseado em `employee_identifier` sem quebra das historias 3.1-3.5.
11. Parser PDF multipagina: validar rejeicao de arquivo sem texto extraivel, PDF protegido por senha e limite maximo de 500 paginas.

## Tasks / Subtasks

- [x] Task 1 - Adaptar ingestao para PDF multipagina com itemizacao por pagina (AC: 1)
   - [x] Estender validacao de importacao para reconhecer variante PDF multipagina e extrair metadados por pagina.
   - [x] Garantir que cada pagina seja convertida para item roteavel de holerite mantendo consistencia do batch.

- [x] Task 2 - Implementar estrategia de identificacao codigo-first com fallback seguro por nome (AC: 1, 2)
   - [x] Priorizar `codigo_colaborador` como chave unica de associacao quando presente.
   - [x] Aplicar `nome_normalizado` apenas na ausencia de codigo e com validacoes auxiliares obrigatorias.
    - [x] Manter compatibilidade com `employee_identifier` no boundary sem breaking change.
   - [x] Bloquear automaticamente quando houver conflito, duplicidade ou baixa confianca.

- [x] Task 3 - Fortalecer bloqueio por ambiguidade e motivo rastreavel (AC: 3)
   - [x] Persistir codigo/mensagem de bloqueio por pagina com contexto tecnico e operacional.
    - [x] Persistir estrategia de match por pagina (`codigo_colaborador` ou `nome_normalizado`) para auditoria.
   - [x] Garantir que lote com bloqueio nao avance para publicacao automatica.

- [x] Task 4 - Garantir tenant-bound, RBAC e correlation_id ponta a ponta (AC: 4)
   - [x] Validar tenant e papel em todas as rotas envolvidas no fluxo.
   - [x] Assegurar propagacao de correlation_id em sucesso e erro no envelope padrao.

- [x] Task 5 - Garantir entrega individual por colaborador no fluxo de publicacao (AC: 1, 3, 5)
   - [x] Assegurar que cada pagina itemizada gere publicacao individual com vinculo univoco colaborador-documento.
   - [x] Bloquear qualquer tentativa de associacao multipla para um mesmo item de pagina.
   - [x] Validar que colaborador nunca recebe holerite de outro colaborador.

- [x] Task 6 - Cobrir cenarios criticos com testes de dominio e API (AC: 5)
   - [x] Adicionar testes de sucesso e de bloqueio por ambiguidade.
   - [x] Adicionar testes de codigo ausente, nome duplicado e cross-tenant.
   - [x] Adicionar teste de publicacao bloqueada por ambiguidade remanescente.
    - [x] Adicionar teste de entrega individual por colaborador sem compartilhamento cruzado.
    - [x] Adicionar teste de regressao de contrato para `employee_identifier`.
    - [x] Adicionar teste de rejeicao com codigos `PDF_TEXT_NOT_EXTRACTABLE`, `PDF_PASSWORD_PROTECTED` e `PDF_PAGE_LIMIT_EXCEEDED`.

## Matriz Task -> Arquivos -> Testes

- Task 1 -> `src/lib/rh/batches/import-validation.ts`, `src/app/api/v1/rh/batches/route.ts` -> `__tests__/rh-batches-import-validation.test.ts`, `__tests__/rh-batches-api.test.ts`
- Task 2 -> `src/lib/rh/batches/batch-routing.ts`, `src/lib/rh/batches/import-validation.ts` -> `__tests__/rh-batches-routing-domain.test.ts`
- Task 3 -> `src/lib/rh/batches/batch-routing.ts`, `src/app/api/v1/rh/batches/[batchId]/process/route.ts`, `src/lib/db/schema/batches.ts` -> `__tests__/rh-batches-routing-domain.test.ts`, `__tests__/rh-batches-api.test.ts`
- Task 4 -> `src/app/api/v1/rh/batches/route.ts`, `src/app/api/v1/rh/batches/[batchId]/process/route.ts`, `src/app/api/v1/rh/batches/[batchId]/publish/route.ts` -> `__tests__/rh-batches-api.test.ts`
- Task 5 -> `src/lib/rh/batches/batch-routing.ts`, `src/app/api/v1/rh/batches/[batchId]/publish/route.ts` -> `__tests__/rh-batches-routing-domain.test.ts`, `__tests__/rh-batches-api.test.ts`
- Task 6 -> `__tests__/rh-batches-import-validation.test.ts`, `__tests__/rh-batches-routing-domain.test.ts`, `__tests__/rh-batches-api.test.ts` -> execucao completa `npm run test:run`

## Dev Notes

### Decisoes de Contrato

- Esta story e aditiva sobre 3.1-3.5: preservar contrato atual (`employee_identifier`) e introduzir semantica de `codigo_colaborador`/`nome_normalizado` internamente.
- Nao aprovar PR que remova compatibilidade de payload sem migracao explicita e teste de regressao.

### Guardrails de Reuso (Nao Reinventar)

- Nao criar cliente DB paralelo, nao criar envelope de API alternativo, nao criar RBAC ad-hoc.
- Nao duplicar motor de roteamento: estender `batch-routing.ts` com regras de identificacao PDF.
- Nao criar trilha de auditoria paralela: reaproveitar padrao de auditoria de batches.

### Riscos de Regressao

- Quebrar fluxo atual CSV/linha unica ao introduzir granularidade por pagina.
- Liberar publicacao com bloqueios ambiguidade por erro de agregacao de status.
- Introduzir match cross-tenant por fallback de nome sem filtro estrito de tenant.

### Referencias

- Source: `_bmad-output/planning-artifacts/epics.md` (Epic 3, FR16-FR23)
- Source: `_bmad-output/planning-artifacts/prd.md` (Jornada RH de lote, NFR4, NFR7, NFR8, NFR12, NFR23)
- Source: `_bmad-output/planning-artifacts/architecture.md` (API v1, envelope, tenant isolation, idempotencia, observabilidade)
- Source: `_bmad-output/project-context.md` (tenant-bound, correlation_id, resposta padrao)
- Source: `sistema-adalto/src/lib/rh/batches/import-validation.ts`
- Source: `sistema-adalto/src/lib/rh/batches/batch-routing.ts`
- Source: `sistema-adalto/src/app/api/v1/rh/batches/[batchId]/process/route.ts`
- Source: `sistema-adalto/src/app/api/v1/rh/batches/[batchId]/publish/route.ts`

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Implementacao executada com TDD em `import-validation.ts` e `batch-routing.ts` com parser PDF multipagina server-side (`pdf-parse`).
- Persistencia de resultado por pagina habilitada em `process/route.ts` via `routingManifest: result.items`.
- Suites executadas e aprovadas: `npm run test:run -- __tests__/rh-batches-import-validation.test.ts __tests__/rh-batches-routing-domain.test.ts __tests__/rh-batches-api.test.ts`, `npm run test:run -- __tests__/rh-batches-routing-domain.test.ts`, `npm run test:run`.

### Completion Notes List

- Ingestao PDF multipagina implementada com itemizacao por pagina, extraindo `page_index`, `raw_text`, `codigo_colaborador` e `nome_normalizado`.
- Regras operacionais de rejeicao adicionadas com codigos: `PDF_TEXT_NOT_EXTRACTABLE`, `PDF_PASSWORD_PROTECTED` e `PDF_PAGE_LIMIT_EXCEEDED`.
- Roteamento atualizado para estrategia `codigo_colaborador` first e fallback seguro por `nome_normalizado` com bloqueio em duplicidade.
- Motivo rastreavel por pagina entregue via `blocked_reason_code`, `blocked_reason_message` e `match_strategy`.
- Persistencia do resultado de roteamento por pagina aplicada no processamento de lote.
- Cobertura de testes ampliada para PDF multipagina, fallback por nome, bloqueios e entrega individual por colaborador.
- Regressao completa validada: 41 arquivos de teste aprovados, 173 testes verdes.

### File List

- _bmad-output/implementation-artifacts/3-6-processamento-de-relatorio-geral-pdf-multipagina.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- sistema-adalto/package.json
- sistema-adalto/package-lock.json
- sistema-adalto/src/lib/rh/batches/import-validation.ts
- sistema-adalto/src/lib/rh/batches/batch-routing.ts
- sistema-adalto/src/app/api/v1/rh/batches/[batchId]/process/route.ts
- sistema-adalto/src/lib/db/schema/batches.ts
- sistema-adalto/__tests__/rh-batches-import-validation.test.ts
- sistema-adalto/__tests__/rh-batches-routing-domain.test.ts
- sistema-adalto/__tests__/rh-batches-api.test.ts

## Story Completion Status

Implementation completed, validated and ready for review.
