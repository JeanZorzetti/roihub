---

description: "Task list — 027 avisos dos projetos"
---

# Tasks: Avisos no Telegram — Atma, ROI Labs, Vértice e Coopluz

**Input**: Design documents from `/specs/027-avisos-dos-projetos/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/avisos.md, quickstart.md

**Tests**: incluídos. A spec não pede, mas a constituição do hub exige (Princípios II e III), e o
plano define um teste por repositório (seção Testing). Nos três produtos, o teste cobre a função
pura e o `avisar()` que nunca lança (FR-016, FR-018).

**Organization**: por história. Quatro repositórios, com caminhos relativos a cada um. Estado
medido em 16/09/2026:

- **hub** = `C:\Users\jeanz\OneDrive\Desktop\ROI Labs\roihub` — `main` 3 à frente de `origin` (só docs da 026 e da 027)
- **atma** = `C:\dev\atma` — em dia, limpo; o código mora em `backend/`
- **roilabs** = `C:\Users\jeanz\OneDrive\Desktop\ROI Labs\ROI Labs` — limpo, **3 atrás** de `origin` (só `Docs/Obsidian/90-medicao`); o código mora em `app/`
- **coopluz** = `C:\dev\coopluz` — em dia, limpo

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivo ou repositório diferente, sem dependência pendente)
- **[Story]**: US1 (lead e candidatura), US2 (queda da Atma) ou US3 (dinheiro do ROI Labs)

---

## Phase 1: Setup

**Purpose**: repositórios em dia, ambiente declarado e vocabulário fixado

- [X] T001 roilabs: `git pull --ff-only` antes de qualquer edição (os 3 commits de `origin` são de medição semanal e não tocam `app/`)
- [X] T002 [P] hub: acrescentar `vigia/.dev.vars` e `vigia/.wrangler/` ao `.gitignore`, com o porquê (secrets do `wrangler dev` e cache local do quickstart §5)
- [X] T003 [P] hub: acrescentar ao `GLOSSARIO.md` os termos da 027 como saem no contrato §3–§4: "Pedido de parceria", "Fora do ar", "De volta", "Pagamento devolvido", "Contestação no cartão", "Renovação recusada", "Assinatura cancelada", cada um com o que evitar e onde aparece
- [X] T004 [P] atma: declarar `ROIHUB_CRM_SECRET` e `ROIHUB_CRM_URL` sem valor em `backend/.env.example`, com comentário (avisos no Telegram pelo hub, spec 027; sem o segredo o lead grava igual e o log traz só o nome; a URL tem padrão `https://hub.roilabs.com.br`)
- [X] T005 [P] roilabs: o mesmo de T004 em `app/.env.example`
- [X] T006 [P] coopluz: o mesmo de T004 em `.env.example`
- [X] T007 [P] coopluz: declarar `@vercel/functions` em `package.json` na versão que já está no `node_modules` pelo adapter (`npm install @vercel/functions@2.2.13`), conferindo no `package-lock.json` que nenhum pacote novo foi baixado (R4)

---

## Phase 2: Foundational (bloqueia US1 e US3)

**Purpose**: a rota `POST /api/avisos/evento`, por onde Atma, ROI Labs e Coopluz falam com o
Telegram. A US2 não passa por ela e pode começar já.

**⚠️ CRITICAL**: nenhum produto chama o hub antes desta fase estar publicada (sem ela, 404 no log)

