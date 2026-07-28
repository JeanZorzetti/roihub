# Handoff — abastecer o /infra com crawl stats toda semana, sem ninguém clicar

**Criado: 2026-07-25.** Não é `../handoff.md` porque esse já existe (histórico do hub inteiro).
Tarefa única, independente do autopublishing — mas **compartilha o repo com ele**, e é isso que
manda no horário (§4).

**Abordagem decidida pelo Jean:** Playwright logado no Search Console, baixando o mesmo ZIP que
hoje é baixado à mão. Descartadas: parsear log do Googlebot na VPS, URL Inspection API e
semi-manual assistido — o porquê está na §2.

**Atualização 25/07:** o robô não abastece mais só o `/infra`. Depois dos downloads ele roda o
`ml/analyze.py` e commita `data/insights.json` junto — o `/insights` lê os mesmos CSVs, então as
duas abas andam no mesmo run e no mesmo commit. Detalhes e gotchas: `handoff-insights-automatico.md`.

---

## 1. O que existe hoje

A aba `/infra` não tem banco: ela **lê o repo a cada request**.

| peça | onde | o que faz |
|---|---|---|
| descoberta | `app/infra/page.tsx:36-51` (`findExports`) | varre `docs/` **recursivamente** e aceita toda pasta cujo nome casa `^(.+)-Crawl-stats-(\d{4}-\d{2}-\d{2})$` |
| leitura | `app/infra/page.tsx:56-64` (`readCsv`) | acha o CSV por palavra sem acento: `/resumo|chart/`, `/respostas|response/`, `/hosts/` |
| parse | `lib/crawl.mjs` | por **posição de coluna**, nunca por nome de header (os headers são localizados) |
| histórico | `mergeExports` (`lib/crawl.mjs:85`) | junta N exports do mesmo host, dedupe por data, export mais novo vence |
| render | `export const dynamic = "force-dynamic"` | sem cache: arquivo novo aparece no próximo request **depois do deploy** |

Só três dos seis CSVs do export são usados hoje (resumo diário, respostas, hosts). Os outros
(`finalidades`, `tipos de Googlebot`, `tipos de arquivos`) vêm no ZIP e ficam no repo sem consumidor.

**Estado:** 9 exports (54 CSVs), **todos de `2026-07-10`** — 15 dias parados, e a pasta `Context/`
está vazia: `context.nimblabs.com` nunca teve export, então a aba mostra 9 propriedades, não 10. O
rodapé já se descreve como "export manual semanal" e o semanal nunca aconteceu.

### Por que acumular exports vale mais que atualizar

Cada export cobre 90 dias e o número que o GSC mostra é **média de 90 dias** — problema corrigido
continua vermelho por ~3 meses (foi o caso do "40,6% OK" do roilabs, investigado e improcedente).
Com um export por semana, `mergeExports` monta uma série **maior que a janela do GSC** e o
`WeekChart`/`crawlTotals28` passam a julgar por **dias novos**. É esse o ganho real da tarefa —
não é só "dado fresco", é conseguir ver o efeito de um fix antes de 3 meses.

---

## 2. Por que Playwright (e não algo mais limpo)

**Crawl Stats não tem API.** Não existe endpoint na Search Console API — está registrado em
`lib/crawl.mjs:2` e continua verdade: `searchconsole.googleapis.com` expõe `searchAnalytics`,
`sitemaps`, `urlInspection` e `sites`, nada de rastreamento. A UI é a única fonte.

| descartada | motivo |
|---|---|
| log do Googlebot na VPS | dado é melhor (diário, real), mas os 10 hosts vivem em 3 plataformas e o Vercel não entrega bytes/ms → parser novo + 3 acessos, para substituir algo que já funciona |
| URL Inspection API | oficial e estável, mas **não devolve bytes, ms nem mix de status**: a aba perderia as 3 métricas que mostra hoje |
| semi-manual assistido | continua dependendo de alguém lembrar — foi exatamente o que falhou por 15 dias |

