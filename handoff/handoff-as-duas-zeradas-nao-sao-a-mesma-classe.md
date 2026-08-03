# Handoff — as duas zeradas não são a mesma classe, e uma delas não tem doc que responda (03/08/2026, tarde)

> Sessão anterior: [`handoff-a-gramatica-da-pergunta-era-um-detector-de-handoff.md`](handoff-a-gramatica-da-pergunta-era-um-detector-de-handoff.md)
> (a lista de vazios levou o BM25 de 77,7% a 81,1%; sobraram duas perguntas em 0,0%).
> Índice: [`../handoff.md`](../handoff.md) · doc da feature: [`../docs/busca/`](../docs/busca/).

`npm test` **274 verdes** · `tsc --noEmit` limpo · `npm run validade` 0 achados · **zero chamada de
LLM nesta sessão** · pool intocado (3 contas) · recall@10 **81,1%, sem movimento** — nenhum arquivo
do corpus foi tocado.

---

## 0. A tarefa 2 do handoff anterior continua não-executável, pelo mesmo motivo

A 3ª sondagem foi **07:59**; esta sessão abriu **08:19**. Vinte minutos. O handoff anterior já
nomeava a armadilha — *"sondagem que repete a anterior confirma o estado e não compra janela"* —, e
uma quarta linha idêntica em `data/pool-sondagens.json` custaria 3 chamadas para gravar o que as
três anteriores já dizem. **Continua sendo dias, não minutos.**

A tarefa 1 (remedir o portão do rerank) custa 85 chamadas contra 1 conta viva. A tarefa 3 custa
zero. Foi ela.

## 1. 🚩 A premissa do §5.3 anterior estava ERRADA em uma das duas

O handoff anterior classificou as duas zeradas juntas: *"`D-73` e `D-85` são a outra classe:
descasamento de VOCABULÁRIO … é trabalho de sinônimo/vetor"*. Medido, **elas são classes
diferentes, e para uma delas sinônimo não é o conserto** — porque não há descasamento nenhum.

A coluna que decide não é o idf, é o **df**:

### `D-73` (teste local × lista do `npm test`) — SATURAÇÃO, não descasamento

| token | idf | df | % do corpus | no alvo? |
|---|---|---|---|---|
| `ci` | **2,7** | 23 | 7% | **não** |
| `mao` | 1,6 | 69 | 20% | sim |
| `passa` | 1,6 | 72 | 21% | não |
| `test` | 1,3 | 98 | **28%** | sim |
| `mjs` | 1,0 | 130 | **37%** | sim |
| `novo` | 1,0 | 133 | **38%** | sim |

**O alvo casa 4 de 6 tokens e mesmo assim não entra no top-10** — porque os quatro que ele casa
estão em 20–38% do corpus e não separam nada. Toda a casa escreve "`npm test` verde" e "rodei à
mão". O único token que discrimina (`ci`, 7%) **não existe em nenhum dos dois alvos**, e no doc que
ganhou o 1º lugar ele aparece uma vez, em "cookie do Google em secret de CI" — assunto nenhum a ver.

