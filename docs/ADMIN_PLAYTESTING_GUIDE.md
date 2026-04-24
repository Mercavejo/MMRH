# Guia Interno de Validacao — Admin Mercavejo

Este roteiro cobre a validacao interna das capacidades de observabilidade e operacao privilegiada da Mercavejo.

> Fonte de verdade: a separacao de escopo formalizada em `sprint-change-proposal-2026-04-24.md` distingue a jornada do `gestor cliente` da area interna de `admin Mercavejo`. Este documento existe para evitar que o playtesting do cliente seja reutilizado para validar operacao interna.

---

## 1. Pre-requisitos

- Utilizar a conta demo `admin@demo.com` ou outra conta interna provisionada com papel `admin_plataforma` no tenant a ser validado.
- Opcionalmente, usar uma conta `suporte` se quiser validar o comportamento compartilhado da auditoria e da consolidacao de casos.
- O seed de playtesting atual tambem provisiona `admin@demo.com` com o mesmo password padrao do ambiente demo.
- Se o ambiente demo estiver carregado, o tenant de demonstracao contem lotes em estados distintos, incluindo um lote com ambiguidades de roteamento util para validacao operacional.

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

## 3. Roteiro Principal

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

### Passo 4 — Validar fila de excecoes

1. Acesse `/rh/excecoes`.
2. Use um lote com ambiguidades ou falhas de roteamento no tenant atual.
3. Se o ambiente demo estiver seedado, procure o lote com excecoes antes de validar a fila.
4. Confirme que a tela permite leitura operacional das pendencias e nao faz parte da jornada do cliente.

### Passo 5 — Validar trilha de auditoria

1. Acesse `/rh/auditoria`.
2. Filtre por lote, documento, usuario ou intervalo de datas.
3. Confirme que a timeline reflete uploads, processamentos, publicacoes e falhas com evidencias coerentes.
4. Se existir um `case_id` conhecido, valide tambem a consolidacao do caso na mesma area.
5. Como apoio, a rota `GET /api/v1/audit-events` deve permanecer restrita a `suporte` e `admin_plataforma`.

### Passo 6 — Validar fronteira negativa

1. Faça logout do admin.
2. Faça login com `gestor@demo.com` ou outra conta `rh_gestor`.
3. Confirme que o gestor nao ve `Indicadores RH`, `Fila de Exceções` nem `Auditoria` na navegacao.
4. Confirme que o gestor permanece no fluxo de envio, acompanhamento funcional e suporte.

---

## 4. Evidencias Esperadas

- `admin_plataforma` acessa `/rh/indicadores`, `/rh/excecoes` e `/rh/auditoria` sem bloqueio indevido.
- `rh_gestor` nao enxerga entradas de observabilidade nem acessa essas rotas como parte da jornada principal.
- Alertas operacionais permanecem associados a indicadores/admin.
- Excecoes e auditoria continuam descritas como operacao interna da Mercavejo.

---

## 5. Observacoes de Handoff

- Use `docs/PLAYTESTING_GUIDE.md` para a jornada do cliente.
- Use este documento para validacao interna/admin.
- O ambiente demo agora provisiona um usuario `admin_plataforma`, reduzindo preparacao manual para validacao interna.
