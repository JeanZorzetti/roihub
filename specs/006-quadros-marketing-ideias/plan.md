# Implementation Plan: Quadros de Marketing e Ideias

**Branch**: `006-quadros-marketing-ideias` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-quadros-marketing-ideias/spec.md`

## Summary

Duas abas novas no hub — **Marketing** (kanban de colunas configuráveis, com vistas de calendário e
documentação) e **Ideias** (lista em seções, no formato visual da Agenda) — sustentadas por três
tabelas `hub_pauta*` e um módulo puro `lib/pauta.mjs`.

O requisito central não é uma tela: é o **isolamento**. Nada criado nestes quadros pode alcançar a
Agenda, o ranking ou qualquer aba existente (FR-009 a FR-011). Isso torna a entrega
aditiva por construção — apenas três arquivos existentes mudam, e nenhum deles é lógica de negócio.

A decisão técnica que organiza o resto é onde ficam os bytes das imagens: como o container
**não tem volume**, disco perderia tudo a cada deploy, então os anexos vão para `BYTEA` no Postgres —
com uma política de retenção que troca crescimento-por-tempo por crescimento-por-cards-abertos.

## Technical Context

**Language/Version**: TypeScript 5.9 (Next/DB) + JavaScript ESM `.mjs` (lógica pura) · Node 22

**Primary Dependencies**: Next.js 16.2 (App Router, `output: "standalone"`), React 19.2, `pg` 8.22.
**Nenhuma dependência nova** (R-010)

**Storage**: PostgreSQL — três tabelas novas (`hub_pauta`, `hub_pauta_coluna`, `hub_pauta_anexo`)
criadas no `ensure()` de `lib/db.ts`. Imagens em `BYTEA` (R-001)

**Testing**: `node --test` com `assert/strict`, sem framework. Arquivo novo `test/pauta.test.mjs`
**tem que ser registrado à mão** na lista explícita do `package.json`

**Target Platform**: contêiner Linux/Alpine (Docker `standalone`) no EasyPanel; push em `main`
reconstrói a imagem. Dev em Windows

**Project Type**: aplicação web server-rendered — server components + server actions, sem estado de
cliente

**Performance Goals**: 2 usuários, ~35 projetos, dezenas de cards ativos. Sem paginação, sem busca em
escala, sem otimização especulativa

**Constraints**:
- Zero dependência nova · zero LLM (não divide o pool do autopublishing) · zero cron novo
- Zero client component além do modal de edição (padrão já existente na Agenda)
- Anexo: ≤ 3 MB por arquivo, ≤ 20 por card, PNG/JPEG/WebP
- Retenção: 30 dias a partir do **arquivamento**, nunca do upload
- Arquivos existentes alteráveis: **quatro** — `app/tabs.tsx`, `lib/db.ts`, `package.json` e
  `app/globals.css`. O CSS **não estava no plano original** e foi acrescentado na implementação:
  kanban e grade de calendário não têm classe reaproveitável entre as `ag-*`, e não há framework
  de CSS no repo. São **acréscimos com prefixo `q-`** no fim do arquivo, sem tocar em regra
  existente — nenhuma aba atual muda de aparência

**Scale/Scope**: 2 abas, 3 vistas, 3 tabelas, 1 route handler, ~8 server actions, 1 módulo puro

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` foi ratificado em **v1.0.0 (2026-08-29)**, depois deste plano ser
escrito. Os cinco princípios codificam as mesmas regras do [CLAUDE.md](../../CLAUDE.md) que este
gate já avaliava — o quadro abaixo passa a citar o princípio correspondente.

