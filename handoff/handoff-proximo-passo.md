# Handoff — próximo passo do ROI Hub (comece por aqui)

Atualizado em **2026-07-28, 2ª sessão da noite**. **O ML fechou (F0–F4)** e com ele acabou a
última frente de código do hub. O que sobrou não é implementação: é **um card podre pra reescrever**,
**duas verificações que só o Jean pode fazer** e **A1**, que é ops de DNS/vhost.

Índice de todos os handoffs e histórico do hub: [`../handoff.md`](../handoff.md).
Como a lista de projetos vem do GitHub: `handoff-hub-github.md`.

**Resumo em uma linha:** o hub projeta os kill-gates e explica em português o que está acontecendo
em cada projeto; falta ele **parar de mandar fazer à mão o que já faz sozinho** (card do aftercare)
e **3 sites voltarem ao ar**.

---

## ✅ Fechado em 28/07 (não reabrir)

- **A2 — robô de crawl stats agendado.** Task Scheduler ("roihub crawl stats", usuário `jeanz`,
  domingo 10:00 BRT, "run if missed" marcado, primeiro disparo **02/08**). `schtasks` não serve: o
  CLI não expõe `StartWhenAvailable`. Comando e porquês em `handoff-crawl-stats-semanal.md` §4.
- **A3 — `Atma` arquivado.** Repo arquivado é ignorado pelo hub e o histórico continua lá — **forma
  canônica de aposentar um projeto**, melhor que limpar a `homepage`.
- **F3 — forecast + kill-gates.** `ml/forecast.py` + render no `/insights`.
- **F4 — narrativa.** `ml/narrate.py`: 1 chamada de `claude-cli` por run, todos os projetos no mesmo
  prompt, `{"slug": "2–3 frases"}` de volta; 11/11 no primeiro run. Já encadeado no robô de crawl.
- **Handoffs organizados**: os temáticos vivem em `handoff/` (nome de arquivo preservado), índice
  no `../handoff.md`.

Decisões de modelagem e de prompt que **não devem ser reabertas**: `handoff-ml.md`, blocos
"STATUS 28/07".

### O que os gates disseram no primeiro run real

| bet | gate D+90 | veredito |
|---|---|---|
| **Aftercare** | 30/08 | ✔ **PASSOU** — 540 imp/semana contra o gate de 100. **Um mês antes da data** |
| **ReviewShield** | 02/09 | ✖ **NÃO cruza** — projeção ~84 imp/sem (35–200) |
| **Context Keeper** | 10/09 | ◷ série curta demais pra projetar, mas **49 imp na última semana** (era 0 em 11/07) |

---

## 🟡 O que fazer na próxima sessão de código (é curto)

### 1. Reescrever o card do `aftercare` — ele manda fazer à mão o que o hub já faz sozinho

`data/projects.json`, campo `acao` do slug `aftercare`, hoje:

> "Checar GSC dos 20 artigos e decidir no gate D+90 (~29/08)"

**Essa leitura já foi feita** — pelo próprio `/insights`, em 28/07, e o veredito é **passou**
(540 imp/sem contra 100). Pela tese do portfólio (regra 4), bet que passa no D+90 **recebe dobrada
no que rankeia**, não espera 30/08 parado. O card novo tem que ser a aposta dobrada (mais conteúdo
no cluster que já rankeia, medido semana a semana no `/insights`), com `Repo:` no começo, como manda
a convenção de 13/07.

> Esta é a segunda vez que uma automação nova apodrece um card. **Quem liga a automação atualiza o
> card no mesmo commit** — vale pra qualquer sessão futura.

Vale conferir na mesma passada se `reviewshield` continua honesto: o card dele (on-page do
`/checker` + links internos) **é** a última chance antes de 02/09 e segue válido — só não deixe
virar texto de enfeite: o efeito agora dá pra medir toda semana.

### 2. Verificações que sobraram (nenhuma é código)

- **`/insights` em prod** — as narrativas do F4 e o render do forecast nunca foram vistos fora do
  dev. Só o Jean consegue (basic auth, `HUB_PASS` só na EasyPanel). É abrir a aba e olhar.
