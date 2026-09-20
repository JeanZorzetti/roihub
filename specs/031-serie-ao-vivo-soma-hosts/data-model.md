# Phase 1 — Modelo de dados: a série ao vivo somada

**Feature**: `031-serie-ao-vivo-soma-hosts` | **Data**: 2026-09-19

Nenhuma tabela nova, nenhuma migração, nenhuma coluna. **Esta feature não grava nada**: as quatro
leituras acontecem no render (aba, `/seo`, ficha) ou na avaliação da home. As entidades abaixo vivem
em memória, entre a borda do Search Console e quem exibe. A série **gravada** (`hub_gsc_dia`) não
muda de forma nem de conteúdo (Assumptions).

## E1 — Host declarado

**Já existe** (`hostsDeclarados()`, `lib/projects.mjs:146`; 030/E1). Consumido, não redefinido.

**Invariantes que esta feature usa**: `hosts[0]` é o host de `url` (o atual); lista vazia significa
"o card não declara URL utilizável" — quem a recebe não lê nada e devolve `null`, nunca lê um host
padrão; a lista nunca é inferida do tráfego (domínio antigo já zerado continua nela).

## E2 — Dia da série

**Já existe** (`GscDay`, `lib/gsc.ts`). Forma preservada.

| Campo | Tipo | Regra |
|---|---|---|
| `date` | `string` `YYYY-MM-DD` | chave; um por data depois da soma |
| `clicks` | `number` | soma dos hosts |
| `impressions` | `number` | soma dos hosts |
| `position` | `number` | média **ponderada por impressões**; com UM voto, o valor do Google como veio (D4) |

`position` é `number` na leitura ao vivo; a função de soma devolve `null` quando nenhum host teve
impressão no dia, e a leitura **descarta** esse dia (`GscDay.position` nunca foi `null` — a resposta
do Google não traz linha sem impressão). Ver contrato C3.

## E3 — Resposta por host (interna)

O que UM host devolveu, antes da soma. Existe para a falha saber se nomear (FR-004).

| Campo | Tipo | Regra |
|---|---|---|
| `host` | `string` | o declarado, e não a propriedade — `sc-domain:` cobre o domínio inteiro |
| `propriedade` | `string` | o que `resolveProperty` escolheu; diagnóstico e `property` de saída |
| `dados` | `T` | `GscDay[]` na série; `[clicksAtual, clicksAnterior]` na tendência; `GscPageRow[]` nas páginas |

**Estados que não colapsam** (030/D5, mantidos): host sem propriedade **não** produz resposta —
produz uma entrada em `encerrados`. Host que falhou não produz nem uma coisa nem outra: **aborta a
leitura**.

## E4 — Série somada

O produto da feature.

| Campo | Tipo | Regra |
|---|---|---|
| `days` | `GscDay[]` | um por data, em ordem; a união dos dias dos hosts vivos |
| `hosts` | `string[]` | os que contribuíram, na ordem de declaração |
| `encerrados` | `string[]` | declarados sem propriedade no Search Console |
| `property` | `string` | propriedade do primeiro host **vivo**; para um host, a de hoje |

A **janela recebida** (E5) não é campo: deriva de `days`.

## E5 — Janela recebida

`{inicio: days[0].date, fim: days.at(-1).date}`, depois da soma. Derivada na tela, como hoje
(`page.tsx:676`) — a fonte se autodeclara. Com a soma passa a ser a **união** dos hosts, e é esse
número que a frase de truncamento usa (FR-003). Vazia (`null`) quando não há dia nenhum.

## E6 — Leitura (o que cada borda devolve)

Um dos três, **nunca uma mistura**:

| Forma | Significa | Quem trata |
|---|---|---|
| `{days, hosts, encerrados, property}` | leitura normal | a tela exibe |
| `{erro: "<host>: <msg ≤ 60>"}` | falha de AGORA em algum host; **nada** é publicado | a tela nomeia o host |
| `null` | não há onde olhar: env off, lista vazia, ou nenhum host com propriedade | a tela diz "sem propriedade" |

`gscTrend` devolve `{current, previous, property}` ou `null`; **não tem** a forma `{erro}` (D6).

## Transições de estado

Não há. As leituras são puras no sentido de que a mesma entrada devolve a mesma saída no mesmo
minuto; o único estado é o cache de 10 min da lista de propriedades (`listSites`), que já existe e
que os testes compartilham de propósito (`test/gsc-hosts.test.mjs`, comentário da linha 164).
