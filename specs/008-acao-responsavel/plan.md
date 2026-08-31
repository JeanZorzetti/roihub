# Implementation Plan: Responsável pela ação do ranking

**Branch**: `008-acao-responsavel` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-acao-responsavel/spec.md`

## Summary

Cada ação do ranking passa a ter um dono — Jean ou Maria — escolhido à mão na `/agenda`. A
atribuição não cabe no `data/projects.json` (lá se edita por push, e o pedido é um seletor na
tela), então ela vira a **segunda camada de estado do banco sobre a projeção**, exatamente ao
lado do check que já existe: tabela própria, chave igual à do check (`acao:<slug>:<hash8>`),
leitura tolerante a falha, escrita por server action validada.

Quase nada é código novo. A lista `RESPONSAVEIS`, o `rotuloResp`, o `<select>` de responsável,
o chip de filtro e a mecânica de filtro-na-URL já existem — foram construídos pela spec 005 e
hoje só os quadros de Marketing/Ideias os usam. Esta feature liga esse maquinário na fila de
ações e move `rotuloResp` do `app/quadro.tsx` para `lib/agenda.mjs`, onde ele deveria estar
desde o começo (Princípio III).

## Technical Context

**Language/Version**: TypeScript / JavaScript (ESM), Node 22

**Primary Dependencies**: Next.js 16 (App Router, Server Actions), React 19, `pg`

**Storage**: Postgres `roihub_db` — tabela nova `hub_acao_dono`, criada pelo `ensure()`
auto-aditivo de `lib/db.ts` (o repo não usa migration formal, por decisão registrada)

**Testing**: `node:test` + `assert/strict`, em `test/agenda.test.mjs` (já registrado no
`package.json`)

**Target Platform**: container Docker Linux/Alpine no EasyPanel, `output: "standalone"`

**Project Type**: aplicação web single-project (Next App Router, sem separação front/back)

**Performance Goals**: nenhuma meta nova. A `/agenda` é `force-dynamic` para 1–2 usuários; a
leitura das atribuições é uma query só, na mesma `Promise.all` que já busca os checks

**Constraints**: zero client JS na aba (todo o estado é form + server action + querystring);
a página não pode cair com o banco fora; `data/projects.json` continua read-only em runtime

**Scale/Scope**: 35 projetos curados, ~30 ações com linha, 2 responsáveis, 2 telas tocadas

## Constitution Check

*GATE: avaliado antes do desenho e revalidado depois. Sem violações — Complexity Tracking
fica vazio e é removido.*

| Princípio | Situação | Como esta feature cumpre |
|---|---|---|
| **I. Contrato único de dados** | ✅ | Nenhum import novo de `data/projects.json`. A página continua lendo por `evaluateAll()` → `listProjects()`. A atribuição não é dado de projeto: é estado de execução, e entra pelo banco, não ao lado do contrato. |
| **II. `node --test` registrado à mão** | ✅ | A lógica nova é pura e cai em `lib/agenda.mjs`, coberta por `test/agenda.test.mjs`, **arquivo já registrado** no `package.json`. Nenhum arquivo de teste novo ⇒ nenhum risco de teste fora da lista. Se um arquivo novo aparecer durante a implementação, ele entra no `package.json` no mesmo commit. |
| **III. `.mjs` puro, `.ts` só na borda** | ✅ | Filtro, rótulo e montagem do item ficam em `lib/agenda.mjs`. Só tocam `.ts` a query (`lib/db.ts`), a server action e os componentes. **Ganho colateral**: `rotuloResp` hoje mora dentro de `app/quadro.tsx` (linha 64), fora de teste — desce para o `.mjs` e passa a ser coberto. |
| **IV. Push é deploy** | ✅ | Nada de cron, nada de `maxDuration`. Push fora de 23:30–01:00 e 08:00–08:45 BRT. |
| **V. Ambiente explícito, segredo nunca em log** | ✅ | Nenhuma variável nova. `dbOn()` já guarda a aba; sem `DATABASE_URL` a lista renderiza sem seletor, como já faz com o check. Nada de segredo no caminho. |

## Decisões de desenho

### D1 — Tabela nova, não coluna em tabela existente

`hub_acao_dono (key TEXT PRIMARY KEY, responsavel TEXT NOT NULL, atualizado TIMESTAMPTZ)`.

`hub_tasks.responsavel` já existe (spec 005) e **não serve**: ele é dono de *tarefa do banco*,
e a agenda não renderiza mais `hub_tasks`. Reaproveitar aquela coluna exigiria criar uma linha
de tarefa por ação — que é exatamente o caminho `promote` que a refatoração de 31/08 removeu, e
que o FR-009 proíbe reintroduzir.

`hub_done` também não serve: lá a linha só existe quando marcada, e a chave inclui `occurrence`.
Dono não é por ocorrência.

`responsavel` é `NOT NULL` de propósito: "sem responsável" é a **ausência de linha**, não uma
linha com `NULL`. Desatribuir é `DELETE`. Um estado, uma representação.

### D2 — Chave é a ação, não o projeto (decisão do Jean, 31/08)

A chave é `acao:<slug>:<hash8(acao)>`, idêntica à do check — `hash8` já existe e já é usado
pelos dois lados (`app/page.tsx:69` e `acoesDoRanking`). Consequência assumida: reescrever a
`acao` no `data/projects.json` zera o dono, e a ação reaparece na fila "sem responsável".

Isso não é efeito colateral tolerado, é a regra: ação nova é decisão nova de alocação. E é a
mesma semântica que o check já tem, então a aba passa a ter **uma** regra de identidade, não duas.

### D3 — Sem `CHECK` de responsável no banco

Mesma razão já escrita no `ensure()` para `hub_tasks.tipo` e `hub_tasks.responsavel`: a lista de
responsáveis vive em `lib/agenda.mjs`, e duplicá-la no schema daria uma migração a cada rótulo
novo. A validação é na server action, contra `RESPONSAVEL_IDS` (FR-008).

### D4 — Controle de 1 clique, não `<select>` + botão

A aba tem zero client JS por design, então um `<select>` só grava com um `submit` ao lado: dois
cliques por linha, ~60 cliques para atribuir a fila inteira na primeira passada.

O controle é um par de botões `Jean | Maria` dentro de um `<form>`, com `aria-pressed` marcando
o ativo. Um clique atribui; clicar no responsável já ativo desatribui. Zero JS, um clique, e o
estado é legível por leitor de tela sem `<label>` extra por linha.

O `<select>` continua sendo a forma certa **no filtro** da barra (lá o submit já existe e é um
só para a tela toda) — e lá ele é literalmente o mesmo componente do `app/quadro.tsx:571`.

### D5 — A home exibe, a agenda atribui

O card do ranking ganha só o rótulo do dono ao lado da `acao` (FR-005). Duas telas escrevendo o
mesmo campo é o tipo de coisa que diverge silenciosamente; e a home não tem barra de ações por
linha para receber o controle sem virar outra tela.

### D6 — Falha de banco degrada, não derruba

`listDonos()` entra na `Promise.all` que já existe, com o mesmo `.catch(() => new Map())` que o
`listDone()` usa. Sem banco, toda ação aparece "sem responsável" e sem controle — a fila continua
completa e na ordem do ranking (FR-010/SC-005).

## Project Structure

### Documentation (this feature)

```text
specs/008-acao-responsavel/
├── spec.md
├── plan.md              # este arquivo
├── tasks.md             # saída do /speckit-tasks
└── checklists/
    └── requirements.md
