# Handoff — `fabrica` + a leva de itens de agente (31/07/2026, 12h BRT)

Executa: [`handoff-proximo-passo-pos-sirius.md`](handoff-proximo-passo-pos-sirius.md), seção
🤖 **O AGENTE FAZ SOZINHO** (itens 1 a 5). Índice: [`../handoff.md`](../handoff.md).

Tudo abaixo foi conferido **em produção** (`curl` sem `-k`, URL Inspection API, GSC Sitemaps API,
API da Vercel). Nada saiu de card.

---

## 🚨 O achado da sessão: a tarefa nº 1 não existia

O handoff mandava destravar o sitemap do `fabrica` porque **"21 artigos escritos que o Google não
vê"**. Rodei a URL Inspection nas **26 URLs do sitemap** antes de mexer em qualquer coisa:

| Estado | Qtd |
|---|---|
| `Submitted and indexed` | **24** |
| `URL is unknown to Google` | 2 — `/termos` e `/blog/como-atrair-pacientes-clinica-de-estetica` |

**20 dos 21 artigos já estão indexados.** Alguns desde 13/07, o mais recente recrawleado em 29/07.
O `errors: 1` do sitemap é **real e persiste** — mas **não é o que estava bloqueando indexação**,
porque não havia bloqueio nenhum. A premissa custou zero desta vez porque foi validada antes; se eu
tivesse "resubmetido e pedido reindexação" cegamente, o relatório teria creditado ao resubmit uma
indexação que já existia há três semanas ([[roihub_agenda_task_premises_unverified]]).

**Consequência de ranking:** o `fabrica` sai da fila de SEO técnico. O gargalo dele é **tráfego e
conversão**, não descoberta. Card reescrito.

### O que sobrou de verdade no `fabrica`

- **Sitemap resubmetido** (31/07 11:50) nas **duas** propriedades — `sc-domain:estetia.estetiacrm.com.br`
  e `sc-domain:estetiacrm.com.br`. Voltou `isPending: true`; **reconferir em ~48h** se o `errors: 1`
  cai e se o campo `contents` finalmente aparece.
  ⚠️ Gotcha do `scripts/submit-sitemap.mjs`: `propertyOf()` resolve
  `estetia.estetiacrm.com.br` → `sc-domain:estetiacrm.com.br` (o domínio registrável), ou seja
  **manda para a propriedade-pai**. Funciona (domain property cobre subdomínio), mas a propriedade
  específica precisa do PUT à mão. Foi feito nas duas.
- **Suspeita do `errors: 1`, NÃO confirmada:** o `<image:image>` que o Next.js emite **entre
  `<loc>` e `<lastmod>`**, fora da sequência do XSD de sitemaps.org (`loc, lastmod, changefreq,
  priority`). O sitemap irmão que funciona (`estetiacrm.com.br`, 99 URLs, `errors: 0`) **não tem
  bloco de imagem nenhum**. Não mexi em `src/app/sitemap.ts`: a indexação está funcionando, o
  detalhe do erro só existe na UI do GSC, e o risco de regressão é maior que o ganho.
- **2 Request Indexing manuais** (Jean, UI do GSC) — as duas URLs acima. Ambas respondem 200 e são
  linkadas internamente; é só fila de crawl.

---

## ✅ Entregue e verificado no ar

| # | Projeto | O que era | O que é agora |
|---|---|---|---|
| 2 | **orcaobra** | `og:image` = `lovable.dev/opengraph-image-p98pqg.png` | card próprio 1200×630 em `/og.png` (200, `image/png`), `og:` + `twitter:` |
| 3 | **potencialarquitetado** | `og:image`/`twitter:image`/`twitter:url` → `arquiteturadopotencial.com` (**NXDOMAIN**) | `/og-image.png` no domínio próprio (200) + `og:image:width/height/alt` |
| 4 | **cardiorisk** | H1 `Sistema IA Médica` ≠ `<title>` | H1 = `CardioCare AI — Análise de Risco Cardiovascular` |
| 5 | **vertice** | `/sitemap.xml` **e** `/robots.txt` em 404 | ambos 200; sitemap submetido em `sc-domain:roilabs.com.br` |
| 5 | **compass** | `/sitemap.xml` **e** `/robots.txt` em 404 | ambos 200; sitemap submetido em `sc-domain:polarisia.com.br` |

Brinde de uma palavra em dois deles: `<html lang="en">` → `pt-BR` no `orcaobra` e no
`potencialarquitetado` (os dois são 100% em português).

