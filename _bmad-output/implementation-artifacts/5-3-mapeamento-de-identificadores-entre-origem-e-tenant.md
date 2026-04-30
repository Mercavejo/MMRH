---
story_id: "5.3"
story_key: "5-3-mapeamento-de-identificadores-entre-origem-e-tenant"
epic: "5"
title: "Mapeamento de Identificadores entre Origem e Tenant"
status: "done"
created_date: "2026-04-13"
last_updated: "2026-04-13"
---

# Story 5.3: Mapeamento de Identificadores entre Origem e Tenant

**Epic:** Epic 5 - Integracoes Externas e Automacao de Ingestao  
**Story ID:** 5.3  
**Priority:** High  
**Status:** done

---

## Story Statement

As a RH/DP operador,
I want mapear identificadores externos para colaboradores internos,
So that o roteamento mantenha acuracia mesmo com multiplas fontes.

---

## Acceptance Criteria

### AC 1: Mapeamento preciso com bloqueio de ambiguidade

**Given** registros externos com identificadores de origem  
**When** o lote for processado  
**Then** o sistema deve aplicar mapeamento para colaborador e tenant corretos  
**And** bloquear associacoes ambiguas para tratamento em excecao.

### AC 2: Versionamento auditavel de regras sem efeito retroativo

**Given** alteracao de regras de mapeamento  
**When** um admin autorizado atualizar configuracao  
**Then** a nova regra deve ser versionada e auditavel  
**And** nao deve afetar retroativamente lotes ja concluidos.

---

## Dependencies and Scope

### Dependencias

- Story 5.1 concluida: intake externo, status operacional e classificacao de falha ja existem e devem ser estendidos.
- Story 5.2 concluida: validacao de contrato versionado no webhook ja esta ativa e deve permanecer gate anterior ao mapeamento.
- Story 3.2 concluida: regra de bloqueio de ambiguidade no roteamento interno ja existe como referencia de comportamento.
- Story 1.3 concluida: RBAC por tenant e escopo funcional continua obrigatorio em alteracoes de configuracao.
- Story 4.1 concluida: trilha auditavel e timeline por evento devem ser reutilizadas para versoes de regra.

### Fora de Escopo

- Publicacao de eventos para consumidores externos (Story 5.4).
- Novo canal de transporte alem do webhook externo atual.
- Alteracao retroativa de lotes concluidos para refletir regras novas.
- Mudanca de modelo comercial/plano por tenant (Epic 6).

---

## Technical Requirements

### API and Contract Requirements

1. Estender o fluxo de intake em `src/app/api/v1/webhooks/integrations/route.ts` para aplicar mapeamento de identificador apos validacao de contrato e antes do registro de processamento final.
2. Preservar envelope padrao `{ data, error, meta }` e propagar `x-correlation-id` no request/response.
3. Para ambiguidades, retornar classificacao rastreavel e manter item bloqueado para fila de excecoes, sem fallback silencioso.
4. Disponibilizar leitura de diagnostico operacional para RH (mapeamento aplicado, motivo de bloqueio, acao recomendada) sem expor dados sensiveis desnecessarios.

### Domain and Data Rules

1. Definir regra de mapeamento por `tenant_id + source_system + external_identifier` com alvo em colaborador interno.
2. Quando houver mais de um candidato valido para o mesmo identificador externo no mesmo escopo, classificar como ambiguidade e bloquear publicacao automatica.
3. Versionar regras de mapeamento com historico auditavel contendo no minimo:
   - `tenant_id`
   - `source_system`
   - `mapping_version`
   - `external_identifier`
   - `employee_id` (ou referencia interna equivalente)
   - `change_type` (create|update|disable)
   - `changed_by`
   - `changed_at`
   - `correlation_id`
4. Garantir regra de nao retroatividade: lotes com status final (`processed`/`published`/`failed` concluido) permanecem vinculados ao snapshot de mapeamento usado no momento do processamento.
5. Persistir no registro de ingestao/processamento a referencia de versao de mapeamento aplicada para auditoria futura.

### Security and Tenant Rules

1. Alteracao de regra de mapeamento somente por perfil autorizado (admin/gestor conforme RBAC do tenant).
2. Toda consulta e escrita de mapeamento deve ser tenant-bound, com bloqueio de cross-tenant (`FORBIDDEN`).
3. Nao vazar identificadores pessoais sensiveis no detalhe de erro; expor apenas metadados tecnicos necessarios para acao operacional.
4. Registrar evento auditavel para cada alteracao de regra e para cada bloqueio por ambiguidade.

### Performance and Reliability Rules

