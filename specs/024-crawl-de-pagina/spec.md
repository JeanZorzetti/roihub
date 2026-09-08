# Feature Specification: O que há dentro das páginas da Atma — seis medidas de um crawl só

**Feature Branch**: `024-crawl-de-pagina`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "024 crawl, focada na Atma — as seis medidas do board que dependem de
ler o HTML das páginas"

## Contexto

A 022 apurou a indexação da Atma em 07/09 e o resultado é o motivo desta spec:

| | |
|---|---|
| URLs declaradas no sitemap | **36** |
| Inspecionadas | 36 — sem amostragem |
| **Indexadas** | **9** |
| **Rastreadas e não indexadas** | **19** |
| Descobertas e não indexadas | 8 |
| Falhas | 0 |

**Taxa de indexação: 25%, contra a meta de 95% do board.** E a maior classe — 19 de 36 — é
"o Googlebot **leu** e recusou".

`D-84` já registrou que essa classe não tem alavanca técnica: sitemap, robots e resubmissão não
movem uma página que o Google leu e decidiu não indexar. O que move é o que está **dentro** da
página e como ela é ligada às outras — e é exatamente isso que o hub nunca olhou.

Somando ao que a 021 já mediu na mesma Atma:

- **CTR Gap de 0%** em 4 URLs avaliadas; a principal (13.262 impressões, posição 8,8) rende
  **1,1% de CTR contra 2% esperado** — a hipótese ali é o **título**, não a posição.
- **Canibalização sistemática**: `/blog/quanto-custa-alinhador-invisivel` contra
  `/pacientes/precos` em praticamente toda consulta de preço, com a segunda sempre entre a
  posição 14 e a 67 — duas páginas dividindo autoridade para o mesmo termo.

Esta feature lê o HTML das 36 páginas **uma vez** e produz seis medidas do board:

| Medida do board | Meta |
|---|---|
| Profundidade de Clique (Click Depth) | 100% das páginas transacionais e pilares a ≤ 3 cliques da home |
| Densidade de Links Internos Contextuais | 5 a 10 links contextuais apontando para cada página alvo |
| Taxa de Integridade do Título | 100% dos títulos entre 500px e 580px, termo nos primeiros 35 caracteres |
| Taxa de Alinhamento de Intenção | modificador de intenção explícito no título |
| Taxa de Cobertura de Dados Estruturados | 100% das páginas prioritárias com Schema válido, 0 erros críticos |
| Cadência de Atualização (Content Freshness) | auditoria a cada 6 a 12 meses nos conteúdos pilares |

**Escopo: só a Atma** (`SLUGS_DE_BUSCA = ["atma"]`), como as 021, 022 e 023.

**36 páginas é o que torna esta spec barata.** Ela foi adiada no handoff de 07/09 por ser "a mais
cara do conjunto" — cálculo feito quando o escopo era 34 sites. Com um site de 36 URLs, o crawl
inteiro é menor que a corrida de conformidade que já roda toda noite.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Para onde vai a autoridade interna (Priority: P1)

Para cada página da Atma, a tela mostra a que distância ela está da home em cliques e quantos
links contextuais apontam para ela. Uma página a 4 cliques com 1 link apontando é uma página que
o site declara no sitemap e trata como periférica — e a hipótese mais direta para "o Google leu e
não indexou".

**Why this priority**: é a única das seis que ataca o achado de 25% de indexação. O board é
explícito no mecanismo: "URLs com profundidade 4+ recebem uma fração ínfima do PageRank interno e
quase nunca conquistam o Top 3". Com 27 páginas fora do índice, essa é a primeira coisa a olhar.

**Independent Test**: conferir que a home tem profundidade 0, que uma página linkada nela tem 1,
e que uma URL declarada no sitemap e não alcançável por link nenhum aparece como **órfã** — não
como profundidade zero nem como erro.

**Acceptance Scenarios**:

1. **Given** o site crawleado a partir da home, **When** a tela carrega, **Then** cada URL do
   sitemap aparece com sua profundidade de clique e a contagem de links internos que a apontam.
2. **Given** uma URL do sitemap que nenhum link interno alcança, **When** a tela carrega,
   **Then** ela é marcada como **órfã**, e isso é apresentado como achado — a página está no
   sitemap e o site não aponta para ela.
3. **Given** a meta do board de 5 a 10 links contextuais, **When** a tela carrega, **Then** as
   páginas abaixo de 5 aparecem ordenadas por impressões, para o trabalho começar pela que mais
   rende.
4. **Given** que menu e rodapé aparecem em todas as páginas, **When** os links são contados,
   **Then** eles **não** entram como contextuais.

---

### User Story 2 - O título, que já tem evidência contra si (Priority: P2)

Para cada página, a tela mostra o comprimento do título na medida que o board pede, se o termo de
busca aparece nos primeiros 35 caracteres, e se há um modificador de intenção explícito
("preço", "quanto custa", "como fazer", "melhores", o ano vigente).

**Why this priority**: a 021 já apontou o título como suspeito — CTR Gap de 0% e a página
principal rendendo 1,1% onde a posição pede 2%. Esta história transforma uma hipótese em uma
lista de páginas nomeadas.

**Independent Test**: conferir que um título de 40 caracteres largos e um de 40 estreitos
produzem larguras diferentes, e que a tela declara como a largura foi obtida.

**Acceptance Scenarios**:

1. **Given** as páginas crawleadas, **When** a tela carrega, **Then** cada título aparece com sua
   largura contra a faixa de 500-580px do board e a posição do termo principal.
2. **Given** que a largura em pixels depende da fonte com que o Google renderiza a SERP,
   **When** a largura é exibida, **Then** a tela declara que é **estimativa** e por qual método —
   nunca apresenta um número de pixels como medição exata.
3. **Given** um título sem nenhum modificador de intenção, **When** a tela carrega, **Then** a
   página aparece na lista de alinhamento de intenção ausente.

---

### User Story 3 - Dados estruturados, presentes ou ausentes (Priority: P3)

A tela mostra quais páginas servem Schema válido e de que tipo, e quais não servem nenhum.

**Why this priority**: sai do mesmo HTML já baixado, mas é o mais distante do problema atual —
Schema afeta como o resultado aparece na SERP, não se a página entra no índice. Vale ter, não
vale priorizar.

**Independent Test**: conferir que uma página com `@graph` contendo três tipos é lida como três
tipos, e que JSON-LD sintaticamente inválido conta como **erro**, não como ausência.

**Acceptance Scenarios**:

1. **Given** as páginas crawleadas, **When** a tela carrega, **Then** a fração com Schema válido
   aparece contra a meta de 100% do board, com os tipos encontrados.
2. **Given** uma página com JSON-LD malformado, **When** a tela carrega, **Then** ela conta como
   erro crítico, distinto de "sem Schema".

---

### User Story 4 - Há quanto tempo o conteúdo não é tocado (Priority: P3)

Para cada página, a data de atualização que ela própria declara, contra a cadência de 6 a 12
meses do board.

**Why this priority**: é a mais fraca das seis e a mais fácil de enganar — uma data no HTML não
prova que o conteúdo mudou. Entra porque é do board e sai barato do mesmo crawl.

**Independent Test**: conferir que uma página sem data declarada aparece como "sem data
declarada", nunca como "desatualizada".

**Acceptance Scenarios**:

1. **Given** páginas com data de atualização declarada, **When** a tela carrega, **Then** as que
   passaram de 12 meses aparecem sinalizadas.
2. **Given** uma página que não declara data nenhuma, **When** a tela carrega, **Then** ela é
   listada como sem data — e **não** entra no numerador nem no denominador da cadência.

---

### Edge Cases