- [X] T008 hub: acrescentar a `test/avisos.test.mjs` (devem falhar) os casos de `parseAvisoEvento(body)`: `projeto` fora de `atma`/`roilabs`/`coopluz`, `titulo` vazio depois de aparar e `caminho` fora de `^/[A-Za-z0-9/_-]{0,199}$` (inclui `//evil.com` e `https://…`) → `{ ok: false, erro }`; `titulo` acima de 120 e `texto` acima de 3.500 são cortados antes do escape, o texto com "…"; quebras de linha do `texto` mantidas; `acao` aparada, até 40, padrão "Abrir no painel" — e de `avisoDeEvento(aviso)`: título em negrito com " · Atma", " · ROI Labs" ou " · Coopluz" só quando o nome não está no título; `titulo`, `texto` e `acao` com `<b>&` escapados; link com a base fixa do projeto (data-model.md) mais o `caminho`; sem `caminho`, nenhuma linha de link e `acao` ignorada (contracts/avisos.md §1)
- [X] T009 hub: implementar `parseAvisoEvento` e `avisoDeEvento` em `lib/avisos.mjs` até T008 passar, com a tabela local de 3 projetos (nome e base do link) e o comentário do porquê de não vir de `pipelines.json` (`coopluz` não existe lá; Princípio I, R1, R9)
- [X] T010 hub: criar `app/api/avisos/evento/route.ts` no molde de `app/api/avisos/ticket/route.ts`: `faltandoTelegram` → 503 `{ error: "missing-env", fields }`; JSON inválido → 400; `parseAvisoEvento` falhou → 400 `{ error }`; `enviarTelegram(avisoDeEvento(...))` aguardado → 200 `{ enviado: true }` ou 502 `{ error }`, com `console.error("[avisos] evento <projeto>: <erro>")`
- [X] T011 hub: em `middleware.ts`, trocar o teste de `/api/avisos/ticket` por prefixo `/api/avisos/`, mantendo `/api/crm/leads`, e ajustar o comentário: toda rota de aviso nova já nasce fechada pelo `CRM_INGEST_SECRET` (R2)

**Checkpoint**: `npm test` verde; `next dev` pelo **PowerShell** (pelo Git Bash as rotas de API dão 404) responde 401 sem segredo, 400 para `projeto: "x"`, 400 para `caminho: "//evil.com"` e 502 `telegram 401` com token falso, sem o token no log

---

## Phase 3: User Story 1 — Lead e candidatura dos quatro projetos chegam no Telegram (Priority: P1) 🎯 MVP

**Goal**: lead novo da Vértice, da Coopluz e da Atma, pedido de parceria da Atma, candidatura e
lead de consumidor do ROI Labs viram mensagem com o projeto na primeira linha

**Independent Test**: quickstart §4 — 6 envios, 6 mensagens; os 3 duplicados da lista geram 0

### Vértice (hub)

- [X] T012 [US1] hub: acrescentar a `test/avisos.test.mjs` o caso de `avisoDeLead` com pipeline `verticemarketing` e origem `verticemarketing:contato` → "🟢 <b>Lead novo · Vértice Marketing</b>" e "pelo formulário de contato" (contrato §3); os casos da 026 ficam intocados (FR-020)
- [X] T013 [US1] hub: acrescentar `verticemarketing` a `PIPELINES_COM_AVISO` em `lib/avisos.mjs` até T012 passar (R3)

### Atma

- [X] T014 [US1] atma: escrever `backend/tests/avisoRoihub.test.js` (jest, deve falhar): `avisoPaciente(lead)` → `{ projeto: "atma", titulo: "🟢 Lead novo", texto, caminho: "/admin/pacientes" }` com "<nome>, paciente", e-mail, telefone e cidade, linha omitida quando o campo falta, e **nunca** `observacoes` mesmo preenchida; `avisoParceria(p)` → "🤝 Pedido de parceria", "<nome>, <clínica>", cidade/UF, e-mail, telefone, `caminho: "/admin/crm"`, sem CRO, `mensagem` nem `valorParteClinica`; `avisar(aviso, env, fetchImpl)`: sem `ROIHUB_CRM_SECRET` loga só o nome e não chama o `fetch`; chama `${ROIHUB_CRM_URL ?? "https://hub.roilabs.com.br"}/api/avisos/evento` com `Authorization: Bearer`; resposta fora de 2xx loga só o status; `fetch` que lança não propaga; nenhum log contém o segredo
- [X] T015 [US1] atma: implementar `backend/src/services/avisoRoihub.js` (CommonJS, `fetch` nativo, logger do backend) até T014 passar (R5)
- [X] T016 [P] [US1] atma: em `backend/src/controllers/patientController.js`, depois do `INSERT INTO patient_leads` (≈ linha 44), chamar `avisar(avisoPaciente(...))` **sem `await`** e só quando `!req.isAdmin` (cadastro manual pelo painel usa a mesma rota com `x-admin-key`, FR-003)
- [X] T017 [P] [US1] atma: em `backend/src/controllers/orthodontistController.js`, depois do `INSERT INTO crm_leads` de `createPartnershipRequest` (≈ linha 36), chamar `avisar(avisoParceria(...))` sem `await`
- [X] T018 [US1] atma: `npx jest` em `backend/` verde, incluindo `patientController.test.js` e `validate*.test.js` (o aviso não pode mudar status nem corpo das respostas)

