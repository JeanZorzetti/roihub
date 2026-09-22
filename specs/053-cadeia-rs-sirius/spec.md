# Feature Specification: A cadeia do Sirius até o dinheiro — banco no retroativo, Stripe nos novos

**Feature Branch**: `053-cadeia-rs-sirius`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: depois da 052, o mapa do Sirius mede SEO e para no clique. O painel "Depois do clique"
diz "signup, ativado e trial pago não têm coletor". Decisão do dono (22/09/2026): **"banco (retroativo) e
stripe (novos)"**.

## O fato que abre esta spec

Medido em 22/09/2026, direto no banco de produção do Sirius (só contagens e datas, sem nome nem e-mail):

1. **O banco responde.** A nota do card ("bloqueado por rede, ETIMEDOUT em 31/07") ficou velha: o banco mudou
   de servidor e conecta em 601 ms da máquina de dev.
2. **O funil real, das 108 contas que não são de teste:**

   | Degrau | Contas | Onde está |
   |---|---|---|
   | Cadastro | 108 (mar 13 · abr 67 · mai 11 · jun 3 · jul 3 · ago 9 · set 2) | data de criação da conta |
   | Criou deal próprio | 26 (mar 9 · abr 15 · mai 1 · **jun 0 · jul 0 · ago 0** · set 1) | deal criado 5 min ou mais depois da conta |
   | Plano pago no banco | 3 (2 PRO, 1 STARTER) | plano da conta |
   | Pago com prova no gateway | **1** (PRO de março, assinatura no Mercado Pago) | id de assinatura do gateway |

3. **Toda conta nova ganha 5 deals de exemplo.** 45 contas têm deals criados em menos de 5 minutos, com os
   mesmos títulos ("Consultoria + CRM" 43 vezes, "CRM para Construtora" 41). Por isso "tem deal" não serve
   como ativação, e o corte de 5 minutos separa exemplo de uso.
4. **O trial não é degrau no Sirius.** Todo cadastro ganha 7 dias de PRO automaticamente. É um degrau de
   100%, que não filtra ninguém. `CONVERTED` também não serve de prova: das 7 contas marcadas assim, 5
   estão no plano FREE.
5. **Plano pago no banco não é pagamento.** Das 3 contas pagas no banco, 2 não têm nenhum id de gateway: o
   STARTER, com 4 deals, e um PRO de abril com trial `EXPIRED` e 243
   deals. É o defeito que o perfil A já avisa: *"`plan` é intenção, extrato é fato"*.
6. **Nenhuma venda pelo Stripe desde a migração de 07/07.** Nenhuma conta tem `stripeSubscriptionId`. Toda
   venda nova vai passar pelo Stripe, e o checkout grava o id da conta (`organization_id`) na sessão e na
   assinatura. Isso deixa o hub casar a cobrança com a conta direto no extrato.
7. **O hub afirma "3 vendas orgânicas: 2 PRO + 1 Business".** O único BUSINESS do banco é conta de teste.
8. **O rastreamento de eventos do produto nunca gravou nada.** A tabela de atividade do usuário está vazia,
   então ativação não pode sair dela.

## Decisões já tomadas pelo dono (22/09/2026)

- **Banco para o retroativo.** Cadastro, ativação e o histórico de pagantes saem do banco do Sirius.
- **Stripe para os novos.** A primeira cobrança aprovada de uma conta nova sai do extrato do Stripe, não do
  plano gravado no banco.

## Clarifications

### Session 2026-09-22

<!-- preenchido pelo speckit-clarify -->

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ver onde o funil do Sirius trava (Priority: P1)

O dono abre a ficha do Sirius (`/okr/sirius`) e o mapa (`/gsc/mapa/sirius`). Nos dois, depois do clique,
vê a cadeia com número em cada degrau: cadastro, ativação e primeira cobrança aprovada, cada um com janela e
fonte. O degrau que trava vem marcado por escrito.

**Why this priority**: sem isso, a fila do mapa ordena o trabalho por clique. Hoje o primeiro da fila é uma
página em inglês com 64% do tráfego nos EUA, e ninguém sabe se um clique ali vira conta.

**Independent Test**: abrir `/okr/sirius` e `/gsc/mapa/sirius` no mesmo dia e conferir que os números da
cadeia são iguais nas duas telas e batem com uma contagem direta no banco.

