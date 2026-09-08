# Tasks: O que há dentro das páginas da Atma — seis medidas de um crawl só

**Feature**: 024 | **Branch**: `024-crawl-de-pagina` | **Data**: 2026-09-08

**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/api-paginas.md](./contracts/api-paginas.md) ·
[quickstart.md](./quickstart.md)

**Testes**: SIM, e aqui eles são o produto, não o acessório. As três armadilhas 🚩 da spec
(menu contado como link contextual, pixel confundido com caractere, `.*` guloso entre `<script>`)
produzem números que *parecem certos* — e todas as três são erros de **parsing**, que é
exatamente o que se prova sem rede. O Princípio II exige `node --test` registrado à mão:
`test/pagina.test.mjs` e `test/grafo.test.mjs` entram na lista do `package.json` **no mesmo
commit** em que nascem (`test/validade.test.mjs` reprova se esquecermos).

**Organização**: por user story — mas com uma consequência que o `speckit-analyze` de 08/09
obrigou a encarar: **o crawl é um só, então a extração é indivisível**. A rota escreve as 17
colunas de `hub_pagina` numa transação; não existe "escrever só as colunas da US1". Por isso
`lib/pagina.mjs` **inteiro** é Foundational, e as user stories se separam onde de fato dá para
separar: **no grafo, nas taxas e na tela**. Fingir o contrário produziria uma US1 que não roda.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência)
- **[Story]**: a que user story a tarefa pertence
- Todo caminho de arquivo é literal e relativo à raiz do repo

## Caminhos desta feature

Aplicação web única (App Router + `lib/`). **Nenhuma dependência nova, nenhum parser de HTML,
nenhum navegador headless, nenhum arquivo além dos abaixo.**

```text
lib/pagina.mjs                     NOVO    puro — extração de UM html + posicaoDoTermo
lib/grafo.mjs                      NOVO    puro — travessia, navegação, densidade, agregar, taxas
test/pagina.test.mjs               NOVO    registrado em package.json no mesmo commit
test/grafo.test.mjs                NOVO    registrado em package.json no mesmo commit
app/api/paginas/route.ts           NOVO    a corrida semanal
.github/workflows/paginas.yml      NOVO    cron 17 9 * * 1 (segunda, 06:17 BRT)
lib/conformidade.mjs               tocado  buscar() ganha `url` e `redirecionada` (D13, aditivo)
lib/kpis-busca.mjs                 tocado  + termoPrincipal(linhas, url) (D10)
lib/db.ts                          tocado  ensure() + 2 tabelas, gravarCrawlDePagina, lerCrawlDePagina
lib/sitemap.mjs                    reusado sem alteração (022)
test/conformidade.test.mjs         tocado  casos de `url`/`redirecionada`
test/kpis-busca.test.mjs           tocado  casos de termoPrincipal
app/okr/[slug]/aquisicao/page.tsx  tocado  bloco novo: as seis medidas, datadas — SÓ renderiza
middleware.ts                      tocado  isenta /api/paginas
package.json / .env.example        tocado
```

**`page.tsx` só renderiza.** Nenhuma taxa, nenhum numerador, nenhuma posição de termo é calculada
lá dentro (Princípio III: se dá para testar sem subir o Next, nasce em `.mjs`). As quatro taxas do
board moram em `lib/grafo.mjs`, ao lado de `agregar()`, porque são agregação sobre a coleção de
páginas — e `posicaoDoTermo()` mora em `lib/pagina.mjs`, porque é sobre o título de uma página só.

---

## Phase 1: Setup — o que precisa existir antes de qualquer regra

**Purpose**: registrar os arquivos de teste e a variável nova **antes** de escrever a regra, para
que o Princípio II não vire pendência de fim de sprint.

- [X] **T001** [P] Criar `test/pagina.test.mjs` e `test/grafo.test.mjs` com um teste trivial cada
  (`assert.ok(true)`) e **acrescentar os dois à lista explícita** do script `test` em
  `package.json`, na ordem em que aparecem os demais. Rodar `npm test` e confirmar que
  `test/validade.test.mjs` passa — é ele que reprova arquivo de teste não registrado.

- [X] **T002** [P] Acrescentar ao `.env.example` a variável `PAGINAS_POR_CORRIDA=` **vazia**, com
  o comentário de que o padrão é `300` e que ela é teto de **tempo**, não de cota
  ([contracts/api-paginas.md](./contracts/api-paginas.md) §Ambiente). Valor real nunca entra neste
  arquivo (Princípio V).

**Checkpoint**: `npm test` verde com os dois arquivos novos na lista.

---

## Phase 2: Foundational — o crawl inteiro, porque o crawl é um só

