# Implementation Plan: the plan only speaks of the future

**Branch**: `058-plano-so-futuro` (work on `main`, like 054–057) | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/058-plano-so-futuro/spec.md`

## Summary

`/gsc/mapa/[slug]/plano` becomes future-only. Three things leave the plan for the map's plan block:
- the starting point and distance of the metas;
- the page states;
- the marks.

Two things leave the screen and stay in the database: the decision authors and the old versions.

On top of that, the plan gains three things:

1. **The core (núcleo)**: per cluster, the intent, answering page, questions, entities and next task.
   It is stored per project and seed, so it survives versions.
2. **One backlog**: every future task (planned pages, 057 D15 page tasks, the map's cards, questions)
   as lever + target.
   - Impact is projected clicks/month, and effort is hours.
   - The order is impact ÷ effort, with the 054 step order kept inside each target.
   - It is scheduled on hours per person per week (clarify Q1), from the current week.
   - The metas read page-creation weeks from that schedule.
3. **The OKR line**: the 180-day clicks next to the goal tree's requirement.

The map's cards reach the plan through a snapshot the map writes when it opens (research D3).

## Technical Context

**Language/Version**: TypeScript (Next.js 16 App Router, React 19) at the edge; pure `.mjs` for logic.
Node 22.

**Primary Dependencies**: none new (`pg`, `next`).

**Storage**: Postgres. All tables are `IF NOT EXISTS` in `ensure()` ([data-model.md](data-model.md)):
- new: `hub_nucleo`, `hub_nucleo_item`, `hub_plano_tarefa`, `hub_mapa_disparo`;
- `hub_plano`: + `horas`, + `esforco`, − `capacidade` (0 rows in production on 28/09).

**Testing**: `node --test`:
- `test/plano.test.mjs` (existing, registered) for the core and the metas;
- new `test/backlog.test.mjs`, registered in `package.json` in the same commit.

**Target Platform**: EasyPanel Docker (Linux).

**Project Type**: web app (single Next project).

**Performance Goals**:
- `/plano` drops one Search Console read (per term) and keeps one (per page).
- It adds four small DB reads (core, items, task edits, snapshot).
- It adds `dadosDaFicha` only for projects with an OKR meta (today `atma`, ~3.3 s cold, in parallel).
- The map adds one fire-and-forget upsert.
- The scheduler is O(tasks × weeks), with at most a few hundred tasks × 26 weeks: microseconds.

**Constraints**:
- no push between 23:30–01:00 or 08:00–08:45 BRT;
- no new env var;
- no new lever;
- no new 055 mark mechanism (research D5).

**Scale/Scope**: 3 projects with a map. Tens to a few hundred tasks per project.

## Constitution Check

| Principle | Gate | Status |
|---|---|---|
| I. Contrato único de dados | The project meta for the OKR line comes from `listProjects()` / `dadosDaFicha`, never `data/projects.json` | ✅ |
| II. `node --test`, registrado | `test/backlog.test.mjs` is added to the explicit list in the same commit; `validade.test.mjs` enforces it | ✅ |
| III. `.mjs` puro / `.ts` na borda | These are all pure `.mjs`: generating tasks, impact, order, scheduling, the intent proposal, the question proposal, and the `lerNucleo`/`lerItem`/`lerTarefa`/`lerPlano` validation. `.ts` only reads, writes and renders | ✅ |
| IV. Push é deploy | The slices ship outside the two windows. No `maxDuration` change | ✅ |
| V. Ambiente explícito, segredo nunca em log | No new env var; the snapshot holds dispatch keys and paths only | ✅ |
| Stack fixa / sem framework novo | No dependency added | ✅ |

Post-design re-check: still ✅. There are no violations, so there is no Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/058-plano-so-futuro/
├── spec.md
├── plan.md              # this file
├── research.md          # D1–D15
├── data-model.md
├── quickstart.md
├── contracts/ui.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
lib/
├── backlog.mjs                    # NEW: gerarTarefas, impacto, ordenar, agendar (pure)
├── plano.mjs                      # agendaDePaginas loses `semana`; propor/montar take page weeks;
│                                  #   + propostaDeIntencao, perguntasPropostas, aplicarNucleo,
│                                  #   lerNucleo, lerItem, lerTarefa; lerPlano in hours;
│                                  #   PREMISSAS_PADRAO gains horas/esforco; − semanaComCards
├── db.ts                          # + 4 tables, hub_plano columns; list/set functions
app/gsc/mapa/[slug]/
├── page.tsx                       # snapshot upsert; plan block per research D15 (partida,
│                                  #   page states, scheduled week); dadosDoPlano with partida + disparos
└── plano/
    ├── dados.ts                   # the whole pipeline: core → tasks → schedule → metas; snapshot
    │                              #   or in-memory dispatches; OKR line
    ├── page.tsx                   # future-only blocks (contracts/ui.md); − gscTermos read
    └── actions.ts                 # + decidirIntencao, apontarPagina, decidirItem, editarTarefa
test/
├── plano.test.mjs                 # core, metas from scheduled weeks, SC-001 view model
└── backlog.test.mjs               # NEW, registered: SC-004, SC-006, SC-007, SC-007a, D4, D5, D7, D8
```

