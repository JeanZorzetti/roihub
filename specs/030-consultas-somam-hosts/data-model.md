# Phase 1 — Modelo de dados: a leitura por página somada

**Feature**: `030-consultas-somam-hosts` | **Data**: 2026-09-19

Nenhuma tabela nova, nenhuma migração, nenhuma coluna. **Esta feature não grava nada** — as três
leituras acontecem no render (aba e ficha) ou dentro de uma corrida que já existe (autopublishing).
As entidades abaixo vivem em memória, entre a borda do Search Console e quem exibe.

## E1 — Host declarado

A lista que o card do projeto declara como sendo o site. **Já existe**, produzida por
`hostsDeclarados()` em `lib/projects.mjs:146`. Esta feature a consome; não a redefine.

| Campo | Tipo | Origem | Regra |
|---|---|---|---|
| (item) | `string` | `url` e `dominioAnterior.url` do card | sem `www.`, sem repetição, ordenado por declaração |

**Invariantes**

- `hosts[0]` é o host de `url` — o atual. É ele que assina a URL canônica (FR-003).
- Lista vazia significa "o card não declara URL utilizável", NUNCA "o site não tem host". Quem
  recebe vazio não lê nada e diz isso (D5) — não lê tudo, e não lê um host padrão.
- Nunca inferida do tráfego. Domínio antigo já zerado continua na lista e contribui com zero linhas
  (edge case da spec).

## E2 — Linha de busca bruta

O que o Search Console devolve por propriedade. Forma preservada de `lib/gsc.ts` (`GscPageRow`).

| Campo | Tipo | Nota |
|---|---|---|
| `keys` | `string[]` | conforme `dimensions` pedidas: `["query","page"]` ou `["page"]` |
| `clicks` | `number` | |
| `impressions` | `number` | |
| `position` | `number` | média da própria propriedade, já ponderada pelo Google |

**Validação**: linha com `query` ou `page` vazio não é linha de busca e é descartada — guarda que
já existe em `mergeGscWindows` e em `gscConsultas`, mantida.

## E3 — Resposta por host

Agrupa o que UM host devolveu, antes da soma. Existe para que a falha saiba se nomear (FR-004) e
para que o truncamento seja medido por propriedade (FR-005, D6).

| Campo | Tipo | Regra |
|---|---|---|
| `host` | `string` | o host declarado, não a propriedade — `sc-domain:` cobre o domínio inteiro |
| `propriedade` | `string` | o que `resolveProperty` escolheu; só para diagnóstico |
| `rows` | `GscPageRow[]` | como vieram |
| `truncado` | `boolean` | `rows.length >= TETO_LINHAS` (25.000), por propriedade |

**Estados que não colapsam** (D5): host sem propriedade não produz `Resposta por host` — produz uma
entrada em `encerrados`. Host que falhou não produz nem uma coisa nem outra: aborta a leitura.

## E4 — Página mesclada

O produto da feature. Uma linha por caminho (mais `query`, quando a dimensão existir).

| Campo | Tipo | Regra |
|---|---|---|
| `query` | `string \| undefined` | presente só quando `dimensions` inclui `query` |
| `page` | `string` | `https://${hosts[0]}${pathname}${search}` — reconstruída (FR-003) |
| `caminho` | `string` | `pathname + search`, a chave da mescla (FR-002) |
| `cliques` | `number` | soma de todos os hosts |
| `impressoes` | `number` | soma de todos os hosts |
| `posicao` | `number \| null` | média ponderada por impressões; `null` sem impressão |
| `hosts` | `string[]` | quem contribuiu com esta linha, em ordem de declaração |

**Regras de validação**

- `posicao` NUNCA é `0`: posição 0 não existe no Google, e gravá-la faria "não medido" ler como a
  melhor posição possível. É `null` — mesma regra de `diasParaGravar` e `somarSeriesPorHost`.
- `posicao` só entra na ponderação quando é `number` finito **e** a linha tem impressão. Linha de 0
  impressões não vota.
- A chave preserva barra final e querystring (D4). `/x` e `/x/` não se fundem.
- `hosts` é da LINHA, não da leitura: uma página que só existe no domínio antigo declara um host só.

## E5 — Leitura somada

O que cada uma das três bordas devolve ao chamador. Um dos quatro estados, nunca uma mistura.

```text
{ linhas: PáginaMesclada[], hosts: string[], encerrados: string[], truncado: boolean }
| { erro: string }     ← falha transitória; a string COMEÇA com o host (FR-004)
| null                 ← ausência estrutural: env desligada, lista vazia, ou nenhum host com propriedade
```

| Campo | Regra |
|---|---|
| `hosts` | os que de fato foram consultados e responderam. É o que a tela publica (FR-008) |
| `encerrados` | declarados sem propriedade no GSC. Ausência estrutural, separada da falha (D5) |
| `truncado` | OR sobre `E3.truncado` de todos os hosts (D6) |

**Invariante que fecha a SC-004**: `sum(linhas.impressoes)` é igual à soma das impressões que cada
propriedade devolveu para a mesma janela, com diferença zero. A mescla redistribui linhas, nunca
altera totais.

**Invariante que fecha a SC-003**: `linhas.map(l => l.page)` — restrito às linhas de mesma `query`,
ou a lista inteira quando não há `query` — não tem repetição.

## Estados e transições

Não há máquina de estados: a leitura é sem memória, calculada a cada render/corrida. A única
transição do domínio é externa e já modelada em E1 — um projeto ganha `dominioAnterior` no card e,
da leitura seguinte em diante, as três passam a somar dois hosts **de uma vez** (FR-007). Nada
migra, nada precisa de backfill.
