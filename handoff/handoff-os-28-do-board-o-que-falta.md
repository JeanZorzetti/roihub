# Os 28 do board: o que falta, em que ordem, e o que não dá

**07/09/2026** · sucessor de `handoff-021-serie-gsc-e-kpis-de-busca.md` · planejamento, nada
implementado

## ⚠️ Antes de tudo: não são 19

Venho escrevendo "19 KPIs" desde a leitura do board em 07/09, inclusive no handoff da 021 e nas
memórias. **O número está errado.** Recontado contra o board:

| Bloco | Itens numerados |
|---|---|
| IMPRESSÕES | 5 |
| POSIÇÃO MÉDIA | 4 |
| CLIQUE | 5 |
| **Subtotal numerado** | **14** |
| Checklist para auditar seu GSC | 4 **grupos**, com **14 medidas nomeadas** dentro |
| **Total de medidas** | **28** |

O "19" saiu de somar os 14 numerados com os 4 grupos e errar a conta. As 14 medidas do checklist
são nomeadas uma a uma no board (LCP, INP, CLS, TTFB, Pass Rate, Sitemap Indexation Ratio,
Rejeição de Rastreio, Cobertura Semântica, Canibalização Interna, Content Freshness, Click Depth,
Densidade de Links Internos, Referring Domains Velocity, Brand Demand Ratio) e cada uma tem meta
própria — tratá-las como 4 itens escondia 10 medidas.

**Placar real depois da 021: 7 de 28 na tela.** Não 6 de 19.

## Onde estão as 28

✅ na tela · ⚠️ na tela sem a meta do board · ❌ ausente

### IMPRESSÕES

| # | Medida | Status | O que falta |
|---|---|---|---|
| 1 | Footprint de Consultas Únicas | ⚠️ | o número está lá (piso). A meta é **+10-20%/trimestre** e exige `query` por dia, que a 021 decidiu não gravar |
| 2 | Volume de KW no Top 20 | ⚠️ | o número está lá. A meta é **≥60% do catálogo de KW mapeadas** — não existe catálogo |
| 3 | Query-to-Page Ratio | ❌ | denominador: total de URLs ativas indexadas |
| 4 | Active Index Ratio | ⚠️ | virou contagem; falta o mesmo denominador |
| 5 | Cobertura do TAM de Busca | ❌ | volume de busca externo |

### POSIÇÃO MÉDIA

| # | Medida | Status | O que falta |
|---|---|---|---|
| 1 | % de Impressões no Top 3 | ✅ | — (meta 40-50% na tela) |
| 2 | Taxa de Penetração no Top 3 | ❌ | denominador: lista de termos estratégicos monitorados |
| 3 | Striking Distance | ✅ | — |
| 4 | Crescimento de Impressões Não-Marca | ❌ | lista de marca por projeto + série separando marca |

### CLIQUE

| # | Medida | Status | O que falta |
|---|---|---|---|
| 1 | CTR Relativo por Posição | ✅ | — |
| 2 | Índice de Conformidade (CTR Gap) | ✅ | — |
| 3 | Cobertura de Dados Estruturados | ❌ | crawl de N páginas + parse de JSON-LD |
| 4 | Integridade do Título | ❌ | crawl + medição em px. **A parte "reescrita pelo Google" é inobservável** — ver seção final |
| 5 | Alinhamento de Intenção | ❌ | crawl + classificação de modificadores |

### Checklist do GSC

| Grupo | Medida | Status | O que falta |
|---|---|---|---|
| 1 | LCP · INP · CLS · TTFB · CWV Pass Rate | ❌ (5) | CrUX API |
| 2 | Sitemap Indexation Ratio | ❌ | ligar `lib/indexacao.mjs`, que já existe |
| 2 | Taxa de Rejeição de Rastreio | ❌ | sai da mesma chamada |
| 3 | Cobertura Semântica / Entidades | ❌ | comparação com o Top 3 da SERP — **o mais caro e o mais subjetivo** |
| 3 | Taxa de Canibalização Interna | ✅ | — (meta zero na tela) |
| 3 | Content Freshness Ratio | ❌ | crawl + data de atualização |
| 4 | Click Depth | ❌ | crawl em largura a partir da home |
| 4 | Densidade de Links Internos | ❌ | mesmo crawl |
| 4 | Referring Domains Velocity | ❌ | fonte de backlinks paga |
| 4 | Brand Demand Ratio | ❌ | lista de marca por projeto |

