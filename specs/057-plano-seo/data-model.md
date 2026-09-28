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

State transitions:
- `hub_plano.estado`: `rascunho` → `ativo` (when every meta has a decision; activating a version moves
  the previous `ativo` to `encerrado`) → `encerrado`.
- A meta without a row is "proposta". Deciding inserts; changing a decision updates, only while the
  version is `rascunho`. After `ativo`, a change requires a new version (FR-017, SC-006).

## 3. Derived (pure, `lib/plano.mjs`, never stored)

| Object | Shape | From |
|---|---|---|
| Cluster | `{semente, termos: [{termo, volume, segmento?}], volume, pagina: url \| null}` | `agrupar()` over the frozen demand, plus `lerCrawlDePagina()` for `pagina` |
| MetaProposta | `{chave, prazo, origem, valor, op, conta, aviso?, partida?}` | `propor()` over clusters, `REGRAS`, `benchmark()`, the plan premises and, for demand metas, the `gscTermos` starting point (research D11) |
| Semana | `{n, inicio, tarefas: Tarefa[], marcos: {chave: valor}}` | `montar()`, over the approved metas (research D11) |
| Tarefa | `{alavanca, alvos: string[], kpis: string[], responsavel, feita: boolean}` | `montar()`, plus 055 marcas (`feita` = marca `marcado` ≥ week start) |
| Comparacao | `{chave, marco, lido, estado, sugerirRefazer}`, where estado ∈ `nao-chegou \| no-marco \| abaixo \| acima \| sem-leitura` | `comparar()` over marcos, the map's `leituras` and the reading of the window shifted 7 days back (research D11) |

Validation (`lerDecisao`, `lerPlano`) is pure and tested, like `lerMarca` (055). Input outside the
contract writes nothing:
- `responsavel` must be `jean` or `maria`;
- `chave` must be a `CATALOGO` key or a headline;
- `prazo` must be 90 or 180;
- `valor` must be finite;
- `capacidade` must be an integer from 0 to 20;
- the premises must be integers from 0 to 26.
