# Tasks: Régua de mercado

**Spec**: `spec.md` · **Plan**: `plan.md`

- [ ] **T001** `lib/benchmark.mjs`: `REGUA` — a tabela da §3 do handoff como dado, chaveada por
      `perfil` e pelo par de `chave` dos marcos (D2). Toda linha com `media`, `elite`, `fonte`.
      Linhas sem fonte publicada simplesmente NÃO existem (FR-004/FR-005/FR-006).
- [ ] **T002** `lib/benchmark.mjs`: `leituraDoDegrau(perfil, taxa)` — pura, um degrau, devolve
      `{rotulo, razao, faixa, buraco, fonte}` ou `sem régua` / `sem par apurado` com motivo
      (FR-003/FR-004/FR-007/FR-008, D4, D5).
- [ ] **T003** `lib/benchmark.mjs`: `distanciaDoMercado(ficha)` — mapeia `ficha.taxas` por T002 e
      devolve também o `destaque` (a leitura mais informativa) para a tela (FR-001).
- [ ] **T004** `test/benchmark.test.mjs`: **trava nº 1** — nenhuma leitura carrega mais de uma
      faixa; a saída de uma leitura não é aceita como entrada de outra (FR-002, D3).
- [ ] **T005** `test/benchmark.test.mjs`: casamento de chaves — toda linha da `REGUA` aponta para
      um par de marcos que existe em `PERFIS` (D2), nos dois sentidos.
- [ ] **T006** `test/benchmark.test.mjs`: caso `atma` — `535 → 39` devolve `acima da média`,
      razão `2,0×`, fonte citada (SC-001); degrau com ponta não apurada devolve `sem par apurado`;
      `contatado→orcamento` devolve `sem régua`; `trial→cobranca` devolve `sem régua` sem modelo
      declarado; apurado `0` com denominador `>0` devolve `abaixo do piso` **com** buraco.
- [ ] **T007** `package.json`: registrar `test/benchmark.test.mjs` na lista do `npm test`
      (Princípio II — teste fora da lista nunca roda).
- [ ] **T008** `app/okr/[slug]/page.tsx`: segunda linha ao lado do veredito da §7, subordinada a
      ele, texto diagnóstico e nunca prescritivo (FR-010/FR-011).
- [ ] **T009** `handoff/okr-kpi-template.md`: nota na R6 apontando para
      `handoff/okr-regua-de-mercado.md` (FR-013).
- [ ] **T010** Verificação: `npm test` verde e `git diff --stat lib/okr.mjs` vazio (SC-003/SC-004).