**Structure Decision**: the backlog is its own pure module. It is a scheduling problem (tasks, hours,
dependencies), separate from the demand math in `plano.mjs`, which imports it. `plano.mjs` stays the
only place that knows clusters and metas, and `backlog.mjs` does not know them. It receives tasks with
impact already attached.

## Order of delivery (independent slices)

1. **Future only (US1)**. It ships alone and changes no computation:
   - remove the present from `/plano`;
   - move partida and page states into the map's plan block (rendered whenever there is demand);
   - drop the `gscTermos` read from `/plano`;
   - start the calendar at the current week, and remove the versions list and the capacity suggestion.
2. **Core (US2)**:
   - the `hub_nucleo` and `hub_nucleo_item` tables;
   - the intent and question proposals, and `aplicarNucleo`;
   - the Núcleo block and its forms.

   It changes no schedule yet. The "next task" reads the 057 calendar until slice 3.
3. **Backlog (US3)**, in this order:
   1. the snapshot table and the map's upsert. Deploy it and open the map, so that the data exists
      before step 4 reads it;
   2. the `hub_plano` hours/effort columns plus `hub_plano_tarefa`;
   3. `backlog.mjs` with its tests;
   4. `plano.mjs` metas from scheduled weeks;
   5. the backlog, week and calendar blocks, the task edit form, and the premises in hours.
4. **OKR (US4)**: the OKR line in `dados.ts` and the metas block.

Before slice 3's step 2, the owner confirms the default efforts and the hours of Jean and Maria
(research D10 table).

## Risks

- **The snapshot is stale** (research D3): the backlog is as fresh as the last map opening, and the
  plan says when that was. The upgrade path is extracting the map's readings into a function.
- **Metas move as weeks pass**, because the schedule starts at the current week. That is correct for a
  future-only plan, and `naoCabe` already flags an approved meta that no longer fits. The owner may
  read it as instability; the `conta` says which weeks the pages land in.
- **Per-lever 055 marks** (057 risk, still open): one `indexacao` mark closes the D15 task of every page
  and starts every page's maturation. A page created after the mark inherits it. The owner re-marks
  after the page exists. A per-target mark would be a new mechanism, which the spec does not allow.
- **Many card targets**: a card with 20 targets makes 20 tasks. That is correct (20 pieces of work),
  but the backlog gets long. Ordering puts the high-impact ones first, and quiet weeks collapse.
- **Owner-declared questions have no impact number** (research D6), so they sort last. That is the
  honest reading until the question has volume. The owner can pin a date to pull one forward.
