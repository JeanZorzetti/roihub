# Implementation Plan: O inventário de termos e a penetração no Top 3

**Branch**: `034-inventario-de-termos` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/034-inventario-de-termos/spec.md`

## Summary

Um arquivo versionado passa a declarar os 725 termos que a Atma monitora, com a procedência que
permite refazê-lo. Uma leitura nova do Search Console — na dimensão `query`, que é a que conta
termo — resolve esse inventário contra a janela de Descoberta e devolve
`{fracao, noTop3, total, cobertura}`. A folha `penetracaoTop3` ganha coletor em `MEDIDO_POR`,
mantém o balizador `recusa`, e o mapa passa a mostrar o número com janela e cobertura, sem veredito.

## Technical Context

**Language/Version**: Node 22, Next.js 16 (App Router), React 19
**Primary Dependencies**: `google-auth-library` (já instalada; nenhuma nova)
**Storage**: arquivo versionado `data/inventario-de-termos.json` — sem tabela nova no Postgres
**Testing**: `node --test`, arquivo novo registrado à mão em `package.json` (Princípio II)
**Target Platform**: Docker/EasyPanel, `output: "standalone"`
**Project Type**: single (Next.js app com `lib/` puro em `.mjs`)
**Performance Goals**: uma requisição adicional ao Search Console por render de `/gsc/mapa`
**Constraints**: a rota já é `force-dynamic` desde a 033 — a credencial não existe no build
**Scale/Scope**: 1 projeto com inventário, 34 sem; 725 termos; 4 arquivos novos, 5 tocados

### A decisão técnica que carrega a feature: a dimensão da leitura

`gscConsultas()` lê `["query", "page"]`. Essa leitura **não serve** aqui: ela devolve uma linha por
par (termo, página), e um termo que ranqueia em três páginas aparece três vezes com três posições.
Contar termos a partir dela seria re-derivar a dimensão `query` somando linhas — que é exatamente o
que a 032 deletou em `porUrl()`, e o que a memória do repositório registra como "critério medido com
outro instrumento".

A leitura é nova e na dimensão certa: `["query"]` sozinha. Medido em 20/09/2026, a diferença não é
teórica — a agregação do próprio Google na dimensão `query` devolve 893 termos na janela atual, e é
sobre ela que os 10,2% desta spec foram apurados.

**Reuso, não duplicação**: `lerHosts()` (genérica, já exportada) faz propriedade, multi-host, falha e
ausência. O que falta é a mescla: `mesclarPorCaminho()` chama `new URL(keys.at(-1))` e, numa leitura
só de `query`, a chave não é URL — todas as linhas cairiam no `catch` e a leitura voltaria vazia,
sem erro. Entra `mesclarPorTermo()` ao lado dela, com as MESMAS regras de voto (linha sem impressão
não vota, voto único devolve a posição como veio, `null` nunca vira 0).

## Constitution Check

| Princípio | Como esta feature se comporta |
|---|---|
| **I. Contrato único de dados** | `data/inventario-de-termos.json` **não** é fonte de dado de projeto: é entrada de medição, mesma classe de `hub_gsc_dia` e `hub_pagina`, lida por módulo próprio e nunca por página. `listProjects()` segue sendo o único ponto de leitura de projeto, e o inventário é chaveado pelo `slug` que ele devolve. Nenhum import de `data/projects.json` é acrescentado. |
| **II. `node --test` registrado à mão** | `test/inventario.test.mjs` novo, acrescentado à lista de `package.json` no mesmo commit. `test/validade.test.mjs` compara lista e diretório nos dois sentidos e reprova se eu esquecer. |
| **III. `.mjs` puro, `.ts` só na borda** | `lib/inventario.mjs` (validação e leitura do arquivo), `penetracaoNoTop3()` em `lib/kpis-busca.mjs` e `mesclarPorTermo()` em `lib/gsc-hosts.mjs` são puros e testáveis sem subir o Next. Só `gscTermos()` é `.ts`, porque toca `google-auth-library`. |
| **IV. Push é deploy** | Nenhum push em 23:30–01:00 nem 08:00–08:45 BRT. A feature não altera `maxDuration` de rota nenhuma. |
| **V. Ambiente explícito, segredo nunca em log** | Nenhuma variável nova. O script de derivação lê `GOOGLE_SERVICE_ACCOUNT_JSON` por `--env-file=.env`, como `scripts/inspect-url.mjs` já faz, e não imprime nada dela. |

Nenhuma violação. Nenhuma entrada em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```
specs/034-inventario-de-termos/
├── spec.md
├── plan.md              # este arquivo
├── data-model.md        # o formato do inventário e o contrato de ausência
├── research.md          # a derivação medida: piso, cobertura, janelas
├── quickstart.md        # como refazer o inventário e conferir o número
└── tasks.md
```

### Source Code (repository root)

```
data/
└── inventario-de-termos.json        # NOVO — a lista congelada, chaveada por slug