**Purpose**: a busca que conta o redirecionamento, as duas tabelas, e **`lib/pagina.mjs`
completo**. Esta fase é grande de propósito: `hub_pagina` tem `schema_estado` e `conteudo_estado`
como `NOT NULL`, e a rota escreve a linha de uma vez. Deixar `blocosJsonLd()` ou
`estadoDoConteudo()` para uma fase adiante obrigaria a US1 a inventar um valor de preenchimento —
que é exatamente o "campo ausente virando zero" que o §2 do data-model proíbe. É a conta que a
decisão **"um crawl, seis medidas"** cobra: as medidas se separam na leitura, não na escrita.

**⚠️ CRÍTICO**: nenhuma user story começa antes desta fase.

### A borda de rede e o banco

- [X] **T003** Em `lib/conformidade.mjs`, acrescentar `url` (a final, após redirecionamentos, de
  `r.url`) e `redirecionada` (de `r.redirected`) ao objeto devolvido por `buscar()` — mudança
  **aditiva** (D13). Conferir os chamadores atuais (`lib/bm25.mjs`, `lib/sitemap.mjs`,
  `app/api/indexacao/route.ts`, `app/busca/page.tsx` e o próprio `conformidade.mjs`): todos
  desestruturam campos nomeados, então nenhum muda. No caminho de erro, `url` é a URL pedida e
  `redirecionada` é `false` — nunca `undefined`.

- [X] **T004** [P] Em `test/conformidade.test.mjs`, cobrir a T003 com `fetch` injetado/dublê:
  resposta direta ⇒ `redirecionada: false` e `url` igual à pedida; resposta com `redirected: true`
  e `r.url` diferente ⇒ `redirecionada: true` e `url` **de destino**; erro de rede ⇒ `url` presente
  e `redirecionada: false`.

- [X] **T005** [P] Em `lib/db.ts`, acrescentar ao `ensure()` as tabelas `hub_pagina_corrida` e
  `hub_pagina` com `CREATE TABLE IF NOT EXISTS`, colunas e PKs exatamente como
  [data-model.md](./data-model.md) §1 e §2 — em particular `profundidade INT` **anulável**
  (`NULL` = órfã), `titulo TEXT` anulável (`NULL` ≠ vazio), `data_declarada DATE` anulável e
  `links_contextuais INT NOT NULL`. PK `(projeto, dia)` e `(projeto, dia, url)`. Nenhum índice
  extra — `(projeto, dia)` já é prefixo da PK.

### `lib/pagina.mjs` — a armadilha do `D-84` primeiro

- [X] **T006** Em `lib/pagina.mjs` (novo, puro — sem `fetch`, sem `pg`, sem `process.env`, sem
  relógio), implementar `semScriptNemStyle(html)` com regex **NÃO-GULOSA** conforme **D5**, e
  `contarPalavras(html)` sobre o resultado (tira tags, colapsa espaço). É a **FR-010**, e vem
  primeiro porque `estadoDoConteudo()` e `extrair()` dependem dela.

- [X] **T007** Em `test/pagina.test.mjs`, escrever a **SC-005** — o teste que decide se os números
  desta feature valem alguma coisa. HTML **minificado de uma linha** com dois blocos `<script>` e
  um `<h1>` no meio (o do [quickstart](./quickstart.md) §2): `contarPalavras()` devolve as palavras
  do `<h1>` e do `<p>`, **nunca 0**. Com o `.*` guloso do `D-84` o resultado seria 0 numa página
  que tem `<h1>` — a **contradição interna é a asserção**.

- [X] **T008** [P] Em `lib/pagina.mjs`, implementar `linksDe(html)`: todos os `<a href>`, âncora
  com tags removidas e espaço colapsado, devolvendo `{href, ancora}[]`. É o par que `navegacao()`
  usa como chave — e **sem ela a travessia da US1 não tem o que percorrer**, que é o motivo de
  estar aqui e não no polimento.

- [X] **T009** [P] Em `lib/pagina.mjs`, implementar `titulo(html)`: primeiro `<title>`, entidades
  básicas decodificadas. Devolve `null` quando a página **não serve** `<title>` e string vazia
  quando serve vazio — **são coisas diferentes** e o data-model depende disso.

- [X] **T010** Em `lib/pagina.mjs`, implementar `larguraDoTitulo(t)` conforme **D4**: tabela de
  larguras de Arial em `em` (estreitos como i, l, j, I, ponto, vírgula ~0,22; minúsculas ~0,55;
  m, M, W ~0,83; demais maiúsculas ~0,70), fallback 0,55 para desconhecido, acentuado usando a
  largura da letra base, multiplicado por **20 px**. Devolve `{px, metodo: "arial-20px-tabela"}` —
  **nunca um número solto**: o `metodo` é o que impede a estimativa de ser lida como medição.

