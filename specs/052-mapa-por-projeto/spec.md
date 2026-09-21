# Feature Specification: O mapa de GSC por projeto — o Sirius entra como segundo

**Feature Branch**: `052-mapa-por-projeto`

**Created**: 2026-09-21

**Status**: Draft

**Input**: User description: *"https://hub.roilabs.com.br/gsc/mapa — precisamos fazer a mesma coisa para
Sirius"*. Três decisões do dono, tomadas em 21/09/2026 antes desta spec (ver § Decisões).

## O fato que abre esta spec

Medido em 21/09/2026 (Search Console, janela 21/08 → 18/09, e o banco do hub):

1. **A tela é da Atma por escrita, não por construção.** `/gsc/mapa` pede os dados com o nome `atma`
   fixo em seis leituras (ficha, série diária, crawl de página, indexação, inventário e busca do card).
   O resto — as 113 folhas do board, as funções de medida, os estados de ausência — não sabe de projeto
   nenhum. Trocar o nome fixo por um parâmetro é o grosso do trabalho.
2. **Os dados do Sirius pararam de ser coletados em 07/09, e a causa é uma decisão, não uma falha.** Em
   07/09 o dono restringiu as corridas de busca à Atma (`SLUGS_DE_BUSCA = ["atma"]`). O comentário
   dessa decisão já diz que "abrir para o segundo projeto é acrescentar um slug aqui". O que está
   gravado hoje:

   | Corrida | Atma | Sirius |
   |---|---|---|
   | Série diária do GSC | 252 dias, até 19/09 | 141 dias, **para em 05/09** |
   | Indexação do sitemap | 14 corridas, diária | **1 corrida** (07/09) |
   | Crawl de página | 3 corridas | **nenhuma** |
   | Campo (CrUX) | ligado | desligado |

