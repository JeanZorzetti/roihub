# Handoff — próximo passo (escrito 29/07, para a sessão seguinte)

Substitui [`handoff-proximo-passo.md`](handoff-proximo-passo.md) (28/07), cujo A1 encolheu.
Medição detalhada: [`handoff-dns-e-paineis.md`](handoff-dns-e-paineis.md).
Índice: [`../handoff.md`](../handoff.md).

---

## Leia isto antes de abrir qualquer arquivo

**Não abra o repo. Não há frente de código no roihub.**

Sobraram **três itens**, e os três se resolvem em **painel e DNS**. Uma sessão de código não move
nenhum — já foram três sessões seguidas confirmando isso. Se você começou esta sessão procurando o
que programar, a resposta é: **nada aqui.** O trabalho é do Jean, num navegador.

Se a sessão for de código de verdade, o alvo não é o roihub — é o backlog dos projetos que ele
rankeia (`/agenda` e a coluna "Próxima ação" da home dizem qual).

---

## A ordem: 1 → 2 → 3

### 🔴 1 · SplitJud — único site de produção fora do ar que ainda é do hub

É o item de maior impacto **e o único que ainda perde tráfego a cada dia**.

Estado medido em 29/07:

| nome | A records | o que acontece |
|---|---|---|
| `splitjud.com.br` | só `187.127.2.204` | **fora do ar** (host morto, 0 portas) |
| `app.splitjud.com.br` | só `187.127.2.204` | **fora do ar** |
| `www.splitjud.com.br` | `187.127.2.204` **+** `185.158.133.1` | metade timeout, metade **site de 2 anos atrás** |

**O `www` é o pior dos três, e não é indisponibilidade — é dano ativo.** O IP que responde 200
(`185.158.133.1`) é o zumbi Vite/Lovable pré-split, e ele está servindo conteúdo velho com sitemap
404 **para o Googlebot**. Confirmado por fingerprint: shell de 1917 bytes, bundle
`/assets/index-BYI09l9g.js`, zero `/_astro/`.

**Passos, nesta ordem — a ordem importa:**

1. **Achar onde o site Astro roda hoje.** **Não é o EasyPanel**: `2.24.207.200` devolve 404 para os
   Hosts `splitjud.com.br` e `app.splitjud.com.br`, ou seja, o vhost sumiu de lá. **Este é o passo
   bloqueante** — sem um host vivo, nenhum dos outros dois pode ser feito.
2. **Apontar os três nomes** para esse host. **A zona fica no Registro.br** (NS = `e.sec.dns.br` /
   `f.sec.dns.br`), **não no Cloudflare** — procurar essa zona no Cloudflare queima a sessão.
3. **Só então** deletar o A `185.158.133.1` do `www` e desligar aquele servidor.

⛔ **Não faça o passo 3 primeiro como "conserto rápido".** Sem o passo 1, isso deixa o `www` com zero
IPs vivos e derruba os 50% que ainda respondiam. Piora.

Depois que os três responderem 200, aí sim preencher a `homepage` do repo `splitjud` (hoje vazia de
propósito — preencher antes só põe um card vermelho no ranking).

### 🟠 2 · Compass — 1 registro de DNS + 8 segredos

O deploy **já está verde**: `compass-ten-plum.vercel.app` responde 200 em `/` e `/login`.

**a)** `compass.polarisia.com.br` ainda resolve `2.24.207.200` (EasyPanel) e dá 404. O domínio já
está anexado ao projeto na Vercel; falta **um A record**, e os NS são **Hostinger**
(`aster/helios.dns-parking.com`), não Cloudflare:

```
A  compass  76.76.21.21
```

A `homepage` do repo já aponta para `https://compass.polarisia.com.br/`, então **o card fica verde
sozinho** quando propagar.

**b)** `/pricing` devolve **500** até estes entrarem na Vercel: `DATABASE_URL`, `AUTH_RESEND_KEY`,
`AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_LIFETIME`, `ANTHROPIC_API_KEY`.

⚠️ `AUTH_SECRET` e `CRON_SECRET` já foram setados **com valores novos** — é a rotação de
[[secrets_to_rotate]] acontecendo. **Não recolar os antigos.**

**O `DATABASE_URL` é a pergunta de verdade:** o serviço sumiu do EasyPanel. Descobrir se o Postgres
do Compass ainda existe é o primeiro passo; se não existir, é banco novo + `migrate deploy`.

### 🟡 3 · 12 repos sem `homepage` — mas só 2 dependem de painel

Recontado em 29/07 **com `--no-archived`**: 47 repos ativos, 12 sem `homepage`. Destes:

- **2 são decisão fechada, não pendência:** `roihub` (admin-only, fica vazio de propósito) e
  `repo-de-teste` (descartável).
- **1 é o item 1:** `splitjud`.
- **6 são boilerplate Lovable intocado** — README ainda com o literal `REPLACE_WITH_PROJECT_ID`, ou
  seja, nunca tiveram domínio: `perfil360`, `loginsplit`, `obeflow`, `agattasemijoias`,
  `financeiromedlly` (priv), `aesthetic-perfection-page` (priv). **Decisão do Jean: arquivar ou
  excluir.** É a mesma classe dos 9 que ele já deletou nas sessões anteriores.
