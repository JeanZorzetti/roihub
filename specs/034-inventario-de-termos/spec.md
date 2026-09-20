# Feature Specification: O inventário de termos que faltava, e a penetração no Top 3 medida contra ele

**Feature Branch**: `034-inventario-de-termos`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "Montar o inventário de termos estratégicos a partir dos 3.821 termos de 8 meses do domínio antigo (corte por impressão e intenção) e ligar o coletor da folha `penetracaoTop3`"

## O fato que abre esta spec

A folha `2. KPI de Distribuição: Taxa de Penetração no Top 3` está no mapa com o selo `◇ sem fonte`
e `medidoPor: null`. A ausência foi **deliberada** e está escrita em `lib/gsc-delta.mjs:122`: o
coletor antigo apontava para `impressoesNoTop3`, que soma **impressões**, enquanto a fórmula do
board conta **termos**. Removê-lo foi o conserto certo, e a frase que ficou no lugar — "o hub não
mantém inventário monitorado, então o coletor não existe" — era verdadeira.

Esta spec remove a razão daquela frase: cria o inventário.

### O que aparece quando o inventário existe

Inventário de 725 termos (a derivação está na seção seguinte), medido contra a leitura por **termo**
dos dois hosts da Atma somados. Cada linha é uma janela de 28 dias, a mesma largura da Descoberta:

| janela de 28 dias | cobertura | no Top 3 | **penetração** |
|---|---:|---:|---:|
| março/2026 | 641/725 (88%) | 355 | **49,0%** |
| maio/2026 | 613/725 (85%) | 159 | **21,9%** |
| julho/2026 | 2/725 (0%) | 0 | **0,0%** |
| ago–set, antes da migração | 505/725 (70%) | 78 | **10,8%** |
| **2026-08-21 → 2026-09-17 (atual)** | **454/725 (63%)** | **74** | **10,2%** |
| os 8 meses inteiros | 725/725 | 193 | 26,6% |

**A Atma perdeu três quartos da penetração que tinha em março, e não recuperou.** O zero de julho é
a desindexação de junho — o mesmo evento que a reindexação de 31/07 encerrou. A recuperação parou em
~10%, metade do piso da faixa que o board pede (20% a 30%).

Duas leituras dessa tabela importam para o desenho:

1. **Os 26,6% dos 8 meses não são o estado do site.** São a média de um período que contém março. A
   janela que define o inventário não pode ser a janela que julga o inventário — medir os termos
   contra o mesmo recorte que os selecionou é circular, e o resultado fica 2,6× acima do real.
2. **Cobertura não é detalhe de rodapé.** 271 dos 725 termos monitorados (37%) não tiveram uma
   impressão sequer nos últimos 28 dias. Publicar "10,2%" sem publicar "63% de cobertura" esconde
   que mais de um terço do inventário sumiu do radar — que é um problema diferente de estar mal
   posicionado, e tem conserto diferente.

### O estado do domínio novo, medido no mesmo dia

`sc-domain:usealigner.com` devolve, na janela atual: **29 termos, 56 impressões, 0 clique, 4 dias com
impressão**, e **nenhum** termo em posição ≤ 3 — o melhor é `atma aligner` em 4,2, que é a própria
marca. Dos 725 termos do inventário, **17** aparecem no domínio novo.

O domínio antigo segue carregando quase tudo: 791 a 1.146 impressões por dia contra 15 a 28 do novo.
Por isso o KPI **soma os dois hosts** — `hostsDeclarados()` já devolve os dois desde que o card
declarou `dominioAnterior`. Medir só o domínio novo publicaria 0% sobre 29 termos e chamaria de
colapso o que é uma propriedade de cinco dias de idade.

## Por que o denominador É esta feature

A fórmula do board é `(termos com posição ≤ 3) ÷ (total de termos monitorados) × 100`. O numerador é
trivial e vem do Search Console. O denominador não existe em lugar nenhum — e ele decide o número:

| piso de impressões (8 meses, sem marca própria) | termos | penetração nos 8 meses | impressões retidas |
|---:|---:|---:|---:|
| 1 | 3.810 | 61,3% | 100,0% |
| 10 | 1.019 | 34,1% | 96,5% |
| **20** | **725** | **26,6%** | **94,2%** |
| 50 | 453 | 21,0% | 89,2% |
| 100 | 253 | 21,7% | 81,4% |

