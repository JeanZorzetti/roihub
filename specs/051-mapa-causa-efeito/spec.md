# Feature Specification: O mapa de GSC como árvore de causa e efeito — a aresta até o dinheiro, as três classes e a fila 80/20

**Feature Branch**: `051-mapa-causa-efeito`

**Created**: 2026-09-21

**Status**: Draft

**Input**: User description: quatro perguntas do dono sobre `/gsc/mapa` em 21/09/2026 — *medimos tudo? vale
decompor em árvore de causa e efeito (Kaplan e Norton)? vale separar preditiva de resultado (4DX)? vale achar
onde o esforço pequeno rende muito (Koch, 80/20)?* — e a instrução que abre esta spec: **"Não se esqueça de:
2. Árvore de causa e efeito (BSC)? Sim no princípio, não no formato · 3. Leading × lagging (4DX)? Sim, mas são
três classes, e o indicador preditivo de verdade não está no mapa · 4. 80/20? Sim, e a concentração passa
muito de 80/20"**. Análise completa em `handoff/handoff-analise-mapa-gsc-bsc-4dx-8020.md`.

> Numeração: `specs/` termina em 036, mas 037–050 já nomeiam as folhas medidas do mapa nos commits e nos
> handoffs. Esta spec é a **051** para não colidir.

## O fato que abre esta spec

Medido no ar em 21/09/2026 (janela do GSC 22/08 → 18/09; cadeia da Atma 31/07 → 21/09):

1. **O mapa é uma lista agrupada, não uma árvore.** Os 4 ramos (CLIQUE, CTR, POSIÇÃO MÉDIA, IMPRESSÕES) levam
   o nome das métricas do Search Console, mas as folhas não entram na conta do ramo. O ramo CLIQUE **não tem
   número de clique**: guarda CTR por posição, penetração no Top 3, striking distance e crescimento não-marca.
   Pela regra do template N0–N6, "filha só é filha se entra na conta da mãe".
2. **Só uma relação fecha por conta:** cliques = Σ impressões × CTR por faixa de posição. Ela já está
   calculada nas 6 faixas do nó "Posição no Google" (posições 7–10: 22.770 de 23.330 impressões). CWV,
   schema, links, frescor e índice são **hipótese causal** sobre posição e CTR, sem coeficiente conhecido — e
   o hub já proíbe somar ou compor esses efeitos.
3. **O mapa termina em CLIQUE, e o dinheiro fica em outra tela.** A cadeia da Atma vive em `/okr/atma` sem
   ligação com o mapa: **55 leads → 22 responderam → 7 orçamentos enviados → 0 tratamentos**. A própria
   ficha diz: *"nada em performance, indexação ou copy move este projeto enquanto este fator for zero"*.
4. **A fila de prioridade já existe e ninguém chama.** A fila de trabalho por moeda do hub (ordena dentro
   de cada moeda, nunca soma) tem teste e nenhuma tela a consome.
5. **A concentração é extrema:** 1 de 29 URLs com impressão tem 93,9% do tráfego decidível
   (`/blog/quanto-custa-alinhador-invisivel`, 20.887 de 22.248 impressões) e o hub já calcula **153 cliques
   por 28 dias** abaixo da régua nela. Uma fila ligada hoje a poria em primeiro.

## Clarifications

### Session 2026-09-21

- Q: O valor em reais da cadeia — o mapa mostra dinheiro, e com qual regra? → A: **O mapa mostra só
  contagens.** `/okr/atma` passa a valer cada pessoa pelo **último orçamento** dela, não pela soma das
  revisões. Valor em aberto hoje: R$ 10.907,98, contra R$ 24.670,98 somando.
- Q: A ação semanal das alavancas é só nomeada ou também contada? → A: **Só nomeada no nó.** Não existe
  fonte para contar "título reescrito" ou "indexação pedida", e contar fica para uma feature futura.

## Decisões já tomadas pelo dono (21/09/2026)

- **BSC: sim no princípio, não no formato.** Nada de redesenhar o mapa nas 4 perspectivas (feitas para unidade
  de negócio, não para um canal). O que entra é a ligação de cada medida com o resultado financeiro.
- **4DX: três classes, não duas** — resultado, alavanca, higiene. O indicador preditivo de verdade é contagem
  de ação por semana e não está no mapa; chamar uma folha de "preditiva" é hipótese não testada.
- **80/20: sim**, pela fila de prioridade.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ver onde o mapa encontra o dinheiro (Priority: P1)

O dono abre `/gsc/mapa` e, sem sair da tela, vê o que vem depois de CLIQUE: a cadeia da Atma até o tratamento
iniciado, cada degrau com número, janela e fonte, e qual degrau trava. No mesmo mapa, as relações que somam
(cliques = impressões × CTR por faixa; os degraus da cadeia) aparecem diferentes das que são hipótese (as
folhas técnicas e de conteúdo sobre posição e CTR).

