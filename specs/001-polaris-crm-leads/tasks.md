---
description: "Task list for spec 001 — CRM do roihub recebe leads do Polaris"
---

# Tasks: CRM do roihub recebe leads do Polaris

**Input**: Design documents from `/specs/001-polaris-crm-leads/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: incluídos, mas **não** como TDD opcional — os testes existentes em `sofia-next` (`crm-lead.test.ts`, `crm-lead-intake.test.ts`) mockam o Sirius CRM e **vão quebrar** quando a rota mudar de destino. Atualizá-los é trabalho obrigatório, não adicional. Um único teste novo cobre a lógica não-trivial introduzida (geração do `external_id`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: US1 / US2 / US3, conforme spec.md
- Dois repositórios envolvidos — caminhos prefixados por `roihub/` ou `sofia-next/` para não haver ambiguidade

---

## Phase 1: Setup

**Purpose**: configuração de ambiente antes de qualquer código

- [X] T001 Documentar `ROIHUB_CRM_URL` e `ROIHUB_CRM_SECRET` em `sofia-next/.env.example`, na seção de integrações (convenção em [research.md §3](./research.md)). `roihub/.env.example` já documenta `CRM_INGEST_SECRET` — não precisa mudar.
- [X] T002 Definir as duas vars no `.env.local` do sofia-next para desenvolvimento, com `ROIHUB_CRM_SECRET` igual ao `CRM_INGEST_SECRET` do roihub local.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: sem estas tarefas, TODA chamada de qualquer formulário volta `400 pipeline desconhecida`

**⚠️ CRITICAL**: nenhuma user story funciona antes desta fase

- [X] T003 Adicionar a entrada `polaris` (slug, nome, etapas `["novo","contato","proposta","ganho","perdido"]`) em `roihub/data/pipelines.json`, conforme [data-model.md](./data-model.md).
- [X] T004 Estender `roihub/test/crm.test.mjs` cobrindo a nova pipeline: `parseLead` aceita `pipeline: "polaris"` e rejeita etapa fora da lista. Rodar `npm test` no roihub e confirmar verde.
- [X] T005 Criar `sofia-next/src/lib/roihub-crm.ts` — helper único usado pelas duas rotas. Responsabilidades: (a) montar o payload do contrato ([contracts/crm-leads-ingest.md](./contracts/crm-leads-ingest.md)); (b) derivar `external_id` = `sha256(email|origem|janela de 2min)` via `node:crypto` ([research.md §2](./research.md)); (c) disparar o `fetch` dentro de `after()` de `next/server`, com try/catch que só loga — nunca lança para o chamador (FR-006). Marcar a janela de 2 min com comentário `ponytail:` nomeando o teto conhecido (reenvio >2min vira card novo) e a alternativa (id gerado no cliente).

**Checkpoint**: pipeline existe no hub e o helper está pronto para ser plugado

---

## Phase 3: User Story 1 — Lead do Polaris aparece no CRM do hub (Priority: P1) 🎯 MVP

**Goal**: os 3 formulários do Polaris passam a alimentar a pipeline "Polaris" no CRM do roihub

**Independent Test**: enviar cada formulário e ver o card correspondente em `/crm` do roihub (cenários 1 e 2 do [quickstart.md](./quickstart.md))

- [X] T006 [US1] Reescrever `sofia-next/src/app/api/crm/lead/route.ts`: manter validação, honeypot e o formato de resposta atuais (FR-005 e contrato com a UI **não mudam**), trocando o forward ao Sirius CRM pela chamada a `roihub-crm.ts`. `origem` derivada do campo `subject` recebido: `site-intake` → `polaris:peca-seu-site`, `early_access` → `polaris:early-access`.
- [X] T007 [US1] Adicionar chamada ao `roihub-crm.ts` em `sofia-next/src/app/api/contact/route.ts`, **depois** do `prisma.salesLead.create` bem-sucedido, com `origem: "polaris:contato"` e `metadata` conforme [data-model.md](./data-model.md). O insert no Postgres do Polaris e a resposta ao visitante permanecem inalterados (FR-007 — aqui é adição, não substituição).
- [X] T008 [P] [US1] Atualizar `sofia-next/src/__tests__/integration/crm-lead.test.ts`: trocar o mock/env do Sirius (`SIRIUS_CRM_API_KEY`, `SIRIUS_CRM_URL`) pelo destino roihub; manter os casos de validação (400) e honeypot que já passam.
- [X] T009 [P] [US1] Atualizar `sofia-next/src/__tests__/integration/crm-lead-intake.test.ts` da mesma forma.
- [X] T010 [US1] Remover o que sobrou do caminho Sirius CRM nessas rotas (`SIRIUS_CRM_API_KEY` / `SIRIUS_CRM_URL` e a montagem de `notes`), já que nenhum caminho vivo o usa mais. **Não** tocar em `SIRIUS_API_URL`/`SIRIUS_API_KEY`/`SIRIUS_WEBHOOK_SECRET` — são da integração AgaaS, sem relação com esta feature.
- [X] T011 [US1] Rodar `npm test` no sofia-next e `npm test` no roihub; confirmar os dois verdes antes de seguir.

**Checkpoint**: US1 completa — MVP entregável

---

## Phase 4: User Story 2 — Origem do lead é identificável (Priority: P2)

**Goal**: distinguir contato / intake de site / early access direto no kanban

**Independent Test**: cenário 2 do [quickstart.md](./quickstart.md) — 3 cards, 3 origens distintas, sem abrir detalhe

> **Nota**: esta story não tem código próprio. A UI do CRM (`roihub/app/crm/page.tsx`) **já** renderiza `origem` como coluna dedicada (pill), e os 3 valores distintos são definidos em T006/T007. A fase existe para verificar, não para construir — inventar código aqui seria trabalho inútil.

- [X] T012 [US2] Verificar na `/crm` do roihub que os 3 valores de `origem` aparecem distintos na coluna dedicada. Se (e só se) os valores ficarem ilegíveis/truncados na pill, ajustar a exibição em `roihub/app/crm/page.tsx`.

**Checkpoint**: US1 e US2 funcionando

---

## Phase 5: User Story 3 — Reenvio não duplica o lead (Priority: P3)

**Goal**: retry técnico não polui a pipeline com cards fantasmas

**Independent Test**: cenário 3 do [quickstart.md](./quickstart.md)

> **Nota**: a deduplicação em si já existe no roihub (`UNIQUE(external_id)` + `ON CONFLICT DO NOTHING` em `insertLead`, com `200` em vez de `409` no reenvio). O que esta feature adiciona é a *estabilidade* do `external_id` gerado no Polaris (T005) — que é justamente a lógica não-trivial que precisa de um teste próprio.

- [X] T013 [US3] Adicionar teste em `sofia-next` cobrindo a geração do `external_id` no `roihub-crm.ts`: mesmo email+origem dentro da mesma janela → mesmo id; janelas diferentes → ids diferentes.
- [X] T014 [US3] Validar ponta a ponta: enviar o mesmo formulário duas vezes em menos de 2 minutos e confirmar **um único** card em `/crm`.

**Checkpoint**: as 3 stories funcionando

---

## Phase 6: Polish & Deploy

- [ ] T015 Configurar `ROIHUB_CRM_URL` e `ROIHUB_CRM_SECRET` no serviço EasyPanel do sofia-next em **produção**. ⚠️ Esta é exatamente a etapa que faltou na integração Sirius e a deixou quebrada (500) sem ninguém notar — sem ela, a feature funciona local e falha em produção.
- [ ] T016 Rodar os 4 cenários do [quickstart.md](./quickstart.md) contra produção, incluindo o cenário 4 (roihub indisponível não afeta o visitante).
- [X] T017 [P] Escrever `handoff.md` co-localizado em `specs/001-polaris-crm-leads/` com o que foi entregue e as evidências de produção.

---

## Dependencies & Execution Order

```
T001, T002 (Setup)
   ↓
