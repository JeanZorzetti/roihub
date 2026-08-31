---
description: "Task list for feature implementation"
---

# Tasks: Responsável pela ação do ranking

**Input**: Design documents from `/specs/008-acao-responsavel/`

**Prerequisites**: spec.md, plan.md

**Tests**: Incluídos. A lógica nova é pura e cai em `lib/agenda.mjs`, coberto pelo
`test/agenda.test.mjs` já registrado no `package.json` — Princípio II não abre exceção.

**Organization**: Tasks agrupadas por user story (US1 atribuir, US2 exibir, US3 filtrar).
US1 e US2 são ambas P1 e formam o MVP; US3 é P2 e é entregável depois, sozinha.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: US1 / US2 / US3
- Caminhos de arquivo exatos em cada descrição

## Path Conventions

Projeto único Next.js App Router. `lib/` para lógica pura (`.mjs`) e borda de banco (`.ts`),
`app/` para páginas e server actions, `test/` para `node --test`.

---

## Phase 1: Setup

Sem setup novo — nenhuma dependência, diretório ou variável de ambiente nova. Todos os
arquivos tocados já existem.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: a persistência e o vocabulário compartilhado. Nenhuma user story renderiza nada
antes disso existir.

**⚠️ CRITICAL**: T001–T004 bloqueiam todas as user stories.

- [X] T001 Criar a tabela em `lib/db.ts`, dentro do template do `ensure()`:
  `CREATE TABLE IF NOT EXISTS hub_acao_dono (key TEXT PRIMARY KEY, responsavel TEXT NOT NULL,
  atualizado TIMESTAMPTZ NOT NULL DEFAULT now());`. Comentário acima explicando o **porquê**
  (estilo `autopublish-clients.ts`): sem `CHECK` de propósito, pela mesma razão já escrita para
  `hub_tasks.responsavel` — a lista de responsáveis vive no `.mjs` e duplicá-la aqui daria
  migração a cada rótulo novo; e `responsavel NOT NULL` porque "sem dono" é ausência de linha,
  não linha com `NULL` (desatribuir é `DELETE`).
- [X] T002 Adicionar `listDonos(): Promise<Map<string, string>>` em `lib/db.ts`, ao lado de
  `listDone()`: `await ensure()` + `SELECT key, responsavel FROM hub_acao_dono` e `new Map`.
  Sem filtro de validade — dono não expira como o check (`ACAO_DONE_DIAS` não se aplica: ele
  existe para o check não sumir com o topo do ranking, e um dono expirando só criaria linha
  órfã sem ninguém).
- [X] T003 Adicionar `setDono(key: string, responsavel: string | null): Promise<void>` em
  `lib/db.ts`: `null` ⇒ `DELETE FROM hub_acao_dono WHERE key = $1`; valor ⇒
  `INSERT ... ON CONFLICT (key) DO UPDATE SET responsavel = $2, atualizado = now()`.
- [X] T004 [P] Em `lib/agenda.mjs`, junto de `RESPONSAVEIS`: (a) trocar o comentário mentiroso
  "A agenda não usa mais (ação do ranking não tem dono)" pelo estado real; (b) exportar
  `SEM_RESP = "sem"` (id do filtro "sem responsável" — não é um responsável, é a ausência);
  (c) mover para cá o `rotuloResp` que hoje é uma const local em `app/quadro.tsx:64`,
  exportado e com JSDoc.

**Checkpoint**: `npm test` verde (nada quebrou), banco aceita atribuir/desatribuir por query
manual.

---

## Phase 3: User Story 1 — Atribuir responsável a uma ação (P1) 🎯 MVP

**Goal**: Jean escolhe o dono de cada ação na `/agenda`, com um clique, e a escolha sobrevive
ao reload.

**Independent Test**: escolher "Maria Zorzetti" numa ação, recarregar, ver Maria ainda lá.

