# Tasks: Striking Distance medido no board

**Feature**: `specs/035-striking-distance-medido` | **Date**: 2026-09-20
**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [data-model.md](./data-model.md)

`[P]` = paralelizável (arquivo diferente, sem dependência). Sem marca = sequencial.

## Phase 1 — A medida pura (US1 + US2)

- [ ] **T001** `lib/kpis-busca.mjs`: `strikingDistancePorTermo(linhas, ehMarca)` ao lado de
  `strikingDistance()`. Faixa `[4, 11)` testando o **tipo** de `posicao`, `impressoes > 0`, guarda de
  marca sobre `l.termo`. Devolve `{total, impressoes, cliques, removidas, base, cauda}`.
  `removidas: null` quando `ehMarca` não foi passado. (FR-002, FR-004, FR-005, FR-011, FR-014)

- [ ] **T002** `lib/kpis-busca.mjs`: a trava da FR-004 no topo de `strikingDistancePorTermo()` —
  lista não-vazia em que **nenhuma** linha carrega `termo` como string devolve `null`, não um
  número. Comentário citando o fato medido (347 × 344, 70 cliques da marca).

- [ ] **T003** `lib/kpis-busca.mjs`: comentário de cabeçalho da função nova explicando por que ela
  não entra em `kpisPorTermo()` — o agregador consome `query`+`page` e nenhuma linha de lá tem
  `termo`. Mesma trava editorial que `penetracaoNoTop3` já carrega (034).

- [ ] **T004** `test/kpis-busca.test.mjs`: casos da medida.
  - faixa: 4,0 entra · 10,9 entra · 11,0 fora · 3,9 fora · `posicao: null` fora · `impressoes: 0` fora
  - marca: com `ehMarca` remove e conta em `removidas` · sem `ehMarca` devolve `removidas: null`
  - `base` conta as linhas lidas, não as da faixa · `cauda` conta as de 1 impressão
  - lista vazia → `{total: 0}`, **não** `null`
  - **forma errada** (linhas com `query`, sem `termo`) → `null`, nunca um número (SC-005)

## Phase 2 — A folha no mapa (US1 + US3)

- [ ] **T005** `app/gsc/mapa/page.tsx`: `topicDoStriking()` e `noteDoStriking()`, ao lado das
  funções da penetração. Ordem da nota conforme `data-model.md` § A nota. Sem glifo de veredito.
  (FR-006, FR-007, FR-009, FR-013, FR-014)

- [ ] **T006** `app/gsc/mapa/page.tsx`: o nó `strikingDistance-medido` como **primeiro** filho da
  folha, com os cinco estados de `data-model.md`, reusando `termosGsc` já lido para a penetração —
  **nenhuma** chamada nova ao Search Console. (FR-001, FR-003, FR-008)

- [ ] **T007** [P] `lib/gsc-delta.mjs`: `MEDIDO_POR.strikingDistance` aponta para
  `strikingDistancePorTermo`, com o comentário do porquê da troca de dimensão. (FR-010)

## Phase 3 — Verificação

- [ ] **T008** `npm test` verde na suíte inteira (Princípio II). Nenhum arquivo de teste novo,
  portanto nenhuma edição em `package.json` — conferir que `test/validade.test.mjs` segue verde.

- [ ] **T009** Conferir a tela pelo [quickstart.md](./quickstart.md): mapa **e** lista sem JS, o nó
  antes da fórmula, e o número **344** (não 347, não 362). (FR-012)

- [ ] **T010** Commit + push em `main`, fora das janelas do Princípio IV. Conferir
  `hub.roilabs.com.br/gsc/mapa` duas vezes após o deploy (~15 min).

## Rastreabilidade

| FR | Tasks |
|---|---|
| FR-001 nó como primeiro filho | T006 |
| FR-002 dimensão `query` | T001, T007 |
| FR-003 zero requisição nova | T006 |
| FR-004 forma de linha não desliga a guarda | T002, T004 |
| FR-005 `removidas: 0` ≠ `null` | T001, T004 |
| FR-006 janela declarada | T005 |
| FR-007 divergência com `/okr` | T005 |
| FR-008 quatro estados, nunca `0` por ausência | T006 |
| FR-009 sem glifo de veredito | T005 |
| FR-010 `MEDIDO_POR` | T007 |
| FR-011 base | T001, T004 |
| FR-012 lista sem JS | T009 |
| FR-013 recorte do inventário na nota | T005 |
| FR-014 cauda visível | T001, T005 |
