# Feature Specification: O veredito sai do intervalo da amostra, não de um piso de impressões

**Feature Branch**: `033-veredito-por-intervalo`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "O veredito de CTR por posição sai do intervalo de confiança da própria amostra, não de um piso fixo de impressões — e o mapa do board mostra o real medido em cada faixa, com a janela declarada"

## O fato que abre esta spec

Medido em 20/09/2026, janela de descoberta (2026-08-21 a 2026-09-17), leitura por página, hosts
somados. O piso fixo de 100 impressões erra nos **dois** sentidos:

| Faixa | impressões | cliques | CTR | intervalo de 95% | régua | o que o piso fixo faz |
|---|---:|---:|---:|---|---:|---|
| Posição 1 | 21 | 0 | 0,0% | 0,0% a **15,5%** | 25,0% | **descarta um veredito válido** |
| Posições 4 a 6 | 105 | 3 | 2,9% | 1,0% a **8,1%** | 4,5% | **publica um não-veredito** |

Zero clique em 21 impressões exclui 25% com folga: se a régua fosse verdade, ver zero clique teria
probabilidade de 0,24%. O piso de 100 joga essa conclusão fora. Já as 105 impressões da faixa 4 a 6
passam do piso e não resolvem nada — o intervalo atravessa a régua inteira.

**Contar impressões não é o teste. O teste é o intervalo excluir a régua.**

### O mesmo raciocínio por URL muda o número publicado

O Índice de Conformidade hoje conta toda URL que tem régua, independentemente de a amostra dela
sustentar alguma conclusão:

| | denominador | atingem | publicado |
|---|---:|---:|---|
| Hoje | 24 URLs | 3 | **12,5%** |
| Com o intervalo | **4 URLs decididas** | 1 | **25,0%** |

As outras **20 URLs são indecisas** — a amostra delas não resolve contra a própria régua — e **5**
seguem sem régua por estarem acima da posição 10,9. Uma URL de 1 impressão e 0 cliques na posição
2,0 hoje entra no denominador como reprovada; contra uma régua de 13%, ver zero clique em uma
impressão tem probabilidade de 87%. Ela não reprovou nada.

O denominador encolher de 24 para 4 **é a entrega**, não o efeito colateral: o site quase não tem
URL com tráfego suficiente para ser julgada, e isso é a informação que o 12,5% escondia.

### Por que três janelas não se combinam

A faixa "Posições 7 a 10" tem **23.450 impressões em 28 dias** e **10.970 em 8 meses**. Uma janela
que contém a outra não pode ter menos — a não ser que o conjunto medido mude. E muda: a página de
maior movimento entra na faixa 4 a 6 quando a posição é a média de 8 meses (4,45) e na faixa 7 a 10
quando é a dos últimos 28 dias (7,31).

```
a mesma página, escorregando
  fev/2026   posição 3,47
  mai/2026   posição 6,31
  hoje       posição 7,31
  média de 8 meses: 4,45 — uma posição que ela não tem desde maio
```

Janelas diferentes não são três medidas da mesma coisa: são medidas de coisas diferentes, porque a
faixa a que uma página pertence depende da janela. Média, mediana ou ponderação entre elas somaria
grandezas distintas.

### A régua e a referência não foram medidas na mesma SERP

A referência pública que o hub usa como ordem de grandeza mede **SERP limpa** e publica 39,8% na
posição 1, 18,7% na 2 e 10,2% na 3. A régua do hub cobra **25% / 13% / 8%** — menos, e de propósito:
o CTR do Search Console é apurado na SERP **real**, com resposta gerada por IA em ~31% delas. O
rebaixamento já foi feito, e está registrado no repositório desde 19/09/2026.

Isso muda o que a tela tem de declarar. A condição "sem resposta gerada por IA no topo" é da
**referência**, não da régua — carimbá-la na régua afirmaria o contrário do que foi medido. São dois
fatos, e a tela carrega os dois: a SERP em que a referência foi medida, e a SERP que a régua julga.

