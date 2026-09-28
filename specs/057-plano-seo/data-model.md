# Data model — 057 Plano de SEO

## 1. Frozen files (committed, written only by `scripts/consultar-demanda.mjs --gravar`)

### `data/inventario-de-termos.json` → new entry `tapepro`

Same shape that `lib/inventario.mjs#validarInventario` already validates. There is no schema change.

```jsonc
"tapepro": {
  "procedencia": {
    "congeladoEm": "2026-09-2X",
    "janela": { "inicio": "<data da consulta>", "fim": "<data da consulta>" },
    "piso": 10,                       // volume mensal mínimo para entrar
    "dimensao": "volume Google Ads (DataForSEO keywords_for_keywords)",
    "hosts": ["tapepro.roilabs.com.br"],
    "excluiMarca": ["tapepro", "tape pro"],
    "excluidos": { "<termo>": "<motivo>" },   // new, optional; ignored by validarInventario
    "porque": "termos do nicho com volume ≥ 10/mês no Brasil, a partir das sementes <lista>"
  },
  "termos": ["fita gomada", "..."]
}
```

### `data/demanda-estimada.json` → new entry `tapepro`

The same `{procedencia, termos: {termo: número}}` that `coberturaDaDemanda()` reads. For Tape Pro the
number is the monthly volume, not an impression floor. `procedencia` adds these fields:
- `fonte: "dataforseo google_ads keywords_for_keywords"`
- `regiao: "Brazil"`
- `idioma: "pt"`
- `custoUsd`, the `cost` returned by the API
- `sementes`
- `movidos: {termo: cluster}`

The map's TAM ressalva must follow `procedencia.fonte`: "estimativa, teto" only when the source is the
GSC floor.

## 2. Postgres (created in `ensure()`, `lib/db.ts`)

```sql
-- 057: one row per plan version. A new proposal is a new version; nothing is overwritten (FR-017).
CREATE TABLE IF NOT EXISTS hub_plano (
  projeto TEXT NOT NULL,
  versao INT NOT NULL,
  criado DATE NOT NULL,
  criado_por TEXT NOT NULL,               -- "jean" | "maria"
  inicio DATE NOT NULL,                   -- Monday of week 1
  capacidade INT NOT NULL,                -- pages per week, default 3
  semanas_indexar INT NOT NULL,           -- default 2, "◇ política do dono, sem fonte"
  semanas_estabilizar INT NOT NULL,       -- default 12, same seal
  estado TEXT NOT NULL,                   -- rascunho | ativo | encerrado
  PRIMARY KEY (projeto, versao)
);
-- 057: the owner's decision on each proposed meta. The proposal itself is recomputed; this row keeps
-- the proposed value as it was on the decision day (FR-009).
CREATE TABLE IF NOT EXISTS hub_plano_meta (
  projeto TEXT NOT NULL,
  versao INT NOT NULL,
  chave TEXT NOT NULL,                    -- CATALOGO key, or "cliques" | "impressoes" | "pagina1" (headline)
  prazo INT NOT NULL,                     -- 90 | 180, fixed horizons (days from inicio); the owner moves inicio (FR-008)
  origem TEXT NOT NULL,                   -- demanda | regua | norma | meta | politica
  proposto TEXT NOT NULL,                 -- JSON number, as proposed
  valor TEXT,                             -- JSON number, final; NULL when recusada
  conta TEXT NOT NULL,                    -- the arithmetic, human-readable
  estado TEXT NOT NULL,                   -- aprovada | editada | recusada
  decidido_por TEXT NOT NULL,
  decidido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (projeto, versao, chave, prazo)
);
```

### Added by the clarification of 2026-09-28 (research D12–D14)

