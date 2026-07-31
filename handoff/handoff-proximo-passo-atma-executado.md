# Handoff executado — as 3 tarefas do Atma/Orion/Pathfinder (30/07/2026, 23h BRT)

Receita: [`handoff-proximo-passo-atma.md`](handoff-proximo-passo-atma.md). Índice geral:
[`../handoff.md`](../handoff.md).

**As tarefas 2 e 3 estão FECHADAS e verificadas no ar. Sobrou UMA coisa, e é justamente a que decide
o Atma: o pedido manual de reindexação, na UI do Search Console — o passo que não tem API.**

---

## ▶️ Tarefa 1 — Atma: só o empurrão secundário saiu (o principal é do Jean)

✅ **Feito às 22h55:** `node --env-file=.env scripts/submit-sitemap.mjs https://atma.roilabs.com.br/sitemap.xml`
→ `OK … → sc-domain:roilabs.com.br (siteFullUser)`.

🚨 **NÃO feito, porque nenhuma sessão de código consegue:** o "Solicitar indexação". A restrição do
handoff original se confirmou na prática — não há endpoint. **As 5 URLs na ordem de valor continuam
esperando o Jean**, e estão em [`handoff-proximo-passo-atma.md`](handoff-proximo-passo-atma.md#1a-manual-jean--o-passo-que-resolve).

A medição de `coverageState` em ~7 dias segue valendo como escrita lá — e vale para os três
projetos, não só para o Atma, porque agora os três dependem do Google voltar.

---

## ▶️ Tarefa 2 — Orion: o schema falso saiu inteiro (`orion-nova-ui@94a6bdb`, pushado)

Tudo estava em **um arquivo só**, `src/lib/schema.ts` — a suspeita de "layout compartilhado" do
handoff estava certa: `organizationSchema` é importado pelo `app/layout.tsx`, ou seja, o endereço e
os telefones falsos estavam nas **64 URLs**; o `aggregateRating` vinha do `softwareSchema`, só na
home.

Deletado (não substituído por número melhor):

| o que | onde |
|---|---|
| `aggregateRating` 4,8 / 1.250 avaliações | `schema.ts` (home) |
| `address` Av. Paulista, 1000 | `schema.ts` (64 URLs) |
| `contactPoint` `+55-11-1234-5678/5679` | `schema.ts` (64 URLs) |
| `sameAs` × 4 para `/orionnova` | `schema.ts` (64 URLs) |
| "+2.500 empresas usando" | `FeaturesGrid.tsx` |
| "+127% produtividade" | `HeroSection.tsx` |
| seção "O Que Nossos Clientes Dizem" (depoimentos assinados por pessoas inexistentes) | `produto/page.tsx` + `lib/social-proof-data.ts` (arquivo apagado) |
| métricas "1.000+ empresas / 50.000+ usuários / 4.9-5 avaliação média" | `sobre/page.tsx` |
| seção "Reconhecimentos" (prêmio, "500% em 12 meses", "NPS 78") | `sobre/page.tsx` |
| selos "ISO 27001" e "AWS Partner" | `TrustBadges.tsx` |

**Achado que não estava no briefing:** o `AggregateOffer` também era inventado — anunciava R$ 299 a
R$ 1.499 em **quatro** planos, e o `PLANS` de `src/lib/mercadopago.ts` tem **três**: R$ 99,90,
R$ 299,90 e R$ 999,90. Corrigido para os valores reais (não importei o `PLANS` para não arrastar o
SDK do Mercado Pago para o bundle da home; há comentário no arquivo avisando que os dois andam
juntos).

**Critério usado onde o handoff não decidia:** ficou o que a plataforma sustenta — "LGPD Compliant"
e o "SLA 99,9%" que o plano Enterprise de fato vende. Saíram as certificações de terceiro, que são
piores que review inflada: são falsas perante o próprio certificador.

✅ **Verificado no ar, não só commitado** (23h25, `curl` sem `-k`, lendo o corpo): a home, `/produto`
e `/sobre` servem **zero** ocorrência de `aggregateRating`, `Paulista`, `1234-5678`, `+2.500`,
`127%`, `Carlos Silva`, `Startup Awards`, `4.9/5` e `AWS Partner`. A prova de que o build é o novo,
e não um HTML que só não tinha aquilo: o `AggregateOffer` no ar traz `99.90`/`999.90`, os preços
corrigidos — o antigo trazia `1499`. `npx tsc --noEmit` limpo. **O deploy do orion sai no push**
(EasyPanel), levou ~10 min.

---

## ▶️ Tarefa 3 — Pathfinder: o sitemap deixou de depender do backend morto (`pathfinder@aee6e09`, pushado)

O host `pathback.roilabs.com.br` é NXDOMAIN — confirmado por `nslookup` e pelo 502 na sondagem.
O rewrite morto saiu do `frontend/vercel.json` e entrou `frontend/public/sitemap.xml`, **estático,
36 URLs**, gerado por `frontend/scripts/generate-sitemap.mjs` a partir dos dados que já vivem no
próprio frontend (`mbtiTypesData`, `blogArticles`). Na Vercel o arquivo estático ganha do catch-all
da SPA, então basta o deploy.

🚨 **O achado que muda a leitura da tarefa:** consertar o DNS do `pathback` **não** teria resolvido.
O sitemap do backend listava `/types/<slug>` e `/test` — rotas que **não existem** neste app; as
reais, no `App.tsx`, são `/mbti/<tipo>` e `/test/<mbti|bigfive|enneagram>`. Um proxy consertado
devolveria um sitemap de 404s. Por isso o gerador lê a tabela de rotas do próprio app.

**Soft-404 mitigado no mesmo commit:** a página `NotFound` injeta
`<meta name="robots" content="noindex, follow">`. Sem SSR é o que existe — o Googlebot renderiza JS.

🚨 **O push NÃO publicou — o projeto na Vercel não está ligado ao git.** `vercel ls pathfinder`
mostrava **uma única** deployment, de 2 dias atrás, depois do push. Mesma armadilha do CannibalScan
([[vercel_deploy_fails_under_onedrive]] é outra coisa; aqui é o repo simplesmente não estar
conectado). **Deploy = CLI de dentro de `frontend/`:**

```bash
cd C:\dev\pathfinder\frontend
npx vercel link --project pathfinder --yes   # clone novo não tem .vercel
npx vercel deploy --prod --yes               # `vercel --prod` sozinho só imprime o help
```

Conferido antes de deployar: `rootDirectory: null` e `framework: vite` no `project.json`, então
subir de dentro de `frontend/` serve a pasta certa — não é o caso do "Root Directory `/` + site em
subpasta" que derruba para 404.

✅ **Verificado no ar (23h30):** `/sitemap.xml` responde **200 com corpo `<?xml`** e **36 `<loc>`** —
validado pelo corpo, nunca pelo status ([[spa_sitemap_200_is_not_proof]]). `/`, `/mbti/intj` e
`/robots.txt` seguem em 200. **Sitemap submetido ao Search Console em seguida:**
`OK … → sc-domain:roilabs.com.br (siteFullUser)`.

Verificado antes: `npm run build` (21,8 s), `sitemap.xml` presente no `dist/`.
⚠️ **`npx tsc` NÃO é gate neste repo** — ele já tinha ~40 erros pré-existentes (`CameraCapture.tsx`,
`data/mbti-types/*.ts`) e o build é `vite build`, que só transpila. Não perca tempo achando que
quebrou agora.

---

## 🚨 O que sobrou — e o que NÃO afirmar

1. **MANUAL, Jean, e é o item mais caro do portfólio:** "Solicitar indexação" das 5 URLs do Atma no
   Search Console. **É a única coisa aberta desta frente.**
2. **O backend do pathfinder continua morto.** O rewrite `/api/*` ainda aponta para
   `pathback.roilabs.com.br`, que é NXDOMAIN. Consertar a **descoberta** não conserta o **produto** —
   é vitrine viva sobre backend morto, e essa parte segue de pé. Não escreva em lugar nenhum que "o
   pathfinder foi consertado": o que foi consertado é o Google conseguir achá-lo.
3. **Medir em ~7 dias pelo `coverageState`, não por tráfego** — vale para os três, e a tabela de
   leitura está na receita original.

## O que a sessão aprendeu (e não estava no briefing)

- **Push ≠ deploy, e isso não é uniforme no portfólio.** O `orion` publicou sozinho em ~10 min
  (EasyPanel); o `pathfinder` **não publicaria nunca** — a Vercel dele não escuta o git. Vale checar
  `vercel ls <projeto>` antes de dar uma entrega por fechada em qualquer repo que deploye na Vercel.
- **Dado falso raramente mora em um lugar só.** O briefing apontava `aggregateRating` + endereço +
  telefones; abrindo o arquivo, o `AggregateOffer` de preços também era inventado, e a superfície
  visível tinha mais quatro blocos (prêmios, NPS, certificações, depoimentos). O critério que
  resolve os casos não listados: **fica o que a plataforma consegue provar.**
- **Consertar o transporte não conserta o conteúdo.** O sitemap do `pathfinder` estava morto por
  DNS, mas mesmo vivo listaria rotas inexistentes. Vale perguntar, em qualquer conserto de sitemap:
  *as URLs aqui dentro existem no roteador do app?*

Cards de `orion` e `pathfinder` atualizados no `data/projects.json` (blockers 7→4 e 6→3).
