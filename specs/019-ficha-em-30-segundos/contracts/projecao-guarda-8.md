# Contrato — a guarda 8 partida em `projetar()`

**Módulo**: `lib/projecao.mjs` (puro) · **Testes**: `test/projecao.test.mjs` (já registrado) ·
**FRs**: FR-008, FR-008a, FR-009, FR-010, FR-011, FR-012

> **A FR-011 revoga a FR-034 da 018** ("`lib/projecao.mjs` NÃO DEVE ganhar regra nova"), de
> propósito e por escrito. A 018 a impôs para não misturar correção com estrutura.

## O defeito

`lib/projecao.mjs:117` — a guarda 8 devolve `naoApuradaCompleta()`, que zera **sete** campos por
causa de um só. `n1Total` é `meta.valor / meta.ticket` e **não toca a âncora**; sai suprimido junto.
Mesma família de `validacao_so_fala_de_problema_cala_o_caminho_feliz`.

## A ordem nova

```
guardas 1–7  → naoApuradaCompleta()   (inalteradas: cada uma nomeia um fator que falta na
                                       PRÓPRIA divisão da meta)
n1Total, n1Janela, normalizacao       ← calculados AQUI, antes da guarda 8
guarda 8 (ancora.valor === 0)         → retorno PARCIAL (abaixo)
ramos de taxa / múltiplo              (inalterados)
```

## Retorno parcial da guarda 8

```js
const motivo = "âncora zerada — meta não se divide por volume nenhum";
return {
  n1Total,                                  // APURADO
  n1Janela,                                 // APURADO
  normalizacao,                             // preenchida — a conta é de calendário, não de cadeia
  ancora,                                   // o objeto real, com valor 0 — a tela precisa nomeá-lo
  fatorObrigatorio:   naoApurado(motivo),
  multiploNecessario: naoApurado(motivo),
  folga:              naoApurado(motivo),
  multiploDeVolume:   naoApurado(motivo),
  degrausAMedir: [],
  veredito: "nao-apurado",
  motivo,
};
```

**Por que `ancora` deixa de ser `null` aqui**: a FR-010 exige que os campos suprimidos **nomeiem a
âncora zerada**. Sem o objeto, a tela não tem o nome do degrau. As guardas 1–7 continuam com
`ancora: null`, porque lá não há âncora nenhuma.

## Testes obrigatórios (`test/projecao.test.mjs`)

| # | Dado | Espera |
|---|---|---|
| 1 | cadeia fechando em `tratamento = 0`, meta 50000, ticket 4932,34 | `ehApurado(n1Total)` e o valor é `meta.valor / meta.ticket` — a conta, não a constante |
| 2 | o mesmo | `n1Janela` apurado, `normalizacao` preenchida, `normalizacao.conta` legível |
| 3 | o mesmo | `fatorObrigatorio` e `multiploNecessario` **não apurados**, e o motivo cita a âncora zerada |
| 4 | o mesmo | `veredito === "nao-apurado"` (a tela distingue pelo estado das células, não pelo veredito) |
| 5 | guardas 1–7 (sem meta, sem ticket, prazo vencido, sem âncora…) | continuam devolvendo a projeção inteira não apurada — **byte a byte** o de hoje |
| 6 | cadeia com âncora não zerada | ramos de taxa e múltiplo **inalterados** |

O teste 5 é a trava de não-regressão dos 16 projetos sem meta: o que muda é **só** o ramo da âncora
zerada.

## Renderização (`app/okr/projecao.tsx`)

O `return` cedo em `p.veredito === "nao-apurado"` some. O componente passa a decidir por célula:

1. **Se `ehApurado(p.n1Total)`** → renderiza a linha da meta (`Meta: R$ … · N1 necessário no prazo:
   10,1 · na janela: …`), com o rótulo de ticket apurado/declarado que já existe.
2. **Em seguida, sempre** → a frase do `p.motivo`, dizendo por que a cadeia não distribui a meta.
3. Fator, múltiplo, folga e degraus a medir continuam guardados por `ehApurado()`, como hoje.

Projeto sem meta nenhuma continua caindo na linha `projeção: não apurado — <motivo>` de hoje —
`n1Total` não é apurado lá, e o primeiro `if` do passo 1 já cobre.

**Consequência declarada (FR-008a)**: `/okr` muda de texto para todo projeto de cadeia zerada. O
ranking **não** muda: `posicaoDeAtaque()` lê só `ficha`, nunca `projecao`.
