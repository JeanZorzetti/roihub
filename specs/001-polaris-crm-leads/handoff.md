# Handoff — CRM do roihub recebe leads do Polaris (spec 001) — 10/08/2026

**Estado**: código completo (T001–T014), testado localmente com evidências reais.
**Falta**: T015/T016 — configurar env vars em produção (EasyPanel) e validar lá. Preciso de acesso ao painel, que não tenho neste ambiente.

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
  5. `/api/contact` **não** foi validado ponta a ponta: o `DATABASE_URL` local do sofia-next (`.env.local`) aponta para `31.97.23.166:5499` — porta de proxy já conhecida como bloqueada — e o Prisma falha com `500` antes mesmo de chegar no meu código. Pré-existente, não relacionado a esta feature, não corrigido (fora do escopo — mudar `DATABASE_URL` é uma decisão de infra que não me cabe tomar sozinho).

---

## Pendente — precisa de você

### T015 — env vars em produção (EasyPanel, serviço sofia-next)
Adicionar em produção:
```
ROIHUB_CRM_URL=https://hub.roilabs.com.br
ROIHUB_CRM_SECRET=<mesmo valor de CRM_INGEST_SECRET no roihub em produção>
```
⚠️ Esta é exatamente a etapa que faltou na integração Sirius e a deixou quebrada (500) sem ninguém notar — sem ela, a feature funciona local e falha silenciosamente em produção (best-effort = sem erro visível, só ausência do lead no CRM).

**Nota**: localmente eu defini `CRM_INGEST_SECRET` no `.env` do roihub (não existia antes) e espelhei o mesmo valor em `ROIHUB_CRM_SECRET` no `.env.local` do sofia-next. Em produção, os dois ambientes já podem ter segredos distintos configurados — confirme o valor real de `CRM_INGEST_SECRET` no serviço roihub do EasyPanel antes de copiar.

### T016 — validar os 4 cenários do [quickstart.md](./quickstart.md) contra produção
Depois do deploy de ambos os repos (roihub primeiro, sofia-next depois — ver seção "Ordem de deploy" no [tasks.md](./tasks.md)):
1. Enviar `/contato` → conferir card `polaris:contato` em `hub.roilabs.com.br/crm`.
2. Enviar `/peca-seu-site` e `/early-access` → conferir os outros 2 cards.
3. Reenviar o mesmo formulário 2x em <2min → confirmar 1 único card (mecanismo já provado localmente, só falta confirmar em produção).
4. Cenário 4 (roihub indisponível não afeta o visitante) — não precisa derrubar produção para testar; já é garantido pelo `after()` + try/catch do `roihub-crm.ts` (best-effort estrutural, não condicional).

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

Nenhum commit foi feito — os dois repositórios têm mudanças pendentes de revisão e commit separado (são repos independentes, sem monorepo).
