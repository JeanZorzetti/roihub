# Handoff — o reranker está no ar, e o gargalo deixou de ser recuperação (31/07/2026, 19h40 BRT)

Estado anterior: [`handoff-busca-hibrida-no-ar.md`](handoff-busca-hibrida-no-ar.md) (a aba, o
piso relativo e as três armadilhas de build). Arquitetura:
[`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md) · índice: [`../handoff.md`](../handoff.md).

**Entregue:** reranker com claude-cli sobre o top-50, **recall@10 82,4% → 88,0%**. 171 testes
verdes, `tsc` limpo, `main` deployado e **verificado em produção** (`36d3306`).

---

## Verificado ao vivo, não inferido

`hub.roilabs.com.br/busca?q=…` às 19h40 BRT, com basic auth (`HUB_USER`/`HUB_PASS` só na
EasyPanel — pedir ao Jean):

| | rodapé | latência |
|---|---|---|
| `?rerank=1` (padrão) | `BM25 + vetor + rerank · recall@10 medido em 88,0%` | **4,8 s** |
| `?rerank=0` | `BM25 + vetor` | **1,0 s** |

**Ler o rodapé sem buscar não prova nada** — o Ollama e o claude-cli só entram quando há `?q=`.
E ao inspecionar o HTML: o rodapé é a **última** `.foot` da página, porque cada resultado usa a
mesma classe. Um grep por `Vetor desligado` casa com o TEXTO de um resultado e produz falso
diagnóstico. Já quase aconteceu.

## Como está a recuperação hoje

```
recall@k       @1     @3     @5    @10    @20    @50
BM25         32,8%  66,0%  75,4%  82,3%  87,2%  91,9%
+ vetor      32,0%  65,4%  76,5%  82,4%  88,7%  92,9%
+ reranker   34,2%  70,5%  79,6%  88,0%  91,6%  92,9%

por camada (@10):  protocolo 93,3% (65q) · estado 51,0% (8q) · episodio 78,3% (5q)
```

---

# ▶️ O que é melhor fazer agora

Três coisas concorrem. Vou dar a ordem e o argumento, não a lista.

## 1º — Transformar a lista em RESPOSTA (o maior ganho por esforço, e ninguém pediu)

**O número que importa e que ninguém olhou: `@1 = 34,2%`.** Depois de todo o trabalho, dois
terços das buscas ainda não põem a resposta em primeiro lugar. A aba **lista**, ela não
**responde** — e o custo que ela existe para eliminar (abrir arquivo, ler, decidir) continua
sendo pago, só que sobre 10 resultados em vez de 263 documentos.

Mas `@10 = 88,0%` diz outra coisa: **o material para responder está lá em 88% das perguntas.**
A conversão é direta — o claude-cli já está no caminho, já custa 4,8 s, já recebeu os 10
melhores trechos. Fazer ele **redigir a resposta com citação obrigatória** é aproveitar uma
chamada que já acontece.

**A tensão, dita na cara:** sintetizar sobre um corpus com taxa de erro desconhecida pode
transformar erro silencioso em erro fluente. A defesa não é evitar a síntese — é **citação
estrita**: toda afirmação com o doc de origem clicável ao lado, e recusa explícita ("não está
no corpus") quando os 10 não sustentam. Hoje uma memória errada na posição 3 é lida e
acreditada **sem sinal nenhum**. Com citação, ela fica conferível em um clique. **Síntese com
citação torna a incorreção visível; a lista a esconde.**

Régua: as mesmas 78 perguntas, medindo se a resposta contém o fato correto — não recall.
É uma régua nova e precisa ser construída, mas o dourado já tem `fontes` por pergunta.

## 2º — Camada 4 (manifesto/pull) para a camada `estado`

`estado` está em **51,0% @10** — e em **74,0% @50**. Esse segundo número é o que decide:
**um quarto dessas respostas não está no corpus em k nenhum.** Reranker, embedding, fusão,
contextual retrieval: nenhum alcança o que não foi escrito. "Quantos projetos hoje", "qual o
gate do sirius" moram no GitHub, no GSC e no banco — e **o hub já lê essas três fontes nas
outras abas**. Isto é menos "construir camada 4" e mais **rotear a busca para o que o hub já
sabe**.

São 8 das 78 perguntas (teto de +6,3 pontos agregados), então parece pequeno no número. **Mas
é a classe de pergunta que o Jean realmente faz**, e é a única hoje estruturalmente sem
resposta. Valor por pergunta alto, agregado baixo — não deixe o agregado decidir.

## 3º — Corretude do corpus (o problema mais sério, e o único sem métrica)

Nesta sessão eu escrevi uma atribuição errada com confiança, commitei, pushei — e ela viveu no
corpus por **três commits**, até eu rodar mais uma medição por conta própria. Se não tivesse
rodado, a próxima sessão teria lido "atualizar o dourado explica a queda" e gastado tempo numa
correção **medida como inútil**.

**Recall de 88% sobre um corpus com taxa de erro desconhecida é acesso rápido à resposta
errada.** O dourado mede recuperação, não verdade. Nada neste sistema mede verdade.

O formato que resiste já existe: os **97 `protocolo`** são registros tipados e verificáveis, e
são justamente a camada com melhor recall (93,3%). Os 40 handoffs e 126 memórias são prosa que
acumula e nunca é reconferida. O caminho é converter a prosa que sustenta decisão em registro
tipado, e/ou auditar afirmações contra a realidade (git, GSC, banco, HTTP) — que é exatamente o
que o hub já faz com projetos.

Está em 3º **só porque é o mais difícil de escopar**, não porque importa menos. Se a #1 for
feita, isto sobe para 1º imediatamente: síntese amplifica o que o corpus tem de errado.

## Não é mais a fase 4 (contextual retrieval)

O reranker colheu **5,6 dos 10,5 pontos** de folga que havia entre @10 e @50. Sobram 4,9. A
fase 4 é o único lever que levanta o teto (@50 = 92,9%), mas custa **1331 chamadas por
reindexação** contra 1 por busca — e melhora a metade densa, que sozinha soma pouco. Se um dia
for feita: janela ociosa do pool, **fora das 00:00–01:00 BRT**, medida com
`--motor rerank --min bm25`, nunca contra 83,0%.

---

## Medido e DESCARTADO — não reabrir

1. **Obedecer o reranker.** Dois prompts diferentes, duas derrotas: @10 76,7% e 78,8% contra os
   82,4% da fusão, com o @1 despencando para 19,5%. O modelo acerta o **conjunto** (sozinho
   levou o @20 de 88,7% para 91,6%) e erra a **ordem**, porque não vê o score do BM25 — que
   carrega o casamento de termo raro. `rrf(c=10)` funde e ganha em todos os k.
2. **Atualizar `data/dourado.json` para creditar as memórias novas.** Rodado com e sem os 4
   docs novos: 82,4% nos dois, **0 pergunta afetada**. Renderia ~0.
3. **Piso absoluto de recall.** Os mesmos 259 docs da fase 3 dão 82,4% hoje, não 83,0% — não é o
   corpus crescer, é handoff e memória serem **reescritos** toda sessão, o que mexe em vetor e
   IDF. Usar sempre `--min bm25`.
4. **`qwen3-embedding` na VPS.** 2 min 20 s por chunk → 51 h de indexação. O modelo é o
   `nomic-embed-text`.

## Armadilhas de operação

- **Reindexar depois de escrever handoff/memória:** `node --env-file=.env scripts/indexar.mjs`
  (19 s morno). As 126 memórias moram em `~/.claude`, **fora do repo** — sem reindexar elas
  somem da aba em silêncio. Já aconteceu: a busca não achava o handoff sobre a busca.
- **`--motor todos` NÃO inclui o rerank**, de propósito — 78 chamadas por acidente queimariam o
  pool do autopublishing. Rodar `--motor rerank` explicitamente.
- **`.cache/rerank.json` é o que torna isto barato.** Corrida morta retoma de onde parou (uma
  foi morta no meio e torrou o pool sem devolver número), e **comparar políticas de fusão saiu
  de graça** do cache, sem chamada nova. Cachear ANTES de medir.
- **`--limite N`** mede as N primeiras perguntas: iterar em 5 antes de gastar 78.
- **Recorte de tamanho fixo tem viés contra doc longo.** Com 400 chars, `fonte@10` de handoff
  caiu para 28,3% enquanto protocolo subiu — protocolo tem 780 chars, handoff tem 9 mil. Vale
  para **qualquer** prompt que compare documentos de tamanhos diferentes.
- **Não dar push entre 00:00 e 01:00 BRT** (cron do autopublishing às 00:13).

## Datas firmes que continuam correndo

- **Domingo 02/08, 10:00 BRT** — 1º run do robô de crawl
  ([`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)).
- **~02/08** — reconferir o `errors: 1` do sitemap do `fabrica`.
- **~14/08** — remedir `sirius` (CTR do `agaas`) **e** a série de impressões do `atma`.
  ⚠️ Não baixar o `decay 10` do `atma` antes disso.
- **31/08** — gate do `sirius`: ≥ 5 cliques não-branded/28d (hoje 2).
- **19/10** — gate do `tapepro`: ≥ 300 imp/28d (hoje 21).

## Só o Jean pode fazer

Bing Webmaster Tools no `goiania`, as 4 chaves do Stripe do `compass`, `GOOGLE_CLIENT_ID` do
`reviewshield`, os 2 Request Indexing do `fabrica`, fechar o Ollama exposto sem auth na VPS
(decidido: depois) e — o mais antigo e perigoso — **rotacionar os segredos vazados**
([[secrets_to_rotate]]). **A senha do `HUB_PASS` foi colada num chat em 31/07 e entra nessa
fila.**
