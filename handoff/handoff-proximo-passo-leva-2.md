# Handoff — próximo passo: 2ª leva de domínios (30/07/2026, fim da sessão)

**A 1ª leva fechou.** Quatro projetos saíram de host de fornecedor e entraram na medição. A receita
do [`handoff-proximo-passo-dominios.md`](handoff-proximo-passo-dominios.md) foi executada de ponta a
ponta e **está validada** — com três correções que só apareceram rodando, documentadas abaixo.

Não substitui [`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md) — **aquele segue
valendo**: domingo **02/08, 10:00 BRT**, primeiro run do robô de crawl. Índice:
[`../handoff.md`](../handoff.md).

---

## 📊 Onde a frente está

| | 30/07 manhã | 30/07 fim |
|---|---|---|
| domínio próprio | 17 | **21** |
| domínio de fornecedor | 22 | **17** |
| projetos no ranking | 39 | **40** |
| hosts duplicados | — | **zero** (`mergeProjects` conferido ao vivo) |

Promovidos: `links.roilabs.com.br`, `sem-swarm.nimblabs.com`, `seoforecaster.nimblabs.com`,
`meridian.roilabs.com.br` — **os quatro com sitemap já aceito** no GSC como `siteFullUser`.

`EGTelemedicina` foi apagado pelo Jean. ⚠️ Ele **ainda aparece** em `gh api user/repos` (cache da
listagem) mas `gh api repos/JeanZorzetti/EGTelemedicina` devolve **404**. Ao recontar, confie no GET
direto, não na listagem — senão a conta sai com 1 a mais.

---

## ✅ Nada pendente da 1ª leva — os 4 fecharam

O meridian entrou por último e completo: DNS, vhost no EasyPanel (feito pelo Jean), certificado
válido, `main` em `b20dcf4`, canonical com barra correta em `/` e `/pricing/`, `sitemap.xml` e
`robots.txt` em 200, `homepage` trocada e sitemap **aceito no GSC** como `siteFullUser`.

⏱️ **O EasyPanel rebuilda sozinho, mas devagar.** Vários minutos depois do push o site ainda servia
o build velho (sem canonical, `/sitemap.xml` em 404) — o suficiente para parecer que não havia
webhook. Havia. **Não clique em Deploy achando que falhou; espere e verifique:**

```bash
curl -s https://meridian.roilabs.com.br/ | grep -o '<link rel="canonical"[^>]*>'
```

---

## 🔧 As três correções na receita (descobertas rodando)

A receita original continua certa na ordem. Estes três pontos ela não previa:

### 1. `.vercel/project.json` local é o sinal antecipado de que o push não publica

O passo 3 ("confirme que o deploy saiu") se confirmou em **2 dos 3** projetos. `roi-labs-links`
publicou pelo `git push`; `sem-swarm` e `seo-forecaster` **não** — sitemap em 404 e canonical velho
no ar, idêntico ao CannibalScan.

O que os três tinham em comum com o CannibalScan: um `.vercel/project.json` local, resíduo de
`vercel link` rodado pela CLI. **Se esse arquivo existe, presuma que o repo não está ligado ao git**
e planeje o deploy manual desde o começo:

```bash
find <repo> -path "*/.vercel/project.json" -not -path "*/node_modules/*"
```

⚠️ **`vercel --prod --yes` devolve `missing_arguments`** nesta versão da CLI (58.x). O comando é
`vercel deploy --prod`, rodado de dentro da pasta que é o root do projeto (em `sem-swarm` e
`seo-forecaster` é `site/`, não a raiz do repo).

### 2. Astro: `site:` sozinho não gera canonical nem sitemap

Adicionar `site: 'https://…'` ao `astro.config.mjs` **não** produz `<link rel="canonical">` nem
`/sitemap.xml`. O canonical precisa ser escrito no layout, e o sitemap é arquivo em `public/`
(ou o pacote `@astrojs/sitemap`, que não estava instalado e não valia a dependência para 2 URLs):

```astro
const canonical = new URL(Astro.url.pathname, Astro.site);
...
<link rel="canonical" href={canonical} />
```

🚨 **Barra final:** o build prerenderiza `/pricing/index.html`, então o canonical emitido é
`/pricing/` **com barra**. Um sitemap escrito com `/pricing` contradiz o canonical e cai no 301 do
nginx que já queimou 46% do crawl do goiânia ([[astro_nginx_trailing_slash_301]]). **Confira a barra
no HTML gerado, não no seu palpite:**

```bash
grep -o '<link rel="canonical"[^>]*>' dist/client/**/index.html
```

### 3. Astro `allowedDomains` é assado no build — e derruba POST sem derrubar a página

Já estava no comentário do `astro.config.mjs` do meridian, mas vale repetir porque o sintoma engana:
apontar o domínio novo sem adicioná-lo a `security.allowedDomains` faz **todo POST** falhar no CSRF
(login, `/admin`, `/api/*`) enquanto a página segue respondendo **200**. Mesmo formato de falha do
Clerk na Atma ([[clerk_subdomain_killed_by_nxdomain_cleanup]]). Manter o host do fornecedor na lista
durante a transição — ele continua servindo até o corte.

---

## 🛠️ Ferramenta nova

`scripts/submit-sitemap.mjs` (roihub) — submete sitemap ao GSC pela API, sem abrir a UI. A
propriedade sai do host do próprio sitemap, então promover projeto novo **não exige editar o
arquivo**:

```bash
node scripts/submit-sitemap.mjs https://<host>/sitemap.xml [...]
```

Precisa de `GOOGLE_SERVICE_ACCOUNT_JSON` no ambiente (está no `.env` do roihub) e usa escopo
`webmasters` (escrita), não `.readonly`. Coberto por `test/submit-sitemap.test.mjs` — o parser tem
branch real (`.com` × `.com.br`: sem os 3 rótulos, `roilabs.com.br` viraria `sc-domain:com.br`).

---

## 🔢 A 2ª leva: 17 projetos restantes

⚠️ **Recontar antes de começar** — a lista vem do GitHub ao vivo e o Jean mexe nela
([[roihub_github_sourced_projects]]). Todos abaixo respondiam **200** em 30/07.

### Decisão do Jean, já tomada — vale para toda a lista

> **"Quero todos ativos, vou monetizar/produtizar todos."**

Zero arquivamentos. Isso **contraria a recomendação** do handoff anterior (que previa ~6–8 promoções
+ 8 arquivamentos) e o Jean reafirmou depois de a objeção ser apresentada. **Não relitigar** — mas
registrar o custo aceito: cada subdomínio que depois for abandonado volta como NXDOMAIN, e foi isso
que consumiu 76% do crawl budget do `roilabs.com.br`
([[roilabs_dns_cloudflare_retired_subdomains]]).

| repo | host hoje | guarda-chuva sugerido |
|---|---|---|
| `claude-loop-runner` | `claude-loop-runner.vercel.app` | `roilabs.com.br` (ferramenta interna) |
| `housing-pro-api` | `housing-pro-api.vercel.app` | `roilabs.com.br` |
| `whatsmeow-gateway` | `whatsmeow-gateway.vercel.app` | `roilabs.com.br` (infra) |
| `aesthetic-perfection-page` | `lumina-demo-beryl.vercel.app` | `estetiacrm.com.br` (2ª demo, Lumina) |
| `aprovai` | `aprovai-locacao.vercel.app` | decidir |
| `moderador` | `moderador.vercel.app` | decidir |
| `reforma-maestro` | `reforma-maestro.vercel.app` | decidir |
| `potencial-arquitetado` | `potencial-arquitetado.vercel.app` | decidir |
| `cardioqwen3code` | `cardioqwen3code.vercel.app` | decidir |
| `portfolio` | `portfolio-three-mu-lfixsylpsz.vercel.app` | decidir — 🚨 ver abaixo |
| `housingpro` | `housingpro-tau.vercel.app` | **`housingpro.com.br`** — ver abaixo |
| `vertex-landing-craft` | `vertex-landing-craft.vercel.app` | decidir |
| `synth-bot-buddy` | `synth-bot-buddy.vercel.app` | decidir |
| `matchfios-textile-connector` | `matchfios-textile-connector.vercel.app` | decidir |
| `tape-vision-ai-92` | `tape-vision-ai-92.vercel.app` | decidir |
| `cardio-risk-insight-hub` | `cardio-risk-insight-hub.vercel.app` | decidir |
| `cyberspace` | `cyberspace-sigma.vercel.app` | decidir |

### 🎁 Dois domínios pagos já na conta, parados em NXDOMAIN

`vercel domains ls` mostra dois domínios **próprios, comprados, sem apontar para nada**:

- **`housingpro.com.br`** (135 dias na conta) — e `housingpro` roda em `housingpro-tau.vercel.app`.
  É a promoção mais barata da lista: o domínio já é seu, só falta o registro DNS.
- **`egtelemedicina24h.com`** (134 dias) — o repo foi apagado. **Decidir se cancela o domínio** ou se
  ele volta a ter uso; domínio pago parado é custo recorrente sem retorno.

### 🚨 `portfolio` merece atenção antes de promover

O host virou `portfolio-three-mu-lfixsylpsz.vercel.app` — isso é **URL de deploy aleatória**, não
alias estável. Ela muda a cada deploy, então além de estar fora da medição o link no hub pode
apodrecer sozinho. Vale confirmar o que esse projeto é hoje (`nimblabs.com` já é o portfólio público)
antes de gastar subdomínio nele.

---

## ▶️ Como retomar (ordem que funcionou)

Por projeto aprovado, e **nesta ordem** — inverter quebra:

1. **DNS.** Cloudflare (`roilabs.com.br`, zona `e55dc82f456e8af7ac764133b4442f19`) ou Hostinger
   (`nimblabs.com`, API `developers.hostinger.com/api/dns/v1/zones/{domínio}`).
   Padrão da casa: **Vercel = `A 76.76.21.21`**, **VPS/EasyPanel = `A 2.24.207.200`**, sempre
   `proxied: false`. Na Hostinger, `PUT` com `{"overwrite": false, "zone": [...]}` **preserva** o
   resto da zona (verificado: 12 → 14 registros, nada perdido) — ainda assim, baixe a zona antes.
2. `vercel domains add <host>` de dentro da pasta linkada (ela diz o registro exato que espera).
3. **Repontar o código** (canonical, `og:url`, `sitemap.xml`, `robots.txt`) e pushar.
4. **Confirmar que o deploy saiu de verdade** — ver correção 1 acima.
5. `gh api repos/JeanZorzetti/<repo> -X PATCH` com a `homepage` nova, **no mesmo ato**.
6. `node scripts/submit-sitemap.mjs https://<host>/sitemap.xml`.
7. Conferir que moveu em vez de duplicar: rodar `mergeProjects` contra o GitHub ao vivo e checar que
   a contagem de hosts duplicados segue **zero**.

### ⛔ O que não fazer

- **Não usar `www.<algo>.dominio`** — dois labels, Universal SSL do Cloudflare não cobre.
- **Não submeter sitemap antes do passo 3.** Sitemap com URL fora da propriedade é erro, não progresso.
- **Não confiar em `git push` para publicar.**
- 🚨 **NUNCA `yes | vercel project rm`** — apaga projetos **vizinhos** ([[vercel_project_rm_deletes_neighbors]]).
- ⚠️ **Janela de não-push: 00:00–01:00 BRT** (cron do autopublishing roda 00:13).
- ⚠️ **`vercel --prod` não roda de dentro do OneDrive** — os repos de trabalho estão em `C:\dev`
  ([[vercel_deploy_fails_under_onedrive]]).

---

## 🔑 Rotacionar quando a frente fechar

Os tokens de **Cloudflare** (`cfat_OKhw…`) e **Hostinger** (`UDPV8L7j…`) foram colados no chat de
30/07. São credenciais de **escrita em DNS de produção de todos os domínios** — mais alcance que
qualquer outra da lista. Registrados em [[secrets_to_rotate]].

Detalhe: o `.claude.json` do usuário tem 3 MCP servers da Hostinger com `HOSTINGER_API_TOKEN` ainda
em `your-token-here`. Se forem preenchidos, use já o token novo.

---

## Contexto herdado

- A 1ª leva, medição e receita original: [`handoff-proximo-passo-dominios.md`](handoff-proximo-passo-dominios.md)
- A data de 02/08 e o robô de crawl: [`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)
- DNS/Cloudflare e o custo do NXDOMAIN: [`handoff-nxdomain-subdominios.md`](handoff-nxdomain-subdominios.md)
- Projetos vêm do GitHub, não de lista fixa: [`handoff-hub-github.md`](handoff-hub-github.md)
