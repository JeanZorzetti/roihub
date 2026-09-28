---

description: "Task list for 057 — Plano de SEO por projeto"
---

# Tasks: Plano de SEO por projeto

**Input**: Design documents from `specs/057-plano-seo/`

**Prerequisites**: plan.md, spec.md, research.md (D1–D10), data-model.md, contracts/, quickstart.md

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

- [ ] T001 Create `test/plano.test.mjs` with one `node:test` import and register it in the `"test"` list in `package.json`, in the same commit (Principle II; `test/validade.test.mjs` fails otherwise)
- [ ] T002 [P] Copy `DATAFORSEO_API_KEY` from `ROI Labs/open-seo/.env` to `roihub/.env`. Confirm with `grep -c DATAFORSEO_API_KEY`, never `cat` or `diff`. Confirm `.env` is in `.gitignore`

---

## Phase 2: Foundational (blocks every story)

**Purpose**: Tape Pro gets a map (FR-001, SC-001). The plan also needs the version tables and the pure validators

- [ ] T003 Add `"tapepro"` to `SLUGS_DE_BUSCA` in `lib/projects.ts:127`. Fix the stale "hoje, a Atma" comments in `app/api/gsc-serie/route.ts:37` and `app/api/indexacao/route.ts:70` so they name the list instead of a project
- [ ] T004 Run `npm test`, commit T003 alone, and push outside the windows. After the next `/api/gsc-serie`, `/api/indexacao` and `/api/paginas` runs, open `/gsc/mapa/tapepro`: it must return 200 with 32 leaves, each in one of the 5 states (SC-001). Confirm the indexing run's duration stays under `maxDuration` (about +2.5 min for 23 URLs, D9)
- [ ] T005 [P] Write tests in `test/plano.test.mjs` for `lerDecisao` and `lerPlano`. They must reject: a `responsavel` other than `jean`/`maria`; a `chave` that is not a `CATALOGO` key (`lib/gsc-delta.mjs:291`) or `cliques`/`impressoes`; a `prazo` other than 90/180; a non-finite `valor`; `capacidade` outside the integers 0–20; premises outside the integers 0–26
- [ ] T006 Implement `lerDecisao` and `lerPlano` in the new pure `lib/plano.mjs`, following `lerMarca` (`lib/proxima-acao.mjs:241`). Bad input returns `null` and writes nothing
- [ ] T007 [P] In `lib/db.ts`, add `hub_plano` and `hub_plano_meta` to `ensure()` next to `hub_mapa_marca` (line 184), exactly as in `data-model.md` §2. Values stay TEXT, not jsonb. Add:
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

- [ ] T008 [P] [US1] Write tests in `test/plano.test.mjs` for `normalizar` (lowercase, no accents, hyphen → space) and `agrupar` (D4, FR-005):
  - "fita gomada preço" → `fita gomada`;
  - "fita gomada para e-commerce" → `fita gomada` with segment `e-commerce`;
  - a term with two product seeds → the longer seed;
  - a term with no seed → `semCluster`;
  - the same input twice → the same output
- [ ] T009 [P] [US1] Write tests in `test/plano.test.mjs` for `cobrir(clusters, crawl)` (D7): a crawl URL whose path contains the normalized seed as a segment sequence (`/produtos/fita-gomada`), or whose title contains the seed, covers the cluster. Otherwise `pagina` is `null`
- [ ] T010 [P] [US1] Write tests in `test/plano.test.mjs` for `propor` (D1, D2, FR-006, FR-007):
  - every `REGRAS` leaf (`lib/proxima-acao.mjs:74`) gets meta = `REGRAS[k].limiar` and origin = the leaf's own seal;
  - `checklistGsc` is absent;
  - `top20` at 90 d, `strikingDistance` at 180 d and `tamBusca` at 180 d follow the D2 math and count a cluster only after `criadaNaSemana + semanasAteEstabilizar`;
  - the 180-day headline cliques equal mature volume × `benchmark(7)`, imported from `lib/kpis-busca.mjs`;
  - the 90-day cliques and impressões are absent with a reason, never 0;
  - `crescimentoNaoMarca` and `consultasUnicas` carry the "base zero" aviso;
  - a term flagged "volume abaixo do mínimo reportado" does not add to any meta;
  - the `conta` text names volume, target position, fraction and deadline