Sem piso, entram `quero`, `a vista`, `e muito caro`, `celular transparente existe` e
`aparelho para alinhamento automotivo` — fragmentos de uma impressão que inflam a penetração porque
ranquear em primeiro para uma busca que ninguém faz é fácil.

**Decisões tomadas antes desta spec** (registradas aqui porque elas são o contrato, não uma nota):

- **Piso: 20 impressões em 8 meses.** É ~1 busca a cada 12 dias — abaixo disso não é termo
  estratégico, é ruído. Retém 94,2% das impressões não-marca em 19% dos termos.
- **Termos de marca concorrente entram** (`invisalign`, `sousmile`, `clearcorrect`): 275 dos 725.
  São a fatia **mais difícil** do inventário (20,4% no Top 3 contra 30,4% dos genéricos) e existe
  página da Atma ranqueando para eles de propósito. Tirá-los subiria o KPI 3,8 pontos sem que nada
  tivesse melhorado — que é exatamente o defeito que o ramo CLIQUE do board existe para acusar.
- **Marca própria fica fora**: `atma`, `atma aligner`, `atma alinhadores`, pela lista já declarada em
  `marca.termos` do card. São 21 termos e 9.936 impressões. Penetração na própria marca não mede SEO.

### A meta do board continua sem virar régua

`CATALOGO.penetracaoTop3.balizador` é `{ tipo: "recusa" }`, e o motivo permanece verdadeiro depois
desta feature: *"inventário de palavras-chave é definido por quem mede; sem denominador comum entre
sites, nenhuma amostra publica a distribuição"*. Um inventário curado aqui dentro não cria um
denominador **comum** — cria o denominador **da Atma**.

Portanto a folha sai de "sem coletor" e **não** entra em "régua publicada". Ela fica onde
`strikingDistance` já está: medida, com número, e sem veredito. Os "20% a 30%" seguem impressos como
*meta do board*, com a mesma tipografia de sempre e nenhum `▼`/`▲` ao lado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - O inventário existe, declarado e congelado (Priority: P1)

Quem abre o repositório encontra a lista exata dos 725 termos que a Atma monitora, com a procedência
ao lado: de qual janela ela saiu, qual piso a formou, quais hosts foram somados, que dia ela foi
congelada e o que foi excluído. A lista não se recalcula sozinha a cada leitura.

**Why this priority**: sem ela nada mais desta spec existe, e ela sozinha já responde uma pergunta
que hoje não tem resposta em lugar nenhum do hub ("quais termos a Atma persegue?"). É também a peça
que qualquer outro projeto vai copiar quando ganhar inventário.

**Independent Test**: abrir o arquivo e conferir contra o Search Console que os 725 termos têm ≥ 20
impressões na janela declarada, que nenhum casa o padrão de marca própria, e que a soma das
impressões bate com o que a procedência afirma.

**Acceptance Scenarios**:

1. **Given** o inventário congelado, **When** a mesma derivação roda de novo amanhã, **Then** ela
   produz uma lista **diferente** (a janela rolou) e **não** sobrescreve a congelada — a troca é um
   ato explícito, versionado, com a data nova na procedência.
2. **Given** um termo do inventário, **When** alguém pergunta por que ele está ali, **Then** a
   resposta está no arquivo: piso, janela, hosts e data, sem precisar reabrir o Search Console.
3. **Given** a lista de marca do card (`marca.termos`), **When** o inventário é derivado, **Then**
   nenhum termo que casa `regexDeMarca()` entra — e o teste reprova se entrar.

---

### User Story 2 - A folha do mapa publica a penetração, com a cobertura ao lado (Priority: P2)

Quem clica em `2. KPI de Distribuição: Taxa de Penetração no Top 3` em `/gsc/mapa` lê o número
medido, a janela em que ele foi medido, quantos termos do inventário a janela devolveu, e a meta do
board — sem veredito, porque não há régua.

**Why this priority**: é a tela que motivou a spec e a única do hub que tem o KPI como unidade. Sem
ela o inventário é um arquivo que ninguém lê.

