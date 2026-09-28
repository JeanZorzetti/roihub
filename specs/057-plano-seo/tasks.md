---

description: "Task list for 057 — Plano de SEO por projeto"
---

# Tasks: Plano de SEO por projeto

**Input**: Design documents from `specs/057-plano-seo/`

**Prerequisites**: plan.md, spec.md, research.md (D1–D16), data-model.md, contracts/, quickstart.md

Phases 1–7 (T001–T039) are the original plan, implemented in `676e0cc`. Phase 8 (T040–T070) is the
clarification of 2026-09-28 (research D12–D16, FR-005a, FR-007a, FR-007b, FR-011a, SC-008).

**Tests**: included. SC-004 asks for a test that fails, quickstart §1 lists the cases, and Principle II
requires `node --test` registered in `package.json`. Test tasks come before the code they cover.

**Organization**: grouped by user story. The work happens on `main`, like 054–056. Every commit uses
`git commit -- <paths>`, because the index may hold other writers' staged files. Pushing is deploying:
never between 23:30–01:00 or 08:00–08:45 BRT.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1, US2, US3, US4 (spec.md)

---

## Phase 1: Setup

- [X] T001 Create `test/plano.test.mjs` with one `node:test` import and register it in the `"test"` list in `package.json`, in the same commit (Principle II; `test/validade.test.mjs` fails otherwise)
- [X] T002 [P] Copy `DATAFORSEO_API_KEY` from `ROI Labs/open-seo/.env` to `roihub/.env`. Confirm with `grep -c DATAFORSEO_API_KEY`, never `cat` or `diff`. Confirm `.env` is in `.gitignore`

---

## Phase 2: Foundational (blocks every story)

**Purpose**: Tape Pro gets a map (FR-001, SC-001). The plan also needs the version tables and the pure validators

- [X] T003 Add `"tapepro"` to `SLUGS_DE_BUSCA` in `lib/projects.ts:127`. Fix the stale "hoje, a Atma" comments in `app/api/gsc-serie/route.ts:37` and `app/api/indexacao/route.ts:70` so they name the list instead of a project
- [ ] T004 Run `npm test`, commit T003 alone, and push outside the windows. After the next `/api/gsc-serie`, `/api/indexacao` and `/api/paginas` runs, open `/gsc/mapa/tapepro`: it must return 200 with 32 leaves, each in one of the 5 states (SC-001). Confirm the indexing run's duration stays under `maxDuration` (about +2.5 min for 23 URLs, D9)
- [X] T005 [P] Write tests in `test/plano.test.mjs` for `lerDecisao` and `lerPlano`. They must reject: a `responsavel` other than `jean`/`maria`; a `chave` that is not a `CATALOGO` key (`lib/gsc-delta.mjs:291`) or a headline (`cliques`/`impressoes`/`pagina1`); a `prazo` other than the fixed 90/180 (FR-008); a non-finite `valor`; `capacidade` outside the integers 0–20; premises outside the integers 0–26
- [X] T006 Implement `lerDecisao` and `lerPlano` in the new pure `lib/plano.mjs`, following `lerMarca` (`lib/proxima-acao.mjs:241`). Bad input returns `null` and writes nothing
- [X] T007 [P] In `lib/db.ts`, add `hub_plano` and `hub_plano_meta` to `ensure()` next to `hub_mapa_marca` (line 184), exactly as in `data-model.md` §2. Values stay TEXT, not jsonb. Add:
  - `listPlanos(projeto)`;
  - `criarPlano(p)`, next `versao`, `estado = 'rascunho'`;
  - `setPremissas(projeto, versao, p)`, only while `rascunho`;
  - `listMetas(projeto, versao)`;
  - `decidirMeta(m)`, an upsert only while the version is `rascunho` (FR-017, SC-006);
  - `ativarPlano(projeto, versao)`, in one transaction that moves the previous `ativo` to `encerrado`

**Checkpoint**: `/gsc/mapa/tapepro` is live and the plan's storage exists

---

## Phase 3: User Story 1 — Ver a demanda do nicho e aprovar as metas (P1) 🎯 MVP

**Goal**: the owner sees Tape Pro's niche demand in clusters and approves, edits or refuses one meta per leaf × horizon, each with its `conta`

**Independent Test**: open `/gsc/mapa/tapepro/plano`, read "cluster fita gomada · N termos · X buscas/mês" and one demand meta with its `conta`, then approve it without leaving the screen

### Tests for US1

- [X] T008 [P] [US1] Write tests in `test/plano.test.mjs` for `normalizar` (lowercase, no accents, hyphen → space) and `agrupar` (D4, FR-005):
  - "fita gomada preço" → `fita gomada`;
  - "fita gomada para e-commerce" → `fita gomada` with segment `e-commerce`;
  - a term with two product seeds → the longer seed;
  - a term with no seed → `semCluster`;
  - the same input twice → the same output
