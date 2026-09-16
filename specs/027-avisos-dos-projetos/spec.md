# Feature Specification: Avisos no Telegram — Atma, ROI Labs, Vértice e Coopluz

**Feature Branch**: `027-avisos-dos-projetos`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "Quero criar uma nova feature no hub para chegar notificações no meu telegram acerca dos projetos acima" (atma, coopluz, vertex-landing-craft, ROI Labs). Escopo fechado na conversa: **Atma** — lead de paciente, pedido de parceria de ortodontista, backend fora do ar; **ROI Labs** — candidatura a cadeira, lead de consumidor, pagamento/assinatura, formulário do site institucional; **Vértice** e **Coopluz** — lead novo.

## Contexto

A spec 026 levou ao Telegram do dono o lead e o ticket da Sirius e da Estetia, pelo mesmo bot e
pelo mesmo chat. Esta spec estende os avisos a mais quatro projetos. Medido em 16/09/2026 no
código e no banco do hub, não suposto:

| Projeto | Evento | Onde nasce | Passa pelo CRM do hub? | Quem avisa o dono hoje |
|---|---|---|---|---|
| Vértice | Lead novo | formulário de contato do site | **sim** — pipeline `verticemarketing`; 1 lead gravado, o último em 16/08 | ninguém |
| Coopluz | Lead novo | formulário do site (Coopluz e Parceiro Coopluz) | **não** — grava direto no banco do autogestor | ninguém |
| Atma (Use Aligner) | Lead de paciente | `/contato`, `/pacientes/enviar-exames` e bot do WhatsApp | **não** — banco próprio | ninguém (o e-mail vai ao ortodontista atribuído e ao paciente) |
| Atma | Pedido de parceria | `/ortodontistas/seja-parceiro` | **não** | ninguém |
| Atma | Backend fora do ar | API pública do site | — | ninguém (o healthcheck do contêiner só reinicia) |
| ROI Labs | Candidatura a cadeira | formulário do site institucional | **não** — banco próprio do painel | e-mail e push, se configurados |
| ROI Labs | Lead de consumidor | calculadora e formulários do polo Goiânia | **não** | e-mail e push |
| ROI Labs | Pedido pago (inclui o 1º ciclo de assinatura) | notificação do gateway de pagamento | **não** | e-mail e push |
| ROI Labs | Reembolso, renovação recusada, assinatura cancelada | gateway, varredura diária, link do cliente | **não** | ninguém |

O hub tem as pipelines `atma` e `roilabs` cadastradas, mas nenhum lead delas: nenhum dos dois
projetos manda nada para o hub.

## O que a medição corrigiu no pedido

- **"Formulário do site institucional" e "candidatura a cadeira" são o mesmo evento.** O único
  formulário do site institucional que envia algo é o de candidatura. O simulador calcula na
  própria página e não envia nada. Fica um aviso só.
- **A Coopluz não passa pelo CRM do hub.** Ela grava no banco do autogestor, e o hub não tem
  pipeline `coopluz`. Um aviso montado só no hub nunca tocaria para ela. O aviso precisa sair do
  site da Coopluz, depois de gravar o lead.
- **O ROI Labs já tem um alerta interno com dois canais** (e-mail e push), e ele cobre três dos
  eventos pedidos. O Telegram entra como terceiro canal desse alerta. Com isso herda também os
  alertas operacionais que já existem: frete quebrado, carteira com assinatura inválida e resumo
  semanal.
- **O backend da Atma e o hub rodam na mesma VPS**, que já parou mais de uma vez por limite de
  CPU. Um vigia rodando nessa VPS cai junto com o que vigia, justo na queda que precisa avisar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Lead e candidatura dos quatro projetos chegam no Telegram (Priority: P1)

Alguém preenche um formulário em qualquer um dos quatro projetos: contato na Vértice, Coopluz ou
Parceiro Coopluz, pedido de avaliação ou parceria na Atma, candidatura a cadeira ou lead de
consumidor no ROI Labs. Em menos de um minuto o dono recebe no Telegram o projeto, o tipo de
contato, o nome, como falar com a pessoa e um link para agir.

