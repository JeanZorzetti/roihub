# Feature Specification: Marcar a alavanca como feita e ver todos os degraus no mapa de GSC

**Feature Branch**: `055-feito-aguardando-mapa`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: *"Então '1 · Índice · página fora do índice não recebe clique nenhum' foi concluído?
Tem que sinalizar de algum modo, pra eu poder ir pra próxima tarefa, mas tava lendo e cadê a segunda
tarefa, parece que da '1' pula pra '3'"* (23/09/2026, sobre `/gsc/mapa/sirius`). Entre marca com prazo,
marca sem prazo e nenhuma marca, o dono escolheu **marca com prazo**.

## O fato que abre esta spec

Lido em 23/09/2026 no mapa do Sirius em produção, depois dos consertos do mesmo dia no site
(`82d86fa4`, `8c6dff17`) e no crawl do hub (`6f573c8`):

1. **O trabalho do degrau 1 foi feito e o degrau continua em primeiro.** Links do blog sem o 307 do
   `/pt-BR`, as 3 órfãs reais ligadas no rodapé, o prefixo `/pt-BR` com 308, e o pedido de indexação
   da URL mais valiosa. A leitura de indexação (73,7%, 30 de 114 fora) só muda quando o Google
   rastrear de novo, em semanas. Até lá o bloco "O que fazer primeiro" põe em destaque uma tarefa
   que não tem mais o que fazer do lado da casa, e o dono não sabe se pode passar para a próxima.
2. **O painel pula do "1" para o "3".** O degrau "2 · Desempenho" não aparece porque nenhuma regra
   dele disparou (054, cenário 2.1: "um degrau sem ação não aparece"). Os números dos degraus são
   fixos, então o buraco é lido como tarefa perdida.
3. **E o degrau 2 some por falta de leitura, não porque está bom.** As cinco folhas dele (LCP, INP,
   CLS, TTFB, % de URLs com status Bom) estão sem leitura: a origem do Sirius não tem visita
   suficiente na CrUX. O rodapé imprime "Sem ação: 2 · Desempenho", frase que um leitor toma por
   "dentro". É o defeito que a FR-004 da 054 proíbe ("sem leitura nunca pode aparecer como dentro"),
   entrando pela porta do degrau em vez da folha.

## Clarifications

### Session 2026-09-23

- Q: Como sinalizar que uma alavanca foi trabalhada e depende do Google? → A: Marca com prazo de
  releitura; vencida com a regra ainda disparando, a entrada volta ativa (US2, US3).
- Q: A marca vale por entrada (alavanca) ou pelo degrau inteiro? → A: Por entrada; o degrau vira
  "aguardando" quando todas as entradas dele estão marcadas (FR-003, FR-006).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ver os cinco degraus, e por que um está vazio (Priority: P1)

O dono lê o bloco "O que fazer primeiro" e encontra os cinco degraus em ordem, de 1 a 5. Um degrau
sem ação aparece numa linha só, dizendo por quê: quantas folhas não dispararam e quantas estão sem
leitura, com o motivo.

**Why this priority**: é o defeito que o dono viu primeiro, e a correção não depende de nada novo:
só muda o que o painel desenha com o que ele já sabe.

**Independent Test**: abrir `/gsc/mapa/sirius` e ler, entre "1 · Índice" e "3 · Página certa para o
termo", a linha do "2 · Desempenho" dizendo que as cinco folhas dele estão sem leitura porque a
origem não tem visita suficiente na CrUX.

**Acceptance Scenarios**:

1. **Given** um degrau sem nenhuma regra disparada, **When** o painel monta, **Then** o degrau aparece
   na posição dele, numa linha, sem ação e com a contagem de folhas por estado.
2. **Given** um degrau vazio com todas as folhas sem leitura, **When** o painel monta, **Then** a linha
   diz "sem leitura" e o motivo, e não diz "dentro", "ok" nem nada que pareça aprovação.
3. **Given** um degrau vazio com todas as folhas dentro, **When** o painel monta, **Then** a linha diz
   que nenhuma folha do degrau disparou (o glossário proíbe "dentro" para sem ação).

---

### User Story 2 — Marcar uma alavanca como feita, com data para reler (Priority: P1)

O dono terminou o trabalho de uma entrada do painel (ex.: "Consertar o índice") e o resultado agora
depende do Google. Ele marca a entrada como feita, diz quem fez e quando reler. A entrada sai do
destaque: fica esmaecida no fim do degrau, com "feito em 23/09 por Jean · aguardando · reler em
07/10", e o destaque de primeira tarefa passa para a próxima entrada não marcada, na ordem de ataque.