- [X] **T011** Em `test/pagina.test.mjs`, escrever a **SC-004**: uma string de dez `i` e uma de
  dez `W` têm o **mesmo comprimento** e larguras **diferentes**, e as duas devolvem `metodo`
  preenchido. Mais: `titulo()` de uma página sem `<title>` é `null`, de `<title></title>` é string
  vazia.

- [X] **T012** [P] Em `lib/pagina.mjs`, implementar `modificadoresDeIntencao(t, ano)` conforme
  **D9**: o ano vigente é **parâmetro**, não `new Date()` dentro do módulo puro — "2026" escrito
  no código apodrece em janeiro e o modificador comercial passaria a reprovar todo mundo. Lista do
  próprio board: informacional ("como fazer", "passo a passo", "guia", "exemplos"); comercial
  ("preço", "comparativo", "melhores", "planos", "grátis", o ano). Devolve `informacional`,
  `comercial`, `ambos` ou `ausente`.

- [X] **T013** Em `test/pagina.test.mjs`, cobrir T012: título com termo informacional e comercial
  ⇒ `ambos`; título sem nenhum ⇒ `ausente`; o **ano passado como parâmetro** conta, outro ano não.

- [X] **T014** [P] Em `lib/pagina.mjs`, implementar `blocosJsonLd(html)` conforme **D11**: extrai
  **todos** os `<script type="application/ld+json">`, cada um passa por `JSON.parse`. Zero blocos
  ⇒ `ausente`. Bloco que estoura ⇒ `invalido`. Bloco válido ⇒ os `@type` colhidos **descendo em
  `@graph` e em arrays, recursivamente**. Página com um bloco válido e outro quebrado é
  **inválida** — o board mede "0 erros críticos", e um erro presente não é apagado por um acerto
  ao lado.

- [X] **T015** Em `test/pagina.test.mjs`, cobrir T014: `@graph` com três tipos ⇒ os três; JSON
  malformado ⇒ `estado: "invalido"`, **não** `"ausente"`; zero blocos ⇒ `"ausente"` com
  `tipos: []`; um bloco válido + um quebrado ⇒ `"invalido"`. São consertos completamente diferentes
  (escrever schema × achar a vírgula).

- [X] **T016** [P] Em `lib/pagina.mjs`, implementar `dataDeclarada(html)` na **ordem que é a
  regra**: JSON-LD `dateModified` → `article:modified_time` → `<time datetime>`. O último é o
  último porque `<time>` na página tanto pode ser a data do artigo quanto a de um comentário.
  Nenhuma das três ⇒ `null`.

- [X] **T017** Em `test/pagina.test.mjs`, cobrir T016: a ordem de precedência com as três fontes
  presentes; página sem nenhuma ⇒ `null`. (A regra de a data ausente ficar fora do numerador **e**
  do denominador é da agregação, e é testada na T054.)

- [X] **T018** Em `lib/pagina.mjs`, implementar `estadoDoConteudo(html, palavras)` conforme
  **D12**, **reusando `detectarStack()`** de `lib/conformidade.mjs` em vez de reescrevê-la: com
  palavras acima do piso ⇒ `com-conteudo`; sem palavras **e** com marca de app que hidrata
  (`<div id="root">`, `<div id="__next">`, `detectarStack()` acusando `vite-spa`) ⇒
  `js-dependente`; sem palavras e sem marca ⇒ `sem-conteudo`. Colapsar os dois últimos trocaria
  "está na fila de render" por "não tem texto" — diagnósticos com consertos **opostos**.

- [X] **T019** Em `test/pagina.test.mjs`, cobrir T018: HTML com texto ⇒ `com-conteudo`; casca de
  SPA sem texto ⇒ `js-dependente`; HTML sem texto e sem marca ⇒ `sem-conteudo`.

- [X] **T020** Em `lib/pagina.mjs`, implementar `extrair(html, ano)` compondo as anteriores **numa
  passada**, devolvendo a forma `Extraida` do §4 do data-model. É a função que a rota chama para
  preencher a linha inteira de `hub_pagina`. Nenhum campo ausente vira zero: `titulo` `null` ≠
  string vazia, `dataDeclarada` `null` é ausência, `palavras: 0` só quando o método não-guloso de
  fato contou zero.

- [X] **T021** Em `test/pagina.test.mjs`, assertar a **contradição que denunciou o `D-84`** como
  invariante de `extrair()`: HTML com `<h1>` presente **não pode** sair com `palavras: 0`.

