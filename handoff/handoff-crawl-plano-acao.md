# Plano de ação — crawl dos 10 projetos

**Criado: 2026-07-25.** Base: `data/insights.json` (janela até 22/07) + os exports de
`docs/Crawl-stats/` + **verificação ao vivo feita hoje** (DNS, robots.txt, sitemap inteiro de cada
site). Companheiro de `handoff-insights-automatico.md` — aquele faz o dado chegar; este diz o que
fazer com ele.

**Regra que este plano seguiu:** Crawl Stats é média de 90 dias, então problema já corrigido fica
vermelho por ~3 meses ([gsc_crawl_stats_stale_90d_window]). Nenhum item abaixo entrou por causa do
percentual: cada um foi **datado no CSV diário** e depois **confirmado ao vivo**. Onde o percentual
é fantasma da janela, está dito, e a ação é *não fazer nada*.

---

## O quadro

| projeto | OK% | req/dia | Discovery | veredito |
|---|---|---|---|---|
| roilabs | **33,6%** | 72 | 17,7% | 🔴 **76% do crawl vai para hosts que não existem — ao vivo, agora** |
| goiania | 74,8% | 39 | 43,1% | 🟡 301 histórico, cicatriza sozinho — 1 link a corrigir |
| estetiacrm | 82,1% | 62 | 14,9% | 🟡 404/301/302 externos + 65% do budget em JS/assets |
| sirius | 92,2% | 64 | 12,3% | 🟡 sitemap anuncia um 404 com priority 0.9 |
| polarisia | 95,1% | 39 | 13,4% | 🟢 crawl ok — o problema dele **não é crawl** |
| fabrica | 95,6% | 9 | 33,8% | 🟢 |
| nimblabs | 96,6% | 79 | 5,9% | 🟢 |
| reviewshield | 99,8% | 43 | 4,8% | 🟢 nada a fazer |
| aftercare | 98,2% | 29 | 7,6% | 🟢 nada a fazer |
| context | 91,4% | **3,0** | **0%** | 🔴 **Google desistiu**: 3 req/dia, zero descoberta, datas no futuro |

O limiar do motor é `OK < 85%` → `crawl-waste` (`ml/diagnostics.py:201`). Sair do vermelho = passar
de 85%, não de 100%.

---

## P0 — roilabs.com.br: 14 subdomínios NXDOMAIN

**É o maior problema do portfólio inteiro e o insights o subestima.**

Medido hoje, com `Resolve-DnsName` contra o 8.8.8.8 — os 19 hosts que o Googlebot visita na
propriedade de domínio:

| host | req (89d) | DNS hoje |
|---|---|---|
| `sirius.roilabs.com.br` | 1302 | ❌ NXDOMAIN |
| `goiania.roilabs.com.br` | 981 | ✅ |
| `sofiaia.roilabs.com.br` | 845 | ❌ NXDOMAIN |
| `atma.roilabs.com.br` | 757 | ❌ NXDOMAIN |
| `www.sirius.roilabs.com.br` | 698 | ❌ NXDOMAIN |
| `alibi.roilabs.com.br` | 482 | ❌ NXDOMAIN |
| `atmaadmin.roilabs.com.br` | 337 | ❌ NXDOMAIN |
| `roilabs.com.br` | 299 | ✅ |
| `pathfinder` · `jbadvocacia` · `orion` · `clerk.atma` · `vertice` · `atmaapi` · `andorinha` · `www.goiania` | 587 | ❌ NXDOMAIN |
| `www.roilabs` · `tapepro` · `app` | 220 | ✅ |

**4.908 dos 6.408 requests (76,6%) vão para hosts que hoje não resolvem.** O export acusa 53,5% de
DNS error porque parte da janela ainda tem os dias em que esses hosts respondiam — ou seja, **o
número vai PIORAR sozinho até ~76%** conforme a janela rola. É o oposto do caso "fantasma": aqui o
percentual está *atrasado em relação ao estrago*, não à frente.

Datando no CSV diário: **08/06 a 27/06 = 20 dias de blackout total** (1.026 requests, 0 byte e 0 ms
todo dia, inclusive no apex). Em 28/06 volta com pico de 367 requests — mas só para os 5 hosts que
existem hoje. Parece troca/limpeza de zona DNS em 08/06 com restauração parcial em 28/06.

### Ação

1. **Decidir host a host: aposentado ou quebrado?** `sofiaia` virou `polarisia.com.br` e `sirius`
   virou `siriuscrm.com.br` — esses são aposentadoria. Já `atma`/`atmaadmin`/`atmaapi` (1.131
   requests somados) precisam de resposta do Jean: o Atma saiu do ar de propósito?
2. **Aposentado ≠ apagar o DNS.** NXDOMAIN não converge: o Googlebot tenta para sempre e a
   autoridade do host evapora. `301` converge — a URL sai do índice em favor do destino e passa
   sinal. Como todos os hosts vivos apontam para `2.24.207.200`, a versão preguiçosa é **um A record
   por host aposentado** (ou um wildcard `*.roilabs.com.br`) + um vhost catch-all no EasyPanel que
   301 para o destino certo, com regra explícita para os dois que valem sinal:
   `sirius.* → siriuscrm.com.br`, `sofiaia.* → polarisia.com.br`.
