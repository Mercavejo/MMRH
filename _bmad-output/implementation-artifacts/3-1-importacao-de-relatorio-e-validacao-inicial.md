# Story 3.1: Importacao de Relatorio e Validacao Inicial

Status: review

## Story

As a RH/DP operador,
I want importar relatorio geral e validar estrutura antes do processamento,
so that erros criticos sejam barrados no inicio do fluxo.

## Acceptance Criteria

1. Given um arquivo de lote enviado pelo RH
   When a importacao for iniciada
   Then o sistema deve validar schema, obrigatoriedade de campos e consistencia minima
   And bloquear continuidade com feedback detalhado quando houver erro critico.

2. Given formulario de upload e retorno operacional
   When o usuario interagir com a tela
   Then validacoes devem ocorrer em linha com mensagens proximas ao campo
   And estados de loading, sucesso e erro devem seguir padrao de feedback definido.

## Tasks / Subtasks

- [x] Task 1 - Estruturar dominio de importacao de lote e contrato de validacao (AC: 1)
  - [x] Definir entidade/DTO de lote importado com batch_id, tenant_id, uploaded_by, original_filename, file_size_bytes, mime_type, validation_status, validation_summary, correlation_id, created_at e updated_at.
  - [x] Implementar validador do arquivo com Zod para metadados e checagem do schema e da consistencia minima do relatorio.
  - [x] Classificar falhas em bloqueio critico e alerta recuperavel, sem permitir avancar para processamento quando houver erro impeditivo.
  - [x] Se houver persistencia do lote, criar schema Drizzle em src/lib/db/schema/batches.ts e exportar em src/lib/db/schema/index.ts.

- [x] Task 2 - Expor endpoint RH de importacao validada (AC: 1)
  - [x] Criar POST em src/app/api/v1/rh/batches/route.ts para receber o arquivo do lote e devolver envelope padrao.
  - [x] Validar cookie de sessao, escopo de tenant e papel rh_operator com validateSession, userTenantMappings, assertTenantAction e RBAC_ACTIONS.
  - [x] Ler x-correlation-id, propagar o correlation_id na resposta e registrar a validacao com a trilha de auditoria existente.
  - [x] Rejeitar payloads invalidos com VALIDATION_ERROR e detalhes suficientes para diagnostico operacional.

- [x] Task 3 - Construir tela RH de importacao com feedback em linha (AC: 2)
  - [x] Criar a entrada principal do fluxo em src/app/(rh)/lotes/page.tsx, alinhada ao layout previsto para operacao de lotes.
  - [x] Implementar upload de arquivo, estados de carregamento, erro e sucesso com componentes MUI e o tema atual.
  - [x] Garantir mensagens proximas ao campo, uma acao primaria clara por tela e suporte a teclado e leitores de tela.

- [x] Task 4 - Cobertura de testes e validacao final (AC: 1, 2)
  - [x] Adicionar testes unitarios para o validador e o resumo de importacao com cenarios de schema invalido, campos obrigatorios ausentes e arquivo valido.
  - [x] Adicionar testes do endpoint para sucesso, sem sessao, role invalida, tenant mismatch e arquivo invalido.
  - [x] Adicionar teste de UI para submit, loading, feedback inline e estados de sucesso e erro.
  - [x] Executar npm run test:run, npm run lint e npm run build sem regressao.

## Dev Notes

### Contexto do Epic

- Epic 3 entrega a operacao RH de lotes e publicacao com validacao forte, tratamento de excecoes e publicacao confiavel em escala.
- Esta story cobre FR16 e FR17 diretamente e prepara o contrato de entrada para FR18, FR19, FR20, FR21, FR22 e FR23.
- NFRs diretamente relacionados: NFR4 (volume e tempo de lote), NFR8 (log auditavel), NFR14 (alerta de falha critica), NFR16 (isolamento multi-tenant), NFR18-NFR20 (acessibilidade), NFR21-NFR24 (validacao de contrato e idempotencia futura).

### Requisitos Tecnicos Obrigatorios

- O fluxo deve parar no primeiro erro critico de schema ou consistencia e nao pode seguir para processamento automatizado.
- Toda resposta deve manter envelope padrao { data, error, meta } com correlation_id.
- O endpoint de importacao e exclusivo de rh_operator; rh_gestor nao deve ganhar capacidade de importacao por acidente.
- Nao permitir qualquer leitura ou escrita cross-tenant.
- Se o lote for persistido para stories futuras, usar a entidade como handoff para lote validado, sem criar client paralelo de banco.

### Architecture Compliance

- Manter a API em src/app/api/v1/**/route.ts, seguindo o namespace RH ja usado pelas rotas de contestacao.
- Reutilizar src/lib/api/response.ts, src/lib/api/errors.ts, src/lib/auth/session.ts, src/lib/auth/rbac.ts e src/lib/observability/correlation-id.ts.
- Usar src/lib/db/client.ts como unico cliente de banco.
- Validacao de entrada deve ser feita com Zod safeParse no boundary da rota.
- Se houver schema novo, exportar no index unico de src/lib/db/schema/index.ts e registrar migracao correspondente em drizzle/migrations.

### Library / Framework Requirements

