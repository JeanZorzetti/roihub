# Feature Specification: Crescimento Não-Marca medido no board, e o `null` que não diz a causa

**Feature Branch**: `036-crescimento-nao-marca-medido`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "Cadê o 'Medido'?" — apontando para a folha `4. KPI de Escala:
Crescimento de Impressões Não-Marca (Non-Branded)` em `/gsc/mapa`, que exibe `Fórmula` e `Meta` e
nenhum número, ao lado da folha vizinha que exibe `Medido: 344 consultas`.

## O fato que abre esta spec

`/gsc/mapa` transcreve o board. **Duas** das 32 folhas trazem o nó `Medido:`, e cada uma foi ligada à
mão pela sua própria feature: `penetracaoTop3` (034, `page.tsx:230-272`) e `strikingDistance` (035,
`page.tsx:274-322`). Não existe caminho genérico "folha com coletor → publica número".

`crescimentoNaoMarca` tem coletor declarado desde a 025 — `lib/gsc-delta.mjs:139` aponta para
`lib/marca.mjs#crescimentoNaoMarca` — e **nenhum número no mapa**. Ela não está entre as 6 sem
coletor (`checklistGsc`, `reescritaTitulo`, `rejeicaoRastreio`, `coberturaSemantica`,
`referringDomains`, `tamBusca`). O selo `◇ sem fonte` que ela carrega diz outra coisa: não há régua
de mercado publicada, os 5% a 10% são do board. Medido não é régua, e a folha pode ter o primeiro
sem ter o segundo — é o caso das outras 24 folhas com coletor.

O número existe, roda, e é publicado em `/okr/atma/aquisicao`. Só não sobe para a folha que o define.

### O que o coletor devolve hoje

`crescimentoNaoMarca(dias, "2026-09-20")` sobre os 250 dias gravados em `hub_gsc_dia` (11/01/2026 →
17/09/2026, hosts somados):

```json
{ "de": "2026-07", "para": "2026-08", "deImpressoes": 342, "paraImpressoes": 14689,
  "valor": 41.95, "diasZeroDe": 27, "diasDe": 31, "baseInterrompida": true }
```

## ⚠️ A armadilha que decide esta spec

Publicar `valor` como topo do nó escreve **`Medido: +4.195%`** embaixo de **`Meta: 5% a 10% ao mês`**.
São três defeitos empilhados, e os três já foram pagos uma vez nesta base.

**1. A base está interrompida, e o número mede a VOLTA.** Julho tem **27 dias de zero em 31** — a
desindexação de junho. O `43×` é a distância até o fundo de um mês quebrado, não ritmo de aquisição.
`lib/marca.mjs:221-227` já nomeia isso: *"quem compara os dois aprova um mês de retomada como se
fosse um mês bom, e a faixa do board passa a premiar justamente o site que quebrou antes."*

**2. Em pt-BR, `4195%` renderiza `"4.195%"`** — o separador de milhar é o ponto, e ao lado de
"5% a 10%" isso lê como 4,195%, **abaixo da faixa**, invertendo o veredito para quem bate o olho. A
025 já consertou isso uma vez com `variacao()`, que acima de 10× escreve `43×`. Só que `variacao()`
é **closure local dentro do componente** (`app/okr/[slug]/aquisicao/page.tsx:729`), não `lib/`: um
segundo consumidor que não a reescreva recria o defeito na outra tela. É o mesmo padrão que a 035
documentou — guarda escrita no chamador volta pela chamada seguinte.

**3. O nó do mapa é lido ISOLADO.** Clicar num nó abre o painel só dele. Uma ressalva que dependa do
nó pai, ou do parágrafo do cabeçalho, não chega ao leitor. A 033 já fixou essa regra para a janela
(FR-004 da 033); aqui ela vale para o estado da base.

