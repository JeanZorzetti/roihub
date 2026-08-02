# `/busca` — detalhamento técnico

> Público: quem vai mexer no código. Arquitetura de intenção original em
> [`../rag-arquitetura.md`](../rag-arquitetura.md) (este doc descreve o que FOI construído, não o
> que foi planejado). Medições em 01/08/2026.

## 1. O que é

Busca com resposta sobre a memória institucional do portfólio: protocolos, handoffs e memórias do
Claude. Uma página, `app/busca/page.tsx`, **server component com `dynamic = "force-dynamic"`**,
formulário `GET` — sem client component, sem estado no browser, URL com `?q=` compartilhável.

Pipeline: **BM25 → + vetor (Ollama) → RRF → reranker (claude-cli) → RRF → síntese (claude-cli)**.

```
corpus (309 docs)
  ├─ BM25 top-50 ──────────┐
  └─ denso top-50 (cosseno)┴─ rrf(c=10) ─→ 50 candidatos
                                             ↓ reranker (1 chamada claude-cli)
                                        rrf(fusão, rerank) ─→ top-10
                                             ↓ síntese (1 chamada claude-cli)
                                        resposta com [n] obrigatório
```

## 2. Corpus e ingestão

`lib/corpus.mjs :: carregarCorpus()` — **309 documentos em 01/08/2026**: 98 protocolos, 72
handoffs, 139 memórias. Mediana de 1.985 caracteres, maior com 89.666.

| tipo | origem | id |
|---|---|---|
| `protocolo` | `data/protocolos/*.json`, **`valid_to` presente = pulado** | nome do arquivo sem extensão (`SEO-04`) |
| `handoff` | `handoff/*.md` | nome do arquivo com `.md` |
| `memoria` | `$MEMORIA_DIR` (default `~/.claude/projects/…/memory`) | slug sem `.md` |

Três decisões que não são estilo:

- **Protocolo revogado não entra.** Devolver fato revogado é pior que não devolver nada.
- **`MEMORY.md` é excluído** — é índice de uma linha por memória: casa com quase toda pergunta e
  não responde nenhuma. Indexá-lo fabrica falso positivo no topo.
- **O `id` é o mesmo vocabulário das `fontes` do `data/dourado.json`.** Divergir aqui zera o recall
  sem erro nenhum aparecer.

**Em produção o corpus é união disco + banco** (`page.tsx:26`): o container tem protocolos e
handoffs na imagem, mas as memórias vivem em `~/.claude`, fora do repo — vêm da tabela
`hub_corpus`. **Disco vence empate** (está mais fresco). Banco fora do ar → a aba responde com o
que está no disco.

## 3. Camada léxica — `lib/bm25.mjs`

BM25 puro, sem dependência e sem índice externo. `K1 = 1.5`, `B = 0.75`, IDF com suavização
`log(1 + (N - n + 0.5) / (n + 0.5))`.

- `tokenizar()`: NFD → remove acento → lowercase → `[a-z0-9]+`, **descarta token de 1 caractere**
  (não separa nada e infla o denominador do BM25).
- Índice montado **uma vez em escopo de módulo** (`page.tsx:25`): ~150 ms para 309 docs, e o
  corpus só muda em deploy ou reindexação.
- **Desempate por `id`**, sempre. Avaliação que muda de número entre execuções não mede nada.

`tsvector`/`pgvector` ficaram de fora de propósito: seriam infra sem evidência enquanto o dourado
não mostrar que este piso não basta.

## 4. Camada densa — `lib/denso.mjs`

Embedding local via **Ollama** (`OLLAMA_URL`), modelo `nomic-embed-text` (`EMBED_MODEL`). Custo de
token zero.

- **Chunk de 900 caracteres**, quebrando em parágrafo (`\n{2,}`). Handoff mediano tem 9 mil e o
  maior 23 mil: embedar o doc inteiro dilui o trecho que responde. Protocolo (~780) cabe inteiro.
