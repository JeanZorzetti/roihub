# Handoff — o portão do rerank não fechou pela SEGUNDA noite, e agora a corrida PARA sozinha (02/08/2026, noite)

> Sessão anterior: [`handoff-busca-no-ranking-executado.md`](handoff-busca-no-ranking-executado.md)
> (os 35 cards entraram no corpus; o portão ficou pendente).
> Índice: [`../handoff.md`](../handoff.md) · doc da feature: [`../docs/busca/`](../docs/busca/).

`npm test` **271 verdes** · corpus **346 docs** · dourado **85 perguntas** · pool **3 contas, as 3 esgotadas**.

---

## 0. O que foi executado, e o que ele mediu

Rodei o portão que a sessão anterior deixou:

```
node --env-file=.env scripts/avaliar.mjs --motor rerank --min bm25
```

**Ele não mediu o reranker. `59/85` voltaram `rerank-conta`** — contra 42/85 na noite anterior.
`rerank-conta` só é emitido quando **todas** as contas do pool devolvem 401/403/429
(`rodarClaude` lança dentro do laço para qualquer outro erro), e o `.env` tem **3 contas**: não é
config, é esgotamento. A corrida levou 19 min e imprimiu, mesmo assim:

```
── rerank — 85 perguntas
todas       29.5%  62.7%  69.4%  77.4%  83.7%  87.9%
⚠️  59/85 reranks falharam e caíram para a fusão: {"rerank-conta":59}
✗ recall@10 77.4% abaixo do piso 77.7%
```

**Nada dessas três linhas vale, inclusive o `✗`.** 26 perguntas foram medidas com reranker e 59
com híbrido puro; o `77,4%` é a média de duas coisas diferentes, e o veredito de piso é um
reranker sendo reprovado por um resultado que em sua maioria não é dele. A lista de `piores 10`
da mesma corrida tem o mesmo defeito e por isso não está reproduzida aqui.

---

## 1. 🚩 O conserto: `avaliar.mjs` era o ÚNICO consumidor do pool sem o aborto

`avaliar-resposta.mjs`, `defasagem-calibrar.mjs` e `corpus-defasado.mjs` já param em
`MAX_CONTA_SEGUIDAS` (3) e **não imprimem agregado nenhum**. `avaliar.mjs` colecionava as falhas
num array e imprimia o aviso **ao lado do percentual** — que é literalmente o defeito de 31/07
descrito no `CLAUDE.md` ("aviso perde para percentual"), sobrevivendo no único script que ainda
não tinha sido convertido. Duas noites de pool queimado saíram por esse buraco.

Agora ele usa o mesmo `falhasDeConta` dos outros três (zero código novo de contagem):

```
🚨 corrida ABORTADA em 3/5 (motor rerank): 3 falhas de conta seguidas — pool esgotado,
   nenhum número desta corrida vale.
```

**Medido, não afirmado:** com `CLAUDE_BIN` apontando para um binário falso que devolve
`{"is_error":true,"api_error_status":429}` e o `.cache/rerank.json` movido para fora, a corrida
parou em **3/5**, saiu com **exit 1** e **não imprimiu a tabela do rerank nem a linha de piso**.
As tabelas de BM25 e híbrido continuam saindo: elas são determinísticas, terminam antes do rerank
começar e não têm o que abortar.

⚠️ **O aborto não precisa mais de disciplina humana.** A instrução "se sair `rerank-conta` de
novo, pare a corrida" do handoff anterior virou comportamento do script.

---

## 2. O teto é o POOL, e ele não se resolve tentando de novo

| noite | reranks perdidos por conta |
|---|---|
| 01→02/08 | 42/85 |
| 02/08 | **59/85** |

Uma corrida do portão custa **85 chamadas de claude-cli** de um pool de 3 assinaturas que o
**autopublishing também consome todo dia às 00:13** (10 projetos). O `.cache/rerank.json` só
retoma o que **deu certo** — as 59 que falharam não estão em cache e serão pedidas de novo.

**As saídas honestas, com preço, e nenhuma é de graça:**

1. **Rodar o portão logo depois da recarga da assinatura**, antes do autopublishing do dia. É a
   mais barata e não muda uma linha de código; depende de quando as 3 contas viram.
2. **Somar conta ao pool** — é o mesmo gargalo já nomeado em `polaris_teams_use_claude_cli`.
3. **Medir o rerank com denominador menor** (`--limite 40`, declarado como tal). ⚠️ Isso NÃO é o
   portão: 40 perguntas não se comparam com 85, pela mesma regra que proíbe comparar 85 com 78.

❌ **O que não fazer: rodar de novo hoje.** As 3 contas estão em 401/403/429 e a única coisa que
uma nova corrida produz é o `🚨` do §1 — que já está provado que funciona.

---

## 3. O que ESTÁ medido nesta corrida e é válido

BM25 e híbrido são determinísticos e completos (zero LLM, 346 docs — o corpus ganhou este
handoff e o da sessão anterior desde os 345):

| motor | @1 | @3 | @5 | **@10** | @20 | @50 |
|---|---|---|---|---|---|---|
| BM25 | 28,7% | 60,1% | 69,1% | **77,7%** | 81,0% | 87,2% |
| híbrido | 29,6% | 60,9% | 68,9% | **77,1%** | 83,3% | 87,9% |

**São os mesmos números de 02/08 de manhã (77,7% e 77,1%), com um documento a mais no corpus.**
Não é confirmação de nada além disto: um handoff novo não move o agregado — o que já se sabia da
deriva de IDF continua valendo, e continua sendo o motivo de o piso ser relativo.

---

## 4. O que a próxima sessão roda

```
node --env-file=.env scripts/avaliar.mjs --motor rerank --min bm25
```

Com o pool recarregado. **Se o pool estiver morto, o script para sozinho e sai com exit 1** — não
há mais decisão a tomar no meio. Ao fechar, atualizar de uma vez os três números do rodapé da
`/busca` (o do rerank ainda é de 31/07, com 263 docs e 78 perguntas, marcado "pendente remedir").

---

## 5. O que continua aberto e não é isto

- **Os 4 deploys presos no EasyPanel** (`aftercare`, `context`, `reviewshield`, `estetia`) seguem
  em 404 — [`handoff-4-deploys-o-easypanel-aceitou.md`](handoff-4-deploys-o-easypanel-aceitou.md).
- **O item 2.3 da spec (reindexar no cron) continua descartado com a premissa falsa** medida em
  02/08: o cron roda em GitHub Actions, sem `~/.claude` e sem Ollama.
- **A busca continua FORA do `computeScore`.** Nada aqui muda isso.
