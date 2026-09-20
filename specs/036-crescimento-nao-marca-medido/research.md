# Phase 0 — Research

**Feature**: 036 · Crescimento Não-Marca medido no board · **Medido em**: 2026-09-20

Tudo abaixo foi lido do banco de produção (`hub_gsc_dia`) e da API do Search Console, com as
funções puras do próprio repositório. Nada é estimado.

## Q1 — O que o coletor devolve hoje?

`crescimentoNaoMarca(dias, "2026-09-20")` sobre os 250 dias da Atma (11/01/2026 → 17/09/2026):

```json
{ "de": "2026-07", "para": "2026-08", "deImpressoes": 342, "paraImpressoes": 14689,
  "valor": 41.95, "diasZeroDe": 27, "diasDe": 31, "baseInterrompida": true }
```

`mesesFechados` devolve **sete**: fev (20.500), mar (36.400), abr (50.824), mai (23.945),
jun (6.377), jul (342), ago (14.689). Janeiro fica fora — a série começa em 11/01 e o mês tem 21
dias medidos de 31, então a regra de calendário o descarta antes de ele virar um mês-base pequeno.

**Consequência para o desenho**: o estado mais provável na entrega **é** o de base interrompida. Não
é caso de borda a ser tratado depois; é o caso de estreia.

## Q2 — Quais das quatro ausências são alcançáveis na base real?

| estado | alcançável hoje | evidência |
|---|---|---|
| `medido` (com `baseInterrompida`) | **sim** | a Atma, acima |
| `nao-declarada` | **sim, em 33 dos 34 projetos** | `hub_gsc_dia` tem série para 34 projetos; só `atma` tem `impressoes_nao_marca` preenchido (250 de 250 dias). Nos outros 33 são **0 de 238/141/126/…** |
| `nao-consecutivos` | não | os sete meses fechados da Atma são consecutivos (fev→ago) |
| `base-zero` | não | o menor mês-base é julho com **342**, não zero |

Os dois inalcançáveis entram só como teste sintético. Isso é decisão, não lacuna: um estado que a
função pode produzir e a suíte não exercita é um estado que ninguém leu antes de ele aparecer em
produção.

**O achado que muda a FR-006**: hoje, para os 33 projetos sem separação, `mesesFechados` devolve `[]`
(descarta todo dia sem `impressoesNaoMarca` numérico) e a função devolve `null` — indistinguível de
"o site é novo demais". Verificado em `roi-labs-links`, 238 dias de série:

```
mesesFechados       -> []
crescimentoNaoMarca -> null
a tela publicaria   -> "ainda não há dois meses fechados nesta janela"   ← causa ERRADA
```

Na aba de aquisição esse texto **não chega à tela**, porque `marcaDeclarada()` intercepta antes e
publica o motivo certo num parágrafo que envolve o bloco. No mapa não há envelope: a folha é um nó
solto. Sem o estado na função pura, o nó novo publicaria a causa errada para 33 projetos.

## Q3 — O que a razão esconde, e por que a nota precisa da forma da série

A razão compara **meses fechados**. Hoje os dois últimos são julho e agosto, e o mês corrente não
entra por construção. Medido:

| | impressões não-marca | por dia |
|---|---:|---:|
| agosto (31 dias) | 14.689 | **474** |
| setembro (1→17, série fecha em D-3) | 3.794 | **223** |

No ritmo atual setembro fecha em ~6.700 e a próxima leitura válida (ago→set, disponível em 04/10)
será de **≈ −54%**. A razão publicada hoje é `43×`.

A forma da série, pelo mesmo módulo (`ritmoDoSegmentoAtual`, com os hosts declarados):

| | semana | impressões não-marca | posição média |
|---|---|---:|---:|
| pico | 06→12/04 | **17.020** | 2,8 |
| última completa | 07→13/09 | **1.492** | 8,3 |

`fracaoDoPico` = **8,8%**; `quedasConsecutivas` = 0 (a última subiu contra 1.449 da anterior);
`semanasCompletas` = 35.

**Consequência para o desenho**: a US3 não é enfeite. Sem ela o nó publica `43×` — a leitura mais
otimista que o dado permite — no mês em que ela é a mais falsa.

## Q4 — Onde mora a regra que impede `4.195%`?

`variacao()` é **closure local** dentro do componente (`app/okr/[slug]/aquisicao/page.tsx:729`),
fora de qualquer teste:

```js
const variacao = (f) => Math.abs(f) >= 10 ? `${(f + 1).toLocaleString("pt-BR", …)}×` : pct(f);
```

Ela existe por um fato medido pela 025: em pt-BR o separador de milhar é o ponto, então `4195%`
imprime `"4.195%"`, que ao lado de "5% a 10%" lê como 4,195% e **inverte o veredito**. O `43×` da
Atma é justamente o valor que dispara a regra.

Três caminhos, e dois recriam o defeito:

| caminho | resultado |
|---|---|
| formatar com `pct()` no mapa | publica `4.195%` — o defeito da 025, na segunda tela |
| copiar `variacao()` para `page.tsx` do mapa | funciona hoje; duas cópias divergem na primeira mudança, e nenhuma tem teste |
| **subir para `lib/marca.mjs`** | uma regra, testada, importada pelas duas telas |

## Q5 — A leitura custa o quê?

`/gsc/mapa` hoje faz **duas** requisições ao Search Console por render (`gscPaginas` e `gscTermos`) e
**nenhuma** consulta ao Postgres. A medida desta feature vem de `hub_gsc_dia`, gravada pela corrida
das 05:17 — **zero** requisição nova ao Google, **uma** consulta nova ao banco (250 linhas para a
Atma), atrás de `dbOn()`.

Buscar as pernas no render foi recusado pela 025 e continua recusado: triplicaria a rede por visita
para exibir o mesmo número, e devolveria um número sem data que finge ser de hoje.

## Q6 — A separação da Atma fecha?

`completude(dias)` sobre os 250 dias:

```json
{ "estado": "fecha", "residuo": 0, "impressoesPais": 180200,
  "impressoesMarca": 10111, "impressoesNaoMarca": 170089 }
```

Resíduo **0**. As duas medidas são completas, não pisos — a ressalva de `fracao` da FR-007 da 025
não se aplica, e o nó não precisa carregá-la.

## Fora do escopo, medido e registrado

A marca declarada da Atma é `atma`, `atma aligner`, `atma alinhadores` (declarada em 08/09). O
domínio virou `usealigner.com` em **11/09**. Na semana 11→17/09, na dimensão `query` com corte
`bra`, **zero** impressão para `usealigner` ou `use aligner` — o nome novo ainda não é buscado; a
marca ainda é `atma aligner` (105 impressões nos dois hosts). O KPI não está contaminado hoje.

Quando passar a ser buscado, essas impressões cairão em **não-marca** e inflarão exatamente este
KPI. O conserto é mudar `marca.termos` e **recorrer o backfill** — reescreve o histórico da fatia de
marca, não é mudança de tela, e por isso não entra nesta feature.
