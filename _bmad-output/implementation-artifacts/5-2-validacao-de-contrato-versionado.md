---
story_id: "5.2"
story_key: "5-2-validacao-de-contrato-versionado"
epic: "5"
title: "Validacao de Contrato Versionado"
status: "done"
created_date: "2026-04-13"
last_updated: "2026-04-13"
---

# Story 5.2: Validacao de Contrato Versionado

**Epic:** Epic 5 - Integracoes Externas e Automacao de Ingestao  
**Story ID:** 5.2  
**Priority:** High  
**Status:** done

---

## Story Statement

As a time de integracao,
I want validar schema e versao de contrato antes de processar,
So that payloads invalidos sejam rejeitados de forma previsivel.

---

## Acceptance Criteria

### AC 1: Validacao forte de schema+versao antes de aceitar processamento

**Given** um payload recebido de sistema externo  
**When** a validacao de contrato for executada  
**Then** o sistema deve confirmar schema e versao suportada antes de aceitar processamento  
**And** rejeitar payload fora do contrato com erro estruturado e rastreavel.

### AC 2: Compatibilidade controlada entre versoes ativas e historico de validacao

**Given** evolucao de contrato entre sistemas  
**When** uma nova versao for habilitada  
**Then** o sistema deve manter compatibilidade controlada entre versoes ativas  
**And** registrar historico de validacoes por versao.

---

## Dependencies and Scope

### Dependencias

- Story 5.1 concluida: intake externo, monitoramento RH, classificacao de falhas e base de ingestao ja estao ativos e devem ser estendidos, nao substituidos.
- Story 1.2 concluida: correlation id e sessao segura ja padronizam rastreabilidade de request.
- Story 1.3 concluida: RBAC e tenant scoping devem permanecer obrigatorios no fluxo RH de consulta e monitoramento.
- Story 4.1 concluida: trilha auditavel e timeline por evento ja existem para reuso na rastreabilidade.

### Fora de Escopo

- Mapeamento de identificadores de origem para colaborador/tenant (Story 5.3).
- Publicacao de eventos para consumidores externos (Story 5.4).
- Introducao de novo canal de transporte alem do intake atual (webhook externo ja implementado).

---

## Technical Requirements

### API and Contract Requirements

1. Estender o endpoint em src/app/api/v1/webhooks/integrations/route.ts para exigir versao de contrato no payload e validar schema por versao antes de chamar o registro de ingestao.
2. Preservar envelope padrao { data, error, meta } com correlation_id no header e em meta.
3. Rejeitar contrato invalido com erro estruturado e rastreavel:
   - 400 para schema/versao invalida (VALIDATION_ERROR ou INVALID_PAYLOAD)
   - 403 para origem nao autorizada
   - 409 para duplicidade idempotente (fluxo existente da 5.1)
4. Normalizar o resultado de validacao em formato consistente para auditoria e diagnostico operacional.

### Domain and Data Rules

1. Definir contratos versionados com suporte a multiplas versoes ativas simultaneamente (compatibilidade controlada).
2. Implementar validador de contrato por versao no modulo src/modules/integrations/domain.
3. Registrar historico de validacao por versao contendo no minimo:
   - ingestion_id
   - tenant_id
   - source_system
   - contract_version
   - validation_result (success|failure)
   - failure_code (quando houver)
   - correlation_id
   - validated_at
4. Garantir que payload fora de contrato nunca avance para processamento.
5. Reutilizar codigos de falha existentes e adicionar classificacao especifica para contrato/versionamento quando necessario.

### Security and Tenant Rules

1. Nao permitir bypass de validacao por origem; contrato deve ser avaliado para toda ingestao autorizada.
2. Manter segregacao por tenant em toda persistencia e consulta de historico de validacao.
3. Nao vazar detalhes sensiveis de payload bruto em mensagens de erro; expor apenas metadados tecnicos necessarios para correcao.

### Performance and Reliability Rules

1. Validacao de contrato deve ocorrer no boundary, antes de persistencia de processamento avancado.
2. Manter comportamento idempotente em reenvios, sem duplicar registros funcionais.
3. Preservar causa + acao recomendada para falhas de validacao, sem fallback silencioso.

---

## Architecture Compliance Notes

### Regras Obrigatorias

- Rotas apenas em src/app/api/v1/**/route.ts.
- Usar src/lib/api/response.ts e src/lib/api/errors.ts para resposta/erro.
- Propagar x-correlation-id com utilitario central.
- Acesso ao banco somente via src/lib/db/client.ts e schema exportado por src/lib/db/schema/index.ts.
- Validacao no boundary com Zod safeParse.
- Sem autorizacao ad-hoc fora de assertTenantAction e RBAC_ACTIONS quando aplicavel ao fluxo autenticado.

### Estrutura de Codigo Alvo

