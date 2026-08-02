# Handoff — os 35 cards entraram no corpus e o ranking ganhou o link; o portão do rerank NÃO fechou (02/08/2026)

> Executa [`handoff-proximo-passo-busca-no-ranking.md`](handoff-proximo-passo-busca-no-ranking.md).
> Índice: [`../handoff.md`](../handoff.md) · doc da feature: [`../docs/busca/`](../docs/busca/).

`npm test` **271 verdes** (270 + 1 novo) · `npm run validade` limpo · `npm run build` verde ·
corpus **345 docs** (309 → 345, 35 cards + este handoff) · dourado **85 perguntas**.

---

## 0. O que fechou, o que não fechou

| item da spec | estado |
|---|---|
| 2.1 cards no corpus (`tipo: projeto`, `id` = slug) | ✅ entregue e medido |
| 2.2 link do foco do dia para a `/busca` | ✅ entregue |
| 2.3 reindexar no fim do autopublishing | ❌ **a premissa é falsa** — §3 |
| 🎯 portão `--motor rerank --min bm25` | ⏳ **não mediu: o pool esgotou** — §2 |

---

## 1. Os cards no corpus, e o que o número consegue e NÃO consegue dizer

Quarta origem em `lib/corpus.mjs`: `nome`, `familia`, `estado`, `receitaNota`, `decayNota`,
`acao`, `acaoDesc` e cada `blockersLista[].texto`. Notas 0-10 ficaram de fora, como manda a spec.

**🚩 O rótulo dos blockers é `blockers:`, no PLURAL, e isso foi MEDIDO.** O BM25 casa token
literal e não deriva plural: com `blocker:` o card do goiania saía em **17º** para "quais os
blockers do goiania" e com o plural sai em **2º**. É a palavra da pergunta e a do cabeçalho da
home — escrever no singular teria entregue o item 2.1 com a pergunta-exemplo da spec ainda
quebrada. Custo: uma reindexação a mais (52 s) e a corrida do portão que já estava rodando foi
morta, porque medir texto que não vai para produção é medir outra coisa.

**🚩 O dourado NÃO PODE premiar os cards, e isso decide como se lê o resultado: nenhuma das 85
perguntas tem slug de projeto em `fontes` (conferido mecanicamente).** O agregado só sabe cobrar o
custo do denominador maior — 35 documentos concorrendo — e nunca creditar o ganho. Ler queda
nesse número como regressão da mudança é ler a régua errada.

O que dá para afirmar, MESMA corrida, zero LLM (`bm25` e `hibrido` são determinísticos aqui):

| motor | sem os cards (310 docs) | com os cards (345) |
|---|---|---|
| BM25 @10 | 78,1% | **77,7%** |
| híbrido @10 | 77,4% | **77,1%** |

**O diff NOMINAL das 85 é a leitura, e ele é melhor que o percentual sugere:** **2 perguntas**
perderam uma fonte que já achavam, as duas saindo da **posição 10 para 11ª/13ª** —
`D-69` (`handoff-resumo-entregue-e-as-26-decisoes.md`) e `D-73` (`handoff-tipar-protocolos.md`).
**Em `D-73` não há card nenhum no top-10**: é deriva de IDF do corpus maior, não card expulsando
handoff. Em `D-69` quem entrou foi o card `tapepro` — e a pergunta é "qual o gate do tapepro e o
que fazer nele agora", ou seja, o documento que entrou é o que TEM a ação de hoje. **O modo de
falha que a spec temia (cards subindo em bloco) não aconteceu**: no controle do §3 da spec, o
top-10 de "quais os blockers do goiania" tem UM card, na 6ª posição, com os handoffs de sempre em
volta.

⚠️ **Não trate essas 2 como tarefa de "consertar o recall".** A resposta barata seria pôr o slug
nas `fontes` de `D-69` — mudar a régua depois de ver o resultado. Se pergunta de projeto entrar no
dourado, entra pelo motivo dela e **com o teste que amarra slug a `projects.json` no mesmo
commit** (a spec já avisa: `test/dourado.test.mjs` deixa slug passar pelos dois testes de fonte).

Teste novo em `test/busca.test.mjs`: os 35 entram com `id` = slug, na ordem do JSON, com o blocker
no texto e **sem nenhum campo numérico** — o defeito que a spec nomeou.

---

## 2. ⏳ O portão não fechou porque o POOL esgotou — 42 de 85

