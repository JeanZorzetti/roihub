# Feature Specification: A próxima ação de cada KPI no mapa de GSC

**Feature Branch**: `054-proxima-acao-mapa`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: *"https://hub.roilabs.com.br/gsc/mapa/sirius — precisamos de um template padrão
de melhoria dos 18 pontos em Clique, CTR, Posição Média e Impressões, do tipo: se tiver abaixo de…
fazer tal coisa"*. O dono corrigiu o escopo ("são os 18 KPIs do mapa + suas granularizações") e, entre
documento e tela, escolheu a tela (22/09/2026). O documento já existe e é a base das regras:
`handoff/gsc-template-de-melhoria.md` (`329388d`).

## O fato que abre esta spec

Lido em 22/09/2026 no mapa do Sirius em produção (janela de 28 dias do próprio mapa):

1. **O mapa diz o número e a meta de cada folha, mas não diz o que fazer.** Das 32 folhas, só três
   trazem uma ação na prosa do board (CTR Gap "exige reescrita do Title", Active Index "podar as
   páginas zumbis", Striking Distance "otimização on-page, expansão semântica e link building
   interno"), e a frase aparece igual com a folha abaixo ou acima da meta.
2. **O painel "Primeiro na fila" (051) só enxerga as folhas com régua publicada**: CTR Gap, largura do
   título e os vitais. No Sirius, o primeiro da fila hoje é `/en/blog/whatsapp-api-oficial-meta-crm`
   (78,5% do tráfego, CTR 0,1% contra a régua de 2%). Mas **30 das 114 URLs do sitemap estão fora do
   índice, e 26 delas foram rastreadas e recusadas.** A fila não vê isso porque indexação não tem
   régua publicada. Pela ordem de ataque do template, o índice vem antes do snippet: uma página fora
   do índice tem CTR zero, e reescrever título não muda isso.
3. **Aplicado às leituras de hoje, o template dispara em 16 folhas:**

   | Origem do limiar | Folhas que disparam no Sirius |
   |---|---|
   | ◆ régua publicada (3) | CTR por posição (faixas 4–6 e 7–10 abaixo), CTR Gap (6 URLs, a primeira com CTR abaixo da metade da régua), largura do título (86 de 133 acima de 580px) |
   | ◇ norma, não régua (2) | dados estruturados (8 de 84 URLs sem schema), intenção (81 de 133 títulos sem modificador) |
   | ◇ meta do board, sem fonte (11) | penetração no Top 3 (0 de 18), striking distance (14 consultas), impressões no Top 3 (3%), termo no título (14 URLs), indexação limpa (73,7%), rejeição de rastreio (24,6%), profundidade (43 de 135 a mais de 3 cliques, 29 órfãs), frescor (38 vencidas, 64 sem data), links internos (84 páginas com menos de 5), Top 20 (3 de 18 termos), consultas por página (1,3, piso) |

   Não disparam: crescimento não-marca (+24,8% no mês), canibalização (0), buscas de marca
   (crescentes), footprint (111 consultas contra 42 treze semanas antes) e Active Index (75%). Sem
   leitura: os cinco vitais (sem amostra na CrUX), reescrita do título, cobertura semântica e domínios
   referenciadores (sem coletor), e o TAM (não estimado).
4. **Muitas folhas de resultado pedem a mesma alavanca.** Penetração no Top 3, striking distance e Top
   20 mandam, as três, para links internos e cobertura das páginas dos termos. Mostradas uma a uma, as
   16 ações viram 16 tarefas; somadas por alavanca, são bem menos. O dono precisa ler a semana, não o
   catálogo.

## Clarifications

### Session 2026-09-22

- Q: A meta do board sem fonte (◇) dispara ação? → A: Sim, com a etiqueta "meta do board, sem fonte"
  e aparência diferente do veredito ◆ (FR-006).
- Q: O painel novo substitui o "Primeiro na fila" da 051? → A: Substitui; a ordem por impacto da fila
  passa a ordenar os itens dentro de cada degrau (FR-007, FR-010).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ler no nó o que fazer com a folha (Priority: P1)

O dono abre o mapa de um projeto e, em cada folha, vê ao lado do número se a folha pede ação. Quando
pede, lê a ação curta, o número que a disparou e o limiar. Quando não pede, lê que está dentro. Quando
o mapa não tem leitura, lê por que não há ação.

**Why this priority**: é o pedido literal ("se tiver abaixo de… fazer tal coisa"), e sozinho já
entrega valor: o mapa deixa de ser só leitura e passa a dizer o próximo passo em cada KPI.

**Independent Test**: abrir `/gsc/mapa/sirius`, localizar a folha "Taxa de Indexação Limpa" e ler
"73,7% · abaixo de 95% → tirar do sitemap o que não deve indexar e consertar as 30 fora do índice",
sem abrir nenhum painel.

**Acceptance Scenarios**:

1. **Given** uma folha com leitura abaixo do limiar, **When** o dono olha o nó, **Then** o nó mostra a
   ação, o número lido e o limiar, e diz a origem do limiar (régua publicada, norma ou meta do board).
2. **Given** uma folha com leitura dentro do limiar, **When** o dono olha o nó, **Then** o nó diz
   "dentro" e não mostra ação.
3. **Given** uma folha sem leitura (sem amostra, sem coletor, fonte com erro ou amostra que não
   decide), **When** o dono olha o nó, **Then** o nó diz o motivo e não mostra ação nem "dentro".
4. **Given** uma folha na faixa crítica (ex.: CTR abaixo da metade da régua da posição), **When** o dono
   olha o nó, **Then** o nó marca a ação como crítica.

---

### User Story 2 — Ler o que fazer esta semana, em ordem (Priority: P1)

Antes do mapa, o dono lê um painel com as ações que dispararam, agrupadas pela alavanca que a equipe
move e ordenadas pela ordem de ataque: índice → técnico → página certa para o termo → posição →
snippet. Cada entrada diz quais KPIs a pediram, com o número de cada um, e até três alvos (URL ou
termo).

**Why this priority**: sem ordem, 16 ações disputam a mesma semana, e a fila de hoje põe o snippet na
frente de 30 páginas fora do índice. A ordem é o que transforma o template em plano.

**Independent Test**: abrir `/gsc/mapa/sirius` e, sem clicar em nada, ler que a primeira entrada é a
de índice (30 de 114 URLs fora) e que a reescrita do título de `/en/blog/whatsapp-api-oficial-meta-crm`
aparece no degrau de snippet, depois dela.

**Acceptance Scenarios**:

1. **Given** ações disparadas em degraus diferentes, **When** o painel monta, **Then** os degraus
   aparecem na ordem de ataque, e um degrau sem ação não aparece.
2. **Given** três KPIs de resultado que apontam para a mesma alavanca, **When** o painel monta, **Then**
   a alavanca aparece uma vez, com os três KPIs e os números deles como motivo.
3. **Given** uma ação crítica e uma comum no mesmo degrau, **When** o painel monta, **Then** a crítica
   vem primeiro.
4. **Given** um degrau com itens que o hub já ordena por impacto (cliques não capturados, pontos
   percentuais, milissegundos), **When** o painel monta, **Then** a ordem interna é essa, sem somar
   moedas diferentes.

---

### User Story 3 — Consultar a regra inteira de qualquer folha (Priority: P3)

O dono quer saber o que faria uma folha disparar, mesmo quando ela está dentro. Ao selecionar o nó, e
na versão em lista, lê a regra completa: "se X, fazer Y", com o limiar e a origem dele.

**Why this priority**: é o template servindo de referência. Útil, mas o valor principal (US1 e US2)
existe sem ele.

**Independent Test**: selecionar a folha "Taxa de Canibalização Interna" (dentro, 0) e ler a regra
"duas ou mais URLs alternando na mesma consulta → escolher a canônica e consolidar a outra".

**Acceptance Scenarios**:

1. **Given** qualquer uma das 32 folhas, **When** o dono abre o painel do nó ou a versão em lista,
   **Then** lê a regra dela, ou o motivo de ela não ter regra (o checklist é procedimento).

---

### Edge Cases

- **Leitura de piso** (a dimensão `query` do GSC omite consultas raras): piso acima do limiar passa;
  piso abaixo dispara com a ressalva "piso: o número real pode ser maior".
- **Amostra que não decide** (o intervalo de confiança cruza a régua): não dispara, e diz por quê.
- **Folha medida numa faixa e não em outra** (CTR por posição: posições 1–3 não decidem, 4–10
  abaixo, página 2 sem régua): a ação cita só as faixas que decidiram.
- **Board e hub divergem no limiar** (TTFB 600 × 800 ms, CTR por posição, profundidade 3 × 4
  cliques): vale o número com que o hub mede a folha, e a divergência que o nó já declara continua
  lá.
- **A mesma URL é alvo de dois degraus** (fora do índice e com título largo): ela aparece nos dois,
  e o de índice vem antes.
- **Fonte que falhou na abertura** (GSC, CrUX, crawl ou banco): as folhas dela ficam "sem leitura
  agora", e o painel diz quais degraus podem estar incompletos.
- **Projeto sem inventário, sem marca ou sem TAM**: as folhas que dependem disso ficam sem leitura, com
  o motivo que o mapa já imprime.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cada uma das 32 folhas do catálogo DEVE ter exatamente uma regra declarada (limiar,
  direção, origem do limiar, faixa crítica quando houver, ação, alavanca de destino e degrau da ordem
  de ataque) ou declarar por que não tem regra. As regras partem de
  `handoff/gsc-template-de-melhoria.md`.
- **FR-002**: O limiar de uma folha com régua publicada DEVE ser o mesmo número que o hub usa para
  julgá-la. Nenhum limiar DEVE ser escrito duas vezes, e mudá-lo num lugar DEVE mudar a ação nos
  mapas de todos os projetos.
- **FR-003**: Uma regra só DEVE disparar sobre uma leitura que o mapa já fez. A feature NÃO DEVE
  acrescentar leitura de fonte externa à abertura da página.
- **FR-004**: Cada folha DEVE estar em exatamente um de cinco estados: **dispara**, **crítica**,
  **dentro**, **não decide** (amostra) ou **sem leitura** (com o motivo). "Sem leitura" nunca pode
  aparecer como "dentro".
- **FR-005**: O nó de uma folha que dispara DEVE mostrar, sem clique, a ação curta, o número lido e o
  limiar.
- **FR-006**: Uma folha cujo limiar é meta do board sem fonte (◇) DEVE disparar ação, com a etiqueta
  "meta do board, sem fonte" escrita na ação. O gatilho ◇ NÃO PODE ter a aparência do veredito ◆:
  a meta dispara trabalho, não emite veredito, e a regra de procedência da 028/033 continua de pé
  para o veredito.
- **FR-007**: O painel de ações DEVE substituir o "Primeiro na fila" (051) e listar as ações
  disparadas pela ordem de ataque: índice → técnico → página certa (canibalização, intenção) →
  posição (cobertura, frescor, links internos) → snippet (dados estruturados, título). A ordem por
  impacto que a fila já calcula passa a ordenar os itens dentro de cada degrau (FR-010), e o que a
  fila contava como "fora" continua contado no painel.
- **FR-008**: Uma folha de resultado NÃO DEVE aparecer no painel como ação própria. Ela aparece como
  motivo da alavanca para a qual aponta, com o número dela.
- **FR-009**: Ações que apontam para a mesma alavanca DEVEM virar uma entrada só, com todos os KPIs
  que a pediram.
- **FR-010**: Dentro de um degrau, a ordem DEVE ser: crítica primeiro; depois o impacto, onde o hub
  já o mede numa moeda (cliques não capturados, pontos percentuais, milissegundos), sem comparar
  moedas; depois o número de alvos.
- **FR-011**: Cada ação DEVE nomear até três alvos (URL ou termo) quando a leitura da folha os tem, e
  dizer quantos faltam ("e mais 27").
- **FR-012**: A regra de cada folha, inclusive das que estão dentro, DEVE estar legível no painel do nó
  e na versão em lista, em forma "se X, fazer Y".
- **FR-013**: As regras DEVEM ser as mesmas para todos os projetos com mapa. Nenhuma regra é escrita
  por projeto.
- **FR-014**: Ao entregar, `handoff/gsc-template-de-melhoria.md` DEVE deixar de manter uma segunda
  cópia dos limiares e passar a apontar para a fonte única.
- **FR-015**: O painel e os estados das folhas DEVEM ser legíveis por teclado e leitor de tela, e o
  estado NÃO PODE ser dito só por cor.

### Key Entities

- **Regra**: pertence a uma folha do catálogo. Tem limiar, direção (abaixo/acima), origem (◆ régua
  publicada, ◇ norma, não régua, ◇ meta do board, sem fonte — os selos que a folha já usa), faixa crítica opcional, ação, alavanca de destino e degrau.
- **Disparo**: o resultado de aplicar a regra à leitura do dia. Tem o estado (FR-004), o número lido,
  os alvos e a ressalva (piso, faixa parcial).
- **Degrau**: um passo da ordem de ataque. Agrupa as alavancas e dá a ordem do painel.
- **Alavanca**: o que a equipe move direto (as 8 folhas `alavanca` do catálogo e as de higiene).
  Recebe os disparos das folhas de resultado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Nos mapas da Atma e do Sirius, 32 de 32 folhas mostram um dos cinco estados. Nenhuma
  folha fica sem estado.
- **SC-002**: No Sirius, com as leituras deste documento, a primeira entrada do painel é a de índice
  (30 de 114 URLs fora), e a reescrita do título de `/en/blog/whatsapp-api-oficial-meta-crm` aparece
  depois, no degrau de snippet.
- **SC-003**: Nenhum limiar exibido difere do número com que o hub mede a folha. Um teste reprova se
  divergirem.
- **SC-004**: O dono lê a primeira ação da semana, com o alvo e o número, sem clicar em nenhum nó.
- **SC-005**: Abrir o mapa não faz nenhuma requisição externa a mais do que antes da feature.
- **SC-006**: Uma alavanca pedida por vários KPIs aparece uma vez no painel. No Sirius, links
  internos (pedido por penetração no Top 3, striking distance, Top 20 e pela própria folha) aparece
  uma vez.

## Assumptions

- As regras aprovadas são as do template `329388d`. Ajuste de limiar ou de ação depois disso é edição
  de regra, não mudança desta spec.
- Marca e país seguem o que cada folha já faz (decisão de 21/09 na 052). As condições do §0 do
  template que o hub não conhece (tráfego de país fora do mercado, página alterada há menos de 28
  dias, janela que atravessa migração) ficam fora do cálculo; o painel as imprime como lembrete fixo.
- A contagem semanal de ações (4DX) continua fora, como a 051 decidiu: o hub não tem fonte para
  contar.
- O hub recomenda e não executa. Nenhum site é alterado por esta feature.

## Fora do escopo

- Executar a ação ou abrir tarefa na agenda a partir dela.
- Separar país nas folhas que hoje somam todos os países.
- Criar coletor para as folhas sem coletor (reescrita do título, cobertura semântica, domínios
  referenciadores, TAM).
