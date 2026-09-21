# Handoff — o mapa de GSC mede tudo? Árvore causal (BSC), lead × lag (4DX) e 80/20

**Data:** 21/09/2026 13:00 BRT · **Estado:** análise, nenhum código mudou. Números lidos NO AR (`curl` com a
credencial do hub) em `/gsc/mapa`, `/okr/atma` e `/okr/atma/aquisicao`. Janela do GSC 22/08 → 18/09 (28d, D-3);
cadeia da Atma 31/07 → 21/09.

## 1. Cobertura: 25 de 31 folhas com número

São 32 folhas no `CATALOGO`. `checklistGsc` é procedimento, então sobram 31 métricas.

| Estado | Qtd | Folhas |
|---|---|---|
| Número na própria folha | 24 | ctrPorPosicao (6 faixas com veredito), penetracaoTop3, strikingDistance, crescimentoNaoMarca, impressoesTop3, ctrGap, schema, larguraTitulo, termoNoTitulo, intencao, lcp, cls, ttfb, indexacaoLimpa, rejeicaoRastreio, profundidadeClique, frescor, canibalizacao, linksInternos, buscasDeMarca, consultasUnicas, top20, queryToPage, activeIndexRatio |
| Número no nó vizinho | 1 | conformidadeUrls: o 25% (1 de 4 decididas) está na nota do ctrGap, e a folha só repete a meta |
| Estimado | 1 | tamBusca: 15,3% (teto, proxy pelo GSC) |
| Coletor sem amostra | 2 | inp (a CrUX não tem INP da origem) · urlsBoas (0 de 10 URLs com os 3 vitais) |
| Sem coletor | 3 | reescritaTitulo (exige ler a SERP) · coberturaSemantica (sem definição operacional) · referringDomains (sem fonte de backlink) |

**Medido ≠ medido no site de hoje.** LCP, CLS e TTFB são do domínio anterior. 872 das 887 consultas chegam
por `atma.roilabs.com.br`. A base do não-marca está interrompida, e `marca.termos` segue `atma*` com o site já
virado Use Aligner. Até ~23/11, parte das leituras descreve a migração de 11/09, não o SEO.

Única rota gratuita para fechar lacuna: referring domains pelo relatório **Links** do GSC (export manual, não tem
API). As outras custam dinheiro (DataForSEO: saldo −US$0,003, recarga mínima US$50) ou não têm definição.

## 2. Árvore causal (BSC): o mapa é taxonomia, não árvore

- O ramo CLIQUE **não tem número de clique**. Guarda CTR por posição, penetração no Top 3, striking distance e
  crescimento não-marca. Pela regra do template N0–N6 ("filha só é filha se entra na conta da mãe"), é lista.
- **Identidade** (fecha por conta): `cliques = Σ impressões × CTR` por faixa. Já está calculada nas 6 faixas:
  posições 7–10 somam 22.770 de 23.330 impressões por página (97,6%).
- **Hipótese** (não fecha): CWV, schema, links, frescor e índice → posição/CTR. `gsc-delta.mjs` já proíbe somar
  ou compor esses efeitos.
- **O elo que falta é justamente o da BSC.** O mapa termina em CLIQUE, e a cadeia até R$ vive em `/okr/atma`
  sem ligação com ele: **55 leads → 22 responderam → 7 orçamentos → 0 tratamentos**.

Proposta (não executada): pendurar o mapa em D1-Descoberta da árvore da Atma, com a aresta CLIQUE → lead
visível, e desenhar arestas sólidas (identidade) × tracejadas (hipótese). As 4 perspectivas da BSC são para
unidade de negócio, não para um canal: forçar o mapa nelas criaria caixas vazias.

## 3. Lead × lag (4DX): três classes, não duas

| Classe | Qtd | Folhas |
|---|---|---|
| Resultado (lag) | 15 | ctrPorPosicao, ctrGap, conformidadeUrls, impressoesTop3, penetracaoTop3, strikingDistance, crescimentoNaoMarca, consultasUnicas, top20, queryToPage, activeIndexRatio, buscasDeMarca, tamBusca, reescritaTitulo, referringDomains |
| Alavanca (a equipe muda amanhã, mas o poder preditivo é hipótese) | 8 | larguraTitulo, termoNoTitulo, intencao, schema, linksInternos, canibalizacao, frescor, coberturaSemantica |
| Higiene (limiar: depois de passar, não rende mais) | 8 | lcp, inp, cls, ttfb, urlsBoas, indexacaoLimpa, rejeicaoRastreio, profundidadeClique |

- A lead do 4DX é **contagem de ação por semana** (títulos reescritos, URLs com indexação solicitada, posts
  atualizados). Isso mora em N6/agenda/autopublishing, não no GSC.
- "Preditiva" é afirmação causal que ainda não dá para testar: é 1 site só, e a série tem o buraco da
  desindexação (27/06 → 24/07) e a migração de 11/09. O rótulo honesto é "alavanca (hipótese)".
- Disciplina 1 (foco na meta crucial): se a meta crucial é R$ 50 mil até 31/12, a lead fica no gargalo, que é o
  fechamento.

## 4. 80/20: a concentração passa muito de 80/20

No mapa:
1. `/blog/quanto-custa-alinhador-invisivel` é **1 de 29 URLs** com impressão e tem **93,9% do tráfego
   decidível** (20.887 de 22.248 impressões) e 814 das 887 consultas. O CTR é 1,3% contra o piso de 2% na posição
   7,3, decidido abaixo pelo IC → **faltam 153 cliques/28d** (`paginaNomeada().cliquesFaltantes`). O título
   no ar tem **767px** pela `larguraDoTitulo()` do hub (limite 580) e diz **"em 2025"**: a parte visível do
   snippet anuncia o preço do ano passado. O post também está vencido (data 2025-10-20, prazo de 6 meses).
2. `/pacientes/precos` está "Descoberta, não indexada" a 1 clique da home, junto com `/contato`,
   `/ortodontistas` e `/blog`. O conserto é "Solicitar indexação" na UI do GSC. Antes, decidir quem é dono da
   consulta de preço: em 28 das 73 consultas canibalizadas, o post (posição 4–9) disputa com `/precos` (48–65).
3. `gsc-delta.mjs#linha/ordenar/resumo` (a fila de trabalho por moeda) existe e tem teste, mas **nenhuma tela
   chama**.

Fora do mapa, onde está o 80/20 do negócio: **4 orçamentos vivos somam R$ 24.670,98**, metade da meta, e
29 dos 55 leads (53%) estão "sem resposta". Hoje, todo clique a mais termina num degrau zerado.

## Decisões em aberto (do dono)

- **Dono da consulta de preço:** o post ou `/pacientes/precos`?
- **Ordem:** abrir a spec 051 (árvore causal, classes e fila) agora, ou atacar primeiro os 2 itens do mapa e o
  follow-up?

## Próximos passos, se aprovados

- Sem código: reescrever título e meta do post (tirar o 2025, caber em 580px), solicitar indexação das 4 URLs,
  fazer follow-up dos 4 orçamentos.
- Spec 051 (Spec Kit):
  - `classe` por folha no `CATALOGO`, travada por teste como o `MEDIDO_POR`;
  - aresta CLIQUE → lead no mapa, lendo a cadeia de `/okr/atma`;
  - `ordenar()` ligado como fila no topo do mapa.
