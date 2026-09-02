# Feature Specification: Ficha N0-N6 por projeto — a árvore inteira, um projeto por vez

**Feature Branch**: `011-okr-ficha-por-projeto`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Quero que o botão que leva à página OKR seja um menu colapsável e dentro
tenha a Atma como página dedicada, porque eu quero que essa questão das OKRs, dos KPIs primários,
secundários, terciários, quaternários e toda essa granularização de microindicadores que eu preciso
atingir para atingir os macroindicadores sejam mais robustas com páginas dedicadas para cada
projeto. Então, vamos começar pela Atma. Mantenha a página da OKR como está."

## Contexto: a árvore tem sete níveis e a tela renderiza três

O `handoff/okr-kpi-template.md:57` define **N0 a N6**. A `/okr` de hoje, somando a 009 e a 010,
renderiza três deles:

| Nível | Pergunta | Onde está hoje |
|---|---|---|
| **N0** Objetivo | o que muda no mundo? | **em lugar nenhum** |
| **N1** KPI primária | quanto isso vale em R$? | `ficha.n1` — o **rótulo** ("Tratamentos iniciados na janela"), e o valor no último degrau da tabela |
| **N2** KPI secundárias | de que fatores o dinheiro é feito? | `ficha.n2` — uma **string decorativa**, `"Receita = Leads × CR(lead→consulta) × …"`, sem um valor por fator |
| **N3** KPI terciárias | quanto se perde em cada etapa? | a tabela de degraus + `Taxa` com a fração colada — **este está inteiro** |
| **N4** KPI quaternárias | o que alimenta o topo, por canal? | **em lugar nenhum** — `cliques` do GSC é orgânico e não se declara como tal |
| **N5** KPI quinárias | por que o volume é esse? | só a **sigla** da família (`familiaDoBuraco`), nenhum medidor |
| **N6** Execução | o que eu faço segunda? | o campo `acao` do card, na `/agenda`, **sem citar que célula ele move** |

A 010 acrescentou a projeção invertida — meta ÷ cadeia = fator obrigatório — e ela também mora
dentro do card. O card ficou sendo a unidade de tudo: veredito, cadeia, projeção. E o card não
comporta mais nada.

### Por que isto não cabe na `/okr` e não é para caber

A `/okr` responde **"qual dos 40 projetos merece o dia"**. É uma tela de comparação: 17 cards com
veredito, 23 recolhidos no `<details>`, ordenados por posição de ataque. O comentário no próprio
`app/okr/page.tsx` registra a medição que produziu esse formato: 23 cards repetiam o mesmo texto e
ocupavam 2288px de rolagem a 1440px.

Quatro níveis a mais **por card** multiplicam essa rolagem pelos 17 com perfil, e o preço é pago
pela tela que hoje funciona. São dois trabalhos diferentes:

- **`/okr`** — comparar. Fica como está.
- **`/okr/<projeto>`** — descer a árvore de UM projeto até o medidor. Tela nova.

### A armadilha desta feature: uma página com sete títulos pede sete respostas

N4 e N5 são exatamente os níveis **sem coletor** no hub. Uma tela com os sete cabeçalhos escritos
convida a preencher os sete, e o jeito mais fácil de preencher N4 é chamar `cliques` de "tráfego
total" — o que transformaria um número de **um canal** no número de **todos**. Foi assim que a
`amostra procurada fora do percentual` e o `(hoje N)` do corpus entraram: um rótulo genérico por
cima de uma medição estreita.

A defesa é a mesma da 009 e da 010, e vira o eixo desta spec: **a tela renderiza o ESTADO do nível,
não o valor dele.** Três estados, sempre nomeados, nunca dois:

| Estado | O que é | O que aparece |
|---|---|---|
| **apurado** | lido de uma fonte que o hub JÁ lê | o número **e a fonte** |
| **declarado** | escrito à mão no card por um humano | o valor, o rótulo `declarado` **e a data da declaração** |
| **não apurado** | não há de onde ler | o **motivo** e a **fonte a consultar** — nunca `0`, nunca `100%` |

Uma célula cujo insumo inclui uma declaração **herda o rótulo `declarado`**. `0 tratamentos ×
R$ 4.000 declarados = R$ 0` é uma conta correta e um número **declarado**, não apurado — e chamá-lo
de apurado seria a R1 caindo por dentro, com a aritmética certa.

### O que a ficha da `atma` diz hoje, e por que ela é o primeiro caso

`535 cliques → 39 leads (7,29%) → 0 tratamentos`, perfil D, meta declarada de R$ 50.000 com ticket
de R$ 4.000 até 31/12. É a **única cadeia com dois degraus apurados** do portfólio.

Descendo a árvore dela, o que a ficha produz não é uma tela cheia — é uma lista curta de trabalho:

- **N2** tem quatro fatores (`Leads × CR(lead→consulta) × CR(consulta→tratamento) × Valor do
  tratamento`). Um apurado (39), um declarado (R$ 4.000, via 010) e **dois não apurados**. A conta
  **não fecha**, e o que falta tem nome.