**Independent Test**: abrir `/gsc/mapa`, expandir a folha e conferir que o número exibido bate com a
consulta ao vivo ao Search Console na mesma janela.

**Acceptance Scenarios**:

1. **Given** a janela de Descoberta e o inventário de 725 termos, **When** a folha é expandida,
   **Then** aparece `10,2% (74 de 725)`, a janela `2026-08-21 → 2026-09-17`, e
   `piso (454 apurados na janela)`.
2. **Given** que a cobertura está abaixo de 100%, **When** o número é publicado, **Then** ele é
   declarado **piso** — um termo sem impressão na janela não prova estar fora do Top 3, prova que
   ninguém buscou por ele (ou que o Search Console omitiu a consulta rara).
3. **Given** a folha medida, **When** o selo é calculado, **Then** ele continua `◇ sem fonte` e
   **nenhum** glifo de veredito (`▼`/`▲`/`◐`) aparece ao lado do número.
4. **Given** a credencial do Search Console ausente no build, **When** a página é renderizada,
   **Then** a folha diz "não apurado" — nunca `0%`.

---

### User Story 3 - Os outros 34 projetos não ganham número falso (Priority: P3)

Nenhum projeto sem inventário declarado exibe penetração. A folha diz "não apurado" e nomeia a
falta: *inventário não declarado para este projeto*.

**Why this priority**: o board é da Atma, mas `/gsc/mapa` é uma tela do hub. A classe de defeito que
esta spec mais arrisca repetir é a de sempre — publicar `0%` onde o certo é "não medido". Vale
entregar como fatia própria porque é testável sozinha e é a única que protege os outros 34.

**Independent Test**: pedir a penetração de um projeto sem inventário e conferir que o retorno é
`null`, não `{fracao: 0}`.

**Limite do que esta tela prova**: `/gsc/mapa` renderiza **só a Atma** — o board é dela, e essa
premissa é da 033. Então o caminho de ausência existe e é exercido pelo teste da função, não pela
tela: ele só apareceria em `/gsc/mapa` se a entrada `atma` saísse do arquivo. A garantia para os
outros 34 é o contrato de `penetracaoNoTop3()`, que nenhuma tela pode contornar.

**Acceptance Scenarios**:

1. **Given** um projeto sem entrada no inventário, **When** o KPI é calculado, **Then** o retorno é
   `null` e a tela imprime "não apurado" com o motivo nomeado.
2. **Given** um projeto com inventário mas com leitura do GSC falhando, **When** o KPI é calculado,
   **Then** a falha transitória é distinguível da ausência de inventário — dois estados, duas
   frases, dois consertos.

---

### Edge Cases

- **Termo do inventário sem impressão na janela**: entra no denominador, não entra no numerador, e
  conta na **cobertura**. Não é posição infinita nem exclusão silenciosa — as duas escolhas erram
  para lados opostos e as duas seriam invisíveis na tela.
- **Termo presente nos dois hosts**: a posição é a média ponderada por impressão dos dois. Somar as
  impressões e tirar média simples das posições daria peso igual a 1 impressão e a 1.000.
- **Inventário com 0 termos** (arquivo presente, lista vazia): é erro de curadoria, não estado
  válido — a leitura recusa e o teste reprova. Dividir por zero devolveria `NaN` para a tela.
- **Marca própria não declarada no card**: sem `marca.termos` não há como excluir marca, e um
  inventário com a marca dentro mede outra coisa. A derivação recusa rodar.
- **Janela sem nenhum dia fechado** (a que o GSC ainda não entregou): cobertura 0 de 725, e o número
  é "não apurado" — não `0%`.
- **O domínio novo assume**: quando `usealigner.com` acumular histórico próprio, o inventário
  derivado do domínio antigo continua válido como denominador (são os mesmos termos), mas a
  procedência passa a mentir sobre a fonte. A data de congelamento no arquivo é o que torna isso
  visível em vez de silencioso.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE guardar o inventário de termos monitorados como dado **declarado e
  versionado**, com um registro de procedência contendo: janela de derivação, piso de impressões,
  hosts somados, propriedades consultadas, data de congelamento e critério de exclusão aplicado.
