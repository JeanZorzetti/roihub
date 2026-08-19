# Contrato: `lib/seo-score.mjs`

Módulo JS puro (sem React/Next), mesmo formato de `lib/score.mjs`. Único ponto de entrada consumido por `app/seo/page.tsx`.

## Export: `WEIGHTS`

```js
export const WEIGHTS = { clicks: 0.4, ctr: 0.3, position: 0.2, impressions: 0.1 };
```

Constante, não uma função — mesma convenção de `lib/score.mjs::WEIGHTS`, para permitir que testes e (futuramente) UI leiam os pesos sem duplicar o número mágico.

## Export: `rankBySeoScore(inputs)`

```js
/**
 * @param {{ slug: string, nome: string, clicks: number, ctr: number|null, position: number|null, impressions: number }[]} inputs
 *   Um item por projeto com dado GSC (t !== null). ctr/position `null` são tratados como pior valor.
 * @returns {{ slug: string, score: number, components: { clicks: number, ctr: number, position: number, impressions: number }, rank: number }[]}
 *   Mesma ordem de `inputs` NÃO é preservada — o retorno já vem ordenado por score desc
 *   (desempate: clicks bruto desc, depois nome asc), com `rank` 1-based atribuído nessa ordem.
 */
export function rankBySeoScore(inputs) { /* ... */ }
```

### Pré-condições

- `inputs` contém apenas projetos com `t !== null` (dado GSC real). Projetos `SEED` não são passados a esta função — seguem tratados em `app/seo/page.tsx` como hoje.
- Array vazio é uma entrada válida → retorna `[]`.

### Pós-condições

- `result.length === inputs.length`.
- `result` ordenado por `score` desc; em empate exato, por `components` originado de `clicks` bruto desc; em novo empate, por `nome` (do input correspondente) asc.
- `rank` é uma sequência 1..N sem lacunas, na ordem do array retornado.
- `score` é um inteiro em `[0, 100]`.
- Cada valor em `components` é um número em `[0, 1]`.
- Determinístico: mesma entrada (mesmos valores, independente da ordem em que chegam em `inputs`) sempre produz o mesmo `result` (mesmo conteúdo e mesma ordem).

### Consumo em `app/seo/page.tsx`

```ts
import { rankBySeoScore } from "@/lib/seo-score.mjs";

const withData = rows.filter((r) => r.t !== null);
const withoutData = rows.filter((r) => r.t === null);
const ranked = rankBySeoScore(
  withData.map((r) => ({
    slug: r.slug,
    nome: r.nome,
    clicks: r.t.current.clicks,
    ctr: r.t.current.ctr,
    position: r.t.current.position,
    impressions: r.t.current.impressions,
  }))
);
const rankBySlug = new Map(ranked.map((r) => [r.slug, r]));
const orderedRows = [
  ...withData.sort((a, b) => rankBySlug.get(a.slug).rank - rankBySlug.get(b.slug).rank),
  ...withoutData, // SEED sempre por último, ordem atual preservada
];
```

Isso substitui a linha 31 atual (`rows.sort((a, b) => (b.t?.current.impressions ?? -1) - (a.t?.current.impressions ?? -1));`).
