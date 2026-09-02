# Data Model: N3 — Funil Visual

**Fase 1** | **Branch**: `012-n3-funil-visual` | **Date**: 2026-09-02

Nenhuma entidade **persistida** nasce nesta feature: sem tabela, sem migração, sem campo novo em
`data/projects.json`. O modelo abaixo é o objeto de apresentação derivado, em memória, do que a
requisição da ficha já carrega.

## 1. Segmento

Um elemento do funil. Corresponde 1:1, na ordem, a uma célula de `n3.celulas` — que por sua vez
corresponde a um elemento de `ficha.taxas` (D1 do research).

```js
/**
 * @typedef {{estado:"apurado", entrada:number, saida:number}
 *          |{estado:"nao-apurado"}} Segmento
 */
```

| Campo | Tipo | Quando existe | Significado |
|---|---|---|---|
| `estado` | `"apurado" \| "nao-apurado"` | sempre | Copiado da célula de N3 correspondente. **Nunca recalculado** (FR-003). |
| `entrada` | `number` em `[0, 1]` | só em `apurado` | Altura relativa do marco **denominador** da taxa. |
| `saida` | `number` em `[0, 1]` | só em `apurado` | Altura relativa do marco **numerador** da taxa. |

**Invariantes**:

- `saida <= entrada` sempre que ambos vierem de valores medidos — `razao()` já recusa numerador
  maior que denominador antes de a taxa chegar aqui.
- `estado: "nao-apurado"` **não** carrega altura, nem `0`, nem `null` numérico usável como altura.
  A ausência do campo é o que impede o `.tsx` de desenhar trapézio degenerado onde deveria haver
  trilho (D3, R1).
- Nenhum segmento carrega texto: nem rótulo, nem motivo, nem fração. Esses três continuam
  exclusivamente na linha de texto (FR-004).

### Regra de altura

`base` = maior `valor` entre os marcos **apurados** da cadeia.

```text
altura(marco) =
  não apurado        → indefinido (o segmento inteiro vira "nao-apurado")
  valor === 0        → 0                          # zero medido desenha zero
  base <= 0          → 0                          # cadeia apurada toda zero, OU nenhum marco
                                                  # apurado (Math.max() de vazio = -Infinity)
  caso geral         → max(PISO, valor / base)    # PISO ≈ 0,034 (~1,5u de 44)
```

`PISO` existe para que uma taxa pequena e real (`6,67%`) não vire uma linha invisível. Ele **nunca**
se aplica a `0`: dar corpo mínimo a zero faria "ninguém passou" e "não sei" se parecerem, que é
exatamente o que a R1 proíbe.

## 2. Nível N3 (estendido)

O objeto de nível que `montarNiveis()` já devolve, com um campo a mais:

```js
{ id: "N3", titulo: "N3 — quanto se perde em cada etapa?", celulas: [...], funil: Segmento[] }
```

| Campo | Mudança |
|---|---|
| `celulas` | **inalterado** — mesma ordem, mesmos motivos, mesma fração colada (FR-004). |
| `funil` | novo. `Segmento[]` com `funil.length === celulas.length`, ou `[]`. |

`funil` é `[]` — e o componente não renderiza nada (FR-005) — quando:

- o projeto não tem perfil declarado (`ficha.marcos` vazio, N3 é a célula única "sem perfil
  declarado");
- a cadeia tem menos de dois marcos, e portanto nenhuma taxa a desenhar.

Nenhum outro nível (N0, N1, N2, N4, N5, N6) ganha campo. A `/okr` não lê `funil` (FR-006).

## 3. Estados herdados

Os três estados da ficha (FR-009 da spec 011) chegam a N3 reduzidos a dois, porque uma taxa é
sempre uma divisão de valores medidos ou não é nada:

| Estado da célula de N3 | Segmento | Forma |
|---|---|---|
| `apurado` | `apurado` | trapézio sólido, `entrada` → `saida` |
| `nao-apurado` | `nao-apurado` | trilho hachurado, altura cheia |
| `declarado` | **não ocorre em N3** | — |

`declarado` não aparece porque `montarN3()` só emite `apurado` ou `naoApurada()`. Se um dia emitir,
o segmento cai em `nao-apurado` por padrão — a leitura conservadora, que nunca desenha corpo sólido
para número que não foi medido.
