---
description: "Task list for 051 — o mapa de GSC como árvore de causa e efeito"
---

# Tasks: O mapa de GSC como árvore de causa e efeito

**Input**: `specs/051-mapa-causa-efeito/` — plan.md, spec.md, research.md, data-model.md, contracts/mapa-e-risco.md

**Tests**: sim. A constituição (II) e o padrão das specs 034–050 exigem teste antes do código em toda regra pura.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 Linha de base: `npm test` e `npx tsc --noEmit` verdes antes de qualquer mudança (1202 testes em 21/09)

## Phase 2: User Story 1 — ver onde o mapa encontra o dinheiro (P1) 🎯 MVP

**Goal**: o mapa mostra a cadeia da Atma depois do clique, com a mesma conta de `/okr/atma`; `/okr/atma` vale
cada pessoa pelo último orçamento.

**Independent Test**: `/gsc/mapa` e `/okr/atma` no mesmo dia mostram os mesmos 4 degraus; o valor em aberto de
`/okr/atma` é a soma dos últimos orçamentos dos vivos.

- [x] T002 [P] [US1] Testes do último orçamento em `valorEmRisco()` em `test/okr.test.mjs`: 2 orçamentos do mesmo lead valem o último; empate no dia vale a última linha; `vivos + perdidos + semLead` = soma dos últimos; `enviados` continua por documento (reescrever "019/T027 caso 1" e "020/auditoria")
- [x] T003 [P] [US1] Testes do ticket por pessoa em `test/okr.test.mjs`: média do último orçamento de cada pessoa, com `docs` e `pessoas` no retorno
- [x] T004 [US1] `ultimoPorPessoa()` em `lib/okr.mjs`, usada por `valorEmRisco()` e `ticketDeOrcamentos()` (depende de T002, T003)
- [x] T005 [US1] Rótulos em `app/okr/[slug]/risco.tsx` e `lib/ficha.mjs`: enviado conta documento; aberto, perdido e ticket pelo último orçamento de cada pessoa
- [x] T006 [US1] Em `app/gsc/mapa/page.tsx`: `dadosDaFicha("atma")` disparada no topo e aguardada no fim; painel "Depois do clique" com `CadeiaDiagrama`, a janela da época, o veredito e os cliques da janela de 28 dias sem taxa; estados `erro na fonte` e `sem cadeia`
- [x] T007 [US1] Em `app/gsc/mapa/page.tsx`: nó "Depois do clique" no ramo CLIQUE com a etiqueta `soma`, e a etiqueta `soma` no nó "Posição no Google"

**Checkpoint**: US1 sozinha já entrega a ligação com o dinheiro.

## Phase 3: User Story 2 — resultado, alavanca ou higiene (P2)

**Goal**: toda folha de métrica diz a classe; alavancas nomeiam a ação semanal.

**Independent Test**: folha sem classe reprova a suíte; o mapa mostra a classe nas 31 folhas de métrica.

- [x] T008 [P] [US2] Testes em `test/gsc-delta.test.mjs`: toda folha de métrica tem classe válida; `procedimento` não tem; `acaoSemanal` existe só nas alavancas
- [x] T009 [P] [US2] Testes em `test/board-gsc.test.mjs`: etiquetas na ordem `[procedência, classe, divergência?]`; a nota traz a frase da classe; `metadata.classe`
- [x] T010 [US2] `classe` e `acaoSemanal` nas 32 entradas do `CATALOGO` e a constante `CLASSES` em `lib/gsc-delta.mjs` (depende de T008)
- [x] T011 [US2] `mapaDoBoard()` publica etiqueta, nota e metadata da classe em `lib/board-gsc.mjs` (depende de T009, T010)
- [x] T012 [US2] Legenda "Como ler" em `app/gsc/mapa/page.tsx`: `soma` × `hipótese` e as três classes com a contagem computada do catálogo

## Phase 4: User Story 3 — ver primeiro o que rende mais (P3)

**Goal**: a fila no topo, por moeda, sem total, dizendo o que ficou de fora.

**Independent Test**: com a janela de hoje, o primeiro item em cliques é o post de preço.

- [x] T013 [P] [US3] Testes de `filaDoMapa()` em `test/gsc-delta.test.mjs`: maior `delta` primeiro dentro da moeda; cliques e pp em blocos separados; nenhum total no retorno; `fora` com a contagem por motivo; a sobreposição das faixas declarada; fila vazia devolve blocos vazios, nunca erro
- [x] T014 [US3] `filaDoMapa()` em `lib/gsc-delta.mjs` sobre `linha()` e `ordenar()` (depende de T013)
- [x] T015 [US3] Blocos "Primeiro na fila" e "Fora da fila" em `app/gsc/mapa/page.tsx`, com os valores que a página já calcula (conformidade do CTR Gap, largura dos títulos, vitais)

## Phase 5: Polish

- [x] T016 CSS do painel escopado a `[data-info="gsc"]` em `app/globals.css`, reusando as classes da ficha
- [x] T017 `npm test` e `npx tsc --noEmit` verdes
- [ ] T018 `ui-verification`: 1440/768/360px, console limpo, frame de `erro na fonte`; G31 (5 segundos) e G32 (procedência) sobre as imagens
- [ ] T019 Commit e push fora das janelas; conferir a TELA duas vezes (~15 min); números do mapa × `/okr/atma` × banco no mesmo dia
- [ ] T020 Handoff em `specs/051-mapa-causa-efeito/handoff-051.md` e memória

## Dependencies & Execution Order

- T001 antes de tudo. US1 → US2 → US3 na ordem de prioridade.
- Testes (T002, T003, T008, T009, T013) antes da implementação que cobrem.
- T006, T007, T012 e T015 editam o mesmo `page.tsx`: em série.

## Parallel Opportunities

- T002 ∥ T003 (mesmo arquivo de teste, blocos independentes — escrever juntos).
- T008 ∥ T009 (arquivos diferentes).
- As regras puras de US2 e US3 (`gsc-delta.mjs`) e de US1 (`okr.mjs`) não se tocam.

## Implementation Strategy

MVP = US1 (a ligação com o dinheiro e a correção do valor por pessoa). US2 e US3 entram na mesma entrega, cada
uma testável sozinha; o painel só vai ao ar com as três e a verificação da T018.
