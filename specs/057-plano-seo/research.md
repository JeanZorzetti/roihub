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

## D10 — UI discipline

At implementation time the new screen pulls in `information-design` (the plan is a milestone and KPI
reading), `accessibility` (forms, and state never shown by color alone, FR-020), `ux-writing` (the 5
comparison states, the empty and zero-capacity states) and `ui-verification` (screenshot of both
routes in production). Glossary rule from 055: no "ok", no ✓, no "dentro" for a state without a
reading.
