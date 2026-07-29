# Handoff — espera medida do ML + A1

> ⚠️ **Este não é mais o ponto de entrada.** A frente ativa desde 29/07 é
> [`handoff-21-projetos-no-ar.md`](handoff-21-projetos-no-ar.md) — 21 projetos do ranking foram
> **apagados da Vercel**. Ele também **corrige o A1 abaixo**: `prolifemed.com.br` está no ar na
> Vercel (projeto `prolife-next-js`), então **não** é caso de vhost na EasyPanel.

Atualizado em **2026-07-28, 3ª sessão da noite**. **Não há frente de código aberta no hub.** O ML
fechou (F0–F4), o robô de crawl stats está agendado e o último card podre foi reescrito — e o que
ele pedia já foi implementado na mesma sessão (uma linha, não uma feature).

O que sobrou é **espera medida** (três números pra olhar em datas conhecidas), **duas verificações
que só o Jean pode fazer** e **A1**, que é ops de DNS/vhost.

Índice de todos os handoffs e histórico do hub: [`../handoff.md`](../handoff.md).
Como a lista de projetos vem do GitHub: `handoff-hub-github.md`. Modelagem do ML: `handoff-ml.md`.

**Resumo em uma linha:** o hub já projeta os kill-gates e explica em português o que está
acontecendo; o próximo movimento não é escrever código, é **ver se o steer B2B do aftercare tira os
cliques do zero** e **3 sites voltarem ao ar**.

---

## 🟡 Se você abriu esta sessão pra codar, comece checando ISTO (não é código)

Nada aqui é implementação. Se todos os três estiverem verdes, **o hub não tem tarefa de dev hoje** —
o valor está nos projetos, não no hub. Não invente refactor.

### 1. A pauta do `aftercare` migrou pro cluster B2B?

Abrir `/seo` e ler a coluna `query` das publicações do `aftercare`. Contexto:

- O D+90 **passou** por impressão (540/sem contra gate de 100), mas o **D+180 mede CLIQUE** — 10/sem
  em **28/11** — e hoje são **0**, com posição média 58,2 em 68 artigos.
- Dos 68 posts, ~31 são `Clinic Resources` (B2B, converte pra `/pricing`) e ~37 eram aftercare
  consumer (paciente de botox/filler). **Clique de paciente não compra software de clínica**, então
  volume de impressão consumer não fecha o D+180 nem multiplicado por 10.
- Em 28/07 o steer foi ligado: `editorialFocus` B2B na entrada do `aftercare` em
  `lib/autopublish-projects.mjs`. É o **mesmo campo** que `goiania` e `tapepro` já usavam
  (injetado no prompt em `autopublish-clients.ts:336`, agora com teste). **Não reimplemente isso
  como filtro novo** — foi o erro que o card anterior mandava cometer.

**Como ler o resultado:** se em ~3 semanas a pauta continuar consumer, o problema é o **texto** do
`editorialFocus`, não o mecanismo — endureça a redação, não escreva código. Se a pauta migrou, o
número que decide é `cliques/sem` no `/insights`, não impressão.

### 2. `/insights` em prod — nunca foi visto fora do dev

As narrativas do F4 e o render do forecast só rodaram em `localhost`. **Só o Jean consegue abrir**
(basic auth, `HUB_PASS` existe só na EasyPanel). É abrir a aba e olhar.

### 3. O run automático de **02/08** (primeiro domingo)

Primeiro run com `narrate.py` encadeado. O risco é só de ambiente: a tarefa roda como `jeanz`
(logon interativo, PATH do usuário) e o `claude.cmd` vive em `%APPDATA%\npm` — deve resolver, **mas
nunca rodou por lá**. Se o log trouxer `aviso: ml/narrate.py falhou`, é PATH ou sessão do CLI, **não
o script**: o `insights.json` commitado fica correto, só sem prosa. `python ml/narrate.py` à mão
fecha o buraco daquela semana.

---

## 🔴 A1 — Três sites de produção continuam FORA DO AR (ops, não código)

Intocado desde 28/07 (manhã) — é acesso a host/DNS, não commit.
Confirmado do host Windows com `Resolve-DnsName` + `curl`:

| site | DNS resolve para | resposta no IP do DNS | resposta **no VPS** (`--resolve` p/ 2.24.207.200) |
|---|---|---|---|
| `prolifemed.com.br` | 187.127.2.204 | **timeout** | **404** |
| `seven-md.com.br` | 187.127.2.204 | **timeout** | **404** |
| `compass.polarisia.com.br` | 2.24.207.200 (VPS EasyPanel) | **404** | **404** |