O que **não** deve ser feito: chamar o endpoint interno de export da UI direto (`/search-console/…`
com token `at=`). Não é documentado, o token é de sessão e quebra sem aviso. O clique no botão é mais
estável que a API privada.

---

## 3. Implementar — ✅ FEITO em 25/07, falta só o `--login` do Jean (§4)

`scripts/fetch-crawl-stats.mjs` (browser + git) e `lib/crawl-fetch.mjs` (as duas funções puras),
com `test/crawl-fetch.test.mjs` no `npm test`. Dependência: **`playwright-core`**, não `playwright`
— o postinstall do segundo baixa browsers e roda dentro do `npm ci` do `Dockerfile` (alpine, sem
suporte oficial), o que derrubaria o deploy do hub. Como o robô usa o Chrome do sistema
(`channel: "chrome"`), não há browser a baixar. A imagem final não muda: ela só copia
`.next/standalone`.

### 3.1 Descobrir as propriedades — de graça, sem hardcode

A service account já lista tudo, e **isso destravou hoje** (§5, gotcha 1). Verificado em 25/07:

```
sc-domain:goiania.roilabs.com.br      sc-domain:roilabs.com.br        sc-domain:siriuscrm.com.br
sc-domain:estetia.estetiacrm.com.br   sc-domain:estetiacrm.com.br     sc-domain:polarisia.com.br
sc-domain:context.nimblabs.com        sc-domain:reviewshield.nimblabs.com
sc-domain:aftercare.nimblabs.com      sc-domain:nimblabs.com
```

Dez propriedades, todas `sc-domain:`, todas `siteFullUser`. Iterar a resposta de
`GET /webmasters/v3/sites` (o mesmo request de `lib/gsc.ts:47`) em vez de manter lista no script:
propriedade nova entra sozinha, e o mapa nunca mente.

⚠️ **`tapepro.roilabs.com.br` não tem propriedade própria** — cai dentro de
`sc-domain:roilabs.com.br` e só aparece na "Tabela de hosts" daquele export. Não existe card de
`/infra` para o tapepro e não vai passar a existir; se quiser um, o caminho é criar a propriedade no
GSC, não mexer no código.

O `resource_id` da UI é a string da propriedade **URL-encoded**:

```
https://search.google.com/search-console/settings/crawl-stats?resource_id=sc-domain%3Agoiania.roilabs.com.br&hl=en
```

O `&hl=en` é de propósito: trava o texto do botão em "Export" independente do idioma da conta. Os
CSVs de dentro podem continuar em pt-BR — o `readCsv` casa os dois idiomas.

### 3.2 Sessão: ⚠️ o Google recusa login em browser automatizado

**Tentativa que falhou (25/07):** `launchPersistentContext` + `--login`. O Google devolveu
`accounts.google.com/v3/signin/rejected` — *"Não foi possível fazer o login / esse navegador ou app
pode não ser seguro"*, com o próprio Chrome avisando `--no-sandbox` na barra. Não é bug de perfil
nem de 2FA: **navegador iniciado pelo Playwright não autentica no Google**, e ficar caçando flags
(`--disable-blink-features=AutomationControlled`, `ignoreDefaultArgs`) é gato e rato que quebra
sozinho no próximo update.

**O que funciona:** separar quem abre de quem dirige. O login acontece num Chrome **comum**, e o
robô só se conecta depois — o Google barra o *fluxo de login* sob automação, não uma sessão que já
existe.

```js
// --login: Playwright não entra aqui. Chrome normal, spawn puro.
spawn(CHROME, [`--user-data-dir=${PROFILE}`, "https://search.google.com/search-console"]);

// run semanal: mesmo perfil, agora com porta de debug, e o robô CONECTA
spawn(CHROME, [`--user-data-dir=${PROFILE}`, "--remote-debugging-port=0", "about:blank"]);
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
```

`PROFILE` = `%LOCALAPPDATA%\roihub-gsc-profile` (**fora do repo** — é sessão Google, nunca
versionar). Porta `0` + ler `DevToolsActivePort` de dentro do perfil: porta fixa colide, e o arquivo
é a única fonte confiável de qual porta o Chrome pegou.

