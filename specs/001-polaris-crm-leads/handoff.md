# Handoff — CRM do roihub recebe leads do Polaris (spec 001) — 10/08/2026

**Estado**: **entrega completa (T001–T017), validada em produção.** As 3 stories (US1/US2/US3) funcionando no ar.

---

## O que foi entregue

### roihub
- `data/pipelines.json` — nova pipeline `polaris` (mesmas etapas de orion/atma/roilabs).
- `test/crm.test.mjs` — caso cobrindo `parseLead` com `pipeline: "polaris"`.

### sofia-next (`Imob/sofia-next`)
- `src/lib/roihub-crm.ts` (novo) — helper único: monta o payload do contrato, deriva `external_id` (sha256 de email+origem+janela de 2min) e dispara o `fetch` dentro de `after()`, best-effort (nunca lança).
- `src/app/api/crm/lead/route.ts` — reescrita: mesma validação/honeypot/formato de resposta de antes, mas chama `roihub-crm.ts` em vez do Sirius CRM. `subject` decide a origem (`early_access` → `polaris:early-access`, qualquer outro valor → `polaris:peca-seu-site`).
- `src/app/api/contact/route.ts` — ganhou uma chamada best-effort ao `roihub-crm.ts` depois do `prisma.salesLead.create`, sem alterar o insert nem a resposta ao visitante.
- `src/__tests__/integration/crm-lead.test.ts` e `crm-lead-intake.test.ts` — reescritos para mockar `sendLeadToRoihub` (ver nota técnica abaixo) em vez do Sirius.
- `src/__tests__/lib/roihub-crm.test.ts` (novo) — cobre a estabilidade do `external_id` dentro/fora da janela de 2min.
- `.env.example` / `.env.local` — `ROIHUB_CRM_URL` / `ROIHUB_CRM_SECRET` documentadas e configuradas para dev local.

### Bugs pré-existentes encontrados e corrigidos (fora do escopo original da spec, mas bloqueavam a própria US1)
1. **`src/middleware.ts`** — `/api/contact` nunca esteve na lista `isPublicApi`, só `/api/crm`. Isso significa que o formulário `/contato` vem retornando `401 Unauthorized` para qualquer visitante anônimo desde a criação do guard (`git blame`: 22/02/2026), independente desta spec. **Corrigido**: adicionada a exceção `pathname.startsWith('/api/contact')`. Sem isso, o Cenário 1 da US1 (lead de `/contato`) era impossível de completar — o middleware barra a requisição antes do meu código rodar.
2. **`jest.config.js`** — `packages/sofia-ai/package.json` tem BOM UTF-8 (commit de maio), quebrando o `jest-haste-map` para o repo inteiro (nenhum teste rodava, de forma nenhuma). Adicionado `modulePathIgnorePatterns` excluindo `packages/` e `.next/` (build output, mesmo problema).
3. **Ambiente de teste jsdom vs Route Handlers** — qualquer teste que importe uma rota que carregue `next/server` (`NextRequest`/`NextResponse`/`after`) quebra sob `jest-environment-jsdom` (`Request is not defined`) — também pré-existente, afeta outros testes não relacionados (ex.: `auth-login.test.ts`, deixado como está, fora de escopo). Nos 3 arquivos desta feature, adicionei o docblock `/** @jest-environment node */` — escopo mínimo, não mexi no ambiente global.

### Nota técnica: por que os testes mockam `sendLeadToRoihub`
`after()` do `next/server` lança `` `after` was called outside a request scope `` quando chamado fora do ciclo de vida real de uma request do Next.js — que é exatamente o caso ao invocar `POST(makeRequest(...))` direto num teste Jest. A saída correta é mockar `@/lib/roihub-crm` no boundary do módulo (`jest.mock`), não testar o `after()` em si — ele é 100% do framework, testado pelo próprio Next.js.

---

## Evidências

