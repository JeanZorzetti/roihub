# Feature Specification: Árvore de metas — a descida da meta declarada até a entrega

**Feature Branch**: `016-okr-arvore-de-metas`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "Uma árvore de metas extremamente granularizada: cada camada com critérios numéricos a bater para alcançar o objetivo final, cruzando o máximo de dados que temos com benchmark de mercado, e na última camada o COMO."

## Contexto

A `/okr/<slug>` de hoje é um **diagnóstico**: diz qual número está quebrado (`§7.1 — fator ZERADO`)
e onde consultar o que falta. O pedido original era outro — uma **árvore de metas**: a meta
declarada dividida camada a camada até virar entrega semanal.

A 010 (`lib/projecao.mjs`) já faz **um** passo dessa divisão e para. Ela para porque
`ancoraDe()` percorre os marcos do topo e interrompe no primeiro `não apurado`: na `atma` a âncora
é `lead` (índice 1), e os quatro degraus abaixo dela ficam fora da conta. O resultado é
`fator obrigatório 9,49%` — verdadeiro, e mudo sobre quantos orçamentos, cliques ou impressões
isso exige.

Esta feature desce o resto do caminho, e desce **por divisão**, nunca por projeção.

### A tensão com a R6, e por que esta feature não a viola

A R6 (`benchmark é ontologia, nunca previsão`) nasceu de empilhar o percentil de **elite em quatro
estágios seguidos** para prever receita — barra de erro de 56×. A 015 já registrou a leitura
correta: **o defeito é a multiplicação, não a comparação.**

| | |
|---|---|
| ❌ Proibido pela R6 | `35.294 × 8% × 42,5% × 62,5% × 40%` → "€1,8M de ARR". Benchmark como **previsão**, multiplicado pra frente. |
| ✅ 010 (precedente aberto) | `meta ÷ âncora` — divisão sobre meta **declarada pelo humano**. Nenhum número novo entra no sistema. |
| ✅ Esta feature | A mesma divisão, continuada. Onde temos taxa apurada, usa a **nossa**. Onde não temos, **uma** faixa de mercado, e a faixa vira **banda** — nunca ponto. |

O que a R6 impede é o produto de quatro faixas apresentado como um número. A trava aqui é
aritmética, não estilística: **no máximo uma faixa de mercado na descida inteira**. A segunda
faixa que fosse necessária **para a árvore** e devolve o degrau que parou.

### As três origens de divisor, em ordem de prioridade

1. **Apurado consecutivo** — os dois lados do degrau apurados na janela. `visitante → lead = 5,83% (31/532)`.
2. **Ponte** — os dois extremos de um trecho apurados, com buraco no meio. `lead → orçamento = 16,13% (5/31)`, atravessando `contato feito`, que não tem coletor. É medida real; ela só não diz **onde dentro do trecho** a perda acontece. **A `/okr` de hoje tem os dois números na tela e nunca calcula esta taxa**, porque a cadeia só divide degraus consecutivos.
3. **Faixa de mercado** — a tabela da 015 (`lib/benchmark.mjs`), quando 1 e 2 não existem.

**Divisor apurado de valor `0` não serve como divisor.** Não é preferência: é divisão por zero.
Na `atma`, `orçamento → tratamento` é `0/5 = 0%` apurado — e é exatamente esse zero que autoriza a
única faixa de mercado da descida (`case acceptance` de paciente novo, 25–35%). Benchmark entra
onde a nossa medição **não consegue dividir**, nunca onde ela conseguiria.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver quanto cada camada precisa valer para a meta fechar (Priority: P1)

Jean abre `/okr/atma` com a meta de R$ 50.000 declarada. Em vez de um único
`fator obrigatório 9,49%`, ele vê a cadeia inteira dividida de baixo para cima: quantos
tratamentos, quantos orçamentos, quantos leads, quantos cliques e quantas impressões a meta exige
na janela — cada camada com o que existe hoje ao lado e o multiplicador que falta.

**Why this priority**: é o pedido inteiro. Sem esta história a feature não existe.

