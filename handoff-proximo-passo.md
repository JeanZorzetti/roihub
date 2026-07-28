# Handoff — próximo passo do ROI Hub (comece por aqui)

Atualizado em **2026-07-28, noite**. Das 4 frentes do handoff anterior, **3 fecharam nesta sessão**
(A2, A3 e F3). Sobrou **A1** — que é ops de infra, não código — e **F4**, que é enfeite.

O hub em produção lista todos os projetos vivos do GitHub, não os 10 curados.
Como isso funciona por dentro: `handoff-hub-github.md`. Histórico geral: `handoff.md`.

**Resumo em uma linha:** o hub agora responde sozinho "esse bet cruza o gate?"; o que falta é
**3 sites fora do ar** (ops) e nada urgente de código.

---

## ✅ Fechado em 28/07 (não reabrir)

- **A2 — robô de crawl stats agendado.** Task Scheduler, domingo 10:00 BRT, "run if missed"
  marcado, primeiro disparo **02/08**. Não deu pra usar `schtasks`: o CLI não expõe
  `StartWhenAvailable`. Comando exato e porquês em `handoff-crawl-stats-semanal.md` §4.
  Consequência: o `/infra` para de congelar e a comparação semana-a-semana passa a existir.
- **A3 — `Atma` arquivado** (`gh repo archive JeanZorzetti/Atma`). Repo arquivado é ignorado pelo
  hub e o histórico continua lá — **é a forma canônica de aposentar um projeto daqui pra frente**.
- **B1/F3 — forecast + kill-gates.** `ml/forecast.py` + render no `/insights`. Detalhes de
  modelagem e o que não reabrir: `handoff-ml.md` (bloco "STATUS 28/07").

### O que os gates disseram no primeiro run real

| bet | gate D+90 | veredito |
|---|---|---|
| **Aftercare** | 30/08 | ✔ **PASSOU** — 540 imp/semana contra o gate de 100. **Um mês antes da data** |
| **ReviewShield** | 02/09 | ✖ **NÃO cruza** — projeção ~84 imp/sem (35–200). Confirma o "em risco" de 11/07 |
| **Context Keeper** | 10/09 | ◷ série curta demais pra projetar, mas **49 imp na última semana** (era 0 em 11/07 — o Request Indexing pegou) |

**Isso muda uma decisão de negócio, não só a tela:** o card do aftercare em `data/projects.json`
manda "checar GSC dos 20 artigos e decidir no gate D+90 (~29/08)" — a leitura já está feita e o
veredito é passar. Pela tese (regra 4), bet que passa no D+90 **recebe dobrada no que rankeia**, não
espera 30/08 parado. O ReviewShield é o oposto: as ações do card (on-page do `/checker` + links
internos do blog) são a última chance antes de 02/09, e agora dá pra medir o efeito toda semana em
vez de na véspera.

---

## 🔴 A1 — Três sites de produção continuam FORA DO AR (ops, não código)

Único item que sobrou do handoff anterior, intocado — é acesso a host/DNS, não commit.
Confirmado por fora, do host Windows, com `Resolve-DnsName` + `Invoke-WebRequest`:

| site | DNS resolve para | resposta |
|---|---|---|
| `prolifemed.com.br` | 187.127.2.204 | **timeout** (20 s, sem resposta) |
| `seven-md.com.br` | 187.127.2.204 | **timeout** (20 s, sem resposta) |
| `compass.polarisia.com.br` | 2.24.207.200 (VPS EasyPanel) | **404** — vhost não roteado |

Os dois primeiros apontam para o **mesmo IP**, que **não é** o VPS do EasyPanel: provavelmente é
**um host caído derrubando dois sites**, não dois problemas independentes. Comece por aí.
O `compass` é outra coisa: o DNS chega no VPS certo, mas o EasyPanel não tem o domínio configurado
pra esse subdomínio. Config de proxy, não de código.

Os três aparecem `✕ FORA DO AR` no ranking, como deviam.

---

## 🟢 Frentes de código abertas (nenhuma urgente)

- **F4 — narrativa via `claude-cli`** (`handoff-ml.md`): 2–3 frases em pt-BR por projeto em cima do
  `insights.json`. Sempre foi "enfeite em cima do F3", e agora que a frase do gate já sai pronta do
  Python, é menos necessário ainda. Orçamento: `claude-cli` apenas, **nunca API paga**.
