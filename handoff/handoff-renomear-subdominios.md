# Handoff — próximo passo: renomear subdomínios (criado 30/07/2026)

A 2ª leva fechou: **todo projeto vivo está em domínio próprio**
([`handoff-proximo-passo-leva-2.md`](handoff-proximo-passo-leva-2.md)). Os nomes saíram do nome do
repo, mecanicamente. **Agora é a passada de nomenclatura**: encurtar para nome de produto.

⚠️ Isto **não** substitui [`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md) —
domingo **02/08, 10:00 BRT**, 1º run do robô de crawl, segue valendo. Índice:
[`../handoff.md`](../handoff.md).

---

## 🚨 Leia isto antes de criar o primeiro registro

Renomear subdomínio **não é criar um novo** — é aposentar um que o Google já conhece. Os 15 hosts
foram submetidos ao GSC em 30/07. Se o host antigo simplesmente sumir, ele volta como **NXDOMAIN**, e
foi exatamente isso que consumiu **76% do crawl budget** do `roilabs.com.br`
([[roilabs_dns_cloudflare_retired_subdomains]]).

**Regra desta leva: host antigo não morre — vira 308 para o novo.** Mantenha o registro DNS antigo
vivo e configure o redirect na Vercel. Só depois de o Google reprocessar (semanas) é que se avalia
remover.

A CLI **não tem** flag de redirect (`vercel domains add --help` só expõe `--force`). Vai pela API,
que já foi conferida ao vivo e expõe os campos `redirect`/`redirectStatusCode`:

```python
# GET para conferir o estado atual:
#   https://api.vercel.com/v9/projects/{projectId}/domains?teamId={orgId}
# PATCH para transformar o host antigo em redirect:
PATCH https://api.vercel.com/v9/projects/{projectId}/domains/{host-antigo}?teamId={orgId}
{"redirect": "<host-novo>", "redirectStatusCode": 308}
```

- token: `%APPDATA%\com.vercel.cli\Data\auth.json` (campo `token`)
- `projectId`/`orgId`: `<pasta-linkada>/.vercel/project.json`

E **remova o sitemap antigo do GSC** depois que o novo for aceito — senão ficam dois sitemaps
apontando para URLs que se redirecionam.

---

## 📋 A lista

Zona `roilabs.com.br` = Cloudflare (`e55dc82f456e8af7ac764133b4442f19`). Zona `nimblabs.com` =
**Hostinger**. Ambos os tokens de 30/07 **devem estar rotacionados** a esta altura
([[secrets_to_rotate]]) — peça os novos antes de começar.

### ✅ Decididos pelo Jean

| host atual | host novo | zona | onde o código guarda a URL | como publica |
|---|---|---|---|---|
| `tape-vision-ai-92.roilabs.com.br` | **`tapevision`** | CF | `Frontend/index.html` + `Frontend/public/{sitemap.xml,robots.txt}` | manual, de `Frontend/` |
| `cardio-risk-insight-hub.roilabs.com.br` | **`cardiorisk`** | CF | `frontend/app/{layout.tsx,robots.ts,sitemap.ts}` | git push (Root Directory = `frontend`) |
| `vertex-landing-craft.roilabs.com.br` | **`verticemarketing`** | CF | **5 arquivos** — `app/layout.tsx`, `app/robots.ts`, `app/sitemap.ts`, `components/StructuredData.tsx`, `app/{contato,servicos}/page.tsx` | manual, da raiz |
| `matchfios-textile-connector.roilabs.com.br` | **`matchfios`** | CF | `index.html` + `public/{sitemap.xml,robots.txt}` | git push |
| `potencial-arquitetado.roilabs.com.br` | **`potencialarquitetado`** | CF | `index.html` + `public/{sitemap.xml,robots.txt}` | git push |
| `whatsmeow-gateway.roilabs.com.br` | **`whatsmeow`** | CF | `site/index.html` + `site/{sitemap.xml,robots.txt}` | manual, de `site/` |
| `claude-loop-runner.roilabs.com.br` | **`claudeloop`** | CF | `site/index.html` + `site/{sitemap.xml,robots.txt}` | manual, de `site/` |
| `sem-swarm.nimblabs.com` | **`swarm`** | **Hostinger** | `site/index.html` + `site/{sitemap.xml,robots.txt}` | manual, de `site/` (não publicou por push na 1ª leva) |

Em `vertex-landing-craft`, **grepe o host antigo no repo inteiro** antes de dar por fechado — foi lá
que apareceu o canonical cruzado apontando para outro produto. Um `grep -rn` que volta 0 é a prova.

### 🗑️ `synth-bot-buddy` — repo excluído, host ainda no ar

`gh api repos/JeanZorzetti/synth-bot-buddy` → **404**, mas `synth-bot-buddy.roilabs.com.br` **responde
200** (deploy órfão). Sai do hub sozinho (a lista vem do GitHub), mas o host não some sozinho.
Limpeza, nesta ordem:

1. **Remover o sitemap do GSC** — `https://synth-bot-buddy.roilabs.com.br/sitemap.xml` foi submetido
   em 30/07 e vai passar a apontar para nada.
2. Apagar o projeto na Vercel. 🚨 **NUNCA `yes | vercel project rm`** — apaga projetos **vizinhos**
   ([[vercel_project_rm_deletes_neighbors]]).
3. **Só então** apagar o registro A no Cloudflare. Invertido, sobra NXDOMAIN servido.

Mesmo tratamento merece `housingpro` (repo apagado, `www.housingpro.com.br` em 200, domínio pago
135 dias) — decisão pendente do handoff anterior.

---

## 🤔 Os dois que faltam nome — precisam de decisão do Jean

### `financeiro-obras.roilabs.com.br`

Produto: **"Planilha de Orçamento de Obras e Reformas em Excel"** (repo `reforma-maestro`, Next em
`frontend-next/`). O nome atual saiu do próprio código do repo, não de escolha.

| opção | a favor | contra |
|---|---|---|
| **`reformamaestro`** ⭐ | É o padrão exato dos outros 8 desta leva: nome do produto, sem hífen. Zero ambiguidade sobre qual repo é. | Não diz ao humano o que o produto faz. |
| `orcaobra` | Curto e diz o que vende. | Nome novo, não existe em lugar nenhum do código. |
| `orcamentodeobras` | Casa com a query principal ("planilha orçamento obras"). | Longo. **E subdomínio não rankeia por si** — se o objetivo é exact-match, o certo é domínio próprio, não subdomínio. |

**Recomendo `reformamaestro`** — consistência com o resto da leva vale mais que descrição, porque o
ganho de SEO por nome de subdomínio é ~zero.

### `cardioqwen3code.roilabs.com.br`

🚨 **A pergunta real não é o nome — é se este projeto e o `cardio-risk-insight-hub` são o mesmo
produto.** Os dois:

- compartilham o arquivo `api_medica_final.py`;
- servem análise de risco cardiovascular com IA;
- têm os títulos **trocados** entre si — `cardioqwen3code` serve `<title>Cardio Risk Insight Hub</title>`
  e `cardio-risk-insight-hub` serve `<title>Sistema IA Médica</title>`.

Dois subdomínios do mesmo domínio servindo conteúdo quase idêntico é **canibalização** — literalmente
o que o CannibalScan detecta ([[project_cannibalscan]]). Renomear sem resolver isso só troca a placa
de um problema que continua.

Caminhos:

1. **São o mesmo produto** → escolher o repo bom (`cardio-risk-insight-hub` é o mais completo: tem
   README, datasets, `dashboard_medico.py`) e tirar o outro do hub. Contraria "quero todos ativos",
   mas aqui não é arquivar projeto: é parar de publicar duas cópias.
2. **São produtos diferentes** → então os títulos precisam ser corrigidos primeiro, e aí o nome sai
   sozinho. Sugestão se ficarem separados: **`cardiocare`** (vem do README do irmão, "CardioCare AI").

`cardioqwen3code` como nome público é ruim de qualquer jeito — "qwen3" é o modelo e "code" não
significa nada para quem lê.

---

## ▶️ Receita por projeto (ordem que funcionou na 2ª leva)

1. **DNS**: criar o A **novo** no Cloudflare (`76.76.21.21`, `proxied: false`) — ou na Hostinger para
   o `swarm`, com `PUT {"overwrite": false, "zone": [...]}`, que preserva o resto da zona
   (verificado: 9 → 10 registros, nada perdido). **Baixe a zona antes assim mesmo.**
2. `vercel domains add <host-novo> <projeto>` — atenção, **2 projetos têm nome diferente do repo**:
   `aprovai`→`aprovai-locacao`, `aesthetic-perfection-page`→`lumina-demo`.
3. **Repontar o código** nos arquivos da tabela acima e pushar.
4. **Confirmar publicação pelo CORPO, nunca pelo status.** Numa SPA todo path devolve o `index.html`
   com 200 ([[spa_sitemap_200_is_not_proof]]):
   ```bash
   curl -s https://<host-novo>/sitemap.xml | head -c 5   # tem que ser <?xml
   ```
5. `gh api repos/JeanZorzetti/<repo> -X PATCH -f homepage=https://<host-novo>` — no mesmo ato.
6. `node --env-file=.env scripts/submit-sitemap.mjs https://<host-novo>/sitemap.xml`
7. **PATCH do host antigo para redirect 308** (bloco no topo) e remover o sitemap antigo do GSC.
8. Conferir que moveu em vez de duplicar: a contagem de hosts duplicados tem que seguir **zero**.

### ⛔ O que não fazer

- **Não apagar o registro DNS antigo** nesta leva — é o que gera NXDOMAIN. Ele vira 308.
- **Não confiar em `git push` para publicar** — só 5 dos 15 publicaram assim na 2ª leva.
- 🚨 **Depois de deploy manual, verifique de novo DEPOIS do push.** No `cardio-risk-insight-hub` o
  push desfez o deploy manual e derrubou o site para 404 — verificar antes do push é verificar o
  deploy errado ([[vercel_legacy_builds_needs_routes]]).
- **Não usar `www.<algo>.dominio`** — dois labels, Universal SSL do Cloudflare não cobre.
- ⚠️ **Janela de não-push: 00:00–01:00 BRT** (cron do autopublishing roda 00:13).
- ⚠️ **`vercel deploy --prod` não roda de dentro do OneDrive** — os repos de trabalho estão em
  `C:\dev` ([[vercel_deploy_fails_under_onedrive]]).
- Ao clonar repo que falte: **não** guarde por `[ -d .git ]`. Clone interrompido deixa `.git` cheio e
  `HEAD` em `refs/heads/.invalid`, e o git chama isso de *"branch appears to be broken"* — parece repo
  vazio ([[broken_clone_looks_like_empty_repo]]). Guarde por `git -C "$d" rev-parse HEAD`.

---

## 🔒 Não mexer nesta leva

Ficam como estão, não estão na lista do Jean: `housing-pro-api`, `aprovai`, `moderador`, `cyberspace`,
`lumina.estetiacrm.com.br`, e os 4 da 1ª leva (`links.roilabs.com.br`,
`seoforecaster.nimblabs.com`, `meridian.roilabs.com.br`, e o `sem-swarm` que **está** na lista).

`portfolio` segue em host de fornecedor por **decisão do Jean** — vai comprar domínio próprio para o
CV depois. Não é pendência.

---

## Contexto herdado

- A 2ª leva, as 5 correções e o estado atual: [`handoff-proximo-passo-leva-2.md`](handoff-proximo-passo-leva-2.md)
- A data de 02/08 e o robô de crawl: [`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)
- O custo do NXDOMAIN, em números: [`handoff-nxdomain-subdominios.md`](handoff-nxdomain-subdominios.md)
- Projetos vêm do GitHub, não de lista fixa: [`handoff-hub-github.md`](handoff-hub-github.md)
