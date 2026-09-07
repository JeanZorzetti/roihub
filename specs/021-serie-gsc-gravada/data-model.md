# Data Model: Série do GSC gravada e os sete KPIs de busca

**Feature**: `021-serie-gsc-gravada` | **Date**: 2026-09-07

---

## 1. Persistido — `hub_gsc_dia`

Criada no `ensure()` de `lib/db.ts`, junto das outras, com `CREATE TABLE IF NOT EXISTS`.

| Coluna | Tipo | Notas |
|---|---|---|
| `projeto` | `TEXT NOT NULL` | o `slug` de `listProjects()`, nunca o rótulo de exibição |
| `dia` | `DATE NOT NULL` | dia da medição no fuso do GSC |
| `impressoes` | `INT NOT NULL` | |
| `cliques` | `INT NOT NULL` | |
| `posicao` | `REAL` | posição média do dia; `NULL` quando o GSC não devolve |
| `criado` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | quando esta linha foi (re)gravada |

**PK**: `(projeto, dia)` — a chave que torna a corrida idempotente (FR-002).

**Escrita**: `ON CONFLICT (projeto, dia) DO UPDATE SET impressoes = EXCLUDED.impressoes,
cliques = EXCLUDED.cliques, posicao = EXCLUDED.posicao, criado = now()`, o mesmo padrão de
`gravarEstado` (`lib/db.ts:755`). Regravar é obrigatório, não tolerado: o dia dentro de D-3 é
provisório (D4 em [research.md](./research.md)).

### CTR não é coluna

A FR-001 pede CTR, e ele é `cliques ÷ impressoes` — exato, sempre. Uma coluna gravada só cria a
chance de divergir da própria divisão. Fica derivado na leitura. `impressoes = 0` ⇒ CTR é
**indefinido**, não zero: exibir 0% para uma página sem impressão nenhuma inventa um desempenho
ruim onde não houve medição.

### `projeto` é o slug

Chave é slug, nunca nome de exibição — o repo já pagou por essa confusão
(`rótulo de exibição nunca é chave`). Um projeto renomeado mantém a série; um projeto cujo slug
muda perde, e isso é aceito: slug é identidade.

---

## 2. Em memória — a entrada dos cálculos

`lib/kpis-busca.mjs` **não** conhece rede nem banco. Recebe um array e devolve números.

```js
/** Uma linha de query+page da janela de descoberta, como o GSC devolve.
 *  @typedef {{query: string, page: string, cliques: number, impressoes: number, posicao: number}} LinhaBusca */
```

A borda (`.ts`) mapeia `GscPageRow` (`keys: [query, page]`) para essa forma antes de chamar. O
módulo puro nunca vê `keys[0]`/`keys[1]` — nomear na fronteira é o que torna os testes legíveis.

---

## 3. Em memória — a saída

```js
/** @typedef {{consulta: string, url: string, impressoes: number, cliques: number, posicao: number, ctr: number, benchmark: number, atinge: boolean}} Candidata */
```

| KPI | Forma | Regra |
|---|---|---|
| Consultas únicas | `{valor: number, piso: true}` | `query` distintas. **Sempre** marcado como piso (FR-009): a dimensão omite as raras |
| Consultas no Top 20 | `number` | `posicao` de 1,0 a 20,0 inclusive |
| % de impressões no Top 3 | `number \| null` | impressões com `posicao` 1,0–3,9 ÷ total. `null` quando o total é 0 |
| URLs com impressão | `number` | `page` distintas com `impressoes ≥ 1`. Contagem, **não** razão (FR-013) |
| Striking Distance | `Candidata[]` | `posicao` 4,0–10,9, ordenado por `impressoes` desc |
| CTR vs benchmark | `Candidata[]` | `atinge = ctr ≥ benchmark(posicao)` |
| CTR Gap | `number \| null` | fração de URLs com `atinge`. `null` quando não há URL |
| Canibalização | `{consulta, urls: {url, posicao, impressoes}[]}[]` | só consultas com 2+ `page` distintas |

### A tabela de benchmark

Constante do board, em `lib/kpis-busca.mjs`:

| Faixa de posição | CTR mínimo |
|---|---|
| 1,0 – 1,9 | 25% |
| 2,0 – 2,9 | 13% |
| 3,0 – 3,9 | 8% |
| 4,0 – 6,9 | 4,5% |
| 7,0 – 10,9 | 2% |
| > 10,9 | sem benchmark |

Acima da posição 10,9 o board não define piso, e inventar um faria toda a cauda longa parecer
reprovada. `benchmark()` devolve `null` nessa faixa, e a linha fica **fora** do CTR Gap em vez de
contar como falha.

---

## 4. Fronteiras de faixa

As faixas são escritas com uma casa decimal de propósito. A posição do GSC é uma **média**, então
7,0 e 10,9 existem de verdade e caem em faixas diferentes. Faixas coladas por inteiro
("4 a 10") deixariam 10,5 fora de tudo. Os limites das faixas acima são contíguos e cobrem todo
o intervalo de 1,0 a 10,9 sem buraco e sem sobreposição — e há teste para cada borda
(3,9 / 4,0 / 6,9 / 7,0 / 10,9 / 11,0).

---

## 5. O que esta feature NÃO modela

- **`query` por dia.** Sem isso, "crescimento de consultas únicas por trimestre" continua
  incalculável. Decisão consciente (D3), não esquecimento.
- **Termo de marca.** Sem lista de marca por projeto e sem corte por país, marca vs não-marca
  mente. Fora de escopo por decisão da spec.
- **Total de URLs indexadas.** É o denominador ausente que rebaixa o Active Index Ratio a uma
  contagem nesta feature.