**Why this priority**: lead é a frente do dinheiro dos quatro projetos, e em três ninguém
avisa o dono hoje. Na Atma o lead de paciente só chega ao ortodontista. É a história com o maior
buraco.

**Independent Test**: enviar em produção um lead de teste por origem (6 envios: Vértice; Coopluz;
Atma paciente pelo site; Atma parceria; ROI Labs candidatura; ROI Labs consumidor). Conferir 6
mensagens, cada uma com o projeto certo na primeira linha.

**Acceptance Scenarios**:

1. **Given** o site da Vértice entregando lead ao hub, **When** um visitante envia o formulário
   de contato, **Then** chega uma mensagem com "Vértice", o nome, o e-mail e o telefone.
2. **Given** o site da Coopluz, **When** um visitante envia o formulário da Coopluz ou do
   Parceiro Coopluz, **Then** chega uma mensagem que diz qual dos dois formulários foi usado, com
   o nome e o WhatsApp.
3. **Given** o site da Atma, **When** um paciente pede avaliação pelo site ou pelo WhatsApp,
   **Then** chega uma mensagem com "Atma", o nome, o contato e a cidade quando houver, **sem** as
   observações escritas pelo paciente.
4. **Given** o site da Atma, **When** um ortodontista pede parceria, **Then** chega uma mensagem
   com "Atma", "parceria", o nome, a clínica, a cidade e o contato.
5. **Given** o site institucional do ROI Labs, **When** uma empresa se candidata a uma cadeira,
   **Then** chega uma mensagem com "ROI Labs", o nome, a empresa, a categoria e o WhatsApp.
6. **Given** o site do polo Goiânia, **When** um consumidor deixa o contato, **Then** chega uma
   mensagem com "ROI Labs", o nome, o WhatsApp e o produto de interesse.
7. **Given** qualquer uma das origens acima, **When** o mesmo envio chega de novo dentro da
   janela em que a origem já o trata como duplicado, **Then** nenhuma segunda mensagem é
   enviada.

---

### User Story 2 — Backend da Atma fora do ar chega no Telegram (Priority: P2)

O backend da Atma para de responder, ou responde sem conseguir falar com o banco. Depois de
alguns minutos fora, o dono recebe um aviso de queda. Quando o backend volta, recebe um aviso de
volta com quanto tempo ficou fora.

**Why this priority**: com o backend fora, os formulários da Atma falham e a história 1 fica muda
para esse projeto, sem que ninguém perceba. Fica abaixo do lead porque a queda é rara. O lead é
diário.

**Independent Test**: deixar um alvo vigiado fora do ar por 15 minutos e depois religá-lo.
Conferir exatamente 2 mensagens, uma de queda e uma de volta. Repetir com uma queda de menos de
5 minutos e conferir nenhuma mensagem.

**Acceptance Scenarios**:

1. **Given** o backend respondendo normalmente, **When** ele fica fora por 10 minutos seguidos,
   **Then** chega uma mensagem de queda com o horário em que a falha começou e o motivo (sem
   resposta, erro ou banco indisponível).
2. **Given** o backend fora e o aviso de queda já enviado, **When** ele continua fora, **Then**
   nenhuma outra mensagem é enviada até ele voltar.
3. **Given** o backend fora e o aviso de queda enviado, **When** ele volta a responder com o banco
   disponível, **Then** chega uma mensagem de volta com quanto tempo ficou fora.
4. **Given** o backend reiniciando (fora por menos de 10 minutos), **When** ele volta, **Then**
   nenhuma mensagem é enviada.
5. **Given** a VPS inteira fora do ar, o hub junto, **When** passam 10 minutos, **Then** o aviso
   de queda chega do mesmo jeito.

---

### User Story 3 — Dinheiro do ROI Labs chega no Telegram (Priority: P3)

