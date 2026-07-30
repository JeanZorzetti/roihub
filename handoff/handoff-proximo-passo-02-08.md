# Handoff — próximo passo (30/07/2026)

**O item de painel acabou.** O NXDOMAIN dos 14 subdomínios do `roilabs.com.br` — a maior frente de
ops que o hub já teve — está **aplicado e verificado**. Não sobrou nada para o Jean clicar no
Cloudflare.

O que sobrou é **uma data**: **domingo 02/08, 10:00 BRT.**

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

### 2. 🟡 Dois cards da agenda venceram — e card vencido manda executar o que já morreu

Este é o padrão que já custou 4 tarefas improcedentes ([[roihub_agenda_task_premises_unverified]]).
Conferido em `data/projects.json` hoje, 30/07:

| projeto | card | por que está podre |
|---|---|---|
| `sirius` | "**Gate 28/07**: medir posição branded 'sirius crm' no GSC" | a data **passou há 2 dias**. Ou a medição saiu e o card devia ter sido reescrito, ou não saiu e o card devia ter data nova |
| `nimblabs` | "Backlink npm → context.nimblabs.com e conferir indexação do CK (**~20/07**)" | 10 dias vencido |
| `tapepro` | `acao` **vazia** | é a 1ª cadeira do Growth Partner e não tem próxima ação nenhuma |

**Medir antes de reescrever.** Os dois primeiros são leitura de GSC — 10 minutos, e o resultado
decide o texto novo. Fechar isso **é** atualizar o card e pushar; deixar o card velho no ar é o que
gera a próxima tarefa improcedente.

### 3. 🟢 Domínio próprio dos sites novos — opcional, sem prazo

`links.roilabs.com.br` (Cloudflare) e `cannibalscan.nimblabs.com` (Hostinger), **com a `homepage` do
repo mudando junto** — a chave de um projeto no hub é a URL, não o repo: trocar domínio sem trocar a
`homepage` **duplica** o projeto no ranking em vez de mover o existente. Mais submeter o CannibalScan
ao GSC (segue **não indexado**).

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