3. **Só depois** vale reavaliar `app.roilabs.com.br` (49 req): é painel, não deveria estar no índice
   — `Disallow` no robots resolve.

**Impacto:** 33,6% → ~90% de OK ao longo de 90 dias, e o crawl útil do apex sai de ~17 req/dia para
~70. É o único item do plano que muda a ordem do ranking do hub.

---

## P0 — context.nimblabs.com: 14 posts datados no futuro

3,0 requests/dia, **100% Refresh, 0% Discovery** em 46 dias. O Google não está descobrindo nada —
e o sitemap explica por quê:

```
2026-08-08  /blog/context-injection-patterns-ai-agents
2026-08-07  /blog/mcp-ecosystem-2026
...          (14 posts, todos com lastmod ATÉ 14 dias no futuro)
2026-07-25  /  e  /blog
```

Os 14 posts estão **no ar e retornando 200** (varri as 63 URLs do sitemap: zero quebrada), mas com
`lastmod` no futuro. Sitemap com data futura é sinal de baixa confiança — o Google despriorizou o
host inteiro, e é coerente com 3 req/dia e 8,6% de 404.

**Ação:** truncar `lastmod` em `min(data, hoje)` na geração do sitemap. Se as datas futuras são fila
de publicação agendada, o conteúdo não devia estar servindo 200 antes da data — escolher um dos
dois: publicar de fato (data = hoje) ou responder 404 até a data chegar. É o único site do portfólio
com esse problema (conferi os 10).

---

## P1 — sirius: o sitemap anuncia uma página que não existe

`app/sitemap.ts:61` publica `/fundadores` com **priority 0.9**, `i18n/routing.ts:30` declara a rota,
e não existe diretório `app/[locale]/(marketing)/fundadores/`. Ao vivo:
`https://siriuscrm.com.br/fundadores` → **404**.

Varri as 115 URLs do sitemap do sirius: **essa é a única quebrada**. Ou seja, os 3,5% de 404 do
export são majoritariamente externos/históricos, mas esta é auto-infligida e vem com prioridade
máxima.

**Ação:** decidir — construir a página (existe `scripts/add-founders-translations.js`, então ela foi
planejada) ou tirar as duas linhas de `sitemap.ts` e `routing.ts`. Enquanto não houver página,
remover do sitemap é o certo.

---

## P1 — estetiacrm: 65% do crawl budget em JavaScript e "outros"

| tipo de arquivo | ratio |
|---|---|
| Other file type | 41,6% |
| JavaScript | 23,5% |
| **HTML** | **16,9%** |
| Image | 5,6% |

Comparação com um site saudável do mesmo perfil (goiania, Astro): HTML 32%, JS 13,5%. O Next.js está
fazendo o Googlebot baixar chunk a cada crawl — 85,1% do budget é Refresh, então ele revisita os
mesmos assets.

As 100 URLs do sitemap estão **todas 200** (varridas hoje), então os 6,9% de 404 + 5,4% de 301 +
2,9% de 302 são histórico e link externo, não auto-infligidos.

**Ação (nesta ordem, para o site sair dos 82,1% e passar de 85%):**
1. `Disallow: /_next/static/chunks/` no robots.txt — os chunks têm hash no nome, o Google não precisa
   deles para renderizar o que importa e cada deploy gera um conjunto novo. Sozinho tira a maior
   fatia dos 41,6% de "outros".
2. Pegar a lista real de 404 no GSC → *Páginas* → *Não encontrada (404)* e mandar 301 os que tiverem
   destino óbvio. Não dá para automatizar: crawl stats não expõe URL, só percentual.

---

## P2 — goiania: não fazer nada de código (quase)

24,1% de 301, e a janela do export é **28/06–22/07** — ou seja, é redirect acontecendo *agora*, não
fantasma. Mas a origem não é o site:

- sitemap: 99 URLs, **todas com barra final**, todas 200 ✅
- links internos no HTML renderizado: nenhum sem barra ✅
- índice de busca (`busca-index.json.ts`): todas as 11 entradas com barra ✅
- **única exceção:** `src/pages/orcamento.astro:84` → `href="/carrinho"` (sem barra)

O resto é o Googlebot re-pedindo URLs sem barra que aprendeu **antes** do `absolute_redirect off`
([astro_nginx_trailing_slash_301]). Confirmado ao vivo: `http://` já 301 para `https://` corretamente
e `/porcelanato` → `/porcelanato/` com destino https. Era 46% do crawl, hoje é 24% — está cicatrizando.

**Ação:** corrigir a linha do `/carrinho` e **esperar**. Qualquer trabalho além disso é gastar tempo
para acelerar algo que o próprio decaimento resolve. Um bônus barato: o sitemap do goiania não emite
`lastmod` nenhum — adicionar ajuda o Google a agendar o recrawl das páginas novas.

---