## O que já existe no repo e NÃO deve ser reconstruído

Este é o ponto mais importante deste handoff. Três aparatos resolvem boa parte do que falta e
**nenhum deles está ligado à `/okr`** — o mesmo padrão de `dourado_estado_dobrou_por_ligacao`
("6 scripts apuravam, nenhum ligado") e do `scripts/serie-gsc.mjs` da 021.

1. **`lib/indexacao.mjs`** — `inspecionarIndexacao(urls)` e `estaIndexada()` já falam com a URL
   Inspection API e devolvem `coverageState`. Isso é **Sitemap Indexation Ratio + Rejeição de
   Rastreio + o denominador de URLs indexadas**, ou seja, 4 medidas, sem uma linha de código
   novo de coleta.
2. **`lib/conformidade.mjs`** — já faz `buscar()` com HTML, lê `robots.txt`, lê e parseia o
   sitemap, extrai `primeiraPaginaInterna()` e já garimpa JSON-LD no HTML (`julgarSameAs`). O
   pipeline de fetch dos 35 projetos existe e roda em ~140 requisições. **Um crawler novo seria
   a segunda cópia disso.**
3. **`lib/gsc.ts:queryPageWindow`** (exportada na 021) — a chamada de `query`+`page` em janela
   arbitrária já está pronta para quem precisar de recorte por termo.

⚠️ **`lib/crawl.mjs` NÃO é um crawler.** É parser dos CSV de Crawl Stats exportados à mão. O nome
engana e já custou uma leitura errada.

## As quatro specs, em ordem de razão entre valor e custo

### 022 — Indexação: 4 medidas ligando o que já existe

**Destrava:** Sitemap Indexation Ratio, Rejeição de Rastreio, Active Index Ratio (a razão de
verdade, não a contagem) e Query-to-Page Ratio — porque todos os quatro dependem do mesmo
denominador, *total de URLs indexadas*, e `lib/indexacao.mjs` já sabe produzi-lo.

**Custo:** baixo. Ler o sitemap (conformidade já sabe), inspecionar as URLs, gravar. Uma tabela
no padrão de `hub_gsc_dia`.

