# Tasks: A árvore de OKR do portfólio

**Branch**: `009-okr-arvore` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Ordem é dependência real: a lógica pura antes do teste que a prova, o teste antes da tela que a
consome. `npm test` tem que estar verde antes da T008.

## Fase 1 — Lógica pura (`.mjs`, Princípio III)

- [x] **T001** `lib/okr.mjs`: `PERFIS` — os quatro perfis do §4 do template, cada um com seus
  degraus nomeados na ordem, e cada degrau declarando a **fonte a consultar** (R4) e a família de
  diagnóstico (D1-D4) a que o buraco dele pertence. Perfil D tem 5 degraus, não 4 — no-show é
  etapa própria.
- [x] **T002** `lib/okr.mjs`: `montarFicha({ slug, perfil, coletado })` — resolve cada degrau
  contra o que foi coletado, produz as células por `apurado`/`naoApurado` de `lib/funil.mjs`, e
  encadeia as taxas com `razao()` (denominador de um degrau = numerador do anterior). Degrau sem
  coletor → `naoApurado` com a fonte a consultar. Projeto sem perfil → ficha `semPerfil`.
- [x] **T003** `lib/okr.mjs`: `posicaoDeAtaque(ficha)` — a §7 como função pura, com curto-circuito
  na ordem: (1) fator zerado, (2) `não apurado` de encanamento, (3) menor taxa da cadeia fechada,
  (4) volume/ticket, (5) N5. Devolve `{ posicao, rotulo, celula, motivo }` — nunca só o número.
- [x] **T004** `lib/okr.mjs`: `resumirPortfolio(fichas)` — contagem por posição. A soma tem que
  bater com o total (SC-005), incluindo a faixa `sem perfil` contada à parte.

## Fase 2 — Prova (Princípio II, NÃO-NEGOCIÁVEL)

- [x] **T005** `test/okr.test.mjs` com `node:test` + `assert/strict`, cobrindo:
  - fator zerado ganha da taxa baixa (a §7 é ordenada, não é "o pior número")
  - degrau sem coletor é `não apurado`, **nunca** `0` (R1)
  - `0/0` e numerador > denominador continuam `não apurado` através de `okr.mjs` (R3, herdado)
  - perfil ausente não vira perfil A por descuido
  - cadeia fechada aponta a **menor** taxa, não a primeira
  - `resumirPortfolio` soma igual ao total
- [x] **T006** Registrar `test/okr.test.mjs` na lista de `npm test` do `package.json`, **no mesmo
  commit**. `test/validade.test.mjs` reprova se faltar.

## Fase 3 — Dados

- [x] **T007** `data/projects.json`: campo `perfil` nos cards. Curadoria manual, um a um. Card sem
  perfil claro fica **sem o campo** — é `não apurado`, não chute.
- [x] **T008** `lib/projects.ts`: `perfil?: "A" | "B" | "C" | "D"` e `vendas?: { data: string }[]`
  no tipo `Project` (o campo já sobrevive ao spread do `mergeProjects`; falta o tipo).

## Fase 4 — Tela

- [x] **T009** `app/okr/page.tsx`: `dynamic = "force-dynamic"`, `listProjects()` + `gscSeries()` +
  `listLeads()`, no padrão de `/seo` e `/crm`. Renderiza por posição de ataque crescente. Toda
  taxa com fração colada (R2, FR-006). Rodapé com a contagem por posição, a janela declarada
  (R7) e o bloco "o que isto não vê" (FR-015).
- [x] **T010** `app/tabs.tsx`: aba `okr`, e o tipo `active` ganha `"okr"`.

## Fase 5 — Portões

- [x] **T011** `npm test` verde — suíte inteira, não só o arquivo novo.
- [x] **T012** `npx next build` sem erro de tipo.
- [x] **T013** Verificar `/okr` servido de verdade: `atma` na posição 1 (SC-004), soma do rodapé
  igual ao total (SC-005), e varredura do HTML sem percentual órfão (SC-003).