- Next.js 16.2.3 com App Router.
- React 19.2.4.
- TypeScript 5 em strict mode.
- MUI 9.0.0 para pagina e feedback operacional.
- Zod 4.3.6 para validacao de entrada.
- Drizzle ORM 0.45.2 e drizzle-kit 0.31.10 para qualquer persistencia de lote ou auditoria adicional.
- Vitest 4.1.3 para testes unitarios, de rota e de UI.

### File Structure Requirements

- src/app/(rh)/lotes/page.tsx
- src/app/(rh)/lotes/loading.tsx se a tela precisar de estado de carregamento dedicado
- src/app/api/v1/rh/batches/route.ts
- src/lib/rh/batches/import-validation.ts
- src/lib/rh/batches/import-batch.ts
- src/lib/db/schema/batches.ts se a persistencia do lote for parte desta entrega
- src/lib/db/schema/index.ts
- __tests__/rh-batches-import-validation.test.ts
- __tests__/rh-batches-api.test.ts
- __tests__/rh-batches-ui.test.tsx

### Testing Requirements

- Cobrir importacao bem-sucedida, arquivo invalido, schema invalido, ausencia de sessao, role sem permissao e tenant mismatch.
- Cobrir feedback inline na pagina, estados loading/success/error e a acao primaria do upload.
- Cobrir uso do envelope padrao e do correlation_id no retorno da rota.
- Usar vi.mock para dependencias externas e limpar estado entre casos com beforeEach.

### UX Requirements Relevantes

- Aplicar a Jornada 3 do UX: importar, validar, acompanhar excecoes e manter o fluxo de lote claro.
- Usar o Batch Progress Panel como referencia para exibicao de progresso e feedback operacional.
- Usar Form Patterns para upload com validacao em linha e Button Hierarchy com uma acao primaria por tela.
- Garantir que mensagens de erro expliquem o problema e o proximo passo, sem depender apenas de cor.
- Garantir foco visivel, rotulos compreensiveis e navegacao por teclado nos controles principais.

### Project Structure Notes

- O projeto ainda nao possui implementacao concreta para o area RH; a pasta src/app/(rh)/ hoje e apenas placeholder.
- A estrutura ja existente para documentos do colaborador mostra o padrao esperado de App Router, feedback MUI e envelope padrao de API.
- A arquitetura do produto ja reserva lotes em src/app/(rh)/lotes e batches em API; esta story deve iniciar essa fronteira sem criar uma segunda interpretacao de dominio.

### References

- Source: _bmad-output/planning-artifacts/epics.md (Epic 3; Story 3.1; FR16, FR17, FR18-23)
- Source: _bmad-output/planning-artifacts/prd.md (Jornada 3; Batch Ingestion, Processing & Routing; NFR4, NFR8, NFR14, NFR16, NFR18-24)
- Source: _bmad-output/planning-artifacts/architecture.md (App Router RH lotes; API /api/v1; RBAC; envelope padrao; idempotencia; observabilidade)
- Source: _bmad-output/planning-artifacts/ux-design-specification.md (Jornada 3; Batch Progress Panel; Feedback Patterns; Form Patterns; Button Hierarchy)
- Source: sistema-adalto/src/lib/api/response.ts
- Source: sistema-adalto/src/lib/api/errors.ts
- Source: sistema-adalto/src/lib/auth/session.ts
- Source: sistema-adalto/src/lib/auth/rbac.ts
- Source: sistema-adalto/src/lib/observability/correlation-id.ts
- Source: sistema-adalto/src/app/api/v1/rh/contestations/route.ts
- Source: sistema-adalto/src/app/(employee)/documents/page.tsx

## Dev Agent Record

### Agent Model Used

GPT-5.4 mini

### Debug Log References

- `npm run test:run` - 32 test files, 119 tests passing.
- `npm run lint` - 2 pre-existing warnings in src/lib/compliance/minimization.ts; no errors introduced by this story.
- `npm run build` - Next.js production build completed successfully.

### Completion Notes List

- Story 3.1 implementada ponta a ponta com validacao de lote, rota RH versionada, tela de importacao e persistencia auditavel.
- O fluxo agora bloqueia arquivos invalidos cedo, registra validacao com correlation_id e mantem envelope padrao de API.
- A area RH ficou alinhada ao namespace de batches e aos componentes de feedback/acessibilidade do produto.
- Validacao final concluida com `npm run test:run`, `npm run lint` e `npm run build`.
- Ajuste de robustez aplicado em pagina server-side de detalhe de documento para evitar falha de request scope em testes SSR (fallback seguro para status da query quando cookies nao estao disponiveis).

### File List

- _bmad-output/implementation-artifacts/3-1-importacao-de-relatorio-e-validacao-inicial.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- sistema-adalto/__tests__/rh-batches-api.test.ts
- sistema-adalto/__tests__/rh-batches-import-validation.test.ts
- sistema-adalto/__tests__/rh-batches-ui.test.tsx
- sistema-adalto/src/app/(rh)/lotes/loading.tsx
- sistema-adalto/src/app/(rh)/lotes/page.tsx
- sistema-adalto/src/app/(employee)/documents/[documentId]/page.tsx
- sistema-adalto/src/app/api/v1/rh/batches/route.ts
- sistema-adalto/src/lib/db/schema/batches.ts
- sistema-adalto/src/lib/db/schema/index.ts
- sistema-adalto/src/lib/rh/batches/import-batch.ts
- sistema-adalto/src/lib/rh/batches/import-validation.ts