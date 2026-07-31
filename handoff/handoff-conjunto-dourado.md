# Handoff — fase 2b fechada: o conjunto dourado existe (31/07/2026)

Estado anterior: [`handoff-tipar-protocolos.md`](handoff-tipar-protocolos.md) (fase 2, 97 protocolos)
· arquitetura: [`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md) · índice:
[`../handoff.md`](../handoff.md).

**Entregue:** [`../data/dourado.json`](../data/dourado.json) com **78 perguntas reais com resposta
conhecida**, `test/dourado.test.mjs` na lista do `npm test`, **147 testes verdes**.

**Com isto as fases 3–6 podem começar.** Antes, qualquer ganho de vetor, reranker, contextual
retrieval ou grafo seria opinião.

---

## O que é o arquivo

Um `data/dourado.json` só, não um arquivo por pergunta: o conjunto é lido inteiro a cada avaliação,
nasceu numa leva, e não tem `supersede` como os protocolos têm. Precedente: `data/resumos.json`.

Seis campos por pergunta:

| Campo | Para quê |
|---|---|
| `pergunta` | Fraseada como o Jean ou um agente perguntaria de verdade, situada no projeto real. |
| `resposta` | A resposta conhecida, com o número/data que a fecha. É o gabarito de precisão. |
| `fontes` | **O alvo de recall@k**: protocolos (`SEO-04`), arquivos de memória (`site_200_is_not_indexed_url_inspection`) e handoffs (`handoff-atma-reindexado.md`). |
| `camada` | `protocolo` (65) · `estado` (8) · `episodio` (5). |
| `armadilha` | A resposta plausível **e errada**. É o que separa medir recuperação de medir sorte. |

**Por que `armadilha` não é enfeite:** um índice ruim quase sempre devolve algo que soa certo. Sem o
distrator escrito, o avaliador (humano ou LLM-juiz) aprova a resposta plausível e o dourado passa a
carimbar regressão como sucesso. Metade das 78 tem uma armadilha que já custou sessão de verdade —
`errors: 1` do sitemap do `fabrica`, `vercel project ls` no `sirius`, `hreflang` que já existia.

**Por que as três camadas ficam marcadas:** recall medido em bloco esconde qual índice está ruim, e
protocolo/estado/episódio não vão para o mesmo índice (camada 1 do doc de arquitetura). Estado é o
que apodrece mais rápido — as 8 perguntas de estado são as primeiras a reconferir.

## O teste (`test/dourado.test.mjs`)

Além do trivial (parseia, campos preenchidos, `id` único em `D-NN`, `camada` no enum), ele amarra o
dourado ao corpus, que é a parte que importa:

- **fonte no formato `AREA-NN` tem que existir em `data/protocolos/`** — protocolo renomeado ou
  revogado quebra o teste em vez de virar alvo fantasma no recall;
- **fonte terminada em `.md` tem que ser um handoff que existe**;
- **toda área com protocolo tipado precisa de ao menos uma pergunta** — as 13 estão cobertas. Área
  sem pergunta é área que a avaliação não mede, e a regressão passaria batida justamente nela;
- **piso de 50 perguntas**, o número do doc de arquitetura;
- pergunta sem `?` reprova: afirmação disfarçada não mede recuperação.

Provado que morde: com `SEO-99` numa fonte, `camada: "outra"` e uma `armadilha` vazia, 3 dos 7 testes
falham com a mensagem certa. Restaurado e verde.

## O que **não** foi feito, de propósito

- **Nenhum script de avaliação.** `recall@k` sem índice para medir é código morto — ele nasce junto
  com o primeiro índice, na fase 3, e aí já sabe qual é a forma da resposta.
- **Nenhuma pergunta inventada.** Toda pergunta saiu de um handoff, de um arquivo de memória ou de um
  protocolo tipado. Pergunta sintética mede o índice contra a imaginação de quem escreveu.
- **Nenhuma pergunta sobre as 5 lacunas** (`BKP`, `CST`, `OBS`, `PRV`, `A11Y`) — não há lastro para
  gabarito.

## Como manter vivo (é onde este ativo apodrece)

- **Protocolo novo na área nova ⇒ pergunta nova**, senão o teste de cobertura de área falha. Isso é
  proposital: é o único ponto do sistema que força o dourado a acompanhar o corpus.
- **As 8 perguntas de `estado` têm data dentro da resposta** (35 curados, gate do `sirius` em 2,
  gate do `tapepro` em 21). Elas envelhecem sozinhas — reconferir junto com as datas firmes abaixo,
  não a cada sessão.
- **Resposta que mudar por decisão** (ex.: se as 26 decisões virarem triagem) reescreve a pergunta,
  não cria uma segunda.

## ▶️ Próximo passo

**Fase 3 — híbrido + reranking, medido contra o dourado.** Agora tem contra o que medir. O doc de
arquitetura manda começar por BM25 + vetor sobre o corpus já tipado, e **só manter o reranker se ele
ganhar no dourado** — a latência não se paga no achismo.

⏸️ **Continua aberto, e é mais barato que a fase 3:** o `UND_ERR_HEADERS_TIMEOUT` do
`run-autopublish.mjs` (~10 min para confirmar: log de `error.cause?.code` no `catch` de
`requestPhase`, `run-autopublish.mjs:87`, esperar um run). Diagnóstico e patch em
[`handoff-harness-decidido.md`](handoff-harness-decidido.md) § D. **Pode estar custando artigo toda
noite** no `polarisia` e no `reviewshield`. ⚠️ Caminho crítico das 00:13 — mexer **fora da janela
00:00–01:00 BRT**.

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
