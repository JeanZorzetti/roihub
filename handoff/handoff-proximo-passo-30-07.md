# Handoff — próximo passo (para a sessão de 30/07)

Escrito 29/07 e **remedido na 2ª sessão de 29/07**, que não executou nada em painel — só mediu.
Substitui [`handoff-proximo-passo.md`](handoff-proximo-passo.md) (28/07).
Medição detalhada anterior: [`handoff-dns-e-paineis.md`](handoff-dns-e-paineis.md).
Índice: [`../handoff.md`](../handoff.md).

---

## Leia isto antes de abrir qualquer arquivo

**Não abra o repo. Não há frente de código no roihub.**

Sobraram **três itens**, e os três se resolvem em **painel e DNS**. Uma sessão de código não move
nenhum — já são quatro sessões seguidas confirmando isso. Se você começou esta sessão procurando o
que programar, a resposta é: **nada aqui.** O trabalho é do Jean, num navegador.

Se a sessão for de código de verdade, o alvo não é o roihub — é o backlog dos projetos que ele
rankeia (`/agenda` e a coluna "Próxima ação" da home dizem qual).

**O que a 2ª sessão de 29/07 entregou:** o passo bloqueante do item 1 caiu. O item 1 deixou de ser
uma investigação e virou uma tarefa de painel com endereço certo. Itens 2 e 3 foram remedidos e estão
idênticos, com dois falsos-positivos descartados.

---

## A ordem: 1 → 2 → 3

### 🔴 1 · SplitJud — único site de produção fora do ar que ainda é do hub

É o item de maior impacto **e o único que ainda perde tráfego a cada dia**.

Estado do DNS, reconfirmado na 2ª sessão de 29/07:

| nome | A records | o que acontece |
|---|---|---|
| `splitjud.com.br` | só `187.127.2.204` | **fora do ar** (host morto, 0 portas) |
| `app.splitjud.com.br` | só `187.127.2.204` | **fora do ar** |
| `www.splitjud.com.br` | `187.127.2.204` **+** `185.158.133.1` | metade timeout, metade **site de 2 anos atrás** |

**O `www` é o pior dos três, e não é indisponibilidade — é dano ativo.** O IP que responde 200
(`185.158.133.1`, rDNS `lovable-app-cd-1-4.p.l5e.io`) é o zumbi Vite/Lovable pré-split, e ele está
servindo conteúdo velho com sitemap 404 **para o Googlebot**. Confirmado por fingerprint: shell de
1918 bytes, bundle `/assets/index-BYI09l9g.js`, zero `/_astro/`.

#### ✅ Onde o Astro roda: EasyPanel, e o servidor está VIVO

Isto era o passo bloqueante e **já está respondido — não repita esta investigação.**

O handoff anterior leu o 404 do `2.24.207.200` como "não é o EasyPanel". Estava invertido: **404 é o
nginx do EasyPanel respondendo que perdeu o vhost.** Host errado dá timeout, não 404. O que foi
medido:

- `2.24.207.200` = `srv1594350.hstgr.cloud` (VPS Hostinger) → **200 no IP raw**, servidor de pé.
- Ele **ainda serve** `siriuscrm.com.br` e `estetiacrm.com.br` (200) → o painel está operando.
- Nos Hosts do SplitJud: **404 no 443** e **301→https no 80**. nginx vivo, vhost ausente.
  **Sumiu a configuração de domínio, não o servidor.**
- O repo confirma que o deploy é ali: dois serviços EasyPanel (`site` e `app`), Dockerfiles
  `apps/site/Dockerfile` e `apps/app/Dockerfile`, **build context = raiz do monorepo**
  ([`splitjud/handoff.md:103`](../../splitjud/handoff.md),
  [`splitjud/docs/GEO-HANDOFF.md:42`](../../splitjud/docs/GEO-HANDOFF.md)).
- **Não está na Vercel:** 27 projetos nas duas páginas do `project ls`, nenhum `splitjud`.
- `187.127.2.204` é bloco **LACNIC/BR, sem rDNS e sem portas abertas** — IP legado que não é destino
  de nada. Os três nomes apontam para um endereço morto.

#### Passos, nesta ordem — a ordem importa

1. **No EasyPanel, reanexar os domínios** aos serviços: `splitjud.com.br` + `www.splitjud.com.br` →
   serviço `site`; `app.splitjud.com.br` → serviço `app`. Emitir o certificado.
   **Se os serviços tiverem sido removidos**, recriar com os dois Dockerfiles acima, ambos com
   **build context na raiz** (eles copiam `packages/` e `server/`; context no subdiretório quebra).
