# Handoff — próximo passo: aba `/resumo`, um resumo executivo por projeto (31/07/2026, 12h30 BRT)

Estado anterior: [`handoff-fabrica-e-leva-de-um-linha-31-07.md`](handoff-fabrica-e-leva-de-um-linha-31-07.md)
(leva de agente executada; `fabrica` saiu da fila de SEO técnico). Índice: [`../handoff.md`](../handoff.md).

**Tarefa:** página nova no ROI Hub com um **resumo executivo de cada um dos 35 projetos**.

---

## Por que esta página, e o que ela NÃO é

O hub hoje responde **"o que eu faço hoje?"** — cinco abas de operação (Ranking, SEO, Infra,
Insights, Agenda), todas orientadas à próxima ação. Nenhuma responde **"o que eu tenho?"**.

O sintoma disso apareceu duas vezes esta semana: eu confundi `vertice` com `vertex-landing-craft`
(dois repos, dois sites, produtos diferentes), e o card do `fabrica` afirmava por seis semanas que
21 artigos não estavam indexados quando 20 estavam. Ambos são falhas de **não existir um lugar que
diga, em três linhas, o que cada coisa é**. Os campos que temos (`acao`, `blockersLista`,
`receitaNota`) descrevem a próxima tarefa, não o produto.

**Não é** uma tabela repaginada dos campos que já existem. Se o resumo do `sirius` for
"CRM, 3 vendas orgânicas, branded resolvido", isso já está no card e a página não precisa existir
([[feedback_no_lazy_features]]).

---

## Decisões já tomadas — não reabrir

| # | Decisão | Porquê |
|---|---|---|
| 1 | **Aba nova `/resumo`**, sexto item do `Tabs` | mesmo chrome das outras cinco; nada de página solta |
| 2 | Conteúdo em **`data/resumos.json`**, chaveado por `slug` | `data/projects.json` é lido por 5 páginas + pelo autopublishing; enfiar 35 blocos de prosa nele engorda o hot path e polui todo diff de card |
| 3 | Os **35 de `data/projects.json`**, nessa ordem de curadoria | "35" é exatamente a curadoria; a lista mergeada com o GitHub tem 36+ e oscila. Projeto sem resumo aparece com o estado vazio explícito, não some |
| 4 | **Seis campos fixos** por projeto (abaixo) | comparabilidade. Texto livre vira 35 formatos diferentes e a página perde a serventia |
| 5 | Server component, `listProjects()` de `lib/projects.ts` | ponto único de entrada — nenhuma página importa `data/projects.json` direto |

### Os seis campos (todos obrigatórios, todos curtos)

| Campo | O que responde | Tamanho |
|---|---|---|
| `oQueE` | O produto em uma frase, sem jargão interno | 1 frase |
| `paraQuem` | Quem paga ou pagaria | ½ frase |
| `estado` | `no-ar` \| `no-ar-inutilizavel` \| `prototipo` \| `parado` \| `morto` — enum, não prosa | 1 valor |
| `dinheiro` | O que já entrou, em número. Zero é resposta válida e importante | 1 frase |
| `oQueTrava` | O gargalo REAL, não a próxima tarefa | 1 frase |
| `proximaDecisao` | A pergunta de negócio em aberto, ou `null` se não há | 1 frase ou `null` |

`estado: "no-ar-inutilizavel"` existe porque é o padrão mais comum do portfólio e o mais caro de
esquecer: o `compass` responde 200 e não fatura, o `cardiorisk` promete análise que a API NXDOMAIN
não entrega ([[landing_200_backend_nxdomain]]).

---

## Os 35, na ordem do arquivo

```
goiania, tapepro, sirius, fabrica, roilabs, polarisia, estetiacrm, reviewshield, context,
aftercare, nimblabs, orcaobra, cardiorisk, tapevision, potencialarquitetado, matchfios,
verticemarketing, whatsmeow, claudeloop, swarm, atma, aprovai, moderador, meridian,
seo-forecaster, cannibal_scan, roi-labs-links, lumina, cyberspace, compass, orion, qprime,
portfolio, vertice, pathfinder
```

⚠️ **`vertice` e `verticemarketing` são dois produtos diferentes**, não duplicata:
`vertice.roilabs.com.br` é onboarding de cliente para agências (repo `vertice`, em inglês);
`verticemarketing.roilabs.com.br` é landing de agência em português (repo `vertex-landing-craft`).
Custou meia hora nesta sessão. O resumo dos dois tem que deixar isso explícito.

---

## Como escrever os 35 sem inventar

A fonte primária é o card + os handoffs + a memória. **Mas card apodrece**
([[roihub_agenda_task_premises_unverified]]) e nesta semana três premissas caíram. Regra:

- **`estado` e `dinheiro` NUNCA saem de card** — `estado` sai de `curl` sem `-k`
  ([[curl_insecure_flag_hides_cert_errors]]) mais um grep de host NXDOMAIN nas envs do repo;
  `dinheiro` sai do que está escrito em `receitaNota` **com a data**, e se não houver data, é zero.
- **`oQueE` e `paraQuem`** podem sair do repo e da memória — são descrição, não estado.
- **`oQueTrava`** é o gargalo, não a tarefa da vez. Do `fabrica` é "não tem tráfego", não
  "resubmeter sitemap". Do `compass` é "não tem como cobrar", não "criar sitemap".

**Trabalhe em lotes de ~7 e commite cada lote.** São 35 resumos; uma sessão que tenta os 35 num
commit só vai perder tudo se estourar. Sugestão de ordem: comece pelos que têm receita
(`goiania`, `sirius`, `orcaobra`, `fabrica`, `atma`) — são os que o resumo precisa acertar — e
deixe os protótipos (`moderador`, `cyberspace`, `qprime`, `orion`) para o fim, onde o resumo é curto
e quase todo `estado: "prototipo"` + `proximaDecisao: "matar ou investir?"`.

---

## Como implementar

**Arquivos:**

| Arquivo | O que |
|---|---|
| `data/resumos.json` | novo — `{ "<slug>": { oQueE, paraQuem, estado, dinheiro, oQueTrava, proximaDecisao } }` |
| `app/resumo/page.tsx` | novo — server component, `export const dynamic = "force-dynamic"` |
| `app/tabs.tsx` | 1 linha: `"resumo"` na union de `active` + `{tab("resumo", "/resumo", "Resumo")}` |
| `test/resumos.test.mjs` | novo — trava enum inválido, campo faltando e slug órfão |
| `app/globals.css` | só se faltar token; **usar os que já existem** (`--seq250/400/550/650`, `.tab`, `.foot`, `.pill`) |

**O teste é obrigatório e é um só** (`node --test`, sem framework, como os outros oito em
`package.json`): falha se algum dos 35 slugs de `projects.json` não tiver entrada, se algum
`estado` estiver fora do enum, ou se `resumos.json` tiver slug que não existe em `projects.json`.
Sem isso, um rename de slug quebra a página em silêncio.

**Não fazer:** filtro, busca, ordenação alternativa, export PDF, gráfico. A página tem 35 blocos
estáticos numa coluna; qualquer coisa além disso é adiantar necessidade que ninguém pediu.

---

## Gotchas desta base

- **`Tabs` tem union type literal** (`"home" | "seo" | "infra" | "insights" | "agenda"`) — esquecer
  de adicionar `"resumo"` quebra o `tsc`, não a página. Bom: falha cedo.
- **`layout.tsx` já tem `robots: { index: false }`** — hub é interno, não gastar tempo com SEO/OG.
- **Build local:** `npm run build` roda nesta máquina (o roihub é a exceção — está no OneDrive mas
  não tem o problema de store do pnpm). O deploy real é **Docker no EasyPanel** (`output: standalone`),
  não Vercel — `vercel project ls` não vai listar o hub e isso não é sinal de nada
  ([[vercel_project_ls_is_not_proof_of_offline.md]]).
- **Janela de não-push 00:00–01:00 BRT** (cron do autopublishing às 00:13), pela hora local.
- **Fechar entrega = `npm test` verde + push.** Aqui não há card de agenda para atualizar — a
  entrega é a própria página.

---

## Datas firmes que continuam correndo (não dependem desta sessão)

- **Domingo 02/08, 10:00 BRT** — 1º run do robô de crawl
  ([`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md).)
- **~48h (02/08)** — reconferir o `errors: 1` do sitemap do `fabrica`
  (`GET /webmasters/v3/sites/sc-domain:estetia.estetiacrm.com.br/sitemaps`).
- **~14/08** — remedir `sirius` (CTR do `agaas`) **e** a série de impressões do `atma`.
  ⚠️ Não baixar o `decay 10` do `atma` antes disso.
- **31/08** — gate do `sirius`: ≥ 5 cliques não-branded/28d (hoje 2).
- **19/10** — gate do `tapepro`: ≥ 300 imp/28d (hoje 21). Nada de SEO nele até lá.

## Ainda só o Jean pode fazer

Inalterado desde [`handoff-proximo-passo-pos-sirius.md`](handoff-proximo-passo-pos-sirius.md):
Bing Webmaster Tools no `goiania` (5 min, maior score acionável), as 4 chaves do Stripe do
`compass`, `GOOGLE_CLIENT_ID` do `reviewshield`, os 2 Request Indexing do `fabrica` e — o mais
antigo e perigoso — **rotacionar os segredos vazados** ([[secrets_to_rotate]]).
