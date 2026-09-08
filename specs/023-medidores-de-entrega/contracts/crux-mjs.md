# Contrato: `lib/crux.mjs` — o módulo puro

**Feature**: 023 | **Princípio III**: lógica pura em `.mjs`, testável sem subir o Next.

Este módulo **não** faz `fetch`, **não** lê `process.env`, **não** olha o relógio e **não**
importa `pg`. Recebe a leitura já resolvida e devolve células prontas. É o que torna a distinção
404/falha, a formatação de cada unidade, as bordas de veredito e o Pass Rate de amostra 1
testáveis sem gastar uma chamada.

---

## Exportações

### `VITAIS`

```js
/** @type {readonly {id, chaveCrux, limite, ideal, unidade}[]} */
export const VITAIS
```

Os quatro do §1 do [data-model](../data-model.md), nesta ordem: `lcp`, `inp`, `cls`, `ttfb`.

**Garantia**: `VITAIS.map(v => v.id)` é subconjunto de `MEDIDORES.D2` (`lib/ficha.mjs`). O teste
amarra as duas listas — um `id` fora do catálogo não teria onde aparecer na ficha, e a divergência
não apareceria em build.

---

### `SLUGS_DE_CAMPO`

```js
export const SLUGS_DE_CAMPO = ["atma"];
```

FR-014. Ver D8 da pesquisa: `projetosDeBusca()` não existe no repo, e criá-la para um consumidor
seria abstração com um cliente.

---

### `dataCrux(d)`

```js
/** @param {{year:number,month:number,day:number}} d @returns {string} `YYYY-MM-DD` */
export function dataCrux(d)
```

A CrUX manda `{year, month, day}` com `month` **1-based**. Função separada e testada de propósito:
misturar essa base com a do `Date` do JS produz erro de um mês que ninguém percebe olhando a tela.

**Entrada inválida** (campo ausente, não finito) devolve `null` — e a janela some do rótulo em vez
de virar `"NaN-NaN-NaN"`.

---

### `medirRecord(record)`

```js
/** @param {RecordCrux} record @returns {Map<string, Medida>} */
export function medirRecord(record)
```

Extrai as `Medida` que o record contém — **só as que contém**.

| entrada | saída |
|---|---|
| `metrics` com os quatro | `Map` de 4 entradas |
| `metrics` sem `experimental_time_to_first_byte` | `Map` de 3 — os outros **intactos** (FR-008) |
| `p75` como string (`"0.08"`) | normalizado para número |
| `p75` não finito, ausente, `null` | a entrada **não existe** no `Map` |

**Invariante que carrega a FR-004**: nenhuma `Medida` existe sem `p75` finito. Não há como
produzir veredito sobre ausência — a garantia é do tipo, não da disciplina de quem escreve a tela.

`veredito` = `p75 <= limite ? "dentro" : "fora"`. Limite **inclusivo** ("≤" no board).

`experimental` = `chaveCrux.startsWith("experimental_")` (D5) — não uma lista fixa, para a
rotulagem parar sozinha quando o Google promover a métrica.

---

### `formatarValor(vital, p75)`

```js
/** @returns {string} */
export function formatarValor(vital, p75)
```

FR-013 sai daqui, por construção:

| vital | regra | exemplo |
|---|---|---|
| `lcp` | `p75 / 1000`, 1 casa, vírgula, sufixo `" s"` | `2437` → `"2,4 s"` |
| `inp`, `ttfb` | arredondado, sufixo `" ms"` | `187.4` → `"187 ms"` |
| `cls` | 2 casas, vírgula, **sem sufixo** | `0.083` → `"0,08"` |

O CLS não tem `unidade`, e é a ausência do campo que impede o `" s"` — não um `if (id === "cls")`
espalhado pela formatação.

---

### `rodape(medida, alvo)`

```js
/** @returns {string} a `fonte` da célula */
export function rodape(medida, alvo)
```

Sempre a mesma ordem, sempre os quatro fatos (FR-005, FR-006, FR-007, FR-010):

```
p75 de campo · CrUX 2026-08-10→2026-09-06 · todos os dispositivos · meta ≤ 2,5 s: dentro
```