- [X] T009 [P] [US1] Write tests in `test/plano.test.mjs` for `cobrir(clusters, crawl)` (D7): a crawl URL whose path contains the normalized seed as a segment sequence (`/produtos/fita-gomada`), or whose title contains the seed, covers the cluster. Otherwise `pagina` is `null`
- [X] T010 [P] [US1] Write tests in `test/plano.test.mjs` for `propor` (D1, D2, FR-006, FR-007):
  - every `REGRAS` leaf (`lib/proxima-acao.mjs:74`) gets meta = `REGRAS[k].limiar` and origin = the leaf's own seal;
  - `checklistGsc` is absent;
  - `top20` at 90 d, `tamBusca` at 180 d and the headline `pagina1` at 180 d (inventory at 1.0–10.9) follow the D2 math and count a cluster only after `criadaNaSemana + semanasAteEstabilizar`;
  - `strikingDistance` keeps `REGRAS.strikingDistance.limiar` and gets no demand meta (D1, analyze I1);
  - a cluster whose page already exists counts as created in week 0. With the defaults (12 weeks to stabilize), no plan page counts at 90 d, and that meta carries the aviso "nenhuma página nova amadurece antes deste prazo com estas premissas" (D2, analyze I2);
  - given a `partida` reading, each demand meta carries it and the distance. Without one, `partida` is absent, not 0 (D11);
  - the 180-day headline cliques equal mature volume × `benchmark(7)`, imported from `lib/kpis-busca.mjs`;
  - the 90-day cliques and impressões are absent with a reason, never 0;
  - `crescimentoNaoMarca` and `consultasUnicas` carry the "base zero" aviso;
  - a term flagged "volume abaixo do mínimo reportado" does not add to any meta;
  - the `conta` text names volume, target position, fraction and deadline

### Implementation for US1

- [X] T011 [US1] Implement `normalizar` and `agrupar(termos, {produtos, segmentos})` in `lib/plano.mjs`
- [X] T012 [US1] Implement `cobrir(clusters, crawl)` in `lib/plano.mjs`
- [X] T013 [US1] Implement `agendaDePaginas(clusters, {capacidade, inicio})` and `propor(clusters, {premissas, inicio})` in `lib/plano.mjs`:
  - `agendaDePaginas` orders uncovered cluster pages by volume, then support pages (cluster × segment ≥ piso), at most `capacidade` per week. It returns the creation week of each page, and `montar` (US2) reuses it, so the two cannot disagree;
  - `propor(clusters, {premissas, inicio, partida})` imports `REGRAS` and `benchmark` and declares no limiar of its own (FR-002 of 054). `partida` is `{top20, tamBusca, pagina1}` or `null`
- [X] T014 [US1] Create `scripts/consultar-demanda.mjs` in no-flag mode (`contracts/consultar-demanda.md`):
  - `DATAFORSEO_API_KEY` missing or blank → exit 2, naming only the variable;
  - seeds are the slug's `produtos` from `lib/autopublish-projects.mjs`, hyphens → spaces, overridable with `--sementes`;
  - region comes from `areaServed` (`BR` → `Brazil`), overridable with `--regiao`; language is `pt`;
  - it prints the balance from `GET /v3/appendix/user_data` and the estimated cost;
  - if the balance is below the cost, it exits and says how much is missing (FR-003a)
- [X] T015 [US1] Add `--consultar` to `scripts/consultar-demanda.mjs`:
  - one `POST` to Google Ads `keywords_for_keywords/live`;
  - any API error or partial response writes nothing;
  - drop terms below `piso` 10 and brand terms (`regexDeMarca`, `lib/marca.mjs:37`), and print the drop counts;
  - a seed with null volume stays as "volume abaixo do mínimo reportado";
  - run `agrupar`, then apply `--mover "termo=semente"` and `--excluir "termo:motivo"`;
  - print the actual `cost`, the clusters with volume and `semCluster`
- [X] T016 [US1] Add `--gravar` to `scripts/consultar-demanda.mjs`. It builds the `tapepro` entries of `data/inventario-de-termos.json` and `data/demanda-estimada.json` as in `data-model.md` §1 (`fonte`, `regiao`, `idioma`, `custoUsd`, `sementes`, `movidos`, `excluidos`). It runs `validarInventario` (`lib/inventario.mjs:43`) before touching disk, then prints the paths written. Before any paid request, `--gravar` refuses a slug whose existing entry has a `procedencia.fonte` other than DataForSEO (the 034/050 entries of Atma and Sirius): exit 1, naming the entry (D11)
- [X] T017 [US1] Real run with Jean:
  - no flag, then `--consultar` (`git status` stays clean);
  - curate consumer-intent terms with `--excluir` and misplaced ones with `--mover`;
  - `--consultar --gravar`;
  - `npm test` green;
  - commit the two JSON files.

  If the niche turns out tiny, record it as a finding (plan Risks), not a bug
