# Implementation Plan: Responsável por tarefa na Agenda

**Branch**: `005-agenda-responsavel` | **Date**: 2026-08-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-agenda-responsavel/spec.md`

## Summary

Adicionar um campo `responsavel` (`jean` | `maria` | nenhum) às tarefas da agenda, replicando exatamente o padrão já usado pelo campo `tipo` (balde): coluna nova em `hub_tasks`, seletor no formulário de criar/editar, filtro dropdown na barra de filtros existente e chip de filtro ativo. Ações do ranking (sem linha no banco) não recebem responsável.

## Technical Context

**Language/Version**: TypeScript / Next.js 16 (App Router), Node

**Primary Dependencies**: `pg` (Postgres direto, sem ORM) via `lib/db.ts`; helpers puros em `lib/agenda.mjs`

**Storage**: Postgres (`hub_tasks`) — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, mesmo padrão de `tipo`

**Testing**: Sem framework de teste no projeto para esta área; validação manual via `npm run dev` + checklist de aceitação da spec

**Target Platform**: Web (Next.js server components + server actions), deploy atual do roihub

**Project Type**: Web app single-project (Next.js) — sem frontend/backend separados

**Performance Goals**: N/A (CRUD simples, sem volume relevante)

**Constraints**: Não pode quebrar tarefas existentes (responsável ausente = `NULL`, continua visível para os dois); não pode alterar a estrutura dos 3 baldes nem a URL dos filtros já existentes

**Scale/Scope**: 2 responsáveis fixos (Jean, Maria); ~5 arquivos alterados

## Constitution Check

`.specify/memory/constitution.md` ainda é o template não preenchido do projeto (sem princípios reais definidos) — nenhum gate aplicável.

## Project Structure

### Documentation (this feature)

```text
specs/005-agenda-responsavel/
├── plan.md              # este arquivo
├── spec.md              # requisitos
├── tasks.md             # lista de tarefas (/speckit-tasks)
└── checklists/
    └── requirements.md  # checklist de qualidade da spec
```

Sem `research.md`, `data-model.md` ou `contracts/`: a mudança de dado é uma coluna nova (documentada abaixo) e não há endpoint/contrato externo — replicar essas seções seria burocracia sem conteúdo novo para uma feature deste tamanho.

### Source Code (repository root)

```text
lib/
├── db.ts            # Task type, CREATE/ALTER TABLE hub_tasks, insertTask/updateTask/listTasks
└── agenda.mjs        # constantes RESPONSAVEIS + lerFiltros/filtrosAtivos/comFiltro/filtrar

app/agenda/
├── page.tsx          # formulário "Nova tarefa", barra de filtros, chip ativo, exibição do responsável no card
├── actions.ts         # taskFields() lê o campo `responsavel` do FormData
└── edit-task.tsx      # seletor de responsável no modal de edição
```

**Structure Decision**: Segue a estrutura já existente do roihub (Next.js App Router + `lib/`); nenhum diretório novo é necessário.

### Data Model (inline — dispensa data-model.md separado)

- **`hub_tasks.responsavel`**: `TEXT NULL`, valores válidos `'jean' | 'maria'` (validado na aplicação, como já é feito hoje com `tipo`/`TIPO_IDS`). `NULL` = sem responsável definido.
- **`Task` (lib/db.ts)**: ganha `responsavel: string | null`.
- **`RESPONSAVEIS` (lib/agenda.mjs)**: nova constante `[{id:"jean", label:"Jean Zorzetti"}, {id:"maria", label:"Maria Zorzetti"}]`, no mesmo formato de `ORIGENS`/`URGENCIAS`.

## Complexity Tracking

Sem violações de constitution a justificar (constitution ainda é template vazio).
