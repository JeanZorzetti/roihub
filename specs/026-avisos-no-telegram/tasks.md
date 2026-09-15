---

description: "Task list — 026 avisos no Telegram"
---

# Tasks: Avisos no Telegram — lead novo e ticket de suporte da Sirius e da Estetia

**Input**: Design documents from `/specs/026-avisos-no-telegram/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/avisos.md, quickstart.md

**Tests**: incluídos. A spec não pede, mas a constituição exige (Princípios II e III): lógica pura em
`.mjs` nasce coberta por `node --test`, com o arquivo registrado no `package.json`.

**Organization**: por história. Três repositórios — caminhos abaixo relativos a cada um:

- **hub** = `roihub/`
- **sirius** = `CRM/crm-project/` (em dia com `origin/main`; tem mudanças locais do dono que NÃO entram em commit nenhum)
- **estetia** = `Doc-CRM/`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivo ou repositório diferente, sem dependência pendente)
- **[Story]**: US1 (lead novo) ou US2 (ticket)

---

## Phase 1: Setup

**Purpose**: ambiente declarado e vocabulário fixado

- [X] T001 hub: declarar `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` sem valor em `.env.example`, com comentário do porquê (avisos da 026; sem elas o lead continua gravando e a rota de ticket responde 503)
- [x] T002 [P] hub: `GLOSSARIO.md` com os termos dos avisos (entregue na fase de plano, skill ux-writing)

---

## Phase 2: Foundational (bloqueia as duas histórias)

**Purpose**: envio ao Telegram e escape — usados pelo aviso de lead e pelo de ticket

**⚠️ CRITICAL**: nenhuma rota do hub chama o Telegram antes desta fase

- [X] T003 hub: escrever `test/avisos.test.mjs` (deve falhar) cobrindo `escaparHtml` (`&`, `<`, `>`), `faltandoTelegram(env)` (ausente, vazio, só espaços → nomes) e `enviarTelegram(texto, env, fetchImpl)`: corpo com `chat_id`, `parse_mode: "HTML"` e prévia de link desligada; `{ ok: false, erro: "telegram 401" }` quando a Bot API recusa; `{ ok: false, erro: "telegram indisponível" }` quando o `fetch` lança ou estoura 8 s; `{ ok: false, erro }` com os nomes quando falta ambiente, sem chamar o `fetch`; e **nenhum `erro` contendo o token**. Registrar o arquivo na lista de `test` do `package.json`
- [X] T004 hub: implementar `escaparHtml`, `faltandoTelegram` e `enviarTelegram` em `lib/avisos.mjs` até T003 passar (R5, R6)

**Checkpoint**: `npm test` verde com `test/avisos.test.mjs` na contagem

---

## Phase 3: User Story 1 — Lead novo chega no Telegram (Priority: P1) 🎯 MVP

**Goal**: todo lead novo de `sirius` e `estetiacrm` gravado no hub vira uma mensagem "Lead novo"

**Independent Test**: quickstart §4 — 3 leads (contato na Sirius; contato e calculadora na Estetia), 3 mensagens, 3 cards; reenvio e outra pipeline sem mensagem

### Pré-requisito nos produtos (os leads precisam chegar ao hub)

- [X] T005 [P] [US1] estetia: publicar o commit `88352ee` (`lib/roihub-crm.ts`, `app/api/contact/route.ts`, `app/api/leads/capture-calculator/route.ts`, `.env.example`) — `git push origin main`, depois de conferir que segue 1 à frente e 0 atrás (R9)
- [X] T006 [P] [US1] sirius: `git fetch C:\dev\sirius main` e `git cherry-pick 9a0b5e81` no `main` do `CRM/crm-project`; resolver conflito em `app/api/contact/route.ts` e `app/api/leads/capture-calculator/route.ts` se houver; conferir que o commit leva só os 4 arquivos do original; checar tipos só dos arquivos tocados (o CI já estava vermelho antes); `git push origin main` (R9). **Executado**: conflito em `capture-calculator/route.ts`, apagada como código morto em `cbc3f32` — remoção mantida, entrou só o contato (`bcb2c86`); `tsc` do projeto com 0 erros

### Testes (devem falhar antes da implementação)

- [X] T007 [US1] hub: acrescentar a `test/avisos.test.mjs` os casos de `avisoDeLead(lead, pipelines)`: `null` para pipeline fora de `["sirius", "estetiacrm"]`; título "🟢 <b>Lead novo · Sirius CRM</b>" e "· Estetia CRM" (nome da pipeline sem o parêntese); canal "pelo formulário de contato", "pela calculadora de ROI" e "via <valor>" para origem desconhecida; linhas de e-mail e telefone omitidas quando nulas; nome com `<b>&` escapado; link "Abrir no CRM do hub" (contracts/avisos.md §2)

### Implementação

- [X] T008 [US1] hub: implementar `avisoDeLead` em `lib/avisos.mjs` até T007 passar (R1, R7, R8)
- [X] T009 [US1] hub: em `app/api/crm/leads/route.ts`, quando `created` for `true`, montar `avisoDeLead(parsed.lead, pipelines)` e, se houver texto, enviar dentro de `after()` de `next/server`; falha vira `console.error("[avisos] " + erro)` — nunca muda o status da resposta nem devolve 503 por falta de `TELEGRAM_*` (Complexity Tracking do plano)

**Checkpoint**: US1 completa no código; prova em produção depende de T020–T022

---

## Phase 4: User Story 2 — Ticket de suporte chega no Telegram (Priority: P2)

**Goal**: ticket novo e resposta do cliente, na Sirius e na Estetia, viram mensagem; resposta de staff e nota interna não

**Independent Test**: quickstart §3 (rota direto) e §5 (ticket aberto, resposta do cliente, resposta do staff → exatamente 2 mensagens)

### Testes (devem falhar antes da implementação)

- [X] T010 [US2] hub: acrescentar a `test/avisos.test.mjs` os casos de `parseAvisoTicket(body)` — `produto` fora de `sirius`/`estetiacrm`, `tipo` fora de `novo`/`resposta`, `ticket_id` fora de `[A-Za-z0-9-]{1,64}`, `assunto` e `organizacao` vazios depois de aparar → `{ ok: false, erro }` (acima de 200 são cortados, como no `parseLead`); categoria e prioridade opcionais — e de `avisoDeTicket(aviso, pipelines)`: normal ("🎫 <b>Ticket novo · Estetia CRM</b>" e corpo "Dúvida · prioridade normal"), alta ("🟠 <b>Prioridade alta · …"), urgente ("🔴 <b>Urgente · …", corpo só com a categoria), resposta ("💬 <b>Cliente respondeu · …", sem categoria nem prioridade), enum desconhecido sai cru, assunto entre aspas curvas e escapado, link `https://siriuscrm.com.br/admin/support/<id>` e `https://estetiacrm.com.br/admin/support/<id>` com o texto "Responder no painel" (contracts/avisos.md §1–2)