O gateway confirma um pedido pago, um pagamento é devolvido, uma renovação de assinatura é
recusada ou uma assinatura é cancelada. O dono recebe cada um desses eventos no Telegram, junto
com os alertas internos que o ROI Labs já dispara hoje por e-mail e push.

**Why this priority**: o evento mais urgente, pedido pago, já avisa por e-mail e push. O ganho
aqui é trazer tudo para um canal só e cobrir reembolso, renovação recusada e cancelamento, que
hoje não avisam ninguém.

**Independent Test**: provocar uma vez cada um dos quatro eventos de dinheiro e conferir 4
mensagens. Provocar uma renovação aprovada e conferir nenhuma.

**Acceptance Scenarios**:

1. **Given** um pedido pendente, **When** o gateway confirma o pagamento, **Then** chega uma
   mensagem com "ROI Labs", o cliente, o total, os itens e o link para o pedido. Se o pedido abre
   uma assinatura, a mensagem diz isso.
2. **Given** a mesma confirmação de pagamento chegando duas vezes, **When** a segunda chega,
   **Then** nenhuma segunda mensagem é enviada.
3. **Given** um pedido pago, **When** o pagamento é devolvido, **Then** chega uma mensagem de
   reembolso com o cliente e o valor.
4. **Given** uma assinatura ativa, **When** a cobrança de renovação é recusada, **Then** chega uma
   mensagem com o cliente, o item e o prazo até o cancelamento automático.
5. **Given** uma assinatura ativa ou inadimplente, **When** ela é cancelada, **Then** chega uma
   mensagem dizendo quem cancelou: o cliente ou o sistema, por falta de pagamento.
6. **Given** uma assinatura ativa, **When** a renovação é aprovada, **Then** nenhuma mensagem é
   enviada.
7. **Given** um alerta interno do ROI Labs que já sai por e-mail ou push (frete quebrado, carteira
   com assinatura inválida, resumo semanal), **When** ele dispara, **Then** também chega no
   Telegram, e o e-mail e o push continuam saindo.

### Edge Cases

- **Hub, Telegram ou credencial do bot indisponível**: o lead, a candidatura e o pedido continuam
  gravados, e quem preencheu vê sucesso. Um aviso perdido é tolerado. Um lead perdido por causa
  do aviso, não.
- **Projeto sem a configuração do aviso**: a origem segue funcionando como hoje. A falta aparece
  no log pelo nome da variável, sem o valor.
- **Duplicado na origem**: cada origem já tem sua regra. A Coopluz ignora o mesmo WhatsApp na
  mesma solução no mesmo dia. A Atma recusa um e-mail que já tem pedido ativo. A Vértice agrupa
  reenvios de 2 minutos. O gateway do ROI Labs só conta a primeira confirmação. O aviso segue a
  regra da origem: sem lead novo, sem mensagem.
- **Lead de paciente vindo do bot do WhatsApp**: avisa como qualquer lead de paciente. A Atma não
  grava de onde o lead veio (os dois formulários do site e o bot chegam iguais), então a mensagem
  não diz a origem.
- **Backend da Atma oscilando**: o contêiner reinicia sob limite de CPU e volta em menos de 2
  minutos. Isso não é queda para esta feature.
- **Backend responde, mas sem banco**: conta como fora. O formulário falha do mesmo jeito.
- **Queda longa (horas)**: um aviso na queda e um na volta, nada no meio.
- **O próprio vigia sem conseguir rodar por um período**: isso não gera aviso de queda nem de
  volta.
- **Mensagem longa (resumo semanal, pedido com muitos itens)**: sai cortada dentro do limite de
  tamanho do canal, com o link mantido, e o envio não falha.
- **Rajada de alertas da carteira**: a origem já limita a 1 por hora por parceiro, e o Telegram
  herda esse limite.
- **Nome, empresa ou produto com caracteres de formatação** (`*`, `_`, `<`, `&`): a mensagem sai
  legível e o envio não falha por causa do conteúdo.
- **Campo opcional ausente** (telefone, e-mail, categoria): a linha some, sem campo vazio.

## Requirements *(mandatory)*

### Functional Requirements

