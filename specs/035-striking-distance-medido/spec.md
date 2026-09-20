# Feature Specification: Striking Distance medido no board, e a guarda de marca que a dimensão nova desliga

**Feature Branch**: `035-striking-distance-medido`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "Quero que apareça medido aqui" — apontando para a folha `3. KPI de Oportunidade Imediata: Volume em Striking Distance (Posições 4 a 10)` em `/gsc/mapa`, a única folha do ramo CLIQUE com coletor declarado e sem número na tela.

## O fato que abre esta spec

A 034 ligou o nó `Medido:` da folha vizinha (`penetracaoTop3`). A folha `strikingDistance` ficou com
`MEDIDO_POR` preenchido — `lib/kpis-busca.mjs#strikingDistance` — e **nenhum número no mapa**. Quem
abre a folha lê a fórmula do board e a meta de 15% a 25%, e não lê quantas consultas existem para
converter.

Ligar o número expõe um defeito que só aparece nesta dimensão.

### A guarda de marca desliga em silêncio na leitura por termo

`strikingDistance(linhas, ehMarca)` filtra a marca por `c.query`. A leitura por termo
(`mesclarPorTermo()`, a mesma que a 034 usa) devolve o campo como **`termo`**, não `query`. A
chamada compila, `ehMarca(undefined)` testa contra a string vazia, e **nada é removido**.

Medido na Atma em 20/09/2026, janela `2026-08-21 → 2026-09-17`, hosts somados:

| | consultas na faixa | impressões | cliques | CTR da fila |
|---|---:|---:|---:|---:|
| com a guarda funcionando | **344** | 5.274 | 41 | **0,8%** |
| com a guarda desligada (o que a chamada ingênua produz) | 347 | 5.697 | 113 | **2,0%** |

Três termos de diferença. **Setenta e dois cliques** de diferença:

- `atma aligner` — posição 4,4 · 423 impressões · **70 cliques**
- `atma dental` — posição 7,4 · 7 impressões · 2 cliques
- `atma odontologia` — posição 10,0 · 2 impressões · 0 clique

A marca própria sozinha responde por **62% dos cliques** que a fila exibiria, e encabeçaria a lista
ordenada por impressões. É o defeito que a 027 consertou na dimensão `query`+`page`, voltando pela
porta da dimensão seguinte — o mesmo padrão que `lib/gsc.ts#lerHosts` documenta: guarda escrita no
chamador volta pela chamada que vier depois.

O efeito não é cosmético. A fila existe para apontar **reforço de conteúdo e link interno**, e
nenhum dos dois move a própria marca. Uma fila que abre com `atma aligner` manda o leitor otimizar
o termo que já converte sozinho, e publica um CTR 2,5× melhor do que o real.

### O que o número diz sobre a Atma

Striking distance em janelas de 28 dias, a mesma largura da Descoberta, dimensão `query`, hosts
somados, marca fora:

| janela de 28 dias | termos lidos | **striking (4,0–10,9)** | impressões | cliques | CTR |
|---|---:|---:|---:|---:|---:|
| março/2026 (03-01 → 03-28) | 1.597 | **335** | 6.218 | 26 | 0,4% |
| maio/2026 (05-01 → 05-28) | 1.341 | **372** | 15.355 | 146 | 1,0% |
| julho/2026 (07-01 → 07-28) | 4 | **2** | 2 | 0 | — |
| ago–set pré-migração (08-07 → 09-03) | 1.024 | **360** | 8.539 | 63 | 0,7% |
| **atual (08-21 → 09-17)** | **893** | **344** | **5.274** | **41** | **0,8%** |
| os 8 meses inteiros (01-17 → 09-17) | 3.831 | 983 | 99.593 | 595 | 0,6% |

**A faixa 4–10 não encolheu: ela parou de ser convertida.** Entre março e hoje a penetração no Top 3
caiu de 49,0% para 10,2% (034), enquanto o volume em striking distance ficou onde estava — 335 em
março, 344 hoje. O zero de julho é a desindexação de junho, o mesmo evento da 034.

