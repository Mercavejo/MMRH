# Decision Gate Log

## WS4: Playtesting Readiness - Audit Engine
**Data**: 2026-04-16
**Status**: Decidido & Implementado
**Decisão**: Injetar telemetria unificada de playtesting dentro da tabela de `auditLogs` já provida pelo DB.

### Contexto
O Workshop 4 exige observabilidade para acompanhar atrito de usuários e sucesso em fluxos cruciais, focando nas rotas mais acionadas: Dashboard do RH, Visualização de Documentos por Colaboradores, e Importação de Lotes (Ingestão). Em staging/preview, os testes com key users geram eventos que não apareciam granularmente sem varrer application logs ruidosos de infraestrutura.

### Decisão
Em vez de implementar um Logger externo ou banco relacional apartado para as features experimentais que poluísse o container AWS ou o datadog prematuramente, tomou-se a decisão de aproveitar a estrutura existente nativa de banco do sistema (`auditLogs`), injetando uma nomenclatura reservada de actions: `playtest.*.*.friction` e `playtest.*.*.success`.

1. **Camada**: Interceptor injetado logo antes das repostas REST (sucesso e falha).
2. **Segurança**: As chamadas do log de fricção em cenários não-autenticados garantem uso `anonymous` sem estourar restrições de RBAC nem NullPointerException.
3. **Escalabilidade**: O Drizzle faz inserts silenciosos na falha. Permite consultar fricção agregada com facilidade usando um frontend no admin, se necessário.

### Arquivos Modificados
- `src/lib/observability/playtest-audit.ts` (Implementação nova paralela ao audit isolado).
- `src/app/api/v1/rh/batches/route.ts`
- `src/app/api/v1/rh/indicators/route.ts`
- `src/app/api/v1/employee/documents/route.ts`

### Conclusão
Garante acompanhamento técnico granular de fricção durante os playtests, de forma isolada aos relatórios de uso.
