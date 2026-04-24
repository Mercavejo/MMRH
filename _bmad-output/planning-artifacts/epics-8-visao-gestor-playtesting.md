# Epic 8: Experiência Cliente Simplificada e Área Admin para Playtesting

Entregar uma experiência cliente enxuta para envio e acompanhamento funcional de lotes, mantendo auditoria e observabilidade como experiência interna/admin durante playtesting e demonstrações.

**FRs covered:** FR5, FR6, FR16, FR23, FR26
**UX-DRs covered:** UX-DR4, UX-DR5, UX-DR6, UX-DR7, UX-DR8, UX-DR9, UX-DR11, UX-DR12, UX-DR18, UX-DR20

## Contexto

Todos os 7 epics anteriores estão completos. As APIs de backend (batches, indicadores, auditoria, exceções, integrações) estão implementadas e testadas. Porém, a separação entre **visão cliente** e **operação interna/admin** ainda precisa ser refletida no frontend:

1. **Dashboard RH** (`/rh`) ainda mistura visão cliente com indicadores operacionais internos
2. **Auditoria** (`/rh/auditoria`) precisa ser tratada como experiência interna/admin, não como jornada do gestor cliente
3. **Upload de documentos** funciona mas a UX ainda pode ser refinada para o fluxo funcional do cliente
4. **Navegação no sidebar** precisa esconder indicadores, auditoria e exceções para perfis cliente
5. **Micro-interações e polish** devem respeitar a nova separação de contexto

O objetivo é transformar cada tela em uma experiência coerente com o escopo do produto e que faça clientes-piloto sentirem que o fluxo funcional é **production-grade**.

---

## Story 8.1: Dashboard Cliente com Status Funcional e Visual Premium

As a gestor cliente,
I want ver o dashboard principal com status funcional real dos meus envios,
So that eu acompanhe o processamento do lote sem precisar interpretar observabilidade interna.

**Acceptance Criteria:**

**Given** um gestor cliente autenticado no tenant ativo
**When** acessar a rota `/rh`
**Then** o dashboard deve exibir status real do último lote, histórico funcional recente e ações principais de envio/suporte
**And** os dados devem ser extraídos das APIs existentes de batches, não de mock hardcoded.

**Given** a necessidade de experiência premium para playtesting
**When** o dashboard for renderizado
**Then** os cards devem reforçar clareza de status, último envio e chamada de suporte
**And** o bloco "Acesso Rápido" deve navegar corretamente para lotes e histórico funcional
**And** o dashboard nao deve exibir indicadores, auditoria ou fila de exceções para o gestor cliente.

**Given** estados vazios e de Loading
**When** não houver dados operacionais ou durante carregamento
**Then** o componente deve exibir o skeleton loading adequado com shimmer effect
**And** estados vazios devem ter mensagem orientadora com call-to-action para importar primeiro lote.

**Tasks:**
- [ ] 8.1.1 Criar função server-side para dashboard cliente que consulta APIs reais de batches e histórico funcional
- [ ] 8.1.2 Substituir `getSummaryData` mock por dados reais injetados via server component
- [ ] 8.1.3 Remover do dashboard cliente cards de indicadores, exceções e auditoria
- [ ] 8.1.4 Implementar skeleton loading com shimmer effect para cada card durante carregamento
- [ ] 8.1.5 Conectar a visão cliente ao último lote e ao histórico funcional do envio
- [ ] 8.1.6 Implementar estados vazios com mensagem orientadora e CTA "Importar primeiro lote"
- [ ] 8.1.7 Ajustar NAV_ITEMS do AppShell para esconder indicadores, auditoria e exceções de perfis cliente
- [ ] 8.1.8 Testes unitários para getDashboardSummary e renderização de cada estado (loading, vazio, dados reais, erro)

---

## Story 8.2: Auditoria Admin com UX Premium e Design System

As a admin Mercavejo,
I want consultar a trilha de auditoria com interface visual profissional e consistente,
So that a investigação interna seja clara e confiável sem ficar exposta ao gestor cliente.

**Acceptance Criteria:**

**Given** a tela de auditoria atual usando HTML cru (`<h1>`, `<form>`, `<ul>`)
**When** a refatoração visual for aplicada
**Then** todos os elementos devem usar componentes MUI com tokens do design system
**And** a lista de eventos deve usar `Table` ou `DataGrid` com colunas claras (ação, status, recurso, ator, data)
**And** os filtros devem usar `TextField`, `DateTimePicker` e `Select` do MUI dentro de um Paper estilizado.

**Given** a timeline de status e o painel de suporte
**When** exibidos na tela
**Then** devem estar visuais e consistentes com o restante das telas RH
**And** a paginação deve ter controles claros com indicação de página atual/total
**And** links para detalhes de batch/documento devem ter hover com tooltip.

