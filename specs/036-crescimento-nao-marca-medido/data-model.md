# Phase 1 — Data Model

**Feature**: 036 · Crescimento Não-Marca medido no board

Nenhuma tabela, coluna ou migração. O modelo é o **retorno** de uma função pura e a linha que ele
produz na tela.

## 1. `crescimentoNaoMarca(dias, hoje)` — de `null` para estado nomeado

### Antes

```js
crescimentoNaoMarca(dias, hoje) => { de, para, deImpressoes, paraImpressoes, valor,
                                     diasZeroDe, diasDe, baseInterrompida } | null
```

O `null` carrega três causas com consertos opostos, e uma quarta (marca não declarada) se disfarça
de `poucos-meses`.

### Depois

```js
/**
 * @returns
 *   | { estado: "nao-declarada" }
 *   | { estado: "poucos-meses",     fechados: number }
 *   | { estado: "nao-consecutivos", de: string, para: string }
 *   | { estado: "base-zero",        de: string, para: string, paraImpressoes: number }
 *   | { estado: "medido", de, para, deImpressoes, paraImpressoes, valor,
 *                         diasZeroDe, diasDe, baseInterrompida }
 */
```

O discriminador é `estado`, o **mesmo** campo e o mesmo idioma de `completude()` e `marcaDeclarada()`
no mesmo arquivo. Um consumidor que leia `.valor` sem checar `estado` recebe `undefined`, não um
número — que é o comportamento desejado: `undefined` quebra visivelmente, `0` mente.

### Ordem de decisão (a causa mais específica primeiro)

1. **`nao-declarada`** — nenhum dia da série carrega `impressoesNaoMarca` numérico. Vem **antes** da
   contagem de meses: é a razão de a contagem dar zero, e hoje é o estado de 33 dos 34 projetos.
2. **`poucos-meses`** — menos de dois meses fechados. `fechados` sai junto porque "1" e "0" pedem
   esperas diferentes.
3. **`nao-consecutivos`** — os dois últimos fechados não são meses vizinhos. Os dois saem nomeados:
   sem eles ninguém sabe onde procurar o buraco.
4. **`base-zero`** — o mês anterior tem zero impressões não-marca. `paraImpressoes` sai junto: há um
   número a publicar mesmo sem razão.
5. **`medido`** — o resto, com os campos de hoje intactos.

`baseInterrompida` **não** vira um sexto estado. Ela é atributo de uma medida que existe, e
transformá-la em ausência apagaria o `43×`, que é informação real sobre a recuperação.

## 2. `linhaDeCrescimento(medida)` — a linha de topo, em `lib/`

Pura, recebe o retorno acima, devolve string. Existe em `lib/marca.mjs` e não no `.tsx` porque
carrega a **correção** da FR-003: é ela que a SC-006 julga, e regra de correção não pode morar onde
`node --test` não alcança.

| `estado` | linha de topo |
|---|---|
| `medido`, `baseInterrompida: true` | `Medido: 14.689 impressões não-marca em 2026-08, contra 342 em 2026-07 — base interrompida (27 de 31 dias em zero)` |
| `medido`, `baseInterrompida: false` | `Medido: +7,2% de 2026-07 para 2026-08 (13.700 → 14.689 impressões não-marca)` |
| `nao-declarada` | `∅ não apurado · marca não declarada para este projeto` |
| `poucos-meses` | `∅ não apurado · 1 mês fechado na série — a razão pede dois consecutivos` |
| `nao-consecutivos` | `∅ não apurado · buraco na série entre 2026-05 e 2026-07` |
| `base-zero` | `∅ não apurado · mês-base em zero (2026-07) — sem base não há razão` |

**A regra que a suíte trava (FR-014)**: com `baseInterrompida: true`, a linha **não pode** começar
pela razão. O teste alimenta a função com esse caso e exige que os absolutos venham primeiro; um
`43×` abrindo a linha reprova.

O glifo `∅ não apurado` é o mesmo da 034. Nenhum estado renderiza `0` ou `0%`.

## 3. `variacao(f)` — a regra dos 10×, em `lib/`

```js
variacao(41.95)  // => "43×"
variacao(0.072)  // => "7,2%"
variacao(-0.54)  // => "-54%"
```

Sobe de `app/okr/[slug]/aquisicao/page.tsx:729` para `lib/marca.mjs`, **auto-contida** — faz o seu
próprio ramo de porcentagem em vez de chamar o `pct` local da página. O `pct` da página fica onde
está: ele serve outras dez medidas que não têm nada a ver com marca, e puxá-lo para `lib/marca.mjs`
espalharia o módulo para fora do assunto dele.

O que não pode existir em dois lugares é o **limiar de 10×** e a escrita `×` — e depois desta feature
existe em um só.

## 4. Os estados da TELA (seis) — `app/gsc/mapa/page.tsx`

Os cinco acima mais um que não é da função pura:

| estado da tela | origem | linha |
|---|---|---|
| medido / 4 ausências | `linhaDeCrescimento()` | tabela acima |
| **falha transitória** | `try/catch` da leitura do banco | `∅ não apurado · banco indisponível (<erro truncado>)` |

A falha transitória é distinta da ausência estrutural pela mesma razão da 030: uma pede investigar
credencial, a outra pede declarar marca. O erro entra **truncado em 60 caracteres**, como já faz
`lerSerieSeparada` — nenhuma string de conexão chega à tela (Princípio V).

## 5. A nota do nó (no `.tsx`, junto das outras duas)

Prosa, não contrato. Traz, nesta ordem:

1. **A janela nos termos desta folha**: meses fechados, e por que o mês corrente não entra (o GSC
   ainda sobe a ponta — 30/07 da Atma saiu com 30 impressões e fechou em 827).
2. **Por que a faixa do board não se aplica** quando `baseInterrompida` (FR-009), com a mesma
   palavra da aba de aquisição.
3. **A forma da série** (US3/FR-013): última semana completa contra o pico, com as datas e as
   posições médias, derivada do **mesmo** `ritmoDoSegmentoAtual` que assina o `% do pico` da aba —
   nunca um pico derivado aqui.
4. **A razão**, quando ela não abriu a linha.

## 6. O que NÃO muda

- `mesesFechados()`, `semanasNaoMarca()`, `ritmoNaoMarca()`, `razaoDeMarca()`, `completude()`:
  intactas.
- `hub_gsc_dia`: nenhuma coluna, nenhum índice, nenhum backfill.
- `MEDIDO_POR.crescimentoNaoMarca`: já aponta para o coletor certo; segue como está (FR-012).
- `CATALOGO`, `BOARD`, `DIVERGENCIAS`, `balizador`: a folha segue `◇ sem fonte` e `recusa`.
