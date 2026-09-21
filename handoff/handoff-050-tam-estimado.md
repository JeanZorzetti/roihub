# Handoff — 050 · Cobertura do TAM de busca, estimada no board

**Data:** 21/09/2026 · **Estado:** conferido no dev server (canvas a 1440px com a folha expandida, console limpo,
tsc limpo, 1202/1202 testes). Produção: conferir depois do push (~1 a 15 min, ler a TELA duas vezes).

## O que mudou

A folha IMPRESSÕES › `5. KPI de Demanda: Cobertura do Total Addressable Volume (TAM de Busca)` abre com o nó
`tamBusca-estimado`. É **estimativa**, não medida: o id não termina em `-medido`, o contador segue em 26 e o
`balizador` continua `semColetor`, porque o hub não lê volume de mercado. A decisão de usar o proxy gratuito pelo
GSC foi do dono em 21/09. A DataForSEO está com saldo negativo e a recarga mínima é de US$50.

| Onde | Mudança |
|---|---|
| `scripts/estimar-demanda.mjs` | Novo. Lê 9 janelas de 28 dias (`query`, os 2 hosts) sobre o inventário congelado e grava o pico de impressões por termo. Sem `--gravar`, só imprime. |
| `data/demanda-estimada.json` | Novo. Pico por termo, com procedência (janelas, totais por janela, inventário de origem). |
| `lib/kpis-busca.mjs` | `coberturaDaDemanda(linhas, demanda)`: impressões ÷ Σ `max(pico, hoje)`, e os buracos ordenados. |
| `app/gsc/mapa/page.tsx` | Bloco 050 depois do 049. Usa a leitura por termo que já estava em memória, sem requisição nova. |

## O número (Atma, janela 22/08 → 18/09)

**15,3% da demanda (teto) · 8.473 de 55.296 impressões em 28 dias.** Na janela de 21/08 → 17/09, a da
derivação, o resultado foi 15,8% (8.749 ÷ 55.278).

- A demanda de cada termo é o maior número de impressões que ele teve numa janela de 28 dias, de 09/01 a 17/09.
  Impressão só existe onde houve busca, então esse número é piso do volume. O denominador fica abaixo do real e a
  razão é **teto**.
- Série do inventário contra o mesmo denominador: jan 31,1% → mar 62,4% → **abr 82,9%** (a janela que definiu a
  maior parte dos picos, alta por construção) → mai 40,4% → jun 14,9% → **jul 0,0%** (desindexação) → ago 17,2% →
  set 15,8%.
- Maiores buracos: «invisalign» 21 de 6.934 (posição 3,7), «aparelho transparente» 4 de 2.605 (posição 3),
  «invisalign preço» 53 de 2.186, «alinhador invisivel» 47 de 1.643, «alinhadores invisíveis» 78 de 1.374. Os cinco
  somam 14,5 mil das 46,8 mil impressões que faltam.
- `invisalign*` (229 termos, marca de concorrente) é 35,3% do denominador. Sem eles, a estimativa sobe para 22,2%.

## Decisões

- **O numerador é impressão, não posição.** A versão "termos no Top 20 ponderados pelo pico" dá 72,8%, dentro da
  meta de 60–80% do board, e seria lida como aprovação. A posição do GSC é a média só das buscas em que o site
  apareceu: «invisalign» está na posição 3,7 com 21 impressões. O nó publica os dois números e diz por que usa o
  primeiro.
- **O filtro de 1ª página foi descartado.** A ideia inicial era contar só as janelas em que o termo estava na
  página 1, supondo que ali impressão ≈ volume. A mesma evidência do «invisalign» derruba a hipótese (6.934 impressões
  na posição 1,06 em abril, 21 na posição 3,7 hoje). Por isso a estimativa aceita qualquer posição.
- **O denominador é `max(pico, hoje)`.** Ele só cresce, então a razão não passa de 100% e não tem como ser inflada.
- **A estimativa fica presa ao inventário.** `procedencia.inventarioCongeladoEm` precisa bater com o inventário em
  uso. Se não bater, o nó mostra "∅ não estimado" e nunca 0%. Refazer o inventário exige refazer a estimativa:
  `node --env-file=.env scripts/estimar-demanda.mjs atma --gravar`.

## Pendente

- A medida real depende de volume do Google Ads: recarregar a DataForSEO (a chamada dos 725 termos custa ~US$0,08) ou
  importar um CSV do Keyword Planner. Com isso a folha deixa de ser `semColetor`.
- A meta do board conta **clusters**, e o hub não agrupa termos. A estimativa soma termo a termo, como o "O que mede".
