# ROI Hub — handoff

**O que é:** hub administrativo dos 10 projetos full-SEO. Rankeia por score de prioridade 0–100 e responde uma pergunta só: **em qual projeto trabalhar hoje** (e quais 9 ignorar). SplitJud ficou de fora por decisão do Jean (10/07/2026) — projeto dividido com o Aldo.

## Feito (10/07/2026)

- Next.js 16 App Router, uma página (`app/page.tsx`), sem DB, sem cron.
- **Score** = receita×0.35 + blockers×0.25 + SEO×0.2 + decay×0.2 (cada 0–10) → 0–100. Lógica em `lib/score.mjs`, testes em `test/score.test.mjs` (`npm test`, 6/6 verdes).
- **Automático a cada carregamento:** health check das 10 URLs (`lib/health.ts`; site fora do ar → decay forçado a 10 + banner) e tração SEO via Search Console (`lib/gsc.ts`: cliques 28d vs 28d anteriores → nota 0–10).
- **Manual:** `data/projects.json` (receita, blockers, decay, seoSeed, próxima ação) — semeado com o estado real dos 10 projetos em 10/07. Editar + push = redeploy.
- Basic auth via `middleware.ts` — **fail closed**: sem `HUB_PASS` em produção o app responde 503.
- Build local OK, página verificada via Playwright (10/10 sites responderam 200; foco do dia = Goiânia 73).

## Decisões

- **Sem DB**: critérios manuais vivem no `projects.json` versionado. Editar pelo git é o fluxo (ou pedir pro Claude).
- **Página dinâmica** (sem ISR): 1 usuário, dados frescos a cada load; health check usa `no-store`.
- **GSC via service account** (uma credencial pra todas as propriedades), não OAuth. Sem a env, cai no `seoSeed` manual com pill "SEED".
- Design system light do admin ROI Labs + paleta dataviz validada (sequencial azul pro score, status com ícone+label).
- TypeScript pinado em ^5 — npm resolve TS 7 por padrão e o build do Next 16 quebra com ele.
- `turbopack.root` setado no `next.config.mjs` — existe um `package-lock.json` solto em `C:\Users\jeanz` que faz o Next inferir o root errado.

## Próximos passos (pro Jean)

1. **EasyPanel:** criar app apontando pro repo `JeanZorzetti/roihub` (Dockerfile na raiz, porta 3000) + subdomínio (sugestão: `hub.roilabs.com.br`).
2. **Envs em prod:** `HUB_USER`, `HUB_PASS` (obrigatório) e depois `GOOGLE_SERVICE_ACCOUNT_JSON` (passos no `.env.example`).
3. **GSC:** conferir se as propriedades em `projects.json` batem com as reais no Search Console (assumi `sc-domain:`; se forem URL-prefix, trocar o campo `gscProperty`).

## Gotchas

- `gscHostFilter` filtra por página "contains" — para domínios com vários subdomínios na mesma propriedade (roilabs, nimblabs, estetiacrm).
- GSC atrasa ~3 dias; as janelas de 28d fecham em D-3.
- Falha de GSC nunca derruba o hub — cai silenciosamente pro seed (try/catch em `lib/gsc.ts`).
- Warning de build "middleware → proxy" é só deprecation do Next 16; funciona.
