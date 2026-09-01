# Feature Specification: A árvore de OKR do portfólio

**Feature Branch**: `009-okr-arvore`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "`handoff/okr-kpi-template.md` ser uma nova feature do roihub"

## Contexto: o template já existe, a tela não

`handoff/okr-kpi-template.md` (commit `0fc6298`) é o checklist reaplicável que nasceu do
subprojeto `handoff/funil-seo/`. Ele define N0-N6, quatro perfis de negócio, oito regras de
apuração (R1-R8) e — o que importa aqui — uma **ordem de ataque determinada** (§7): com a ficha
preenchida, o que fazer não é opinião, é consequência.

Hoje esse conhecimento mora em três lugares e nenhum deles é o hub:

| Onde | O que já faz | Onde para |
|---|---|---|
| `lib/funil.mjs` | célula `{valor}`/`{naoApurado}`, `razao()` com as três recusas, `ehLeadDeTeste()` | R1, R3 e R5 do template. Não conhece perfil, nem N2, nem §7 |
| `scripts/funil.mjs` | coleta GSC + `crm_leads` + campo `vendas`, imprime tabela com fração colada (R2) | o console. Três degraus fixos, iguais para os 35 projetos |
| `handoff/okr-kpi-template.md` | as regras, os perfis, a ordem de ataque | markdown. Ninguém executa markdown |

O hub tem doze páginas e nenhuma responde a pergunta que o template existe para responder:
**qual é a única coisa que adianta fazer neste projeto agora.**

O fato que motivou o template continua valendo: em 01/09/2026, **34 dos 35 projetos não tinham
como responder "quanto vale um cliente a mais"**, e a única cadeia apurada do portfólio era
`atma` — `535 cliques → 39 leads → 0 vendas`, `7,29% (39/535)`, com o último fator zerado.

### O que esta feature NÃO é

Não é um dashboard de métricas. A §7 do template diz que otimizar um fator zerado é desperdício
e que apurar vem antes de melhorar. Uma tela que mostra 35 projetos em `não apurado` bonito não
entrega nada. **O entregável é o veredito**, não o gráfico: em que das cinco posições de ataque
cada projeto está, e qual célula colocou ele lá.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Saber o que atacar segunda-feira (Priority: P1)

Jean abre `/okr` e lê, projeto a projeto, a posição de ataque do §7 e a célula que a determinou.
Para `atma` lê "fator ZERADO em N2 — `CR(consulta→tratamento)` = 0 de 39" e entende, sem
interpretar nada, que performance, indexação e copy não movem esse projeto enquanto o fator for
zero.

**Why this priority**: é o pedido inteiro. Sem o veredito a tela é um relatório a mais.

**Independent Test**: abrir `/okr` com um projeto de cadeia conhecida e conferir que a posição
exibida é a que a §7 determina para aquela cadeia, à mão.

**Acceptance Scenarios**:

1. **Given** um projeto com fator zerado em N2, **When** Jean abre `/okr`, **Then** o projeto
   aparece na posição 1 ("fator zerado") com o nome do fator e o valor `0`, e nenhuma sugestão
   de N5 é exibida para ele.
2. **Given** um projeto com `não apurado` em N3 atribuído à família D4, **When** Jean abre a
   linha, **Then** a posição é 2 ("apurar antes de melhorar") e o texto nomeia a fonte que
   precisa ser consultada — não a instrumentação a escrever (R4).
3. **Given** um projeto com a cadeia inteira apurada e sem zeros, **When** Jean abre a linha,
   **Then** a posição é 3 e a etapa apontada é a de **menor taxa**, não a primeira da cadeia.

### User Story 2 - Ler a cadeia sem ser enganado por ela (Priority: P1)

Jean abre a linha de um projeto e vê a cadeia do perfil dele — não uma cadeia genérica. Cada
taxa sai com a fração colada; cada célula ausente sai com o motivo escrito no lugar do número; e
cada `não apurado` diz de qual família de diagnóstico (D1-D4) ele é.

**Why this priority**: sem R1, R2 e R3 a tela fabrica taxa, que é exatamente o defeito que o
template existe para impedir. Uma cadeia `6,67%` de dois leads de teste já passou por taxa do
portfólio uma vez.

**Independent Test**: um projeto sem instrumentação de lead nunca exibe `0%` nem `0` na etapa de
lead; exibe o motivo.

**Acceptance Scenarios**:

1. **Given** uma etapa sem numerador instrumentado, **When** a linha é renderizada, **Then** a
   célula mostra `não apurado` com o motivo, e **nunca** `0`.
2. **Given** uma taxa apurada, **When** ela é exibida, **Then** o percentual vem com a fração
   colada no mesmo texto (`7,29% (39/535)`), não em tooltip nem em coluna vizinha.