**Leads e candidaturas (US1)**

- **FR-001**: Um lead **novo** da Vértice gravado no CRM do hub DEVE gerar uma mensagem.
- **FR-002**: Um lead **novo** da Coopluz DEVE gerar uma mensagem que diz qual formulário foi
  usado (Coopluz ou Parceiro Coopluz). O reenvio que a Coopluz trata como duplicado NÃO DEVE
  gerar mensagem.
- **FR-003**: Um lead de paciente **criado** na Atma DEVE gerar uma mensagem com nome, contato e
  cidade (quando houver). A mensagem NÃO DEVE conter as observações do paciente.
- **FR-004**: Um pedido de parceria **criado** na Atma DEVE gerar uma mensagem com nome, clínica,
  cidade e contato.
- **FR-005**: Uma candidatura a cadeira **criada** no ROI Labs DEVE gerar uma mensagem com nome,
  empresa, categoria e WhatsApp.
- **FR-006**: Um lead de consumidor **criado** no ROI Labs DEVE gerar uma mensagem com nome,
  WhatsApp e produto de interesse.

**Queda do backend da Atma (US2)**

- **FR-007**: O backend da Atma DEVE ser considerado fora quando fica 10 minutos seguidos sem
  responder, respondendo com erro ou informando o banco indisponível.
- **FR-008**: A entrada em "fora" DEVE gerar uma mensagem com o início da falha e o motivo. A
  saída DEVE gerar uma mensagem com a duração da queda. Enquanto a queda durar, NÃO DEVE sair
  nenhuma outra mensagem.
- **FR-009**: O aviso de queda DEVE chegar mesmo com a VPS que hospeda a Atma e o hub
  inteiramente fora do ar.

**Dinheiro e alertas do ROI Labs (US3)**

- **FR-010**: Um pedido **confirmado como pago** DEVE gerar uma mensagem com cliente, total,
  itens e link para o pedido, dizendo quando o pedido abre uma assinatura. A confirmação repetida
  NÃO DEVE gerar mensagem.
- **FR-011**: Um pagamento devolvido DEVE gerar uma mensagem com cliente e valor.
- **FR-012**: Uma renovação de assinatura recusada DEVE gerar uma mensagem com cliente, item e
  prazo até o cancelamento automático. Uma renovação aprovada NÃO DEVE gerar mensagem.
- **FR-013**: Uma assinatura cancelada DEVE gerar uma mensagem que diz se quem cancelou foi o
  cliente ou o sistema, por falta de pagamento.
- **FR-014**: Todo alerta interno do ROI Labs que hoje sai por e-mail ou push DEVE sair também no
  Telegram. O e-mail e o push NÃO DEVEM mudar.

**Transversais**

- **FR-015**: A primeira linha de toda mensagem DEVE dizer o evento e o projeto. Toda mensagem de
  evento DEVE ter um link para agir (abrir o lead, a candidatura, o pedido ou o painel).
- **FR-016**: Falha no envio do aviso NUNCA DEVE impedir a gravação do lead, da candidatura, do
  pedido ou da mudança de assinatura, nem mostrar erro ou atraso perceptível a quem preencheu ou
  ao gateway.
- **FR-017**: Todo ponto que aceite, de fora, um pedido de aviso DEVE exigir chamador
  autenticado, com o mesmo nível de confiança já exigido para ingerir lead no hub.
- **FR-018**: Credenciais do bot e segredos de integração NUNCA DEVEM aparecer em log, resposta ou
  mensagem de erro. Uma credencial ausente é reportada só pelo nome.
- **FR-019**: A mensagem DEVE sair legível qualquer que seja o conteúdo vindo de fora. Uma
  mensagem acima do limite de tamanho do canal DEVE ser cortada sem perder o link.
- **FR-020**: Os avisos da spec 026 (lead e ticket da Sirius e da Estetia) NÃO DEVEM mudar.

### Key Entities

- **Aviso**: mensagem ao dono disparada por um evento. Atributos: evento, projeto de origem,
  conteúdo resumido e link para agir. Não é gravado.
