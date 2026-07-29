# Handoff — próximo passo: o compass e os repos sem site

Criado em **2026-07-29**, depois da execução do [`handoff-21-projetos-no-ar.md`](handoff-21-projetos-no-ar.md).
Índice de todos os handoffs: [`../handoff.md`](../handoff.md).

**Estado do hub ao abrir esta frente:** 19 projetos no ar, **1 fora** (`compass`). A frente dos 21
está fechada. Sobraram duas perguntas, e **as duas já têm diagnóstico parcial medido aqui** — a
próxima sessão não precisa redescobrir, precisa executar.

---

## 1. Por que o `compass` está fora do ar?

**Resposta curta: o DNS está certo, o app não está publicado no EasyPanel com esse domínio.**

Medido em 29/07:

```
compass.polarisia.com.br  ->  2.24.207.200   (A record OK)
polarisia.com.br          ->  2.24.207.200   (MESMO IP, responde 200)

curl https://compass.polarisia.com.br/  ->  HTTP 404, <title>Not Found</title>, corpo do EasyPanel
```

**O que isso prova:**

- **Não é DNS.** O nome resolve e chega no VPS certo — o mesmo host que serve o Polaris em
  `polarisia.com.br` com 200. Não perca tempo no Cloudflare.
- **Não é a Vercel.** Sem header `x-vercel-error`; o 404 vem do proxy do **EasyPanel**, não da Vercel.
- **É o EasyPanel que não conhece esse domínio.** A requisição chega no servidor e o proxy não acha
  serviço nenhum casando com `compass.polarisia.com.br`, então devolve a página padrão de "Not Found".

**Causa provável (confirmar no painel):** o serviço do Compass está parado/removido, ou está de pé mas
**sem o domínio atribuído** em *Domains*. As duas dão exatamente este 404.

### O que fazer (é ops, não commit — precisa do painel do EasyPanel)

1. Abrir o EasyPanel do VPS `2.24.207.200` e procurar o serviço do Compass.
2. **Se o serviço existe:** conferir se está *running* e se `compass.polarisia.com.br` está listado em
   **Domains**. Faltando, adicionar (o Polaris no mesmo host é a referência de config que funciona).
3. **Se o serviço não existe:** foi removido. Precisa recriar a partir do repo — ver §"O que é o
   Compass" abaixo.
4. Fechar o loop: quando responder 200, **conferir a `homepage` do repo** (a chave do projeto no hub é
   a URL, não o repo). Hoje ela é `https://compass.polarisia.com.br/`, então se o domínio voltar não
   precisa de PATCH.

### O que é o Compass (contexto, pra não redescobrir)

Micro-SaaS de monitoramento de uso de IA para devs (daemon Go + Next 16/Prisma 7/Stripe). Código em
`Projeto_novo/`. Estava **100% completo e cobrável desde 2026-05-24**; o que falta é distribuição, não
feature. Doc viva em `Projeto_novo/BRAINSTORM.md`.

⚠️ Ele tem **segredos expostos a rotacionar** ([[secrets_to_rotate]]) — se for recriar o serviço, é a
hora de trocar em vez de recolar os mesmos valores.

---

## 2. Por que N repos estão "sem site"?

**Resposta curta: a maioria TEM site no ar. O campo `homepage` do GitHub é que está vazio.**

Isto é a mesma armadilha do `sirius` e do `sofia-ia` na sessão de 29/07, em escala: **a chave de um
projeto no hub é a URL**, e um repo sem `homepage` simplesmente não é um projeto pro hub — ele não
aparece como "fora do ar", ele **não aparece**.

Medição de 29/07: **31 repos não-arquivados com `homepage` vazia.** (Se o hub mostra 24, a diferença
provavelmente são os 5 privados — `nimblabs`, `mhedicos`, `financeiromedlly`, `medlly`,
`aesthetic-perfection-page` — mais repos que o hub filtra por outro critério. **Confirmar a régua
antes de agir**, ver [`handoff-hub-github.md`](handoff-hub-github.md).)

### A prova: 8 de 10 amostrados estão no ar agora

```
context-keeper       https://context.nimblabs.com            200
estetia              https://estetiacrm.com.br               200
estetia-demo         https://estetia.estetiacrm.com.br       200
review-dispute       https://reviewshield.nimblabs.com       200
nimblabs             https://nimblabs.com                    200
roilabs              https://roilabs.com.br                  200
tape                 https://tapepro.roilabs.com.br          200
roihub               https://hub.roilabs.com.br              401  <- no ar, ver gotcha
splitjud             https://splitjud.com.br                 NXDOMAIN (URL chutada, achar a certa)
aftercare-nimblabs   https://aftercaregen.com                NXDOMAIN (URL chutada, achar a certa)
```

⚠️ **`roihub` devolve 401 (basic auth) e o hub trata isso como "fora do ar"** — a checagem usa
`res.ok`. Se o próprio hub entrar na lista, ele vai se mostrar vermelho. Decidir se `401`/`403` contam
como no ar antes de preencher a `homepage` dele.

### Os 31 repos sem `homepage`