3. **Given** um projeto de perfil A, **When** a cadeia é renderizada, **Then** as etapas são as
   do perfil A do template (`visitante→signup→ativado→trial→cobrança aprovada`), não
   `cliques→leads→vendas`.
4. **Given** um projeto sem perfil declarado, **When** a linha é renderizada, **Then** ela sai
   como `não apurado: sem perfil declarado` e **não** cai num perfil padrão.

### User Story 3 - Ver o portfólio ordenado pelo que ele pede (Priority: P2)

Jean abre `/okr` e o portfólio inteiro já vem ordenado pela posição de ataque, com a contagem
por posição no rodapé. Ele vê de relance quantos projetos estão presos em encanamento (posição
2) contra quantos já são otimizáveis (posições 3-5).

**Why this priority**: é a leitura de portfólio que o subprojeto `funil-seo/` fez à mão. Útil,
mas depende das duas histórias acima existirem.

**Independent Test**: a soma das contagens por posição é igual ao total de projetos.

**Acceptance Scenarios**:

1. **Given** os projetos carregados, **When** a página renderiza, **Then** eles aparecem
   ordenados por posição de ataque crescente, e a soma das contagens do rodapé é igual ao total.
2. **Given** um projeto sem perfil declarado, **When** a página renderiza, **Then** ele aparece
   numa faixa própria, fora das cinco posições, e é contado separadamente.

### Edge Cases

- **Fonte de dados caiu inteira** (banco fora, GSC sem propriedade): a coluna afetada vira
  `não apurado` com o motivo em todas as linhas. **Nunca vira `0` em todo mundo** — o melhor
  placar possível produzido pelo pior estado possível é o defeito que `scripts/funil.mjs` já
  documenta e que esta feature herda.
- **Numerador maior que denominador**: `não apurado`, nunca taxa acima de 100% (R3). Significa
  entrada por canal não medido, e isso é descoberta.
- **`0/0`**: `não apurado`, nunca `0%` (R3).
- **Projeto com zero lead na história inteira**: `não apurado`, nunca `0` — não separa "o site
  não manda evento" de "manda e ninguém converteu", e as duas pedem trabalho oposto.
- **Todos os leads da janela são de teste nosso**: `não apurado` com o motivo, nunca a taxa (R5).
- **Janelas diferentes entre fontes**: a árvore inteira declara UMA janela e corta todas as
  fontes nela (R7). Fonte que não cobre a janela é `não apurado`, não é extrapolada.
- **Primeira corrida**: a tela avisa que a primeira corrida de um check mede o CHECK, e que a
  lista é nominal antes de ser contagem.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE expor uma rota `/okr` no hub, no padrão das páginas existentes.
- **FR-002**: O sistema DEVE ler os projetos exclusivamente por `listProjects()`
  (`lib/projects.ts`), nunca importando `data/projects.json` — Princípio I da constituição.
- **FR-003**: Cada projeto DEVE ter um **perfil** declarado (A SaaS, B E-commerce, C Serviço,
  D Clínica/lead), curado à mão junto do card. Projeto sem perfil sai como
  `não apurado: sem perfil declarado` e NÃO recebe perfil padrão.
- **FR-004**: A cadeia N3 exibida DEVE ser a do perfil do projeto, com as etapas nominais do §4
  do template — não uma cadeia única para todos.
- **FR-005**: Toda célula DEVE ser `{valor}` ou `{não apurado: motivo}`. O sistema NÃO PODE
  escrever `0` onde a resposta é "não olhei" (R1).
- **FR-006**: Toda taxa exibida DEVE trazer a fração no mesmo texto do percentual (R2).
  Percentual sem denominador colado é proibido na renderização.
- **FR-007**: Razão com qualquer ponta não apurada, com denominador `0`, ou com numerador maior
  que o denominador DEVE resultar em `não apurado` com o motivo (R3). Esta regra já existe em
  `lib/funil.mjs` e DEVE ser reusada, não reescrita.
- **FR-008**: Lead identificado como de teste nosso NÃO PODE entrar em numerador de taxa (R5).
  Reusar `ehLeadDeTeste()`.
- **FR-009**: O sistema DEVE declarar UMA janela para a árvore inteira e exibi-la (R7).
- **FR-010**: Toda célula exibida DEVE nomear sua fonte — tabela, painel ou comando (R8).
- **FR-011**: O sistema DEVE calcular a **posição de ataque** de cada projeto pela ordem do §7,
  como função determinística das células: (1) fator zerado em N2; (2) `não apurado` em N3 por
  encanamento; (3) cadeia fechada → menor taxa; (4) taxas razoáveis → volume ou ticket;
  (5) só então N5.
