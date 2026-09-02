# Contrato — N4 por canal (camada pura, `lib/ficha.mjs`)

**Feature**: `013-n4-canais-ga4-somado`

Tudo aqui é função pura: sem env, sem banco, sem rede, sem relógio (Princípio III). É o que
`test/ficha.test.mjs` — **arquivo já registrado em `npm test`** — consegue reprovar sem subir o
Next.

---

## `mapearCanaisGa4(linhas)`

```js
/**
 * @param {{grupo:string, sessoes:number}[]} linhas  cruas da GA4 Data API
 * @returns {{
 *   porCanal: Record<"direto"|"pago"|"indicacao"|"social", number>,
 *   organicoIgnorado: number,
 *   foraDoCatalogo: {grupo:string, sessoes:number}[]
 * }}
 */
```

**Garantias**:

1. `porCanal` sempre traz as **quatro** chaves, `0` quando o grupo não veio nas linhas (FR-004).
2. `Organic Search` **nunca** entra em `porCanal`; seu volume vai para `organicoIgnorado`, que a
   nota do nível nomeia (FR-005a).
3. Grupo desconhecido vai **inteiro** para `foraDoCatalogo`, preservando o nome recebido do GA4.
   Nunca é somado a canal existente, nunca é descartado (FR-009).
4. `sessoes` não numérico ou negativo é tratado como grupo desconhecido, não como `0` — número
   estranho que vira zero é o defeito da R1 pela porta dos fundos.
5. Função total: `[]` devolve as quatro chaves em `0`, `organicoIgnorado: 0`, `foraDoCatalogo: []`.

**Mapa** (D3 da pesquisa) — constante exportada, para o teste conferir sem duplicar a tabela:

```js
export const GRUPOS_GA4 = {
  "Direct": "direto",
  "Referral": "indicacao",
  "Organic Social": "social",
  "Paid Search": "pago", "Paid Social": "pago", "Paid Shopping": "pago",
  "Paid Video": "pago", "Paid Other": "pago", "Display": "pago", "Cross-network": "pago",
};
```

`outbound` **não aparece no mapa**, e é assim de propósito.

---

## `montarN4(canais, cliquesCelula, marcos, ga4, janela)`

Assinatura de hoje mais dois parâmetros. Chamadores antigos que passem três argumentos continuam
válidos (`ga4` indefinido = não configurado) — o que mantém `test/ficha.test.mjs` verde sem edição
nas asserções que já existem.

```js
/**
 * @param {string[]} canais                        o catálogo CANAIS
 * @param {Celula} cliquesCelula                   a célula do GSC, INTOCADA
 * @param {{chave:string, celula:Celula}[]} marcos a cadeia do perfil
 * @param {null|{erro:string}|{linhas:{grupo:string,sessoes:number}[], janela:{inicio:string,fim:string}, propriedade:string}} ga4
 * @param {{inicio:string, fim:string}} janela     a janela declarada da cadeia (R7)
 * @returns {{id:string, nome:string, celula:CelulaFicha, semElo:boolean}[]}
 */
```

**Tabela de decisão** — uma linha por situação, e é ela que vira asserção:

| `ga4` | `organico` | `direto`/`pago`/`indicacao`/`social` | `outbound` |
|---|---|---|---|
| `null`/`undefined` | GSC, como hoje | `não apurado` · `sem propriedade GA4 configurada para este projeto` | `não apurado` |
| `{erro}` | **GSC, como hoje** | `não apurado` · `fonte GA4 indisponível (<erro>)` | `não apurado` |
| janela ≠ janela da cadeia | **GSC, como hoje** | `não apurado` · `janela do GA4 (a→b) difere da janela da cadeia (c→d)` | `não apurado` |
| `{linhas: []}` | GSC, como hoje | `0` apurado · fonte `GA4 · <propriedade>` | `não apurado` |
| `{linhas: [...]}` | GSC, como hoje | valor apurado · fonte `GA4 · <propriedade>` | `não apurado` |

A coluna do `organico` é constante nas cinco linhas. É a SC-008 escrita como contrato: **nenhum**
caminho desta função lê `ga4` para produzir a célula do orgânico.

`outbound` também é constante: `não apurado` · `a fonte GA4 não distingue prospecção ativa` ·
consultar `apuração manual de outbound`.

**Falha parcial** (edge case da spec): não existe — o GA4 responde para a propriedade inteira ou
falha inteira. Se um dia responder parcialmente, cada canal já carrega seu próprio estado, então o
comportamento correto sai de graça.

---

## `montarN4Nivel(canais, extras)`

Devolve a lista plana de células do nível, na ordem do §4 do data-model.

```js
/**
 * @param {ReturnType<typeof montarN4>} canais
 * @param {{
 *   foraDoCatalogo?: {grupo:string, sessoes:number}[],
 *   propriedade?: string,
 *   inferencias?: {rotulo:string, valor:number, de:string, divida:string}[],
 * }} [extras]
 * @returns {{celulas: CelulaFicha[], nota: string}}
 */
```

**Garantias**:

1. **`total composto`** soma apenas células com `estado === "apurado"`. Se nenhuma for apurada, sai
   `não apurado`. O rótulo declara a cobertura: `total composto (orgânico + 4 canais)`, e nunca o
   nome de uma grandeza só (FR-005b, D7).
2. A `fonte` do total é a junção das fontes das parcelas (`Search Console · GA4 · properties/123`),
   pela mesma regra de `combinar()` — a procedência da soma nunca é implícita (FR-002).
3. **`diferença`** sai `não apurado` sempre que existir canal com `estado === "nao-apurado"`,
   nomeando **quais** (FR-012). Só quando os seis tiverem fonte é que ela vira apurada, como
   `composto − visitante` — e a SC-005 já registra que exceder é o comportamento correto.
4. **`fora do catálogo`** só aparece quando há volume; o rótulo lista os grupos com seu volume
   (`Email 12 · Unassigned 3`). Não entra no total (FR-009).
5. **Inferências** entram como células `inferido`, depois de tudo, e **não** entram no total.
6. `nota` é a frase da FR-005d, acrescida de `sessões orgânicas do GA4 ignoradas: N` quando
   `organicoIgnorado > 0`.

---

## `inferida(valor, { de, divida, rotulo })`

```js
/** @returns {{estado:"inferido", valor:number, rotulo:string, de:string, divida:string}} */
```

Lança se `de` ou `divida` forem vazios — mesma régua de `naoApurada()`, que exige `consultar`. Uma
inferência sem o vestígio e sem a dívida é um número solto, que é o que a feature existe para
evitar.

---

## Borda de render — `app/okr/[slug]/page.tsx`

- `<Cel>` ganha o ramo `inferido`: **valor em destaque**, seguido de `inferido de {de}` e da
  dívida em `.foot`. Visualmente distinto de `apurado` (FR-011, SC-007).
- A `nota` do nível é impressa uma vez, abaixo do `<h2>` de N4 (FR-005d).
- `agruparPorMotivo()` continua agrupando **só** `nao-apurado`; célula inferida nunca entra em
  grupo, senão o número desaparece dentro de um `<summary>`.
- Nenhum `'use client'`, nenhum estado, nenhuma dependência nova — a ficha continua Server
  Component.
