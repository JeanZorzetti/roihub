# Handoff — a busca virou aba; falta confirmar o motor em produção (31/07/2026, 14h BRT)

Estado anterior: [`handoff-fase3-hibrido-medido.md`](handoff-fase3-hibrido-medido.md) (a medição —
números, decisões e o porquê de cada uma). Arquitetura:
[`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md) · índice: [`../handoff.md`](../handoff.md).

**Entregue nesta sessão:** fase 3 medida **e** a sétima aba do hub, `/busca`, no ar em
`hub.roilabs.com.br/busca`. **153 testes verdes**, build verde, tudo em `main`.

---

## ▶️ A primeira coisa a fazer (30 segundos)

**Abrir `hub.roilabs.com.br/busca` e ler o rodapé.** Ele diz o estado do motor sem precisar
buscar:

| Rodapé | Significa | O que fazer |
|---|---|---|
| `BM25 + vetor` | híbrido ativo, 83,0% | nada — pode ir para a fase 4 |
| `⚠️ Vetor desligado — OLLAMA_URL não está no ambiente` | a env não chegou **no container do hub** | conferir se foi no serviço certo do EasyPanel e redeployar |
| `⚠️ Vetor desligado — ollama em http://sofia_ollama:11434: fetch failed` | env certa, rede errada | `sofia` e o hub são **projetos diferentes** no EasyPanel; confirmar que compartilham rede, ou usar o host que o hub enxerga |
| `⚠️ Vetor desligado — hub_embeddings vazia` | o banco de produção não é o que foi indexado | conferir `DATABASE_URL` e rodar `scripts/indexar.mjs` |

Em 31/07 às 14h o rodapé dizia **`BM25`** — mas era a versão sem diagnóstico, e a env tinha
acabado de ser posta. Por isso o primeiro passo é reler, não consertar.

## O que existe agora

| Arquivo | Papel |
|---|---|
| `app/busca/page.tsx` | a aba. Formulário GET, sem client component, ~200 ms morno. |
| `lib/corpus.mjs` | 259 docs do disco: 97 protocolos + 39 handoffs + 123 memórias. |
| `lib/bm25.mjs` · `lib/denso.mjs` · `lib/busca.mjs` | BM25 · embedding Ollama · RRF. |
| `lib/corpus-db.mjs` | `hub_corpus` + `hub_embeddings`. **Dono único das duas tabelas.** |
| `scripts/indexar.mjs` | recalcula e grava. **De máquina com Ollama, nunca do container.** |
| `scripts/avaliar.mjs` | a régua: recall@k contra `data/dourado.json`. |
| `test/busca.test.mjs` | 6 testes, na lista do `npm test`. |

**Por que o corpus está no Postgres:** as 123 memórias moram em `~/.claude`, **fora do repo**.
Sem `hub_corpus` o container teria o vetor delas e não o texto — devolveria um id que não sabe
renderizar. São 72 das 160 fontes do dourado.

**Reindexar** (depois de escrever handoff/protocolo/memória nova):

```bash
node --env-file=.env scripts/indexar.mjs     # ~11 min do zero, segundos com .cache/
node scripts/avaliar.mjs --motor hibrido --min 0.83   # a régua não pode cair
```

## Três armadilhas fechadas — não reabrir

1. **`new URL("../x", import.meta.url)` quebra sob Turbopack.** Como `Module not found` (asset
   estático) ou `ERR_INVALID_ARG_TYPE` no `fileURLToPath` — e a segunda derruba a aba **na
   importação do módulo, mesmo sem usar a constante**. Use
   `join(dirname(fileURLToPath(import.meta.url)), …)`. Mordeu duas vezes hoje.
2. **`output: "standalone"` não copia arquivo lido em runtime.** Sem
   `outputFileTracingIncludes` (em `next.config.mjs`) o container sobe com índice vazio e a aba
   responde **200 mostrando nada**.
3. **Degradação silenciosa é pior que degradação.** O rodapé agora diz *por que* o vetor está
   desligado; antes, três causas diferentes imprimiam o mesmo "BM25".

## Fatos da VPS (medidos hoje, não repetir o teste)

- Ollama do EasyPanel: projeto `sofia`, serviço `ollama`, interno `http://sofia_ollama:11434`.
- **`qwen3-embedding` é impraticável aqui: 2 min 20 s por chunk** → 51 h para indexar o corpus.
  Testado e descartado. O modelo em uso é o `nomic-embed-text` (puxado na VPS em 31/07).
- 🔓 **O endpoint está exposto na internet sem autenticação** — puxei um modelo de fora só com
  `curl`. **O Jean decidiu tratar depois; não repropor a cada sessão.**

## ▶️ Próximo passo de verdade: fase 4

**Contextual retrieval, medido igual.** Piso a bater: **83,0%** (`--min 0.83`). Teto: **93,3%**
(recall@50 — acima disso o doc certo nem está entre os 50). Custa claude-cli em lote na
indexação — janela ociosa do pool, **fora das 00:00–01:00 BRT** (cron do autopublishing às 00:13).

O que **não** perseguir: a camada `estado` parou em 42,7% com qualquer motor porque a resposta
("quantos projetos hoje", "qual o gate do sirius") **não mora em texto** — mora no GitHub, no GSC
e no banco. É camada 4 do doc (manifesto/pull), não embedding melhor.

## Decidido pelo Jean — não reabrir

- **`UND_ERR_HEADERS_TIMEOUT` do `run-autopublish.mjs`:** despriorizado por decisão dele.
  Diagnóstico continua em [`handoff-harness-decidido.md`](handoff-harness-decidido.md) § D.
- **Fechar o Ollama exposto:** ele faz depois.

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
