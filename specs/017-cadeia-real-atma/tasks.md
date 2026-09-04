# Tasks: A cadeia da `atma` é a que o app da Atma escreve

**Branch**: `017-cadeia-real-atma` · **Plan**: `plan.md`

## US1 + US2 — a cadeia certa e o `contatado` apurado (P1, mesmo commit)

- [ ] **T001** `lib/okr.mjs`: reescrever `PERFIS.D.marcos` para `visitante → novo → contatado → pre_orcamento → exames_enviados → convertido` (FR-001). `fonte` de cada degrau apontando `Atma/Site/admin/src/lib/funil.ts`.
- [ ] **T002** `lib/okr.mjs`: remover o marco `aceito`, a constante `STATUS_ACEITE` e a chave `aceitos` de `celulasDeOrcamento()` (FR-002). Re-cobrir `PERFIS.D.fatores` para os spans que passam a existir.
- [ ] **T003** `lib/okr-coleta.ts`: `status` na query de `patient_leads` (mesma query, coluna a mais) e `contatados = status <> 'novo'` (FR-003, D2).
- [ ] **T004** `lib/okr.mjs`: marco `contatado` com `coletor: "contatados"`, `familia: "D3"`, e `fonte` citando **quem declarou e quando** — "regra declarada por Jean em 04/09/2026: todo cancelado foi contatado" (FR-004).
- [ ] **T005** `lib/benchmark.mjs`: re-chavear `REGUA.D` conforme D4 — `visitante→novo`, `novo→contatado`, `exames_enviados→convertido` (a antiga `orcamento→aceito`, mesma faixa e mesma fonte, `nota` explicando o remapeamento). Sem linha para `contatado→pre_orcamento` e `pre_orcamento→exames_enviados` (FR-005).
- [ ] **T006** `test/cadeia-atma.test.mjs` + registro no `package.json` (Princípio II): ordem dos marcos, `aceito` inexistente, `contatado` com 43 de 43, lead em `novo` **não** contando, cancelado contando, e o teste de espelho contra o `funil.ts` da Atma que **pula** se o repo não estiver ao lado (D1).
- [ ] **T007** Atualizar `test/okr.test.mjs`, `test/benchmark.test.mjs`, `test/ficha.test.mjs` e `test/arvore-metas.test.mjs` para a cadeia nova. Nenhum teste é apagado para "passar".

## US3 — o zero que é medido (P2)

- [ ] **T008** `lib/okr.mjs`: `pre_orcamento` conta pela tabela `orcamentos` (D3); `exames_enviados` e `convertido` contam por `patient_leads.status`, com a declaração do Jean na `fonte`.
- [ ] **T009** `lib/okr.mjs` + `app/okr/[slug]/page.tsx`: contagem de órfãs (`orcamentos` sem `paciente_lead_id`) exibida quando > 0 (FR-006). Hoje: 2 de 7.
- [ ] **T010** Teste: `apurado(0)` chega ao `divisorDe()` e é recusado pela FR-003 da 016; a árvore para com motivo `pré-orçamento → exames enviados: 0 de 7` (SC-003).

## US4 — CTR × posição, com a D7 revogada (P3)

- [ ] **T011** `lib/benchmark.mjs`: `CTR_POR_POSICAO` — faixa e fonte **por linha**, nunca ponto (FR-007).
- [ ] **T012** `lib/arvore-metas.mjs`: `alavancaDePosicao()` devolve faixa de posição além do CTR necessário (FR-008), e o render na `page.tsx`.
- [ ] **T013** Teste: a tabela nunca aparece como divisor de camada; o teste "duas faixas DEVEM falhar" da 016 continua verde (FR-009).

## Pendente de decisão do Jean

- [ ] **T014** Algum lead hoje em `cancelado` chegou a mandar exames antes de cancelar?
  - **Não** → `exames_enviados = apurado(0)`, e o gargalo `pré-orçamento → exames enviados` está **provado**.
  - **Sim** → `exames_enviados = não apurado`, porque a posição atual apaga a passagem e não há log de evento. A árvore para uma camada acima e o motivo muda de "0 de 7" para "sem log de transição".
  - Só T008 e T010 dependem disso. T001-T007 e T011-T013 seguem sem a resposta.

## Portões

- [ ] `npm test` verde (suíte inteira).
- [ ] `test/cadeia-atma.test.mjs` na lista do `package.json`.
- [ ] `lib/projecao.mjs` sem diff (FR-010).
- [ ] `grep -rn "aceito\|tratamento" lib/` sem nenhuma ocorrência como chave de degrau (SC-001).
- [ ] `/okr/atma` em produção mostra `contato feito — 43` apurado (SC-002).
- [ ] Push fora de 23:30-01:00 e 08:00-08:45 BRT (Princípio IV).
