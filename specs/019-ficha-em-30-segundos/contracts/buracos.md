# Contrato — `buracosDeVerdade(marcos)`

**Módulo**: `lib/okr.mjs` (puro) · **Testes**: `test/okr.test.mjs` (já registrado) ·
**FRs**: FR-004, FR-005, FR-002

## Assinatura

```js
/**
 * Os buracos de medição que uma pessoa que DECIDE precisa ver. Célula `tela-nao-le` é dívida de
 * LEITURA, não buraco (018/FR-029): o trabalho é de engenharia, não do negócio.
 *
 * Esta é a MESMA lista que `posicaoDeAtaque()` consome — extraída dela, não escrita de novo.
 * Duas listas de "onde falta dado" na mesma tela é a segunda régua que a FR-002 proíbe.
 *
 * @param {Marco[]} marcos  `ficha.marcos`
 * @returns {{chave:string, nome:string, fonte:string, motivo:string, familia:string, transitorio:boolean}[]}
 */
export function buracosDeVerdade(marcos)
```

## Regras

1. Entra a célula com `!ehApurado(celula)` **e** `celula.rotuloBuraco !== "tela-nao-le"`.
2. `transitorio = celula.rotuloBuraco === "falhou-agora"`.
3. Ordem preservada: a ordem dos marcos **é** a ordem da cadeia. Nada de reordenar por família —
   `posicaoDeAtaque()` é quem prioriza D4, e ela continua fazendo isso do lado dela.
4. Sem marcos, ou nenhum buraco: `[]`. **Nunca `null`** — a tela precisa distinguir "vazia" de
   "não calculada", e a distinção sai do array vazio, não do tipo.

## Mudança em `posicaoDeAtaque()`

`lib/okr.mjs:451` deixa de filtrar à mão:

```js
const buracos = buracosDeVerdade(ficha.marcos);
const buraco = buracos.find((m) => m.familia === "D4") ?? buracos[0];
```

Note o rename de `familiaDoBuraco` → `familia` no objeto devolvido. Os campos `celula.naoApurado`
e `fonte` que a `posicao 2` usa no `motivo` continuam disponíveis (`motivo`, `fonte`).

## Testes obrigatórios (`test/okr.test.mjs`)

| # | Dado | Espera |
|---|---|---|
| 1 | marcos com uma célula `tela-nao-le` | ela **não** aparece na lista |
| 2 | marcos com `falhou-agora` | aparece, com `transitorio: true` |
| 3 | marcos com `nao-mede` e sem rótulo | aparecem, com `transitorio: false` |
| 4 | todos apurados | `[]`, não `null` |
| 5 | a mesma ficha | `posicaoDeAtaque().celula` é o primeiro D4 da lista, ou o primeiro item — **nenhuma divergência entre as duas leituras** |

## Renderização (`app/okr/[slug]/buracos.tsx`)

- Lista vazia → `nenhum buraco de medição na cadeia` (FR-005). Sumir em silêncio é indistinguível
  de não ter sido calculada.
- Cada linha nomeia **a fonte a consultar** (US2-AC2).
- `transitorio` sai num agrupamento próprio, abaixo dos permanentes, rotulado como transitório —
  não compete pela atenção (US2-AC4, regressão da rodada 3 do design-review).
- A frase "isso fecha um buraco de medição, mas não destrava X" (`veredito.posicao === 1` e
  `veredito.celula !== primeiro buraco`) **sobrevive à reordenação** e passa a morar aqui: sem ela,
  a dobra parece dois planos de ataque.