- TTFB acrescenta o ideal **ao lado** do limite, nunca no lugar: `meta ≤ 600 ms (ideal < 300 ms)`.
- `experimental === true` acrescenta ` · experimental na fonte`.
- `janela` ausente (`dataCrux` devolveu `null`) **omite o trecho** — nunca datas inventadas.

---

### `celulasDeVitais(leitura, alvo)`

```js
/** @param {LeituraDaFonte} leitura @param {Alvo} alvo
 *  @returns {Record<"lcp"|"inp"|"cls"|"ttfb", CelulaDeVital>} */
export function celulasDeVitais(leitura, alvo)
```

**Sempre devolve as quatro chaves.** É a função inteira da FR-003.

| `leitura.estado` | as quatro células |
|---|---|
| `"record"` | apurada onde há `Medida`; `sem amostra suficiente na fonte para <vital>` onde a métrica faltou |
| `"sem-amostra"` | as quatro com `sem amostra suficiente na fonte de campo para <alvo>`, **sem** `rotuloBuraco` |
| `"falhou"` | as quatro com `CrUX indisponível (<erro>)` e `rotuloBuraco: "falhou-agora"` |
| `"sem-chave"` | as quatro com `CRUX_API_KEY ausente`, **sem** `rotuloBuraco` |

Regras que o teste fixa:

- **`"sem-amostra"` nunca ganha `rotuloBuraco`.** Ausência de observação não é falha, e a tela lê
  "não apurado", não "falhou agora".
- **`"sem-chave"` nomeia só a variável** (FR-011). Nunca valor, prefixo ou comprimento.
- **Nenhum caminho produz `valor: 0`, `"dentro"` ou `"fora"` sem `Medida`** (FR-004). Não existe
  ramo no código onde isso seja expressável.
- Um `record` que veio com **zero** métricas conhecidas produz quatro ausências — não um erro.

---

### `passRate(leiturasPorUrl, consultadas)`

```js
/** @param {Map<string, LeituraDaFonte>} leiturasPorUrl @param {number} consultadas
 *  @returns {PassRate} */
export function passRate(leiturasPorUrl, consultadas)
```

FR-009, sobre **LCP, INP e CLS** — o TTFB é experimental e não entra na definição de "Bom".

- `comDado` = quantas leituras têm `estado: "record"` com os três vitais medidos.
- `passam` = quantas dessas têm os três `veredito: "dentro"`.
- **`comDado < 2` ⇒ `fracao: null` e `motivo` preenchido.** A regra literal da FR-009 e do
  AC3 da US3: uma URL com dado devolve a explicação, **nunca `1`**.
- `comDado >= 2` ⇒ `fracao = passam / comDado` e `motivo: null`.

**Invariante**: exatamente um de `fracao`/`motivo` é não-nulo. Nunca ambos, nunca nenhum — é o que
faz a tela ser incapaz de exibir fração sem denominador ou silêncio sem explicação.

O `motivo` cita `comDado` e `consultadas`, não só a ausência (SC-006): quem lê precisa entender
que é característica do site, não defeito do hub.

`CAP_URLS_PASS_RATE` é exportado junto — constante, para o teste medir o corte sem chamar a rede.

---

## O que este módulo NÃO faz

- Não fala com a rede, não lê env, não conhece `slug` além de `SLUGS_DE_CAMPO`.
- **Não mistura origem e URL.** Não existe função que receba os dois e devolva um número — a
  proibição de Edge Cases é estrutural, não uma convenção.
- Não decide onde a célula aparece na tela. Isso é `montarN5()`, que já existe.

---

## Teste

`test/crux.test.mjs`, registrado na lista de `package.json` **no mesmo commit** (Princípio II).
Cobertura mínima, um caso por invariante acima — com destaque para:

- `2500` é `dentro` e `2501` é `fora` (limite inclusivo).
- `"sem-amostra"` e `"falhou"` produzem textos **diferentes** e só o segundo tem `rotuloBuraco`.
- `experimental_time_to_first_byte` ausente deixa os outros três apurados.
- `comDado === 1` devolve `motivo`, e `fracao` é `null`.
- CLS formatado sem `" s"`.