- [X] T018 [P] [US1] In `app/gsc/mapa/[slug]/page.tsx`, the TAM ressalva says "estimativa, teto" only when `procedencia.fonte` is the GSC impression floor. For DataForSEO it names the source and the consultation date. Confirm Top 20, Top 3 penetration and TAM for `tapepro` no longer say "inventário de termos não declarado"
- [X] T019 [US1] Invoke the `information-design`, `accessibility` and `ux-writing` skills (D10) before writing the screen. Fix the copy of the aviso, the seals, the meta states and the form buttons
- [X] T020 [US1] Create `app/gsc/mapa/[slug]/plano/page.tsx`, a server component that returns 404 when the slug is not in `SLUGS_DE_BUSCA`. It reads the frozen JSON, `lerCrawlDePagina` (`lib/db.ts:1508`), `listPlanos` and `listMetas`. It makes no DataForSEO call (SC-005). It makes one `gscTermos(hosts, janela)` read over the map's window and computes the `partida` for `top20`, `tamBusca` and `pagina1` with `penetracaoNoInventario` (20 and 10.9) and `coberturaDaDemanda` from `lib/kpis-busca.mjs`. A failed read leaves `partida` null and says why, the same way the map does (D11). It renders these blocks from `contracts/ui.md`:
  - 1, the "no frozen demand" aviso naming the command;
  - 2, Demanda, read-only, naming `--mover`/`--excluir`;
  - 3, Metas, grouped under the 18 KPIs, headlines first, each row with seal, `conta`, state and the approve/edit/refuse form with `responsavel`;
  - 6, Versões.

  Demand metas show the starting point and the distance. An edited meta below the starting point is accepted with the "já atingida" aviso. REGRAS leaves link to the map for their starting point
- [X] T021 [US1] Create `app/gsc/mapa/[slug]/plano/actions.ts` with `criarVersao` and `decidirMeta`. Both validate with `lerPlano`/`lerDecisao`, return without writing on bad input, and call `revalidatePath` on `/gsc/mapa/[slug]` and `/gsc/mapa/[slug]/plano`. `decidirMeta` stores the proposed value, final value, state, author and date (FR-009)

**Checkpoint**: US1 works alone. Demand, metas and decisions are on screen and in `hub_plano_meta`

---

## Phase 4: User Story 2 — Ler o plano semana a semana (P1)

**Goal**: with approved metas, a weekly calendar bounded by capacity. Each task has alavanca, target, responsible and milestone

**Independent Test**: open `/gsc/mapa/tapepro/plano` and, without clicking, read the current week's task, its responsible and the expected milestone

**Depends on**: US1 (`agendaDePaginas`, approved metas)

### Tests for US2

- [X] T022 [P] [US2] Write tests in `test/plano.test.mjs` for `montar` (D8):
  - no week has more `cobertura` than `capacidade` (SC-004);
  - no `links`, `titulo` or `schema` comes before its page's week (FR-012);
  - `indexacao` lands at `+semanasAteIndexar`;
  - a covered cluster (including a page created outside the plan) emits no `cobertura`;
  - the same alavanca in the same week is one task with every target and KPI (054 FR-009);
  - `capacidade 0` → first-line aviso and no coverage milestone (FR-018);
  - a deadline that does not fit → "não cabe no prazo com esta capacidade" for that meta;
  - `montar` takes the approved metas: the milestone at each deadline equals the approved value, and weekly milestones are what the schedule delivers. Raising an approved meta above what the schedule delivers flips that meta to "não cabe" with no change in capacity (D11, analyze I3);
  - only `ALAVANCAS` keys from `lib/proxima-acao.mjs:33` appear (FR-011)
- [X] T023 [P] [US2] Write tests in `test/plano.test.mjs` for `feita`: a task is done when the 055 marca for its alavanca has `marcado` ≥ the week start. Earlier or absent → not done

### Implementation for US2

- [X] T024 [US2] Implement `montar({inicio, capacidade, semanasAteIndexar, semanasAteEstabilizar, clusters, metas, responsavel})` in `lib/plano.mjs`. It reuses `agendaDePaginas`, orders tasks by `DEGRAUS`, and fills each week's `marcos` for `top20`, `tamBusca` and the headlines (cliques, `pagina1`). At each deadline the milestone is the approved meta from `listMetas` (D11)
- [X] T025 [US2] Implement `feita(tarefa, semana, marcas)` in `lib/plano.mjs`, taking marcas from `listMarcas` (`lib/db.ts:902`). No new mechanism (FR-016)
- [X] T026 [US2] Add `salvarPremissas` and `ativar` to `app/gsc/mapa/[slug]/plano/actions.ts`. `ativar` refuses while any meta has no decision. After `ativo`, a change requires `criarVersao` (FR-017)
- [X] T027 [US2] In `app/gsc/mapa/[slug]/plano/page.tsx`, add:
  - block 1 in full: capacity 0, and a deadline that does not fit, before any task (FR-018);
  - block 4, Premissas, defaults 3/2/12 with the seal "◇ política do dono, sem fonte" and the edit form (FR-013);
  - block 5, Calendário: week number and date, tasks (alavanca, targets, KPIs, responsible, 055 marca) and demand milestones. The current week is marked by text, not only by style (FR-020)

**Checkpoint**: US1 + US2 are the full plan for Tape Pro (SC-002, SC-003, SC-004)

---

## Phase 5: User Story 3 — Comparar planejado com lido toda semana (P2)

**Goal**: the map shows each due milestone against its reading, in one of 5 states

**Independent Test**: in an `ativo` plan, open `/gsc/mapa/tapepro` and read "Plano · semana N de M" with each demand leaf's milestone, reading and state in glyph and text

**Depends on**: US2 (`montar`, an `ativo` version)

### Tests for US3