- **FR-002**: O inventário DEVE ser derivável por um comando reproduzível, e esse comando NÃO PODE
  sobrescrever o inventário congelado sem ação explícita de quem o roda.
- **FR-003**: A derivação DEVE excluir todo termo que case o padrão de marca própria do projeto
  (`regexDeMarca()` sobre `marca.termos` do card), e DEVE recusar rodar para projeto que não declara
  marca.
- **FR-004**: O sistema DEVE calcular a penetração como `termos do inventário com posição ≤ 3 na
  janela ÷ total de termos do inventário`, com o denominador sempre igual ao inventário inteiro.
- **FR-005**: O sistema DEVE publicar, junto de toda penetração, a **cobertura** (quantos termos do
  inventário tiveram impressão na janela) e a **janela** (início e fim).
- **FR-006**: O sistema DEVE somar os hosts declarados do projeto numa única leitura por termo,
  ponderando a posição de um termo repetido pelas impressões de cada host.
- **FR-007**: O sistema DEVE devolver ausência (`null`) — nunca zero — quando não houver inventário
  declarado, e DEVE distinguir essa ausência de uma falha transitória de leitura.
- **FR-008**: A folha `penetracaoTop3` DEVE passar a declarar seu coletor em `MEDIDO_POR`, e DEVE
  manter o balizador `recusa`: número publicado, veredito nenhum.
- **FR-009**: A tela NÃO PODE exibir glifo de veredito (`▼`, `▲`, `◐`) ao lado da penetração, e DEVE
  continuar apresentando os "20% a 30%" rotulados como meta do board.
- **FR-010**: A penetração DEVE ser declarada **piso** sempre que a cobertura for menor que 100%.

### Key Entities

- **Inventário de termos**: a lista congelada de termos que um projeto monitora, com sua
  procedência. Chaveada por slug de projeto. Um projeto tem no máximo um inventário; 34 dos 35 não
  têm nenhum.
- **Procedência do inventário**: janela, piso, hosts, propriedades, data de congelamento e exclusões
  — o que permite alguém refazer a lista e conferir que daria a mesma coisa.
- **Leitura de penetração**: o par (inventário, janela) resolvido contra o Search Console, que
  produz `{penetração, no Top 3, total, cobertura, janela}`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A folha `2. KPI de Distribuição: Taxa de Penetração no Top 3` deixa de exibir
  `medidoPor: null` e passa a exibir um número com janela e cobertura — hoje são 0 números e 1
  frase de ausência.
- **SC-002**: O número publicado bate, na casa decimal, com uma consulta ao vivo ao Search Console
  feita no mesmo dia sobre os mesmos hosts e a mesma janela.
- **SC-003**: `penetracaoNoTop3()` devolve `null` para todo projeto sem inventário, provado por
  teste, e a tela tem o caminho de ausência com a frase que nomeia a falta. Nenhuma superfície do
  hub exibe `0%` por falta de inventário.
- **SC-004**: `npm test` verde com a suíte inteira, incluindo o teste novo registrado à mão em
  `package.json`.
- **SC-005**: Qualquer pessoa consegue responder "por que este termo está no inventário?" lendo só o
  arquivo, sem abrir o Search Console.

## Assumptions

- O board `okr-Saw2eoSKZDPLJAk6xeDBuS` é o board **da Atma**, então entregar a Atma medida e os
  outros 34 em "não apurado" é o escopo correto — mesma premissa já assumida pela 033.
- A leitura por termo do Search Console é um **piso**: a fonte omite consultas raras por privacidade.
  A cobertura publicada é a defesa contra ler o piso como total.
- O inventário derivado do domínio antigo continua sendo o inventário certo depois da migração: o
  produto e os termos são os mesmos, só a URL mudou.
- A janela de medição é a de Descoberta (D-30 → D-3), a mesma do resto do hub. Nenhuma janela nova
  entra nesta feature.
- Não entra série histórica nesta spec. A tabela de colapso que abre este documento foi medida à
  mão e **não** será um produto da tela — publicar a série exigiria gravar a penetração por dia, que
  é feature própria. Fica registrado como o próximo passo óbvio.