**Why this priority**: é o pedido literal ("sinalizar pra eu poder ir pra próxima tarefa").

**Independent Test**: no mapa do Sirius, marcar "Consertar o índice" e "Consolidar, enriquecer ou
desindexar" como feitas por Jean, com releitura em 14 dias. Recarregar a página e ler as duas
entradas esmaecidas com a data, o degrau 1 marcado como aguardando, e o destaque de primeira tarefa
em "3 · Página certa para o termo".

**Acceptance Scenarios**:

1. **Given** uma entrada ativa, **When** o dono marca como feita escolhendo responsável e prazo,
   **Then** a marca fica gravada e sobrevive a recarregar a página, a outro navegador e a um deploy.
2. **Given** uma entrada marcada, **When** o painel monta antes da data de releitura, **Then** a
   entrada aparece esmaecida no fim do degrau, com quem, quando e a data de releitura, e não recebe o
   destaque de primeira tarefa.
3. **Given** todas as entradas de um degrau marcadas, **When** o painel monta, **Then** o cabeçalho do
   degrau diz "aguardando" e o destaque vai para o primeiro degrau seguinte com entrada não marcada.
4. **Given** uma entrada marcada, **When** o dono desfaz a marca, **Then** a entrada volta a ser ativa
   na mesma hora.
5. **Given** uma entrada marcada no mapa do Sirius, **When** o dono abre o mapa da Atma, **Then** a
   mesma alavanca na Atma não está marcada.

---

### User Story 3 — A marca vence e a tarefa volta se não resolveu (Priority: P1)

Na data de releitura, o mapa confere a regra de novo. Se ela não dispara mais, a entrada some do
painel como qualquer alavanca resolvida. Se ainda dispara, a entrada volta a ser ativa, dizendo "feito
em 23/09 e ainda dispara", com o número de quando foi marcada ao lado do número de hoje.

**Why this priority**: é o que impede a marca de mentir. Marca sem prazo fica velha sem ninguém ver,
e o dono escolheu o prazo por isso. Sem esta história, a US2 é a marca sem prazo.

**Independent Test**: com uma marca cuja data de releitura já passou e cuja regra ainda dispara, abrir
o mapa e ler a entrada ativa com "feito em … e ainda dispara" e as duas leituras.

**Acceptance Scenarios**:

1. **Given** uma marca vencida e a regra ainda disparando, **When** o painel monta, **Then** a entrada
   volta ativa, na ordem normal do degrau, com a data da marca e as duas leituras (a de quando foi
   marcada e a de hoje).
2. **Given** uma marca, vencida ou não, e a regra que não dispara mais, **When** o painel monta,
   **Then** a entrada não aparece, como toda alavanca sem disparo.
3. **Given** uma marca ainda no prazo, **When** o painel monta, **Then** a entrada esmaecida mostra a
   leitura de quando foi marcada ao lado da de hoje, para o dono ver se o número já se mexeu.

---

### Edge Cases

- **A leitura piora enquanto a marca está no prazo** (ex.: 30 fora do índice viram 40): a marca não
  vence sozinha; a entrada esmaecida mostra as duas leituras, e a diferença fica visível.
- **Motivo novo na alavanca marcada** (outra folha passa a pedir a mesma alavanca depois da marca): a
  entrada continua marcada, e o motivo novo aparece na lista dela sinalizado como posterior à marca.
- **Leitura sem fonte no dia** (GSC ou crawl caiu): a marca continua; a entrada diz que a leitura de
  hoje falhou, sem tratar a falha como "resolvido".
- **Alavanca que deixa de existir no catálogo**: a marca órfã não aparece e não quebra a página.
- **Data de releitura no passado ao marcar**: não é aceita.
- **Marca sem responsável**: não é aceita. Só Jean Zorzetti ou Maria Zorzetti.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O painel "O que fazer primeiro" DEVE mostrar os cinco degraus em ordem de ataque, sempre.
  Revoga o cenário 2.1 da 054 ("um degrau sem ação não aparece").
- **FR-002**: Um degrau sem disparo DEVE aparecer numa linha com a contagem das folhas dele por estado
  (dentro, não decide, sem leitura) e, para "sem leitura", o motivo. A linha NÃO PODE dizer ou sugerir
  aprovação quando alguma folha do degrau está sem leitura.