A referência é reconstruída **mensalmente**, e a que o hub cita é de **2025-05-28**. Em 20/09/2026
são **16 meses** — quinze reconstruções atrás. O veredito "abaixo" na Posição 1 depende dessa régua,
e a idade dela é informação da tela, não nota de rodapé.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - O veredito só existe onde a amostra o sustenta (Priority: P1)

O dono lê quantas das suas páginas atingem o CTR mínimo da posição e sabe que cada uma dessas
páginas teve tráfego suficiente para a conclusão valer. As que não tiveram aparecem nomeadas, fora
da conta.

**Why this priority**: é a correção da régua, e sem ela todo número desta família mistura conclusão
com ruído. Sozinha ela já torna o Índice de Conformidade honesto.

**Independent Test**: abrir a aba de aquisição e conferir que o denominador contém apenas páginas
cuja amostra decide, e que as indecisas estão listadas com a base delas.

**Acceptance Scenarios**:

1. **Given** uma página com 21 impressões e nenhum clique numa faixa cuja régua é 25%, **When** o
   veredito é calculado, **Then** ela é classificada como **abaixo** — a amostra decide.
2. **Given** uma página com 1 impressão e nenhum clique numa faixa cuja régua é 13%, **When** o
   veredito é calculado, **Then** ela é **indecisa**, fica fora do denominador e é nomeada.
3. **Given** um conjunto com 24 páginas com régua das quais 4 têm amostra decisiva, **When** o
   índice é publicado, **Then** o denominador é 4 e a tela diz quantas ficaram indecisas.
4. **Given** uma página cuja amostra decide a favor, **When** o veredito é calculado, **Then** ela
   é **atinge** e entra no numerador.

---

### User Story 2 - O mapa do board mostra o real de cada faixa (Priority: P1)

Quem abre o mapa mental do board vê, em cada uma das seis faixas de posição, o que o site de fato
faz ali: quantas páginas, quantas impressões, e o veredito quando ele existe.

**Why this priority**: é o pedido que abriu a spec, e é onde a régua nova aparece para quem lê o
board. Depende da US1 para não publicar seis percentuais dos quais quatro seriam ruído.

**Independent Test**: abrir o mapa e conferir que cada uma das seis faixas declara base e janela, e
que só as faixas com amostra decisiva carregam veredito.

**Acceptance Scenarios**:

1. **Given** uma faixa onde o site tem páginas, **When** o nó é lido, **Then** ele declara quantas
   páginas, quantas impressões e em que janela.
2. **Given** uma faixa cuja amostra decide, **When** o nó é lido, **Then** ele mostra o CTR real e
   o veredito contra a régua **que julga** — não contra a tabela transcrita do board.
3. **Given** uma faixa cuja amostra não decide, **When** o nó é lido, **Then** ele diz que a amostra
   não decide e mostra a base, sem percentual de veredito.
4. **Given** uma faixa onde o site não teve nenhuma impressão, **When** o nó é lido, **Then** ele
   diz que o site não aparece ali — estado distinto de "amostra não decide".
5. **Given** a tela impressa em tons de cinza, **When** os nós são lidos, **Then** os três estados
   continuam distinguíveis sem a cor.

---

### User Story 3 - A concentração no Top 3 usa o mesmo teste (Priority: P2)

A fração de impressões no Top 3 deixa de depender de um piso fixo de amostra e passa pelo mesmo
critério das demais.

**Why this priority**: é a única outra medida do hub que hoje usa o piso fixo. Mesma raiz, e deixá-la
para trás manteria duas réguas de suficiência de amostra no mesmo painel.

**Independent Test**: conferir que a fração do Top 3 emite ou omite veredito pelo mesmo critério das
faixas, com a base declarada em ambos os casos.

**Acceptance Scenarios**:

1. **Given** uma amostra que não decide contra a faixa do board, **When** a fração é publicada,
   **Then** o número aparece com a base e **sem** veredito.

