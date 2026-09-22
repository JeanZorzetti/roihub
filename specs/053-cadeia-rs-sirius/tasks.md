# Tasks: A cadeia do Sirius até o dinheiro — banco no retroativo, Stripe nos novos

**Input**: `specs/053-cadeia-rs-sirius/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: a constituição exige `node --test` para toda regra pura (Princípio II). Os testes vêm antes da
implementação em cada fase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: US1 (cadeia), US2 (pagantes), US3 (texto do card)

---

## Phase 1: Setup

- [ ] T001 Capturar em produção, ANTES de qualquer push de código, o HTML de `/okr/<slug>` dos 8 projetos do
  perfil A que não são o Sirius (polarisia, estetiacrm, reviewshield, context, seo-forecaster, cannibal_scan,
  compass, vertice), no scratchpad. É o "antes" da SC-005, e sem ele a comparação é impossível depois.
- [ ] T002 Escrever `scripts/sirius-usuario-leitura.mjs`: lê a conexão de administrador do `.env` do Sirius
  (`CRM/crm-project/.env`), gera 32 bytes aleatórios de senha, cria `roihub_leitura` com os grants por coluna
  de research D8 (idempotente: `ALTER ROLE … PASSWORD` se já existir) e grava `SIRIUS_DATABASE_URL` no `.env`
  do hub. Nunca imprime a senha nem a URL (Princípio V).
- [ ] T003 Rodar T002 (autorizado pelo dono em 22/09/2026) e conferir quickstart §3: `name` de
  `"Organization"` e `email` de `"Contact"` dão `permission denied`, `INSERT` dá `permission denied`, e a query
  de research D4 roda.
- [ ] T004 ⛔ Dono: copiar `SIRIUS_DATABASE_URL` do `.env` local para o ambiente do serviço `roihub` no
  EasyPanel.

---

## Phase 2: Foundational (a regra pura)

- [ ] T005 [P] Em `test/okr.test.mjs`, testes que falham: `montarFicha` com `slug: "sirius"` liga `signup` a
  `signups` e `ativado` a `ativados`, omite `trial` (e expõe `{chave, motivo}` em `omitidos`); com `epoca`, a
  taxa `visitante → signup` sai `não apurado` com "janelas diferentes"; `cadeiaLigada("A", "sirius")` é
  `ligada`; e, para cada um dos outros 8 slugs do perfil A, `montarFicha` devolve o mesmo que antes.
- [ ] T006 Em `lib/okr.mjs`: `CADEIAS_DO_PROJETO`, e `montarFicha`/`cadeiaLigada` com `slug` (e `epoca` na
  ficha), até T005 passar.
- [ ] T007 [P] Criar `test/saas.test.mjs` e registrá-lo em `package.json` no mesmo commit: `celulasDaConta`
  (conta de teste fora; cadastro pela data; ativado só com contato próprio), `classificarSessoesStripe` (os 5
  motivos de descarte, nominais), `pagantes` (união por conta sem duplicar; declarada + Stripe = uma conta com
  duas fontes; `pagaHoje`; divergência "plano pago sem pagamento ativo"; conta declarada não encontrada).
- [ ] T008 Criar `lib/saas.mjs` até T007 passar.

---

## Phase 3: User Story 1 — ver onde o funil trava (P1) 🎯 MVP

**Independent Test**: `/okr/sirius` e `/gsc/mapa/sirius` mostram signup e ativado iguais à contagem direta
(quickstart §2).

- [ ] T009 [US1] Em `lib/okr-coleta.ts`, ler o banco do Sirius por `SIRIUS_DATABASE_URL` com a query de
  research D4, uma conexão, falha fechada (`{erro}` com o código, nunca a URL); devolver as linhas.
- [ ] T010 [US1] Em `lib/ficha-dados.ts`, passar `slug` e `epoca` a `montarFicha`, e montar `signups`/`ativados`
  com `celulasDaConta` na janela de conversão. Sem a env: `não apurado · SIRIUS_DATABASE_URL ausente`.
- [ ] T011 [P] [US1] Em `data/projects.json`, card `sirius`: `epoca` `{ "data": "2026-03-17", "porque":
  "primeira conta real do produto (Cartopel)" }`.
- [ ] T012 [US1] Em `app/okr/[slug]/page.tsx`, mostrar o degrau omitido com o motivo, e a taxa recusada com o
  texto de research D3.
- [ ] T013 [P] [US1] Em `app/gsc/mapa/[slug]/page.tsx`, `cadeiaLigada(p.perfil, p.slug)`.

---

## Phase 4: User Story 2 — pagante com a fonte dita (P1)

**Independent Test**: a ficha mostra "já pagou" 6 e "paga hoje" 1, cada conta com a fonte, e a Boxer como
"plano PRO sem pagamento ativo".

- [ ] T014 [US2] Em `data/projects.json`, card `sirius`: `pagantesDeclarados` com os ids COMPLETOS das 6
  contas (buscados no banco, conferidos contra a tabela de Clarifications da spec).
- [ ] T015 [P] [US2] Criar `lib/stripe-leitura.ts`: `GET /v1/checkout/sessions?status=complete` (paginado, com
  `expand[]=data.payment_intent.latest_charge`) e `GET /v1/subscriptions?status=active` por `fetch`, com
  `SIRIUS_STRIPE_KEY`. Sem a chave, `{erro: "chave do Stripe ausente"}`. Erro HTTP, `{erro}` com o status,
  nunca a chave.
- [ ] T016 [US2] Em `lib/okr-coleta.ts`/`lib/ficha-dados.ts`, a célula `vendas` do Sirius passa a ser
  `pagantes(...).vendas`, e a ficha recebe `pagaHoje`, `divergencias` e `descartes`.
- [ ] T017 [US2] Em `app/okr/[slug]/page.tsx`, mostrar "paga hoje", as divergências e os descartes do Stripe,
  cada um com a fonte e a data.

---

## Phase 5: User Story 3 — o card para de afirmar o que não mediu (P2)

- [ ] T018 [P] [US3] Reescrever a `receitaNota` do Sirius em `data/projects.json` e o resumo do Sirius em
  `data/resumos.json` com o número medido, a data e a fonte. Não tocar os corpora de calibração (research
  D11).

---

## Phase 6: Polish

- [ ] T019 `npm test` (suíte inteira) e `npx tsc --noEmit` limpos.
- [ ] T020 Commit (mensagem em inglês) e push em `main` fora de 23:30–01:00, 08:00–08:45 e 05:15–06:40 BRT.
- [ ] T021 Depois do deploy e do T004: quickstart §2 e §4 em produção (os números da ficha e do mapa iguais à
  contagem direta, no mesmo dia).
- [ ] T022 SC-005: capturar de novo o HTML dos 8 projetos de T001 e comparar o texto de `<main>` com o de
  antes.
- [ ] T023 `ui-verification` em `/okr/sirius`: árvore de acessibilidade dos blocos novos, 360/768/1440 px e o
  console.
- [ ] T024 ⛔ Quando o dono criar a chave restrita: gravar `SIRIUS_STRIPE_KEY` no EasyPanel e conferir que o lado
  Stripe sai de `não apurado` para `0` apurado (nenhuma venda pelo Stripe até hoje).

---

## Dependencies

- T001 antes de T020 (o "antes" da SC-005 precisa ser do código atual).
- T002 → T003 → T004. T009/T010 dependem de T003 localmente e de T004 em produção.
- T005 → T006; T007 → T008. As fases 3 e 4 dependem da fase 2.
- T014 depende de T003 (os ids vêm do banco). T016 depende de T008, T009 e T015.
- T024 depende da chave do dono e pode ficar para depois do resto.

## Parallel

- T005 com T007 (arquivos de teste diferentes).
- T011, T013, T015 e T018 são arquivos diferentes.

## Implementation Strategy

Um push com as fases 1 a 5 (sem T004 e T024, que são do dono). A cadeia aparece com cadastro, ativação e as 6
declaradas mesmo sem a chave do Stripe. Quando a chave chegar, T024 fecha o lado dos novos.
