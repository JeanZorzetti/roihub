# Implementation Plan: Ranking Ponderado de Projetos na Página SEO

**Branch**: `004-seo-weighted-ranking` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-seo-weighted-ranking/spec.md`

## Summary

Trocar a ordenação da página `/seo` (hoje: impressões brutas, `app/seo/page.tsx:31`) por um score composto normalizado (cliques 40%, CTR 30%, posição 20% invertida, impressões 10%), calculado por um novo módulo puro `lib/seo-score.mjs` seguindo o padrão já existente de `lib/score.mjs`. Os cards ganham um badge de posição (#1, #2...) e acento visual (`--accent`) nos melhores colocados, reaproveitando os tokens de cor já definidos em `app/globals.css`. Projetos sem dado GSC (`t === null`) ficam fora do cálculo e continuam ao final da lista com o rótulo `SEED` existente.

## Technical Context

**Language/Version**: TypeScript (Next.js App Router, React Server Components) para a página; JavaScript puro com JSDoc (`.mjs`) para a lógica de score, igual `lib/score.mjs` e `lib/series.mjs`.

**Primary Dependencies**: Nenhuma nova dependência — usa apenas Next.js/React já presentes no projeto.

**Storage**: N/A. Score recalculado a cada request (`export const dynamic = "force-dynamic"` já existe na página; dados vêm ao vivo da API do GSC via `lib/gsc.ts`, sem persistência).

**Testing**: `node --test`, seguindo o padrão de `test/score.test.mjs` / `test/series.test.mjs` — arquivos listados explicitamente no script `"test"` do `package.json` (não há glob automático; o novo arquivo de teste precisa ser adicionado à lista).

**Target Platform**: Web interno (Next.js), consumido no navegador pela aba `/seo` do roihub.

**Project Type**: Web app single-project (Next.js App Router) — sem frontend/backend separados.

**Performance Goals**: Nenhum requisito novo — cálculo é O(n) sobre ~10–35 projetos (curadoria fechada), desprezível frente ao tempo de rede da API do GSC que já domina o carregamento da página.

**Constraints**: Não alterar o modelo de dados ao vivo (`force-dynamic`, sem cache/DB); não introduzir novos tokens de cor — reutilizar `--accent`, `--grid`, `--muted` etc. já definidos em `app/globals.css`; não quebrar o grid responsivo existente (`--seo-grid` com `auto-fill, minmax(430px, 1fr)`).

**Scale/Scope**: Portfólio curado de ~35 projetos (conforme `lib/projects.ts`), subconjunto menor com GSC ativo.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

O arquivo `.specify/memory/constitution.md` deste projeto está com os placeholders originais do template (nenhum princípio foi preenchido) — não há gates de constituição aplicáveis. Nenhuma violação a registrar.

## Project Structure

### Documentation (this feature)

```text
specs/004-seo-weighted-ranking/
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Fase 0 (/speckit-plan)
├── data-model.md         # Fase 1 (/speckit-plan)
├── quickstart.md         # Fase 1 (/speckit-plan)
├── contracts/            # Fase 1 (/speckit-plan) — contrato do módulo de score
└── tasks.md              # Fase 2 (/speckit-tasks) — não criado por este comando
```

### Source Code (repository root)

```text
lib/
├── seo-score.mjs         # NOVO — normalização + score composto + desempate (padrão de lib/score.mjs)
├── score.mjs             # existente — referência de padrão (WEIGHTS + computeScore)
├── series.mjs            # existente — já fornece clicks/ctr/position/impressions por janela de 28d
├── gsc.ts                # existente — fonte dos dados GSC, sem alteração
└── projects.ts           # existente — fonte da lista de projetos, sem alteração

app/
├── seo/
│   └── page.tsx           # MODIFICADO — troca o `.sort` por lib/seo-score.mjs; adiciona badge/acento nos cards
├── globals.css            # MODIFICADO — novas regras `.seo-rank-badge` / `.seo-card--top`, reaproveitando --accent
└── viz.tsx                # possível pequeno ajuste se o score precisar de um formatter novo (ex.: fmtScore)

test/
└── seo-score.test.mjs     # NOVO — node:test, mesmo padrão de test/score.test.mjs

package.json                # MODIFICADO — adicionar test/seo-score.test.mjs à lista do script "test"
```

**Structure Decision**: Projeto único Next.js (App Router). A lógica de score é isolada em `lib/seo-score.mjs` (JS puro, sem dependência de React/Next) para ficar testável com `node:test` sem tooling extra — exatamente o padrão já estabelecido por `lib/score.mjs` e `lib/series.mjs` neste repositório. `app/seo/page.tsx` (server component) apenas consome o módulo e renderiza; nenhuma lógica de cálculo migra para o componente.

## Complexity Tracking

*Nenhuma violação de constituição a justificar — seção não aplicável.*
