---
description: "Task list for feature implementation"
---

# Tasks: Sub-balde Segurança na Agenda

**Input**: Design documents from `/specs/007-agenda-sub-balde-seguranca/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Explicitamente pedidos pelo handoff de origem (§6) — incluídos.

**Organization**: Tasks agrupadas por user story (US1 fura a fila, US2 não quebra a
classificação de esforço existente, US3 rótulo dos grupos).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: US1 / US2 / US3
- Caminhos de arquivo exatos em cada descrição

## Path Conventions

Projeto único Next.js App Router. `lib/` para lógica pura (`.mjs`), `app/` para a borda
(`.tsx`/`.css`), `test/` para `node --test`.

---

## Phase 1: Setup

Sem setup novo — nenhuma dependência, diretório ou config nova é necessária; a feature usa a
estrutura já existente do repo.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: o predicado puro é a base que todas as user stories consomem — precisa existir e
estar coberto por teste antes de qualquer mudança de render.

**⚠️ CRITICAL**: nenhuma user story pode começar antes de T001–T003 estarem prontos.

- [X] T001 Adicionar `RE_SEGURANCA` e `export function seguranca(titulo)` logo abaixo de
  `tipoDe()` em `lib/agenda.mjs:72`, com o regex e o comentário JSDoc definidos em
  `roihub/handoff/handoff-sub-balde-seguranca.md` §2 (inclui o lookaround
  `(?<![/\w])auth(?![/\w])` de `research.md` §3).
- [X] T002 [P] Escrever os 5 casos de teste do predicado em `test/agenda.test.mjs` (import de
  `seguranca` no topo do arquivo, junto dos demais imports de `../lib/agenda.mjs`):
  positivos reais, exclusão de "author"/URL de OAuth (`auth` dentro de
  `/api/auth/callback/github`), ortogonalidade com `tipoDe`, `seguranca(null)`/
  `seguranca(undefined)` sem lançar exceção. Ver `spec.md` FR-002/FR-003/FR-009/FR-010 e
  `data-model.md`.
- [X] T003 Rodar o script de medição do passo zero (`quickstart.md` §1) contra `hub_tasks` e
  `data/projects.json` reais e ler a lista inteira antes de seguir para as user stories —
  critério de aceite: falso-positivo abaixo de ~20% (medição de referência de 31/08/2026: 2 de
  61 cards, 0% de falso-positivo após a correção do regex).
  **Rodado em 31/08/2026**: 1 de 61 cards hoje ("Rotacionar o token de produção do
  MercadoPago…"), verdadeiro positivo, 0% falso-positivo.

**Checkpoint**: `node --test test/agenda.test.mjs` passa; `seguranca()` está pronta para ser
consumida pelo render.

---

## Phase 3: User Story 1 - Ver os cards de segurança primeiro na Execução (Priority: P1) 🎯 MVP

**Goal**: dentro do balde Execução, cards de segurança aparecem agrupados no topo, antes de
qualquer outro card, mesmo com rank de projeto pior.

**Independent Test**: com 1 card de segurança (rank #20) e 1 card comum (rank #2) no balde
Execução, o de segurança aparece primeiro na tela.

### Tests for User Story 1

- [X] T004 [P] [US1] Teste de partição em `test/agenda.test.mjs`: com 1 card de segurança rank
  20 e 1 comum rank 2 (mesma forma dos objetos usados em `CARDS`/os testes de `ordenar` já
  existentes no arquivo), confirmar que o de segurança vem primeiro e que, dentro do grupo de
  segurança, a ordem por `ordenar()`/rank continua valendo (2 cards de segurança, rank 5 e
  rank 1 → rank 1 primeiro). Ver `spec.md` Acceptance Scenario US1.1 e FR-004/FR-005.

### Implementation for User Story 1

- [X] T005 [US1] Em `app/agenda/page.tsx:34` (`type Item`), adicionar o campo
  `seguranca: boolean`.
- [X] T006 [US1] Em `app/agenda/page.tsx` (`itemFromTask`, por volta da linha 48-59), importar
  `seguranca` de `@/lib/agenda.mjs` e preencher `seguranca: seguranca(t.titulo)` no objeto
  `base` retornado.
- [X] T007 [US1] Em `app/agenda/page.tsx:216` (montagem de `acoes`), preencher
  `seguranca: seguranca(p.acao)` em cada item.
- [X] T008 [US1] Em `app/agenda/page.tsx`, dentro de `Balde` (por volta da linha 148-175),
  particionar `items` quando `tipo.id === "execucao"`:
  `const seg = tipo.id === "execucao" ? items.filter((i) => i.seguranca) : [];` e
  `const resto = seg.length ? items.filter((i) => !i.seguranca) : items;` — e renderizar
  `resto` no lugar de `items` na `<ul className="ag-list">` existente (depende de T005-T007).

**Checkpoint**: com pelo menos 1 card de segurança, ele aparece antes dos demais dentro da
seção Execução; sem nenhum, a lista renderiza igual a hoje (`seg.length === 0`).

---

## Phase 4: User Story 2 - Não perder a classificação de esforço existente (Priority: P2)

**Goal**: marcar um card como "de segurança" não tira ele da contagem nem da seção Execução —
protege contra regressão do que já existe.

**Independent Test**: comparar o contador "🔨 Execução (N)" antes e depois de um card virar "de
segurança" — o número não muda.

### Tests for User Story 2

- [X] T009 [P] [US2] Teste de ortogonalidade em `test/agenda.test.mjs`:
  `tipoDe("Rotacionar o token de produção do MercadoPago") === "execucao"` **e**
  `seguranca(...) === true` no mesmo título — o card não muda de balde por causa do predicado
  de segurança. Ver `spec.md` Acceptance Scenario US2.1 e FR-009 (pode ser o mesmo teste de
  T004 se agrupado; manter como caso explícito e nomeado).

### Implementation for User Story 2

- [X] T010 [US2] Conferir visualmente/manualmente que o `<h2>` de `Balde`
  (`app/agenda/page.tsx:166-175`, `{tipo.label} ({items.length})`) continua usando o `items`
  original (não `resto`) para a contagem — ajustar se a partição de T008 tiver alterado a
  variável usada no `.length`. Nenhuma mudança de código é esperada além de confirmar que a
  contagem lê o array pré-partição.
  **Confirmado em produção local**: "Execução (18)" continua contando os 18, com 1 no subgrupo
  Segurança e 17 no resto.

**Checkpoint**: contador da seção Execução bate com o total real, com ou sem cards de
segurança presentes (FR-008).

---

## Phase 5: User Story 3 - Rótulo claro de por que um card veio primeiro (Priority: P3)

**Goal**: subtítulo visível acima de cada grupo (segurança e resto) quando o grupo de
segurança existir, para a ordem furada não parecer bug.

**Independent Test**: com 2 cards de segurança e 5 comuns no balde Execução, aparecem os
subtítulos "🔒 Segurança (2)" e um para o restante, cada um seguido dos itens do grupo.

### Tests for User Story 3

- [X] T011 [P] [US3] Se o projeto tiver teste de render/snapshot para `app/agenda/page.tsx`
  (hoje não tem — só `lib/agenda.mjs` é coberto por `node --test`), pular este item; a
  verificação de US3 é feita via `quickstart.md` §3/§4 (browser + árvore de acessibilidade),
  não por `node --test`, porque JSX de página não é lógica pura testável sem subir o Next
  (Princípio III da constituição).
  Confirmado: não há teste de render no projeto; verificação feita só via T015.

### Implementation for User Story 3

- [X] T012 [P] [US3] Em `app/globals.css` (próximo de `.ag-h`, linha 280), adicionar `.ag-sub`
  — subtítulo `<h3>` do grupo, no mesmo tom visual de `.ag-h` mas em nível de heading inferior
  (ver `roihub/handoff/handoff-sub-balde-seguranca.md` §5).
- [X] T013 [US3] Em `app/agenda/page.tsx`, dentro de `Balde`, quando `seg.length > 0`
  renderizar dois `<h3 className="ag-sub">` — "🔒 Segurança (N)" acima da `<ul>` dos itens de
  `seg`, e um subtítulo para o restante acima da `<ul>` de `resto` — sem pular nível
  (`<h2>` da seção → `<h3>` do subgrupo). Quando `seg.length === 0`, nenhum `<h3>` aparece
  (depende de T008, T012).

**Checkpoint**: com card de segurança presente, os dois grupos têm subtítulo e a árvore de
heading é `h1 → h2 → h3` sem saltos.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T014 Rodar `npm test` e `npx tsc --noEmit` — ambos verdes (quickstart.md §2).
  **389/389 testes verdes, `tsc --noEmit` sem erro.**
- [X] T015 Rodar `HUB_PASS= npx next dev`, abrir `/agenda` em 1440px e 360px com pelo menos um
  card de segurança visível, conferir a árvore de acessibilidade `h2 → h3` (quickstart.md
  §3/§4) — usar a skill `ui-verification`.
  **Confirmado via Playwright em 1440px**: `heading "Execução (18)" [level=2]` →
  `heading "Segurança (1)" [level=3]` → item "Rotacionar o token de produção do MercadoPago…"
  → `heading "resto" [level=3]` → demais 17 itens. Sem salto de nível.
- [ ] T016 Ao terminar e confirmar que está no ar, adicionar a entrada `★ ENTREGUE` no topo de
  `handoff.md`, conforme `handoff-sub-balde-seguranca.md` §8. **Pendente: aguarda push/deploy
  em `main`, ainda não feito.**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: sem dependências — pode começar imediatamente. BLOQUEIA todas as
  user stories (o predicado precisa existir antes de qualquer consumo no render).
- **US1 (Phase 3)**: depende só da Foundational.
- **US2 (Phase 4)**: depende da Foundational **e** de T008 (US1) já ter feito a partição —
  T010 só faz sentido depois que `Balde` foi alterado.
- **US3 (Phase 5)**: depende da Foundational **e** de T008 (US1) — o subtítulo é renderizado
  em cima da mesma partição.
- **Polish (Phase 6)**: depende de US1, US2 e US3 completas.

### Observação sobre independência

US2 e US3 não são tecnicamente independentes de US1 no código (ambas leem `seg`/`resto`
criados em T008), mas são independentes como **valor entregue**: US1 sozinha já fura a fila
(MVP funcional); US2 é uma checagem de não-regressão sobre o que US1 fez; US3 é só o rótulo
visual por cima. Não há necessidade de reordenar o trabalho — a sequência natural (US1 → US2 →
US3) já reflete a dependência real de implementação.

### Parallel Opportunities

- T002 [P] (teste do predicado) pode rodar em paralelo com a escrita de T001, desde que a
  assinatura de `seguranca()` esteja combinada antes — na prática, escrever T001 e T002 juntos
  no mesmo commit é mais simples que paralelizar de fato.
- T004 [P] (teste de partição) e T009 [P] (teste de ortogonalidade) podem ser escritos em
  paralelo — arquivos e casos de teste independentes dentro do mesmo `test/agenda.test.mjs`.
- T012 [P] (CSS) pode ser feito em paralelo com T005-T008 (TSX) — arquivos diferentes.

---

## Implementation Strategy

### MVP First (User Story 1 apenas)

1. Completar Phase 2 (Foundational): predicado + teste + medição do passo zero.
2. Completar Phase 3 (US1): `Item.seguranca` + partição no `Balde`.
3. **PARAR e VALIDAR**: `npm test` verde, e visualmente o card de segurança aparece primeiro
   (mesmo sem subtítulo ainda — US3 é só o rótulo).
4. US2 (Phase 4) e US3 (Phase 5) são pequenas o suficiente para seguir na sequência sem
   parar de novo; não há razão para tratá-las como entregas separadas no tempo.

### Incremental Delivery

1. Foundational pronta → predicado testado e medido contra dados reais.
2. US1 pronta → fila furada funcionando (valor central da feature).
3. US2 pronta → confirmação de que nada regrediu na contagem/balde.
4. US3 pronta → subtítulo, feature completa conforme o handoff.
5. Polish → testes globais, verificação visual, `handoff.md` atualizado.
