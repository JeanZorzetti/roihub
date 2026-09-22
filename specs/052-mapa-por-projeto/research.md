# Research: O mapa de GSC por projeto

Medido em 21/09/2026 contra o código, o banco do hub (`hub_gsc_dia`, `hub_indexacao`, `hub_pagina_corrida`) e o
sitemap do Sirius. Nenhum `NEEDS CLARIFICATION` ficou aberto.

## D1 — A rota: segmento dinâmico `[slug]`, o endereço antigo redireciona

- **Decisão**: `app/gsc/mapa/page.tsx` muda para `app/gsc/mapa/[slug]/page.tsx` com `git mv`, e o conteúdo
  não é copiado. No lugar dele fica um `page.tsx` de uma linha, `redirect("/gsc/mapa/atma")` (307). A
  página nova segue o padrão de `/okr/[slug]/aquisicao`: `params: Promise<{slug}>`, `await params`,
  `notFound()` e `generateMetadata`. `mapa.tsx` fica onde está e é importado como `../mapa`.
- **Por quê**: FR-001 pede uma implementação só, e FR-002 pede que o endereço antigo continue levando à
  Atma. O navegador leva o `#fragmento` do link antigo através do 307.
- **Alternativas rejeitadas**: `permanentRedirect` (308). O navegador guarda o 308 para sempre, e `/gsc/mapa`
  não poderia virar um seletor de projetos depois. `redirects()` no `next.config.mjs`: seria mais um lugar
  para a regra morar, longe da rota. Servir a Atma nos dois endereços: seriam duas URLs com o mesmo
  conteúdo e duas entradas no histórico de quem compara.

## D2 — Quem tem mapa: a mesma lista das corridas

- **Decisão**: `projetosDeBusca()` passa a devolver só projeto com card curado e `url`, na ordem de
  `SLUGS_DE_BUSCA`. A regra mora numa função pura, `deBusca(projetos, slugs)` em `lib/projects.mjs`, testada em
  `test/projects.test.mjs`. O projeto do mapa é `(await projetosDeBusca()).find((p) => p.slug === slug)`, e sem
  ele a resposta é `notFound()`. O seletor do cabeçalho (FR-011) lista a mesma `projetosDeBusca()`, sem filtro
  próprio.
- **Por quê**: FR-003 e a entidade "Escopo" dizem que a lista das corridas e a lista dos mapas são a mesma.
  Filtrar por `url` não cobre o card que sumiu. `listProjects()` mescla os repos do GitHub (Princípio I), e o
  repo `sirius` tem `homepage` (`sirius-ebon.vercel.app`, conforme `test/projects.test.mjs:37`). Sem o card, o
  slug continuaria com `url`, e o mapa mediria o host da Vercel. O `curated` fecha esse caso: repo sem card
  nunca é `curated`. A guarda fica na função que todos chamam, não na página: posta só na página, a corrida
  seguiria medindo a Vercel com o mapa em 404, e as duas listas divergiriam.
- **A ordem**: `mergeProjects` preserva a ordem do `projects.json`, e lá o Sirius é o card 2 e a Atma o card
  20. Sem ordenar por `SLUGS_DE_BUSCA`, o seletor sairia "Sirius CRM, Atma Aligner".
- **Efeito nas corridas**: nenhum hoje. Os dois slugs do escopo têm card curado e `url`, e a ordem de
  percurso passa a ser a de `SLUGS_DE_BUSCA`.
- **Efeito que isso tem**: depois do `notFound()` o projeto nunca é `undefined`. Os ramos
  `atma ? … : "projeto atma não encontrado no hub"` (linhas 898, 1558 e 1886 de hoje) viram código morto e
  saem do arquivo.

## D3 — "Depois do clique": a ligação sai do perfil, não é declarada

- **Decisão**: uma função pura `cadeiaLigada(perfil)` em `lib/okr.mjs`. Ela toma os `marcos` de
  `PERFIS[perfil]`, tira o `visitante` inicial pela mesma regra de `lib/ficha-dados.ts:106`, e devolve
  `{ ligada, semColetor }`. A cadeia está ligada quando todo degrau tem `coletor`. O mapa só chama
  `dadosDaFicha(slug)` quando a cadeia está ligada. Quando não está, o painel diz, com os nomes que
  saem de `semColetor`: "sem cadeia de R$ ligada ao hub: signup, ativado e trial pago não têm coletor".
  Nenhuma taxa é calculada nesse caso (FR-010).
