# Handoff — a sonda virou `scripts/`, e a 3ª leitura NÃO datou a conta 3 (03/08/2026, manhã)

> Sessão anterior: [`handoff-o-portao-do-rerank-fechou-81-1.md`](handoff-o-portao-do-rerank-fechou-81-1.md)
> (o portão fechou em 81,1%; deixou duas pendências, as duas sobre o POOL).
> Índice: [`../handoff.md`](../handoff.md) · doc da feature: [`../docs/busca/`](../docs/busca/).

`npm test` **272 verdes** · `tsc --noEmit` limpo · pool **3 contas, 1 viva**.

---

## 0. As duas pendências do handoff anterior, e a que não fechou

| pendência | estado |
|---|---|
| 2. a sonda vira `scripts/`? | ✅ **`scripts/probe-pool.mjs`**, commitada, com histórico e teste |
| 1. datar a conta 3 | ⏳ **NÃO** — a 3ª leitura saiu 13 min depois da 2ª |

---

## 1. ⏳ A 3ª sondagem confirmou o quadro e NÃO comprou janela

```
sondagem 2026-08-03 07:59 BRT — 3 contas

conta 1  viva
conta 2  rate-limit (429)
conta 3  desabilitada (403)

1 viva(s) de 3.
⚠️ 1 com subscription disabled (403) — 403 NÃO recarrega esperando.
```

Terceira leitura idêntica às duas anteriores. **Isso não data o 403, e chamar de "datado" seria o
defeito que esta base já nomeou três vezes:** a leitura das 07:59 está a **13 minutos** da de 07:46.
As três juntas cobrem ~10 h (02/08 22:12 → 03/08 07:59), com o autopublishing das 00:13 no meio — e
~10 h não separam **"morta de vez"** de **"morta desde ontem à noite"**. Uma sondagem colada na
anterior confirma o estado e não acrescenta janela nenhuma.

O que decide continua sendo o mesmo, e agora tem onde ficar: **`data/pool-sondagens.json`**, gravado
por `--gravar`, já com as 3 leituras (as 2 primeiras marcadas `fonte: "handoff"`, esta
`fonte: "sonda"`). A próxima leitura útil é a que abre janela larga — dias, ou depois de um ciclo de
reset —, não a próxima que alguém rodar por hábito.

⚠️ **A decisão prática, porém, já não depende disso.** Com 1 conta viva de 3 em três leituras,
"somar conta ao pool" é a mesma ação nos dois cenários; o que o dado datado mudaria é só o RÓTULO
(reposição × expansão) e o quanto se compra. Não segure a compra esperando a medição — segure o
número.

---

## 2. ✅ A sonda virou `scripts/probe-pool.mjs`

```
node --env-file=.env scripts/probe-pool.mjs [--gravar]
```

~40 s, 1 chamada por conta. **Responde em 3 chamadas o que custava as 85 do portão** — e o portão
era o único jeito de descobrir pool morto nas duas noites em que ele saiu com 42/85 e 59/85 caídas
na fusão.

**O que precisou mudar em `lib/reranker.mjs` foram duas linhas, e o motivo é conceitual:**
`trocaDeConta` responde **"troco de conta?"** e devolve `true` para 401, 403 **e** 429 — o
comportamento certo para a busca, e cego para quem decide comprar conta. A sonda precisa do
contrário. Então:

- o `api_error_status` agora **sobrevive** ao `rerank-conta` (`erro.status`), que antes só carregava
  o booleano;
- **`classificarConta(erro)`** (exportada, com teste no `npm test`) devolve
  `viva` · `rate-limit` · `desabilitada` · `auth` · `outro`.

**`outro` existe de propósito:** timeout e CLI quebrado não são veredito sobre a conta. Ler falha de
instrumento como "conta esgotada" mandaria repor conta viva — a mesma classe do `rerank-output`
contando pool morto como "o modelo escreveu bobagem".

---

## 3. O que a próxima sessão roda

1. **Sondar de novo com janela LARGA** (dias, não minutos) e `--gravar`. É a única coisa que data o
   403 — e o histórico agora acumula sozinho.
2. **Nada do portão.** Ele fechou em 81,1%, o número está publicado no rodapé da `/busca` e
   remedi-lo custa 85 chamadas contra 1 conta viva.

---

## 4. O que continua aberto e não é isto

- **As 5 piores em recall@10 continuam em 0,0%** (`D-66`, `D-70`, `D-71`, `D-73`, `D-85`) — todas de
  `estado`/projeto, e o reranker não as consertou.
- **Os 4 deploys presos no EasyPanel** (`aftercare`, `context`, `reviewshield`, `estetia`) seguem em
  404 — [`handoff-4-deploys-o-easypanel-aceitou.md`](handoff-4-deploys-o-easypanel-aceitou.md).
- **A busca continua FORA do `computeScore`.**
- **O item 2.3 da spec (reindexar no cron) continua descartado com a premissa falsa**: o cron roda
  em GitHub Actions, sem `~/.claude` e sem Ollama.
