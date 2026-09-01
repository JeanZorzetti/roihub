# Feature Specification: Projeção invertida — da meta para o fator obrigatório

**Feature Branch**: `010-okr-projecao-invertida`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "A feature `/okr` foi pensada para me ajudar matematicamente a fazer
os projetos baterem OKRs. Uma OKR SMART precisa ser PROJETADA. Ela não foi criada para eu
acompanhar o que está acontecendo — foi criada para me dar um norte para eu fazer acontecer."

## Contexto: a 009 foi proibida de projetar, e a proibição estava certa pela metade

A 009 entregou o diagnóstico e **para de propósito** na posição 3. Está escrito em
`lib/okr.mjs`, no comentário de `posicaoDeAtaque()`:

> ⚠️ As posições 4 e 5 do template (volume/ticket, depois N5) **NÃO são derivadas aqui**.
> Separar "taxa razoável" de "taxa ruim" exige um número de referência, e a **R6 proíbe
> benchmark como meta** [...] o passo seguinte é leitura humana, e dizer o contrário seria
> fabricar automação por cima de um chute.

A R6 do `handoff/okr-kpi-template.md:268` é o motivo: *"Benchmark é ontologia, nunca previsão.
Empilhar o percentil de elite em todas as etapas produz projeções dezenas de vezes acima da
média — o mesmo tráfego vira 5 ou 300 clientes."* E o `:52`: *"a meta numérica vem depois de
existir o primeiro número."*

A consequência medida: com 40 projetos e nenhuma cadeia fechada, a tela nunca sai de **"apurar
antes de melhorar"**. Ela entrega um raio-X correto e cala. O usuário não pediu raio-X.

### A R6 proíbe uma direção, não as duas

| Direção | Que conta é | Números inventados | R6 |
|---|---|---|---|
| **Pra frente** — taxas de referência → receita prevista | multiplicação de taxas escolhidas por quem projeta | todos | **proibida**, e com razão |
| **Pra trás** — meta declarada ÷ cadeia apurada → fator obrigatório | **divisão** | **nenhum** | não alcançada |

A projeção invertida não estima nada. O humano declara a meta; a tela divide pelo que já está
apurado e devolve **quanto o resto da cadeia precisa valer**. Nenhum número novo entra no
sistema: entram a meta e o ticket, que são *declarações* do humano — rotuladas como declaradas,
nunca como apuradas — e o resto é aritmética sobre células que a 009 já produz.

### O teto de 100% é o teste de viabilidade, e ele não custa benchmark nenhum

Taxa não passa de 100%. Se a inversão exigir, de um ponto medido até o fim da cadeia, um fator
maior que 1, **a meta é aritmeticamente impossível com o volume atual** — porque o produto de
taxas, todas ≤ 1, nunca passa de 1. Isso deriva a posição 4 do §7 (volume ou ticket, não taxa)
sem um único número de referência, e é a única saída do sistema que pode dizer "essa meta é
fantasia" com prova em vez de opinião.

### O que muda no veredito de `atma`, a única cadeia apurada do portfólio

`535 cliques → 39 leads (7,29%) → 0 vendas`, perfil D.

| | Hoje (009) | Com a inversão (010) |
|---|---|---|
| Saída | posição 1, "fator ZERADO no fim da cadeia" | mesma posição 1, **mais** o fator obrigatório |
| Trabalho que ela manda fazer | nenhum específico — "é multiplicação, nada move enquanto for zero" | "a meta cabe em 39 leads e depende inteiramente de 4 degraus que você nunca mediu; medir `lead→consulta` é o trabalho da semana" |

Com meta de R$ 50.000 na janela e ticket declarado de R$ 4.000:
`50.000 ÷ 4.000 = 12,5 tratamentos`; `12,5 ÷ 39 leads = 32,05%` de conversão obrigatória no
trecho `lead → contatado → agendada → compareceu → tratamento`. Menor que 100%: a meta **cabe**.
O veredito deixa de ser "não apurado" e vira uma taxa nomeada a ir medir.

