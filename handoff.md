# ROI Hub — handoff

**O que é:** hub administrativo dos 10 projetos full-SEO em `hub.roilabs.com.br` (EasyPanel, repo privado `JeanZorzetti/roihub`, deploy por push). Rankeia por score de prioridade 0–100 e responde: **em qual projeto trabalhar hoje**. SplitJud fica de fora por decisão do Jean (10/07/2026) — projeto dividido com o Aldo.

## 🎯 PRÓXIMA SESSÃO: Aba SEO (progressão)

Pedido do Jean (10/07): **aba exclusiva de SEO com análise de progressão** — saber se o SEO de cada projeto está MELHORANDO ao longo do tempo, não só o snapshot 28d.

Notas pra implementação:

- **Não precisa de DB**: a API do Search Console guarda 16 meses de histórico. `searchAnalytics/query` com `dimensions: ["date"]` devolve série diária de clicks/impressions/ctr/position por propriedade. Progressão = calcular na hora.
- **Reusar `lib/gsc.ts`**: `resolveProperty` + `listSites` (cache 10 min) já resolvem propriedade por host. Adicionar um `queryTimeseries(property, host, start, end)` ao lado do `queryClicks` existente (mesmo endpoint, só acrescenta `dimensions`).
- Rota nova `app/seo/page.tsx` + navegação de abas no topo (o middleware de basic auth já cobre qualquer rota).
- **10 projetos = small multiples** (um mini-gráfico por projeto), NUNCA 10 séries num gráfico só. Carregar a skill `dataviz` antes de escrever o UI (paleta/marks já usados no hub: ramp azul sequencial, chrome em `app/globals.css`).
- Métricas que respondem "está melhorando?": cliques e impressões semanais (agregar os dias em semanas pra suavizar), Δ 28d vs 28d anteriores (o hub já calcula), e posição média (cair = melhor — inverter leitura).
- Impressões importam mais que cliques pra sites novos (nimblabs ~0 cliques): impressão subindo = Google começando a servir o site.
- Projeto sem env GSC ou sem propriedade → mostrar estado vazio honesto (mesmo padrão pill SEED da home).

## Estado atual (fim da sessão de 10/07)

- **App no ar** em `hub.roilabs.com.br` com basic auth. Home completa: score = receita×0.35 + blockers×0.25 + SEO×0.2 + decay×0.2 (0–10 cada), FOCO DE HOJE, health check ao vivo das 10 URLs, tabela rankeada.
- **GSC automático PRONTO no código, pendente só a env em prod**: a service account `nimblabs@review-dispute-agent-498311.iam.gserviceaccount.com` tem acesso Full às **10 propriedades** (verificado via sites.list em 10/07 — Jean adicionou tudo). Local com a credencial: 10/10 pills GSC com cliques reais.
- **Última pendência (Jean, no EasyPanel):** colar o JSON de 1 linha na env `GOOGLE_SERVICE_ACCOUNT_JSON` + Deploy. Ele colou o COMANDO PowerShell em vez do resultado (deixei o valor pronto no clipboard + backup em `nimblabs/docs/review-dispute-agent-498311-oneline.txt`). **Primeira coisa da próxima sessão: abrir o hub e ler a linha "GSC:" do rodapé** — desligado/ERRO/conectado diz exatamente o estado.

## Commits (todos na main, deploy automático)

- `879c5fa` app inicial completo (score+health+GSC+auth+Docker)
- `3b4c7f3` GSC auto-descoberta de propriedades (sites.list, cache 10 min, filtro por host) — zero config por projeto
- `3d2c552` linha de status GSC no rodapé (desligado / ERRO com mensagem / conectado + lista)
- `c4e1e50` fix: env malformada mostrava 500 em vez do estado de erro (JSON.parse fora do try no gscStatus)

## Decisões de arquitetura

- **Sem DB**: critérios manuais em `data/projects.json` versionado (editar + push = redeploy). Vale pra aba SEO também — histórico vem da API.
- **Página dinâmica** (sem ISR): 1 usuário, health `no-store` a cada load; site fora do ar → decay forçado 10 + banner.
- **Service account REUSADA** do projeto GCP `review-dispute-agent-498311` (API já ativa). ⚠️ Se esse projeto GCP for deletado, o hub perde o GSC.
- Basic auth fail-closed: sem `HUB_PASS` em produção → 503.
- Score em `lib/score.mjs` (JS puro com JSDoc pra rodar no node:test sem tooling) — `npm test`, 6/6.

## Gotchas (vários valem pra qualquer projeto novo nesta máquina)

- **TypeScript pinado `^5`**: npm resolve TS 7 por padrão e o build do Next 16 quebra com ele.
- **`turbopack.root` obrigatório** no next.config: há um `package-lock.json` solto em `C:\Users\jeanz` que faz o Next inferir o root errado.
- **PS 5.1 + git commit**: aspas duplas dentro de here-string `-m` quebram o argumento — não usar `"` na mensagem.
- **Matar dev server**: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where { $_.CommandLine -match "next" } | ForEach { Stop-Process -Id $_.ProcessId -Force }` — kill simples deixa órfão segurando a porta 3000.
- GSC atrasa ~3 dias; janelas de 28d fecham em D-3.
- Falha de GSC nunca derruba o hub — `gscTrend` cai pro `seoSeed` (pill SEED); `gscStatus` reporta o motivo no rodapé.
- Warning "middleware → proxy" no build é só deprecation do Next 16.
- Quando o GSC entrar em prod, **scores dos nimblabs vão CAIR** (0–1 cliques reais → SEO ~2/10). É o comportamento desejado.