E há um quarto fato que o KPI não vê por construção: a razão compara **meses fechados**, e hoje os
dois últimos são julho e agosto. Setembro corre a **223 impressões não-marca/dia** contra **474/dia**
de agosto — a próxima leitura válida (ago→set, disponível em 04/10) será de **≈ −54%**. A série
medida pelo mesmo módulo diz o resto: a última semana completa (07→13/09) vale **1.492** impressões
não-marca contra **17.020** da melhor da série (06→12/04), **8,8% do pico**, posição média de 2,8
para 8,3. Um nó que publique só `43×` publica a leitura mais otimista que o dado permite, no momento
em que ela é a mais falsa.

## O segundo defeito, que só aparece ao ligar a folha

`crescimentoNaoMarca` devolve `null` por **três** motivos diferentes — menos de dois meses fechados,
meses não consecutivos, e mês-base em zero (`marca.mjs:204-208`). Os três pedem trabalho **oposto**:
esperar o calendário, investigar um buraco na série, aceitar que não há base.

`/okr/atma/aquisicao:1761-1766` imprime **uma** frase para os três: *"ainda não há dois meses
fechados nesta janela"* — falsa em dois deles. Copiar essa frase para o mapa propagaria o erro para
a segunda tela; escrever uma frase nova só para o mapa faria as duas telas divergirem sobre o mesmo
`null`. O conserto é na função pura, onde os dois chamadores passam.

**A quarta ausência é a que a segunda tela não tem de graça.** "Marca não declarada" é nomeada em
`/okr/[slug]/aquisicao` por `marcaDeclarada()`, num parágrafo que envolve o bloco inteiro e separa
três motivos (`ausente`, `sem-termos`, `sem-pais`). O mapa não tem esse envelope: o nó é uma folha
solta, e sem o estado explícito ele cairia em "menos de dois meses fechados" — que é exatamente o
que acontece hoje com **33 dos 34 projetos** que têm série gravada e nenhum dia com
`impressoes_nao_marca` (medido em 20/09/2026: só a `atma` tem os 250 dias separados). Por isso o
estado entra também na função pura, com o mesmo discriminador que `completude()` já usa no mesmo
arquivo.

É a mesma família da FR-008 da 035 e dos quatro estados da 034: ausência que não diz a causa manda
consertar o problema errado.

## Clarifications

### Session 2026-09-20

- **Q: Com `baseInterrompida`, o que o nó escreve na linha de topo?**
  → **Os absolutos primeiro; a razão desce para a nota.** A linha de topo é o que o mapa exibe sem
  expandir, e é ela que um leitor apressado lê inteira. `14.689 contra 342 — base interrompida` é
  verdadeiro lido sozinho; `43×` não é. A forma da aba de aquisição (valor em destaque + selo) foi
  recusada **para este nó** porque lá o valor vive dentro de um bloco com quatro linhas de contexto
  em volta, e aqui vive sozinho. Recusar a razão por completo também foi recusado: o `43×` é
  informação real sobre a recuperação, e apagá-lo trocaria um número enganoso por um buraco.

- **Q: O nó carrega também a FORMA da série (`% do pico`), ou só a razão mensal?**
  → **Sim, na nota (US3 fica de pé).** A razão mensal é cega ao mês corrente por construção. Hoje
  ela diz `43×` enquanto setembro corre a 223 impressões/dia contra 474/dia de agosto (−53%) e a
  última semana completa vale 8,8% do pico. Publicar a razão sozinha nesta folha seria publicar a
  leitura mais otimista que o dado permite, exatamente no mês em que ela é a mais falsa.

- **Q: A folha gêmea `buscasDeMarca` (`razaoDeMarca`, 5,6% hoje) entra nesta feature?**
  → **Não. Só a folha 4.** É o escopo do pedido. A gêmea usa a mesma leitura de banco e custaria
  pouco, mas ela tem uma pergunta própria em aberto — a marca declarada da Atma ainda é `atma*` e o
  domínio virou `usealigner.com` em 11/09 —, e resolver isso dentro desta feature a faria crescer no
  meio. Vira 037 se valer.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - O número na folha do board (Priority: P1)