**Lista de sinônimos não move isto**: o alvo já casa os tokens da pergunta. Quem responde de fato é
`handoff-tipar-protocolos.md:89` ("adicionar à lista explícita do `npm test` no `package.json`,
senão nunca roda") — e ele nunca escreve a sigla que a pergunta usa.

### `D-85` (volume de crawl por propriedade) — o alvo tem score ZERO

```
    SEO-05
      pos=>10  casa 0/5  []  🚩 score 0: nenhum ranking alcança
    gsc_crawl_stats_stale_90d_window
      pos=>10  casa 1/5  [cada 1.0]
```

**Zero token em comum.** Não é ranking ruim — é score 0: nenhum reranqueador, nenhuma fusão e
nenhum ajuste de `k1`/`b` alcança um documento que o BM25 nunca pontua.

E aqui a suspeita do handoff anterior se confirma pela metade: **o dourado pede um doc que responde
só metade da pergunta.** `SEO-05` é a norma de datar o número (a segunda metade, e é a citação
certa para ela). Os **números por propriedade não estão em documento nenhum do corpus** — são
apurados na hora por `d85()`, que lê `docs/Crawl-stats`, e **`docs/` não entra em
`carregarCorpus()`**. O 1º colocado também não responde: ele conta como o pipeline de crawl foi
construído, não quanto cada host recebeu.

**Não mexi no `fontes` de `D-85`.** Trocar o gabarito para premiar o doc que o BM25 já acha é
escrever a régua depois de ver o resultado. O que a próxima sessão precisa decidir está no §4.

## 2. 🚩 O handoff que diagnostica uma pergunta VIRA resultado dela

O 2º colocado de `D-85` é **o handoff da sessão anterior**. Ele chegou lá porque cita a pergunta
literalmente ao diagnosticá-la — e com isso injetou no corpus o token mais raro dela, que existe em
**5 dos 350 docs**. O corpus é reindexado toda sessão, então o documento que descreve o defeito
passa a competir na medição do defeito.

Medido nas 85, com n-grama literal de 5 tokens: **7 perguntas aparecem citadas em algum doc, e 3
delas em posição de top-10 sem serem fonte.** Lendo as 3 uma a uma — e a leitura é o produto, não a
contagem — **só 1 é citação de pergunta**: as outras duas casam **mensagem de erro** (`falha
unknown unknown error read`, `sitemap fabrica volta errors gsc`), que é recuperação legítima, a
pergunta e o doc citando o mesmo stack trace. **A primeira corrida do n-grama mediu o n-grama**, e
ele erra dos dois lados: também perde `D-85`, cuja citação tem 4 tokens.

**Movimento no recall: ZERO, por enquanto.** Em `D-66` o intruso está em 4º e não expulsou nenhuma
fonte do top-10; em `D-85` não havia fonte no top-10 para expulsar. O custo hoje é um slot
queimado — e vira número no dia em que uma fonte estiver em 10ª ou 11ª.

**A norma que sai disto vale para quem escrever o próximo handoff:** ao diagnosticar uma pergunta
do dourado, **nomeie pelo id e não reproduza os termos raros dela**. Este handoff segue a própria
regra — por isso `D-73` e `D-85` aparecem aqui descritos, nunca transcritos. Handoff datado não se
reescreve, então o da sessão anterior fica como está: o slot já foi queimado e desfazê-lo custaria
mais que o slot.

## 3. O que foi entregue

**`scripts/diagnosticar-pergunta.mjs`** — zero LLM, zero rede, ~1 s. Foi escrito à mão em três
sessões seguidas e jogado fora nas três; `avaliar.mjs` dá o percentual e não diz de onde ele vem.
Imprime, para cada pergunta: `idf` **e `df`** de cada token, quais o alvo casa, e o top-10 com o
que cada colocado casou.

```
node scripts/diagnosticar-pergunta.mjs D-73 D-85
node scripts/diagnosticar-pergunta.mjs --zeradas
```

`--zeradas` devolve exatamente `D-73` e `D-85`, que é o mesmo conjunto que o `avaliar.mjs` reporta —
sonda que não reproduz o número da régua não serve para investigá-lo.

**O check que faltava para o defeito de `D-73` (`test/validade.test.mjs`).** A pergunta descreve um
buraco real: `node --test` recebe **lista explícita**, não glob, e arquivo de teste novo fica verde
na mão de quem escreveu e inexistente no CI. É o item 2 das cinco coisas que toda sessão redescobre
e **nada no repo o pegava** — nem podia, porque um teste que não roda não reprova nada. Mora dentro
de um arquivo **já registrado**, compara nos dois sentidos (sobrar na lista é arquivo renomeado, e
aí o `npm test` inteiro morre em `ENOENT` sem dizer qual foi) e **foi provado que morde**: criei um
`test/zz-prova.test.mjs` vazio e ele reprovou nomeando o arquivo.

**Não escrevi protocolo para a norma do `package.json`.** Ele carregaria a sigla que falta em
`D-73` e a pergunta passaria — comprando o número com a mesma contaminação do §2, no mesmo dia em
que ela foi medida. Se a norma virar protocolo, que seja por valer como norma, e a corrida seguinte
declare que o ganho foi comprado.

## 4. O que a próxima sessão roda

1. **Decidir `D-85`, e é decisão de GABARITO, não de motor.** Três saídas, e nenhuma é ajuste de
   ranking: (a) aceitar 0,0% permanente e declarar no relatório que a pergunta mede citação de
   norma contra vocabulário de dado; (b) pôr `docs/Crawl-stats` no corpus, e aí a primeira metade
   passa a ter documento — mede antes, são 350 docs e o denominador mexe em todo mundo; (c)
   reescrever a pergunta para o registro da norma, que é gabarito seguindo motor e precisa ser
   declarado como tal.
2. **Remedir o portão do rerank** (`--motor rerank --min bm25`) quando o pool permitir — continua
   sendo a única coisa que responde se as 2 chamadas por busca se pagam. Sonde antes
   (`scripts/probe-pool.mjs`, ~40 s).
3. **Sondar o pool com janela LARGA** e `--gravar`. Última leitura: 03/08 07:59. **Terceira sessão
   seguida em que esta tarefa não é executável** — se a próxima também abrir no mesmo dia, o item
   não é "sondar", é aceitar que a janela só vem depois de um ciclo de reset.

## 5. O que continua aberto e não é isto

- **Os 4 deploys presos no EasyPanel** (`aftercare`, `context`, `reviewshield`, `estetia`) seguem em
  404 — [`handoff-4-deploys-o-easypanel-aceitou.md`](handoff-4-deploys-o-easypanel-aceitou.md).
- **A busca continua FORA do `computeScore`.**
- **O 403 da conta 3 continua NÃO DATADO.**