Contra a meta do board — converter 15% a 25% ao trimestre —, o trimestre medido fez o contrário: a
fila permaneceu cheia e o Top 3 esvaziou. É esse o veredito que o número publica, e é por isso que
ele precisa estar na folha.

## Por que a dimensão é `query` e não `query`+`page`

O board pede *"número absoluto de **consultas** com impressões relevantes situadas entre as posições
4,0 e 10,9"*. Consulta se conta na dimensão que o Google agrega por consulta.

A mesma janela, nas duas dimensões:

| dimensão | resultado | o que a linha é |
|---|---:|---|
| `query` | **344** | uma consulta |
| `query`+`page` | 362 | um par consulta×página — o mesmo termo aparece uma vez por página em que ranqueia |

Os 18 de diferença são termos que ranqueiam com mais de uma página. `/okr/atma/aquisicao` usa e
**continua usando** a leitura `query`+`page`, porque lá a lista é fila de trabalho e precisa nomear
a página a reforçar. O board conta consultas. São duas perguntas, e a 034 já escreveu a regra em
`lib/kpis-busca.mjs:195`: a agregação do Google por `query` não é a soma das linhas de
`query`+`page`, e pendurar uma medida na dimensão errada compila e devolve o número errado.

As duas telas vão exibir números diferentes para o mesmo KPI, e isso é correto desde que cada tela
diga o que está medindo. É o que a FR-007 exige.

## Clarifications

### Session 2026-09-20

- **Q: O numerador conta todas as consultas lidas, ou só as do inventário congelado de 725 da 034?**
  → **Todas as lidas (344).** O board pede "número absoluto". O inventário da 034 está congelado em
  20/09/2026, e usá-lo como filtro aqui cegaria a folha para toda consulta nova que entrar na faixa
  4–10 — que é exatamente a oportunidade que este KPI existe para achar. O KPI 2, uma folha acima na
  mesma tela, já reporta contra o inventário; fazer o KPI 3 também colapsaria duas medidas numa
  lente só. Medido: 190 das 344 estão no inventário (26,2% dele), e as 154 de fora somam 424
  impressões. O recorte por inventário entra na **nota** como leitura secundária (FR-013).

- **Q: O que conta como "impressões relevantes" na letra do board?**
  → **Qualquer impressão (> 0), sem piso (344).** A 033 removeu o piso fixo de impressões do hub: o
  que decide se uma amostra sustenta um **veredito** passou a ser o intervalo de confiança
  (`lib/intervalo.mjs`). Aqui não há veredito — é contagem — e contagem não pede IC nem piso.
  Reintroduzir um piso arbitrário reverteria a 033 por outro caminho, e o piso escolhido por quem
  mede tornaria o número incomparável com qualquer outro site. Medido: piso 5 daria 173, piso 20
  daria 63. A cauda fica **visível**, não escondida: 93 das 344 têm uma impressão só, e a nota diz
  isso (FR-014).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - O número na folha do board (Priority: P1)

Quem abre `/gsc/mapa`, navega até `CLIQUE` → `3. KPI de Oportunidade Imediata` e expande a folha
precisa ver quantas consultas da Atma estão hoje entre as posições 4,0 e 10,9 — com a base, a janela
e o estado da medida.

**Why this priority**: é o pedido. Sem ele a folha continua sendo a única do ramo CLIQUE com coletor
declarado e sem número, e a meta de 15% a 25% fica pendurada em nada.

**Independent Test**: abrir a folha no mapa e na lista sem JavaScript; o nó `Medido:` aparece em
ambos com número, base e janela.

**Acceptance Scenarios**:

1. **Given** a Atma com credencial do Search Console ativa, **When** a folha `strikingDistance` é
   expandida, **Then** o primeiro filho traz `Medido: 344 consultas entre as posições 4,0 e 10,9`
   com a base de termos lidos, e o painel de seleção traz a janela `2026-08-21 → 2026-09-17` e os
   termos de marca removidos.
