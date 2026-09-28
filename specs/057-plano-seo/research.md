# Research — 057 Plano de SEO

Every decision below was read in the code on 2026-09-28. Nothing here is a guess about how the hub
works.

## D1 — Where the plan's metas come from: `REGRAS` first, demand only where it adds a number

**Decision**: For every `CATALOGO` leaf (31, minus `checklistGsc`, which is a procedure), the meta is
the limiar that `lib/proxima-acao.mjs#REGRAS` already declares. The meta keeps the leaf's own seal
(◆ régua, ◇ norma, ◇ meta do board, ◇ política do dono). Only two leaves get a demand-derived meta:
`top20` and `tamBusca`. The plan also shows three headline projections on the inventory terms
(impressões, cliques and `pagina1`), because no leaf counts them.

**`strikingDistance` keeps its `REGRAS` meta** (analyze I1, 2026-09-28). The leaf counts queries in
positions 4.0–10.9, and its rule is `op ">" limiar 0`: it is an opportunity queue, and the board's goal
is to move 15% to 25% of it into the Top 3. A demand meta of "N terms in 4–10.9" would read a term that
climbs to position 3 as a loss. The page-1 target lives in the headline `pagina1` instead: the fraction
of the inventory at positions 1.0–10.9, read by `penetracaoNoInventario(termos, inventario, 10.9)`, the
same function and the same `query`-dimension reading that the map uses for the Top 3 and Top 20
penetration.

**Rationale**: FR-002 of 054 already forbids writing a limiar twice. `REGRAS` is the single home for
"what counts as below". Reusing it means that for 29 of the 31 leaves, "abaixo do marco" is exactly
054's "dispara". US3 then comes almost free for those leaves, and the two screens cannot disagree.

**Refinement of spec FR-006**: the spec named three origins (demanda, régua, board). The code has four
seals. "The rest" keeps whatever seal the leaf already carries (norma and política do dono included),
not a blanket "board". No new seal (clarify Q3).

**Relative leaves stay relative**: `crescimentoNaoMarca` and `consultasUnicas` read as growth against
an earlier window. On a zero base there is no ratio. They keep the `REGRAS` meta, and the plan prints
"base zero: a meta relativa só vale quando a base tiver leitura". Inventing an absolute unit for them
would break the comparison with the map's `leitura.valor`.

**Alternatives rejected**: a demand meta for all 18 KPIs, which would give new numbers to CTR and
vitals, where a published régua already exists (spec US1 AC3 forbids it). Absolute click and
impression leaves, which would be new leaves in the catalog and a new rule per leaf (054 test).

## D2 — The demand math

**Decision**: with clarify Q2 (Top 20 at 90 d, band 7–10 at 180 d):
- A cluster counts toward a milestone only after `criadaNaSemana + semanasAteEstabilizar`. A cluster
  whose page already exists (D7) counts as created in week 0 (analyze I2).
- `top20` (fraction of the inventory in the Top 20), meta at 90 d = terms of mature clusters ÷ total
  terms.
- **Consequence of the defaults, shown on screen**: 90 d is week 12.9, and a page created by the plan in
  week 1 matures in week 13. With `semanasAteEstabilizar = 12`, the 90-day meta comes only from pages
  that already exist. When no plan page matures before a deadline, the meta for that deadline carries
  the aviso "nenhuma página nova amadurece antes deste prazo com estas premissas". This is not hidden
  and not rounded up.
- Headline `pagina1` (fraction of the inventory at positions 1.0–10.9), meta at 180 d = terms of
  clusters mature by week 26 ÷ total terms.
- `tamBusca` (impressions ÷ demand), meta at 180 d = volume of mature clusters ÷ total volume. A
  page-1 result is counted as an impression when the page loads, so impressions ≈ volume.
- Headline cliques at 180 d = mature volume × `benchmark(7)`. That is 0.02, read from
  `lib/kpis-busca.mjs#BENCHMARK`, never retyped.
