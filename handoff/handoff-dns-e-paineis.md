# Handoff — próximo passo: nada disto é código

Criado em **2026-07-29**, ao fim da sessão que executou
[`handoff-compass-e-repos-sem-site.md`](handoff-compass-e-repos-sem-site.md) e
[`handoff-seis-sites.md`](handoff-seis-sites.md).
Índice de todos os handoffs: [`../handoff.md`](../handoff.md).

---

## Leia isto antes de abrir qualquer arquivo

> 📍 **Este arquivo é a medição detalhada. O briefing curto da próxima sessão está em
> [`handoff-proximo-passo-30-07.md`](handoff-proximo-passo-30-07.md).**

**Não há frente de código aberta no roihub.** Sobraram **três itens de painel e DNS** — o item 3 foi
encerrado em 29/07 por decisão de produto (sem código) e o item 1c saiu com a exclusão do repo do
ProLife. Uma sessão de código não move nenhum dos outros.

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

### 1c · ~~prolifemed~~ — ENCERRADO: o ProLife saiu do hub em 29/07

**O Jean deletou os repos `ProLife` e `mhedicos` em 29/07.** Sem repo, não há projeto no hub (a lista
vem do GitHub, [[roihub_github_sourced_projects]]) — **`prolifemed.com.br` deixou de ser pendência
deste handoff.** Isso reduz o A1 herdado de 28/07: dos "3 sites fora do ar", `prolifemed` sai da conta
e `compass` é o item 2 abaixo.

Fica só o registro do que foi medido, caso o ProLife volte: apex e `www` → `187.127.2.204` (morto),
`app.prolifemed.com.br` sem A record, NS = Cloudflare, e o vhost **sumiu do EasyPanel** (404).

> 🚨 Se um dia voltar: **`prolife-next-js.vercel.app` responde 200 e NÃO serve como destino do
> `prolifemed.com.br`.** É o segundo ambiente de 23/07, Supabase com **banco vazio**
> ([[prolife_supabase_vercel_env]]) — apontar o domínio de produção para lá é o erro do `sofia-ia`
> listado nas armadilhas abaixo.

ℹ️ O `mhedicos` **não era** o repo do ProLife, como o handoff anterior supôs pelo README: era o
**Mhédicos** (`mhedicos.com`), produto próprio que só *consumia* a API do ProLife (`PROLIFE_API_KEY`).
Supor parentesco de projeto por menção no README erra.

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

## 🟡 4 · 12 repos sem `homepage` — e a maioria NÃO espera o EasyPanel

Recontado em 29/07 fim da tarde, **com `--no-archived`**: **47 repos ativos, 12 sem `homepage`.**

> ⚠️ **Contar sem filtrar arquivado dá número errado.** Uma medição intermediária desta sessão
> reportou "14, achei o `Atma`" — `Atma` está **arquivado desde 28/07** e repo arquivado é ignorado
> pelo hub de propósito (é a forma canônica de aposentar um projeto). **Sempre `gh repo list
> --no-archived`.** `ProLife` e `mhedicos` foram **deletados pelo Jean em 29/07**, o que tirou o
> `prolifemed.com.br` da conta do hub de vez.

**A premissa "9 saem da lista de domínios do EasyPanel" não se sustentou.** Lendo os READMEs, **6 dos
12 são boilerplate Lovable intocado** — o README ainda tem o literal `REPLACE_WITH_PROJECT_ID`, ou
seja, nunca receberam domínio próprio em lugar nenhum. São a mesma classe dos 9 repos que o Jean já
deletou nas sessões anteriores: **candidatos a arquivar/excluir, não a procurar URL.**

| repo | por que ainda está aqui |
|---|---|
| `roihub` | **item 3: encerrado.** Admin-only, fica vazio de propósito — **não é pendência** |
| `repo-de-teste` | **decidido: fica de fora**, é descartável |
| `splitjud` | item 1 acima: o site está fora do ar |
| `perfil360`, `loginsplit`, `obeflow`, `agattasemijoias`, `financeiromedlly` (priv), `aesthetic-perfection-page` (priv) | **boilerplate Lovable** (`REPLACE_WITH_PROJECT_ID` no README) — decidir arquivar ou excluir |
| `aprovai` | sem README e sem URL declarada — só o painel diz se está no ar |
| `cannibal_scan` | repo com código de verdade do CannibalScan (bet do portfólio nimblabs) — merece URL |
| `roi-labs-links` | página de links em PHP, nunca deployada |
| `repo-de-teste` | **decidido: fica de fora**, é descartável |
| `perfil360`, `loginsplit`, `obeflow`, `agattasemijoias`, `aprovai`, `financeiromedlly` (priv), `aesthetic-perfection-page` (priv), `mhedicos` (priv) | **não têm projeto na Vercel** — conferido nas 2 páginas do `project ls`. Se estão no ar, é EasyPanel. |
| `cannibal_scan` | é o repo com código de verdade (`size=170`); o vazio `cannibal-scan` você já deletou |
| `roi-labs-links` | página de links em PHP, nunca deployada |

**O atalho que funcionou:** ler o README pela API (`gh api repos/OWNER/REPO/readme`) e procurar URL
**declarada** — isso separou os 6 Lovable dos que merecem investigação, sem abrir painel nenhum e sem
chutar subdomínio. Chutar foi o que produziu os NXDOMAIN falsos de `splitjud` e `aftercaregen.com` na
primeira medição.

Sobra para o painel do EasyPanel: **`aprovai` e `cannibal_scan`** — dois, não nove.

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
