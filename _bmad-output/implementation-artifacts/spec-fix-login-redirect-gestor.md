---
title: 'Fix login redirect — gestor/operator/suporte va para /rh em vez de /rh/indicadores'
type: 'bugfix'
created: '2026-04-30'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** Todos os papeis RH (`rh_gestor`, `rh_operator`, `suporte`, `rh`, `admin_plataforma`) eram redirecionados para `/rh/indicadores` apos login. Porem `/rh/indicadores` so aceita `admin_plataforma`, fazendo gestor e outros papeis cairem em tela de erro de permissao.

**Approach:** Separar redirect: `admin_plataforma` mantem `/rh/indicadores`; demais papeis RH va para `/rh` que renderiza o dashboard adequado por role (ClientDashboard para gestor, Painel de Gestao para admin).

## Suggested Review Order

- Unico change: redirect condicional por role no handler de submit do login.
  [`LoginForm.tsx:56`](../../src/modules/auth/components/LoginForm.tsx#L56)
