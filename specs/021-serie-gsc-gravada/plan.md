# Implementation Plan: Série do GSC gravada e os sete KPIs de busca do board

**Branch**: `021-serie-gsc-gravada` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-serie-gsc-gravada/spec.md`

## Summary

Duas entregas independentes que compartilham a mesma fonte:

1. **Persistência** (US1) — uma tabela `hub_gsc_dia` e uma corrida diária que grava impressões,
   cliques, CTR e posição por projeto e por dia. Reusa o padrão já em produção do estado noturno:
   cron do Actions dispara um endpoint autenticado, o trabalho acontece no servidor, a escrita é
   idempotente por `ON CONFLICT DO UPDATE`. Não produz nenhum KPI no dia do merge; produz o
   histórico sem o qual os KPIs de crescimento do board nunca existirão.
2. **Cálculo** (US2–US5) — `lib/kpis-busca.mjs`, módulo puro que recebe as linhas de
   `query`+`page` já buscadas e devolve os sete KPIs. A aba `/okr/[slug]/aquisicao` passa a
   renderizá-los ao lado dos dois totais que já mostra.

As duas não se bloqueiam: os sete KPIs saem da leitura ao vivo, não da tabela. A tabela existe
para o que vem depois desta spec.

## Technical Context

**Language/Version**: TypeScript + JavaScript (ESM), Node 22

**Primary Dependencies**: Next.js 16 (App Router), React 19, `pg`, `google-auth-library`.
Nenhuma dependência nova.

**Storage**: Postgres. Uma tabela nova (`hub_gsc_dia`), criada no `ensure()` de `lib/db.ts`
como todas as outras.

**Testing**: `node --test` sobre `test/*.test.mjs`, registrado à mão em `package.json`
(Princípio II).

**Target Platform**: Linux/Alpine em Docker no EasyPanel; dev em Windows.

**Project Type**: Aplicação web única (App Router + `lib/`), sem separação front/back.

**Performance Goals**: a corrida diária percorre os projetos com propriedade no GSC, uma
chamada por projeto. Ordem de grandeza: segundos, não minutos — muito abaixo dos ~2 min medidos
da corrida noturna.

**Constraints**: `rowLimit: 25000` é o teto da API por chamada. O GSC fecha o dia com ~3 dias de
atraso. A dimensão `query` omite consultas raras, o que torna toda contagem de consultas um piso.

**Scale/Scope**: os mesmos projetos que `listProjects()` já devolve com `url` — hoje na ordem de
algumas dezenas, dos quais um subconjunto tem propriedade no GSC.

## Constitution Check

*GATE: revisto contra `.specify/memory/constitution.md`.*

| Princípio | Como esta feature cumpre |
|---|---|
| **I. Contrato único de dados** | A corrida e a aba leem projetos por `listProjects()`. Nenhum import de `data/projects.json`. |
| **II. `node --test` registrado à mão** | `test/kpis-busca.test.mjs` novo, adicionado à lista de `package.json` **no mesmo commit**. `test/validade.test.mjs` reprova se esquecermos. |
| **III. `.mjs` puro, `.ts` só na borda** | Todos os sete cálculos nascem em `lib/kpis-busca.mjs`, sem `pg`, sem `fetch`, sem `process.env`. A borda `.ts` (rota e página) só busca linhas e passa. |
| **IV. Push é deploy** | Workflow novo em **05:17 BRT (`17 8 * * *` UTC)**, fora das duas janelas proibidas. `maxDuration` da rota nova é dela própria e não altera a de `/api/estado`, então o proxy do EasyPanel não muda. |
| **V. Ambiente explícito, segredo nunca em log** | A rota valida `DATABASE_URL` e `GOOGLE_SERVICE_ACCOUNT_JSON` na entrada e devolve `503` com **apenas os nomes** ausentes. Reusa o `CRON_SECRET` que o middleware já conhece; nenhum segredo em resposta ou log. |

Sem violações. A tabela de Complexity Tracking fica vazia de propósito.

## Decisões técnicas

Detalhe e alternativas rejeitadas em [research.md](./research.md). Em resumo:

- **A janela dos KPIs é `descoberta()`, não a de `gscQueryPages`.** Aquela função tem a janela
  hardcoded em D-31→D-3 e faz uma **segunda** chamada para uma janela anterior que nenhum dos
  sete KPIs usa. Um dia de divergência entre o número de cima da aba e a lista de baixo é
  exatamente a classe de erro que a 019 já pagou. `queryPageWindow` passa a ser exportada e é
  chamada uma vez, com `descoberta()`.
- **Corrida própria, não pendurada no estado noturno.** O Princípio IV encarece qualquer mudança
  naquela rota, e uma falha do GSC não pode derrubar o card noturno.
- **A tabela guarda o dia, não a consulta.** Persistir `query`+`page` diariamente seria dezenas
  de milhares de linhas/dia para responder perguntas que esta spec não faz.

## Project Structure

### Documentation (this feature)

```text
specs/021-serie-gsc-gravada/
├── spec.md              # aprovado 07/09/2026
├── plan.md              # este arquivo
├── research.md          # decisões e alternativas rejeitadas
├── data-model.md        # hub_gsc_dia e as formas em memória
└── tasks.md             # próximo passo
```

### Source Code (repository root)

```text
lib/
├── kpis-busca.mjs        # NOVO — os sete cálculos, puros
├── gsc.ts                # exporta queryPageWindow (hoje interna)
├── db.ts                 # + hub_gsc_dia no ensure(), + gravarDiasGsc(), + lerDiasGsc()
└── janelas.mjs           # sem alteração — descoberta() é a janela

app/
├── api/gsc-serie/route.ts          # NOVO — a corrida diária
└── okr/[slug]/aquisicao/page.tsx   # renderiza os sete KPIs

test/
└── kpis-busca.test.mjs   # NOVO — registrado em package.json no mesmo commit

.github/workflows/
└── serie-gsc.yml         # NOVO — cron 17 8 * * * (05:17 BRT)

middleware.ts             # isenta /api/gsc-serie como já isenta /api/estado
```

**Structure Decision**: a estrutura existente do repo, sem camada nova. A única regra de
posicionamento que importa é o Princípio III: cálculo em `lib/*.mjs`, borda em `.ts`.

## Complexity Tracking

Sem violações da constituição a justificar.