**Acceptance Scenarios**:

1. **Given** as 108 contas reais de 22/09, **When** a ficha abre, **Then** o cadastro mostra o número de
   contas na janela da cadeia, sem as de teste.
2. **Given** uma conta cujo único deal é de exemplo, **When** a ativação é contada, **Then** ela não conta como
   ativada.
3. **Given** o degrau de trial, **When** a cadeia é montada para o Sirius, **Then** ele não aparece como
   degrau, e a tela diz por quê ("todo cadastro ganha trial: degrau de 100%").
4. **Given** um mês com cadastro e sem ativação (agosto: 9 e 0), **When** a cadeia abre nessa janela, **Then**
   a trava é a ativação, por escrito.

---

### User Story 2 — Pagante só com prova de pagamento (Priority: P1)

O dono vê quantas contas pagaram de verdade, e cada uma aparece com a fonte da prova.

**Why this priority**: é o número que o card afirma sem ter checado. Hoje o hub diz 3, o banco diz 3 planos
pagos, e só 1 tem pagamento rastreável.

**Independent Test**: listar as contas contadas como pagantes e conferir que cada uma tem uma prova de
pagamento nomeada (id de cobrança no Stripe ou assinatura no Mercado Pago).

**Acceptance Scenarios**:

1. **Given** uma conta com plano pago no banco e sem nenhum id de gateway, **When** os pagantes são contados,
   **Then** ela aparece separada, como "plano pago sem prova de pagamento", e não entra no número de pagantes.
2. **Given** uma cobrança aprovada no Stripe com o id de uma conta real, **When** a coleta roda, **Then** a
   conta entra como pagante a partir da data da cobrança.
3. **Given** uma cobrança do Stripe de conta de teste, reembolsada ou em modo de teste, **When** a coleta roda,
   **Then** ela é descartada, e o descarte aparece nominalmente com o motivo.
4. **Given** o Stripe fora do ar ou sem credencial, **When** a ficha abre, **Then** o degrau mostra "não
   apurado" com o motivo, nunca `0`.

---

### User Story 3 — O card para de afirmar o que não foi medido (Priority: P2)

O texto do card do Sirius que diz "3 vendas orgânicas, 2 PRO + 1 Business" é substituído pelo que a coleta
mediu, com data.

**Why this priority**: a frase errada sai da tela sozinha quando o número entra, mas continua no card e no
resumo até alguém corrigir.

**Independent Test**: depois da primeira coleta, nenhuma tela do hub diz "3 vendas" ou "Business" sobre o
Sirius sem data e fonte.

**Acceptance Scenarios**:

1. **Given** a coleta medida, **When** o card é lido, **Then** a nota de receita traz o número medido, a data e
   a fonte, e não a frase antiga.

---

### Edge Cases

- **Conta criada com o rastreio de trial anterior ao recurso** (16 contas sem data de início de trial): não
  muda nada, porque o trial não é degrau.
- **Conta que pagou pelo Mercado Pago antes de 07/07** (a assinatura legada): entra como pagante do
  retroativo, pela prova que o banco guarda. O extrato do Mercado Pago do Sirius não é lido nesta spec.
- **Cobrança do Stripe sem id de conta** (checkout avulso, fundador, serviço): aparece como "cobrança sem conta
  do Sirius", separada, e não entra na cadeia.
- **Renovação mensal**: não conta como nova venda. O degrau é a PRIMEIRA cobrança aprovada da conta.
- **Mês de 2 cadastros** (setembro): a tela mostra a contagem, sem taxa com casa decimal sobre amostra pequena.
- **Banco do Sirius fora do ar**: os degraus de cadastro e ativação mostram "fonte própria indisponível", nunca
  `0`, como já acontece com a Atma.
- **Outros projetos com o mesmo perfil de SaaS** (sem banco nem Stripe ligados): seguem com "sem coletor". Ligar
  o Sirius não pode ligar a cadeia deles.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O hub DEVE ler o banco do Sirius com uma credencial SÓ DE LEITURA, própria do hub, e não com a
  credencial da aplicação.
- **FR-002**: O degrau de cadastro DEVE contar as contas criadas na janela da cadeia, sem as marcadas como
  teste.
