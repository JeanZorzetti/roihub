---
description: "Task list for feature implementation"
---

# Tasks: Ranking Ponderado de Projetos na Página SEO

**Input**: Design documents from `/specs/004-seo-weighted-ranking/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/seo-score.md](./contracts/seo-score.md), [quickstart.md](./quickstart.md)

**Tests**: Incluídos — o projeto já segue TDD com `node:test` para módulos `.mjs` puros (`test/score.test.mjs`, `test/series.test.mjs`), e a lógica de score é isolada exatamente para viabilizar isso.

**Organization**: Tarefas agrupadas por user story do spec.md, em ordem de prioridade (P1 → P2 → P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa incompleta)
- **[Story]**: US1/US2/US3, mapeando para o spec.md
- Caminhos de arquivo são absolutos à raiz do repo `roihub`

## Phase 1: Setup

Não aplicável — feature reaproveita o projeto Next.js existente, sem novas dependências, sem novo tooling de lint/format. Segue direto para o Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: A lógica de score é compartilhada pelas 3 user stories (US1 ordena por ela, US2 destaca por ela, US3 exibe seus componentes) — nenhuma story pode ser implementada sem ela existir primeiro.

**⚠️ CRITICAL**: Nenhuma user story começa antes desta fase estar completa.

- [X] T001 Escrever os testes de `lib/seo-score.mjs` em `test/seo-score.test.mjs` (ainda sem implementação — devem FALHAR), cobrindo os cenários listados em `quickstart.md` §1: ordenação cliques>impressões, CTR alto vencendo posição melhor, determinismo independente da ordem de entrada, `ctr`/`position` nulos tratados como pior valor sem erro, desempate por cliques brutos depois por nome, e conjunto de um único projeto sem divisão por zero (regra 3 de `data-model.md`)
- [X] T002 Implementar `lib/seo-score.mjs` (`WEIGHTS` + `rankBySeoScore`) conforme `contracts/seo-score.md`, seguindo o padrão de `lib/score.mjs` (JS puro + JSDoc, sem import de React/Next), até os testes de T001 passarem (depende de T001)
- [X] T003 [P] Adicionar `test/seo-score.test.mjs` à lista explícita do script `"test"` em `package.json` (o projeto não usa glob automático — conferir os demais arquivos `test/*.test.mjs` já listados como referência de formato)
- [X] T004 Rodar `npm test` e confirmar que `test/seo-score.test.mjs` passa e nenhum teste existente quebrou (depende de T002, T003)

**Checkpoint**: `lib/seo-score.mjs` pronto e testado isoladamente — as user stories podem começar.

---

## Phase 3: User Story 1 - Ver os projetos que realmente performam primeiro (Priority: P1) 🎯 MVP

**Goal**: A página `/seo` ordena os cards pelo score composto (cliques 40% / CTR 30% / posição 20% / impressões 10%), não mais por impressões brutas.

**Independent Test**: Abrir `/seo`, comparar a ordem dos 2-3 primeiros cards com um cálculo manual do score — sem nenhuma mudança visual além da ordem.

### Implementation for User Story 1

- [X] T005 [US1] Em `app/seo/page.tsx`, substituir a linha `rows.sort((a, b) => (b.t?.current.impressions ?? -1) - (a.t?.current.impressions ?? -1));` (linha 31) pelo fluxo do snippet de consumo em `contracts/seo-score.md`: separar `withData`/`withoutData` por `r.t !== null`, mapear `withData` para `SeoScoreInput`, chamar `rankBySeoScore`, reordenar `withData` pelo `rank` retornado, e concatenar `withoutData` (SEED) sempre ao final — depende de T002

**Checkpoint**: US1 completa e testável de forma independente — a ordenação já reflete o score composto, mesmo sem nenhum elemento visual novo ainda.

---

## Phase 4: User Story 2 - Perceber a diferença de importância sem ler números (Priority: P2)

**Goal**: Os cards dos projetos mais bem colocados têm um badge de posição (#1, #2, #3...) e acento visual (`--accent`), perceptível em uma varredura rápida, sem alterar o tamanho do card nem o grid uniforme.

**Independent Test**: Com os olhos semicerrados, apontar o card de melhor score em menos de 2 segundos, incluindo em largura mobile; projetos SEED nunca aparecem com badge/acento.

### Implementation for User Story 2

- [X] T006 [P] [US2] Adicionar em `app/globals.css` as regras de badge de posição e acento de destaque (ex.: `.seo-rank-badge`, `.seo-card--top`), reaproveitando os tokens já existentes (`--accent`, `--grid`, `--muted`) — sem criar cor nova, conforme decisão em `research.md`
- [X] T007 [US2] Em `app/seo/page.tsx`, renderizar o badge de posição em cada card com dado GSC usando o `rank` retornado por `rankBySeoScore`, e aplicar a classe de acento aos melhores colocados; cards `SEED` nunca recebem badge nem acento — depende de T005, T006

**Checkpoint**: US1 + US2 funcionando juntas — ranking correto e visualmente hierarquizado.

---

## Phase 5: User Story 3 - Entender por que um projeto está numa posição (Priority: P3)

**Goal**: O score composto (ou seus 4 componentes) fica visível em qualquer card com dado GSC, sem precisar abrir o código-fonte.

**Independent Test**: Para qualquer projeto com dado, localizar na tela (texto direto ou hover/tooltip) o score final e/ou as métricas que o formaram.

### Implementation for User Story 3

- [X] T008 [US3] Em `app/seo/page.tsx`, exibir o `score` (e opcionalmente os `components`) de cada card com dado GSC reaproveitando o padrão visual `.score-cell`/`.score-num`/`.score-track`/`.score-fill` já definido em `app/globals.css:175-178` (mesmo usado no ranking da home em `app/page.tsx`) — depende de T005

**Checkpoint**: Todas as 3 user stories funcionando de forma independente e combinada.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T009 Atualizar o parágrafo de rodapé (`<p className="foot">`) em `app/seo/page.tsx` para mencionar em uma frase o novo critério de ordenação por score composto, mantendo o tom técnico-conciso já existente no texto
- [X] T010 Rodar a checklist completa de `quickstart.md` (§1 `node --test`, §2 manual no navegador incluindo mobile e reload, §3 `npm test`) e confirmar todos os itens antes de considerar a feature pronta

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: sem dependências externas — bloqueia todas as user stories
- **US1 (Phase 3)**: depende de Foundational (T002)
- **US2 (Phase 4)**: depende de Foundational (T002) e de US1 (T005, porque o badge/acento usa o `rank` já calculado na ordenação)
- **US3 (Phase 5)**: depende de Foundational (T002) e de US1 (T005); independente de US2 (pode ser feita antes ou depois de US2)
- **Polish (Phase 6)**: depende de todas as stories desejadas estarem completas

### Parallel Opportunities

- T001 (testes) e depois T003 (package.json) podem ser feitas em paralelo com a implementação de T002, desde que T001 exista antes de T002 começar (TDD: teste primeiro, falhando)
- T006 (CSS) é `[P]` — arquivo diferente de T005/T007, pode ser feito enquanto T005 está em andamento
- T008 (US3) pode ser feito em paralelo com T006/T007 (US2) já que ambos dependem só de T005, não um do outro — mas como ambos editam `app/seo/page.tsx`, coordenar para evitar conflito de merge se feito por pessoas diferentes

---

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Phase 2 (Foundational) — `lib/seo-score.mjs` testado
2. Completar Phase 3 (US1) — ordenação corrigida
3. **PARAR e VALIDAR**: comparar ordem na página com cálculo manual (quickstart.md §2, primeiro item)
4. Isso já corrige o problema central do pedido (ordenação por impressões brutas) mesmo sem nenhum elemento visual novo

### Incremental Delivery

1. Foundational → US1 (MVP: ordem corrigida)
2. + US2 (hierarquia visual perceptível)
3. + US3 (transparência do score)
4. + Polish (rodapé + validação final)