Quem abre `/gsc/mapa`, navega até `CLIQUE` → `4. KPI de Escala` e expande a folha precisa ver o
crescimento de impressões não-marca da Atma — com os dois meses nomeados, os absolutos, e o estado da
base. Hoje lê fórmula e meta, e nenhum número.

**Why this priority**: é o pedido. Sem ele a folha continua sendo definição pura, com coletor
declarado desde a 025 e nada na tela.

**Independent Test**: abrir a folha no mapa e na lista aninhada sem JavaScript; o nó `Medido:`
aparece nos dois, com os dois meses nomeados e os absolutos.

**Acceptance Scenarios**:

1. **Given** a série separada da Atma gravada em `hub_gsc_dia`, **When** a folha
   `crescimentoNaoMarca` é expandida, **Then** o **primeiro** filho traz a medida de jul→ago com os
   absolutos `342 → 14.689` e os dois meses nomeados.
2. **Given** que o mês-base tem 27 de 31 dias em zero, **When** o nó é renderizado, **Then** ele
   declara a base interrompida **na própria linha**, e não só no painel.
3. **Given** um nó lido isolado (clique direto, sem passar pelo pai), **When** o painel abre,
   **Then** ele declara de que meses o número é e por que a faixa do board não se aplica.
4. **Given** que a razão excede 10×, **When** o valor é formatado, **Then** ele sai como `43×` e
   nunca como `4.195%`.

---

### User Story 2 - A ausência que diz a causa (Priority: P2)

Quem abre a folha num projeto sem medida precisa ler **qual** ausência é — e não uma frase única que
serve para quatro situações com consertos opostos.

**Why this priority**: fica depois da US1 porque é o contrato que ela consome, e porque o conserto
vale para `/okr/[slug]/aquisicao`, que hoje publica a mesma frase para três causas e acerta em uma.

**Independent Test**: alimentar a função pura com as quatro formas de série e conferir que cada uma
devolve um motivo distinto; abrir a aba de aquisição de um projeto sem marca declarada e ler a
frase correta.

**Acceptance Scenarios**:

1. **Given** uma série com um só mês fechado, **When** a medida é pedida, **Then** o motivo é
   "menos de dois meses fechados" e a tela NUNCA publica `0%`.
2. **Given** uma série com buraco entre os dois últimos meses fechados, **When** a medida é pedida,
   **Then** o motivo é "meses não consecutivos" — não "faltam meses".
3. **Given** um mês-base com zero impressões não-marca, **When** a medida é pedida, **Then** o
   motivo é "sem base para a razão" — não "faltam meses".
4. **Given** uma série em que nenhum dia carrega a separação (33 dos 34 projetos hoje), **When** a
   medida é pedida, **Then** o estado é "marca não declarada" — nunca "faltam meses" —, e o nó do
   mapa aponta o campo do card.
5. **Given** a correção na função pura, **When** `/okr/[slug]/aquisicao` renderiza, **Then** ela
   passa a publicar a mesma causa — sem frase nova escrita só para ela.

---

### User Story 3 - A forma da série ao lado da razão (Priority: P3)

Quem lê `43×` na folha do board precisa ver, no mesmo nó, que a série está em 8,8% do pico. A razão
mensal é cega ao mês corrente e à forma dos oito meses; publicada sozinha ela aprova contra a meta
um site que está caindo.

**Why this priority**: depende da US1 e é a que impede o número de mentir por omissão. Fica em P3
porque a US1 com a ressalva da base já não mente — esta acrescenta o contexto que fecha a leitura.

**Independent Test**: conferir que o nó cita a última semana completa e o pico com as datas de cada
um, e que os dois saem do mesmo objeto que assina o `% do pico` de `/okr/atma/aquisicao`.

**Acceptance Scenarios**:

1. **Given** a série separada, **When** o nó é renderizado, **Then** a nota traz a última semana
   completa contra o pico, com as datas dos dois.
