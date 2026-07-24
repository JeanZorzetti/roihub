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

As variáveis locais estão em [`.env.example`](.env.example). Não salve valores reais
nesse arquivo.

## Dados

- [`data/projects.json`](data/projects.json) — projetos e cards da agenda
- [`data/insights.json`](data/insights.json) — saída da camada de ML

## Autopublishing: operação

### Contrato de ambiente

O deploy do hub exige `CLAUDE_CODE_OAUTH_TOKEN`, `CRON_SECRET`, `DATABASE_URL`,
`GITHUB_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_JSON` e `UNSPLASH_ACCESS_KEY`.
Ausência, valor vazio ou somente espaços interrompe a rota com `503`; a resposta
contém apenas os nomes ausentes.

O motor editorial é o **claude-cli**, não uma API paga: a imagem Docker instala
`@anthropic-ai/claude-code` e autentica por `CLAUDE_CODE_OAUTH_TOKEN`, gerado com
`claude setup-token` na sua máquina. Uma chamada por projeto pesquisa (WebSearch) e
decide no mesmo turno; projetos `ymyl-restricted` levam uma segunda chamada só para
classificar risco. O custo marginal por artigo é zero — o limite é o rate limit da
assinatura, não crédito.

`CRON_SECRET` fica no ambiente do hub e protege `/api/seo/autopublish`.
`HUB_CRON_SECRET` fica nos secrets do GitHub Actions e deve conter o mesmo segredo
para chamar essa rota. Configure também `HUB_URL` no GitHub Actions. Nunca registre
os valores desses três campos.

Crie um GitHub fine-grained token com acesso somente a **Contents: read and write**
nos dez alvos abaixo (nove repositórios únicos, pois dois alvos compartilham o
monorepo):

- `goiania` — `JeanZorzetti/roilabs`
- `sirius` — `JeanZorzetti/sirius`
- `fabrica` — `JeanZorzetti/estetia-demo`
- `roilabs` — `JeanZorzetti/roilabs`
- `polarisia` — `JeanZorzetti/sofia-ia`
- `estetiacrm` — `JeanZorzetti/estetia`
- `reviewshield` — `JeanZorzetti/review-dispute`
- `context` — `JeanZorzetti/context-keeper`
- `aftercare` — `JeanZorzetti/aftercare-nimblabs`
- `nimblabs` — `JeanZorzetti/nimblabs`

A capa vem só do Unsplash — não há geração de imagem de fallback. Mantenha a URL
retornada para hotlink, exiba a atribuição do fotógrafo e do Unsplash e acione o
endpoint de download informado pela API quando a imagem for usada; não copie o
arquivo para o repositório. Busca sem nenhum resultado bloqueia a publicação
(`unsplash-output`) em vez de publicar sem capa.

### Gates e dry-run

O kill switch global (`*`) permanece **desligado por padrão**. O cron agendado não
publica enquanto ele estiver desligado.

O dry-run executa pesquisa e geração editorial — portanto consome rate limit da
assinatura Claude — mas é transitório: não cria nem reutiliza linha no banco e não
escreve imagem ou commit no GitHub.

```powershell
$env:HUB_URL='https://hub.roilabs.com.br'
$env:HUB_CRON_SECRET='local-secret'
$env:DRY_RUN='true'
node scripts/run-autopublish.mjs
```

Antes do rollout, confirme que os seis campos do hub e os secrets `HUB_URL` e
`HUB_CRON_SECRET` existem. Execute primeiro um `workflow_dispatch` com
`dry_run=true` e confirme dez resumos transitórios, sem linha em
`seo_publications`, imagem ou escrita GitHub.

Somente depois, mantenha o global desligado e habilite estes canários, nesta ordem:

1. `goiania` — Astro
2. `sirius` — TypeScript post
3. `context` — MDX
4. `nimblabs` — TypeScript catalog

Habilite o global temporariamente, rode `dry_run=false` e desligue-o ao terminar os
quatro. Para cada canário, valide build, HTTP 200, canonical, schema, sitemap e
atribuição da imagem. Só após os quatro passarem habilite os demais projetos e
deixe o global ligado para o cron diário.