- [X] T028 [P] [US3] Write tests in `test/plano.test.mjs` for `comparar(marcos, leituras, semana)` (FR-015):
  - a milestone in the future → `nao-chegou`;
  - a reading `{ausente}` → `sem-leitura` with the map's motivo, never `no-marco`;
  - `no-marco`, `abaixo` and `acima` at the edges;
  - no state label contains "ok", "✓" or "dentro" (055 glossary);
  - `abaixo` this week and `abaixo` for the previous reading against the previous week's milestone → `sugerirRefazer: true`, and the meta is not changed. A previous reading that is absent → `sugerirRefazer: false`, never a guess

### Implementation for US3

- [X] T029 [US3] Implement `comparar` in `lib/plano.mjs`
- [X] T030 [US3] In `app/gsc/mapa/[slug]/page.tsx`, add the "Plano · semana N de M" block right after "O que fazer primeiro" (around line 2334). It shows only with an `ativo` plan and links to `/plano`. It contains:
  - this week's tasks with their 055 marca;
  - the demand leaves' milestone vs. the page's existing `leituras`, with glyph + text. `pagina1` is read with `penetracaoNoInventario(termosGsc.linhas, inventario, 10.9)` over the `termosGsc` the page already has;
  - one extra `gscTermos` read over the same window shifted 7 days back, only when an `ativo` plan exists, as the previous reading for `sugerirRefazer` (US3 AC3, D11). Nothing is written on read;
  - one line pointing to "O que fazer primeiro" for the REGRAS leaves;
  - a task marked done whose reler date passed and whose rule still fires, shown as "ainda dispara" (reuse `plano()` from `lib/proxima-acao.mjs:268`);
  - the capacity suggestion when `indexacaoLimpa` of the plan's pages is above 90% (FR-010), never changing it.

  No DataForSEO request

**Checkpoint**: SC-007 is readable on the first weekly comparison after activation

---

## Phase 6: User Story 4 — Plano para qualquer projeto com mapa (P3)

**Goal**: the same route serves Atma and Sirius (FR-019)

**Independent Test**: open `/gsc/mapa/sirius/plano` and see the metas starting from today's reading

- [X] T031 [US4] Grep `lib/plano.mjs` and `app/gsc/mapa/[slug]/plano/` for `tapepro`, `atma` and `sirius`. There must be zero hits, because no rule is written per project (FR-019)
- [X] T032 [US4] Run `node --env-file=.env scripts/consultar-demanda.mjs atma --consultar --gravar`. It must exit 1 naming the entry **before** any paid request, because Atma's entry comes from the GSC floor (D11, T016 guard). `git status` stays clean and the balance is unchanged
- [X] T033 [US4] Open `/gsc/mapa/atma/plano` and `/gsc/mapa/sirius/plano`: 200, blocks render, with no Tape-Pro-specific text. The demand block names the 050 GSC-floor source, not DataForSEO
- [X] T034 [US4] On `/gsc/mapa/sirius/plano`, each demand meta shows the starting point read today and the distance to the meta, not a start from zero (US4 AC1). Compare `top20` with the value the map prints for the same leaf on the same day: they must match, because it is the same function over the same window

---

## Phase 7: Polish & Cross-Cutting

- [X] T035 Run `npm test` (all green, `test/plano.test.mjs` included) and `npx next build`. Commit with `git commit -- <paths>` and push outside 23:30–01:00 and 08:00–08:45 BRT. Poll the screen for new text twice; a 200 is not proof
- [X] T036 Invoke `ui-verification` on `/gsc/mapa/tapepro/plano` and `/gsc/mapa/tapepro`: 3 widths, a keyboard pass through every form, the accessibility tree (no state by color alone, FR-020), a clean console, and the network tab with no DataForSEO or Google request (SC-005)
- [ ] T037 Quickstart §4 in production: approve every meta as Jean and activate. Check that `hub_plano_meta` has `decidido_por = 'jean'` on every row, and that editing an approved meta asks for a new version (SC-006). The map must show "Plano · semana 1 de 26" with the demand milestones as `nao-chegou`
- [ ] T038 Schedule a re-read one week after activation for SC-007: 100% of Tape Pro's due milestones in one of the 5 states
- [ ] T039 Re-run `speckit-analyze` on `specs/057-plano-seo/` after implementation, to catch drift between code and design

---

## Phase 8: Clarification of 2026-09-28 (research D12–D16)

