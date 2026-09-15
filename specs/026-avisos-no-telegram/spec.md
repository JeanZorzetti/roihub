# Feature Specification: Avisos no Telegram — lead novo e ticket de suporte da Sirius e da Estetia

**Feature Branch**: `026-avisos-no-telegram`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "Quero criar uma nova feature no hub para chegar notificações no meu telegram acerca dos projetos" — escopo fechado na conversa: "Lead novo, ticket de suporte, da sirius e da estetia"

## Contexto

Sirius CRM e Estetia CRM geram dois eventos que pedem reação rápida do dono, e hoje nenhum dos
dois chega a ele na hora:

| Evento | Onde nasce | Como o dono fica sabendo hoje |
|---|---|---|
| Lead novo | formulário de contato e calculadora de ROI dos sites | abrindo o CRM do hub — **e nem isso, ver abaixo** |
| Ticket de suporte | área de suporte do cliente logado, dentro de cada produto | e-mail para `suporte@roilabs.com.br` |

O hub já é o destino dos leads da casa (ingestão autenticada, pipelines `sirius` e `estetiacrm`
já cadastradas), então é o ponto natural para avisar de lead. De ticket o hub não sabe nada: ele
vive só no banco de cada produto.

## ⚠️ O lead dessas duas origens não chega ao hub hoje

Medido em 15/09/2026 no git, não suposto: o código que manda o lead dos sites para o CRM do hub
foi escrito em 01/09 nos dois produtos e **nunca foi para a produção**.

- **Estetia** — o commit `88352ee` ("send contact and calculator leads to the roihub CRM") está
  só no clone local, 1 commit à frente do `origin/main`.
- **Sirius** — o commit equivalente `9a0b5e81` está só em `C:\dev\sirius`, um clone 27 commits
  atrás do `origin/main`. O clone em uso (`CRM/crm-project`, em dia com o `origin`) não tem esse
  código.

Consequência direta: um aviso de lead construído só no hub **nasce mudo** — passaria em todo
teste local e nunca tocaria em produção, porque não há lead dessas pipelines para avisar. Levar
esses dois commits à produção é **pré-requisito da história 1**, não detalhe de deploy.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Lead novo chega no Telegram (Priority: P1)

Um visitante preenche o formulário de contato ou a calculadora de ROI no site da Sirius ou da
Estetia. Em menos de um minuto o dono recebe no Telegram de qual produto e de qual formulário o
lead veio, o nome, o e-mail, o telefone quando houver e o caminho para o CRM do hub — o
suficiente para responder sem abrir outra tela.

**Why this priority**: lead é a frente do dinheiro dos dois projetos, e o gate de conversão de
ambos depende de responder enquanto o visitante ainda lembra que preencheu. É também a história
com o buraco maior: hoje o lead não chega nem ao hub.

**Independent Test**: enviar um lead de teste por cada formulário dos dois sites em produção
(4 envios) e conferir 4 mensagens no Telegram e 4 cards no CRM do hub.

**Acceptance Scenarios**:

1. **Given** o site da Sirius entregando lead ao hub, **When** um visitante envia o formulário
   de contato, **Then** chega uma mensagem identificando "Sirius", a origem "contato", o nome e
   o contato do visitante.
2. **Given** o site da Estetia entregando lead ao hub, **When** um visitante usa a calculadora
   de ROI, **Then** chega uma mensagem identificando "Estetia", a origem "calculadora de ROI", o
   nome e o contato.
3. **Given** um lead já gravado, **When** o mesmo lead é reenviado (reenvio técnico, mesmo
   identificador), **Then** nenhuma segunda mensagem é enviada.
4. **Given** um lead de qualquer outra pipeline do hub, **When** ele é gravado, **Then** nenhuma
   mensagem é enviada.

---

### User Story 2 — Ticket de suporte chega no Telegram (Priority: P2)

Um cliente logado abre um ticket na área de suporte da Sirius ou da Estetia, ou responde num
ticket que já estava aberto. Em menos de um minuto o dono recebe no Telegram o produto, a
organização do cliente, o assunto e o link direto para o ticket no painel de staff do produto —
e, na abertura, também a categoria e a prioridade.

**Why this priority**: é cliente pagante esperando resposta, mas o evento já tem um canal
(e-mail) — o ganho é velocidade, não existência. Por isso vem depois do lead, que hoje não tem
canal nenhum. A resposta entra junto com a abertura porque é nela que o cliente fica esperando:
a conversa parada do lado do dono é o que vira cancelamento.

**Independent Test**: numa conta de teste de cada produto, abrir um ticket, responder como
cliente e responder como staff — conferir exatamente 2 mensagens (abertura e resposta do
cliente); o e-mail de novo ticket continua chegando.

**Acceptance Scenarios**:

1. **Given** um cliente logado na Sirius, **When** ele abre um ticket, **Then** chega uma
   mensagem com "Sirius", organização, assunto, categoria e prioridade, e o link abre o ticket no
   painel de staff.
2. **Given** um ticket aberto com prioridade alta ou urgente, **When** a mensagem chega, **Then**
   a prioridade é a primeira coisa legível nela.
3. **Given** o hub ou o Telegram fora do ar, **When** o cliente abre um ticket, **Then** o ticket
   é criado, o cliente não vê erro e o e-mail de novo ticket sai normalmente.
4. **Given** um ticket já aberto, **When** o cliente responde nele, **Then** chega uma mensagem
   com produto, organização, assunto do ticket e o link para ele.
5. **Given** um ticket já aberto, **When** o staff responde ou registra uma nota interna,
   **Then** nenhuma mensagem é enviada.

### Edge Cases

- **Hub, Telegram ou credencial do bot indisponível**: o lead continua gravado e o ticket
  continua criado. Aviso perdido é tolerado; lead ou ticket perdido por causa do aviso, não.
