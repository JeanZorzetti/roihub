# ROI Hub — handoff

**O que é:** hub administrativo dos 10 projetos full-SEO em `hub.roilabs.com.br` (EasyPanel, repo privado `JeanZorzetti/roihub`, deploy por push). Rankeia por score de prioridade 0–100 e responde: **em qual projeto trabalhar hoje**. SplitJud fica de fora por decisão do Jean (10/07/2026) — projeto dividido com o Aldo.

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