- **FR-003**: O degrau de ativação DEVE contar as contas que criaram deal próprio, com a definição escrita na
  ficha. [NEEDS CLARIFICATION: ativação é "criou 1 deal 5 min ou mais depois da conta" (26 contas),
  "criou 1 contato 5 min ou mais depois" (32), ou "concluiu o onboarding" (15)?]
- **FR-004**: O degrau de trial NÃO DEVE aparecer na cadeia do Sirius, e a tela DEVE dizer por quê.
- **FR-005**: O degrau de pagante DEVE contar só contas com prova de pagamento. Para vendas a partir de
  07/07/2026, a prova é a primeira cobrança aprovada no Stripe com o id da conta. Para antes, é a
  assinatura de gateway gravada no banco. [NEEDS CLARIFICATION: no retroativo, "plano pago no banco sem id
  de gateway" (2 contas) conta como pagante ou fica separado como "sem prova"?]
- **FR-006**: Cobranças do Stripe de teste, reembolsadas, de conta de teste ou sem id de conta DEVEM ser
  descartadas e listadas por motivo, nunca somadas em silêncio.
- **FR-007**: A ficha (`/okr/sirius`) e o mapa (`/gsc/mapa/sirius`) DEVEM mostrar os mesmos números da cadeia,
  saídos da mesma conta.
- **FR-008**: Nenhuma taxa DEVE ser calculada entre clique e cadastro quando as janelas forem diferentes, como já
  é a regra da 051.
- **FR-009**: Falha de qualquer fonte (banco, Stripe) DEVE aparecer como "não apurado" com o motivo, nunca `0`.
- **FR-010**: Os outros projetos de perfil SaaS DEVEM continuar com "sem coletor".
- **FR-011**: A nota de receita do card do Sirius DEVE trocar a frase antiga pelo número medido, com data e
  fonte.

### Key Entities

- **Conta do Sirius**: uma organização no banco do produto, com data de criação, plano, marca de teste e ids de
  gateway.
- **Ativação**: o evento, escrito e datado, que separa uso real dos deals de exemplo.
- **Prova de pagamento**: uma cobrança aprovada no Stripe com o id da conta, ou uma assinatura de gateway
  gravada no banco antes de 07/07/2026.
- **Descarte**: uma cobrança que não entra, com o motivo nomeado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A ficha e o mapa do Sirius mostram número em cadastro, ativação e pagante, com janela e fonte. Zero
  degrau mostra `0` sobre ausência.
- **SC-002**: As contagens da tela batem 100% com uma contagem direta no banco, no mesmo dia.
- **SC-003**: Toda conta contada como pagante tem uma prova nomeada. Zero pagante sem prova.
- **SC-004**: Uma venda nova pelo Stripe aparece na cadeia em até 1 dia depois da cobrança.
- **SC-005**: A ficha dos outros projetos SaaS é igual antes e depois da mudança.
- **SC-006**: Nenhuma tela do hub diz "3 vendas" ou "Business" sobre o Sirius sem data e fonte.

## Assumptions

- **A janela da cadeia é a época do produto**: desde a primeira conta real (março de 2026), declarada no card
  como `epoca`. Os meses aparecem separados porque o volume é pequeno e desigual (abril tem 67 dos 108).
- **O Stripe entra por uma chave restrita, só de leitura**, criada pelo dono no painel do Stripe. A chave
  secreta LIVE do Sirius vazou em 07/07/2026 e não deve entrar no hub.
- **O corte de 5 minutos** separa os deals de exemplo dos criados pelo usuário. Ele sai da medição de 22/09
  (os de exemplo nascem no mesmo minuto da conta). Se o produto mudar a semente, o corte muda junto.
- **O extrato do Mercado Pago do Sirius não é lido.** A única assinatura legada tem prova no banco, e a conta do
  Mercado Pago que o hub lê é a da Atma.
- **Valor em reais fica fora.** A cadeia mostra contagens, como decidido na 051. MRR é outra spec.

## Fora do escopo

- Consertar o rastreamento de eventos do produto (a tabela vazia).
- Consertar o produto: a semente de deals, o `CONVERTED` em conta FREE, os planos pagos sem gateway.
- MRR, ticket e churn.
- Ligar a cadeia de qualquer outro projeto.
