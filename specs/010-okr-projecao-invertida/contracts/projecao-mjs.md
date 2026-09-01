# Contrato — `lib/projecao.mjs` e `exigencia()`

Interface pública consumida por `app/okr/page.tsx` e `test/projecao.test.mjs`; qualquer mudança
nela quebra os dois de uma vez, de propósito.

Os módulos são **puros**: nenhuma leitura de env, banco, rede ou relógio. `hoje` entra como
parâmetro (D3) — função que lê `Date.now()` por dentro não é testável sem congelar o relógio, e
congelar relógio sem framework é ferramenta que a constituição proíbe.

---

## Adição a `lib/funil.mjs`: `exigencia(necessario, ancora)`

```js
/**
 * A segunda divisão do repo, e ela mora AQUI, colada em `razao()`, porque a diferença entre as
 * duas só é legível se estiverem uma embaixo da outra.
 *
 * `razao()` confronta duas MEDIÇÕES: numerador > denominador significa que as pontas não medem a
 * mesma coisa, e devolver 250% publicaria o defeito como resultado. `exigencia()` confronta uma
 * EXIGÊNCIA DECLARADA com uma medição: acima de 1 é resultado legítimo — é a prova de que a meta
 * não cabe no volume atual, e é o único achado desta feature que economiza um trimestre.
 *
 * @param {Celula} necessario @param {Celula} ancora @returns {Celula} fração, PODE exceder 1
 */
export function exigencia(necessario, ancora)
```

| Entrada | Saída |
|---|---|
| `ancora` não apurada | `não apurado: âncora: <motivo>` |
| `necessario` não apurado | `não apurado: necessário: <motivo>` |
| `ancora.valor === 0` | `não apurado: âncora zerada — meta não se divide por volume nenhum` |
| numerador > denominador | **apurado** — ao contrário de `razao()` |

Teste em `test/funil.test.mjs` (já registrado em `package.json`), ao lado dos de `razao()`.

---

## `lib/projecao.mjs` — imports permitidos

```js
import { apurado, naoApurado, ehApurado, razao, exigencia } from "./funil.mjs";
```

`lib/okr.mjs` é consumido pelo **formato da ficha** (`montarFicha()`), não por import de função.
Reimplementar célula, razão ou cadeia é proibido (FR-015).

---

## `ancoraDe(marcos)`

```js
/**
 * @param {{chave:string, nome:string, celula:Celula}[]} marcos
 * @returns {{chave:string, nome:string, indice:number, valor:number, ehFinal:boolean}|null}
 */
export function ancoraDe(marcos)
```

Último degrau apurado da sequência contígua a partir do topo — **o degrau final incluído**
(FR-005 literal, D2). `null` quando não há nenhum. Degrau apurado depois de um `não apurado` nunca
é âncora (SC-007). `ehFinal` marca quando a âncora é o próprio N1, e é ele que escolhe o ramo.

---

## `projetar({ ficha, meta, hoje, janelaDias })`

```js
/**
 * @param {object} entrada
 * @param {ReturnType<import("./okr.mjs").montarFicha>} entrada.ficha
 * @param {{valor?:number, ticket?:number, prazo?:string, declaradaEm?:string}|null} entrada.meta
 * @param {string} entrada.hoje            ISO `YYYY-MM-DD`
 * @param {number} [entrada.janelaDias]    default 28 (R7)
 * @returns {Projecao}
 */
export function projetar({ ficha, meta, hoje, janelaDias = 28 })
```

### Garantias

| # | Garantia | Requisito |
|---|---|---|
| G1 | Sem `meta`, **nenhum** campo numérico sai apurado | FR-013, SC-003 |
| G2 | Nunca deriva meta de benchmark, média ou histórico | FR-012 |
| G3 | `fatorObrigatorio` pode exceder 1; usa `exigencia()`, não `razao()` | D7, FR-007 |
| G4 | `fatorObrigatorio` e `multiploNecessario` nunca saem apurados juntos | D9, FR-010 |
| G5 | Âncora `0` nunca vira divisão por zero | edge case |
| G6 | `degrausAMedir` é não-vazio sse `fatorObrigatorio` está apurado; vazio no ramo do múltiplo | FR-009, D9 |
| G7 | `veredito` é sempre uma das seis etiquetas; nunca `undefined` | |
| G8 | A mesma entrada com prazos de 28 e 112 dias produz fatores na razão 4:1 | SC-006 |
| G9 | `veredito === "impossivel"` **jamais** com `ancora.ehFinal === true` | D9 |
| G10 | `declaradaEm` nunca entra em conta nem invalida a meta | D10 |

### Retorno

Ver `data-model.md` §4.

---

## Contrato de renderização (`app/okr/page.tsx`)

Regras que o módulo **não** pode impor sozinho e que a tela DEVE cumprir:

| # | Regra | Requisito |
|---|---|---|
| R-a | Todo fator e todo múltiplo levam a fração colada no mesmo texto: `7,42% (2,89/39)` | FR-011, SC-004 |
| R-b | `fatorObrigatorio > 1` nunca é formatado como percentual de célula — o percentual só aparece dentro da frase de prova | D8, SC-005 |
| R-c | `valor` e `ticket` aparecem rotulados como **declarados**, com `declaradaEm` ao lado | FR-002, D10 |
| R-d | Projeto sem meta exibe o motivo numa linha `.foot`, nunca bloco vazio nem `0` | FR-013, D6 |
| R-e | No veredito `impossivel`, o texto nomeia volume e ticket e **não** sugere copy, performance ou indexação | FR-008 |
| R-f | A seção "O que isto NÃO vê" ganha o item de que caber em 100% não é ser alcançável | FR-018 |
| R-g | No ramo do múltiplo, a palavra "impossível" não aparece — nem para múltiplos altos | D9, G9 |
| R-h | No veredito `limite` (fator exatamente `1`) o texto diz **"100% em todos os degraus restantes — limite, não meta"**. A palavra "impossível" NÃO aparece: aritmeticamente `1` cabe, e a spec o chama de "impossível na prática" como leitura, não como veredito | Edge case, `limite` |
