# Feature Specification: Marca e não-marca — separar a demanda que já é sua da que ainda não é

**Feature Branch**: `025-marca-e-nao-marca`

**Created**: 2026-09-08

**Status**: Draft

**Input**: User description: "spec 025 — marca, para a Atma"

## Contexto

Duas medidas do board dependem de separar quem busca **pelo nome da Atma** de quem busca **pelo
problema que ela resolve**:

| Medida do board | Meta |
|---|---|
| Crescimento de Impressões Não-Marca | 5% a 10% ao mês em setor estável; > 15%/mês em tração |
| Proporção de Buscas de Marca (Brand Demand Ratio) | crescimento contínuo do volume pelo nome |

São medidas opostas e é isso que as torna úteis juntas: **marca subindo** é o algoritmo ganhando
um validador de entidade real; **não-marca subindo** é o site alcançando gente que ainda não
conhece a Atma. Um número só, somando os dois, esconde qual dos dois se moveu.

Hoje `hub_gsc_dia` guarda `impressoes` e `cliques` **do site inteiro**, sem separação. E a
separação já é usada para decidir na casa — o card do sirius traz *"cliques não-branded = 2
(branded = 4)"*, medido à mão via API com `query × page × country`, e um gate escrito em cima
disso (*"≥ 5 cliques não-branded/28d"*). A distinção já vale dinheiro; ela só não é automática.

Há ainda uma dívida visível na tela: a canibalização entregue pela 021 lista **`atma aligner` com
8 URLs disputando**, e como não há lista de marca eu deixei um parágrafo pedindo ao leitor que
ignore aquela linha. Busca pelo nome da empresa traz o site inteiro por construção — isso nunca
foi canibalização.

**Escopo: só a Atma** (`SLUGS_DE_BUSCA = ["atma"]`).

## ⚠️ A armadilha que decide esta spec

O `CLAUDE.md` do repo já registra o problema, medido:

> **Impressão pede `dimensions: []`; clique não-branded pede `query`.** Com a dimensão `query` o
> GSC omite as raras e a soma vira piso: **5 contra 33 no tapepro**. Trocar os dois inventa
> quedas.

Isso **invalida a solução mais óbvia** — e é a que eu mesmo propus no handoff de 07/09:
"grava o total e as impressões de marca; não-marca é a subtração". Não é:

- o **total** vem sem dimensão de consulta e **inclui** as buscas raras;
- a fatia de **marca** vem identificada por consulta e **exclui** as raras;
- `total − marca` devolve, portanto, *não-marca **mais** as buscas de marca que o Google
  anonimizou* — e faz o não-marca parecer maior do que é, justamente o KPI que se quer ver
  crescer.

Sobra uma pergunta que **não pode ser respondida por leitura de documentação, só por medição**:
filtrar por consulta **sem pedir a consulta como dimensão** preserva as buscas raras? Se
preservar, marca e não-marca fecham com o total e as duas são medidas completas. Se não
preservar, as duas são **pisos** e a tela tem que dizer isso.

Esta spec exige que a **primeira corrida responda essa pergunta** comparando a soma das partes
contra o total independente — no espírito de "a primeira corrida mede o check", que esta base já
pagou quatro vezes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A série passa a saber quem buscou pelo nome (Priority: P1)

A corrida diária que já grava a série do Search Console passa a gravar também quanto daquele dia
veio de busca pela marca. O histórico que já existe desde 11/01/2026 é preenchido
retroativamente, para as duas medidas nascerem com passado em vez de esperar um trimestre.

**Why this priority**: é a base das outras duas histórias, e sem ela nenhum dos dois KPIs existe.

**Independent Test**: conferir que, para um dia qualquer já gravado, existe o valor de marca ao
lado do total, e que o backfill cobriu a mesma janela que a série do total já cobre.

**Acceptance Scenarios**:

1. **Given** a lista de termos de marca declarada para o projeto, **When** a corrida executa,
   **Then** cada dia passa a ter impressões e cliques de marca ao lado dos totais.
2. **Given** que a série do total já cobre desde 11/01/2026, **When** o backfill executa,
   **Then** a fatia de marca cobre a mesma janela — a medida não começa do dia da entrega.
3. **Given** um projeto sem lista de marca declarada, **When** a corrida executa, **Then** ela
   grava o total como sempre e marca a fatia como **não declarada**, nunca como zero.
4. **Given** a corrida repetida no mesmo dia, **When** ela executa de novo, **Then** o estado
   final é idêntico, como já vale para o total.

---