**Independent Test**: abrir `/okr/atma` e conferir que a árvore desce da meta até impressões, com
`necessário`, `hoje` e `gap` em cada camada, e que o gap de todas as camadas é idêntico quando
nenhuma taxa é alterada.

**Acceptance Scenarios**:

1. **Given** meta declarada, cadeia com taxas apuradas e uma faixa de mercado, **When** a página é aberta, **Then** cada camada exibe `necessário (banda) · hoje · gap (banda)` e o divisor usado, rotulado por origem (`apurado`, `ponte`, `mercado`).
2. **Given** um trecho com buraco no meio e os dois extremos apurados, **When** a árvore desce por ele, **Then** o divisor é a **ponte**, rotulada nomeando os degraus que ela atravessa — nunca uma faixa de mercado.
3. **Given** a meta da `atma` (R$ 50.000 / R$ 4.000 / 2026-12-31), **When** a árvore desce, **Then** ela exige `8,4–11,8 orçamentos`, `52–73 leads`, `894–1.252 cliques` e `56.600–79.200 impressões` na janela de 28 dias.

---

### User Story 2 - Não receber árvore onde ela seria chute (Priority: P1)

Jean abre a ficha de um projeto sem meta declarada, ou de um perfil cuja cadeia exigiria duas
faixas de mercado. Em vez de uma árvore plausível, a tela para na camada onde faltou divisor e diz
qual degrau parou e por quê.

**Why this priority**: sem esta história a feature vira a projeção de €1,8M que a R6 recusa. As
duas P1 nascem juntas ou nenhuma nasce.

**Independent Test**: rodar a árvore com uma cadeia que exigiria duas faixas e conferir que ela
para na segunda, nomeando o degrau.

**Acceptance Scenarios**:

1. **Given** uma descida que já consumiu uma faixa de mercado, **When** um segundo degrau também não tem divisor apurado nem ponte, **Then** a árvore para nesse degrau, e a camada exibe `sem divisor` com o nome do degrau e o motivo.
2. **Given** um projeto sem meta, ticket ou prazo declarado, **When** a página é aberta, **Then** a árvore herda o motivo exato da 010 (`sem meta declarada`, `sem ticket declarado`...) e não exibe camada nenhuma.
3. **Given** um degrau cujo divisor apurado é `0`, **When** a árvore desce por ele, **Then** o divisor apurado é recusado com o motivo `taxa apurada em 0 — não divide` e a faixa de mercado é consultada.
4. **Given** um degrau sem linha na tabela de benchmark (`sem régua` da 015), **When** a árvore precisa dele, **Then** ela para — nunca estima a faixa.

---

### User Story 3 - Saber quantas páginas publicar por semana (Priority: P2)

Jean vê, embaixo da camada de impressões, quantas páginas a meta exige e em que ritmo: as
impressões que faltam divididas pelas impressões médias por página **apuradas no próprio site**,
e o total dividido pelas semanas até o prazo.

**Why this priority**: é a resposta à pergunta "o que eu faço segunda" em número, mas depende das
camadas 1 e 2 existirem primeiro. Entrega valor sozinha assim que a US1 estiver de pé.

**Independent Test**: conferir que `páginas necessárias × impressões médias por página ≈ impressões
que faltam`, e que o ritmo semanal bate com as semanas restantes até o prazo.

**Acceptance Scenarios**:

1. **Given** impressões por página apuradas no GSC na janela, **When** a árvore desce abaixo de impressões, **Then** ela exibe `páginas necessárias` (banda) e `páginas por semana` até o prazo.
2. **Given** menos de 3 páginas com impressão na janela, **When** a média por página seria calculada, **Then** ela sai `não apurada` — média de amostra mínima não vira meta de publicação.
3. **Given** a árvore parou antes da camada de impressões, **When** a camada de entrega seria montada, **Then** ela não aparece.

---

### User Story 4 - Ver a alavanca de posição como alternativa a publicar (Priority: P3)