**Checkpoint**: `npm test` verde, `tsc --noEmit` limpo, `ensure()` cria as duas tabelas num banco
limpo, e `extrair()` devolve as 17 colunas de `hub_pagina` a partir de uma string de HTML.

---

## Phase 3: User Story 1 — Para onde vai a autoridade interna (P1) 🎯 MVP

**Goal**: cada URL do sitemap da Atma com sua profundidade de clique e a contagem de links
**contextuais** que a apontam — e as órfãs nomeadas. É a única das seis que ataca o achado de 25%
de indexação da 022.

**Independent Test**: home com profundidade 0, página linkada nela com 1, e URL declarada no
sitemap que nenhum link alcança marcada como **órfã** — não como profundidade zero, não como erro.

### O grafo (é onde as armadilhas que sobraram moram)

- [X] **T022** [P] [US1] Em `lib/grafo.mjs` (novo, puro — sem `fetch`, sem `pg`, sem
  `process.env`, sem relógio), implementar `canonizar(href, base)` conforme **D3**: resolve
  relativo contra a base, minúscula o host, remove fragmento, remove barra final **exceto na
  raiz**, preserva query; devolve `null` para `mailto:`, `tel:`, `javascript:` e âncora pura.

- [X] **T023** [P] [US1] Em `lib/grafo.mjs`, implementar `ehInterna(url, host)`: mesmo host
  **exato**. Subdomínio **não** é interno (Edge Case da spec).

- [X] **T024** [US1] Em `test/grafo.test.mjs`, cobrir T022/T023: `/precos` e `/precos/` canonizam
  para a **mesma** chave; a raiz mantém a barra; host em maiúscula vira minúsculo; `#topo`,
  `mailto:` e `tel:` devolvem `null`; `blog.x.com` **não** é interno de `x.com`. Sem isso
  `/precos` e `/precos/` viram duas páginas e o sitemap inteiro parece órfão.

- [X] **T025** [US1] Em `lib/grafo.mjs`, implementar `navegacao(arestas, totalPaginas)` conforme
  **D1**: devolve o `Set` de chaves `href` + quebra de linha + `âncora` emitidas por
  ≥ `FRACAO_NAVEGACAO` (0,5) das páginas visitadas **e** por ≥ `MIN_PAGINAS_NAVEGACAO` (3) delas.
  As duas constantes ficam exportadas do módulo, cobertas por teste — **nunca** em variável de
  ambiente.

- [X] **T026** [US1] Em `test/grafo.test.mjs`, escrever a **SC-003 como teste de invariância**:
  o mesmo conjunto de páginas duas vezes — primeiro com um menu de **5** links em todas, depois
  com um de **15** —, e `densidades()` devolve **exatamente os mesmos números** nos dois casos.
  Não é preciso saber o número certo de antemão; é o defeito que se reprova. Cobrir também o piso
  de 3 páginas: link repetido em 2 páginas de um conjunto de 3 **não** é navegação.

- [X] **T027** [US1] Em `lib/grafo.mjs`, implementar `profundidades(arestas, home, teto)` conforme
  **D2/D7**: travessia **em largura** sobre **todas** as arestas (link de menu é um clique de
  verdade), `visitados` como `Set` para ciclo terminar por construção, parada no teto devolvendo
  `tetoAtingido: true`. Devolve `Map<url, número>`; **ausente do mapa = inalcançável**, jamais 0.

- [X] **T028** [US1] Em `lib/grafo.mjs`, implementar `densidades(arestas, nav)` conforme **D2**:
  conta arestas **recebidas** excluindo as que estão em `nav` e excluindo autolinks
  (`de === para`). Duas leituras do mesmo grafo, não dois crawls.

- [X] **T029** [US1] Em `lib/grafo.mjs`, implementar `agregar(paginas)`: as contagens da corrida
  (`visitadas`, `falhas`, `orfas`, `linkadasNaoDeclaradas`, `linksNavegacao`, `profundidadeMaxima`)
  **mais as três invariantes** do §2 do data-model como asserções internas.

- [X] **T030** [US1] Em `test/grafo.test.mjs`, cobrir T027/T028/T029 com o grafo do
  [quickstart](./quickstart.md) §2: home linka A e B; C só existe no sitemap; D falhou na busca.
  Asserções: `profundidade(home) = 0`, `profundidade(A) = 1`, `profundidade(C) = null` **com
  `orfa = true`**, e `D` com `profundidade = null` **e `erro` preenchido** que **não** entra em
  `orfas`. Somar as duas transformaria erro de rede em achado de arquitetura de links. Mais:
  ciclo `A → B → A` com teto 100 **encerra**; teto 2 num grafo de 5 devolve `tetoAtingido: true`.