- **Medido**: no perfil D (Atma) os 4 degraus têm coletor (`leads`, `respondeu`, `orcamentos`, `vendas`), então
  a Atma segue pelo caminho de hoje, sem mudança (US2). No perfil A (Sirius), `signup`, `ativado` e `trial`
  têm `coletor: null`.
- **Alternativas rejeitadas**: um campo novo no card ("cadeia ligada: não"). É uma segunda declaração do
  mesmo fato que o perfil já declara, e no dia em que alguém ligar trial → assinatura o card continuaria
  dizendo o contrário. Chamar `dadosDaFicha("sirius")` e mostrar o que viesse: a cadeia viria com
  `? → ? → ? → n`, e um degrau final com valor ao lado de três não apurados é a leitura que a FR-010 proíbe.
  A chamada também custa ~3,3 s a frio.

## D4 — O nome na frase: `nomeCurto` e artigo neutro

- **Decisão**: `nomeCurto = p.nome.split(" — ")[0]`, a convenção de `/okr/[slug]/aquisicao` e `/metodo`. O
  resultado é "Atma Aligner" e "Sirius CRM". O cabeçalho diz "O que esta tela mede é o projeto {nomeCurto}
  — {hosts}". As notas dizem "este projeto".
- **Por quê**: o português pede artigo por gênero ("a Atma", "o Sirius"), e o card não declara gênero.
  "o projeto X" é correto para os dois. O cenário 1 da US1 foi alinhado a esta frase em 21/09.
- **Alternativa rejeitada**: um campo `artigo` no card, que seria um dado novo só para uma frase.

## D5 — As frases que nomeiam a Atma: medida ou evidência

Levantamento de toda string renderizada em `app/gsc/mapa/page.tsx` que contém "atma" (as linhas são as de
21/09). A árvore estática de `mapaDoBoard()` tem **zero** ocorrências (medido: 0 em `topic`, `note` e
`tags`). Tudo o que nomeia a Atma é escrito pela página.

| Linha | Frase | Classe | No mapa do Sirius |
|---|---|---|---|
| 256 | "O card da Atma não declara `marca`" | projeto medido | "O card deste projeto não declara `marca`" |
| 268 | "da série que o hub grava da Atma" | projeto medido | "da série que o hub grava deste projeto" |
| 369, 370, 493, 593, 690 | "/okr/atma/aquisicao" | link do projeto | `/okr/{slug}/aquisicao` |
| 1896, 1902, 1994, 2008 | "/okr/atma" | link do projeto | `/okr/{slug}` |
| 1903, 2009 | "O perfil da Atma não declara degraus" | projeto medido | "O perfil deste projeto não declara degraus" |
| 2108 | "O que esta tela mede é a Atma" | cabeçalho | D4 |
| 2112 | "é o board dela, não do portfólio" | projeto medido | "é de SEO: a mesma definição vale para cada projeto com mapa", sem contagem (D12) |
| 898, 1558, 1886 | "projeto atma não encontrado" | código morto (D2) | sai |
| 379 | "42,1% das impressões da Atma" | **evidência** | fica |
| 382 | "`conferir-soma-hosts.mjs atma …` imprimia 12,50% … em 20/09/2026" | **evidência** | fica |

As duas evidências vão para `EVIDENCIAS` em `lib/mapa-projeto.mjs`. Qualquer outra frase com "atma" no HTML
do Sirius reprova a testemunha da SC-005 (D12). A busca não diferencia maiúsculas: a linha 382 traz o slug
em minúscula.

## D6 — O hiato da série (FR-012) não pede código

- **Decisão**: nenhuma mudança em `/api/gsc-serie`. `janelaDaCorrida("2026-09-05")` devolve
  `{ inicio: "2026-09-05", fim: hoje }`, e a primeira corrida com o Sirius no escopo pede o hiato inteiro.
- **Medido**: `hub_gsc_dia` tem 0 lacunas nas duas séries (Atma, 252 dias de 11/01 a 19/09, span 252;
  Sirius, 141 dias de 18/04 a 05/09, span 141). Os dias sem impressão já vêm gravados como linha: 2 na Atma e
  1 no Sirius. É o comportamento que a memória de 19/09 registrou: a API devolve o dia sem impressão com
  `position: 0`. A FR-012 ("gravado como zero, nunca omitido") já vale hoje, e o quickstart confere.
- **Alternativa rejeitada**: aplicar `adensarDias` ao total. Mudaria a escrita da Atma para resolver um caso
  que a medição não mostrou.

## D7 — Correção de premissa: a separação de marca chega à série antiga

- **O que a spec supunha** (corrigido nela em 21/09): "Os 141 dias do Sirius sem separação de marca não são
  reescritos. A separação vale da primeira corrida com a marca declarada em diante". A SC-004 abria exceção
  para as folhas que precisam de dois meses fechados.
