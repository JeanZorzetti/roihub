# Feature Specification: Série do GSC gravada e os sete KPIs de busca do board

**Feature Branch**: `021-serie-gsc-gravada`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "serie do GSC gravada e os sete KPIs de busca do board"

## Contexto

O board `whimsical.com/v-rtice3/okr-Saw2eoSKZDPLJAk6xeDBuS` não é uma árvore de OKR: é um
**catálogo de 19 KPIs de SEO** em 4 blocos (IMPRESSÕES, POSIÇÃO MÉDIA, CLIQUE, checklist técnico
do GSC), cada um com fórmula e meta numérica. A `/okr` de hoje mede a cadeia de conversão
(`lead→respondeu→orçamento→venda`); o board mede **aquisição orgânica**, um eixo que a tela não
toca. `app/okr/[slug]/aquisicao/page.tsx` é a única aba que olha para busca e mostra apenas
**cliques e impressões somados de 8 meses** — zero dos 19 KPIs.

Dois achados definem o escopo desta spec:

1. **O roihub não grava nada do Search Console.** São 16 tabelas no `ensure()` de `lib/db.ts` e
   nenhuma de GSC. Toda leitura é ao vivo e descartada. Os KPIs de *crescimento* do board
   (+10–20%/trimestre em consultas únicas, 5–10% MoM em impressões não-marca) não são um
   problema de cálculo: são um problema de **calendário**. Só existem meses depois de alguém
   começar a gravar. Por isso gravar entra nesta spec mesmo sem render KPI no dia do merge.
2. **`gscQueryPages` já existe** em `lib/gsc.ts:150` (`dimensions: ["query","page"]`,
   `rowLimit: 25000`) e a `/okr` simplesmente não a chama. Sete KPIs do board estão a uma
   chamada de distância, sem nenhuma fonte externa nova.

Fora de escopo, por falta de fonte: TAM de busca (volume externo), Core Web Vitals, cobertura de
Schema, integridade de título, alinhamento de intenção, referring domains. E os três KPIs cujo
denominador o hub não mantém (catálogo de palavras-chave alvo, total de URLs indexadas).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A série diária do GSC passa a ser gravada (Priority: P1)

Todo dia, sem ninguém pedir, o hub grava uma linha por projeto e por dia com impressões, cliques,
CTR e posição média do Search Console. A partir daí existe um histórico que ninguém precisa
recomputar, e as perguntas de crescimento do board deixam de ser impossíveis — passam a ser
"ainda não tenho janela suficiente", que é uma resposta com data de vencimento.

**Why this priority**: é a única parte da feature cujo valor depende do relógio. Todo dia sem
gravar é um dia de histórico que não volta. As outras histórias podem ser feitas em qualquer
ordem depois; esta atrasa tudo o que vier depois dela.

**Independent Test**: rodar a corrida duas vezes no mesmo dia e conferir no banco que a segunda
não duplicou linha nem alterou os dias já fechados; conferir que existe ≥1 linha por projeto com
propriedade no GSC.

**Acceptance Scenarios**:

1. **Given** um projeto com propriedade no GSC, **When** a corrida diária executa, **Then** o
   banco tem uma linha por dia da janela coletada, com impressões, cliques, CTR e posição.
2. **Given** uma corrida que já gravou hoje, **When** a corrida executa de novo no mesmo dia,
   **Then** os dias já fechados permanecem com os mesmos valores e nenhuma linha é duplicada.
3. **Given** um projeto sem propriedade no GSC, **When** a corrida executa, **Then** ela grava
   zero linhas para esse projeto e **não** falha a corrida dos demais.
4. **Given** um dia dentro da janela de D-3 (que o GSC ainda não fechou), **When** uma corrida
   posterior traz o valor definitivo daquele dia, **Then** a linha é **atualizada**, não ignorada.

---

### User Story 2 - Striking Distance: o que está a um empurrão do Top 3 (Priority: P2)

Ao abrir a aba de aquisição de um projeto, aparece a lista de consultas nas posições 4,0 a 10,9
com impressões relevantes, ordenada por impressão. É a fila de trabalho de SEO da semana: cada
linha é uma página que já rankeia e que um reforço de conteúdo ou link interno pode levar ao
Top 3.

**Why this priority**: é o KPI mais acionável do board inteiro e o mais barato de calcular — sai
da mesma chamada que os outros seis. Entregue sozinho, já muda o que a pessoa faz na segunda-feira.

**Independent Test**: abrir `/okr/<slug>/aquisicao` de um projeto com tráfego e conferir que toda
consulta listada tem posição entre 4,0 e 10,9, e que nenhuma consulta fora dessa faixa aparece.

**Acceptance Scenarios**:

1. **Given** um projeto com consultas em várias posições, **When** a aba de aquisição carrega,
   **Then** só as consultas entre 4,0 e 10,9 aparecem na lista, ordenadas por impressões.
2. **Given** um projeto sem nenhuma consulta nessa faixa, **When** a aba carrega, **Then** a tela
   diz que não há candidata na faixa — e **não** mostra lista vazia sem explicação.