- [X] **T031** [US1] Em `lib/grafo.mjs`, implementar `dedupPorUrl(paginas)` — **uma URL canônica,
  uma linha**. Sem isso a PK `(projeto, dia, url)` estoura no **INSERT multi-linha** e a corrida
  inteira cai, que é o oposto da FR-016. Dois caminhos produzem a colisão e os dois são normais:
  **duas URLs do sitemap redirecionando para o mesmo destino** (D13 — o destino é que conta) e uma
  URL alcançada na fase largura sendo recolhida de novo na fase colheita. A linha que sobrevive
  mantém `no_sitemap = true` se **qualquer** das colididas era declarada. Cobrir os dois casos em
  `test/grafo.test.mjs`.

### A corrida

- [X] **T032** [US1] Criar `app/api/paginas/route.ts` com `runtime = "nodejs"` e
  `maxDuration = 800` (o **mesmo** valor de `/api/indexacao`, para o proxy do EasyPanel não mudar).
  Validar `DATABASE_URL` **na entrada** e devolver `503` com `{"error":"ambiente incompleto","faltando":[...]}`
  contendo **apenas os nomes** (Princípio V). Ler `PAGINAS_POR_CORRIDA` com padrão `300`.

- [X] **T033** [US1] Em `middleware.ts`, isentar `/api/paginas` na mesma condição que já isenta
  `/api/gsc-serie` e `/api/indexacao` — reusa o `CRON_SECRET` existente, **sem segredo novo**
  (ler HTML público de um site da casa é a menor capacidade do conjunto).

- [X] **T034** [US1] Em `app/api/paginas/route.ts`, implementar a ordem de trabalho do
  [contrato](./contracts/api-paginas.md) §Execução: `projetosDeBusca()` de `lib/projects.ts`
  (FR-014) → `buscar(base + "/robots.txt")` → `urlDoSitemap()` de **`lib/conformidade.mjs`** →
  `lerSitemap()` de `lib/sitemap.mjs` (022, sem alteração) → **fase largura** a partir da home
  canonizada, extraindo cada página com `extrair()` → **fase colheita** das URLs do sitemap que a
  largura não alcançou, buscadas do mesmo jeito e marcadas **órfãs** (D7) → `navegacao()` →
  `densidades()` → `dedupPorUrl()` → `agregar()`. Busca em **lotes de 4** — é contra um único
  host, de um cliente da casa; educação com o servidor, não performance.

- [X] **T035** [US1] Na mesma rota, tratar os três estados de `motivo` como **estados diferentes**
  que nunca somam num "0 páginas": `sem_sitemap`, `sitemap_vazio` e **`home_inacessivel`**. No
  terceiro, gravar o motivo e **não gravar linha nenhuma** em `hub_pagina` — sem home não há origem
  para a travessia, e toda página do sitemap sairia órfã por causa de um `ETIMEDOUT`.

- [X] **T036** [US1] Na mesma rota, garantir a FR-016: exceção por página é capturada, truncada em
  **60 caracteres** e entra em `falhas` — a página fica com `erro` preenchido e **nunca** vira
  "página sem título, sem Schema ou sem links". Nenhuma mensagem carrega valor de ambiente. Falha
  parcial responde `200` com a lista nominal de URLs que caíram.

- [X] **T037** [US1] Em `lib/db.ts`, implementar `gravarCrawlDePagina(...)`: upsert em
  `hub_pagina_corrida` por `(projeto, dia)` e, em `hub_pagina`,
  `DELETE FROM hub_pagina WHERE projeto = $1 AND dia = $2` seguido de **INSERT multi-linha**, no
  padrão de `gravarDiasGsc` (`lib/db.ts:832`). `DELETE` antes do `INSERT` e **não** `ON CONFLICT`:
  uma URL que saiu do site precisa sumir da corrida do dia, e o upsert a deixaria como fantasma
  indistinguível de uma página viva. O lote chega já deduplicado pela T031.

- [X] **T038** [US1] Em `lib/db.ts`, implementar `lerCrawlDePagina(projeto)` devolvendo a
  **última** corrida no formato `CrawlDePagina` do contrato — com `dia` no objeto (FR-015: um
  crawl de semanas atrás não pode se apresentar como o estado de hoje) e `paginas` já ordenadas:
  **órfã primeiro, depois profundidade desc, depois url**.

### A tela

- [X] **T039** [US1] Em `app/okr/[slug]/aquisicao/page.tsx`, abrir o bloco novo abaixo de
  Indexação lendo de `lerCrawlDePagina()` — **lê o gravado e nunca busca**: uma tela com
  `revalidate` que crawleasse ao carregar transformaria cada visita numa varredura do site do
  cliente. Exibir **a data da apuração** (FR-015) e, quando `tetoAtingido`, dizer que o número
  está incompleto (FR-012).