- src/app/api/v1/webhooks/integrations/route.ts
- src/modules/integrations/domain/external-ingestion.ts
- src/modules/integrations/application/register-external-ingestion.ts
- src/modules/integrations/infrastructure/external-ingestions-repository.ts
- src/lib/db/schema/external-ingestions.ts
- src/lib/db/schema/index.ts
- __tests__/external-ingestions-api.test.ts
- __tests__/external-ingestions-domain.test.ts

### Reuso Obrigatorio (Nao Reinventar)

1. Reusar AUTHORIZED_EXTERNAL_SOURCES, classificacao de falha e timeline da 5.1.
2. Reusar fluxo de assinatura HMAC e validacao de origem no route handler existente.
3. Reusar padrao de idempotencia ja persistido em external_ingestions.
4. Reusar padrao de feedback operacional do painel de integracoes sem criar UI paralela para erro de contrato.

---

## Implementation Tasks / Subtasks

- [x] T1 - Modelar contrato versionado no dominio (AC: 1, 2)
  - [x] Criar estrutura de versoes suportadas por source_system e regras de compatibilidade.
  - [x] Criar funcao de validacao schema+versao com saida normalizada (success/failure + detalhes rastreaveis).
  - [x] Cobrir transicoes/resultado no dominio sem efeitos colaterais.

- [x] T2 - Aplicar validacao no intake externo (AC: 1)
  - [x] Exigir contract_version no payload de entrada do webhook.
  - [x] Executar validacao antes de registerExternalIngestion.
  - [x] Retornar erro estruturado em caso de contrato invalido com correlation_id.

- [x] T3 - Persistir historico de validacao por versao (AC: 2)
  - [x] Estender schema/repository para armazenar resultado de validacao por versao.
  - [x] Garantir tenant scoping e rastreabilidade por ingestion/correlation.
  - [x] Disponibilizar consulta para monitoramento operacional sem quebrar APIs existentes.

- [x] T4 - Atualizar testes automatizados obrigatorios (AC: 1, 2)
  - [x] API: sucesso com versao suportada e schema valido.
  - [x] API: falha por versao nao suportada.
  - [x] API: falha por schema invalido com erro estruturado.
  - [x] API: manter comportamento de 403 origem nao autorizada e 409 duplicidade idempotente.
  - [x] Dominio: compatibilidade controlada entre versoes ativas e historico de validacoes.

- [x] T5 - Verificacao final e regressao direcionada (AC: 1, 2)
  - [x] Rodar suite de testes focada em integrations.
  - [x] Rodar suite completa para validar ausencia de regressao.
  - [x] Confirmar contratos de resposta e padrao de logs/correlation intactos.

### Review Findings

- [x] [Review][Patch] Refatorar assinatura HMAC para reuso de utilitario compartilhado (remover implementacao local no handler) [sistema-adalto/src/app/api/v1/webhooks/integrations/route.ts:56]
- [x] [Review][Patch] Falta janela de validade para x-integration-timestamp permite replay de requisicao assinada [sistema-adalto/src/app/api/v1/webhooks/integrations/route.ts:108]
- [x] [Review][Patch] Backfill de validated_at na migracao usa now() e distorce historico preexistente; alinhar com received_at para registros antigos [sistema-adalto/drizzle/migrations/20260413_contract_validation_tracking.sql:9]
- [x] [Review][Defer] Corrida entre pre-check de duplicidade e INSERT pode retornar erro de banco nao classificado em concorrencia extrema [sistema-adalto/src/modules/integrations/infrastructure/external-ingestions-repository.ts:105] — deferred, pre-existing

---

## Testing Requirements Summary

Cobertura minima obrigatoria em __tests__/**/*.test.ts(x):

1. Intake aceita payload com contract_version suportada e schema valido (202).
2. Intake rejeita payload com contract_version nao suportada (400) com erro estruturado.
3. Intake rejeita payload com schema fora do contrato (400) com details auditaveis.
4. Intake preserva 403 para origem nao autorizada.
5. Intake preserva 409 para duplicidade idempotente.
6. Dominio valida matriz de compatibilidade entre versoes ativas.
7. Historico de validacao grava contract_version + resultado + correlation_id + tenant_id.
8. Testes limpam estado entre casos e mockam dependencias externas com vi.mock.

---

## Previous Story Intelligence (5.1)

1. O fluxo ja usa HMAC por origem e deve continuar como gate de seguranca antes da logica de contrato.
2. A 5.1 consolidou codigos de falha e recommended_action; 5.2 deve ampliar sem quebrar semantica existente.
3. O repositório e schema de external_ingestions ja suportam rastreio operacional e devem ser estendidos com minimo de ruptura.
4. O review da 5.1 reforcou que fallback generico sem classificacao nao e aceitavel em caminhos de erro.