```sql
-- 057/D14: the new premise of FR-005a, on the plan version like the other three.
ALTER TABLE hub_plano ADD COLUMN IF NOT EXISTS piso_apoio INT NOT NULL DEFAULT 100;  -- "◇ política do dono, sem fonte"

-- 057/D12: the per-URL verdict the indexing run already reads and used to drop. One row per URL per
-- run. Written as DELETE (projeto, dia) + multi-row INSERT, like hub_pagina, so a URL that left the
-- sitemap disappears instead of lingering. classe = classificar() from lib/indexacao-corrida.mjs.
-- 'falha' is "not read", never "out of the index".
CREATE TABLE IF NOT EXISTS hub_indexacao_url (
  projeto TEXT NOT NULL,
  dia DATE NOT NULL,
  url TEXT NOT NULL,
  classe TEXT NOT NULL,                   -- indexada | rastreada_nao_indexada | descoberta_nao_indexada | outra | falha
  PRIMARY KEY (projeto, dia, url)
);

-- 057/D14: the H1 next to the title. NULL on rows before the change = "not read", not "no H1".
ALTER TABLE hub_pagina ADD COLUMN IF NOT EXISTS h1 TEXT;
```

`PaginaCrawl` (TS) gains `h1: string | null`.

`lerIndexacaoPorUrl(projeto)` returns the latest verdict of each URL, `Record<url, {classe, dia}>`
(`DISTINCT ON (url) … ORDER BY url, dia DESC`), or `null` when there has never been a run. It does not
return "the latest day", because the run inspects a cota-limited sample (research D12, speckit-analyze
C2).

State transitions:
- `hub_plano.estado`: `rascunho` → `ativo` (when every meta has a decision; activating a version moves
  the previous `ativo` to `encerrado`) → `encerrado`.
- A meta without a row is "proposta". Deciding inserts; changing a decision updates, only while the
  version is `rascunho`. After `ativo`, a change requires a new version (FR-017, SC-006).

## 3. Derived (pure, `lib/plano.mjs`, never stored)

| Object | Shape | From |
|---|---|---|
| Cluster | `{semente, termos: [{termo, volume, segmento?, cobertoPor: url \| rótulo \| null}], volume, pagina: url \| null, estadoDaPagina}` | `agrupar()` over the frozen demand, plus `lerCrawlDePagina()` for `pagina` and `cobertoPor` (D14), plus `estadoDaPagina()` (D13) |
| EstadoDaPagina | `ativa \| indexada-sem-impressao \| fora-do-indice \| sem-leitura` | `estadoDaPagina(url, {classes, impressoes})`: `hub_indexacao_url` × `gscPaginas` (D13) |
| PaginaAgendada | `{tipo: cluster \| apoio-segmento \| apoio-termo, semente, segmento?, termo?, volume, semana, alvo, cobre: string[]}` | `agendaDePaginas()`; `apoio-termo` = FR-005a, `volume ≥ pisoApoio`, not covered (D14) |
| MetaProposta | `{chave, prazo, origem, valor, op, conta, aviso?, partida?}` | `propor()` over clusters, `REGRAS`, `benchmark()`, the plan premises and, for demand metas, the `gscTermos` starting point (research D11) |
| Semana | `{n, inicio, tarefas: Tarefa[], marcos: {chave: valor}}` | `montar()`, over the approved metas (research D11) |
| Tarefa | `{alavanca, alvos: string[], kpis: string[], responsavel, feita: boolean, origem: ("calendario" \| "mapa")[]}` | `montar()`, plus 055 marcas (`feita` = marca `marcado` ≥ week start). A week-1 task for an existing page that is not `ativa` (D15) is part of the calendar. `semanaComCards()` adds `"mapa"` to the current week only (D16) |
| Comparacao | `{chave, marco, lido, estado, sugerirRefazer}`, where estado ∈ `nao-chegou \| no-marco \| abaixo \| acima \| sem-leitura` | `comparar()` over marcos, the map's `leituras` and the reading of the window shifted 7 days back (research D11) |

Validation (`lerDecisao`, `lerPlano`) is pure and tested, like `lerMarca` (055). Input outside the
contract writes nothing:
- `responsavel` must be `jean` or `maria`;
- `chave` must be a `CATALOGO` key or a headline;
- `prazo` must be 90 or 180;
- `valor` must be finite;
- `capacidade` must be an integer from 0 to 20;
- `pisoApoio` must be an integer from 1 to 100000;
- the premises must be integers from 0 to 26.