lib/
├── inventario.mjs                   # NOVO — leitura e validação do arquivo (puro)
├── kpis-busca.mjs                   # penetracaoNoTop3() — FORA de kpisPorTermo(), ver abaixo
├── gsc-hosts.mjs                    # mesclarPorTermo()
├── gsc.ts                           # gscTermos() — a leitura na dimensão `query`
└── gsc-delta.mjs                    # MEDIDO_POR.penetracaoTop3

app/gsc/mapa/
└── page.tsx                         # a folha ganha filhos com o medido

scripts/
└── derivar-inventario.mjs           # NOVO — refaz a lista, só grava com --gravar

test/
└── inventario.test.mjs              # NOVO — registrado em package.json
```

## Sequência de implementação

A ordem é a das User Stories, e cada uma fecha sozinha.

**US1 — o inventário existe (P1)**
1. `scripts/derivar-inventario.mjs`: lê o card pelo slug, exige `marca.termos`, consulta as duas
   propriedades na janela de 8 meses na dimensão `query`, exclui marca por `regexDeMarca()`, aplica
   o piso e imprime o resumo. Grava só com `--gravar`.
2. `data/inventario-de-termos.json` gerado por ele e conferido à mão.
3. `lib/inventario.mjs`: `lerInventario(slug)` devolve `{termos, procedencia}` ou `null`; recusa
   lista vazia e procedência incompleta.
4. `test/inventario.test.mjs` cobrindo: ausência devolve `null`, lista vazia reprova, marca dentro
   da lista reprova, procedência sem janela reprova.

**US2 — o número na folha (P2)**
5. `mesclarPorTermo()` em `lib/gsc-hosts.mjs` + teste (dois hosts, termo repetido, linha sem
   impressão, voto único).
6. `gscTermos(hosts, janela)` em `lib/gsc.ts`, sobre `lerHosts()`.
7. `penetracaoNoTop3(linhas, inventario)` em `lib/kpis-busca.mjs`, ao lado de `impressoesNoTop3` e
   **fora** de `kpisPorTermo()`. Tentado dentro e revertido no mesmo dia: aquele agregador consome a
   leitura `["query", "page"]` e nenhuma linha dela tem o campo `termo` — a medida compilaria e
   devolveria 0 para sempre. É a mesma confusão de dimensão que a feature existe para desfazer, e
   ela entrou pela porta de trás na primeira tentativa de implementação.
8. `MEDIDO_POR.penetracaoTop3 = "lib/kpis-busca.mjs#penetracaoNoTop3"`.
9. `app/gsc/mapa/page.tsx`: filhos injetados na folha, no mesmo padrão das seis faixas da 033 —
   `topic` curto com o número, `note` com a prosa (janela, cobertura, o que "piso" significa).

**US3 — os 34 sem inventário (P3)**
10. Caminho de ausência: `lerInventario()` devolve `null` → `penetracaoNoTop3()` devolve `null` →
    a folha imprime "não apurado" nomeando a falta, distinta da falha de leitura.

**Fechamento**
11. `npm test` inteiro verde, `tsc --noEmit` limpo.
12. Conferir a tela no ar **duas vezes** (o deploy leva ~15 min e a working tree tem outros
    escritores) e comparar o número publicado com uma consulta ao vivo do mesmo dia.

## Complexity Tracking

Vazio. Nenhuma violação de princípio a justificar.