### User Story 2 - Os dois KPIs, com o rótulo do que a fonte não conta (Priority: P2)

A aba de aquisição mostra a proporção de busca de marca e o crescimento mês a mês das impressões
não-marca, cada um contra a meta do board — e declara se os números são completos ou pisos,
conforme o que a primeira corrida descobrir sobre as buscas anonimizadas.

**Why this priority**: é a entrega visível. Fica depois da US1 porque depende da série separada,
e porque o rótulo de completude depende de uma medição que só a US1 permite fazer.

**Independent Test**: conferir que o crescimento mês a mês compara meses fechados equivalentes, e
que um mês parcial não é comparado com um mês inteiro.

**Acceptance Scenarios**:

1. **Given** a série separada com pelo menos dois meses fechados, **When** a aba carrega,
   **Then** o crescimento de impressões não-marca aparece contra a faixa de 5-10% ao mês do board.
2. **Given** que o mês corrente ainda não fechou, **When** o crescimento é calculado, **Then** ele
   compara meses **fechados** — um mês pela metade contra um mês inteiro produziria uma queda que
   não existe.
3. **Given** a série separada, **When** a aba carrega, **Then** a proporção de buscas de marca
   aparece com a janela declarada.
4. **Given** que a soma de marca e não-marca não fecha com o total independente, **When** os
   números são exibidos, **Then** a tela declara os dois como **pisos** e diz o tamanho da
   diferença — nunca apresenta como cobertura completa.

---

### User Story 3 - A canibalização para de acusar a própria marca (Priority: P3)

Com a lista de marca disponível, a canibalização deixa de listar buscas pelo nome da Atma, e o
parágrafo que hoje pede ao leitor para ignorar aquelas linhas sai da tela.

**Why this priority**: é a menor das três em esforço e a mais direta em resultado — troca uma
ressalva escrita por um filtro real. Fica por último porque depende da mesma lista e não bloqueia
nada.

**Independent Test**: conferir que uma consulta contendo termo de marca não aparece na
canibalização, e que uma consulta genérica atendida por duas URLs continua aparecendo.

**Acceptance Scenarios**:

1. **Given** a lista de marca declarada, **When** a aba carrega, **Then** consultas de marca não
   aparecem na lista de canibalização.
2. **Given** que consultas de marca foram removidas, **When** a aba carrega, **Then** a tela diz
   **quantas** foram removidas por serem de marca — sumir em silêncio esconderia um filtro largo
   demais.
3. **Given** um projeto sem lista de marca declarada, **When** a aba carrega, **Then** o
   comportamento atual é preservado, com a ressalva de hoje.

---

### Edge Cases

- **🚩 A soma das partes pode não fechar com o total**, pelo motivo já medido no tapepro (5 contra
  33). É o edge case principal e a razão de a US2 exigir o rótulo.