**Why**: the implemented plan promised 100% of Tape Pro's 70 terms on page 1 from 2 pages that have
had 0 impressions since 07/08, with an empty week. Four slices, in plan order (plan.md "Order of
delivery" §6). Each one ships alone.

### 8.1 Store what is already read (Foundational, no screen change)

**Purpose**: the per-URL index verdict and the H1 exist in Postgres before any rule reads them (D12, D14)

- [X] T040 [P] Write tests in `test/pagina.test.mjs` for `h1(html)` (D14):
  - the first `<h1>` wins over a second one;
  - nested tags are stripped and entities decoded (`Fita Gomada &amp; Kraft` → `Fita Gomada & Kraft`);
  - an `<h1>` inside `<script>` or `<style>` is ignored (run over `semScriptNemStyle`, `lib/pagina.mjs:31`);
  - no `<h1>` → `null`, never `""`;
  - `extrair()` returns `h1` next to `titulo`
- [X] T041 Implement `h1(html)` in `lib/pagina.mjs`, next to `titulo()` (line 77), and add `h1` to the `extrair()` return (line 295) and its typedef (line 11)
- [X] T042 [P] In `lib/db.ts` `ensure()`, add exactly the three statements of `data-model.md` "Added by the clarification": `hub_pagina.h1`, `hub_indexacao_url`, `hub_plano.piso_apoio`. Then:
  - `PaginaCrawl` (line 1542) gains `h1: string | null`. `gravarCrawlDePagina` (line 1583) inserts it and `lerCrawlDePagina` (line 1670) selects it;
  - add `gravarIndexacaoPorUrl(projeto, dia, linhas: {url, classe}[])`: DELETE by `(projeto, dia)` plus one multi-row INSERT in one transaction, like `gravarCrawlDePagina`;
  - add `lerIndexacaoPorUrl(projeto)`: the latest verdict of each URL, `Record<url, {classe, dia}>`, via `SELECT DISTINCT ON (url) url, classe, dia … ORDER BY url, dia DESC`, or `null` when there was never a run. It does not return "the latest day", because a day with a partial cota would erase the URLs it skipped (D12, analyze C2);
  - `Plano`, `listPlanos` (line 989), `criarPlano` and `setPremissas` (line 1023) carry `pisoApoio`
- [X] T043 In `app/api/indexacao/route.ts`, right after `inspecionarIndexacao` (line 155), call `gravarIndexacaoPorUrl(f.slug, dia, linhas.map((l) => ({ url: l.url, classe: classificar(l) })))`, importing `classificar` from `lib/indexacao-corrida.mjs:91`. It makes 0 extra inspections. Write only the URLs that were inspected. A day with cota 0 writes nothing and leaves the previous verdicts in place
- [X] T044 In `app/api/paginas/route.ts`, write `extraida.h1` into each `PaginaCrawl` row passed to `gravarCrawlDePagina` (line 241). A page with `extraida === null` writes `h1: null`
- [X] T045 Run `npm test` and `npx next build`. Commit T040–T044 alone with `git commit -- <paths>` and push outside 23:30–01:00 and 08:00–08:45 BRT. Then trigger one `POST /api/indexacao` by hand, the way the workflow does, and check that every Tape Pro sitemap URL has a verdict in `lerIndexacaoPorUrl("tapepro")`, adding up the days (quickstart §5). If one is missing, record that day's cota for `tapepro` (from the route's JSON response): the URL is past the cota, and that is a budget finding (D12). No screen changes in this slice

**Checkpoint**: the verdict and the H1 are stored. Nothing on screen changed yet

### 8.2 Pure logic with tests (US1 + US2): the Tape Pro promise drops

**Goal**: an existing page counts only when `ativa`, a page counts only the terms its title or H1 cover, and a non-`ativa` page becomes a week-1 task

**Independent Test**: `node --test test/plano.test.mjs` passes the SC-008 case: the Tape Pro scenario of 28/09 has a non-empty week 1, the 2 existing pages without a marca count no term, and no demand meta reaches 100%

#### Tests

- [X] T046 [P] [US1] In `test/plano.test.mjs`, extend the `lerPlano` tests: `pisoApoio` must be an integer from 1 to 100000; `0`, `1.5`, `"abc"` and `100001` → `null`; a missing `pisoApoio` → the default 100
- [X] T047 [P] [US1] Write tests for `estadoDaPagina(url, {classes, impressoes})`, where `classes` has the shape `lerIndexacaoPorUrl` returns (`Record<url, {classe, dia}>`). One test per row of the D13 table:
  - `indexada` + ≥ 1 impression → `ativa`;
  - `indexada` + absent from a complete reading → `indexada-sem-impressao`;
  - `rastreada_nao_indexada`, `descoberta_nao_indexada` or `outra` → `fora-do-indice`, whatever the impressions;
  - `falha`, a missing URL or `classes === null` → `sem-leitura`, never `fora-do-indice`;
  - `indexada` + a failed or `truncado` impression reading → `sem-leitura`.

  Also the path match: decoded, no trailing slash, only the project's own hosts. `/pt-BR/x` does not lend its impressions to `/x`
- [X] T048 [P] [US1] Write tests for `cobreTermo(termo, texto)` (quickstart §1):
  - "fita gomada kraft" is covered by "Fita Gomada Kraft 70mm", and by "Kraft Fita Gomada" (any order, no accents, no case);
  - it is not covered by "Fita Gomada";
  - `fitas` ≠ `fita`, and `para` counts;
  - `null` text → `false`.

  Then extend the `cobrir` tests: a term is covered when the title covers it **or** the H1 covers it, each alone. Half the words in the title and half in the H1 → not covered. Each term gets `cobertoPor` (URL or `null`), and each cluster gets `estadoDaPagina`
- [X] T049 [P] [US1] Extend the `agendaDePaginas` tests (FR-005a):
  - an uncovered cluster term with volume ≥ `pisoApoio` → one `apoio-termo` whose `cobre` is the term;
  - below the floor → nothing;
  - a term already covered by an existing page (in any state) or by a page earlier in the queue → nothing;
  - a term the owner excluded never enters;
  - the seed of a cluster whose existing page (found by path) lacks the seed in its title and H1 → **no** `apoio-termo`. `montar` emits a week-1 `titulo` task with that URL as target instead (FR-005a exception, D14, analyze U2);
  - order: cluster pages first, then `apoio-segmento` and `apoio-termo` together by volume, at most `capacidade` per week
