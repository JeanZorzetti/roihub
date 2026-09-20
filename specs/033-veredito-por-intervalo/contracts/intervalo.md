# Contrato · `lib/intervalo.mjs` (novo)

**Natureza**: módulo **folha** da árvore de dependências. Zero imports, sem `process.env`, sem `pg`,
sem `fetch`, sem `Date.now()`. Mesmo contrato de `lib/janelas.mjs`, e pelo mesmo motivo: `scripts/` e
`node --test` importam sem arrastar `google-auth-library`.

**Princípio III**: toda a aritmética desta feature mora aqui. Nenhuma conta em `.tsx`.

---

## Constantes exportadas

```js
/** O nível de confiança desta família de vereditos. Mudá-lo é decisão do dono e muda quantas
 *  páginas ficam indecisas — por isso é constante em commit, não seletor de tela. */
export const CONFIANCA = 0.95;

/** z de 97,5% (bicaudal a 95%). Valor cheio, não 1,96: o arredondado move o teto de `0/21` em
 *  0,1 ponto, e é esse teto que decide a Posição 1 contra uma régua de 25%. */
export const Z_95 = 1.959963984540054;
```

---

## `wilson(cliques, impressoes, z = Z_95)`

```
@param  {number} cliques
@param  {number} impressoes
@param  {number} [z]
@returns {{inferior:number, superior:number, confianca:number, metodo:"wilson"} | null}
```

**Contrato**:

- `impressoes <= 0` ou entrada não finita → **`null`**. Não há intervalo de uma amostra que não existe,
  e `[0,0]` "decidiria" tudo.
- `cliques < 0`, `cliques > impressoes` → **lança**. É bug de chamador, não estado: a fonte nunca
  devolve mais clique que impressão, e engolir isso devolveria um intervalo plausível sobre dado
  impossível.
- `inferior >= 0` e `superior <= 1` **sempre**, incluindo `k = 0` e `k = n`. É a FR-003, e o teste
  cobra nas duas bordas.
- **A saída é clampada em `[0, 1]`, e a linha não é defensiva — é aritmética medida.** A forma
  fechada devolve **`-1,1731740316366828e-17`** para `wilson(0, 21)`: em aritmética exata `c - m` é
  zero, em ponto flutuante o sinal vira com `n` (`+2,16e-19` em `wilson(0, 1000)`). Sem o clamp
  `inferior >= 0` é **falso**, e a varredura da FR-003 fica vermelha no primeiro caso — por um
  motivo que não é o método. `Math.max(0, …)` na saída de `inferior`, `Math.min(1, …)` na de
  `superior`, com o valor medido no comentário.
- `inferior <= superior` sempre.
- Puro: mesma entrada, mesma saída, sem estado.

**Casos de referência** (de `research.md` §R1 — são estes que o teste afirma):

| `cliques/impressoes` | `inferior` | `superior` |
|---|---:|---:|
| `0/21` | 0,0% | **15,5%** |
| `3/105` | **1,0%** | **8,1%** |
| `0/1` | 0,0% | 79,3% |
| `275/21500` | 1,1% | 1,4% |

---

## `vereditoContraRegua(cliques, impressoes, regua, z = Z_95)`

```
@returns {"atinge" | "abaixo" | "indecisa" | null}
```

**Contrato**:

```
regua == null  ou  impressoes <= 0   →  null
superior <  regua                    →  "abaixo"
inferior >= regua                    →  "atinge"
senão                                →  "indecisa"
```

- As três condições são **exaustivas e mutuamente exclusivas**. Não existe amostra sem veredito nem
  com dois.
- A assimetria `<` contra `>=` é deliberada: a régua é um **piso**, e empate exato com o piso é
  `atinge`. `inferior > regua` deixaria o empate em `indecisa`, o que é falso.
- **Contagem de cliques não entra.** `cliques === 0` não implica `indecisa` — `0/21` contra 25% é
  `abaixo`. O teste guarda os dois lados para que a regra não seja reintroduzida.
- `regua === null` devolve `null`, **não** `"indecisa"`: "não há régua aqui" e "a amostra não decide"
  pedem trabalho oposto, e são estados de tela diferentes.

**Casos de referência**:

| Caso | Entrada | Régua | Saída | Vem de |
|---|---|---:|---|---|
| Posição 1 | `0/21` | 25,0% | `"abaixo"` | **SC-001** |
| Posições 4 a 6 | `3/105` | 4,5% | `"indecisa"` | **SC-002** |
| URL de 1 impressão | `0/1` | 13,0% | `"indecisa"` | US1 AS-2 |
| Página nomeada | `275/21500` | 2,0% | `"abaixo"` | SC-009 |
| Página 2 | `4/900` | `null` | `null` | edge "faixa sem régua" |
| Empate exato | `25/100` | 25,0% | `"indecisa"` | o IC de `25/100` atravessa 25% |

---

## `vereditoContraFaixa(cliques, impressoes, faixa, z = Z_95)`

```
@param {[number, number]} faixa  [piso, teto] — o par do board
@returns {"atinge" | "abaixo" | "indecisa" | null}
```

**Contrato**:

```
faixa == null  ou  impressoes <= 0   →  null
superior <  piso                     →  "abaixo"
inferior >= teto                     →  "atinge"
senão                                →  "indecisa"
```

- Qualquer sobreposição com `[piso, teto]` é **indecisão**: a amostra não distingue "dentro da faixa"
  de "fora dela".
- `piso > teto` → **lança**. Par invertido é bug de chamador.
- **Não é a mesma função com o piso.** Aplicar `vereditoContraRegua(…, piso)` emitiria `atinge` para
  amostra que não exclui o teto — precisão inventada.

**Uso**: US3, a fração de impressões no Top 3 contra os 40% a 50% do board. Ressalva que a tela
carrega e que este módulo **não** resolve: esses 40-50% são **parâmetro do board sem fonte**
(`balizador: { tipo: "recusa" }` no catálogo), não régua publicada. O `◇` e o motivo continuam do
lado — este módulo devolve a decisão estatística, nunca a autoridade.

---

## O que este módulo NÃO faz

- **Não escolhe faixa de posição.** Isso é `FAIXAS`/`faixaDaPosicao()` em `lib/kpis-busca.mjs`, que
  conhece `BENCHMARK`. Trazer a régua para cá faria a folha depender da tabela.
- **Não formata.** Nenhum `toLocaleString`, nenhum `%`, nenhum texto em português. A tela formata.
- **Não conta indecisas nem monta índice.** Isso é `conformidadeDeCtr()`.
- **Não sabe o que é uma URL.** Recebe dois números e uma régua.
