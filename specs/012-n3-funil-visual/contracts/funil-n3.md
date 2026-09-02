# Contract: `segmentosDoFunil()` e o markup do funil

**Fase 1** | **Branch**: `012-n3-funil-visual`

Dois contratos: o da função pura em `lib/ficha.mjs` e o do markup que a página emite a partir dela.

---

## 1. `segmentosDoFunil(ficha, celulasN3)` — `lib/ficha.mjs`

```js
/**
 * Os segmentos do funil de N3, um por célula de N3, na mesma ordem.
 *
 * O ESTADO vem da célula (a mesma que vira linha de texto); a GEOMETRIA vem dos marcos. São
 * coisas diferentes e só uma delas poderia divergir do texto — por isso o estado é copiado,
 * nunca recalculado a partir de `ficha.taxas`.
 *
 * @param {ReturnType<typeof import("./okr.mjs").montarFicha>} ficha
 * @param {{estado:string}[]} celulasN3  o retorno de montarN3(ficha)
 * @returns {import("./ficha.mjs").Segmento[]}
 */
export function segmentosDoFunil(ficha, celulasN3)
```

**Pré-condições**: nenhuma. Aceita ficha sem perfil, sem marcos e com `celulasN3` de tamanho
qualquer.

**Pós-condições**:

| # | Garantia |
|---|---|
| C1 | `resultado.length === celulasN3.length` quando `ficha.taxas.length === celulasN3.length`; `[]` em qualquer outro caso (inclusive sem perfil, onde `celulasN3` é a célula única de ausência). |
| C2 | `resultado[i].estado === "apurado"` **se e somente se** `celulasN3[i].estado === "apurado"`. |
| C3 | Segmento `apurado` tem `entrada` e `saida` em `[0, 1]`, com `saida <= entrada`. |
| C4 | Segmento `nao-apurado` **não** tem `entrada` nem `saida`. |
| C5 | Marco com `valor === 0` produz altura `0` exata — o `PISO` nunca se aplica a zero. |
| C6 | Cadeia cujos marcos apurados são todos `0` produz alturas `0`, nunca `NaN` nem `Infinity`. |
| C7 | Função pura: sem `Date`, sem `process.env`, sem I/O. Mesma entrada, mesma saída. |
| C8 | Cadeia com **nenhum** marco apurado devolve a contagem certa de segmentos, todos `nao-apurado`, sem `NaN` nem `-Infinity`. É o conjunto vazio, não o conjunto de zeros de C6: `Math.max()` de nada é `-Infinity`, e a regra `base <= 0 → 0` precisa absorvê-lo de propósito, não por acidente. |
| C9 | Taxa `0/0` (denominador zero) chega como célula `não apurado` — `razao()` já a recusa — e produz segmento `nao-apurado`, **nunca** apurado com altura `0`. É a R1 na forma: "não sei" e "ninguém passou" não podem se parecer. |

**Uso**: chamada dentro de `montarNiveis()`, no ramo com perfil, com o resultado de `montarN3(ficha)`
que já é calculado ali. Nenhum segundo cálculo de `montarN3`.

---

## 2. Markup — `app/okr/[slug]/page.tsx`

Emitido **acima** das linhas de texto de N3 e **somente** quando `n.id === "N3" && n.funil.length > 0`.

```text
<svg class="ficha-funil" viewBox="0 0 600 96" aria-hidden="true" focusable="false">
  <defs>
    <pattern id="n3-hachura" width="6" height="6" patternUnits="userSpaceOnUse"
             patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" />
    </pattern>
  </defs>

  # por segmento i, faixa x0 = i * (600/N) + 4  ..  x1 = (i+1) * (600/N) - 4
  apurado      → <polygon points="x0,48-e*44  x1,48-s*44  x1,48+s*44  x0,48+e*44" />
  nao-apurado  → <rect x="x0" y="4" width="x1-x0" height="88" fill="url(#n3-hachura)" />
</svg>
```

| Regra | Motivo |
|---|---|
| Eixo em `y = 48`, meia-altura máxima `44` | funil simétrico; 4 unidades de folga em cima e embaixo. |
| `viewBox` fixo + `width: 100%` no CSS, sem `preserveAspectRatio="none"` | escala uniforme mantém a espessura da hachura constante. |
| `id="n3-hachura"` fixo, sem gerador | há no máximo um funil por página (FR-006). |
| Nenhum `<text>`, `<title>`, `<desc>`, `role` ou `tabindex` | FR-008 — decorativo; o texto é a linha abaixo. |
| Nenhum `'use client'`, `<script>`, `onMouseOver` ou estado | FR-007 / SC-004 — `js_kb: 0`. |
| Cor por token (`--seq550` preenchido, `--grid` trilho e hachura); raio 0, sombra 0, sem `opacity` | direção corte-seco de `.art/log.json`. |

**Contrato negativo (o que NÃO pode mudar)** — é a User Story 2 virada em asserção de diff:

- nenhuma linha de `n.celulas` removida, reordenada, agrupada ou truncada;
- `montarN3()` continua devolvendo o mesmo array de células, com a mesma fração colada (R2);
- a `/okr` (listagem) não é tocada;
- os níveis N0-N2 e N4-N6 não ganham funil nem campo.