---

### User Story 3 - CTR contra o benchmark da posição (Priority: P2)

Para cada consulta, o hub compara o CTR real com o CTR que aquela posição deveria render
(P1 ≥25%, P2 ≥13%, P3 ≥8%, P4-6 ≥4,5%, P7-10 ≥2%) e mostra a diferença. Uma URL na posição 2
com 5% de CTR aparece marcada: o problema dela não é ranking, é o título.

**Why this priority**: mesma chamada da US2, e separa dois trabalhos que hoje se confundem —
"subir posição" e "reescrever o snippet". Sem isso, uma página bem posicionada e mal escrita
some no meio da média.

**Independent Test**: conferir que uma consulta com posição 2 e CTR 5% é marcada como abaixo do
benchmark, e uma com posição 8 e CTR 3% é marcada como acima.

**Acceptance Scenarios**:

1. **Given** uma consulta na posição 2 com CTR de 5%, **When** a aba carrega, **Then** ela é
   marcada como abaixo do benchmark da posição.
2. **Given** o conjunto de URLs de um projeto, **When** a aba carrega, **Then** a tela mostra que
   percentual delas atinge ou supera o benchmark da própria posição (o CTR Gap do board).

---

### User Story 4 - O tamanho e a forma da presença orgânica (Priority: P3)

Quatro números de enquadramento na mesma aba: quantas consultas distintas geram impressão,
quantas estão no Top 20, que fatia das impressões está no Top 3, e quantas URLs receberam ao
menos uma impressão.

O quarto número é uma **contagem**, não o Active Index Ratio do board. O board pede
`URLs com impressão ÷ total de URLs indexadas`, e o hub não mantém o denominador — publicá-lo
seria inventar a razão. A contagem sozinha é verdadeira e já dá a escala; a razão fica para
quando alguém decidir de onde vem o total de indexadas (FR-013).

**Why this priority**: contexto, não ação. Sem eles a US2 e a US3 são uma lista sem escala —
mas eles sozinhos não fazem ninguém mudar de comportamento.

**Independent Test**: conferir que a contagem de consultas distintas bate com o número de linhas
distintas de `query` retornadas pela chamada, e que a soma das fatias percentuais é coerente.

**Acceptance Scenarios**:

1. **Given** um projeto com tráfego, **When** a aba carrega, **Then** aparecem as consultas
   únicas, as no Top 20, o % de impressões no Top 3 e a contagem de URLs com impressão.
2. **Given** que a dimensão `query` omite consultas raras, **When** o total de consultas únicas é
   exibido, **Then** a tela o apresenta explicitamente como **piso**, nunca como total.

---

### User Story 5 - Canibalização: duas páginas suas disputando a mesma consulta (Priority: P3)

Quando duas ou mais URLs do mesmo projeto recebem impressões para a mesma consulta, o hub lista
o par. O board pede zero páginas competindo pela mesma palavra-chave primária; hoje ninguém sabe
se há alguma.

**Why this priority**: sai de graça da mesma chamada (que já traz `query` **e** `page`), mas é
diagnóstico de baixa frequência — não muda a semana, muda o trimestre.

**Independent Test**: montar duas URLs conhecidas que rankeiam para o mesmo termo e conferir que
o par aparece; conferir que uma consulta com URL única nunca aparece.

**Acceptance Scenarios**:

1. **Given** uma consulta com impressões em 2+ URLs do projeto, **When** a aba carrega, **Then**
   a consulta e as URLs concorrentes são listadas com suas posições.
2. **Given** uma consulta atendida por uma única URL, **When** a aba carrega, **Then** ela não
   aparece na lista de canibalização.

---

### Edge Cases

- **Os últimos ~3 dias do GSC não estão fechados.** Ler o dia de ontem como queda é inventar
  regressão — o comentário de `scripts/serie-gsc.mjs` já registra o caso (atma: 30 imp em 30/07,
  827 em 31/07). Dia não fechado precisa poder ser regravado quando o valor definitivo chegar.
- **A dimensão `query` omite as consultas raras.** O total com `query` é um **piso**, não o
  total — 5 contra 33 no tapepro, segundo o mesmo script. Todo KPI que conte consultas herda esse
  viés e precisa dizê-lo na tela.
- **Marca versus não-marca é poluído por país.** Já registrado no projeto: posição de termo
  branded mente sem corte por país.
- **Projeto em domínio de fornecedor** (`*.vercel.app`) fica fora de toda propriedade. Isso não é
  "zero tráfego", é "não há onde olhar" — a distinção que `okr-coleta.ts` já faz entre `null`
  (ausência estrutural) e `{erro}` (falha transitória) precisa valer aqui também.
- **Um projeto sem propriedade no GSC não pode derrubar a corrida dos outros.**
- **`rowLimit: 25000` é um teto.** Um projeto que o alcance está truncado, e a tela precisa
  saber disso em vez de tratar o corte como o fim dos dados.
