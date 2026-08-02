# `docs/` — índice

Relatórios de medição, taxonomias e documentação de feature. Escrito em 01/08/2026.

> ⚠️ **Os `.md` da raiz NÃO foram movidos para subpastas, de propósito.** Eles são citados por
> CAMINHO em 15 handoffs datados (que não se reescrevem) e nos fixtures congelados do detector de
> defasagem (`data/defasagem-*.json`) — mover quebraria os dois. Este índice existe no lugar da
> reorganização. **Documento novo nasce em subpasta** (ver `busca/`).

## Feature — busca (`/busca`)

| arquivo | público |
|---|---|
| [`busca/resumo-executivo.md`](busca/resumo-executivo.md) | uma página: o quê, os números, o risco |
| [`busca/tecnico-devs.md`](busca/tecnico-devs.md) | quem vai mexer no código |
| [`busca/para-leigos.md`](busca/para-leigos.md) | entender sem saber programar |
| [`busca/como-usar.md`](busca/como-usar.md) | instruções + 6 casos de uso executados |
| [`rag-arquitetura.md`](rag-arquitetura.md) | a arquitetura **planejada** (camadas 0-7). O que foi construído está em `busca/tecnico-devs.md` |

## Taxonomia do corpus

| arquivo | o que fixa |
|---|---|
| [`protocolos-areas.md`](protocolos-areas.md) | áreas de protocolo — taxonomia da camada 0 |
| [`protocolos-triagem.md`](protocolos-triagem.md) | protocolo × estado × episódio (31/07) |
| [`curadoria-familia-concordancia.md`](curadoria-familia-concordancia.md) | holdout cego de `familia`/`estado`: 77,1% e 85,7%. **Os testes das famílias, com ordem de precedência, moram aqui** |

## Detector de defasagem — 🧊 frente CONGELADA por decisão (01/08)

Ordem de leitura para quem for descongelar. **Descongelar exige responder ANTES para quê.**

| arquivo | o que mede |
|---|---|
| [`defasagem-calibracao.md`](defasagem-calibracao.md) | os dois portões e por que reprovam |
| [`defasagem-fase-c-2026-08-01.md`](defasagem-fase-c-2026-08-01.md) | poder de resolução do portão |
| [`defasagem-reprodutibilidade-2026-08-01.md`](defasagem-reprodutibilidade-2026-08-01.md) | movimento zero ao reindexar (critério 1.7) |
| [`defasagem-monocultura-2026-08-01.md`](defasagem-monocultura-2026-08-01.md) | holdout fora da monocultura: as células perigosas apareceram |
| [`defasagem-mineracao-2026-08-01.md`](defasagem-mineracao-2026-08-01.md) | minerar `desmente` do git: **reprovou**, 8 pares contra meta de 15 |
| [`auditoria-congelado-2026-08-01.md`](auditoria-congelado-2026-08-01.md) | auditoria de tudo que se diz congelado/determinístico/reprodutível |

## Medições de estado

| arquivo | o que apura |
|---|---|
| [`gateways-cruzamento-2026-08-01.md`](gateways-cruzamento-2026-08-01.md) | HTML servido × código do repo: 10 com SDK, 1 ligado, **R$ 0,00 de receita provada** |
| [`estado-conformidade-crawl-2026-08-01.md`](estado-conformidade-crawl-2026-08-01.md) | os 33,6% de OK do `roilabs.com.br` são de JUNHO — datar antes de caçar bug |
| [`juiz-fase-b-2026-08-01.md`](juiz-fase-b-2026-08-01.md) | os 4 casos que o juiz apontou para dentro da casa |

## `Crawl-stats/` — exports do Search Console

**Layout: `Crawl-stats/{host}/{host}-Crawl-stats-{AAAA-MM-DD}/`** — o mesmo que
`lib/crawl-fetch.mjs:27` escreve. Reorganizado em 01/08: o lote de 10/07 estava em pastas ad-hoc
(`After/`, `Roi/`, `estetia crm/`…), agora está junto do lote de 25/07 por host.

- `lib/crawl-exports.mjs :: acharExports()` casa pelo **nome da pasta**, recursivo a partir de
  `docs/` — a subpasta não importa, o nome importa. Renomear a pasta do export **some com o dado**.
- Crawl stats **não tem API**: a UI é a única fonte, e o que está no repo é o que alguém exportou
  por último. Todo número derivado daqui carrega a **data do export**.
- ⚠️ Cada export cobre **90 dias**: falha que aparece no gráfico hoje pode ser de dois meses atrás.
- Consumidores: a aba `/infra` e o fato `D-85` em `lib/dourado-estado.mjs`.

## `superpowers/`

Plano e spec do autopublishing (24/07), do fluxo de skills. Histórico — não é norma vigente.
