---
story_id: "2.5"
story_key: "2-5-vinculo-seguro-do-colaborador-por-codigo-de-referencia"
epic: "2"
title: "Vinculo Seguro do Colaborador por Codigo de Referencia"
status: "done"
created_date: "2026-04-27"
last_updated: "2026-04-27"
---

# Story 2.5: Vinculo Seguro do Colaborador por Codigo de Referencia

Status: done

## Story

As a colaborador em primeiro acesso,
I want confirmar meu codigo de referencia para ativar meu acesso,
so that meus documentos sejam associados ao meu perfil correto com seguranca.

## Acceptance Criteria

1. Given um colaborador pre-cadastrado no tenant com `codigo_de_referencia`
   When ele realizar o primeiro acesso e informar esse codigo junto com um verificador secundario valido
   Then o sistema deve ativar o vinculo do usuario ao registro correto
   And registrar trilha auditavel da ativacao.

2. Given um codigo inexistente, divergente ou duplicado
   When o colaborador tentar concluir a ativacao
   Then o sistema deve bloquear o vinculo
   And nao pode liberar acesso ao portal nem inferir associacao parcial.

3. Given documentos roteados por `codigo_de_referencia`
   When o lote for publicado
   Then o sistema deve resolver esse codigo para a identidade funcional interna do colaborador
   And disponibilizar o documento somente ao usuario vinculado.

4. Given tentativa de acesso cross-tenant ou combinacao invalida de fatores
   When o fluxo de ativacao for executado
   Then o sistema deve falhar fechado com erro padronizado
   And registrar evento auditavel com correlation_id.

## Dependencies and Scope

### Dependencias

- Story 1.2 concluida: login/sessao segura ja existem e devem ser reutilizados.
- Story 1.3 concluida: RBAC e escopo por tenant ja estao estabelecidos.
- Story 3.6 concluida: o processamento de PDF agora extrai `codigo_colaborador` como sinal principal de associacao.
- Story 5.3 concluida: o projeto ja adotou padrao de mapeamento de identificadores tenant-bound que pode servir como referencia conceitual.

### Fora de Escopo

- Cadastro livre de colaborador sem pre-vinculo interno.
- Autoescolha de codigo pelo colaborador.
- Reset de senha e recuperacao de acesso avancada.
- Integrações externas de onboarding de colaborador.

## Technical Requirements

### Domain and Data Rules

1. Introduzir uma identidade funcional do colaborador por tenant, separada de `users`, com no minimo:
   - `tenant_id`
   - `reference_code`
   - `employee_name`
   - `status` (`pending_activation`, `active`, `blocked`)
   - `user_id` nullable ate ativacao
   - verificador secundario seguro (`admission_date`, `cpf_hash_parcial` ou equivalente permitido)
2. `reference_code` deve ser unico por tenant para identidade ativa.
3. O vinculo do primeiro acesso deve ser atomicamente gravado e auditado.
4. O sistema deve resolver documentos publicados a partir dessa identidade funcional, nao de texto solto.

### Security and Activation Rules

1. O `codigo_de_referencia` nao pode ser a unica prova de identidade.
2. O fluxo deve exigir um verificador secundario configuravel por tenant/politica.
3. O colaborador nao pode ativar um registro que ja esteja vinculado a outro `user_id`.
4. Toda tentativa invalida deve ser auditada sem vazar informacao sensivel.

### API and UX Rules

1. O primeiro acesso deve ser um fluxo dedicado, separado do login recorrente.
2. O fluxo deve seguir o padrao de API `{ data, error, meta }` com `correlation_id`.
3. A UX deve ser curta e objetiva, com linguagem simples e sem termos tecnicos de pipeline.
4. Em erro, a interface deve orientar o colaborador a procurar RH quando houver mismatch de cadastro.

## File Structure Requirements

- `src/modules/employee-identity/domain/*`
- `src/modules/employee-identity/application/*`
- `src/modules/employee-identity/infrastructure/*`
- `src/app/api/v1/employee/activation/route.ts`
- `src/app/(public)/primeiro-acesso/page.tsx`
- `src/lib/db/schema/employee-identities.ts`
- `src/lib/db/schema/index.ts`
- `__tests__/employee-activation-api.test.ts`
- `__tests__/employee-identity-domain.test.ts`

## Testing Requirements

1. Ativacao valida vincula `user_id` correto ao registro funcional do tenant.
2. Codigo inexistente retorna erro padronizado sem ativacao parcial.
3. Codigo duplicado ou ambiguo bloqueia o fluxo.
4. Cross-tenant e mismatch de verificador secundario falham fechado.
5. Documento publicado por `reference_code` aparece apenas para o colaborador vinculado.

## Tasks / Subtasks

- [x] T1 - Modelar identidade funcional do colaborador por tenant.
- [x] T2 - Criar fluxo de primeiro acesso com `codigo_de_referencia` + verificador secundario.
- [x] T3 - Resolver publicacao/consulta de documentos via identidade funcional interna.
- [x] T4 - Auditar ativacoes, recusas e conflitos de vinculo.
- [x] T5 - Cobrir testes automatizados de ativacao, ambiguidade e isolamento.