- **Banco fora do ar durante a corrida diária**: falha fechada. Um dia sem linha é um buraco
  visível; um dia com zero gravado é uma mentira permanente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST gravar, por projeto e por dia, impressões, cliques, CTR e posição
  média do Search Console.
- **FR-002**: A gravação MUST ser idempotente por `(projeto, dia)`: repetir a corrida no mesmo
  dia não duplica linha.
- **FR-003**: Dias ainda não fechados pelo GSC MUST poder ser sobrescritos por uma corrida
  posterior que traga o valor definitivo.
- **FR-004**: A corrida diária MUST prosseguir para os demais projetos quando um projeto falha ou
  não tem propriedade no GSC.
- **FR-005**: A corrida MUST ser disparada por agendamento, sem intervenção humana, e MUST poder
  ser disparada manualmente.
- **FR-006**: A primeira corrida MUST fazer backfill da janela mais longa que o GSC devolve, para
  que o histórico não comece vazio.
- **FR-007**: O sistema MUST calcular, a partir das dimensões `query` e `page` na janela de
  descoberta: consultas únicas, consultas no Top 20 (1,0–20,0), % de impressões no Top 3
  (1,0–3,9), URLs com ao menos uma impressão, Striking Distance (4,0–10,9), CTR por consulta
  contra o benchmark da posição, CTR Gap (% de URLs no benchmark ou acima) e pares de
  canibalização.
- **FR-008**: A tabela de benchmark de CTR por posição MUST ser P1 ≥25%, P2 ≥13%, P3 ≥8%,
  P4–P6 ≥4,5%, P7–P10 ≥2%.
- **FR-009**: A tela MUST apresentar a contagem de consultas únicas como **piso**, com a razão
  (a dimensão `query` omite as raras) visível ao leitor.
- **FR-010**: A tela MUST distinguir "não há dado" (ausência estrutural: sem propriedade no GSC)
  de "falhou agora" (erro transitório), como `okr-coleta.ts` já faz para as demais células.
- **FR-011**: O sistema MUST sinalizar quando o resultado foi truncado pelo teto de linhas da API.
- **FR-012**: Os sete KPIs MUST ser calculados sem nenhuma chamada de rede além das que a página
  de aquisição já faz mais a chamada de `query`+`page`.
- **FR-013**: Nenhum KPI cujo denominador o hub não mantém (catálogo de palavras-chave alvo,
  total de URLs indexadas) MUST ser exibido nesta feature.

### Key Entities

- **Dia de busca**: a medição de um projeto num dia — impressões, cliques, CTR, posição média.
  Chaveado por projeto e data. É a linha que se acumula e vira histórico.
- **Consulta**: um termo de busca numa janela, com a URL que o atende, impressões, cliques,
  CTR e posição. Não é persistido nesta spec — é lido ao vivo e agregado nos sete KPIs.
- **Benchmark de posição**: a faixa de posição e o CTR mínimo esperado nela. Constante, vem do
  board.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 7 dos 19 KPIs do board passam a ser exibidos, contra 0 hoje.
- **SC-002**: Depois de 90 dias de corrida diária, os KPIs de crescimento trimestral do board
  passam a ser calculáveis sem nenhuma coleta nova.
- **SC-003**: Duas corridas no mesmo dia produzem exatamente o mesmo estado no banco.
- **SC-004**: Quem abre a aba de aquisição consegue nomear, em menos de 30 segundos, qual
  consulta trabalhar primeiro — hoje a aba mostra dois totais de 8 meses e nenhuma candidata.
- **SC-005**: Nenhum número exibido tem denominador ausente ou inventado.

## Assumptions

- A janela de descoberta e o corte de D-3 seguem `lib/janelas.mjs`, que já resolve o atraso do
  GSC para as demais células da `/okr`. Esta spec não redefine janela.
- A corrida diária reusa o padrão já em produção em `estado-noturno.yml`: o cron dispara um
  endpoint autenticado do hub e o trabalho acontece no servidor, com retry só em falha de
  conexão — nunca em erro HTTP.
- `scripts/serie-gsc.mjs` permanece como ferramenta de diagnóstico de linha de comando. Ele
  imprime e não grava; esta feature não o altera nem depende dele.
- A credencial do Search Console já usada pela `/okr` (`GOOGLE_SERVICE_ACCOUNT_JSON`) cobre os
  projetos desta feature. Nenhuma credencial nova.
- **Escopo: só a Atma.** ⚠️ CORRIGIDO em 07/09/2026, depois do merge: esta spec nasceu
  percorrendo os 35 projetos e o objetivo era outro — o board de OKR de busca é da Atma, e é
  ela, sozinha, que a corrida grava. A lista viva é `SLUGS_DE_BUSCA` em `lib/projects.ts`.
  A curadoria não muda; muda quem a corrida percorre.
- Marca versus não-marca fica **fora** desta spec: exige uma lista de termos de marca por projeto
  e um corte por país que ninguém definiu ainda. É a primeira candidata à spec seguinte.