- [X] T005 [US1] Estender `acoesDoRanking(curados, donos = new Map())` em `lib/agenda.mjs`:
  cada item ganha `responsavel: donos.get(key) ?? null`. Assinatura com default para não
  quebrar chamador existente. A `key` já é montada ali — reusar a mesma expressão, nunca
  recalcular o `hash8` num segundo lugar.
- [X] T006 [P] [US1] Casos em `test/agenda.test.mjs`: item recebe o dono do Map pela chave
  certa; chave ausente ⇒ `responsavel: null`; `acoesDoRanking(curados)` sem segundo argumento
  continua funcionando; **reescrever o texto da ação muda a `key`** e portanto zera o dono
  (é o Edge Case central da spec — se este teste não existir, a decisão D2 não está coberta).
- [X] T007 [US1] Server action `atribuir(fd: FormData)` em `app/agenda/actions.ts`, no molde
  exato do `toggle`: `if (!dbOn()) return`; `key` tem de começar com `acao:`; `responsavel`
  só passa se estiver em `RESPONSAVEL_IDS`, senão vira `null` (FR-008); `await setDono(...)`;
  `revalidatePath("/agenda")`. Atualizar o comentário do topo do arquivo, que hoje afirma
  "O único write da agenda" — passam a ser dois, e nada além de dois (FR-009).
- [X] T008 [US1] Componente `Dono` em `app/agenda/page.tsx`: um `<form action={atribuir}>` com
  `key` em hidden e **um botão por responsável**, cada um com `name="responsavel"` e
  `value={r.id}` — clicar no que já está ativo manda `""` e desatribui (D4). `aria-pressed` no
  ativo e `aria-label` que nomeia a ação, pelo mesmo motivo do `<summary>` de contexto: o
  rótulo se repete em ~30 linhas. Renderizar só quando `canWrite`.
- [X] T009 [US1] Ligar na página: incluir `listDonos()` na `Promise.all` existente com
  `.catch(() => new Map<string, string>())` (D6), passar o Map para `acoesDoRanking`, e o campo
  `responsavel` no type `Item`.
- [X] T010 [P] [US1] Estilo do par de botões em `app/globals.css`, reusando os tokens de
  `.ag-check`/`.pill` já existentes — estado ativo com `--accent`, alvo de toque ≥ 24px (WCAG 2.2 AA; o `.ag-check` vizinho tem 22px, e um controle muito maior que ele destoaria da linha), foco
  visível. Sem paleta nova.

**Checkpoint**: US1 fecha sozinha — dá para atribuir e desatribuir, e persiste.

---

## Phase 4: User Story 2 — Enxergar quem é o dono sem abrir nada (P1)

**Goal**: o dono aparece na linha da agenda e no card da home; ação sem dono aparece como
pendência explícita, não como espaço vazio.

**Independent Test**: com uma ação da Maria, ver "Maria" nas duas telas.

- [X] T011 [US2] No `Row` de `app/agenda/page.tsx`, exibir o dono na `.ag-meta` ao lado do
  `pill` de projeto: `rotuloResp(item.responsavel)` quando houver, e um pill de alerta
  "sem responsável" quando não houver (FR-006). Vale também para as linhas de "Feitas" — o
  histórico perde o sentido se o dono sumir ao marcar.
- [X] T012 [US2] Em `app/page.tsx`, exibir o dono junto da `acao`: no bloco do foco
  (`app/page.tsx:156`) e na célula `.acao-cell` da tabela (`app/page.tsx:233`). A home
  **não** atribui (D5). Reusar a `key` de `acaoDone()` (`app/page.tsx:69`), que já é a mesma —
  se ela for recalculada num terceiro lugar, é sinal de que precisa virar helper no `.mjs`.
- [X] T013 [US2] Em `app/quadro.tsx`, apagar a const local `rotuloResp` (linha 64) e importar
  a versão de `lib/agenda.mjs`. Nenhuma mudança de comportamento nos quadros — é a
  consolidação que a T004 tornou possível.

**Checkpoint**: US1+US2 = o pedido do Jean atendido. Entregável aqui, mesmo sem a US3.

