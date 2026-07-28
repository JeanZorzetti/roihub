# ROI Hub — handoff

> **Próxima sessão começa em [`handoff-proximo-passo.md`](handoff-proximo-passo.md)** (28/07).
> O hub deixou de ter lista fixa de 10 projetos: agora todo repo do GitHub com `homepage`
> preenchida é um projeto — detalhe técnico em [`handoff-hub-github.md`](handoff-hub-github.md).

**O que é:** hub administrativo dos 10 projetos full-SEO em `hub.roilabs.com.br` (EasyPanel, repo privado `JeanZorzetti/roihub`, deploy por push). Rankeia por score de prioridade 0–100 e responde: **em qual projeto trabalhar hoje**. SplitJud fica de fora por decisão do Jean (10/07/2026) — projeto dividido com o Aldo.

## 13/07 — auditoria dos 10 cards de ação: 3 estavam improcedentes/errados; convenção "Repo:" adotada

- **Gatilho (Jean):** "já é a quarta tarefa improcedente que pego da agenda". Auditei os 10 `acao`/`acaoDesc` do
  projects.json contra os repos e a prod ANTES de reescrever — cada afirmação nova tem verificação datada.
- **Padrão da falha (é processo, não código):** os cards são texto curado à mão; o trabalho acontece
  (ou uma investigação conclui) e ninguém volta pra atualizar o card — o hub segue mandando executar
  o que já morreu. Agravante: nenhum card dizia **em qual repo** executar.
- **Caso pior (13/07):** o card do **estetiacrm** ("233 console.* → pino") foi executado **no monorepo roilabs**
  por engano — sem "Repo:" no texto, o executor assumiu o repo errado. A premissa numérica era quase certa
  **no Doc-CRM**: 1.084 console.* versionados, ~222 em runtime (lib 76, components 74, app 52, hooks 18).
  E "pino" era prescrição errada: Doc-CRM builda `output: standalone` (worker_threads do transport não é
  traçado no bundle; quebra só em prod). Card reescrito: logger JSON zero-dep, referência em
  `ROI Labs/app/src/lib/log.ts` (shipped 13/07 no roilabs).
- **goiania:** "Consertar IndexNow 403" → causa JÁ achada 13/07 (Bing não conhece o subdomínio; Yandex 202
  prova chave/arquivo ok). Card virou o desbloqueio real: **manual**, verificar o host no Bing Webmaster Tools.
- **roilabs:** "Investigar crawl 40,6% OK" → investigação CONCLUÍDA 13/07, zero bug vivo (Crawl Stats = média
  de 90 dias; 222/234 requisições pré-fix; www 301 e /obrigado noindex sondados hoje). Card virou a tarefa viva
  e verificada: logo de 173.709 bytes em `site/public/roilabs-logo.png` (conferido em disco hoje).
- **Válidos, mantidos:** sirius (gate 28/07), fabrica (sitemap GSC — pendente por handoff de hoje), polarisia
  (spec 012), reviewshield (/checker p78), context (**llms.txt confirmado 404 hoje**), aftercare (gate ~29/08),
  nimblabs (backlink npm; adicionado aviso pra DATAR as falhas antes de investigar o "60,3% OK" — mesmo gotcha
  de 90 dias do roilabs).
- **Convenção nova:** todo card com tarefa de dev começa com `Repo: …` (ou `MANUAL (Jean…)`). Ao fechar
  trabalho de um projeto, **atualizar o card no projects.json faz parte do fechamento** — o rodapé da /agenda
  já dizia isso; agora é regra de handoff.
- Verificado: JSON parseia (10 projetos, todos com acao+acaoDesc), suíte verde. projects.json é import
  estático — o push publica via redeploy automático.

## 12/07 — recorrência DIÁRIA na agenda (weekday=7) + 10 tarefas de artigo/dia

- Pedido do Jean: 10 tarefas contínuas, 1 por projeto, "publicar um novo artigo por dia". A agenda só tinha recorrência semanal (weekday 0-6) → **`weekday = 7` agora = diária** (ocorrência sempre = hoje; cai no bucket "Hoje" e reseta a cada dia). Diff mínimo: 1 branch em `nextOccurrence()` (lib/agenda.mjs), label "todo dia" no meta, opção nos 2 selects (add + modal), regex `^[0-7]$` no actions.ts, e CHECK do banco trocado de 0-6 → 0-7 (par DROP IF EXISTS + ADD no `ensure()`, idempotente — padrão aditivo; já apliquei no PROD direto).
- **10 tarefas inseridas** (ids 6–15): "Publicar 1 artigo novo no blog", weekday=7, uma por slug do projects.json, com descrição de cadência. Inserção idempotente (checa título+projeto+weekday antes).
- Ação da fabrica "Publicar artigos 4–20..." **EXECUTADA** (blog do estetia-demo 3→20 artigos, ver handoff s5 lá) → marcada feita em hub_done (`acao:fabrica:e0c29431`) e card atualizado: nova acao = submeter sitemap + indexação no GSC.
- Verificado: tsc 0 erros, testes (incl. 2 casos novos de `nextOccurrence(7,…)`).

