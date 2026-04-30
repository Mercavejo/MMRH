---
story_id: "2.6"
story_key: "2-6-cadastro-de-colaboradores-pelo-gestor-rh-com-codigo-de-referencia"
epic: "2"
title: "Cadastro de Colaboradores pelo Gestor RH com Codigo de Referencia"
status: "review"
created_date: "2026-04-27"
last_updated: "2026-04-27"
---

# Story 2.6: Cadastro de Colaboradores pelo Gestor RH com Codigo de Referencia

Status: review

## Story

As a gestor RH,
I want cadastrar colaboradores no sistema com nome e codigo de referencia oficial,
so that o portal e a distribuicao de documentos comecem com vinculos corretos desde a origem.

## Acceptance Criteria

1. Given um gestor RH autenticado no tenant
   When ele cadastrar um colaborador com nome e `codigo_de_referencia`
   Then o sistema deve criar uma identidade funcional tenant-bound em estado `pending_activation`
   And validar unicidade do codigo dentro do tenant.

2. Given um cadastro ja existente com o mesmo codigo ou dados conflitantes
   When o gestor tentar salvar
   Then o sistema deve bloquear a operacao
   And exibir erro operacional claro sem duplicar registro.

3. Given um colaborador cadastrado pelo RH
   When esse colaborador realizar o primeiro acesso
   Then o sistema deve poder usar esse pre-cadastro como base para o vinculo seguro da Story 2.5.

4. Given uma alteracao de nome, codigo ou status do colaborador
   When o gestor RH ou admin autorizado atualizar o registro
   Then a mudanca deve ser auditada
   And nao pode quebrar isolamento entre colaboradores nem between tenants.

## Isso e uma boa ideia?

Sim, **e uma boa ideia**, com uma ressalva importante:

- e bom que RH/gestor consiga cadastrar nome + numero de referencia porque isso reduz ambiguidade no roteamento e prepara o primeiro acesso do colaborador;
- mas esse cadastro deve criar uma **identidade funcional pendente**, nao um acesso imediatamente ativo e sem verificacao.

Em outras palavras:

- boa ideia: RH cria o registro base do colaborador;
- nao ideal: RH criar um usuario final “pronto” sem confirmacao do proprio colaborador ou sem segundo fator de verificacao.

## Dependencies and Scope

### Dependencias

- Story 1.3 concluida: RBAC por tenant e papeis ja existe.
- Story 3.6 concluida: o processamento do PDF usa `codigo_colaborador` como chave operacional forte.
- Story 2.5 proposta: este cadastro deve alimentar diretamente o fluxo de ativacao segura do colaborador.

### Fora de Escopo

- Convite por e-mail completo com antifraude avancado.
- Importacao massiva de colaboradores por planilha.
- Gestao completa de folha/cadastro trabalhista fora dos campos minimos de identidade funcional.

## Technical Requirements

### Domain and Data Rules

1. O cadastro RH deve criar/atualizar a mesma entidade funcional usada pela Story 2.5.
2. Campos minimos recomendados:
   - `tenant_id`
   - `reference_code`
   - `employee_name`
   - `admission_date` ou outro verificador secundario aprovado
   - `status`
   - `notes` opcionais minimizadas
3. `reference_code` deve ser unico por tenant.
4. O sistema deve permitir inativar ou bloquear registros sem apagar historico.

### Security and Authorization Rules

1. Apenas `rh_gestor`, `rh_operator` e `admin_plataforma` autorizados podem criar/editar colaboradores funcionais, conforme decisao de produto final.
2. Toda operacao deve ser tenant-bound e auditada.
3. O cadastro nao pode expor dados sensiveis desnecessarios do colaborador.
4. O gestor nao deve conseguir vincular um colaborador a outro tenant.

### UX and Operational Rules

1. A tela deve ser simples e objetiva: nome, codigo de referencia, verificador secundario e status.
2. Mensagens de erro devem explicar claramente duplicidade de codigo, conflito de dados e impedimentos de ativacao.
3. O sistema deve indicar quando um colaborador ainda esta `pending_activation` ou ja foi ativado.
4. O fluxo deve caber na densidade operacional do RH sem parecer um modulo pesado de ERP.

## File Structure Requirements

- `src/app/rh/colaboradores/page.tsx`
- `src/app/api/v1/rh/employees/route.ts`
- `src/app/api/v1/rh/employees/[employeeId]/route.ts`
- `src/modules/employee-identity/domain/*`
- `src/modules/employee-identity/application/*`
- `src/modules/employee-identity/infrastructure/*`
- `src/lib/db/schema/employee-identities.ts`
- `__tests__/rh-employee-registration-api.test.ts`
- `__tests__/rh-employee-registration-ui.test.tsx`

## Testing Requirements

1. Cadastro valido cria identidade funcional `pending_activation`.
2. Codigo duplicado no mesmo tenant retorna erro padronizado.
3. Cross-tenant e role sem permissao retornam `FORBIDDEN`.
4. Atualizacao auditada preserva historico e nao duplica identidade.
5. O cadastro criado pode ser consumido pelo fluxo de primeiro acesso do colaborador.

## Tasks / Subtasks

- [x] T1 - Criar modulo de cadastro funcional de colaborador por tenant.
- [x] T2 - Expor API RH para criar, listar e atualizar colaboradores funcionais.
- [x] T3 - Criar tela RH de cadastro/consulta com foco em nome + codigo de referencia + status.
- [x] T4 - Integrar com o fluxo de ativacao da Story 2.5.
- [x] T5 - Adicionar auditoria, bloqueios de duplicidade e testes automatizados.