### O que esta feature NÃO é

- **Não é previsão.** Não existe "receita estimada", "projeção de fechamento" nem cenário
  otimista/pessimista. A tela nunca escreve um número que ninguém mediu nem declarou.
- **Não é acompanhamento.** O bloco não mostra "quanto falta para a meta" ao longo do tempo.
  Ele mostra **o que cada fator precisa valer**, que é uma frase sobre o futuro, não sobre o
  passado. O `valor` declarado no card já É "o que falta", mas quem desconta o realizado é o
  humano ao reescrever o campo — a tela nunca lê histórico para descontar sozinha, e `declaradaEm`
  existe para essa defasagem ficar à vista em vez de silenciosa.
- **Não substitui o diagnóstico da 009.** A posição de ataque continua sendo o veredito; a
  inversão entra logo abaixo dela, no mesmo card.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Saber quanto cada fator precisa valer (Priority: P1)

Jean declara a meta de um projeto no card (`meta: { valor, ticket, prazo }`) e abre `/okr`. No
card do projeto, logo abaixo da posição de ataque, lê o **fator obrigatório**: a partir do último
degrau realmente medido, quanto o resto da cadeia tem que converter para a meta acontecer na
janela.

**Why this priority**: é o pedido inteiro. É a diferença entre "esse projeto está sem dado" e
"esse projeto precisa de 32% aqui, vai medir".

**Independent Test**: um projeto com meta e um degrau apurado exibe uma taxa obrigatória
conferível à mão pela divisão; sem meta declarada, exibe `não apurado: sem meta declarada`.

**Acceptance Scenarios**:

1. **Given** um projeto com `meta` e `ticket` declarados e ao menos um degrau apurado,
   **When** Jean abre `/okr`, **Then** a linha mostra o N1 necessário na janela e o fator
   obrigatório do ponto medido até o fim da cadeia, com a divisão colada no mesmo texto
   no formato da R2 — `<percentual> (<necessário>/<âncora>)`, p.ex. `32,05% (12,5/39)` quando a
   meta é declarada na própria janela. O percentual concreto depende do `prazo` (FR-004): o
   critério é a divisão exibida bater com a conta à mão, nunca um número fixo.
2. **Given** um projeto **sem** `meta` declarada, **When** a linha é renderizada, **Then** o
   bloco sai como `não apurado: sem meta declarada` e **nunca** com meta inferida, arredondada
   ou herdada de outro projeto.
3. **Given** um projeto com `meta` mas **sem** `ticket`, **When** a linha é renderizada,
   **Then** o N1 necessário sai como `não apurado: sem ticket declarado — R$ não vira contagem
   sem valor por unidade`, pagando a lacuna que a FR-018 da 009 deixou aberta de propósito.
4. **Given** um projeto sem nenhum degrau apurado, **When** a linha é renderizada, **Then** o
   bloco sai como `não apurado: sem âncora — nenhum degrau medido para dividir`, e o trabalho
   apontado continua sendo o da posição 2 (apurar).

---

### User Story 2 - Descobrir que a meta é impossível antes de gastar o trimestre (Priority: P1)

Jean declara uma meta e a tela responde que ela **não cabe**: para acontecer, algum degrau
precisaria converter acima de 100%. A linha diz qual volume ou qual ticket tornaria a meta
possível, porque com fator obrigatório > 1 os únicos fatores que restam são esses dois.

**Why this priority**: é o único resultado do sistema que economiza um trimestre inteiro, e é a
posição 4 do §7 caindo de graça. Uma meta impossível que parece possível consome o trimestre e
só se revela no fim.

**Independent Test**: forçar uma meta acima do teto num projeto de cadeia conhecida e conferir
que a saída é "impossível" com o multiplicador de volume necessário, não uma taxa acima de 100%.

**Acceptance Scenarios**:

