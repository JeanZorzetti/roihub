# Fase 1 — Modelo de dados: duas leituras, duas famílias de medida

**Feature**: `032-ctr-gap-dimensao-certa` | **Data**: 2026-09-19

Nenhuma tabela nova, nenhuma migração, nenhuma coluna. **Esta feature não grava nada**: as duas
leituras acontecem no render da aba de aquisição, e as entidades abaixo vivem em memória, entre a
borda do Search Console e quem exibe. A série gravada (`hub_gsc_dia`) não é tocada.

O que esta feature acrescenta ao modelo não é um dado novo: é a **natureza** de cada medida, que
até aqui existia só na cabeça de quem escreveu a função.

## E1 — Host declarado

**Já existe** (`hostsDeclarados()`, `lib/projects.mjs`; 030/E1, 031/E1). Consumido, não redefinido.

A invariante que ESTA feature usa: **a mesma lista alimenta as duas leituras** (FR-006). Não há
segunda lista, nem filtro por leitura — se um host entra numa, entra na outra.

## E2 — Leitura por página (a completa)

`GscPaginas`, `lib/gsc.ts` · **já existe** (016, somada por host desde a 030). Uma linha por
CAMINHO, depois de `mesclarPorCaminho`.

| Campo | Tipo | Regra |
|---|---|---|
| `pagina` | `string` | a URL assinada por `hosts[0]`; **é o nome do campo que marca a família** (D2) |
| `impressoes` | `number` | soma dos hosts para aquele caminho |
| `cliques` | `number` | idem |
| `posicao` | `number` | média ponderada por impressões; com um voto, o valor do Google como veio |
| `hosts` | `string[]` | quem contribuiu com a linha |

Acompanham a lista: `hosts`, `encerrados`, `truncado` (contra **1.000**, o `rowLimit` desta
requisição — nunca contra o teto das consultas).

**Não tem `query`.** Por isso nada que dependa de termo pode migrar para cá: a fronteira da spec é
o contrato, e o modelo a torna impossível de violar por descuido.

## E3 — Leitura por termo e página (a parcial)

`GscConsultas`, `lib/gsc.ts` · **já existe** (021, somada por host desde a 030). Uma linha por par
`query`+`caminho`.

| Campo | Tipo | Regra |
|---|---|---|
| `query` | `string` | o termo; ausente da E2 por construção |
| `page` | `string` | a URL, **outro nome de campo** que o da E2 — é a fronteira de tipo (D2) |
| `cliques`, `impressoes`, `posicao`, `hosts` | | como na E2, para o par |

**Invariante medida** (Atma, 2026-08-20 → 2026-09-16): esta leitura devolve **42,1%** das
impressões e **43,8%** dos cliques que a E2 devolve, porque o Search Console omite as consultas
raras. O número dela é um **piso**, e é isso que o selo publica.

## E4 — Família da medida

Não é um objeto em memória: é a propriedade que decide qual leitura alimenta cada função, e onde
ela mora é na **assinatura** (D5) — `kpisPorTermo(linhas)` contra `kpisPorPagina(paginas)`.

| Medida | Família | Fonte |
|---|---|---|
| `ctrGap` (Índice de Conformidade, e a lista `abaixo`) | por URL | E2 |
| `urlsComImpressao` | por URL | E2 |
| `activeIndexRatio` | por URL | E2 |
| amostra do Pass Rate (`lerPassRate`) | por URL | E2 |
| mapa `URL → impressões` do bloco de crawl | por URL | E2 (D10) |
| `consultasUnicas`, `noTop20`, `queryToPageRatio` | por termo | E3 |
| `strikingDistance`, `canibalizacao`, `termoPrincipal` | por termo | E3 |
| `impressoesNoTop3` | por termo | E3 (decisão do dono, D9) |

## E5 — Base da medida

O que a FR-003 põe na tela ao lado de cada número.

| Campo | Tipo | Regra |
|---|---|---|
| `impressoes` | `number` | o total da leitura que alimentou a medida — `totalImpressoes` da lista dela |
| `leitura` | `"pagina" \| "termo"` | qual das duas; é o que impede dois números da mesma aba lerem como contradição |

`null` quando a leitura não respondeu — e aí a medida também não está na tela (E6). Base nunca é
`0` por ausência: zero impressões é um estado medido, e a tela já o distingue.

## E6 — Estado de cada leitura (FR-005)

Herdado da 030/031, **agora em duplicata independente**: um estado por leitura, e um nunca decide
pelo outro.

| Estado | Significa | O que a tela faz |
|---|---|---|
| lista | respondeu | publica as medidas daquela família |
| `null` | nenhum host declarado tem propriedade, ou a env está desligada | ausência **estrutural**: o conserto é domínio próprio |
| `{erro}` | falha transitória; a mensagem COMEÇA pelo host | esconde **só** as medidas daquela família, nomeando a leitura |
| `truncado` | alguma propriedade bateu o teto de linhas da requisição | ressalva de piso **daquela** leitura (D15) |

O par (`null`, `{erro}`) não colapsa: "sem propriedade" e "falhou agora" pedem consertos opostos, e
foi por isso que a 030 os separou.

## E7 — Régua de CTR por posição

`BENCHMARK` + `benchmark(posicao)`, `lib/kpis-busca.mjs` · **inalterada**. Esta spec troca a
alimentação, não o balizador (Assumptions). A faixa coberta continua terminando em **10,9** — é
justamente por isso que a leitura errada expulsava a home (11,82) do denominador.
