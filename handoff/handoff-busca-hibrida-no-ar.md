# Handoff — a busca virou aba; falta confirmar o motor em produção (31/07/2026, 14h BRT)

Estado anterior: [`handoff-fase3-hibrido-medido.md`](handoff-fase3-hibrido-medido.md) (a medição —
números, decisões e o porquê de cada uma). Arquitetura:
[`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md) · índice: [`../handoff.md`](../handoff.md).

**Entregue nesta sessão:** fase 3 medida **e** a sétima aba do hub, `/busca`, no ar em
`hub.roilabs.com.br/busca`. **153 testes verdes**, build verde, tudo em `main`.

---

> **Adendo de 31/07, 18h — leia antes do resto.** Três coisas desta página envelheceram em
> quatro horas:
>
> 1. ✅ **O HÍBRIDO ESTÁ ATIVO EM PRODUÇÃO — confirmado, não inferido.** `?q=` real devolve
>    rodapé `BM25 + vetor` com **os dois slots de aviso em `false`** (`page.tsx:161`), o que só
>    acontece se `motor !== "BM25"`, sem `falha` e sem `porQueSemVetor`. Logo: `OLLAMA_URL`
>    chegou ao container **e** o container alcança `sofia_ollama`. Consulta híbrida completa em
>    **0,9 s** com a chamada ao Ollama dentro. **Encerra o único item aberto da fase 3.**
> 2. **A aba pede senha** (basic auth, `HUB_USER`/`HUB_PASS` só na EasyPanel) — `handoff.md:441`
>    já registrava o mesmo bloqueio. **Peça as credenciais ao Jean; sem elas é 401.**
> 3. **Ler o rodapé sem buscar não prova o vetor.** `page.tsx:95` põe `BM25 + vetor` assim que
>    os vetores carregam do banco; o Ollama só é chamado quando há `?q=` (`page.tsx:96`). O
>    rodapé pode dizer `BM25 + vetor` com o Ollama inalcançável. **Buscar alguma coisa** — a
>    linha 3 da tabela abaixo só aparece depois de uma consulta de verdade.
> 4. ⚠️ **Ao ler o HTML, o rodapé é a ÚLTIMA `.foot` da página** — cada resultado também usa
>    `class="foot"`. Pior: um `grep` por `Vetor desligado` casa com **o trecho desta própria
>    página** quando ela sai como resultado. Quase virou falso diagnóstico. Ler o array
>    `children` do último `.foot`, não o primeiro casamento.
> 5. **O piso de 83,0% morreu.** Ver § "A régua apodreceu" no fim.

## ▶️ A primeira coisa a fazer (30 segundos)

**Abrir `hub.roilabs.com.br/busca`, buscar qualquer coisa e ler o rodapé.** Ele diz o estado
do motor:

| Rodapé | Significa | O que fazer |
|---|---|---|
| `BM25 + vetor` | híbrido ativo, 83,0% | nada — pode ir para a fase 4 |
| `⚠️ Vetor desligado — OLLAMA_URL não está no ambiente` | a env não chegou **no container do hub** | conferir se foi no serviço certo do EasyPanel e redeployar |
| `⚠️ Vetor desligado — ollama em http://sofia_ollama:11434: fetch failed` | env certa, rede errada | `sofia` e o hub são **projetos diferentes** no EasyPanel; confirmar que compartilham rede, ou usar o host que o hub enxerga |
| `⚠️ Vetor desligado — hub_embeddings vazia` | o banco de produção não é o que foi indexado | conferir `DATABASE_URL` e rodar `scripts/indexar.mjs` |

Em 31/07 às 14h o rodapé dizia **`BM25`** — mas era a versão sem diagnóstico, e a env tinha
acabado de ser posta. Por isso o primeiro passo é reler, não consertar. **Às 18h30 releu:
`BM25 + vetor`. Era isso mesmo — a env já tinha pegado, e o "BM25" das 14h era a leitura
antiga.**

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
node --env-file=.env scripts/indexar.mjs     # ~11 min do zero, 19 s com .cache/
node --env-file=.env scripts/avaliar.mjs --motor hibrido --min bm25   # a régua que não apodrece
```

**Isto é fácil de esquecer e some em silêncio.** Em 31/07 às 18h o banco ainda estava em 259
docs e a sessão anterior tinha escrito 4 — dois deles memórias, que **só existem no banco**
(não estão no repo). Um dos não indexados era **este handoff**: a busca não achava o handoff
sobre a busca. Agora: **263 docs, 1323 chunks.**

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

## A régua apodreceu — e o que ela revelou

Reindexado o corpus (259 → 263 docs), remedido, mesmo código:

| motor | fase 3 (259 docs) | 31/07 18h (263 docs) |
|---|---|---|
| BM25 | 82,3% | **82,3%** — idêntico |
| denso | 76,7% | 75,7% (−1,0) |
| híbrido | 83,0% | **82,4%** (−0,6) |

**Nenhuma linha de código mudou.** A primeira explicação foi "o corpus cresceu e doc que o
dourado não conhece só entra no top-10 como falso positivo". **Errada — e vale registrar
porque é a hipótese que qualquer um levanta primeiro.**

Rodado o dourado com e sem os 4 docs novos, mesmo pipeline:

```
COM os 4 novos: 263 docs -> recall@10 82.4%
SEM os 4 novos: 259 docs -> recall@10 82.4%      # exatamente os 259 da fase 3
0 pergunta(s) pioraram por causa dos docs novos.
```

Eles entram no top-10 em 6 perguntas e **não deslocam nada**: as afetadas ou já estavam em
100%, ou já estavam em 0% por outro motivo. **Custo medido dos docs novos: 0,0 ponto.**

Então o achado é **pior** que "o corpus cresceu": **os mesmos 259 docs da fase 3 rendem 82,4%
hoje, não 83,0%.** O que muda entre sessões não é só a contagem — é o *conteúdo*: handoff e
memória são reescritos toda sessão, e reescrever doc que já está no índice mexe nos vetores e
no IDF. **O número absoluto não reproduz nem a corpus constante.** Um piso absoluto ia acusar
regressão em toda sessão que escrevesse qualquer coisa.

Trocado por `--min bm25` (`avaliar.mjs:105`): o piso é o BM25 **da mesma execução, mesmo
corpus**. As duas metades sofrem a mesma deriva, então a diferença sobrevive a ela.

E o número que ele revela é desconfortável: **o híbrido ganha do BM25 por 0,1 ponto** (82,4%
× 82,3%). Eram 0,7 na fase 3. Em 78 perguntas, 0,1 ponto é **fração de uma pergunta** — o
lado vetorial hoje não paga o Ollama, o `hub_embeddings` e os 19 s de reindexação.

## ✅ O reranker existe e ganhou — mas não do jeito que a fase 3 supôs

Recusado na fase 3 por *"sem cross-encoder local viável"* — restrição sobre **modelo local**,
que o claude-cli não tem. Reaberto em 31/07 e medido três vezes:

| política | @1 | @3 | @5 | @10 | @20 | @50 |
|---|---|---|---|---|---|---|
| BM25 | 32,8% | 66,0% | 75,4% | 82,3% | 87,2% | 91,9% |
| fusão (híbrido) | 32,0% | 65,4% | 76,5% | 82,4% | 88,7% | 92,9% |
| rerank obedecido, recorte 400 | 17,9% | 60,6% | 72,2% | 78,8% | 91,9% | 92,9% |
| rerank obedecido, recorte 900×3 | 19,5% | 62,1% | 71,0% | 76,7% | 91,6% | 92,9% |
| **RRF(fusão, rerank) c=10** | **34,2%** | **70,5%** | **79,6%** | **88,0%** | **91,6%** | 92,9% |

**As três lições, em ordem de quanto custaram:**

1. **O ranking do reranker é para FUNDIR, não para obedecer.** Obedecer perdeu com dois
   prompts diferentes. O modelo acerta o **conjunto** (só ele levou o @20 de 88,7% para 91,6%)
   e erra a **ordem** (sozinho derruba o @1 de 32,0% para 19,5%), porque não enxerga o score
   do BM25, que carrega o casamento de termo raro. É a mesma lição que o vetor já tinha dado
   na fase 3, e o `c=10` que serve é o mesmo.
2. **Recorte de tamanho fixo tem viés contra doc longo.** Com 400 chars, `fonte@10` de handoff
   caiu de 80,4% para **28,3%** enquanto o de protocolo subiu — protocolo tem 780 chars e 400
   mostram metade dele, handoff tem 9 mil e 400 mostram 4%. Agora são até 3 janelas em 900, e
   doc que cabe no orçamento vai inteiro.
3. **Comparar política de fusão não precisa de chamada nova.** As respostas do modelo estão em
   `.cache/rerank.json`; as 5 políticas da tabela foram avaliadas offline, de graça. Medir o
   caro uma vez e iterar em cima do cache é o que tornou isto barato — depois de uma corrida
   ter sido morta no meio e ter torrado o pool sem devolver número.

**Custo:** 1 chamada de claude-cli por busca, **0,3 s → 6,5 s**. Ligado por padrão, com link
de escape (`?rerank=0`) no rodapé porque o formulário só manda `q`.

## ▶️ Próximo passo de verdade

**Não é mais a fase 4.** O reranker colheu 5,6 dos 10,5 pontos de folga que existiam entre
@10 e @50; sobram **4,9** (88,0% contra o teto de 92,9%). Contextual retrieval é o único lever
que levanta esse teto, mas custa **1331 chamadas por reindexação** contra 1 por busca do
reranker — e é a metade densa que ela melhora, a que sozinha soma pouco.

**O maior buraco agora é a camada `estado`: 51,0%** (era 42,7%; o reranker deu +8,3 sem ser
feito para isso). E em @50 ela dá **74,0%** — **um quarto dessas respostas não está no corpus
em k nenhum**. Nenhum reranker, embedding ou fusão alcança isso: "quantos projetos hoje",
"qual o gate do sirius" moram no GitHub, no GSC e no banco. **É a camada 4 (manifesto/pull) do
doc de arquitetura, e é para lá que o próximo esforço deveria ir.**

Se ainda assim for a fase 4: janela ociosa do pool, **fora das 00:00–01:00 BRT** (cron do
autopublishing às 00:13), e mede-se com `--motor rerank --min bm25`, não contra 83,0%.

**Atualizar `data/dourado.json` foi cogitado e MEDIDO como inútil** — não repetir a ideia. A
hipótese era que as memórias novas respondiam perguntas do dourado sem constar em `fontes`,
contando como erro quando o motor acerta. Os números acima mostram que não: elas entram no
top-10 e não mudam recall nenhum. Creditar as fontes renderia ~0.

**A dúvida honesta antes de gastar claude-cli:** a fase 4 melhora o **lado denso** — que hoje
soma **+0,1 ponto** sobre o BM25. A justificativa histórica do vetor nunca foi o agregado, foi
a camada `estado` (+18,7 pontos). E esta mesma página diz, logo abaixo, que a camada `estado`
**não é problema de recuperação, é fonte errada**. Ou seja: a fase 4 gasta o pool escasso para
melhorar a metade que não mede nada, a serviço da camada que embedding nenhum resolve. **Ver
"o que não perseguir" antes de começar.**

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
