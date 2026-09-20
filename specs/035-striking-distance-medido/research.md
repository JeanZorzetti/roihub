# Phase 0 — Research: Striking Distance medido no board

**Data das medições**: 2026-09-20 · **Janela**: `2026-08-21 → 2026-09-17` (Descoberta, 28d, D-3)
**Fonte**: Search Console, `sc-domain:usealigner.com` + `sc-domain:roilabs.com.br` filtrada por
`atma.roilabs.com.br`, os dois hosts declarados do card da Atma, somados.

Nada aqui foi estimado. Cada linha saiu de uma requisição real.

## R1 — Qual dimensão mede "consultas"

**Decisão**: `query` sozinha.

| dimensão | linhas na faixa 4,0–10,9 | o que uma linha é |
|---|---:|---|
| `query` | **344** | uma consulta |
| `query`+`page` | 362 | um par consulta×página |

**Por quê**: o board pede "número absoluto de **consultas**". Os 18 de diferença são termos que
ranqueiam com mais de uma página, contados uma vez por página. A regra já estava escrita em
`lib/kpis-busca.mjs:195` (034): a agregação do Google por `query` não é a soma das linhas de
`query`+`page`, e re-derivá-la somando é o que a 032 deletou em `porUrl()`.

**Alternativa rejeitada**: ler `query`+`page` para bater com `/okr/atma/aquisicao`. Custaria duas
requisições a mais por render e publicaria pares sob o rótulo "consultas". A divergência entre as
duas telas é correta e declarada (FR-007), não um defeito a esconder.

## R2 — A guarda de marca na dimensão nova

**Achado**: `strikingDistance()` filtra por `c.query`; `mesclarPorTermo()` devolve `termo`. A
chamada compila e a guarda não remove nada.

| | consultas | impressões | cliques | CTR da fila |
|---|---:|---:|---:|---:|
| guarda funcionando | **344** | 5.274 | 41 | **0,8%** |
| guarda desligada | 347 | 5.697 | 113 | **2,0%** |

Os três termos: `atma aligner` (4,4 · 423 impr · **70 cliques**), `atma dental` (7,4 · 7 · 2),
`atma odontologia` (10,0 · 2 · 0).

**Decisão**: função irmã que lê `termo`, com validação de forma no topo (ver plan.md). A marca
sozinha responde por 62% dos cliques da fila; publicá-la inflaria o CTR em 2,5× e poria o termo que
já converte sozinho no topo de uma lista que existe para apontar reforço de conteúdo.

## R3 — Escopo do numerador: todas as consultas ou só o inventário de 725

**Decisão**: todas as lidas (344). Resolvido em Clarifications.

| recorte | consultas | impressões |
|---|---:|---:|
| todas as lidas | **344** | 5.274 |
| só as do inventário congelado (725 termos, 034) | 190 | 4.850 |
| fora do inventário | 154 | 424 |

As 190 são 26,2% do inventário. As 154 de fora somam 424 impressões (≈2,8 cada).

**Por quê**: "número absoluto" na letra do board; o inventário está congelado em 20/09/2026 e
filtrar por ele cegaria a folha para consulta nova — a oportunidade que o KPI existe para achar. O
KPI 2, uma folha acima na mesma tela, já reporta contra o inventário. O recorte entra na nota como
leitura secundária (FR-013).

## R4 — "Impressões relevantes": piso ou não

**Decisão**: sem piso (`impressoes > 0`). Resolvido em Clarifications.

| piso | consultas | impressões da faixa retidas |
|---:|---:|---:|
| **1** | **344** | **100,0%** |
| 2 | 251 | 98,2% |
| 5 | 173 | 94,1% |
| 10 | 115 | 86,6% |
| 20 | 63 | 73,6% |
| 50 | 17 | 48,4% |

93 das 344 têm uma impressão só. Acima de 20 impressões a faixa é idêntica com ou sem o filtro de
inventário (63 nos dois casos) — o inventário da 034 foi derivado com piso de 20.

**Por quê**: a 033 removeu o piso fixo de impressões do hub e passou a decidir suficiência de
amostra por intervalo de confiança — mas isso vale para **veredito**. Aqui é contagem: sem veredito,
não há o que o IC sustente, e um piso escolhido por quem mede tornaria o número incomparável. A
cauda fica declarada na nota (FR-014) em vez de cortada em silêncio.

## R5 — De onde vem a leitura (custo)

**Decisão**: reusar `termosGsc`, que `app/gsc/mapa/page.tsx` já obtém para `penetracaoTop3`.

A página faz hoje duas leituras: `gscPaginas` (dimensão `page`, para as seis faixas) e `gscTermos`
(dimensão `query`, para a penetração). A medida desta feature consome a segunda. **Zero requisição
nova** (SC-003).

**Alternativa rejeitada**: `gscConsultas()`, que traria `query`+`page` — dois problemas de uma vez,
a dimensão errada (R1) e +2 requisições por render.

## R6 — A série histórica, para saber o que o número significa

| janela de 28 dias | termos lidos | striking | impressões | cliques |
|---|---:|---:|---:|---:|
| março/2026 | 1.597 | 335 | 6.218 | 26 |
| maio/2026 | 1.341 | 372 | 15.355 | 146 |
| julho/2026 | 4 | 2 | 2 | 0 |
| ago–set pré-migração | 1.024 | 360 | 8.539 | 63 |
| **atual** | **893** | **344** | **5.274** | **41** |
| 8 meses | 3.831 | 983 | 99.593 | 595 |

A faixa 4–10 é estável (335 → 344) enquanto a penetração no Top 3 caiu de 49,0% para 10,2% (034).
O KPI não está medindo um problema novo: está medindo uma fila que ninguém converteu. O zero de
julho é a desindexação de junho.

Esta série **não** vai para a tela — ela justifica a feature e fica registrada aqui. A folha publica
a janela corrente, como todas as outras do mapa.
