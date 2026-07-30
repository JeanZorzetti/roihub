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

### 🎁 Dois domínios pagos já na conta ~~parados em NXDOMAIN~~

> 🛑 **SUPERADO — as duas premissas caíram.** `housingpro.com.br` **não** estava em NXDOMAIN (já
> resolvia e servia o projeto), e no fim da sessão **os dois repos foram apagados** pelo Jean. Os
> domínios seguem pagos e sem produto: são custo recorrente, não oportunidade. Ver a seção de
> exclusões no fim do documento. Mantido aqui só para explicar por que a leva foi planejada assim.

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

## 🔄 Sessão 30/07 (2ª) — a leva inteira saiu; housingpro depois foi apagado

### `housingpro` promovido — mas a premissa deste handoff estava errada

🚨 **`housingpro.com.br` NÃO estava em NXDOMAIN.** Já resolvia para `216.198.79.1` (o A record novo
da Vercel, não o `76.76.21.21` da receita), apex em **307 → `www`**, `www` em **200**, servindo o
projeto certo, canonical e sitemap já corretos. A frase "dois domínios pagos parados em NXDOMAIN"
era estado velho. Confirma [[roihub_agenda_task_premises_unverified]]: **medir antes de executar** —
a promoção "mais barata da lista" já estava 80% pronta.

O que faltava e foi feito:

- `src/app/robots.ts` (rota nativa do Next, não arquivo em `public/`) — commit `05cf658`, robots.txt
  em 200 apontando o sitemap. ⏱️ Levou ~1 min de deploy; as 3 primeiras leituras deram 404.
- `homepage` do repo → `https://www.housingpro.com.br` via `gh api -X PATCH`.
- Contagem: **22 domínio próprio / 16 fornecedor** (o 17º é `EGTelemedicina`, repo apagado que ainda
  aparece na listagem). Zero hosts duplicados, `node --test test/projects.test.mjs` 7/7.

⛔ **Sitemap NÃO submetido**, e agora não será: `sc-domain:housingpro.com.br` não existia no Search
Console, e no fim da sessão **o Jean apagou o repo `housingpro`**. Ficou sem efeito — inclusive o
`robots.ts` commitado acima. Ver a seção de exclusões no fim do documento.

Detalhe que **continua valendo** para qualquer submissão futura: `node --env-file=.env
scripts/submit-sitemap.mjs …` — o `GOOGLE_SERVICE_ACCOUNT_JSON` é um JSON de uma linha e o Node lê
direto, sem dotenv e sem exportar nada à mão.

### ✅ 2ª LEVA EXECUTADA — a frente fechou

Token do Cloudflare recebido no fim da sessão e **os 15 projetos restantes foram promovidos**.

| | 30/07 manhã | 30/07 fim (1ª leva) | **agora** |
|---|---|---|---|
| domínio próprio | 17 | 21 | **35** |
| domínio de fornecedor | 22 | 17 | **1** |
| hosts duplicados | — | zero | **zero** |

**Todo projeto vivo está em domínio próprio.** O único em host de fornecedor é o `portfolio`, que é
**exceção pedida pelo Jean** (vai comprar domínio para o CV depois) — não pendência. `housingpro` e
`EGTelemedicina` saíram da conta porque os repos foram apagados; ver a seção de exclusões abaixo.

**15/15 verdes** na verificação final — `/` em 200, `/sitemap.xml` servindo XML de verdade e
canonical apontando para o próprio host. Todos os 15 sitemaps aceitos no GSC.

| repo | host novo | como publicou |
|---|---|---|
| `claude-loop-runner` | `claude-loop-runner.roilabs.com.br` | manual |
| `housing-pro-api` | `housing-pro-api.roilabs.com.br` | manual |
| `whatsmeow-gateway` | `whatsmeow-gateway.roilabs.com.br` | manual |
| `aprovai` | `aprovai.roilabs.com.br` | manual |
| `moderador` | `moderador.roilabs.com.br` | manual |
| `reforma-maestro` | **`financeiro-obras.roilabs.com.br`** | manual (`frontend-next/`) |
| `potencial-arquitetado` | `potencial-arquitetado.roilabs.com.br` | git push |
| `cardioqwen3code` | `cardioqwen3code.roilabs.com.br` | manual (`frontend/`) |
| `vertex-landing-craft` | `vertex-landing-craft.roilabs.com.br` | manual |
| `synth-bot-buddy` | `synth-bot-buddy.roilabs.com.br` | manual (`frontend/`) |
| `matchfios-textile-connector` | `matchfios-textile-connector.roilabs.com.br` | git push |
| `cardio-risk-insight-hub` | `cardio-risk-insight-hub.roilabs.com.br` | git push (depois do fix) |
| `cyberspace` | `cyberspace.roilabs.com.br` | git push |
| `aesthetic-perfection-page` | `lumina.estetiacrm.com.br` | git push |
| `tape-vision-ai-92` | `tape-vision-ai-92.roilabs.com.br` | ⚠️ repo VAZIO |