2. **Given** a mesma folha, **When** o leitor confere a ordem dos filhos, **Then** o nó medido vem
   **antes** da fórmula e da meta — quem expande procura o número, e confere a definição depois.
3. **Given** a lista sem JavaScript da mesma página, **When** ela é impressa ou lida por leitor de
   tela, **Then** o mesmo nó e a mesma nota aparecem em texto corrido.

---

### User Story 2 - A marca fora da fila, e dito por escrito (Priority: P1)

O número publicado não pode contar a marca própria, e a tela precisa dizer quantos termos saíram —
`0 removidos` e `guarda não declarada` são estados diferentes com consertos diferentes.

**Why this priority**: mesma prioridade da US1 porque não é refinamento dela: publicar 347 com 113
cliques é publicar um número errado, e errado no sentido que faz o KPI parecer melhor.

**Independent Test**: com a declaração de marca do card presente, o total exclui `atma aligner`,
`atma dental` e `atma odontologia`; a nota diz "3 de marca removida(s)".

**Acceptance Scenarios**:

1. **Given** a Atma com `marca.termos` declarado no card, **When** a medida roda, **Then** o total é
   344 e a nota declara os 3 termos de marca removidos.
2. **Given** um projeto sem `marca` declarada, **When** a medida roda, **Then** o número é publicado
   com a ressalva de que a marca **não** foi filtrada — nunca `0 removidos`.

---

### User Story 3 - Ausência dita pelo nome certo (Priority: P2)

Quando não há número, a folha precisa dizer qual das causas ocorreu, porque cada uma pede trabalho
oposto.

**Why this priority**: P2 porque o caminho feliz entrega valor sozinho — mas sem isto a primeira
falha de credencial publica silêncio, e silêncio lê como "zero consultas na faixa", a afirmação mais
otimista possível sobre um KPI de oportunidade.

**Independent Test**: com `GOOGLE_SERVICE_ACCOUNT_JSON` ausente, a folha diz "sem leitura do Search
Console" e nomeia a causa; nunca `0`.

**Acceptance Scenarios**:

1. **Given** credencial ausente, **When** a folha é expandida, **Then** aparece `∅ não apurado` com
   o motivo nomeado por `motivoDeAusencia`.
2. **Given** a leitura falhando de forma transitória, **When** a folha é expandida, **Then** aparece
   `∅ não apurado · a leitura do Search Console falhou` com a mensagem da fonte.
3. **Given** a leitura respondendo com zero termo na faixa, **When** a folha é expandida, **Then**
   aparece `0 consultas` declarado como medida, distinto dos dois estados acima.

### Edge Cases

- **Termo com posição `null`** (linha sem impressão, que não vota na média ponderada de
  `mesclarPorTermo`): fica fora da faixa. `null >= 4` é `false`, e a medida não pode depender desse
  acidente — o filtro testa o tipo.
- **Posição exatamente 4,0 e exatamente 11,0**: 4,0 entra, 11,0 não. A faixa é `[4, 11)`, a mesma da
  função existente, e o rótulo do board ("4 a 10") corresponde a `4,0–10,9`.
- **Projeto sem marca declarada**: publica o número sem filtro, com a ressalva. Nunca `removidas: 0`.
- **Leitura truncada no teto de 25.000 linhas**: o total vira piso e a tela declara.
- **Um dos dois hosts sem propriedade no Search Console**: a leitura segue com o vivo e o encerrado
  sai nomeado — contrato de `lerHosts`, já existente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A folha `strikingDistance` do board MUST exibir, como **primeiro** filho, um nó com o
  número de consultas medidas na faixa 4,0–10,9 para a Atma.
- **FR-002**: A medida MUST ser feita na dimensão `query` (agregação do Google por consulta), e
  NUNCA na soma das linhas de `query`+`page`.
- **FR-003**: A medida MUST reutilizar a leitura por termo que a página já faz para
  `penetracaoTop3` — zero requisição adicional ao Search Console por render.