### ROI Labs (canal no `sendAlert`)

- [X] T019 [US1] roilabs: escrever `app/test/aviso-telegram.test.mjs` (deve falhar) e registrá-lo no script `test` de `app/package.json` (`node --import tsx test/aviso-telegram.test.mjs`): `alertaParaAviso(subject, html)` → `projeto: "roilabs"`; título = assunto até o primeiro " — ", com entidades desfeitas ("💰 Pedido pago — Maria · R$ 900" → "💰 Pedido pago"); o primeiro `<a href="https://app.roilabs.com.br/...">` vira `caminho` + `acao` e sai do corpo; link de outro domínio fica só como texto; `</p>`, `<br>`, `</li>`, `</h2>`, `</ul>` viram quebra, `<li>` vira "• ", demais tags somem, entidades desfeitas, linhas vazias e espaços repetidos saem; um `caminho` que não caberia na regra da rota (query string, por exemplo) é descartado em vez de derrubar o aviso com 400 — e `avisarRoihub(aviso, env, fetchImpl)`: sem segredo loga só o nome e não chama o `fetch`; fora de 2xx loga só o status; nunca lança (R6)
- [X] T020 [US1] roilabs: implementar `alertaParaAviso` e `avisarRoihub` em `app/src/lib/aviso-telegram.ts` até T019 passar, usando o `log` de `@/lib/log`
- [X] T021 [US1] roilabs: em `app/src/lib/email.ts`, `sendAlert(subject, html)` passa a chamar também `avisarRoihub(alertaParaAviso(subject, html))`, solto como o ntfy; e-mail e push seguem iguais; atualizar o comentário "Canais paralelos" para os três canais (FR-014). Com isso, candidatura e lead de consumidor (e os outros 4 alertas que já existem) ganham Telegram sem tocar nos chamadores

### Coopluz

- [X] T022 [US1] coopluz: escrever `test/aviso.test.mjs` (deve falhar; o glob `test/*.test.mjs` já pega): `avisoDeLead(lead, solucao)` → `{ projeto: "coopluz", titulo: "🟢 Lead novo", caminho: "/leads" }`, texto "<nome>, pela página <Solucao.nome>", WhatsApp e a terceira linha "Conta de luz: …" ou "Cidade: …" conforme o formulário, omitida quando falta; ip, user agent e referer nunca entram — e `avisar(aviso, env, fetchImpl)` com os mesmos casos de T014
- [X] T023 [US1] coopluz: implementar `src/lib/aviso.mjs` até T022 passar, lendo os campos reais que `parseLead` (`src/lib/lead.mjs`) devolve para cada solução
- [X] T024 [US1] coopluz: em `src/pages/api/lead.ts`, quando `gravarLead` devolver `created: true` (≈ linha 74), chamar `waitUntil(avisar(avisoDeLead(...), import.meta.env))` de `@vercel/functions` antes do `return`; `duplicado: true` não avisa (FR-002, R4)
- [X] T025 [US1] coopluz: `npm test` e `npm run build` verdes (o build prova que o adapter empacota o `@vercel/functions`)