- **N4** tem um canal apurado (orgânico, 535 do Search Console) e cinco não apurados. E a linha que
  importa: a entrada da cadeia de N3 **é só o orgânico**, então lead vindo de WhatsApp, indicação ou
  direto entra no numerador sem entrar em denominador nenhum. A `/okr` já diz isso em prosa no
  rodapé; aqui vira uma linha com nome e estado.
- **N5** desce em **uma** família só — a do gargalo — e o resto **não aparece**. Quatro famílias
  lado a lado é dashboard, e dashboard é o que esta árvore existe para não ser.
- **N6** mostra os itens da agenda daquele projeto — os mesmos da `/agenda`, com o dono que já vem
  da tabela de donos — e mostra que **nenhum deles declara qual célula move**. Esse buraco é o
  entregável, não um defeito da tela.

### ⚠️ A ficha em produção não é a ficha da sua máquina

`ATMA_DATABASE_URL` não está no EasyPanel. Sem ela, `lerFontePropria('atma')` devolve erro e a
célula de leads sai `não apurado`, o que move a **âncora** da 010 de `lead = 39` para
`visitante = 535` e muda a projeção inteira. Os `7,29%` deste documento existem onde a env existe.

Isso não é um detalhe de infra: é o critério de conferência. **Toda leitura desta feature se confere
no HTML servido pelo EasyPanel, nunca no `next dev` local** — a primeira corrida de um check mede o
check, não o negócio.

### O que esta feature NÃO é

- **Não é instrumentação.** Nenhum coletor novo é escrito. Os degraus sem fonte continuam sendo os
  que a 009 já nomeia; a ficha só passa a dizer, por nível, **o que consultar**.
- **Não é dashboard.** Não há gráfico, não há série temporal, não há comparação com período
  anterior. A árvore aponta trabalho; histórico é outra tela.
- **Não mexe na `/okr`.** O veredito, a ordem, a tabela de degraus e o bloco de projeção da 010
  ficam idênticos.
- **Não projeta.** A R6 continua valendo inteira: nada aqui deriva meta de benchmark, média do
  portfólio ou histórico do próprio projeto.

## Clarifications

### Session 2026-09-01

- Q: "Mantenha a página da OKR como está" — a FR-006 (link do card para a ficha) fica ou cai? → A:
  Fica. O nome do projeto no card vira o link, e essa é a **única** mudança permitida na `/okr`.
- Q: Um KR pode apostar em célula fora da cadeia N3 (canal de N4, medidor de N5)? → A: Sim —
  qualquer célula nomeada da árvore, com o nível no prefixo da chave (`n3:`, `n4:`, `n5:`).
- Q: N6 sai da agenda do projeto ou só da `acao` do card? → A: Da **agenda**, filtrada pelo slug,
  pela mesma `lib/agenda.mjs` que a `/agenda` usa — com o dono que já vem de `hub_acao_dono`.
- Q: N5 liga os medidores que `/seo` e `/infra` já leem? → A: **Não.** Só o que o contrato de
  projetos e a série do GSC já entregam nesta requisição; o resto sai `não apurado` com a fonte.
- Q: Decompor os fatores de N2 dos 4 perfis agora, ou só o D? → A: **Só o D.** A, B e C saem
  `não apurado: fatores do perfil ainda não declarados` — motivo declarado, não célula vazia.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Abrir a ficha de um projeto pelo menu (Priority: P1)

Jean clica na aba **OKR**, que se abre num menu com **Portfólio** e os projetos que têm ficha
curada. Clica em **Atma** e cai em `/okr/atma`, a árvore N0-N6 daquele projeto só.

**Why this priority**: sem alcance, a ficha não existe. E é a metade do pedido que o usuário
descreveu primeiro.

**Independent Test**: a partir de qualquer uma das 13 abas, alcançar `/okr` em um clique (como hoje)
e `/okr/atma` em dois, com teclado só.

**Acceptance Scenarios**:

1. **Given** Jean em qualquer página do hub, **When** ele aciona a aba OKR, **Then** o menu abre
   listando `Portfólio` e cada projeto com ficha curada, **e** `/okr` continua alcançável em **um**
   clique — um menu que engole o próprio destino é regressão de navegação, não recurso.
2. **Given** Jean em `/okr/atma`, **When** a página carrega, **Then** o menu já está **aberto** e
   `Atma` está marcada como página atual, sem ele precisar reabrir a cada navegação.
3. **Given** Jean navegando só pelo teclado, **When** ele tabula a partir do topo, **Then** o
   primeiro alvo continua sendo o link "Pular para o conteúdo", o controle do menu recebe foco
   visível, abre por Enter ou Espaço, e os sublinks são alcançáveis na ordem em que aparecem.
4. **Given** nenhum projeto com ficha curada no `data/projects.json`, **When** a barra é
   renderizada, **Then** a aba OKR continua sendo um link simples — um menu cujo único item é a
   página onde você já está é ruído.

---

