# Phase 0 — Pesquisa: a leitura por página soma os hosts declarados

**Feature**: `030-consultas-somam-hosts` | **Data**: 2026-09-19

Nenhum `NEEDS CLARIFICATION` sobreviveu ao Technical Context: a stack é a do repo, a fonte de
verdade dos hosts já existe (029) e as três leituras estão nomeadas na spec. O que esta fase
resolve são as decisões de ONDE o conserto mora, porque é exatamente aí que a spec põe o dedo —
`guarda_no_chamador_volta_pela_porta_seguinte`, sexta ocorrência no repo.

## O que foi medido antes de decidir

Leitura do código em 19/09/2026, das três chamadas que a spec nomeia até a borda:

| Leitura | Chamada | Borda | Dimensões | Janela |
|---|---|---|---|---|
| Consultas | `app/okr/[slug]/aquisicao/page.tsx:541` | `gscConsultas(p.url, curtaGsc)` | `query`,`page` | `descoberta()` (28d, D-31→D-3) |
| Páginas | `lib/okr-coleta.ts:186` | `gscPaginas(p.url, janela)` | `page` | `descoberta()` |
| Autopublishing | `lib/autopublish.ts:221` | `gscQueryPages(project.siteUrl, {strict:true})` | `query`,`page` | duas, fixas em D-31→D-3 e D-59→D-32 |

As três terminam no mesmo par de linhas em `lib/gsc.ts`: um `resolveProperty(host, sites)` sobre
`new URL(siteUrl).hostname`, e um `dimensionFilterGroups` com
`page contains "https://${host}/"`. **É uma decisão repetida três vezes, não três defeitos** — e é
por isso que a FR-007 existe.

`queryPageWindow` (exportada, usada por `gscQueryPages` e `gscConsultas`) e o corpo inline de
`gscPaginas` são a mesma requisição com `dimensions` diferentes. Unificá-las é pré-requisito do
conserto, não refator oportunista.

## D1 — Onde a lista de hosts é resolvida

**Decisão**: `hostsDeclarados()` de `lib/projects.mjs` continua sendo o ÚNICO resolvedor, e as três
leituras passam a receber `string[]` em vez de `siteUrl: string`. A ordem importa: `hosts[0]` é o
host de `url` (o atual) e é ele que assina a URL canônica da FR-003 — `hostsDeclarados` já devolve
nessa ordem.

**Racional**: é a mesma função que a corrida da 029 usa (`app/api/gsc-serie/route.ts:89`) e que os
dois blocos de GA4 desta mesma tela usam desde a 026. A FR-001 proíbe uma segunda lista justamente
porque ela divergiria da primeira no primeiro projeto novo; reusar a existente é o que torna a
proibição verificável (um `grep` por `dominioAnterior` fora de `lib/projects.*` deve continuar
vazio).

**Alternativas rejeitadas**:

- *Resolver dentro de `lib/gsc.ts`, a partir do `siteUrl`, procurando o card por host.* Inverte a
  dependência (a borda do Google passaria a conhecer o formato do card) e ainda precisaria de uma
  busca por host, que é a chave errada: a chave de um projeto é o slug.
- *Manter a assinatura `siteUrl` e aceitar `options.hosts` opcional.* O caminho padrão continuaria
  de um host só, e a FR-007 viraria uma promessa que o código não cobra. Parâmetro opcional que
  ninguém é obrigado a passar é exatamente como as outras duas leituras ficaram de fora da 029.

## D2 — O autopublishing, que não lê o card

`lib/autopublish-projects.mjs` é uma lista PRÓPRIA (10 projetos, campo `siteUrl`) e **não tem**
`dominioAnterior`. A Atma não está nela — medido: `grep -c atma lib/autopublish-projects.mjs` = 0.
Ou seja, hoje nenhum projeto do autopublishing declara domínio anterior, e a mudança é
estruturalmente invisível (a FR-006 garante resultado idêntico).

**Decisão**: acrescentar `dominioAnterior` à lista do autopublishing está PROIBIDO pela FR-001. Em
vez disso, um acessor novo em `lib/projects.ts` devolve o que o card declara para um slug, e o
autopublishing monta a entrada de `hostsDeclarados()` com o `siteUrl` dele como host atual:

