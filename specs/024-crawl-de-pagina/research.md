# Research: O que há dentro das páginas da Atma

**Feature**: `024-crawl-de-pagina` | **Date**: 2026-09-08

Nenhum `NEEDS CLARIFICATION` sobreviveu à spec — o checklist de requisitos já estava aprovado com
os quatro pontos de validação. As decisões abaixo são as que a Technical Context do
[plan.md](./plan.md) referencia.

Três delas (D1, D4, D5) existem porque a spec marcou as armadilhas com 🚩: são os pontos onde o
código erra produzindo um número que **parece certo**.

---

## D1 — Navegação é o link que aparece em quase toda página

**Decisão**: monta-se a lista completa de arestas primeiro. Depois, o par
`(href canônico, âncora normalizada)` emitido por **≥ 50% das páginas visitadas e por ≥ 3 delas**
é classificado como navegação e **não** entra na densidade de links contextuais (FR-004). Os
limiares são constantes exportadas de `lib/grafo.mjs`, cobertas por teste.

**Rationale**: todo site serve menu e rodapé em todas as páginas. Contá-los faz a densidade de
cada página tender ao número de páginas do site, e a medida vira uma constante que não distingue
nada — que é a spec dizendo, literalmente, "a diferença entre a medida existir e não existir".

A chave é o **par**, não só o `href`: um link de menu tem sempre a mesma âncora; 12 posts que
apontam para `/pacientes/precos` com âncoras diferentes não são navegação, são exatamente o que o
board chama de "contextuais, com âncoras exatas". Um bloco de "posts relacionados" gerado pelo
template cai como navegação — e isso está **certo**: é navegação.

Este é o desenho que satisfaz a **SC-003 por construção**. Menu que ganha 10 itens: os 10 aparecem
em 100% das páginas, os 10 são navegação, e nenhuma contagem contextual se move.

**Alternativas rejeitadas**:
- *Ignorar o que estiver dentro de `<nav>`, `<header>` e `<footer>`*: depende de o site marcar
  semântica. Um menu em `<div class="menu">` passaria inteiro, e aí a medida some sem avisar. Pior:
  o defeito seria **silencioso e específico do site**, que é o modo de falha que esta base já
  pagou em `geo01_grep_measures_word_not_permission`.
- *Lista manual de URLs de menu por projeto*: dado escrito à mão que apodrece no primeiro deploy
  do cliente, e que ninguém revisita.
- *Limiar de 100% (só o que está em toda página)*: uma única página que não renderiza o rodapé
  (um 404 estilizado, uma landing sem chrome) devolveria o menu inteiro para dentro da conta.

---

## D2 — Profundidade usa TODAS as arestas; densidade usa só as contextuais

**Decisão**: a travessia em largura que calcula a profundidade de clique percorre **todos** os
links internos, inclusive os de navegação. A contagem de links recebidos (densidade) usa apenas os
contextuais da D1.

**Rationale**: são duas perguntas diferentes sobre o mesmo grafo. "A quantos cliques da home?" é
uma pergunta sobre **alcance**, e clicar no menu é um clique de verdade — excluir a navegação daí
inventaria profundidade 4 para uma página que está no menu principal. "Quantos links apontam para
cá?" é uma pergunta sobre **voto editorial**, e o menu não vota: ele aponta para tudo igualmente.

É por isso que a spec diz "duas leituras do mesmo grafo, não dois crawls".

**Consequência que a tela precisa dizer**: uma página pode ter profundidade 1 (está no menu) e
densidade 0 (ninguém a citou no texto). Longe de ser contradição, é o achado mais acionável
desta feature.

**Alternativas rejeitadas**:
- *Excluir navegação também da profundidade*: transformaria todo site com menu em site raso de
  fachada e profundo na medida, que é o oposto do que o board mede.
- *Contar navegação na densidade com peso menor*: peso arbitrário sem fonte. O board fala em
  contagem de 5 a 10, não em soma ponderada.

---

## D3 — A chave de página é a URL canônica

**Decisão**: `canonizar(url)` devolve `protocolo + host minúsculo + pathname + query`, sem
fragmento e sem barra final (exceto na raiz, que é `/`). Links relativos são resolvidos contra a
URL da página que os emitiu, com `new URL(href, base)`. `mailto:`, `tel:`, `javascript:` e
âncora pura (`#secao`) não são arestas.

**Rationale**: o sitemap declara `https://atmaaligner.com.br/pacientes/precos` e o HTML linka
`href="/pacientes/precos/"`. Sem canonização essas são duas páginas: a do sitemap fica **órfã** e
a linkada fica fora do inventário — e a feature inteira publicaria um site que aponta para lugar
nenhum. É a lição de `rotulo_de_exibicao_nunca_e_chave` aplicada à URL.

