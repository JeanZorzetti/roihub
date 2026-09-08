# Handoff — 024: o que há dentro das páginas da Atma

**Data**: 08/09/2026 · **Branch**: `024-crawl-de-pagina` · **Corrida medida**: `dia = 2026-09-08`

A 022 mediu **9 de 36 URLs indexadas, com 19 lidas e recusadas pelo Googlebot** (apuração de
07/09, ainda no banco). Esta feature abre a caixa: busca o HTML de cada URL uma vez por semana e
extrai seis medidas do board. Está no ar em `/okr/atma/aquisicao`, bloco abaixo de Indexação.

## O que entrou

| Arquivo | O que faz |
|---|---|
| `lib/pagina.mjs` | novo, puro — extrai de UM html: título, largura estimada, intenção, JSON-LD, data declarada, palavras, links, estado do conteúdo |
| `lib/grafo.mjs` | novo, puro — canonizar, navegação por frequência, profundidade, densidade, fronteira, dedup, agregação e as quatro taxas |
| `test/pagina.test.mjs` · `test/grafo.test.mjs` | 20 + 23 testes, registrados em `package.json` no mesmo commit |
| `app/api/paginas/route.ts` | a corrida semanal (`maxDuration = 800`, lotes de 4) |
| `.github/workflows/paginas.yml` | cron `17 9 * * 1` — segunda, 06:17 BRT |
| `lib/db.ts` | `hub_pagina_corrida` + `hub_pagina` no `ensure()`, `gravarCrawlDePagina`, `lerCrawlDePagina` |
| `lib/conformidade.mjs` | `buscar()` ganha `url` e `redirecionada` (aditivo, D13) |
| `lib/kpis-busca.mjs` | `termoPrincipal(linhas, url)` — a consulta de maior impressão da URL |
| `app/okr/[slug]/aquisicao/page.tsx` | bloco novo, datado, que só renderiza |
| `middleware.ts` · `.env.example` | isenção de `/api/paginas` no `CRON_SECRET`; `PAGINAS_POR_CORRIDA` |

`npm test`: **811 passando, 0 falhando**. `tsc --noEmit` limpo. `next build` limpo.

## Os números medidos (08/09/2026, corrida em 9,8 s)

```
declaradas 36 · visitadas 42 · falhas 0 · órfãs 0 · linkadas não declaradas 6
links de navegação 14 · profundidade máxima 4 · teto atingido não
```

Conferidos contra a tabela, um a um:

| Confere | Resultado |
|---|---|
| `visitadas` bate com `count(*)` de `hub_pagina` | 42 = 42 ✓ |
| `orfas` conta só quem tem `erro IS NULL` | 0 órfãs, 0 erros ✓ |
| `linksNavegacao` na ordem do menu (dezenas, não centenas) | 14 ✓ |
| `profundidadeMaxima` pequeno, não `null` | 4 ✓ |
| rodar duas vezes no mesmo dia não duplica | 2 corridas, 1 linha em `hub_pagina_corrida`, 42 em `hub_pagina` ✓ |

**As seis medidas, como a tela as exibe:**

- **Profundidade de clique** — 0:1 · 1:14 · 2:22 · 3:4 · 4:1. Nada abaixo de 4 cliques.
- **Densidade de links contextuais** — **31 das 42** páginas abaixo dos 5 do board. A home tem
  **0**: todo link que chega nela é menu.
- **Integridade do título — 0%** (7 URLs avaliadas). **24 dos 42 títulos passam de 580 px**
  estimados; 17 cabem na faixa e 1 é curto demais. É a hipótese da 021 (CTR Gap de 0%) virando
  lista nominal. **35 URLs saem do denominador por "sem termo apurado"** — o GSC não tem
  impressão delas, o que não é o mesmo que título errado.
- **Alinhamento de intenção — 50%** (42 títulos): 21 `ausente`, 15 comercial, 4 informacional,
  2 ambos.
- **Cobertura de dados estruturados — 100%**, 0 inválido e 0 ausente. ⚠️ Ver a ressalva abaixo.
- **Cadência — 42,9%** das 14 páginas que **declaram** data; 8 passaram de 12 meses. As **28 sem
  data declarada ficam fora do numerador E do denominador** — não aparecem como desatualizadas.