- At 90 d there are no clicks and no impressions: page 2 has no régua (`benchmark(>10.9)` returns
  `null`), and the plan says so instead of printing 0.

**Rationale**: every factor is either the owner's policy (maturation, capacity), a measured volume or
the hub's existing régua. Nothing is multiplied by an invented coefficient. `gsc-delta.mjs` forbids
summing deltas across KPIs, and this math does not: each meta is a single chain.

## D3 — The demand consultation is a local script that writes committed JSON

**Decision**: `scripts/consultar-demanda.mjs <slug>` with three modes:
- no flag: show the seeds, the term estimate, the estimated cost and the DataForSEO balance, which is
  a free endpoint (FR-003a);
- `--consultar`: spend money and print the clusters;
- `--consultar --gravar`: also write the tapepro entries in `data/inventario-de-termos.json` and
  `data/demanda-estimada.json`.

The endpoint is Google Ads `keywords_for_keywords/live`: seeds in, related terms with monthly volume
out, one task, region `Brazil` (`areaServed: "BR"`). The actual `cost` from the response goes into the
procedência.

**Rationale**:
- It is the same pattern as `derivar-inventario.mjs` and `estimar-demanda.mjs` (034/050): the frozen
  list is committed, and git is the history, with author, date and diff. That satisfies FR-005 "a
  mudança fica gravada" and FR-017 (an old version stays readable) at no cost.
- The inventory must not move silently (034 header). A UI edit of the term list would move the
  denominator of `top20`, `penetracaoTop3` and `tamBusca` without a commit.
- The DataForSEO key stays on the dev machine (`roihub/.env`, copied from `open-seo/.env`). Production
  never gets a paid credential it does not use. The script validates the variable and exits naming only
  the variable (Principle V).

**Side effect, and a wanted one**: writing the tapepro inventory also gives the map its denominators.
Top 20, Top 3 penetration and TAM stop being "inventário de termos não declarado".

**Curation** (move a term, exclude a term or cluster, FR-005 and edge cases) happens in the JSON before
`--gravar`, through two script options:
- `--mover "termo=cluster"`
- `--excluir "termo:motivo"`

Exclusions are written to `procedencia.excluidos` with the reason. The plan page shows clusters
read-only and names the command.

**Alternatives rejected**:
- A consult button in the hub: it needs the paid key in production, and one click spends money.
- A DB table for terms: it gives a moving denominator and a second source next to the inventory.
- `search_volume/live` on seeds only: it returns the seeds' volume and never shows the niche.

## D4 — Clustering (clarify Q4)

**Decision**: a pure function `agrupar(termos, {produtos, segmentos})`:
- the term goes to the cluster of the product seed it contains, compared after `normalizar` (lowercase,
  no accents, hyphen → space);
- two product seeds → the longer one;
- a segment seed → a `segmento` tag inside the product cluster, as a candidate for a support page;
- no seed → `semCluster`.

The seeds are `lib/autopublish-projects.mjs` `produtos` and `segmentos` for the slug, overridable with
`--sementes`.

## D5 — Plan state lives in Postgres, in two tables

**Decision**:
- `hub_plano`: one row per version, holding capacity, maturation premises, start week and state.
- `hub_plano_meta`: one row per (version, leaf, horizon), holding the proposed value, final value,
  state and who decided and when.

Created in `ensure()` in `lib/db.ts`, like `hub_mapa_marca`. Values go in TEXT, not jsonb, where the
reader `JSON.parse`s them (055 note and memory `jsonb_breaks_code_that_json_parses`).

**Rationale**: approval needs an author and a timestamp, and it happens on screen (US1 AC5). The
proposal itself is not stored. It is recomputed from the JSON and `REGRAS`, and only the decision is
persisted, together with a snapshot of the proposed value (FR-009).

**Tasks are not stored**: `montar()` derives them from the plan, the clusters and the crawl. A task is
"feita" when the 055 marca for its alavanca has `marcado` on or after the task's week. That is FR-016
with zero new mechanism.

## D6 — Where each story renders