## 12/07 — ação do Context Keeper era fantasma: publish já tinha saído em 10/06

- Pedido do Jean: executar "npm publish do daemon com os 4 fixes e2e" e atualizar a /agenda. Verificado no registry ANTES de publicar: `@jeanzorzetti/context-keeper@1.2.0` (e MCP 0.2.0) publicados em **10/06 16:32 UTC** — tarball conferido (contém `quality.js`/providers/hook + `response_format: json_object` no groq.js, o fix do bug 4). Nada a publicar; a ação do ranking estava desatualizada (memória/projects.json).
- Atualização: `projects.json` do card `context` → blocker removido (`blockers` 5→2, lista vazia), acaoDesc com ✅ e nova acao "Hashear User.apiToken (hoje plaintext no banco)" (confirmado no código: `findUnique({ where: { apiToken } })`). Ação antiga marcada feita em `hub_done` (`acao:context:9547cb72`) pro histórico.
- Verificação da página ao vivo bloqueada por basic auth (HUB_PASS só no EasyPanel); dados conferidos direto nas duas fontes da página (projects.json na main + hub_done no PG).

## 11/07 — SEM Google Ads em nenhum projeto (decisão do Jean)

- Portfólio é **100% SEO** — nada de tráfego pago, nem branded defense. A ação "Subir Google Ads branded 'sirius crm'" (reintroduzida em `33ea5f2` após a investigação do declining) foi trocada por: validar entity SEO em prod (Rich Results Test) + medir posição branded no GSC ~28/07; sem recuperação → reforçar entity SEO on-site.
- Regra pra edições futuras do projects.json (soma à regra "só tarefa DEV"): **acao/blockers nunca propõem mídia paga**.

## 11/07 — /agenda ordena as ações pelo ranking da home

- Pedido do Jean: "Ações dos projetos" estava na ordem do arquivo projects.json, não na prioridade da home. `evaluate()`/`evaluateAll()` extraídos de `app/page.tsx` para `lib/evaluate.ts` (fonte única de score) — home e agenda usam a MESMA avaliação ao vivo (saúde + GSC + insights), então a ordem nunca diverge. Cada ação ganhou meta `#N · score S`.
- Custo: /agenda agora faz os mesmos 10 health checks + 10 gscTrend da home a cada load (paralelo, 1 usuário — ok; se pesar, cachear o evaluateAll por request/minuto).
- Tarefas do banco (buckets datados) seguem ordenadas por data/id — prioridade por projeto dentro do bucket não foi pedida (adicionar se fizer falta).
- Verificado E2E local: DOM da /agenda com pendentes #2..#10 na ordem exata da home (#1 goiania em Feitas por já estar riscada).

## 11/07 — home risca ações já feitas na agenda

- Pedido do Jean: a home não refletia o check da /agenda. Agora a home lê o mesmo `hub_done` (`listDone()`, chave `acao:{slug}:{hash8(acao)}@1970-01-01`) e risca a ação no hero (✓ + cinza) e na coluna "Próxima ação". Sem `DATABASE_URL`/DB fora → nada riscado (catch → set vazio, hub nunca cai por DB).
- Home ganhou `force-dynamic` explícito (antes dependia só do `no-store` do health check; agora tem query PG).
- Riscar ≠ concluir: conclusão real segue sendo trocar a ação no projects.json (rodapé explica).
- Verificado E2E local com DB real (goiania riscada de verdade + sirius com row de teste, removida depois).

## 11/07 — data de início no GSC por projeto (`gscInicio`)

- Pedido do Jean: marcar quando cada projeto entrou no GSC pra ter régua de revisão de performance/crawl. Decisão (confirmada): **campo opcional `gscInicio: "AAAA-MM-DD"` no projects.json** — sem DB, sem arquivo novo; editar+push como todo metadado manual.
- Exibição via `sinceGsc()` em `app/viz.tsx`: "/seo" mostra "· GSC desde 28/06 · D+13" ao lado da URL do card; "/infra" mostra no "cobre: Nome (GSC desde … · D+N)". Projeto sem o campo não mostra nada.
- Preenchido por enquanto **só goiânia (28/06/2026)** — os outros 9 entram quando o Jean confirmar as datas.

