---
story_id: "5.4"
story_key: "5-4-publicacao-de-eventos-para-consumidores-externos"
epic: "5"
title: "Publicacao de Eventos para Consumidores Externos"
status: "done"
created_date: "2026-04-13"
last_updated: "2026-04-13"
---

# Story 5.4: Publicacao de Eventos para Consumidores Externos

**Epic:** Epic 5 - Integracoes Externas e Automacao de Ingestao  
**Story ID:** 5.4  
**Priority:** High  
**Status:** done

---

## Story Statement

As a sistema consumidor autorizado,
I want receber eventos de processamento e publicacao,
So that eu sincronize status e automacoes no ecossistema da empresa.

---

## Acceptance Criteria

### AC 1: Eventos canonicos publicados apenas para consumidores autorizados

**Given** eventos de recebido, validado, processado, publicado e excecao  
**When** uma transicao de estado ocorrer em um fluxo de integracao ja persistido  
**Then** o sistema deve publicar evento canonico com `event_name`, `event_version`, `occurred_at`, `correlation_id`, `tenant_id`, `actor` e `payload` minimo  
**And** o nome do evento deve seguir o padrao `integrations.external_ingestion.<state>.v1`  
**And** a entrega deve ocorrer somente para consumidores autorizados no mesmo tenant e para o evento assinado.

### AC 2: Reenvio idempotente sem duplicidade de efeitos

**Given** uma nova tentativa de entrega do mesmo evento por falha transitoria ou reprocessamento operacional  
**When** o sistema recalcular a mesma publicacao para o mesmo consumidor e fingerprint do evento  
**Then** nao deve haver duplicidade de entrega, de registro operacional ou de efeito externo  
**And** a segunda tentativa deve reutilizar o mesmo fingerprint/idempotency key de entrega  
**And** a publicacao do evento nao pode desfazer nem bloquear o workflow principal que ja teve seu estado duravel confirmado.

### AC 3: Falha final rastreavel e visibilidade operacional

**Given** falha de autorizacao, configuracao do consumidor ou esgotamento das tentativas  
**When** a entrega nao puder ser concluida  
**Then** o sistema deve registrar `failure_code`, `recommended_action`, `attempt_count`, `last_error`, `correlation_id`, `tenant_id` e `consumer_key`  
**And** deve manter trilha auditavel do resultado da publicacao  
**And** o suporte/RH autorizado deve conseguir diagnosticar a falha sem acesso a payload bruto ou segredos.

---

## Dependencies and Scope

### Dependencias

- Story 5.1 concluida: intake externo, rastreio e classificacao de falhas ja existem e fornecem a base de eventos de origem.
- Story 5.2 concluida: validacao de contrato por versao ja esta consolidada e deve continuar sendo gate anterior a qualquer publicacao.
- Story 5.3 concluida: mapeamento de identificadores e snapshot de tenant ja estao disponiveis para compor payloads com contexto correto.
- Story 4.1 concluida: trilha auditavel e linha do tempo por evento ja fornecem o padrao de rastreio que esta story deve reutilizar.
- Story 4.3 concluida: severidade, causa e acao recomendada para falhas operacionais ja possuem linguagem consolidada.
- Story 1.2 concluida: correlation_id e seguranca de sessao ja estao padronizados para os fluxos autenticados que consumirem diagnostico operacional.
- Story 1.3 concluida: RBAC por tenant e escopo de permissao seguem obrigatorios para qualquer consulta administrativa relacionada a entrega de eventos.

### Fora de Escopo

- Criar painel novo para administracao de consumidores externos.
- Implementar broker/infra de mensageria externa dedicada fora do padrao atual do projeto.
- Criar novo endpoint publico de publicacao manual de eventos.
- Expandir a cobertura para notificacao de colaborador final (FR15), que pertence a outro slice.
- Introduzir transportes adicionais como API/SFTP para consumo dos eventos nesta story.

---

## Technical Requirements

### Event and Contract Requirements

1. Reusar `src/lib/events/publisher.ts` como adaptador central de evento; nao criar abstractions paralelas para publicacao.
2. Definir contrato canonico de evento de saida com o padrao `domain.entity.action.v1`, usando estes nomes iniciais:
   - `integrations.external_ingestion.received.v1`
   - `integrations.external_ingestion.validated.v1`
   - `integrations.external_ingestion.processed.v1`
   - `integrations.external_ingestion.published.v1`
   - `integrations.external_ingestion.exception.v1`