> O card do item 5 só citava o `sitemap.xml`. **O `robots.txt` também estava 404 nos dois** — sem
> ele o Google não tinha nem como descobrir o sitemap. Os dois arquivos foram criados juntos.

Os OG cards foram renderizados com Chrome headless a partir de um HTML montado com os tokens de
marca de cada projeto (`--primary`/`--accent` do `globals.css`), não com asset de estoque.

---

## 🚨 O segundo achado: 3 projetos publicavam quebrado desde sempre

Os 5 pushes dispararam build automático. **Três morreram em 5–9 s**, todos com a mesma assinatura:

```
npm error enoent Could not read package.json: ENOENT ... open '/vercel/path0/package.json'
```

Causa: **Root Directory da Vercel em `/` com o app numa subpasta**
([[vercel_root_dir_slash_push_kills_subfolder_site]]). A produção não caiu — a Vercel segura o
último deploy bom — mas **nenhum push publicava**, e isso explica o blocker antigo do `orcaobra`
("build de git dá ERROR em todo commit") e o "sem push desde 03/03" do `vertice`.

Corrigido via API da Vercel (`PATCH /v9/projects/{id}`, campo `rootDirectory`):

| Projeto | antes | depois | resultado |
|---|---|---|---|
| **reforma-maestro** (orcaobra) | `null` | `frontend-next` | ✅ build por git **voltou a funcionar** |
| **vertice** | `null` | `app` | ✅ build por git **voltou a funcionar** |
| **compass** | `null` | `web` → **revertido para `null`** | ❌ ver abaixo |

### ⚠️ O `compass` continua sem build por git — e agora sabemos por quê

Com `rootDirectory: "web"` ele **compila** (o log lista `○ /robots.txt` e `○ /sitemap.xml`
gerados, "Build Completed in /vercel/output [46s]") e depois **quebra ao publicar**:

```
ENOENT: no such file or directory, lstat '/vercel/path0/.next/routes-manifest-deterministic.json'
```

Reproduzido 2×, inclusive com cache desligado. Next 16.2.6. E setar `rootDirectory` ainda tem um
efeito colateral: **o link `.vercel/` do compass mora DENTRO de `web/`**, então o CLI passa a
procurar `web/web` e o `vercel --prod` para de funcionar também. Por isso voltei para `null`.

**Como publicar o compass hoje:** `npx vercel --prod` de dentro de `C:\dev\compass\web` — foi assim
que o sitemap subiu. Confirma o que já estava na memória ([[project_compass_prod_setup]]).

---

## ▶️ PRÓXIMO PASSO

**🤖 Agente:** item 6 da lista — **`polarisia`, spec 012 T001–T017** (home V4). É a única tarefa de
sessão longa que sobrou e não depende de credencial do Jean. A leva de uma linha acabou.
Antes disso, dois minutos: **reconferir o `errors: 1` do sitemap do `fabrica`** (passaram ~48h?
`GET /webmasters/v3/sites/sc-domain:estetia.estetiacrm.com.br/sitemaps`).

**🙋 Jean, 5 minutos, inalterado:** **Bing Webmaster Tools no `goiania`** — maior score acionável
(44) e mata o IndexNow 403 que reaparece a cada build. Depois, dois Request Indexing na UI do GSC
para as 2 URLs do `fabrica`.

---

## Lições que valem além desta sessão

- **A URL Inspection é o único juiz de indexação, e ela também derruba tarefa** — não serve só para
  confirmar problema, serve para provar que não há problema
  ([[site_200_is_not_indexed_url_inspection]]). Duas premissas de card caíram em dois dias.
- **`errors: 1` num sitemap ≠ sitemap bloqueando indexação.** Só a inspeção URL a URL separa as duas
  coisas. O campo `contents` ausente no retorno da API é o sinal de que o Google não processou o
  arquivo — mas ele ainda pode ter descoberto as URLs por link interno.
- **Push verde não é deploy verde.** Depois de qualquer push, `vercel ls <projeto> --prod` e olhar o
  `Status`; um `● Error` de 5–9 s é quase sempre Root Directory, não código
  ([[vercel_project_not_linked_to_git]]).
- **Root Directory e o link `.vercel/` têm que concordar.** Se o `.vercel/` está dentro da subpasta,
  `rootDirectory` tem que ser `null`; se está na raiz do repo, tem que apontar para a subpasta.
  Misturar quebra um dos dois caminhos de deploy.
