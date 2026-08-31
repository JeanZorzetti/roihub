# Implementation Plan: Sub-balde Segurança na Agenda

**Branch**: `007-agenda-sub-balde-seguranca` | **Date**: 2026-08-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-agenda-sub-balde-seguranca/spec.md`

## Summary

Adicionar um predicado puro `seguranca(titulo)` em `lib/agenda.mjs`, ortogonal ao balde de
esforço já existente (`tipoDe`). Dentro da seção Execução de `/agenda`, quando houver ao menos
um card de segurança, particionar a lista em dois grupos renderizados com subtítulo `<h3>`:
"🔒 Segurança (N)" primeiro, resto depois — cada grupo mantendo a ordenação `ordenar`/
`porUrgencia` já existente. Sem card de segurança, a tela fica idêntica a hoje. Design e
critérios de aceite já fechados com o usuário em `roihub/handoff/handoff-sub-balde-seguranca.md`
(31/08/2026).

## Technical Context

**Language/Version**: JavaScript (`.mjs`, ESM) para lógica pura; TypeScript/TSX para a página
Next.js — segue o Princípio III da constituição.

**Primary Dependencies**: Next.js (App Router) já em uso no projeto; nenhuma dependência nova.

**Storage**: N/A — nenhuma mudança de schema; o predicado é derivado em memória do título já
carregado (`hub_tasks.titulo` / `acao` de `data/projects.json`).

**Testing**: `node --test` via `test/agenda.test.mjs`, seguindo o Princípio II
(NÃO-NEGOCIÁVEL) — proibido introduzir jest/vitest.

**Target Platform**: Web (Next.js App Router, deploy Docker/EasyPanel via push em `main`).

**Project Type**: Web application (app Next.js único, sem frontend/backend separados).

**Performance Goals**: Nenhum alvo novo — o predicado é um teste de regex sobre uma string
curta (título do card), custo desprezível frente ao já existente `tipoDe`.

**Constraints**: Não alterar `porUrgencia` (comparador global dos três baldes); não criar um
quarto item em `TIPOS`; não pular nível de heading (`h2` da seção → `h3` do subgrupo).

**Scale/Scope**: Escopo único: `lib/agenda.mjs` + `app/agenda/page.tsx` + `app/globals.css` +
`test/agenda.test.mjs`. Medição de 31/08/2026: 2 cards de segurança em 61 títulos existentes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Gate | Status |
|---|---|---|
| I. Contrato único de dados | Feature não lê `data/projects.json` nem toca `lib/projects.ts` — consome os itens já montados pela página, que já passam por `listProjects()`. | ✅ PASS |
| II. Teste é `node --test`, registrado à mão | Novos testes vão em `test/agenda.test.mjs` (arquivo já registrado em `package.json`); nenhum framework novo. | ✅ PASS (verificar registro se algum teste for para arquivo novo — não é o caso aqui) |
| III. `.mjs` para lógica pura, `.ts` só na borda | `seguranca()` é lógica pura testável sem subir o Next → nasce em `lib/agenda.mjs` (`.mjs`). A partição de render fica em `app/agenda/page.tsx` (`.tsx`), que é a borda. | ✅ PASS |
| IV. Push é deploy — janela noturna intocável | Nenhum cron/rota de deploy é tocado; a regra vale só para o momento do `git push`, não para o desenvolvimento. Anotado para a fase de entrega. | ✅ PASS (observar na hora do push) |
| V. Ambiente explícito, segredo nunca em log | Feature não lê env vars nem loga segredo. | ✅ N/A |

Nenhuma violação — sem necessidade de Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/007-agenda-sub-balde-seguranca/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

Sem `contracts/`: a feature não expõe API externa nem contrato de rede novo — o único
"contrato" é a assinatura da função pura `seguranca(titulo): boolean`, documentada em
`data-model.md`.

### Source Code (repository root)

```text
roihub/
├── lib/
│   └── agenda.mjs           # + RE_SEGURANCA, export function seguranca(titulo)
├── app/
│   ├── agenda/
│   │   └── page.tsx         # Item.seguranca; itemFromTask/ação do ranking preenchem;
│   │                        # Balde particiona quando tipo.id === "execucao"
│   └── globals.css          # .ag-sub — subtítulo <h3> do grupo
└── test/
    └── agenda.test.mjs      # 5 casos novos (§6 do handoff)
```

**Structure Decision**: Projeto único (Next.js App Router). Lógica pura em `lib/agenda.mjs`
(`.mjs`, Princípio III), renderização em `app/agenda/page.tsx` (`.tsx`, borda Next), estilo em
`app/globals.css`, teste em `test/agenda.test.mjs`. Nenhum diretório novo além dos specs desta
feature.

## Complexity Tracking

*Sem violações da constituição — seção não aplicável.*