- **FR-003**: O dono DEVE poder marcar uma entrada do painel (uma alavanca) como feita num projeto,
  informando o responsável (Jean Zorzetti ou Maria Zorzetti) e a data de releitura. O prazo padrão é
  de 14 dias.
- **FR-004**: A marca DEVE ser gravada por projeto e alavanca, com responsável, data da marca, data de
  releitura e a leitura de cada motivo no momento da marca. Ela DEVE sobreviver a recarregar a página
  e a deploy.
- **FR-005**: Enquanto a data de releitura não chega, a entrada marcada DEVE aparecer esmaecida no fim
  do degrau dela, com responsável, data da marca, data de releitura e as duas leituras (a da marca e
  a de hoje), e NÃO DEVE receber o destaque de primeira tarefa.
- **FR-006**: O destaque de primeira tarefa DEVE ir para a primeira entrada não marcada na ordem de
  ataque. Um degrau com todas as entradas marcadas DEVE dizer "aguardando" no cabeçalho.
- **FR-007**: Depois da data de releitura, uma entrada cuja regra ainda dispara DEVE voltar a ser ativa
  na ordem normal do degrau, com "feito em [data] e ainda dispara" e as duas leituras.
- **FR-008**: Uma entrada cuja regra não dispara mais NÃO DEVE aparecer, com ou sem marca.
- **FR-009**: O dono DEVE poder desfazer uma marca a qualquer momento, e o efeito DEVE ser imediato.
- **FR-010**: A marca NÃO DEVE mudar nenhuma leitura, regra, limiar nem estado de folha: ela muda só a
  ordem e a aparência do painel. O nó da folha no mapa continua dizendo o que a regra diz.
- **FR-011**: Marcar, desfazer e ler o estado de marca DEVEM funcionar só por teclado e ser anunciados
  por leitor de tela. O estado "aguardando" NÃO PODE ser dito só por cor ou opacidade.
- **FR-012**: Abrir o mapa NÃO DEVE fazer requisição externa a mais do que antes da feature (054,
  SC-005). A marca vem do banco do próprio hub.

### Key Entities

- **Marca**: pertence a um projeto e a uma alavanca. Tem responsável, data da marca, data de releitura
  e a leitura de cada motivo da entrada no momento da marca. Não guarda estado de folha: esse
  continua sendo calculado a cada abertura.
- **Entrada** (054): a alavanca no painel, com seus motivos. Passa a ter três estados de apresentação:
  **ativa**, **aguardando** (marca no prazo) e **voltou** (marca vencida e a regra ainda dispara).
- **Degrau** (054): passa a aparecer sempre, com **com ação**, **aguardando** ou **vazio** (com a
  contagem por estado).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Nos mapas da Atma e do Sirius, o painel mostra 5 de 5 degraus, numerados de 1 a 5, sem
  buraco.
- **SC-002**: No Sirius, com as leituras de 23/09/2026, a linha do "2 · Desempenho" diz que as cinco
  folhas estão sem leitura e dá o motivo; nenhuma palavra dela é "dentro", "ok" ou "sem problema".
- **SC-003**: Depois de marcar as duas entradas do degrau 1 do Sirius, o destaque de primeira tarefa
  está numa entrada do degrau 3, sem clique a mais.
- **SC-004**: Uma marca vencida com a regra ainda disparando volta ativa na primeira abertura depois da
  data de releitura, sem ação de ninguém.
- **SC-005**: Marcar uma entrada leva no máximo três interações (abrir, escolher responsável, confirmar),
  com o prazo padrão já preenchido.
- **SC-006**: Abrir o mapa não faz nenhuma requisição externa a mais do que antes da feature.

## Assumptions

- Um só dono opera o hub por trás da mesma senha; o responsável é escolhido na marca, não deduzido do
  login. A lista de responsáveis é a que o hub já usa na agenda (008).
- A marca vale para a alavanca inteira, não para cada URL-alvo dela.
- O prazo padrão de 14 dias cobre o tempo típico de um novo rastreio depois de pedir indexação; o dono
  pode escolher outro.
- A marca é histórico de trabalho, não de medição: ela não entra em série, régua nem veredito.

## Fora do escopo

- Marcar folhas individuais no nó do mapa (a marca é da entrada do painel).
- Avisar por Telegram, e-mail ou agenda quando uma marca vence.
- Abrir tarefa na agenda a partir da marca.
- Trazer leitura para os vitais do Sirius (sem amostra na CrUX é fato da origem, não do hub).