**Decision**:
- `/gsc/mapa/[slug]/plano` (new route) holds US1 and US2: clusters, metas with approve, edit and refuse
  forms, capacity and premises, and the weekly calendar. It reads the frozen JSON, the DB and
  `lerCrawlDePagina()`. It makes no DataForSEO call (SC-005). It makes **one** GSC read, `gscTermos`
  over the map's own window, for the starting point of the demand metas only (`top20`, `tamBusca`,
  `pagina1`), computed with the functions the map already uses. See D11.
- `/gsc/mapa/[slug]` (existing) gets one block for US3: "Plano · semana N". It lists this week's tasks
  with their 055 marca, and the demand marcos against the `leituras` the page already built. The
  comparison lives where the readings live. The page's own rule is "nothing is read twice".

**Alternatives rejected**:
- US3 on the plan page: it would have to recompute the 32 readings or extract them from a
  2,000-line page.
- Snapshotting readings to the DB on page open: that is a write on read.

## D7 — Coverage: which cluster already has a page

**Decision**: a cluster is covered when some URL in the latest crawl (`lerCrawlDePagina`) has the
normalized seed as a path segment sequence, or the seed in its title. Tape Pro today has
`/produtos/{fita-gomada,…}`, so the three product clusters start covered, and the plan begins with
support pages and uncovered clusters.

**Superseded in part by D12–D15 (clarify 2026-09-28)**: "covered" still names which page belongs to a
cluster, but it no longer makes the page count. The page counts only when it is `ativa` (D13), and it
counts only the terms its title or H1 cover (D14).

## D8 — Montage algorithm (FR-010 to FR-014, FR-018)

**Decision**: `montar({inicio, capacidade, semanasAteIndexar, semanasAteEstabilizar, clusters})`
works as follows:
- Clusters are ordered by volume, descending.
- Each week takes up to `capacidade` pages, in this order: uncovered cluster pages first, then support
  pages (cluster × segment with volume ≥ piso), largest first.
- Each page creation emits:
  - `cobertura` for the page itself;
  - `links`, `titulo` and `schema` in the same week, as part of making the page right. None of these
    can precede the page (FR-012).
  - `indexacao` at `+semanasAteIndexar`.
- A week with `capacidade = 0` produces the first-line warning and no coverage milestones.
- If the pages needed for a meta do not fit before its deadline, the result says "não cabe no prazo com
  esta capacidade" for that meta.
- The same alavanca in the same week becomes one task listing every target (054 FR-009).

**Defaults**: capacidade 3 (clarify), semanasAteIndexar 2, semanasAteEstabilizar 12, both with the
seal "◇ política do dono, sem fonte" and editable.

The plan suggests raising capacity when clean indexing of plan pages is above 90%. It reads
`indexacaoLimpa` on the map and never changes the value itself (FR-010).

## D9 — Tape Pro enters `SLUGS_DE_BUSCA`

**Decision**: `SLUGS_DE_BUSCA = ["atma", "sirius", "tapepro"]`. This turns on, for 23 URLs:
- `/api/gsc-serie`;
- `/api/indexacao`, at about 6.4 s per URL, so about 2.5 min;
- `/api/paginas` (crawl);
- the map.

Well inside the GSC quota and `maxDuration`. There is no route change: 052 designed the list for this.

## D11 — Decisions from speckit-analyze (2026-09-28)

Read in the code before deciding: the map reads GSC live (`gscConsultas`, `gscPaginas`, `gscTermos` in
`app/gsc/mapa/[slug]/page.tsx`). Only daily site totals are stored (`lerDiasGsc`). `gscTermos(hosts,
janela)` takes the window as a parameter.

- **Starting point (US4 AC1, "meta abaixo do ponto de partida")**: the plan page reads `gscTermos` once,
  as in D6. A stored series cannot give `top20` or `pagina1`, because the query-dimension reading is
  never stored. Showing the starting point only on the map would miss the moment of the proposal. For
  the 29 `REGRAS` leaves the starting point is already on the map, and the plan page links to it.
