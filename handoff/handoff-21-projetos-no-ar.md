# Handoff — colocar os 21 projetos no ar

Criado em **2026-07-29**. Substitui `handoff-proximo-passo.md` como **frente ativa**: o hub voltou a
ter trabalho, e não é feature — é **recolocar 21 sites no ar** e fazer o ranking parar de mentir.

Índice de todos os handoffs: [`../handoff.md`](../handoff.md).
Como a lista de projetos vem do GitHub: [`handoff-hub-github.md`](handoff-hub-github.md).

**Resumo em uma linha:** os 21 "fora do ar" do ranking devolvem `X-Vercel-Error: DEPLOYMENT_NOT_FOUND`
porque **os projetos não existem mais na Vercel** — a conta tem **9 projetos, não 30**. Não é bug do
hub, não é DNS: os deploys foram apagados e a `homepage` do GitHub ficou apontando pro alias morto.

---

## O número: de onde saem os 21

Medido em 29/07 contra os 28 repos não-arquivados com `homepage` preenchida:

| resultado | quantos | o que significa |
|---|---|---|
| **200** | 5 | no ar de verdade (`eg`, `housingpro`, `portfolio`, `qprime`, `roi-zenith`) |
| **404 · `DEPLOYMENT_NOT_FOUND`** | **21** | **o assunto deste handoff** — projeto apagado da Vercel |
| 404 · `NOT_FOUND` | 1 | `vertice-ten` — alias resolve, rota `/` não casa. Caso diferente, ver §5 |
| 404 · EasyPanel | 1 | `compass` — é o A1, ver §5 |

**A distinção que decide tudo** é o header, não o status:

```bash
curl -skI https://<alias>.vercel.app | grep -i x-vercel-error
# DEPLOYMENT_NOT_FOUND = projeto não existe mais na conta  -> precisa recriar
# NOT_FOUND            = projeto existe, rota não casa     -> é config, não deploy
```

Confirmado pelo outro lado, que é a prova real:

```
$ vercel project ls          # scope jean-zorzettis-projects (o ÚNICO — vercel teams ls confirma)
portfolio · prolife-next-js · repo-de-teste · atma · eg-site · eg · housingpro · admin · roi-zenith
```

**9 projetos.** Nenhum dos 21 está lá. Não adianta procurar deploy quebrado, log de build ou env
faltando: **não há o que consertar, há o que recriar.**

---

## 1. Antes de deployar qualquer coisa: 2 dos 21 não precisam de deploy

Estes dois estão **vivos** e só têm a `homepage` errada. Consertar aqui é 1 comando e tira 2 do
vermelho sem build nenhum. **Faça isto primeiro** — é a armadilha do "`homepage` errada falha em
silêncio" (ver `handoff-proximo-passo.md`).

| repo | `homepage` de hoje (morta) | realidade medida em 29/07 |
|---|---|---|
| `sirius` | `sirius-ebon.vercel.app` → `DEPLOYMENT_NOT_FOUND` | **`siriuscrm.com.br` responde 200.** O projeto nunca saiu do ar |
| `sofia-ia` | `sofia-ia-dashboard.vercel.app` → `DEPLOYMENT_NOT_FOUND` | **`sofiaia.roilabs.com.br` é NXDOMAIN** e não há projeto Vercel. Sem URL viva |

- ✅ **`sirius` — FEITO em 29/07.** `homepage` = `https://siriuscrm.com.br`, mede 200. Zero deploy:
  ```bash
  echo '{"homepage":"https://siriuscrm.com.br"}' | gh api repos/JeanZorzetti/sirius -X PATCH --input -
  ```
  ⚠️ Use a apex. `www.siriuscrm.com.br` devolve **404** (medido) — apontar o hub pro `www` recria o
  mesmo problema com outra roupa.
- **`sofia-ia` — este é o único dos 21 que é projeto de produção ativo** (push **hoje**, 29/07).
  O subdomínio caiu junto com os 14 subdomínios aposentados do `roilabs` (ver
  [[roilabs_dns_cloudflare_retired_subdomains]]). Precisa dos três passos: criar o projeto na Vercel,
  atribuir o domínio, e **recriar o registro no Cloudflare** — o DNS não existe, não está errado.
  Enquanto o DNS não voltar, o deploy só existe no alias `*.vercel.app`.

---

## 2. Os 19 restantes: deploy, em 3 grupos por esforço

Todos são protótipos (último push entre **08/2025 e 05/2026**). Agrupados pelo que o build precisa —
a diferença entre os grupos é **onde mora o `package.json`**, e isso muda a config da Vercel.

