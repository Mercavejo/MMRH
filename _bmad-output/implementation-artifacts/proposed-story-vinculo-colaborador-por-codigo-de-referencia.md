# Proposed Story: Vinculo do Colaborador por Codigo de Referencia

Status: proposed

## Story

As a colaborador em primeiro acesso,
I want informar meu codigo de referencia para confirmar meu vinculo,
so that o sistema associe meus documentos ao meu perfil correto com seguranca.

## Objetivo

Fechar a ponta mais sensivel do produto: garantir que o documento roteado pelo `codigo de referencia` do holerite seja entregue ao colaborador certo tambem no momento de ativacao/cadastro do portal.

## Recomendacao de Produto

O colaborador **pode sim informar o proprio codigo** no primeiro acesso, mas esse codigo **nao deve ser a unica prova** nem virar uma entrada livre sem validacao.

O modelo mais seguro e previsivel para o ADALTO e:

1. O tenant/RH pre-carrega ou confirma a identidade do colaborador com um `codigo_de_referencia` oficial.
2. No primeiro acesso, o colaborador informa:
   - e-mail
   - senha inicial ou convite
   - codigo de referencia
   - um segundo fator de confirmacao leve, por exemplo:
     - data de admissao
     - ultimos digitos de um documento permitido pela politica
     - token temporario enviado por e-mail
3. O sistema valida `tenant + codigo_de_referencia + fator_secundario`.
4. Se o match for unico, grava o vinculo permanente entre o usuario autenticado e a identidade funcional do colaborador.
5. A partir dai, o login volta a ser simples: e-mail + senha.

## O que evitar

- Nao usar o codigo digitado pelo colaborador como fonte unica de verdade sem pre-cadastro.
- Nao permitir que o usuario “escolha” o proprio codigo.
- Nao depender apenas de nome do colaborador para vinculo, porque nome pode duplicar e gerar risco de exposicao cruzada.
- Nao misturar esse vinculo com permissao RH/admin; ele pertence ao dominio de identidade do colaborador.

## Fluxo Recomendado

### Fase 1 - Pre-vinculo interno

Antes do primeiro acesso, o sistema precisa ter uma identidade funcional do colaborador por tenant, contendo no minimo:

- `tenant_id`
- `codigo_de_referencia`
- `nome_normalizado`
- `status_do_vinculo` (`pending_activation`, `active`, `blocked`)
- um verificador secundario seguro (`data_admissao`, `cpf_hash_parcial` ou equivalente)
- `user_id` opcional enquanto nao ativado

### Fase 2 - Primeiro acesso do colaborador

Na tela de ativacao/cadastro:

- o colaborador informa e-mail e senha
- informa o `codigo de referencia` do documento
- informa o verificador secundario

Resultado esperado:

- se houver match unico no tenant, o sistema associa essa identidade ao `users.id`
- se houver divergencia, o sistema bloqueia e orienta contato com RH
- se houver ambiguidade, o sistema nao ativa e registra evento auditavel

### Fase 3 - Operacao recorrente

Depois de ativado:

- login segue com e-mail + senha
- documentos publicados por `codigo_de_referencia` ou mapeamento interno do colaborador chegam sempre no mesmo usuario
- mudancas de codigo precisam ser controladas e auditadas

## Regra de Dados Recomendada

O roteamento do lote e o portal do colaborador devem convergir para uma mesma identidade interna.

Em vez de depender apenas de `employee_identifier` solto no batch, o sistema deve ter um registro interno equivalente a:

- `employee_identity.id`
- `tenant_id`
- `reference_code`
- `user_id`
- `is_active`
- `activated_at`
- `last_verified_at`

Com isso:

- o PDF continua sendo interpretado pelo `codigo de referencia` ao lado do nome
- esse codigo e resolvido para uma identidade interna do colaborador
- a publicacao do documento passa a mirar essa identidade, nao apenas texto extraido do arquivo

## Acceptance Criteria

1. Given um colaborador ainda nao ativado
   When ele informar `codigo de referencia` e verificador secundario validos
   Then o sistema deve vincular o usuario ao registro interno correto do tenant
   And marcar o vinculo como ativo com trilha auditavel.

2. Given um codigo inexistente, divergente ou ambiguo
   When o colaborador tentar ativar o acesso
   Then o sistema deve bloquear a ativacao
   And nao pode expor documentos nem inferir vinculacao parcial.

3. Given um documento processado com `codigo de referencia`
   When o lote for publicado
   Then o sistema deve resolver esse codigo para a identidade interna do colaborador
   And disponibilizar o documento somente para o usuario vinculado.

4. Given alteracao de codigo ou correcoes cadastrais
   When RH/admin atualizar a identidade funcional
   Then a mudanca deve ser auditada
   And nao pode causar exposicao cruzada entre colaboradores.

## Tarefas Propostas

- [ ] Modelar tabela/modulo de identidade funcional do colaborador por tenant.
- [ ] Criar fluxo de primeiro acesso com `codigo de referencia` + verificador secundario.
- [ ] Associar publicacao/consulta de documentos a essa identidade interna.
- [ ] Adicionar bloqueios e auditoria para mismatch, duplicidade e tentativa invalida.
- [ ] Cobrir testes de ativacao correta, codigo invalido, ambiguidade e isolamento cross-tenant.

## Impacto Tecnico Esperado

- Novo slice de identidade do colaborador, separado de `users` e `user_tenant_mappings`.
- Evolucao futura do login para suportar ativacao/primeiro acesso, nao apenas autenticacao direta.
- Publicacao de documentos deve deixar de depender de associacao ad-hoc por texto e passar a usar identidade funcional resolvida.

## Observacao Importante

Para o MVP seguro, a melhor experiencia nao e “o colaborador inventa/cadastra o codigo”, e sim:

`o colaborador confirma um codigo que ja existe no tenant e prova que aquele registro e dele`.

Esse detalhe reduz muito o risco de um colaborador vincular sem querer, ou de forma maliciosa, documentos de outra pessoa.