**Achado da FR-013**: `/pacientes/enviar-exames` está no sitemap e **redireciona**.

## A primeira corrida mede o check (T054) — feito à mão

Décima primeira vez que esta base precisa deste passo, e desta vez ele **pegou um defeito**.

1. **Título lido × título do navegador** — 3 páginas abertas no Playwright, os três títulos batem
   exatamente com o que `hub_pagina.titulo` gravou (`/`, `/sobre`,
   `/blog/alinhadores-passo-fundo`).
2. **A afirmação "0 links contextuais"** — não há órfã para conferir, então o equivalente: o crawl
   diz que `/sobre` recebe **0 link contextual**. Conferido à mão em 6 páginas: todo link para
   `/sobre` vem com a âncora `"Sobre Nós"`, em todas elas. É menu, e a regra da D1 acertou.
3. 🚨 **O defeito que o check pegou**: a primeira corrida rodou **13 minutos sem gravar linha
   nenhuma**. A fase largura chaveava as visitadas pela URL de **destino** (D3), então uma URL que
   **redireciona** nunca aparecia como visitada e a fronteira a devolvia a cada volta do laço —
   travessia infinita, com o teto de 300 páginas como único freio. A regra virou
   `fronteira(arestas, vistas)` em `lib/grafo.mjs`, com `vistas` guardando os **dois lados** (URL
   pedida e URL de destino), e um teste que reprova a volta. Depois do conserto: **9,8 s**.

## Ressalvas — leia antes de usar os números

- 🚩 **A URL da Atma nos documentos desta spec estava errada.** `quickstart.md` §3 usava
  `atmaaligner.com.br`, que **não resolve** desta máquina. O projeto no hub é
  `https://atma.roilabs.com.br/`, e é contra ele que a corrida roda — a URL vem de
  `listProjects()` (Princípio I), nunca do documento. Corrigido no quickstart.
- ⚠️ **"100% de cobertura de Schema" merece um segundo olhar.** O site serve o **mesmo bloco
  JSON-LD** (`MedicalBusiness`, `ImageObject`, `PostalAddress`…) em todas as rotas, porque é uma
  SPA com o schema no `index.html`. A medida está correta sobre o que é **servido**; ela não diz
  que cada página tem schema **próprio e adequado ao seu tipo**.
- ⚠️ **`visitadas` (42) > `declaradas` (36)** porque o site é catch-all: `/blog/1`, `/blog/2`,
  `/blog/3` (paginação) respondem 200 com HTML e entram como páginas. São as 6 "linkadas não
  declaradas".
- **Nenhuma órfã.** O achado de 25% de indexação da 022 **não** se explica por página inalcançável
  — a arquitetura de links alcança tudo o que o sitemap declara. O que sobra como suspeito é a
  **densidade** (31 de 42 abaixo de 5 links contextuais) e o **título** (24 acima de 580 px).

## Declarado ausente, com o motivo

- **Taxa de reescrita do título pelo Google** — o Search Console não expõe o título exibido na
  SERP. Sem fonte, não há medida.
- **Cobertura Semântica / Entidades** — exige comparar com o Top 3 da SERP; continua fora.
- **Cruzamento página a página com as 27 fora do índice** — a 022 grava só o agregado do dia, sem
  veredito por URL. A tela **declara isso** e marca quem tem zero impressão no GSC (35 de 42).
  Cruzar exige a 022 persistir por URL: spec nova.

## SC-001

O board sai de 16 para **22 de 28** medidas na tela: as seis desta spec estão renderizadas em
`/okr/atma/aquisicao`, datadas com a apuração.

## Pendente

- **`gh workflow run paginas.yml`** só depois do merge em `main` — o Actions só enxerga workflow na
  branch padrão. ⚠️ Não disparar entre 23:30-01:00 nem 08:00-08:45 BRT (Princípio IV).
- ~~O `quickstart.md` §3 citava o host errado~~ — corrigido para `atma.roilabs.com.br` neste commit.