- [X] T050 [P] [US1] Extend the `propor` tests (D14, D15):
  - a demand meta counts a term only once its covering page is mature, and a term covered by several pages takes the earliest maturity;
  - an existing non-`ativa` page with no marca counts in no meta and no deadline;
  - the `conta` lists, per page, the terms it covers and their volume (FR-007b);
  - an `ativa` page still counts as created in week 0
- [X] T051 [P] [US2] Extend the `montar` tests (D15):
  - `fora-do-indice`, or `sem-leitura` with a verdict that is not `indexada` → week-1 `indexacao` with the URL as a target;
  - `sem-leitura` with an `indexada` verdict (only the impression reading failed or was truncated) → **no** task, the first-line aviso names the failed reading, and the page enters no milestone (D15, analyze U1);
  - `indexada-sem-impressao` → week-1 `links`, `frescor` and `backlinks`. The test derives this list from `ALAVANCAS` (`degrau === "posicao"`, minus `cobertura` and `marca`), not a literal;
  - two non-`ativa` pages → one task per lever with both URLs (054 FR-009);
  - no marca → the page enters no milestone;
  - a marca `marcado` in week 3 → the page matures at week 3 + `semanasAteEstabilizar`
- [X] T052 [US2] Write the SC-008 test in `test/plano.test.mjs`. The scenario is Tape Pro on 28/09:
  - the 70 frozen terms from `data/demanda-estimada.json`;
  - 2 cluster pages, 0 impressions, no marca;
  - the pages' title and H1 are read **once** from the live HTML of the 2 URLs, through `titulo()` and `h1()` (T041), and pasted into the fixture as literals. Never invent them. The test makes no network call and does not depend on T004 or the daily crawl (analyze D1).

  Assert (analyze A1):
  - week 1 is not empty;
  - the 2 existing pages add **0** terms to every milestone and every meta, because they have no marca (FR-007a);
  - the 180-day `pagina1` meta is ≤ the terms covered by the labels of the support pages scheduled up to week `SEMANAS − semanasAteEstabilizar`;
  - that meta is < 100%.

  Run it against the current `lib/plano.mjs` first and see it fail

#### Implementation

