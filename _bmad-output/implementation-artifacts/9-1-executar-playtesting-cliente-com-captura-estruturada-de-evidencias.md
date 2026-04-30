# Story 9.1: Executar Playtesting Cliente com Captura Estruturada de Evidencias

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a responsavel pelo playtesting,
I want conduzir o roteiro cliente de ponta a ponta com registro estruturado,
so that possamos validar se a jornada simplificada de envio e acompanhamento realmente funciona para clientes-piloto.

## Acceptance Criteria

1. O roteiro de `docs/PLAYTESTING_GUIDE.md` deve poder ser executado integralmente usando o dataset demo provisionado na story 8.5, sem depender do roteiro interno de admin. [Source: _bmad-output/planning-artifacts/epic-9-playtesting-validacao-consolidacao-mvp.md; _bmad-output/implementation-artifacts/8-5-seed-data-fluxo-demo-playtesting.md]
2. Cada etapa validada no playtesting cliente deve gerar uma evidencia estruturada com, no minimo: etapa, papel, resultado esperado, resultado observado, nivel de friccao, correlation_id e links/IDs de apoio quando existirem. [Source: _bmad-output/planning-artifacts/epic-9-playtesting-validacao-consolidacao-mvp.md]
3. O pacote de evidencias deve cobrir pelo menos estes momentos da jornada: clareza do dashboard cliente, upload/processamento inicial de lote, historico funcional do envio, abertura/consulta de suporte e troca de visao para colaborador. [Source: _bmad-output/planning-artifacts/epic-9-playtesting-validacao-consolidacao-mvp.md; docs/PLAYTESTING_GUIDE.md]
4. Eventos tecnicos de playtest ja emitidos pelo sistema devem ser reaproveitados como trilha de apoio, e os gaps de instrumentacao necessarios para `dashboard cliente` e `suporte` devem ser fechados sem misturar a jornada cliente com indicadores/auditoria/admin. [Source: src/lib/observability/playtest-audit.ts; src/app/api/v1/rh/batches/route.ts; src/app/api/v1/employee/documents/route.ts; src/app/api/v1/rh/indicators/route.ts; docs/ADMIN_PLAYTESTING_GUIDE.md]
5. O fluxo deve permanecer aderente ao RBAC atual: gestor cliente continua restrito a jornada funcional, colaborador ve apenas seus documentos e qualquer vazamento de areas admin fica explicitamente fora do escopo desta story. [Source: _bmad-output/planning-artifacts/prd.md#RBAC Matrix; _bmad-output/project-context.md]

## Tasks / Subtasks

- [x] Task 1 - Definir o contrato de evidencia estruturada para playtesting cliente (AC: #2, #3)
  - [x] Criar um formato canonico para sessao de playtesting em `docs/playtesting/`, com campos obrigatorios para etapa, papel, resultado esperado, resultado observado, nivel de friccao, correlation_id e acao sugerida.
  - [x] Incluir uma sessao modelo para o fluxo cliente, alinhada aos passos do `docs/PLAYTESTING_GUIDE.md`.
  - [x] Garantir separacao explicita entre evidencia de cliente e evidencia interna/admin.

- [x] Task 2 - Consolidar a trilha tecnica de apoio da jornada cliente (AC: #3, #4)
  - [x] Reaproveitar `src/lib/observability/playtest-audit.ts` como base para consolidacao de eventos da sessao.
  - [x] Fechar os gaps de instrumentacao da jornada cliente onde ainda nao ha eventos de playtest suficientes, especialmente `dashboard cliente` e `suporte`.
  - [x] Garantir que os eventos emitidos mantenham `tenantId`, `actorId`, `correlationId`, `action`, `resourceType`, `status` e `details` consistentes com os padroes atuais.

- [x] Task 3 - Criar utilitario de consolidacao/exportacao das evidencias (AC: #2, #3, #4)
  - [x] Implementar um utilitario reutilizavel para agrupar os eventos de playtest relevantes por sessao/correlation_id.
  - [x] Expor esse utilitario no formato mais simples para o fluxo atual do projeto, preferencialmente como script em `drizzle/scripts/` ou modulo reutilizavel em `src/lib/observability/`.
  - [x] Produzir uma saida que o time consiga anexar ao artefato humano de playtesting sem retrabalho manual excessivo.

- [x] Task 4 - Atualizar o roteiro de playtesting cliente para uso operacional (AC: #1, #2, #3)
  - [x] Atualizar `docs/PLAYTESTING_GUIDE.md` com instrucoes claras de captura de correlation_id, coleta de evidencia e evidencia minima por etapa.
  - [x] Explicitar no roteiro onde termina a jornada cliente e quando o testador deve parar e usar `docs/ADMIN_PLAYTESTING_GUIDE.md`.
  - [x] Garantir que a troca de visao gestor -> colaborador continue tratada como validacao de fronteira de acesso, nao como atalho para observabilidade interna.

- [x] Task 5 - Cobertura de testes e validacao final (AC: #2, #4, #5)
  - [x] Adicionar testes unitarios para o agregador/exportador de evidencias de playtest.
  - [x] Adicionar testes para os novos eventos de playtest introduzidos nesta story, cobrindo sucesso e falha quando aplicavel.
  - [x] Validar que nenhuma mudanca expoe indicadores, auditoria ou excecoes para o papel `rh_gestor` na jornada cliente.

## Dev Notes

### Contexto do Epic

- O Epic 9 troca expansao de funcionalidade por validacao com evidencia. O objetivo agora nao e criar mais superficie de produto, e sim produzir sinais confiaveis para decidir `go`, `fix` ou `defer`.
- A Story 9.1 cobre apenas o playtesting do fluxo cliente. O roteiro admin ja existe em `docs/ADMIN_PLAYTESTING_GUIDE.md` e fica para a Story 9.2.

### Story Foundation

- O roteiro cliente atual ja cobre login do gestor cliente, upload de lote, historico funcional, suporte e troca de visao para colaborador.
- A story 8.5 ja deixou pronto o dataset demo, as credenciais e os guias base; a 9.1 deve reutilizar essa fundacao, nao reinventar um segundo fluxo.
- O codigo ja registra eventos de playtest em pontos importantes:
  - `src/app/api/v1/rh/batches/route.ts` registra friccao e sucesso de importacao de lote.
  - `src/app/api/v1/employee/documents/route.ts` registra consulta/friccao na lista de documentos do colaborador.
  - `src/app/api/v1/rh/indicators/route.ts` ja mostra o padrao de eventos de observabilidade, mas essa rota pertence ao contexto admin e serve apenas como referencia de padrao tecnico.
- Ainda faltam sinais claros para partes criticas do roteiro cliente:
  - `src/app/rh/page.tsx` carrega o dashboard cliente, mas hoje nao emite evento de playtest proprio.
  - `src/app/api/v1/support/cases/[caseId]/route.ts` escreve auditoria funcional de suporte, mas nao usa `writePlaytestEvent`.

### Technical Requirements

- Reutilizar a infraestrutura existente de audit/playtest antes de criar novas tabelas, novas rotas ou novos formatos paralelos.
- Manter o fluxo de evidencia simples: parte automatica via eventos tecnicos, parte humana via artefato estruturado em `docs/playtesting/`.
- Tratar `correlation_id` como chave de costura entre a sessao manual e os eventos automatizados.
- Nao transformar esta story em dashboard de analytics. O objetivo e gerar evidencia operacional suficiente para triagem do playtesting.

### Architecture Compliance

- Seguir o padrao de App Router e manter novas rotas, se realmente necessarias, em `src/app/api/v1/**/route.ts`.
- Reutilizar `src/lib/api/response.ts`, `src/lib/auth/session.ts`, `src/lib/auth/rbac.ts` e `src/lib/observability/correlation-id.ts`.
- Preservar isolamento por tenant e papel em qualquer leitura de eventos ou agregacao de evidencias.
- Nao criar caminhos que misturem jornada cliente com auditoria detalhada, indicadores ou fila de excecoes da Mercavejo.

### Library / Framework Requirements

- Next.js App Router e TypeScript strict, seguindo os padroes atuais do projeto.
- Validacao de entrada com Zod se houver qualquer endpoint ou contrato de filtro novo.
- Testes em Vitest com `vi.mock` para dependencias externas e limpeza entre casos.

### File Structure Requirements

- Artefatos humanos de playtesting devem ficar em `docs/playtesting/` ou caminho semelhante dentro de `docs/`.
- Utilitarios tecnicos de consolidacao podem ficar em `src/lib/observability/` se forem compartilhaveis, ou `drizzle/scripts/` se forem puramente operacionais.
- Evitar espalhar logica de playtesting em componentes visuais sem necessidade; preferir modulos utilitarios e pontos de integracao bem delimitados.

### Testing Requirements

- Cobrir a agregacao/normalizacao das evidencias de playtest por correlation_id.
- Cobrir os novos eventos de playtest introduzidos para dashboard cliente e suporte, incluindo shape minimo de `details`.
- Validar a fronteira negativa: nada desta story deve facilitar acesso de `rh_gestor` a `/rh/indicadores`, `/rh/auditoria` ou `/rh/excecoes`.

### Previous Story Intelligence

- A story 8.5 ja consolidou:
  - dataset demo com gestor cliente, colaborador e admin;
  - `docs/PLAYTESTING_GUIDE.md` como roteiro do cliente;
  - `docs/ADMIN_PLAYTESTING_GUIDE.md` como roteiro interno separado;
  - script de reset para repetir sessoes de teste com baixo custo operacional.
- O realinhamento de 2026-04-24 foi importante: tudo que for auditoria, indicadores, status operacional e excecoes pertence ao contexto interno/admin, nao ao gestor cliente.
- O layout do colaborador permite simulacao de visao por perfis RH/admin em `src/app/(employee)/layout.tsx`, o que e util para demonstracao, mas essa simulacao nao pode mascarar problemas reais de permissao.

### Git Intelligence Summary

- `28b16ce fix(scope): separar gestor cliente da operacao admin`
- `43bab3b feat(rh): consolidar auditoria, alertas, indicadores e suporte operacional`
- Esses commits reforcam que a 9.1 deve medir a jornada do cliente sem reabrir a mistura de escopos entre cliente e operacao interna.

### Project Structure Notes

- Ja existe cobertura de testes e modulos para batches, audit, support e documentos; a story deve se encaixar nessa estrutura, nao criar uma stack paralela de playtesting.
- O projeto ja possui `src/lib/observability/playtest-audit.ts`; portanto, o caminho mais seguro e evoluir essa base com agregacao/exportacao e eventos faltantes.

### References

- Source: `_bmad-output/planning-artifacts/epic-9-playtesting-validacao-consolidacao-mvp.md`
- Source: `_bmad-output/implementation-artifacts/8-5-seed-data-fluxo-demo-playtesting.md`
- Source: `docs/PLAYTESTING_GUIDE.md`
- Source: `docs/ADMIN_PLAYTESTING_GUIDE.md`
- Source: `_bmad-output/planning-artifacts/prd.md`
- Source: `_bmad-output/planning-artifacts/architecture.md`
- Source: `_bmad-output/planning-artifacts/ux-design-specification.md`
- Source: `_bmad-output/project-context.md`
- Source: `src/lib/observability/playtest-audit.ts`
- Source: `src/app/api/v1/rh/batches/route.ts`
- Source: `src/app/api/v1/employee/documents/route.ts`
- Source: `src/app/api/v1/support/cases/[caseId]/route.ts`
- Source: `src/app/rh/page.tsx`
- Source: `src/app/(employee)/layout.tsx`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `rtk npm run test:run -- __tests__/playtest-evidence.test.ts __tests__/rh-dashboard-page.test.tsx __tests__/support-cases-api.test.ts __tests__/rh-batches-api.test.ts`
- `rtk npm run test:run -- __tests__/playtest-audit.test.ts __tests__/playtest-evidence.test.ts __tests__/rh-dashboard-page.test.tsx __tests__/rh-batches-api.test.ts __tests__/support-cases-api.test.ts __tests__/employee-documents-api.test.ts __tests__/rh-indicators-api.test.ts`
- `rtk npm run test:run`
- `rtk npm run lint`

### Completion Notes List

- Criado contrato humano de evidencia em `docs/playtesting/client-playtest-evidence-template.md`, com sessao modelo e separacao explicita entre jornada cliente e jornada admin.
- Implementada consolidacao tecnica em `src/lib/observability/playtest-evidence.ts`, incluindo agrupamento por `correlation_id`, mapeamento por etapa do playtest e formatacao em Markdown.
- Adicionado script operacional `drizzle/scripts/export-playtest-evidence.ts` para exportar pacote de evidencias do tenant demo com base nos eventos tecnicos registrados.
- Instrumentado dashboard cliente em `src/app/rh/page.tsx` com eventos `playtest.rh.dashboard.view` e `playtest.rh.dashboard.friction`.
- Instrumentada consulta de historico do lote em `src/app/api/v1/rh/batches/[batchId]/route.ts` com eventos `playtest.rh.batches.history.view` e `playtest.rh.batches.history.friction`.
- Instrumentada consulta de suporte em `src/app/api/v1/support/cases/[caseId]/route.ts` com eventos `playtest.rh.support.case.view` e `playtest.rh.support.case.friction` para a jornada do `rh_gestor`.
- Atualizado `docs/PLAYTESTING_GUIDE.md` com captura de `correlation_id`, uso do template e comando de exportacao do pacote tecnico.
- Validacao final concluida com `417/417` testes passando e `eslint` limpo.

### File List

- `__tests__/playtest-evidence.test.ts`
- `__tests__/rh-batches-api.test.ts`
- `__tests__/rh-dashboard-page.test.tsx`
- `__tests__/support-cases-api.test.ts`
- `docs/PLAYTESTING_GUIDE.md`
- `docs/playtesting/client-playtest-evidence-template.md`
- `drizzle/scripts/export-playtest-evidence.ts`
- `src/app/api/v1/rh/batches/[batchId]/route.ts`
- `src/app/api/v1/support/cases/[caseId]/route.ts`
- `src/app/rh/page.tsx`
- `src/lib/observability/playtest-evidence.ts`

### Change Log

- 2026-04-28: Implementada a story 9.1 com contrato de evidencia, exportador tecnico, instrumentacao de dashboard/historico/suporte e atualizacao do guia operacional.

### Review Findings

- [x] [Review][Patch] Exportador filtra por `gestor@demo.com` e nao consegue consolidar a etapa `troca_para_colaborador`, embora o guia mande usar exatamente esse comando no fim da rodada. [`drizzle/scripts/export-playtest-evidence.ts:41`]
- [x] [Review][Patch] Dashboard classifica `rh_operator` como papel cliente por usar `'rh'` na allowlist interna; operador passa a ver painel de cliente e emitir evento de playtest indevido. [`src/app/rh/page.tsx:97`]
- [x] [Review][Patch] Nova observabilidade ficou no caminho feliz e pode derrubar fluxo funcional quando a escrita de evento falha (dashboard, historico de lote e consulta de suporte). [`src/app/api/v1/rh/batches/[batchId]/route.ts:238`]
- [x] [Review][Patch] `GET /api/v1/support/cases/[caseId]` grava auditoria `support.case.opened.v1` em toda consulta, poluindo trilha funcional com falsos positivos de abertura. [`src/app/api/v1/support/cases/[caseId]/route.ts:57`]
