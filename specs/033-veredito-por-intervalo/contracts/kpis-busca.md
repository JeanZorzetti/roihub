# Contrato · `lib/kpis-busca.mjs` (reescrito na família por URL)

O módulo continua **puro** (sem `process.env`, sem `pg`, sem `fetch`), mas deixa de ser "zero
imports": passa a importar `lib/intervalo.mjs`, que é folha. O cabeçalho do arquivo precisa ser
corrigido junto — dizer "zero imports" com um import é a divergência silenciosa que este repo já
paga em outros lugares.

---

## O que SAI

```js
export const PISO_IMPRESSOES_VEREDITO = 100;   // REMOVIDO — FR-009
export function ctrGap(paginas) { … }            // RENOMEADO (ver abaixo)
```

**`ctrGap` é renomeado, não ajustado.** O nome muda junto com o conteúdo porque é isso que força a
revisão do chamador — a 032 estabeleceu o padrão: manter o nome antigo com uma semântica nova deixa
a aba compilando e medindo outra coisa. `conformidadeDeCtr(paginas)` não compila onde `ctrGap` era
consumido, e o `tsc` aponta os dois pontos de uso.

`MEDIDO_POR.ctrGap` e `MEDIDO_POR.conformidadeUrls` em `lib/gsc-delta.mjs` reapontam no mesmo commit.

---

## O que ENTRA

### `LIMIAR_PAGINAS_DECIDIDAS = 20`

```js
/**
 * Abaixo disto nenhum dos dois índices é o elemento de maior peso da tela (FR-012).
 *
 * DERIVADO, não escolhido: a meta do board tem 5 pontos de largura (75% a 80%). Com `n` páginas
 * decididas, uma página mudar de veredito move o índice em `1/n`; para o índice ser comparável à
 * faixa, uma página sozinha não pode atravessá-la — `1/n < 0,05` → `n >= 20`.
 *
 * ⚠️ Deliberadamente MAIS FROUXO que o precedente: o piso de impressões da 026 exigia ~10 unidades
 * para atravessar a faixa, e a mesma exigência aqui pediria 200 páginas decididas — nenhum projeto
 * do portfólio tem isso nem somando todas as URLs com impressão. Adotar 200 tornaria o índice
 * permanentemente não publicável, o que é mentir por omissão. Medido na Atma em 20/09/2026: 4
 * decididas, e uma página vale 25 pontos — cinco vezes a faixa inteira.
 */
export const LIMIAR_PAGINAS_DECIDIDAS = 20;
```

O teste afirma a **derivação**, não o número: `1 / LIMIAR_PAGINAS_DECIDIDAS < 0.05` e
`1 / (LIMIAR_PAGINAS_DECIDIDAS - 1) >= 0.05`. Constante afirmada por igualdade sobrevive a mudar a
meta do board; afirmada pela desigualdade que a gerou, não.

### `FAIXAS` e `faixaDaPosicao(posicao)`

```
@returns {{rotulo:string, de:number, ate:number, regua:number|null}[]}
```

**`FAIXAS` é DERIVADA de `BENCHMARK`**, com uma entrada declarada a mais para a página 2. Cinco
faixas saem dos cinco degraus de `BENCHMARK` (o `ate` de cada um é a fronteira, exclusiva); a sexta é
`{ rotulo: "Página 2 (11 a 20)", de: 11, ate: 21, regua: null }`, declarada porque existe no board e
**não** em `BENCHMARK` — o piso de "~1,5%" não tem fonte.

**O que é derivado e o que é autoral**: `de`, `ate` e `regua` saem de `BENCHMARK` — nenhum número
escrito duas vezes. **`rotulo` é autoral**: "Posições 4 a 6" não existe em `BENCHMARK` e não é
derivável dele. Por isso a trava dos dois sentidos cobre `de`/`ate`/`regua` e **não** cobre `rotulo`;
o que guarda o rótulo é uma asserção separada de que ele nomeia a própria faixa (`de` e `ate - 1`
aparecem no texto). Rótulo é rótulo de exibição, nunca chave.

**Trava obrigatória** (`test/kpis-busca.test.mjs`): o teste percorre `BENCHMARK` e `FAIXAS` **nos dois
sentidos** — degrau de `BENCHMARK` sem faixa, e faixa com `regua` que não existe em `BENCHMARK`. É a
mesma trava que `test/board-gsc.test.mjs` aplica ao catálogo, e existe porque uma segunda lista
divergiria em silêncio no primeiro limiar novo.

`faixaDaPosicao(posicao)` devolve a faixa ou `null` acima de 20,0. Comparação por fronteira
exclusiva, **nunca** re-agregação — `11,000000000000002` cai na página 2 e não fora de tudo.

### `porFaixaDePosicao(paginas, janela)`

```
@param  {LinhaPagina[]} paginas   a leitura por PÁGINA, hosts já somados na borda
@param  {Janela}        janela    declarada, propagada para cada faixa (FR-004)
@returns {FaixaDePosicao[]}       sempre as SEIS, na ordem de FAIXAS
```

**Contrato**:

- Devolve **sempre seis** entradas, mesmo as sem impressão. Faixa que desaparece da saída é
  indistinguível de faixa que o site não alcança, e o estado "o site não aparece aqui" é justamente
  o que precisa aparecer.
- `amostra` é a **soma** das páginas cuja `posicao` cai na faixa. `posicao` da faixa é a média
  ponderada por impressões — usada só para exibição, **nunca** para escolher a faixa.
- `veredito` sai de `vereditoContraRegua()` sobre a amostra **somada** da faixa, contra
  `faixa.regua` — a régua que **julga**, nunca a tabela transcrita do board (FR-005).
