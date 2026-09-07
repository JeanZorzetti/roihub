# Handoff — 022: indexação do sitemap

**Branch**: `022-indexacao-do-sitemap` · **Spec**: `specs/022-indexacao-do-sitemap/`
**Estado**: 35 das 40 tarefas fechadas. As 5 abertas são pós-deploy — todas gastam quota real.

## O que entrou

O denominador que faltava ao board: **quantas URLs do site estão no índice do Google**. Nenhuma
coleta nova — `lib/indexacao.mjs` já falava com a URL Inspection API e `lib/conformidade.mjs` já
achava o sitemap. Esta feature liga as duas pontas e grava.

| Arquivo | O quê |
|---|---|
| `lib/sitemap.mjs` (novo) | inventário INTEIRO: desce em **todos** os filhos do `<sitemapindex>` |
| `lib/indexacao-corrida.mjs` (novo) | fila do rodízio, orçamento por propriedade, amostra, 5 classes |
| `app/api/indexacao/route.ts` (novo) | a corrida: planeja, inspeciona, grava |
| `lib/db.ts` | `hub_indexacao` + `gravarIndexacao` / `lerIndexacao` / `ultimasApuracoes` |
| `lib/kpis-busca.mjs` | `activeIndexRatio` e `queryToPageRatio`, denominador injetado |
| `app/okr/[slug]/aquisicao/page.tsx` | fração + data + amostra, os dois baldes separados, os 2 KPIs |
| `.github/workflows/indexacao.yml` (novo) | cron `47 8 * * *` = 05:47 BRT |
| `middleware.ts` | `/api/indexacao` isenta do Basic, exige `Bearer CRON_SECRET` |

`npm test`: **733 verdes**, incluindo 26 casos novos em 3 arquivos.

## A prova que importa (FR-002), medida em 07/09/2026

`lerSitemap` contra o `sitemapindex` real do google.com:

```
filhos declarados: 22
só o PRIMEIRO filho (o que VER-04 fazia):    166 URLs
TODOS os filhos (FR-002):                 43.430 URLs — lidos 16 de 22
```

**262× de diferença.** Era exatamente esse o buraco: ler o primeiro filho e chamar de inventário.

`filhosLidos = 16 < filhos = 22` também está fazendo o trabalho dele — 6 filhos do Google não
responderam, e o par de números denuncia o buraco em vez de entregar 43.430 como se fosse o total.

## As três decisões que impedem o número de mentir

1. **Orçamento por PROPRIEDADE.** 21 dos 35 projetos resolvem para `sc-domain:roilabs.com.br` e
   dividem UMA quota. O teste trava isso: 21 projetos × 1.000 URLs com teto 2.000 somam **2.000**,
   não 21.000.
2. **`falha` é a quinta classe**, fora do numerador E do denominador. Um 429 contado como
   não-indexação inverte o sinal — quanto mais o sistema falhasse, pior o site pareceria.
3. **A amostra é o prefixo do sitemap.** Estável entre corridas por construção; um sitemap que
   ganha URLs no fim não move a amostra.

## Desvio da spec que você precisa saber

**O Active Index Ratio NÃO aparece quando houve amostragem** — a tarefa T032 dizia só "razão quando
o denominador existir", mas o denominador de uma amostra não serve aqui: o numerador (URLs com
impressão) é do **site inteiro**, medido pelo GSC em 28 dias. Dividir numerador de site por
denominador de amostra dá uma razão que pode passar de 1 e não mede nada — é a armadilha de
`amostra_procurada_fora_do_percentual`. Com amostra, a tela volta à contagem e **diz o motivo**.

Consequência prática: nos projetos grandes o KPI só aparece quando o orçamento cobrir o sitemap
inteiro. Isso é `INSPECOES_POR_PROPRIEDADE` / `INSPECOES_POR_CORRIDA`, não código.

## O que falta (T036–T039) — tudo pós-merge

1. Merge em `main` (deploy) **fora** de 23:30-01:00 e 08:00-08:45 BRT.
2. `workflow_dispatch` do `indexacao.yml` **uma vez, à mão**, e **ler a resposta antes de confiar no
   cron**: `gastas ≤ orcamento` em toda propriedade · `pulados` separado de `apurados` ·
   `falhasDeQuota`.
3. Se `falhasDeQuota > 0` com `gastas < orcamento`, o teto real do Google é menor que 2.000 →
   baixar `INSPECOES_POR_PROPRIEDADE` **por env, sem deploy**. Anotar o número aqui.
4. Rodar de novo e conferir zero duplicata:
   `select projeto, count(*) from hub_indexacao where dia = current_date group by 1 having count(*) > 1`
5. Abrir `/okr/<slug>/aquisicao` em quatro projetos — sitemap pequeno, sitemap grande amostrado, sem
   sitemap, host fora do GSC.

**A primeira corrida mede o check, não o mundo.** Não confie no primeiro número.

## Achado lateral, fora do escopo

Rodando o inventário contra os projetos reais desta máquina em 07/09/2026:
`tapepro.com.br` e `atmaaligner.com.br` deram **ENOTFOUND no DNS**, tanto no Node quanto no `curl`.
`goianiacadeiras.com.br` responde 302 no `curl` mas dá `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` no Node
(store de CA do Windows). Pode ser só esta máquina — mas se for DNS de verdade, é bem maior que
esta spec e vale conferir de outra rede antes de olhar código.