- **O título vai em todo pedaço** — sem ele o chunk do meio de um handoff perde de que projeto fala.
- **Prefixos por família de modelo.** `nomic` separa documento de consulta por prefixo literal
  (`search_document: ` / `search_query: `); `qwen3` embeda o documento cru e põe a instrução só na
  consulta. Trocar os dois derruba a similaridade **sem erro nenhum**.
- **Documento pontua pelo MELHOR chunk**, nunca pela média: um handoff de 20 chunks não pode
  ganhar por diluição.
- Cosseno **com as normas na conta** — nem todo modelo devolve vetor normalizado, e produto interno
  sobre vetor não normalizado ranqueia por tamanho do vetor.
- `AbortSignal.timeout` explícito: sem ele o `fetch` do Node só desiste em **300 s** (o
  `headersTimeout` do undici) e a aba ficaria 5 minutos pendurada num Ollama fora do ar.
- Cache de embeddings em `.cache/embeddings-{modelo}.json`, **chaveado por modelo** — misturar
  vetores de modelos diferentes no mesmo arquivo é lixo silencioso. Grava a cada lote de 8: o
  corpus inteiro leva ~40 min de CPU.

Em produção os vetores vêm da tabela `hub_embeddings` (`lib/corpus-db.mjs`), não do disco: são
~13 MB de float que não entram no repositório e ~35 min de CPU que o container não pode pagar ao
subir.

## 5. Fusão — `lib/busca.mjs :: rrf()`

Reciprocal Rank Fusion, `score += 1 / (c + posição + 1)`. Junta rankings sem exigir que os scores
sejam comparáveis (BM25 devolve dezenas, cosseno devolve 0..1) — **normalizar score é onde a fusão
costuma quebrar**.

**`c = 10`, não o 60 da literatura.** Medido: com 60 o topo achata e a fusão fica ABAIXO do BM25
sozinho (81,0% × 82,3% em recall@10); com 10 vai a 83,0%, e a camada `estado` sobe de 21,9% para
42,7%. Com dois rankings curtos, `c` alto joga fora a informação de posição.

## 6. Reranker — `lib/reranker.mjs`

Reordena os **50** candidatos da fusão com claude-cli (`RERANK_MODEL`, default `sonnet`,
`--effort low`, `--max-turns 1`, timeout 120 s).

Por que 50 e não 10: `recall@50` do híbrido é **92,9%** contra 82,4% em @10 — o documento certo já
está entre os 50 em quase todas as perguntas, falta ordenar.

### `trechoRelevante()` — até 3 janelas, orçamento 900 chars

Começou em 400 numa janela só e **o reranker desabou justamente nos docs longos**: `fonte@10` de
handoff caiu de 80,4% para 28,3% enquanto o de protocolo subiu para 89,2%. A causa é aritmética —
400 chars mostram metade de um protocolo e **4% de um handoff**, então doc longo chegava ao modelo
parecendo menção de passagem. Doc que cabe no orçamento entra inteiro.

### `parseOrdem()`

claude-cli **não tem `json_schema` strict**: o array vem no meio de prosa que pode conter colchetes
(listas markdown). Tenta cada `[` como início candidato — recortar do primeiro `[` ao último `]`
quebra. Índice fora da faixa ou repetido é descartado.

### `reordenar()` + `fundirComFusao()` — a decisão central

**O ranking do reranker é para FUNDIR, não para obedecer.** Medido com dois prompts diferentes e
perdeu as duas vezes:

| política | @1 | @3 | @5 | @10 | @20 |
|---|---|---|---|---|---|
| fusão (híbrido) | 32,0% | 65,4% | 76,5% | 82,4% | 88,7% |
| rerank puro | 19,5% | 62,1% | 71,0% | 76,7% | 91,6% |
| **`rrf(fusão, rerank)`** | **34,2%** | **70,5%** | **79,6%** | **88,0%** | **91,6%** |