| Princípio | Situação | Onde |
|---|---|---|
| **I. Contrato único de dados** — nenhuma página importa `data/projects.json` direto | ✅ o `select` de projeto usa `listProjects()` | [server-actions.md](./contracts/server-actions.md) |
| **II. Teste é `node --test`, registrado à mão no `package.json`** | ✅ previsto e destacado | [quickstart.md](./quickstart.md) §1 |
| **III. `.mjs` para lógica pura, `.ts` só na borda** | ✅ `lib/pauta.mjs` puro; `.ts` só nas actions, na rota e no `db.ts` | [pauta-mjs.md](./contracts/pauta-mjs.md) |
| **IV. Push é deploy — janela noturna intocável** | ✅ registrado no fechamento; e é o fato que decide R-001 (sem volume, disco perde a cada deploy) | [quickstart.md](./quickstart.md) §8, [research.md](./research.md) R-001 |
| **V. Ambiente explícito, segredo nunca em log** | ✅ nenhum segredo novo; a rota herda o `HUB_PASS` do middleware e responde `503` sem `DATABASE_URL` | [anexos-http.md](./contracts/anexos-http.md) |
| Restrições Técnicas — comentário explica *por quê*, com o fato medido | ✅ os "por quês" estão no `research.md`, prontos para virar comentário | [research.md](./research.md) |
| Restrições Técnicas — sem linter/formatter, siga o arquivo vizinho | ✅ os vizinhos são `app/agenda/*` e `app/crm/*` | — |

**Desvio consciente de convenção — um só:**

| Convenção | Desvio | Justificativa |
|---|---|---|
| "A lista de tipos vive no `.mjs`, sem `CHECK` no banco" ([lib/db.ts:144-150](../../lib/db.ts)) | Colunas viram **tabela** (`hub_pauta_coluna`), não constante em `.mjs` | A convenção vale para enum decidido por **quem programa** (`tipo`, `responsavel`). FR-012 exige que o usuário mude colunas **sem publicar versão nova** — enum em código exigiria exatamente o deploy que a história existe para eliminar. `tipo` e `canal`, que continuam sendo decisão de código, seguem a convenção original |

**Resultado do gate: PASSA.** Nenhuma violação sem justificativa.

## Project Structure

### Documentation (this feature)

```text
specs/006-quadros-marketing-ideias/
├── plan.md                       # Este arquivo
├── spec.md                       # O quê e por quê (sem detalhe técnico, por regra do template)
├── research.md                   # Phase 0 — as 10 decisões técnicas e o que foi rejeitado
├── data-model.md                 # Phase 1 — 3 tabelas, estados, invariantes
├── quickstart.md                 # Phase 1 — roteiro de validação ponta a ponta
├── checklists/
│   └── requirements.md           # Qualidade da spec (16/16)
├── contracts/
│   ├── pauta-mjs.md              # Módulo puro (o que o node --test importa)
│   ├── server-actions.md         # Actions de card e de coluna
│   └── anexos-http.md            # A única superfície que toca bytes
└── tasks.md                      # Phase 2 — criado por /speckit-tasks, NÃO por este comando
```

### Source Code (repository root)

```text
lib/
├── pauta.mjs                     # NOVO · puro: constantes, validação, grade do mês, filtros
└── db.ts                         # ALTERADO · +3 tabelas no ensure(), +funções de acesso

app/
├── tabs.tsx                      # ALTERADO · +2 abas (o union de `active` cresce)
├── quadro.tsx                     # NOVO · componente comum dos dois quadros
├── editar-card.tsx                # NOVO · client component (modal), no molde de agenda/edit-task.tsx
├── quadro-actions.ts              # NOVO · "use server": cards, colunas, liberarVencidos
├── marketing/page.tsx             # NOVO · fino: escolhe a vista e delega
├── ideias/page.tsx                # NOVO · fino: seções empilhadas
└── api/pauta/anexo/[[...id]]/route.ts   # NOVO · única superfície de bytes

test/
└── pauta.test.mjs                # NOVO · registrar na lista do package.json

package.json                       # ALTERADO · só a lista do `npm test`
```

