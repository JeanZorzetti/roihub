# Handoff — o portão do rerank FECHOU: 81,1% ≥ 77,7%, zero `rerank-conta` (03/08/2026, manhã)

> Sessão anterior: [`handoff-o-portao-para-sozinho-e-o-teto-e-o-pool.md`](handoff-o-portao-para-sozinho-e-o-teto-e-o-pool.md)
> (o aborto entrou; o portão ficou pendente pela segunda noite).
> Índice: [`../handoff.md`](../handoff.md) · doc da feature: [`../docs/busca/`](../docs/busca/).

`npm test` **271 verdes** · `tsc --noEmit` limpo · corpus **347 docs** · dourado **85 perguntas**
· pool **3 contas, 1 viva**.

---

## 0. O portão fechou, e desta vez ele mediu o reranker

```
node --env-file=.env scripts/avaliar.mjs --motor rerank --min bm25
```

| motor | @1 | @3 | @5 | **@10** | @20 | @50 |
|---|---|---|---|---|---|---|
| BM25 | 28,7% | 60,1% | 69,1% | **77,7%** | 81,0% | 87,2% |
| híbrido | 29,6% | 60,9% | 68,9% | **77,1%** | 83,3% | 87,9% |
| **rerank** | 29,5% | 62,0% | 71,1% | **81,1%** | 86,8% | 87,9% |

```
✓ recall@10 81.1% ≥ piso 77.7%
```

**A linha que prova que o número vale é a que NÃO saiu.** `avaliar.mjs:147` imprime
`⚠️ N/85 reranks falharam` sempre que `falhasRerank` não está vazio; a corrida não a imprimiu, então
foram **85 de 85 reranqueadas**. As duas corridas anteriores (42/85 e 59/85 caídas na fusão) eram
média de reranqueado com híbrido puro — esta não é.

⚠️ **Isto NÃO se compara com os 88,0% de 31/07**, e a queda aparente não é queda: aquilo eram **78
perguntas e 263 docs**. Pela mesma regra que proíbe comparar 85 com 78, o ganho do reranker se lê
**dentro da corrida**: **+4,0 pontos sobre o híbrido em @10** (77,1% → 81,1%) e **+3,5 em @20**.
É por isso que o portão é `--min bm25` e não um piso absoluto.

**Onde o reranker paga mais é a camada `estado`:** 28,3% → **38,9%** em @10, a camada mais fraca das
três. E `fonte@10 protocolo` 71,8% → **79,0%**.

---

## 1. 🚩 O que a sessão passada leu como "3 contas esgotadas" são DOIS estados diferentes

Antes de gastar as 85 chamadas do portão, sondei o pool com **1 chamada por conta** (~40 s).
Duas sondagens, com o autopublishing das 00:13 no meio:

| | 02/08 22:12 | 03/08 07:46 |
|---|---|---|
| conta 1 | **viva** | **viva** |
| conta 2 | 429 | 429 |
| conta 3 | **403** | **403** |

**429 é rate limit e recarrega esperando; 403 é `subscription access disabled` e não.** A conta 3
deu 403 nas duas sondagens, separadas por 9 h e por um ciclo de autopublishing. O handoff anterior
tratava o pool como bloco ("as 3 esgotadas") e daí saía "o teto são 3 contas dividas com o
autopublishing" — **o teto pode ser 2 contas úteis**, e nesse caso a saída 2 do §2 ("somar conta ao
pool") deixa de ser otimização e vira **reposição de uma conta que morreu**.

⏳ **Não medido:** se o 403 da conta 3 é permanente. Duas leituras a 9 h de distância não provam
morte, e a diferença importa — decidir "somar conta" sem saber se é reposição ou expansão é comprar
antes de contar.

✅ **A sonda é a ferramenta barata que faltava.** O portão custa 85 chamadas e era o único jeito de
descobrir que o pool estava morto; 3 chamadas respondem a mesma pergunta.
Está em `scratchpad/probe-pool.mjs` (não commitada — decidir se vira `scripts/`).

---

## 2. A corrida de 02/08 morreu por TEARDOWN, não pelo aborto

Rodei o portão às 22:13 de 02/08. Ele morreu às **22:22, dentro da fase do rerank**, sem tabela,
**sem o `🚨` do §1 do handoff anterior e sem exit code** — o processo foi derrubado por fora, não
pelo script. Isso não contradiz o §1: o aborto dispara em 3 falhas de conta seguidas, e naquela
corrida a conta 1 estava respondendo.

O que salvou o trabalho foi o `.cache/rerank.json`: a corrida de hoje de manhã retomou o que já
tinha respondido e fechou em **107 s** de rerank, contra os ~19 min de uma corrida fria.

---

## 3. O rodapé da `/busca` — os três números agora são da MESMA corrida

Era o item que a sessão anterior deixou marcado. Antes o rerank exibia
`88,0% medido em 31/07 com 263 docs e 78 perguntas — pendente remedir` ao lado de BM25/híbrido de
02/08 — três números de duas corridas diferentes. Agora os três saem de 03/08, 347 docs, 85
perguntas, e o comentário registra por que 81,1% não se compara com 88,0%.

Também caíram dois comentários que citavam o 88,0% como se fosse corrente
([`app/busca/page.tsx:120`](../app/busca/page.tsx#L120) e `:137`).

---

## 4. O que a próxima sessão roda

**Não é o portão de novo** — ele fechou e o número está publicado. As duas pendências que este
handoff cria:

1. **Datar a conta 3.** Uma terceira sondagem decide se o 403 é permanente. Sem isso, "somar conta
   ao pool" é decisão sem denominador.
2. **Decidir se a sonda vira `scripts/`.** Ela responde em 3 chamadas o que custava 85.

---

## 5. O que continua aberto e não é isto

- **Os 4 deploys presos no EasyPanel** (`aftercare`, `context`, `reviewshield`, `estetia`) seguem
  em 404 — [`handoff-4-deploys-o-easypanel-aceitou.md`](handoff-4-deploys-o-easypanel-aceitou.md).
- **O item 2.3 da spec (reindexar no cron) continua descartado com a premissa falsa** medida em
  02/08: o cron roda em GitHub Actions, sem `~/.claude` e sem Ollama.
- **A busca continua FORA do `computeScore`.** Nada aqui muda isso.
- **As 5 piores em recall@10 continuam em 0,0%** (`D-66`, `D-70`, `D-71`, `D-73`, `D-85`) — todas
  perguntas de `estado`/projeto, e o reranker não as consertou.