2. **Given** que as duas telas citam o mesmo pico, **When** os números são comparados, **Then** são
   idênticos — nenhuma delas deriva um pico próprio.

---

### Edge Cases

- **Mês corrente**: nunca entra. `mesesFechados` exige mês de calendário completo **mais 3 dias** —
  o GSC ainda sobe a ponta (30/07 da Atma saiu com 30 impressões e fechou em 827).
- **Janeiro/2026 tem 21 dias** (a série começa em 11/01): cai fora de `mesesFechados` pela regra do
  calendário, e não vira um mês-base pequeno que fabrica crescimento.
- **Razão negativa**: `−54%` é medida, não ausência, e sai com sinal. O selo de meta não se aplica
  do mesmo jeito que não se aplica a `43×`.
- **Banco fora do ar**: é falha transitória (`{erro}`), não ausência estrutural — consertos opostos,
  e o contrato de três estados da 030 já os separa.
- **Projeto sem série gravada**: os 34 projetos fora de `SLUGS_DE_BUSCA` não têm separação de marca.
  A folha é da Atma (premissa da 033); os outros não renderizam número nem `0`.
- **A semana que cruza a migração**: `ritmoNaoMarca` chama `semanasNaoMarca` **sem** os hosts
  declarados, então a semana 07→13/09 sai com `host: null` enquanto o gráfico da aba a desenha
  nomeada. Hoje é inerte (nada lê `ritmo.ultima.host`), e esta spec **não** o conserta — mas o nó
  novo não pode passar a depender desse campo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A folha `crescimentoNaoMarca` do board MUST exibir, como **primeiro** filho, um nó com
  a medida de crescimento de impressões não-marca da Atma.
- **FR-002**: O nó MUST nomear os **dois meses comparados** e trazer os **absolutos** dos dois. Uma
  razão sobre base pequena é ilegível sozinha.
- **FR-003**: Com `baseInterrompida`, a linha de topo do nó MUST liderar com os **absolutos** e com
  o estado da base (os dias em zero), e a razão MUST descer para a nota. A linha de topo é o que a
  tela exibe sem expandir, e ela precisa ser verdadeira lida sozinha.
- **FR-003b**: Sem `baseInterrompida`, a linha de topo MUST liderar com a razão, seguida dos dois
  meses e dos absolutos — é a leitura que a folha define, e ela só é honesta com base íntegra.
- **FR-004**: A formatação de razão acima de 10× MUST sair como `43×`, nunca como `4.195%`. A regra
  MUST morar em `lib/` e ser a **mesma** que `/okr/[slug]/aquisicao` usa — nunca reescrita no novo
  consumidor (Princípio III da constituição: lógica testável nasce em `.mjs`).
- **FR-005**: A medida MUST ler a série do **banco** (`hub_gsc_dia`), com **zero** requisição nova ao
  Search Console por render.
- **FR-006**: A função pura MUST distinguir as quatro ausências — marca não declarada, menos de dois
  meses fechados, meses não consecutivos, mês-base em zero — e NUNCA publicar `0`/`0%` em nenhuma
  delas. O discriminador MUST ser o mesmo campo `estado` que `completude()` já usa no mesmo módulo.
- **FR-007**: `/okr/[slug]/aquisicao` MUST passar a publicar a causa devolvida pela função pura, em
  vez da frase única atual — o conserto é no ponto por onde os dois chamadores passam. O parágrafo
  de marca não declarada que ela já publica por `marcaDeclarada()` MUST continuar como está: ele
  nomeia três motivos (`ausente`, `sem-termos`, `sem-pais`) que a série sozinha não distingue.
- **FR-008**: O nó NÃO PODE exibir glifo de veredito (`▼`/`▲`/`◐`) contra os 5% a 10%. É **meta do
  board**, `balizador.tipo` da folha é `recusa`, e a folha segue `◇ sem fonte`. Mesma regra da
  FR-009 da 034 e da 035.
