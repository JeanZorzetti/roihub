# Phase 0 — Pesquisa: a leitura ao vivo da série soma os hosts declarados

**Feature**: `031-serie-ao-vivo-soma-hosts` | **Data**: 2026-09-19

Nenhum `NEEDS CLARIFICATION` sobreviveu ao Technical Context: a soma por dia (029), a lista de hosts
(`hostsDeclarados`) e o contrato de falha por host (030, `lerPorHosts`) **já existem e estão
testados**. Esta feature liga peças, não inventa nenhuma. O que a Fase 0 resolve é ONDE cada ligação
mora e o que o código lido mostrou que a spec não sabia.

## O que foi medido antes de decidir

Leitura do código em 19/09/2026, dos quatro chamadores que a spec nomeia até a borda:

| Leitura | Chamada | Borda | O que consome |
|---|---|---|---|
| Janela longa | `app/okr/[slug]/aquisicao/page.tsx:527` | `gscSeries(p.url, longa.inicio, longa.fim)` | `.days`, `.property`, `.erro` |
| Painel de SEO | `app/seo/page.tsx:40` | `gscSeries(p.url)` | `.days` → `bucketWeeks`, `totals28` |
| Coleta (ficha/OKR) | `lib/okr-coleta.ts:184` | `gscSeries(p.url)` | `.days` → `totals28`, fatia da época (CTR) |
| Tendência | `lib/evaluate.ts:23` | `gscTrend(p.url)` | `{current, previous}` → `seoScoreFromClicks` |

Todas terminam no mesmo par de linhas em `lib/gsc.ts`: `resolveProperty(new URL(siteUrl).hostname)` e
o filtro `page contains "https://${host}/"`. **É uma decisão repetida, não quatro defeitos** — e a
`gscTrend` ainda a repete numa segunda função (`queryClicks`), com o `try/catch` próprio.

Uma quinta chamada existe e **não** é uma das quatro: `app/api/gsc-serie/route.ts:94`, a corrida que
grava. Ela já soma por host, à mão (D3).

## D1 — Onde a lista de hosts é resolvida

**Decisão**: `hostsDeclarados()` (`lib/projects.mjs:146`) continua sendo o ÚNICO resolvedor.
`gscSeries` e `gscTrend` passam a receber `string[]` em vez de `siteUrl: string`.

**Racional**: é a mesma decisão da 030/D1 e pelo mesmo motivo. Parâmetro opcional (`options.hosts`)
deixaria o caminho padrão de um host só, e a FR-007 viraria promessa que o compilador não cobra —
"como as outras duas leituras ficaram de fora da 029". Trocar o tipo do parâmetro faz o `next build`
reprovar qualquer chamada `gscSeries(p.url)` futura: a porta errada deixa de existir em vez de ficar
fechada por convenção.

**Rejeitada**: resolver dentro de `lib/gsc.ts` a partir do `siteUrl`, procurando o card. Inverte a
dependência e ainda pesquisa por host, que é a chave errada (a chave é o slug).

## D2 — O laço de hosts vira UM só, e as leituras se penduram nele

**Decisão**: extrair de `lerPorHosts` (030) o laço genérico `lerHosts<T>(hosts, buscar, client?)`:
resolve o cliente, lista propriedades, e para cada host resolve a propriedade, chama `buscar` e
acumula. Devolve `{respostas, encerrados}`, `{erro: "<host>: …"}` ou `null`. Três leituras usam:

- `lerPorHosts` (páginas, consultas, pauta) — comportamento idêntico, só deixa de ter o laço próprio;
- `gscSeries` (nova assinatura) — `buscar` = `queryTimeseries`, depois `somarSeriesPorHost`;
- `gscTrend` (nova assinatura) — `buscar` = as duas janelas de `queryClicks`, depois soma.

**Racional**: sem isto seriam DUAS cópias novas do contrato de falha (`encerrados`, host que falha
aborta, nada parcial) ao lado da que a 030 acabou de consolidar — a mesma repetição que a 030 veio
remover. O extrato **apaga** código: `lerPorHosts` encolhe e as duas leituras novas cabem em ~15
linhas cada. A garantia de que o extrato não muda nada são os testes da 030 em
`test/gsc-hosts.test.mjs`, que rodam **antes** de qualquer leitura nova (ordem 0 do plano).

**Rejeitada**: chamar a primitiva de um host em laço dentro de `gscSeries`, como a corrida faz. É a
terceira cópia do laço, e a única que teria de decidir sozinha o que `null` e `{erro}` significam.

## D3 — A primitiva de um host, e a corrida que grava

**Decisão**: a função de UM host que hoje se chama `gscSeries` é renomeada `gscSerieDeUmHost` e fica
com um consumidor só: `app/api/gsc-serie/route.ts`, que muda **apenas o nome** no import e na chamada.
O nome `gscSeries` passa a ser da leitura somada.

