# Handoff — `/resumo` no ar, e o que os 35 resumos revelaram juntos (31/07/2026, 10h30 BRT)

Plano executado: [`handoff-pagina-resumo-executivo.md`](handoff-pagina-resumo-executivo.md).
Índice: [`../handoff.md`](../handoff.md).

**Entregue:** sexta aba `/resumo`, 35 resumos executivos, `npm test` verde (132 testes) e push
(`1fa5568` dados, `70ef3d9` página). Nada do plano foi cortado.

---

## O que foi feito

| Arquivo | O que |
|---|---|
| `data/resumos.json` | 35 entradas, seis campos fixos, na ordem da curadoria |
| `app/resumo/page.tsx` | server component, `force-dynamic`, `listProjects()` filtrado por `curated` |
| `app/tabs.tsx` | `"resumo"` na union + o sexto `tab()` |
| `test/resumos.test.mjs` | slug faltando, slug órfão, enum inválido, campo vazio — no `npm test` |
| `app/globals.css` | 10 linhas de `.rsm-*` + **`flex-wrap` em `.tabs`** (a 6ª aba não cabia em 390px) |

Verificado: build limpo com `/resumo` como `ƒ`, teste **provado que morde** (troquei um `estado` por
lixo e ele falhou), e Playwright em 1200px e 390px — as outras cinco abas seguem intactas.

**`estado` e `dinheiro` não vieram de card**, como o plano exigia: os 35 hosts foram curlados **sem
`-k`** (todos 200) e os quatro backends que os cards chamam de mortos foram re-resolvidos —
`cardioapi`, `aitradingapi`, `arquiteturaapi` e `pathback` seguem **NXDOMAIN em 31/07**. São eles
que colocam `cardiorisk`, `tapevision`, `potencialarquitetado` e `pathfinder` em
`no-ar-inutilizavel`, ao lado do `compass`.

---

## 🚨 O achado: 26 dos 35 estão parados numa decisão, não numa tarefa

Escrever os 35 lado a lado expôs uma coisa que card nenhum diz sozinho:

| Número | O quê |
|---|---|
| **1 de 35** | tem receita provada (`sirius`, 3 vendas orgânicas — e o card **não registra as datas**) |
| **2 de 35** | têm checkout vivo: `orcaobra` (Kiwify 200, R$ 47,90) e `atma` (MP valida, **nunca testado em produção**) |
| **26 de 35** | têm `proximaDecisao` preenchida — uma **pergunta de negócio em aberto** |
| **28 / 5 / 2** | `no-ar` / `no-ar-inutilizavel` / `prototipo` |

E as 26 decisões caem em três famílias, não em vinte e seis problemas diferentes:

1. **"Não tem como cobrar"** — `aprovai`, `matchfios`, `compass`, `cardiorisk`, `tapevision`,
   `potencialarquitetado`, `pathfinder`, `claudeloop`, `seo-forecaster`. Alguns nunca construíram
   o caminho; o `compass` construiu e deixou as 4 chaves em branco.
2. **"Não tem quem venda"** — `estetiacrm`, `verticemarketing`, `whatsmeow`, `qprime`, `vertice`.
   Produto pronto, ninguém prospectando.
3. **"Não tem tráfego"** — a maioria do resto. Essa é a única família que as cinco abas existentes
   já sabem tratar.

⚠️ **A agenda não guarda decisão.** Ela lista tarefa com data e checkbox; "matar ou investir o
`orion`?" não tem data e não é para ser riscado. As 26 estão no `/resumo` porque não havia outro
lugar — mas ficar num campo de texto que ninguém revisita é exatamente como card apodrece
([[roihub_agenda_task_premises_unverified]]).

**Não construí nada para isso** — o plano proibia filtro, busca e ordenação, e criar um sistema de
decisões seria adiantar necessidade que ninguém pediu. Fica registrado como pergunta para o Jean:
**as 26 viram uma triagem, ou o `/resumo` é só onde elas moram?**

---

## Como manter isto vivo

O risco desta página é envelhecer bonito. Duas regras baratas:

- **Mexeu em `estado` ou `dinheiro`? Mede antes.** `curl` sem `-k` + resolver o host de API do
  repo. O texto do rodapé da própria página diz isso de propósito.
- **`dinheiro` sem data é R$ 0.** Só o `sirius` escapa hoje, e escapa citando que não tem data —
  se alguém achar as datas das 3 vendas, é ali que entram.

O teste cobre o contrato (slug, enum, campo vazio). **Nada cobre a verdade do texto** — e nada
pode. Isso é revisão humana.

---

## Datas firmes (não dependem desta sessão)

- **Domingo 02/08, 10:00 BRT** — 1º run do robô de crawl
  ([`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)).
- **~02/08** — reconferir o `errors: 1` do sitemap do `fabrica`
  (`GET /webmasters/v3/sites/sc-domain:estetia.estetiacrm.com.br/sitemaps`).
- **~14/08** — remedir `sirius` (CTR do `agaas`) **e** a série de impressões do `atma`.
  ⚠️ Não baixar o `decay 10` do `atma` antes disso.
- **31/08** — gate do `sirius`: ≥ 5 cliques não-branded/28d (hoje 2).
- **19/10** — gate do `tapepro`: ≥ 300 imp/28d (hoje 21). Nada de SEO nele até lá.

## Ainda só o Jean pode fazer

Inalterado: Bing Webmaster Tools no `goiania` (5 min, maior score acionável), as 4 chaves do Stripe
do `compass`, `GOOGLE_CLIENT_ID` do `reviewshield`, os 2 Request Indexing do `fabrica` e — o mais
antigo e perigoso — **rotacionar os segredos vazados** ([[secrets_to_rotate]]).
