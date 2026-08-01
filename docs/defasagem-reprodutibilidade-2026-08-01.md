# Reprodutibilidade do portão do detector de defasagem (critério 1.7)

**Pergunta:** o portão mede o DETECTOR ou mede o DIA? Um portão nunca medido duas vezes não sabe
a resposta — e já aconteceu nesta base o recall cair de 83,0% para 82,4% sem uma linha de código
mudar, só porque handoff e memória foram reescritos e isso mexe no IDF e nos vetores.

A crença de projeto era que `scripts/defasagem-calibrar.mjs` está imune por construção: os dois
fixtures inlinam o `apurado` **e** o `trecho` já recortado no orçamento de 2400 da produção, então
o portão nunca chama `carregarCorpus()` nem a busca. **Mas a fase E de 01/08 existiu exatamente
para provar que "congelado" mente** — os fixtures do juiz se diziam congelados e liam
`dourado.json` na hora da corrida. Crença de projeto não é medição.

## Protocolo

Cache **morno nas duas corridas**, senão o que se mede é a variância do modelo em vez da do
corpus — essa é uma segunda medição, legítima e separada.

1. rodar `node --env-file=.env scripts/defasagem-calibrar.mjs`, guardar a saída inteira
2. **escrever um documento novo** no corpus (um handoff)
3. **reindexar**: `node --env-file=.env scripts/indexar.mjs`
4. rodar de novo, guardar
5. `diff` das duas saídas — **byte a byte**, não só o agregado

O `diff` é do arquivo inteiro de propósito. Comparar só o percentual esconderia uma célula da
matriz trocando com outra e o total ficando igual.

## Medição 1 — 2026-08-01

| | antes | depois |
|---|---|---|
| corpus | 290 documentos | **291 documentos** (`handoff-a-definicao-de-pronto-executado.md`) |
| chunks embedados | — | 1752, reescritos com `nomic-embed-text` |
| portão 1 | 83,3% (35/42), 2 sem veredito | 83,3% (35/42), 2 sem veredito |
| portão 2 | 14/20 | 14/20 |
| matriz | 19 / 11 / 7 / 5 | 19 / 11 / 7 / 5 |

**`diff` da saída inteira: ZERO diferença.**

## Medição 2 — 2026-08-01

| | antes | depois |
|---|---|---|
| corpus | 291 documentos | **292 documentos** (memória `duas-passadas-cegas-fabricam`) |
| portão 1 | 83,3% (35/42) | 83,3% (35/42) |
| portão 2 | 14/20 | 14/20 |

**`diff` da saída inteira: ZERO diferença.**

⚠️ **A primeira tentativa desta medição não valia, e o motivo é reutilizável:** escrevi ESTE
arquivo em `docs/`, reindexei e comparei — zero diferença, mas o corpus ficou em 291. `docs/` não
entra em `carregarCorpus()`, que lê protocolos, handoffs e memórias. **Um teste de "o corpus mudou
e o número não" onde o corpus NÃO mudou não testa nada** — dá o resultado esperado pela razão
errada, que é a forma mais convincente de um teste inútil. Confira sempre a contagem impressa
pelo `indexar.mjs` antes de acreditar no `diff`.

## Conclusão

**O portão mede o detector, não o dia.** O critério 1.7 pedia movimento menor que 3 pontos em duas
medições; o movimento é **zero em ambas**, e zero na matriz inteira, não só no agregado.

Isso vale para o PORTÃO, e a distinção importa:

- ✅ **`scripts/defasagem-calibrar.mjs` é reprodutível.** Fixture congelado com `apurado` e
  `trecho` inlinados não toca no índice. Número desta régua pode ser comparado entre sessões.
- ❌ **`scripts/corpus-defasado.mjs` NÃO herda isso.** Ele roda a busca de verdade contra o corpus
  vivo para escolher os top-10 de cada pergunta, então reescrever um handoff muda quais
  documentos ele julga. O piso relativo (`--min bm25`) existe para a busca por essa razão, e a
  taxa de erro do corpus tem o mesmo problema: **ela se compara contra a própria corrida, nunca
  contra um número absoluto de outra sessão.**

**Consequência prática para a fase L:** quando a segunda corrida do `corpus-defasado.mjs` mostrar
o número caindo, o corpus terá mudado entre as duas (é o conserto que o faz mudar). Provar que o
número caiu **por causa do conserto** exige o achado nominal sumindo, não o percentual descendo —
que é exatamente o que o critério 3.2 pede antes do 3.3, e agora se sabe por quê.