1. Aplicacao de mapeamento deve ser deterministica e idempotente para reenvios do mesmo payload.
2. Ambiguidades devem ser tratadas como estado operacional explicito, nunca como sucesso parcial oculto.
3. Reprocessamento deve permitir nova avaliacao de mapeamento apenas para itens ainda nao concluidos, respeitando a regra de nao retroatividade.
4. Falhas de consulta de mapeamento devem manter rastreabilidade com causa e recomendacao operacional.

---

## Architecture Compliance Notes

### Regras Obrigatorias

- Rotas somente em `src/app/api/v1/**/route.ts`.
- Usar `src/lib/api/response.ts` e `src/lib/api/errors.ts` para contratos de API.
- Validar input no boundary com Zod `safeParse`.
- Acesso ao banco apenas via `src/lib/db/client.ts`.
- Exportar schemas via `src/lib/db/schema/index.ts`.
- Em autorizacao, reutilizar `assertTenantAction` e `RBAC_ACTIONS`; nao criar autorizacao ad-hoc.

### Estrutura de Codigo Alvo

- `src/app/api/v1/webhooks/integrations/route.ts`
- `src/modules/integrations/domain/external-ingestion.ts`
- `src/modules/integrations/application/register-external-ingestion.ts`
- `src/modules/integrations/infrastructure/external-ingestions-repository.ts`
- `src/lib/db/schema/external-ingestions.ts`
- `src/lib/db/schema/index.ts`
- `src/modules/exceptions/*` (somente se necessario para enfileirar ambiguidade com contrato existente)
- `__tests__/external-ingestions-api.test.ts`
- `__tests__/external-ingestions-domain.test.ts`

### Reuso Obrigatorio (Nao Reinventar)

1. Reusar `AUTHORIZED_EXTERNAL_SOURCES`, validacao HMAC e janela temporal de assinatura consolidadas na 5.1/5.2.
2. Reusar classificacao de falhas e linguagem de `recommended_action` ja adotada no modulo integrations.
3. Reusar fila de excecoes existente para itens ambiguos, sem criar fluxo paralelo de tratamento.
4. Reusar padrao de idempotencia e rastreio por `ingestion_id`/`correlation_id` do fluxo atual.

---

## Library and Framework Requirements

- Next.js 16.2.3: manter Route Handlers em App Router com Web Request/Response API.
- Zod 4.x: manter validacao TypeScript-first no boundary com `safeParse`.
- Drizzle ORM 0.45.2 + drizzle-kit 0.31.10: manter schema e migracoes coerentes.
- TypeScript strict: manter tipagem explicita em boundaries e dominio.

Sem novas dependencias obrigatorias para esta story.

---

## Implementation Tasks / Subtasks

- [x] T1 - Modelar regra de mapeamento tenant-bound e ambiguidade (AC: 1)
  - [x] Definir contrato de mapeamento no dominio com chave de lookup deterministicamente escopada por tenant e origem.
  - [x] Definir criterios de ambiguidade e codigos de falha padrao para bloqueio.
  - [x] Cobrir comportamento em funcoes puras do dominio com testes unitarios.

- [x] T2 - Integrar mapeamento no fluxo de ingestao (AC: 1)
  - [x] Aplicar mapeamento apos validacao de contrato e antes de consolidar processamento da ingestao.
  - [x] Bloquear itens ambiguos para excecao com rastreabilidade completa.
  - [x] Preservar envelope padrao, correlation id e semantica de erro existente.

- [x] T3 - Versionar configuracoes de mapeamento com auditoria (AC: 2)
  - [x] Modelar persistencia de versoes de regra com historico de alteracoes por tenant.
  - [x] Garantir que atualizacao de regra exija permissao adequada via RBAC.
  - [x] Registrar eventos auditaveis de alteracao de regra e referencia de versao aplicada por item/lote.

- [x] T4 - Enforce de nao retroatividade (AC: 2)
  - [x] Garantir que lotes ja concluidos mantenham snapshot de versao aplicada anteriormente.
  - [x] Ajustar reprocessamento para respeitar estado do item e regra de nao retroatividade.
  - [x] Adicionar asserts de regressao para impedir reescrita retroativa de vinculacao.

- [x] T5 - Testes automatizados obrigatorios e regressao (AC: 1, 2)
  - [x] API: mapeamento bem-sucedido resolve colaborador/tenant corretos.
  - [x] API: ambiguidade bloqueia associacao e direciona para excecao com erro rastreavel.
  - [x] API: alteracao de regra sem permissao retorna `403`.
  - [x] Dominio: versao nova de regra nao altera processamento de lote concluido.
  - [x] Regressao: manter 403 origem nao autorizada e 409 duplicidade idempotente da 5.1/5.2.

