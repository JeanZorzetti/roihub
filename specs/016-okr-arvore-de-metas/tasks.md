# Tasks: Árvore de metas

**Branch**: `016-okr-arvore-de-metas` · **Plan**: `plan.md`

## US1 + US2 — o motor e as travas (P1, mesmo commit)

- [x] **T001** `lib/arvore-metas.mjs`: `divisorDe(marcos, i, perfil, bandaAberta)` — ordem apurado → ponte → faixa (FR-002), recusa de divisor `0` nas três origens (FR-003, D3), recusa da segunda faixa (FR-004).
- [x] **T002** `lib/benchmark.mjs`: `faixaDoSpan(perfil, chaveDe, chavePara)` — lookup exato do span na `REGUA`, sem casar por aproximação. Não altera `leituraDoDegrau()`.
- [x] **T003** `lib/arvore-metas.mjs`: `montarArvore({ficha, projecao, perfil, ctr})` — descida do fim para o começo, banda degenerada que abre uma vez (D4), parada com degrau e motivo (FR-016).
- [x] **T004** `test/arvore-metas.test.mjs` + registro no `package.json` (Princípio II): ordem do divisor, ponte nomeando os degraus atravessados, recusa do zero, **duas faixas DEVEM falhar**, banda propagada, parada com motivo, gap idêntico entre camadas.
- [x] **T005** `app/okr/[slug]/page.tsx`: bloco "Árvore de metas" entre `Quanto falta` e `N0` — origem do divisor ao lado de todo número (SC-008).

## US3 — entrega em páginas/semana (P2)

- [x] **T006** `lib/gsc.ts`: `gscPaginas(url, {inicio, fim})` — dimensão `page`, mesma auth (D6).
- [x] **T007** `lib/okr-coleta.ts`: `gscPaginas()` no `Promise.all` existente; devolve `paginas`.
- [x] **T008** `lib/arvore-metas.mjs`: `camadaDeEntrega()` — páginas necessárias e ritmo semanal, `não apurada` com menos de 3 páginas (FR-010).
- [x] **T009** Teste da guarda de amostra mínima + render na página.

## US4 — alavanca de posição (P3)

- [ ] ~~**T010**~~ `CTR_POR_POSICAO` — **não construída nesta spec.** A D7 recusou a curva CTR × posição por ser uma segunda faixa de mercado. Jean REVOGOU a proibição em 04/09/2026; a tabela passa para a **017** (T011).
- [x] **T011** `lib/arvore-metas.mjs`: `alavancaDePosicao()` — leitura paralela, fora da conta (D7). Devolve o CTR necessário; a tradução para posição fica na 017.

## Resolvido pela 017

- [ ] ~~**T012** (D2) `REGUA.D["orcamento→tratamento"]`~~ — **a pergunta estava errada.** Jean
  declarou em 04/09/2026 que a cadeia da Atma é `novo → contatado → pre_orcamento →
  exames_enviados → convertido | cancelado`, e que **não existe degrau de "aceite"**. O span que
  esta task queria criar cobria um vão inventado por esta spec. A régua não precisa de linha nova:
  precisa que as chaves apontem para os degraus reais. Ver `specs/017-cadeia-real-atma/`.

## Portões

- [x] `npm test` verde (suíte inteira).
- [x] `test/arvore-metas.test.mjs` na lista do `package.json`.
- [x] `lib/okr.mjs` e `lib/projecao.mjs` sem diff (FR-014).
- [x] Push fora de 23:30-01:00 e 08:00-08:45 BRT (Princípio IV).
