# Handoff — próximo passo: nada disto é código

Criado em **2026-07-29**, ao fim da sessão que executou
[`handoff-compass-e-repos-sem-site.md`](handoff-compass-e-repos-sem-site.md) e
[`handoff-seis-sites.md`](handoff-seis-sites.md).
Índice de todos os handoffs: [`../handoff.md`](../handoff.md).

---

## Leia isto antes de abrir qualquer arquivo

**Não há frente de código aberta no roihub.** Sobraram **quatro itens de painel e DNS** — o item 3
foi encerrado em 29/07 por decisão de produto, sem código. Uma sessão de código não move nenhum
dos outros.

O erro a não repetir: nas duas últimas sessões, tempo foi gasto procurando bug em coisa que era
registro de DNS apontando para o lugar errado. **Meça o DNS antes de abrir o repo** — e meça do jeito
descrito nas armadilhas, porque a primeira medição do item 1 estava errada.

Tudo abaixo foi medido em **29/07** — os itens 1, 2 e 4 foram **remedidos às ~10h BRT** e estão
datados de propósito.

---

## 🔴 1 · SplitJud caiu de verdade — e o `www` está servindo o site ZUMBI

> **Remedido em 29/07 ~10h BRT.** Duas armadilhas aqui, nesta ordem:
> a versão anterior deste item dizia "compare o A record com o IP do host onde a app roda" — não é
> uma tarefa só. E **o IP que responde 200 é o servidor velho**, não o certo. Confirmar conteúdo
> antes de apagar registro.

### 1a · Qual IP é qual (medido, não inferido)

```
187.127.2.204   timeout, 0 portas abertas   ← era AQUI o site Astro correto. HOST MORTO.
185.158.133.1   200 OK                      ← é o ZUMBI Vite/Lovable pré-split. Ainda no ar.
```

`185.158.133.1` está confirmado como o zumbi de [[splitjud_www_dns_orphan]] pela fingerprint:
title `Split Jud - Automatize a Divisão de Honorários Advocatícios`, shell de **1917 bytes**, bundle
**`/assets/index-BYI09l9g.js` (Vite)** sem nenhum `/_astro/`, e `/sitemap-index.xml`,
`/sitemap-0.xml`, `/sitemap.xml` todos **404**.

**Estado real dos três nomes:**

| nome | A records | o que o usuário vê |
|---|---|---|
| `splitjud.com.br` | só `187.127.2.204` | **fora do ar** |
| `app.splitjud.com.br` | só `187.127.2.204` | **fora do ar** |
| `www.splitjud.com.br` | os **dois** | round-robin: metade timeout, metade **conteúdo de 2 anos atrás** |

O `www` é o pior dos três: não está "fora do ar", está **servindo conteúdo velho para usuário e para
o Googlebot**, com sitemap 404. É dano de SEO acontecendo agora, não indisponibilidade.

### 1b · O que fazer, na ordem

1. **Achar onde o site Astro roda hoje.** Não é o EasyPanel: `2.24.207.200` devolve **404** para os
   Hosts `splitjud.com.br`, `app.splitjud.com.br` e `prolifemed.com.br` — **o vhost sumiu de lá.**
   Esta é a única tarefa que exige painel, e é o gargalo do item inteiro.
2. **Apontar os três nomes** para esse host, no **Registro.br** — os NS de `splitjud.com.br` são
   `e.sec.dns.br` / `f.sec.dns.br`, **não Cloudflare**. Procurar essa zona no Cloudflare é perder a sessão.
3. **Deletar o A `185.158.133.1` do `www` e desligar aquele servidor.** Enquanto ele existir, qualquer
   conserto continua sendo sorteado contra o conteúdo velho.

⚠️ **Não deletar o `185.158.133.1` sozinho como "conserto rápido"**: sem o passo 1, isso deixa o `www`
só com o IP morto e derruba os 50% que ainda respondiam. O passo 3 vem **depois** do 2.

⚠️ `185.158.133.1` é edge **Cloudflare-for-SaaS** (cert Google Trust Services com SAN único
`www.splitjud.com.br`; devolve **409** para apex e `app`) — ou seja, o zumbi está atrás de um
Cloudflare de **outra conta/plataforma**, não do Cloudflare do `roilabs`. Desligá-lo pode exigir achar
onde aquele deploy Lovable/Vite ainda vive.

### 1c · prolifemed: nenhum host vivo