3. Cada evento deve conter no minimo:
   - `event_name`
   - `event_version`
   - `occurred_at`
   - `correlation_id`
   - `tenant_id`
   - `actor.actor_id`
   - `actor.actor_role`
   - `payload` com metadados operacionais apenas
4. O `payload` nao pode expor conteudo bruto sensivel, tokens, segredos ou dados alem do necessario para sincronizacao externa.
5. Toda emissao deve ser vinculada a um estado duravel ja persistido; read-only views ou estados transitorios nao podem gerar evento externo.

### Domain and Data Rules

1. Modelar a publicacao de eventos no modulo `src/modules/integrations` para reutilizar o contexto de tenant, contrato e mapeamento ja existente.
2. Persistir tentativa de entrega por consumidor com identificacao deterministica de idempotencia/fingerprint baseada em:
   - `tenant_id`
   - `event_name`
   - `event_version`
   - `source_reference` ou `ingestion_id`
   - `consumer_key`
3. Registrar status de entrega com ciclos minimos:
   - `pending`
   - `delivering`
   - `delivered`
   - `failed`
4. Manter allowlist de consumidores autorizados por tenant e por evento, sem permitir cross-tenant subscription.
5. Guardar historico de tentativas com `attempt_count`, `last_attempt_at`, `last_error`, `failure_code`, `recommended_action` e `correlation_id`.

### Security and Tenant Rules

1. Todo consumidor deve ser validado contra o tenant de origem antes de receber qualquer payload.
2. Consumidor inativo, desconhecido ou fora do escopo deve ser tratado como `FORBIDDEN` operacional, sem vazamento de dados do evento.
3. Nenhum evento deve atravessar tenant boundary fora da allowlist explicitamente autorizada.
4. A publicacao nao deve exigir um novo contexto de sessao do usuario final; deve operar a partir do contexto interno do workflow que gerou o evento.
5. Se a entrega falhar, o estado do workflow de origem continua valido e a falha fica isolada no canal de entrega.

### Performance and Reliability Rules

1. A emissao de evento deve ser best-effort para o fluxo de origem: o estado principal nao pode ser revertido por falha de entrega externa.
2. Reenvios do mesmo evento devem ser idempotentes e nao podem duplicar registros de entrega nem efeitos no consumidor.
3. Falhas transitorias devem ser registradas para retentativa; falhas finais devem ser classificadas com causa e acao recomendada.
4. Limitar tentativas a uma politica clara e testavel; o padrao desta story e 3 tentativas para falhas transitivas, preservando o estado final no banco.
5. A publicacao nao deve criar polling agressivo nem jobs paralelos sem necessidade; reutilizar o padrao operacional do modulo de integracoes.

---

## Architecture Compliance Notes

### Regras Obrigatorias

- Rotas somente em `src/app/api/v1/**/route.ts`; esta story nao deve criar novo endpoint publico se o fluxo puder ser executado pelo modulo de aplicacao existente.
- Usar `src/lib/events/publisher.ts` para o envelope de evento e `src/lib/db/client.ts` para persistencia.
- Exportar novos schemas por `src/lib/db/schema/index.ts` e versionar migracao em `drizzle/migrations` quando necessario.
- Nao criar cliente de banco paralelo nem abstrair publicacao fora do modulo de integracoes.
- Se algum fluxo administrativo for adicionado futuramente, aplicar `validateSession`, `assertTenantAction` e `RBAC_ACTIONS` como nos demais fluxos do tenant.

### Estrutura de Codigo Alvo

- `src/lib/events/publisher.ts`
- `src/modules/integrations/domain/external-events.ts`
- `src/modules/integrations/application/publish-external-events.ts`
- `src/modules/integrations/infrastructure/external-event-consumers-repository.ts`
- `src/modules/integrations/infrastructure/external-event-deliveries-repository.ts`
- `src/lib/db/schema/external-event-consumers.ts`
- `src/lib/db/schema/external-event-deliveries.ts`
- `src/lib/db/schema/index.ts`
- `drizzle/migrations/*external-event*`
- `__tests__/external-events-domain.test.ts`
- `__tests__/external-events-publication.test.ts`