### Implementação — hub

- [X] T011 [US2] hub: implementar `parseAvisoTicket` e `avisoDeTicket` em `lib/avisos.mjs` até T010 passar (R4, R8)
- [X] T012 [US2] hub: criar `app/api/avisos/ticket/route.ts` (`runtime = "nodejs"`, `dynamic = "force-dynamic"`): JSON inválido → 400; `parseAvisoTicket` falhou → 400 `{ error }`; `faltandoTelegram(process.env)` → 503 `{ error: "missing-env", fields }`; `enviarTelegram` → 200 `{ enviado: true }` ou 502 `{ error }`
- [X] T013 [US2] hub: incluir `/api/avisos/ticket` no bloco do `CRM_INGEST_SECRET` em `middleware.ts`, com o porquê de não ter segredo próprio (R3: capacidade menor que gravar lead)

### Implementação — produtos (dependem de T006 na sirius)

- [X] T014 [P] [US2] sirius: acrescentar `avisarTicketNoRoihub(input)` a `lib/roihub-crm.ts` — mesmo molde de `sendLeadToRoihub` (`after()`, lê `ROIHUB_CRM_URL`/`ROIHUB_CRM_SECRET`, `POST /api/avisos/ticket` com `Authorization: Bearer`, nunca lança, loga só o status)
- [X] T015 [US2] sirius: chamar `avisarTicketNoRoihub` em `app/api/support/tickets/route.ts` depois do `create` (`tipo: "novo"`, `ticket_id`, `assunto`, `organizacao: ticket.organization.name`, `categoria`, `prioridade`) e em `app/api/support/tickets/[id]/messages/route.ts` depois da transação, só quando `!ctx.isRoiLabsStaff` (`tipo: "resposta"`)
- [X] T016 [P] [US2] estetia: o mesmo de T014 em `lib/roihub-crm.ts`
- [X] T017 [US2] estetia: o mesmo de T015 em `app/api/support/tickets/route.ts` e `app/api/support/tickets/[id]/messages/route.ts`

**Checkpoint**: US2 completa no código; e-mails de ticket intocados (FR-013)

---

## Phase 5: Polish & entrega