**Racional**: a spec declara (Assumptions) que a série **gravada** não é tocada, e não é — o
comportamento da corrida é byte a byte o de hoje. O rename é o que faz a porta errada deixar de
compilar (D1) sem migrar a corrida. Manter o nome antigo com a assinatura antiga deixaria
`gscSeries(p.url)` natural e válido para o próximo chamador.

**A quinta porta, registrada para não ser redescoberta**: o laço de `route.ts:93-109` é o mesmo
contrato de D2 escrito à mão, correto hoje. Migrá-lo para `gscSeries(declarados, …)` apagaria ~25
linhas, mas a corrida escreve no banco e o Princípio IV faz do push um deploy: **spec própria**.
`gscSerieFiltrada` (as três pernas de marca) é primitiva de um host só da corrida, pelo mesmo motivo.

## D4 — A soma: a função que existe, com um defeito que a 029 não mediu

**Decisão**: os dias são somados por `somarSeriesPorHost` (FR-002), **corrigida** para devolver a
posição como veio quando só UM host votou naquele dia.

**O achado**: `somarSeriesPorHost` com um host só NÃO devolve o número do Google. Medido em
19/09/2026, 20.000 dias sintéticos de um host (posição de 1,0 a 31,0; impressões de 1 a 30.000):
**1.574 saíram com a posição diferente da crua** — `3,9 × 1146 ÷ 1146 = 3,8999999999999995`. É o
mesmo ponto flutuante que a 030 já tratou em `mesclarPorCaminho` ("voto único devolve a posição do
Google como veio"), e a FR-006 cobra "exatamente o resultado de hoje". O teste existente da 029 passa
por sorte: `4,2 × 786 ÷ 786` é exato.

**Por que na função e não num desvio no leitor** ("um host → devolve os dias crus"): o desvio
consertaria só o projeto de um host, e o defeito também está nos dias da Atma em que **um** host
contribui (todos os anteriores a 11/09). Consertar onde a conta é feita é a mesma escolha da 030 e
deixa as duas funções irmãs (`somarSeriesPorHost`, `mesclarPorCaminho`) com a mesma régua.

**O efeito colateral, medido**: `route.ts` chama a mesma função. A partir da próxima corrida, a
`posicao` gravada dos dias de um voto só pode diferir da anterior na 16ª casa, na direção do valor do
Google. `gravarDiasGsc` (`lib/db.ts:937`) guarda por **host**, nunca por valor, e o `ON CONFLICT`
apenas sobrescreve — nada acorda. Registrado aqui porque a spec disse "não tocada" e este é o único
ponto onde a corrida sente esta feature.

## D5 — Janelas: nada muda de tamanho, e as datas nascem uma vez

**Decisão**: o default de `gscSeries` continua `D-86 → D-3` (byte a byte, `019/FR-025`: trocá-lo
moveria a célula `visitante` dos 17 projetos), e a tendência continua `D-31→D-3` contra `D-59→D-32`.
As datas são calculadas **uma vez, fora do laço de hosts**.

**Racional**: com dois hosts em série, calcular `isoDaysAgo` dentro do laço deixa a segunda
requisição usar uma janela um dia à frente se a corrida atravessar a meia-noite UTC — os dois hosts
somariam períodos diferentes. É a lição da 025/D13 ("mesma corrida, mesma janela"), agora dentro de
uma única leitura.

## D6 — O contrato de falha, e o segredo que o `JSON.parse` vaza

**Decisão**:

| Leitura | Um host sem propriedade | Um host falha | Nenhum host vivo / env off / lista vazia |
|---|---|---|---|
| `gscSeries` | soma dos vivos, host em `encerrados` | `{erro: "<host>: …"}`, **nenhum dia** | `null` |
| `gscTrend` | soma dos vivos | `null` | `null` |

`getClient()` continua **fora** do `try` do laço compartilhado (como na 030).

**Racional**: FR-004 manda nomear o host, e a série tem onde: o `{erro}` já é impresso pela aba
(`Search Console indisponível (${serie.erro})`), e agora começa pelo host. A **tendência não tem
onde**: `GscTrend` é `{current, previous, property} | null`, os consumidores (`evaluate`, home) caem
em `seoSeed` quando é `null`, e nenhum lê motivo. O contrato de hoje ("qualquer falha → `null`") já
cumpre a metade que importa da FR-004 — **nada parcial é publicado** — e a metade "nomear" fica onde
há superfície. Ampliar `GscTrend` com `{erro}` reescreveria home e agenda por uma frase que ninguém
exibe. Se a spec quiser o host na home, é decisão de produto e não de plano.

`getClient()` faz `JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON)` síncrono. Movê-lo para dentro do `try`
transformaria uma env malformada em `{erro: <mensagem do V8>}` — e a mensagem do `JSON.parse`
**cita um trecho do texto parseado**, isto é, do JSON da service account. Princípio V: nem
prefixo. Por isso a `gscTrend` engole a exceção no `catch` externo que já tem (contrato de hoje), e
`gscSeries` a deixa subir, como hoje.

## D7 — O que `gscSeries` devolve

**Decisão**: `{ property, days, hosts, encerrados } | { erro } | null`. `property` é a propriedade do
primeiro host **vivo** — para um projeto de um host, a mesma de hoje.

**Racional**: só `aquisicao/page.tsx:864` lê `.property` (para checar se o `sc-domain:` cobre o host
que o crawl visitou). `hosts` e `encerrados` são o que a tela precisa para declarar a soma (D8) sem
reconsultar. A janela recebida (FR-003) **não precisa de campo**: a tela já a deriva de
`days[0]` / `days.at(-1)`, e com os dias somados ela é a união por construção.

## D8 — A tela: a mesma declaração nos dois blocos, por construção

**Decisão**: a frase que hoje vive só no bloco de consultas (`page.tsx:1740-1753`: "hosts somados: …
· sem propriedade no Search Console e fora da soma: …") vira **um componente**, usado no bloco da
série e no de consultas. Sem string nova.

**Racional**: FR-005/SC-003 pedem a mesma lista nos dois blocos. Dois trechos de JSX com a mesma
frase divergiriam na primeira edição — seis vezes nesta tela um conserto no chamador voltou pela
porta seguinte. Um componente faz a igualdade valer por construção, e o `grep` da cobrança prova que
ele tem dois usos.

**Textos que se ocultam sozinhos, verificados**: o bloco "A troca de domínio" (`:1376`) só aparece se
`recebidaGsc.inicio > janelaGsc.inicio`, e a linha "Recebida: … dos 28 dias" (`:2070`) só se
`recebidaGsc.inicio > curtaGsc.inicio`. Com a série somada a Atma começa em 2026-01-17 = início
pedido, então **os dois somem** — inclusive o parágrafo "as fontes ao vivo medem só o domínio novo"
(`:1405`), que já era falso desde a 030. Quando a união dos hosts ainda for truncada, o texto
reaparece dizendo "instrumento novo" sobre um site que tem os dois hosts: **revisar essa cópia
(`ux-writing`) na implementação**, não decidi a redação aqui.

## D9 — `www.`: latente, medido zero, e a 030 o descreveu errado

`hostsDeclarados` tira o `www.`. A `gscSeries` de hoje usa `new URL(siteUrl).hostname`, que o
**mantém**. Para um projeto cujo `url` tenha `www.`, a leitura passaria de `https://www.x.com/` para
`https://x.com/` e não casaria as páginas — a série do projeto sairia vazia.

**Medido em 19/09/2026**: 0 dos 35 projetos curados têm `www.` no `url` (leitura de
`data/projects.json`), e 0 dos 35 repos do GitHub com homepage (`gh api`, `normalizeSite` preserva o
`www.`, então seriam candidatos). **Latente, não presente.**

A 030/D9 trata isso como "comportamento PRÉ-EXISTENTE em todas as leituras". Pelo código lido, ele
foi **introduzido** por aquela feature nas leituras por página: as três usavam `new URL(siteUrl).hostname`.
Inofensivo enquanto o número for zero; o conserto é no resolvedor (`hostsDeclarados`), que serve
GA4 e a corrida, e não nesta spec. Fica como linha de risco com sinal observável.

## D10 — Custo de rede

Uma requisição por host por janela, em SÉRIE dentro da leitura (mesma credencial, mesmo endpoint —
030/D7). Projetos de um host: **zero requisição a mais**. Só a Atma declara dois hosts:

| Leitura | Requisições hoje | Depois (Atma) | Depois (os outros 34) |
|---|---:|---:|---:|
| Série da janela longa (aba) | 1 | 2 | 1 |
| Série padrão (`/seo`) | 1 | 2 | 1 |
| Série da coleta (ficha/OKR) | 1 | 2 | 1 |
| Tendência (home/agenda) | 2 | 4 | 2 |

O `/seo` e a home leem TODOS os projetos em `Promise.all` — a série em série é por projeto, e o
paralelismo entre projetos é o de hoje. Latência da Atma: uma requisição a mais por leitura.

## D11 — O que fica sem conserto e continua valendo

- **A corrida que grava** (D3): quinta porta, correta hoje, spec própria.
- **`scripts/` com cópia própria de `resolveProperty`** (`lib/gsc-consulta.mjs`): ferramentas de
  conferência, e é de propósito que a testemunha não importe o código que confere.
- **`piso, não total`** (omissão das consultas raras): a série usa a dimensão `date`, que não tem
  esse corte — o selo pertence ao bloco de consultas e continua lá.
- **`serie.property` para `sc-domain:` de domínio-pai**: o filtro de página é o que isola o host,
  como sempre foi.