**Checkpoint**: US1 completa no código nos 4 repositórios; prova em produção depende de T045–T047

---

## Phase 4: User Story 2 — Backend da Atma fora do ar chega no Telegram (Priority: P2)

**Goal**: um Worker fora da VPS avisa a queda depois de 10 minutos e a volta com a duração

**Independent Test**: quickstart §5 — queda de 4 min, 0 mensagens; queda de 15 min, exatamente 2; banco fora, motivo "sem banco de dados"

**Depende só da Phase 1 (T002)**: pode andar em paralelo com a Phase 2 e a US1, mas T026–T027 e T008–T013 tocam `package.json`/`test/` do hub, então não no mesmo commit sem cuidado

### Testes (devem falhar antes da implementação)

- [X] T026 [US2] hub: escrever `test/vigia.test.mjs` e registrá-lo na lista de `test` do `package.json` no mesmo commit (o `test/validade.test.mjs` reprova se não): `checar(url, fetchImpl)` nas 5 linhas da tabela do data-model (exceção ou mais de 10 s → "sem resposta"; fora de 2xx → "erro 502"; 2xx sem JSON → "resposta inesperada"; JSON sem `status: "OK"` → "sem banco de dados"; `status: "OK"` → ok); `passo(estado, checagem, agora)` nas 7 transições, com `{ estado, aviso, mudou }` exatos (inclui 9 min 59 s sem aviso e 10 min com aviso; oscilação curta limpa em silêncio; volta só se `avisado`); `textoDoAviso(aviso, alvoUrl)`: queda "🔴 <b>Fora do ar · Atma</b>" / "Backend sem resposta desde 14:32 de 16/09" e os 4 motivos ("com erro 502", "sem banco de dados", "com resposta inesperada"); volta "✅ <b>De volta · Atma</b>" com "23 min" e "2 h 05 min"; queda que atravessa o dia leva data nos dois horários; hora em BRT por deslocamento fixo de −3 h (o teste passa igual com `TZ` qualquer); link "Abrir a checagem" com a URL escapada (contrato §3, R8)

### Implementação

- [X] T027 [US2] hub: implementar `checar`, `passo` e `textoDoAviso` em `lib/vigia.mjs` até T026 passar, com `fetchImpl` injetável e timeout de 10 s por `AbortSignal.timeout`; o comentário da constante de −3 h diz o que trocar se o horário de verão voltar (R8)
- [X] T028 [US2] hub: criar `vigia/worker.mjs` com `export default { scheduled(controller, env, ctx) }`: lê a chave `atma` do KV `VIGIA` → `checar(env.ALVO_URL)` → `passo` → se houver aviso, `enviarTelegram(textoDoAviso(...), env)` e só grava (ou apaga a chave) se o envio for aceito; sem aviso, grava/apaga só quando `mudou`; falha de envio vira `console.error` com o `erro` de `enviarTelegram` (já sem token), e o estado fica para a próxima execução (data-model.md, Transições)
- [X] T029 [US2] hub: criar `vigia/wrangler.toml`: `name = "roihub-vigia"`, `main = "worker.mjs"`, `compatibility_date`, `[triggers] crons = ["*/2 * * * *"]`, `[vars] ALVO_URL = "https://atmaapi.roilabs.com.br/api/system/health"`, `[[kv_namespaces]] binding = "VIGIA"` com o `id` a preencher no quickstart §1 e um comentário dizendo isso; os secrets `TELEGRAM_*` não entram no arquivo
- [X] T030 [US2] hub: `npx wrangler deploy --dry-run --outdir <scratchpad>` dentro de `vigia/` para provar que o bundle resolve `../lib/vigia.mjs`, `../lib/avisos.mjs` e o `lib/crm.mjs` que ele importa, sem API do Node (Structure Decision do plano); nada é publicado

