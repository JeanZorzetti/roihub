# Handoff — próximo passo: nada disto é código

Criado em **2026-07-29**, ao fim da sessão que executou
[`handoff-compass-e-repos-sem-site.md`](handoff-compass-e-repos-sem-site.md) e
[`handoff-seis-sites.md`](handoff-seis-sites.md).
Índice de todos os handoffs: [`../handoff.md`](../handoff.md).

---

## Leia isto antes de abrir qualquer arquivo

**Não há frente de código aberta no roihub.** O que sobrou são **cinco itens de painel e DNS**, e
quatro deles se resolvem na mesma visita ao EasyPanel + provedor de DNS. Uma sessão de código não
move nenhum.

O erro a não repetir: nas duas últimas sessões, tempo foi gasto procurando bug em coisa que era
registro de DNS apontando para o lugar errado. **Meça o DNS antes de abrir o repo.**

Tudo abaixo foi medido em **29/07, fim da sessão** — os números estão datados de propósito.

---

## 🔴 1 · Dois sites de produção mortos no mesmo IP

**Maior impacto da lista, e a causa já está isolada.**

```
splitjud.com.br      →  187.127.2.204    porta 443: timeout · porta 80: timeout
app.splitjud.com.br  →  187.127.2.204    idem
prolifemed.com.br    →  187.127.2.204    idem
```

**O que isso já prova, para não redescobrir:**

- **Resolvem de verdade.** Confirmado em `8.8.8.8` e no DoH da Cloudflare (`Status: 0`). **Não é
  sequestro de NXDOMAIN do provedor** — um domínio inexistente devolve `Non-existent domain` normal
  no mesmo resolvedor.
- **Não é o VPS do EasyPanel.** O EasyPanel é `2.24.207.200` e responde. `187.127.2.204` é faixa
  residencial brasileira e **não responde em porta nenhuma**.
- Ou seja: **o A record aponta para o lugar errado, ou o host que estava ali morreu.**

**O que fazer:** abrir o DNS dos dois domínios e comparar o A record com o IP do host onde a aplicação
realmente roda hoje. Se for o EasyPanel, é `2.24.207.200`. Isso encerra o **A1** que arrasta desde
28/07 (`prolifemed` é um dos "3 sites fora do ar" de lá).

⚠️ `splitjud` também tem um **`www` com A record zumbi** anotado em [[splitjud_www_dns_orphan]] —
conferir os dois nomes na mesma passada.

**Só depois que responderem 200**, preencher a `homepage` do repo `splitjud` (hoje vazia). Preencher
antes só coloca um card vermelho no ranking.

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

## 🟡 3 · Decisão sua: o hub devolve 401 e se mostraria vermelho

`https://hub.roilabs.com.br` → **401** (basic auth). A checagem de saúde usa `res.ok`, então **401 e
403 contam como "fora do ar"**. O repo `roihub` está sem `homepage` por causa disso — se preencher
hoje, o hub aparece no próprio ranking marcado como caído.

Duas saídas, e é decisão de produto, não de código:

- **Tratar 401/403 como no ar** (o host respondeu, logo está de pé) — mexe em `lib/projects.mjs` /
  na função de health, e vale para qualquer projeto futuro atrás de auth.
- **Deixar o hub fora do próprio ranking** — preço zero, e é defensável: o hub não é um dos projetos
  que ele rankeia.

---

## 🟡 4 · 13 repos ainda sem `homepage` — 9 saem numa visita só

Situação em 29/07: **35 repos com `homepage`, 13 sem** (eram 20/31 no começo do dia).

| repo | por que ainda está aqui |
|---|---|
| `roihub` | item 3 acima, decisão sua |
| `splitjud` | item 1 acima, o site está morto |
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
