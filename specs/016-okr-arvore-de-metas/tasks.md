# Tasks: Árvore de metas

**Branch**: `016-okr-arvore-de-metas` · **Plan**: `plan.md`

## US1 + US2 — o motor e as travas (P1, mesmo commit)

- [ ] **T001** `lib/arvore-metas.mjs`: `divisorDe(marcos, i, perfil, bandaAberta)` — ordem apurado → ponte → faixa (FR-002), recusa de divisor `0` nas três origens (FR-003, D3), recusa da segunda faixa (FR-004).
- [ ] **T002** `lib/benchmark.mjs`: `faixaDoSpan(perfil, chaveDe, chavePara)` — lookup exato do span na `REGUA`, sem casar por aproximação. Não altera `leituraDoDegrau()`.
- [ ] **T003** `lib/arvore-metas.mjs`: `montarArvore({ficha, projecao, perfil, ctr})` — descida do fim para o começo, banda degenerada que abre uma vez (D4), parada com degrau e motivo (FR-016).
- [ ] **T004** `test/arvore-metas.test.mjs` + registro no `package.json` (Princípio II): ordem do divisor, ponte nomeando os degraus atravessados, recusa do zero, **duas faixas DEVEM falhar**, banda propagada, parada com motivo, gap idêntico entre camadas.
- [ ] **T005** `app/okr/[slug]/page.tsx`: bloco "Árvore de metas" entre `Quanto falta` e `N0` — origem do divisor ao lado de todo número (SC-008).

## US3 — entrega em páginas/semana (P2)

- [ ] **T006** `lib/gsc.ts`: `gscPaginas(url, {inicio, fim})` — dimensão `page`, mesma auth (D6).
- [ ] **T007** `lib/okr-coleta.ts`: `gscPaginas()` no `Promise.all` existente; devolve `paginas`.
- [ ] **T008** `lib/arvore-metas.mjs`: `camadaDeEntrega()` — páginas necessárias e ritmo semanal, `não apurada` com menos de 3 páginas (FR-010).
- [ ] **T009** Teste da guarda de amostra mínima + render na página.

## US4 — alavanca de posição (P3)

- [ ] **T010** `lib/benchmark.mjs`: `CTR_POR_POSICAO` — faixa com fonte por linha, nunca ponto.
- [ ] **T011** `lib/arvore-metas.mjs`: `alavancaDePosicao()` — leitura paralela, fora da conta (D7). Teste: nunca aparece como divisor de camada.

## Pendente de decisão do Jean

- [ ] **T012** (D2) `REGUA.D["orcamento→tratamento"]` — `media [0.25, 0.35]`, `elite [0.7, 0.9]`, mesma fonte de `orcamento→aceito`, `nota` declarando que o span é o conflado da literatura. **Só depois do "ok" do Jean.** Sem esta linha a árvore da `atma` para na primeira camada — comportamento correto, mas o SC-002 não fecha em produção.

## Portões

- [ ] `npm test` verde (suíte inteira).
- [ ] `test/arvore-metas.test.mjs` na lista do `package.json`.
- [ ] `lib/okr.mjs` e `lib/projecao.mjs` sem diff (FR-014).
- [ ] Push fora de 23:30-01:00 e 08:00-08:45 BRT (Princípio IV).