- **O que o código faz**: as três pernas de marca rodam **toda corrida** na janela de `DIAS_BACKFILL = 480`
  dias (`app/api/gsc-serie/route.ts:147`), e `gravarMarcaGsc` faz `UPDATE` das sete colunas nas linhas que
  já existem. A guarda de host deixa passar, porque as 141 linhas do Sirius têm `host = 'siriuscrm.com.br'`,
  que é o host declarado. **Na primeira corrida com a marca declarada, os 141 dias ganham a separação.**
- **Consequência**: julho e agosto de 2026 fecham com a separação no primeiro dia, e o crescimento
  não-marca do Sirius sai medido já no primeiro dia depois da corrida. A SC-004 não precisa de exceção. O
  estado "a série gravada ainda não traz a separação de marca" continua no código, para o intervalo entre
  declarar a marca e a corrida seguinte. O total (`impressoes`/`cliques`) não é reescrito, o que continua
  de acordo com a spec.
- **Corte por país**: as pernas de marca já filtram pelo `pais` da declaração, que na Atma é `bra` desde
  08/09, e `marcaDeclarada()` recusa marca sem país. Com `pais: "bra"` o não-marca do Sirius lê só o
  Brasil, e o resto do mapa lê todos os países. O inventário também lê todos: `derivar-inventario.mjs` pede
  `consultarGsc(host, ["query"])`, sem filtro de país. No Sirius, com 64% das impressões vindas dos EUA,
  penetração e crescimento não-marca passam a ter denominadores bem diferentes. A regra é a mesma para os
  dois projetos, e a spec diz isso na FR-007 e nas Assumptions.

## D8 — O tempo das três corridas cabe, e nenhuma `maxDuration` muda

| Corrida | `maxDuration` | O que o Sirius acrescenta | Leitura |
|---|---|---|---|
| `/api/gsc-serie` | 300 s | 1 host × (1 total + 3 pernas de marca) = 4 requisições | ordem de segundos |
| `/api/indexacao` | 800 s | 114 URLs no sitemap (medido em 21/09) | 25 + 114 = 139 inspeções, abaixo do teto de 400 por corrida. `sc-domain:siriuscrm.com.br` é outra propriedade e não divide a quota com a Atma. A ~300 ms por inspeção são ~35 s |
| `/api/paginas` | 800 s | ≤ 300 páginas por projeto (`PAGINAS_POR_CORRIDA`), 114 declaradas | lotes de 4 contra um host só, ~1–2 min |

- O `sem_orcamento` da única corrida de indexação do Sirius (07/09, 114 declaradas e 0 inspecionadas) é do
  rodízio de 35 projetos, que não existe mais. Com dois projetos, `repartir()` dá cota cheia aos dois.
- Como nenhuma `maxDuration` muda, o proxy do EasyPanel também não muda (Princípio IV). O cron do Actions
  (`--max-time` 360/780) não muda.

> **⚠️ CORRIGIDO em 21/09/2026: a linha da indexação estava errada.** Os ~300 ms por inspeção eram
> suposição herdada da 022, nunca medição. O medido é **~6,4 s por inspeção**: a Atma levou 2min40s para 25
> URLs em 20/09, e na primeira corrida com os dois projetos (disparo manual das 22:11Z) o Sirius foi gravado
> depois de 12min12s e a Atma aos **892 s**. Isso passou do `maxDuration` de 800 s, e o `curl` do Actions
> desistiu em 780 s (`exit 28`, workflow vermelho). Os dados foram gravados assim mesmo, mas a Atma ficou por
> último, e um restart no meio da corrida faria ela perder o dia. O conserto é inspecionar em lotes de
> `INSPECOES_SIMULTANEAS = 4` (`lib/indexacao.mjs`, teste em `test/indexacao.test.mjs`): 139 URLs viram ~35
> lotes, uns 4 min. Nenhuma `maxDuration` muda. O teto de 400 por corrida daria ~11 min, perto dos 800 s, e
> subir o teto exige subir `maxDuration`, proxy e `--max-time` juntos.
>
> **Conferido em 22/09/2026:** a corrida agendada com os lotes de 4 fez 139 inspeções em **4m47s**, verde,
> com 0 falha de quota (Atma 25/25 às 13:41:09Z, Sirius 114/114 às 13:44:36Z). No mesmo dia a latência em
> série, medida à parte, era 7,2 s por URL, ou uns 17 min para as 139.

## D9 — Campo (CrUX): `SLUGS_DE_CAMPO` ganha o Sirius