- **🚩 Contar palavras com regex de `<script>` mede o regex, não a página.** `D-84` registrou o
  caso: HTML minificado é uma linha só, e um `.*` guloso entre `<script>` e `</script>` engole
  até o **último** fechamento do documento, devolvendo zero palavra numa página que tem `<h1>` e
  texto. Qualquer contagem de conteúdo nesta feature herda essa armadilha.
- **🚩 Link de menu e rodapé não é link contextual.** Todo site serve a navegação em todas as
  páginas; contá-la faz a densidade de links de cada página tender ao número de páginas do site,
  e a medida vira uma constante que não distingue nada. O board pede **contextuais, com âncoras
  exatas** — é a diferença entre a medida existir e não existir.
- **🚩 Pixel não é caractere.** O board pede 500-580px, e `titulo.length` não é largura: "iiiii" e
  "WWWWW" têm o mesmo comprimento e larguras muito diferentes. Estimar é aceitável; **chamar a
  estimativa de medição não é**.
- **SPA que serve HTML vazio**: `D-84` mediu 3 projetos da casa servindo zero palavra no HTML
  inicial. Uma página assim não é "sem conteúdo" — é conteúdo que só existe depois do JavaScript,
  e o crawl precisa dizer qual dos dois está vendo.
- **Página órfã**: alcançável pelo sitemap e por nenhum link. Profundidade indefinida, não zero e
  não erro — é dos achados mais úteis desta feature.
- **JSON-LD em `@graph` ou em vários blocos** na mesma página.
- **URL declarada no sitemap que responde 404 ou redireciona**: o destino conta, e o fato de o
  sitemap declarar uma URL morta é achado.
- **Ciclos de links** entre páginas: a travessia não pode entrar em laço.
- **Link para outro host** (incluindo subdomínio) não é link interno.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST buscar o HTML de cada URL declarada no sitemap do projeto, uma vez
  por corrida.
- **FR-002**: O sistema MUST calcular a profundidade de clique de cada URL a partir da home,
  seguindo apenas links do mesmo host.
- **FR-003**: URL alcançável pelo sitemap e por nenhum link interno MUST ser marcada como órfã,
  distinta de profundidade 0 e de erro.
- **FR-004**: A contagem de links internos MUST excluir os links de navegação repetidos em todas
  as páginas (menu, rodapé), contando apenas os contextuais.
- **FR-005**: O sistema MUST registrar, por URL, o título servido e sua largura estimada em
  pixels, e MUST declarar na tela que a largura é estimativa e por qual método.
- **FR-006**: O sistema MUST registrar a posição do termo principal dentro do título, contra o
  limite de 35 caracteres do board.
- **FR-007**: O sistema MUST detectar modificadores de intenção no título e classificar a página
  como tendo ou não alinhamento explícito.
- **FR-008**: O sistema MUST extrair todos os blocos de dados estruturados de cada página,
  incluindo os agrupados, e MUST distinguir **ausente** de **inválido**.
- **FR-009**: O sistema MUST registrar a data de atualização declarada por cada página, e páginas
  sem data MUST ficar fora do numerador e do denominador da cadência.
- **FR-010**: Nenhuma contagem de conteúdo MUST usar remoção de `<script>` por expressão gulosa;
  o método usado MUST ser verificável por teste contra HTML minificado de uma linha.
- **FR-011**: O sistema MUST distinguir "página sem conteúdo no HTML" de "conteúdo dependente de
  JavaScript".
- **FR-012**: A travessia MUST terminar mesmo com ciclos de links, e MUST respeitar um teto de
  páginas visitadas por corrida, declarado na tela quando atingido.
- **FR-013**: URL do sitemap que responde erro ou redireciona MUST ser registrada como tal, e
  isso MUST aparecer como achado.
- **FR-014**: A corrida MUST percorrer apenas os projetos de `projetosDeBusca()`.
- **FR-015**: A tela MUST trazer a data da apuração; um crawl de semanas atrás não pode se
  apresentar como o estado de hoje.