```

Sem `research.md`, `data-model.md` ou `contracts/`: não há incógnita para pesquisar (as duas
decisões abertas foram respondidas pelo Jean antes da spec), o modelo de dados é uma tabela de
três colunas descrita em D1, e a feature não expõe nenhum endpoint — o write é server action.
Mesma composição de artefatos das specs 005 e 007.

### Source Code (repository root)

```text
lib/
├── agenda.mjs           # ALTERADO — SEM_RESP, rotuloResp, lerFiltros, filtrosAtivos,
│                        #            filtrar, acoesDoRanking(curados, donos)
└── db.ts                # ALTERADO — hub_acao_dono no ensure(), listDonos(), setDono()

app/
├── page.tsx             # ALTERADO — rótulo do dono no foco e na célula da tabela
├── quadro.tsx           # ALTERADO — passa a importar rotuloResp do .mjs (remove a cópia local)
└── agenda/
    ├── page.tsx         # ALTERADO — controle por linha, filtro na barra, chip, rodapé
    └── actions.ts       # ALTERADO — server action `atribuir`

app/globals.css          # ALTERADO — estilo do par de botões (reusa .pill e .ag-*)

test/
└── agenda.test.mjs      # ALTERADO — casos novos, arquivo JÁ registrado no package.json
```

**Structure Decision**: single-project Next App Router, sem diretório novo. Todo arquivo tocado
já existe; a feature é ligação de peças, não estrutura nova.

## Complexity Tracking

Sem violação de constituição a justificar.