- `intervalo` é `null` sem impressão.
- `janela` vai em **cada** faixa, não no objeto pai: o nó do mapa é lido isolado, e uma janela que só
  existe no cabeçalho não acompanha o nó.
- **Nenhuma combinação de janelas** (FR-007): a função recebe **uma** janela e não tem parâmetro para
  uma segunda. Comparar janelas é decisão de tela sobre a mesma página, nunca valor de faixa.

**Consumidores**: `app/gsc/mapa/page.tsx` **e** `app/okr/[slug]/aquisicao/page.tsx`. Uma função, dois
portadores — é o que impede as duas telas de discordarem (`plan.md`, Complexity Tracking).

### `conformidadeDeCtr(paginas, janela)`

```
@returns {ConformidadeDeCtr}   ver data-model.md §6
```

**Contrato**:

- Uma URL por linha. A régua é aplicada **linha a linha**; re-agregar devolveria a deriva de ponto
  flutuante que a 031 removeu.
- **`porTrafego.meta` é `null` obrigatoriamente.** O teste reprova qualquer outro valor: é a trava
  contra copiar a meta da leitura vizinha por simetria (FR-010).
- `porPagina.fracao` e `porTrafego.fracao` são `null` quando o denominador é 0 — **nunca** `0`. Sem
  denominador não há fração, e `0%` mentiria.
- `indecisas`, `semRegua` e `semImpressao` são campos **públicos**, não derivados que a tela
  recalcula: é o que sustenta a FR-011.
- **Invariante cobrável**:
  `decididas + indecisas + semRegua + semImpressao === paginas.length`, e
  `porPagina.atingem <= porPagina.decididas`. O teste soma os quatro.
- `nomeada` é `null` quando `decididas === 0` (FR-013) — e a tela **declara** a ausência, não deixa
  um branco.

**Caso de referência** (Atma, 20/09/2026 — a fixture do teste):
`porPagina 25,0% (1 de 4)` · `porTrafego 2,5% (583 de 22.899)` · `indecisas 20` · `semRegua 5`.

### `paginaNomeada(decididas, impressoesDecididas)`

```
@returns {PaginaNomeada | null}
```

- **Maior impressão entre as decididas**, não a pior. Empate resolve pela URL alfabeticamente menor
  (mesma regra de `termoPrincipal()`), para duas leituras da mesma janela não trocarem de página.
- `veredito` da nomeada é `"atinge"` **ou** `"abaixo"`, nunca `"indecisa"` — a lista de origem é a das
  decididas. Se a maior atinge, a frase diz isso: inverter para "a pior" faria a tela procurar
  problema onde não há.
- `participacao = impressoes / impressoesDecididas` existe para a troca de página nomeada entre duas
  leituras ser visível, e não parecer que algo aconteceu com a página anterior.

### `cliquesNaoCapturados(u)` — **migra** de `lib/gsc-delta.mjs`

Hoje vive em `gsc-delta.mjs:444` e **não tem consumidor em produção**, só o próprio teste. A página
nomeada é o primeiro, e `gsc-delta.mjs` importa `kpis-busca.mjs` (não o contrário), então a função
desce para cá e `gsc-delta.mjs` a **re-exporta**, como já faz com `ctrEsperado`. As 4 asserções migram
para `test/kpis-busca.test.mjs`.

Uma fórmula, um lugar. A alternativa era recalcular "faltam N cliques" na tela e ter duas fórmulas
para o mesmo número.

---

## `kpisPorPagina(paginas, indexadas, janela)`

Agregador da família por URL. Ganha `janela` e troca `ctrGap` por `conformidadeDeCtr` +
`porFaixaDePosicao`:

```js
export function kpisPorPagina(paginas, indexadas = null, janela) {
  return {
    urlsComImpressao: urlsComImpressao(paginas),
    conformidade: conformidadeDeCtr(paginas, janela),
    faixas: porFaixaDePosicao(paginas, janela),
    activeIndexRatio: activeIndexRatio(paginas, indexadas),
  };
}
```

`janela` é **obrigatória** e sem default: uma janela com valor padrão é a porta por onde um número
perde a declaração dela, e a FR-004 exige que todo número desta família a carregue.

---

## `kpisPorTermo(linhas, ehMarca)` — o que muda na US3

A assinatura de `kpisPorTermo` **não** muda. A de `impressoesNoTop3()` **muda, e precisa mudar**:
hoje ela devolve só a fração (`noTop3 / total`, `lib/kpis-busca.mjs:106`) e descarta os dois números
que `vereditoContraFaixa()` exige. Passa a devolver `{ fracao, noTop3, total }`, e `null` quando
`total === 0` — como hoje.

O numerador é **impressão no Top 3, nunca clique**:
`vereditoContraFaixa(k.impressoesNoTop3.noTop3, k.impressoesNoTop3.total, [0.40, 0.50])`. Chamar o
numerador de "cliques" numa feature que existe para separar clique de impressão é o rótulo trocado
de instrumento.

Isso também mata uma **segunda fórmula**: `app/okr/[slug]/aquisicao/page.tsx:1984` hoje recalcula o
numerador na tela (`Math.round(impressoesNoTop3 * baseCurta)`) porque a lib não o expõe. Uma conta,
um lugar — o mesmo motivo da migração de `cliquesNaoCapturados()`.

Os 6 pontos de asserção de `test/kpis-busca.test.mjs` (`:249`, `:253`, `:254`, `:284`, `:309`,
`:492`) passam a ler `.fracao`.

A base parcial da leitura por termo (o GSC omite as consultas raras) **continua** declarada pelo selo
de piso — são coisas diferentes: aquele piso é sobre a **completude da dimensão**, este era sobre a
**suficiência da amostra**. Só o segundo sai. Confundir os dois removeria uma ressalva conquistada.