1. **Given** um projeto cujo N1 necessário é maior que o volume do último degrau apurado,
   **When** a linha é renderizada, **Then** ela sai como **meta impossível na janela** com a
   prova aritmética (`exigiria 187% de conversão; taxa não passa de 100%`).
2. **Given** a mesma situação, **When** Jean lê o motivo, **Then** ele nomeia os dois únicos
   fatores restantes com o múltiplo necessário de cada (`precisa de 1,9× no volume de entrada,
   OU de 1,9× no ticket`) — e **não** sugere copy, performance ou indexação.
3. **Given** um projeto com a cadeia inteira fechada e já batendo a meta, **When** a linha é
   renderizada, **Then** a âncora é o **próprio N1** e a linha mostra o **múltiplo necessário**
   (`necessário 2,89 ÷ atual 3,70 = 0,78× — folga de 1,28×`), não uma taxa e não um alerta.

   Sem degrau depois da âncora não existe trecho a exigir: o `fator obrigatório` sai
   `não apurado: âncora é o próprio N1 — não há trecho a exigir`, e **o teto de 100% não se
   aplica neste ramo**. Múltiplo maior que 1 aqui não é impossibilidade, é crescimento — e
   confundir os dois declararia "meta impossível" em projetos perfeitamente viáveis.

---

### User Story 3 - Comparar meta anual com funil de 28 dias sem se enganar (Priority: P2)

A meta tem prazo (`2026-12-31`) e a cadeia é medida numa janela de 28 dias (R7). A tela
normaliza a meta para a janela antes de dividir, e mostra as duas leituras: o total do prazo e a
parcela da janela.

**Why this priority**: sem isso a feature mente por um fator de 4 a 13. Comparar meta de
trimestre contra funil de 28 dias declara "impossível" em projetos perfeitamente viáveis — o
erro seria invisível e todo o resto da feature herdaria ele.

**Independent Test**: a mesma meta com prazo de 28 dias e com prazo de 112 dias produz fatores
obrigatórios numa razão de 4 para 1.

**Acceptance Scenarios**:

1. **Given** uma meta com prazo de 112 dias e a janela padrão de 28 dias, **When** a linha é
   renderizada, **Then** o N1 necessário exibido é o **da janela** (total ÷ 4), com o total do
   prazo visível ao lado e a conta de normalização escrita.
2. **Given** uma meta com prazo **já vencido**, **When** a linha é renderizada, **Then** ela sai
   como `não apurado: prazo vencido em <data>` e não divide por janela negativa nem por zero.
3. **Given** uma meta cujo prazo restante é menor que uma janela, **When** a linha é renderizada,
   **Then** a normalização usa o prazo restante real e o texto diz que a janela foi encurtada.

---

### Edge Cases

- **Nenhum degrau apurado** (o caso de 39 dos 40 projetos hoje): `não apurado: sem âncora`.
  Nunca fator `0`, nunca `100%`.
- **Âncora depois de um buraco**: a âncora é o último degrau apurado da sequência **contígua a
  partir do topo**. Um degrau apurado depois de um `não apurado` NÃO serve de âncora — a cadeia
  entre eles tem furo, e dividir por ele produziria um fator obrigatório que ignora um degrau
  inteiro. Em `atma`, `tratamento = 0` é apurado e vem depois de três `não apurado`: a âncora é
  `lead = 39`, não `tratamento`.
- **Âncora com valor `0`**: divisão por zero. Sai `não apurado: âncora zerada — meta não se
  divide por volume nenhum`, e o veredito continua sendo a posição 1 da 009.
- **`ticket` declarado igual a `0` ou ausente**: `não apurado`, nunca N1 infinito.
- **Meta declarada em R$ num projeto sem perfil**: sem perfil não há cadeia, logo não há âncora
  nem degraus a exigir. Sai `não apurado: sem perfil declarado`, herdando a regra da 009.