## 11/07 — agenda: modal de edição de tarefa

- Pedido do Jean: clicar na tarefa → modal de edição. Título da tarefa (só as do banco; "ações do ranking" continuam texto) virou botão que abre `<dialog>` nativo com os mesmos campos do form de adicionar (título, data, recorrência, projeto) → server action `update` → `UPDATE hub_tasks`.
- **+ campo `descricao`** (pedido seguinte): coluna nova via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` no `ensure()` (o padrão aditivo combinado), textarea no modal (2000 chars), exibida em cinza sob o título quando a tarefa está pendente (some quando feita). Form de adicionar NÃO tem o campo — descrição entra pelo modal. As 3 tarefas seed já foram descritas direto no banco (passo-a-passo da rotina de sexta; alerta do serper quebrado 06/07 no rank tracking; pré-requisitos do checkpoint da malha).
- Único client component da aba: `app/agenda/edit-task.tsx` (precisa de `showModal()`); resto segue 100% server. Parsing de campos unificado em `taskFields()` no actions.ts (add e update validam igual).
- Done antigo não é limpo ao mudar data/recorrência: linhas órfãs em `hub_done` são inertes (lookup usa a ocorrência nova).
- Verificado: tsc + build + 24/24 testes.

## 11/07 — aba Agenda (checklist com persistência em Postgres)

- Pedido do Jean: "calendário com checklist" interativo. Duas correções dele mudaram o desenho: o vault Obsidian só cobre roilabs/goiânia (2 de 10 — o hub é o único agregador dos 10) e o "sem-DB" era decisão minha, não requisito dele → **agora tem Postgres**.
- **DB: `roihub_db` DEDICADO** (`2.24.207.200:5445`, user `roihub_db` — o Jean criou na EasyPanel em 11/07; a 1ª versão usava o servidor do roilabs_db com prefixo `hub_`, tabelas de lá já dropadas): `hub_tasks` (titulo, projeto?, due?, weekday? 0-6 = recorrente semanal) e `hub_done` (key, occurrence, PK composto). Sem migration formal por design: schema auto-criado no 1º uso (`CREATE TABLE IF NOT EXISTS` em `lib/db.ts`, pool pg singleton) — schema novo no futuro = editar o `ensure()` (aditivo) ou rodar SQL manual. Schema + seeds já aplicados no banco dedicado em 11/07. Sem `DATABASE_URL` → banner de setup + ações do ranking em modo leitura.
- `/agenda`: buckets Atrasadas / Hoje / Próximos 7 dias / Mais tarde / Sem data + **"Ações dos projetos"** (espelha a `acao` do projects.json de graça — key com hash do texto, mudou a ação = check reseta) + "✓ Feitas" recolhido com undo. Form de nova tarefa (data OU recorrência semanal + projeto opcional). Tudo server actions + forms, zero JS no cliente; helpers de data puros em `lib/agenda.mjs` (fuso São Paulo, testados).
- Recorrente reseta a cada ocorrência (done por data); ocorrência perdida some sem cobrar (ponytail: sem nag de recorrente atrasado — upgrade se fizer falta).
- Seeds no DB (11/07): rotina de sexta (crawl+analyze.py), conferir rank tracking (toda segunda), checkpoint da malha 15/07.
- Verificado: 24/24 testes, build limpo, **E2E local com DB real** (marcar→Feitas, desmarcar, adicionar, apagar via Playwright).
- ⚠️ **Ops pendente (Jean, 2 min): setar `DATABASE_URL` na EasyPanel do hub + redeploy** — valor no `.env` local (externo `2.24.207.200:5445/roihub_db`; do serviço na mesma EasyPanel o hostname interno do postgres novo na porta 5432 também vale). Senha PG segue na lista de rotação.

## 11/07 — hub é só do Jean (dev): tarefas comerciais fora da equação

- Decisão do Jean: captação/comercial é da Maria Eduarda e NÃO entra no ranking. `projects.json` limpo: goiânia perdeu o blocker "contatar fornecedor" (9→4, ação virou os secrets do checkpoint 15/07 + redirects do crawl), sirius perdeu "subir Google Ads" (7→2, ação virou investigar o trend declining do /insights), reviewshield perdeu "primeiro outreach US" (6→4). Receita segue intocada — mede valor na mesa, não tarefa.
- **Regra pra edições futuras do projects.json: blockers/acao = só tarefa DEV.** Tarefas da Duda vivem no vault (`backlog-pendencias` seção "Não-dev").
- Ranking resultante (sim. com seoSeed): goiania 64 > sirius 56 > fabrica 55 > roilabs 55 > …

## 11/07 — decay do score agora vem do insights.json (ML)

- **Pedido do Jean**: o ranking da home não reagia às abas novas; o `/insights` já tinha `health` 0–100 por projeto sem alimentar o score. Semântica confirmada com ele: saúde baixa = precisa de atenção = decay ALTO (mapeamento invertido).
- `decayFromHealth(health, generatedAt)` em `lib/score.mjs`: `10 − saúde/10`, só quando o insights.json foi gerado há ≤ 10 dias (mesma régua de "velho" do /insights); senão `null` → cai no `decay` manual do projects.json. Site fora do ar continua forçando 10 (precedência máxima).
- Flags do insights (hoje só `crawl-waste`, com o detail do crawl) entram como linhas ⚠ nos blockers exibidos do foco — **não** mudam a nota `blockers` (manual).
- Meter do foco ganha sufixo "· ML" quando o decay é automático; rodapé explica a regra.
- Efeito medido na simulação (seoSeed, dados de 10/07): top 4 estável (receita+blockers dominam); polarisia (saúde 80) cai 5º→8º; context/nimblabs/estetiacrm/reviewshield (crawl-waste) sobem. Ou seja: rodar `ml/analyze.py` na sexta agora move o ranking sozinho.
- Testes 19/19 (`decayFromHealth` coberto) + tsc limpo.

## Estado atual (fim da sessão de 10/07, tarde)

- **App no ar** em `hub.roilabs.com.br` com basic auth. **GSC conectado em prod** (rodapé "conectado — 10 propriedades", confirmado pelo Jean 10/07).
- **Aba SEO de progressão SHIPPED** nesta sessão: `/seo` com small multiples (1 card por projeto), verificada local com dados reais (10/10 cards com GSC).
  - Por card: 3 stats 28d vs 28d anteriores (cliques Δ%, impressões Δ%, posição média Δ absoluto com leitura invertida — cair é verde) + 2 mini-gráficos de colunas de 12 semanas (cliques/sem e impressões/sem, séries separadas — nunca 2 escalas num eixo).
  - Sem DB: `gscSeries()` busca 84 dias diários da API (16 meses de histórico disponível), `lib/series.mjs` agrega em semanas e janelas 28d na hora, a cada load (`force-dynamic`).
  - Posição média ponderada por impressões (média simples mente); semana/janela sem impressão → `—`.
  - Tooltip = `<title>` nativo do SVG (sem JS no cliente); tabela-gêmea em `<details>` cobre teclado/a11y. Upgrade pra tooltip JS só se fizer falta.
  - Cards ordenados por impressões 28d desc; projeto sem propriedade GSC → estado vazio honesto com pill SEED.
  - Navegação por abas (Ranking | SEO) no topo das duas páginas; chrome compartilhado em `app/tabs.tsx` (Tabs + GscFoot).

- **Aba Infra (crawl stats) SHIPPED 10/07** (`d930830`): `/infra` lê os exports manuais de "Estatísticas de rastreamento" do GSC (a API NÃO expõe crawl stats). 1 card por propriedade: requisições 28d Δ%, resposta média 28d ponderada (cair = melhor), % por classe de resposta (OK/redirect/404/5xx/outros) com alerta (OK < 85% ou 5xx ≥ 1%), 2 charts de 12 semanas, tabela semanal por card. Verificado local com 9 propriedades reais.
  - **Rotina de sexta do Jean**: GSC → Configurações → Estatísticas de rastreamento → Exportar; descompactar em `docs/` (qualquer subpasta) e **commit+push** — o nome da pasta (`{host}-Crawl-stats-AAAA-MM-DD`) identifica host e data, o app acha sozinho (scan recursivo).
  - Cada export cobre 90 dias; exports de semanas seguintes se emendam por data (merge, export mais novo vence no dia sobreposto) — histórico cresce sem DB.
  - Achados do 1º export (10/07): roilabs.com.br só 40,6% OK (32,5% redirect + 22,7% outros!), goiania 65,2% OK (33,6% redirect — eco do gotcha trailing-slash do nginx), nimblabs 60,3% OK. Candidatos a investigação.

## Arquivos-chave

- `lib/gsc.ts` — auth + sites.list (cache 10 min) + `gscTrend` (home) + `gscSeries`/`queryTimeseries` (aba SEO, `dimensions:["date"]`).
- `lib/series.mjs` — agregação pura da série GSC (bucketWeeks, totals28, addDays), JS+JSDoc.
- `lib/crawl.mjs` — parse dos CSVs de crawl stats (localizados pt-BR: parse por POSIÇÃO de coluna; classe "(5xx)" agrupada no label), merge de exports, buckets.
- `app/viz.tsx` — WeekChart/Stat/Delta/InvDelta compartilhados entre /seo e /infra (100% server, tooltip `<title>` SVG).
- `app/seo/page.tsx` e `app/infra/page.tsx` — as abas.
- `data/projects.json` — critérios manuais; editar + push = redeploy.
- `npm test` — 16/16 (score + series + crawl). Node 22: listar arquivos explícitos no script (dir não resolve).
- Dockerfile copia `docs/` pra imagem (a /infra lê via fs em runtime).

## Commits (todos na main, deploy automático)

- `879c5fa` app inicial completo (score+health+GSC+auth+Docker)
- `3b4c7f3` GSC auto-descoberta de propriedades (sites.list, cache 10 min, filtro por host)
- `3d2c552` linha de status GSC no rodapé
- `c4e1e50` fix: env malformada mostrava 500 em vez do estado de erro
- (10/07 tarde) aba SEO de progressão — ver `git log`

## Decisões de arquitetura

- **Sem DB**: critérios manuais em `data/projects.json` versionado. Histórico SEO vem da API do GSC a cada load — 10 projetos × 1 request, latência ok pra 1 usuário.
- **Página dinâmica** (sem ISR): 1 usuário, health `no-store`; site fora do ar → decay forçado 10 + banner.
- **Service account REUSADA** do projeto GCP `review-dispute-agent-498311` (API já ativa). ⚠️ Se esse projeto GCP for deletado, o hub perde o GSC.
- Basic auth fail-closed: sem `HUB_PASS` em produção → 503.
- Score em `lib/score.mjs`, agregação em `lib/series.mjs` (JS puro com JSDoc pra rodar no node:test sem tooling).

## Aba Insights (ML) — SHIPPED 10/07 (noite)

- **F0–F2 do `handoff-ml.md` implementados**: `ml/` (Python 3.13, venv em `C:\venvs\roihub-ml`) gera `data/insights.json` (versionado) e a aba `/insights` renderiza — health 0–100 explicável, tendência Theil-Sen 4/12/26 sem, changepoints PELT, anomalias MAD, diagnóstico crawl↔SEO. Detalhes/gotchas/pendências (F3 forecast, F4 narrativa) em `handoff-ml.md`.
- **Rotina de sexta agora**: export de crawl em `docs/` → `C:\venvs\roihub-ml\Scripts\python ml\analyze.py` → commit+push.
- pytest 11/11 em `ml/test_ml.py`; extração validada 100% contra os totais 28d do hub.

## Próximos candidatos

- F3 (forecast + kill-gates nimblabs) e F4 (narrativa claude-cli) do `handoff-ml.md`.
- Conferir `/seo`, `/infra` e `/insights` em prod depois do deploy (deploy é automático no push).
- `.env` local com a credencial agora existe (gitignorado) — dev local mostra dados reais.
- Se a aba SEO pedir interação real (crosshair, filtro de janela), aí sim entra client JS — hoje é 100% server.

## Gotchas (vários valem pra qualquer projeto novo nesta máquina)

- **TypeScript pinado `^5`**: npm resolve TS 7 por padrão e o build do Next 16 quebra com ele.
- **`turbopack.root` obrigatório** no next.config: há um `package-lock.json` solto em `C:\Users\jeanz` que faz o Next inferir o root errado.
- **PS 5.1 + git commit**: aspas duplas dentro de here-string `-m` quebram o argumento — usar o Bash tool ou não usar `"` na mensagem.
- **Matar dev server**: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where { $_.CommandLine -match "next" } | ForEach { Stop-Process -Id $_.ProcessId -Force }` — kill simples deixa órfão segurando a porta 3000.
- **`node --test <dir>` não resolve no Node 22** — listar os arquivos de teste explícitos no script.
- GSC atrasa ~3 dias; janelas de 28d e semanas fecham em D-3.
- Falha de GSC nunca derruba o hub — home cai pro `seoSeed` (pill SEED), `/seo` mostra estado vazio; `gscStatus` reporta o motivo no rodapé das duas.
- Warning "middleware → proxy" no build é só deprecation do Next 16 (e o "1 Issue" no dev overlay é DeprecationWarning de zlib de dependência — ignorar).