> 🔴 **Revisado de novo em 29/07 — o bloco abaixo vale só pra `seven-md` e `compass`.**
> `prolifemed.com.br` **não** é caso de EasyPanel: o app está no ar na Vercel
> (`prolife-next-js.vercel.app`, 200), só sem domínio atribuído. Detalhe e a pergunta que precisa ir
> pro Jean (o deploy Vercel é o 2º ambiente, de banco vazio) em
> [`handoff-21-projetos-no-ar.md`](handoff-21-projetos-no-ar.md) §5.

**Os três são o MESMO problema** (revisado 28/07, 4ª sessão): nenhum dos três domínios tem vhost no
EasyPanel — forçando o Host header contra o VPS, todos dão 404, inclusive `www.prolifemed.com.br`.
Não é "um host caído derrubando dois sites".

- **187.127.2.204 está morto de verdade**: sem ICMP, sem 80, sem 443. Não adianta investigar o host —
  é IP velho no DNS (mesmo padrão do [[splitjud_www_dns_orphan]]).
- **Conserto, na ordem:** (1) adicionar os 3 domínios no EasyPanel e emitir cert; (2) só então apontar
  o A record de `prolifemed.com.br` e `seven-md.com.br` (e o `www`) pro 2.24.207.200 e **remover** o
  187.127.2.204. Inverter a ordem deixa os sites em 404 público em vez de timeout.
- Se algum dos dois apps **não estiver deployado** no VPS, o passo (1) já revela — o EasyPanel não
  tem serviço pra rotear.

Comando que reproduz o diagnóstico:

```bash
for h in prolifemed.com.br seven-md.com.br compass.polarisia.com.br; do
  curl -sk -o /dev/null -w "$h -> %{http_code}\n" --resolve "$h:443:2.24.207.200" "https://$h/"
done
```

Os três aparecem `✕ FORA DO AR` no ranking, como deviam.

---

## 📅 Calendário do que decide sozinho (só olhar na data)

| data | o que acontece | onde olhar |
|---|---|---|
| **02/08** | 1º run automático do robô de crawl stats + narrate | log da Task Scheduler, `docs/**` |
| **~18/08** | 3 semanas de pauta sob o `editorialFocus` B2B | `/seo` (coluna query) |
| **30/08** | data nominal do D+90 do Aftercare — **já passou antes** | `/insights` |
| **02/09** | D+90 do ReviewShield — projeção diz **não cruza** (~84 imp/sem, banda 35–200) | `/insights` |
| **10/09** | D+90 do Context Keeper — série curta; 49 imp na última semana (era 0 em 11/07) | `/insights` |
| **28/11** | **D+180 do Aftercare: 10 cliques/sem.** Hoje 0 | `/insights` |

---

## ✅ Fechado em 28/07 (não reabrir)

- **A2 — robô de crawl stats agendado.** Task Scheduler ("roihub crawl stats", usuário `jeanz`,
  domingo 10:00 BRT, "run if missed" marcado, primeiro disparo **02/08**). `schtasks` não serve: o
  CLI não expõe `StartWhenAvailable`. Comando e porquês em `handoff-crawl-stats-semanal.md` §4.
- **A3 — `Atma` arquivado.** Repo arquivado é ignorado pelo hub e o histórico continua lá — **forma
  canônica de aposentar um projeto**, melhor que limpar a `homepage`.
- **F3 — forecast + kill-gates.** `ml/forecast.py` + render no `/insights`.
- **F4 — narrativa.** `ml/narrate.py`: 1 chamada de `claude-cli` por run, todos os projetos no mesmo
  prompt, `{"slug": "2–3 frases"}` de volta; 11/11 no primeiro run. Encadeado no robô de crawl.
- **Card do `aftercare` reescrito + steer B2B ligado.** O card mandava checar GSC à mão pro D+90 que
  o `/insights` já tinha decidido; virou a aposta dobrada, com o gate de clique como único número.
  `receitaNota` (dizia 20 artigos), `blockersLista` e `decayNota` ("estável parado", com impressão
  subindo 68%/sem em 4 semanas) foram junto. O `editorialFocus` do `aftercare` entrou no mesmo dia,
  com teste (`researchAndDraft leva o editorialFocus do projeto pro prompt`).
- **Handoffs organizados**: os temáticos vivem em `handoff/`, índice no `../handoff.md`.

