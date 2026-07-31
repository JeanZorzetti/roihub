# Handoff — Atma REINDEXADO, frente encerrada (31/07/2026, 07h50 BRT)

Receita: [`handoff-proximo-passo-atma.md`](handoff-proximo-passo-atma.md) ·
execução anterior: [`handoff-proximo-passo-atma-executado.md`](handoff-proximo-passo-atma-executado.md) ·
índice: [`../handoff.md`](../handoff.md).

**O item mais caro do portfólio está resolvido.** O Jean pediu a reindexação na UI do Search
Console e as **5 URLs voltaram para `Submitted and indexed`**, com crawl do próprio 31/07.

---

## A medição (URL Inspection API, 31/07 07h42 BRT)

| URL | coverageState | lastCrawlTime |
|---|---|---|
| `/blog/quanto-custa-alinhador-invisivel` | Submitted and indexed | **31/07 01:55Z** |
| `/` | Submitted and indexed | **31/07 01:55Z** |
| `/pacientes/precos` | Submitted and indexed | **31/07 10:39Z** |
| `/blog/invisalign-vs-alinhadores-nacionais` | Submitted and indexed | **31/07 10:39Z** |
| `/blog/alinhadores-vs-aparelho-fixo` | Submitted and indexed | **31/07 10:41Z** |

`verdict: PASS`, `robotsTxt: ALLOWED`, `indexing: INDEXING_ALLOWED` nas cinco. Antes: todas em
`Crawled - currently not indexed` com último crawl congelado em **04–06/06**.

Pela tabela de leitura da receita, é o desfecho **✅✅ resolvido** — não o caso intermediário
("crawl novo mas segue not indexed"), que viraria investigação de qualidade de conteúdo.

**O que o horário entrega:** 01:55Z = **22:55 BRT**, o minuto exato do resubmit do sitemap pela API
na sessão de ontem. O empurrão que o handoff chamava de "secundário" reindexou sozinho a home e o
artigo que fazia 85% do tráfego; o pedido manual pegou as outras três, ~8h depois. Da próxima vez o
sitemap vale ser a primeira coisa, não a última.

## Script novo — reexecutar a leitura sem abrir a UI

```bash
cd roihub
node --env-file=.env scripts/inspect-url.mjs https://atma.roilabs.com.br/ [...]
```

[`scripts/inspect-url.mjs`](../scripts/inspect-url.mjs) — reusa o `propertyOf` do
`submit-sitemap.mjs`, escopo `.readonly`. Serve para qualquer host das propriedades, não só o Atma.

---

## ⛔ O que NÃO concluir daqui

- **Não medir sucesso por tráfego ainda.** Impressão e clique são indicadores atrasados; a série
  diária leva semanas para reagir. Reconferir em **~14 dias**.
- **Não baixar o `decay` do card agora.** O 10 descreve o colapso já medido, que continua nos
  números. A causa saiu; o efeito não. Reavaliar quando a série reagir — e os pesos do
  `lib/score.mjs` seguem sendo decisão do Jean ([[roihub_agenda_task_premises_unverified]]).
- **O Atma não está "pronto".** Restam o MercadoPago nunca testado em produção (a rota grava no
  banco real antes de chamar o MP) e o resíduo de DNS `clerk.` / `www.`.

## Ainda de pé, e não depende de sessão

**Domingo 02/08, 10:00 BRT — 1º run do robô de crawl**
([`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)).

Card do `atma` atualizado em `data/projects.json`: blockers 8→4, o blocker de desindexação apagado
da lista, `acao` trocada para "deixar assentar e reconferir em ~14 dias".