- [X] T018 [P] hub: corrigir `handoff/funil-seo/00-LEIA-PRIMEIRO.md` (linhas da tabela de entregas e do funil de `sirius`/`estetiacrm`): o "ENTREGUE 01/09" era falso — o código só subiu em 15/09 (T005, T006); segue faltando o ambiente
- [X] T019 hub: `npm test` verde (suíte inteira) e revisão dos portões — teste registrado, nenhum import de `data/projects.json`, nenhum `console.*` que imprima URL da Bot API, token, chat id ou objeto de erro do `fetch`
- [X] T020 publicar na ordem do plano: hub (fora de 23:30–01:00 e 08:00–08:45 BRT), depois sirius e estetia com T014–T017
- [ ] T021 **dono**: criar o bot e preencher o ambiente dos 3 serviços no EasyPanel (quickstart §1) — antes disso, rodar quickstart §6 (SC-003)
- [ ] T022 rodar quickstart §2–5 e marcar SC-001, SC-002, SC-004 e SC-005

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependência
- **Foundational (Phase 2)**: bloqueia T008–T009 e T011–T012
- **US1 (Phase 3)**: T005 e T006 não dependem de nada no hub e podem sair primeiro; T007 → T008 → T009 depois da Phase 2
- **US2 (Phase 4)**: hub (T010 → T011 → T012, T013) depois da Phase 2; T014–T015 dependem de T006 (o `lib/roihub-crm.ts` da sirius chega pelo cherry-pick)
- **Polish (Phase 5)**: T020 depois de US1 e US2; T021 é do dono e destrava T022

### User Story Dependencies

- **US1**: independente de US2
- **US2**: independente de US1 no comportamento; compartilha só a Phase 2 e, na sirius, o arquivo trazido por T006

### Within Each User Story

- Teste escrito e falhando antes da implementação (T007 antes de T008; T010 antes de T011)
- Lógica em `lib/avisos.mjs` antes da rota que a chama
- Rota do hub publicada antes dos ganchos dos produtos (senão eles recebem 404 — inofensivo, mas polui o log)

### Parallel Opportunities

- T005 e T006 (repositórios diferentes)
- T014 e T016; T015 e T017 (repositórios diferentes)
- T018 com qualquer tarefa de código
- T003/T007/T010 tocam o mesmo arquivo de teste e T004/T008/T011 o mesmo `lib/avisos.mjs`: **não** são paralelas entre si

---

## Parallel Example: User Story 1

```text
Task: "T005 estetia: publicar 88352ee"
Task: "T006 sirius: cherry-pick de 9a0b5e81 no CRM/crm-project e push"
```

## Parallel Example: User Story 2 (produtos)

```text
Task: "T014 sirius: avisarTicketNoRoihub em lib/roihub-crm.ts"
Task: "T016 estetia: avisarTicketNoRoihub em lib/roihub-crm.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2
2. Phase 3 (US1), começando por T005/T006 — é o que destrava qualquer prova
3. **STOP and VALIDATE**: quickstart §4 com o bot configurado
4. Publicar

### Incremental Delivery

1. Setup + Foundational → envio e escape testados
2. US1 → lead novo avisando (MVP)
3. US2 → ticket novo e resposta do cliente avisando
4. Polish → handoff corrigido, portões conferidos, quickstart inteiro

---

## Notes

- 22 tarefas: 2 de setup (1 já feita), 2 fundacionais, 5 da US1, 8 da US2, 5 de polish
- Commit por grupo lógico, em inglês, com a linha de coautoria
- Na sirius, nunca `git add -A`: o clone tem `handoff.md` apagado e `.specify/`, `.claude/skills/` e `docs/screenshots/` não rastreados, que são do dono
- **Publicado em 15/09**: hub `bf50e54`; estetia `88352ee` + `7cf28cf` + `3c1845a`; sirius `bcb2c86` + `78971cd`
- O CI da estetia ficou vermelho no `7cf28cf`: `lib/logger.test.ts` proíbe `console.*` em código de runtime, e o `lib/roihub-crm.ts` (o helper de lead de 01/09 e o de ticket copiado dele) usava `console.error`. Corrigido em `3c1845a` com o `logger` do repo. O job de build, que é a trava do deploy, tinha passado
- ⚠️ O `main` da sirius tem regra de "mudança só por pull request" e check obrigatório "All Checks Passed". O push de 15/09 passou porque a conta do dono pode ignorar a regra — o GitHub registrou o bypass
- Verificação local da rota: `next dev` pelo PowerShell (pelo Git Bash toda rota de API deu 404); sem segredo, segredo errado, produto fora do contrato, JSON quebrado e chamada válida com token falso responderam 401, 401, 400, 400 e 502 (`telegram 401: Unauthorized`), como no contrato, e o token falso não apareceu no log
