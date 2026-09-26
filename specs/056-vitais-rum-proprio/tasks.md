# Tasks: 056 — Vitais de campo próprios (RUM)

**Input**: [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md),
[contracts/recebimento.md](./contracts/recebimento.md)

## Phase 1: Foundational (lógica pura + teste)

- [x] T001 [US1][US3] `lib/rum.mjs`: `lerMedida()` (D6, data-model §2) e `agenteRecusado()`
- [x] T002 [US2] `lib/rum.mjs`: `leituraRum()` (D7, data-model §3), reusando `vereditoContraRegua` e `VITAIS`
- [x] T003 [US2] `lib/rum.mjs`: `passRateMisto()` (D9, data-model §6)
- [x] T004 `test/rum.test.mjs` cobrindo T001–T003, registrado no `package.json`; `npm test` verde

## Phase 2: US1 + US3 — receber (hub)

- [x] T005 [US1] `lib/db.ts`: `hub_vitais` no `ensure()`, `gravarVital()`, `lerRum()` (D10)
- [x] T006 [US1] `lib/projects.ts`: `slugDeCampoDoHost()` (D5)
- [x] T007 [US1][US3] `app/api/vitais/route.ts` (contrato) + isenção em `middleware.ts`

## Phase 3: US2 — o mapa lê o RUM

- [x] T008 [US2] `app/gsc/mapa/[slug]/page.tsx`: nó e leitura do RUM nos 4 vitais (D8)
- [x] T009 [US2] `app/gsc/mapa/[slug]/page.tsx`: URLs boas com `passRateMisto()` (D9)
- [x] T010 `npx tsc --noEmit` e `npm test` verdes; commit e push do hub

## Phase 4: US1 — coletor no Sirius

- [x] T011 [US1] `components/marketing/vitais-de-campo.tsx` (D1–D4) montado em `app/[locale]/(marketing)/layout.tsx`
- [x] T012 typecheck do arquivo novo; commit e push do Sirius (depois do hub no ar)

## Phase 5: Verificação em produção

- [x] T013 quickstart 1–7, em 26/09/2026:
  - 1 recusa: origem alheia, valor negativo e agente do Lighthouse → 204 e 0 linhas (SC-004 ✓)
  - 2 ponta a ponta: Chromium real com agente de Chrome em `/pricing?email=…` → linhas `lcp` e
    `ttfb` em `/pricing`, sem o parâmetro (SC-001 caminho, SC-006 ✓); com a aba escondida saem `inp` e
    `cls`, e esconder de novo não repete. Linhas de teste apagadas. Agente `HeadlessChrome` → 0 linhas
  - 3 `/login` → 0 beacons (FR-002 ✓)
  - 4 PageSpeed não rodado (cota do PSI sem chave); coberto pelo filtro de agente, testado com
    `Chrome-Lighthouse` (SC-003 parcial)
  - 5–6 mapa: sem beacon real ainda, Sirius mantém o texto da CrUX (D8); Atma com LCP/CLS/TTFB da
    origem anterior e INP "parcial", sem RUM (SC-005 ✓)
  - 7 peso: o chunk sai com `async` e não bloqueia a renderização, mas custa **3.298 B gz** medidos
    no chunk servido, contra a meta de 3 KB: **SC-007 não cumprida por ~0,3 KB**. 2.854 B são a
    `web-vitals` que o Next embute, com `onFCP`/`onFID` que o coletor não usa. Cortar exigiria o
    pacote `web-vitals` direto (ESM, tree-shaking), uma dependência nova
- [ ] T014 SC-002 em 03/10/2026 (D+7)
