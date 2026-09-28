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
- **`lerDecisao` / `lerPlano`**: reject bad responsavel, key, horizon, value and capacity.

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