- **FR-009**: Com `baseInterrompida`, o nó MUST declarar que a faixa do board **não se aplica** — a
  mesma palavra que a aba de aquisição já publica, para as duas telas não divergirem.
- **FR-010**: O nó MUST declarar a janela do KPI nos seus próprios termos (meses fechados), e o
  cabeçalho da página — que declara a janela de 28 dias das seis faixas de posição — NÃO PODE ser
  lido como se valesse para esta folha.
- **FR-011**: A lista aninhada sem JavaScript da mesma página MUST mostrar o mesmo nó e a mesma nota.
- **FR-012**: `MEDIDO_POR.crescimentoNaoMarca` MUST continuar apontando para o coletor que a tela
  efetivamente usa.
- **FR-013**: A nota MUST trazer a forma da série (última semana completa contra o pico, com datas),
  derivada do **mesmo** objeto que assina o `% do pico` de `/okr/atma/aquisicao`.
- **FR-014**: A suíte MUST reprovar se um nó de medida publicar a razão sem o estado da base — o
  defeito desta spec não pode voltar em silêncio pela próxima folha ligada.

### Key Entities

- **Crescimento não-marca**: `{ de, para, deImpressoes, paraImpressoes, valor, diasZeroDe, diasDe,
  baseInterrompida }` — os dois meses fechados consecutivos, a razão entre eles, e o que diz se a
  razão mede crescimento ou recuperação.
- **Ausência de medida**: o motivo nomeado, em quatro valores distintos, cada um com um conserto
  diferente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Quem abre a folha `4. KPI de Escala` no board lê o número sem sair da página e sem
  consultar outra tela.
- **SC-002**: Nenhuma das duas telas publica `4.195%`; as duas publicam `43×`, com a mesma regra
  vinda do mesmo módulo.
- **SC-003**: As quatro ausências produzem quatro frases distintas, e nenhuma delas renderiza `0` ou
  `0%`.
- **SC-004**: A página `/gsc/mapa` continua fazendo **duas** leituras ao Search Console por render —
  o mesmo número de antes desta feature.
- **SC-005**: O nó do board e o bloco de `/okr/atma/aquisicao` citam os **mesmos** dois meses, os
  mesmos absolutos e o mesmo pico. Divergência entre as duas telas sobre o mesmo KPI reprova.
- **SC-006**: Um leitor que veja só a linha de topo do nó não conclui que a Atma está acima da meta.

## Assumptions

- O board `okr-Saw2eoSKZDPLJAk6xeDBuS` é o board **da Atma**, e a folha mede a Atma — premissa já
  declarada por escrito pela 033 no cabeçalho da mesma página.
- Os dois hosts declarados (`usealigner.com` + `atma.roilabs.com.br`) continuam somados na série. A
  migração de 11/09/2026 não corta a série: `hub_gsc_dia` grava a soma, e `hostsDeclarados` faz os
  dois contarem como o mesmo site.
- A meta de 5% a 10% continua **meta**, não régua: `balizador.tipo` segue `recusa` e a folha segue
  `◇ sem fonte`. Esta spec não a promove a veredito.
- A janela desta folha é de **meses fechados**, e não a Descoberta de 28 dias das outras medidas da
  página. As duas convivem na mesma tela, cada uma declarando a sua.
- A separação marca/não-marca da Atma **fecha** com o total do corte (resíduo 0 em 180.200
  impressões, medido em 20/09/2026): as duas medidas são completas, não pisos. A `fracao` da FR-007
  da 025 continua não se aplicando.
- `data/projects.json` declara como marca da Atma `atma`, `atma aligner`, `atma alinhadores`. O
  domínio virou `usealigner.com` em 11/09 e o nome novo **ainda não é buscado** (zero impressão para
  `usealigner`/`use aligner` em 11→17/09, medido na API). Quando passar a ser, essas buscas cairão em
  não-marca e inflarão este KPI. **Fora do escopo desta spec** — é mudança de declaração e exige
  recorrida do backfill, não mudança de tela.
