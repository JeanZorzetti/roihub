# `/busca` — resumo executivo

> Uma página. Estado em **01/08/2026**. Detalhe técnico em [`tecnico-devs.md`](tecnico-devs.md),
> versão sem jargão em [`para-leigos.md`](para-leigos.md).

## Em uma frase

A memória institucional dos 35 projetos virou consultável em português, com resposta sintetizada
que **só é exibida se citar a fonte** — no ar em `hub.roilabs.com.br/busca`.

## O problema

309 documentos de protocolos, handoffs e memórias acumulados. O custo nunca foi ler — foi **não
saber que a regra existe** e repetir um erro já pago. Cada repetição custa horas de sessão.

## O que foi entregue

| camada | função | tecnologia |
|---|---|---|
| recuperação léxica | casa a palavra exata | BM25 próprio, sem dependência |
| recuperação semântica | casa o sentido | embeddings locais (Ollama), custo zero por consulta |
| fusão | junta os dois rankings | RRF, `c=10` calibrado no dourado |
| reordenação | lê 50 candidatos e reordena | claude-cli |
| síntese | responde em até 5 frases com citação | claude-cli |

**Zero API paga.** O único LLM é a assinatura Claude via `claude-cli`, com rotação automática entre
contas do pool.

## Os números

| indicador | valor | leitura |
|---|---|---|
| **recall@10** | **88,0%** | o documento certo está entre os 10 primeiros |
| recall@3 | 70,5% | entre os 3 primeiros |
| recall@1 | 34,2% | em primeiro lugar |
| ganho do reranker | +5,6 pts | 82,4% → 88,0% |
| latência completa | ~12 s | 2 chamadas de LLM |
| latência só-lista | ~0,3 s | link no rodapé |
| corpus | 309 docs | 98 protocolos, 72 handoffs, 139 memórias |
| base de teste | 85 perguntas | gabarito escrito à mão |

⚠️ Os 88,0% foram medidos com **78** das 85 perguntas. Denominador novo não se compara com número
velho — e o valor absoluto **não reproduz entre sessões**, porque reescrever handoffs muda os
vetores e a raridade das palavras (83,0% → 82,4% sem uma linha de código alterada). Por isso a régua
oficial é **relativa** (`--min bm25`), não um alvo fixo.

## As três decisões que definem o produto

**1. Falha fechada na citação.** Resposta sem `[n]` válido não é renderizada — vira aviso no rodapé.
Prosa fluente sem procedência tem a autoridade da resposta e nenhuma da fonte; é o pior resultado
que este componente pode produzir, pior que não responder.

**2. O ranking do LLM é para fundir, não para obedecer.** Testado duas vezes com prompts diferentes:
obedecer ao LLM derruba o acerto em 1º lugar de 32,0% para 19,5%. Ele acerta o *conjunto* e erra a
*ordem*. Fundir as duas opiniões entrega 88,0% — melhor que qualquer uma sozinha.

**3. Recall e resposta têm réguas separadas.** Um prompt único que ordenasse e respondesse
obrigaria a remedir os 88,0% a cada ajuste de redação. Separados, cada um se mede sozinho.

## Risco conhecido, e a mitigação

**A busca mede recuperação, não verdade.** Um documento com número desatualizado será encontrado e
resumido com confiança — sintetizar sobre um corpus com taxa de erro desconhecida transforma erro
silencioso em **erro fluente**.

A mitigação não é evitar a síntese, é torná-la conferível em um clique: citação obrigatória, índice
casado com a numeração dos cards, e o aviso *"confira antes de agir"* fixo abaixo de toda resposta.

Uma frente separada tentou medir a taxa de erro do corpus e está **congelada por decisão**: a
precisão da lista de acusações ficou em 70% — 3 de cada 10 linhas mandavam corrigir algo que estava
certo. O caminho barato que ficou de pé é `scripts/validade.mjs`, que roda no `npm test`, custa
segundos e **impede a defasagem de nascer** em vez de caçá-la depois.

## Robustez

Cada camada degrada sozinha e **nomeia a causa no rodapé**: Ollama fora → volta para BM25; LLM
falha → volta para a fusão; síntese falha → só a lista. Não existe tela de erro. Degradar em
silêncio seria pior que degradar.

## Custo operacional

Duas chamadas de LLM por busca completa, do mesmo pool do autopublishing. Sem infraestrutura nova:
o Postgres já existia. Índice léxico montado uma vez por processo (~150 ms).

## Pendência aberta

**Reindexar após escrever handoff ou memória** (`scripts/indexar.mjs`). Sem isso o documento novo
some da aba em silêncio — é o único passo manual do ciclo.
