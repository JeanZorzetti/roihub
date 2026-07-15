# ROI Hub

Painel de comando dos projetos SEO do ROI Labs. Rankeia os 10 projetos por um score
único e aponta **o foco de dev do dia** — no ar em [hub.roilabs.com.br](https://hub.roilabs.com.br).

## O que faz

- **Ranking** — ordena os 10 projetos por score. O ranking considera **apenas tarefa de dev**
  (a parte comercial é acompanhada fora daqui).
- **SEO** — métricas de busca por projeto, alimentadas pelo Google Search Console.
- **Infra** — status de infraestrutura dos projetos.
- **Insights** — camada de ML (Python) sobre os dados de crawl e GSC.
- **Agenda** — tarefas do dia. Os cards vivem em [`data/projects.json`](data/projects.json)
  e são escritos à mão; sempre valide a premissa (o `Repo:` do card) antes de executar.

## Stack

- **Next.js** (App Router) + **React** — [`app/`](app), abas em `app/{seo,infra,insights,agenda}`
- **Postgres** (`pg`) — banco dedicado para a agenda
- **google-auth-library** — integração com o Google Search Console
- **ML em Python** — [`ml/`](ml): `crawl.py`, `gsc.py`, `analyze.py`, `diagnostics.py`
- Deploy via **Docker** ([`Dockerfile`](Dockerfile))

## Rodar localmente

```bash
npm install
npm run dev     # http://localhost:3000
npm test
```

As credenciais do GSC e a `DATABASE_URL` do Postgres da agenda são fornecidas por
variáveis de ambiente (ver `middleware.ts` e `lib/`).

## Dados

- [`data/projects.json`](data/projects.json) — projetos e cards da agenda
- [`data/insights.json`](data/insights.json) — saída da camada de ML