- **Cadeia fechada — a âncora É o N1**: não há degrau depois dela. O fator obrigatório sai
  `não apurado: âncora é o próprio N1 — não há trecho a exigir`, e a linha mostra o **múltiplo**
  da FR-010. Nenhum veredito de impossibilidade neste ramo, por maior que seja o múltiplo. Em
  01/09/2026 **nenhum** dos 17 projetos com perfil declarado alcança este caso: 16 não têm o campo
  `vendas` e o único que tem (`atma`) tem três degraus não apurados acima dele.
- **Fator obrigatório exatamente `1,0`**: exige 100% de conversão em todos os degraus restantes.
  Tratado como **impossível na prática**, com o texto dizendo que 100% não é meta, é limite.
- **Meta batida com folga**: mostra a folga; não vira alerta e não some da tela.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O card DEVE aceitar um campo `meta` opcional com `valor` (R$), `ticket` (R$ por
  unidade de N1), `prazo` (data) e `declaradaEm` (data), curado à mão em `data/projects.json`
  como `perfil` e `estado` já são. NÃO há meta inferida, herdada nem padrão.

  `valor` é **o que falta a partir da declaração**, não o total histórico do período: a tela não
  desconta o já realizado, porque descontar seria acompanhamento — e a spec o proíbe. Corrigir
  `valor` conforme o período avança é curadoria à mão, como `perfil` e `estado`.
- **FR-002**: `meta` e `ticket` DEVEM ser rotulados na tela como **declarados**, nunca como
  apurados. São escolhas do humano, não medições — e a distinção é o que mantém a R1 de pé
  quando um número escrito à mão entra na mesma linha que células medidas.
- **FR-003**: O sistema DEVE converter a meta em **N1 necessário** (contagem da unidade final do
  perfil) por `valor ÷ ticket`. Sem `ticket`, o N1 necessário é `não apurado` com o motivo —
  nunca a meta em R$ tratada como se fosse contagem.
- **FR-004**: O sistema DEVE normalizar o N1 necessário para a **janela declarada** (R7) antes de
  dividir, usando o prazo restante contado **do dia de hoje** até o `prazo`. As duas leituras —
  total do prazo e parcela da janela — DEVEM aparecer, com a conta de normalização visível.

  Contar de hoje, e não de `declaradaEm`, é deliberado: o fator obrigatório TEM que subir
  conforme a janela aperta. Congelá-lo na data da declaração transformaria a projeção num retrato
  datado e apagaria o achado que a User Story 2 existe para produzir.
- **FR-005**: O sistema DEVE eleger como **âncora** o último degrau apurado da sequência contígua
  a partir do topo da cadeia. Degrau apurado após um `não apurado` NÃO é âncora.

  Numa cadeia **fechada** a âncora é o próprio N1. Nesse ramo não há trecho a exigir: vale a
  FR-010 (múltiplo necessário), e não a FR-006 nem a FR-007.
- **FR-006**: O **fator obrigatório** é `N1 necessário na janela ÷ valor da âncora`, e representa
  o produto das taxas de todos os degraus entre a âncora e o fim da cadeia. Existe **somente**
  quando há ao menos um degrau depois da âncora; sem isso sai
  `não apurado: âncora é o próprio N1 — não há trecho a exigir`.
- **FR-007**: Fator obrigatório `> 1` DEVE ser exibido como **meta impossível na janela**, com a
  prova aritmética escrita (o percentual exigido e a frase de que taxa não passa de 100%).

  Este teto vale **só** no ramo da FR-006. Múltiplo necessário maior que 1 (FR-010) NÃO é
  impossibilidade — é crescimento, e não existe teto para ele. Um único ramo decidindo os dois
  declararia "meta impossível" em projeto viável.
- **FR-008**: No caso impossível, o sistema DEVE nomear os dois únicos fatores restantes —
  volume de entrada e ticket — com o múltiplo necessário de cada, e NÃO PODE sugerir trabalho de
  taxa (copy, performance, indexação) para esse projeto.
