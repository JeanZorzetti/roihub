# Tasks: A próxima ação de cada KPI no mapa de GSC

**Input**: `specs/054-proxima-acao-mapa/` — plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: obrigatórios pela constituição (Princípio II) para toda lógica pura nova.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Foundational — o módulo das regras

- [x] T001 Criar `lib/proxima-acao.mjs` com `DEGRAUS`, `ALAVANCAS`, `LINKS_DO_BOARD`, `PROFUNDIDADE_DO_BOARD` e `REGRAS` (32 chaves de `CATALOGO`, limiar ◆ lido de `CATALOGO`/`BENCHMARK`) — data-model §1–3
- [x] T002 Implementar `avaliar(leituras)` e `etiqueta(disparo)` em `lib/proxima-acao.mjs` — data-model §4–5, research D4/D5/D10
- [x] T003 Implementar `regraEmTexto(chave)` e `plano(disparos)` em `lib/proxima-acao.mjs` — data-model §6, research D6/D7
- [x] T004 Escrever `test/proxima-acao.test.mjs` e registrá-lo em `package.json`: chaves = `CATALOGO` nos dois sentidos; limiar ◆ = régua viva (SC-003); os cinco estados nas bordas (`<`, `>=`, piso, crítico, ausente, indecisa); nenhuma etiqueta ◇ com `▼` nem `régua`; fixture do Sirius de 22/09 → primeira entrada `indexacao` (SC-002), `links` uma vez com 4 motivos (SC-006), `titulo` no degrau `snippet`

**Checkpoint**: `npm test` verde com o módulo sozinho.

## Phase 2: User Story 1 — a etiqueta em cada folha (P1) 🎯 MVP

**Goal**: cada uma das 32 folhas mostra o estado, com ação, leitura e limiar quando dispara.

**Independent Test**: `/gsc/mapa/sirius`, folha "Taxa de Indexação Limpa" com `→ consertar o índice · 73,7% (30 fora) · meta ≥ 95%`.

- [x] T005 [US1] Em `app/gsc/mapa/[slug]/page.tsx`: declarar `leituras` e registrar, em cada bloco de folha que já existe, a leitura normalizada (valor, texto, fonte, alvos, piso) ou o motivo da ausência — as 32 chaves
- [x] T006 [US1] Trocar `CLIQUES_DO_BOARD` e `LINKS_DO_BOARD` locais pelos exports do módulo em `app/gsc/mapa/[slug]/page.tsx`
- [x] T007 [US1] Depois dos blocos, chamar `avaliar()`, pendurar `etiqueta()` nas `tags` do nó de cada folha e acrescentar `regraEmTexto()` à `note` dela (US3 junto: a mesma `note` alimenta a lista) em `app/gsc/mapa/[slug]/page.tsx`

## Phase 3: User Story 2 — "O que fazer primeiro" (P1)

**Goal**: o bloco substitui "Primeiro na fila", com degraus, entradas por alavanca, motivos e alvos.

**Independent Test**: no Sirius, primeira entrada "1 · Índice → Consertar o índice"; reescrita do título no degrau 5.

- [x] T008 [US2] Alimentar os alvos do CTR Gap na ordem de `filaDoMapa()` (cliques não capturados) em `app/gsc/mapa/[slug]/page.tsx`; largura e vitais não têm ordem por URL (research D7)
- [x] T009 [US2] Substituir a seção `mapa-fila-h` pelo bloco "O que fazer primeiro" (degraus, entradas, motivos com origem, alvos, rodapé com sem ação / não decide / sem leitura e o lembrete do §0) em `app/gsc/mapa/[slug]/page.tsx`
- [x] T010 [P] [US2] Estilo mínimo do bloco no escopo `[data-info="gsc"]` em `app/globals.css`, reusando `mapa-fila`/`mb-tag` e só acrescentando o que faltar

## Phase 4: Polish

- [x] T011 [P] Entradas novas no `GLOSSARIO.md`: Próxima ação, Sem ação, Meta do board sem fonte, Degrau
- [x] T012 [P] `handoff/gsc-template-de-melhoria.md` vira ponteiro, sem limiar (research D11)
- [x] T013 `npm test` + `npx tsc --noEmit` verdes
- [x] T014 Verificação no navegador (ui-verification): Sirius e Atma em dev, 3 larguras, 32 etiquetas, bloco novo; depois do push, as mesmas conferências em produção
- [x] T015 Registro: `.info/log.json` (information-design Passo 8) e memória do projeto

## Dependencies

T001 → T002 → T003 → T004 · T004 → T005 → T006 → T007 · T007 → T008 → T009 · T010–T012 em paralelo depois de T009 · T013 → T014 → T015