DNS: 14 registros A novos na `roilabs.com.br` (Cloudflare, `76.76.21.21`, `proxied:false`) e
`lumina` na `estetiacrm.com.br` (Hostinger — zona 9 → 10 registros, nada perdido; o
`{"overwrite": false}` do handoff se confirmou). Backup da zona Cloudflare tirado antes de escrever.

### 🔧 As cinco correções desta leva (todas descobertas rodando)

#### 1. Título igual não prova qual pasta é deployada

`reforma-maestro` tem `frontend/` (Vite) **e** `frontend-next/` (Next) com **exatamente o mesmo
`<title>`**. Casar título do ar com título local apontou para a pasta errada, e o deploy só falhou no
build (`No Next.js version detected`). **Confirme pelo preset do projeto**, que não mente:

```bash
vercel project inspect <projeto> | grep -iE "Root Directory|Framework Preset"
```

#### 2. `robots.txt` em 200 não prova que seu deploy subiu

`synth-bot-buddy` já tinha um `public/robots.txt` antigo (`User-agent: Googlebot`). O teste "responde
200 e começa com User-agent" deu verde num deploy que **nunca aconteceu**. O sinal honesto é
`/sitemap.xml` **começar com `<?xml`** — numa SPA o fallback devolve o `index.html` com status 200,
então status sozinho nunca serve:

```bash
curl -s https://<host>/sitemap.xml | head -c 5   # tem que ser <?xml
```

#### 3. `vercel.json` com catch-all engole `/sitemap.xml` e `/robots.txt`

`cardio-risk-insight-hub` tinha `"routes": [{"src": "/(.*)", "dest": "/"}]`. Toda URL servia a home —
inclusive o sitemap, que voltava HTML. 🚨 **Mas remover só o `routes` derrubou o site inteiro para
404:** com o bloco legado `builds`, o roteamento automático está desligado e `routes` é a única coisa
que roteia. O conserto certo é **matar o `builds`** e deixar a Vercel detectar:

```json
{ "framework": "nextjs", "regions": ["gru1"] }
```

#### 4. Deploy manual verde + `git push` depois = o push desfaz o manual

Mesmo projeto: o deploy manual de dentro de `frontend/` ficou 200, e o `git push` seguinte derrubou
para 404 de novo. O projeto **era** git-connected, com Root Directory `.`, onde havia um
`vercel.json` mandando `@vercel/static-build` num `package.json` **que não existe**. Os dois caminhos
publicavam coisas diferentes. Conserto = alinhar o projeto à pasta real, via API (a CLI não expõe):

```python
PATCH https://api.vercel.com/v9/projects/{id}?teamId={org}
{"rootDirectory": "frontend", "framework": "nextjs"}
# token em %APPDATA%\com.vercel.cli\Data\auth.json ; ids em <pasta>/.vercel/project.json
```

**Regra que sai daí:** depois de deploy manual, ou não pushe, ou verifique de novo **depois** do
push. Verificar antes do push é verificar o deploy errado.

#### 5. Canonical cruzado entre dois projetos homônimos

`vertex-landing-craft` (Vértice **Marketing**, agência) tinha `metadataBase`, `openGraph.url`,
`alternates.canonical`, `robots.ts`, `sitemap.ts` e o `@graph` inteiro apontando para
`vertice.roilabs.com.br` — que é o **outro** produto (Vértice Onboarding, repo `vertice`). Isso
declara ao Google que a agência é duplicata do SaaS, e deindexaria a agência inteira. Trocado em 5
arquivos. **Repo gerado por Lovable/clonado herda URL de irmão: grepe o domínio antigo no repo todo,
não só no layout.**

### 📌 Escolhas de nome que fugiram da regra mecânica

- **`reforma-maestro` → `financeiro-obras.roilabs.com.br`**, não `reforma-maestro.…`: o
  `sitemap.ts`/`robots.ts` do próprio repo já apontavam para `financeiro-obras`. Seguir o código
  custou 1 registro DNS e evitou reescrever dois arquivos. O registro `reforma-maestro` criado por
  engano foi **deletado** e o alias removido da Vercel.
- **`vertex-landing-craft` ficou com o nome do repo**: `vertice.roilabs.com.br` já é do repo
  `vertice`.

### ⚠️ Pendência real que sobrou — uma só

**`tape-vision-ai-92` é um repo VAZIO** (`git log` → *branch appears to be broken*). O host novo
responde 200 servindo um deploy antigo, mas **não há código para repontar**: canonical é `/`,
`/sitemap.xml` e `/robots.txt` devolvem HTML de fallback. **O sitemap dele NÃO foi submetido** ao GSC
de propósito — seria rejeitado. Decidir se o fonte volta ou se o projeto sai do hub.