- **FR-009**: O sistema DEVE nomear **quais degraus** compõem o fator obrigatório, um a um, para
  que a saída seja uma lista de coisas a medir e não um número solto.
- **FR-010**: Quando a cadeia estiver fechada (posição 3 da 009), o sistema DEVE exibir o
  **múltiplo necessário** = `N1 necessário na janela ÷ N1 apurado`, e a **folga** = `1 ÷ múltiplo`
  quando o múltiplo for menor que 1. É um múltiplo, nunca uma taxa — e `fator obrigatório` e
  `múltiplo necessário` NUNCA saem preenchidos ao mesmo tempo.
- **FR-011**: Toda razão exibida DEVE trazer a fração colada no mesmo texto (R2), inclusive as
  desta feature. Fator obrigatório sem o `(necessário/âncora)` ao lado é proibido na renderização.
- **FR-012**: O sistema NÃO PODE derivar, sugerir ou preencher a meta a partir de benchmark,
  média do portfólio ou histórico do próprio projeto (R6). Meta ausente é `não apurado`, ponto.
- **FR-013**: O sistema NÃO PODE produzir número algum para um projeto sem meta declarada. Um
  bloco majoritariamente `não apurado` é o resultado pretendido, como a FR-019 da 009 já
  estabeleceu para as células vazias.
- **FR-014**: A projeção DEVE entrar na **`/okr` existente**, como bloco no card do projeto logo
  abaixo da posição de ataque. NÃO é rota nova e NÃO substitui o veredito da 009.

  "Coluna" era a palavra original e ela foi trocada de propósito (emenda 7 do
  `checklists/requirements.md`): a `/okr` não é tabela de projetos — é uma sequência de cards com
  uma tabela de degraus dentro de cada um. Coluna literal quebra em 390px, e a `.tabela-rolavel`
  que já existe no card mede degraus, não projetos. O requisito é **onde a informação aparece**
  (no card, colada ao veredito), não a forma geométrica.
- **FR-015**: A lógica de inversão DEVE nascer em `.mjs` puro, testável por `node --test` sem
  subir o Next — Princípio III. Ela DEVE importar `lib/funil.mjs` e `lib/okr.mjs`, e NÃO PODE
  reimplementar célula, razão ou cadeia.
- **FR-016**: O arquivo de teste novo DEVE ser registrado na lista de `npm test` do
  `package.json` no mesmo commit que o cria — Princípio II.
- **FR-017**: O tipo `Project` de `lib/projects.ts` DEVE receber o campo `meta` dentro do
  contrato do Princípio I. Nenhuma leitura de `data/projects.json` fora de `lib/projects.*`.
- **FR-018**: A página DEVE exibir o que a inversão **não** prova: que o fator obrigatório caber
  em 100% não significa que ele seja alcançável, apenas que não é aritmeticamente impossível. A
  distância entre "cabe" e "acontece" é leitura humana, e dizer o contrário seria a previsão que
  a R6 proíbe.

### Key Entities

- **Meta**: `valor` em R$ (o que falta a partir da declaração), `ticket` em R$ por unidade de N1,
  `prazo` em data, `declaradaEm` em data. Declarada à mão no card. É entrada do humano, não
  medição — e é rotulada assim em toda exibição. `declaradaEm` existe para a defasagem ficar
  visível: `valor` não se atualiza sozinho, e sem a data isso apodrece sem parecer errado. A tela
  **nunca** recusa uma meta por idade — escolher um limiar de "velha demais" seria escolher um
  número, que é o que a R6 proíbe.
- **N1 necessário**: contagem da unidade final do perfil que a meta exige, já normalizada para a
  janela. `não apurado` sem ticket, sem prazo válido ou sem perfil.
- **Âncora**: o último degrau apurado da sequência contígua a partir do topo da cadeia. É o
  denominador da inversão. Pode ser o próprio N1, quando a cadeia está fechada.
