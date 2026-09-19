# Auditoria de dados — `/gsc/mapa` (032)

**Data:** 19/09/2026 · **Alvo:** `https://hub.roilabs.com.br/gsc/mapa`
**Commit auditado:** `d57fef6` — *Publish the whole board, not just the leaves it can judge*
**Estado do repo:** working tree limpa · `npm test` 1029/1029 · tela no ar (200, 123.281 bytes, autenticada)

---

## O que esta tela tem de dado, e o que ela não tem

`/gsc/mapa` é `force-static`. **Não lê banco, não lê GSC, não lê projeto.** Não há janela de data
para auditar, não há host para somar, não há zero que possa ser filtro. A decisão está declarada em
[`app/gsc/mapa/page.tsx:20`](../app/gsc/mapa/page.tsx#L20) e é correta — os números da Atma vivem em
`/okr/atma/aquisicao`, e repeti-los aqui daria duas telas discordando sobre o mesmo KPI.

O dado auditável são **duas listas em disco e a junção delas**:

| Fonte | O que guarda | Apurado |
|---|---|---|
| `lib/gsc-delta.mjs#CATALOGO` | 32 folhas + a natureza do balizador de cada uma | 32 |
| `lib/board-gsc.mjs#BOARD` | o título numerado e a prosa transcrita do Whimsical | 32 |
| `lib/board-gsc.mjs#mapaDoBoard()` | a árvore montada da junção | 113 nós |

Apurado por execução, não por leitura:

```
CATALOGO folhas: 32     BOARD entradas: 32     órfãs nos dois sentidos: 0
com régua (◆): 7  -> ctrPorPosicao, ctrGap, larguraTitulo, lcp, inp, cls, ttfb
sem régua (◇): 25 -> recusa 18 · norma 3 · semColetor 3 · procedimento 1
nós no mapa: 113        folhas com metadata.chave: 32        nós com note: 84
```

**A contagem bate.** 32/7/25/113 são verdade. A estrutura está travada por teste nos dois sentidos,
e essa trava é boa — foi ela que encerrou as duas semanas de reconstrução do board.

**O que não está travado é o VALOR.** Nenhum dos 1029 testes compara um número transcrito do board
com a constante que o hub usa para julgar. Os testes verificam que as duas *listas* casam; nunca que
os dois *números* casam. Todos os 9 achados abaixo passam por `npm test` sem uma falha.

---

## Achados

### A1 · CRÍTICO — o TTFB publica o número que o hub descartou no mesmo dia

A folha `ttfb` carrega a tag **◆ régua publicada**. O painel diz `limiar 800`. O nó filho, que é o
texto grande e visível no mapa, diz:

> **≤ 600ms**, idealmente < 300ms em conexões locais

Os dois estão na mesma página, no ar, agora. `curl` confirma: `600ms` → 1 ocorrência, `limiar 800` →
1 ocorrência.

O 600 não é uma alternativa em aberto. Ele foi **explicitamente rejeitado em 19/09/2026**, o mesmo
dia em que esta tela nasceu — [`lib/crux.mjs:20-23`](../lib/crux.mjs#L20):

> ⚠️ 19/09/2026 — o TTFB foi de 600 para 800ms, por decisão do dono após o levantamento de
> `handoff/gsc-balizador-estudo.md` §1.1. **O 600 vinha do board e não tinha fonte**; 800ms no p75 é
> o limiar publicado pelo Google. **Entre 600 e 800ms a tela REPROVAVA o que a fonte oficial aprova
> — falso-negativo, não rigor.**

A decisão foi aplicada em `crux.mjs` e em `gsc-delta.mjs`. A terceira fonte — `board-gsc.mjs` —
republicou o valor antigo, e o republicou **mais visível que o vigente**: o 600 está no rótulo do
nó, o 800 exige clicar no pai e ler o painel.

O mais grave é que o repo **sabe tratar esta classe de divergência** e tratou as outras duas:

- `profundidadeClique`: board diz 3, `grafo.mjs` usa 4 → declarado no motivo do balizador **e** em `EDITORIAIS`.
- `larguraTitulo`: board diz piso 500, sem fonte → declarado dentro do próprio `recorte` da régua.
- `ttfb`: board diz 600, código usa 800 → **não declarado em lugar nenhum.** `EDITORIAIS` registra o
  `ideal: 300` e passa direto pelo 600.

**Reproduzir:** `grep -n "600" lib/board-gsc.mjs` · `grep -n "limite: 800" lib/gsc-delta.mjs`

---

### A2 · CRÍTICO — duas tabelas de CTR por posição, conflitantes, ambas com selo ◆

O mapa publica **dois conjuntos de piso de CTR por posição**, em duas folhas distintas, as duas
marcadas ◆ e as duas citando **a mesma fonte** (First Page Sage) no painel:

| Posição | `ctrPorPosicao` (◆) | `ctrGap` (◆) = `BENCHMARK` do código | divergência |
|---|---|---|---|
| 1 | > 30% | ≥ 25% | +20% |
| 2 | > 18% | ≥ 13% | +38% |
| 3 | > 12% | ≥ 8% | +50% |
| 4 a 6 | > 7% | ≥ 4,5% | +56% |
| 7 a 10 | > 4% | ≥ 2% | **+100%** |
| 11 a 20 | ~ 1,5% | *(sem piso)* | — |

`BENCHMARK` em `kpis-busca.mjs` é **idêntico** à coluna do `ctrGap` (verificado: `true`). Ou seja: a
tabela que o hub usa para emitir veredito é a segunda. A primeira não julga nada — mas é a que abre
o ramo CLIQUE, é o KPI nº 1 do board, e nada na tela diz qual das duas manda.

Quem usar a primeira para avaliar uma URL na posição 8 vai cobrar **o dobro** do que o hub cobra.

Isto acontece apesar de [`lib/gsc-delta.mjs:146`](../lib/gsc-delta.mjs#L146) proibir exatamente isso:

> Os VALORES de CTR não moram aqui: `ctrEsperado()` é importado de `kpis-busca.mjs`. **Duas tabelas
> de CTR no mesmo repo seria uma delas ficando para trás na primeira correção.**

A regra foi escrita para o `CATALOGO` e respeitada lá. `board-gsc.mjs` introduziu duas tabelas
literais como prosa — e a prosa não é coberta pela regra nem por teste.

**Efeito colateral:** `kpis-busca.mjs:26` afirma *"Acima de 10,9 o board NÃO define piso"*. A
transcrição de 19/09 desmente: o board define `~1,5%` para a página 2
([`board-gsc.mjs:112`](../lib/board-gsc.mjs#L112)). O comentário que justifica devolver `null`
tornou-se falso no momento em que o board entrou no repo, e ninguém ligou os dois.

---

### A3 · ALTO — `penetracaoTop3` aponta para um coletor que mede outra grandeza

O painel da folha `penetracaoTop3` afirma: `Medido em lib/kpis-busca.mjs#impressoesNoTop3`.

O mapa publica, dois nós acima, a fórmula do board para esta folha:

> (Termos estratégicos com Posição ≤ 3) ÷ (**Total de termos monitorados**) × 100 — meta 20% a 30%

O coletor apontado faz outra conta ([`kpis-busca.mjs:97`](../lib/kpis-busca.mjs#L97)):

```js
export function impressoesNoTop3(linhas) {          // fração de IMPRESSÕES, não de termos
  return linhas.filter(l => l.posicao < 4 && l.posicao >= 1)
               .reduce((a, l) => a + l.impressoes, 0) / total;
}
```

`penetracaoTop3` conta **termos**; o coletor soma **impressões**. São métricas diferentes com metas
diferentes — e a prova está no próprio catálogo: `impressoesTop3` aponta para o **mesmo** coletor,
com a meta de 40% a 50%. Um coletor, dois KPIs, duas metas, uma implementação.

Na tela, quem abrir `penetracaoTop3` lê "medido" e vai comparar um percentual de impressões contra
uma meta de inventário de palavras-chave.

---

### A4 · ALTO — "as 25 em que o número existe" é falso para 6 delas

Texto de nível 1, [`page.tsx:66`](../app/gsc/mapa/page.tsx#L66), no ar:

> ◆ marca as 7 folhas com fonte, URL e recorte declarados, ◇ **as 25 em que o número existe e
> ninguém publica a faixa dele**.

Apurado: **6 das 25 não têm coletor nenhum.** O número não existe.

| Folha | Natureza | Coletor |
|---|---|---|
| `rejeicaoRastreio` | `semColetor` | — |
| `referringDomains` | `semColetor` | — |
| `tamBusca` | `semColetor` | — |
| `reescritaTitulo` | `recusa` | — |
| `coberturaSemantica` | `recusa` | — |
| `checklistGsc` | `procedimento` | — (é um checklist, não uma medida) |

A frase colapsa **quatro naturezas** — `recusa`, `norma`, `semColetor`, `procedimento` — numa
afirmação única que é falsa para seis folhas. É exatamente o colapso que
[`gsc-delta.mjs:40`](../lib/gsc-delta.mjs#L40) criou cinco tipos para evitar:

> Cinco tipos e não uma flag booleana `temRegua` […] sem eles, as folhas sem veredito devolviam a
> MESMA frase por razões diferentes, e quem lê a tela não distinguiria "ninguém publica isso" de
> "falta ligar a fonte" — **e os dois pedem trabalho oposto.**

O painel individual acerta: mostra `nenhum coletor` ao clicar. O defeito está no resumo, que é o que
se lê primeiro e o que a maioria lê só.

---

### A5 · MÉDIO — "em 5 níveis" são 6

[`page.tsx:61`](../app/gsc/mapa/page.tsx#L61), no ar: *"113 nós ao todo, **em 5 níveis**"*.

Medido: **6 níveis.** Distribuição — `{1: 1, 2: 4, 3: 20, 4: 47, 5: 34, 6: 7}`.

Caminho mais fundo:

```
1. GSC
2. CTR
3. 4. Taxa de Integridade do Título (Sem Truncamento / Sem Reescrita pelo Google)
4. Metas recomendadas
5. Comprimento em pixels
6. 100% dos títulos entre 500px e 580px
```

7 nós vivem no nível que a tela diz não existir. `.info/log.json` registrou o mesmo erro
(`"profundidade 5"`), então a medida nunca foi feita — foi estimada e propagada.

---

### A6 · MÉDIO — `7`, `25` e `5 níveis` são literais na prosa, e nada os trava

`{total}` e `{Object.keys(cat).length}` são computados. **`7`, `25` e `5` são texto.**

Os testes comparam listas contra listas, nunca contra uma constante:

```js
test("as 7 folhas com régua são exatamente as que o catálogo diz ter régua", () => {
  const comRegua = Object.keys(CATALOGO).filter(k => regua(k).tem);   // computa dos dois lados
  assert.deepEqual(marcadas.sort(), comRegua.sort());                 // nunca assere === 7
});
```

Mudar o balizador de uma folha de `recusa` para `regua` mantém os 1029 testes verdes e deixa a tela
dizendo 7/25 para um mundo de 8/24. Mesmo padrão da constante acoplada ao tamanho da lista — a lista
encolhe, a constante fica.

---

### A7 · MÉDIO — 2 das 7 "réguas publicadas" não publicam limiar algum

`selo()` monta o texto do painel a partir de `regua().meta`. Apurado:

| Folha | `meta` | O painel mostra |
|---|---|---|
| `larguraTitulo` | `580` | `… · limiar 580 · …` |
| `lcp` / `inp` / `cls` / `ttfb` | `2500` / `200` / `0.1` / `800` | `… · limiar N · …` |
| **`ctrPorPosicao`** | **`null`** | fonte e recorte, **sem número** |
| **`ctrGap`** | **`null`** | fonte e recorte, **sem número** |

Por desenho isso é defensável — a régua das duas é uma *tabela* (`benchmark()`), não um escalar. Mas
na tela as duas recebem o mesmo rótulo `régua publicada` das outras cinco, e o placar `7 ◆` conta as
sete como equivalentes. Na prática, **5 folhas das 32 carregam um número que julga**; duas carregam
uma fonte, e o número delas está espalhado em nós-filho conflitantes (A2).

**Agravante:** as duas são as únicas com `base: "impressoes"`, ou seja, as únicas cuja régua só vale
acima de `PISO_IMPRESSOES_VEREDITO = 100`. Esse piso **não aparece na tela** — `grep` por `piso` em
`page.tsx`, `mapa.tsx` e `board-gsc.mjs` devolve **0**. A condição de validade da única régua
tabelada do mapa é invisível.

---

### A8 · BAIXO — 4 folhas dizem "medido" apontando para coletores que devolvem um piso

`consultasUnicas` e `queryToPageRatio` retornam `{ valor, piso: true }` — a dimensão `query` do GSC
omite consultas raras, então o número **é sempre um piso, nunca o total**. O código sabe disso e
carrega a flag justamente para a tela não publicar o piso como se fosse a razão real.

`/gsc/mapa` publica `Medido em lib/kpis-busca.mjs#consultasUnicas` e para por aí. A flag não viaja
até o mapa. Afeta `consultasUnicas`, `queryToPage`, `top20`, `activeIndexRatio`.

Relacionado: o board define a janela (`≥ 1 impressão em 28 dias`) para duas dessas folhas, e as
funções apontadas são puras — **não conhecem janela nenhuma**; quem recorta é a borda que as chama.
O mapa publica a janela do board e credita um coletor que não a garante.

---

### A9 · BAIXO — dois comentários desatualizados no mesmo dia em que foram escritos

- [`gsc-delta.mjs:41`](../lib/gsc-delta.mjs#L41) — *"as **22** folhas sem veredito"*. São **25**.
- [`kpis-busca.mjs:26`](../lib/kpis-busca.mjs#L26) — *"Acima de 10,9 o board **NÃO** define piso"*.
  Define: `~1,5%` para a página 2 (ver A2).

Nenhum dos dois muda comportamento. Ficam registrados porque são o rastro de que a transcrição do
board entrou no repo sem uma passada de reconciliação contra o que já existia — que é a causa-raiz
comum de A1, A2 e A9.

---

## Camada 2 — as fontes externas, conferidas na web (19/09/2026)

A tela oferece **"ver a fonte"** em 7 folhas, linkando 4 URLs. Um link é a tela emprestando a
autoridade de terceiro ao próprio número — então cada URL foi aberta e confrontada com o que
publica hoje.

### W1 · CRÍTICO — nenhuma das duas tabelas de CTR reproduz a fonte que ambas citam

First Page Sage publica hoje:

| Posição | FPS (fonte) | `ctrGap` = `BENCHMARK` (**julga**) | `ctrPorPosicao` (board) |
|---|---|---|---|
| 1 | **39,8%** | 25% · −37% | > 30% · −25% |
| 2 | **18,7%** | 13% · −30% | > 18% · ✓ |
| 3 | **10,2%** | 8% · −22% | > 12% · **+18%** |
| 4 / 5 / 6 | **7,2 / 5,1 / 4,4%** | 4,5% | > 7% |
| 7 / 8 / 9 / 10 | **3,0 / 2,1 / 1,9 / 1,6%** | 2% · ✓ | > 4% · **~2×** |

**A régua que emite veredito está sistematicamente abaixo da fonte que ela cita.** Na posição 1 o
hub cobra 25% onde a fonte mede 39,8%.

Consequência operacional: **uma URL na posição 1 com 26% de CTR passa no `ctrGap` do hub**, enquanto
a fonte linkada na mesma tela diz que a média daquela posição é 39,8%. Isso é um **falso-positivo** —
exatamente o inverso do falso-negativo que a correção do TTFB (600→800) eliminou em 19/09. As duas
decisões foram tomadas no mesmo dia, em direções opostas, e só uma foi conferida contra a fonte.

O `ctrPorPosicao` do board erra para os dois lados: bate na posição 2, fica 25% abaixo na 1, e cobra
**quase o dobro** nas posições 8 a 10.

### W2 · ALTO — o recorte declarado da FPS afirma duas coisas que a fonte não sustenta

`FPS.recorte` em [`gsc-delta.mjs:53`](../lib/gsc-delta.mjs#L53) declara:
`"EUA · SERP limpa, sem outros elementos · sem segmentação por vertical · atualizado 2025-12-23"`

| Afirmação | Fonte |
|---|---|
| `atualizado 2025-12-23` | ✗ a página diz **"Last Updated: May 28, 2025"** |
| `EUA` | ✗ a fonte **não especifica país** |
| `SERP limpa, sem outros elementos` | ✓ confirmado (sem AI Overview, featured snippet, local pack) |
| `sem segmentação por vertical` | ✓ confirmado (tabela única, categoria "All") |

O `recorte` é o campo que sustenta a validade da régua. Duas das quatro cláusulas são invenção de
precisão — e a data declarada é **sete meses posterior** à real, o que faz a régua parecer mais
fresca do que é.

### W3 · MÉDIO — o teto de 580px é creditado a um estudo que publica 600px

`larguraTitulo` linka o estudo de reescrita de títulos do Zyppy e declara `limite: 580`. O estudo
diz: *"Google typically limits titles to **600 pixels**"*. O 580 é consenso de **outras** fontes
(a zona segura abaixo do corte de ~600) — defensável como número, mas a URL que a tela oferece como
"ver a fonte" não o contém. O recorte diz "convergente entre fontes" e linka a única que diverge.

### W4 · Confirmado — o que está certo, e vale saber que está

- **TTFB 800ms** ✓ exato: *"most sites should strive to have a TTFB of 0.8 seconds or less"*. Também
  confirmados: **não é Core Web Vital**, o limiar é *"rough guide"*, e a página está atualizada em
  **18/11/2025** — a data declarada no repo bate ao dia.
- **LCP 2.500ms · INP 200ms · CLS 0,1** ✓ exatos, no p75.
- **Zyppy** ✓ exatos: 61,6% de reescrita em **80.959 títulos**, piso de **39%** na faixa de 51-60
  caracteres. O motivo da recusa de `reescritaTitulo` é sólido e bem citado.

**Isto agrava A1.** O 800ms não é apenas "a decisão do dono": é o número que a fonte publica,
verificado. O 600ms que o mapa exibe em corpo maior não tem fonte nenhuma — e agora está confirmado
que não tem. A1 deixa de ser "divergência não declarada" e passa a ser **o valor sem fonte publicado
acima do valor com fonte**.

### W5 · Observação de validade — a régua é de SERP limpa, o GSC não é

A própria FPS reporta que **AI Overviews aparecem em ~31% das SERPs**. A tabela usada mede SERP
limpa. O recorte declara isso corretamente, mas o recorte vive no painel do nó-pai: nenhum dos dez
nós-filho que exibem percentuais carrega a condição sob a qual eles valem. Declarar ≠ neutralizar —
o CTR real do GSC é apurado sobre SERPs que incluem AIO, e é contra essa tabela que ele é julgado.

---

## Veredito

**A estrutura é sólida. Os valores não foram reconciliados — nem entre si, nem com as fontes.**

O que está certo, e vale preservar: as duas listas travadas nos dois sentidos, o selo preso a
`regua()` e não ao texto do board, a recusa de link em folha sem fonte, o painel nomeando `nenhum
coletor`, o segundo portador em lista, a tela não lendo dado de projeto. O trabalho de procedência
foi feito com cuidado — é justamente por isso que A1 e A2 surpreendem.

A causa-raiz é única: **a transcrição do board entrou como prosa, e prosa não passa por `regua()`.**
Todo o aparato de procedência protege o campo `balizador`; nada protege o texto do nó-filho, que é o
que o leitor vê primeiro e em corpo maior. O board virou uma terceira fonte de números no repo sem
herdar a disciplina que as outras duas têm.

### Prioridade de conserto

| # | Achado | Conserto mínimo |
|---|---|---|
| 1 | **W1** benchmark abaixo da fonte | decidir: o `BENCHMARK` sobe para os números da FPS, ou o recorte declara que é um piso deliberadamente conservador e **para de citar a FPS como se a reproduzisse**. Hoje o hub aprova posição 1 com 26% citando uma fonte que mede 39,8% |
| 2 | **W2** recorte inventado | corrigir a data para `2025-05-28` e remover `EUA` — a fonte não declara país |
| 3 | A1 TTFB 600 | o 800 tem fonte confirmada; o 600 não tem nenhuma. Declarar no nó, como `profundidadeClique` já faz |
| 4 | A2 duas tabelas CTR | uma das duas some, ou o nó diz qual julga e qual é histórica |
| 5 | A3 coletor errado | remover `penetracaoTop3` de `MEDIDO_POR`, ou implementar a fração por termos |
| 6 | A4 "o número existe" | a frase deriva de `MEDIDO_POR`, não de texto: *"25 sem faixa publicada, das quais 6 sem coletor"* |
| 7 | W3 580px | creditar ao consenso, não ao Zyppy — ou trocar a URL por uma que publique 580 |
| 8 | A5/A6 contagens | computar profundidade e os 7/25 de `mapaDoBoard()`, como `{total}` já faz |

### A trava que falta

Um teste que compare **valor transcrito × constante do código**, por folha. Os 9 achados passam
pelos 1029 testes atuais porque nenhum deles olha para dentro da prosa. Enquanto o board for
transcrito à mão e julgado à parte, é o único ponto onde a divergência pode ser pega antes da tela.

```
test("nenhuma meta publicada contradiz a constante que o hub usa para julgar")
```

---

*Auditoria de dados · escopo `/gsc/mapa` · apuração por execução de `lib/board-gsc.mjs` e
`lib/gsc-delta.mjs`, conferida contra o HTML servido em produção.*