### 🗑️ Fechadas por exclusão de repo (30/07, decisão do Jean)

- **`housingpro` — repo APAGADO.** Some do hub sozinho (a lista vem do GitHub). Cai junto a pendência
  da propriedade no Search Console: não há mais o que medir. ⚠️ Mas **`www.housingpro.com.br` segue
  em 200** — projeto vivo na Vercel + domínio pago (135 dias), agora **sem repo**. Mesmo formato da
  EG. Se não for reusado, é custo recorrente: cancelar o domínio e apagar o projeto na Vercel.
- **`egtelemedicina24h.com` → 301: CANCELADO.** O Jean mandou esquecer; o repo já estava apagado. Não
  reabrir — nem o redirect, nem o domínio.

⚠️ `eg-telemedicina.vercel.app` **ainda aparece** em `gh api user/repos` (cache da listagem) com o
repo em 404. Ao recontar, confie no GET direto — senão a conta de "domínio de fornecedor" sai com 1 a
mais do que a realidade.

### 🚧 O bloqueador que existia: o token do Cloudflare

O passo 1 (DNS) é o primeiro da receita e **não há token de Cloudflare nem de Hostinger em nenhum
`.env` da máquina** — varredura feita em `ROI Labs/` e `C:\dev`. O `.env` do roihub tem só
`DATABASE_URL` e `GOOGLE_SERVICE_ACCOUNT_JSON`. Os tokens de 30/07 existiram só no chat.

**Para retomar, exportar antes de qualquer coisa:**

```bash
export CLOUDFLARE_API_TOKEN=...   # zona roilabs.com.br = e55dc82f456e8af7ac764133b4442f19
```

(A Hostinger só é necessária se algum projeto for para `nimblabs.com` — pela decisão abaixo, nenhum vai.)

### 📌 Decisões do Jean nesta sessão

1. **Guarda-chuva em lote: `<repo>.roilabs.com.br` para os 12 "decidir".** Uma zona só, um token só.
   Mantida a exceção do handoff: `aesthetic-perfection-page` → `estetiacrm.com.br` (2ª demo Lumina).
2. **`portfolio` é exceção — não promover.** Jean vai comprar um domínio próprio para o CV pessoal
   depois. Confirmado que o repo é o CV ("Jean Zorzetti — Full-Stack Engineer, AI-augmented", Astro
   em `C:\dev\portfolio`), distinto do `nimblabs.com`. Segue no host aleatório até o domínio existir.
3. ~~**`egtelemedicina24h.com` → 301 para `roilabs.com.br`.**~~ **REVOGADA no fim da sessão** — "esqueça
   a EG, já exclui o repo dela". Não implementar o redirect.
4. **`housingpro`: repo apagado** no fim da sessão, depois de promovido. Sai do hub sozinho.

### 🔎 Recon já feito — os 15 repos da fila

**Todos os 6 clonados localmente têm `.vercel/project.json`.** Ou seja, a correção 1 vale para
**100%** da leva: nenhum publica por `git push`, todos exigem `vercel deploy --prod` rodado de dentro
da pasta linkada. Planejar deploy manual desde o começo, não descobrir no passo 4.

| repo | clone | root do deploy |
|---|---|---|
| `claude-loop-runner` | `C:\dev\claude-loop-runner` | `site/` |
| `housing-pro-api` | `C:\dev\housing-pro-api` | `site/` |
| `whatsmeow-gateway` | `C:\dev\whatsmeow-gateway` | `site/` |
| `aprovai` | `C:\dev\aprovai` | `site/` |
| `moderador` | `C:\dev\moderador` | `site/` |
| `aesthetic-perfection-page` | `C:\dev\aesthetic-perfection-page` | raiz |

Os 9 restantes (`reforma-maestro`, `potencial-arquitetado`, `cardioqwen3code`, `vertex-landing-craft`,
`synth-bot-buddy`, `matchfios-textile-connector`, `tape-vision-ai-92`, `cardio-risk-insight-hub`,
`cyberspace`) **não têm clone local** — `gh repo clone` **em `C:\dev`**, nunca no OneDrive
([[vercel_deploy_fails_under_onedrive]]).

⚠️ Achado solto: `housing-pro-next` estava com `next.config.ts` **deletado** na working tree, sem
commit. Restaurado com `git checkout --`. Se reaparecer, alguém está apagando de propósito.

---

## Contexto herdado

- A 1ª leva, medição e receita original: [`handoff-proximo-passo-dominios.md`](handoff-proximo-passo-dominios.md)
- A data de 02/08 e o robô de crawl: [`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)
- DNS/Cloudflare e o custo do NXDOMAIN: [`handoff-nxdomain-subdominios.md`](handoff-nxdomain-subdominios.md)
- Projetos vêm do GitHub, não de lista fixa: [`handoff-hub-github.md`](handoff-hub-github.md)
