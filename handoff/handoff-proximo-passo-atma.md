# Handoff — próximo passo: reindexar o Atma (criado 30/07/2026, 22h BRT)

**O próximo passo é UM projeto: o Atma.** Ele está fora do índice do Google e perdeu 98% das
impressões. É, de longe, o item mais caro do portfólio.

Contexto completo da medição: [`handoff-curar-os-15-executado.md`](handoff-curar-os-15-executado.md).
Índice geral: [`../handoff.md`](../handoff.md).

⚠️ Isto **não** substitui [`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md) —
domingo **02/08, 10:00 BRT**, 1º run do robô de crawl, segue valendo e não depende de sessão.

---

## O estado, em 4 linhas

- 28d: **43 cliques / 316 impressões**. 28d anteriores: **298 / 14.818**.
- Queda datada: **09/06 fechou com 1.675 imp/dia, 10/06 com 380.**
- Home, `/pacientes/precos` e o blog: `Crawled - currently not indexed`, **último crawl 04–06/06**.
- **Não foi deploy** — zero commits no repo entre 20/05 e 30/07.

---

## 🚨 A restrição que decide o plano

**Não existe "Solicitar indexação" na API.** A `urlInspection/index:inspect` é **somente leitura**, e
a Indexing API do Google só aceita `JobPosting` e `BroadcastEvent` — não serve para páginas comuns.

Ou seja: **o passo principal é MANUAL, do Jean, na UI do Search Console.** Nenhuma sessão de código
substitui isso. O que dá para automatizar é só o empurrão secundário (resubmeter o sitemap).

---

## ▶️ Tarefa 1 — Atma (a única que importa hoje)

### 1a. MANUAL (Jean) — o passo que resolve

Search Console → propriedade `sc-domain:roilabs.com.br` → **Inspeção de URL** → colar a URL →
**Solicitar indexação**. Nesta ordem, que é por ordem de valor:

1. `https://atma.roilabs.com.br/blog/quanto-custa-alinhador-invisivel` ← **fazia 85% do tráfego**
2. `https://atma.roilabs.com.br/`
3. `https://atma.roilabs.com.br/pacientes/precos`
4. `https://atma.roilabs.com.br/blog/invisalign-vs-alinhadores-nacionais`
5. `https://atma.roilabs.com.br/blog/alinhadores-vs-aparelho-fixo`

A cota é de ~10–20 URLs/dia por propriedade. Cinco cabem folgado.

### 1b. Programático (sessão) — o empurrão secundário

```bash
cd roihub
node scripts/submit-sitemap.mjs https://atma.roilabs.com.br/sitemap.xml
```

O script já resolve a propriedade sozinho (`sc-domain:roilabs.com.br`) e usa escopo de escrita.
O sitemap serve **36 URLs** e é XML válido — conferido em 30/07.

### 1c. Como medir se funcionou (não confie no tráfego)

Tráfego demora semanas. O sinal que vira primeiro é o `coverageState`. Reexecutar a inspeção
**em ~7 dias**:

```
POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect
body: { "inspectionUrl": "<url>", "siteUrl": "sc-domain:roilabs.com.br" }
→ inspectionResult.indexStatusResult.{ coverageState, lastCrawlTime }
```

| o que você vê | leitura |
|---|---|
| `lastCrawlTime` **saiu de 04–06/06** | ✅ o Google voltou — o resto é tempo |
| `Submitted and indexed` | ✅✅ resolvido |
| segue `Crawled - currently not indexed` com crawl novo | 🚨 aí sim vira problema de **qualidade/conteúdo** — e é outra investigação |
| `lastCrawlTime` **não mudou** | o pedido não pegou; repetir |

⚠️ **Não medir por `Crawl requests` do relatório de crawl stats** — janela de 90 dias
([[gsc_crawl_stats_stale_90d_window]]), vai mentir por ~3 meses.

---

## ▶️ Tarefa 2 — Orion: arrancar as avaliações falsas

**Por que é 2º e não 5º:** o risco é do **domínio**, não do projeto. `orion.roilabs.com.br` publica
`schema.org` com `aggregateRating` de **4,8 sobre 1.250 avaliações que não existem** — review
fabricada é violação explícita de spam policy do Google, punível com ação manual, e está no mesmo
domínio do institucional, do goiania e do orcaobra.

Junto disso, tudo no mesmo bloco de schema: endereço falso (*Av. Paulista, 1000*), telefones
placeholder (`+55-11-1234-5678` / `5679`) e `sameAs` para perfis `/orionnova` inexistentes
(contraria [[roilabs_canonical_social_profiles]]). Na página visível: `+2.500 empresas usando`,
`+127% produtividade` e logos de clientes fictícios.

- Repo: **`orion-nova-ui`** — ⚠️ **não tem clone local**, precisa `git clone` antes.
- São **64 URLs no sitemap** — conferir se o bloco de schema é um layout compartilhado (provável) ou
  está repetido por página.
- Mínimo aceitável: **apagar** `aggregateRating`, endereço, telefones e `sameAs`. Não substituir por
  números "melhores" — o certo é não declarar o que não se pode provar.

---

## ▶️ Tarefa 3 — Pathfinder: consertar o proxy do sitemap

`robots.txt` está no ar e aponta `Sitemap: https://pathfinder.roilabs.com.br/sitemap.xml`, com o
comentário honesto *"served via frontend proxy"* — e esse proxy está morto:

```
GET /sitemap.xml → 502
An error occurred with this application.
DNS_HOSTNAME_NOT_FOUND
```

Resultado: **`URL is unknown to Google` depois de nove meses no ar.** O Google nunca descobriu o site.

- Repo: **`pathfinder`** — ⚠️ **não tem clone local**.
- O host morto está na **config de rewrite/proxy** (provável `vercel.json`), não no código — por isso
  o grep de host NXDOMAIN nos repositórios não pegaria.
- Bônus medido no mesmo host: `/rota-que-nao-existe` devolve **200** (soft-404 de SPA).
- Depois de consertar: `node scripts/submit-sitemap.mjs https://pathfinder.roilabs.com.br/sitemap.xml`.

---

## ⛔ O que não fazer

- **Não medir "está no ar" por status 200.** Foi exatamente assim que o Atma sumiu sem ninguém ver
  ([[site_200_is_not_indexed_url_inspection]]).
- **Não tentar "Solicitar indexação" pela API** — não existe. Perde-se a sessão inteira nisso.
- **Não mexer nos pesos do `lib/score.mjs`** sem o Jean. Existe um defeito conhecido (o critério
  `seo` premia crescimento, então quem desaba tira nota **baixa** — o Atma tirou 0,7 justamente por
  ter colapsado, e compensei à mão com `decay 10`). É decisão dele, não da sessão.
- **Não relitigar arquivamento** — zero arquivamentos, decisão tomada e reafirmada.
- ⚠️ **Janela de não-push: 00:00–01:00 BRT** (cron do autopublishing às 00:13). Usar a hora local da
  máquina: `TZ=America/Sao_Paulo` no Git Bash devolve UTC e engana.
- **Fechar entrega = atualizar o card no `data/projects.json` + push.** Card que descreve trabalho já
  feito é como o hub apodrece.
