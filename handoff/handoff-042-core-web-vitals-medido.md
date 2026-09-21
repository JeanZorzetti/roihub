# Handoff — 042 · Core Web Vitals e TTFB medidos no board, pelas duas origens

**Data:** 21/09/2026 · **Commit:** `921e76c` (+ crédito em `MEDIDO_POR` no commit seguinte) ·
**Estado:** no ar ~30 s depois do push e **conferido em produção duas vezes** (varredura do HTML e
curl de novo, mesma leitura).

## O que mudou

As cinco folhas do ramo POSIÇÃO MÉDIA › `1. KPIs Técnicas de Experiência e Performance (Core Web
Vitals & TTFB)` abrem com a leitura de campo (CrUX, p75, todos os dispositivos). Agora são 15 folhas
`-medido` no mapa.

| Onde | Mudança |
|---|---|
| `lib/crux.mjs` | `vitalPorOrigem()` nova e pura: recebe TODAS as origens declaradas (a atual primeiro) e diz qual respondeu, ou por que nenhuma respondeu. |
| `lib/crux.ts` | `lerOrigens()` nova. `lerPassRate()` **mudou** de `/okr/[slug]/aquisicao` para cá, e as duas telas usam a mesma. |
| `app/gsc/mapa/page.tsx` | `noDoVital()` e `noDoPassRate()`; a leitura da CrUX começa logo depois da leitura por página do GSC e só é esperada no bloco dos vitais. |
| `app/okr/[slug]/aquisicao/page.tsx` | Importa o `lerPassRate` e não o declara mais. Saída idêntica (conferida: 0 de 10). |
| `lib/gsc-delta.mjs` | `MEDIDO_POR` dos quatro vitais credita `vitalPorOrigem` (a função do mapa) + `celulasDeVitais` (a da ficha). |
| `test/crux.test.mjs` | +2 testes (1.195 no total, todos passando). |

## O número (Atma, 21/09/2026)

| Folha | Leitura | Origem |
|---|---|---|
| LCP | 1,8 s · ✓ ≤ 2,5 s | atma.roilabs.com.br |
| INP | ∅ sem amostra de INP | a origem tem os outros vitais, este não |
| CLS | 0,00 · ✓ ≤ 0,10 | atma.roilabs.com.br |
| TTFB | 406 ms · ✓ ≤ 800 ms | atma.roilabs.com.br |
| Meta do Pass Rate | ∅ não apurável · 0 de 10 URLs com os três vitais | 10 sem amostra, todas em usealigner.com |

Janela CrUX 2026-08-23 → 2026-09-19. **19 dos 28 dias são de antes da troca de domínio de 11/09.**
`usealigner.com` responde 404 (sem amostra) na origem e nas URLs.

## Por que as duas origens

O hub perguntava só pela origem do card (`usealigner.com`) e publicava "sem amostra" enquanto a
origem anterior tinha 28 dias de campo. Perguntar só pela anterior publicaria o domínio velho como
o site de hoje. O nó diz no próprio texto qual domínio respondeu (`no domínio anterior —
usealigner.com ainda sem amostra`), e o painel diz quantos dias da janela são de antes da troca.

## O que vai mudar sem ninguém mexer

- **Até 08/10/2026** (antes, se a amostra cair): a origem antiga sai da janela e as folhas viram
  `∅ sem amostra de campo`. É o estado certo, não regressão.
- Quando `usealigner.com` passar do limiar de tráfego da CrUX, ela vence a antiga (é a primeira
  da ordem) e o `no domínio anterior` some do nó sozinho.

## Pendências

1. **A ficha (`lib/ficha-dados.ts`) e o selo "Campo (CrUX)" de `/okr/atma/aquisicao` perguntam
   só pela origem do card.** Não mentem, porque nomeiam a origem, mas mostram "sem amostra" onde o
   mapa mostra 1,8 s. Consertar = trocar `lerCampo(alvoCrux)` por `lerOrigens(hostsDeclarados(p))`
   + `vitalPorOrigem()`.
2. INP: o histórico da CrUX (`queryHistoryRecord`) tinha 106 e 98 ms em dois períodos anteriores, e
   o dado sumiu. O hub não lê o histórico.
3. Cosmético: `formatarValor` usa espaço comum, e o mapa quebra `≤ 2,5 / s` entre duas linhas. A
   função é compartilhada com a ficha e com testes, então não foi mexida.

## Gotchas do ambiente

- PageSpeed Insights sem chave: cota diária esgotada (429). Não faz falta, porque a régua do board
  é p75 de campo, e dado de laboratório não responde a ela.
- A CrUX devolve o CLS como string (`"0.00"`); `numero()` já trata.
- Para screenshot do Mind Elixir: não disparar `pointerdown` sintético, porque `setPointerCapture`
  lança e acende o overlay de erro do Next. Clicar com `page.mouse` num nó que esteja dentro da
  caixa do mapa.
