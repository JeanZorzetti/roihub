# Contract: o que cada bloco mostra, e em que estado

## `/gsc/mapa` — painel novo, acima do mapa

Pergunta do painel: **"Onde o trabalho de busca da Atma rende mais, e ele chega ao dinheiro?"**

| Nível | Bloco | Mostra | Estados |
|---|---|---|---|
| 1 | Depois do clique | `CadeiaDiagrama` com os degraus de `/okr/atma`, a janela da época e o veredito ("trava em …") | com dado · `erro na fonte` (falha de `dadosDaFicha`) · `sem cadeia` (perfil sem marcos) |
| 1 | — | cliques do mapa na janela de 28 dias, ao lado, **sem taxa** e com a frase das janelas diferentes | com dado · `sem leitura do Search Console` |
| 2 | Primeiro na fila | `porMoeda.cliques` (URL, faltam N cliques, CTR × régua, posição) e `porMoeda.pp` | com itens · `nada abaixo da régua nesta janela` |
| 2 | Fora da fila | contagem por motivo + a sobreposição das faixas | sempre |
| 3 | Como ler | legenda de `soma`/`hipótese` e as três classes com a contagem computada | sempre |

Proibido: total em qualquer moeda; taxa cliques→leads; valor em reais; número digitado à mão.

## `/gsc/mapa` — etiquetas das folhas (lista e mapa)

Ordem: `[procedência (◆/◇), classe, divergência?]`. `checklistGsc` não tem classe.

| Classe | Etiqueta | Linha acrescentada à nota |
|---|---|---|
| resultado | `resultado` | é reação do Google, com atraso; mede, não se move direto |
| alavanca | `alavanca · <ação semanal>` | a equipe move com a ação; efeito no clique é hipótese não testada |
| higiene | `higiene · limiar` | abaixo do limiar atrapalha; passado ele, não se espera ganho |

Nós com `soma`: as faixas de "Posição no Google" e "Depois do clique".

## `/okr/atma` — valor em risco e ticket

- **Enviado**: soma de documentos, rotulado como tal ("N orçamentos, revisões incluídas").
- **Em aberto / perdido**: por pessoa, pelo último orçamento.
- **Ticket**: média do último orçamento de cada pessoa, com `pessoas` e `docs` no rótulo.
