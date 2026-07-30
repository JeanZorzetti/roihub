# Handoff — próximo passo: todo projeto com domínio próprio (30/07/2026)

**A frente anterior fechou.** Em 29/07 todo repo vivo ganhou site (`homepage` preenchida) — a coluna
"repos sem site" está vazia e some sozinha. A frente seguinte é a que o CannibalScan expôs hoje:

> **Ter site não é ter domínio. Site em domínio de fornecedor é invisível para a medição.**

Não substitui [`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md) — **aquele segue
valendo**: domingo **02/08, 10:00 BRT** é o primeiro run do robô de crawl, e continua sendo a única
coisa que mede o conserto do NXDOMAIN. Este aqui é o que fazer **quando houver sessão de trabalho**.
Índice: [`../handoff.md`](../handoff.md).

---

## Por que isso virou prioridade: a prova do CannibalScan

Medido e resolvido em 30/07 (detalhe na [seção 2 do outro handoff](handoff-proximo-passo-02-08.md)):

O CannibalScan estava havia semanas como "não indexado", tratado como pendência de **Request
Indexing manual**. A causa não era essa. Ele morava em `cannibalscan.vercel.app`, e `vercel.app` **não
é um domínio seu** — logo o site ficava fora da propriedade `sc-domain:nimblabs.com`, a única
verificada. Consequência em cadeia:

1. Não havia onde submeter o sitemap (a propriedade só aceita URLs do próprio domínio).
2. O `URL Inspection` devolvia `URL is unknown to Google` — **e isso não era um sinal de SEO**, era só
   o Google dizendo que aquele host não pertence à propriedade consultada.
3. Nenhuma métrica do projeto aparecia em lugar nenhum: nem no `/seo` do hub, nem no `ml/analyze.py`,
   nem nos kill gates do portfólio.

Um subdomínio próprio (`cannibalscan.nimblabs.com`) destravou os três de uma vez.

**A lição generaliza:** todo projeto em `*.vercel.app` está hoje no mesmo estado — no ar, contando
como "site" no hub, e **completamente fora da medição**.

---

## 🔢 O tamanho da frente, medido em 30/07

`gh repo list --no-archived` + classificação por host + `curl` um a um:

| | quantos |
|---|---|
| repos vivos com `homepage` | **38** |
| **domínio próprio** (roilabs / nimblabs / polarisia / estetiacrm / siriuscrm) | **17** |
| **domínio de fornecedor** (`*.vercel.app`, `*.easypanel.host`) | **21** |
| dos 21, quantos respondem **200** | **21 — todos** |
| dos 21, quantos estão em **alguma propriedade do GSC** | **ZERO** |

Não é um problema de site quebrado. São 21 sites saudáveis e mudos.

### A. Ganharam landing em 29/07 — 12 repos

Todos com push em `2026-07-29`, todos com commit `feat(site): landing page estatica` ou equivalente.
São o resultado direto da frente anterior, e por isso os mais fáceis de promover: nasceram há um dia.

| repo | host hoje | guarda-chuva natural |
|---|---|---|
| `roi-labs-links` | `roi-labs-links.vercel.app` | **`links.roilabs.com.br`** — já estava planejado |
| `sem-swarm` | `sem-swarm.vercel.app` | `nimblabs.com` (repo público, projeto real) |
| `seo-forecaster` | `seo-forecaster-pi.vercel.app` | `nimblabs.com` |
| `claude-loop-runner` | `claude-loop-runner.vercel.app` | `roilabs.com.br` (ferramenta interna) |
| `housing-pro-api` | `housing-pro-api.vercel.app` | `roilabs.com.br` |
| `whatsmeow-gateway` | `whatsmeow-gateway.vercel.app` | `roilabs.com.br` (infra) |
| `aesthetic-perfection-page` | `lumina-demo-beryl.vercel.app` | `estetiacrm.com.br` (é a 2ª demo, Lumina) |
| `aprovai` | `aprovai-locacao.vercel.app` | decidir |
| `moderador` | `moderador.vercel.app` | decidir |
| `reforma-maestro` | `reforma-maestro.vercel.app` | decidir |
| `potencial-arquitetado` | `potencial-arquitetado.vercel.app` | decidir |
| `cardioqwen3code` | `cardioqwen3code.vercel.app` | decidir |

### B. Sites antigos, repo parado — 8 repos

Aqui o passo provavelmente **não é dar domínio**. Ver o critério abaixo.

| repo | último push | idade |
|---|---|---|
| `portfolio` | 2026-07-26 | dias |
| `housingpro` | 2026-04-04 | ~4 meses |
| `vertex-landing-craft` | 2026-01-31 | ~6 meses |
| `synth-bot-buddy` | 2025-12-24 | ~7 meses |
| `matchfios-textile-connector` | 2025-09-26 | ~10 meses |
| `tape-vision-ai-92` | 2025-08-30 | ~11 meses |
| `cardio-risk-insight-hub` | 2025-08-22 | ~11 meses |
| `cyberspace` | 2025-08-20 | ~11 meses |

### C. Fora da Vercel — 1 repo

`meridian` → `sirius-crm-meridian.7c17iw.easypanel.host`. Mesmo problema, outro fornecedor: aquele
host **é da EasyPanel**, não seu. É o laboratório de beleza da vaga FitNext ([[project_meridian]]).

---

## 🚨 O critério: "todos com domínio" NÃO é "criar 21 subdomínios"

Esta é a parte que decide se a frente ajuda ou machuca.

**Subdomínio criado e depois abandonado é caro.** Foi exatamente o que produziu a maior frente de ops
que o hub já teve: 14 subdomínios aposentados do `roilabs.com.br` viraram NXDOMAIN e consumiram
**76% do crawl budget** do domínio ([[roilabs_dns_cloudflare_retired_subdomains]]). O Googlebot
continua batendo em host morto por meses. Criar domínio "porque sim" em 21 projetos, dos quais metade
vai morrer, **reconstrói o problema que acabou de ser consertado**.

Então a pergunta por projeto não é "tem domínio?", é:

> **Este projeto vai buscar tráfego de busca?**

- **SIM** → precisa de domínio próprio, porque sem isso ele não existe para o GSC. Promover.
- **NÃO** (experimento, demo, ferramenta interna, aprendizado) → o certo é **arquivar o repo**, não
  dar domínio. O próprio `lib/projects.mjs` documenta isso: *"arquivar o repo é o caminho preferido
  para APOSENTAR um projeto"* — o repo arquivado sai do ranking sozinho, sem NXDOMAIN, sem DNS órfão.
- **AINDA NÃO SEI** → deixar em `*.vercel.app` **é a resposta certa por enquanto**. O host de
  fornecedor é descartável de graça; um subdomínio seu, não.

Ou seja, o resultado bom desta frente é provavelmente algo como **6–8 promoções + 8 arquivamentos**,
não 21 promoções. O grupo B inteiro (repo parado há 4–11 meses) é candidato natural a arquivar.

⚠️ **Decisão de negócio, não de código.** Trazer a lista acima para o Jean e decidir linha a linha
antes de tocar em DNS. Executar as 21 sem essa triagem é a versão cara do erro.

---

## 🔧 A receita, já validada hoje no CannibalScan

Para cada projeto **aprovado na triagem**, nesta ordem — inverter quebra:

### 1. Criar o subdomínio (DNS + plataforma)

`roilabs.com.br` é Cloudflare; `nimblabs.com` é Hostinger.

⚠️ **Proxied (nuvem laranja) é proibido em host promovido** — impede a Vercel de emitir o
certificado. Proxied só serve para Redirect Rule de host morto. Inverter os dois gera um "deploy
quebrado" que não é deploy quebrado ([[roilabs_dns_cloudflare_retired_subdomains]]).

⚠️ **Universal SSL do Cloudflare cobre UM label.** `app.dominio.com.br` funciona;
`www.app.dominio.com.br` **não** — só redireciona em `http://`. Curar exige ACM pago. Não criar hosts
de dois labels.

### 2. Repontar o site para o domínio novo — **antes** de qualquer coisa de GSC

O CannibalScan ainda se declarava `.vercel.app` em **12 lugares** depois de o domínio estar no ar:
`<link rel="canonical">`, `og:url`, os `@id` do `@graph` JSON-LD, o `<loc>` do `sitemap.xml` e a linha
`Sitemap:` do `robots.txt`. Varredura obrigatória:

```bash
grep -rn "<projeto>.vercel.app" <repo> --include=*.html --include=*.ts --include=*.tsx \
  --include=*.xml --include=*.txt --include=*.json | grep -v node_modules
```

Submeter sitemap antes disso entrega ao Google um arquivo apontando para fora da propriedade.

### 3. 🚨 Confirmar que o deploy realmente saiu

**O projeto do CannibalScan na Vercel não estava ligado ao git.** O `git push` publicou zero. O
sintoma é traiçoeiro: commit verde, repo certo, site velho no ar. Checagem antes de comemorar:

```bash
npx vercel ls <projeto>          # "Age" da última production deve bater com agora
cd <pasta-do-site> && npx vercel link --project <projeto> --yes && npx vercel --prod --yes
```

⚠️ **`vercel --prod` não roda de dentro do OneDrive** (`UNKNOWN: unknown error, read`, sem citar o
OneDrive). Clonar em `C:\dev\<repo>` e deployar de lá ([[vercel_deploy_fails_under_onedrive]]).

### 4. Trocar a `homepage` do repo NO MESMO ATO

A chave de um projeto no hub é a **URL do site**, não o repo ([[roihub_github_sourced_projects]]).
Trocar o domínio sem trocar a `homepage` **duplica** o projeto no ranking em vez de movê-lo.

⚠️ `gh repo edit --homepage` quebra no PowerShell. Usar pelo Bash tool:

```bash
echo '{"homepage":"https://<host>"}' | gh api repos/JeanZorzetti/<repo> -X PATCH --input -
```

Conferir que não duplicou (deve continuar **uma** entrada por site):

```bash
node -e "…mergeProjects…"   # a receita completa está no histórico de 30/07
```

### 5. Submeter o sitemap — **pela API, sem UI**

Descoberto hoje: a service account do `GOOGLE_SERVICE_ACCOUNT_JSON` é **`siteFullUser`** nas
propriedades, então o `PUT` funciona. Basta trocar o escopo:

```js
scopes: ["https://www.googleapis.com/auth/webmasters"]        // e não webmasters.readonly
// PUT https://searchconsole.googleapis.com/webmasters/v3/sites/{prop}/sitemaps/{feedEncoded}
```

Não precisa abrir o Search Console. O script usado em 30/07 está no histórico da sessão.

### 6. Fechar o card no hub

Atualizar `acao`/`acaoDesc` do projeto em `data/projects.json` e pushar — deixar o card velho no ar é
o que gera a próxima tarefa improcedente ([[roihub_agenda_task_premises_unverified]]).

---

## ⛔ O que NÃO fazer

- **Não criar subdomínio para projeto que você não sabe se continua.** `*.vercel.app` abandonado não
  custa nada; subdomínio seu abandonado custa crawl budget por meses.
- **Não usar `www.<algo>.dominio`** — dois labels, o certificado do Cloudflare não cobre.
- **Não submeter sitemap antes do passo 2.** Sitemap com URL de fora da propriedade é erro, não
  progresso.
- **Não confiar em `git push` para publicar.** Confirmar o deploy (passo 3).
- 🚨 **NUNCA `yes | vercel project rm`** — não existe `--yes` nesse comando e o `yes` apaga **projetos
  vizinhos** da conta ([[vercel_project_rm_deletes_neighbors]]).
- ⚠️ **Janela de não-push: 00:00–01:00 BRT** — o cron do autopublishing roda 00:13.

---

## Como saber que a frente andou

O número a acompanhar é **quantos dos 39 projetos do ranking estão dentro de alguma propriedade do
GSC**. Hoje: **17 de 38 com `homepage`** (o `roihub` não tem site por decisão). O alvo não é 38 — é
"todo projeto que ainda existe depois da triagem".

Reler este arquivo com uma medição nova antes de retomar: a lista de repos vem do GitHub ao vivo, e
o Jean pode ter arquivado ou apagado coisas no meio ([[roihub_github_sourced_projects]]).

---

## Contexto herdado

- Estado atual e a data de 02/08: [`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)
- A receita de DNS/Cloudflare e o custo do NXDOMAIN:
  [`handoff-nxdomain-subdominios.md`](handoff-nxdomain-subdominios.md)
- Projetos vêm do GitHub, não de lista fixa: [`handoff-hub-github.md`](handoff-hub-github.md)