Apex e `www` → `187.127.2.204` (morto). `app.prolifemed.com.br` **não tem A record**. NS =
**`dale/jo.ns.cloudflare.com` = Cloudflare** (aqui sim). O EasyPanel (`2.24.207.200`) devolve **404**
para os Hosts `prolifemed.com.br`, `splitjud.com.br` e `app.splitjud.com.br` — **o vhost sumiu de lá.**
Descobrir onde o ProLife roda hoje é trabalho de painel, não de DNS.

> 🚨 **`prolife-next-js.vercel.app` responde 200 — NÃO aponte `prolifemed.com.br` para ele.** É o
> segundo ambiente de 23/07, Supabase com **banco vazio** ([[prolife_supabase_vercel_env]]). Apontar
> o domínio de produção para lá é exatamente o erro do `sofia-ia` listado nas armadilhas abaixo.

**A `homepage` do repo `splitjud` segue vazia** até 1a estar feito e o `www` responder 200 de forma
estável. Preencher antes só coloca um card vermelho no ranking.

---

## 🟠 2 · Compass: falta 1 registro de DNS e 8 segredos

O deploy **já está feito e verde**: `vercel project ls` → **`compass` → https://compass-ten-plum.vercel.app**
(`/` e `/login` respondem 200). Clonado em `C:\dev\compass` (fora do OneDrive, obrigatório).

**a) O registro de DNS.** `compass.polarisia.com.br` já está anexado ao projeto na Vercel, mas o A
record ainda aponta para o EasyPanel (por isso o 404 de proxy continua). Os nameservers são
**`aster/helios.dns-parking.com` = Hostinger, não Cloudflare**:

```
A  compass  76.76.21.21
```

> Reconferido em 29/07 ~10h: `compass.polarisia.com.br` **ainda resolve `2.24.207.200`** (EasyPanel) e
> devolve 404. O registro **não foi trocado** — nada aqui avançou.

A `homepage` do repo **não foi mexida** de propósito: segue `https://compass.polarisia.com.br/`, que é
a URL final. Quando o DNS propagar, **o card fica verde sozinho** — e o `APP_URL` na Vercel deve
passar a apontar para o domínio.

**b) Os segredos.** `/pricing` devolve **500** e vai continuar até entrarem na Vercel:

`DATABASE_URL` · `AUTH_RESEND_KEY` · `AUTH_GITHUB_ID` · `AUTH_GITHUB_SECRET` ·
`STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `STRIPE_PRICE_PRO_MONTHLY` · `STRIPE_PRICE_LIFETIME` ·
`ANTHROPIC_API_KEY`

Já setados: `AUTH_SECRET` e `CRON_SECRET` (**gerados novos** — é a rotação de [[secrets_to_rotate]]
acontecendo; **não recolar os antigos**), `ADMIN_EMAIL`, `APP_URL`.
Opcionais, já com default no código: `TRIAL_DAYS` (7), `LIFETIME_SLOTS` (50), `EMAIL_FROM`.

**O `DATABASE_URL` é a pergunta de verdade:** o serviço antigo sumiu do EasyPanel, então descobrir se
o Postgres do Compass ainda existe lá é o primeiro passo — se não existir, é banco novo + `migrate deploy`.

---

## ✅ 3 · DECIDIDO em 29/07 — o hub fica fora do próprio ranking, para sempre

`https://hub.roilabs.com.br` → **401** (basic auth), e a checagem de saúde usa `res.ok`, então 401
contaria como "fora do ar".

**Decisão do Jean: o `roihub` é 100% admin e nunca terá site público.** Logo ele não é um dos
projetos que se rankeia, e a `homepage` do repo **fica vazia de propósito**.

**Não mexer na função de health** para acomodar 401/403 — não há caso de uso. Se um dia entrar um
projeto público atrás de auth, aí sim reabrir. **Item encerrado; não reabrir como bug de "repo sem
homepage".**

---

## 🟡 4 · 14 repos ainda sem `homepage` — 9 saem numa visita só

Situação recontada em 29/07 ~10h: **são 14 sem `homepage`, não 13** — a contagem anterior perdeu o
**`Atma`** (público, 75 MB, o maior repo da conta).

| repo | por que ainda está aqui |
|---|---|
| `roihub` | **item 3: encerrado.** Admin-only, fica vazio de propósito — não é pendência |
| `splitjud` | item 1a acima: um A record zumbi a deletar no Registro.br |
| `Atma` | tem projeto Vercel `atma` → `atma.roilabs.com.br`, mas esse subdomínio é **NXDOMAIN** (um dos 14 aposentados de [[roilabs_dns_cloudflare_retired_subdomains]]). Criar o registro no Cloudflare **ou** usar a URL `*.vercel.app` |
| `repo-de-teste` | **decidido: fica de fora**, é descartável |
| `perfil360`, `loginsplit`, `obeflow`, `agattasemijoias`, `aprovai`, `financeiromedlly` (priv), `aesthetic-perfection-page` (priv), `mhedicos` (priv) | **não têm projeto na Vercel** — conferido nas 2 páginas do `project ls`. Se estão no ar, é EasyPanel. |
| `cannibal_scan` | é o repo com código de verdade (`size=170`); o vazio `cannibal-scan` você já deletou |
| `roi-labs-links` | página de links em PHP, nunca deployada |

