# Guia de Playtesting — SISTEMA ADALTO

Este guia descreve o fluxo ponta-a-ponta para demonstração e playtesting do sistema.

> **Nota de realinhamento (2026-04-24):** Este roteiro foi atualizado para refletir a separação correta entre `gestor cliente` e `admin Mercavejo`. Auditoria, indicadores, status operacional e fila de exceções agora pertencem apenas ao contexto interno/admin. A validação interna correspondente foi separada em `docs/ADMIN_PLAYTESTING_GUIDE.md`.

---

## 1. Ambiente e Credenciais

Os dados de demonstração são provisionados automaticamente pelo script de seed. Utilize as credenciais abaixo:

| Perfil          | E-mail                   | Senha             | Acesso                                                      |
|-----------------|--------------------------|-------------------|-------------------------------------------------------------|
| Gestor Cliente  | `gestor@demo.com`        | `SenhaSegura123!` | Dashboard cliente, upload de lotes, histórico funcional, suporte |
| Colaborador     | `colaborador@demo.com`   | `SenhaSegura123!` | Lista de documentos pessoais (holerites do período 2026-04) |

> **Nota:** A senha padrão pode ser sobrescrita definindo a variável de ambiente `PLAYTESTING_PASSWORD` antes de executar o seed.

---

## 2. Arquivo de Demonstração

Utilize o arquivo PDF multipágina de exemplo para simular um upload real:

- **Localização:** `public/assets/demo/exemplomulti.pdf`
- **Descrição:** PDF com múltiplas páginas representando um relatório de folha de pagamento.

Acesse o arquivo diretamente via URL após iniciar o servidor:
`http://localhost:3000/assets/demo/exemplomulti.pdf`

---

## 3. Fluxo de Demonstração (Step-by-Step)

### Passo 1 — Login como Gestor Cliente

1. Acesse o sistema (`http://localhost:3000`) e insira as credenciais do **Gestor Cliente**.
2. Após o login, você será direcionado ao **Dashboard do Cliente** (`/rh`).
3. Verifique a leitura do último lote enviado, o resumo funcional do processamento e a disponibilidade do CTA para suporte técnico.

---

### Passo 2 — Upload de Lote

1. Acesse **Processar Lotes** via o menu lateral ou o botão de atalho no dashboard.
2. Na tela de upload, **arraste e solte** o arquivo `exemplomulti.pdf` no campo de Dropzone.
3. Acompanhe o stepper visual: `Upload → Validação → Roteamento`.
4. Ao final, valide que o fluxo oferece acompanhamento funcional do lote, sem expor trilhas operacionais internas.

---

### Passo 3 — Histórico do Envio e Suporte

1. Acesse o histórico funcional do lote recém-enviado.
2. Verifique o resultado apresentado ao gestor: status do envio, quantidade processada e orientação de próximo passo.
3. Em caso de inconsistência, valide a opção de **abrir chamado técnico** para a equipe Mercavejo.

> **Validação interna opcional:** Auditoria (`/rh/auditoria`), indicadores (`/rh/indicadores`) e exceções (`/rh/excecoes`) devem ser testados separadamente com um usuário `admin Mercavejo`, seguindo `docs/ADMIN_PLAYTESTING_GUIDE.md`, fora do roteiro do gestor cliente.

---

### Passo 4 — Trocar Modo de Visão (Gestor → Colaborador)

> **Objetivo:** Demonstrar o isolamento por perfil — o colaborador vê apenas seus próprios documentos.

1. **Faça logout** da sessão do Gestor Cliente (menu de perfil no canto superior direito → "Sair").
2. **Faça login** com as credenciais do **Colaborador** (`colaborador@demo.com`).
3. Navegue até **Meus Documentos** (`/documents`).
4. Verifique que **apenas 5 holerites** do período `2026-04` estão visíveis — evidenciando o isolamento por `userId` e `tenantId`.
5. (Opcional) Tente acessar `/rh` diretamente — o sistema deve redirecionar ou exibir acesso negado.

---

### Passo 5 — Encerrar a Demonstração Cliente

1. Retorne ao login do Gestor Cliente, se necessário, e confirme que o dashboard continua restrito ao fluxo de envio, acompanhamento e suporte.
2. Registre qualquer dúvida operacional como item para validação do roteiro interno de `admin Mercavejo`, e não como requisito da jornada do cliente.
3. (Opcional) Caso queira demonstrar a jornada do colaborador em mais detalhe, mantenha a navegação em `/documents`, sem misturar capacidades administrativas.

---

## 4. Reset do Ambiente

Após cada sessão de playtesting, resete o ambiente para o estado inicial:

```bash
npm run dev:reset-playtesting
```

Esse comando:
1. Remove todos os dados do tenant de demonstração (lotes, documentos, logs, mapeamentos).
2. Recria o tenant, 3 usuários demo (`admin`, `gestor cliente`, `colaborador`), 3 lotes e 85 documentos do seed original.
3. É seguro: **não afeta nenhum outro tenant no banco de dados**.

> **Dica:** O reset leva menos de 30 segundos em condições normais.

---

## 5. Troubleshooting

| Problema                        | Solução                                                                |
|---------------------------------|------------------------------------------------------------------------|
| Seed falha com "tenant exists"  | Execute `npm run dev:reset-playtesting` antes de rodar o seed.         |
| PDF não encontrado no Dropzone  | Verifique que `public/assets/demo/exemplomulti.pdf` existe no projeto. |
| Colaborador vê 0 documentos     | Rode o reset para garantir que o seed recente está aplicado.           |
| `npx tsx` não encontrado        | Certifique-se de ter rodado `npm install` no diretório do projeto.     |