🚩 **Quota: a URL Inspection API dá ~2.000 inspeções/dia por propriedade.** Com 34 projetos isso
não é ilimitado: sites grandes precisam de **amostra declarada** ("450 de 1.200 URLs, amostradas
por X"), nunca de um número que finge cobrir o site inteiro. Amostra não declarada é a armadilha
de `amostra_procurada_fora_do_percentual`.

**Por que primeiro:** melhor razão do conjunto — 4 medidas, quase nenhuma coleta nova, e entrega
o denominador que hoje faz dois KPIs saírem capados.

### 023 — Core Web Vitals: 5 medidas de uma fonte só

**Destrava:** LCP, INP, CLS, TTFB e Pass Rate — o grupo 1 inteiro do checklist.

**Fonte: CrUX API do Google** (dado de campo, cota gratuita com chave do Google Cloud —
*confirmar cota e limites antes de planejar a spec*). Campo, **não** Lighthouse local:
`lighthouse_local_windows_onedrive_unreliable` mede ±30% nesta máquina, e
`goiania_lcp_root_causes` já registra que uma leitura de PSI não decide nada. O board pede
"75º percentil" e "90% das URLs prioritárias" — as duas coisas são de campo por definição.

**Custo:** baixo-médio. Uma chave nova, um coletor, uma tabela. Sem crawl, sem HTML.

### 024 — Crawl de páginas: 6 medidas sobre o HTML

**Destrava:** Cobertura de Schema, Integridade do Título (a parte observável), Alinhamento de
Intenção, Content Freshness, Click Depth e Densidade de Links Internos.

**Custo: o maior do conjunto.** Exige percorrer N páginas por projeto em largura a partir da home
(Click Depth não sai de outro jeito) e guardar o resultado. Estender `lib/conformidade.mjs` em
vez de escrever um crawler novo.

🚩 **Não pendurar isso na corrida de conformidade.** Aquela já faz ~140 requisições e está fora
do `npm test` por isso; um crawl em largura de 34 sites multiplica esse número por página
visitada. Corrida própria, com teto de páginas por projeto declarado na tela.

**Sugestão de fatiamento:** Schema + Título + Intenção saem só da home e das páginas do sitemap
(barato). Click Depth + Links Internos exigem o crawl em largura (caro). São duas specs, não uma.

### 025 — Marca: 2 medidas e uma decisão

**Destrava:** Brand Demand Ratio e Crescimento de Impressões Não-Marca.

**A ideia barata:** em vez de gravar `query` por dia (~25 mil linhas/dia/projeto, rejeitado na
021), a corrida diária faz **uma requisição a mais por projeto**, com filtro de `query` contendo
o termo de marca, e grava **duas colunas** em `hub_gsc_dia`: impressões totais e impressões de
marca. Não-marca é a subtração. Custo: +1 requisição por projeto por dia, zero linha nova.

🚩 **Sem corte por país o número mente** — `gsc_branded_position_polluted_by_country` já registra
isso.

**Depende de você, não de código:** a lista de termos de marca por projeto.

## O que NÃO vou propor construir

Três coisas, com o motivo. Cada uma é uma medida do board que ficará permanentemente ❌ a menos
que você decida o contrário.

1. **"Taxa de reescrita do título pelo Google" (CLIQUE-4, metade da medida).** O Search Console
   **não expõe o título que o Google exibiu na SERP**. Medir isso exigiria raspar resultados de
   busca — que viola os termos do Google, quebra a cada mudança de layout e daria um número que
   ninguém consegue reproduzir. A outra metade do KPI (comprimento em px, keyword nos primeiros
   35 caracteres) é perfeitamente observável e entra na 024. **Proponho entregar metade e dizer
   na tela que é metade**, em vez de um número inventado.
2. **Referring Domains Velocity (checklist 4).** Exige base de backlinks — Ahrefs, Majestic ou
   DataForSEO, todas pagas e nenhuma barata. É a única medida do board que custa assinatura
   recorrente para um portfólio que, segundo `roihub_portfolio_nao_cobra`, ainda não fatura.
   **Recomendo deixar fora até haver receita.**
3. **Cobertura Semântica / Entidades (checklist 3).** O board pede "100% das sub-intenções que os
   3 primeiros colocados cobrem". Isso exige raspar o Top 3 da SERP e rodar NLP comparativa — a
   medida mais cara e mais subjetiva do board inteiro, e a que mais facilmente produz um número
   que parece rigoroso e não é. Se você quiser, é a última.

**Cobertura máxima realista: 24 de 28**, com as 4 acima declaradas como ausentes e o porquê
visível na tela — em vez de números fabricados para fechar o placar.

## Decisões que são suas, não do código

Três specs acima travam sem isto, e nenhuma quantidade de engenharia substitui:

1. **O catálogo de palavras-chave alvo por projeto.** Destrava Top 20 como % (IMPRESSÕES-2) e
   Penetração no Top 3 (POSIÇÃO-2). Sem ele os dois KPIs continuam sendo número sem denominador
   — e o repo já pagou caro por denominador inventado.
2. **A lista de termos de marca por projeto.** Destrava a 025.
3. **O TAM de busca vem de onde?** `project_openseo_keyword_planner` já tem DataForSEO ligado. A
   pergunta é se vale a chamada, não se é possível.

## Ordem sugerida

**022 (indexação) → 023 (CrUX) → 025 (marca) → 024a (schema/título/intenção) → 024b (click depth
e links internos).**

Depois da 022 e da 023 o placar vai de **7 para 16 de 28** com custo baixo nas duas. A 024b é a
mais cara e a que menos muda decisão — deixá-la por último é de propósito.

## Antes de começar qualquer uma

`git pull` primeiro: a 021 foi merged em `main` pelo PR #5 e o working tree deste repo tem outros
escritores (`roihub_working_tree_has_other_writers`). E confira que a corrida de 05:17 BRT rodou
sozinha — no dia deste handoff ela só tinha rodado por `workflow_dispatch`.