- **FR-004**: A guarda de marca MUST operar sobre o campo que a leitura por termo devolve, e o
  contrato MUST tornar impossível passar uma forma de linha que desligue a guarda em silêncio.
- **FR-005**: A medida MUST distinguir `removidas: 0` (marca declarada, nada casou) de
  `removidas: null` (marca não declarada).
- **FR-006**: O nó MUST declarar a janela (`início → fim`, 28 dias, fecha em D-3) no nó e na nota,
  para um nó lido isolado ainda dizer de que período o número é.
- **FR-007**: A nota MUST declarar que `/okr/atma/aquisicao` publica um número diferente para o
  mesmo KPI, e por quê (lá é fila de trabalho por página, aqui é contagem de consultas).
- **FR-008**: O nó MUST distinguir quatro estados — medido, sem leitura, leitura falhou e zero
  medido — e NUNCA publicar `0` para os três primeiros.
- **FR-009**: O nó NÃO PODE exibir glifo de veredito (`▼`/`▲`/`◐`). Os 15% a 25% são **meta do
  board**, e `balizador.tipo` desta folha é `recusa`: comparar contra eles publicaria um veredito
  que o próprio painel nega duas linhas acima. Mesma regra da FR-009 da 034.
- **FR-010**: `MEDIDO_POR.strikingDistance` MUST apontar para o coletor que a tela efetivamente usa.
- **FR-011**: A medida MUST expor também a base (termos lidos na janela) e as impressões da faixa,
  para o número não ser publicado sem denominador.
- **FR-012**: A lista aninhada sem JavaScript da mesma página MUST mostrar o mesmo nó e a mesma nota.
- **FR-013**: A nota MUST trazer quantas das consultas medidas pertencem ao inventário declarado do
  projeto, quando ele existe — leitura secundária, nunca o numerador (ver Clarifications).
- **FR-014**: A nota MUST tornar a cauda visível: quantas das consultas medidas têm uma única
  impressão na janela. Sem essa frase, um total sem piso lê como se todas fossem trabalho igual.

### Key Entities

- **Consulta em striking distance**: um termo da leitura por `query`, com posição em `[4,0; 11,0)` e
  ao menos uma impressão na janela, que não casa com a declaração de marca do projeto.
- **Medida de striking distance**: `{ total, impressoes, cliques, removidas, base }` — o número, o
  que o sustenta, e quantos termos de marca saíram.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Quem abre a folha no board vê o número de consultas conversíveis sem sair da página e
  sem consultar outra tela.
- **SC-002**: O número publicado exclui 100% dos termos que casam com a declaração de marca do
  projeto — verificável: `atma aligner`, `atma dental` e `atma odontologia` não aparecem na medida.
- **SC-003**: A página continua fazendo **duas** leituras ao Search Console por render, o mesmo
  número de antes desta feature.
- **SC-004**: Nenhum dos três estados de ausência renderiza `0`.
- **SC-005**: A suíte reprova se alguém alimentar a medida com a forma de linha errada — o defeito
  desta spec não pode voltar em silêncio pela dimensão seguinte.

## Assumptions

- O board `okr-Saw2eoSKZDPLJAk6xeDBuS` é o board **da Atma**, e a folha mede a Atma — premissa já
  declarada por escrito pela 033 no cabeçalho da mesma página.
- Os dois hosts declarados (`usealigner.com` + `atma.roilabs.com.br`) continuam sendo somados. A
  migração de 11/09/2026 ainda não transferiu o inventário: o domínio novo sozinho tem 29 termos, 56
  impressões e **zero** consulta na faixa 4–10 fora a marca. Medir só ele publicaria `0` e chamaria
  de colapso uma propriedade de dias de idade.
- A faixa `[4, 11)` é a mesma da função existente. Esta spec não redefine a faixa; ela a reusa.
- A meta de 15% a 25% continua **meta**, não régua: `balizador.tipo` segue `recusa` e a folha segue
  `◇ sem fonte`.
- A janela é a Descoberta (28 dias, fecha em D-3), a mesma das outras medidas da página.
