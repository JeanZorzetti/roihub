---

description: "Task list for 058 — the plan only speaks of the future"
---

# Tasks: the plan only speaks of the future

**Input**: Design documents from `specs/058-plano-so-futuro/`

**Prerequisites**: plan.md, spec.md (clarify 28/09, option C), research.md (D1–D15), data-model.md, contracts/ui.md, quickstart.md

**Tests**: included. SC-001, SC-006, SC-007 and SC-007a each ask for a test that fails, quickstart §1 lists
the cases, and Principle II requires `node --test` registered in `package.json`. Test tasks come before the
code they cover.

**Organization**: grouped by user story, in the plan's order of delivery (plan.md, "Order of delivery"). The
work happens on `main`, like 054–057. Every commit uses `git commit -- <paths>`, because the index may hold
other writers' staged files. Pushing is deploying: never between 23:30–01:00 or 08:00–08:45 BRT.

**Three decisions made here, where the design documents disagreed or were silent**:

1. **Where impact lives.** plan.md listed `gerarTarefas` and `impacto` in `lib/backlog.mjs`, but its Structure
   Decision said `backlog.mjs` "does not know clusters" and "receives tasks with impact already attached".
   Impact needs cluster terms (research D6), so the Structure Decision wins:
   - `lib/plano.mjs` generates the plan's own tasks (planned pages, existing pages, questions) and computes
     impact;
   - `lib/backlog.mjs` turns the map's cards into tasks, merges, orders, applies the owner's edits and
     schedules. It imports only `lib/proxima-acao.mjs`.
2. **The OKR arithmetic is pure.** plan.md put the OKR line in `dados.ts`. The division and the three shapes
   (research D14) can be tested without Next, so Principle III puts them in `lib/plano.mjs#linhaDoOkr`, and
   `dados.ts` only fetches.
3. **`montar` keeps all 26 weeks.** data-model.md said the weeks start at the current one. But the map's
   `comparar()` indexes `semanas[n - 1]` and the week before it. So `montar` keeps returning every week, and
   the plan's view (`vistaDoPlano`, T005) cuts the past.

plan.md and data-model.md were updated to match these three on 28/09 (analyze I4). The same analyze pass
amended spec, research (D3, D5, D6, D8, D11, D14), data-model and contracts/ui.md for findings C1–C3,
I1–I3, U1–U5 and A1. The tasks below already carry them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1, US2, US3, US4 (spec.md)

---

## Phase 1: Setup

- [X] T001 Create `test/backlog.test.mjs` with one `node:test` import and register it in the `"test"` list in `package.json`, in the same commit (Principle II; `test/validade.test.mjs` fails otherwise)
- [X] T002 [P] Baseline: `npm test` green on `e310ba2`, and `git status --short -- lib/ app/gsc/mapa test package.json` clean. Anything staged by another writer stays out of every 058 commit

---

## Phase 2: Foundational

No task. Each slice carries its own table (plan.md, "Order of delivery"), and US1 needs none. Nothing blocks all
four stories at once.

---

## Phase 3: User Story 1 — O plano só fala do que vai acontecer (P1) 🎯 MVP

**Goal**: `/plano` shows only the future. What leaves it (the starting point and distance, the page states)
shows up in the map's plan block. The marks stay where they already are (research D1, D15).

**Independent Test**: open `/gsc/mapa/tapepro/plano` and find none of these: "Hoje:", "distância até a meta", a
page state, "feito em", an author or decision date, a previous version. Then open `/gsc/mapa/tapepro` and find
the starting point of the demand metas, the state of the cluster pages and the marks.

### Tests for US1

- [X] T003 [US1] SC-001 in `test/plano.test.mjs`: build `vistaDoPlano(...)` (T005) from the Tape Pro frozen demand (the fixture the file already imports at ~line 665), a version list with one `encerrado`, one `ativo` and one `rascunho`, decisions with `decididoPor`/`decididoEm`, 055 marks, and `semanaAtual = 5`. Walk the returned object recursively and fail on any of these:
  - the keys `partida`, `distancia`, `estadoDaPagina`, `estados`, `decididoPor`, `decididoEm`, `marcado`;
  - a version other than the active one and the draft;
  - a week with `n < 5`;
  - a meta `conta` containing any page-state word (`ativa`, `fora do índice`, `indexada, sem impressão`, `sem leitura`), "marca de feito" or "semana 1".
- [X] T004 [US1] FR-004/FR-005/FR-006 in `test/plano.test.mjs`, against `vistaDoPlano`:
  - `semanaAtual = 5` → the first week is 5;
  - `semanaAtual ≤ 0` → the weeks start at 1, and the view carries `comecaEm = inicio`;
  - a task whose lever has a 055 mark with `marcado ≥` the task week's start and `hoje < reler` is absent;
  - the same mark with `hoje ≥ reler` → the task is back;
  - a task of week 3 with no mark shows up in week 5 (still future work);
  - each meta keeps its state word (`proposta`, `aprovada`, `editada`, `recusada`) and the final value, with no author and no date.

### Implementation for US1