3. **O Sirius não tem marca declarada**, e sem ela o hub recusa separar marca de não-marca e recusa
   derivar o inventário de termos (o próprio script para com "sem isso o inventário mede a própria
   marca"). Também não tem inventário nem demanda estimada.
4. **O tráfego do Sirius não é o do público que compra.** Nos 28 dias, 64% das impressões vieram dos
   EUA, com 0 clique. O Brasil teve 13% das impressões e 13 cliques. Uma consulta em inglês
   (`evolution api baileys whatsapp ban risk official meta stance`, 2.776 impressões, 0 clique) leva
   `/en/blog/whatsapp-api-oficial-meta-crm` a **3.479 de 7.115 impressões por página (48,9%)**. O mapa
   do Sirius vai mostrar isso, e deve: é o 80/20 dele.
5. **A dimensão importa aqui mais que na Atma.** Por consulta o Sirius soma 4.363 impressões e 18
   cliques; por página, 7.115 impressões e 62 cliques. As consultas raras que o Google anonimiza são
   39% das impressões e 71% dos cliques. É a mesma diferença que fez a 032 escolher a dimensão por
   folha, e as folhas já a escolhem.

## Decisões já tomadas pelo dono (21/09/2026)

- **Parametrizar, não copiar.** Uma implementação só, com o projeto como parâmetro. A Atma continua
  no endereço que já tem, e o Sirius ganha o dele. Copiar a tela criaria duas implementações que
  divergem, o defeito que a 033 documentou.
- **Dado declarado: o agente levanta, o dono aprova.** Marca e inventário do Sirius são propostos
  nesta spec a partir das consultas reais e só são congelados depois do aceite. A demanda estimada
  (TAM) fica declarada como ausente até existir uma fonte.
- **A aresta até o dinheiro fica fora.** O painel "Depois do clique" diz por escrito que o Sirius não
  tem cadeia de R$ ligada ao hub. Ligar trial → assinatura é outra frente.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Abrir o mapa do Sirius e ler o número de cada folha (Priority: P1)

O dono abre o mapa do Sirius e vê o mesmo board da Atma, com as 113 folhas. Cada folha mostra o
número do Sirius com janela e fonte, ou o estado de ausência com o motivo nomeado. O cabeçalho
diz por escrito qual projeto e quais hosts estão sendo medidos.

**Why this priority**: é o pedido. Sem esta história não existe mapa do Sirius.

**Independent Test**: abrir o mapa do Sirius e o do Atma no mesmo dia. Conferir que o cabeçalho de
cada um nomeia o próprio projeto e hosts, e que as folhas que leem o Search Console ao vivo (as seis
faixas de posição, a conformidade de CTR, as impressões no Top 3, o footprint) mostram números
diferentes nos dois.

**Acceptance Scenarios**:

1. **Given** o Sirius no escopo das corridas de busca, **When** o dono abre o mapa do Sirius,
   **Then** o cabeçalho diz "O que esta tela mede é o Sirius CRM — siriuscrm.com.br" e as seis faixas
   de posição mostram as impressões do Sirius na janela de 28 dias.
2. **Given** uma folha sem dado para o Sirius (ex.: demanda estimada), **When** o mapa abre, **Then**
   a folha mostra `∅` com o motivo nomeado ("sem demanda estimada declarada para este projeto"),
   nunca `0` ou `0%`.
3. **Given** uma frase de nota que cita a Atma como a medição que justificou a regra (ex.: "medido
   na Atma em 20/09/2026: 347 consultas com a guarda desligada"), **When** ela aparece no mapa do
   Sirius, **Then** ela segue dizendo "na Atma". Uma frase que afirma algo sobre o projeto medido
   nunca diz "Atma" no mapa do Sirius.
4. **Given** um projeto fora do escopo das corridas de busca, **When** alguém abre o endereço do mapa
   dele, **Then** a tela responde "não encontrado". Um mapa inteiro de `∅` não é servido.

---

### User Story 2 — O mapa da Atma continua igual (Priority: P1)

O dono abre o mapa da Atma pelo endereço de sempre e pelos links antigos, e vê os mesmos números de
antes da mudança.

**Why this priority**: a Atma é o único projeto com o mapa em uso. Parametrizar não pode mexer
nos números dela.

**Independent Test**: capturar as folhas da Atma antes e depois da mudança, na mesma hora e na
mesma janela, e comparar.

**Acceptance Scenarios**:

1. **Given** um link antigo para o mapa (`/gsc/mapa`), **When** o dono o abre, **Then** chega ao mapa
   da Atma.
2. **Given** a mesma janela e a mesma hora, **When** as folhas da Atma são comparadas antes e depois,
   **Then** todo número é igual. Nenhuma folha troca de estado.

---

### User Story 3 — Trocar de projeto sem digitar endereço (Priority: P2)

No mapa de um projeto, o dono vê quais outros projetos têm mapa e troca para um deles com um clique.

**Why this priority**: com dois projetos, a troca por endereço funciona. O seletor é conforto,
não é o pedido.

**Independent Test**: no mapa da Atma, achar o link do Sirius e chegar ao mapa dele (e o inverso), só
com o teclado.

**Acceptance Scenarios**:

1. **Given** dois projetos no escopo, **When** o mapa abre, **Then** o cabeçalho lista os dois, marca o
   atual e liga o outro.

---

### User Story 4 — As corridas diárias voltam a cobrir o Sirius (Priority: P1)

A partir do dia em que o Sirius entra no escopo, a série diária do GSC, a indexação do sitemap e o
crawl de página gravam uma linha do Sirius por dia, como fazem para a Atma.

**Why this priority**: sem as corridas, cerca de 11 folhas do mapa do Sirius ficam em `∅` para sempre: as que
leem o banco (crescimento não-marca, marca, schema, título, intenção, profundidade, frescor, links,
indexação limpa, rejeição de rastreio, active index). A tela sairia com metade vazia.

**Independent Test**: no dia seguinte ao deploy, conferir no banco uma linha do Sirius com a data
do dia em cada uma das três tabelas das corridas, e conferir que a da Atma também foi gravada.

**Acceptance Scenarios**:

1. **Given** o Sirius no escopo, **When** as três corridas do dia terminam, **Then** cada uma gravou uma
   linha do Sirius com a data do dia, e a da Atma continua gravada.
2. **Given** o hiato da série diária do Sirius (06/09 → o dia do deploy), **When** a corrida da série
   roda, **Then** o hiato é preenchido até onde o Search Console ainda guarda o dado. Um dia sem
   impressão é gravado como zero medido, nunca omitido.
3. **Given** uma corrida com os dois projetos, **When** ela roda, **Then** termina dentro do tempo
   máximo da rota. Se não couber, a spec do plano declara o corte.

---

### Edge Cases

- **Folha que depende de dado declarado e o Sirius não tem.** A demanda estimada (TAM) e a
  cadeia depois do clique: `∅` com motivo, e a fila 80/20 do painel não recebe item dessas folhas.
- **Folha do campo (CrUX) com tráfego abaixo do limiar da fonte.** A CrUX não publica origem com pouco
  tráfego. Sirius sem dado de campo: `∅ sem dado na CrUX`, não "reprovado".
- **Série com separação de marca só daqui para frente.** Os 141 dias gravados antes da marca
  declarada não têm a separação. O crescimento não-marca compara meses fechados. Enquanto não houver
  dois meses fechados com a separação, a folha diz "a série gravada ainda não traz a separação de
  marca", nunca "0%". Isso já é um estado existente da folha.
- **Homônimos na marca.** `sirius financeira`, `sirius corretora` e `sirius interativa` são busca pelo
  nome de outra empresa. Declarar `sirius` como marca os tira do não-marca. É o lado conservador:
  eles não são demanda que o Sirius possa conquistar, e contá-los como não-marca inflaria o
  crescimento.
- **Consulta em inglês dominando o inventário.** O inventário derivado pela regra da Atma põe a
  consulta de 2.777 impressões em primeiro. A regra é a mesma para os dois projetos. O mapa mostra a
  concentração em vez de escondê-la.
- **Projeto no escopo sem card.** O card sumiu do `projects.json`: a tela responde "não encontrado",
  como para projeto fora do escopo.
- **A Atma tem domínio anterior; o Sirius não.** As folhas que leem o domínio anterior (vitais por
  origem, canibalização, active index) caem no caminho de "sem domínio anterior", que já existe.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O mapa DEVE receber o projeto como parte do endereço e medir só esse projeto. Não pode
  existir uma segunda cópia da tela.
- **FR-002**: O endereço antigo do mapa DEVE continuar levando ao mapa da Atma.
- **FR-003**: Só os projetos do escopo das corridas de busca têm mapa. Fora dele, e para projeto sem
  card, a resposta DEVE ser "não encontrado".
- **FR-004**: Toda frase da tela que afirma algo sobre o projeto medido (cabeçalho, notas de
  ausência, links para a ficha e a aba de aquisição) DEVE nomear o projeto medido e apontar para as
  telas dele. Frases que citam a Atma como a evidência de uma regra DEVEM continuar nomeando a Atma.
- **FR-005**: O Sirius DEVE entrar no escopo das corridas de busca (série diária, indexação, crawl
  de página). A mudança liga também os blocos de KPI da aba de aquisição do Sirius, que leem o mesmo
  escopo. É desejado: as duas telas publicam o mesmo número pela mesma função.
- **FR-006**: O Sirius DEVE entrar no escopo do campo (CrUX).
- **FR-007**: O card do Sirius DEVE declarar a marca. **Proposta, aguardando o aceite do dono:**
  termos `sirius` e `siriuscrm`, país `bra`, declarada em 21/09/2026. `sirius` com fronteira de
  palavra já cobre `sirius crm`, `crm sirius`, `sirius ia` e `plataforma sirius`. `siriuscrm` entra à
  parte porque não tem fronteira no meio.
- **FR-008**: O inventário de termos do Sirius DEVE ser derivado pela mesma regra da Atma (≥ 20
  impressões em 8 meses, dimensão consulta, sem a marca) e congelado só depois do aceite do dono.
  **Prévia de 21/09/2026:** 18 termos, que retêm 90,3% das impressões não-marca. Nenhum está no Top
  3. Os 5 primeiros: `evolution api baileys…` (2.777), `agaas` (606), `crm roi` (198), `agaas meaning`
  (171), `crm solar` (147).
- **FR-009**: A folha de demanda estimada (TAM) do Sirius DEVE mostrar `∅` com o motivo "sem demanda
  estimada declarada para este projeto".
- **FR-010**: O painel "Depois do clique" do Sirius DEVE dizer por escrito que o projeto não tem cadeia
  de R$ ligada ao hub, e nenhuma taxa entre clique e receita DEVE ser calculada.
- **FR-011**: O cabeçalho do mapa DEVE listar os projetos que têm mapa, marcar o atual e ligar os
  outros, com o texto de cada link dizendo o nome do projeto.
- **FR-012**: A série diária do Sirius DEVE ser completada desde 06/09 até o dia do deploy, dentro do
  que o Search Console ainda guarda. Dia sem impressão é gravado como zero.
- **FR-013**: Nenhum estado de ausência pode ser exibido como `0` ou `0%` no mapa do Sirius. É a mesma
  regra das folhas da Atma.

### Key Entities

- **Projeto do mapa**: um card do hub dentro do escopo das corridas de busca. Carrega nome, hosts
  declarados, domínio anterior (opcional) e marca.
- **Marca declarada**: termos, país e data da declaração, no card. Separa busca pelo nome de busca
  genérica.
- **Inventário de termos**: a lista congelada de termos monitorados de um projeto, com procedência
  (janela, piso, hosts, marca excluída). É o denominador da penetração no Top 3.
- **Escopo das corridas de busca**: a lista de projetos que as três corridas diárias percorrem. É a
  mesma lista que decide quem tem mapa.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O mapa do Sirius abre com as 113 folhas do board. Cada folha medida mostra número com
  janela ou `∅` com motivo. Zero folha mostra `0`/`0%` sobre ausência.
- **SC-002**: Na mesma hora e na mesma janela, 100% dos números do mapa da Atma são iguais antes e
  depois da mudança.
- **SC-003**: No primeiro dia após o deploy, as três corridas diárias gravam uma linha do Sirius com a
  data do dia, e a da Atma segue gravada.
- **SC-004**: Sete dias após o deploy, as folhas que leem o banco saem do estado "nenhuma corrida
  gravada" no mapa do Sirius. Exceção: as que dependem de dois meses fechados com separação de marca,
  que dizem isso.
- **SC-005**: No mapa do Sirius, nenhuma frase que descreve o projeto medido contém "Atma". Isso é
  conferido por busca no HTML renderizado, contra a lista das frases de evidência permitidas.
- **SC-006**: O dono chega do mapa da Atma ao do Sirius (e volta) em um clique, só com o teclado.

## Assumptions

- **Sem corte por país no mapa.** O mapa do Sirius lê como o da Atma lê: todos os países somados,
  pelas mesmas funções. Os 64% dos EUA com 0 clique aparecem no número e na fila, e não são
  filtrados. Um corte por país mudaria também os números da Atma, que o SC-002 proíbe. Se for
  desejado, é uma spec própria para os dois projetos.
- **O board vale para o Sirius como está.** As definições e metas do Whimsical são de SEO, não de
  alinhador. A meta do board continua sendo meta, não régua (o `◇` de cada folha não muda).
- **A quota de inspeção do Search Console não aperta.** O Sirius é propriedade própria
  (`siriuscrm.com.br`) e não divide a quota diária com as da Atma.
- **O tempo das corridas cabe.** O Sirius declara ~131 páginas com impressão em 8 meses. O plano
  confere o tempo máximo de cada rota com os dois projetos antes de ligar.
- **A série antiga fica.** Os 141 dias do Sirius sem separação de marca não são reescritos. A
  separação vale da primeira corrida com a marca declarada em diante.
- **O endereço do Sirius é `/gsc/mapa/sirius`** e o da Atma passa a ser também `/gsc/mapa/atma`.

## Fora do escopo

- A aresta clique → trial → assinatura do Sirius (Stripe ou banco do produto).
- A demanda estimada (TAM) do Sirius.
- Corte por país em qualquer folha.
- Abrir o mapa para um terceiro projeto. A estrutura permite, mas esta spec só acrescenta o Sirius.
- Consertar o que o mapa do Sirius mostrar (a página em inglês, o título, a canibalização). Isso vai
  para a fila, não para esta spec.
