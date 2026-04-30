---
title: 'Corrigir erros de interacao do MVP'
type: 'bugfix'
created: '2026-04-22T22:48:00-03:00'
status: 'done'
baseline_commit: '535597d9f249a8be71854863e8da47b3e26a3575'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O MVP compila nos testes unitarios, mas interacoes reais quebram em runtime: paginas com botoes MUI usando `component={Link}` em Server Components disparam erro RSC, e a rota de importacao de lotes quebra no Turbopack porque `pdf-parse` nao expoe default ESM.

**Approach:** Corrigir os pontos reproduzidos que impedem navegacao e fluxo basico de lotes, preservando a arquitetura atual e sem reverter alteracoes existentes. Adicionar testes focados para travar os comportamentos que falharam.

## Boundaries & Constraints

**Always:** manter Next.js App Router, envelope padrao de API, validacao de boundary existente e estilos MUI atuais; trabalhar apenas em arquivos relacionados aos crashes reproduzidos; preservar dados e scripts de playtesting.

**Ask First:** alterar modelo de autenticacao, trocar biblioteca de PDF, remover suporte a PDF, resetar banco remoto, ou reorganizar paginas/rotas fora do MVP.

**Never:** reverter a arvore suja existente, mascarar erro com `any`, ignorar erro de importacao via dynamic require sem teste, ou substituir navegacao por reload completo quando `Link`/`href` resolve.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| RH dashboard navigation | Usuario RH autenticado acessa `/rh` | Pagina renderiza sem erro RSC e botoes navegam para `/rh/lotes`, `/rh/auditoria`, `/rh/excecoes` | Se dados falharem, manter `ErrorAlert` atual |
| Notifications navigation | Colaborador autenticado acessa `/notifications` | Pagina renderiza sem erro RSC e link de retorno para documentos funciona | Se listagem falhar, mostrar mensagem atual |
| Batch import API compile | POST `/api/v1/rh/batches` carrega modulo de validacao | Modulo compila em ESM/Turbopack sem erro de default export | Erros de validacao continuam retornando envelope de API |

</frozen-after-approval>

## Code Map

- `src/app/rh/page.tsx` -- Server Component com `Button component={Link}` que quebra serializacao RSC.
- `src/app/(employee)/notifications/page.tsx` -- Server Component com `Button component={Link}` que quebra serializacao RSC.
- `src/lib/rh/batches/import-validation.ts` -- Parser/validador de importacao que importa `pdf-parse` incorretamente para ESM.
- `__tests__/rh-dashboard-summary.test.ts` -- Cobre dashboard RH em nivel de aplicacao; pode receber regressao de render se necessario.
- `__tests__/employee-notifications-ui.test.tsx` -- Cobre UI de notificacoes; deve travar render sem crash.
- `__tests__/rh-batches-import-validation.test.ts` -- Cobre validacao de importacao; deve travar import ESM e parse.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/rh/page.tsx` -- trocar uso de `component={Link}` por padrao serializavel em Server Component -- elimina erro RSC no dashboard.
- [x] `src/app/(employee)/notifications/page.tsx` -- trocar uso de `component={Link}` por padrao serializavel em Server Component -- elimina erro RSC em notificacoes.
- [x] `src/lib/rh/batches/import-validation.ts` -- corrigir import/uso de `pdf-parse` compatível com ESM/Turbopack -- desbloqueia `/rh/lotes` e POST de importacao.
- [x] `__tests__/*` -- adicionar/ajustar testes focados nos tres crashes -- garante regressao automatizada.

**Acceptance Criteria:**
- Given usuario RH autenticado, when acessar `/rh`, then a pagina responde/renderiza sem erro “Functions cannot be passed directly to Client Components”.
- Given usuario colaborador autenticado, when acessar `/notifications`, then a pagina responde/renderiza sem erro “Functions cannot be passed directly to Client Components”.
- Given rota `/api/v1/rh/batches` carregada pelo dev server, when enviar arquivo CSV/JSON/PDF valido ou invalido, then nao ocorre erro de compilacao “Export default doesn't exist in target module”.
- Given `npm run test:run` and `npm run lint`, when executados no workspace canonico, then nao ha falhas.

## Spec Change Log

## Verification

**Commands:**
- `rtk npm run test:run -- --reporter=dot` -- expected: all tests pass.
- `rtk npm run lint` -- expected: no lint errors.
- `rtk curl` login + paginas `/rh`, `/notifications`, `/rh/lotes` -- expected: no runtime RSC/import crash.

## Suggested Review Order

**PDF Validation Runtime**

- Named parser API removes Turbopack default-export crash.
  [`import-validation.ts:2`](../../src/lib/rh/batches/import-validation.ts#L2)

- Wrapper preserves old `{ text, numpages }` contract and destroys parser.
  [`import-validation.ts:131`](../../src/lib/rh/batches/import-validation.ts#L131)

**Server Component Navigation**

- RH dashboard buttons now pass serializable `href` props.
  [`page.tsx:86`](../../src/app/rh/page.tsx#L86)

- Quick actions keep navigation without passing `Link` as a function prop.
  [`page.tsx:306`](../../src/app/rh/page.tsx#L306)

- Notifications return action no longer trips RSC serialization.
  [`page.tsx:40`](../../src/app/(employee)/notifications/page.tsx#L40)

**Regression Tests**

- Constructor mock matches `new PDFParse()` usage.
  [`rh-batches-import-validation.test.ts:9`](../../__tests__/rh-batches-import-validation.test.ts#L9)

- PDF cases still cover multipage, password, limit, and missing period.
  [`rh-batches-import-validation.test.ts:113`](../../__tests__/rh-batches-import-validation.test.ts#L113)