2. **No Registro.br, apontar os três nomes para `2.24.207.200`** e **remover o A `187.127.2.204`
   dos três**. **A zona fica no Registro.br** (NS = `e.sec.dns.br` / `f.sec.dns.br`), **não no
   Cloudflare** — procurar essa zona no Cloudflare queima a sessão.
3. **Só então** deletar o A `185.158.133.1` do `www` e desligar aquele servidor.

⛔ **Não faça o passo 3 primeiro como "conserto rápido".** Sem os passos 1 e 2, isso deixa o `www` com
zero IPs vivos e derruba os 50% que ainda respondiam. Piora.

Depois que os três responderem 200, aí sim preencher a `homepage` do repo `splitjud` (hoje vazia de
propósito — preencher antes só põe um card vermelho no ranking).

### 🟠 2 · Compass — 1 registro de DNS + 9 segredos

O deploy **já está verde**: `compass-ten-plum.vercel.app` responde 200 em `/` e `/login`.

**a) Falta um A record.** `compass.polarisia.com.br` ainda resolve `2.24.207.200` (EasyPanel) e dá
404. O domínio **já está anexado ao projeto e com `verified: true`** — não falta verificação, falta
só o registro. Os NS são **Hostinger** (`aster/helios.dns-parking.com`), não Cloudflare:

```
A  compass  76.76.21.21
```

A `homepage` do repo já aponta para `https://compass.polarisia.com.br/`, então **o card fica verde
sozinho** quando propagar.

**b) `/pricing` devolve 500** até estes **9** entrarem na Vercel (o índice antigo dizia "8" — são 9):