### User Story 2 - Ler a árvore inteira de um projeto e sair com trabalho nomeado (Priority: P1)

Jean abre `/okr/atma` e lê os sete níveis em ordem. Cada nível traz seu estado; cada `não apurado`
traz a fonte a consultar. Ele fecha a página sabendo **qual medição falta**, não quantos KPIs
existem.

**Why this priority**: é o pedido inteiro. "Granularização de microindicadores" só vale se o
microindicador ausente for tão visível quanto o presente.

**Independent Test**: numa ficha com meta, perfil e dois degraus apurados, conferir à mão que cada
um dos sete níveis exibe estado e fonte, e que nenhum número aparece sem uma das duas.

**Acceptance Scenarios**:

1. **Given** um projeto com perfil declarado, **When** a ficha renderiza, **Then** os **sete**
   níveis N0-N6 aparecem, na ordem, **inclusive os vazios** — o nível ausente some da tela é o que
   faz uma árvore de três níveis parecer completa.
2. **Given** o nível N2 do perfil D, **When** ele renderiza, **Then** cada fator da conta sai como
   linha própria com seu estado, e o veredito da conta é **"não fecha"** com os fatores faltantes
   nomeados — nunca um "✓ fecha" derivado de fatores não apurados.
3. **Given** uma célula calculada a partir da meta ou do ticket declarados, **When** ela renderiza,
   **Then** ela sai rotulada **declarado** com a data da declaração, e **nunca** como apurada.
4. **Given** um nível cujo valor não pode ser lido, **When** ele renderiza, **Then** sai
   `não apurado` com o motivo **e** a fonte a consultar, e a página **não** exibe `0`, `100%`, `—`
   nem célula em branco no lugar.
5. **Given** a ficha inteira, **When** Jean procura de onde veio um número, **Then** todo número
   apurado tem a fonte escrita ao lado dele, na mesma linha.

---

### User Story 3 - Descer só na família do gargalo (Priority: P2)

Em N5, a ficha mostra os medidores de **uma** família de diagnóstico — a que o veredito da 009
apontou — e não mostra as outras três.

**Why this priority**: é a regra §5 do template ("só desça na família do gargalo") virando
comportamento. Sem ela, N5 vira um painel de 16 medidores dos quais 15 não importam hoje, e a tela
volta a ser o dashboard que a árvore substitui.

**Independent Test**: dois projetos com gargalos de famílias diferentes exibem conjuntos de
medidores diferentes, e nenhum dos dois exibe as quatro famílias.

**Acceptance Scenarios**:

1. **Given** um projeto cujo veredito aponta um buraco de família D4, **When** N5 renderiza,
   **Then** aparecem os medidores de encanamento e **só** eles, com a família nomeada e o motivo de
   ela ter sido escolhida.
2. **Given** um projeto com a cadeia fechada (posição §7.3), **When** N5 renderiza, **Then** a
   família é a do degrau de **menor taxa**, não a de um `não apurado` que não existe.
3. **Given** um medidor da família escolhida sem coletor no hub, **When** ele renderiza, **Then**
   sai `não apurado` nomeando onde consultar — e **não** é omitido da lista: o medidor que falta é o
   trabalho.
4. **Given** a posição média do Search Console como medidor de D1, **When** ela renderiza sem corte
   por país, **Then** sai `não apurado: posição média sem corte por país mistura branded com
   genérico` — o número existe na API e exibi-lo cru já produziu leitura errada antes.

---

### User Story 4 - Declarar objetivo e Key Results, e descobrir quais deles não são verificáveis (Priority: P2)

Jean escreve no card o objetivo (N0) e até três KRs, cada um citando a célula da cadeia que move e
seu dono. A ficha mostra cada KR e marca os que apostam numa célula **não apurada**.

**Why this priority**: um KR sobre célula que ninguém mede não é meta, é intenção — e a §7 diz que
apurar vem antes de melhorar. Marcar isso é o que impede um trimestre inteiro de perseguir um
número que não se lê.

**Independent Test**: declarar dois KRs, um sobre célula apurada e outro sobre célula não apurada, e
conferir que só o segundo sai marcado como não verificável.

**Acceptance Scenarios**:

1. **Given** um card com `objetivo` declarado, **When** N0 renderiza, **Then** a frase aparece
   rotulada **declarada** com a data, e sem número — objetivo com número dentro é N1 disfarçado.
2. **Given** um KR que cita uma célula **não apurada**, **When** ele renderiza, **Then** sai marcado
   `sem baseline apurado — não é verificável; o trabalho é apurar a célula, não perseguir o número`.
3. **Given** um KR **sem dono**, **When** ele renderiza, **Then** sai marcado `sem dono — sem dono
   não é KR, é observação`, e continua visível em vez de sumir.
4. **Given** um KR que cita uma chave **inexistente no nível que o prefixo declara** (`n3:`, `n4:`
   ou `n5:`), **When** ele renderiza, **Then** sai como **erro de declaração** nomeando a chave
   inválida — e a página não casa com a célula mais parecida, não procura a chave nos outros níveis
   e não ignora em silêncio.