- **O run automático de 02/08** é o primeiro com o `narrate.py` encadeado. O risco é só ambiente:
  a tarefa roda como `jeanz` (logon interativo, PATH do usuário) e o `claude.cmd` está em
  `%APPDATA%\npm` — deve resolver, **mas nunca rodou por lá**. Se o log do domingo trouxer
  `aviso: ml/narrate.py falhou`, é PATH ou sessão do CLI, não o script: o insights.json commitado
  fica correto, só sem prosa. Rodar `python ml/narrate.py` à mão fecha o buraco daquela semana.

---

## 🔴 A1 — Três sites de produção continuam FORA DO AR (ops, não código)

Intocado desde 28/07 (manhã) — é acesso a host/DNS, não commit.
Confirmado do host Windows com `Resolve-DnsName` + `Invoke-WebRequest`:

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

## 🟢 Ficam esperando (não puxe sem motivo)

- **Threshold do D+180.** Único número inventado do sistema (10 cliques/sem, em `GATE_SPECS`); a
  tese não fixa valor. Calibrar quando o primeiro D+180 chegar perto (28/11). É uma constante.
- **A home ficou cara.** 38 projetos × (1 health check + 2 queries GSC). Em dev deu 2,2–3,0 s;
  ninguém mediu em prod. **Não otimize preventivamente** — meça. Se doer, cachear o health check
  por alguns minutos é o caminho barato, não reescrever nada.
- **Changepoint em crawl stats** só passa a valer com 2–3 meses de exports emendados. O robô semanal
  começou agora; isso liga sozinho conforme o histórico cresce.

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
- **Uma chamada de `claude-cli` por run no narrate**, com todos os projetos no mesmo prompt. Dividir
  por projeto multiplica a chance de 429 sem melhorar nada.
- **Ordem `analyze.py` → `narrate.py`.** O analyze zera as narrativas de propósito: é isso que
  garante que nunca sobre texto velho descrevendo número novo.

---

## Como validar qualquer coisa acima

```bash
npm test                 # 128/128
npx tsc --noEmit         # limpo
npm run build            # 5 rotas ƒ (dynamic)

C:\venvs\roihub-ml\Scripts\python -m pytest ml/test_ml.py -q   # 24/24 (7 do forecast, 6 do narrate)
C:\venvs\roihub-ml\Scripts\python ml/analyze.py                # regenera data/insights.json
C:\venvs\roihub-ml\Scripts\python ml/narrate.py                # narrativa; --dry-run mostra o prompt sem chamar o CLI

# hub real, com dados de verdade (o token vem do gh, não precisa mexer no .env):
GITHUB_TOKEN="$(gh auth token)" HUB_USER=roi HUB_PASS=devcheck npx next dev -p 3199
curl -s -u roi:devcheck http://localhost:3199/ | grep -o 'GitHub: [^<]*'
curl -s -u roi:devcheck http://localhost:3199/insights | grep -c insight-narrative   # > 0 = F4 no ar
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
  10 estavam podres e um mandou trabalhar no repositório errado. O do `aftercare` é o caso vivo
  agora (item 1 lá em cima).
- **`homepage` errada falha em silêncio.** O hub health-checka e consulta o GSC contra a URL de
  preview sem reclamar; o sintoma é "esse projeto não tem dados de SEO".
- **Site atrás de Basic Auth se reporta como fora do ar.** `lib/health.ts` usa `res.ok`, 401 conta
  como caído. Vale pro roihub e pra qualquer coisa protegida.
- **A chave de um projeto é a URL do site, nunca o nome do repo.** Um repo serve N sites (o
  monorepo `roilabs` serve roilabs.com.br, goiania e tapepro). Releia `handoff-hub-github.md`.
- **Crawl Stats do GSC é média de 90 dias.** Problema já corrigido fica vermelho por ~3 meses.
  **Datar as falhas antes de caçar bug** — foi o caso do "40,6% OK" do roilabs: zero bug vivo.
- **`insufficient-data` não é queda**, é série curta. Vale pra ler o `/insights` e está escrito nas
  regras do prompt do narrate justamente porque o modelo tendia a ler como notícia ruim.
- **SplitJud fica de fora do hub** por decisão do Jean (10/07) — projeto dividido com o Aldo.
  O repo `splitjud` aparece na lista "sem site"; **não** preencha a homepage dele.
- ⚠️ **Janela de não-push: 00:00–01:00 BRT** (o cron do autopublishing roda 00:13).