- [X] **T040** [US1] No mesmo bloco, listar as páginas ordenadas por **periferia** (órfã →
  profundidade ≥ 4 → menos de 5 links contextuais), marcando quem tem **zero impressão** no GSC
  (`porUrl()` de `lib/kpis-busca.mjs`, que a página já importa). Órfã aparece como **órfã**, nunca
  como profundidade 0 (US1 cenário 2). As páginas abaixo de 5 links contextuais aparecem
  **ordenadas por impressões**, para o trabalho começar pela que mais rende (US1 cenário 3).

- [X] **T041** [US1] No mesmo bloco, declarar na tela o risco aceito do plano: esta lista **não
  cruza página a página com as 27 fora do índice**, porque a 022 grava só o agregado do dia. Sem
  essa frase, o leitor conclui sozinho que a órfã é a recusada.

**Checkpoint**: US1 entregue e verificável sozinha — o [quickstart](./quickstart.md) §4 e §5 rodam
e a SC-006 (nomear as periféricas em menos de 30 s) é cronometrável.

---

## Phase 4: User Story 2 — O título, que já tem evidência contra si (P2)

**Goal**: transformar a hipótese da 021 (CTR Gap de 0%, página principal rendendo 1,1% onde a
posição pede 2%) numa lista de páginas nomeadas.

**Independent Test**: um título de 40 caracteres largos e um de 40 estreitos produzem larguras
**diferentes**, e a tela declara **como** a largura foi obtida.

- [X] **T042** [P] [US2] Em `lib/pagina.mjs`, implementar `posicaoDoTermo(titulo, termo)`
  (FR-006): o índice do termo dentro do título, contra o limite de **35 caracteres** do board.
  Título `null` ou termo `null` ⇒ `null`, **jamais 0** — 0 é "está na primeira posição", que é o
  melhor caso possível, e confundi-lo com ausência inverteria a medida. Cobrir em
  `test/pagina.test.mjs`, incluindo casamento sem diferenciar acento e caixa.

- [X] **T043** [US2] Em `lib/kpis-busca.mjs`, implementar `termoPrincipal(linhas, url)` conforme
  **D10**: a consulta de **maior impressão** daquela URL na janela que a aba já carrega. URL sem
  consulta com impressão devolve `null` — que a tela lê como **"sem termo apurado"**, nunca como
  "termo ausente do título".

- [X] **T044** [US2] Em `test/kpis-busca.test.mjs`, cobrir T043: a consulta escolhida é a de maior
  impressão (não a de mais cliques, não a primeira da lista); URL ausente das linhas devolve `null`;
  empate resolve de forma determinística.

- [X] **T045** [US2] Em `lib/grafo.mjs`, ao lado de `agregar()`, implementar
  `taxaIntegridadeDoTitulo(paginas, termos)` e `taxaAlinhamento(paginas)` — as duas medidas do
  board da US2, **puras e testáveis sem subir o Next** (Princípio III). A primeira exige
  `titulo_px` ∈ [500, 580] **e** `posicaoDoTermo` ≤ 35; URL com termo `null` **sai do
  denominador** e nunca conta como título reprovado. Cobrir em `test/grafo.test.mjs`: uma página
  sem termo apurado não move nem o numerador nem o denominador.

- [X] **T046** [US2] Na tela (`app/okr/[slug]/aquisicao/page.tsx`), **renderizar** o que a T045
  calculou: a largura por página contra a faixa de 500-580px com a palavra **"estimativa"** e o
  método visíveis (FR-005/SC-004 — número de pixels solto viola a FR-005), a posição do termo,
  a lista de alinhamento de intenção ausente (FR-007), e **"sem termo apurado"** onde o GSC não
  tem impressão. Nenhuma conta dentro do `.tsx`.

**Checkpoint**: US1 + US2 entregues; a lista de títulos suspeitos existe e é nomeada.

---

## Phase 5: User Story 3 — Dados estruturados, presentes ou ausentes (P3)

**Goal**: quais páginas servem Schema válido e de que tipo, e quais não servem nenhum.

**Independent Test**: `@graph` com três tipos é lido como **três** tipos (T015, já verde), e
JSON-LD sintaticamente inválido conta como **erro**, não como ausência.

- [X] **T047** [US3] Em `lib/grafo.mjs`, implementar `taxaCobertura(paginas)`: a fração com
  `schema_estado = 'valido'` contra a meta de **100%** do board, devolvendo `invalido` e `ausente`
  como **dois números separados** — nunca somados num "sem schema". Cobrir em
  `test/grafo.test.mjs`: 1 válida + 1 inválida + 1 ausente ⇒ taxa 1/3 com os dois estados de falha
  distinguíveis. São consertos completamente diferentes (escrever schema × achar a vírgula).