5. **Given** um card com mais de três KRs declarados, **When** eles renderizam, **Then** a ficha
   exibe todos e marca o excedente — o teto de 3 é do template e cortar em silêncio esconderia a
   declaração do humano.

---

### User Story 5 - Ver que nenhuma ação da semana diz que célula move (Priority: P3)

Em N6, a ficha mostra os itens da agenda daquele projeto — os mesmos da `/agenda`, filtrados pelo
slug — cada um com dono, data, e a coluna "célula que move" saindo `não declarada`.

**Why this priority**: é a lacuna mais barata de mostrar e a mais cara de deixar invisível. Ação que
não move célula não entra no plano — e hoje **nenhuma** declara qual move. A ficha é onde isso fica
óbvio, porque é a única tela que põe a ação ao lado das células que existem.

**Independent Test**: a ficha de um projeto com itens na agenda exibe os mesmos itens que a
`/agenda` exibe para aquele projeto, com dono, data e `célula que move: não declarada`.

**Acceptance Scenarios**:

1. **Given** um projeto com itens na agenda, **When** N6 renderiza, **Then** aparecem os mesmos
   itens que a `/agenda` filtrada por aquele projeto mostra — conferível abrindo as duas telas — e
   nenhum item extra, inventado ou reagrupado.
2. **Given** um item **sem** dono na tabela de donos, **When** ele renderiza, **Then** sai
   `sem dono` — herdando a regra da 008, e sem inventar um nem herdar o dono de outro item.
3. **Given** o texto de um item mencionando literalmente o nome de um degrau, **When** N6 renderiza,
   **Then** a célula movida **continua** `não declarada` — casar ação com célula por busca de
   palavra no texto é proibido; medir a palavra em vez do fato já produziu 18 cards onde havia 5.
4. **Given** a fonte da agenda indisponível, **When** N6 renderiza, **Then** sai `não apurado` com o
   motivo, e **não** como um projeto sem ações pendentes.
5. **Given** um item da agenda antigo, **When** ele renderiza, **Then** a data aparece ao lado —
   premissa de card apodrece, e um plano de três meses atrás parece igual a um de hoje.

---

### Edge Cases

- **Slug inexistente** em `/okr/<slug>`: **404**. Uma ficha em branco com sete cabeçalhos vazios
  para um projeto que não existe é indistinguível de um projeto real sem dados.
- **Projeto sem perfil declarado** (23 dos 40): a ficha abre com os sete níveis presentes, e de N1 a
  N5 todos saem `não apurado: sem perfil declarado — fora da árvore até alguém escolher a cadeia`.
  **Nenhum** número aparece nesses níveis. N0 e N6 continuam válidos, porque objetivo e ação não
  dependem da cadeia. Cadeia errada é pior que cadeia ausente porque parece medida.
- **Projeto com perfil e sem meta**: N1 em contagem é apurado (é o último degrau), N1 em R$ sai
  `não apurado: sem ticket declarado`, e o bloco de projeção da 010 sai `sem meta declarada`. A
  ficha não fica menos válida por isso.
- **`ATMA_DATABASE_URL` ausente** (o estado de produção hoje): a célula de leads inteira vira
  `não apurado`, N2 perde o fator `Leads`, N3 perde uma taxa e a âncora da 010 recua para
  `visitante`. **Nada** disso pode virar `0` — banco fora produz o melhor placar possível a partir
  do pior estado possível.
- **Fator de N2 que cobre mais de um degrau de N3**: `CR(lead→consulta)` do perfil D atravessa
  `lead → contatado → agendada → compareceu`. Se qualquer degrau do trecho for `não apurado`, o
  fator inteiro é `não apurado` — não a taxa do pedaço que por acaso tem número.
- **Cobertura de N2 com buraco no meio ou sobreposição**: é **erro de definição do perfil**, e a
  ficha diz isso — não é célula vazia. Duas exclusões, ambas por definição: fator **de valor**
  (ticket, AOV, churn) não atravessa degrau nenhum e não entra na conferência; e os degraus **acima**
  do primeiro fator são a entrada da cadeia, respondida por N4, não um buraco de N2.
- **Canal de N4 sem cadeia abaixo**: aparece marcado `sem elo`. Volume sem cadeia é vaidade, e
  somar canais para exibir um "total" seria criar o número que não existe.
- **Soma dos canais de N4 ≠ entrada de N3**: é o caso normal hoje (só o orgânico é medido). A ficha
  declara a diferença como `não apurado`, e **não** fecha a conta atribuindo o resto a "direto".
- **Projeto com perfil, meta e cadeia inteira fechada**: N5 desce na família do degrau de menor
  taxa; o `não apurado` que normalmente escolhe a família não existe nesse ramo.
- **Ficha curada para um projeto que depois perde o perfil**: o objetivo e os KRs continuam sendo
  exibidos como declarados, e a validação dos KRs contra a cadeia sai `não apurado: sem cadeia para
  validar a célula` — a declaração do humano não é apagada por causa de um campo removido.