---

### Edge Cases

- **Zero clique não é sempre indecisão.** Zero em 21 impressões decide contra uma régua de 25%;
  zero em 3 não decide contra 13%. A regra é o intervalo, nunca a contagem de cliques.
- **A amostra pequena empurra o intervalo para fora do possível.** Um método de intervalo que
  assuma normalidade devolve limite inferior negativo com poucos cliques — CTR negativo não existe,
  e publicá-lo transformaria o conserto em outro defeito.
- **Três estados, não dois.** "O site não aparece nesta faixa" (zero impressão), "a amostra não
  decide" e "decidido" pedem trabalhos diferentes e não podem compartilhar aparência.
- **O denominador encolhe.** De 24 para 4 páginas. Quem olhar sem a contagem de indecisas ao lado
  vai ler como perda de dado; a contagem ao lado é obrigatória, não decorativa.
- **Faixa sem régua.** A Página 2 (11 a 20) não tem régua com fonte. Nenhum intervalo produz
  veredito ali — o CTR real aparece, o veredito não.
- **Nenhuma medida combina janelas.** A pertença de uma página a uma faixa muda com a janela;
  comparar janelas só é legítimo como direção de uma mesma página, nunca como valor de uma faixa.
- **A régua tem validade, e a de hoje já está vencida.** A referência é reconstruída mensalmente e
  a citada é de **2025-05-28** — 16 meses em 20/09/2026, quinze reconstruções atrás. A tela declara
  origem, data e **idade**; uma régua de dois anos atrás julgando a busca de hoje é o mesmo defeito
  que esta spec conserta, um nível acima. **Declarar a idade é escopo desta spec; trocar a curva não
  é** — a troca é decisão do dono, e sai daqui instrumentada para ser tomada.
- **Uma página pode sair da faixa entre duas leituras** sem que nada tenha piorado — ela pode ter
  subido. Mudança de faixa nunca é lida como queda sem olhar a direção.
- **A página nomeada pode ser a que ATINGE.** A FR-012 manda destacar a de maior impressão entre as
  decididas, não a pior. Se a maior estiver acima da régua, a frase diz isso — inverter a regra
  para "a pior" faria a tela procurar problema mesmo quando não há, e um painel que só sabe dar
  má notícia é ignorado na terceira semana.
- **A página nomeada pode mudar de uma leitura para outra** sem que nada tenha acontecido com ela:
  basta outra crescer. A frase carrega a participação no tráfego justamente para isso ser visível.
- **O projeto pode cruzar as 20 páginas decididas** e a tela trocar de forma. A troca é legítima —
  acima de 20 o índice passa a ser comparável à faixa do board — mas não pode ser silenciosa: quem
  abrir a tela depois da troca precisa entender por que ela mudou de cara.

## De onde sai o 20 — número, não gosto

A meta do board para este índice é uma **faixa de 5 pontos de largura** (75% a 80%). Com `n`
páginas decididas, **uma** página mudar de veredito move o índice em `1/n`. Para o índice poder ser
comparado à faixa do board, uma página sozinha não pode atravessá-la:

```
1/n < 0,05   →   n ≥ 20
```

Hoje a Atma tem **4** páginas decididas. Uma página vale **25 pontos** — cinco vezes a largura da
faixa inteira. Um índice assim não mede o site: mede qual página caiu de um lado da régua.

⚠️ **Este limiar é deliberadamente mais frouxo que o precedente do hub.** O piso de impressões da
026 exigiu que fossem precisas ~10 unidades para atravessar a faixa (faixa de 10 pontos, 100
impressões, 1 ponto cada). A mesma exigência aqui pediria **200 páginas decididas** — nenhum
projeto do portfólio tem isso, nem somando todas as URLs com impressão. Adotar 200 tornaria o
índice permanentemente não publicável, o que é uma forma de mentir por omissão. O 20 é o piso do
que ainda é comparável à régua do board, e a diferença entre os dois critérios fica escrita aqui em
vez de descoberta depois.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Um veredito de CTR contra régua MUST ser emitido apenas quando o intervalo de
  confiança da própria amostra **exclui** a régua. Contagem de impressões MUST NOT ser o critério.
