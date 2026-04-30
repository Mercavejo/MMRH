## Deferred from: code review of 1-1-set-up-initial-project-from-starter-template (2026-04-08)

- Health check nao valida dependencias (DB/Redis): endpoint atual apenas confirma processo e envelope; aprofundar readiness/liveness em historia de operacao.
- AppError sem pipeline global de mapeamento para envelope padrao: handler central deve ser introduzido junto aos fluxos de autenticacao e rotas de dominio.

## Deferred from: code review of 5-2-validacao-de-contrato-versionado (2026-04-13)
- Corrida entre pre-check de duplicidade e INSERT pode retornar erro de banco nao classificado em concorrencia extrema (pre-existing): avaliar tratamento explicito de violacao de unique index para retornar 409 deterministico.

## Deferred from: completion of Epic 6 (2026-04-14)
- **Controle de Quotas Quantitativas**: Evoluir a habilitação de features (booleanas) para limites numéricos (ex: 5.000 documentos/mês no plano Pro) aproveitando a estrutura de telemetria baseada em `plan_code`.
- **Estabilização de Testes Pós-Auditoria**: Refatorar suites de testes de integração para tratar a injeção best-effort de logs de auditoria (especialmente em rotas de leitura) sem exigir mocks manuais repetitivos de `db.insert`.


## Deferred from: code review of 8-2-auditoria-com-ux-premium-design-system (2026-04-20)
- Role Resolution Ambiguity [src/app/rh/auditoria/page.tsx] (Ambiguity in resolveTenantRole without ordering)
- Lack of Date String Validation in Component [src/app/rh/auditoria/page.tsx] (Delegates validation to backend rather than strictly enforcing boundary)
- Silent Type Failures on nested details payload (Rendering diverse nested JSON potentially unsafe without optional chains)