- [X] T053 [US1] In `lib/plano.mjs`, add `pisoApoio: 100` to `PREMISSAS_PADRAO` (line 30) and accept it in `lerPlano` (line 589) as an integer from 1 to 100000
- [X] T054 [US1] Implement `estadoDaPagina(url, {classes, impressoes})` in `lib/plano.mjs`, following the D13 table
- [X] T055 [US1] Implement `cobreTermo(termo, texto)` over `normalizar` (line 90), and change `cobrir` (line 199) to fill `cobertoPor` per term from title or H1. Take the page state as an input to `cobrir`, not a lookup inside it
- [X] T056 [US1] In `agendaDePaginas` (line 228), add the `apoio-termo` branch behind `pisoApoio`, and give each `PaginaAgendada` its `cobre` words (seed, seed + segment, or the term), as in `data-model.md`. Change `entrega` (line 253) from "terms of mature clusters" to "terms whose covering page is mature". Put the creation-week rule of D15 (first marca `marcado ≥ inicio` on any of the page's levers, else `Infinity`) in one helper that both `propor` and `montar` call, so the two cannot disagree. The seed of a cluster that already has a page never becomes an `apoio-termo` (FR-005a exception). `agendaDePaginas` returns it as a `titulo` candidate for `montar` (T057)
- [X] T057 [US2] `propor` (line 303) and `montar` (line 372) receive `marcas`. `montar` emits the D15 week-1 tasks, plus the week-1 `titulo` task for a seed missing from its existing page's title and H1 (FR-005a exception), merged with the calendar's own week-1 tasks by lever. Run T046–T052: all green

**Checkpoint**: the math no longer promises what the pages cannot deliver. No screen changed yet

### 8.3 Screens (US1, US2, US3)

- [X] T058 [US1] Invoke `ux-writing` and `accessibility` before writing any string. Settle the copy for: the 4 page states, the `sem-leitura` reasons, "H1 não lido nesta corrida", the support-page candidate mark, the `pisoApoio` label, the week row's pointer line to the map (D16) and the `origem` "disparada pelo mapa". No state by color alone (FR-020), and no "ok", ✓ or "dentro" (055 glossary)
- [X] T059 [US1] In `app/gsc/mapa/[slug]/plano/dados.ts`, `dadosDoPlano(slug, partida, {soAtivo, paginas})`:
  - read `lerIndexacaoPorUrl(slug)` together with the existing `Promise.all` (line 33);
  - take the page impressions from the `paginas` option (the `gscPaginas` result, or its error/truncation);
  - compute each covering page's state with `estadoDaPagina`;
  - pass `marcas` (already read) and `pisoApoio` from the plan version into `propor` (line 55) and `montar` (line 66)
- [X] T060 [US1] In `app/gsc/mapa/[slug]/plano/page.tsx`, read `gscPaginas(hosts, janela)` next to `gscTermos` (line 70), in parallel, and pass it into `dadosDoPlano`. Render the ui.md delta in block 2, Demanda:
  - each covering page with its state in text;
  - its covered terms and volume;
  - the uncovered terms, with support-page candidates marked;
  - "H1 não lido nesta corrida" when the latest crawl has no `h1`.

  A failed or truncated impression reading goes in block 1, the first line, with the reason
- [X] T061 [US1] In `app/gsc/mapa/[slug]/plano/actions.ts`, `criarVersao` and `salvarPremissas` (line 31) read `pisoApoio` through `lerPlano`. In `plano/page.tsx`, block 4 (Premissas) gets the `pisoApoio` field in the same form, with the seal "◇ política do dono, sem fonte"
- [X] T062 [US2] In `plano/page.tsx`, block 5 (Calendário): week 1 shows the D15 tasks with their URLs. The current week's row ends with the pointer line to the map's block (`/gsc/mapa/[slug]#mapa-plano-h`), with no count. No week reads "nada a fazer"
- [X] T063 [P] [US3] Write tests in `test/plano.test.mjs` for `semanaComCards(semana, entradas)` (D16, quickstart §1):
  - an entry and a calendar task with the same lever → one task, the union of targets and KPIs, `origem: ["calendario", "mapa"]`;
  - a card-only lever → appended in 054 order (degrau, then lever), `origem: ["mapa"]`;
  - an `aguardando` entry stays out, and a `voltou` entry enters;
  - `semana` is not mutated
- [X] T064 [US3] Implement `semanaComCards` in `lib/plano.mjs`. It copies no 054 rule or text: it takes the `plano()` entries as they are
- [X] T065 [US3] In `app/gsc/mapa/[slug]/page.tsx`:
  - pass the `paginasGsc` it already reads (line 775) into `dadosDoPlano` (line 2179). That adds 0 reads;
  - the "Plano · semana N de M" block (line 2492) renders `semanaComCards(semanaAtual, entradas)`, where `entradas` are the `acoes.degraus` entries (line 2171) whose `apresentacao` is `ativa` or `voltou`;
  - a card-only task shows its origin in text;
  - the separate `voltou` set (line 2194) is removed if `semanaComCards` now covers "ainda dispara"; otherwise it stays

**Checkpoint**: `/plano` shows state and coverage, and the map's week shows calendar and cards as one list

### 8.4 Polish and production

- [X] T066 Grep `lib/plano.mjs` and `app/gsc/mapa/[slug]/plano/` for `tapepro`, `atma` and `sirius`: zero hits (FR-019). The only new number in `lib/plano.mjs` is `PREMISSAS_PADRAO.pisoApoio`
- [X] T067 Run `npm test` and `npx next build`. Commit 8.2 + 8.3 with `git commit -- <paths>`, push outside the windows, and poll the screen twice for the new text. A 200 is not proof
- [ ] T068 Quickstart §5 in production, after the next daily crawl fills `hub_pagina.h1`:
  - `/gsc/mapa/tapepro/plano`: the two product pages show their state, week 1 is not empty, the 90-day `top20` meta counts only what `ativa` pages cover by title or H1, and the demand `conta` lists terms and volume per page;
  - `/gsc/mapa/tapepro`: the week block shows the map's cards with their origin, one task per lever.

  Then check `/gsc/mapa/atma/plano` and `/gsc/mapa/sirius/plano` still return 200 with no project-specific text
- [X] T069 Invoke `ui-verification` on `/gsc/mapa/tapepro/plano` and `/gsc/mapa/tapepro`: 3 widths, a keyboard pass through the Premissas form, the accessibility tree (every page state and task origin in text), a clean console, and no DataForSEO request (SC-005)
- [X] T070 Existing plans (plan §6.4, no code). If any version is `ativo`, it stays `ativo`, and `naoCabe` lists each approved meta the new math no longer reaches. Redoing the proposal is a new version that Jean decides (FR-017), never automatic. **T037 waits for this phase**: Jean approves Tape Pro's metas on the new math, not on the 100% promise

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T007)** → stories.
- **T004** needs a deploy plus a run of the three collectors. It can run while US1 is being coded.
- **US1** depends on Foundational. **T017** (real spend) needs T014–T016 and T002.
- **US2** depends on US1: approved metas and `agendaDePaginas`.
- **US3** depends on US2: an `ativo` version and `montar`.
- **US4** depends on US1 + US2.
- **Polish** comes last. T038 is a date, not a task that can run now.
- **Phase 8** (clarification): 8.1 → deploy + one manual indexing run (T045) → 8.2 → 8.3 → 8.4.
  - 8.2 can be coded while T045 waits for the deploy, because it is pure and needs no data. T052
    needs only T041 (`h1()`, to read the 2 live pages once), not T004 or the crawl.
  - T052 (SC-008) is written before T053–T057 and must fail first.
  - T065 needs T064. T059 is needed by T060–T062 and T065.
  - **T037 and T038 move after Phase 8** (T070). T039 (`speckit-analyze`) runs last, over Phase 8 too.

