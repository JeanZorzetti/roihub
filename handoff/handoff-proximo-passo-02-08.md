# Handoff — próximo passo (30/07/2026)

**O item de painel acabou.** O NXDOMAIN dos 14 subdomínios do `roilabs.com.br` — a maior frente de
ops que o hub já teve — está **aplicado e verificado**. Não sobrou nada para o Jean clicar no
Cloudflare.

O que sobrou é **uma data**: **domingo 02/08, 10:00 BRT.**

> **Atualizado ainda em 30/07:** os três cards podres da agenda foram **medidos e reescritos** — ver
> [a seção 2](#2--os-três-cards-podres-foram-medidos-e-reescritos-3007). O saldo: o gate branded do
> Sirius **passou** (pos 1,0 no BR; a média global era ruído de Bangladesh), o `repo` do `tapepro`
> apontava para o **monorepo errado**, e o CannibalScan foi **destravado de ponta a ponta** — o
> problema não era Request Indexing nem sitemap, era **não ter domínio próprio**. O `alibi_ai` foi
> apagado: **40 repos ativos, 39 projetos**. **O próximo passo segue sendo a data.**

> ➡️ **A frente de trabalho seguinte já tem handoff próprio:**
> [`handoff-proximo-passo-dominios.md`](handoff-proximo-passo-dominios.md) — **todo projeto com
> domínio próprio**. Nasceu da lição do CannibalScan: 21 dos 38 sites estão em `*.vercel.app` /
> `*.easypanel.host` e, por isso, **fora de qualquer propriedade do Search Console**. Este arquivo
> aqui continua sendo a **data**; aquele é o que fazer quando houver sessão.

Substitui [`handoff-proximo-passo-30-07.md`](handoff-proximo-passo-30-07.md) (29/07).
Índice: [`../handoff.md`](../handoff.md).

---

## 🎯 O próximo passo é o primeiro run do robô de crawl stats

`Get-ScheduledTaskInfo 'roihub crawl stats'`, medido em 30/07:

```
LastRunTime    : 30/11/1999 00:00:00     ← nunca rodou
LastTaskResult : 267011                  ← 0x41303 = SCHED_S_TASK_HAS_NOT_RUN
NextRunTime    : 02/08/2026 10:00:00
State          : Ready
```

O robô foi agendado em 28/07 (terça) com gatilho semanal no **domingo** (`DaysOfWeek: 1`,
`StartWhenAvailable: True`), então o primeiro disparo é **02/08**. Ele é, ao mesmo tempo:

1. **O único instrumento de medição do NXDOMAIN.** Existe **um** export do `roilabs.com.br` no repo
   (`docs/Crawl-stats/roilabs.com.br/roilabs.com.br-Crawl-stats-2026-07-25/`), e ele é o **baseline
   de antes do conserto**. Sem export novo não há como saber se funcionou.
2. **Código que nunca executou de ponta a ponta.** Ele abre o Chrome, baixa 10 exports do GSC,
   descompacta, encadeia `ml/analyze.py` + `ml/narrate.py` e faz `git commit && git push` sozinho.
   Cada uma dessas etapas foi testada à mão; **a corrente inteira, sem ninguém olhando, não.**

### O que fazer no domingo

Nada antes das 10:00. Depois:

```bash
cd "C:\Users\jeanz\OneDrive\Desktop\ROI Labs\roihub"
git pull                                       # o robô commita e pusha sozinho
ls docs/Crawl-stats/roilabs.com.br/            # tem que existir uma pasta nova, datada 02/08
```

Se a pasta nova apareceu, **a medição do NXDOMAIN é uma comparação de duas colunas**:

```
docs/Crawl-stats/roilabs.com.br/roilabs.com.br-Crawl-stats-2026-07-25/Hosts table.csv   (antes)
docs/Crawl-stats/roilabs.com.br/roilabs.com.br-Crawl-stats-2026-08-02/Hosts table.csv   (depois)
```

🚨 **O sinal certo é `Crawl requests` dos hosts mortos CAINDO.** Não é o OK%.

A janela do Crawl Stats é de **90 dias** ([[gsc_crawl_stats_stale_90d_window]]): os dias ruins de
antes do conserto continuam dentro da média até ~outubro, então **o OK% pode piorar com tudo certo**.
Já custou uma investigação inteira nesta mesma propriedade — o "40,6% OK" do roilabs era problema já
corrigido, zero bug vivo. **Uma semana também é pouco:** 5 dias contra uma janela de 90 movem quase
nada. O que dá para ver em 02/08 é *direção*, não *número*. Prazo real da curva: 33,6% → ~90% em ~90
dias.

### Se o robô falhar

Ele roda em janela visível, na máquina do Jean, com sessão Google real. Os modos de falha conhecidos,
em ordem de probabilidade:

| sintoma | causa | conserto |
|---|---|---|
| `Chrome não abriu porta de debug` | já existe janela aberta **no perfil `%LOCALAPPDATA%\roihub-gsc-profile`** — o Chrome delega para a instância existente e o processo novo morre sem escrever o `DevToolsActivePort` | fechar aquela janela e rodar de novo à mão |
| pede login do Google | a sessão do perfil expirou | `node scripts/fetch-crawl-stats.mjs --login`, logar, fechar a janela. ⚠️ **logar num Chrome automatizado não funciona** ([[google_login_blocks_automated_browser]]) — é por isso que existe o modo `--login` com perfil próprio |
| `nenhum export válido — nada commitado` | o GSC mudou a UI ou a propriedade sumiu | rodar com filtro por substring: `node scripts/fetch-crawl-stats.mjs roilabs` |
| exports OK mas sem narrativa no `/insights` | `ml/narrate.py` bateu rate limit | **não é robô quebrado** — de propósito não entra no exit code. Rodar `narrate.py` à mão depois |

Rodar à mão é o mesmo comando do agendador:

```bash
node scripts/fetch-crawl-stats.mjs            # todas as propriedades
node scripts/fetch-crawl-stats.mjs roilabs    # só uma, por substring
```

---

## ✅ O que fechou e não se reabre

### O NXDOMAIN está aplicado — 6 hosts promovidos, produção intacta

`node scripts/cloudflare-redirects.mjs --verify` (sem token, só mede) em **30/07**:

| host | estado hoje |
|---|---|
| `pathfinder` · `orion` · `vertice` · `atma` | **200**, `A 76.76.21.21` DNS only (Vercel) |
| `atmaadmin` | **307 → `/admin`**, Vercel (projeto `admin`) — 307 é a rota, não erro |
| `atmaapi` | **200**, `A 2.24.207.200` (EasyPanel, app `atma` do projeto `doc_crm`) |
| `sirius` · `sofiaia` | **301** para `siriuscrm.com.br` / `polarisia.com.br`, preservando path |
| `clerk.atma` · `jbadvocacia` · `andorinha` · `alibi` | **301** para o apex |
| `www.sirius` · `www.goiania` | ⚠️ **falha de TLS** — Universal SSL cobre 1 label; só redirecionam em `http://`. Curar exige ACM pago (~US$10/mês), **não vale por faxina de índice** |
| `goiania` · `tapepro` | **200**, intactos — este é o teste de segurança e ele passou |

Curar `www.sirius` é a única coisa "aberta" aqui, e a decisão já foi **não fazer**. Os 698 req dele
não somem inteiros; é o preço aceito.

### ⛔ `alibi_ai` saiu (Jean, 30/07) — e isso **não** exige rodar nada

O `alibi` era o último host em `RESSUSCITAR` no `scripts/cloudflare-redirects.mjs`, esperando o dia
em que o site subisse. Com o repo fora, ele passa a **morto permanente**: movido para `MORTOS` no
mesmo commit deste handoff.

**A mudança é semântica, não operacional.** A Regra 4 do Cloudflare é montada com
`[...MORTOS, ...RESSUSCITAR]` — a expressão publicada é **byte-a-byte a mesma**, e o host já responde
301 para o apex. **Não rode o script por causa disso** (rodar não faz mal, só não faz nada).

> ⚠️ Medido em 30/07, minutos antes deste commit: `gh api repos/JeanZorzetti/alibi_ai` **ainda
> respondia** — repo público, não arquivado, `homepage: https://alibi-ai.vercel.app`. Se ele voltar a
> aparecer no ranking do hub, a exclusão não saiu; a lista vem do GitHub ao vivo, e o hub se corrige
> sozinho quando o repo for embora. **41 repos ativos → 40** quando isso acontecer.
>
> ✅ **FECHADO em 30/07: o Jean apagou o repo.** `gh api repos/JeanZorzetti/alibi_ai` devolve **404**.
> O hub se corrige sozinho no próximo carregamento — **40 repos ativos, 39 projetos no ranking**.
> Nada a fazer no código.

### Atma voltou inteiro — e agora tem handoff próprio

Os três hosts que faltavam subiram em 30/07 (`atma`, `atmaadmin`, `atmaapi`). O backend está
saudável, as migrations aplicadas, e a 7ª sessão de lá **deletou a feature `/admin/automacoes`**
(46 arquivos, 16.320 linhas que nunca rodaram em produção).

**Nada disso é trabalho do roihub.** O estado e a próxima entrega do Atma vivem em
`C:\dev\atma\handoff.md` — próximo alvo lá é decidir `crm_leads.próximo_followup`.
⚠️ **O clone de trabalho é `C:/dev/atma`**, não a cópia em `Atma/Site` (OneDrive), que está atrasada.

### 41 repos ativos, **2** sem `homepage` — e os 2 são decisão

Medido em 30/07 com `--no-archived`: só `roihub` (admin-only, nunca terá site público) e
`repo-de-teste`. **A frente "repos sem site" está encerrada** — o `<details>` da home fica vazio e
some sozinho, sem tocar no código.

---

## O que sobra, em ordem — nada é código do roihub

### 1. 🟠 Compass — Etapas 2 e 3, painel de terceiro

O app está **no ar** em `compass.polarisia.com.br` mas **não é usável nem cobrável**. Detalhe em
[`C:\dev\compass\handoff.md`](https://github.com/JeanZorzetti/compass/blob/main/handoff.md):

- **Etapa 2 · login** — `AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET` (callback
  `https://compass.polarisia.com.br/api/auth/callback/github`) e `AUTH_RESEND_KEY`. `/login` responde
  200, mas **sem provider ninguém entra**.
- **Etapa 3 · cobrança** — `STRIPE_SECRET_KEY`, os dois `price_…` e o `STRIPE_WEBHOOK_SECRET`. Criar
  o webhook **já no domínio final** — webhook morto = cliente paga e não vira assinante.

🔴 **Dívida com prazo:** o Postgres é o do VPS EasyPanel (`2.24.207.200:5451`) e o servidor **não
suporta TLS** ([[vps_postgres_no_tls_sslrequest_probe]]) — senha e dados em texto puro até a Vercel.
Resolver **antes do primeiro pagante**, não antes do primeiro login.

### 2. ✅ Os três cards podres foram medidos e reescritos (30/07)

Feito no mesmo dia, contra a API do GSC — nenhum texto novo é palpite. O que a medição achou:

**`sirius` — o gate 28/07 passou, e a métrica agregada mentia.** "sirius crm" agregado dá pos 5,2 com
CTR de 1,7% (5 cliques / 295 imp), o que parecia piora. Quebrando por país: **264 das 295 impressões
são de Bangladesh** (0 clique). **No Brasil o Sirius está em posição 1,0**, 4 cliques em 6 impressões.
Entity SEO está resolvido; a home já serve Organization + SoftwareApplication + WebSite com `sameAs`
canônico — **não refazer schema**. 🚨 **Nunca medir branded sem quebrar por país** — a média global
quase gerou a 5ª tarefa improcedente. Card novo aponta o gargalo real (não-branded: 716 imp, 7
cliques): `agaas`, 81 imp em **pos 8,1 com zero clique**, é o clique mais barato do site.

**`nimblabs` — as duas pontas do card já estavam fechadas, e apareceu uma terceira que não estava.**
Indexação do CK: `verdict=PASS`, "Submitted and indexed", crawl 11/07 — fechado. Backlink npm: o
README publicado **já linka** `context.nimblabs.com` (sobra só `homepage`/`repository` ausentes no
`package.json` do 1.2.0 → patch 1.2.1). ✅ **O achado novo virou entrega no mesmo dia.** A primeira leitura foi "o
sitemap do CannibalScan nunca foi submetido"; a causa era **anterior**: `cannibalscan.nimblabs.com`
não existia, o site vivia em `cannibalscan.vercel.app` e por isso ficava **fora** da propriedade
`sc-domain:nimblabs.com` — não havia onde submeter sitemap nenhum. O "domínio próprio" que a seção 3
marcava como opcional e sem prazo era, na verdade, **pré-requisito da indexação**. Executado em 30/07,
na ordem obrigatória:

1. **Jean criou o subdomínio** — `cannibalscan.nimblabs.com` responde 200.
2. **O site ainda se declarava `.vercel.app`** em 12 lugares (canonical, `og:url`, os 4 `@id` do
   `@graph`, o `<loc>` do sitemap, a linha `Sitemap:` do robots). Trocados no repo `cannibal_scan`
   (`bb13bd4`). Submeter antes disso teria entregado ao Google um sitemap apontando para fora da
   propriedade.
3. 🚨 **O projeto da Vercel NÃO está ligado ao git** — o último deploy era por CLI, do dia anterior,
   e o push não publicou nada. Foi preciso `vercel link --project cannibalscan` + `vercel --prod` de
   dentro de `site/`. **Quem mexer nesse repo de novo precisa saber disso**: commitar ≠ publicar.
4. **`homepage` do repo trocada no mesmo ato** — o hub segue com **39 projetos** e uma única entrada
   `cannibal_scan`, sem duplicata ([[roihub_github_sourced_projects]]).
5. **Sitemap submetido pela API** (`PUT .../sitemaps/{feed}`): a service account é `siteFullUser`, então
   basta trocar o escopo `webmasters.readonly` por `webmasters` — **não precisa da UI**. Propriedade
   agora com 5 sitemaps, o do CannibalScan `submitted=2026-07-30`, 0 erro, `downloaded` ainda vazio.

⏭️ Ler de novo em **~06/08**: saiu de `URL is unknown to Google`? E não confundir com vitória — o
sitemap tem **uma URL só** (a landing). Indexar a home é o começo, não o fim.

**`tapepro` — o card não estava só vazio, estava apontando pro repo errado.** `"repo": "roilabs"`
estava errado desde a criação: o site é `github.com/JeanZorzetti/tape`. Corrigido no
`data/projects.json` e nos dois lugares que repetiam a lenda do monorepo (`lib/projects.mjs`,
`app/page.tsx`). O resto é idade: a propriedade GSC **nasceu 21/07** (`gscInicio` agora registrado),
tem **8 dias** e 21 impressões, e o `analyze.py` devolve `insufficient-data` nas três janelas. Não há
trabalho de SEO — o autopublishing já publica 1/dia. Gate datado: **19/10** (D+90), ≥ 300 imp/28d.

⚠️ Descartado com medição, para ninguém reabrir: o blog do tapepro aparece no GSC com e **sem** barra
final, mas os dois formatos devolvem **200 e o mesmo canonical** — é consolidação atrasada do Google,
**não** o bug de trailing slash do goiania ([[astro_nginx_trailing_slash_301]]).

### 3. 🟢 Domínio próprio dos sites novos — opcional, sem prazo

`links.roilabs.com.br` (Cloudflare) e `cannibalscan.nimblabs.com` (Hostinger), **com a `homepage` do
repo mudando junto** — a chave de um projeto no hub é a URL, não o repo: trocar domínio sem trocar a
`homepage` **duplica** o projeto no ranking em vez de mover o existente.

✅ **O CannibalScan saiu daqui em 30/07** — domínio criado, site repontado, `homepage` trocada e
sitemap submetido; detalhe na [seção 2](#2--os-três-cards-podres-foram-medidos-e-reescritos-3007).
Ele nunca foi opcional: sem subdomínio próprio o projeto ficava fora da propriedade do GSC.
**O `links.roilabs.com.br` segue opcional e sem prazo.**

---

## Se esta sessão for de código, o alvo não é o roihub

Quatro sessões seguidas confirmaram: **não há frente de código aberta aqui.** O ML fechou (F0–F4), o
autopublishing está 10/10, o robô de crawl está agendado, e o hub lê a lista de projetos do GitHub
sozinho.

O backlog de código está **nos projetos que o hub rankeia** — a coluna "Próxima ação" da home e a
`/agenda` dizem qual, na ordem do score. Hoje os dois maiores são
**`polarisia`** (spec 012, home V4 "sites de produção", T001–T017) e **`estetiacrm`** (~222
`console.*` de runtime → logger JSON; ⚠️ **não é pino** — `output: standalone` não traça
`worker_threads` e quebra só em prod; ⚠️ **não é o repo roilabs** — esse card já foi executado no
repo errado uma vez).

---

## Armadilhas ainda válidas

- ⚠️ **Janela de não-push: 00:00–01:00 BRT** — o cron do autopublishing roda 00:13.
- 🚨 **Não olhe o OK% do Crawl Stats para validar conserto** — janela de 90 dias, o número piora com
  tudo certo. Datar as falhas antes de caçar bug.
- ⛔ **`vercel --prod` não roda de pasta dentro do OneDrive** (`UNKNOWN: unknown error, read`).
  Clonar em `C:\dev\<repo>` e deployar de lá — vale para o roihub também.
- 🚨 **NUNCA `yes | vercel project rm`** — não existe `--yes`, e o `yes` apaga **projetos vizinhos**.
- 🚫 **"Fora do ar" pode estar rodando em outra plataforma.** `vercel project ls` só responde "não
  existe **na Vercel**", e pagina em 20.
- ⚠️ **`gh repo list --json homepage` não existe** — o campo é `homepageUrl`, e o nome errado faz o
  comando sair com erro e o `| python` seguinte estourar num JSONDecodeError enganoso.
- ⚠️ **`gh repo edit --homepage` quebra no PowerShell** — usar
  `echo '{"homepage":"..."}' | gh api repos/JeanZorzetti/<repo> -X PATCH --input -` pelo Bash tool.
- ⚠️ **Proxied (nuvem laranja) é obrigatório para Redirect Rule** e **proibido para host promovido**
  (impede a Vercel de emitir o cert). Promover é mover uma linha para `PROMOVIDOS` e rodar — o
  script faz DNS e regra **no mesmo ato, na ordem certa**. Inverter dá "deploy quebrado" que não é
  deploy quebrado.
- ⚠️ **`node --test <dir>` não resolve no Node 22** — listar os arquivos explicitamente.
- ⚠️ **O Python deste ambiente é o do Windows**: não enxerga paths `/c/...` do Bash tool, e o stdout
  é cp1252 (imprimir `→` estoura `UnicodeEncodeError`). Usar `PYTHONIOENCODING=utf-8`.

---

## Contexto herdado

- Receita e execução do NXDOMAIN: [`handoff-nxdomain-subdominios.md`](handoff-nxdomain-subdominios.md)
- Como o robô de crawl funciona: [`handoff-crawl-stats-semanal.md`](handoff-crawl-stats-semanal.md)
- Motor de ML (F0–F4): [`handoff-ml.md`](handoff-ml.md)
- Projetos vêm do GitHub, não de lista fixa: [`handoff-hub-github.md`](handoff-hub-github.md)
- Estado anterior: [`handoff-proximo-passo-30-07.md`](handoff-proximo-passo-30-07.md)