- **roihub**: `npm test` → **301/301 verde**.
- **sofia-next**: os 3 arquivos desta feature → **15/15 verde** (`crm-lead.test.ts`, `crm-lead-intake.test.ts`, `roihub-crm.test.ts`). Suíte completa do sofia-next tem ~24 suítes com falhas **pré-existentes e não relacionadas** (ownership tests, squads, e2e Playwright pego por engano pelo `testMatch` do Jest, `auth-login`/`auth-register` — todas já quebradas antes desta sessão, nenhuma toca em `crm`/`contact`/`roihub-crm`).
- **E2E real (dev local, servidores subidos e derrubados nesta sessão)**:
  1. Subi roihub em `:3199` e sofia-next em `:3000`.
  2. `POST /api/crm/lead` (sofia-next, subject `site-intake`) enviado **duas vezes** em ~3s com o mesmo payload.
  3. Query direta no Postgres do roihub (`crm_leads WHERE pipeline='polaris'`): **uma única linha** (`id=4`, `external_id` = mesmo hash sha256 nas duas tentativas) — dedupe via `UNIQUE(external_id)` + `ON CONFLICT DO NOTHING` confirmado ponta a ponta.
  4. Linhas de teste (`id=3` sanity check, `id=4` dedupe) **apagadas** do banco depois da validação — não sobrou lixo na pipeline real.
  5. `/api/contact` **não** foi validado ponta a ponta localmente (só em produção, ver abaixo): o `DATABASE_URL` local do sofia-next (`.env.local`) aponta para `31.97.23.166:5499` — porta de proxy já conhecida como bloqueada — e o Prisma falha com `500` antes mesmo de chegar no meu código. Pré-existente, não relacionado a esta feature, não corrigido (fora do escopo — mudar `DATABASE_URL` é uma decisão de infra que não me cabe tomar sozinho).

- **T015 — env vars em produção**: você configurou `CRM_INGEST_SECRET` (roihub) e `ROIHUB_CRM_URL`/`ROIHUB_CRM_SECRET` (sofia-next) no EasyPanel. `CRM_INGEST_SECRET` **não existia em produção antes** — o que significa que `/api/crm/leads` vinha devolvendo `401` pra qualquer chamada (inclusive da Orion, se já usava o endpoint). Corrigido.

- **T016 — os 4 cenários do quickstart, rodados de verdade contra produção** (`hub.roilabs.com.br` + `polarisia.com.br`), depois de eu commitar, dar `git push` (auto-deploy do EasyPanel) e esperar o build subir (~5min):
  1. **Cenário 1** (`/contato`): `POST /api/contact` → `200 {"success":true,"data":{"id":"0db58857-..."}}`. Confirma também que o fix do middleware (`/api/contact` isento de auth) está no ar.
  2. **Cenário 2** (intake + early access, origem distinguível): `POST /api/crm/lead` com `subject: "early_access"` e `subject: "site-intake"` → dois cards com `origem` = `polaris:early-access` e `polaris:peca-seu-site` respectivamente, confirmados por query direta no Postgres de produção.
  3. **Cenário 3** (dedupe): o mesmo `site-intake` enviado **duas vezes** em produção → **uma única linha** em `crm_leads` (mesmo `external_id` sha256 nas duas tentativas).
  4. **Cenário 4** (roihub indisponível não afeta o visitante): não testado ativamente (derrubar o roihub de produção pra isso não vale o risco) — é garantia estrutural do `after()` + try/catch em `roihub-crm.ts`, não um comportamento condicional que possa regredir sem eu perceber.
  5. As 5 linhas de teste criadas em produção (`teste-prod-spec001-*@example.com`, mais 2 de sanity-check) foram **apagadas** de `crm_leads`/`crm_eventos` depois da validação — a pipeline `polaris` ficou limpa.
  6. **Sobrou 1 linha de teste não limpa**: o `salesLead` criado pelo Cenário 1 (`id 0db58857-cf41-4a8a-975f-b23978c2bb6a`, email `teste-prod-spec001-contato@example.com`) no Postgres do **Polaris** (não do roihub) — não achei uma connection string de produção confiável pra esse banco nesta sessão (a do `.env.local` aponta pro proxy bloqueado citado acima). Ação sua: apagar esse `salesLead` de teste quando tiver acesso.

---

## Commits

- **roihub**: `a07b0ad` — `feat(crm): add polaris pipeline for Polaris lead ingestion`.
- **sofia-next**: `858658f` — `feat(crm): route Polaris leads to the roihub CRM instead of Sirius`.

Ambos em `main`, pushados e já deployados (EasyPanel com auto-deploy via git push, confirmado pelos testes de produção acima).

---

## Arquivos alterados

```
roihub/data/pipelines.json
roihub/test/crm.test.mjs
roihub/specs/001-polaris-crm-leads/tasks.md        (checkboxes)

Imob/sofia-next/.env.example
Imob/sofia-next/.env.local
Imob/sofia-next/jest.config.js                      (fix pré-existente)
Imob/sofia-next/src/middleware.ts                    (fix pré-existente, bloqueava US1)
Imob/sofia-next/src/lib/roihub-crm.ts                (novo)
Imob/sofia-next/src/app/api/crm/lead/route.ts
Imob/sofia-next/src/app/api/contact/route.ts
Imob/sofia-next/src/__tests__/integration/crm-lead.test.ts
Imob/sofia-next/src/__tests__/integration/crm-lead-intake.test.ts
Imob/sofia-next/src/__tests__/lib/roihub-crm.test.ts (novo)
```

Commits separados por repositório (são repos independentes, sem monorepo) — ver seção "Commits" acima.
