# Implementation Plan: O que há dentro das páginas da Atma — seis medidas de um crawl só

**Branch**: `024-crawl-de-pagina` | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-crawl-de-pagina/spec.md`

## Summary

A 022 mediu **9 de 36 URLs indexadas na Atma, com 19 lidas e recusadas pelo Googlebot**. Nenhum
conserto técnico move essa classe — o que move está **dentro** da página e em como o site liga
uma à outra, e é a única coisa que o hub nunca olhou.

Esta feature busca o HTML das 36 URLs **uma vez por corrida** e extrai seis medidas do board.
Nada de crawler novo: `lib/sitemap.mjs` (022) já entrega o inventário completo e `buscar()` de
`lib/conformidade.mjs` já trata timeout, erro e header no idioma da casa.

Três entregas, na ordem em que se destravam:

1. **Extração de uma página** — `lib/pagina.mjs` (puro): título e largura **estimada**,
   modificadores de intenção, blocos JSON-LD (ausente ≠ inválido), data declarada, contagem de
   palavras **sem regex gulosa**, links emitidos, e a separação entre "página vazia" e "conteúdo
   que só existe depois do JS" (FR-005..FR-011).
2. **O grafo** — `lib/grafo.mjs` (puro): travessia em largura a partir da home com teto e
   proteção a ciclo, profundidade de clique, **exclusão da navegação** por frequência, contagem
   de links contextuais recebidos e marcação de órfã (FR-002..FR-004, FR-012).
3. **A corrida e a tela** — `POST /api/paginas` executa, grava em `hub_pagina_corrida` +
   `hub_pagina`, e a aba de aquisição da Atma passa a exibir as seis medidas com a data da
   apuração (FR-001, FR-013..FR-016).

**A restrição que molda tudo é o custo de errar em silêncio, não o custo de rede.** 36 páginas
são ~30 s de HTTP. As três armadilhas marcadas 🚩 na spec — menu contado como link contextual,
pixel confundido com caractere, `.*` guloso entre `<script>` — produzem números que *parecem
certos*. Por isso a regra inteira nasce em `.mjs` puro e é provada sem rede.

## Technical Context

**Language/Version**: TypeScript + JavaScript (ESM), Node 22

**Primary Dependencies**: Next.js 16 (App Router), React 19, `pg`. **Nenhuma dependência nova** —
em particular, nenhum parser de HTML e nenhum navegador headless (D4, D6).

**Storage**: Postgres. Duas tabelas novas (`hub_pagina_corrida`, `hub_pagina`), criadas no
`ensure()` de `lib/db.ts` como todas as outras.

**Testing**: `node --test` sobre `test/*.test.mjs`, lista explícita em `package.json`
(Princípio II). Dois arquivos novos: `test/pagina.test.mjs` e `test/grafo.test.mjs`.

**Target Platform**: Linux/Alpine em Docker no EasyPanel; dev em Windows.

**Project Type**: Aplicação web única (App Router + `lib/`), sem separação front/back.

**Performance Goals**: 36 páginas em lotes de 4 contra **um único host** ≈ 15-30 s. O teto de
`PAGINAS_POR_CORRIDA = 300` dá ~4 min no pior caso, dentro de `maxDuration = 800`.

**Constraints**: o crawl lê o **HTML servido**, sem executar JavaScript (Out of Scope da spec).
Escopo `SLUGS_DE_BUSCA = ["atma"]`. Janelas de deploy proibidas do Princípio IV.

**Scale/Scope**: 36 URLs declaradas hoje; teto de 300 páginas por corrida. Cadência **semanal** —
estrutura interna e título mudam por deploy, não por hora.

## Constitution Check

*GATE: revisto contra `.specify/memory/constitution.md`. Reavaliado após a Fase 1 — sem mudança.*

| Princípio | Como esta feature cumpre |
|---|---|
| **I. Contrato único de dados** | A corrida percorre `projetosDeBusca()`, que sai de `listProjects()`. Nenhum import de `data/projects.json`. A chave gravada é o `slug`; a chave de página é a **URL canônica** (D3), nunca o título. |
| **II. `node --test` registrado à mão** | `test/pagina.test.mjs` e `test/grafo.test.mjs` novos, adicionados à lista de `package.json` **no mesmo commit**; `test/kpis-busca.test.mjs` ganha os casos de `termoPrincipal()`. `test/validade.test.mjs` reprova se esquecermos. |
| **III. `.mjs` puro, `.ts` só na borda** | As três armadilhas 🚩 e a travessia inteira nascem em `lib/pagina.mjs` e `lib/grafo.mjs`: sem `fetch` (injetado), sem `pg`, sem `process.env`, sem relógio (o ano vigente é **parâmetro**, D9). A borda `.ts` só busca, grava e renderiza. É o que permite provar a SC-003 e a SC-005 em milissegundos. |
| **IV. Push é deploy** | Workflow novo **semanal**, segunda 06:17 BRT (`17 9 * * 1` UTC), fora das duas janelas proibidas e 30 min depois da corrida de indexação (05:47). `maxDuration = 800` é o mesmo valor que `/api/indexacao` já usa — o proxy do EasyPanel não muda. |
| **V. Ambiente explícito, segredo nunca em log** | A rota valida `DATABASE_URL` na entrada e devolve `503` com **apenas os nomes** ausentes. Reusa o `CRON_SECRET` que o middleware já conhece — não pede segredo novo: ler HTML público é capacidade menor que publicar artigo em 10 repos. Erros por URL são truncados em 60 caracteres, sem valor de ambiente. |

**Sem violações.** A tabela de Complexity Tracking fica vazia de propósito.

## Decisões técnicas

Detalhe e alternativas rejeitadas em [research.md](./research.md). Em resumo:

- **D1 — Navegação é o link que aparece em quase toda página.** O par `(href canônico, âncora)`
  emitido por ≥ 50% das páginas visitadas **e** por ≥ 3 delas é navegação e sai da densidade.
  Rejeitado: confiar em `<nav>`/`<footer>`, que depende de o site marcar semântica. A regra por
  frequência satisfaz a **SC-003 por construção** — menu que cresce continua sendo menu.
- **D2 — Profundidade usa TODAS as arestas; densidade usa só as contextuais.** Um link de menu é
  um clique de verdade, então conta na profundidade; ele não é voto editorial, então não conta na
  densidade. Duas leituras do mesmo grafo, como a spec pede — não dois crawls.
- **D3 — A chave de página é a URL canônica** (host minúsculo, sem fragmento, sem barra final
  exceto na raiz, query preservada). Sem isso `/precos` e `/precos/` viram duas páginas e o
  sitemap inteiro parece órfão.
- **D4 — Largura de título estimada por tabela de larguras de caractere** (Arial 20px, a fonte do
  título na SERP desktop), **nunca renderizada**. A tela é obrigada a dizer que é estimativa e por
  qual método (FR-005). Navegador headless foi rejeitado: `playwright-core` existe no repo, mas o
  binário do browser não está na imagem Alpine, e a decisão que o board quer tomar ("cabe ou não
  cabe") não precisa de precisão de subpixel.
- **D5 — `<script>` some por regex NÃO-GULOSA, com teste contra HTML minificado de uma linha.**
  É a FR-010 e o defeito medido em `D-84`: `sed 's/<script[^>]*>.*<\/script>//g'` devolveu **0
  palavras para páginas que têm `<h1>`**, porque apagou do primeiro `<script>` ao último.
- **D6 — Sem parser de HTML.** Extração por expressões ancoradas e não-gulosas sobre o HTML
  servido. Dependência nova para ler 36 páginas contraria a Restrição Técnica da casa, e o
  contrato aqui é frágil por natureza: são regexes **com teste**, não um DOM.
- **D7 — Travessia em duas fases**: largura a partir da home (que produz a profundidade), depois
  **colheita** das URLs do sitemap que ninguém alcançou — elas são buscadas do mesmo jeito e
  marcadas **órfãs** (FR-001 + FR-003). Órfã tem profundidade `null`, nunca `0` e nunca erro.
- **D8 — Detalhe por URL É persistido**, ao contrário da 022 (§6 do data-model dela). A SC-006
  pergunta *quais* páginas são órfãs ou periféricas, e agregado não responde isso. São 36 linhas
  por semana, não 35 projetos × milhares de URLs por dia.
- **D9 — O ano vigente é parâmetro, não `new Date()` dentro do módulo puro.** "2026" escrito no
  código apodrece em janeiro, e o modificador de intenção comercial passaria a reprovar todo mundo.
- **D10 — O termo principal vem do GSC, na LEITURA, não da corrida.** É a consulta de maior
  impressão daquela URL na janela que a aba de aquisição já carrega. Gravar o termo congelaria na
  semana da corrida uma coisa que muda toda semana. URL sem consulta com impressão sai como
  **"sem termo apurado"** — nunca como "termo ausente do título".

## Project Structure

### Documentation (this feature)

```text
specs/024-crawl-de-pagina/
├── spec.md                        # aprovado 07/09/2026
├── plan.md                        # este arquivo
├── research.md                    # D1..D14, decisões e alternativas rejeitadas
├── data-model.md                  # hub_pagina_corrida, hub_pagina e as formas em memória
├── quickstart.md                  # como provar que funciona
├── contracts/
│   └── api-paginas.md             # POST /api/paginas + lerCrawlDePagina()
├── checklists/
│   └── requirements.md            # já aprovado
└── tasks.md                       # próximo passo (/speckit-tasks)
```

### Source Code (repository root)

```text
lib/
├── pagina.mjs                # NOVO — extrai de UM html: titulo, larguraDoTitulo, modificadores,
│                             #   blocosJsonLd, dataDeclarada, palavras, links, estadoDoConteudo
├── grafo.mjs                 # NOVO — canonizar, ehInterna, navegacao, profundidades,
│                             #   densidades, orfas, agregar (todos puros)
├── sitemap.mjs               # sem alteração — lerSitemap() da 022 reusada
├── conformidade.mjs          # + `url` e `redirecionada` no retorno de `buscar()` (FR-013),
│                             #   aditivo; `detectarStack()` reusada no estado do conteúdo
├── kpis-busca.mjs            # + termoPrincipal(linhas, url) — a consulta de maior impressão
└── db.ts                     # + hub_pagina_corrida e hub_pagina no ensure(),
                              #   + gravarCrawlDePagina(), + lerCrawlDePagina()

app/
├── api/paginas/route.ts              # NOVO — a corrida semanal
└── okr/[slug]/aquisicao/page.tsx     # bloco novo: as seis medidas, datadas

test/
├── pagina.test.mjs                   # NOVO — registrado em package.json no mesmo commit
├── grafo.test.mjs                    # NOVO — registrado em package.json no mesmo commit
└── kpis-busca.test.mjs               # + casos de termoPrincipal e da URL sem impressão

.github/workflows/
└── paginas.yml               # NOVO — cron `17 9 * * 1` (segunda, 06:17 BRT)

middleware.ts                 # isenta /api/paginas como já isenta /api/indexacao
```

**Structure Decision**: a estrutura existente do repo, sem camada nova. O corte que importa é o do
Princípio III, e aqui ele tem consequência direta: **as três armadilhas da spec são erros de
parsing, e parsing é exatamente o que dá para provar sem rede**. Um teste de milissegundos com
HTML minificado de uma linha reprova o regex guloso; descobri-lo em produção custa uma semana de
números que parecem certos.

## Riscos aceitos, e por quê

| Risco | Mitigação |
|---|---|
| **A tela não cruza página a página com as 27 fora do índice** — a 022 grava só o agregado do dia, sem status por URL | A lista sai ordenada por periferia (órfã primeiro, depois profundidade ≥ 4, depois < 5 links contextuais) e marca quem tem **zero impressão** no GSC. Cruzar com o veredito por URL exige a 022 persistir por URL: spec nova, não esta. Declarado na tela |
| Extração por regex quebra em HTML incomum | Cada campo tem estado próprio de ausência; campo ausente nunca vira zero. `palavras: 0` com `<h1>` presente é a **contradição interna** que denunciou o `D-84`, e vira asserção de teste |
| O limiar de 50% da D1 pode classificar errado num site pequeno | A regra exige ≥ 3 páginas além da fração, e a contagem de links classificados como navegação sai na resposta da corrida. Ajuste é constante em `.mjs` coberta por teste — não env |
| A largura em pixels não bate com o que o Google renderiza | É **estimativa declarada** (FR-005/SC-004). A decisão que ela serve é binária e a faixa do board tem 80 px de folga |
| Data declarada não prova que o conteúdo mudou | A própria spec já rebaixou a US4 a P3. Página sem data fica fora do numerador **e** do denominador (FR-009) |
| Um deploy da Atma no meio da corrida mistura duas versões do site | Aceito: a corrida é semanal e leva ~30 s. A data da apuração está na tela (FR-015) |

## Complexity Tracking

Sem violações da constituição a justificar.
