# Implementation Plan: Plano de SEO por projeto

**Branch**: `057-plano-seo` (work on `main`, like 054–056) | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/057-plano-seo/spec.md`

## Summary

The hub gains a plan per project that has a map, and Tape Pro is the first.

A local script consults the niche's search volume on DataForSEO once and freezes Tape Pro's term
inventory and demand into the committed JSON files that the map already reads. That also gives the
map, now switched on for `tapepro`, its denominators.

A new route `/gsc/mapa/[slug]/plano` proposes a meta for each leaf of the 18 KPIs:
- the existing `REGRAS` limiar for 29 of 31 leaves;
- demand math for `top20` and `tamBusca`, plus three headline projections (impressões, cliques and
  `pagina1`, the inventory on page 1). `strikingDistance` keeps its `REGRAS` meta (research D1, D11).

The owner approves each meta in Postgres, and the route shows a weekly construction calendar bounded
by capacity. A block on the existing map compares this week's milestones with the readings the map
already builds.

## Technical Context

**Language/Version**: TypeScript (Next.js 16 App Router, React 19) at the edge; pure `.mjs` for logic.
Node 22.

**Primary Dependencies**: all already installed: `pg` and `next`. DataForSEO is called with `fetch`
from a local script only. No new package.

**Storage**:
- committed JSON (`data/inventario-de-termos.json`, `data/demanda-estimada.json`) for the frozen
  demand;
- Postgres, with the new `hub_plano` and `hub_plano_meta`, for decisions and premises.

**Testing**: `node --test`, with the new `test/plano.test.mjs` registered in `package.json`.

**Target Platform**: EasyPanel Docker (Linux). The script runs on the Windows dev machine.

**Project Type**: web app (single Next project).

**Performance Goals**: opening either route makes 0 DataForSEO requests. The plan route adds one
`gscTermos` read (starting point); the map adds one shifted `gscTermos` read only when a plan is `ativo`
(research D11). `montar()` runs over at most
26 weeks × a few dozen clusters, so it takes microseconds.

**Constraints**:
- no DataForSEO key in production;
- no push between 23:30–01:00 or 08:00–08:45 BRT;
- the new crawl, series and indexing work for 23 Tape Pro URLs fits inside the existing `maxDuration`.

**Scale/Scope**: 3 projects with a map. About 100–500 terms per project. Plans of 26 weeks.

## Constitution Check

| Principle | Gate | Status |
|---|---|---|
| I. Contrato único de dados | The plan route reads projects via `projetosDeBusca()`/`listProjects()`, never `data/projects.json` | ✅ |
| II. `node --test`, registrado | `test/plano.test.mjs` added to the explicit list in the same commit; `validade.test.mjs` enforces it | ✅ |
| III. `.mjs` puro / `.ts` na borda | `lib/plano.mjs` (agrupar, propor, montar, comparar, lerDecisao, lerPlano) is pure; `.ts` only for the page, the actions and `db.ts` | ✅ |
| IV. Push é deploy | Deploy outside the two windows; the change to `SLUGS_DE_BUSCA` adds about 2.5 min to the indexing run, well under `maxDuration` | ✅ |
| V. Ambiente explícito, segredo nunca em log | The script validates `DATAFORSEO_API_KEY`, exits naming only the variable, never prints the key; production gets no new env var | ✅ |
| Stack fixa / sem framework novo | No dependency added | ✅ |

Post-design re-check: still ✅. There are no violations, so there is no Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/057-plano-seo/
├── spec.md
├── plan.md              # this file
├── research.md          # D1–D10
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── consultar-demanda.md
│   └── ui.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
lib/
├── plano.mjs                      # NEW — agrupar, propor, montar, comparar, lerDecisao, lerPlano
├── projects.ts                    # SLUGS_DE_BUSCA += "tapepro"
└── db.ts                          # + hub_plano, hub_plano_meta in ensure(); list/set functions
scripts/
└── consultar-demanda.mjs          # NEW — DataForSEO keywords_for_keywords, freezes JSON
data/
├── inventario-de-termos.json      # + tapepro (written by the script)
└── demanda-estimada.json          # + tapepro (written by the script)
app/gsc/mapa/[slug]/
├── page.tsx                       # + "Plano · semana N" block; TAM ressalva follows procedencia.fonte
└── plano/
    ├── page.tsx                   # NEW — US1 + US2
    └── actions.ts                 # NEW — criarVersao, decidirMeta, salvarPremissas, ativar
test/
└── plano.test.mjs                 # NEW, registered in package.json
```

**Structure Decision**:
- The existing single Next app. The plan route nests under the map, because it shares the slug scope
  and the 404 rule.
- All arithmetic lives in one pure module, next to `proxima-acao.mjs`, which it imports (`REGRAS`,
  `ALAVANCAS`, `DEGRAUS`). It also imports `benchmark` from `kpis-busca.mjs`. It declares no limiar of
  its own.

## Order of delivery (independent slices)

1. **Tape Pro gets a map**: `SLUGS_DE_BUSCA`. It ships alone and immediately satisfies SC-001 (leaves
   without inventory say so).
2. **Demand**: script, tests for `agrupar`, first real run and curation with Jean, then commit the
   JSON. The map's Top 20, Top 3 and TAM gain denominators.
3. **US1 + US2**: `lib/plano.mjs` (propor, montar) with tests, DB tables, `/plano` route and actions.
4. **US3**: `comparar` with tests, then the block on the map.
5. **US4**: no code. Atma and Sirius already work through the same route, and it is verified.

## Risks

- **The volume says the B2B niche is tiny** (like AftercareGen's B2B, "sem demanda"). That is a finding,
  not a bug. The plan shows it on day 1, before any page is written. That is the point of step 2 coming
  first.
- **`keywords_for_keywords` returns consumer noise** (craft tape, school supplies). Curation with
  `--excluir` happens before `--gravar`. The frozen list is what counts.
- **The robot restarts publishing**. Its pages count in the readings and in the coverage (D7), but not
  in the capacity (spec Assumptions).