**Why this priority**: é a lição central da BSC — medida que não se liga ao resultado financeiro é lista. Hoje
o mapa inteiro otimiza uma cadeia cujo último degrau é zero, e a tela não mostra isso.

**Independent Test**: abrir `/gsc/mapa` e `/okr/atma` no mesmo dia e conferir que os 4 números da cadeia são
iguais nas duas telas e que o degrau zerado aparece marcado por texto.

**Acceptance Scenarios**:

1. **Given** a cadeia da Atma com tratamento iniciado = 0, **When** o mapa abre, **Then** ele mostra os quatro
   degraus com os mesmos números de `/okr/atma` no mesmo dia, com janela e fonte, e marca por escrito
   "trava em tratamento iniciado".
2. **Given** cliques numa janela de 28 dias e leads na janela da época, **When** o mapa mostra os dois lado a
   lado, **Then** nenhuma taxa entre eles é calculada, e a tela diz que as janelas são diferentes.
3. **Given** a fonte da cadeia fora do ar, **When** o mapa abre, **Then** o bloco mostra "erro na fonte", nunca
   zeros.
4. **Given** o leitor sem distinguir cores, **When** ele olha as ligações, **Then** ele separa "soma" de
   "hipótese" pelo rótulo.

---

### User Story 2 — Saber se cada folha é resultado, alavanca ou higiene (Priority: P2)

Cada uma das 31 folhas de métrica carrega uma das três classes, escrita no nó. As **alavancas** dizem qual ação
semanal as move e que o efeito no resultado é hipótese. As de **higiene** dizem que, passado o limiar, não se
espera ganho. As de **resultado** dizem que são a reação do Google, com atraso de dias a meses.

**Why this priority**: é o que transforma o mapa de "32 números" em "8 coisas que a equipe move amanhã". Sem a
classe, o leitor trata um LCP que já passa como se fosse alavanca.

**Independent Test**: a verificação automática falha quando uma folha nova entra sem classe; a tela mostra a
classe em todas as 31 folhas de métrica e em nenhum procedimento.

**Acceptance Scenarios**:

1. **Given** o catálogo de folhas, **When** alguém acrescenta uma folha de métrica sem classe, **Then** a
   verificação automática reprova.
2. **Given** a classificação desta spec, **When** o mapa abre, **Then** o leitor conta 15 resultado, 8 alavanca e
   8 higiene, e o checklist do GSC sem classe.
3. **Given** uma folha de alavanca, **When** o leitor abre o nó, **Then** ele lê a ação semanal que a move e
   que o poder preditivo não foi testado.

---

### User Story 3 — Ver primeiro o que rende mais (Priority: P3)

No topo do mapa, uma fila lista as folhas com distância medida até a régua, da maior para a menor **dentro de
cada moeda** (cliques; pontos percentuais; px/ms). Moedas nunca se misturam numa lista, e nenhum total aparece.
Hoje, o primeiro item em cliques é o post de preço, com 153 cliques por 28 dias abaixo da régua.

**Why this priority**: é o 80/20 como mecanismo, não como opinião. Vem depois da US1 porque, enquanto o último
degrau da cadeia for zero, a fila de SEO otimiza um fator que multiplica zero — a US1 é o que deixa isso
visível.

**Independent Test**: com a janela de hoje, o primeiro item da fila em cliques é o post de preço; a tela não
mostra soma em lugar nenhum.

**Acceptance Scenarios**:

1. **Given** o post de preço 153 cliques abaixo da régua, **When** o mapa abre, **Then** ele é o primeiro item
   do bloco em cliques.
2. **Given** itens em moedas diferentes, **When** a fila é montada, **Then** eles aparecem em blocos separados.
3. **Given** dois itens que contam os mesmos cliques (o post está dentro da faixa 7–10), **When** os dois
   aparecem, **Then** a fila diz que eles se sobrepõem e não soma.
4. **Given** nenhuma folha abaixo da régua, **When** o mapa abre, **Then** a fila diz "nada abaixo da régua
   nesta janela", nunca um bloco vazio.
5. **Given** folhas sem régua ou sem amostra, **When** a fila é montada, **Then** ela diz quantas ficaram de
   fora e por qual motivo.

---

### Edge Cases

- A época da Atma muda (novo corte do negócio): a janela da cadeia muda junto, e o mapa segue a de `/okr/atma`.
- Amostra que não decide (intervalo de confiança atravessa a régua): a folha não entra na fila com distância.
- Folha muda de natureza (ganha régua, perde coletor): a classe continua valendo; a fila só muda pela régua.
- Métricas mensais por definição (crescimento não-marca, buscas de marca): não entram na fila.
- Em 360px o canvas é decorativo: cadeia, classes e fila precisam estar também na lista servidor.
- Pessoa com dois orçamentos no mesmo minuto: vale o mais recente pela data de criação; empate na data,
  vale a última linha na ordem da fonte.
