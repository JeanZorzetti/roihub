# Implementation Plan: Avisos no Telegram — Atma, ROI Labs, Vértice e Coopluz

**Branch**: `027-avisos-dos-projetos` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/027-avisos-dos-projetos/spec.md`

## Summary

Três caminhos, escolhidos por onde cada evento já passa:

- **Vértice**: o lead já chega ao hub. `verticemarketing` entra em `PIPELINES_COM_AVISO` e o
  `avisoDeLead` da 026 faz o resto.
- **Atma, ROI Labs e Coopluz**: o evento vive no banco de cada projeto. Os três chamam uma rota
  genérica nova, `POST /api/avisos/evento`, com o texto já montado. O hub escapa o texto, põe o
  nome do projeto no título, monta o link a partir de uma base fixa e envia. O ROI Labs entra pelo
  `sendAlert`, que já concentra os alertas internos, e por isso todo alerta dele ganha o Telegram.
- **Queda da Atma**: um Cloudflare Worker, fora da VPS, checa o `/health` a cada 2 minutos, guarda
  o estado no KV e fala direto com o Telegram. A transição de estado é pura e mora no hub
  (`lib/vigia.mjs`), coberta por `node --test`.

## Technical Context

**Language/Version**: hub em Next.js 16.2 + `.mjs`, Node 22 · Atma backend em Express, CommonJS, Node 20 · ROI Labs `app/` em Next.js + Prisma · Coopluz em Astro 5.16 com `@astrojs/vercel` 8.2.9 · vigia em Cloudflare Workers (ESM)

**Primary Dependencies**: `fetch` nativo em todos. Única dependência declarada nova: `@vercel/functions` na Coopluz, que já está instalada como dependência do adapter (research R4). O `wrangler` roda por `npx`, fora do `package.json`

**Storage**: nada relacional. Estado do vigia numa chave do Workers KV (data-model.md)

**Testing**: hub — `node --test` (`test/avisos.test.mjs` estendido, `test/vigia.test.mjs` novo e registrado) · Atma — jest (`backend/tests/avisoRoihub.test.js`) · ROI Labs — `node --import tsx test/aviso-telegram.test.mjs`, registrado no script `test` · Coopluz — `node --test test/aviso.test.mjs` (o glob já pega). Prova ponta a ponta: quickstart

**Target Platform**: hub, Atma backend e painel ROI Labs no EasyPanel (VPS) · Coopluz e Vértice na Vercel · vigia no Cloudflare

**Project Type**: web-service, com mudanças em 4 repositórios e 1 Worker

**Performance Goals**: evento em até 60 s (na prática, um `fetch` de ~1 s) · queda em até 12 min, volta em até 2 min (SC-002 pede 15)

**Constraints**: aviso nunca bloqueia nem derruba o evento (FR-016) · token do bot nunca em log, e ele viaja na URL da Bot API (comentário do `enviarTelegram`) · push do hub fora das janelas do Princípio IV · um deploy por vez no EasyPanel

**Scale/Scope**: dezenas de eventos por mês e 1 chat · vigia com 720 execuções por dia, dentro do Free (research R7)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como a feature cumpre | Status |
|---|---|---|
| I. Contrato único de dados | Não lê `data/projects.json`. Os nomes dos projetos da rota nova são uma tabela local de 3 linhas em `lib/avisos.mjs`, porque `coopluz` nem existe em `pipelines.json` | ✅ |
| II. `node --test`, registrado à mão | `test/vigia.test.mjs` entra na lista do `package.json` no mesmo commit. Os casos novos de `avisos` vão para o arquivo que já está registrado | ✅ |
| III. `.mjs` pura, `.ts` na borda | Validação, montagem, corte, transição e checagem (com `fetch` injetável) em `lib/avisos.mjs` e `lib/vigia.mjs`. `route.ts` e `vigia/worker.mjs` só leem o ambiente, chamam e gravam | ✅ |
| IV. Push é deploy | Push do hub fora de 23:30–01:00 e 08:00–08:45 BRT. O Worker sai por `wrangler deploy` e não reinicia o contêiner | ✅ |
| V. Ambiente explícito, segredo fora de log | `/api/avisos/evento` devolve 503 com os nomes do `TELEGRAM_*` ausente. O Worker loga a falta pelo nome (`enviarTelegram` já devolve "ambiente ausente: …"). Os projetos logam só `ROIHUB_CRM_SECRET` pelo nome e o status HTTP | ✅ |
| Restrição: "Deploy por Docker" | O vigia é um Worker, não um contêiner | ⚠️ justificado em Complexity Tracking |

**Portões de merge**: `npm test` verde · teste novo registrado · nenhum import direto de
`data/projects.json` · nenhum segredo em log, resposta ou erro.

**Re-check pós-Fase 1**: sem mudança. O desenho não trouxe tabela, segredo novo nem dependência
além das listadas. O segredo do hub é o `CRM_INGEST_SECRET` que já existe (research R2).

## Project Structure

### Documentation (this feature)

```text
specs/027-avisos-dos-projetos/
├── spec.md
├── plan.md               # este arquivo
├── research.md           # decisões R1–R9
├── data-model.md         # corpo da rota, eventos por origem, estado do vigia
├── quickstart.md         # ambiente, vigia e roteiro de verificação
├── contracts/
│   └── avisos.md         # POST /api/avisos/evento, vigia e texto das mensagens
├── checklists/
│   └── requirements.md
└── tasks.md              # /speckit-tasks
```

### Source Code

```text
roihub/
├── lib/avisos.mjs                       # + verticemarketing; + parseAvisoEvento, avisoDeEvento
├── lib/vigia.mjs                        # NOVO — checar, passo, textoDoAviso
├── app/api/avisos/evento/route.ts       # NOVO — molde da rota de ticket
├── middleware.ts                        # CRM_INGEST_SECRET para o prefixo /api/avisos/
├── vigia/worker.mjs                     # NOVO — scheduled(): KV → checar → passo → Telegram → KV
├── vigia/wrangler.toml                  # NOVO — cron */2, KV VIGIA, ALVO_URL
├── .gitignore                           # vigia/.dev.vars e vigia/.wrangler
├── test/avisos.test.mjs                 # + evento, + verticemarketing
├── test/vigia.test.mjs                  # NOVO
├── package.json                         # registra test/vigia.test.mjs
└── GLOSSARIO.md                         # + termos da 027

