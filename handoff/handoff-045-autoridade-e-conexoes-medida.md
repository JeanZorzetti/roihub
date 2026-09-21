# Handoff — 045 · Autoridade e Conexões medida no board (links internos, referring domains, marca)

**Data:** 21/09/2026 · **Estado:** conferido no dev server (lista servidor + mapa expandido + painel a
1470px); produção a conferir depois do push.

## O que mudou

As folhas do ramo POSIÇÃO MÉDIA › `4. KPIs de Autoridade e Conexões (PageRank Interno e Externo)` abrem
com leitura própria. O mapa passa de 20 para 22 folhas `-medido`. **Nenhuma requisição nova:** os links
leem a corrida de página (024), a marca lê a série de `hub_gsc_dia` que o crescimento não-marca (036) já
lia, agora hasteada, e a leitura por termo que a penetração (034) já fazia.

| Onde | Mudança |
|---|---|
| `lib/marca.mjs` | `mesesFechados(dias, hoje, campo)`: a coluna somada virou parâmetro (padrão `impressoesNaoMarca`, os consumidores antigos não mudam). |
| `app/gsc/mapa/page.tsx` | Bloco 045: nós em Links Internos e Buscas de Marca, e o nó "∅ sem coletor" em Referring Domains. A leitura da série subiu para fora do bloco 036. |
| `lib/gsc-delta.mjs` | `MEDIDO_POR.buscasDeMarca` credita `razaoDeMarca` (a proporção) e `mesesFechados` (o volume mensal que a meta pede). |
| `test/` | +1 teste (1.198 no total). |

## O número (Atma, corrida de 21/09; série 18/01 → 17/09; termos na janela 22/08 → 18/09)

| Folha | Leitura | Meta do board |
|---|---|---|
| Links internos contextuais | **5 de 30** páginas com 5 a 10 · 21 abaixo de 5 · 4 acima de 10 | 5 a 10 por página-alvo |
| Referring domains | **∅ sem coletor** | +3 a +10 por trimestre |
| Buscas de marca | **5,5%** das impressões do corte `bra` · 448 em ago, contra 171 em jul e 2.240 no pico (abr) | volume mensal crescente |

## Achados

1. **A busca pela marca caiu a 20% do pico e não voltou.** Meses fechados: fev 1.649 · mar 1.910 · abr 2.240
   · mai 1.803 · jun 722 · jul 171 · ago 448. O +162% de jul→ago é a volta da desindexação (7 dias sem
   nenhuma impressão de marca em julho), não crescimento. Setembro corre a ~13/dia, contra 14,5/dia em agosto.
2. **O nome mudou e a marca declarada não.** A home diz "Use Aligner", o domínio é `usealigner.com`, e
   `marca.termos` segue `atma, atma aligner, atma alinhadores`. Na janela de 28 dias **nenhuma** consulta
   contém "usealigner". A marca que ainda é buscada é a antiga: «atma aligner», 412 impressões na **posição
   4,4**. O site não é o 1º resultado para o próprio nome.
3. **Os links internos se concentram nas páginas de navegação.** Recebem mais de 10: `/pacientes/enviar-exames`
   (26), `/blog` (21), `/pacientes` (20) e `/blog/quanto-custa-alinhador-invisivel` (11). `/sobre` recebe 0,
   e 16 posts recebem de 1 a 4. `/pacientes/precos` está na faixa, com 9.
4. **A régua do hub (3 a 10 por 1.000 palavras) dá 10 dentro, 14 abaixo e 6 acima.** As duas contagens estão
   no painel. Nenhuma das duas tem fonte.

## Declarado, não consertado

- **`marca.termos` da Atma.** Quando "use aligner" passar a ser buscado, vai contar como não-marca e inflar o
  crescimento não-marca (036). Declarar exige refazer o backfill. Hoje não muda número nenhum (zero consultas),
  e o nó avisa sozinho enquanto o nome do domínio não estiver coberto.
- **"Página-alvo".** O hub não sabe quais páginas você quer empurrar para o Top 3, então conta as 30 da corrida.
- **"Partindo de páginas com alto tráfego".** A corrida grava quantos links chegam a cada página, não de onde
  vêm (as arestas não são persistidas). Essa metade da meta não dá para conferir.
- **Referring domains.** O coletor mais barato é manual: exportar o relatório Links do Search Console a cada
  trimestre e contar os domínios novos. As bases pagas continuam fora (`handoff-os-28-do-board-o-que-falta.md`).
- O canvas a 390px não foi conferido. No celular quem responde é a lista servidor, como decidido na 032.