## Dev Notes

- O ponto central desta story e transformar o `codigo_de_referencia` do documento em uma chave operacional segura, sem permitir associacao manual frouxa.
- O melhor modelo para o ADALTO nao e “o colaborador escolhe o proprio codigo”, e sim “o colaborador confirma um codigo oficial preexistente”.
- Essa story prepara a base correta para publicacao precisa e portal do colaborador com menos risco de exposicao cruzada.

### References

- Source: `_bmad-output/planning-artifacts/prd.md`
- Source: `_bmad-output/planning-artifacts/ux-design-specification.md`
- Source: `_bmad-output/implementation-artifacts/1-2-autenticacao-com-sessao-segura-e-criptografia.md`
- Source: `_bmad-output/implementation-artifacts/1-3-autorizacao-rbac-por-perfil-e-escopo-de-tenant.md`
- Source: `_bmad-output/implementation-artifacts/3-6-processamento-de-relatorio-geral-pdf-multipagina.md`
- Source: `_bmad-output/implementation-artifacts/5-3-mapeamento-de-identificadores-entre-origem-e-tenant.md`

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- Suite focal verde: `rtk npm run test:run -- __tests__/activate-employee-access.test.ts __tests__/employee-activation-api.test.ts __tests__/publish-employee-documents.test.ts __tests__/rh-batches-publish-domain.test.ts`
- Regressao relacionada verde: `rtk npm run test:run -- __tests__/auth-login.test.ts __tests__/employee-documents-api.test.ts __tests__/employee-identity-domain.test.ts __tests__/employee-identities-repository.test.ts __tests__/employee-identity-activation-candidate.test.ts __tests__/rh-employee-registration-api.test.ts`
- Lint local verde: `rtk npm run lint -- __tests__/activate-employee-access.test.ts __tests__/employee-activation-api.test.ts __tests__/publish-employee-documents.test.ts __tests__/rh-batches-publish-domain.test.ts src/lib/documents/publish-employee-documents.ts src/modules/employee-identity/application/activate-employee-access.ts src/app/api/v1/employee/activation/route.ts src/modules/employee-identity/components/EmployeeActivationForm.tsx src/app/(public)/primeiro-acesso/page.tsx src/modules/batches/application/publish-batch.ts src/modules/batches/infrastructure/batch-repository.ts`
- Regressao global verde: `rtk npm run test:run` com `411/411` testes verdes
- Lint global verde: `rtk npm run lint`

### Completion Notes List

- Reutilizado e validado o modulo `employee-identity` introduzido pela Story 2.6 como base tenant-bound para vinculacao segura do colaborador.
- Implementado fluxo dedicado de primeiro acesso em `POST /api/v1/employee/activation` com `tenant_id`, `reference_code`, `admission_date`, criacao de credencial, abertura de sessao e cookie seguro.
- Criada UX publica `src/app/(public)/primeiro-acesso/page.tsx` com formulario curto, mensagens objetivas e orientacao para acionar o RH em caso de mismatch.
- Publicacao de lote agora resolve `reference_code` contra identidade funcional ativa e vinculada antes de inserir `employee_documents`, evitando associacao frouxa por texto solto.
- Auditoria adicionada para ativacoes concluidas e recusadas com `correlation_id`, incluindo conflitos de vinculo e dados invalidos.
- Testes automatizados adicionados para servico de ativacao, rota de ativacao, resolucao segura de publicacao e regressao do dominio de publicacao.

### Change Log

- 2026-04-28: Implementado primeiro acesso seguro do colaborador com ativacao por codigo de referencia, verificador secundario, sessao inicial e auditoria.
- 2026-04-28: Publicacao de documentos passou a exigir resolucao por identidade funcional ativa e vinculada antes de disponibilizar documentos ao colaborador.

### File List

- _bmad-output/implementation-artifacts/2-5-vinculo-seguro-do-colaborador-por-codigo-de-referencia.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- __tests__/activate-employee-access.test.ts
- __tests__/employee-activation-api.test.ts
- __tests__/publish-employee-documents.test.ts
- __tests__/rh-batches-publish-domain.test.ts
- src/app/(public)/primeiro-acesso/page.tsx
- src/app/api/v1/employee/activation/route.ts
- src/lib/documents/publish-employee-documents.ts
- src/modules/batches/application/publish-batch.ts
- src/modules/batches/infrastructure/batch-repository.ts
- src/modules/employee-identity/application/activate-employee-access.ts
- src/modules/employee-identity/components/EmployeeActivationForm.tsx

### Review Findings

- [x] [Review][Patch] Activation API remains blocked by proxy for unauthenticated first access [src/proxy.ts:10]
- [x] [Review][Patch] Activation success commits before session bootstrap, leaving irrecoverable partial activation on downstream failure [src/app/api/v1/employee/activation/route.ts:48]
- [x] [Review][Patch] Validation and failure responses from activation route omit mandatory `x-correlation-id` response header [src/app/api/v1/employee/activation/route.ts:36]