**O atalho:** a lista de domínios do painel do EasyPanel resolve os **9 de uma vez** — e é a mesma
visita que os itens 1 e 2 já exigem. Não chutar subdomínio: foi o que produziu os NXDOMAIN falsos de
`splitjud` e `aftercaregen.com` na primeira medição.

`mhedicos` referencia `prolifemed.com.br` no README, então provavelmente é o repo do ProLife —
depende do item 1 para ter URL viva.

---

## 🟢 5 · Domínio próprio para os 6 sites novos (quando quiser)

Os seis estão em `*.vercel.app` e **funcionando**:

`sem-swarm` · `claude-loop-runner` · `seo-forecaster-pi` · `whatsmeow-gateway` · `housing-pro-api` ·
`moderador` — detalhes em [`handoff-seis-sites.md`](handoff-seis-sites.md).

⚠️ **Ao trocar por subdomínio de `roilabs.com.br`, trocar a `homepage` do repo no mesmo passo.** A
chave de um projeto no hub é a **URL**, não o repo: mudar o domínio sem mudar a `homepage` cria um
projeto duplicado no ranking em vez de mover o existente.

---

## Armadilhas herdadas (custaram tempo, não repetir)

- ✅ **Como o item 1 foi corrigido — repetir esta medição antes de tocar em DNS.** `Resolve-DnsName`
  para ver **todos** os A records (um nome pode ter dois, e o cliente escolhe), e depois
  `curl --resolve host:443:IP` para perguntar a cada IP candidato se ele serve aquele Host.
  **404 = vhost não existe** (EasyPanel), **409 = Cloudflare-for-SaaS sem custom hostname**,
  **timeout = host morto**. Os três parecem "fora do ar" pelo browser e têm consertos diferentes.
  Conferir o SAN do cert (`openssl s_client -servername`) diz para quais nomes aquele host aceita servir.
- ⚠️ **`res.ok`/`fetch` não reconsulta A records como o curl.** `www.splitjud.com.br` deu 10/10 no curl
  e timeout no `Invoke-WebRequest` no mesmo minuto. **Um "fora do ar" no ranking pode ser round-robin
  com um IP morto** — medir com os dois clientes antes de caçar bug.
- 🚨 **200 não prova que é o servidor CERTO.** No `www.splitjud.com.br` o IP que responde 200 é o
  servidor zumbi, e o que dá timeout é o que tinha o site bom. Com dois A records, **conferir o
  conteúdo** (title, tamanho do HTML, `/_astro/` vs `/assets/index-*.js`, sitemap) antes de decidir
  qual registro apagar. Um "conserto de DNS" feito só pelo status code teria apagado o site certo.

- 🚫 **"Fora do ar" pode estar rodando em outra plataforma.** `vercel project ls` responde "não existe
  **na Vercel**", não "não existe". Em 29/07 o `sofia-ia` foi deployado por engano na Vercel — o
  Polaris já rodava no EasyPanel com o mesmo repo, e o deploy criou um segundo ambiente de produção
  **contra o banco real**.
- 🚨 **NUNCA `yes | vercel project rm`.** O comando é interativo, não tem `--yes`, e o `yes` apaga
  **projetos vizinhos** (levou `eg`, `eg-site` e `roi-zenith`).
- ⛔ **`vercel --prod` não roda de pasta dentro do OneDrive** (`UNKNOWN: unknown error, read`).
  Clonar em `C:\dev\<repo>` e deployar de lá.
- **A URL de produção nem sempre é `<projeto>.vercel.app`** — o `seo-forecaster` saiu como
  `seo-forecaster-pi.vercel.app`. **Ler do `vercel project ls` e confirmar com `curl` antes de gravar
  a `homepage`.**
- **`gh repo edit --homepage` não funciona no PowerShell** — usar `echo '{"homepage":"..."}' | gh api
  repos/JeanZorzetti/<repo> -X PATCH --input -` (pelo Bash tool).
- **`vercel project ls` pagina em 20** — projeto "sumido" pode estar na página 2.
- ⚠️ **Janela de não-push: 00:00–01:00 BRT** (o cron do autopublishing roda 00:13).