Jean vê que o mesmo gap fecha por dois caminhos: mais páginas, ou posição melhor nas páginas que
já rankeiam. A árvore mostra qual CTR a meta exigiria sem publicar nada, e a que posição média
esse CTR corresponde na curva de mercado.

**Why this priority**: muda a decisão (publicar × consertar), mas a US3 sozinha já entrega um
número acionável.

**Independent Test**: conferir que o CTR alvo × impressões de hoje = cliques necessários da US1.

**Acceptance Scenarios**:

1. **Given** cliques necessários e impressões de hoje, **When** a alavanca é montada, **Then** a tela exibe o `CTR alvo` e a faixa de posição correspondente na curva de mercado, rotulada como faixa.
2. **Given** que a curva de posição é uma faixa de mercado, **When** a descida já consumiu a sua única faixa, **Then** a alavanca é exibida como **leitura paralela**, fora da conta da árvore — nunca como divisor de uma camada.

### Edge Cases

- **Prazo vencido ou âncora zerada** — herdado da 010; a árvore não monta.
- **Janela encurtada** (`diasRestantes < janelaDias`) — a normalização da 010 já cobre; a árvore usa o mesmo `n1Janela` e não recalcula.
- **Perfil sem `fatores` declarados** (A, B, C hoje) — a descida usa a cadeia de `marcos`, que todo perfil tem; `fatores` é do N2 e não entra aqui.
- **Ponte que atravessa a cadeia inteira** — se `visitante` e o marco final forem os únicos apurados, a ponte cobre tudo e a árvore tem duas camadas. É correto e deve sair rotulado como tal.
- **`hoje` maior que o necessário** numa camada — o gap sai `< 1×` e a camada é rotulada `já cobre`, sem virar número negativo.
- **CTR de `0` impressões** — `razao()` já recusa `0/0`; a camada de impressões sai `não apurada`.
- **Faixa invertida na tabela** (`min > max`) — erro de dado, não de conta: a árvore para e nomeia a linha.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A árvore MUST descer da meta declarada até a camada mais baixa alcançável, uma camada por degrau da cadeia, do fim para o começo.
- **FR-002**: O divisor de cada camada MUST ser escolhido nesta ordem: (1) taxa apurada entre degraus consecutivos, (2) ponte entre os dois extremos apurados mais próximos, (3) faixa de mercado da 015. A primeira que existir vence.
- **FR-003**: Divisor apurado de valor `0` MUST ser recusado (divisão por zero) com motivo próprio, e a escolha MUST seguir para a próxima origem.
- **FR-004**: A descida MUST consumir **no máximo uma** faixa de mercado. Um segundo degrau sem divisor apurado nem ponte PARA a árvore.
- **FR-005**: Consumida a faixa, toda camada acima MUST ser exibida como banda `mín…máx`, nunca como ponto.
- **FR-006**: Toda camada MUST declarar a origem do seu divisor (`apurado`, `ponte`, `mercado`), e a ponte MUST nomear os degraus que atravessa.
- **FR-007**: Toda camada MUST exibir `necessário`, `hoje` e `gap`, com `gap` só quando `hoje` estiver apurado.
- **FR-008**: A camada de impressões MUST usar o CTR apurado da **mesma** série do GSC que já produz `cliques` — sem chamada nova.
- **FR-009**: A camada de entrega MUST calcular `páginas necessárias` = impressões que faltam ÷ impressões médias por página apuradas na janela, e `páginas por semana` = páginas necessárias ÷ semanas até o prazo.
- **FR-010**: Impressões médias por página MUST sair `não apurada` com menos de 3 páginas com impressão na janela.
- **FR-011**: A alavanca de posição (US4) MUST ser exibida como leitura paralela, nunca como divisor de camada, e MUST declarar a fonte da curva de CTR por posição.
- **FR-012**: Nenhuma camada MUST virar KR automaticamente. A árvore é diagnóstico dimensionado; KR continua declarado à mão (R6, trava 5).
- **FR-013**: A conta MUST reusar `apurado`, `naoApurado`, `ehApurado`, `razao` e `exigencia` de `lib/funil.mjs`. Reimplementar célula, razão ou cadeia é proibido.
- **FR-014**: `lib/okr.mjs` e `lib/projecao.mjs` MUST NOT ser alterados. A árvore recebe `ficha` e `projecao` prontas.
- **FR-015**: A árvore MUST usar a janela única declarada (R7), a mesma de toda a página.
- **FR-016**: Quando a árvore para, ela MUST devolver o degrau que a parou e o motivo, e as camadas já montadas MUST continuar visíveis.
- **FR-017**: O teto de demanda por volume de busca (`Nível 0 — DEMANDA`) MUST ficar **fora** desta feature. Decidido em 2026-09-03: o roihub não tem credencial DataForSEO e não há integração com o OpenSEO Keyword Planner; ligar uma fonte externa nova dentro desta feature atrasaria as camadas que já fecham com GSC. Entra na spec 017. Até lá, a árvore diz quantas impressões a meta exige e **não** afirma que elas existem no mercado — a ausência continua declarada, como já está em `app/okr/page.tsx`.

