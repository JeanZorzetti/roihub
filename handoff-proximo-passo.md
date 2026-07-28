# Handoff — próximo passo do ROI Hub (comece por aqui)

Atualizado em **2026-07-28, fim da tarde**. `GITHUB_TOKEN` **confirmado em produção pelo Jean** —
com isso **toda a frente de configuração do hub está fechada** (P0–P4 do plano anterior).

O hub em produção agora lista todos os projetos vivos do GitHub, não os 10 curados.
Como isso funciona por dentro: `handoff-hub-github.md`. Histórico geral: `handoff.md`.

**Resumo em uma linha:** não sobrou config; sobraram **3 tarefas de ops (suas)** e
**1 frente de código (F3)**.

---

## 🔴 A1 — Três sites de produção estão FORA DO AR (ops, não código)

Descoberto em 28/07 ao apontar as `homepage` para os domínios reais. **Não é bug do hub** —
confirmado por fora, do host Windows, com `Resolve-DnsName` + `Invoke-WebRequest`:

| site | DNS resolve para | resposta |
|---|---|---|
| `prolifemed.com.br` | 187.127.2.204 | **timeout** (20 s, sem resposta) |
| `seven-md.com.br` | 187.127.2.204 | **timeout** (20 s, sem resposta) |
| `compass.polarisia.com.br` | 2.24.207.200 (VPS EasyPanel) | **404** — vhost não roteado |

Os dois primeiros apontam para o **mesmo IP**, que **não é** o VPS do EasyPanel: provavelmente é
**um host caído derrubando dois sites**, não dois problemas independentes. Comece por aí.

O `compass` é outra coisa: o DNS chega no VPS certo, mas o EasyPanel não tem o domínio
configurado pra esse subdomínio. Config de proxy, não de código.

Os três aparecem `✕ FORA DO AR` no ranking, como deviam — e como não apareciam antes, porque a
`homepage` deles apontava pra preview da Vercel.

---

## 🔴 A2 — O robô de crawl stats **nunca foi agendado** (1 comando)

Descoberto em 28/07 e **não estava registrado em lugar nenhum**: o
`handoff-crawl-stats-semanal.md` dizia "falta só o `--login`", mas o login já funcionou (os
exports de 25/07 estão no repo, pushados pelo próprio robô). O que falta é o **Task Scheduler**:

```powershell
schtasks /query /tn "roihub crawl stats"
# ERRO: O sistema não pode encontrar o arquivo especificado.  ← não existe
```

Estado dos dados hoje: **2 snapshots, 10 hosts** — `2026-07-10` e `2026-07-25`. Sem agendar, a
aba `/infra` congela em 25/07 e a comparação semana-a-semana (que é o ponto dela) morre.

```powershell
schtasks /create /tn "roihub crawl stats" /sc weekly /d SUN /st 10:00 `
  /tr "node \"C:\Users\jeanz\OneDrive\Desktop\ROI Labs\roihub\scripts\fetch-crawl-stats.mjs\""
