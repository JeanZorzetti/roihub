# Handoff — fase 3 fechada: a recuperação virou número (31/07/2026)

Estado anterior: [`handoff-conjunto-dourado.md`](handoff-conjunto-dourado.md) (fase 2b, 78 perguntas)
· arquitetura: [`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md) · índice:
[`../handoff.md`](../handoff.md).

**Entregue:** `node scripts/avaliar.mjs` mede BM25, denso e híbrido contra o dourado.
**153 testes verdes** (6 novos em `test/busca.test.mjs`).

```
recall@10        todas   protocolo(65)  estado(8)  episodio(5)
BM25             82,3%      90,4%        21,9%       73,3%
denso            76,7%      81,0%        40,6%       78,3%
híbrido (RRF)    83,0%      88,3%        42,7%       78,3%
```

---

## O que foi construído (5 arquivos, nenhuma dependência nova)

| Arquivo | O que faz |
|---|---|
| `lib/corpus.mjs` | 258 docs: 97 protocolos + 38 handoffs + 123 memórias. |
| `lib/bm25.mjs` | BM25 em memória, 40 ms para indexar tudo. |
| `lib/denso.mjs` | Chunk de 900 chars + embedding local (Ollama `nomic-embed-text`), cache em `.cache/`. |
| `lib/busca.mjs` | RRF. Uma função. |
| `scripts/avaliar.mjs` | O relatório, com `--motor` e `--min` (gate de regressão). |

**Nada disso foi para Postgres.** `pgvector`/`tsvector` continuam no doc como destino, mas 258
docs indexam em 40 ms na memória — infra sem número que a justifique é infra que se mantém à toa.

**O id do doc é o mesmo vocabulário das `fontes` do dourado** (`SEO-04`,
`handoff-atma-reindexado.md`, `site_200_is_not_indexed_url_inspection`). Divergir ali zera o recall
sem erro nenhum aparecer — por isso tem teste amarrando os dois.

## As três coisas que só apareceram por medir

1. **O vetor perde sozinho em tudo, menos onde o BM25 é cego.** −5,6 pontos no agregado,
   **+18,7 na camada `estado`**. Se a avaliação fosse só o número global, o vetor teria sido
   descartado — e junto com ele o único ganho real. Foi medir por camada que salvou.
2. **`c = 60`, o valor de manual da RRF, estava errado aqui.** Com ele a fusão fica *abaixo* do
   BM25 sozinho (81,0% contra 82,3%). Com `c = 10`: 83,0%. Dois rankings curtos: `c` alto achata
   a diferença de posição, que é justamente o sinal. Comentado em `lib/busca.mjs`.
3. **O teto do reranker é 10,3 pontos** — recall@50 (93,3%) menos recall@10 (83,0%). Acima disso
   não há o que reordenar.

## O reranker **não** foi construído, de propósito

O doc manda "só manter o reranker se ele ganhar no dourado". Não há cross-encoder local viável
aqui: embedar 1.298 chunks com um modelo de 137M levou ~35 min de CPU; um cross-encoder sobre 50
candidatos × 78 perguntas é ordens de grandeza pior, e API paga está fora
([[budget_claude_cli_only]]). Sem medição não entra. **O teto já está medido (10,3 pontos)** — se
um dia houver GPU ou modelo viável, o alvo já é conhecido e o gate já existe: `--min`.

## O buraco que sobrou não é de índice — é de fonte

As 8 perguntas de `estado` param em 42,7% com qualquer motor. Elas são
*"qual o gate do sirius e onde ele está hoje"*, *"quantos projetos o hub tem hoje"*. **A resposta
não mora em texto** — mora no GitHub, no GSC e no banco, que é exatamente o que o doc de
arquitetura diz da camada `estado`. Otimizar embedding para isso é polir o índice que não tem a
resposta. O caminho é a camada 4 (manifesto/pull), não um vetor melhor.

## Como rodar

```bash
node scripts/avaliar.mjs --motor bm25            # não precisa de Ollama, 100 ms
node scripts/avaliar.mjs                         # os três motores (precisa de Ollama)
node scripts/avaliar.mjs --motor hibrido --min 0.83   # exit 1 se cair
```

⚠️ **Produção não tem Ollama** (Docker/EasyPanel). Quem consumir isto hoje usa BM25; o híbrido é
o vencedor medido *quando há embedder*. Decidir onde o embedder vive é assunto da fase 7
(interfaces), não desta.

## ▶️ Próximo passo

**Fase 4 — contextual retrieval, medido igual.** O aparato já existe: `--min 0.83` é o piso a
bater, e o teto de 93,3% (recall@50) diz quanto ainda há para ganhar. A fase 4 custa claude-cli em
lote na indexação — janela ociosa do pool, **fora das 00:00–01:00 BRT**.

⏸️ **Continua aberto, e continua mais barato que a próxima fase:** o `UND_ERR_HEADERS_TIMEOUT` do
`run-autopublish.mjs` (~10 min: log de `error.cause?.code` no `catch` de `requestPhase`,
`run-autopublish.mjs:87`). Diagnóstico em [`handoff-harness-decidido.md`](handoff-harness-decidido.md) § D.
**Pode estar custando artigo toda noite** no `polarisia` e no `reviewshield`.

## Datas firmes que continuam correndo

- **Domingo 02/08, 10:00 BRT** — 1º run do robô de crawl
  ([`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)).
- **~02/08** — reconferir o `errors: 1` do sitemap do `fabrica`.
- **~14/08** — remedir `sirius` (CTR do `agaas`) **e** a série de impressões do `atma`.
  ⚠️ Não baixar o `decay 10` do `atma` antes disso.
- **31/08** — gate do `sirius`: ≥ 5 cliques não-branded/28d (hoje 2).
- **19/10** — gate do `tapepro`: ≥ 300 imp/28d (hoje 21).

## Ainda só o Jean pode fazer

Bing Webmaster Tools no `goiania`, as 4 chaves do Stripe do `compass`, `GOOGLE_CLIENT_ID` do
`reviewshield`, os 2 Request Indexing do `fabrica` e — o mais antigo e perigoso —
**rotacionar os segredos vazados** ([[secrets_to_rotate]]).