---

## Phase 5: User Story 3 — Isolar "o que é meu" (P2)

**Goal**: filtrar a fila por responsável, incluindo "sem responsável".

**Independent Test**: com ações dos dois e algumas sem dono, filtrar por Maria e ver só as dela.

- [X] T014 [US3] Em `lib/agenda.mjs`: `lerFiltros` lê `responsavel` aceitando só
  `RESPONSAVEL_IDS` + `SEM_RESP` (querystring é entrada de usuário e volta para a tela no
  `value` do select — desconhecido vira sem filtro, nunca filtro que não casa com nada);
  `filtrosAtivos` passa a listar `responsavel`; `filtrar` compara `i.responsavel`, com
  `SEM_RESP` casando `responsavel == null`.
- [X] T015 [P] [US3] Casos em `test/agenda.test.mjs`: filtro por `jean` devolve só as de Jean;
  filtro `sem` devolve só as sem dono; valor desconhecido na querystring é descartado;
  `comFiltro` mantém e remove `responsavel` como faz com os demais; sem filtro, todas voltam.
- [X] T016 [US3] Na barra de filtros de `app/agenda/page.tsx`, `<select name="responsavel">`
  com "todos os responsáveis" / os dois nomes / "sem responsável" — cópia do que já existe em
  `app/quadro.tsx:571`. Adicionar a entrada `responsavel` no mapa `ROTULO` do chip (com o
  rótulo, não o id) e incluir o campo no `semFiltro`.

**Checkpoint**: SC-002 fica verificável em um clique.

---

## Phase 6: Polish & Cross-Cutting

- [X] T017 Atualizar o rodapé da `/agenda` (`app/agenda/page.tsx`): o parágrafo que hoje diz
  que a aba só tem o check precisa dizer que o dono também vive no banco e **zera quando o
  texto da ação muda**, pela mesma razão que o check reseta. O rodapé é a única documentação
  que o Jean lê na hora de usar.
- [X] T018 `npm test` (suíte inteira, não só `agenda.test.mjs`) + `npm run build` em modo
  produção. Os dois verdes são o portão do Princípio II e do fluxo de entrega.
- [X] T019 Verificação em navegador com banco real (`ui-verification`): atribuir, recarregar,
  desatribuir, filtrar por cada valor, passagem de teclado no par de botões, e a tela com
  `DATABASE_URL` removida (FR-010). Screenshot antes/depois. **Sem isso, não está pronto.**
- [X] T020 Commit + push respeitando a janela do Princípio IV (fora de 23:30–01:00 e
  08:00–08:45 BRT), e atualizar `handoff.md`.

---

## Dependencies

```text
Phase 2 (T001–T004)  ← bloqueia tudo
      ├── US1 (T005–T010)  ← MVP, entregável sozinha
      │       └── US2 (T011–T013)  ← precisa do campo `responsavel` no Item (T005)
      └── US3 (T014–T016)  ← só precisa da Phase 2 + T005; independente da US2
Phase 6 (T017–T020)  ← depois de tudo que for entregue
```

- T004 é `[P]` com T001–T003 (arquivos diferentes: `.mjs` × `.ts`).
- T006, T010, T015 são `[P]` entre si e com as tasks de código da mesma fase.
- T013 depende de T004 e de nada mais.

## Implementation Strategy

**MVP = Phase 2 + US1 + US2.** Isso já responde "as ações precisam ter responsáveis": dá para
atribuir pela tela e dá para ver de quem é cada ação nas duas telas. US3 é o incremento que
torna a fila operável no dia a dia e pode ir num segundo commit sem deixar nada quebrado no
meio.

Ordem de risco: a única parte que pode surpreender é a T009 (banco na `Promise.all`) — se o
`.catch` não estiver lá, uma queda de banco derruba a `/agenda` inteira em vez de degradar.
É o mesmo cuidado que o `listDone()` já tem e o motivo de ele existir.