A janela abre **visível** também no run semanal, de propósito: headless com sessão Google é
justamente o que costuma disparar re-autenticação. Domingo de manhã, 3 minutos de janela aberta na
máquina do Jean, não incomoda ninguém.

Não usar o perfil pessoal do Chrome do Jean: o Chrome recusa `--user-data-dir` já em uso e o
processo novo morre em silêncio sem escrever a porta.

Verificado em 25/07 sem precisar de login: `connectOverCDP` → `waitForEvent("download")` →
`suggestedFilename()` → `saveAs()` funciona (era o elo incerto — download por CDP não é o mesmo
caminho de um contexto criado pelo Playwright).

### 3.3 O download nomeia a pasta

Não montar o nome à mão — o GSC já entrega o nome no padrão que o `findExports` espera
(`goiania.roilabs.com.br-Crawl-stats-2026-07-10.zip`, confirmado nas 10 pastas atuais):

```js
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: /export/i }).click().then(() =>
    page.getByRole("menuitem", { name: /download csv/i }).click()),
]);
const base = download.suggestedFilename().replace(/\.zip$/i, "");   // já é host-Crawl-stats-AAAA-MM-DD
await download.saveAs(path.join(tmp, `${base}.zip`));
```

Descompactar com **`Expand-Archive`** (PowerShell) — é o mesmo "Extrair aqui" que gerou as pastas
atuais. Não use `tar -xf`: o `tar` que aparece primeiro no PATH desta máquina é **GNU tar 1.35, que
não lê ZIP**; o bsdtar do Windows leria, mas qual dos dois responde depende do PATH de quem chamou.

Destino `docs/Crawl-stats/<host>/<base>/` (CSVs na raiz da pasta, como as atuais). Não
reaproveitar a taxonomia `After/`, `Nimb/`, `Roi/`… — ela não significa nada para o código, que só
lê o nome da pasta. **Não renomeie as pastas antigas**: elas são o histórico anterior a 10/07.

### 3.4 ⚠️ O menu do Export escorrega — clicar depressa acerta o item errado

Falha que custou 3 runs: `aftercare` e `reviewshield` davam **timeout esperando o download**, sempre;
os outros 8 passavam, sempre. Não era seletor (existe **um** `menuitem` "Download CSV") nem sessão.

O menu abre e **desce ~40px** quando o resto da página chega — as duas propriedades que falhavam são
justamente as que exibem a faixa "Host had problems in the past", que empurra o topo mais tarde. O
clique sai durante o movimento e acerta o item de cima, **"Download Excel"**, que aqui não baixa
nada. O Playwright não acusa: para ele o clique foi entregue.

O `stable` nativo do Playwright não cobre isso — ele exige caixa igual por 2 frames (~33ms), e o
shift é discreto, não animação. A espera tem que ser explícita:

```js
await settled(csv);          // mesma boundingBox em duas medições com 250ms de intervalo
await csv.click();
```

Dois detalhes que custam tempo se descobertos de novo:

- **`dispatchEvent("click")` não funciona** neste menu (tentado como "imune a coordenada"): o item
  ignora click sintético e o download nunca sai. Tem que ser clique real.
- O sintoma engana no diagnóstico: qualquer `console.log(await csv.boundingBox())` antes do clique
  **faz o bug sumir**, porque a medição dá tempo do menu assentar. Um diagnóstico instrumentado
  passa enquanto o script real falha.

### 3.5 Falhar ruidoso, nunca commitar lixo

Duas funções puras, e são elas que o teste cobre:

- `destDirFor(suggestedFilename)` → caminho de destino, ou `null` se o nome não casar o regex do
  `findExports` (nome fora do padrão = a UI mudou → abortar, não adivinhar).
- `validateExport(dir)` → `parseDailyChart` do CSV de resumo tem ≥ 1 linha `AAAA-MM-DD`. Falhou:
  apagar a pasta e contar como erro do projeto.