### Review Findings

- [x] [Review][Patch] Classificacao incorreta de erro de mapeamento no intake (not-found mascarado como ambiguidade) [_sistema-adalto/src/app/api/v1/webhooks/integrations/route.ts_]
- [x] [Review][Patch] Ambiguidade bloqueia intake sem enfileirar item na fila de excecoes [_sistema-adalto/src/app/api/v1/webhooks/integrations/route.ts_]
- [x] [Review][Patch] Upsert de mapeamento sujeito a corrida (versionamento/ativo sem transacao + sem unicidade parcial de ativo) [_sistema-adalto/src/modules/integrations/infrastructure/external-identifier-mappings-repository.ts_]
- [x] [Review][Patch] Falta validacao de tenant ownership de `employee_id` no PUT de mapeamento [_sistema-adalto/src/app/api/v1/webhooks/integrations/route.ts_]
- [x] [Review][Patch] Snapshot de `external_identifier` pode ser perdido quando origem usa chaves alternativas [_sistema-adalto/src/modules/integrations/infrastructure/external-ingestions-repository.ts_]
- [x] [Review][Patch] `failureCode` default conflita com status `ambiguous` no dominio [_sistema-adalto/src/modules/integrations/domain/external-ingestion.ts_]
- [x] [Review][Patch] Falta cobertura de regressao para nao retroatividade/reprocessamento de lote concluido [_sistema-adalto/__tests__/external-ingestions-domain.test.ts_]

---

## Testing Requirements Summary

Cobertura minima obrigatoria em `__tests__/**/*.test.ts(x)`:

1. Mapeamento por `tenant_id + source_system + external_identifier` retorna alvo unico correto.
2. Ambiguidade gera bloqueio com classificacao de falha e recomendacao operacional.
3. Regra ausente/indefinida gera erro rastreavel sem publicar automaticamente.
4. Atualizacao de regra exige RBAC correto e gera evento auditavel.
5. Versao nova de regra nao altera lotes concluidos anteriormente.
6. Reprocessamento de item nao concluido pode usar versao vigente sem violar idempotencia.
7. Testes preservam contratos de erro/resposta padrao e `x-correlation-id`.
8. Dependencias externas mockadas com `vi.mock` e estado limpo com `beforeEach`.

---

## Previous Story Intelligence (5.2 e 5.1)

1. 5.2 consolidou validacao de contrato como gate obrigatorio; mapeamento deve executar depois deste gate, nunca antes.
2. 5.2 reforcou persistencia de metadados (`contract_version`, `validation_result`, `correlation_id`) no mesmo fluxo de ingestao; 5.3 deve preservar consistencia ao adicionar `mapping_version` e resultado de associacao.
3. 5.1/5.2 reforcaram que erro sem classificacao/recomendacao e anti-pattern; manter codigos de falha explicitos para ambiguidade.
4. Correcoes recentes de assinatura HMAC e timestamp anti-replay nao podem ser regredidas ao alterar o webhook.
5. Padrrao de testes do modulo integrations ja esta estabelecido em API + dominio; ampliar sem criar suite paralela fora desse padrao.

---

## Git Intelligence Summary

Commits recentes relevantes:

1. `1577a61` - hardening de validacao de assinatura webhook e backfill de migracao; preservar seguranca e coerencia historica.
2. `798a4a3` - validacao de contrato versionado no intake externo; estender fluxo sem quebrar erros e persistencia existentes.
3. `01baec7` - base de ingestao externa e monitoramento RH; reusar estrutura de modulo, repositorio e testes.
4. `43bab3b` - consolidacao de auditoria/alertas/excecoes; reusar mecanismos operacionais existentes para ambiguidade.
5. `b31b68c` - idempotencia e auditoria em reprocessamento; manter semantica para reenvios e correcoes.

---

## Latest Tech Information

- Next.js Route Handlers mantem suporte oficial a handlers por metodo HTTP e Web APIs (`Request`/`Response`) na versao 16.2.3.
- Zod 4 esta estavel e continua alinhado com TypeScript strict para validacao de boundary.
- Drizzle continua com abordagem SQL-like e migracoes versionadas; manter alteracoes de schema acompanhadas por migracao e export central.

---

## Project Structure Notes

- Fluxo de integracoes externas permanece centralizado em `src/modules/integrations` e `src/app/api/v1/webhooks/integrations`.
- Se houver tabela/colunas novas para versao de mapeamento, atualizar schema central e migracoes em `drizzle/migrations`.
- Evitar duplicar regra de mapeamento em API e dominio; manter fonte unica no dominio integrations.
- Manter compatibilidade de API e UI operacional de RH sem introduzir endpoints fora do padrao `/api/v1`.

