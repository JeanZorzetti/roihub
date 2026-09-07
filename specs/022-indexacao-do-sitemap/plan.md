# Implementation Plan: Indexação do sitemap — quanto do que o site declara está no índice

**Branch**: `022-indexacao-do-sitemap` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-indexacao-do-sitemap/spec.md`

## Summary

O denominador que falta ao board — **quantas URLs do site estão no índice** — não precisa de
coleta nova. `lib/indexacao.mjs` já fala com a URL Inspection API e já separa "sem propriedade"
de "não indexada"; `lib/conformidade.mjs` já acha o sitemap pelo `robots.txt`, já distingue XML
de HTML de catch-all e já desce um nível num `<sitemapindex>`. Esta feature **liga** as duas
pontas e grava o resultado.

Três entregas, na ordem em que se destravam:

1. **Inventário** — `lib/sitemap.mjs`: ler a lista **inteira** do sitemap, percorrendo todos os
   filhos do índice, não o primeiro (FR-001..FR-003).
2. **Corrida** (US1, US2) — `lib/indexacao-corrida.mjs` decide fila, orçamento, amostra e
   classificação, tudo puro; `POST /api/indexacao` executa e grava em `hub_indexacao`
   (FR-004..FR-010, FR-013..FR-015). A aba de aquisição passa a exibir a fração, a data e o
   tamanho da amostra.
3. **Os dois KPIs capados** (US3) — com o denominador na mão, `activeIndexRatio` e
   `queryToPageRatio` entram em `lib/kpis-busca.mjs`, ambos com o denominador **injetado** e
   `null` quando ele não existe (FR-011, FR-012).

**A restrição que molda tudo**: a quota é ~2.000 inspeções/dia **por propriedade**, e 21 dos 35
projetos resolvem para `sc-domain:roilabs.com.br`. Eles dividem uma quota, não têm 2.000 cada. O
orçamento é por propriedade, o rodízio é diário e a amostra é declarada na tela.

## Technical Context

**Language/Version**: TypeScript + JavaScript (ESM), Node 22

**Primary Dependencies**: Next.js 16 (App Router), React 19, `pg`, `google-auth-library`.
**Nenhuma dependência nova.**

**Storage**: Postgres. Uma tabela nova (`hub_indexacao`), criada no `ensure()` de `lib/db.ts`
como todas as outras.

**Testing**: `node --test` sobre `test/*.test.mjs`, registrado à mão em `package.json`
(Princípio II).

**Target Platform**: Linux/Alpine em Docker no EasyPanel; dev em Windows.

**Project Type**: Aplicação web única (App Router + `lib/`), sem separação front/back.

**Performance Goals**: a corrida gasta ~400 inspeções em série a ~300 ms cada ≈ 2 min, dentro de
`maxDuration = 800`. A leitura dos sitemaps é um `fetch` por projeto (mais um por filho de
índice) e não custa quota do GSC.

**Constraints**: URL Inspection API ~2.000/dia **por propriedade**, compartilhada por 21
projetos; somente leitura (não existe "solicitar indexação" programático). Janelas de deploy
proibidas do Princípio IV.

**Scale/Scope**: os mesmos projetos que `listProjects()` devolve com `url` — 35 hoje, dos quais
21 na mesma propriedade. Inventários de dezenas a ~1.200 URLs.

## Constitution Check

*GATE: revisto contra `.specify/memory/constitution.md`. Reavaliado após a Fase 1 — sem
mudança.*

| Princípio | Como esta feature cumpre |
|---|---|
| **I. Contrato único de dados** | A corrida e a aba leem projetos por `listProjects()`. Nenhum import de `data/projects.json`. A chave gravada é o `slug`, nunca o rótulo de exibição. |
| **II. `node --test` registrado à mão** | `test/sitemap.test.mjs` e `test/indexacao-corrida.test.mjs` novos, adicionados à lista de `package.json` **no mesmo commit**; `test/kpis-busca.test.mjs` ganha os casos das duas razões novas. `test/validade.test.mjs` reprova se esquecermos. |
| **III. `.mjs` puro, `.ts` só na borda** | Toda a regra cara — orçamento por propriedade, fila do rodízio, amostra estável, classificação em cinco baldes — nasce em `lib/sitemap.mjs` e `lib/indexacao-corrida.mjs`, sem `pg`, sem `fetch` (injetado), sem `process.env`. A borda `.ts` só orquestra e grava. É o que torna a SC-003 e a SC-004 testáveis **sem gastar uma inspeção**. |
| **IV. Push é deploy** | Workflow novo em **05:47 BRT (`47 8 * * *` UTC)**, fora das duas janelas proibidas e 30 min depois da série da 021. `maxDuration = 800` é da rota nova e **não** altera a de `/api/estado`, então o proxy do EasyPanel não muda. |
| **V. Ambiente explícito, segredo nunca em log** | A rota valida `DATABASE_URL` e `GOOGLE_SERVICE_ACCOUNT_JSON` na entrada e devolve `503` com **apenas os nomes** ausentes. Reusa o `CRON_SECRET` que o middleware já conhece. Mensagens de erro por projeto são truncadas e não carregam valor de ambiente. |

**Sem violações.** A tabela de Complexity Tracking fica vazia de propósito.

## Decisões técnicas

Detalhe e alternativas rejeitadas em [research.md](./research.md). Em resumo:

- **Orçamento por propriedade, não por projeto** (D1). `melhorPropriedade()` já resolve o host;
  a mudança é chamá-la uma vez **no planejamento**, antes de gastar qualquer inspeção, e
  decrementar um saldo por propriedade. Teto por projeto multiplicaria a quota real por 21 e as
  últimas inspeções voltariam `429` — que, sem a FR-008, viraria "não indexada".
- **Rodízio derivado da própria tabela** (D2): fila ordenada pela data da última apuração, mais
  antiga primeiro. Sem cursor separado, que pode divergir do que foi gravado quando a corrida
  morre no meio. `dia % n` foi rejeitado — encolher a lista reembaralharia tudo.
- **A amostra é o prefixo do sitemap** (D3): estável entre corridas por construção (SC-004) e
  enviesada para o que o site declara como prioritário. O viés é **declarado na tela**, que é o
  que a FR-007 cobra.
- **`falha` é uma quinta classe** (D4), fora do numerador e do denominador. Erro de quota contado
  como não-indexação inverte o sinal: quanto mais o sistema falha, pior o site parece.
- **Três "não apurados" distintos** (D5): `sem_sitemap`, `sitemap_vazio`, `sem_propriedade` — mais
  `sem_orcamento` (FR-015). Cada um pede uma frase e um passo diferentes na tela; somá-los num
  "0%" é a inversão que este repo já pagou.
- **A tela lê o gravado, nunca inspeciona** (D9). Uma página com `revalidate = 3600` que
  inspecionasse ao carregar transformaria cada visita em consumo da quota que a corrida precisa.
- **O `~2000/dia` é hipótese a confirmar** (D10): env com padrão, e a resposta da corrida devolve
  `orcamento`/`gastas`/`falhasDeQuota` por propriedade. A corrida é o instrumento que mede o
  próprio teto.

## Project Structure

### Documentation (this feature)

```text
specs/022-indexacao-do-sitemap/
├── spec.md                        # aprovado 07/09/2026
├── plan.md                        # este arquivo
├── research.md                    # D1..D10, decisões e alternativas rejeitadas
├── data-model.md                  # hub_indexacao e as formas em memória
├── quickstart.md                  # como provar que funciona
├── contracts/
│   └── api-indexacao.md           # POST /api/indexacao + lerIndexacao()
├── checklists/
│   └── requirements.md            # já aprovado
└── tasks.md                       # próximo passo (/speckit-tasks)
```

### Source Code (repository root)

```text
lib/
├── sitemap.mjs               # NOVO — lerSitemap(): TODOS os filhos do índice, dedupe em ordem
├── indexacao-corrida.mjs     # NOVO — filaDoDia, repartir, amostra, classificar, agregar (puros)
├── indexacao.mjs             # sem alteração — inspecionarIndexacao e estaIndexada reusados
├── conformidade.mjs          # sem alteração — urlDoSitemap, julgarSitemap, buscar reusados
├── gsc-consulta.mjs          # sem alteração — melhorPropriedade reusada
├── kpis-busca.mjs            # + activeIndexRatio(), + queryToPageRatio() (denominador injetado)
└── db.ts                     # + hub_indexacao no ensure(), + gravarIndexacao(), + lerIndexacao(),
                              #   + ultimasApuracoes() (a fila do rodízio)

app/
├── api/indexacao/route.ts            # NOVO — a corrida diária
└── okr/[slug]/aquisicao/page.tsx     # fração + data + amostra; Active Index Ratio vira razão

test/
├── sitemap.test.mjs                  # NOVO — registrado em package.json no mesmo commit
├── indexacao-corrida.test.mjs        # NOVO — registrado em package.json no mesmo commit
└── kpis-busca.test.mjs               # + casos das duas razões e do denominador ausente

.github/workflows/
└── indexacao.yml             # NOVO — cron 47 8 * * * (05:47 BRT), retry só em falha de conexão

middleware.ts                 # isenta /api/indexacao como já isenta /api/gsc-serie
```

**Structure Decision**: a estrutura existente do repo, sem camada nova. A regra de posicionamento
que importa é o Princípio III — orçamento, fila, amostra e classificação em `lib/*.mjs`, rede e
banco na borda `.ts`. É essa separação que permite provar a SC-003 (a corrida cabe no orçamento
de toda propriedade) e a SC-004 (a amostra não se move) num teste de milissegundos, em vez de
descobri-las com um dia inteiro de dados contaminados.

## Riscos aceitos, e por quê

| Risco | Mitigação |
|---|---|
| O teto real da API é menor que 2.000 | `falhasDeQuota` por propriedade na resposta (D10); ajuste por env, sem deploy |
| A amostra por prefixo é enviesada | Declarada na tela (FR-007/SC-002). Amostra aleatória violaria a SC-004, que é o requisito mais forte |
| A cadência real por projeto pode não ser semanal | A saída da corrida diz quantos projetos couberam; ajuste em `INSPECOES_POR_CORRIDA`, sem código (D8) |
| Sitemap grande deixa o inventário desatualizado entre corridas | Aceito: indexação se move em dias e semanas, e a FR-014 datou o número na tela |

## Complexity Tracking

Sem violações da constituição a justificar.
