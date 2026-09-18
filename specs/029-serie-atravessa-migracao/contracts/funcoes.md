# Contratos — 029

## Funções puras novas (`lib/serie-gsc.mjs`)

```js
/**
 * Soma as séries de vários hosts num dia só. Chave: o dia.
 * Dia presente num host e ausente no outro entra com o que existe — ausência de linha no GSC é
 * "zero impressão naquele host", não "dia não medido".
 *
 * @param {{host: string, days: {date: string, clicks?: number, impressions?: number, position?: number}[]}[]} series
 * @returns {{date: string, clicks: number, impressions: number, position: number|null}[]} em ordem
 */
export function somarSeriesPorHost(series)
```

- `position` é a média ponderada por impressão dos hosts que a reportaram; `null` quando o dia não
  tem impressão em host nenhum.
- `series` vazio devolve `[]`. Um host só devolve os dias daquele host, sem alterar nada.

```js
/**
 * A assinatura de um conjunto de hosts: normalizada, sem repetição, ordenada, unida por `+`.
 * @param {string[]} hosts
 * @returns {string|null} `null` para lista vazia
 */
export function assinaturaDeHosts(hosts)
```

```js
/**
 * Todos os hosts da assinatura estão entre os declarados?
 * Assinatura ausente (`null`) devolve `true`: linha gravada antes da coluna existir não é evidência
 * de outro site — é ignorância, e a 026 já a tratava assim.
 *
 * @param {string|null} assinatura
 * @param {string[]} declarados
 * @returns {boolean}
 */
export function dentroDoDeclarado(assinatura, declarados)
```

## Funções alteradas (`lib/marca.mjs`)

```js
export function segmentosPorHost(dias, declarados = [])
export function semanasNaoMarca(dias, declarados = [])
export function ritmoDoSegmentoAtual(dias, declarados = [])
```

Regra nova, idêntica nas três: duas assinaturas que **cabem no mesmo conjunto declarado** são o
mesmo site. Assinatura fora do declarado continua abrindo segmento novo e continua marcando a
semana com `host: null` (FR-015).

`declarados` vazio ⇒ comportamento atual, byte a byte. É o que mantém os 34 projetos sem migração
fora do alcance desta feature, e é o caso do teste de regressão.

## Gravação (`lib/db.ts`)

```ts
gravarDiasGsc(projeto: string, dias: DiaGsc[], host: string | null, declarados?: string[]): Promise<number>
gravarMarcaGsc(projeto: string, pais: string, dias: DiaDeMarca[], host: string | null, declarados?: string[]): Promise<{...}>
```

A guarda passa de igualdade de host para pertinência ao conjunto declarado:

```sql
WHERE hub_gsc_dia.host IS NULL
   OR (SELECT bool_and(h = ANY($declarados::text[]))
         FROM unnest(string_to_array(hub_gsc_dia.host, '+')) AS h)
```

`declarados` ausente ou vazio ⇒ a guarda antiga (`IS NOT DISTINCT FROM`), para que nenhum chamador
que não saiba desta feature afrouxe a proteção por omissão.

## Rota `POST /api/gsc-serie`

**Entrada** (corpo opcional, JSON): `{ "desde": "YYYY-MM-DD" }` — substitui o início da janela do
TOTAL. Ausente: janela incremental de sempre. Data inválida: `400`, sem tocar em nada.

**Saída** — campos novos, os demais inalterados:

```jsonc
{
  "gravados": { "atma": 6 },
  "somados": { "atma": ["atma.roilabs.com.br", "usealigner.com"] },  // hosts que entraram na soma
  "encerrados": [ { "projeto": "atma", "host": "x.com" } ],          // declarado, sem propriedade
  "recusados": [ { "projeto": "atma", "host": "...", "dias": 0 } ],  // barrados pela guarda
  "falhas":    [ { "projeto": "atma", "erro": "..." } ]              // host que FALHOU: nada gravado
}
```

`somados` é o que torna a corrida auditável sem abrir o banco: se um host sumir da lista sem que
ninguém tenha mexido na declaração, a soma encolheu e o número do dia encolheu junto.