**Checkpoint**: `npm test` verde com `test/vigia.test.mjs` na contagem; bundle do Worker resolvido. Publicação e prova dependem do dono (T046, quickstart §1 e §5)

---

## Phase 5: User Story 3 — Dinheiro do ROI Labs chega no Telegram (Priority: P3)

**Goal**: pedido pago (dizendo se abre assinatura), pagamento devolvido, contestação, renovação
recusada e assinatura cancelada pelo cliente ou pelo sistema saem nos três canais

**Independent Test**: quickstart §6 — resumo semanal chega no Telegram; cancelamento pelo link do cliente gera 1 mensagem e o segundo clique, 0

**Depende de T021** (o canal Telegram do `sendAlert`) e da Phase 2 publicada

- [X] T031 [US3] roilabs: mover `JANELA_DIAS` (7) de `app/src/app/api/cron/assinaturas/route.ts` para um `export const` em `app/src/lib/assinaturas.ts` e importá-lo na rota, com o porquê (o alerta de renovação recusada precisa da mesma data; R6)
- [X] T032 [US3] roilabs: criar `alertarCancelamento(assinaturaId, quem: 'cliente' | 'sistema')` em `app/src/lib/assinaturas.ts`: busca a assinatura com o pedido (nome, WhatsApp, `slug`) e chama `sendAlert("⛔ Assinatura cancelada — {nome}", corpo)` com `{nome} · {whatsapp}` / `Assinatura {slug}` / "Cancelada pelo cliente." ou "Cancelada por falta de pagamento: 7 dias sem cobrança aprovada." (o 7 vem de `JANELA_DIAS`) e `<a href="https://app.roilabs.com.br/admin/assinaturas">Abrir no admin</a>`; valores por `escapeHtml`; qualquer erro vira log e nunca propaga (FR-016). **Executado** com a assinatura (`{ id, slug, pedidoId }`) no lugar do id: os dois chamadores já a têm, e isso poupa uma consulta
- [X] T033 [US3] roilabs: em `app/src/app/api/pagamentos/webhook/route.ts`, no `sendAlert` do pedido pago (≈ linha 224), acrescentar "Assinatura: renova sozinha a cada ciclo." quando `cancelToken` existir (FR-010)
- [X] T034 [US3] roilabs: no mesmo arquivo, no ramo `refunded`/`charged_back` (≈ linha 240), guardar `pedido.statusPagamento` antes do update e só chamar `sendAlert` se ele não era `reembolsado` — hoje o ramo regrava a cada notificação repetida; assunto "↩️ Pagamento devolvido — {nome} · {total}" com "Total devolvido: {total}", ou "⚠️ Contestação no cartão — {nome} · {total}" com "O cliente contestou a compra com o banco. Responda a disputa no Mercado Pago."; link `/admin/pedidos` (FR-011, contrato §3). **Achado na execução**: a trava do topo do webhook (`mesmo mpPaymentId e fora de pendente`) descartava a devolução e a contestação de um pedido pago, que chegam com o mesmo id do pagamento aprovado — o ramo nunca rodava, e um reembolso feito no painel do MP ou uma contestação deixavam o pedido `pago`. A trava virou `notificacaoJaAplicada` em `app/src/lib/mercadopago.ts`, com `app/test/webhook-reembolso.test.mjs` registrado: devolução e contestação passam até o pedido ficar `reembolsado`; os outros casos seguem iguais
- [X] T035 [US3] roilabs: no mesmo arquivo, no ramo de renovação recusada (≈ linha 282–291), chamar `sendAlert("⚠️ Renovação recusada — {nome}", …)` dentro de um `if (decisao.setarJanela)` **próprio** — o `if` atual também exige `pedido.email`, e o dono precisa do aviso mesmo sem e-mail do cliente; corpo `{nome} · {whatsapp}` / `Assinatura {slug} · {total}` / "Cancela sozinha em {dd/mm} se nenhuma cobrança passar." (data = início da janela + `JANELA_DIAS`); link `/admin/assinaturas`; renovação aprovada não passa por aqui (FR-012)
- [X] T036 [P] [US3] roilabs: em `app/src/app/api/cron/assinaturas/route.ts`, depois de cada `await cancelarAssinatura(a)` que não lançou (≈ linha 34), `await alertarCancelamento(a.id, 'sistema')` (FR-013)
- [X] T037 [P] [US3] roilabs: em `app/src/app/api/assinaturas/cancelar/route.ts`, depois do `cancelarAssinatura` bem-sucedido (linha 38), chamar `alertarCancelamento(assinatura.id, 'cliente')` **só no caminho do `token`**; o caminho do `id` (equipe no painel) não avisa, e o `noop` de assinatura já cancelada sai antes (FR-013)
- [X] T038 [US3] roilabs: `npm test` e `npx tsc --noEmit` em `app/` verdes (as regressões de assinatura — `assinatura-dedupe`, `assinatura-maquina-estado`, `assinatura-cancel-token`, `mercadopago-assinatura-regressao` — continuam passando)