### Reuso Obrigatorio (Nao Reinventar)

1. Reusar o padrao de event name e payload minimo ja consolidado em `src/modules/batches/application/publish-batch.ts` com `rh.batch.published.v1`.
2. Reusar `correlation_id` e trilha auditavel do fluxo de integracoes ja entregue nas stories 5.1-5.3.
3. Reusar a semantica de falha e `recommended_action` de `src/modules/integrations/domain/external-ingestion.ts` para qualquer falha de entrega.
4. Reusar o principio de best-effort para side effects: o workflow principal nao deve depender de entrega externa sincrona para ser considerado concluido.

---

## Library and Framework Requirements

- Next.js 16.2.3 (App Router e Route Handlers).
- React 19.2.x.
- TypeScript ^5 com `strict` habilitado.
- Zod 4.x para validacao de qualquer entrada administrativa futura.
- Drizzle ORM 0.45.2 para persistencia de consumidores e entregas.
- Vitest 4.1.x para testes de dominio, persistencia e regressao operacional.

Sem novas dependencias obrigatorias para esta story.

---

## File Structure Requirements

- Manter o modulo de integracoes como fonte unica da logica de publicacao externa.
- Adicionar schema novo somente se houver necessidade real de persistir allowlist ou tentativas de entrega.
- Qualquer schema novo deve ser exportado em `src/lib/db/schema/index.ts` e acompanhado de migracao.
- Nao duplicar regras de autorizacao em app, dominio e infraestrutura; manter uma unica decisao de allowlist por consumidor/tenant.

---

## Testing Requirements Summary

Cobertura minima obrigatoria em `__tests__/**/*.test.ts(x)`:

1. Dominio monta evento canonico com nome, versao, correlation_id, tenant_id e payload minimo correto.
2. Dominio bloqueia payload com dados sensiveis ou campos nao permitidos na publicacao externa.
3. Publicacao idempotente nao duplica entrega quando o mesmo fingerprint e reprocessado.
4. Consumidor nao autorizado ou tenant mismatch nao recebem evento e geram falha rastreavel.
5. Falha transitoria grava tentativa, causa e acao recomendada sem quebrar o workflow principal.
6. Evento de origem ja consolidado em 5.1-5.3 permanece funcional apos habilitar a nova publicacao externa.
7. Dependencias externas mockadas com `vi.mock` e estado limpo com `beforeEach`.

---

## Previous Story Intelligence (5.3, 5.2 e 5.1)

1. 5.3 consolidou snapshots de tenant, mapeamento e nao retroatividade; esta story deve ler o contexto ja persistido e publicar somente apos estado duravel.
2. 5.2 consolidou validacao de contrato por versao como gate obrigatorio; a emissao externa nunca pode ocorrer antes desse gate.
3. 5.1 consolidou idempotencia, correlation_id, audit trail e falhas classificadas; a nova publicacao deve reutilizar a mesma semantica de rastreio.
4. As stories anteriores mostraram que fallback silencioso e regressao operacional; esta story deve deixar claro quando a entrega falha, quem pode ver e como retentar.

---

## Git Intelligence Summary

Commits recentes relevantes:

1. `b31b68c` - reforcou idempotencia e auditoria em reprocessamento; manter fingerprint e estado de entrega sem duplicidade.
2. `01baec7` - consolidou a base de integracoes externas; reutilizar a estrutura de modulo, schema e testes.
3. `798a4a3` - endureceu validacao de contrato versionado; manter a publicacao acoplada ao estado validado.
4. `1577a61` - reforcou seguranca de webhook e hardening de origem; nao abrir excecao para consumidores nao autorizados.
5. `43bab3b` - consolidou auditoria e alertas; usar a mesma linguagem de falha e evidencia operacional.

---

## Latest Tech Information

- O helper `src/lib/events/publisher.ts` ja expõe `buildDomainEvent` e `publishDomainEvent`; esta story deve estender o uso desses helpers, nao substitui-los.
- O padrao de evento ja em uso no projeto e `domain.entity.action.v1`, exemplificado por `rh.batch.published.v1` em `src/modules/batches/application/publish-batch.ts`.
- Next.js App Router continua adequado para fluxos do MVP, mas esta story nao precisa de novo Route Handler se a publicacao puder ser acoplada aos fluxos de aplicacao existentes.
- Drizzle continua sendo o caminho para schema/migracao; se houver allowlist ou entrega persistida, o schema deve nascer versionado e exportado no index central.