atma/backend/
├── src/services/avisoRoihub.js          # NOVO — avisoPaciente, avisoParceria, avisar
├── src/controllers/patientController.js # + avisar() depois do INSERT, se !req.isAdmin
├── src/controllers/orthodontistController.js  # + avisar() depois do INSERT
├── tests/avisoRoihub.test.js            # NOVO
└── .env.example                         # ROIHUB_CRM_SECRET, ROIHUB_CRM_URL

ROI Labs/app/
├── src/lib/aviso-telegram.ts            # NOVO — alertaParaAviso (pura), avisarRoihub
├── src/lib/email.ts                     # sendAlert chama avisarRoihub
├── src/lib/assinaturas.ts               # + JANELA_DIAS, + alertarCancelamento
├── src/app/api/pagamentos/webhook/route.ts   # linha de assinatura; devolvido; renovação recusada
├── src/app/api/cron/assinaturas/route.ts     # importa JANELA_DIAS; alerta "sistema"
├── src/app/api/assinaturas/cancelar/route.ts # alerta "cliente" no caminho do token
├── test/aviso-telegram.test.mjs         # NOVO
├── package.json                         # registra o teste
└── .env.example                         # ROIHUB_CRM_SECRET, ROIHUB_CRM_URL

coopluz/
├── src/lib/aviso.mjs                    # NOVO — avisoDeLead (pura), avisar
├── src/pages/api/lead.ts                # + waitUntil(avisar(...)) quando created
├── test/aviso.test.mjs                  # NOVO
├── package.json                         # + @vercel/functions
└── .env.example                         # ROIHUB_CRM_SECRET, ROIHUB_CRM_URL
```

**Structure Decision**: um arquivo de aviso por projeto, porque cada um tem linguagem e forma de
teste diferentes, e nenhum compartilha pacote com os outros. O Worker mora no roihub para
importar `lib/avisos.mjs` e `lib/vigia.mjs` sem copiar código. O `wrangler` empacota imports
relativos, e `lib/crm.mjs`, único import de `avisos.mjs`, não usa API do Node.

## Ordem de entrega

A ordem vem da dependência:

1. **Hub**: rota, `lib/avisos.mjs`, middleware, `verticemarketing`, testes, glossário e o código
   do vigia. Push fora das janelas. Esse push leva junto os 2 commits de docs parados (026 e 027).
   Depois dele, a rota responde e a Vértice já avisa.
2. **Atma backend**: push e deploy pelo painel. Sem o segredo, só loga a falta.
3. **ROI Labs `app/`**: push e deploy, **depois** de o deploy da Atma terminar.
4. **Coopluz**: push. Vercel.
5. **Dono**: ambiente dos 3 projetos, conferência da Vértice e o vigia (quickstart §1). A SC-003
   entra antes de preencher os segredos (quickstart §3).
6. **Verificação**: quickstart §2 a §8.

Os passos 2 a 4 não dependem do passo 5: sem `ROIHUB_CRM_SECRET`, cada projeto segue igual a hoje
e registra a falta pelo nome.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Vigia fora do "Deploy por Docker" (Cloudflare Worker) | A FR-009 pede aviso com a VPS inteira fora, e toda a infraestrutura Docker da casa roda nessa VPS | Um contêiner no EasyPanel cai junto com o que vigia. O GitHub Actions `schedule` pode atrasar e descartar execuções em horário de pico (documentação oficial), o que fura a SC-002. Ver research R7 |
| `/api/avisos/evento` não valida o conteúdo por tipo de evento | São 11 eventos em 3 repositórios, e 6 deles já saem prontos do `sendAlert` | Uma rota tipada por evento poria no hub o modelo de pedido, assinatura e paciente, e cada campo novo exigiria deploy em dois lugares. O que protege o dono (escape, domínio do link, segredo) continua no hub (research R1) |