```

Marcar **"Run task as soon as possible after a scheduled start is missed"** (PC desligado no
domingo não pode perder a semana). Domingo 10:00 é de propósito: `git push` no roihub dispara
auto-deploy e a **janela proibida é 00:00–01:00 BRT** (cron do autopublish às 00:13).
Detalhes e gotchas: `handoff-crawl-stats-semanal.md` §4.

---

## 🟡 A3 — Arquivar o `Atma` no GitHub

Já **saiu do ranking** em 28/07 (a `homepage` foi limpa), mas o repo continua vivo. O
`gh repo archive` foi **bloqueado pelo classificador de permissões** na sessão de 28/07 — é ação
sua, 5 segundos:

```bash
gh repo archive JeanZorzetti/Atma
```

Repo arquivado é ignorado pelo hub e o histórico continua lá. **É a forma canônica de aposentar
um projeto daqui pra frente** — melhor que limpar a homepage, que foi só o paliativo.

---

## 🟢 B1 — A única frente de código aberta: F3 (forecast + kill-gates)

`handoff-ml.md`: **F0–F2 shipped** (o `ml/` gera `data/insights.json` e a aba `/insights`
renderiza health 0–100, Theil-Sen, PELT, MAD). **F3 e F4 continuam abertos**, e os briefs de lá
seguem válidos.

**F3 — forecast + kill-gates.** Holt-Winters/ETS nas impressões semanais → projeção de 4–8
semanas com intervalo, usada para os **kill-gates D+90/180/270 dos bets nimblabs**. O output é
uma frase como *"no ritmo atual, o aftercare NÃO cruza o gate D+180"*. O próprio `handoff-ml.md`
chama isso de **o insight de maior valor de negócio do sistema** — e é a coisa mais próxima do
propósito do hub ("qual é o foco de hoje") que ainda não existe.

**Por que agora:** o gate D+90 do AftercareGen cai **~29/08** e hoje a decisão vai ser tomada
olhando GSC na mão. F3 é o que transforma isso em número antes da data.

**F4 (narrativa via `claude-cli`) fica pra depois de F3** — é enfeite em cima do forecast.
Orçamento: `claude-cli` apenas, **nunca API paga**.

Ambiente: Python 3.13, venv em `C:\venvs\roihub-ml`. Ler `handoff-ml.md` §"Gotchas pra próxima
sessão" **antes** de escrever código.

---

## ⚠️ Coisa nova pra ficar de olho: a home ficou cara

Agora que a prod lê o GitHub, o ranking tem **38 projetos**, e cada load faz **1 health check +
2 queries GSC por projeto**. Em dev isso deu **2,2–3,0 s**. Ninguém mediu em prod ainda.

**Não otimize preventivamente** — meça primeiro. Se doer, o caminho barato é cachear o health
check por alguns minutos, não reescrever nada.

---

## 🚫 Não reabrir (decidido, com motivo)

- **A régua do ranking.** Em 28/07 o Jean decidiu: **todos os repos com `homepage` entram**, sem
  filtro por atividade e sem arquivar os protótipos. "Ver tudo" é o ponto de um hub de todos os
  repos. Não implemente cutoff de 12 meses.
- **`homepage` do `roihub`.** Deixada vazia **de propósito**: o hub está atrás de Basic Auth e
  `lib/health.ts` usa `res.ok`, então um 401 faria o hub se reportar como "FORA DO AR" pra
  sempre. Só faz sentido depois que o health check souber tratar 401.
- **`acao` do `tapepro` vazia.** De propósito: não há tarefa de dev real hoje, e card inventado
  apodrece (ver Armadilhas).
- **As ~24 `homepage` restantes em `*.vercel.app`.** Para protótipos que só existem no preview,
  a URL da Vercel **é** a URL real. Só corrigir quando o projeto ganhar domínio próprio.

---

## Como validar qualquer coisa acima

```bash
npm test                 # 128/128
npx tsc --noEmit         # limpo
npm run build            # 5 rotas ƒ (dynamic)

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
  10 estavam podres e um mandou trabalhar no repositório errado.
- **`homepage` errada falha em silêncio.** O hub health-checka e consulta o GSC contra a URL de
  preview sem reclamar de nada; o sintoma é "esse projeto não tem dados de SEO".
- **Site atrás de Basic Auth se reporta como fora do ar.** `lib/health.ts` usa `res.ok`, então
  401 conta como caído. Vale pro roihub e pra qualquer coisa protegida.
- **A chave de um projeto é a URL do site, nunca o nome do repo.** Um repo serve N sites (o
  monorepo `roilabs` serve roilabs.com.br, goiania e tapepro). Se aparecer a tentação de chavear
  por repo, releia o `handoff-hub-github.md`.
- **Crawl Stats do GSC é média de 90 dias.** Problema já corrigido fica vermelho por ~3 meses.
  **Datar as falhas antes de caçar bug** — foi o caso do "40,6% OK" do roilabs: zero bug vivo.
- **SplitJud fica de fora do hub** por decisão do Jean (10/07) — projeto dividido com o Aldo.
  O repo `splitjud` aparece na lista "sem site"; **não** preencha a homepage dele.
- ⚠️ **Janela de não-push: 00:00–01:00 BRT** (o cron do autopublishing roda 00:13).