---

## Git Intelligence Summary

Commits recentes relevantes:

1. 01baec7 - implementou base de integracoes externa (story 5.1), incluindo rota, dominio, repositorio e testes.
2. 43bab3b - consolidou padroes RH e cobertura ampla de testes operacionais; seguir mesmos padroes de clareza de estado e erro.
3. b31b68c - reforcou idempotencia e auditoria no reprocessamento; manter consistencia no tratamento de reenvio.

---

## Latest Tech Information

- Next.js docs confirmam uso do App Router com Route Handlers como padrao adequado para contrato de webhook/REST na versao 16.x.
- Zod 4 permanece estavel e compativel com TypeScript strict para validacao de boundary.
- Drizzle segue abordagem SQL-like com migracoes versionadas; manter schema + migration coesos para qualquer ajuste de persistencia de validacao.
- Nesta story, manter stack atual sem introduzir dependencias novas.

---

## Project Structure Notes

- Integracoes externas continuam centralizadas em src/modules/integrations e src/app/api/v1/webhooks/integrations.
- Qualquer mudanca de schema deve refletir export em src/lib/db/schema/index.ts e migracao em drizzle/migrations quando aplicavel.
- Evitar duplicar validacao em camadas diferentes com regras conflitantes; manter fonte unica de verdade no dominio de integrations.

---

## References

- Source: _bmad-output/planning-artifacts/epics.md (Epic 5; Story 5.2)
- Source: _bmad-output/planning-artifacts/prd.md (FR44; NFR21-NFR24)
- Source: _bmad-output/planning-artifacts/architecture.md (API /api/v1, envelope padrao, boundaries, naming, events)
- Source: _bmad-output/planning-artifacts/ux-design-specification.md (Journey 3 RH, feedback de erro claro e acao orientada)
- Source: _bmad-output/project-context.md (regras de API, correlation id, tenant scoping, testes)
- Source: _bmad-output/implementation-artifacts/5-1-ingestao-externa-com-monitoramento-operacional.md
- Source: sistema-adalto/src/app/api/v1/webhooks/integrations/route.ts
- Source: sistema-adalto/src/modules/integrations/domain/external-ingestion.ts

---

## Story Completion Status

- Story implementada e validada com contrato versionado por origem e validacao no boundary.
- Historico de validacao por versao persistido e exposto no retorno operacional de integracoes.
- Status da story: done.

---

## Open Questions (registradas apos analise completa)

1. O versionamento de contrato sera por origem (source_system) apenas ou tambem por tenant?
2. O historico de validacao deve ficar na tabela external_ingestions (colunas adicionais) ou em tabela dedicada para granularidade por tentativa?
3. Quais versoes iniciais devem estar ativas em producao para payroll-api e sftp-gateway no primeiro rollout?

---

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Workflow base: .github/skills/bmad-dev-story/workflow.md
- Testes RED T1: npm run -s test:run -- __tests__/external-ingestions-domain.test.ts
- Testes RED T2: npm run -s test:run -- __tests__/external-ingestions-api.test.ts
- Testes focados GREEN: npm run -s test:run -- __tests__/external-ingestions-domain.test.ts __tests__/external-ingestions-api.test.ts
- Regressao completa: npm run -s test:run
- Qualidade: npm run -s lint

### Completion Notes List

- Implementado contrato versionado no dominio com matriz de versoes por source_system e validacao schema+versao com retorno normalizado.
- Webhook de intake passou a exigir contract_version e validar contrato antes de registerExternalIngestion; payload invalido/versao invalida retorna 400 estruturado com correlation_id.
- Fluxo de ingestao estendido para persistir contract_version, validation_result, validation_failure_code e validated_at com migration dedicada.
- Consulta operacional preservada e ampliada com contract_validation no payload de retorno, sem quebra do envelope padrao.
- Cobertura automatizada atualizada para sucesso/falha de contrato, mantendo 403 de origem nao autorizada e 409 de duplicidade idempotente.

### File List

- _bmad-output/implementation-artifacts/5-2-validacao-de-contrato-versionado.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- sistema-adalto/__tests__/external-ingestions-api.test.ts
- sistema-adalto/__tests__/external-ingestions-domain.test.ts
- sistema-adalto/drizzle/migrations/20260413_contract_validation_tracking.sql
- sistema-adalto/src/app/api/v1/webhooks/integrations/route.ts
- sistema-adalto/src/lib/db/schema/external-ingestions.ts
- sistema-adalto/src/modules/integrations/domain/external-ingestion.ts
- sistema-adalto/src/modules/integrations/infrastructure/external-ingestions-repository.ts

## Change Log

- 2026-04-13: implementada validacao de contrato versionado no intake externo, persistencia de historico de validacao por versao e cobertura completa de testes da story 5.2.
