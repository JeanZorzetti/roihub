# Research: 051 — o mapa como árvore de causa e efeito

## R1. Onde a classe mora

- **Decision**: campos `classe` e `acaoSemanal` dentro de cada entrada do `CATALOGO` (`lib/gsc-delta.mjs`).
- **Rationale**: o `CATALOGO` é a lista única das 32 folhas; o board foi reconstruído três vezes porque cada
  tentativa escrevia a própria lista. Um mapa `CLASSE` ao lado seria a segunda lista.
- **Alternatives considered**: mapa separado como `MEDIDO_POR` — rejeitado: `MEDIDO_POR` existe porque o
  coletor é da borda; a classe é natureza da folha, como `balizador`.

## R2. Como o mapa mostra a cadeia sem uma segunda conta

- **Decision**: `dadosDaFicha("atma")` + `CadeiaDiagrama` (`app/okr/[slug]/celulas.tsx`), disparada no topo
  da página e aguardada no fim.
- **Rationale**: `dadosDaFicha()` nasceu para três telas não divergirem ("duas cópias divergiriam na primeira
  mudança de veredito"). O mapa vira a quarta consumidora. Mesmo componente = mesmo desenho, mesmas taxas.
- **Alternatives considered**: caminho leve (`coletarDoProjeto` + `montarFicha` direto) — rejeitado: é a
  segunda composição que a própria `ficha-dados.ts` proíbe. Custo aceito: ~3,3 s a frio, em paralelo.

## R3. Granularidade da fila

- **Decision**: em **cliques**, um item por URL decidida abaixo da régua (`conformidadeDeCtr().abaixo`), com
  `cliquesNaoCapturados()`. Em **pp**, um item para a largura de título (títulos acima de 580px). As 6 faixas
  de posição ficam fora e a fila diz por quê: contam os mesmos cliques por outro corte.
- **Rationale**: "o que fazer primeiro" é uma página, não uma folha. `linha()` + `ordenar()` já garantem
  moeda obrigatória e nenhuma ordenação entre moedas; nenhuma função de soma é criada.
- **Alternatives considered**: um item por folha somando URLs — rejeitado: esconde qual página mexer e cria
  um total, que a `ordenar()` foi escrita para não ter.

## R4. Como distinguir "soma" de "hipótese"

- **Decision**: etiqueta `soma` em dois nós (as faixas de "Posição no Google" e "Depois do clique"); a classe
  das alavancas e higienes diz `hipótese`/`limiar`; uma legenda em texto no painel.
- **Rationale**: o Mind Elixir não tem rótulo por aresta, e cor não pode ser o único portador. Etiqueta a lib
  desenha ao lado do rótulo; nota exige clique.
- **Alternatives considered**: estilo de aresta por nó (`branchColor`) — rejeitado: cor sozinha.

## R5. O "último orçamento" de uma pessoa

- **Decision**: ordenação estável por `criado`; vale a última linha. Empate no dia (a fonte grava a data sem
  hora) mantém a ordem da fonte, que já vem por `criado_em` — o orçamento das 10:35 vence o das 10:31.
- **Rationale**: é o que o operador enviou por último. Revisão substitui; alternativa (simples × moderado)
  também: o paciente fecha UM tratamento.
- **Alternatives considered**: maior valor por pessoa — rejeitado pelo dono (Q1: A).

## R6. Ação semanal contada

- **Decision**: não contada (Q2: A). O nó nomeia a ação; contar exige fonte que o hub não tem.