- Orçamento sem pessoa identificável (órfão): continua no balde "sem lead", pelo próprio valor.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O mapa MUST mostrar, depois de CLIQUE, a cadeia da Atma (lead → respondeu → orçamento enviado →
  tratamento iniciado) com número, janela e fonte de cada degrau, iguais aos de `/okr/atma` no mesmo dia — uma
  conta só, nunca uma segunda implementação.
- **FR-002**: O mapa MUST marcar por texto o degrau onde a cadeia trava.
- **FR-003**: O mapa MUST NOT calcular taxa entre números de janelas diferentes, e MUST dizer por quê.
- **FR-004**: O mapa MUST distinguir as relações que somam das hipóteses causais, com legenda legível sem cor.
- **FR-005**: Toda folha de métrica MUST ter exatamente uma classe (resultado, alavanca, higiene); procedimento
  não tem classe. Uma verificação automática MUST reprovar folha sem classe ou com classe desconhecida.
- **FR-006**: Folha de alavanca MUST nomear a ação semanal que a move e dizer que o efeito é hipótese não testada.
- **FR-007**: Folha de higiene MUST dizer que, passado o limiar, não se espera ganho.
- **FR-008**: O mapa MUST mostrar uma fila com as folhas que têm distância medida até a régua, ordenada dentro
  de cada moeda, sem misturar moedas e sem total.
- **FR-009**: A fila MUST declarar sobreposição entre itens que contam os mesmos cliques.
- **FR-010**: A fila MUST dizer quantas folhas ficaram de fora e por qual motivo (sem régua, sem amostra, sem
  coletor).
- **FR-011**: Cadeia, classes e fila MUST aparecer também na lista servidor, não só dentro do mapa.
- **FR-012**: O mapa MUST mostrar só **contagens** na cadeia, nunca valor em reais.
- **FR-012a**: `/okr/atma` MUST valer cada pessoa pelo **último orçamento** dela (o mais recente na janela,
  líquido de desconto) no valor em aberto e no valor perdido. Hoje os 4 pacientes vivos têm 2 orçamentos
  cada, criados com minutos de diferença (revisões ou alternativas do mesmo tratamento): R$ 10.907,98 em
  aberto, não R$ 24.670,98. O total **enviado** continua contando documentos e diz isso no rótulo.
- **FR-012b**: O ticket de `/okr/atma` MUST usar a mesma regra: média do último orçamento de cada pessoa.
  Resolve o viés que o próprio código declara ("quem pediu 2 orçamentos pesa o dobro na média").
- **FR-013**: A ação semanal das alavancas MUST ser só nomeada no nó, sem contagem.

### Key Entities

- **Classe da folha**: resultado, alavanca ou higiene; uma por folha de métrica; ausente no procedimento.
- **Ação semanal**: o verbo contável que move uma alavanca (ex.: "títulos reescritos por semana").
- **Degrau da cadeia**: lead, respondeu, orçamento enviado, tratamento iniciado — número, janela, fonte.
- **Ligação**: "soma" (identidade aritmética) ou "hipótese" (efeito causal sem coeficiente).
- **Item da fila**: folha, distância, moeda, sobreposição declarada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Olhando só o mapa, o leitor diz em até 5 segundos qual degrau trava a receita (hoje: tratamento
  iniciado = 0).
- **SC-002**: 31 de 31 folhas de métrica mostram a classe, e acrescentar uma folha sem classe reprova a suíte.
- **SC-003**: O primeiro item da fila em cliques é o de maior distância medida (hoje: o post de preço, 153
  cliques/28d), e a tela não mostra nenhum total.
- **SC-004**: Zero divergência entre os números da cadeia no mapa e em `/okr/atma` numa comparação no mesmo dia.
- **SC-005**: Em 360px, a lista servidor carrega cadeia, classes e fila.
- **SC-006**: `/okr/atma` publica o valor em aberto pelo último orçamento de cada pessoa (hoje R$ 10.907,98), e
  o valor em aberto somado ao perdido é igual à soma dos últimos orçamentos das pessoas da janela.

## Assumptions

- O board é **só da Atma** (decisão de 07/09/2026); cadeia e fila leem só a Atma.
- A classificação é a da análise de 21/09: **resultado (15)** — CTR por posição, CTR Gap, % de URLs acima do
  benchmark, impressões no Top 3, penetração no Top 3, striking distance, crescimento não-marca, footprint,
  Top 20, consultas por página, active index, buscas de marca, TAM, reescrita de título, referring domains;
  **alavanca (8)** — largura do título, termo no título, intenção, schema, links internos, canibalização,
  frescor, cobertura semântica; **higiene (8)** — LCP, INP, CLS, TTFB, pass rate, indexação limpa, rejeição de
  rastreio, profundidade de clique.
- A fila usa as réguas e o veredito por amostra que já existem; nenhuma régua nova nasce aqui.
- Fora de escopo: coletor novo, as 3 folhas sem coletor, reescrever o texto do board, e as 4 perspectivas da BSC.