## P2 — robots.txt intermitente (polarisia, sirius, estetiacrm)

`robots.txt not available` em 1,22% / 1,16% / 1,07%, e `Page could not be reached` 1,54% no
polarisia. Testados ao vivo agora: **os 10 hosts devolvem robots.txt 200** em 0,5–1,1s. Não é bug de
código — é a janela de restart do container no EasyPanel durante deploy. Quando o Google pega o
robots.txt fora do ar, ele **para de rastrear o host** até reconseguir.

**Ação:** 1% não paga refatoração de deploy. Vale só se virar tendência — o robô semanal já mede
isso toda semana. Deixar registrado e seguir.

**Sobre o polarisia:** ele é o único `declining` do painel, mas o crawl dele está em 95,1% OK. O
problema é impressões (-19,6%/sem em 4 semanas) com posição média piorando 8,5→10,2. **Não é um
problema de crawl e não se resolve nesta frente** — fica para o F3/F4 do `handoff-ml.md`.

---

## Ordem de execução

| # | ação | onde | esforço | ganho | status |
|---|---|---|---|---|---|
| 1 | decidir destino dos 14 subdomínios + A record + 301 | Cloudflare | ~20 min | **+43 pp de OK no roilabs** | ✅ **aplicado 29/07** via `scripts/cloudflare-redirects.mjs` — 12/14 em 301 (https), `www.sirius`/`www.goiania` só em http |
| 2 | truncar `lastmod` futuro | context-keeper (sitemap) | 15 min | destrava o crawl de um site parado | ✅ `f2a13db` |
| 3 | `/fundadores`: página ou fora do sitemap | `crm-project` | 10 min | tira o 404 priority 0.9 | ✅ `94ade14` |
| 4 | `Disallow: /_next/static/chunks/` | estetiacrm (`Doc-CRM/`) | 10 min | libera ~40% do budget | ✅ `54b06bc` |
| 5 | `href="/carrinho"` → `/carrinho/` | site-goiania | 2 min | 1 redirect a menos | ✅ `e6bb47c` |
| 6 | 404s reais do GSC → 301 | estetiacrm, sirius | 1h manual | fecha o resto | ⛔ manual no GSC |

**Executado em 25/07 — 2 a 5, todos em `main`.** O que mudou em relação ao previsto:

- **#2 não ficou no sitemap.** As datas vazam para quatro consumidores (sitemap, JSON-LD `Article`,
  OG meta e o cabeçalho do artigo), então o clamp foi para `lib/content.ts`, na leitura do
  frontmatter — clampar só o sitemap deixaria três sinais de data futura no ar. Não existe fila de
  publicação agendada no repo (só um flag `draft`), então as datas estavam simplesmente erradas:
  clampar é o fix, não gatear o conteúdo. 4 testes em `tests/content-clamp-dates.test.ts`, verdes.
- **#3 saiu do sitemap e do `routing.ts`.** Nada linka para a rota (`grep` em todo o `app/`), então
  a remoção é inerte. O fork do estetiacrm não herdou a rota fantasma — conferido.
- **#5 eram 6 ocorrências, não 1.** Além da âncora da `orcamento.astro:84`, os tokens
  compartilháveis (`/carrinho?c=<token>` em `carrinho.astro` ×3, `favoritos.astro`, `orcamento.astro`)
  tinham o mesmo defeito, e esses são piores: vão colados no WhatsApp e cobram o hop do visitante,
  não só do Googlebot.

**O item 1 destravou no mesmo dia.** Jean confirmou que o Atma não existe mais, então os 14 hosts
são todos aposentadoria — nenhum precisa voltar ao ar. E o DNS de `roilabs.com.br` está no
**Cloudflare**, não no EasyPanel: dá para fazer tudo com 14 A records + 4 Redirect Rules na borda,
sem vhost catch-all e sem risco para goiania/tapepro/app. Estimativa caiu de 1–2h para ~20 min.

Receita com os hostnames exatos, as expressões prontas e o porquê de 301 em vez de 410:
`ROI Labs/Docs/Obsidian/80-dev/roilabs-subdominios-aposentados.md`. Só falta o Jean executar no
painel do Cloudflare — não tenho acesso.

Também saiu junto o P0 #3: `app.roilabs.com.br` ganhou `robots.ts` com `Disallow: /` (é painel).

---

## O que ficou de fora, e por quê

- **Não propus tocar em aftercare, reviewshield, nimblabs e fabrica.** 96–99,8% de OK. O crawl deles
  está resolvido; o gargalo é conteúdo e link, não rastreamento.
- **Não propus script novo.** A varredura de sitemap que achou o `/fundadores` foi ad-hoc com `curl`
  e levou 9 minutos para 7 sites. Vira script quando achar o segundo bug — um achado não paga
  manutenção de ferramenta.
- **Não dá para listar as URLs que dão 404.** Crawl Stats só expõe percentual por tipo de resposta;
  a lista está no relatório *Páginas* do GSC, que não tem API. Os itens que dependem disso (#6) são
  manuais por limitação da fonte, não por preguiça.