**Structure Decision**: componentes compartilhados moram na **raiz de `app/`**, ao lado de
`tabs.tsx` e `viz.tsx` — é o padrão que o repo já usa para código de UI que serve mais de uma rota.
As duas páginas ficam finas e delegam para `app/quadro.tsx`, o que dá URLs limpas (`/marketing`,
`/ideias`) sem duplicar a lógica de dados e filtros.

`lib/pauta.mjs` fica **puro de propósito**: é ele que o `node --test` importa sem transpilar, e é a
única forma de testar a grade do calendário e a regra de retenção sem banco e sem DOM.

Nenhum arquivo é movido. Isso importa mais do que parece: `app/automacao/action-fields.mjs` e
`publications.tsx` são lidos por **caminho literal** em `test/autopublish.test.mjs`, então mover
arquivo neste repo tem custo. Aqui só se acrescenta.

## Fatiamento por prioridade

Segue as user stories da spec. Cada fatia é entregável e testável sozinha.

| | História | Entrega | Depende de |
|---|---|---|---|
| **P1** | US1 | `lib/pauta.mjs` + tabelas + `/ideias` completo (CRUD, mover, arquivar, filtros) | — |
| **P2** | US2 | `/marketing` em kanban com as colunas semeadas | P1 |
| **P3** | US3 | Colunas editáveis: `+`, renomear, reordenar, apagar com guarda | P2 |
| **P4** | US4 | Route handler + carrossel (subir, ordenar, remover, servir) | P1 |
| **P5** | US5 | `?vista=calendario` — `gradeDoMes` + grade CSS | P2 |
| **P6** | US6 | `?vista=docs` — `tipo = 'doc'` fora do fluxo | P2 |
| **P7** | US7 | Retenção: `arquivado_em`, varredura, restaurar, contador de espaço | P4 |

**P1 é o de Ideias, não o de Marketing, de propósito**: é o quadro sem data, sem imagem e sem
calendário, então valida o modelo de card, de coluna e de filtro com a menor superfície possível.
Errar o modelo ali custa barato; errar depois de o kanban, o upload e o calendário estarem em cima
custa caro.

## Complexity Tracking

> Preenchido apenas quando o Constitution Check tem violações a justificar.

| Violação | Por que é necessária | Alternativa mais simples rejeitada porque |
|---|---|---|
| Tabela `hub_pauta_coluna` em vez de enum em `.mjs` | FR-012 exige mudar colunas sem publicar versão nova | Enum em código exigiria deploy a cada ajuste de fluxo — exatamente o atrito que a US3 existe para eliminar |
| `BYTEA` no banco em vez de arquivo em disco | O contêiner não tem volume; push em `main` reconstrói a imagem | Disco perderia todas as imagens a cada deploy, violando FR-022. Volume no EasyPanel exigiria mudança de infra que o escopo proíbe |
| Route handler em vez de server action para upload | Server action tem teto de corpo de ~1 MB, e alterar isso exigiria tocar `next.config.mjs` | Aumentar `bodySizeLimit` mexeria em arquivo fora do escopo declarado |

---

## Riscos conhecidos

| Risco | Mitigação |
|---|---|
| O teto de corpo do Route Handler em Next 16 pode não ser o assumido | Verificação explícita no [quickstart §4.4](./quickstart.md): subir 3 MB de verdade **antes** de assumir. Conserto conhecido e barato se falhar |
| Kanban vira um segundo lugar que diz "feito", ao lado da Agenda | Consciente e aceito pelo usuário na conversa de desenho. A coluna final é "Publicado", não "Feito" — vocabulário de publicação, não de tarefa |
| `test/pauta.test.mjs` esquecido na lista do `package.json` | `test/validade.test.mjs` pega nos dois sentidos; ainda assim está no roteiro como passo explícito |
| Crescimento do banco com carrosséis em PNG | Retenção (P7) troca crescimento-por-tempo por crescimento-por-cards-abertos; o contador de espaço (FR-036) mantém o custo visível |