**Given** a necessidade de polish visual
**When** a tela carregar
**Then** deve haver transição suave (fade-in) ao exibir a lista de eventos
**And** each row da tabela deve ter hover highlight sutil
**And** badges de status devem usar Chips com cores semânticas do design system (sucesso, atenção, erro).

**Tasks:**
- [ ] 8.2.1 Refatorar `RhAuditPageView` para usar Container, Paper, Stack e Typography do MUI
- [ ] 8.2.2 Converter formulario de filtros para componentes MUI (TextField, DateTimePicker, Button) com layout responsivo
- [ ] 8.2.3 Converter lista de eventos para Table do MUI com colunas: Ação, Status (Chip colorido), Recurso, Ator, Data
- [ ] 8.2.4 Estilizar paginação com controles Previous/Next e indicador de página/total
- [ ] 8.2.5 Adicionar fade-in animation ao carregar lista e hover highlight nas row
- [ ] 8.2.6 Estilizar StatusTimeline para consistência visual com tokens do design system
- [ ] 8.2.7 Estilizar SupportCasePanel para consistência visual com tokens do design system
- [ ] 8.2.8 Testes de renderização para cada variante (loading, vazio, dados, erro, com/sem case_id)

---

## Story 8.3: UX Premium para Upload e Processamento de Lotes

As a RH/DP operador,
I want uma experiência de upload de documentos fluida e premium,
So that o processo de importação transmita confiança profissional durante demonstrações para clientes.

**Acceptance Criteria:**

**Given** a tela de importação de lotes
**When** o operador interagir com a área de upload
**Then** deve existir uma drop zone visual com drag & drop suportado (arrastar arquivo sobre a área)
**And** a drop zone deve ter animação de highlight ao arrastar um arquivo sobre ela (border pulsante, ícone animado)
**And** deve exibir preview do arquivo selecionado com nome, tamanho e tipo.

**Given** o progresso de processamento do lote
**When** o roteamento estiver em andamento
**Then** o BatchProgressPanel deve ter animação de progresso suave (transição gradual da barra)
**And** os chips de contadores devem ter micro-animação ao mudar valor
**And** cada etapa do fluxo (validação → roteamento → publicação) deve ter indicação visual com stepper.

**Given** conclusão do fluxo completo
**When** o lote for publicado com sucesso
**Then** deve haver animação de celebração sutil (check animado, confetti discreto ou pulse de sucesso)
**And** um resumo visual final com total de documentos publicados, tempo total e orientação para acompanhar o histórico funcional ou abrir chamado técnico.

**Tasks:**
- [ ] 8.3.1 Implementar componente DropZone com drag & drop (onDragEnter, onDragOver, onDrop) e highlight animation
- [ ] 8.3.2 Adicionar preview de arquivo selecionado com ícone por tipo (PDF, CSV, JSON), nome e tamanho formatado
- [ ] 8.3.3 Implementar Stepper visual (MUI Stepper) para as etapas do fluxo: Validação → Roteamento → Publicação
- [ ] 8.3.4 Suavizar animação da barra de progresso no BatchProgressPanel (CSS transition em LinearProgress)
- [ ] 8.3.5 Implementar animação de celebração sutil ao publicar lote com sucesso (checkmark animado + resumo final)
- [ ] 8.3.6 Adicionar link para trilha de auditoria no resumo pós-publicação
- [ ] 8.3.7 Testes unitários para DropZone, Stepper transitions e estados de cada etapa

### Review Findings

- [x] [Review][Patch] DropZone perde tamanho e tipo no preview integrado [sistema-adalto/src/app/rh/lotes/page.tsx:70]
- [x] [Review][Patch] Stepper avança estados blocked/failed/processing para etapa incorreta [sistema-adalto/src/components/batches/batch-stepper.tsx:67]
- [x] [Review][Patch] Drop rejeitado limpa arquivo valido e nao informa rejeicao [sistema-adalto/src/components/batches/drop-zone.tsx:25]
- [x] [Review][Patch] Resumo pos-publicacao nao mostra tempo total nem link de auditoria [sistema-adalto/src/components/batches/batch-progress-panel.tsx:151]
- [x] [Review][Patch] Testes nao cobrem drag/drop, highlight, onFileSelect, rejeicao nem estado ativo do stepper [sistema-adalto/__tests__/batches/drop-zone.test.tsx:13]

---

## Story 8.4: Polish Visual Global e Micro-Interações

As a gestor RH navegando pelo sistema,
I want sentir que a plataforma é premium e viva em todas as telas,
So that clientes-piloto percebam qualidade profissional durante playtesting.

**Acceptance Criteria:**

**Given** a navegação principal (AppShell sidebar)
**When** o gestor navegar entre seções
**Then** a transição de conteúdo principal deve ter fade-in suave
**And** o item ativo no sidebar deve ter animação de indicador lateral (barra animada)
**And** deve existir link "Dashboard" como primeiro item RH no sidebar
**And** o botão "Alternar Visão" deve estar sempre visível na AppBar (confirmado funcional).