- **Threshold do D+180.** É o único número inventado do sistema (10 cliques/sem, em `GATE_SPECS`).
  A tese não fixa valor. Quando o primeiro D+180 chegar perto (28/11), calibrar — é uma constante.
- **A home ficou cara.** 38 projetos × (1 health check + 2 queries GSC). Em dev deu 2,2–3,0 s;
  ninguém mediu em prod. **Não otimize preventivamente** — meça. Se doer, cachear o health check
  por alguns minutos é o caminho barato, não reescrever nada.

---

## 🚫 Não reabrir (decidido, com motivo)

- **A régua do ranking.** 28/07, decisão do Jean: **todos os repos com `homepage` entram**, sem
  filtro por atividade. Não implemente cutoff de 12 meses.
- **`homepage` do `roihub`.** Vazia de propósito: o hub está atrás de Basic Auth e `lib/health.ts`
  usa `res.ok`, então um 401 faria o hub se reportar como "FORA DO AR" pra sempre.
- **`acao` do `tapepro` vazia.** De propósito: não há tarefa de dev real hoje, e card inventado
  apodrece (ver Armadilhas).
- **As ~24 `homepage` restantes em `*.vercel.app`.** Para protótipo que só existe no preview, a URL
  da Vercel **é** a URL real. Só corrigir quando o projeto ganhar domínio próprio.
- **Banda larga do forecast em bet novo.** Não é bug — `handoff-ml.md` explica.

---

## Como validar qualquer coisa acima

```bash
npm test                 # 128/128
npx tsc --noEmit         # limpo
npm run build            # 5 rotas ƒ (dynamic)

C:\venvs\roihub-ml\Scripts\python -m pytest ml/test_ml.py -q   # 18/18 (7 são do forecast)
C:\venvs\roihub-ml\Scripts\python ml/analyze.py                # regenera data/insights.json

# hub real, com dados de verdade (o token vem do gh, não precisa mexer no .env):
GITHUB_TOKEN="$(gh auth token)" HUB_USER=roi HUB_PASS=devcheck npx next dev -p 3199
curl -s -u roi:devcheck http://localhost:3199/ | grep -o 'GitHub: [^<]*'
```

Inspecionar as `homepage` sem abrir o browser:

```bash
gh repo list JeanZorzetti --limit 100 --json name,homepageUrl,isArchived,pushedAt
```

⚠️ `gh repo edit --homepage ""` **não funciona no PowerShell** (a string vazia é engolida e o
flag reclama de argumento faltando). Use a API:

```bash
echo '{"homepage":""}' | gh api repos/JeanZorzetti/<repo> -X PATCH --input -
```

---

## Armadilhas conhecidas (já custaram tempo)

- **Card da agenda ≠ verdade.** As `acao`/`acaoDesc` do `projects.json` são texto à mão e
  apodrecem. Ler o `Repo:` do card e **validar a premissa antes de executar** — em 13/07, 3 de
  10 estavam podres e um mandou trabalhar no repositório errado. (O card do aftercare acabou de
  virar um desses: o gate que ele manda checar já foi checado pelo próprio hub.)
- **`homepage` errada falha em silêncio.** O hub health-checka e consulta o GSC contra a URL de
  preview sem reclamar; o sintoma é "esse projeto não tem dados de SEO".
- **Site atrás de Basic Auth se reporta como fora do ar.** `lib/health.ts` usa `res.ok`, 401 conta
  como caído. Vale pro roihub e pra qualquer coisa protegida.
- **A chave de um projeto é a URL do site, nunca o nome do repo.** Um repo serve N sites (o
  monorepo `roilabs` serve roilabs.com.br, goiania e tapepro). Releia `handoff-hub-github.md`.
- **Crawl Stats do GSC é média de 90 dias.** Problema já corrigido fica vermelho por ~3 meses.
  **Datar as falhas antes de caçar bug** — foi o caso do "40,6% OK" do roilabs: zero bug vivo.
- **SplitJud fica de fora do hub** por decisão do Jean (10/07) — projeto dividido com o Aldo.
  O repo `splitjud` aparece na lista "sem site"; **não** preencha a homepage dele.
- ⚠️ **Janela de não-push: 00:00–01:00 BRT** (o cron do autopublishing roda 00:13).