- **FR-016**: Falha ao buscar uma página MUST NOT derrubar o crawl das demais, e MUST ser contada
  como falha — nunca como página sem título, sem Schema ou sem links.

### Key Entities

- **Página crawleada**: uma URL do sitemap com o que foi lido dela — título e sua largura, blocos
  de dados estruturados, data declarada, links internos que ela emite, e o estado da busca.
- **Aresta interna**: um link contextual de uma página para outra do mesmo host. É o que produz
  tanto a profundidade quanto a densidade — duas leituras do mesmo grafo, não dois crawls.
- **Apuração de crawl**: a corrida de um projeto num dia — quantas páginas o sitemap declarava,
  quantas foram visitadas, quantas falharam, e a data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 6 medidas do board saem de ausentes para exibidas — o placar vai de 16 para 22
  de 28.
- **SC-002**: Toda URL do sitemap da Atma tem profundidade de clique conhecida ou está marcada
  como órfã.
- **SC-003**: A contagem de links contextuais de uma página não muda quando o menu do site muda
  de tamanho — prova de que a navegação está fora da conta.
- **SC-004**: Nenhuma largura de título é apresentada como medição exata.
- **SC-005**: Existe teste que reprova contagem de conteúdo sobre HTML minificado de uma linha.
- **SC-006**: Quem abre a tela consegue nomear, em menos de 30 segundos, quais das 27 páginas
  fora do índice são órfãs ou periféricas — que é a pergunta que a 022 deixou aberta e nenhuma
  tela responde hoje.

## Assumptions

- **Reusa `lib/sitemap.mjs`** (`locs`, `ehIndice`, `lerSitemap`), construído pela 022, para saber
  quais URLs existem — e `buscar()` de `lib/conformidade.mjs` para o fetch, que já trata timeout
  e erro no idioma da casa. Esta feature **não** escreve um crawler novo.
- **Um crawl, seis medidas.** Profundidade e densidade são duas leituras do mesmo grafo de
  links; título, Schema e data saem do mesmo HTML já baixado. Separar em corridas seria buscar as
  mesmas 36 páginas quatro vezes.
- **A travessia parte da home** e segue links internos em largura, com teto de páginas por
  corrida. Com 36 URLs o teto não deve ser atingido na Atma — ele existe para o dia em que um
  site maior entrar em `SLUGS_DE_BUSCA`.
- **A largura do título é estimada** por tabela de larguras de caractere, não por renderização.
  Renderizar para medir exigiria navegador headless na corrida, o que custa mais do que a medida
  vale — e a estimativa resolve a decisão ("cabe ou não cabe") que o board quer tomar.
- **Os modificadores de intenção saem da lista do próprio board** (informacional: "como fazer",
  "passo a passo", "guia", "exemplos"; comercial: "preço", "comparativo", "melhores", "planos",
  "grátis", ano vigente).
- Reusa o padrão de corrida das 021/022/023 — cron dispara endpoint autenticado, trabalho no
  servidor, escrita idempotente, fora das janelas do Princípio IV.
- A cadência é **semanal**: estrutura interna e título mudam por deploy, não por hora.

## Out of Scope

- **A "taxa de reescrita do título pelo Google"**, metade da medida CLIQUE-4 do board: o Search
  Console não expõe o título exibido na SERP, e obtê-lo exigiria raspar resultados de busca.
  Fica declarada como ausente, com o motivo, como já combinado no handoff de 07/09.
- **Cobertura Semântica / Entidades**: exige comparar com o Top 3 da SERP. É a medida mais cara e
  mais subjetiva do board e continua fora.
- **Renderizar JavaScript.** O crawl lê o HTML servido. Quando o conteúdo depender de JS, a tela
  diz isso em vez de fingir que a página está vazia — mas executar o JS é outra ordem de custo.
- **Consertar** qualquer uma das seis. Esta feature mede.
- **Sugerir onde adicionar links internos**: a lista de páginas com poucos links é o insumo; a
  decisão editorial de onde ligar é humana.