- **1 merece URL:** `cannibal_scan` — é o repo com o código real do CannibalScan, bet do portfólio.
- **2 só o painel resolve:** `cannibal_scan` e `aprovai` (sem README, sem URL declarada).
- `roi-labs-links` é página de links em PHP, nunca deployada.

**Arquivar é melhor que limpar a `homepage`** para aposentar projeto: repo arquivado é ignorado pelo
hub e o histórico continua lá (decisão de 28/07).

---

## O que saiu da lista em 29/07 (não reabrir)

- ✅ **Item do hub no ranking — encerrado por decisão de produto.** "O roihub é 100% admin, não terá
  site público" (Jean). Logo ele não é um projeto ranqueado, a `homepage` do repo fica vazia de
  propósito, e **não se mexe na checagem de saúde para tratar 401/403 como "no ar"** — não há caso de
  uso. Reabrir só se entrar um projeto **público** atrás de auth.
- ✅ **ProLife saiu do hub.** Os repos `ProLife` e `mhedicos` foram deletados pelo Jean em 29/07. Sem
  repo não há projeto (a lista vem do GitHub), então **`prolifemed.com.br` não é mais pendência** —
  o A1 herdado de 28/07 encolheu de 3 sites para o `splitjud` + o `compass` do item 2.

---

## Armadilhas desta sessão (as caras)

- 🚨 **200 não prova que é o servidor certo.** No `www.splitjud.com.br` o IP que responde 200 é o
  zumbi e o que dá timeout é o do site bom. Com dois A records, **conferir o conteúdo** (title,
  bytes, `/_astro/` vs `/assets/index-*.js`, sitemap) antes de decidir qual apagar. Decidir pelo
  status code teria apagado o registro certo.
- 🚨 **`gh repo list` sem `--no-archived` infla a contagem.** Uma medição intermediária reportou "14
  repos, achei o `Atma`" — o `Atma` está arquivado desde 28/07 e é ignorado pelo hub de propósito.
- ⚠️ **`fetch`/`Invoke-WebRequest` não reconsulta A records como o `curl` faz.** O mesmo host deu
  10/10 no curl e timeout no PowerShell no mesmo minuto. **Um "fora do ar" no ranking pode ser
  round-robin com um IP morto.**
- ⚠️ **Menção no README não prova parentesco de projeto.** O handoff anterior concluiu que `mhedicos`
  era o repo do ProLife porque citava `prolifemed.com.br`; era produto próprio que só consumia a API.
- ✅ **O atalho que funcionou:** `gh api repos/OWNER/REPO/readme` e procurar URL **declarada** separou
  os 6 Lovable dos que merecem investigação — sem abrir painel e sem chutar subdomínio (chutar foi o
  que gerou os NXDOMAIN falsos na primeira medição).

## Como medir DNS direito (reusar, não reinventar)

1. `Resolve-DnsName` para ver **todos** os A records — um nome pode ter dois e o cliente sorteia.
2. `curl --resolve host:443:IP` para perguntar a **cada IP** se ele serve aquele Host.
3. Ler o código: **404** = vhost não existe (EasyPanel) · **409** = Cloudflare-for-SaaS sem custom
   hostname · **timeout** = host morto. Os três parecem "fora do ar" no browser e têm consertos
   diferentes.
4. `openssl s_client -servername` mostra para quais nomes aquele host aceita servir.
5. Só então mexer no registro — e conferir o **conteúdo** antes de apagar qualquer coisa.

---

## Herdadas, ainda válidas

- ⛔ **`vercel --prod` não roda de pasta dentro do OneDrive** (`UNKNOWN: unknown error, read`).
  Clonar em `C:\dev\<repo>` e deployar de lá.
- 🚨 **NUNCA `yes | vercel project rm`** — o comando é interativo, não tem `--yes`, e o `yes` apaga
  **projetos vizinhos** (levou `eg`, `eg-site` e `roi-zenith`).
- 🚫 **"Fora do ar" pode estar rodando em outra plataforma.** `vercel project ls` responde "não existe
  **na Vercel**". Em 29/07 o `sofia-ia` foi deployado por engano lá, criando um segundo ambiente de
  produção **contra o banco real**.
- **`vercel project ls` pagina em 20** — projeto "sumido" pode estar na página 2.
- **A URL de produção nem sempre é `<projeto>.vercel.app`** (`seo-forecaster` saiu como
  `seo-forecaster-pi`). Ler do `project ls` e confirmar com `curl` antes de gravar a `homepage`.
- **`gh repo edit --homepage` não funciona no PowerShell** — usar
  `echo '{"homepage":"..."}' | gh api repos/JeanZorzetti/<repo> -X PATCH --input -` pelo Bash tool.
- **A chave de um projeto no hub é a URL, não o repo** — trocar domínio sem trocar a `homepage` cria
  um projeto duplicado no ranking em vez de mover o existente.
- ⚠️ **Janela de não-push: 00:00–01:00 BRT** (o cron do autopublishing roda 00:13).