**Given** todas as telas RH
**When** o conteúdo carregar
**Then** os cards e paper devem ter sombra de hover sutil ao mouse over (elevation transition)
**And** botões devem ter ripple effect suave e consistente
**And** tabelas devem ter hover row highlight em todas as telas
**And** chips de status devem seguir paleta semântica consistente: sucesso=verde, atenção=âmbar, erro=vermelho, processando=azul, pendente=cinza.

**Given** estados de carregamento em qualquer tela RH
**When** dados estiverem sendo carregados
**Then** deve haver skeleton loading com shimmer (não spinner bruto)
**And** mensagens de erro devem seguir o padrão de Alert do MUI com orientação de próximo passo.

**Given** a responsividade mobile/tablet
**When** o gestor acessar em tela menor
**Then** todas as telas RH devem manter legibilidade e funcionalidade
**And** cards devem empilhar verticalmente em mobile
**And** tabelas devem ter scroll horizontal com indicador visual.

**Tasks:**
- [ ] 8.4.1 Adicionar item "Dashboard" no NAV_ITEMS do AppShell como primeiro link RH (path `/rh`, ícone DashboardIcon)
- [ ] 8.4.2 Implementar indicador lateral animado no sidebar para item ativo (barra colorida com transição)
- [ ] 8.4.3 Criar componente utilitário `SkeletonCard` reutilizável com shimmer effect para uso em todas as telas
- [ ] 8.4.4 Padronizar paleta de Chips de status semânticos em arquivo de tokens (objeto `statusColors`)
- [ ] 8.4.5 Adicionar hover elevation transition em todos os Paper/Card das telas RH
- [ ] 8.4.6 Implementar fade-in transition no container principal (`<Box component="main">` do AppShell)
- [ ] 8.4.7 Revisar responsividade de todas as telas RH em breakpoints mobile (320-767px) e tablet (768-1023px)
- [ ] 8.4.8 Garantir que o botão "Alternar Visão" está funcional e visível em todos os tamanhos de tela
- [ ] 8.4.9 Testes de renderização para skeleton, estados de erro e responsividade básica

---

## Story 8.5: Seed Data e Fluxo Demo para Playtesting

As a responsável pelo playtesting,
I want ter dados de demonstração realistas e um script de reset de ambiente,
So that clientes-piloto experimentem o sistema com cenários verossímeis.

**Acceptance Criteria:**

**Given** um ambiente de playtesting sendo preparado
**When** o script de seed for executado
**Then** deve criar um tenant de demonstração com 3 usuários (1 admin Mercavejo, 1 gestor cliente, 1 colaborador)
**And** deve criar 3 lotes com status diferentes (publicado, processando, com exceções)
**And** deve inserir 50-100 documentos distribuídos entre os lotes
**And** deve criar eventos de auditoria realistas vinculados aos lotes e documentos.

**Given** necessidade de repetir demonstrações
**When** o script de reset for executado
**Then** deve limpar e recriar o dataset de demonstração sem afetar outros tenants.

**Given** o fluxo de demonstração ponta-a-ponta
**When** o gestor RH logar
**Then** deve ver dados realistas no dashboard cliente, poder navegar até lotes e acompanhar o resultado funcional do envio
**And** deve poder fazer upload de um novo lote PDF de teste, processar e publicar
**And** ao alternar para visão colaborador, deve ver os documentos publicados.

**Tasks:**
- [ ] 8.5.1 Criar script `drizzle/scripts/seed-playtesting.ts` com geração de tenant, usuários, lotes e documentos demo
- [ ] 8.5.2 Gerar eventos de auditoria realistas para cada ação do fluxo demo (importação, roteamento, publicação)
- [ ] 8.5.3 Criar PDF de teste multipágina (3-5 páginas) para demonstração de upload
- [ ] 8.5.4 Criar script `drizzle/scripts/reset-playtesting.ts` para limpar e recriar dataset demo
- [ ] 8.5.5 Documentar roteiro de demonstração passo-a-passo em `docs/PLAYTESTING_GUIDE.md`
- [ ] 8.5.6 Testar o fluxo ponta-a-ponta: login → dashboard → upload → roteamento → publicação → visão colaborador

---

## Prioridade de Implementação

| Ordem | Story | Justificativa |
|-------|-------|---------------|
| 1 | 8.1 | Dashboard com dados reais — é a primeira tela que o gestor vê |
| 2 | 8.4 | Polish global — afeta todas as telas e melhora percepção imediata |
| 3 | 8.2 | Auditoria premium — única tela sem design system, mais visível visualmente |
| 4 | 8.3 | Upload premium — diferencial de experiência durante demo |
| 5 | 8.5 | Seed data — preparação final para sessões de playtesting |
