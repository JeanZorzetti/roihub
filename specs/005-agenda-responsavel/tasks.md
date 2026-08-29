# Tasks: Responsável por tarefa na Agenda

**Input**: Design documents from `specs/005-agenda-responsavel/` (spec.md, plan.md)

**Tests**: Não solicitados na spec — sem framework de teste automatizado nesta área do projeto; validação por checklist manual (ver Fase 4).

**Organization**: Tarefas agrupadas por user story da spec.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: US1 = atribuir responsável, US2 = filtrar por responsável

## Phase 1: Foundational (bloqueia as duas stories)

- [x] T001 Adicionar `ALTER TABLE hub_tasks ADD COLUMN IF NOT EXISTS responsavel TEXT` na inicialização do schema em `lib/db.ts` (mesmo bloco de `ALTER TABLE ... ADD COLUMN IF NOT EXISTS tipo`)
- [x] T002 Adicionar `responsavel: string | null` ao `type Task` em `lib/db.ts`
- [x] T003 [P] Adicionar constante `RESPONSAVEIS` (`jean`/`maria`) e `RESPONSAVEL_IDS` em `lib/agenda.mjs`, no formato de `ORIGENS`/`TIPO_IDS`

**Checkpoint**: coluna e tipos existem; nada ainda lê/escreve o campo.

---

## Phase 2: User Story 1 - Atribuir responsável a uma tarefa (P1) 🎯 MVP

**Goal**: criar e editar tarefa com um responsável (Jean, Maria ou nenhum), persistido e exibido no card.

**Independent Test**: criar tarefa escolhendo "Jean Zorzetti", recarregar `/agenda` e ver o card marcado com o responsável.

- [x] T004 [US1] Atualizar `listTasks`/`insertTask`/`updateTask` em `lib/db.ts` para incluir a coluna `responsavel` (SELECT, INSERT, UPDATE), validando contra `RESPONSAVEL_IDS` como já é feito com `tipo`
- [x] T005 [US1] Em `app/agenda/actions.ts`, `taskFields()` ler `fd.get("responsavel")` e normalizar para `"jean" | "maria" | null` (desconhecido/vazio → `null`, mesmo padrão do campo `tipo`)
- [x] T006 [US1] Em `app/agenda/page.tsx`, adicionar `<select name="responsavel">` ao formulário "Nova tarefa" (opções: — sem responsável —, Jean Zorzetti, Maria Zorzetti)
- [x] T007 [US1] Em `app/agenda/edit-task.tsx`, adicionar o mesmo seletor de responsável ao formulário de edição/modal, pré-selecionado com `task.responsavel`
- [x] T008 [US1] Em `app/agenda/page.tsx`, exibir o responsável como `<span className="pill">` no `ag-meta` de `Row` quando `item.task?.responsavel` existir (rótulo a partir de `RESPONSAVEIS`)

**Checkpoint**: US1 completa e testável isoladamente.

---

## Phase 3: User Story 2 - Filtrar a agenda por responsável (P2)

**Goal**: filtro dropdown por responsável na barra de filtros existente, com chip ativo e URL compartilhável.

**Independent Test**: com tarefas de Jean e Maria cadastradas, aplicar `?responsavel=jean` e ver só as tarefas dele + ações do ranking.

- [x] T009 [US2] Em `lib/agenda.mjs`, `lerFiltros()` ler e validar `responsavel` contra `RESPONSAVEIS` (mesmo padrão de `urgencia`/`origem`)
- [x] T010 [US2] Em `lib/agenda.mjs`, `filtrosAtivos()` incluir `"responsavel"` na lista de chaves ativas
- [x] T011 [US2] Em `lib/agenda.mjs`, `filtrar()` aplicar o filtro: passa se `!f.responsavel`, ou `item.taskId === null` (ação do ranking, sempre visível), ou `item.task?.responsavel === f.responsavel`
- [x] T012 [US2] Em `app/agenda/page.tsx`, adicionar `<select name="responsavel">` ao formulário GET de filtro (mesma linha de projeto/urgência/origem) e a entrada correspondente em `ROTULO` para o chip ativo

**Checkpoint**: US1 + US2 completas — separação por responsabilidade pronta.

---

## Phase 4: Validação manual

- [x] T013 Rodar `npm run dev`, criar 1 tarefa para Jean e 1 para Maria, confirmar exibição do responsável no card e persistência após reload
- [x] T014 Aplicar filtro por cada responsável e confirmar que ações do ranking continuam aparecendo e que o chip/URL/"limpar filtros" funcionam como nos filtros existentes

---

## Dependencies & Execution Order

- Fase 1 bloqueia as fases 2 e 3.
- T004 depende de T001-T003. T005-T008 (US1) podem seguir em paralelo entre si depois de T004, exceto T007 que depende da forma final do `<select>` decidida em T006 (mesmo markup).
- US2 (T009-T012) depende apenas da Fase 1 (usa `item.task?.responsavel`, já existente no tipo `Task`) — pode ser feita em paralelo com US1 se necessário, mas faz mais sentido depois porque sem T004-T007 não há dado real para filtrar.
- T013-T014 vêm por último, depois de tudo.