- **FR-002**: Toda medida desta família MUST distinguir três resultados — **atinge**, **abaixo** e
  **indecisa** — e a indecisa MUST ficar fora do denominador e ser contada na tela.
- **FR-003**: O intervalo MUST ser calculado por um método válido para amostra pequena e proporção
  próxima de zero, e MUST NOT produzir limite fora da faixa possível de um CTR.
- **FR-004**: Todo número desta família MUST declarar janela, base e a régua contra a qual foi
  julgado.
- **FR-005**: O mapa do board MUST mostrar, em cada faixa de posição, a base e o veredito quando ele
  existir, contra a régua que julga — e MUST NOT usar a tabela transcrita do board como régua.
- **FR-006**: Os três estados MUST ser distinguíveis sem cor.
- **FR-007**: Nenhuma medida MUST combinar janelas diferentes num mesmo número. Comparação entre
  janelas é permitida apenas como direção de uma mesma página.
- **FR-008**: A régua MUST declarar de onde veio, de quando é, e sob que condição de SERP vale — a
  da **referência** de onde saiu (SERP limpa) e a da busca que ela **julga** (SERP real, com resposta
  gerada por IA em ~31% delas), que não são a mesma. A tela MUST exibir a **idade** da régua junto do
  valor, derivada da data de medição e da cadência de reconstrução.
- **FR-009**: O piso fixo de impressões MUST deixar de existir como critério de veredito em todas as
  medidas que o usam hoje.
- **FR-010**: O Índice de Conformidade MUST ser publicado nas duas leituras — por página e por
  tráfego — cada uma nomeada pela grandeza que mede, com a base ao lado. A leitura por página MUST
  carregar a meta do board; a por tráfego MUST NOT carregar meta, porque o board não definiu
  nenhuma. As duas MUST NOT receber o mesmo peso visual: uma responde, a outra qualifica.
- **FR-011**: Quando o denominador de páginas decididas mudar entre duas leituras, a tela MUST
  deixar claro que a variação do índice por página pode vir da mudança do denominador e não de
  desempenho — a leitura por tráfego ao lado é o portador dessa distinção.
- **FR-012**: Com **menos de 20 páginas decididas**, nenhum dos dois índices MUST ser o elemento de
  maior peso da tela. A resposta MUST ser a **página nomeada** de maior impressão entre as
  decididas, com o CTR dela, a régua da posição dela e quantos cliques faltam na janela; os dois
  percentuais ficam abaixo, como contexto. O limiar é derivado, não escolhido — ver a seção abaixo.
- **FR-013**: Com **zero página decidida**, a tela MUST dizer isso em texto, com a contagem de
  indecisas e das sem régua. Índice nenhum é publicado, e a ausência de página nomeada é declarada
  — não é um espaço em branco.

### Key Entities

- **Amostra de uma página ou faixa**: impressões, cliques e posição média numa janela.
- **Régua**: o CTR mínimo esperado para a faixa, com origem, data e a condição de SERP em que foi
  medida.
- **Veredito**: atinge, abaixo ou indeciso, derivado da relação entre o intervalo da amostra e a
  régua.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma faixa com 21 impressões e nenhum clique contra régua de 25% **recebe** veredito de
  "abaixo". Hoje um piso de amostra a descartaria.
- **SC-002**: Uma faixa com 105 impressões e CTR de 2,9% contra régua de 4,5% **não recebe**
  veredito. Hoje ela passaria do piso e publicaria um.
- **SC-003**: O Índice de Conformidade publica o denominador das páginas decididas e, ao lado, a
  contagem de indecisas. Medido hoje na Atma: **4 decididas, 1 atinge, 20 indecisas, 5 sem régua**.