- **Decisão**: `SLUGS_DE_CAMPO = ["atma", "sirius"]` e a asserção de `test/crux.test.mjs:49` acompanha. A lista
  fica separada de `SLUGS_DE_BUSCA`: a CrUX é outra fonte com outra quota, e a spec trata as duas por FRs
  separados (FR-005 e FR-006).
- **Efeito colateral desejado**: `lib/ficha-dados.ts:93` passa a ler o campo de `/okr/sirius` também.
- **Esperado**: a origem do Sirius deve ficar abaixo do limiar de tráfego da CrUX. O caminho "sem dado na
  CrUX" já existe, e a fila recebe o vital como `semAmostra`, não como reprovado.

## D10 — Marca e inventário: o código não espera o aceite, o dado espera

- **Decisão**: o código (rota, escopo, campo e textos) vai ao ar sem depender do aceite. Enquanto o dono
  não aprova, o Sirius mostra os estados que já existem: "marca não declarada" e "inventário de termos
  não declarado para este projeto".
- **Sequência depois do aceite**: (1) a marca entra no card `sirius` de `data/projects.json` (`termos:
  ["sirius", "siriuscrm"]`, `pais: "bra"`, `declaradaEm` = data do aceite); (2) roda-se
  `node --env-file=.env scripts/derivar-inventario.mjs sirius --piso 20 --meses 8` **sem** `--gravar` e o
  dono vê a lista; (3) com o aceite, a mesma linha com `--gravar`. A ordem importa porque o script recusa
  derivar sem marca ("sem isso o inventário mede a própria marca").
- **O que é melhor ir junto**: a marca, no mesmo push do escopo. Assim a primeira corrida já reclassifica a
  série (D7). Se o aceite atrasar, a corrida seguinte ao aceite faz o mesmo, sem perda de histórico.

## D11 — TAM do Sirius (FR-009)

- **Decisão**: no ramo `!est` o texto de hoje, "sem estimativa de demanda gravada", passa a ser "sem demanda
  estimada declarada para este projeto". `DEMANDAS[slug]` substitui o `DEMANDAS.atma` fixo. A Atma tem
  estimativa e nunca passa por esse ramo, então o texto dela não muda.
- **Ordem dos motivos**: enquanto o inventário do Sirius não for congelado, o motivo exibido é o primeiro
  da cadeia de hoje, "inventário de termos não declarado para este projeto". Depois do congelamento vira o
  da FR-009. As duas frases são verdadeiras, e cada uma pede um trabalho diferente.

## D12 — As testemunhas das SC-002 e SC-005

- **Decisão**: `lib/mapa-projeto.mjs` (puro) com `EVIDENCIAS`, `textoDoMain(html)`, `frasesAlheias(texto,
  alheio, permitidas)` e `numerosDoMapa(texto)`. `scripts/conferir-mapa.mjs` lê o HTML que o `curl` do
  quickstart baixou e passa por essas funções. O teste `test/mapa-projeto.test.mjs` fica registrado em
  `package.json` (Princípio II).
- **Só o texto visível de `<main>`**: `textoDoMain` tira os blocos `<script>` e `<style>` inteiros antes das
  tags. O HTML do App Router leva o payload RSC dentro de `<script>`: ele repete o texto da página e traz ids
  e caminhos de chunk que mudam de um build para outro. Comparado junto, reprovaria a SC-002 numa
  implementação correta. As notas das folhas não se perdem, porque `#board-lista` as renderiza no servidor.
  O `<title>` também fica fora, e com ele a troca de título da rota nova.
- **Frases e números**: `frasesAlheias` corta em `.`, `!` ou `?` seguidos de espaço, para não partir `1.234`
  nem `.mjs`. `numerosDoMapa` devolve os números em ordem e ignora o carimbo "Apurado ao abrir a página,
  em …".
- **Nenhum número novo na tela da Atma**: a comparação é por posição, e um número a mais desalinha todos os
  seguintes. Por isso a frase do board no cabeçalho não conta os projetos com mapa (D5).
- **SC-002 sem janela móvel**: a janela do mapa fecha em D-3 e muda à meia-noite. Por isso a comparação
  roda **localmente e ao mesmo tempo**: o commit anterior num worktree na porta 3001 e o novo na 3002, com o
  mesmo `.env`. A comparação é de antes contra depois no mesmo minuto, não de produção ontem contra
  produção hoje.
- **Alternativa rejeitada**: conferir a SC-005 com um `grep` manual. A spec pede comparação "contra a lista
  das frases de evidência permitidas", e uma lista que só existe em prosa não reprova nada.