### Key Entities

- **Camada**: um degrau da árvore. Nome, `necessario` (célula ou banda), `hoje` (célula), `gap` (banda), `divisor` e o degrau da cadeia a que corresponde.
- **Divisor**: a taxa que produziu a camada. Origem (`apurado` | `ponte` | `mercado`), valor ou faixa, degraus cobertos e fonte.
- **Banda**: par `mín…máx` que nasce quando uma faixa de mercado entra na descida e se propaga para cima. Antes da faixa, a banda é degenerada (`mín = máx`).
- **Entrega**: a camada abaixo de impressões. Páginas necessárias, ritmo semanal e a média por página que os produziu.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `/okr/atma` exibe 5 camadas numéricas (tratamento → orçamento → lead → clique → impressão) onde hoje exibe 1 (`fator obrigatório`).
- **SC-002**: Com a meta declarada de 2026-09-01 e janela de 28 dias, a árvore da `atma` exige `2,94` tratamentos, `8,4–11,8` orçamentos, `52–73` leads, `894–1.252` cliques e `56.600–79.200` impressões.
- **SC-003**: O gap é `1,68×–2,35×` e **idêntico** nas quatro camadas acima da faixa — a igualdade é o teste de que nenhuma taxa foi alterada no caminho.
- **SC-004**: Exatamente **uma** faixa de mercado é consumida na descida da `atma` (`orçamento → tratamento`, 25–35%). Um teste FALHA se a árvore compuser duas.
- **SC-005**: A taxa `lead → orçamento = 16,13%` aparece na tela — hoje os dois números que a compõem estão na página e a taxa não existe em lugar nenhum.
- **SC-006**: A camada de entrega exibe `páginas necessárias` e `páginas por semana` sempre que houver ao menos 3 páginas com impressão na janela.
- **SC-007**: `npm test` verde com o novo `test/arvore-metas.test.mjs` registrado em `package.json` no mesmo commit (Princípio II).
- **SC-008**: Nenhuma camada da árvore aparece na tela sem a origem do divisor ao lado — 0 números órfãos.

## Assumptions

- A meta (`valor`, `ticket`, `prazo`) continua declarada à mão em `data/projects.json`; esta feature não cria interface de declaração.
- A tabela de benchmark da 015 (`lib/benchmark.mjs`) é a única fonte de faixa de mercado, e a cobertura dela (10 de 17 degraus) é a cobertura desta árvore.
- A curva de CTR por posição é dado novo, na mesma forma da tabela da 015: faixa com fonte por linha, nunca ponto.
- Impressões por página vêm da mesma API do GSC já usada por `lib/gsc.ts`, com a dimensão `page` — sem credencial nova.
- `atma` é o único projeto com cadeia funda o bastante para exercitar a árvore inteira hoje; os demais vão parar cedo, e parar cedo é comportamento correto, não defeito.
- A árvore é **paralela** à §7, como a régua da 015: ela dimensiona, não decide onde atacar.