---

## References

- Source: `_bmad-output/planning-artifacts/epics.md` (Epic 5; Story 5.3)
- Source: `_bmad-output/planning-artifacts/prd.md` (FR45; FR47; NFR21-NFR24; NFR7)
- Source: `_bmad-output/planning-artifacts/architecture.md` (API `/api/v1`; tenant scoping; eventos versionados; correlation_id)
- Source: `_bmad-output/planning-artifacts/ux-design-specification.md` (feedback operacional claro; orientacao por excecao)
- Source: `_bmad-output/project-context.md` (regras obrigatorias de API, RBAC e testes)
- Source: `_bmad-output/implementation-artifacts/5-1-ingestao-externa-com-monitoramento-operacional.md`
- Source: `_bmad-output/implementation-artifacts/5-2-validacao-de-contrato-versionado.md`

---

## Story Completion Status

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story implementada, revisada e definida para `done`.

---

## Open Questions (registradas apos analise completa)

1. O mapeamento deve suportar multiplos identificadores externos por colaborador (ex.: matricula + cpf mascarado) no mesmo `source_system`?
2. O versionamento de regra sera por snapshot completo por tenant ou por alteracao incremental de linhas de mapeamento?
3. Em ambiguidade, o item deve ir para excecao com prioridade padrao ou prioridade elevada por risco de roteamento incorreto?

---

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Workflow base: `.github/skills/bmad-dev-story/workflow.md`
- Testes RED: `npm run -s test:run -- __tests__/external-ingestions-domain.test.ts __tests__/external-ingestions-api.test.ts`
- Testes GREEN focados: `npm run -s test:run -- __tests__/external-ingestions-domain.test.ts __tests__/external-ingestions-api.test.ts`
- Regressao completa: `npm run -s test:run`
- Qualidade: `npm run -s lint`

### Completion Notes List

- Implementada resolucao de identificador externo com resultado deterministico (`mapped`, `ambiguous`, `not-found`) e classificacao de falhas de mapeamento no dominio.
- Integrado mapeamento no webhook de intake apos validacao de contrato, bloqueando ambiguidades com erro estruturado `AMBIGUOUS_ASSOCIATION` e mantendo envelope padrao.
- Implementado endpoint `PUT /api/v1/webhooks/integrations` para versionar regras de mapeamento com RBAC, auditoria e persistencia historica.
- Estendido schema/persistencia de `external_ingestions` para snapshot de mapeamento (`mapping_status`, `mapping_version`, `mapped_employee_id`, `external_identifier`) garantindo nao retroatividade para lotes concluidos.
- Adicionada migracao SQL para enum/tabela de mapeamento e colunas de snapshot.
- Cobertura de testes ampliada para dominio e API: mapeamento com sucesso, bloqueio por ambiguidade e proibicao de update de regra sem permissao.

### File List

- `_bmad-output/implementation-artifacts/5-3-mapeamento-de-identificadores-entre-origem-e-tenant.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `sistema-adalto/__tests__/external-ingestions-api.test.ts`
- `sistema-adalto/__tests__/external-ingestions-domain.test.ts`
- `sistema-adalto/drizzle/migrations/20260413_identifier_mapping.sql`
- `sistema-adalto/src/app/api/v1/webhooks/integrations/route.ts`
- `sistema-adalto/src/lib/db/schema/external-identifier-mappings.ts`
- `sistema-adalto/src/lib/db/schema/external-ingestions.ts`
- `sistema-adalto/src/lib/db/schema/index.ts`
- `sistema-adalto/src/modules/integrations/application/register-external-ingestion.ts`
- `sistema-adalto/src/modules/integrations/application/resolve-external-identifier-mapping.ts`
- `sistema-adalto/src/modules/integrations/application/upsert-external-identifier-mapping.ts`
- `sistema-adalto/src/modules/integrations/domain/external-ingestion.ts`
- `sistema-adalto/src/modules/integrations/infrastructure/external-identifier-mappings-repository.ts`
- `sistema-adalto/src/modules/integrations/infrastructure/external-ingestions-repository.ts`

## Change Log

- 2026-04-13: Story 5.3 criada com status `ready-for-dev` e contexto completo para execucao por dev agent.
- 2026-04-13: Story 5.3 implementada com mapeamento versionado, bloqueio de ambiguidade, endpoint de configuracao e regressao completa validada; status atualizado para `review`.