- **🚩 Lista de marca pobre erra para o lado que agrada.** Esquecer uma variante ("atma
  alinhadores", um erro de digitação frequente) tira aquela busca do balde de marca e a joga no de
  não-marca — inflando exatamente o KPI que se quer ver subir. **A direção do erro é
  favorável, e por isso perigosa**; a tela precisa mostrar a lista usada para que quem lê possa
  desconfiar dela.
- **🚩 Sem corte por país, marca mente.** Já registrado em
  `gsc_branded_position_polluted_by_country`, e é por isso que a medição à mão do sirius usou
  `country`. Busca pelo nome vinda de outro país tem comportamento diferente e contamina a razão.
- **Termo de marca que também é palavra comum**: uma marca cujo nome é uma palavra genérica
  classificaria buscas genéricas como marca. Não é o caso da Atma, mas a regra de casamento
  precisa ser explícita para não virar armadilha no segundo projeto.
- **Mês parcial**: comparar o mês corrente incompleto com o anterior inteiro fabrica queda. O
  mesmo erro da 021 com os dias não fechados do Search Console, uma escala acima.
- **O primeiro mês da série** não tem anterior — crescimento é "ainda não apurável", não 0%.
- **A janela do Search Console desliza na meia-noite UTC** (a mesma tarde já deu 33 e depois 42);
  a data de apuração é carimbada em BRT como no resto da casa.
- **Projeto sem lista de marca** é o estado padrão de todos menos a Atma: nada quebra, nada é
  zerado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir declarar, por projeto, a lista de termos que identificam a
  marca, em local versionado junto da curadoria do projeto.
- **FR-002**: O sistema MUST gravar, por dia, as impressões e os cliques atribuídos a busca de
  marca, ao lado dos totais que já grava.
- **FR-003**: O sistema MUST preencher retroativamente a fatia de marca para toda a janela que a
  série do total já cobre.
- **FR-004**: A ausência de lista de marca MUST produzir o estado **não declarada**, distinto de
  zero, e MUST NOT impedir a gravação dos totais.
- **FR-005**: O sistema MUST aplicar corte por país na atribuição de marca e MUST declarar o
  corte usado na tela.
- **FR-006**: A primeira corrida MUST comparar a soma de marca e não-marca contra o total obtido
  independentemente, e MUST registrar a diferença.
- **FR-007**: Quando a soma não fechar com o total, a tela MUST apresentar marca e não-marca como
  **pisos** e MUST informar o tamanho da diferença.
- **FR-008**: O crescimento de impressões não-marca MUST comparar apenas meses **fechados**, e
  MUST ser exibido contra a faixa de 5% a 10% ao mês do board.
- **FR-009**: O primeiro mês da série MUST exibir "ainda não apurável" para o crescimento, nunca
  0%.
- **FR-010**: A proporção de buscas de marca MUST ser exibida com a janela declarada.
- **FR-011**: A canibalização MUST excluir consultas de marca quando a lista existir, e MUST
  informar quantas consultas foram removidas por esse motivo.
- **FR-012**: A tela MUST tornar visível a lista de termos de marca em uso, para que a
  classificação seja auditável por quem lê.
- **FR-013**: Sem lista declarada, o comportamento atual da canibalização MUST ser preservado.
- **FR-014**: A coleta MUST percorrer apenas os projetos de `projetosDeBusca()`.
- **FR-015**: Repetir a corrida no mesmo dia MUST produzir o mesmo estado final.

### Key Entities

- **Termo de marca**: uma variante do nome do projeto pela qual as pessoas o procuram. Curadoria
  humana, versionada, auditável na tela.
- **Dia separado**: a medição de um dia com o total e a fatia atribuída à marca. Não-marca é
  derivado — e a spec exige saber se é derivado **exato** ou **piso**.
- **Crescimento mensal**: a variação das impressões não-marca entre dois meses fechados
  consecutivos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 2 medidas do board saem de ausentes para exibidas — o placar vai de 22 para 24
  de 28, que é o teto realista declarado no handoff de 07/09.
- **SC-002**: A fatia de marca cobre a mesma janela histórica que o total já cobre, sem esperar
  um trimestre.
- **SC-003**: Está registrado, com número, se a soma de marca e não-marca fecha com o total — e a
  tela reflete a resposta.
- **SC-004**: Nenhum crescimento mensal é calculado contra um mês parcial.
- **SC-005**: A lista de termos de marca em uso é visível para quem lê os números.
- **SC-006**: A canibalização da Atma deixa de listar buscas pelo nome da empresa, e o parágrafo
  de ressalva sai da tela.

## Assumptions

- **A lista de termos de marca é curadoria humana**, declarada no card do projeto, como
  `familia`, `estado` e `blockersLista` já são. Derivá-la automaticamente do nome do domínio
  erraria nas variantes, que são justamente o que importa.
- **Backfill é possível e obrigatório.** A série diária aceita filtro por consulta em janela
  passada, então a fatia de marca pode ser reconstruída para os mesmos dias que a 021 já
  gravou. Corrige o que o handoff de 07/09 afirmou: **esta feature não tem urgência de
  calendário** — diferente da 021, esperar não custa histórico.
- **A subtração não é confiável até prova em contrário.** A spec trata "não-marca" como derivado
  cuja exatidão depende de uma medição (FR-006), e não como fato.
- Reusa a corrida e a tabela da 021 em vez de criar uma segunda série paralela: duas séries do
  mesmo Search Console divergiriam na primeira mudança de janela.
- Reusa o padrão das 021/022/023/024 — cron dispara endpoint autenticado, trabalho no servidor,
  escrita idempotente, fora das janelas do Princípio IV. Nenhuma credencial nova.
- A cadência acompanha a corrida diária que já existe.

## Out of Scope

- **Posição média por marca/não-marca**: o board não pede, e a posição média separada tem o
  mesmo problema de país que a razão tem, com menos valor.
- **Classificar intenção da consulta** (informacional, comercial): é a medida CLIQUE-5, entregue
  pela 024.
- **Decidir o que fazer** quando o não-marca não cresce. A feature mede.
- **Lista de marca para os outros 34 projetos**: escopo é a Atma. A estrutura aceita os demais no
  dia em que entrarem em `SLUGS_DE_BUSCA`.