### Implementation for US1

- [ ] T011 [US1] Implement `normalizar` and `agrupar(termos, {produtos, segmentos})` in `lib/plano.mjs`
- [ ] T012 [US1] Implement `cobrir(clusters, crawl)` in `lib/plano.mjs`
- [ ] T013 [US1] Implement `agendaDePaginas(clusters, {capacidade, inicio})` and `propor(clusters, {premissas, inicio})` in `lib/plano.mjs`:
  - `agendaDePaginas` orders uncovered cluster pages by volume, then support pages (cluster × segment ≥ piso), at most `capacidade` per week. It returns the creation week of each page, and `montar` (US2) reuses it, so the two cannot disagree;
  - `propor` imports `REGRAS` and `benchmark` and declares no limiar of its own (FR-002 of 054)
- [ ] T014 [US1] Create `scripts/consultar-demanda.mjs` in no-flag mode (`contracts/consultar-demanda.md`):
  - `DATAFORSEO_API_KEY` missing or blank → exit 2, naming only the variable;
  - seeds are the slug's `produtos` from `lib/autopublish-projects.mjs`, hyphens → spaces, overridable with `--sementes`;
  - region comes from `areaServed` (`BR` → `Brazil`), overridable with `--regiao`; language is `pt`;
  - it prints the balance from `GET /v3/appendix/user_data` and the estimated cost;
  - if the balance is below the cost, it exits and says how much is missing (FR-003a)
- [ ] T015 [US1] Add `--consultar` to `scripts/consultar-demanda.mjs`:
  - one `POST` to Google Ads `keywords_for_keywords/live`;
  - any API error or partial response writes nothing;
  - drop terms below `piso` 10 and brand terms (`regexDeMarca`, `lib/marca.mjs:37`), and print the drop counts;
  - a seed with null volume stays as "volume abaixo do mínimo reportado";
  - run `agrupar`, then apply `--mover "termo=semente"` and `--excluir "termo:motivo"`;
  - print the actual `cost`, the clusters with volume and `semCluster`
- [ ] T016 [US1] Add `--gravar` to `scripts/consultar-demanda.mjs`. It builds the `tapepro` entries of `data/inventario-de-termos.json` and `data/demanda-estimada.json` as in `data-model.md` §1 (`fonte`, `regiao`, `idioma`, `custoUsd`, `sementes`, `movidos`, `excluidos`). It runs `validarInventario` (`lib/inventario.mjs:43`) before touching disk, then prints the paths written
- [ ] T017 [US1] Real run with Jean:
  - no flag, then `--consultar` (`git status` stays clean);
  - curate consumer-intent terms with `--excluir` and misplaced ones with `--mover`;
  - `--consultar --gravar`;
  - `npm test` green;
  - commit the two JSON files.

  If the niche turns out tiny, record it as a finding (plan Risks), not a bug
- [ ] T018 [P] [US1] In `app/gsc/mapa/[slug]/page.tsx`, the TAM ressalva says "estimativa, teto" only when `procedencia.fonte` is the GSC impression floor. For DataForSEO it names the source and the consultation date. Confirm Top 20, Top 3 penetration and TAM for `tapepro` no longer say "inventário de termos não declarado"
- [ ] T019 [US1] Invoke the `information-design`, `accessibility` and `ux-writing` skills (D10) before writing the screen. Fix the copy of the aviso, the seals, the meta states and the form buttons
- [ ] T020 [US1] Create `app/gsc/mapa/[slug]/plano/page.tsx`, a server component that returns 404 when the slug is not in `SLUGS_DE_BUSCA`. It reads the frozen JSON, `lerCrawlDePagina` (`lib/db.ts:1508`), `listPlanos` and `listMetas`. It makes no GSC or DataForSEO call (SC-005). It renders these blocks from `contracts/ui.md`:
  - 1, the "no frozen demand" aviso naming the command;
  - 2, Demanda, read-only, naming `--mover`/`--excluir`;
  - 3, Metas, grouped under the 18 KPIs, headlines first, each row with seal, `conta`, state and the approve/edit/refuse form with `responsavel`;
  - 6, Versões.

  An edited meta below the starting point is accepted with the "já atingida" aviso when a starting point exists (see T034)
