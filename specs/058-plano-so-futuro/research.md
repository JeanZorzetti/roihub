# Research: 058 — the plan only speaks of the future

Facts read on 2026-09-28 (code at `9814c7a`, production DB at 15:3x BRT):

- `hub_plano` = 0 rows, `hub_plano_meta` = 0 rows. Tape Pro has one 055 marca: `indexacao`, marked 28/09,
  reler 12/10.
- The map's 32 readings are assembled inline in `app/gsc/mapa/[slug]/page.tsx` (about 1,200 lines,
  lines ~758–1,900), then `avaliar(leituras)` → `plano(disparos, {marcas, hoje})`. No function outside
  the page can produce the fired cards.
- `propor()` uses `partida` only to annotate `{partida, distancia}`. No meta value depends on it.
- Tape Pro frozen demand: 46 terms, none starting with an interrogative word. Intent modifiers: 4 terms
  with "preço" (160 searches/month), all `comercial` under `pagina.mjs#modificadoresDeIntencao`.
- Only `atma` declares an OKR `meta` in `data/projects.json`. Tape Pro is profile B with no meta, so its
  goal tree stops at "sem meta declarada".
- `RESPONSAVEIS` = jean, maria (`lib/agenda.mjs`).

## D1 — What leaves `/plano`, and where it goes

| Today on `/plano` | Tense | Goes to |
|---|---|---|
| "Hoje: X% (janela) · distância até a meta" per demand meta | present | the plan block on the map (D15) |
| Page state per cluster and per covering page | present | the plan block on the map (D15); still an input to scheduling |
| "feito em DD/MM (marca do mapa)" | past | nowhere new: the map already shows marks |
| "aprovada por X em DD/MM" per meta | past | stays in `hub_plano_meta`; the plan shows only the meta's state |
| "Versões" list | past | stays in `hub_plano`; the plan shows the active version and the draft only |
| Weeks before the current one in "Calendário" | past | dropped; the map compares milestones (057 US3) |
| Warning "Estado das páginas sem leitura de impressões: …" | present | rewritten as its consequence: "nenhuma página existente conta nas metas até a próxima leitura" |

Stays: the demand's provenance (source, region, date, cost) and "Esta semana" (the next execution).

## D2 — `/plano` stops reading the Search Console per term

**Decision**: remove the `gscTermos` read from the plan route. The map computes `partida` from the
`termosGsc` it already reads, and passes it to `dadosDoPlano` (D15).
**Rationale**: `partida` only annotated distance (fact above). One external read less (SC-009).
**Kept**: `gscPaginas` on the plan route, because it decides page state, which decides scheduling
(FR-002).

## D3 — How the map's cards reach the plan: a snapshot the map writes