## Dev Notes

- Esta story e boa porque move a confiabilidade para antes do upload/publicacao: o RH prepara a identidade certa antes de o documento chegar.
- O `codigo_de_referencia` passa a ser fonte operacional oficial do tenant para distribuicao documental.
- O melhor desenho e: RH cadastra, colaborador confirma, sistema vincula. Isso reduz risco e melhora suporte.

### References

- Source: `_bmad-output/planning-artifacts/prd.md`
- Source: `_bmad-output/planning-artifacts/ux-design-specification.md`
- Source: `_bmad-output/implementation-artifacts/1-3-autorizacao-rbac-por-perfil-e-escopo-de-tenant.md`
- Source: `_bmad-output/implementation-artifacts/3-6-processamento-de-relatorio-geral-pdf-multipagina.md`
- Source: `/home/wogny/projects/sistema-adalto/_bmad-output/implementation-artifacts/2-5-vinculo-seguro-do-colaborador-por-codigo-de-referencia.md`

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- Suite focal verde: `rtk npm run test:run -- __tests__/employee-identity-domain.test.ts __tests__/rh-employee-registration-api.test.ts __tests__/rh-employee-registration-ui.test.tsx`
- Lint local verde: `rtk npm run lint -- src/app/api/v1/rh/employees/route.ts src/app/api/v1/rh/employees/[employeeId]/route.ts src/app/rh/colaboradores/page.tsx src/app/rh/colaboradores/rh-employees-manager.tsx src/modules/employee-identity src/lib/db/schema/employee-identities.ts __tests__/employee-identity-domain.test.ts __tests__/rh-employee-registration-api.test.ts __tests__/rh-employee-registration-ui.test.tsx`
- Regressao global saneada: `rtk npm run test:run -- __tests__/api/exceptions.test.ts __tests__/rbac-permissions-api.test.ts` e `rtk npm run test:run` executados com sucesso
- Validacao final completa: `rtk npm run lint` sem erros e `rtk npm run test:run` com `388/388` testes verdes

### Completion Notes List

- Implementado o schema `employee_identities` com unicidade por `tenant_id + reference_code`, status funcional e verificador secundario `admission_date`.
- Criado modulo `employee-identity` com dominio, aplicacao, persistencia e contrato reutilizavel para a ativacao segura da Story 2.5.
- Expostas rotas RH `GET/POST /api/v1/rh/employees` e `PATCH /api/v1/rh/employees/[employeeId]` com sessao, RBAC, `correlation_id`, auditoria e bloqueio de duplicidade/cross-tenant.
- Criada tela `src/app/rh/colaboradores/page.tsx` com cadastro, consulta, edicao basica e indicacao de `pending_activation` versus colaborador ja ativado.
- Testes de dominio, API e UI adicionados e validados na suite focal.
- Corrigidas regressoes globais nas rotas de excecao e na consulta de permissoes RBAC, restaurando compatibilidade de params e escopo esperado por `rh_gestor`.
- Ajuste de lint aplicado em `src/components/batches/batch-progress-panel.tsx` para zerar erros de `react/no-unescaped-entities`.
- Story validada ponta a ponta e promovida para `review`.

### Change Log

- 2026-04-27: Implementado cadastro funcional de colaboradores por tenant com API RH, tela operacional, auditoria e base reutilizavel para ativacao segura.
- 2026-04-27: Corrigidas regressoes globais em excecoes/RBAC e concluida a validacao completa da story com status `review`.

### File List

- _bmad-output/implementation-artifacts/2-6-cadastro-de-colaboradores-pelo-gestor-rh-com-codigo-de-referencia.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- __tests__/employee-identity-domain.test.ts
- __tests__/rh-employee-registration-api.test.ts
- __tests__/rh-employee-registration-ui.test.tsx
- drizzle/migrations/0009_odd_legion.sql
- drizzle/migrations/meta/0009_snapshot.json
- src/app/api/v1/batches/[batch-id]/exceptions/route.ts
- src/app/api/v1/exceptions/[exception-id]/actions/route.ts
- src/app/api/v1/exceptions/[exception-id]/route.ts
- src/app/api/v1/rbac/permissions/route.ts
- src/app/api/v1/rh/employees/_shared.ts
- src/app/api/v1/rh/employees/route.ts
- src/app/api/v1/rh/employees/[employeeId]/route.ts
- src/app/rh/colaboradores/page.tsx
- src/app/rh/colaboradores/rh-employees-manager.tsx
- src/components/batches/batch-progress-panel.tsx
- src/lib/db/schema/employee-identities.ts
- src/lib/db/schema/index.ts
- src/modules/employee-identity/application/employee-identity-service-error.ts
- src/modules/employee-identity/application/get-employee-identity-activation-candidate.ts
- src/modules/employee-identity/application/list-employee-identities.ts
- src/modules/employee-identity/application/register-employee-identity.ts
- src/modules/employee-identity/application/types.ts
- src/modules/employee-identity/application/update-employee-identity.ts
- src/modules/employee-identity/application/write-employee-identity-audit.ts
- src/modules/employee-identity/domain/employee-identity.ts
- src/modules/employee-identity/infrastructure/employee-identities-repository.ts