O modelo acerta o **conjunto** (só ele levou o @20 de 88,7% para 91,6%) e erra a **ordem** (sozinho
derruba o @1 de 32,0% para 19,5%) porque não vê o score do BM25, que carrega o casamento de termo
raro. `c = 10`, o mesmo da fusão léxico+denso.

`reordenar()` põe o índice não citado no fim, na ordem original: **o reranker pode errar a ordem,
não pode encolher o conjunto.**

### Pool de tokens — `rodarClaude()`

`CLAUDE_CODE_OAUTH_TOKENS` é **plural**, separado por vírgula. `rodarClaude` **percorre o pool
inteiro** até uma conta responder.

**Só `api_error_status` (401/403/429) decide trocar de conta**, nunca a mensagem: *"You've hit your
monthly spend limit"* não tem uma palavra de rate limit e *"organization has disabled Claude
subscription access"* não tem uma de auth. Em 31/07 a busca morreu em produção porque o código
parava em `tokens[0]` — dois dos três tokens estavam mortos e o terceiro respondia normalmente.

Pool inteiro esgotado tem código próprio: `rerank-conta` / `resposta-conta` / `juiz-conta`,
separado de `-output` ("o modelo escreveu bobagem").

### Cache (`.cache/rerank.json`)

Só para a **avaliação** (`cache: true`). Chave = `sha1(modelo + effort + prompt)` — o modelo entra
porque o juiz roda em `opus` e a síntese em `sonnet`; o effort entra porque, sem ele, trocar o
effort devolvia o resultado anterior em silêncio ("mudar o effort não mudou nada" é a conclusão
errada com cara de medição). Grava **por pergunta**, não no fim: o ponto é sobreviver a ser morto no
meio. **A aba nunca liga isto** — cada busca é uma pergunta nova.

## 7. Síntese — `lib/resposta.mjs`

Segunda chamada de claude-cli, `--effort medium`, sobre os 10 finais. Orçamento de trecho **2400**
chars (contra 900 do reranker: lá a restrição é janela com 50 candidatos; aqui o caro é responder
por cima de um recorte que cortou justo a frase que sustenta a afirmação).

**Por que um segundo prompt e não um só que ordena e responde:** acoplar as duas obrigaria a
remedir os 88,0% a cada ajuste de redação. Separados, recall e resposta têm réguas independentes
(`scripts/avaliar.mjs` e `scripts/avaliar-resposta.mjs`).

**Por que existe:** depois do reranker o recall@10 é 88,0% mas o **@1 é 34,2%** — o material está lá
em 88% das perguntas e dois terços das buscas não põem a resposta em primeiro lugar.

### Falha FECHADA na citação

Índices **1-based**, casando com a numeração dos cards na tela: `[3]` na resposta é o 3º resultado.
Sem esse casamento, conferir a citação exigiria um mapa extra — e citação que dá trabalho de
conferir não é conferida.

`responder()` devolve `{texto, fontes, erro}` e o contrato é:

| situação | `texto` | `erro` | tela |
|---|---|---|---|
| resposta citada | preenchido | `""` | resposta + lista |
| recusa (`NÃO ESTÁ NO CORPUS`) | `""` | `""` | só a lista, **sem aviso** |
| síntese sem `[n]` válido | `""` | `resposta-sem-citacao` | só a lista + aviso no rodapé |
| falha de CLI | `""` | `resposta-*` | só a lista + aviso no rodapé |

**A CITAÇÃO decide, não a frase de recusa, e nessa ordem por um erro medido:** procurar `NÃO ESTÁ NO
CORPUS` em qualquer lugar do texto apagou 5 das 78 respostas do dourado que eram completas e
citadas e só abriam com uma ressalva. Recusa **parcial** é comportamento certo e fica na tela.

**Prosa fluente sem procedência é o pior resultado deste componente** — tem a autoridade da resposta
e nenhuma da fonte. Por isso não é renderizada.

