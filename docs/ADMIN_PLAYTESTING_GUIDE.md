# Guia Interno de Validacao — Admin Mercavejo

Este roteiro cobre a validacao interna das capacidades de observabilidade e operacao privilegiada da Mercavejo.

> Fonte de verdade: a separacao de escopo formalizada em `sprint-change-proposal-2026-04-24.md` distingue a jornada do `gestor cliente` da area interna de `admin Mercavejo`. Este documento existe para evitar que o playtesting do cliente seja reutilizado para validar operacao interna.

---

## 1. Pre-requisitos

- Utilizar a conta demo `admin@demo.com` ou outra conta interna provisionada com papel `admin_plataforma` no tenant a ser validado.
- Opcionalmente, usar uma conta `suporte` se quiser validar o comportamento compartilhado da auditoria e da consolidacao de casos.
- Reservar tambem a conta `gestor@demo.com` ou outra conta `rh_gestor` para a fronteira negativa.
- O seed de playtesting atual tambem provisiona `admin@demo.com` com o mesmo password padrao do ambiente demo.
- Se o ambiente demo estiver carregado, o tenant de demonstracao contem lotes em estados distintos, incluindo um lote com ambiguidades de roteamento util para validacao operacional.
- Antes de iniciar, abrir `docs/playtesting/admin-playtest-evidence-template.md`.

---

## 2. Objetivo do Roteiro

Validar que as areas abaixo permanecem restritas ao contexto interno da Mercavejo:

- indicadores operacionais
- alertas operacionais
- trilha de auditoria
- fila de excecoes
- consolidacao tecnica de casos

Tambem validar que essas capacidades nao vazam para a jornada do `gestor cliente`.

---

## 3. Como registrar evidencias

Preencher uma linha por etapa validada no template admin. Cada linha deve registrar:

- `etapa`
- `papel`
- `resultado_esperado`
- `resultado_observado`
- `nivel_de_friccao`
- `classificacao`
- `correlation_id`
- `links_ids_de_apoio`
- `acao_sugerida`

Como capturar `correlation_id`:

1. Ao validar rota via browser/devtools, copiar o header `x-correlation-id` da resposta.
2. Ao validar via terminal, preservar o header da resposta HTTP ou o ID emitido no pacote exportado.
3. Se a etapa depender de mais de uma chamada, registrar o `correlation_id` principal e citar IDs auxiliares em `links_ids_de_apoio`.

Classificacao obrigatoria:

- `ok` para etapa sem gap relevante.
- `melhoria` para copy, clareza ou ergonomia interna.
- `gap_observabilidade` para falta de evento, trilha ou dado tecnico suficiente.
- `bloqueador` para qualquer vazamento de menu, rota, dado ou UX admin na jornada `rh_gestor`.

---

## 4. Roteiro Principal

### Passo 1 — Confirmar fronteira de acesso

1. Faça login com `admin@demo.com` ou outro usuario `admin_plataforma`.
2. Verifique no menu lateral a presenca das entradas internas:
   - `Dashboard`
   - `Indicadores RH`
   - `Processamento de Lotes`
   - `Fila de Exceções`
   - `Auditoria`
3. Confirme que esse roteiro nao depende das credenciais do playtesting cliente descritas em `docs/PLAYTESTING_GUIDE.md`.

### Passo 2 — Validar dashboard interno

1. Acesse `/rh`.
2. Confirme que a experiencia interna exibe leitura operacional consolidada, distinta do dashboard simplificado do gestor cliente.
3. Em caso de falha de carregamento, verifique se a mensagem orienta consulta a auditoria ou acionamento do suporte tecnico interno.

### Passo 3 — Validar indicadores e alertas

1. Acesse `/rh/indicadores`.
2. Verifique a carga dos cards e tabelas de indicadores operacionais.
3. Aplique filtros por `batch_id`, intervalo de datas ou unidade organizacional, quando houver dados disponiveis.
4. Valide o painel de alertas operacionais embutido na tela.
5. Se precisar validar a camada de dados separadamente, consulte tambem:
   - `GET /api/v1/rh/indicators`
   - `GET /api/v1/rh/alerts`
6. Registrar `correlation_id` da chamada principal de indicadores e, quando houver, da consulta de alertas.

### Passo 4 — Validar fila de excecoes

1. Acesse `/rh/excecoes`.
2. Use um lote com ambiguidades ou falhas de roteamento no tenant atual.
3. Se o ambiente demo estiver seedado, procure o lote com excecoes antes de validar a fila.
4. Confirme que a tela permite leitura operacional das pendencias e nao faz parte da jornada do cliente.
5. Se a tela depender de `batch_id`, registrar o lote usado e o `correlation_id` associado.

### Passo 5 — Validar trilha de auditoria

1. Acesse `/rh/auditoria`.
2. Filtre por lote, documento, usuario ou intervalo de datas.
3. Confirme que a timeline reflete uploads, processamentos, publicacoes e falhas com evidencias coerentes.
4. Se existir um `case_id` conhecido, valide tambem a consolidacao do caso na mesma area.
5. Como apoio, a rota `GET /api/v1/audit-events` deve permanecer restrita a `suporte` e `admin_plataforma`.

### Passo 6 — Validar consolidacao tecnica de suporte

1. Permanecendo como `admin_plataforma`, abra um caso tecnico conhecido na auditoria ou consulte `GET /api/v1/support/cases/[caseId]`.
2. Repita a validacao com conta `suporte` quando a operacao exigir papel compartilhado.
3. Confirme que a consolidacao mostra timeline, links tecnicos e IDs de apoio sem expor recursos fora do tenant.
4. Registrar papel usado na linha da evidencia: `admin_plataforma` ou `suporte`.

### Passo 7 — Validar fronteira negativa

1. Faça logout do admin.
2. Faça login com `gestor@demo.com` ou outra conta `rh_gestor`.
3. Confirme que o gestor nao ve `Indicadores RH`, `Fila de Exceções` nem `Auditoria` na navegacao.
4. Confirme que o gestor permanece no fluxo de envio, acompanhamento funcional e suporte.
5. Tente acessar manualmente `/rh/indicadores`, `/rh/excecoes` e `/rh/auditoria`.
6. Se qualquer menu, rota, payload ou dado admin aparecer para `rh_gestor`, registrar como `bloqueador`.

---

## 5. Evidencias Esperadas

- `admin_plataforma` acessa `/rh/indicadores`, `/rh/excecoes` e `/rh/auditoria` sem bloqueio indevido.
- `suporte` participa apenas da consolidacao tecnica compartilhada e, quando usado, precisa aparecer em evidencia propria.
- `rh_gestor` nao enxerga entradas de observabilidade nem acessa essas rotas como parte da jornada principal.
- `rh_gestor` forca navegacao direta nas rotas internas sem receber dados admin utilizaveis.
- Alertas operacionais permanecem associados a indicadores/admin.
- Excecoes e auditoria continuam descritas como operacao interna da Mercavejo.
- Qualquer ausencia de `correlation_id`, evento tecnico ou IDs de apoio deve ser registrada como `gap_observabilidade`.

---

## 6. Observacoes de Handoff

- Use `docs/PLAYTESTING_GUIDE.md` para a jornada do cliente.
- Use este documento para validacao interna/admin.
- O ambiente demo agora provisiona um usuario `admin_plataforma`, reduzindo preparacao manual para validacao interna.