- [X] T005 [US1] Add `vistaDoPlano({propostas, decisoes, montado, planos, clusters, marcas, hoje, semanaAtual})` to `lib/plano.mjs`. It is pure and is the only thing `plano/page.tsx` renders from, in every slice: T016 adds the core to it and T038 the backlog, so the SC-001 walk (T003) keeps guarding every block (analyze C1). It returns:
  - `versoes: {ativo: number|null, rascunho: number|null}`;
  - the metas without `partida`/`distancia`, each with `{estado, valorFinal}` from its decision;
  - `semanas` from `max(1, semanaAtual)`. A task whose lever has a vigente 055 mark (`marcado ≥` its week's start and `hoje < reler`) is dropped. An undone task of a past week joins the current week. `ponytail:` both rules live only until T037, when the scheduler never uses a past week and marks act through the origin rules (research D5);
  - the clusters without `estadoDaPagina`/`estados`. `cobertoPor` stays: it is the input of the future pages (contracts/ui.md §8).
- [X] T006 [US1] Rewrite the three texts in `lib/plano.mjs` that read the present, keeping only their future consequence (FR-001, research D1):
  - `contaPorPagina` (~line 458) drops the page-state words and "tarefa da semana 1": "Só conta depois que a tarefa da página for feita: /x, /y";
  - `regra()` inside `propor` (~line 507) says an existing page with a task counts from the week that task is done, without "ativa", "marca de feito" or "semana 1";
  - `montar`'s `semImpressao` warning (~line 630) says "nenhuma página existente conta nas metas até a próxima leitura de impressões" without the reasons (those are present readings; the map shows them).
- [X] T007 [US1] Move `ESTADO_PAGINA` from `app/gsc/mapa/[slug]/plano/page.tsx:56` to `lib/plano.mjs` as an export, and delete `ESTADO_TEXTO` (`lib/plano.mjs:452`), which T006 leaves unused. There is now one list of page-state words
- [X] T008 [P] [US1] Rewrite `app/gsc/mapa/[slug]/plano/page.tsx` to render only from `vistaDoPlano`:
  - Drop the `gscTermos` import and read and the `partida` block (lines ~78–105). Keep `gscPaginas`, because it decides scheduling (FR-002, FR-007), and call `dadosDoPlano(slug, null, {paginas})`.
  - In `linhaDaMeta`: remove "Hoje: … distância", "Ponto de partida …" and `jaAtingida`. The state shows the word only, with no "por X em DD/MM".
  - Remove "feito em" from `tarefasDa`, and the page state from the Demanda block (~lines 467, 475).
  - Remove the "Versões" block (~line 543) and the capacity suggestion from the Premissas text (~line 532). The suggestion stays on the map.
  - The header says "versão N ativa" and/or "versão M em rascunho", otherwise "prévia com as premissas padrão".
  - The `semImpressoes` warning (~line 120) becomes the consequence only.
  - The footer (~line 559) names the page-impression read as the only external read, and says why (it decides which week a page's task goes in).
- [X] T009 [P] [US1] In `app/gsc/mapa/[slug]/page.tsx`, move the starting point to the map (research D15):
  - Compute `partida` from `termosGsc`, `inventario` and the frozen entry, with the block that T008 removed from the plan route: same functions, same window.
  - Pass it to `dadosDoPlano(slug, partida, {soAtivo: true, paginas: paginasGsc})` (~line 2180).
  - The plan block (~lines 2490–2552) renders whenever `planoMapa?.demanda` exists, not only with an active version.
  - It adds **Ponto de partida**: per demand meta (`top20`, `tamBusca`, `pagina1`), the meta, the deadline, "hoje X (janela, Search Console)" and the distance, or "ponto de partida não lido: motivo".
  - It adds **Páginas dos clusters**: each URL in the clusters' `estados`, with the `ESTADO_PAGINA` words and the reason.
  - With no active version the metas are the preview's (`soAtivo` falls back to `PREMISSAS_PADRAO`). The block says "prévia com as premissas padrão" and shows neither "Esta semana" nor Marcos. The capacity suggestion (~line 2540) stays.
- [X] T010 [US1] Run `npm test`, commit T003–T009, and push outside the windows. In production:
  - `curl` `/gsc/mapa/tapepro/plano` and grep 0 hits for "Hoje:", "distância", "fora do índice", "feito em", "aprovada por" and "Versões" (SC-001);
  - `grep -n gscTermos "app/gsc/mapa/[slug]/plano/page.tsx"` returns nothing (SC-009);
  - `/gsc/mapa/tapepro` shows the starting point of the three demand metas and the page states (SC-002).

**Checkpoint**: `/plano` is future-only. The present lives on the map. No computation changed.

---

## Phase 4: User Story 2 — O núcleo: cada cluster diz o que vai atender (P1)

**Goal**: each cluster carries intent, answering page, questions, entities and the next task. The owner's
decisions persist per project and seed (research D11).

**Independent Test**: open the "fita gomada" cluster of Tape Pro and read intent, answering page, questions,
entities and the next task. Change the proposed intent without leaving the screen.

### Tests for US2

- [X] T011 [US2] Test `propostaDeIntencao` (D11) in `test/plano.test.mjs`:
  - On the Tape Pro "fita gomada" cluster it returns `{classe: "comercial", volumeDeclarado, volumeTotal}`. `volumeTotal` is the cluster volume, and `volumeDeclarado` is the sum of its terms that `modificadoresDeIntencao` does not call `ausente` (160 on 28/09). Assert against the fixture, not the literal.
  - A cluster with no declaring term returns `null`.
  - Weights go by volume, and a tie between `informacional` and `comercial` gives `ambos`.
- [X] T012 [US2] Test `perguntasPropostas` (D12) in `test/plano.test.mjs`:
  - `como aplicar fita gomada`, `o que é fita gomada`, `Quanto custa fita gomada` (accent and case) and `pra que serve fita kraft` are questions, with their volume;
  - `fita gomada` and `fita gomada preço` are not;
  - Tape Pro's frozen demand has none, so the list is empty.
- [X] T013 [US2] Test `aplicarNucleo` in `test/plano.test.mjs`:
  - A decided intent wins over the proposal (`decidida: true`).
  - An owner-pointed page becomes `pagina` with origin `dono`, and `agendaDePaginas` no longer queues that cluster's page. Every term keeps its `cobertoPor` (research D11, analyze U1).
  - A cluster with no page and volume > 0 has `paginaResponsavel = {alvo: rotuloDaPagina(semente), origem: "planejada"}`.
  - A proposed question with a `removida` row is left out. An owner question keeps its `detalhe` page, and a `respondida` question keeps its state.
  - Entities come back with their kind.
  - A row whose seed is not a cluster is ignored.
  - The same rows applied to the demand regrouped with one more term (a new consultation or version) keep every decision (FR-015).
  - SC-001 again: the T003 walk over `vistaDoPlano` with the applied clusters finds no `estadoDaPagina`, including the one `aplicarNucleo` sets for the owner's page.
- [X] T014 [US2] Test `lerNucleo` and `lerItem` in `test/plano.test.mjs`. They reject:
  - a seed that is not a cluster seed, and an `intencao` outside the three classes;
  - a `pagina` that is not an absolute URL on the project's hosts (empty is accepted and means "back to default");
  - a `tipo` outside `pergunta`/`entidade`, and a `texto` of 0 or more than 200 characters;
  - `respondida` on an entity, and an entity kind outside the fixed list;
  - an answering-page URL off the project's hosts, and a `responsavel` other than `jean`/`maria`.

### Implementation for US2

- [X] T015 [P] [US2] In `lib/db.ts`, add `hub_nucleo` and `hub_nucleo_item` to `ensure()` after the `hub_plano` lines (~224), exactly as in data-model.md §1. Add:
  - `listNucleo(projeto)` → `{decisoes, itens}`;
  - `setIntencao(projeto, semente, intencao, por)` and `setPaginaResponsavel(projeto, semente, pagina | null, por)`, each an upsert on the PK that touches only its own column;
  - `decidirItem(i)`, an upsert on `(projeto, semente, tipo, texto)`.
- [X] T016 [US2] Implement in `lib/plano.mjs`, with no `Date.now()` (the caller passes `ano`):
  - `propostaDeIntencao(cluster, ano)`, which imports `modificadoresDeIntencao` from `./pagina.mjs` (no second classifier);
  - `perguntasPropostas(cluster)`;
  - `aplicarNucleo(clusters, {decisoes, itens, estados, ano})`. It sets the owner's `pagina` (with its `estadoDaPagina` from `estados`), `intencao`, `paginaResponsavel`, `perguntas` and `entidades`, and never touches a term's `cobertoPor`. It runs BEFORE `agendaDePaginas`, so a pointed page stops the planned cluster page;
  - in `vistaDoPlano`, pass the core fields through and strip `estadoDaPagina`;
  - `lerNucleo(c, {slugs, sementes, hosts})` and `lerItem(c, {slugs, sementes, hosts})`, following `lerMarca`: bad input returns `null`.
- [X] T017 [US2] In `app/gsc/mapa/[slug]/plano/dados.ts`:
  - Read `listNucleo(slug)` in the existing `Promise.all` (~line 37).
  - Apply `aplicarNucleo` right after `cobrir` and before `propor`/`montar`.
  - Derive each cluster's `proxima` (lever and week) from the 057 calendar until T037: the first week ≥ the current one with a task whose `alvos` include the answering page. `null` means "nada planejado".
- [X] T018 [US2] Add to `app/gsc/mapa/[slug]/plano/actions.ts`:
  - `decidirIntencao` and `apontarPagina` (`lerNucleo` → `setIntencao` / `setPaginaResponsavel`);
  - `decidirItem` (`lerItem` → `decidirItem`).

  Each one reads the seeds from `lerDemanda` of the frozen entry and the hosts with the same `hostsDeclarados` the page uses, writes nothing on `null`, and calls `revalidar(projeto)`.
- [X] T019 [US2] Invoke `accessibility` and `ux-writing`, then add the **Núcleo** block to `app/gsc/mapa/[slug]/plano/page.tsx` (contracts/ui.md §5), rendered from `vistaDoPlano(...).clusters`, never from `d.clusters` (analyze C1). One block per cluster, by volume, shows:
  - the intent: decided; or proposed, with its basis ("comercial em 160 de 14.470 buscas/mês"); or "nenhum termo do cluster declara intenção";
  - the answering page, as a path or planned label, with its origin in words;
  - the questions with their answering page, or "nenhuma pergunta proposta pela demanda: declare as do cliente";
  - the entities, or "nenhuma declarada";
  - the next task and its week, or "nada planejado".

  The forms, shown only when `podeGravar`:
  - an intent select;
  - an answering-page URL field;
  - "add question";
  - accept, remove and "respondida por" for each question. Accepting with another page makes that page the task's target, and "respondida por" a page ends it with no task (research D11, analyze U2);
  - add and remove for entities, with a kind select.

  Every field has a `<label>`, each form sits in a `fieldset` with a `legend`, and no state is conveyed by color alone.
- [X] T020 [US2] Run `npm test`, commit T011–T019, and push outside the windows. On `/gsc/mapa/tapepro/plano`:
  - the 3 clusters show the five lines (SC-003);
  - changing the intent of "fita gomada", then creating a draft version, keeps the choice (US2 scenario 4).

**Checkpoint**: the core exists and persists. The schedule is still 057's.

---

## Phase 5: User Story 3 — Backlog priorizado (P2)

**Goal**: one backlog of every future task, from any origin, each task with impact, effort (owner minutes),
responsible, due week and state, in D7 order and scheduled from the current week. Only new pages take capacity
(research D8).

**Independent Test**: open the Tape Pro backlog and read the first task with its impact in clicks/month, its
effort, responsible and due week. Change the responsible, and see the change survive a new version.

### Step 1 — the map's snapshot (deploy first, so the data exists before step 5 reads it)

- [X] T021 [P] [US3] In `lib/db.ts`, add `hub_mapa_disparo` to `ensure()` (data-model.md §1), with the `sem_leitura` column. Add `gravarDisparos(projeto, disparos, semLeitura)`, an upsert with `lido_em = now()`, and `lerDisparos(projeto)` → `{lidoEm, disparos, semLeitura} | null`, with `JSON.parse` on read
- [X] T022 [US3] In `app/gsc/mapa/[slug]/page.tsx`, right after `const disparos = avaliar(leituras)` (~line 2151) and only when `dbOn()`:
  - call `gravarDisparos(slug, …)` with no `await`, followed by `.catch(() => {})`;
  - write the `dispara`/`critica` dispatches, each as `{chave, alavanca, estado, alvos, nAlvos}`. These are the fields `plano()` reads;
  - write the `sem-leitura` ones as `{chave, alavanca, motivo}` in `semLeitura` (research D3, analyze U3).
- [X] T023 [US3] Run `npm test`, commit T021–T022, and push outside the windows. Open `/gsc/mapa/tapepro` once. Confirm with a `SELECT projeto, lido_em, length(disparos) FROM hub_mapa_disparo` that one row exists. Print no other column

### Step 2 — storage for effort and edits

- [X] T024 [P] [US3] In `lib/db.ts`, make the storage changes for effort and edits:
  - `ALTER TABLE hub_plano ADD COLUMN IF NOT EXISTS esforco TEXT NOT NULL DEFAULT '{}'`;
  - carry `esforco` through the `Plano` type, `listPlanos` (`JSON.parse`, falling back to `{}`), `criarPlano` and `setPremissas`;
  - add `hub_plano_tarefa` (data-model.md §1), `listTarefas(projeto)` → `Map<chave, {responsavel, esforco, prazo}>` and `editarTarefa(e)` (an upsert on `(projeto, chave)`; empty fields are stored as `NULL`).

### Step 3 — `lib/backlog.mjs`, test first

- [X] T025 [US3] D3/D4/D5 cards in `test/backlog.test.mjs`, against `deCards(snapshot, {marcas, hoje})`:
  - a card with 3 targets gives 3 tasks, keyed `alavanca|url:/a`, … Targets come from the first reason with targets in full, not `plano()`'s 3-item cut;
  - `«termo»` becomes `termo:«termo»`;
  - `/a/ (faltam 12 cliques)` becomes the key `…|url:/a` and keeps the annotation in the label;
  - a card with only `nAlvos` becomes `alavanca|*`;
  - a lever with a vigente mark (`hoje < reler`) gives no task, and past `reler` it is back;
  - each task carries `kpis` = the leaves that fired it (FR-002, analyze C2);
  - a `semLeitura` leaf returns `faltas: [{alavanca, folha, motivo}]` next to the tasks, which T038 prints as "as tarefas de {alavanca} podem faltar" (analyze U3).
- [X] T026 [US3] Test merging in `test/backlog.test.mjs`, against `juntar(tarefas)`:
  - the same key from `pagina-existente` and `mapa` is one task with both origins;
  - a `*` task is dropped when a concrete task of the same lever exists, and kept otherwise;
  - the input is not mutated.
- [X] T027 [US3] Test ordering (D7, SC-006) in `test/backlog.test.mjs`, against `ordenar(tarefas)`:
  - tasks sort by impact ÷ effort, descending;
  - `null` impact goes after every number, in 054 order, then by key;
  - on one existing target, `indexacao` comes before a `posicao` lever and that before `snippet`, even when the later step has more impact;
  - on a planned target, `cobertura` comes first;
  - a generated case (every lever × 3 targets × random impact) never puts a task before one of an earlier step on the same target.
- [X] T028 [US3] Test scheduling (D8, SC-007a, US3 scenario 7) in `test/backlog.test.mjs`, against `agendar(tarefas, {capacidade, semanaAtual, semanas})`:
  - with 4 new pages and capacity 3, three land in the current week and the fourth in the next;
  - non-page tasks land in the first week their dependencies allow, including the page's own week, and `indexacao` of a planned page lands no earlier than `naoAntes`;
  - a fixed date on a full week gives `a-fazer`, with "a data fixada não cabe: a semana DD/MM já tem N páginas novas";
  - a page with a fixed date that fits goes to that week ahead of pages earlier in the D7 order (FR-028);
  - a non-page task with a fixed date goes to that week, or `bloqueada` when its dependency lands later;
  - a fixed date whose week is before `semanaAtual` is scheduled in the current week with "data fixada vencida", and prints no past date (research D8, analyze U4);
  - a page past week 26 is `a-fazer`, and a task depending on it is `bloqueada`, naming it;
  - with capacity 0, no page is scheduled;
  - no week has an `n < semanaAtual`.

  Invariant over a generated case: no week has more new pages than `capacidade`, and only new pages are ever `a-fazer`.
- [X] T029 [US3] Test edits (D13, SC-007) in `test/backlog.test.mjs`, against `aplicarEdicoes(tarefas, edicoes, {responsavel, esforco})`:
  - an edit of responsible, effort or fixed date survives when the task list is rebuilt from a different version's premises (same key);
  - the edit of a key that no longer exists is ignored;
  - with no edit, the responsible is the version's `criadoPor`, and the effort is `esforco[alavanca]` (or `esforco.pergunta` × the task's questions);
  - `editado` flags which values came from the owner.
- [X] T030 [US3] Implement `lib/backlog.mjs` (pure; it imports only `./proxima-acao.mjs`):
  - `deCards` calls `plano(snapshotComoDisparos, {marcas, hoje})` to reuse the 055 rule without copying it. It keeps entries with `apresentacao` `ativa`/`voltou`, and takes targets from `e.motivos.find((m) => m.alvos.length)?.alvos`;
  - `juntar`, `ordenar`, `agendar` and `aplicarEdicoes`;
  - one normalizer for target keys (decoded path, no trailing slash, annotation stripped).

  It never reads clusters or metas.

### Step 4 — `lib/plano.mjs`: tasks, impact, metas from the schedule

- [X] T031 [US3] Test `tarefasDoPlano` in `test/plano.test.mjs`:
  - A planned page gives `cobertura` (`paginaNova: true`, with briefing), plus `links`/`titulo`/`schema` on the same target depending on it, plus `indexacao` depending on it with `naoAntes = semana + semanasAteIndexar` (resolved after scheduling).
  - An existing covering page that is not `ativa` gives its D15 levers. A vigente mark of that lever (made on or after `inicio`, `hoje < reler`) removes them; past `reler`, a page still not `ativa` gets them back (FR-004, research D5, analyze I2).
  - An owner-pointed page leaves the D15 tasks of the pages that cover terms untouched (they follow `cobertoPor`); the cluster's own tasks (FR-005a `titulo`, questions) go to the pointed page (research D11, analyze U1).
  - An accepted question that is not `respondida` gives `cobertura` on its `detalhe` page (the answering page when null), with the question in the briefing. A `respondida` one gives nothing, whichever page it names. A question on a planned page merges into that page's `cobertura` (same key).
  - The FR-005a seed-missing-from-title case gives `titulo` on the URL.
  - Every task carries `kpis` from `kpisDa(alavanca)` (FR-002, analyze C2). Every task whose target is a cluster's answering page carries that cluster's briefing, whether it creates or adjusts the page (FR-016, analyze C3).
  - SC-001 again: the T003 walk over `vistaDoPlano` with the backlog in its input finds no page state, mark date or author.
- [X] T032 [US3] Test `comImpacto` (D6, SC-004) in `test/plano.test.mjs`:
  - `url:` → the terms with `cobertoPor` = that page;
  - `planejada:` → the terms its label covers;
  - `termo:` → that term if frozen;
  - a question-only task → its term's volume, or `{naoCalculavel: "pergunta declarada, sem volume"}`;
  - `*` or a path covering no term → `naoCalculavel` with the reason;
  - a target whose terms all have `null` volume → `naoCalculavel: "termos abaixo do mínimo que o Google Ads informa"`, never 0 (research D6, analyze U5).

  Every task carries `cliques` or `naoCalculavel`, and never `0` for missing data. The `conta` reads like "… buscas/mês × 2,2% = N cliques/mês", using `benchmark(7)`, the same number as the 180-day click meta.
- [X] T033 [US3] Test D9 in `test/plano.test.mjs`:
  - `propor` and `montar` take `semanaDaPagina` (a `Map` from label to week or `null`);
  - a page that is `a-fazer` counts in no meta;
  - with capacity 0, every demand meta carries `SEM_NOVA`;
  - the week of each page in `montar` equals the week of its `cobertura` in the schedule;
  - `montar` still returns 26 weeks.
- [X] T034 [US3] Test `lerPlano` + `esforco` and `lerTarefa` in `test/plano.test.mjs`. The rules:
  - effort keys are `ALAVANCAS` plus `pergunta`, integer minutes 1–600 (0 is rejected: effort divides impact), and a missing key takes its default;
  - `chave` is ≤ 600 characters and has a known lever prefix;
  - `responsavel` is `jean`/`maria` or empty;
  - `esforco` is 1–600 or empty;
  - `prazo` is a real date, snapped to its Monday (`segundaDe`), not before the Monday of `hoje`, or empty (analyze U4, U5).
- [X] T035 [US3] In `lib/plano.mjs`, handle premises and validators:
  - `PREMISSAS_PADRAO.esforco` takes the research D10 table (owner minutes, "◇ política do dono, sem fonte");
  - `lerPlano` gains `esforco.{chave}` fields;
  - add `lerTarefa(c, {slugs, hoje})`;
  - keep the D10 texts ("quem executa · o que o dono faz") next to `PREMISSAS_PADRAO.esforco`, so T040 prints them without copying.
- [X] T036 [US3] In `lib/plano.mjs`, add `tarefasDoPlano(clusters, agenda, {premissas, marcas, inicio, hoje})` and `comImpacto(tarefas, clusters)`, as tested in T031–T032. Each task gets `kpis` from `kpisDa(alavanca)`. Briefing (FR-016): every task whose target is a cluster's answering page (creating or adjusting it) and every question task carries `{intencao, perguntas, entidades}` of that cluster
- [X] T037 [US3] In `lib/plano.mjs`, apply D9:
  - `agendaDePaginas` loses `semana` (queue order and `cobre` stay);
  - `donos`, `propor` and `montar` read `semanaDaPagina`;
  - `montar` stops building tasks (the `poe` block, ~lines 573–600) and receives the scheduled tasks. Each week gets `tarefas` (backlog order) and `paginasNovas`, and all 26 weeks stay;
  - delete `semanaComCards` and its test (`test/plano.test.mjs:702`), `JUNTO_DA_PAGINA`, and both interim rules of T005: the carry-over (the scheduler never uses a past week) and the per-lever mark filter (marks act only through the origin rules; one `indexacao` mark would hide every planned page's indexing, analyze I3). Update T004's cases to match;
  - keep `kpisDa`: T036 uses it (analyze C2);
  - `vistaDoPlano` gains the backlog, "Esta semana" and the calendar weeks from the schedule, so T040 renders them through it (analyze C1).
  - `feita` stays only if T041 still calls it; otherwise delete it and its test (~line 366).

### Step 5 — screens and forms

- [X] T038 [US3] Rewrite `dadosDoPlano` in `app/gsc/mapa/[slug]/plano/dados.ts` as the whole pipeline, in this order:
  1. `cobrir` → `aplicarNucleo` → `agendaDePaginas`;
  2. `tarefasDoPlano` + `deCards` (the `disparos` option from the map, in memory; otherwise `lerDisparos(slug)`) → `juntar` → `comImpacto`;
  3. `aplicarEdicoes` (`listTarefas`, the version's `criadoPor` and `esforco`) → `ordenar` → `agendar({capacidade, semanaAtual, semanas: SEMANAS})`;
  4. `semanaDaPagina` → `propor`/`montar`, and each cluster's `proxima` from the backlog (this replaces T017's interim).

  It returns `backlog`, `disparosLidosEm` and the warnings:
  - with no snapshot: "as tarefas que o mapa dispara ainda não foram lidas: abra o mapa uma vez";
  - when the snapshot read fails: "as tarefas que o mapa dispara não entraram: {motivo}", with the rest built anyway;
  - for each `faltas` entry from `deCards`: "as tarefas de {alavanca} podem faltar: {folha} estava sem leitura quando o mapa foi lido ({motivo})" (analyze U3).
- [X] T039 [US3] In `app/gsc/mapa/[slug]/plano/actions.ts`:
  - add `editarTarefa` (`lerTarefa` → `editarTarefa` in `lib/db.ts`, then `revalidar`);
  - `criarVersao` and `salvarPremissas` pass `esforco` through to `criarPlano`/`setPremissas`.
- [X] T040 [US3] Invoke `information-design`, `responsive-design`, `accessibility` and `ux-writing`, then change `app/gsc/mapa/[slug]/plano/page.tsx` (contracts/ui.md §2–4, 7, 9). Every block renders from `vistaDoPlano`, never from `d.backlog` directly (analyze C1):
  - **Esta semana** lists the current week's scheduled tasks in backlog order, with responsible and owner minutes. With nothing left it says "Nada mais planejado para esta semana" and names the next week with a task. Before the start it says "O plano começa em DD/MM".
  - **Backlog** has one row per task, with the columns task, impact, effort, responsible, due and state + reason. The state is in words. A `<details>` holds the `conta`, the origins, the leaves the task moves ("Move: …", from `kpis`), the briefing and the edit form (responsible, minutes 1–600, fixed date from this week on). At ≤ 390 px each task is a card, with no horizontal scroll.
  - **Calendário** runs from the current week, shows "páginas novas: N de C", and collapses quiet weeks with the existing `blocos` logic (~line 300).
  - **Premissas** gets one minutes field per lever plus `pergunta`, each with who executes and what the owner does (research D10), all "◇ política do dono, sem fonte".
  - **Avisos**: capacity 0 comes first, then no snapshot and tasks past 26 weeks. "Cards do mapa lidos em DD/MM HH:mm" is provenance, printed next to the demand's date, not a warning.
  - Remove `apontaMapa` (~lines 257–269).
- [X] T041 [US3] In `app/gsc/mapa/[slug]/page.tsx`:
  - pass the in-memory `disparos` to `dadosDoPlano` (so the map needs no snapshot read);
  - "Esta semana" in the plan block lists the backlog's current-week tasks, each with its lever's 055 mark state: "feito em DD/MM por X", "ainda dispara" or "sem marca de feito";
  - remove the `semanaComCards` import and call (~lines 28, 2185).
- [ ] T042 [US3] Run `npm test` and commit T024–T041. Push outside the windows. Run quickstart §2 steps 1–5 on Tape Pro:
  - every row has impact or "não calculável", effort, responsible, due and state (SC-004);
  - the backlog's `mapa`-origin levers equal the levers the map fires without a vigente mark, read the same minute (SC-005);
  - Maria + 30 min survive version 2 (SC-007);
  - no week has more than 3 new pages, and every non-page task has a week (SC-007a);
  - a question accepted and then marked `respondida` leaves the backlog.

**Checkpoint**: the plan is a planner. The map and the plan read one backlog.

---

## Phase 6: User Story 4 — O plano diz se basta para o OKR (P3)

**Goal**: next to the 180-day clicks meta, the plan shows what the OKR goal tree requires and the fraction
the plan covers. It never invents a number (research D14).

**Independent Test**: on a project with an OKR meta, one line reads "o plano projeta X cliques/mês aos 180 dias;
o OKR exige Y; o plano cobre Z% do exigido".

- [ ] T043 [US4] Test `linhaDoOkr(arvore, cliquesPlano, {temMeta, recusada})` in `test/plano.test.mjs`:
  - a `visitante` layer with `necessario {min, max}` (per 28 days) gives `{necessario, janelaDias: 28, necessarioMes, plano, fracao}`, with `necessarioMes = necessario × (365,25 / 12) / 28` and `fracao = {min: plano / necessarioMes.max, max: plano / necessarioMes.min}`. When `min = max` the band collapses to one value;
  - units (analyze I1): `necessario = 28` per 28 days and `plano = 30,4375` per month give `fracao = 1`, not 1,087. The case fails if the function divides month by 28 days;
  - `recusada: true` gives `{semComparacao: "a meta de cliques aos 180 dias foi recusada: nada a comparar"}` (analyze A1);
  - `temMeta: false` gives `{semComparacao: "sem meta declarada"}`;
  - `arvore.parou` before the `visitante` layer gives `{semComparacao: parou.motivo}`;
  - no branch returns a number that is not in the input.
- [ ] T044 [US4] Implement `linhaDoOkr` in `lib/plano.mjs`. It is pure. It reads the layer whose `chave` is `visitante`, the one `lib/ficha-dados.ts:169` calls `camadaClique`
- [ ] T045 [US4] In `app/gsc/mapa/[slug]/plano/dados.ts`, with a `comOkr` option that only the plan route passes (the map does not pay ~3.3 s):
  - read the project's `meta` from `listProjects()`, never `data/projects.json` (Principle I);
  - when there is a meta, call `dadosDaFicha(slug)` in parallel with the DB reads, catching failure as `{falhou: motivo}`;
  - return `linhaDoOkr(ficha.arvore, cliques180, {temMeta, recusada})`. `cliques180` is the 180-day clicks meta as decided: the approved or edited value, or the proposal while undecided; `recusada` when its decision is `recusada` (research D14, analyze A1).
- [ ] T046 [US4] Invoke `ux-writing`, then print the OKR line under the 180-day clicks meta in `app/gsc/mapa/[slug]/plano/page.tsx` (contracts/ui.md §6). It takes one of three shapes:
  - "o OKR exige X–Y cliques por 28 dias; o plano projeta Z por mês aos 180 dias: cobre A–B%", with a link to `/okr/{slug}`;
  - "o OKR de {projeto} não exige cliques ainda: {motivo}";
  - "o OKR não respondeu: {motivo}".
- [ ] T047 [US4] Run `npm test`, commit T043–T046, and push outside the windows. Then check both projects:
  - `/gsc/mapa/tapepro/plano` says "o OKR de Tape Pro não exige cliques ainda: sem meta declarada" (FR-031);
  - `/gsc/mapa/atma/plano` shows the band and the link (SC-008).

**Checkpoint**: all four stories work, each testable on its own.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T048 [P] Add entries to `GLOSSARIO.md`, next to the 057 ones: núcleo, backlog, impacto (cliques/mês projetados aos 180 dias), esforço (minutos do dono, só ordena), the task states (agendada / a fazer / bloqueada), and "cards do mapa lidos em"
- [ ] T049 [P] In `specs/057-plano-seo/spec.md`, add a one-line "substituído pela 058 (FR-xxx)" note next to each item listed in 058's "O que muda na 057":
  - clarify "Onde o plano lê o ponto de partida?";
  - US4 scenario 1;
  - FR-011a, FR-014 and FR-017.
- [ ] T050 Sweep `lib/plano.mjs` and both routes for dead code. Grep for callers of `feita`, `leiturasDoPlano`, `comparar` and the `partida` parameter of `propor`. The map still uses the last three. Delete whatever has no caller, and run `npm test`
- [ ] T051 Run `ui-verification` on `/gsc/mapa/tapepro/plano` and on the map's plan block, at 390, 768 and 1280 px:
  - keyboard through every form (núcleo, task edit, premises, metas);
  - states readable without color;
  - no horizontal scroll at 390 px;
  - a clean console.

  Record screenshots before and after (FR-041).
- [ ] T052 Run the whole of quickstart.md in production (§1–§4). Then write the "Implementation notes" at the end of this file: commits, measured facts and the pending reading dates. Mark every task `[X]`

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (T001–T002)**: none.
- **US1 (T003–T010)**: after Setup. It ships alone.
- **US2 (T011–T020)**: after US1 is merged. It touches the same `page.tsx` and `dados.ts`, so it cannot run in parallel with US1. There is no logical dependency.
- **US3 (T021–T042)**: after US2. `tarefasDoPlano` needs the questions and the answering page, and the impact of a question needs the core. Steps 1 and 2 (T021–T024) touch only `lib/db.ts` and the map, so they can go while US2 is under review.
- **US4 (T043–T047)**: after US3. It needs the 180-day click value computed from the scheduled weeks (T037). The pure test and function (T043–T044) can be written any time.
- **Polish (T048–T052)**: after the stories that are delivered.

### Inside each story

Tests before code (T003–T004 → T005; T011–T014 → T016; T025–T029 → T030; T031–T034 → T035–T037;
T043 → T044). Then `lib/db.ts` → pure `.mjs` → `dados.ts` → `actions.ts` → `page.tsx`. The last task of each
story is test, commit, push and production check.

### Critical path

T001 → T005 → T008 → T010 → T016 → T019 → T020 → T023 (deploy + open the map) → T030 → T037 → T038 → T040 →
T042 → T045 → T047.

---

## Parallel Opportunities

- T002 alongside T001.
- US1: after T007, T008 (`plano/page.tsx`) and T009 (map `page.tsx`).
- US2: T015 (`lib/db.ts`) alongside the tests T011–T014 (`test/plano.test.mjs`).
- US3:
  - T021 and T024 (`lib/db.ts`, one after the other in the same file) alongside T025–T029 (`test/backlog.test.mjs`);
  - T025–T029 alongside T031–T034 (`test/plano.test.mjs`), in different files.
- Polish: T048 and T049 alongside each other and alongside T050.

### Parallel Example: User Story 3

```text
Task: "T025–T029 backlog tests in test/backlog.test.mjs"
Task: "T031–T034 task/impact/D9/validator tests in test/plano.test.mjs"
Task: "T024 hub_plano.esforco + hub_plano_tarefa in lib/db.ts"
```

---

## Implementation Strategy

### MVP first (US1 only)

1. T001–T002.
2. T003–T010: the plan stops showing the present, and the map gains the starting point and the page states.
3. **Stop and validate**: SC-001, SC-002 (partial: marks are already on the map), SC-009.

This is the cheapest part (removal), and it is already the owner's definition of the screen.

### Incremental delivery

1. US1 → deploy: future only.
2. US2 → deploy: the core, with decisions that persist.
3. US3:
   - steps 1–2 → deploy, then open the map (the snapshot exists);
   - steps 3–5 → deploy: the backlog replaces the 057 calendar.
4. US4 → deploy: the OKR line.

Each step leaves `npm test` green and the plan readable. No step needs the next one to make sense.

---

## Notes

- `[P]` = different files, no dependency on an unfinished task.
- Every new form: validated by a pure `ler*`, and bad input writes nothing (the 055/057 pattern).
- No new env var, no new lever, no new 055 mark mechanism (plan, Constraints).
- The Tape Pro backlog will open dominated by indexing (0 of 23 URLs indexed on 28/09). That is expected, not a defect.