- **Projeto de perfil A, B ou C**: N2 sai inteiro como `não apurado: fatores do perfil ainda não
  declarados`. N1, N3, N4, N5 e N6 continuam funcionando normalmente — a cadeia existe, só a
  decomposição da conta é que não. Um nível não apurado não derruba os outros seis.
- **Projeto sem nenhum item na agenda**: N6 sai `sem ação declarada para este projeto`, que é
  diferente de `não apurado` (fonte fora) e diferente de `0`. As três leituras pedem trabalho
  diferente e não podem compartilhar texto.
- **390px**: o menu aberto quebra em linhas; nem a barra nem a faixa do menu rolam a página para o
  lado.

## Requirements *(mandatory)*

### Functional Requirements

#### Navegação

- **FR-001**: A aba OKR DEVE virar um controle de expandir/recolher que revela `Portfólio` (`/okr`)
  e um item por projeto com ficha curada. As outras 12 abas NÃO mudam.
- **FR-002**: `/okr` DEVE continuar alcançável em **um** acionamento a partir de qualquer página. O
  menu acrescenta destinos; não pode custar o que já existia.
- **FR-003**: O menu DEVE nascer **aberto** e com o item correspondente marcado como página atual
  quando a rota ativa for `/okr` ou `/okr/<slug>`, sem exigir reabertura a cada navegação.
- **FR-004**: O menu DEVE funcionar sem JavaScript no cliente e ser operável só por teclado, com
  foco visível, abertura por Enter/Espaço e ordem de foco igual à ordem visual. O link "Pular para o
  conteúdo" DEVE continuar sendo o primeiro alvo tabulável da página.
- **FR-005**: Com **zero** projetos de ficha curada, a aba OKR DEVE permanecer um link simples, sem
  controle de expansão.
- **FR-006**: Na `/okr`, o **nome do projeto** de cada card **com perfil declarado** DEVE levar à
  ficha daquele projeto. É a única mudança permitida na `/okr` (FR-032): layout, ordem, veredito,
  tabela de degraus e bloco de projeção ficam idênticos, e o nome continua sendo o mesmo título de
  seção que já é hoje. Card **sem** perfil não ganha caminho — não há ficha a oferecer.

  Sem isto, os 16 projetos com perfil e sem ficha curada só seriam alcançáveis digitando a URL,
  porque o menu lista apenas os curados (FR-001).

#### A ficha

- **FR-007**: DEVE existir uma rota de ficha por projeto, **genérica**, endereçada pelo `slug` do
  card. Slug desconhecido DEVE responder **404**, nunca uma ficha vazia.
- **FR-008**: A ficha DEVE renderizar os **sete** níveis N0-N6 em ordem, sempre — inclusive os que
  saem inteiros como `não apurado`. Omitir nível vazio é proibido.
- **FR-009**: Toda célula da ficha DEVE sair em exatamente um de três estados: **apurado** (com a
  fonte escrita ao lado), **declarado** (com a data da declaração) ou **não apurado** (com o motivo
  e a fonte a consultar). Célula em branco, `0` de preguiça, `—` e `100%` de arredondamento são
  proibidos.
- **FR-010**: Célula cujo cálculo consome qualquer insumo **declarado** DEVE herdar o rótulo
  `declarado`. Nenhuma célula com insumo declarado sai como apurada, por mais correta que seja a
  aritmética.
- **FR-011**: Toda razão exibida na ficha DEVE trazer a fração colada no mesmo texto (R2), sem
  exceção — a mesma régua da 009 e da 010.
- **FR-012**: A ficha DEVE usar a **mesma janela** da 009/010 (R7: 28 dias fechando em D-3) e
  declará-la na tela. Duas janelas na mesma árvore é uma taxa inventada.

#### N0 e Key Results (declarações)

- **FR-013**: O card DEVE aceitar um campo de ficha opcional com `objetivo` (uma frase), `krs` (até
  três, cada um com KPI, baseline, meta, prazo, **dono** e a **chave da célula** que move) e a data
  da declaração — curado à mão em `data/projects.json`, como `perfil`, `estado` e `meta` já são. NÃO
  há objetivo nem KR inferido, herdado ou padrão.

  A chave da célula PODE apontar para um degrau de **N3**, um canal de **N4** ou um medidor de
  **N5**, e DEVE trazer o nível no prefixo (`n3:`, `n4:`, `n5:`) para que a validação da FR-017 não
  dependa de os nomes serem únicos entre níveis. Restringir o KR a N3 proibiria KR justamente nos
  seis projetos com `visitante = 0`, onde nenhuma etapa da cadeia se move enquanto ninguém chega e
  o único trabalho é D1 — o contrário do que a §7 manda.
- **FR-014**: N0 e os KRs DEVEM ser rotulados como **declarados** em toda exibição, com a data.
- **FR-015**: A ficha DEVE marcar como **não verificável** todo KR cuja célula citada esteja
  `não apurada`, dizendo que o trabalho é apurar a célula.