- **Two consecutive weeks below (US3 AC3)**: when a plan is `ativo`, the map reads `gscTermos` a second
  time over the same 28-day window shifted 7 days back. `comparar` receives that previous reading
  against the previous week's milestone. That is one more GSC call per host, only on projects with an
  active plan, and nothing is written on read.
- **Deadlines**: fixed at 90 and 180 days (clarify Q2). FR-008 now says the owner moves `inicio`, not
  the horizon.
- **Edited metas drive the milestones (analyze I3)**: `montar` receives the approved metas. The weekly
  milestone is what the page schedule delivers that week. At each deadline, the milestone is the
  approved value. If the schedule delivers less than the approved value by the deadline, that meta
  carries "não cabe no prazo com esta capacidade". Raising a meta by hand can therefore show "não cabe"
  without changing capacity.
- **US4 uses the demand the hub already has (analyze U2)**: Atma and Sirius keep their 034 inventory
  and 050 demand, whose source is the GSC floor. `consultar-demanda.mjs --gravar` refuses to overwrite
  an entry whose `procedencia.fonte` is not DataForSEO, and exits naming the entry. Replacing it would
  move the denominator of leaves that already have readings.

## D12 — Per-URL index verdict is stored by the run that already reads it (FR-007a)

Read in the code on 2026-09-28: `/api/indexacao` inspects the sitemap URLs of the projects in
`SLUGS_DE_BUSCA` and gets one verdict per URL (`inspecionarIndexacao` → `linhas`). Then `agregar()`
throws the URL away and `hub_indexacao` keeps only the counts.

It does **not** inspect every URL every day (speckit-analyze C2). It inspects `amostra(urls, cota) =
urls.slice(0, cota)`, where `repartir()` takes the cota from a budget of 400 inspections per run
(`INSPECOES_POR_CORRIDA`) shared by all projects. The queue starts with the oldest reading. A project
that comes late in the queue gets a partial cota, and the tail of its sitemap goes unread that day.

**Decision**: the same run also writes the per-URL class to a new table `hub_indexacao_url (projeto,
dia, url, classe)`. `classe` is the output of `classificar()` from `lib/indexacao-corrida.mjs`, reused
as is: `indexada | rastreada_nao_indexada | descoberta_nao_indexada | outra | falha`. The write is
DELETE by `(projeto, dia)` plus a multi-row INSERT, the same as `hub_pagina` (024), so a URL that left
the sitemap does not linger as a ghost. `lerIndexacaoPorUrl(slug)` returns **the latest verdict of each
URL**, each with its own day: `Record<url, {classe, dia}>` (`SELECT DISTINCT ON (url) … ORDER BY url, dia
DESC`). It does not return "the latest day", because a day with a partial cota would erase the verdicts
of the URLs it skipped.

A URL that left the sitemap keeps its old verdict in the table, but it never reaches a screen. The plan
looks up only the URLs of the latest page crawl.

**Rationale**: it costs 0 extra inspections. The route already paid about 6.4 s per URL for this
answer, and it drops it on the floor. The volume is about 160 rows a day (Atma, Sirius and Tape Pro).
That is the same order as `hub_pagina`, which already keeps every URL of every run.

**Consequences**:
- A URL outside the sitemap is never inspected, so it stays "sem leitura". That is the honest
  answer.
- A URL whose place in the sitemap is always beyond the cota is never read. It stays "sem leitura"
  for good, and the page says so. That is a budget finding, not a plan bug.
- Until the first run after deploy, every page is "sem leitura" and gets the `indexacao` task. The
  quickstart triggers one run by hand, outside the night window.
- `falha` is "sem leitura", never "fora do índice": a 429 is not a verdict.

**Alternative rejected**: inspecting the covering pages on plan open. That is 6.4 s per URL inside a
page render, and it spends quota on read (write on read, D6).

## D13 — Page state: indexing × impressions (FR-007a)