- **SC-004**: Cada uma das seis faixas do mapa declara base e janela, e nenhuma faixa com amostra
  indecisa publica percentual de veredito.
- **SC-005**: Nenhum número da tela é composto por mais de uma janela — verificável lendo as
  declarações de janela da própria tela.
- **SC-006**: Os três estados são distinguíveis numa captura em tons de cinza.
- **SC-007**: A tela publica as duas leituras do índice com grandeza nomeada e base ao lado —
  medido hoje na Atma: **25,0% por página (1 de 4)** e **2,5% por tráfego (583 de 22.899)** — e
  apenas a primeira exibe a meta do board.
- **SC-008**: Um leitor que só viu a tela consegue dizer qual das duas é o KPI do board e qual é a
  qualificação, sem abrir a spec.
- **SC-009**: Com menos de 20 páginas decididas, o elemento mais destacado da tela é uma **frase
  sobre uma página nomeada**, não um percentual. Medido hoje na Atma (4 decididas), a frase é:
  *"`/blog/quanto-custa-alinhador-invisivel` — 94% do tráfego decidível, CTR 1,28% contra piso de
  2,00% na posição 7,3; faltam 155 cliques na janela."* — 21.500 de 22.899 impressões decidíveis
  (93,9%), e 21.500 × 2,00% = 430 cliques contra os 275 medidos. A grandeza é **nomeada** pelo mesmo
  motivo da FR-010: sobre o tráfego do site inteiro (24.664) a mesma página é 87%, e as duas frases
  soltas na mesma reunião viram dois números disputando a mesma afirmação.
- **SC-010**: Um leitor que olha só a captura da tela por 5 segundos diz o nome da página que
  precisa de trabalho. Hoje ele diria "12,5%", que não aponta para nenhuma ação.

## Assumptions

- A janela de veredito continua sendo a de descoberta (28 dias fechando em D-3). São quatro semanas
  inteiras, o que elimina viés de dia da semana, e é o recorte que descreve a posição atual — a
  única leitura para a qual uma faixa de posição é verdadeira.
- As réguas por faixa não mudam de valor nesta spec. O que muda é como se decide se a amostra pode
  ser comparada a elas.
- A leitura por página (completa) continua alimentando as medidas por URL, como a 032 definiu.
- A soma de hosts das 030 e 031 permanece.
- O nível de confiança é 95%, o usual para esta classe de decisão. Mudá-lo é decisão do dono e afeta
  quantas páginas ficam indecisas.

## As duas leituras do Índice — decidido em 20/09/2026

**O índice é publicado nas duas formas, cada uma nomeada e com papel declarado** (decisão do dono).
Medido hoje na Atma, na mesma janela:

| Leitura | O que afirma | Valor | Régua |
|---|---|---:|---|
| **Por página** | quantas das páginas decidíveis atingem a régua da própria posição | **25,0%** (1 de 4) | meta do board: 75% a 80% |
| **Por tráfego** | que fração das impressões decidíveis está em páginas que atingem | **2,5%** (583 de 22.899) | **sem meta** — o board nunca definiu uma |

As duas são verdadeiras e apontam para lados opostos, e é por isso que **publicar as duas exige
declarar o papel de cada uma** (FR-010). Sem isso elas viram dois números disputando a mesma frase
numa reunião — o defeito que `transcricao_vira_terceira_fonte_de_numero` já custou caro neste hub.

**Os papéis**: a leitura por página é o **KPI do board** e carrega a meta dele. A leitura por
tráfego é a **qualificação** — ela existe para impedir que o KPI seja lido como melhora quando
não houve nenhuma. É exatamente o que acontece aqui: o índice por página **sobe de 12,5% para
25,0% sem que uma única página tenha melhorado**, só porque 20 páginas indecisas saíram do
denominador. A leitura por tráfego é o que denuncia isso, mostrando 2,5%.

Elas nunca aparecem com o mesmo peso visual: uma responde, a outra qualifica.