Os códigos de erro trocam o prefixo `rerank-` por `resposta-` (`lib/resposta.mjs`): deixar
`rerank-output` no rodapé da resposta mandaria a próxima sessão debugar o componente errado.

## 8. Degradação — cada camada cai sozinha

| falta | efeito | recall@10 |
|---|---|---|
| nada | pipeline completo | **88,0%** |
| `OLLAMA_URL` / Ollama fora / `hub_embeddings` vazia | cai para BM25 | 82,3% |
| claude-cli falha no rerank | cai para a fusão | 82,4% |
| claude-cli falha na síntese | só a lista | — |
| `DATABASE_URL` fora | perde as memórias do índice | mede meio corpus |

**Degradar em silêncio é pior que degradar:** o rodapé nomeia a causa (`porQueSemVetor` distingue
env faltando de Ollama fora do ar de tabela vazia). Sem isso o diagnóstico só sai por dentro do
container.

## 9. Chaves de query

| parâmetro | efeito |
|---|---|
| `?q=` | a pergunta |
| `?rerank=0` | desliga o reranker — ~0,3 s em vez de ~6,5 s |
| `?resposta=0` | desliga a síntese |

O link "só a lista" no rodapé desliga as duas. **São 2 chamadas de claude-cli por busca completa**,
do mesmo pool do autopublishing.

## 10. Medição

| régua | comando | o que mede |
|---|---|---|
| recall | `node --env-file=.env scripts/avaliar.mjs --motor rerank --min bm25` | o doc certo está no top-k |
| ancoragem | `node --env-file=.env scripts/avaliar-resposta.mjs` | a resposta cita a fonte certa |
| corretude | `… scripts/avaliar-resposta.mjs --juiz` | fidelidade + concordância (3 chamadas/pergunta) |
| calibração do juiz | `node scripts/juiz-calibrar.mjs` | holdout cego ≥ 85% **e** adversarial ≥ 9/10 |

`data/dourado.json` tem **85 perguntas** (65 protocolo, 15 estado, 5 episódio). ⚠️ **Os 82,3% →
82,4% → 88,0% foram medidos com 78** — denominador novo não se compara com número velho.

⚠️ **Piso é relativo, nunca absoluto** (`--min bm25`). O número absoluto não reproduz entre sessões
porque handoff e memória são reescritos, e isso mexe em vetor e IDF: 83,0% → 82,4% **sem mudança de
código**.

⚠️ **`--motor todos` NÃO inclui o rerank**, de propósito: 78 chamadas por acidente queimariam o pool.

⚠️ **`avaliar-resposta.mjs` mede ancoragem, NÃO verdade.** Citar a fonte certa e resumi-la errado
passa com 100%.

## 11. Operação

**Reindexar depois de escrever handoff ou memória:**

```
node --env-file=.env scripts/indexar.mjs
```

Sem isso o documento novo some da aba **em silêncio** — a memória mora em `~/.claude`, fora do repo,
e o container lê do banco.

Testes: `test/busca.test.mjs`, `test/reranker.test.mjs`, `test/resposta.test.mjs`,
`test/juiz.test.mjs`, `test/dourado.test.mjs` — `node --test`, sem framework. **Arquivo de teste
novo tem que entrar na lista do `package.json` à mão**, senão nunca roda.

## 12. Armadilhas registradas

- **`new URL(..., import.meta.url)` quebra sob Turbopack** — a aba cai em 500 já na importação. Use
  `join(dirname(fileURLToPath(import.meta.url)), ...)`.
- **`spawn("claude")` no Windows** só acha o binário com `shell: true` (o CLI é um shim `.cmd`).
- **Vetor de doc que saiu do corpus** devolve id sem texto: `page.tsx:117` filtra por `porId`.
- **O `.mjs` vs `.ts` é deliberado** — a lógica testável é `.mjs` para que a medição (node puro) e a
  aba (Next) rodem o MESMO caminho. Reranker medido por um runner e servido por outro não prova nada.