- [ ] T021 [US1] Create `app/gsc/mapa/[slug]/plano/actions.ts` with `criarVersao` and `decidirMeta`. Both validate with `lerPlano`/`lerDecisao`, return without writing on bad input, and call `revalidatePath` on `/gsc/mapa/[slug]` and `/gsc/mapa/[slug]/plano`. `decidirMeta` stores the proposed value, final value, state, author and date (FR-009)

**Checkpoint**: US1 works alone. Demand, metas and decisions are on screen and in `hub_plano_meta`

---

## Phase 4: User Story 2 — Ler o plano semana a semana (P1)

**Goal**: with approved metas, a weekly calendar bounded by capacity. Each task has alavanca, target, responsible and milestone

**Independent Test**: open `/gsc/mapa/tapepro/plano` and, without clicking, read the current week's task, its responsible and the expected milestone

**Depends on**: US1 (`agendaDePaginas`, approved metas)

### Tests for US2

- [ ] T022 [P] [US2] Write tests in `test/plano.test.mjs` for `montar` (D8):
  - no week has more `cobertura` than `capacidade` (SC-004);
  - no `links`, `titulo` or `schema` comes before its page's week (FR-012);
  - `indexacao` lands at `+semanasAteIndexar`;
  - a covered cluster (including a page created outside the plan) emits no `cobertura`;
  - the same alavanca in the same week is one task with every target and KPI (054 FR-009);
  - `capacidade 0` → first-line aviso and no coverage milestone (FR-018);
  - a deadline that does not fit → "não cabe no prazo com esta capacidade" for that meta;
  - only `ALAVANCAS` keys from `lib/proxima-acao.mjs:33` appear (FR-011)
- [ ] T023 [P] [US2] Write tests in `test/plano.test.mjs` for `feita`: a task is done when the 055 marca for its alavanca has `marcado` ≥ the week start. Earlier or absent → not done

### Implementation for US2

- [ ] T024 [US2] Implement `montar({inicio, capacidade, semanasAteIndexar, semanasAteEstabilizar, clusters, responsavel})` in `lib/plano.mjs`. It reuses `agendaDePaginas`, orders tasks by `DEGRAUS`, and fills each week's `marcos` for `top20`, `strikingDistance`, `tamBusca` and the headline cliques
- [ ] T025 [US2] Implement `feita(tarefa, semana, marcas)` in `lib/plano.mjs`, taking marcas from `listMarcas` (`lib/db.ts:902`). No new mechanism (FR-016)
- [ ] T026 [US2] Add `salvarPremissas` and `ativar` to `app/gsc/mapa/[slug]/plano/actions.ts`. `ativar` refuses while any meta has no decision. After `ativo`, a change requires `criarVersao` (FR-017)
- [ ] T027 [US2] In `app/gsc/mapa/[slug]/plano/page.tsx`, add:
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

- [ ] T028 [P] [US3] Write tests in `test/plano.test.mjs` for `comparar(marcos, leituras, semana)` (FR-015):
  - a milestone in the future → `nao-chegou`;
  - a reading `{ausente}` → `sem-leitura` with the map's motivo, never `no-marco`;
  - `no-marco`, `abaixo` and `acima` at the edges;
  - no state label contains "ok", "✓" or "dentro" (055 glossary);
  - `abaixo` for two consecutive weeks, when a previous reading is passed → `sugerirRefazer: true`, and the meta is not changed

### Implementation for US3

- [ ] T029 [US3] Implement `comparar` in `lib/plano.mjs`
- [ ] T030 [US3] In `app/gsc/mapa/[slug]/page.tsx`, add the "Plano · semana N de M" block right after "O que fazer primeiro" (around line 2334). It shows only with an `ativo` plan and links to `/plano`. It contains:
  - this week's tasks with their 055 marca;
  - the demand leaves' milestone vs. the page's existing `leituras`, with glyph + text;
  - one line pointing to "O que fazer primeiro" for the REGRAS leaves;
  - a task marked done whose reler date passed and whose rule still fires, shown as "ainda dispara" (reuse `plano()` from `lib/proxima-acao.mjs:268`);
  - the capacity suggestion when `indexacaoLimpa` of the plan's pages is above 90% (FR-010), never changing it.

  No new external request

