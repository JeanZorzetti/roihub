# Handoff — 051 · o mapa de GSC como árvore de causa e efeito

**Data:** 21/09/2026 · **Commits:** `bdb9687` (plano) · `6c64fe6` (feature) · **Suíte:** 1216/1216, `tsc` limpo.

## O que entrou

| História | Onde | O quê |
|---|---|---|
| US1 — a ligação com o dinheiro | `app/gsc/mapa/page.tsx` | painel "Depois do clique" no topo: `CadeiaDiagrama` com a cadeia de `/okr/atma` (55 → 22 → 7 → 0), o veredito, a janela da época e os cliques da janela de 28 dias **sem taxa** entre eles; nó "Depois do clique" no ramo CLIQUE; etiqueta `soma` nele e nas faixas de posição |
| US2 — três classes | `lib/gsc-delta.mjs` (`CATALOGO.classe`, `acaoSemanal`, `CLASSES`), `lib/board-gsc.mjs` | 15 resultado, 8 alavanca, 8 higiene; o checklist sem classe. A classe é a 2ª etiqueta, entra na nota e no `metadata` |
| US3 — a fila 80/20 | `lib/gsc-delta.mjs#filaDoMapa` | sobre `linha()` + `ordenar()`, que existiam com teste e ninguém chamava. Em cliques, um item por URL decidida abaixo da régua (o post de preço primeiro, 153/28d); em pp, largura de título; vitais acima do limite. Nada somado; o que fica fora sai contado e com motivo |
| FR-012a/b — dinheiro por pessoa | `lib/okr.mjs#ultimoPorPessoa`, `valorEmRisco`, `ticketDeOrcamentos`; `lib/ficha.mjs`; `app/okr/[slug]/risco.tsx` | cada pessoa vale o **último** orçamento. Em aberto: R$ 10.907,98 (era R$ 24.670,98 somando revisões). Ticket: média do último orçamento de cada pessoa |

## Decisões (dono, 21/09/2026)

- Q1: A — o mapa mostra só contagens; `/okr/atma` passa para o último orçamento por pessoa. O ticket entrou na
  mesma regra porque o próprio código declarava o viés da média por documento.
- Q2: A — a ação semanal das alavancas é só nomeada; contar exige fonte que o hub não tem.

## Armadilhas desta entrega

- O teste de `board-gsc` que proibia etiqueta extra foi **atualizado de propósito**: a classe tem dono (FR-005).
  A ordem agora é `[procedência, classe, divergência?]`.
- `conformidadeDeCtr()` foi hasteada no topo da página: o nó do CTR Gap e a fila leem a mesma.
- `dadosDaFicha("atma")` roda em paralelo no topo; ela inclui `evaluateAll()` — o mapa ficou mais pesado.
- O dev server da 3000 (que já estava rodando, PID 12224) travou com 3,5 GB depois de várias capturas seguidas.
  Não foi derrubado: não era desta sessão.

## Verificação

- Local, antes do travamento: painel a 1440/768/360 sem estouro horizontal, console limpo, cabeçalhos em ordem.
- Gates de information-design 32/32 depois dos consertos: G8 (impressões ao lado do CTR), G3 (hora da
  apuração), G24 (altura mínima no estado de erro), G25 (crawl atrasado marcado). G26 passa pelo salto
  tipográfico (21px contra 15px), não pela área. G20/G21: o hub não tem tema escuro; nenhuma cor nova.
- **Produção, 21/09 14:59 BRT:** painel no ar a 1440/768/360, sem estouro, console limpo. Mapa responde em ~8 s,
  o mesmo de antes (a `dadosDaFicha` em paralelo não somou). Números no mesmo dia: cadeia 55 → 22 → 7 → 0 igual
  em `/okr/atma` (SC-004); em aberto **R$ 10.907,98**, perdido R$ 16.231,85 e ticket R$ 3.877,12, iguais à conta
  no banco (SC-006); "faltam 153 cliques" igual a `/okr/atma/aquisicao` (SC-003).
- **Não verificado em imagem:** o frame de `erro na fonte` do nível 1 (o dev server travou antes, e produção
  não falha sob demanda).

## Próximos passos

1. Contar a ação semanal quando existir fonte (Q2 fica aberta para uma feature futura).
2. Refazer o inventário quando "use aligner" começar a ser buscado (ver `marca.termos`).