### Grupo A — deploy direto, raiz do repo (8)

`package.json` na raiz, build padrão. É `vercel link` + `vercel --prod`, sem config.

| repo | framework | último push |
|---|---|---|
| `amaze` | Next | 2026-05-12 |
| `monolith-muse` | Next | 2026-04-08 |
| `alibi_ai` | Next | 2026-02-28 |
| `vertex-landing-craft` | Next | 2026-01-31 |
| `sofia-ai-lux-dash` | Vite | 2025-08-03 |
| `cyberspace` | Vite | 2025-08-20 |
| `potencial-arquitetado` | Vite | 2025-08-18 |
| `matchfios-textile-connector` | Vite | 2025-09-26 |

### Grupo B — precisa de banco/env (1)

| repo | por quê |
|---|---|
| `orion-nova-ui` | build é `prisma generate && next build` — **sem `DATABASE_URL` o build falha**. Decidir se ganha banco ou se o protótipo vai ao ar com banco descartável |

### Grupo C — monorepo: precisa apontar o *root directory* (10)

Não têm `package.json` na raiz. O site fica num subdiretório e **a Vercel precisa saber qual** —
sem isso o build falha com "no package.json found" e parece repo quebrado.

| repo | root directory provável | último push |
|---|---|---|
| `mk6` | `web` | 2026-03-03 |
| `secure-business-architect` | `frontend-next` (tem `frontend` legado) | 2025-12-18 |
| `andorinha-digital` | `frontend-next` (tem `frontend` legado) | 2025-12-11 |
| `reforma-maestro` | `frontend-next` (tem `frontend` legado) | 2025-11-27 |
| `pulse-tronic-install-pro` | `Frontend` (maiúsculo) | 2025-11-08 |
| `pathfinder` | `frontend` | 2025-10-23 |
| `tape-vision-ai-92` | `Frontend` (maiúsculo) | 2025-08-30 |
| `cardioqwen3code` | `frontend` | 2025-08-23 |
| `cardio-risk-insight-hub` | `frontend` | 2025-08-22 |
| `synth-bot-buddy` | `frontend` | 2025-12-24 |

⚠️ **`frontend-next` vs `frontend`:** quatro repos têm os dois. O `-next` é a migração; o outro é o
legado. Confirmar olhando o `package.json` de cada um **antes** de linkar — errar aqui põe a versão
velha no ar, que é pior que ficar fora.

⚠️ **`synth-bot-buddy` provavelmente não é site.** Linguagem primária **Python**, com `k8s/`,
`nginx/`, `deploy/`, `monitoring/`. Tem `frontend/`, mas o projeto é um bot com backend — deploy na
Vercel pode não fazer sentido nenhum. **Verificar antes**, não empurrar pra Vercel por simetria.

---

## 3. Receita mecânica (Grupo A; C só muda o root directory)

CLI já instalada e autenticada (`vercel@50.35.0`, `vercel whoami` → `jeanzorzetti`).

```bash
cd <repo>
vercel link --yes --project <nome>     # cria o projeto no scope jean-zorzettis-projects
vercel --prod --yes                    # primeiro deploy de produção
```

Para o Grupo C, o root directory entra no link (ou pelo dashboard, em Settings → Build):

```bash
vercel link --yes --project <nome>
# Settings > Build & Deployment > Root Directory = frontend-next
vercel --prod --yes
```

**Fechar o loop no hub** — deploy sem isto não muda o ranking, porque a chave do projeto é a URL:

```bash
echo '{"homepage":"https://<url-de-producao>"}' | gh api repos/JeanZorzetti/<repo> -X PATCH --input -
```

⚠️ Copie a **Latest Production URL** do `vercel project ls`, **nunca** um alias de preview. Foi
exatamente assim que os 21 apodreceram: a `homepage` guardava um alias efêmero, o alias morreu, o
repo continuou apontando pra ele.

---

## 4. Decisão que vem antes do trabalho (1 minuto, evita 19 deploys)

Os 19 do §2 são protótipos parados há 2–12 meses. Pôr todos no ar cria 19 projetos Vercel pra manter,
e o hub já tem a **forma canônica de aposentar projeto**: arquivar o repo (foi o que se fez com o
`Atma` em 28/07 — repo arquivado some do hub e o histórico fica).

**Recomendação:** varrer a lista uma vez e separar em "quero isto de pé" vs "arquivar". Provavelmente
não são 19 — e cada arquivado sai do vermelho de graça, sem build, sem manutenção.