**Checkpoint**: US3 completa no código; pago, devolvido e renovação recusada só se provam com dinheiro real ou no primeiro evento real (quickstart §6)

---

## Phase 6: Polish & entrega

- [X] T039 hub: `npm test` verde (suíte inteira) e revisão dos portões — `test/vigia.test.mjs` registrado, nenhum import de `data/projects.json`, nenhum `console.*` que imprima token, chat id, URL da Bot API, `CRM_INGEST_SECRET` ou objeto de erro do `fetch`
- [X] T040 [P] atma, roilabs, coopluz: `git grep` pelo valor de `ROIHUB_CRM_SECRET` e pelas palavras `secret`/`Bearer` nas linhas de log novas — só o nome da variável e o status HTTP podem aparecer (FR-018)
- [ ] T041 hub: commit e push fora de 23:30–01:00 e 08:00–08:45 BRT (Princípio IV); o push leva junto os 3 commits de docs parados. Depois, conferir a rota em produção com o quickstart §2
- [ ] T042 atma: commit e push de T004 e T014–T018; deploy do backend pelo EasyPanel; esperar terminar antes de T043 (build simultâneo derruba a VPS com 137)
- [ ] T043 roilabs: commit e push de T005, T019–T021 e T031–T038; deploy do painel pelo EasyPanel, **depois** de T042 terminar
- [ ] T044 coopluz: commit e push de T006–T007 e T022–T025; conferir o deploy de Production na Vercel
- [ ] T045 **dono**: antes de preencher os segredos, rodar o quickstart §3 (SC-003) na Coopluz e na Atma; depois, preencher `ROIHUB_CRM_SECRET` na Atma, no ROI Labs e na Coopluz (redeploy) e **conferir se existe** na Vértice (quickstart §1, R3)
- [ ] T046 **dono**: vigia na Cloudflare — `npx wrangler login`, criar o KV `VIGIA` e colar o `id` em `vigia/wrangler.toml` (commit do hub fora das janelas), gravar os 2 secrets e `npx wrangler deploy`; conferir o trigger `*/2 * * * *` e `wrangler tail` sem erro (quickstart §1)
- [ ] T047 rodar o quickstart §2, §4, §5 e §6 e registrar aqui SC-001, SC-002, SC-004, SC-005 e SC-006, o caminho usado para pago/devolvido/renovação recusada e o resultado do bot do WhatsApp da Atma (se ele manda `x-admin-key`, os leads dele não avisam — R5)
- [ ] T048 quickstart §7: `npm test` do hub e um ticket de teste na Sirius ou na Estetia ainda gerando "Ticket novo" (SC-007); durante 7 dias, anotar aqui por projeto o primeiro lead real que chegou ao Telegram, ou "sem lead" (SC-008)
- [ ] T049 quickstart §8: apagar as linhas `TESTE 027` no hub, no autogestor, na Atma (paciente, parceria e atividades) e no ROI Labs (`Candidatura`, `LeadConsumidor`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependência; T001 antes de qualquer tarefa do roilabs
- **Foundational (Phase 2)**: bloqueia a prova de US1 (menos a Vértice) e de US3 em produção. No código, os produtos podem ser escritos antes, porque o `avisar()` só loga um 404
- **US1 (Phase 3)**: Vértice (T012 → T013) depois de T009, porque os dois tocam `lib/avisos.mjs` e `test/avisos.test.mjs`; Atma, ROI Labs e Coopluz só dependem da Phase 1
- **US2 (Phase 4)**: só de T002; T028 usa `enviarTelegram`, que já existe (026)
- **US3 (Phase 5)**: depende de T021 (canal no `sendAlert`) e de T001
- **Polish (Phase 6)**: T041 → T042 → T043, em série (ordem do plano); T044 em qualquer momento depois de T041; T045 e T046 são do dono e destravam T047

### User Story Dependencies

- **US1**: independente de US2 e US3
- **US2**: independente das outras; não usa a rota nova
- **US3**: usa o canal do ROI Labs criado em T019–T021 (US1), mas se prova sozinha pelo resumo semanal e pelo cancelamento

### Within Each User Story

- Teste escrito e falhando antes da implementação (T008 antes de T009, T012 antes de T013, T014 antes de T015, T019 antes de T020, T022 antes de T023, T026 antes de T027)
- Função pura antes do gancho que a chama
- Rota do hub publicada antes dos produtos (T041 antes de T042–T044)

### Parallel Opportunities

- T002–T007 (arquivos e repositórios diferentes)
- Atma (T014–T018), ROI Labs (T019–T021) e Coopluz (T022–T025) entre si: repositórios diferentes
- T016 e T017 (controllers diferentes); T036 e T037 (rotas diferentes)
- US2 inteira em paralelo com os produtos
- **Não** paralelas: T008/T012/T026 (arquivos de teste e `package.json` do hub), T009/T013 (`lib/avisos.mjs`), T031/T032 (`lib/assinaturas.ts`) e T033/T034/T035 (mesma rota do webhook)

---

## Parallel Example: User Story 1 (produtos)

```text
Task: "T014–T018 atma: avisoRoihub.js, teste jest e os 2 ganchos"
Task: "T019–T021 roilabs: aviso-telegram.ts, teste e o terceiro canal do sendAlert"
Task: "T022–T025 coopluz: aviso.mjs, teste e o waitUntil em api/lead.ts"
```

## Parallel Example: User Story 3 (cancelamento)

```text
Task: "T036 roilabs: alertarCancelamento(a.id, 'sistema') no cron de assinaturas"
Task: "T037 roilabs: alertarCancelamento(assinatura.id, 'cliente') no caminho do token"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2
2. Phase 3 (US1): Vértice é uma linha e sai no mesmo push do hub
3. **STOP and VALIDATE**: quickstart §2, §3 e §4
4. Publicar na ordem do plano

### Incremental Delivery

1. Setup + Foundational → rota testada e fechada pelo segredo
2. US1 → leads dos 4 projetos avisando (MVP)
3. US2 → vigia no ar; não depende de nenhum produto
4. US3 → dinheiro do ROI Labs; só o roilabs muda
5. Polish → portões, publicação em série, ambiente do dono, quickstart inteiro

---

## Notes

- 49 tarefas: 7 de setup, 4 fundacionais, 14 da US1, 5 da US2, 8 da US3, 11 de polish
- Commit por grupo lógico, em inglês, com a linha de coautoria; um repositório por commit
- `git add` com caminho explícito em todos os repositórios, nunca `-A`
- As linhas citadas com "≈" foram medidas em 16/09; confira antes de editar
- Os ganchos da Atma e da Coopluz não têm teste de integração: o comportamento que importa (nunca lançar, nunca vazar segredo, não avisar duplicado) está na função pura e no `avisar()`, e a prova de ponta a ponta é o quickstart §3–§4
