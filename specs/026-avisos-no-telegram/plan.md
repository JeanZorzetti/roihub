# Implementation Plan: Avisos no Telegram — lead novo e ticket de suporte da Sirius e da Estetia

**Branch**: `026-avisos-no-telegram` | **Date**: 2026-09-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/026-avisos-no-telegram/spec.md`

## Summary

O hub passa a mandar mensagem ao Telegram do dono em três eventos da Sirius e da Estetia:

- **Lead novo** — gancho na ingestão que já existe (`POST /api/crm/leads`), disparado só quando
  `insertLead` devolve `created: true` e a pipeline é `sirius` ou `estetiacrm`. O dedupe da FR-002
  vem pronto do `UNIQUE(external_id)`.
- **Ticket novo** e **cliente respondeu** — os dois produtos chamam uma rota nova do hub,
  `POST /api/avisos/ticket`, com o mesmo segredo e o mesmo helper best-effort (`after()`, nunca
  lança) que já usam para mandar lead.

Validação do payload, filtro de pipeline, texto e escape da mensagem e o envio à Bot API moram em
`lib/avisos.mjs`, pura e coberta por `node --test`. As rotas `.ts` só ligam as pontas.

Antes de tudo, os commits de lead de 01/09 que nunca subiram vão para a produção dos dois
produtos — sem isso a história 1 nasce muda (spec, "⚠️ O lead dessas duas origens não chega ao hub
hoje").

## Technical Context

**Language/Version**: TypeScript + ESM (`.mjs`), Node 22. Hub em Next.js 16.2; Sirius e Estetia em Next.js 16.1.1

**Primary Dependencies**: nenhuma nova. `fetch` nativo para a Bot API do Telegram; `after()` de `next/server` (já usado em `lib/roihub-crm.ts` dos produtos)

**Storage**: nada novo. O aviso não é gravado; o lead segue em `crm_leads` (hub) e o ticket em `SupportTicket`/`SupportMessage` (cada produto)

**Testing**: `node --test` — `test/avisos.test.mjs` no hub, registrado em `package.json`. Nos produtos o gancho é uma chamada best-effort sem ramo próprio; a prova é o quickstart E2E

**Target Platform**: 3 containers Docker no EasyPanel (VPS Linux), auto-deploy por push em `main`

**Project Type**: web-service — rotas de API em 3 repositórios

**Performance Goals**: mensagem em até 60 s (SC-002); na prática um `fetch` de ~1 s depois do evento

**Constraints**: aviso nunca bloqueia nem derruba lead, ticket ou resposta (FR-010); token do bot nunca em log — e ele viaja **na URL** da Bot API, então nenhum log imprime URL nem erro cru do `fetch` (FR-011, Princípio V); push do hub fora das janelas do Princípio IV

**Scale/Scope**: dezenas de leads e tickets por mês, 1 chat de destino; o limite da Bot API (~1 mensagem/s por chat) fica ordens de grandeza acima

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como a feature cumpre | Status |
|---|---|---|
| I. Contrato único de dados | Não lê `data/projects.json`. O nome do produto vem de `data/pipelines.json`, que a rota de leads já importa | ✅ |
| II. `node --test`, registrado à mão | `test/avisos.test.mjs` entra na lista do `package.json` no mesmo commit; `test/validade.test.mjs` reprova a divergência | ✅ |
| III. `.mjs` pura, `.ts` na borda | Filtro, validação, texto, escape e envio (com `fetch` injetável) em `lib/avisos.mjs`; `route.ts` só lê ambiente, chama e responde | ✅ |
| IV. Push é deploy | Push do hub fora de 23:30–01:00 e 08:00–08:45 BRT | ✅ |
| V. Ambiente explícito, segredo fora de log | Rota de ticket devolve `503 { error: "missing-env", fields }` sem `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`. Log de falha leva só status e `description` do Telegram | ✅ com uma exceção justificada em Complexity Tracking |

**Portões de merge**: `npm test` verde · teste novo registrado · nenhum import direto de
`data/projects.json` · nenhum segredo em log, resposta ou erro.

**Re-check pós-Fase 1**: sem mudança. O desenho não adicionou dependência, tabela, segredo nem rota
além das listadas.

## Project Structure

### Documentation (this feature)

```text
specs/026-avisos-no-telegram/
├── spec.md
├── plan.md               # este arquivo
├── research.md           # decisões R1–R9
├── data-model.md         # os 3 avisos — nada é gravado
├── quickstart.md         # bot, ambiente e roteiro de verificação
├── contracts/
│   └── avisos.md         # POST /api/avisos/ticket + texto das 3 mensagens
├── checklists/
│   └── requirements.md
└── tasks.md              # /speckit-tasks
```

### Source Code

```text
roihub/
├── lib/avisos.mjs                                   # NOVO
├── app/api/avisos/ticket/route.ts                   # NOVO
├── app/api/crm/leads/route.ts                       # + after() quando created
├── middleware.ts                                    # /api/avisos/ticket no bloco do CRM_INGEST_SECRET
├── test/avisos.test.mjs                             # NOVO
├── package.json                                     # registra o teste
├── .env.example                                     # TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
├── GLOSSARIO.md                                     # NOVO — termos dos avisos
└── handoff/funil-seo/00-LEIA-PRIMEIRO.md            # corrige o "ENTREGUE 01/09"

sirius (CRM/crm-project) e estetia (Doc-CRM) — a mesma mudança nos dois:
├── lib/roihub-crm.ts                                # sirius: chega pelo cherry-pick de 9a0b5e81; + avisarTicketNoRoihub()
├── app/api/support/tickets/route.ts                 # + 1 chamada depois do create
└── app/api/support/tickets/[id]/messages/route.ts   # + 1 chamada quando !ctx.isRoiLabsStaff
```

**Structure Decision**: nenhuma pasta nova além da rota. O helper de ticket entra no
`lib/roihub-crm.ts` que já carrega endereço, segredo e o padrão `after()` + nunca lança; um arquivo
a mais por produto só duplicaria essas três coisas.

## Ordem de entrega

A ordem vem da dependência, não de preferência:

1. **Estetia** — push de `88352ee` (já em `main`, 0 atrás do `origin`).
2. **Sirius** — cherry-pick de `9a0b5e81` no `CRM/crm-project`, sem levar as mudanças locais não
   commitadas desse clone (`handoff.md` apagado, `.specify/` e `.claude/skills/` não rastreados).
3. **Hub** — `lib/avisos.mjs` + teste, as duas rotas, middleware, `.env.example`, glossário e a
   correção do handoff. Push fora das janelas.
4. **Sirius e Estetia** — ganchos de ticket novo e de resposta do cliente. Push.
5. **Dono** — criar o bot e preencher o ambiente dos 3 serviços no EasyPanel (quickstart, passo 1).
6. **Verificação** — quickstart, passos 2 a 6.

Os passos 1–4 não dependem do bot: sem `TELEGRAM_*` o hub segue gravando lead e a rota de ticket
responde 503 com os nomes — o produto, em `after()`, só registra o status. Esse intervalo é também
o momento natural de provar a SC-003 (quickstart, passo 6).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| `POST /api/crm/leads` **não** devolve 503 quando `TELEGRAM_*` falta, embora o Princípio V peça 503 para ambiente ausente | O dever dessa rota é gravar o lead; o Telegram é acessório nela | 503 por falta do bot perderia o lead — exatamente o que a FR-010 proíbe. A falta vai para o log pelo nome da variável, sem valor |