```ts
hostsDeclarados({ url: project.siteUrl, dominioAnterior: dominioAnteriorDoSlug(project.slug) })
```

`siteUrl` continua sendo o host canônico porque é ele que decide `targetUrl`, `origin` e sitemap no
resto de `lib/autopublish.ts` — trocá-lo pelo `url` do card moveria coisa que esta spec não pediu.

**Racional do acessor ler a curadoria direto**: `dominioAnterior` SÓ existe na curadoria — repo
vindo da API do GitHub nunca tem o campo. É o mesmo argumento, escrito no próprio arquivo, que
autoriza `listFichas()` a ler `curated` sem `listRepos()`. Fica dentro de `lib/projects.ts`, então
o Princípio I é respeitado (a proibição é importar `data/projects.json` FORA de `lib/projects.*`).

**Armadilha registrada**: lista de hosts vazia não pode virar leitura vazia. Em `strict:true` uma
resposta `[]` faz toda pauta virar `new` e o robô duplica URL já ranqueada — é o defeito que o
`strict` existe para impedir. Lista vazia MUST ser erro, nunca zero linhas.

## D3 — Onde a mescla mora

**Decisão**: função pura em módulo novo `lib/gsc-hosts.mjs`, testada por `node --test` sem subir o
Next. A borda (`lib/gsc.ts`) só busca e chama.

**Racional**: o Princípio III é explícito — "se a função pode ser testada sem subir o Next, ela DEVE
nascer em `.mjs`". A mescla é aritmética pura sobre linhas já buscadas, exatamente como
`somarSeriesPorHost` em `lib/serie-gsc.mjs`, que é a função irmã desta (aquela soma por DIA, esta
por CAMINHO).

**Alternativas rejeitadas**:

- *Pôr a função em `lib/serie-gsc.mjs`.* O módulo se declara, na primeira linha, como "a corrida que
  grava a série do GSC (021)". Uma função de página lá dentro seria encontrada por acidente.
- *Pôr em `lib/kpis-busca.mjs`, ao lado de `porUrl`.* Aquele módulo serve os KPIs do board; a ficha
  e o autopublishing não o importam, e importá-lo só para a mescla arrastaria o `BENCHMARK` para
  dentro do robô de pauta.

## D4 — A chave da mescla e a posição

**Decisão**: a chave é `pathname + search` da URL da página, mais a `query` quando essa dimensão
existir. A URL de saída é reconstruída como `https://${hosts[0]}${pathname}${search}`. Posição é
**média ponderada por impressões**; sem impressão, `null`.

**Racional medido (da própria spec)**: a página campeã da Atma existe nos dois hosts — 22.059
impressões na posição 7,3 e 5 impressões na posição 21. Média simples devolveria ~14, uma posição
que nenhum dos dois domínios mediu, e jogaria a página para fora da faixa do balizador (≤ 10,9). É
a mesma conta que `somarSeriesPorHost` já faz por dia e que `porUrl` já faz por URL, pelo mesmo
motivo — três lugares, uma régua.

**O que NÃO é normalizado**: barra final (`/x` e `/x/` são páginas diferentes no Google e no
sitemap) e querystring (`?p=2` é outra página). Normalizar aqui inventaria uma fusão que o Search
Console não fez.

**Consequência boa de graça**: `porUrl` em `lib/kpis-busca.mjs:50` agrupa por `l.page`. Com a URL já
canônica na entrada, ele deixa de produzir as 5 duplicatas da SC-003 **sem ser tocado**.

## D5 — O contrato de falha, e os dois estados que não podem colapsar

**Decisão**: espelhar o que a corrida da 029 já faz, host a host:

| Estado do host | Origem | O que a leitura faz |
|---|---|---|
| sem propriedade no GSC | `resolveProperty` devolve `null` | pula o host, registra em `encerrados`, segue com os vivos |
| falha na requisição | exceção | **aborta a leitura inteira**, devolve `{erro: "<host>: <msg>"}` |
| nenhum host vivo | todos sem propriedade | devolve `null` (ausência estrutural, o de hoje) |
| lista de hosts vazia | card sem URL utilizável | devolve `null` — e em `strict:true`, lança |