- [X] **T048** [US3] Na tela, renderizar a taxa da T047 com os tipos encontrados por página, e
  **`invalido` visualmente separado de `ausente`**.

---

## Phase 6: User Story 4 — Há quanto tempo o conteúdo não é tocado (P3)

**Goal**: a data de atualização que cada página declara, contra a cadência de 6 a 12 meses.

**Independent Test**: página sem data declarada aparece como **"sem data declarada"**, nunca como
"desatualizada".

- [X] **T049** [US4] Em `lib/grafo.mjs`, implementar `cadencia(paginas, hoje)` — `hoje` é
  **parâmetro**, pelo mesmo motivo da D9. Página com `data_declarada = null` fica **fora do
  numerador E do denominador** (FR-009). Cobrir em `test/grafo.test.mjs`: 2 páginas com data (1
  vencida) + 3 sem data ⇒ denominador **2**, não 5. É a asserção que impede "sem data" de virar
  "desatualizada" — o Independent Test desta história.

- [X] **T050** [US4] Na tela, sinalizar as páginas que passaram de 12 meses e listar as sem data
  **como sem data**, fora das duas pontas da fração.

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: o achado das URLs mortas, o gatilho semanal, e a verificação que decide se qualquer
número desta feature vale alguma coisa.

- [X] **T051** Na rota e na tela, fechar a **FR-013**: URL do sitemap que responde erro ou
  redireciona é gravada com `status`, `erro` e `redirecionada`, e aparece como **achado** — o
  destino conta (a T031 já garantiu que duas origens para o mesmo destino viram uma linha), e o
  fato de o sitemap declarar uma URL morta é a informação.

- [X] **T052** [P] Criar `.github/workflows/paginas.yml` conforme **D14**: cron `17 9 * * 1`
  (segunda, **06:17 BRT**) — fora das duas janelas proibidas do Princípio IV (23:30-01:00 e
  08:00-08:45 BRT) e 30 min depois da corrida de indexação, que roda `47 8 * * *` (05:47 BRT), para
  as duas não dividirem o container. O Actions **só dispara**; o trabalho é server-side. Retry
  cobre **apenas** falha de conexão (`7`, `35`, `52`), **nunca timeout**: aqui timeout significa
  "está rodando", e repetir buscaria as 36 páginas de novo enquanto a primeira corrida ainda
  escreve.

- [X] **T053** Rodar o [quickstart](./quickstart.md) inteiro: `npm test` verde; §3 (extrair de uma
  página real, sem gravar); §4 a corrida contra o banco **conferindo as cinco linhas da tabela**
  (`visitadas` bate com o `count(*)`; `orfas` conta só quem tem `erro IS NULL`; `linksNavegacao` é
  da ordem de dezenas e não centenas; `profundidadeMaxima` é 3-5 e não `null`; **rodar duas vezes
  no mesmo dia não duplica linha**); §5 a tela; §6 o workflow.

- [X] **T054** ⚠️ **A primeira corrida mede o check.** Antes de tratar qualquer número como fato
  sobre a Atma, abrir **3 páginas no navegador** e conferir à mão: o título que o crawl leu é o que
  o navegador mostra? A página que ele chamou de órfã realmente não é linkada de lugar nenhum?
  Anotar o resultado como **fato medido** no handoff — é a décima primeira vez que esta base
  precisa deste passo.

- [X] **T055** Escrever `specs/024-crawl-de-pagina/handoff-024-crawl-de-pagina.md` com os números
  medidos da T053/T054, quantas das 27 páginas fora do índice são órfãs ou periféricas, e o que
  ficou declarado ausente (a taxa de reescrita do título pelo Google e a Cobertura Semântica, com
  o motivo). Confirmar a **SC-001**: o placar do board vai de 16 para **22 de 28**.

---

## Dependências

```text
Setup (T001-T002)
   └─> Foundational (T003-T021)   ← buscar() + tabelas + lib/pagina.mjs INTEIRO
          │                          a rota escreve a linha de uma vez; a extração não se fatia
          ├─> US1  (T022-T041)  P1  🎯 MVP — grafo + rota + tela
          ├─> US2  (T042-T046)  P2
          ├─> US3  (T047-T048)  P3
          └─> US4  (T049-T050)  P3
                 └─> Polish (T051-T055)
```

- **Por que a Foundational é grande**: `hub_pagina.schema_estado` e `conteudo_estado` são
  `NOT NULL`, e `linksDe()` é o que alimenta a travessia. Uma US1 sem `extrair()` completo teria
  que inventar valor de preenchimento — o "campo ausente virando zero" que o data-model proíbe.