`DATABASE_URL`, `AUTH_RESEND_KEY`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_LIFETIME`, `ANTHROPIC_API_KEY`.

Inventário exato medido em 29/07 (`GET /v9/projects/compass/env`): existem **4** vars, todas em
`production` — `ADMIN_EMAIL`, `APP_URL`, `AUTH_SECRET`, `CRON_SECRET`. **As 9 acima não existem em
target nenhum.**

⚠️ `AUTH_SECRET` e `CRON_SECRET` já foram setados **com valores novos** — é a rotação de
[[secrets_to_rotate]] acontecendo. **Não recolar os antigos.**

**O `DATABASE_URL` é a pergunta de verdade:** o serviço sumiu do EasyPanel. Descobrir se o Postgres
do Compass ainda existe é o primeiro passo; se não existir, é banco novo + `migrate deploy`.

### 🟡 3 · 12 repos sem `homepage` — mas só 2 dependem de painel

Recontado em 29/07 **com `--no-archived`**: **47 repos ativos, 12 sem `homepage`** (número idêntico
ao da 1ª sessão). Destes:

- **2 são decisão fechada, não pendência:** `roihub` (admin-only, fica vazio de propósito) e
  `repo-de-teste` (descartável).
- **1 é o item 1:** `splitjud`.
- **6 são boilerplate Lovable intocado** — README ainda com o literal `REPLACE_WITH_PROJECT_ID`, ou
  seja, nunca tiveram domínio: `perfil360`, `loginsplit`, `obeflow`, `agattasemijoias`,
  `financeiromedlly` (priv), `aesthetic-perfection-page` (priv). **Decisão do Jean: arquivar ou
  excluir.** É a mesma classe dos 9 que ele já deletou nas sessões anteriores.
- **2 só o painel resolve:** `cannibal_scan` e `aprovai`. Confirmado em 29/07 que **não dá para
  resolver esses dois por fora** — não insista por CLI:
  - `cannibal_scan` — o `sitemap.xml` do `nimblabs.com` tem **só** `/` e `/blog/*`, e
    `nimblabs.com/cannibalscan` dá 404. **Não existe página do CannibalScan no portfólio hoje**, então
    não há `homepage` para gravar (bate com o "NÃO INDEXADO" da revisão de 11/07). Publicar a página
    vem antes de preencher a URL.
  - `aprovai` — ⚠️ **`aprovai.vercel.app` responde 200 e NÃO é do Jean.** É um Next.js pt-BR, title
    "AprovAI - Sua Plataforma de Estudos Inteligente", mas a API da Vercel devolve 404 para o projeto
    `aprovai` no **único** scope da conta (`jean-zorzettis-projects`). **Gravar essa URL como
    `homepage` colocaria o site de um terceiro no ranking.**
- `roi-labs-links` é página de links em PHP, nunca deployada.

**Arquivar é melhor que limpar a `homepage`** para aposentar projeto: repo arquivado é ignorado pelo
hub e o histórico continua lá (decisão de 28/07).

---

## O que saiu da lista (não reabrir)

- ✅ **Item do hub no ranking — encerrado por decisão de produto.** "O roihub é 100% admin, não terá
  site público" (Jean). Logo ele não é um projeto ranqueado, a `homepage` do repo fica vazia de
  propósito, e **não se mexe na checagem de saúde para tratar 401/403 como "no ar"** — não há caso de
  uso. Reabrir só se entrar um projeto **público** atrás de auth.
- ✅ **ProLife saiu do hub.** Os repos `ProLife` e `mhedicos` foram deletados pelo Jean em 29/07. Sem
  repo não há projeto (a lista vem do GitHub), então **`prolifemed.com.br` não é mais pendência**.
- ✅ **"Achar onde o Astro do SplitJud roda" — respondido.** É o EasyPanel `2.24.207.200`. Ver item 1.

---

## Armadilhas desta sessão (as caras)

- 🚨 **404 não é "o host não é esse" — é "o host é esse e perdeu o vhost".** Foi o erro da 1ª sessão
  de 29/07: o EasyPanel devolveu 404, o handoff concluiu "não é o EasyPanel", e isso virou um passo
  bloqueante de caçada que custou uma sessão. Um 404 **prova que existe um nginx vivo ali**; host
  errado dá timeout ou connection refused. Confirmar com `curl -k https://<IP>/` direto no IP e com
  outro domínio conhecido do mesmo servidor **antes** de sair procurando plataforma.
- ⚠️ **`--resolve` sem `-k` devolve `000` e parece "host morto".** O mesmo `2.24.207.200` deu `000`
  em todos os Hosts e, com `-k`, **404** nos mesmos Hosts no minuto seguinte. Falha de certificado ≠
  fora do ar. Sempre `-k` ao sondar por IP.
- 🚨 **200 não prova que é o servidor certo.** No `www.splitjud.com.br` o IP que responde 200 é o
  zumbi e o que dá timeout é o do site bom. Com dois A records, **conferir o conteúdo** (title,
  bytes, `/_astro/` vs `/assets/index-*.js`, sitemap) antes de decidir qual apagar.
- 🚨 **…e isso vale para `.vercel.app` também.** `aprovai.vercel.app` responde 200 e é de outra
  conta. **Um domínio parecido com o nome do repo não prova propriedade** — conferir na API da
  Vercel (`GET /v9/projects/<nome>?teamId=…`) antes de gravar qualquer `homepage`.
- 🚨 **`gh repo list` sem `--no-archived` infla a contagem.** Uma medição intermediária reportou "14
  repos, achei o `Atma`" — o `Atma` está arquivado desde 28/07 e é ignorado pelo hub de propósito.
- ⚠️ **`gh repo list --json homepage` não existe** — o campo é **`homepageUrl`**. Com o nome errado o
  comando sai com erro e o `| python` a seguir estoura num JSONDecodeError enganoso.
- ⚠️ **`fetch`/`Invoke-WebRequest` não reconsulta A records como o `curl` faz.** O mesmo host deu
  10/10 no curl e timeout no PowerShell no mesmo minuto. **Um "fora do ar" no ranking pode ser
  round-robin com um IP morto.**
- ⚠️ **Menção no README não prova parentesco de projeto.** Um handoff anterior concluiu que `mhedicos`
  era o repo do ProLife porque citava `prolifemed.com.br`; era produto próprio que só consumia a API.
- ⚠️ **O Python deste ambiente é o do Windows: ele não enxerga paths `/c/...` do Bash tool.** Passar
  dados por **pipe** em vez de arquivo intermediário evita o `FileNotFoundError`.
- ⚠️ **Here-string `@'…'@` é PowerShell e vaza como texto no Bash tool** — sujou a mensagem de um
  commit com um `@` solto no subject. No Bash tool, usar heredoc (`-F - <<'EOF'`).
- ✅ **O atalho que funcionou:** `gh api repos/OWNER/REPO/readme` e procurar URL **declarada** separou
  os 6 Lovable dos que merecem investigação — sem abrir painel e sem chutar subdomínio (chutar foi o
  que gerou os NXDOMAIN falsos na primeira medição).

## Como medir DNS direito (reusar, não reinventar)

1. `Resolve-DnsName` para ver **todos** os A records — um nome pode ter dois e o cliente sorteia.
2. `curl -k --resolve host:443:IP` para perguntar a **cada IP** se ele serve aquele Host.
3. Ler o código: **404** = servidor certo, **vhost não existe** · **409** = Cloudflare-for-SaaS sem
   custom hostname · **timeout / connection refused** = host morto · **000 no curl** = quase sempre
   falta o `-k`. Os quatro parecem "fora do ar" no browser e têm consertos diferentes.
4. `curl -k https://<IP>/` direto no IP diz se **o servidor** está vivo, independente de vhost.
5. `openssl s_client -servername` mostra para quais nomes aquele host aceita servir.
6. Só então mexer no registro — e conferir o **conteúdo** antes de apagar qualquer coisa.

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