> **Lição da sessão, vale pra qualquer uma:** o card mandava construir um "filtro de cluster" que já
> existia há semanas como `editorialFocus`, usado por dois projetos. **Antes de escrever feature,
> grep pelo campo em `lib/autopublish-projects.mjs`** — os projetos mais antigos já resolveram
> problema parecido.

---

## 🟢 Ficam esperando (não puxe sem motivo)

- **Threshold do D+180.** Único número inventado do sistema (10 cliques/sem, em `GATE_SPECS`); a tese
  não fixa valor. Calibrar quando o D+180 chegar perto (28/11). É uma constante.
- **A home ficou cara.** 38 projetos × (1 health check + 2 queries GSC). Em dev deu 2,2–3,0 s;
  ninguém mediu em prod. **Não otimize preventivamente** — meça. Se doer, cachear o health check por
  alguns minutos é o caminho barato, não reescrever nada.
- **Changepoint em crawl stats** só passa a valer com 2–3 meses de exports emendados. O robô semanal
  começou agora; isso liga sozinho conforme o histórico cresce.
- **`reviewshield`**: o card (on-page do `/checker` + links internos) segue **honesto e válido** — é
  a última chance antes de 02/09. Não deixe virar texto de enfeite: o efeito dá pra medir semanal.

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
- **Uma chamada de `claude-cli` por run no narrate**, todos os projetos no mesmo prompt. Dividir por
  projeto multiplica a chance de 429 sem melhorar nada.
- **Ordem `analyze.py` → `narrate.py`.** O analyze zera as narrativas de propósito: é o que garante
  que nunca sobre texto velho descrevendo número novo.
- **Filtro de cluster no autopublish.** Já existe: `editorialFocus`. Ver item 1.

---

## Como validar qualquer coisa acima

```bash
npm test                 # 129/129
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

⚠️ `gh repo edit --homepage ""` **não funciona no PowerShell** (a string vazia é engolida e o flag
reclama de argumento faltando). Use a API:

```bash
echo '{"homepage":""}' | gh api repos/JeanZorzetti/<repo> -X PATCH --input -
```

---

## Armadilhas conhecidas (já custaram tempo)

- **Card da agenda ≠ verdade.** As `acao`/`acaoDesc` do `projects.json` são texto à mão e apodrecem.
  Ler o `Repo:` do card e **validar a premissa antes de executar** — em 13/07, 3 de 10 estavam podres
  e um mandou trabalhar no repositório errado; em 28/07 o do `aftercare` mandava medir à mão o que o
  `/insights` já decidia. **Quem liga a automação atualiza o card no mesmo commit.**
- **Antes de escrever feature nova no autopublish, grep em `lib/autopublish-projects.mjs`.** Campos
  como `editorialFocus`, `registryPath`, `layoutRenders`, `risk` já resolvem casos parecidos.
- **`homepage` errada falha em silêncio.** O hub health-checka e consulta o GSC contra a URL de
  preview sem reclamar; o sintoma é "esse projeto não tem dados de SEO".
- **Site atrás de Basic Auth se reporta como fora do ar.** `lib/health.ts` usa `res.ok`, 401 conta
  como caído. Vale pro roihub e pra qualquer coisa protegida.
- **A chave de um projeto é a URL do site, nunca o nome do repo.** Um repo serve N sites (o monorepo
  `roilabs` serve roilabs.com.br, goiania e tapepro). Releia `handoff-hub-github.md`.
- **Crawl Stats do GSC é média de 90 dias.** Problema já corrigido fica vermelho por ~3 meses.
  **Datar as falhas antes de caçar bug** — foi o caso do "40,6% OK" do roilabs: zero bug vivo.
- **`insufficient-data` não é queda**, é série curta. Vale pra ler o `/insights` e está nas regras do
  prompt do narrate porque o modelo tendia a ler como notícia ruim.
- **`draft:ymyl` no `aftercare` é COMPORTAMENTO ESPERADO**, não bug: o renderizador é
  `ymyl-restricted` e conteúdo clínico é bloqueado por design. O steer B2B tende a reduzir isso —
  pauta operacional de clínica passa no gate; recuperação de paciente não.
- **SplitJud fica de fora do hub** por decisão do Jean (10/07) — projeto dividido com o Aldo. O repo
  `splitjud` aparece na lista "sem site"; **não** preencha a homepage dele.
- ⚠️ **Janela de não-push: 00:00–01:00 BRT** (o cron do autopublishing roda 00:13).