---

## Project Structure Notes

- O trabalho deve ficar isolado em `src/modules/integrations` e `src/lib/events` para evitar duplicacao com batches, audit ou notifications.
- O payload externo deve ser estritamente operacional e orientado a sincronizacao; nao misturar com documento bruto, UI state ou dados de autenticacao.
- Nao criar canal paralelo para notificacao de colaborador; esse requisito pertence ao Epic 2/FR15, nao ao outbound eventing da integracao.
- Se a equipe precisar de admin de consumidores depois, isso deve virar story separada com RBAC e UI proprios.

---

## References

- Source: `_bmad-output/planning-artifacts/epics.md` (Epic 5; Story 5.4; FR46)
- Source: `_bmad-output/planning-artifacts/prd.md` (FR46; NFR23; NFR24)
- Source: `_bmad-output/planning-artifacts/architecture.md` (event naming; `/api/v1`; tenant scoping; audit trail; correlation_id)
- Source: `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-08.md` (Epic 5 Story 5.4 size warning; error-path guidance)
- Source: `_bmad-output/implementation-artifacts/epic-4-retro-2026-04-13.md` (reuso de correlation_id, audit trail e tenant-bound)
- Source: `_bmad-output/implementation-artifacts/5-1-ingestao-externa-com-monitoramento-operacional.md`
- Source: `_bmad-output/implementation-artifacts/5-2-validacao-de-contrato-versionado.md`
- Source: `_bmad-output/implementation-artifacts/5-3-mapeamento-de-identificadores-entre-origem-e-tenant.md`
- Source: `sistema-adalto/src/lib/events/publisher.ts`
- Source: `sistema-adalto/src/modules/batches/application/publish-batch.ts`
- Source: `sistema-adalto/src/modules/integrations/domain/external-ingestion.ts`

---

## Dev Agent Record

### Agent Model Used

GPT-5.4 mini

### Debug Log References

- `bmad-init` carregou a configuracao do projeto e o contexto de comunicacao.
- `bmad-dev-story` guiou a implementacao da story 5.4 a partir dos ACs e dos requisitos tecnicos.
- Testes focados executados com sucesso para dominio, publicacao e regressao do fluxo de ingestao.
- Suite completa de testes executada com sucesso.
- Lint executado com apenas avisos preexistentes e nao bloqueantes.

### Completion Notes List

- Publicacao externa implementada como best-effort a partir do fluxo duravel de ingestao.
- Envelope canonico e nomes de eventos externos consolidados em `src/modules/integrations/domain/external-events.ts`.
- Allowlist de consumidores e rastreio duravel de entregas adicionados com migracao propria.
- Fingerprint e idempotencia de entrega passaram a ser deterministicas por tenant, evento, referencia de origem e consumidor.
- Falhas finais agora registram `failure_code`, `recommended_action`, `attempt_count`, `last_error`, `correlation_id`, `tenant_id` e `consumer_key`.

### File List

- `src/lib/db/schema/external-event-consumers.ts`
- `src/lib/db/schema/external-event-deliveries.ts`
- `src/lib/db/schema/index.ts`
- `src/modules/integrations/domain/external-events.ts`
- `src/modules/integrations/infrastructure/external-event-consumers-repository.ts`
- `src/modules/integrations/infrastructure/external-event-deliveries-repository.ts`
- `src/modules/integrations/application/publish-external-events.ts`
- `src/modules/integrations/application/register-external-ingestion.ts`
- `drizzle/migrations/20260413_external_event_publication.sql`
- `__tests__/external-events-domain.test.ts`
- `__tests__/external-events-publication.test.ts`
- `__tests__/external-ingestions-publication-regression.test.ts`

### Change Log

- Implementado contrato canonico `integrations.external_ingestion.<state>.v1` para saida externa.
- Implementada allowlist por tenant e evento para consumidores autorizados.
- Implementado tracking duravel de entrega com tentativas, erro final e auditoria.
- Integrado o disparo best-effort no registro de ingestao existente sem bloquear o workflow principal.
- Adicionados testes de dominio, publicacao e regressao operacional.

## Story Completion Status

- Story implementation completed and validated.
- Status definido para `done`.