**Decision**: the map, after `avaliar(leituras)`, upserts the fired dispatches (`estado` dispara or
crítica) into `hub_mapa_disparo (projeto PK, lido_em, disparos TEXT)`, fire-and-forget. The plan
reads the latest snapshot and applies the 055 marks itself: a lever with a marca where
`hoje < reler` is dropped (that is `plano()`'s "aguardando"). A lever past `reler` that still fires is
kept (it is "voltou"). The plan prints "cards do mapa lidos em DD/MM HH:mm" as provenance of the input,
like the demand's date.
**Alternatives rejected**:
- Extracting the 1,200 lines of readings into a shared function: the right shape long-term, but it
  is a refactor of the map, not of the plan, and each reading is interleaved with the tree node it
  renders.
- The plan fetching the map over HTTP: couples two routes through HTML.
- Keeping 057 D16 (the plan only points to the map): contradicts FR-020 and the owner's "tarefas
  geradas pelos gaps".
**Ceiling**: the backlog is as fresh as the last map opening. Without a snapshot, the plan says
"as tarefas que o mapa dispara ainda não foram lidas: abra o mapa uma vez". Upgrade path: the
extraction above, if staleness hurts.

## D4 — A task is lever + target, with typed target keys

**Decision**: `chave = alavanca|alvo`, where `alvo` is one of:
- `url:/path` (decoded path, no trailing slash, as `caminhoDe`): an existing page;
- `planejada:«…»`: a planned page's label (`rotuloDaPagina`);
- `termo:«…»`: a term (the strikingDistance cards);
- `*`: a card with no target list (for example `indexacaoLimpa`, which only carries `nAlvos`).

A card becomes one task per target in its first reason that has targets. Annotations like
" (faltam 12 cliques)" are stripped from the key and kept in the label. The same key from two origins
is one task with both origins (FR-021). A `*` card is absorbed (dropped) when the backlog already has a
task of the same lever from another origin, because the concrete tasks are the same work named better.
**Rationale**: the per-target split makes merging trivial (same key = same task) and makes the owner's
edits survive (D13).

## D5 — When a task is done: no new marca mechanism

055 marks are per project and lever. A per-target task cannot have its own 055 marca without a new
mechanism, which 057 FR-016 forbids. Each origin already has a way to end:

| Origin | Ends when |
|---|---|
| Planned page (creation, links, título, schema, indexação) | the page shows up in the crawl: it stops being planned and becomes an existing page (then D15 applies, as in 057) |
| Existing page not `ativa` (057 D15: `indexacao`, or the posição levers) | a 055 marca of that lever made on or after the plan's start (`criacaoDaPagina`, unchanged) |
| Map card | a vigente 055 marca of that lever (D3); it comes back past `reler` if it still fires |
| Question | the owner records in the core that a page answers it (`respondida`) |

**Spec amendment (FR-022, US3 scenario 2)**: a question generates ONE task, lever `cobertura` on its
answering page, whose briefing includes the answer block and its `FAQPage` markup. The separate
`schema` task is dropped. Reasons: a per-question `schema` task could only end through a per-lever
marca, which would close every `schema` task of the project at once. Also, since 2023 the FAQ rich
result shows only for government and health sites (spec Assumptions), so a separate task buys nothing
in the SERP. Marking is still done on the map; the plan only shows the future.

## D6 — Impact: projected clicks per month, per target

**Decision**: `impacto = Σ volume of the terms the target moves × benchmark(7)`: the same CTR floor
and 180-day target position as the 057 click meta. The terms each target moves:

- `url:` → the cluster terms with `cobertoPor` = that page;
- `planejada:` → the terms its label covers (`cobreTermo(termo, cobre)`), as `donos()` counts them;
- `termo:` → that term, if it is in the frozen demand;
- question → the question's own term volume, if it came from a frozen term;
- anything else (`*`, a path covering no term, an owner-declared question) → `null` with the reason.

The `conta` is shown ("fita gomada 12.100 + … = 14.470 buscas/mês × 2,2% = 318 cliques/mês").
Impacts are not summed across tasks: several tasks on one page carry the same terms, and a total would
count them several times.
**Rationale**: FR-024; no new number. Honest `null` beats a guessed weight.

## D7 — Order

1. Sort by `impacto ÷ esforço`, descending. `null` impact goes after every number, in 054 order
   (step, then lever declaration), then by key.
2. Per-target fix-up: the tasks of one target keep the SET of positions they occupy, and are
   reassigned to those positions in dependency order. On a planned target, creation (`cobertura`)
   comes first, then the rest in 054 step order. On an existing target, 054 step order applies (índice →
   desempenho → página → posição → snippet).

This keeps the global ranking and guarantees SC-006 without a topological sort.
**Spec amendment (FR-026)**: "impacto não calculável vai para o fim da lista, na ordem da 054"
replaces "vai para o fim do seu degrau". Degrau is no longer a global tier; it stays the order inside
one target.

## D8 — Scheduling by person-hours

This is a greedy list schedule, deterministic, pure:

- Weeks run from `max(1, semanaAtual)` to `SEMANAS` (26). Past weeks take nothing (FR-005).
- Tasks with a fixed date go first, into their week, if they fit. One that does not fit becomes
  "a fazer" with "a data fixada não cabe: semana DD/MM de {pessoa} já tem X h de Y h".
- The rest go in D7 order, each into the earliest week that satisfies all three conditions:
  - it is no earlier than the week of every dependency (the same week is fine);
  - it is no earlier than its `naoAntes` (a planned page's indexing = creation week +
    `semanasAteIndexar`);
  - the responsible person's remaining hours that week ≥ the task's effort.
- A task whose effort is above the person's weekly hours becomes "a fazer" with "não cabe numa semana de
  {pessoa}: dividir ou trocar o responsável".
- A task past week 26 becomes "a fazer".
- A task whose dependency is not scheduled becomes "bloqueada", and the dependency is named.
- With no hours declared for anyone, nothing is scheduled, and the first line says so (FR-025a).

**Invariant, tested (SC-007a)**: for each person and week, the sum of scheduled efforts ≤ that person's
hours.

## D9 — The metas read page weeks from the schedule

`agendaDePaginas` keeps its queue (which pages, in which order, what each covers) and loses `semana`.
The creation week of each planned page is the week the scheduler gave its `cobertura` task (`null` if
it is "a fazer" or "bloqueada"). `propor` and `montar` receive that map instead of `capacidade`.
`donos`, `entrega`, `valores`, `naoCabe` and the milestones are unchanged. The `conta` text says
"páginas criadas nas semanas que o backlog agenda com X h/semana" instead of "N páginas novas por
semana". Because the schedule starts at the current week, the metas recompute as weeks pass, as 057
already did (`naoCabe` shows an approved meta that no longer fits).

## D10 — Premises in hours

`hub_plano` gains `horas JSONB` (`{"jean": h, "maria": h}`) and `esforco JSONB` (`{alavanca: h,
"pergunta": h}`), and drops `capacidade`. The table has 0 rows in production (fact above), so nothing
migrates. The support-page floor and the two maturation premises stay. `pergunta` is an effort key,
not a lever: a question section is far smaller than a new page, and both are `cobertura`.

**Proposed defaults**: "◇ política do dono, sem fonte". The owner confirms or changes them before
implement.

| Key | Hours | Per |
|---|---|---|
| indexacao | 0.5 | target (`*` = 1 unit) |
| poda | 1 | target |
| profundidade | 0.5 | target |
| vitais | 3 | target |
| canibalizacao | 2 | target |
| intencao | 0.5 | target |
| links | 1 | target |
| cobertura | 4 | target (a new page) |
| pergunta | 1 | question |
| frescor | 1 | target |
| backlinks | 3 | target |
| marca | 2 | target |
| schema | 1 | target |
| titulo | 0.5 | target |
| jean | ? h/week | — |
| maria | ? h/week | — |

## D11 — The core (núcleo): two tables keyed by project and seed

- `hub_nucleo (projeto, semente, intencao, pagina, decidido_por, decidido_em)`, PK `(projeto,
  semente)`. `intencao` ∈ informacional | comercial | ambos, or null (not decided). `pagina` is the
  owner's override of the answering page, or null.
- `hub_nucleo_item (projeto, semente, tipo, texto, detalhe, estado, decidido_por, decidido_em)`, PK
  `(projeto, semente, tipo, texto)`:
  - `tipo` ∈ pergunta | entidade;
  - for an entity, `detalhe` is its kind (produto, material, aplicação, norma, marca própria, outra);
  - for a question, `detalhe` is the page that answers it (null = the cluster's page);
  - `estado` ∈ aceita | removida | respondida (questions); aceita | removida (entities).

The key is the seed, not the cluster object: clusters are regrouped from the frozen demand on every
open, and the seed is what stays stable across versions and consultations (FR-015). A row whose seed
no longer exists is ignored, never deleted.

**Intent proposal**: classify each term with `modificadoresDeIntencao(termo, ano)`, the same function
as for titles and queries (no second classifier). Weight the declaring terms (≠ ausente) by volume and
propose the heaviest class. With no declaring term there is no proposal ("nenhum termo do cluster
declara intenção"), and the owner chooses. Tape Pro gets "comercial" on 160 of 14,470 searches, and the
line says those two numbers.

## D12 — Proposed questions

A frozen term whose first words are one of `como, qual, quais, quanto, quanta, quantos, onde, o que,
por que, porque, pra que, para que` (normalized) is a proposed question of its cluster. There is no
paid source. Tape Pro has none (fact above), so the core says "nenhuma pergunta proposta pela
demanda: declare as do cliente". A proposal the owner removes gets a `removida` row, so it does not
return.

## D13 — The owner's task edits survive by key

`hub_plano_tarefa (projeto, chave, responsavel, esforco, prazo, atualizado)`, PK `(projeto, chave)`.
This is per project, not per version, because it must survive a new version (FR-029). A row whose
task no longer exists is ignored. Defaults when there is no row: responsible = the version's
`criadoPor`; effort = `esforco[alavanca]` (or `esforco.pergunta`), times 1 per target; fixed date =
none.

## D14 — The OKR line

- If the project declares no `meta` (from `listProjects()`), the plan prints FR-031 with the tree's
  own reason ("sem meta declarada") without calling anything.
- Otherwise it calls `dadosDaFicha(slug)` (the same function `/okr/[slug]` uses; no rule copied). It
  takes the goal-tree layer of the chain step collected from Search Console clicks (the `visitante`
  step, `coletor: "cliques"`), and prints its `necessario {min,max}` per 28-day window. Next to it go
  the plan's 180-day clicks per month and the covered fraction, `plano ÷ necessario` (a band when
  `min ≠ max`).
- If the tree stopped before that layer, the plan prints `arvore.parou.motivo`.
- A failure prints "o OKR não respondeu: {motivo}" and never breaks the plan.

**Cost**: `dadosDaFicha` reads GSC, GA4, Postgres and CrUX (~3.3 s cold). It is paid only by
projects with a declared meta (today: `atma`).

## D15 — The plan block on the map shows what left the plan

The block renders whenever the project has frozen demand, not only with an active version:

- per demand meta of the current version (or the preview): meta, deadline, "hoje" (from the map's
  `termosGsc`, via `partida`) and distance;
- the state of each page that covers a cluster (the `ESTADO_PAGINA` words);
- this week's scheduled tasks, from the same backlog, with the 055 mark state of their lever;
- the 057 milestone comparison, unchanged.

The capacity suggestion ("indexação limpa > 90%: considerar subir a capacidade") is removed: capacity
is now hours (spec, "O que muda na 057"). `semanaComCards` is deleted, because the backlog merges
cards for every week.