No fim: se **nenhum** export passou, `process.exit(1)` sem commit. Se alguns passaram, commitar os
bons e sair diferente de zero com a lista dos que falharam — silêncio aqui vira 15 dias de dado
velho outra vez. Salvar `screenshot` do erro em `%TEMP%` ajuda a diferenciar "sessão expirou" de
"seletor mudou" (são as duas falhas prováveis, e o tratamento é oposto).

### 3.6 Teste

`test/crawl-fetch.test.mjs`, no `npm test`. Sem browser, sem fixture pesada: `destDirFor` com nome
bom e nome ruim, e `validateExport` num diretório temporário com um CSV de resumo válido e um vazio.
Playwright não entra no teste — o que quebra em silêncio é o naming e a validação, não o clique.

---

## 4. Agendar

**Onde:** máquina do Jean, Task Scheduler. **Quando:** domingo, 10:00 BRT.

- IP residencial e sessão de verdade: cookie do Google em secret de CI, aberto de IP de datacenter,
  é challenge na cara — e um robô semanal não justifica manter isso vivo.
- Marcar "Run task as soon as possible after a scheduled start is missed": PC desligado no domingo
  não perde a semana.
- O push é local, o `git` da máquina já tem credencial (push de 25/07 passou sem prompt).

**Não agendar de madrugada.** `git push` no roihub dispara auto-deploy no EasyPanel, o container do
hub troca e o autopublish **em andamento volta `request-failed` nos projetos em voo**. Com os 10
projetos ligados a janela proibida é **00:00–01:00 BRT** (o cron é `13 3 * * *` = 00:13 BRT). Domingo
10:00 está a 9 horas de distância dos dois lados.

✅ **Agendado em 28/07.** Não com `schtasks`: o CLI **não expõe "run if missed"** (`StartWhenAvailable`),
que é justamente o requisito acima. O cmdlet expõe, e ainda resolve o `cd` do §4 sem wrapper:

```powershell
$a = New-ScheduledTaskAction -Execute "C:\Program Files\nodejs\node.exe" `
     -Argument '"C:\Users\jeanz\OneDrive\Desktop\ROI Labs\roihub\scripts\fetch-crawl-stats.mjs"' `
     -WorkingDirectory "C:\Users\jeanz\OneDrive\Desktop\ROI Labs\roihub"
$t = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 10:00
$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName "roihub crawl stats" -Action $a -Trigger $t -Settings $s
```

`-WorkingDirectory` é o repo (o Task Scheduler inicia em `C:\Windows\System32` e `git add` cairia no
lugar errado); `node` por caminho absoluto porque o PATH da tarefa não é o do seu shell.
Conferir: `(Get-ScheduledTask -TaskName "roihub crawl stats").Settings.StartWhenAvailable` → `True`.
Primeiro disparo: **domingo 02/08/2026 10:00**.

O script tem que `cd` para o repo (ou usar caminhos absolutos): o Task Scheduler inicia em
`C:\Windows\System32`, e `process.cwd()` errado faz o `git add` cair no lugar errado.

---

## 5. Gotchas que vão morder

1. **BOM no `.env` engolia o `GOOGLE_SERVICE_ACCOUNT_JSON`** — corrigido em 25/07 (3 bytes
   removidos). Com BOM, `node --env-file` registra a chave como `"\ufeffGOOGLE_SERVICE_ACCOUNT_JSON"`
   e `process.env.GOOGLE_SERVICE_ACCOUNT_JSON` fica `undefined`: **nenhum script local jamais leu o
   GSC**, e o sintoma é "credencial inválida", não "variável faltando". Só a **primeira** linha do
   arquivo é afetada — por isso `DATABASE_URL` (segunda linha) sempre funcionou. Produção nunca
   sofreu disso (as vars vêm do EasyPanel). Se editar o `.env` no Notepad, o BOM volta.
2. **Arquivo local não abastece nada.** O `Dockerfile` faz `COPY --from=build /app/docs ./docs`: o
   `/infra` de produção lê o `docs/` **de dentro da imagem**. Sem commit + push + rebuild, o export
   novo existe só na sua máquina.