**Decision**: a pure function `estadoDaPagina(url, {classes, impressoes})` returns one of four states:

| Index reading | Impression reading | State |
|---|---|---|
| `indexada` | ≥ 1 in the window | `ativa` |
| `indexada` | absent from a complete reading | `indexada-sem-impressao` |
| `rastreada_nao_indexada`, `descoberta_nao_indexada` or `outra` | any | `fora-do-indice` |
| missing URL, `falha` or no run | any | `sem-leitura` |
| `indexada` | read failed, or the reading was `truncado` | `sem-leitura` |

The impressions come from `gscPaginas(hosts, janela)`, over the same window the map uses:
- **Map**: it already makes this read (`paginasGsc`) and passes it into `dadosDoPlano`. That adds 0
  calls.
- **Plan route**: this becomes its second Search Console read, next to `gscTermos` (D6/D11). There is
  still no DataForSEO call (SC-005).

Google leaves out a row with zero impressions, so a URL absent from a complete reading means 0. A
truncated or failed reading proves nothing about absence, so the state is `sem-leitura` and the plan's
first line says why.

URLs are matched by **path**: decoded, without the trailing slash, and only for the project's own hosts.
A variant such as `/pt-BR/x` is a different path (memory `google_indexa_url_prefixada_pelo_link_interno`).
Its impressions do not count for `/x`, and that is correct: the page the plan measures is not the one
Google shows.

## D14 — Term coverage by title or H1 (FR-007b, FR-005a)

Read in the code: the crawl (`lib/pagina.mjs#extrair`, 024) stores `titulo` but not the H1.

**Decision**:
- `lib/pagina.mjs` gains `h1(html)`: the first `<h1>`, with tags removed and entities decoded, run over
  `semScriptNemStyle(html)`. That avoids the greedy-regex defect that file already documents. It
  returns `null` when there is no `<h1>`.
- `hub_pagina` gains a nullable `h1 TEXT` (`ADD COLUMN IF NOT EXISTS`). NULL on older rows means "not
  read", not "no H1". Until the next daily crawl, coverage uses the title only, and the plan says
  "H1 não lido nesta corrida".
- `cobreTermo(termo, texto)`: split `normalizar(termo)` and `normalizar(texto)` into words. It returns
  true when **every** word of the term is a word of the text, in any order. A page covers a term when
  its title covers it **or** its H1 covers it (each one alone, not the two mixed).
- A **planned** page covers what its label covers:
  - a cluster page: the seed;
  - a segment support page: seed + segment;
  - a term support page (FR-005a): the term itself.

  The calendar cannot read a title that does not exist yet. The label is the promise that the page's
  title will carry those words, and the page's `titulo` task (FR-012) is that promise.
- `entrega()` changes unit: from "terms of mature clusters" to "terms whose covering page is mature". A
  term covered by several pages takes the earliest maturity. The `conta` lists, for each page, the
  terms and the volume it covers (FR-007b).

**FR-005a, the term support page**: a cluster term with `volume ≥ pisoApoio` enters the queue as a
support page labeled with the term, after the cluster pages and together with the segment support
pages, by volume. It qualifies only when no existing page (any state) and no page already in the queue
covers it. `pisoApoio` defaults to 100 and is a new premise on `hub_plano`, with the seal "◇ política do
dono, sem fonte". It is edited in the same form as capacity.

**The seed of a cluster that already has a page** (speckit-analyze U2, decided by Jean on 28/09):
- The cluster page is found by path **or** title (D7), but term coverage reads only the title or the H1.
  A page found by path whose title and H1 lack the seed therefore leaves the seed uncovered.
- In that case the seed does **not** become an `apoio-termo`, because a second page for the same term
  would compete with the first. The existing page gets a `titulo` task in week 1 instead, with that URL
  as its target. The task is to put the seed in the title.
- The rule is the same for every existing page:
  - the page still does not count the seed until the crawl reads the new title;
  - after that it follows FR-007a like any other page.

