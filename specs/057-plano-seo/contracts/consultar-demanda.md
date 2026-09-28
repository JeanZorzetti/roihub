# Contract — `scripts/consultar-demanda.mjs`

```
node --env-file=.env scripts/consultar-demanda.mjs <slug> [--sementes "a,b,c"] [--consultar] [--gravar]
     [--mover "termo=semente"]... [--excluir "termo:motivo"]...
```

| Mode | Spends money | Writes | Prints |
|---|---|---|---|
| no flag | no | nothing | seeds, region, balance (`GET /v3/appendix/user_data`), estimated cost of one task |
| `--consultar` | yes, 1 task | nothing | actual `cost`, terms kept/dropped (piso, marca), clusters with volume, `semCluster` |
| `--consultar --gravar` | yes, 1 task | tapepro entries in `data/inventario-de-termos.json` and `data/demanda-estimada.json` | same, plus the paths written |

Rules:
- `DATAFORSEO_API_KEY` missing or blank → exit 2, printing only the variable name (Principle V). The
  key is never printed, logged or written.
- If the balance is below the estimated cost, the script exits before consulting and says how much is
  missing (FR-003a).
- Region comes from the project's `areaServed`, `BR` → `Brazil`, and `--regiao` overrides it. Language
  is `pt`.
- Seeds default to `produtos` of the slug in `lib/autopublish-projects.mjs`, with hyphens turned into
  spaces. Segments are markers only, not expansion seeds.
- The script drops terms below `piso` (10/month) and brand terms (`regexDeMarca`). Drops are counted in
  the output, not silently.
- `--mover` and `--excluir` are applied after `agrupar()` and recorded in `procedencia`
  (`movidos`, `excluidos`).
- An API error or a partial response writes nothing (spec edge case "consulta que falha").
- Writing re-runs `validarInventario` on the result before touching disk.
- `--gravar` refuses to overwrite an existing entry whose `procedencia.fonte` is not DataForSEO (the
  034 inventory and 050 GSC-floor demand of Atma and Sirius), exits 1 and names the entry (research D11).