- **FR-016**: KR sem dono DEVE ser marcado, e continuar visível. Dono NÃO PODE ser inferido,
  herdado do `responsavel` da ação nem preenchido por padrão.
- **FR-017**: KR que cite uma **chave de célula inexistente** no nível que o prefixo declara DEVE
  sair como erro de declaração nomeando a chave. É proibido casar por nome parecido, por
  aproximação ou por posição, e é proibido procurar a chave nos outros níveis quando ela falta no
  declarado — rótulo de exibição nunca é chave, e um casamento "quase certo" é o modo de falhar em
  silêncio que esta feature inteira existe para não ter.
- **FR-018**: KRs acima de três DEVEM ser exibidos e marcados como excedentes, nunca truncados em
  silêncio.

#### N2 — os fatores da receita

- **FR-019**: Cada perfil DEVE declarar seus fatores de N2, e cada fator DEVE ser de um de dois
  tipos: **fator de cadeia**, que declara **quais degraus de N3 ele cobre** por chave, ou **fator de
  valor**, que não é taxa da cadeia (ticket, AOV, ARPA, churn, devolução) e declara a **própria
  fonte**. Fator sem tipo ou sem cobertura/fonte declarada sai `não apurado`.

  A distinção não é burocracia: `Receita = Sessões × CR(sessão→pedido) × AOV × (1 − devolução)` tem
  dois fatores que atravessam degraus e dois que não atravessam nenhum. Uma régua só para os quatro
  acusaria "erro de definição" em três dos quatro perfis e o aviso viraria ruído permanente.
- **FR-019a**: Nesta feature **apenas o perfil D** declara seus fatores. Perfil cujos fatores ainda
  não foram declarados DEVE sair `não apurado: fatores do perfil ainda não declarados` — motivo
  declarado, portanto dentro da FR-009, e nunca um nível N2 vazio sem explicação.

  Declarar A, B e C exige antes reconciliar as fórmulas de N2 do template com as cadeias de N3 dele:
  o perfil B nomeia `Sessões` como denominador e a cadeia começa em `visitante` (cliques do Search
  Console), que é outra coisa; o C começa em `Propostas`, no meio da própria cadeia. Isso é decisão
  sobre o `handoff/okr-kpi-template.md`, não sobre esta tela, e não entra numa feature de interface.
- **FR-020**: Um fator de cadeia DEVE ser `não apurado` quando **qualquer** degrau do trecho que ele
  cobre estiver `não apurado`. Taxa do pedaço medido NÃO PODE ser exibida como se fosse a do fator.
- **FR-021**: A ficha DEVE conferir que as coberturas dos **fatores de cadeia** são **contíguas** e
  **terminam no N1**, e exibir buraco no meio ou sobreposição como **erro de definição do perfil**.
  Fatores de valor ficam fora dessa conferência por definição.

  Os degraus **acima** do primeiro fator NÃO são buraco: são a **entrada**, e quem responde por eles
  é N4. Nos quatro perfis do template a conta de N2 começa num volume do meio da cadeia
  (`Clientes pagantes`, `Sessões`, `Propostas`, `Leads`) e o topo fica de fora de propósito — exigir
  cobertura da cadeia inteira acusaria "erro de definição" nos quatro perfis, e um alerta que sempre
  aparece deixa de ser lido.
- **FR-022**: O veredito "a conta fecha?" DEVE sair `não apurado` sempre que qualquer fator estiver
  não apurado, e nomear os fatores que faltam. Um "fecha" derivado de fatores ausentes é proibido.

#### N4 — volume por canal

- **FR-023**: N4 DEVE listar os canais do template (orgânico, direto, pago, indicação, outbound,
  social), cada um com seu estado. O canal medido pelo Search Console DEVE ser rotulado
  **orgânico**, nunca "tráfego" ou "visitantes".
- **FR-024**: A ficha NÃO PODE somar canais para exibir um total, nem atribuir a diferença entre a
  soma medida e a entrada da cadeia a qualquer canal. A diferença sai `não apurado`.
- **FR-025**: Canal sem cadeia abaixo dele DEVE sair marcado `sem elo`.

#### N5 — diagnóstico

- **FR-026**: N5 DEVE exibir os medidores de **uma** família — a do gargalo apontado pelo veredito
  da 009 — e NÃO PODE exibir as outras três.
- **FR-027**: A ficha DEVE nomear a família escolhida **e o motivo** de ela ter sido escolhida
  (qual célula, qual `não apurado`, ou qual menor taxa).
- **FR-028**: Um medidor de N5 só PODE exibir número quando ele já vem do contrato de projetos ou
  da série do GSC que a própria requisição da ficha carrega. Todo o resto DEVE aparecer na lista
  como `não apurado` com a fonte a consultar — omitir o medidor que falta esconderia o trabalho.

  Puxar `indexacao`, `health` ou `seo-score` para cá é proibido nesta feature, e o motivo não é
  escopo: cada um tem janela própria (Crawl Stats é média de 90 dias, health é pontual) e exibi-los
  na árvore de 28 dias seria a segunda janela que a FR-012 proíbe. Ligá-los exige decidir o corte de
  cada um, e isso é feature própria.