Isso **não** contradiz a régua de 28/07 ("todos os repos com `homepage` entram no ranking"): aquela
decisão é sobre **quem aparece**, esta é sobre **quem merece existir**. Se a resposta for "põe os 19
no ar", o §2 e o §3 já estão prontos pra isso — só executar.

---

## 5. Os 2 casos vizinhos (não são dos 21, não misture)

- **`vertice-ten`** → `X-Vercel-Error: NOT_FOUND`, não `DEPLOYMENT_NOT_FOUND`. O alias resolve pra um
  projeto que existe; a rota `/` é que não casa. **É config de rota, não deploy** — não entre pelo
  caminho do §3.
- **`compass`** → o A1. 404 na EasyPanel, DNS já chega no VPS certo. Segue em
  [`handoff-proximo-passo.md`](handoff-proximo-passo.md).

### ⚠️ Correção do A1 de ontem (28/07): `prolifemed` não é caso de EasyPanel

O handoff de ontem concluiu que os três sites do A1 precisavam de vhost na EasyPanel. Para
`prolifemed.com.br` **isso está errado** — a `vercel project ls` mostra:

```
prolife-next-js   https://prolife-next-js.vercel.app   (atualizado há 6 dias)
```

e essa URL responde **200**. O app está no ar **na Vercel**, sem domínio atribuído; o
`prolifemed.com.br` aponta pra um IP morto. O conserto é **atribuir o domínio ao projeto Vercel +
apontar o DNS pra lá**, não criar vhost.

🟡 **Confirmar com o Jean antes de mexer:** por [[prolife_supabase_vercel_env]], esse deploy na Vercel
é o **segundo ambiente** (Supabase, banco novo e **vazio**, sem os dados da prod da EasyPanel).
Apontar `prolifemed.com.br` pra ele **publica o ambiente vazio como se fosse produção**. A pergunta
é uma só: *o ambiente Vercel virou a produção, ou a produção EasyPanel precisa voltar?*
`seven-md.com.br` continua como estava — nenhum projeto Vercel corresponde a ele.

---

## Como reverificar tudo (roda em ~2 min)

```bash
# estado real de cada projeto do hub, com a causa e não só o status
gh repo list JeanZorzetti --limit 200 --json name,homepageUrl,isArchived \
  --jq '.[] | select(.isArchived==false) | select(.homepageUrl != "") | [.name,.homepageUrl] | @tsv' \
| while IFS=$'\t' read -r name url; do
    code=$(curl -sk -L -o /dev/null -w '%{http_code}' --max-time 15 "$url")
    err=$(curl -skI --max-time 12 "$url" | grep -i '^x-vercel-error' | tr -d '\r' | cut -d' ' -f2)
    echo -e "$code\t${err:--}\t$name\t$url"
  done | sort

vercel project ls        # a lista de quem REALMENTE existe — é a fonte da verdade
```

---

## Armadilhas (desta investigação)

- ⛔ **`vercel --prod` da pasta local NÃO funciona sob o OneDrive** (medido 29/07 no `sofia-next`):
  morre com `UNKNOWN: unknown error, read` — o CLI tenta ler um arquivo que o OneDrive não hidratou
  (`--archive=tgz` também). O `vercel link` conecta o repo do GitHub; **o deploy tem que vir do git**
  (push/redeploy), não do upload local. A receita do §3 só vale a parte do `link`.
- **Status 404 não classifica nada.** Os 23 sites fora do ar dão o mesmo 404 por **três** causas
  diferentes (projeto apagado, rota não casada, vhost ausente). Sem o header `x-vercel-error` você
  trata os três igual e conserta o errado.
- **`vercel project ls` é a fonte da verdade, não o browser.** Ela responde "existe ou não existe" em
  2 s; ficar abrindo URL só mostra sintoma.
- **A chave de um projeto no hub é a URL, nunca o repo.** Deploy feito e `homepage` velha = o hub
  segue mostrando ✕ FORA DO AR. Fechar entrega inclui o `gh api ... -X PATCH`.
- **`gh repo edit --homepage` não funciona no PowerShell** — usar a API (`gh api -X PATCH --input -`).
- **Alias de preview ≠ URL de produção.** É a causa-raiz dos 21. Sempre a Latest Production URL.
- **Repo com `frontend/` e `frontend-next/` juntos:** o `-next` é o vivo. Confirmar antes de linkar.
- ⚠️ **Janela de não-push: 00:00–01:00 BRT** (o cron do autopublishing roda 00:13).
