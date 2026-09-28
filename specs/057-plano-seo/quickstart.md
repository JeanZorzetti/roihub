# Quickstart — validating 057

## Prerequisites

- `DATAFORSEO_API_KEY` in `roihub/.env`, copied from `ROI Labs/open-seo/.env`. Compare by `grep -c`,
  never by `cat` (memory `feedback_diff_cat_leak_secrets`).
- Balance > US$ 1, checked on 2026-09-28: US$ 49.997.

## 1. Pure logic (no network, no DB)

```
npm test
```

`test/plano.test.mjs` is registered in `package.json` (Principle II). It must fail if any of these
break:
- **`agrupar`**:
  - "fita gomada preço" → cluster `fita gomada`;
  - "fita gomada para e-commerce" → cluster `fita gomada`, segment `e-commerce`;
  - a term containing two product seeds → the longer seed;
  - a term with no seed → `semCluster`.
- **`propor`**:
  - `ctrGap`, `lcp` and every REGRAS leaf → meta equals `REGRAS[k].limiar`, origin equals the leaf's
    seal;
  - the headline 180-day clicks use `benchmark(7)`;
  - the 90-day clicks are absent, not 0.
- **`montar`**:
  - no week exceeds `capacidade` (SC-004);
  - no `links`, `titulo` or `schema` before its page (FR-012);
  - `capacidade 0` → warning and no coverage milestone (FR-018);
  - a deadline that does not fit → "não cabe no prazo".
- **`comparar`**: a reading `{ausente}` → `sem-leitura`, never `no-marco`; a milestone in the future
  → `nao-chegou`.
- **`lerDecisao` / `lerPlano`**: reject bad responsavel, key, horizon, value, capacity and
  `pisoApoio`.
- **Clarification of 2026-09-28** (research D12–D16):
  - `estadoDaPagina`:
    - `indexada` + impressions → `ativa`;
    - `indexada` absent from a complete reading → `indexada-sem-impressao`;
    - `indexada` + truncated or failed reading → `sem-leitura`;
    - `falha` or missing URL → `sem-leitura`, never `fora-do-indice`.
  - `cobreTermo`:
    - "fita gomada kraft" is covered by the title "Fita Gomada Kraft 70mm", in any order, without
      accents;
    - it is not covered by a title that has only "fita gomada";
    - it is not covered by mixing half the words from the title and half from the H1;
    - `fitas` ≠ `fita`.
  - `agendaDePaginas`: an uncovered term with volume ≥ `pisoApoio` becomes an `apoio-termo`; one
    below the floor does not; one already covered by a queued page does not. The seed of a cluster
    that already has a page never becomes one: it becomes a week-1 `titulo` task on that page.
  - `montar`:
    - a non-`ativa` page gets `indexacao` or `links`/`frescor`/`backlinks` in week 1. A `sem-leitura`
      page with an `indexada` verdict gets no task, only the first-line aviso;
    - that page enters no milestone without a marca;
    - with a marca in week 3, it matures in week 3 + `semanasAteEstabilizar`.
  - `semanaComCards`: the same lever merges into one task (union of targets); an `aguardando` entry
    stays out; a future week receives no card.
  - **SC-008**: the Tape Pro scenario of 28/09 (2 cluster pages, 0 impressions) → week 1 is not
    empty, and no demand meta exceeds the terms covered by title/H1. The test fails on "semana vazia"
    and on 100% page 1 with 2 pages.

## 2. Demand, Tape Pro

```
node --env-file=.env scripts/consultar-demanda.mjs tapepro
```

Expected: seeds `fita gomada, fita transparente personalizada, fita transparente comum`, region
`Brazil`, balance, estimated cost. No spend.

```
node --env-file=.env scripts/consultar-demanda.mjs tapepro --consultar
```

Expected: actual cost (cents), the clusters with volume, the dropped counts, `semCluster`. Nothing is
written (`git status` clean).

Curate with `--excluir` and `--mover`, then add `--gravar`. Then:
- `npm test` stays green, because `validarInventario` accepts the entry;
- the commit carries the two JSON files.

## 3. Map (after deploy, outside 23:30–01:00 and 08:00–08:45 BRT)

- `/gsc/mapa/tapepro` → 200, with 32 leaves, each in one of the 5 states (SC-001).
- Top 20, Top 3 penetration and TAM no longer say "inventário de termos não declarado".

## 4. Plan

- `/gsc/mapa/tapepro/plano` shows:
  - the Demanda block;
  - metas for the 18 KPIs, each leaf with a seal and a `conta` (SC-002);
  - the default premises 3 / 2 / 12.
- Approve every meta as Jean, then activate. Check that:
  - the version becomes `ativo`;
  - `hub_plano_meta` has `decidido_por = 'jean'` on every row (SC-006);
  - an approved meta cannot be edited without "nova versão".
- The calendar shows the current week's task, responsible and milestone without a click (SC-003).
- Open the map and the plan with the DevTools network tab open: no request to DataForSEO or Google
  (SC-005).
- `/gsc/mapa/tapepro` shows "Plano · semana 1 de 26" with the demand milestones as `nao-chegou`.
- Take screenshots of both routes at 3 widths, plus a keyboard pass (`ui-verification`).

## 5. Clarification of 2026-09-28, in production

- After the deploy, outside the windows, trigger one indexing run by hand (`POST /api/indexacao`, the
  same way the workflow does). Then check that every Tape Pro sitemap URL has a verdict in
  `lerIndexacaoPorUrl`, adding up the days. The run inspects a cota-limited sample (research D12), so a
  missing URL means it is past the cota, not a bug. Before that run, every page says `sem leitura` and
  has the `indexacao` task, which is expected.
- After the next daily crawl, `hub_pagina.h1` is filled for Tape Pro. Until then, the Demanda block
  says "H1 não lido nesta corrida".
- `/gsc/mapa/tapepro/plano`:
  - the two product pages show their state;
  - week 1 is not empty;
  - the 90-day `top20` meta counts only what `ativa` pages cover by title or H1;
  - the demand `conta` lists terms and volume per page.
- `/gsc/mapa/tapepro`: the "Plano · semana N" block shows the map's cards with their origin, and one
  task per lever.