- **Hub sem a credencial do bot configurada**: a ingestão de lead segue funcionando; a falta é
  reportada pelo nome da variável, sem valor.
- **Nome, assunto ou organização com caracteres de formatação** (`*`, `_`, `<`, `&`): a mensagem
  sai legível e o envio não falha por causa do conteúdo.
- **Lead sem telefone**: a mensagem sai sem a linha de telefone, sem campo vazio.
- **Rajada** (vários leads ou tickets no mesmo minuto): uma mensagem por evento. Os formulários e
  a abertura de ticket já têm limite de frequência próprio na origem.
- **Cliente respondendo várias vezes seguidas no mesmo ticket**: uma mensagem por resposta. O
  e-mail ao staff tem limitação de frequência própria; o aviso não herda essa limitação na v1.
- **Descrição do ticket ou texto da resposta com dado sensível do cliente final**: não vai para o
  Telegram — o link leva ao painel.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE enviar uma mensagem ao Telegram do dono sempre que um lead **novo**
  das pipelines Sirius ou Estetia for gravado no CRM do hub.
- **FR-002**: O sistema NÃO DEVE enviar mensagem quando o lead recebido é reenvio de um lead já
  gravado.
- **FR-003**: O sistema NÃO DEVE enviar mensagem de lead de nenhuma outra pipeline.
- **FR-004**: A mensagem de lead DEVE conter produto, origem, nome, e-mail, telefone (quando
  houver) e o caminho para o CRM do hub.
- **FR-005**: Os sites da Sirius e da Estetia DEVEM entregar em produção os leads de contato e da
  calculadora de ROI ao CRM do hub (pré-requisito da FR-001, hoje não atendido).
- **FR-006**: A abertura de um ticket de suporte na Sirius ou na Estetia DEVE gerar uma mensagem
  com produto, organização, assunto, categoria, prioridade e link para o ticket no painel de
  staff do produto.
- **FR-007**: A resposta do cliente num ticket já aberto DEVE gerar uma mensagem com produto,
  organização, assunto do ticket e link para ele. Resposta do staff e nota interna NÃO DEVEM
  gerar mensagem.
- **FR-008**: A mensagem de ticket NÃO DEVE conter a descrição do ticket nem o texto da resposta.
- **FR-009**: O hub DEVE aceitar aviso de ticket somente de chamador autenticado, com o mesmo
  nível de confiança já exigido para ingerir lead.
- **FR-010**: Falha no envio do aviso NUNCA DEVE impedir a gravação do lead, a criação do ticket
  ou o registro da resposta, nem mostrar erro ou atraso perceptível a quem preencheu.
- **FR-011**: Credenciais do bot e segredos de ingestão NUNCA DEVEM aparecer em log, resposta ou
  mensagem de erro; credencial ausente é reportada só pelo nome.
- **FR-012**: A mensagem DEVE sair legível qualquer que seja o conteúdo de nome, assunto ou
  organização.
- **FR-013**: Os e-mails de ticket que já existem NÃO DEVEM mudar: o Telegram soma ao e-mail, não
  o substitui.

### Key Entities

- **Aviso**: mensagem ao dono disparada por um evento. Atributos: tipo (lead novo | ticket aberto
  | resposta do cliente), produto de origem, conteúdo resumido, link para agir. Não é gravado.
- **Lead** (já existe no hub): pipeline, origem, nome, e-mail, telefone e o identificador externo
  que detecta reenvio.
- **Ticket de suporte** (já existe em cada produto): assunto, categoria, prioridade, organização
  do cliente, status e as mensagens da conversa, cada uma com autor (cliente, staff ou sistema) e
  a marca de nota interna.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dos 4 leads de teste enviados em produção (contato e calculadora, nos dois sites),
  chegam exatamente 4 mensagens — nenhuma faltando, nenhuma duplicada.
- **SC-002**: Cada mensagem chega em até 60 segundos depois do envio do formulário ou da
  abertura do ticket.
- **SC-003**: Com o envio de avisos quebrado de propósito (credencial inválida), 100% dos leads e
  tickets de teste continuam gravados e quem preencheu recebe sucesso.
- **SC-004**: Zero mensagens para leads de outras pipelines durante a verificação.
- **SC-005**: Em cada produto, um ticket de teste aberto, respondido uma vez pelo cliente e uma
  vez pelo staff gera exatamente 2 mensagens, e o link das duas abre o ticket certo no painel de
  staff.

## Assumptions

- **Destino único**: um chat privado entre o dono e o bot. Grupo ou vários destinatários ficam
  fora da v1.
- **O bot é criado à mão pelo dono**, que informa o token e o identificador do chat; esta feature
  não automatiza essa etapa.
- **Lead leva e-mail e telefone no aviso**: o chat é privado do dono, que já é quem trata esses
  dados, e aviso que obriga a abrir outra tela para achar o contato perde o motivo de existir.
- **Ticket não leva descrição**: ela é texto livre do cliente final e pode ter dado sensível, e o
  Telegram é serviço de terceiro.
- **Entrega best-effort, sem fila e sem reenvio**: aviso perdido é tolerado porque o lead fica no
  CRM do hub e o ticket continua gerando e-mail.
- **Sem resumo ou agrupamento** de avisos na v1.
- **Os dois produtos reusam a relação de confiança que já têm com o hub** para entregar lead, em
  vez de criar outra para o ticket.
- **Dependência**: a história 1 só é verificável depois que os commits de lead dos dois produtos
  (ver "⚠️ O lead dessas duas origens não chega ao hub hoje") estiverem em produção, com o
  endereço e o segredo do hub configurados no ambiente de cada um — o que também ainda não foi
  verificado.