- **FR-012**: Cada `não apurado` de N3 DEVE ser atribuído a uma das quatro famílias de
  diagnóstico (D1 Descoberta, D2 Entrega, D3 Persuasão, D4 Encanamento), com D4 avaliada
  primeiro.
- **FR-013**: A lógica de perfil, cadeia, famílias e posição de ataque DEVE nascer em `.mjs`
  puro e testável por `node --test`, sem subir o Next — Princípio III.
- **FR-014**: O arquivo de teste novo DEVE ser registrado na lista de `npm test` do
  `package.json` no mesmo commit que o cria — Princípio II.
- **FR-015**: A página DEVE exibir explicitamente o que ela não vê: cliques ≠ sessões, lead de
  outro canal entra em numerador sem entrar em denominador, e o Nível 0 (demanda) está fora.
- **FR-016**: Falha de qualquer fonte DEVE ser fechada: a coluna vira `não apurado` com o
  motivo. Nenhuma linha PODE virar `0` por indisponibilidade de fonte.
- **FR-017**: O sistema NÃO PODE exibir benchmark de mercado como meta (R6). Se houver
  referência de mercado, ela é rotulada como ontologia — quais etapas existem — nunca previsão.

### Resolvidos na clarificação (01/09/2026)

- **FR-018**: N1 é a **contagem de vendas** na janela, e o valor em R$ sai explicitamente como
  `não apurado: sem ticket declarado`. O template exige que N1 seja dinheiro; declarar contagem
  como se fosse dinheiro seria a violação da R1 que esta feature existe para impedir, então a
  contagem é rotulada como contagem e a lacuna de R$ fica visível. Isso NÃO enfraquece o
  veredito: a §7 decide por fator ZERADO e por `não apurado`, não pelo total em reais. Nenhum
  campo `ticket` é adicionado ao card nesta feature.
- **FR-019**: A cadeia exibida é a **inteira**, com todos os degraus do perfil. Degrau sem
  coletor sai como `não apurado` nomeando **a fonte a consultar** (R4: procurar onde o dado já
  cai antes de instrumentar), não a instrumentação a escrever. É desta lista que sai o trabalho
  de encanamento — a tela mostrar muitas células vazias é o resultado pretendido, não um defeito.

### Key Entities

- **Perfil**: A, B, C ou D. Define quais etapas compõem a cadeia N3 e quais famílias de
  diagnóstico pesam mais. Curado à mão por projeto.
- **Célula**: `{valor}` ou `{não apurado: motivo}`, com fonte citável. Já existe em
  `lib/funil.mjs`.
- **Etapa**: um degrau nomeado da cadeia de um perfil, com numerador, denominador e fonte. O
  denominador de uma etapa é o numerador da anterior.
- **Ficha**: N0-N6 de um projeto numa janela declarada.
- **Posição de ataque**: 1 a 5, derivada da ficha pela §7. Não é editável.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `/okr` responde 200 e lista **todos** os projetos que `listProjects()` devolve —
  não só os 35 curados. Medido em 01/09/2026: **40** (35 do `data/projects.json` + 5 repos do
  GitHub com site próprio). A spec dizia "35" por ter contado o JSON em vez do contrato; quem
  manda é o Princípio I, e um repo do GitHub sem perfil declarado cai na faixa `sem perfil` como
  qualquer outro.
- **SC-002**: Zero células exibindo `0` onde a fonte não foi consultada — conferível projeto a
  projeto contra o motivo exibido.
- **SC-003**: Zero percentuais exibidos sem fração colada — conferível por varredura do HTML
  servido.
- **SC-004**: A posição de ataque de `atma` é 1 (fator zerado), e a célula citada é a última da
  cadeia do perfil D.
- **SC-005**: A soma das contagens por posição no rodapé é igual ao total de projetos listados.
- **SC-006**: `npm test` verde com o arquivo de teste novo registrado em `package.json`.
- **SC-007**: Derrubar a fonte de leads (env ausente) não muda nenhuma linha para `0`; muda
  todas para `não apurado` com o motivo.

## Assumptions

- A janela padrão é a mesma de `scripts/funil.mjs`: 28 dias fechando em D-3, alinhada ao atraso
  do Search Console. Trocar a janela é decisão de leitura, não de código.
- As fontes disponíveis hoje são as três que `scripts/funil.mjs` já usa: GSC (cliques),
  `crm_leads` (leads) e o campo `vendas` do card, mais as fontes próprias declaradas em
  `FONTES_PROPRIAS` (hoje só `atma`/`patient_leads`). Nenhuma instrumentação nova entra nesta
  feature — R4 diz para procurar o dado onde ele já cai antes de escrever encanamento.
- O perfil de cada projeto é curadoria manual no card, como os demais campos escritos à mão em
  `data/projects.json`. Não há inferência automática de perfil.
- A página é leitura. Nada nela edita card, banco ou ação.