**Checkpoint**: SC-007 is readable on the first weekly comparison after activation

---

## Phase 6: User Story 4 — Plano para qualquer projeto com mapa (P3)

**Goal**: the same route serves Atma and Sirius (FR-019)

**Independent Test**: open `/gsc/mapa/sirius/plano` and see the metas starting from today's reading

- [ ] T031 [US4] Grep `lib/plano.mjs` and `app/gsc/mapa/[slug]/plano/` for `tapepro`, `atma` and `sirius`. There must be zero hits, because no rule is written per project (FR-019)
- [ ] T032 [US4] Run `scripts/consultar-demanda.mjs` in no-flag mode for `atma` and `sirius`. For both, the script must refuse `--gravar` without overwriting their existing GSC-floor inventory unless `--sementes` is given. Decide with Jean before spending
- [ ] T033 [US4] Open `/gsc/mapa/atma/plano` and `/gsc/mapa/sirius/plano`: 200, blocks render, with no Tape-Pro-specific text
- [ ] T034 [US4] ⚠️ Gap to settle in `speckit-analyze`: US4 AC1 and the edge case "meta editada abaixo do ponto de partida" need the current reading on the plan page. D6 keeps the readings only on the map, which reads GSC live. Options:
  - (a) show the starting point only in the map's plan block;
  - (b) the plan page reads the last stored series from the DB, not GSC.

  Implement the chosen one in `lib/plano.mjs` (`propor` receives `pontoDePartida`) with a test in `test/plano.test.mjs`

---

## Phase 7: Polish & Cross-Cutting

- [ ] T035 Run `npm test` (all green, `test/plano.test.mjs` included) and `npx next build`. Commit with `git commit -- <paths>` and push outside 23:30–01:00 and 08:00–08:45 BRT. Poll the screen for new text twice; a 200 is not proof
- [ ] T036 Invoke `ui-verification` on `/gsc/mapa/tapepro/plano` and `/gsc/mapa/tapepro`: 3 widths, a keyboard pass through every form, the accessibility tree (no state by color alone, FR-020), a clean console, and the network tab with no DataForSEO or Google request (SC-005)
- [ ] T037 Quickstart §4 in production: approve every meta as Jean and activate. Check that `hub_plano_meta` has `decidido_por = 'jean'` on every row, and that editing an approved meta asks for a new version (SC-006). The map must show "Plano · semana 1 de 26" with the demand milestones as `nao-chegou`
- [ ] T038 Schedule a re-read one week after activation for SC-007: 100% of Tape Pro's due milestones in one of the 5 states
- [ ] T039 Run `speckit-analyze` on `specs/057-plano-seo/` (settles T034)

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T007)** → stories.
- **T004** needs a deploy plus a run of the three collectors. It can run while US1 is being coded.
- **US1** depends on Foundational. **T017** (real spend) needs T014–T016 and T002.
- **US2** depends on US1: approved metas and `agendaDePaginas`.
- **US3** depends on US2: an `ativo` version and `montar`.
- **US4** depends on US1 + US2. T034 waits for the analyze decision.
- **Polish** comes last. T038 is a date, not a task that can run now.

Inside each story: tests → pure functions → script/DB → screen → actions.

## Parallel Opportunities

- T002 ∥ T001. T005 ∥ T007 (different files).
- US1: T008, T009 and T010 are all in `test/plano.test.mjs`. They can be written in one sitting, but they are not parallel across agents. T018 (map page) ∥ T011–T016.
- US2: T022 ∥ T023 (same file, independent `describe` blocks).
- The script (T014–T016) ∥ the pure functions (T011–T013), except that the script imports `agrupar` from T011.

## Implementation Strategy

**MVP = Foundational + US1**: Tape Pro has a map, the demand is frozen and the metas are approved. Stop here and validate. The demand number alone answers "is there a niche?" before any page is written.

Then US2 (the calendar, the actual ask), US3 (weekly comparison, which needs one week of the `ativo` plan) and US4 (verification plus the T034 gap).