T003 → T004        (roihub: pipeline + teste)
T005               (sofia-next: helper)      ← T003 precisa existir para o helper funcionar de verdade
   ↓
T006, T007 (rotas) → T008, T009 (testes [P]) → T010 (limpeza) → T011 (suítes verdes)
   ↓
T012 (US2, verificação)   T013 → T014 (US3)
   ↓
T015 → T016 → T017
```

### Parallel Opportunities

- **T003/T004 (roihub) e T005 (sofia-next)**: repositórios diferentes, podem correr em paralelo — desde que T003 esteja mergeado/deployado antes de qualquer teste ponta a ponta.
- **T008 e T009**: arquivos de teste distintos, paralelizáveis.
- **T012 e T013**: stories diferentes, arquivos diferentes.

### Ordem obrigatória

- T003 antes de qualquer validação real: sem a pipeline no JSON, toda chamada é `400`.
- T005 antes de T006/T007: as duas rotas consomem o helper.
- T011 antes da Phase 6: não faz sentido deployar com suíte vermelha.

---

## Implementation Strategy

### MVP (para em US1)

Phase 1 → Phase 2 → Phase 3 → validar cenários 1 e 2 do quickstart → deployar. US2 já vem junto de graça (a coluna `origem` existe); US3 já vem parcialmente (o dedupe do banco existe) — o que sobra delas é verificação e um teste.

### Ordem de deploy entre os dois repos

roihub **primeiro** (T003 — pipeline no ar), sofia-next **depois** (T006/T007). O inverso deixa uma janela em que todo lead do Polaris toma `400 pipeline desconhecida` — e, por ser best-effort (FR-006), essa falha seria **silenciosa** para o visitante e só apareceria como lead faltando no CRM.

---

## Notes

- Commits separados por repositório — são dois repos independentes, sem monorepo.
- `ContactForm.tsx` (sofia-next) é código morto e permanece fora do escopo (ver Assumptions da spec).
- Nenhuma migração de banco em nenhum dos dois lados: `crm_leads` e `salesLead` já existem com os campos necessários.
