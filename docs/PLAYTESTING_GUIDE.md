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

## 1.1 Evidencias obrigatorias da sessao

Antes de iniciar, abra o template canonico em `docs/playtesting/client-playtest-evidence-template.md`.

Cada etapa validada deve registrar, no minimo:

- `etapa`
- `papel`
- `resultado_esperado`
- `resultado_observado`
- `nivel_de_friccao`
- `correlation_id`
- `links_ids_de_apoio`
- `acao_sugerida`

> Regra de escopo: este template cobre apenas a jornada cliente. Evidencias de `admin Mercavejo` ficam fora daqui e devem usar `docs/ADMIN_PLAYTESTING_GUIDE.md`.

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
4. Registre no template a etapa `dashboard_cliente`.
5. Depois do passo, exporte o pacote técnico da sessão para recuperar o evento `playtest.rh.dashboard.view`:

```bash
npx tsx drizzle/scripts/export-playtest-evidence.ts --tenant-slug demo-playtesting-tenant --actor-email gestor@demo.com
```

---

### Passo 2 — Upload de Lote

1. Acesse **Processar Lotes** via o menu lateral ou o botão de atalho no dashboard.
2. Na tela de upload, **arraste e solte** o arquivo `exemplomulti.pdf` no campo de Dropzone.
3. Acompanhe o stepper visual: `Upload → Validação → Roteamento`.
4. Ao final, valide que o fluxo oferece acompanhamento funcional do lote, sem expor trilhas operacionais internas.
5. No DevTools > Network, copie o `x-correlation-id` da resposta `POST /api/v1/rh/batches`.
6. Registre no template a etapa `upload_lote` com o `batch_id` retornado pela API.

---

### Passo 3 — Histórico do Envio e Suporte

1. Acesse o histórico funcional do lote recém-enviado.
2. Verifique o resultado apresentado ao gestor: status do envio, quantidade processada e orientação de próximo passo.
3. Em caso de inconsistência, valide a opção de **abrir chamado técnico** para a equipe Mercavejo.
4. No DevTools > Network, copie o `x-correlation-id` da resposta `GET /api/v1/rh/batches/[batchId]` e registre a etapa `historico_envio`.
5. Se consultar um caso técnico existente, copie o `x-correlation-id` da resposta `GET /api/v1/support/cases/[caseId]` e registre a etapa `suporte`.

> **Validação interna opcional:** Auditoria (`/rh/auditoria`), indicadores (`/rh/indicadores`) e exceções (`/rh/excecoes`) devem ser testados separadamente com um usuário `admin Mercavejo`, seguindo `docs/ADMIN_PLAYTESTING_GUIDE.md`, fora do roteiro do gestor cliente.

---

### Passo 4 — Trocar Modo de Visão (Gestor → Colaborador)

> **Objetivo:** Demonstrar o isolamento por perfil — o colaborador vê apenas seus próprios documentos.

1. **Faça logout** da sessão do Gestor Cliente (menu de perfil no canto superior direito → "Sair").
2. **Faça login** com as credenciais do **Colaborador** (`colaborador@demo.com`).
3. Navegue até **Meus Documentos** (`/documents`).
4. Verifique que **apenas 5 holerites** do período `2026-04` estão visíveis — evidenciando o isolamento por `userId` e `tenantId`.
5. (Opcional) Tente acessar `/rh` diretamente — o sistema deve redirecionar ou exibir acesso negado.
6. No DevTools > Network, copie o `x-correlation-id` da resposta `GET /api/v1/employee/documents` e registre a etapa `troca_para_colaborador`.

---

### Passo 5 — Encerrar a Demonstração Cliente

1. Retorne ao login do Gestor Cliente, se necessário, e confirme que o dashboard continua restrito ao fluxo de envio, acompanhamento e suporte.
2. Registre qualquer dúvida operacional como item para validação do roteiro interno de `admin Mercavejo`, e não como requisito da jornada do cliente.
3. (Opcional) Caso queira demonstrar a jornada do colaborador em mais detalhe, mantenha a navegação em `/documents`, sem misturar capacidades administrativas.
4. Ao final da rodada, exporte novamente o pacote técnico para anexar ao artefato humano:

```bash
npx tsx drizzle/scripts/export-playtest-evidence.ts --tenant-slug demo-playtesting-tenant --output docs/playtesting/evidence-cliente.md
```

5. Use `--actor-email` apenas quando quiser revisar a trilha de um unico usuario. Para o fechamento da sessao cliente completa, mantenha a exportacao agregada por tenant para incluir a troca de visao gestor -> colaborador.
6. Anexe ou copie os campos relevantes do arquivo exportado para `docs/playtesting/client-playtest-evidence-template.md`.

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