**Consequences of the literal rule, as clarified** (kept, and shown in the `conta`, not softened):
- plural and singular are different words (`fita` ≠ `fitas`);
- prepositions count (`fita gomada para caixa` needs `para`).

Stemming or a stop-word list would be a second, unannounced matching rule. If the owner wants one,
that is a new clarification.

## D15 — Existing pages that are not `ativa` become week-1 tasks (FR-007a)

**Decision**: in `montar()`, a covering page that is not `ativa` emits week-1 tasks:
- `fora-do-indice`, or `sem-leitura` whose index verdict is not `indexada` (missing, `falha`, no run):
  `indexacao`, with the URL as the target.
- `sem-leitura` with an `indexada` verdict: the page is indexed, and only the impression reading failed
  or was truncated (speckit-analyze U1). **No task**, because asking to index an indexed page is the
  wrong lever. The plan's first line names the failed reading. The page enters no milestone until a
  complete reading exists.
- `indexada-sem-impressao`: the **posição** levers that act on an existing URL: `links`, `frescor`
  and `backlinks`. These are the 054 levers with `degrau: "posicao"`, minus `cobertura` (the page
  exists) and `marca` (it acts on the brand, not on a page).

The same lever in the same week stays a single task with every target (054 FR-009).

**Maturation**:
- The page's creation week is the week of the first 055 marca on any of its levers with `marcado ≥
  inicio`.
- Maturation is that week + `semanasAteEstabilizar`.
- With no marca, the creation week is `Infinity`: the page enters no milestone and no deadline.

`montar` and `propor` receive `marcas`, and the 055 marca is per lever per project (there is no
per-URL marca). One `indexacao` marca therefore starts the clock for every page that had that task.
That is the same granularity 054/055 already use, and it adds no mechanism (FR-016).

**Consequence for Tape Pro on 2026-09-28**: 2 cluster pages had 0 impressions since 07/08. Both are
either `indexada-sem-impressao` or `fora-do-indice`, and week 1 has tasks. No demand meta counts those
clusters before a marca, so the 90-day meta drops to what the math can actually deliver. That is
SC-008.

## D16 — The current week merges the map's cards, on the map (FR-011a)

**Decision**: a pure function `semanaComCards(semana, entradas)`:
- `entradas` is the output of the 054 `plano()`, keeping only entries whose `apresentacao` is `ativa`
  or `voltou`. An entry that is `aguardando` has a vigente marca and stays hidden until `reler`.
- An entry and a calendar task with the same lever become **one** task: the union of targets and KPIs,
  plus `origem: ["calendario", "mapa"]`.
- Cards without a calendar task are appended in the 054 order (degrau, then lever).
- Future weeks never receive cards.

**Where it renders**: the map's block "Plano · semana N". It already holds `acoes = plano(disparos,
{marcas, hoje})` and the 32 readings, so the merge costs 0 reads. On the plan route, the current
week's row shows the calendar tasks and then a line pointing to the map's block, something like "as
alavancas que o mapa dispara hoje também são desta semana". The final copy comes from `ux-writing`.
The row never shows "nada a fazer". The line carries no count, because the plan route cannot know one
without the 32 readings.

**Rationale**: D6 already rejected recomputing the 32 readings on the plan route. Doing it now would
put a second copy of a 2,600-line page's readings next to the first, and the two screens could
disagree. The map block is the week's reading, and the plan route is the calendar. SC-003 ("sem
clicar") is met where the owner reads the week, which is the map.

**Alternative rejected**: extracting the readings into a shared module. It is the right move the day a
third screen needs them. Today it is a refactor of the largest file in the repo in order to repeat a
list that already renders one click away.

## D10 — UI discipline

At implementation time the new screen pulls in `information-design` (the plan is a milestone and KPI
reading), `accessibility` (forms, and state never shown by color alone, FR-020), `ux-writing` (the 5
comparison states, the empty and zero-capacity states) and `ui-verification` (screenshot of both
routes in production). Glossary rule from 055: no "ok", no ✓, no "dentro" for a state without a
reading.
