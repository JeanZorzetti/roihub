# Contrato: o rótulo de buraco — campo opcional, nunca regex

**Feature**: `018-atma-numeros-certos` · FR-028 a FR-031

## O defeito medido

`motivo`, `status_historico`, `orcamentos.preco` e o histórico completo de `patient_leads` estavam
medidos e gravados; a página nunca os leu e chamava isso de "não apurado". A lista de buracos —
**prioridade nº 1 do leitor** — estava inflada por dívida de leitura.

> **"o negócio não mede" ≠ "a tela não lê".** A segunda é backlog de engenharia, não informação
> para quem decide.

## O campo

```js
/** @typedef {"nao-mede"|"falhou-agora"|"tela-nao-le"} RotuloBuraco */
```

| valor | significado | ação | efeito na lista de buracos |
|---|---|---|---|
| `nao-mede` | o negócio não mede | instrumentar | **entra** (é buraco de verdade) |
| `falhou-agora` | transitório (fonte fora do ar) | esperar / conferir a fonte | **entra**, separada do permanente |
| `tela-nao-le` | o dado existe, a tela não o lê | backlog de engenharia | **SAI** (FR-029) |
| *(ausente)* | não revisado | — | **comportamento de hoje, byte a byte** |

## As assinaturas

```js
// lib/funil.mjs
naoApurado(motivo, rotuloBuraco?) → { naoApurado: motivo, rotuloBuraco? }

// lib/ficha.mjs
naoApurada(motivo, consultar, rotulo, rotuloBuraco?) → CelulaNaoApurada
```

**`rotuloBuraco`, não `rotulo`.** `CelulaNaoApurada` **já** tem um `rotulo`, que é o texto exibido
("orçamento ENVIADO"). Reusar a palavra criaria dois significados no mesmo objeto — o defeito que
`rótulo de exibição nunca é chave` já custou uma vez no repo.

## As três regras que não podem ser afrouxadas

### R1 — Opcional, e **sem default** (FR-028)

Rótulo obrigatório com default gravaria `nao-mede` em ~70 dos 72 call sites que ninguém revisou,
produzindo **em massa** a declaração falsa que esta spec existe para acabar.

> **Dado** um `não apurado` **sem** rótulo, **quando** a ficha o processa, **então** ele se comporta
> exatamente como hoje — nenhum dos 72 call sites existentes muda de comportamento por não ter sido
> revisado. *(US4-AC1)*

### R2 — Campo, **nunca** regex sobre o texto do motivo (FR-028)

`EH_FALHA_TRANSITORIA` (`app/okr/[slug]/page.tsx:94`, `/indispon[íi]vel/i`) **fica** — mas apenas
como o comportamento de hoje para célula **sem** rótulo. Onde o campo existe, ele decide.

Ordem de precedência:

```
c.rotuloBuraco   →   se ausente: EH_FALHA_TRANSITORIA.test(c.motivo)   →   "não apurado"
```

> **Dado** o GSC fora do ar, **quando** a célula falha, **então** o rótulo é `falhou-agora` e ela
> continua separada do buraco permanente. *(US4-AC3 — regressão da rodada 3 do design-review)*

### R3 — Ortogonal a D1–D4 (FR-030)

A **família** diz **onde** está a causa (Descoberta, Entrega, Persuasão, Encanamento).
O **rótulo** diz **de quem** é o trabalho (do negócio, do momento, da engenharia).

`familiaDe()` (`lib/okr.mjs`) continua exatamente como está. Nenhuma das duas classificações lê a
outra.

## Onde os rótulos são colocados nesta spec

Só nos pontos que a spec revisou. Todo o resto fica sem rótulo, de propósito.

| ponto | rótulo |
|---|---|
| erros de conexão em `lerFontePropria()` (`fonte própria indisponível (…)`) | `falhou-agora` |
| `gscSeries` com `{erro}` → `falhou agora — GSC indisponível (…)` | `falhou-agora` |
| `resolverGa4()` estado `erro` | `falhou-agora` |
| `tratamento` da `atma` (venda: `apurado(0)`, mas sem instrumento) | **nenhum** — é `apurado(0)`, não buraco |
| degraus da `atma` que a tela passou a ler (`respondeu`, ticket, orçamentos) | **deixam de ser célula não apurada** |

## `status_historico` NÃO vira célula (FR-031)

Nada o lê hoje, e criar uma célula só para escondê-la da lista é scaffolding.

O backlog fica registrado em `handoff/`:

- velocidade (8,3 h médios até o contato, 34,9 h no pior caso)
- passagem cumulativa
- coorte — **com `n < 20` sai como contagem crua, nunca como percentual**: uma coorte de 4 leads só
  produz 0%, 25%, 50%, 75% ou 100%

## O critério de aceitação que fecha

> **Dado** a Atma depois desta spec, **quando** se conta os `tela-nao-le` dela, **então** dá
> **zero**. *(US4-AC4)*

> **Dado** a linha de base da SC-000, **quando** se conta os buracos da `atma` depois, **então** a
> lista **encolheu**. *(US4-AC5)*

É a **tese da spec** (a lista estava inflada por dívida de leitura) que está sendo testada, não um
teto que alguém chutou — e por isso a linha de base tem que ser medida **antes** de qualquer
edição (SC-000).