- **US1 não depende de US2/US3/US4** e as três últimas são independentes entre si: depois da
  Foundational, cada uma é uma agregação pura + um pedaço de tela.
- Dentro da Foundational, a ordem é rígida em dois pontos: `contarPalavras` (T006) antes de
  `estadoDoConteudo` (T018), e todas antes de `extrair` (T020).
- Dentro da US1, `canonizar` (T022) vem antes de tudo — uma chave de página errada faz o sitemap
  inteiro parecer órfão. E `dedupPorUrl` (T031) vem **antes** de `gravarCrawlDePagina` (T037).

## Paralelismo

**Setup**: T001 ‖ T002.

**Foundational**: T004 ‖ T005 (depois de T003). No módulo puro, T008 ‖ T009 ‖ T012 ‖ T014 ‖ T016
são funções independentes — mesmo arquivo, então coordenar o merge. T006 → T007 e T018 → T019 são
série.

**US1**: T022 ‖ T023. Depois T025 → T026, T027 → T028 → T029 → T030 → T031 em série, porque
`densidades` depende de `navegacao` e `agregar` depende das duas.

**Entre stories, depois do Foundational**: US2 (T042) ‖ US3 (T047) ‖ US4 (T049) — três agregações
puras, zero estado compartilhado.

**Polish**: T052 ‖ T051.

## Estratégia de entrega

1. **MVP = Phase 1 + 2 + US1** (T001-T041). É o que responde a pergunta que a 022 deixou aberta:
   *quais* das 27 páginas fora do índice são órfãs ou periféricas. Sozinha, já vale o deploy — e
   a Foundational já grava as seis medidas na tabela, mesmo que só duas apareçam na tela.
2. **+US2** (T042-T046) fecha a hipótese do título que a 021 abriu — a segunda coisa com evidência
   contra si.
3. **+US3 e +US4** (T047-T050) completam o placar do board. São P3 na spec por um motivo: saem
   baratas do mesmo HTML, mas nenhuma das duas move a indexação.
4. **Polish** (T051-T055) liga o cron e faz a verificação que decide se os números valem algo.

---

## Critérios de aceite, por Success Criteria da spec

| SC | Onde é provado |
|---|---|
| **SC-001** — 6 medidas de ausentes para exibidas, placar 16 → 22 de 28 | T055 |
| **SC-002** — toda URL do sitemap com profundidade conhecida ou marcada órfã | T030, T034, T053 |
| **SC-003** — densidade não muda quando o menu muda de tamanho | **T026** (invariância) |
| **SC-004** — nenhuma largura apresentada como medição exata | **T011** + T046 |
| **SC-005** — teste reprova contagem sobre HTML minificado de uma linha | **T007** |
| **SC-006** — nomear as periféricas em menos de 30 s | T038 (ordenação), T040, T054 |

## Rastro dos consertos do `speckit-analyze` (08/09/2026)

| Achado | Conserto |
|---|---|
| **F1** — `linksDe`/`contarPalavras` eram pré-requisito duro da US1 e estavam na Phase 7 | T006-T008 movidos para a Foundational |
| **F2** — T020 gravava colunas `NOT NULL` produzidas só nas Phases 5 e 7 | `lib/pagina.mjs` inteiro (T006-T021) é Foundational |
| **F3** — redirecionamento e recolheita colidiam na PK e derrubavam o INSERT em lote | **T031** `dedupPorUrl()` + dois casos de teste |
| **F4** — 4 taxas e `posicaoDoTermo` nasciam em `.tsx`, contra o Princípio III | **T042** (`lib/pagina.mjs`), **T045**, **T047**, **T049** (`lib/grafo.mjs`); a tela só renderiza |
| **F6** — `urlDoSitemap()` citado sem arquivo | T034 nomeia `lib/conformidade.mjs` |

**F5** (a FR-006 diz "registrar" e a D10 apura na leitura) fica **aceita como está** — a decisão da
D10 é a certa (gravar congelaria na semana da corrida um termo que muda toda semana) e o texto da
FR é que envelheceu. Registrado aqui em vez de emendar a spec aprovada.

## Validação de formato

Todas as 55 tarefas seguem `- [ ] **Tnnn** [P?] [Story?] descrição com caminho de arquivo`:
checkbox, ID sequencial em ordem de execução, `[P]` só onde arquivo é diferente e não há
dependência, `[Story]` apenas nas fases 3-6 (Setup, Foundational e Polish não levam rótulo), e
caminho literal relativo à raiz do repo em toda tarefa que toca arquivo.