- **FR-029**: A posição média do Search Console **sem corte por país** DEVE sair `não apurado` com o
  motivo, nunca como número.

#### N6 — execução

- **FR-030**: N6 DEVE exibir os itens da **agenda daquele projeto**, pela mesma projeção que a
  `/agenda` usa, filtrados pelo slug — cada um com seu dono (que vem da tabela de donos, **não** do
  card) e com a célula movida como `não declarada`. Reimplementar a projeção da agenda é proibido:
  duas regras para a mesma lista divergem na primeira correção.
- **FR-030a**: Cada item de N6 DEVE exibir sua **data**, porque premissa de card de agenda apodrece
  e um plano de segunda-feira escrito há três meses parece igual a um escrito hoje.
- **FR-030b**: Com a fonte da agenda indisponível, N6 DEVE sair `não apurado` com o motivo. **Zero
  ações NÃO PODE** ser o resultado de banco fora — é o melhor plano possível produzido pelo pior
  estado possível.
- **FR-031**: A ficha NÃO PODE inferir qual célula uma ação move a partir do texto dela — nem por
  busca de palavra, nem por similaridade, nem por classificação. Ausência de declaração é
  `não declarada`, e é o achado.

#### Restrições de arquitetura

- **FR-032**: A `/okr` DEVE continuar entregando os mesmos 40 projetos, na mesma ordem, com as
  mesmas posições de ataque e o mesmo bloco de projeção da 010. A única mudança permitida nela é a
  da FR-006.
- **FR-033**: A montagem da ficha DEVE nascer em `.mjs` puro, testável por `node --test` sem subir o
  Next (Princípio III), importando `lib/funil.mjs`, `lib/okr.mjs` e `lib/projecao.mjs` sem
  reimplementar célula, razão, cadeia, veredito ou inversão.
- **FR-034**: O arquivo de teste novo DEVE ser registrado na lista de `npm test` do `package.json`
  **no mesmo commit** que o cria (Princípio II).
- **FR-035**: O campo de ficha DEVE entrar no contrato de `lib/projects.ts` (Princípio I). Nenhuma
  leitura de `data/projects.json` fora de `lib/projects.*`.
- **FR-036**: Nenhum coletor novo, nenhuma env nova e nenhuma escrita entram nesta feature. A ficha
  é leitura.

### Key Entities

- **Ficha declarada**: o que o humano escreve no card — `objetivo` (N0, uma frase sem número), até
  três `krs` (KPI, baseline, meta, prazo, dono, chave da célula que move) e a data da declaração.
  Entrada humana, rotulada como tal em toda exibição.
- **Nível**: um dos sete degraus da árvore (N0-N6). Tem título, pergunta, e um conjunto de células.
  Existe na tela mesmo quando está inteiramente `não apurado`.
- **Estado da célula**: `apurado` (com fonte), `declarado` (com data) ou `não apurado` (com motivo e
  fonte a consultar). Herança: insumo declarado contamina o resultado.
- **Fator de N2**: um termo da conta da receita do perfil, de um de dois tipos. **De cadeia**: traz
  a **cobertura**, a lista de degraus de N3 que atravessa — é ela que impede o fator de virar a taxa
  de um pedaço. **De valor**: não atravessa degrau nenhum (ticket, AOV, ARPA, churn, devolução) e
  traz a própria fonte.
- **Canal de N4**: uma origem de entrada nomeada, com volume e a marca `sem elo` quando não é
  denominador de nenhuma taxa de N3.
- **Medidor de N5**: um indicador da família do gargalo, com estado e fonte. A lista dos que faltam
  é o entregável do nível.
- **Item de N6**: um item da agenda daquele projeto, com seu dono (da tabela de donos), sua data, e
  a célula que ele move — hoje sempre `não declarada`, em todos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

Todas as leituras se conferem no **HTML servido em produção**, não no `next dev`.

- **SC-001**: `/okr` responde 200, lista os mesmos 40 projetos, na mesma ordem, com as mesmas
  posições de ataque e os mesmos blocos de projeção de antes da feature — diferença conferível por
  comparação do HTML servido, exceto pelo acréscimo da FR-006.
- **SC-002**: `/okr/atma` responde 200 e exibe os **sete** títulos N0-N6.
- **SC-003**: Zero números exibidos na ficha sem uma fonte escrita ao lado ou o rótulo `declarado`
  com data — conferível por varredura do HTML.
- **SC-004**: Zero células em branco, zero `—` e zero `0` onde a resposta é "não olhei", em qualquer
  ficha do portfólio.
- **SC-005**: Nenhuma ficha exibe medidores de mais de uma família de N5.
- **SC-006**: Na ficha da `atma`, o veredito de N2 é "não fecha", com os fatores faltantes nomeados,
  e o fator `Valor do tratamento` sai rotulado **declarado**.