**Racional**: os dois estados pedem conserto diferente — um é "criar a propriedade no Search
Console", o outro é "tentar de novo". `lib/gsc.ts` já mantém essa distinção em `gscSeries`,
`gscPaginas` e `gscConsultas`, com o motivo escrito no arquivo (design-review de 03/09: colapsar os
dois fazia "sem propriedade" mentir quando era só timeout). A FR-004 acrescenta o *nome do host* na
mensagem, que é o que falta hoje — `{erro}` sem host, com dois hosts na leitura, não diz onde ir.

Soma parcial é o pior dos três: um total que encolhe sem explicação lê como queda de tráfego. É a
lição de `guarda_salva_o_historico_e_entrega_a_subcontagem` — a guarda da 029 salvou o histórico e
entregou 3% do número; nada aqui pode repetir isso.

## D6 — Truncamento (FR-005)

**Decisão**: `truncado = true` se QUALQUER propriedade devolver `rows.length >= TETO_LINHAS`
(25.000, já constante nomeada em `lib/gsc.ts:139`).

**Racional**: o teto é por requisição, e a requisição é por propriedade. Comparar contra o total
somado (até 50.000 com dois hosts) faria a flag nunca disparar — um `truncado` que não dispara é
pior que não ter a flag, porque a tela publicaria o teto como se fosse o fim dos dados. A
constante já existe nomeada exatamente para permitir essa comparação (comentário da 021 no
arquivo).

## D7 — Custo de rede

Uma requisição por host por janela. Hoje só a Atma declara dois hosts:

| Leitura | Requisições hoje | Depois (Atma) | Depois (os outros 34) |
|---|---:|---:|---:|
| Consultas (aba de aquisição) | 1 | 2 | 1 |
| Páginas (ficha/OKR) | 1 | 2 | 1 |
| Autopublishing | 2 (duas janelas) | 2 | 2 |

As duas primeiras rodam no render da página, em `Promise.all` com outras fontes. A segunda
requisição é sequencial DENTRO da leitura (não em paralelo), pelo mesmo motivo que a corrida da 029
é em série: mesma credencial, mesmo endpoint, e disparar de uma vez é o caminho curto para um 429.
Com dois hosts o custo é uma latência a mais, não um fan-out.

## D8 — Um quarto local com o mesmo defeito, FORA do escopo

Registrado porque calar seria repetir a 029: **`gscSeries(p.url, ...)` em
`app/okr/[slug]/aquisicao/page.tsx:527` e em `lib/okr-coleta.ts:184` também lê um host só.** É a
série AO VIVO (dimensão `date`), não a gravada — a 029 consertou a tabela `hub_gsc_dia`, não estas
duas chamadas. Elas alimentam `cliques`, `impressoes`, `recebidaGsc` e `mesesGsc` da mesma tela.

Esta spec declara, em Assumptions, que a série não é tocada aqui. **Fica fora do escopo por decisão
da spec, e fica escrito para não ser descoberto de novo daqui a um mês** — é o padrão
`migracao_tratada_em_uma_fonte_so`, e consertar N−1 fontes não é conserto parcial, é o mesmo
defeito com menos portas. Vira spec própria.

## D9 — O que fica sem conserto e continua valendo

- **A dimensão `query` omite consultas raras.** Medido na Atma: `query`+`page` devolve 10.359 das
  24.566 impressões (42%) e nenhum dos 8 cliques do domínio novo. Somar hosts não conserta isso — o
  selo `piso, não total` (`consultasUnicas`, `lib/kpis-busca.mjs:76`) continua obrigatório e a
  ressalva da tela continua no lugar.
- **`www.`**: o filtro é `page contains "https://${host}/"` e `hostsDeclarados` tira o `www.`. Um
  site servido em `www.` não casaria. Comportamento PRÉ-EXISTENTE em todas as leituras; esta spec
  não o introduz nem o conserta.