Inside each story: tests → pure functions → script/DB → screen → actions.

## Parallel Opportunities

- T002 ∥ T001. T005 ∥ T007 (different files).
- US1: T008, T009 and T010 are all in `test/plano.test.mjs`. They can be written in one sitting, but they are not parallel across agents. T018 (map page) ∥ T011–T016.
- US2: T022 ∥ T023 (same file, independent `describe` blocks).
- The script (T014–T016) ∥ the pure functions (T011–T013), except that the script imports `agrupar` from T011.
- Phase 8.1: T040 ∥ T042 (different files). T043 and T044 need T042.
- Phase 8.2: T046–T051 are all in `test/plano.test.mjs`, one sitting, independent `describe` blocks.
  T063 can join that sitting.
- Phase 8.3: T058 (copy) ∥ T059 (data). T060–T062 share `plano/page.tsx`, so they are sequential.

## Implementation Strategy

**MVP = Foundational + US1**: Tape Pro has a map, the demand is frozen and the metas are approved. Stop here and validate. The demand number alone answers "is there a niche?" before any page is written.

Then US2 (the calendar, the actual ask), US3 (weekly comparison, which needs one week of the `ativo` plan) and US4 (verification on Atma and Sirius).

## Implementation notes (2026-09-28)

- **T017 finding, curated with Jean**: 79 terms returned (US$ 0.09 per run, two runs). 71 kept, 17,030
  searches/month in Brazil, and 99% of it is the `fita-gomada` cluster (12,100 on the head term alone).
  Google Ads returns close variants with the SAME volume (`fitagomada`, `fitas gomadas` = 12,100 each):
  summing them triple-counts one search, so they were excluded with that reason. `fita transparente
  personalizada` has 170/month across 4 terms; `fita transparente comum` is below the reported minimum.
- **Design finding (D2/D8, for a speckit-clarify round)**: no term carries a segment, so no support page
  is ever scheduled, and D2 counts a whole cluster once its single page stabilizes. With one cluster
  holding 66 terms, the proposal promises 100% of the inventory on page 1 at 180 days from 2 new pages.
  The math follows the spec; the spec over-promises for a one-cluster niche. Candidate fix: sub-clusters
  by modifier (`com reforço`, `personalizada`, `kraft`…) as support pages, or maturity per term, not per
  cluster.
- **US4 (T034)**: Atma's plan `top20` starting point equals the map's leaf (35%, 254 of 725, same day and
  window). Sirius has no frozen demand (050 never estimated it), so its plan shows only the 29 rule
  metas; Atma declares no seeds, so its demand metas are 0 with the first-line warning.
- **Production 11:12 BRT**: 6 routes 200 at 1440/768/360, no horizontal scroll, clean console, zero requests to any other host (SC-005). T004 waits for the collectors on tapepro; T037 for Jean (after the D2 finding); T038 a week after activation; T039 analyze.


## Implementation notes, Phase 8 (2026-09-28)

- **8.1** `a14c3df`, **8.2 + 8.3** `e527062`. T046/T053 (`lerPlano.pisoApoio`) moved into the 8.1 commit:
  `NovoPlano` gained `pisoApoio`, and the build needs `lerPlano` to return it.
- **T045**: manual `POST /api/indexacao` at 12:47 BRT. Tape Pro: 23 of 23 sitemap URLs inspected, **0
  indexed** (18 crawled-not-indexed, 1 discovered, 4 other). `hub_indexacao_url` holds 23 Tape Pro, 113
  Sirius and 25 Atma rows. The two product pages read "fora do índice", and week 1 carries `indexacao`.
- **SC-008** with the frozen demand and the live titles of 28/09: `top20`@90 drops from 100% to **0%**,
  `pagina1`@180 to **14.3%** (10 of 70 terms), week 1 has 6 levers. The test failed first on the old
  module (missing exports), then passed.
- **Finding for Jean (D14 as written, not changed)**: a planned page covers every term whose words are
  a subset of its label. «fita gomada personalizada» therefore also covers the head term «fita gomada»
  (12,100/month), and because the existing product page counts nothing without a marca, the planned page
  wins as the earliest. That puts `tamBusca`@180 at 87.8% while `pagina1` is 14.3%. Two pages would be
  credited with the same head term; if that reads as cannibalization, it is a new clarification (e.g. a
  planned page covers only its own term), not an implementation choice.
- `ATE_PAGINAS = 6` in `lib/plano.mjs` is a display cap that keeps the `conta` under the 2,000 characters
  `lerDecisao` accepts, not a rule.
- **T070**: `hub_plano` is empty in production (no version was ever created), so there is nothing to
  migrate. T037 runs directly on the new math.
- **T068 open**: the H1 fills with the next daily crawl ("H1 não lido nesta corrida" until then), and
  the merged week on the map needs an `ativo` version (T037). Atma and Sirius `/plano`: 200, no other
  project's text.
- **T069**: both routes at 1440/768/360 with no horizontal scroll, keyboard order through Premissas
  (início → capacidade → indexar → estabilizar → piso → quem → Criar), visible focus, 0 unnamed
  buttons/links, clean console, no request outside `hub.roilabs.com.br` (SC-005). Not verified: a real
  screen reader, and the map's merged week (no active plan).