- **SC-007**: Um fator de N2 cujo trecho contém um degrau não apurado sai `não apurado`, mesmo
  quando o trecho tem degraus apurados — conferível por teste.
- **SC-008**: N4 da `atma` mostra o orgânico apurado e os outros cinco canais `não apurados`, e não
  exibe soma nem total.
- **SC-009**: Um KR sobre célula não apurada sai marcado como não verificável; um KR sobre célula
  apurada, não. Conferível por teste com as duas declarações lado a lado.
- **SC-010**: Um KR citando chave inexistente produz erro de declaração nomeando a chave, e **zero**
  células são casadas por aproximação.
- **SC-011**: `/okr/<slug inexistente>` responde **404**.
- **SC-012**: `/okr/<slug sem perfil>` responde 200, diz "sem perfil declarado" e exibe **zero**
  números nos níveis N2 a N5.
- **SC-013**: A partir de qualquer aba, `/okr` é alcançável em um acionamento e `/okr/atma` em dois,
  usando **só** o teclado, com o link "Pular para o conteúdo" ainda como primeiro alvo.
- **SC-014**: Em 390px de largura, nem a barra de abas nem o menu aberto provocam rolagem horizontal
  da página.
- **SC-015**: Remover a env da fonte própria da `atma` muda a ficha para `não apurado` nos níveis
  afetados e **não** produz nenhum `0` novo — conferível comparando as duas leituras.
- **SC-016**: `npm test` verde, com o arquivo de teste novo presente na lista do `package.json` e a
  suíte continuando abaixo de ~2s.
- **SC-017**: Nas fichas de perfil A, B e C, N2 sai com o motivo declarado — zero números, zero
  células vazias — e os outros seis níveis continuam renderizando normalmente.
- **SC-018**: Os itens de N6 na ficha de um projeto são exatamente os que a `/agenda` filtrada por
  aquele projeto mostra, com os mesmos donos — conferível abrindo as duas telas lado a lado.
- **SC-019**: Zero números em N5 provenientes de `/seo` ou `/infra`. A ficha carrega uma janela só,
  a da FR-012, e ela aparece escrita na tela.
- **SC-020**: Um KR com chave `n4:` ou `n5:` válida é aceito e validado; o mesmo KR com a chave
  trocada para um nível onde ela não existe vira erro de declaração, sem casamento por aproximação.

## Assumptions

- **"Mantenha a página da OKR como está"** foi esclarecido em 01/09/2026: significa *não redesenhar
  e não reordenar*, e **não** proíbe o caminho para a ficha. A FR-006 é a interpretação mínima — o
  título que já existe no card vira o link — e é a única exceção da SC-001. Descartadas: (a) `/okr`
  byte-idêntica com o menu listando os 17 com perfil, que põe 17 nomes na faixa de navegação e vira
  4-5 linhas em 390px; (b) `/okr` byte-idêntica com menu só de curados, que deixaria 16 projetos sem
  nenhum caminho na interface.
- O menu lista **quem tem ficha curada**, não os 17 com perfil. Hoje é um item (`atma`). O menu
  cresce por curadoria no JSON, não por código.
- A ficha nasce **genérica** por `slug`. Os 16 projetos com perfil e sem curadoria abrem a mesma
  página com os níveis declarados em `não apurado` — que é o resultado correto, não um defeito.
- A lista de canais de N4 e a de medidores de N5 vêm do template (§3-N4 e §5), fixas, e **não** são
  declaradas por projeto. Declarar canais por projeto seria uma segunda régua para o mesmo número.
- Os fatores de N2 e suas coberturas são declarados **por perfil**, junto da cadeia que já existe —
  não por projeto. Quatro perfis, quatro contas; instância por projeto seria a mesma regra escrita
  35 vezes. Decidido em 01/09/2026: **só o perfil D** é declarado nesta feature (FR-019a), e os
  outros três aguardam a reconciliação das fórmulas de N2 do template com as cadeias de N3.
- Nenhuma instrumentação nova, e nenhuma fonte existente puxada de outra tela. Decidido em
  01/09/2026: os medidores de N5 e os canais de N4 sem coletor continuam `não apurados`. Ligar D1
  (indexação, cobertura) e D2 (LCP, uptime) a partir do que o hub já lê em `/seo` e `/infra` foi
  **descartado nesta feature** — não por escopo, mas porque cada fonte tem janela própria e usá-las
  aqui criaria a segunda janela que a FR-012 proíbe. É feature própria, e começa por decidir a
  janela e o corte por país de cada medidor.
- A janela continua sendo a da 009/010 (R7). Trocá-la é decisão de leitura, não de código.
- A página é leitura. Nada nela edita card, banco ou ação.
- A `atma` é o primeiro caso porque é a única cadeia com dois degraus apurados. Isso é uma
  propriedade do portfólio hoje, não uma preferência — e é o que faz a ficha dela produzir uma lista
  de trabalho em vez de uma tela de `não apurado`.