A **query é preservada** de propósito: `?p=2` costuma ser outra página de verdade. O fragmento é
descartado porque `#preco` é a mesma página.

**Alternativa rejeitada**: *usar `<link rel="canonical">` da própria página como chave*. Tentador,
mas circular — uma canonical errada (que é justamente o tipo de defeito que se quer achar) fundiria
páginas distintas e esconderia o erro que a medida existe para expor.

---

## D4 — 🚩 Pixel não é caractere: largura estimada por tabela, declarada como estimativa

**Decisão**: `larguraDoTitulo(titulo)` soma larguras por caractere de uma tabela de métricas de
**Arial**, em `em`, multiplicada por **20 px** — a fonte e o tamanho do título na SERP desktop.
Caractere fora da tabela usa a largura média (`0.55em`); acentuado usa a largura da letra base. A
função devolve `{ px, metodo: "arial-20px-tabela" }`, e o `metodo` **viaja junto com o número até
a tela** (FR-005 / SC-004).

**Rationale**: o board pede 500-580 px, e `titulo.length` não é largura — "iiiii" e "WWWWW" têm o
mesmo comprimento. Estimar resolve a decisão que o board quer tomar, que é binária ("cabe ou não
cabe na SERP"), e a faixa tem 80 px de folga para absorver o erro da estimativa.

O que a spec proíbe não é estimar — é **chamar a estimativa de medição**. Por isso o método é
campo, não comentário: um número de pixels sem o rótulo do método é indistinguível de uma medição,
e vai ser lido como uma.

**Alternativas rejeitadas**:
- *Renderizar num navegador headless para medir de verdade*: `playwright-core` já é
  `devDependency` do repo, mas o binário do browser **não está na imagem Alpine** de produção, e
  colocá-lo lá é ordem de grandeza de custo (imagem, memória, tempo de corrida) para trocar uma
  estimativa boa por uma medição de uma fonte que o Google pode nem estar usando naquele device.
- *Contar caracteres com um limite equivalente (~60)*: é exatamente o defeito que a spec marcou
  com 🚩.
- *Tabela de larguras completa gerada a partir do arquivo da fonte*: precisão que a decisão não
  usa, e um artefato binário no repo para sustentar.

---

## D5 — 🚩 `<script>` some por regex NÃO-GULOSA, provada contra HTML minificado

**Decisão**: `semScriptNemStyle(html)` remove com `/<script\b[^>]*>[\s\S]*?<\/script>/gi` e o par
equivalente para `<style>` — **não-guloso** (`*?`). O teste obrigatório roda contra HTML
**minificado de uma linha** com dois blocos `<script>` e um `<h1>` entre eles, e exige que as
palavras do `<h1>` sobrevivam (FR-010 / SC-005).

**Rationale**: é o defeito medido, não hipótese. `D-84` (handoff de 07/08) usou
`sed 's/<script[^>]*>.*<\/script>//g'` e devolveu **0 palavras para `orcaobra` e `vertice`, que
têm `<h1>`** — HTML minificado é uma linha só, e o `.*` guloso apaga do primeiro `<script>` até o
**último** fechamento do documento, ou seja, o body inteiro. Refeito não-guloso: 472 e 301
palavras. O que denunciou foi a **contradição interna** (0 palavras numa página com `<h1>`), e essa
contradição vira asserção de teste aqui.

Décima ocorrência de `first_run_measures_the_check` nesta base — a primeira corrida mede o check,
não o mundo.

**Alternativa rejeitada**: *contar palavras sem remover script*: o JSON de configuração de um app
Next moderno tem milhares de "palavras". A página apareceria rica em conteúdo justamente quando
não serve nenhum.

---

## D6 — Sem parser de HTML novo

**Decisão**: extração por expressões regulares ancoradas e não-gulosas em `lib/pagina.mjs`. Nenhuma
dependência nova.

**Rationale**: a Restrição Técnica da constituição é explícita sobre dependência, e o repo inteiro
já lê HTML assim (`conformidade.mjs`, `sitemap.mjs`, `gateways-servido.mjs`). São 36 páginas de um
site que a casa controla, não a web aberta.

**O custo é reconhecido**: regex sobre HTML é frágil. A mitigação é o Princípio III — cada campo é
uma função pura com teste próprio, e cada uma tem **estado de ausência distinto** (`titulo: null`
não é `titulo: ""`), então uma quebra aparece como "não apurado" em vez de virar zero.

**Alternativas rejeitadas**: *`cheerio` / `node-html-parser`*: dependência nova, e nenhuma delas
resolve a única coisa que realmente decide os números aqui, que é a D1 (o que conta como link
contextual).

---

## D7 — Travessia em duas fases: largura a partir da home, depois colheita das órfãs

**Decisão**:

1. **Fase largura** — fila iniciada na home canonizada. A cada página buscada, extraem-se as
   arestas internas; destinos inéditos entram na fila com `profundidade + 1`. `visitados` é um
   `Set`, o que encerra ciclo por construção (FR-012). Para no teto `PAGINAS_POR_CORRIDA`.
2. **Fase colheita** — as URLs do sitemap que a fase 1 não alcançou são buscadas do mesmo jeito
   (FR-001 exige o HTML de **cada** URL declarada) e recebem `profundidade: null` +
   `orfa: true` (FR-003).

Páginas descobertas por link e **não declaradas** no sitemap continuam no grafo — elas transportam
autoridade — e saem contadas na resposta da corrida como `linkadasNaoDeclaradas`, sem virar medida
do board.

**Rationale**: profundidade só existe a partir de um ponto de origem, e órfã só existe como
diferença entre "o que o sitemap declara" e "o que a travessia alcança". As duas fases são
exatamente essa diferença, na ordem em que ela se calcula.

**Órfã tem profundidade `null`, nunca `0` e nunca erro** — é a instrução literal do Independent
Test da US1, e é a distinção que o repo já quebrou uma vez em
`zero_na_janela_nao_e_zero_no_mundo`.

**Alternativas rejeitadas**:
- *Crawlear só o que está no sitemap*: a profundidade ficaria errada, porque uma página do sitemap
  pode ser alcançável apenas por uma página que **não** está no sitemap.
- *Travessia em profundidade (DFS)*: dá o mesmo conjunto, mas a primeira distância encontrada não é
  a mínima. Profundidade de clique é a **menor** distância; largura entrega isso por construção.

---

## D8 — O detalhe por URL É persistido (ao contrário da 022)

**Decisão**: duas tabelas — `hub_pagina_corrida` (o agregado do dia) e `hub_pagina` (uma linha por
URL por corrida).

**Rationale**: a 022 decidiu, com razão, **não** persistir por URL: 35 projetos × milhares de URLs
× diário responderia perguntas que aquela spec não fazia. Aqui a pergunta central é literalmente
por URL — a **SC-006** exige nomear em 30 segundos *quais* páginas são órfãs ou periféricas. Um
agregado não responde isso.

E o volume é outro: **36 linhas por semana**, num projeto só.

**Alternativa rejeitada**: *guardar as páginas num JSON dentro da linha de agregado*. Economizaria
uma tabela e custaria toda ordenação e todo filtro em SQL — e `jsonb_breaks_code_that_json_parses`
já mostrou o preço de esconder estrutura dentro de uma coluna nesta casa.

**As arestas NÃO são persistidas.** Elas existem durante a corrida e produzem dois números por
página (profundidade e densidade); guardar o grafo inteiro seria dado para uma pergunta que esta
spec não faz. "Quais páginas linkam para esta?" é tabela nova numa spec nova.

---

## D9 — O ano vigente é parâmetro, não relógio dentro do módulo puro

**Decisão**: `modificadoresDeIntencao(titulo, ano)` recebe o ano como argumento. A borda `.ts`
passa `new Date().getFullYear()`.

**Rationale**: a lista do board inclui "o ano vigente" como modificador comercial. `2026` escrito
no código apodrece em 1º de janeiro, e a medida passaria a reprovar todo título que se atualizou
corretamente. Relógio dentro do módulo puro também quebra o teste no dia da virada — `crux.mjs`
(023) já estabeleceu essa regra na casa ("sem `fetch`, sem `process.env`, sem relógio").

**Listas**, direto do board, sem invenção: informacional — `como fazer`, `passo a passo`, `guia`,
`exemplos`; comercial — `preço`/`preco`, `quanto custa`, `comparativo`, `melhores`, `planos`,
`grátis`/`gratis`, o ano vigente. Comparação sem acento e sem caixa; o par com e sem acento é
explícito porque `preço` e `preco` aparecem os dois em títulos reais.

---

## D10 — O termo principal vem do GSC, na LEITURA

**Decisão**: `termoPrincipal(linhas, url)` em `lib/kpis-busca.mjs` devolve a consulta de **maior
impressão** daquela URL na janela que a aba de aquisição já carrega, ou `null`. A posição do termo
no título (FR-006) é calculada na renderização, sobre o título gravado pela corrida.

**Rationale**: o board pede "o termo nos primeiros 35 caracteres", mas nunca diz de onde sai o
termo. As opções eram slug do projeto (não é termo de busca), lista manual (apodrece) ou o próprio
Search Console — que já está carregado na tela, medido, e é o que o usuário de verdade digitou.

Calcular na leitura em vez de gravar tem uma razão de correção, não de economia: o termo muda toda
semana, e gravado na tabela ele congelaria na semana da corrida. É o mesmo desenho da 022, onde a
taxa é derivada em vez de coluna.

**URL sem consulta com impressão sai como "sem termo apurado"**, jamais como "termo ausente do
título". Não perguntei ≠ perguntei e não achei — a regra que atravessa 021, 022 e 023.

---

## D11 — Ausente, inválido e presente são três estados de JSON-LD

**Decisão**: todos os `<script type="application/ld+json">` são extraídos e cada um passa por
`JSON.parse`. Bloco que estoura ⇒ `invalido` (erro crítico, FR-008). Zero blocos ⇒ `ausente`.
Bloco válido ⇒ os `@type` são colhidos descendo em `@graph` e em arrays, recursivamente.

Uma página com um bloco válido e outro quebrado é **inválida**: o board mede "0 erros críticos", e
um erro presente não é apagado por um acerto ao lado.

**Rationale**: é o Independent Test da US3 e o cenário 2 dela. `@graph` com três tipos é lido como
três tipos; JSON malformado conta como erro, não como ausência — são consertos completamente
diferentes (escrever schema × achar a vírgula).

**Alternativa rejeitada**: *validar contra o vocabulário schema.org*. Exige rede ou um dicionário
embarcado, e a medida do board é "válido, 0 erros críticos", não "semanticamente correto".

---

## D12 — Página vazia ≠ conteúdo que depende de JavaScript

**Decisão**: `estadoDoConteudo(html, palavras)` devolve `com-conteudo`, `js-dependente` ou
`sem-conteudo`. Com palavras acima do piso ⇒ `com-conteudo`. Sem palavras **e** com marca de app
que hidrata (`<div id="root">`, `<div id="__next">`, `detectarStack()` de `conformidade.mjs`
acusando `vite-spa`) ⇒ `js-dependente`. Sem palavras e sem marca ⇒ `sem-conteudo`.

**Rationale**: FR-011. `D-84` mediu 3 projetos da casa servindo zero palavra no HTML inicial, e o
handoff é explícito sobre o prognóstico: conteúdo em JS é renderizável pelo Google, então SPA vazia
**atrasa** a indexação, não a impede. Colapsar os dois estados num "sem conteúdo" trocaria "está na
fila de render" por "não tem texto" — diagnósticos com consertos opostos.

`detectarStack()` é reusada em vez de reescrita: ela já detecta Next, Astro e `vite-spa` pelo que o
servidor entrega, que é a mesma pergunta feita de outro ângulo.

---

## D13 — URL do sitemap que erra ou redireciona é achado, não buraco

**Decisão**: `buscar()` de `lib/conformidade.mjs` ganha dois campos **aditivos** no retorno:
`url` (a final, após redirecionamentos) e `redirecionada` (booleano). A corrida grava `status`,
`erro` e `redirecionada` por página; a tela lista as URLs mortas ou redirecionadas do sitemap como
achado (FR-013). Falha de rede numa página **não derruba** as outras e é contada como falha —
nunca como página sem título, sem Schema ou sem links (FR-016).

**Rationale**: mudar `buscar()` é a mudança **menor**, não a maior: os dados já estão no objeto
`Response` do `fetch` (`r.url`, `r.redirected`) e são descartados hoje. A alternativa era uma
segunda requisição com `{ manual: true }` por URL — o dobro de rede para saber o que a primeira
resposta já sabia. Os cinco chamadores atuais desestruturam campos nomeados (`corpo`, `status`,
`headers`, `erro`), então acrescentar dois não muda nada para eles.

O destino do redirecionamento é o que conta (a spec diz isso), e o **fato de o sitemap declarar uma
URL que redireciona** é o achado.

---

## D14 — Cadência semanal, num horário que não colide com nada

**Decisão**: `.github/workflows/paginas.yml`, cron `17 9 * * 1` — **segunda-feira, 06:17 BRT**.
Mesmo desenho de gatilho da 022: o Actions só dispara, o trabalho é server-side, e o retry cobre
**apenas** falha de conexão (`7`, `35`, `52`), nunca timeout.

**Rationale**: a spec já fixou semanal — estrutura interna e título mudam por deploy, não por hora.
O horário respeita o Princípio IV (fora de 23:30-01:00 e de 08:00-08:45 BRT) e fica 30 min depois
da corrida de indexação das 05:47, para as duas não dividirem o container.

Timeout fora do retry pela mesma lição da 022: esta corrida pode legitimamente passar do
`--max-time`, e ali o timeout significa "está rodando", não "não começou". Repetir buscaria as 36
páginas de novo enquanto a primeira corrida ainda escreve — e duas corridas escrevendo o mesmo
`(projeto, dia)` é a receita para um número que ninguém consegue explicar.
