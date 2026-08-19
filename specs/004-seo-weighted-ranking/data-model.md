# Data Model: Ranking Ponderado de Projetos na Página SEO

Nenhuma entidade persistida é criada — tudo é derivado em memória a cada request (`force-dynamic`). As "entidades" abaixo são formas de dado que passam a existir na função de score.

## Window28 (existente, sem alteração)

Já produzido por `lib/series.mjs::totals28` e consumido em `app/seo/page.tsx`.

| Campo | Tipo | Observação |
|---|---|---|
| `clicks` | `number` | soma absoluta na janela de 28 dias |
| `impressions` | `number` | soma absoluta na janela de 28 dias |
| `position` | `number \| null` | ponderada por impressões; `null` quando `impressions === 0` |
| `ctr` | `number \| null` | `clicks / impressions`; `null` quando `impressions === 0` |

## SeoScoreInput (novo, interno a `lib/seo-score.mjs`)

Um item por projeto com dado GSC, extraído de `Row.t.current` (ver `app/seo/page.tsx` tipo `Row`).

| Campo | Tipo | Observação |
|---|---|---|
| `slug` | `string` | chave de identidade do projeto (já existe em `Project`) |
| `nome` | `string` | usado como critério final de desempate |
| `clicks` | `number` | de `Window28.clicks` |
| `ctr` | `number` | de `Window28.ctr`, com `null` tratado como `0` na entrada da normalização |
| `position` | `number` | de `Window28.position`, com `null` tratado como pior valor (equivalente a CTR 0) |
| `impressions` | `number` | de `Window28.impressions` |

## SeoScoreResult (novo, retornado por `lib/seo-score.mjs`)

| Campo | Tipo | Observação |
|---|---|---|
| `slug` | `string` | referência de volta ao projeto |
| `score` | `number` | 0–100, arredondado, mesma escala visual de `lib/score.mjs::computeScore` |
| `components` | `{ clicks: number; ctr: number; position: number; impressions: number }` | os 4 valores normalizados (0–1) que formaram o score, para exibição (FR-008) |
| `rank` | `number` | posição 1-based no ranking (para o badge #1/#2/#3...) |

## Regras de validação / cálculo

1. Normalização min-max é calculada **uma vez por render**, sobre o conjunto de `SeoScoreInput` de todos os projetos com `t !== null` presentes na página naquele momento (não é um valor global fixo). Ver `research.md`.
2. `position` entra na normalização como `-position` (inversão) antes do min-max, para que "menor posição bruta" vire "maior valor normalizado".
3. Quando `max === min` para uma métrica (todos os projetos empatados nela, incluindo o caso de um único projeto com dado), o componente normalizado dessa métrica é `1` para todos — evita divisão por zero e não penaliza artificialmente por falta de variância.
4. `score = round(100 * (0.4·clicksNorm + 0.3·ctrNorm + 0.2·positionNorm + 0.1·impressionsNorm))`.
5. Ordenação final: `score` desc → `clicks` (bruto) desc → `nome` asc.
6. Projetos com `t === null` não entram em `SeoScoreInput`/`SeoScoreResult` — continuam tratados à parte em `app/seo/page.tsx` exatamente como hoje (rótulo `SEED`, sempre ao final).