```
⚠️  42/85 reranks falharam e caíram para a fusão: {"rerank-conta":42}
```

`rerank-conta` é o código de **pool inteiro esgotado** (429/401/403 em todas as contas), não de
resposta ruim. Metade das perguntas foi medida com reranker e metade com híbrido puro: o
`recall@10 77,7%` que a corrida imprimiu **é uma mistura e não é comparável com nada** — nem com
os 88,0%, nem com o BM25 da mesma corrida. `avaliar.mjs` não aborta como o `corpus-defasado.mjs`
faz; ele imprime o agregado com o aviso ao lado, e **aviso perde para percentual** é exatamente o
defeito de 31/07. Por isso o número não subiu para o rodapé nem para o `CLAUDE.md`.

**O que a próxima sessão roda, com o pool inteiro:**

```
node --env-file=.env scripts/avaliar.mjs --motor rerank --min bm25
```

Se sair `rerank-conta` de novo, **pare a corrida** — não há informação em corrida mista. O
`.cache/rerank.json` retoma de onde parou.

⚠️ **Duas corridas do portão foram queimadas hoje** (uma morta de propósito na troca do rótulo,
outra até o pool acabar). Se a intenção for medir logo, medir ANTES de qualquer ajuste de texto
do card: cada mudança no `textoProjeto()` invalida a corrida inteira.

---

## 3. ❌ O item 2.3 não pode ser feito onde a spec disse — a premissa é falsa

A spec propõe pendurar `scripts/indexar.mjs` no fim do autopublishing "que já roda todo dia às
00:13 BRT e já tem o ambiente". **Não tem.** O cron é
[`.github/workflows/seo-autopublish.yml`](../.github/workflows/seo-autopublish.yml) e roda em
GitHub Actions, que:

1. **não tem as memórias** (`~/.claude/…/memory`) — e `indexar.mjs` **aborta de propósito** sem
   elas, porque indexar sem memória apaga 139 documentos do índice em produção sem erro nenhum;
2. **não tem o Ollama** — `OLLAMA_URL` no `.env` é `http://127.0.0.1:11434`, a máquina do Jean;
3. não recebe `DATABASE_URL` nem `OLLAMA_URL` como secret no workflow.

Pendurar ali entregaria um passo que falha todo dia às 00:13 — pior que o passo manual, porque
teria cara de automação.

**A parte cara do problema, porém, encolheu por outro caminho.** O item 2.3 existia porque "card
editado é a coisa que mais muda na casa" — e o card é o único dos quatro tipos que **não depende
de reindexação para chegar à aba**: `data/projects.json` está na imagem (o `Dockerfile` copia
`data/`, e agora o `outputFileTracingIncludes` do `/busca` também nomeia o arquivo), e
`getIndice()` une disco + banco com o disco ganhando. **Card editado → push → deploy → texto
fresco no BM25.** Só o vetor dele fica velho até alguém rodar `indexar.mjs` daqui.

Quem quiser resolver o resto de verdade tem duas saídas honestas, as duas com preço: subir um
Ollama alcançável e pôr as memórias num lugar que o CI enxergue, **ou** um passo agendado na
máquina do Jean. Nenhuma das duas é uma linha.

---

## 4. O link do ranking (2.2)

Em [`app/page.tsx`](../app/page.tsx), ao lado da URL do foco do dia: `o que a casa sabe` →
`/busca?q={nome}&rerank=0&resposta=0`. Zero LLM, ~0,3 s, URL compartilhável por construção.

---

## 5. O que continua aberto e não é isto

- **Os 4 deploys presos no EasyPanel** (`aftercare`, `context`, `reviewshield`, `estetia`) seguem
  em 404, com as mesmas duas hipóteses dentro do painel —
  [`handoff-4-deploys-o-easypanel-aceitou.md`](handoff-4-deploys-o-easypanel-aceitou.md).
- **O rodapé da `/busca` agora declara a idade de cada número** (BM25 e híbrido de 02/08 com 345
  docs; rerank de 31/07 com 263 docs e 78 perguntas, marcado "pendente remedir"). Ao fechar o
  portão do §2, atualizar os três de uma vez — número velho declarado velho é honesto, número
  novo medindo outra coisa não é.
- **A busca continua FORA do `computeScore`**, pelo motivo do §0 da spec. Nada aqui muda isso.