3. **`force-dynamic` relê tudo a cada request.** 10 exports/semana = ~520 pastas/ano × 6 CSVs. Hoje
   é irrelevante (~60 KB/semana); passando de **~100 pastas**, o caminho é consolidar em um
   `data/crawl.json` no próprio script e o `/infra` ler um arquivo só. Não faça agora.
4. **Sessão Google expira sem avisar** e o robô cai numa tela de login onde esperava o botão
   Export. É a falha nº 1: tratar como "rodar `--login` de novo", não como bug de seletor. E o
   `--login` **tem que abrir Chrome comum** (§3.2) — se alguém "simplificar" isso de volta para
   `chromium.launch()`, o Google recusa a autenticação e o robô nunca mais loga.
8. **Chrome do perfil do robô aberto = run falha inteiro.** A segunda instância delega para a
   primeira e morre sem escrever `DevToolsActivePort`; a mensagem de erro já diz qual perfil fechar.
5. **O ZIP não vem com pasta interna.** Extrair "achatado" dentro da pasta que você cria; se
   aparecer um nível extra, o `readCsv` não acha CSV nenhum e o export passa vazio pela validação
   (por isso `validateExport` exige linha de data, não só arquivo presente).
6. **Só 3 dos 6 CSVs importam.** Se um export vier incompleto, o que decide é o de resumo; os outros
   dois degradam para "sem status"/0% sem quebrar a página.
7. **A propriedade que a service account lista pode não ser a que a sessão vê.** São duas
   identidades diferentes (SA na API, conta do Jean no browser). Divergiu → 404 na UI; a mensagem de
   erro tem que dizer qual `resource_id` falhou.

---

## 6. Verificar

```bash
node scripts/fetch-crawl-stats.mjs          # ~2-4 min, 10 propriedades
git status --short docs/                    # 10 pastas novas com a data de hoje
npm test                                    # crawl-fetch + os 117 atuais
```

Depois do push, no `/infra`: o rodapé conta 10 propriedades, cada card mostra "dados até" com data
da semana, e o `WeekChart` ganhou uma barra à direita. Um card que **não** avançou de data é
export falhado, não site parado — confira a saída do script antes de investigar o site.

---

## 7. Checklist

- [x] `playwright-core` como devDep (não `playwright` — §3)
- [x] `lib/crawl-fetch.mjs` com `destDirFor` + `validateExport`; `scripts/fetch-crawl-stats.mjs`
      com o browser e o git
- [x] `test/crawl-fetch.test.mjs` no comando `test`: **121/121 verde**, `npx tsc --noEmit` limpo
- [x] Run sem sessão exercitado em 25/07: lista as 10 propriedades, abre o Chrome por spawn, conecta
      por CDP, detecta a tela de login, falha nas 10 com "sessão expirou", `exit 1`, **nada commitado**
- [x] Caminho de download provado isolado (CDP → `waitForEvent` → `saveAs`), sem depender de login
- [x] `--login` feito pelo Jean em 25/07 (Chrome comum, perfil em `%LOCALAPPDATA%\roihub-gsc-profile`)
- [x] **Primeiro run de verdade concluído: 10/10 exports de `2026-07-25` no repo**, commitados e
      pushados pelo próprio robô (`b4c17a0` com 8, `66d5feb` com os 2 que faltavam). O `context`
      deixou de ser a pasta vazia — a aba passa a ter as 10 propriedades
- [x] **Task Scheduler domingo 10:00 BRT + "run if missed" — feito em 28/07** (§4; primeiro
      disparo 02/08). Até aqui o `/infra` congelava em 25/07
- [ ] Re-run seletivo quando uma propriedade falhar: `node scripts/fetch-crawl-stats.mjs aftercare`
      (argumento solto filtra por substring; sem argumento roda as 10)
- [ ] Trocar o texto "export manual semanal" no rodapé de `app/infra/page.tsx:123`