- **Fator obrigatório**: `N1 necessário na janela ÷ âncora`, **só** quando há degrau depois da
  âncora. Produto das taxas dos degraus restantes. Acima de 1 = meta impossível na janela.
- **Múltiplo necessário**: `N1 necessário na janela ÷ N1 apurado`, só quando a cadeia está
  fechada — isto é, quando a âncora É o N1. Menor que 1 = folga. Não tem teto: é crescimento,
  não taxa. Nunca coexiste com o fator obrigatório.
- **Degraus a medir**: a lista nominal dos degraus entre a âncora e o fim da cadeia. É o
  entregável de trabalho da feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `/okr` continua respondendo 200 e listando os 40 projetos que `listProjects()`
  devolve, agora com o bloco de projeção. Nenhuma linha existente muda de posição de ataque.
- **SC-002**: Com `meta: { valor: 50000, ticket: 4000, prazo: "2026-12-31", declaradaEm:
  "2026-09-01" }` em `atma`, a linha exibe âncora `lead = 39`, N1 necessário e fator obrigatório
  conferíveis à mão pela divisão, e nomeia os quatro degraus entre `lead` e `tratamento`.

  ⚠️ O número **depende do prazo declarado**, e por isso não é fixável aqui: lido em 01/09/2026
  com prazo em 31/12 são 121 dias restantes, logo `12,5 × 28/121 = 2,89` na janela e
  `7,42% (2,89/39)`. O `32,05%` que aparece no Contexto continua correto como ilustração — lá a
  meta é declarada **na janela**, e aqui o prazo é o ano. O critério é a conferência à mão bater
  com a tela na data em que se olha, nunca um percentual fixo.
- **SC-003**: Zero projetos exibindo fator obrigatório sem meta declarada — conferível por
  varredura do HTML servido.
- **SC-004**: Zero fatores obrigatórios exibidos sem a fração colada.
- **SC-005**: Uma meta deliberadamente acima do teto produz "meta impossível" com o múltiplo de
  volume, e **nunca** uma taxa exibida acima de 100%.
- **SC-006**: A mesma meta com prazo de 28 e de 112 dias produz fatores obrigatórios na razão de
  4 para 1 — a normalização é conferível por teste.
- **SC-007**: Um projeto cuja cadeia tem `não apurado` seguido de degrau apurado elege como
  âncora o degrau **anterior** ao buraco, não o posterior.
- **SC-008**: `npm test` verde com o arquivo de teste novo registrado em `package.json`.
- **SC-009**: Remover `ticket` de um card não muda nenhuma linha para `0` nem para `100%`; muda
  para `não apurado` com o motivo.

## Assumptions

- A janela é a mesma da 009: 28 dias fechando em D-3, alinhada ao atraso do Search Console (R7).
  Trocar a janela continua sendo decisão de leitura, não de código.
- `ticket` é declaração do humano, como `perfil` e `estado`. Esta feature paga explicitamente a
  lacuna que a FR-018 da 009 deixou aberta ("nenhum campo `ticket` é adicionado ao card nesta
  feature") — mas paga rotulando o campo como declarado, não fingindo que ele é apurado.
- A meta é sempre expressa em R$ com ticket, não em contagem direta. Projetos onde R$ por unidade
  não faz sentido ficam sem meta até o campo existir; inventar um segundo formato de meta agora
  seria duas regras para o mesmo número, que é o defeito que `lib/okr.mjs` já evita não
  reimplementando `razao()`.
- A distribuição da meta pelo prazo é **linear** (total ÷ janelas restantes). Sazonalidade e
  rampa não entram: modelá-las exigiria uma curva escolhida por quem projeta, que é exatamente a
  previsão que a R6 proíbe.
- Nenhuma instrumentação nova entra nesta feature. Os degraus sem coletor continuam sendo os que
  a 009 já nomeia, e a inversão só muda o que a tela diz sobre eles.
- A página continua sendo leitura. Nada nela edita card, banco ou ação.
