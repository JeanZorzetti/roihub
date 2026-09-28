# Quickstart: validating 058

## Prerequisites

- `roihub/.env` with `DATABASE_URL` (the hub's Postgres). `ensure()` creates the new tables on the first
  request.
- Tape Pro has frozen demand (`data/demanda-estimada.json#tapepro`) and at least one crawl
  (`POST /api/paginas`).

## 1. Pure logic (every slice)

```sh
npm test
```

The suite must stay green, and it must include the new cases:

- **SC-006**: no task before another of an earlier step on the same target, including a planned page
  whose creation comes first.
- **SC-007a**: no week has more new pages than `capacidade`; no task other than a new page is ever
  "a fazer". A page with a fixed date in a full week becomes "a fazer".
- **SC-004**: every task has impact or "não calculável" with a reason. No `0` for missing data.
- **D4**: a card with 3 targets makes 3 tasks, the same key from two origins is one task, and a `*`
  card is absorbed by a concrete task of its lever.
- **D5**: a card lever with a vigente marca is not in the backlog, and it is back past `reler`. A
  `respondida` question makes no task.
- **D9**: metas read page weeks from the schedule. With capacity 0 no page is created, and every demand
  meta says "nenhuma página nova amadurece".
- **D11**: the Tape Pro intent proposal = comercial on 160 of the fita-gomada volume. A cluster with
  no declaring term has no proposal.
- **D12**: `como aplicar fita gomada` is a proposed question; `fita gomada` is not.
- **SC-001**: the plan's view model carries no `partida`, `distancia`, page state, marca date, decision
  author, version list or past week.

## 2. `/gsc/mapa/tapepro/plano` (after deploy, outside 23:30–01:00 and 08:00–08:45 BRT)

1. Open `/gsc/mapa/tapepro` once, so the map writes its snapshot.
2. Open `/gsc/mapa/tapepro/plano`. Expect all of the following:
   - no "Hoje:", no "distância", no "ativa/fora do índice", no "feito em", no "aprovada por", no
     "Versões" block (SC-001);
   - "cards do mapa lidos em …" (provenance);
   - with the default capacity (3), no week has more than 3 new pages;
   - the Núcleo shows 3 clusters, each with an intent line, an answering page, "nenhuma pergunta
     proposta pela demanda", "nenhuma entidade declarada" and a next task (SC-003);
   - the OKR line: "o OKR de Tape Pro não exige cliques ainda: sem meta declarada" (FR-031).
3. Create version 1 with capacity 3 and the default efforts. Expect:
   - the backlog has impact, effort, responsible, due and state in every row (SC-004);
   - the calendar weeks never pass 3 new pages, and every non-page task has a week (SC-007a).
4. Change the responsible of one task to Maria and its effort to 30 min. Create version 2: both
   changes are still there (SC-007).
5. Accept a question in the "fita gomada" cluster. Expect a new `cobertura` task on
   `/produtos/fita-gomada/` with `impacto: não calculável: pergunta declarada, sem volume`. Mark it
   `respondida`: the task leaves.
6. Open `/gsc/mapa/tapepro`. The plan block shows the demand metas' starting point and distance, the
   page states, and this week's tasks with their mark state (SC-002).

## 3. A project with an OKR meta

`/gsc/mapa/atma/plano`: the 180-day clicks row shows "o OKR exige X–Y cliques por 28 dias … cobre A–B%"
with the link (SC-008).

## 4. Lighthouse / keyboard

Run `ui-verification` on `/gsc/mapa/tapepro/plano` at 390, 768 and 1280 px, checking all of these:
- keyboard through every form;
- states readable without color;
- no horizontal scroll at 390 px (the backlog as cards).
