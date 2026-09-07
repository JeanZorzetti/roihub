# A série do GSC parou de ser jogada fora

**07/09/2026** · spec `021-serie-gsc-gravada` · branch `021-serie-gsc-gravada`

## O que motivou

O board de OKR no Whimsical (`whimsical.com/v-rtice3/okr-Saw2eoSKZDPLJAk6xeDBuS`) não é uma
árvore de OKR: é um **catálogo de 19 KPIs de SEO** com fórmula e meta para cada um. A `/okr`
media a cadeia de conversão e não tocava nenhum deles. `app/okr/[slug]/aquisicao/page.tsx`, a
única aba que olhava para busca, mostrava **dois totais de 8 meses** e nada mais.

## O achado que decidiu a ordem

`grep 'create table if not exists'` devolvia 16 tabelas e **nenhuma de GSC**. Todo dado de
Search Console era lido ao vivo e descartado.

Isso torna os KPIs de crescimento do board (+10-20%/trimestre, 5-10% MoM) impossíveis — e a
falta **não é de cálculo, é de calendário**: só existem meses depois de alguém começar a gravar.
Por isso a persistência entrou primeiro, mesmo sem render KPI no dia do merge.

⚠️ **`scripts/serie-gsc.mjs` parece resolver isso pelo nome e não resolve**: ele imprime no
console, não grava, e não está em workflow nenhum. Continua sendo a ferramenta de diagnóstico
que sempre foi. Foi o primeiro lugar onde olhei e quase o li como "já existe".

## O que entrou

**Persistência.** `hub_gsc_dia`, PK `(projeto, dia)`, `ON CONFLICT DO UPDATE`. Corrida em
`POST /api/gsc-serie` disparada por `.github/workflows/serie-gsc.yml` às **05:17 BRT** — fora
das duas janelas do Princípio IV. Rota própria em vez de mais um coletor em `/api/estado`:
aquela roda na janela intocável, e uma indisponibilidade do GSC não pode derrubar o card
noturno.

**Cálculo.** `lib/kpis-busca.mjs` (puro) — striking distance, CTR vs benchmark, CTR Gap,
consultas únicas, Top 20, % no Top 3, URLs com impressão, canibalização. Renderizados na aba de
aquisição, em bloco separado e na janela **curta** (28d), não na de 8 meses da página: striking
distance com 8 meses misturaria posição de fevereiro com a de hoje, e fila de trabalho velha é
pior que fila nenhuma.

## Primeira corrida (07/09, contra produção)

**5.829 linhas · 34 projetos · 8 sem propriedade · zero falhas · 50 s.**
Segunda corrida no mesmo dia: 34 linhas tocadas, **5.829 e 394.228 impressões antes e depois** —
idempotência provada, não afirmada.

O backfill parou em **11/01/2026** em vez dos 480 dias pedidos: é a data em que a propriedade
`sc-domain:roilabs.com.br` começa a ter dado. Os "238 dias" repetidos em muitos projetos são
isso, não bug — as impressões diferem por projeto (atma 368k, vertice 475, orion 338).
**Conferi porque um número idêntico repetido em vários projetos parece o filtro de host vazando.**

## O que a tela mostrou na atma

- **CTR Gap 0%** de 4 URLs avaliadas. A principal (13.262 impressões, posição 8,8) tem CTR de
  **1,1% contra 2% esperado** — problema de título, não de posição.
- **22,3% das impressões no Top 3**, contra a meta de 40-50% do board.
- **Canibalização sistemática**: `/blog/quanto-custa-alinhador-invisivel` contra
  `/pacientes/precos` em praticamente toda consulta de preço, com a segunda sempre entre a
  posição 14 e a 67. É o custo concreto do que a memória `atma_uma_pagina_uma_query_de_preco`
  já descrevia.

## 🚩 Armadilhas pagas nesta feature

1. **Crase em comentário SQL dentro de template literal FECHA a string.** `lib/db.ts` avisa
   sobre isso 60 linhas abaixo e eu escrevi `` `run_date` `` mesmo assim. O sintoma foi
   `Expected ',', got 'run_date'` em `test/autopublish.test.mjs`, que importa `lib/gsc.ts` — um
   arquivo que eu não tinha quebrado. **`npx tsc --noEmit` passou limpo**: quem pega é o
   type-stripping do Node, não o tsc.
2. **`gscQueryPages` não serve para janela arbitrária.** Ela é hardcoded em D-31→D-3 (um dia mais
   larga que `descoberta()`) e faz uma segunda chamada na janela anterior que nenhum KPI daqui
   usa. `queryPageWindow` foi exportada e é chamada uma vez.
3. **Busca de marca aparece como canibalização e não é.** `atma aligner` lista 8 URLs — o Google
   mostrar o site inteiro para o nome da empresa é o esperado. Sem lista de marca por projeto não
   dá para filtrar, então o rótulo ficou na tela em vez de a lista fingir que toda linha é
   trabalho.

## O que NÃO entrou, e por quê

- **Active Index Ratio** virou contagem de URLs com impressão: o board pede
  `URLs com impressão ÷ total de indexadas` e o hub não mantém o denominador. Razão sem
  denominador é razão inventada.
- **Crescimento de consultas únicas** continua incalculável mesmo depois de 90 dias gravando —
  precisaria de contagem de `query` por dia, ~25 mil linhas/dia/projeto. Decisão consciente (D3
  em `research.md`), não esquecimento.
- **Marca vs não-marca**: exige lista de termos por projeto e corte por país. É a primeira
  candidata à spec seguinte.

**Placar honesto: 6 dos 19 KPIs do board na tela** (não 7 — o de crescimento de consultas ficou
de fora), mais o histórico que destrava os de crescimento em ~90 dias.

## Próximo passo

Merge para `main` é **deploy** (Princípio IV) e ainda não foi feito — a branch está pushada e o
merge é decisão de quem lê isto. Depois do merge, conferir a primeira corrida automática de
05:17 BRT e que `serie-gsc.yml` tem `HUB_URL` e `HUB_CRON_SECRET` nos secrets do repositório.

## Fechamento (07/09, 14:44 BRT)

Merged em `main` pelo PR #5 às 14:34. `HUB_URL` e `HUB_CRON_SECRET` conferidos nos secrets do
repositório. A corrida de 05:17 BRT só acontece em 08/09, então disparei o `workflow_dispatch`
para provar o gatilho hoje: **42 projetos · 34 linhas · 8 sem propriedade · zero falhas · 15 s**,
`backfills: []` — o backfill de 238 dias já estava gravado, então a corrida diária custa 15 s e
não os 50 s da primeira.

Tela conferida em `/okr/atma/aquisicao`: 1.024 consultas únicas, 871 no Top 20, **22,3% no Top 3**
e Striking distance renderizando. O bloco de CTR Gap não aparece — é o zero de 4 URLs avaliadas
descrito acima, não regressão.

`/okr/atma/aquisicao` **não é órfã**: `/okr/atma` linka para ela no rodapé de método
(`app/okr/[slug]/page.tsx:281`), e `/okr/atma/metodo` também. O link do bloco de Descoberta
(linha 271) nunca renderiza para a atma — é `iniciaEmVisitante`, perfis A/B só. Uma entrada em
nota de rodapé é pouco para uma aba com 6 KPIs, mas é entrada.