| repo | push | linguagem | |
|---|---|---|---|
| `estetia-demo` | 2026-07-29 | TypeScript | ✅ no ar |
| `context-keeper` | 2026-07-29 | MDX | ✅ no ar |
| `roihub` | 2026-07-29 | JavaScript | ⚠️ no ar, 401 |
| `tape` | 2026-07-29 | Astro | ✅ no ar |
| `perfil360` | 2026-07-28 | TypeScript | ? |
| `review-dispute` | 2026-07-28 | MDX | ✅ no ar |
| `roilabs` | 2026-07-27 | Astro | ✅ no ar |
| `meridian` | 2026-07-26 | TypeScript | ? (era local, `C:\dev\meridian`) |
| `estetia` | 2026-07-25 | TypeScript | ✅ no ar |
| `claude-loop-runner` | 2026-07-24 | JavaScript | ferramenta, provavelmente sem site |
| `cannibal-scan` | 2026-07-24 | — | ? |
| `splitjud` | 2026-07-15 | TypeScript | ? achar a URL |
| `housing-pro-api` | 2026-07-15 | TypeScript | API, provavelmente sem site |
| `nimblabs` (priv) | 2026-07-13 | TypeScript | ✅ no ar |
| `aftercare-nimblabs` | 2026-07-12 | MDX | ? achar a URL |
| `repo-de-teste` | 2026-07-09 | CSS | descartável |
| `sem-swarm` | 2026-07-07 | Python | lib, sem site |
| `loginsplit` | 2026-06-25 | TypeScript | ? |
| `obeflow` | 2026-06-24 | TypeScript | ? |
| `agattasemijoias` | 2026-06-24 | TypeScript | ? |
| `cannibal_scan` | 2026-06-20 | TypeScript | ? (duplicata do `cannibal-scan`?) |
| `mhedicos` (priv) | 2026-06-03 | TypeScript | ? |
| `seo-forecaster` | 2026-05-31 | Python | ferramenta, sem site |
| `whatsmeow-gateway` | 2026-04-11 | Go | gateway, sem site |
| `aprovai` | 2026-03-23 | TypeScript | ? |
| `financeiromedlly` (priv) | 2026-03-13 | TypeScript | ? |
| `medlly` (priv) | 2026-03-07 | TypeScript | ? |
| `moderador` | 2026-02-05 | JavaScript | ? |
| `aesthetic-perfection-page` (priv) | 2026-01-09 | TypeScript | ? |
| `jizreel` | 2025-08-24 | — | ? |
| `roi-labs-links` | 2025-06-17 | PHP | ? |

### O que fazer

**Passo 1 — separar em três baldes, não em dois.** Nem todo repo merece `homepage`:

- **tem site no ar** → `gh api repos/JeanZorzetti/<repo> -X PATCH` com a URL. Entra no hub. Custo zero.
- **não é site** (lib, CLI, API, gateway: `sem-swarm`, `claude-loop-runner`, `seo-forecaster`,
  `whatsmeow-gateway`, `housing-pro-api`) → **não preencher**. Repo sem site não deveria aparecer num
  ranking de sites.
- **morto** (`repo-de-teste`, duplicatas como `cannibal_scan` vs `cannibal-scan`) → **arquivar**
  (`gh repo archive`). É a forma canônica de aposentar, o histórico fica.

**Passo 2 — perguntar ao Jean antes de arquivar qualquer coisa.** Na sessão de 29/07 ele excluiu 9
repos por conta própria quando viu a lista. **Mande a lista, não decida sozinho.**

**Passo 3 — comando pra medir** (descobre quem já está no ar sem chutar URL):

```bash
gh repo list JeanZorzetti --limit 200 --json name,homepageUrl,isArchived \
  --jq '.[] | select(.isArchived==false) | select(.homepageUrl == "") | .name'
```

Pra achar a URL de quem está no ar, o caminho barato é ler o `README`/`vercel.json`/`.env` do repo ou
listar os domínios do EasyPanel — **não** chutar subdomínio, que foi o que falhou com `splitjud` e
`aftercare-nimblabs` acima.

---

## Armadilhas herdadas (leia antes de executar)

- 🚫 **Antes de concluir "fora do ar", procure o app em OUTRAS plataformas.** `vercel project ls`
  responde "não existe **na Vercel**", não "não existe". Em 29/07 o `sofia-ia` foi deployado por engano
  na Vercel — o Polaris já rodava em `polarisia.com.br` no **EasyPanel** com o mesmo repo, e o deploy
  criou um segundo ambiente de produção **contra o banco real**. Projeto deletado e revertido.
- 🚨 **NUNCA `yes | vercel project rm`.** O comando é interativo, não tem `--yes`, e o `yes` apaga
  **projetos vizinhos**. Em 29/07 levou `eg`, `eg-site` e `roi-zenith` junto.
- ⛔ **`vercel --prod` não funciona de pasta dentro do OneDrive** (`UNKNOWN: unknown error, read`).
  Clone fora do OneDrive (`$TEMP`, `C:\dev`) e deploye de lá.
- **`gh repo edit --homepage` não funciona no PowerShell** — usar `gh api -X PATCH --input -`.
- **`vercel project ls` pagina em 20** — projeto "sumido" pode estar na página 2.
- ⚠️ **Janela de não-push: 00:00–01:00 BRT** (o cron do autopublishing roda 00:13).