- **Origem**: formulário, notificação de gateway ou varredura que produz o evento. Cada origem
  tem sua própria regra de duplicado, e o aviso segue essa regra.
- **Estado do alvo vigiado**: no ar ou fora, desde quando e se o aviso de queda já saiu. É o
  único dado desta feature que precisa sobreviver entre uma checagem e outra.
- **Entidades que já existem**: lead (hub, Coopluz, Atma), pedido de parceria (Atma),
  candidatura, lead de consumidor, pedido e assinatura (ROI Labs).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dos 6 envios de teste em produção (US1), chegam exatamente 6 mensagens, cada uma
  com o projeto certo na primeira linha.
- **SC-002**: Mensagens de evento (US1 e US3) chegam em até 60 segundos. O aviso de queda chega
  em até 15 minutos depois do início da falha, e o aviso de volta em até 15 minutos depois de o
  backend voltar.
- **SC-003**: Com o aviso quebrado de propósito (credencial inválida), 100% dos envios de teste
  continuam gravados, e quem preencheu recebe sucesso.
- **SC-004**: Um reenvio de cada origem dentro da janela de duplicado gera zero mensagens extras.
- **SC-005**: Um alvo vigiado fora do ar por 15 minutos gera exatamente 2 mensagens. Fora por
  menos de 5 minutos, gera nenhuma.
- **SC-006**: Cada um dos 4 eventos de dinheiro, provocado uma vez, gera exatamente 1 mensagem.
  Uma renovação aprovada gera nenhuma.
- **SC-007**: Durante a verificação, a Sirius e a Estetia continuam gerando as mesmas mensagens de
  antes, e nenhuma origem fora desta spec gera mensagem.
- **SC-008**: Na primeira semana, pelo menos 1 lead real de cada projeto que recebeu lead no
  período chega ao Telegram. Projeto sem lead no período fica registrado como "sem lead", não
  como sucesso.

## Assumptions

- **Mesmo destino da 026**: o mesmo bot e o mesmo chat privado do dono. Nada de grupo ou vários
  destinatários.
- **O Telegram soma aos canais existentes**: o e-mail e o push do ROI Labs e o e-mail da Atma ao
  ortodontista e ao paciente continuam como estão.
- **O vigia não depende do hub**: ele roda fora da VPS e fala com o Telegram por conta própria.
  É o único ponto, além do hub, que conhece a credencial do bot.
- **10 minutos para declarar queda**: o contêiner da Atma reinicia sob limite de CPU e volta em
  menos de 2 minutos. Avisar esses reinícios seria ruído que ensina o dono a ignorar o canal.
- **Só o backend da Atma é vigiado na v1**, porque foi o que o dono pediu. Os sites dos outros
  projetos ficam fora.
- **Pagamento recusado no primeiro checkout não avisa**: o cliente tenta de novo na mesma sessão,
  e cada tentativa viraria uma mensagem. Só a renovação recusada avisa, porque aí ninguém está
  olhando.
- **Lead leva contato; paciente não leva observações**: o chat é privado do dono, que já trata
  esses contatos, mas o texto livre do paciente pode conter dado de saúde (LGPD), e o Telegram é
  serviço de terceiro.
- **Entrega best-effort, sem fila e sem reenvio**: o evento continua gravado na origem, e o link
  leva até ele.
- **Sem resumo ou agrupamento** de avisos na v1, além do resumo semanal que o ROI Labs já tem.
- **Deploy em quatro repositórios e duas plataformas**: hub, painel do ROI Labs e backend da Atma
  saem pelo EasyPanel da VPS, um de cada vez, porque builds simultâneos derrubam a VPS. Coopluz e
  Vértice saem pela Vercel.
- **Dependência — Vértice**: o hub tem 1 lead dessa pipeline, de 16/08. Antes de afirmar que o
  aviso funciona, é preciso confirmar que o segredo do hub continua valendo no ambiente da
  Vértice (lição da 026: sem ele, o formulário responde e nada chega).
