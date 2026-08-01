# Handoff — tirar o dourado do achismo (aberto em 31/07/2026, para a próxima sessão)

Este handoff é **especificação de trabalho**, não relatório. Ele assume que quem chega não tem
contexto e que **esforço não é critério de corte** — onde o caminho barato e o caminho certo
divergem, o documento defende o certo e diz o preço na cara.

Estado imediatamente anterior:
[`handoff-juiz-de-verdade-executado.md`](handoff-juiz-de-verdade-executado.md) (frente 2
executada) · especificação que a originou: [`handoff-juiz-de-verdade.md`](handoff-juiz-de-verdade.md) ·
frente 1: [`handoff-normas-que-rodam.md`](handoff-normas-que-rodam.md) ·
arquitetura: [`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md) ·
índice: [`../handoff.md`](../handoff.md).

---

## O que ficou pronto ontem, dito sem propaganda

A aba `/busca` agora tem **três réguas**, e cada uma responde uma pergunta diferente:

| régua | pergunta | teto declarado |
|---|---|---|
| `scripts/avaliar.mjs` | o documento certo está entre os 10? | **88,0%** recall@10 |
| `scripts/avaliar-resposta.mjs` | a citação aponta para um documento que o dourado reconhece? | ancoragem |
| `scripts/avaliar-resposta.mjs --juiz` | **o que ela escreveu bate com o que a casa sabe?** | concordância |

O juiz (`lib/juiz.mjs`) roda em duas passadas — **A: fidelidade**, cega ao dourado e às fontes
esperadas; **B: concordância**, vê o dourado e a `armadilha` — e passou os dois portões:
**holdout cego 87,5%** (8 casos rotulados antes de o juiz vê-los) e **adversarial 10/10** (10
respostas corrompidas de propósito). Em 38 casos julgados, **zero vezes** ele chamou de `correta`
uma resposta errada.

**Nada disso mede verdade.** É a única frase deste documento que precisa ser lida duas vezes.

---

## O buraco, dito sem eufemismo

O dourado (`data/dourado.json`, 78 perguntas) foi escrito por um agente lendo o mesmo corpus que a
aba lê. O juiz compara a resposta com o dourado. Logo:

> **Se o corpus está errado, o dourado repete o erro e o juiz aprova com nota máxima.**

Isso não é hipótese teórica. Ontem, em uma sessão, o sistema produziu **duas** provas concretas:

1. **`D-76` saiu `fiel` E `contradiz` ao mesmo tempo.** A resposta é derivada corretamente do que
   citou — inclusive de uma premissa falsa que ela reproduz como **citação exata** de um documento
   do corpus. Um handoff antigo afirmando que o sirius não tem uma única ocorrência de `hreflang`
   convive, no mesmo índice, com o de 31/07 que provou por `curl` que tem. A síntese leu os dois e
   abriu pelo velho.
2. **A memória da busca mandava "pedir `HUB_USER`/`HUB_PASS` ao Jean"** quando as duas estão no
   `.env` local. A resposta `D-71` reproduziu isso como bloqueio de verdade e liderou a resposta
   com ele. Verificado e corrigido na memória — mas **só porque um humano leu**.

Nos dois casos o documento estava tecnicamente "correto quando foi escrito" e virou mentira sem
que nada acusasse. **A taxa de erro do corpus continua NÃO MEDIDA**, e a síntese multiplica o
alcance de cada erro individual.

E há um agravante que só ficou visível ontem: **eu mesmo, rotulando à mão, vazei "verdade" para
dentro de uma régua de consistência** — marquei `contradiz` em dois casos por afirmações que eu
sabia falsas mas que conflitam com o *corpus*, não com o *dourado*. A confusão entre "concorda com
o que está escrito" e "é verdade" não é um defeito do LLM. É a forma natural de errar aqui, e ela
pega humano também.

---

## A tese deste handoff

> **As 8 perguntas de camada `estado` são as únicas do dourado cuja resposta certa existe FORA do
> corpus. Elas têm que parar de ter lastro em prosa e passar a ter lastro em dado vivo.**

`estado` é a camada que apodrece **por construção**: ela pergunta "quantos projetos o hub tem
hoje", "qual o gate do sirius e onde ele está", "o que está travado". A resposta muda sozinha, sem
ninguém editar nada, e o corpus só sabe o que alguém escreveu da última vez. Em `D-66` o corpus
guardava **quatro contagens defasadas do mesmo número** (37, 39, 40, 39).

E são justamente as 8 cuja resposta certa é **computável**:

| pergunta | fonte de verdade que já existe neste repo |
|---|---|
| `D-66` quantos projetos e de onde vem a lista | API do GitHub + `lib/projects.mjs` (`listProjects()`) |
| `D-67` quantos têm receita provada | `data/projects.json` (campo de receita) |
| `D-68` qual o gate do sirius e onde está | `lib/gsc.ts` — cliques não-branded por query × page × country |
| `D-69` qual o gate do tapepro | `lib/gsc.ts` — impressões em 28 dias |
| `D-70` o que está travado e em quê | `data/projects.json` (blockers) + `lib/score.mjs` |
| `D-71` o que está bloqueado esperando o Jean | `data/projects.json` (blockers marcados) |
| `D-72` onde o roihub roda e como se publica | `Dockerfile` + `.github/workflows/` |
| `D-73` teste novo está no CI? | `package.json` (a lista explícita) |

Nenhuma dessas exige API nova. **Todas as fontes já estão ligadas neste repo.**

### Por que isso vale mais que qualquer melhoria no juiz

O juiz está bom o bastante: passou os dois portões e não confundiu `contradiz` com `correta`
nenhuma vez. **O próximo ganho não está nele.** Está no que ele compara.

Um dourado com lastro externo muda a natureza da medição em três frentes de uma vez:

- **Ele não pode ser aprovado por concordância com um erro.** Se o corpus disser 37 e o GitHub
  disser 35, o dourado diz 35 e a resposta que disser 37 é reprovada. Hoje ela passaria.
- **Ele mede a taxa de erro do corpus pela primeira vez.** Comparar "o que o corpus afirma" com "o
  que a fonte viva devolve", nas 8, é o primeiro número honesto sobre a qualidade da memória
  institucional. Ninguém tem esse número. Ele é o que decide se a aba de busca é um ativo ou um
  amplificador.
- **Ele não apodrece.** Um dourado que se recalcula não precisa ser reescrito, e a régua para de
  derivar entre sessões pela razão mais boba (reescrever handoff mexe em IDF e vetor:
  83,0% → 82,4% sem uma linha de código mudar).

**E inverte a camada:** `estado`, hoje a camada em que menos se pode confiar, vira a única com
resposta verificável. É o começo da saída de "consistência interna" para verdade — e só ficou
visível agora, porque a frente 1 (`conformidade.mjs`) provou que dá para produzir fato verificado
sem LLM, e a frente 2 deu a quebra por camada que isola `estado` num número próprio.

---

# ▶️ O desenho, com o argumento de cada decisão

## 1. O dourado de `estado` vira FUNÇÃO, não texto

```
data/dourado.json          →  as 70 de protocolo/episodio continuam texto (a resposta é uma regra,
                              e regra não muda sozinha)
lib/dourado-estado.mjs     →  as 8 de estado viram funções que devolvem { resposta, fontes, apurado_em }
```

**Não escreva um script que reescreve o `dourado.json`.** É a tentação óbvia e ela recria o
problema: um JSON gerado ontem é tão defasado quanto um JSON escrito à mão ontem. O dourado de
`estado` tem que ser **avaliado na hora da medição**, com a data de apuração carimbada na resposta.

Aceite: `node --env-file=.env scripts/dourado-estado.mjs` imprime as 8 respostas apuradas e a fonte
de cada número, e **duas execuções no mesmo dia batem**.

## 2. Cada uma das 8 declara a própria fonte e o próprio custo

Três delas (`D-68`, `D-69`, `D-70`) dependem do GSC, que é rede e tem cota. Duas (`D-66`, `D-72`)
são baratas. Isso não pode ficar implícito: a medição precisa poder rodar **sem** as caras.

```
--estado offline   → só as que saem de arquivo do repo (D-72, D-73, D-67, D-71)
--estado tudo      → inclui GitHub e GSC
```

Aceite: com a rede desligada, as offline continuam apurando e as demais dizem `nao-apurado`,
**nunca um valor velho**. `n/a` não é aprovação — é "não olhei", e o placar já imprime os três
estados em `conformidade.mjs` exatamente por isso.

## 3. 🔑 O número que este trabalho existe para produzir: a taxa de erro do corpus

Este é o ponto alto da frente, e é o que não se pode cortar por tempo.

Para cada uma das 8, faça **duas** comparações, não uma:

```
A) resposta da aba   × dourado apurado   → mede a SÍNTESE (é o que o juiz já faz)
B) o que o CORPUS diz × dourado apurado   → mede a MEMÓRIA INSTITUCIONAL   ← novo
```

A comparação **B** é a que ninguém fez ainda. Ela responde: *dos documentos que falam sobre o
estado do portfólio, quantos afirmam hoje uma coisa que a fonte viva desmente?*

Operacionalmente: pegue os top-10 documentos que a busca recupera para cada uma das 8, extraia a
afirmação que cada um faz sobre aquele número, e compare com o apurado. **Isso é caro** (8 × ~10
documentos × 1 chamada) e é o único jeito de sair do anedótico — hoje temos duas provas de corpus
defasado achadas por acidente e zero ideia se são duas ou duzentas.

Aceite: sai uma lista nominal de documentos que afirmam algo desmentido pela fonte viva, com o
trecho e o valor certo ao lado. **Essa lista é acionável na hora**: cada linha é uma edição de
memória ou de handoff.

🚩 Se esse número vier alto (digamos, > 20% dos documentos de `estado` defasados), **a conclusão
não é "melhorar o prompt da síntese"** — é que a memória institucional precisa de data de validade,
e aí nasce a frente seguinte. Não confunda o remédio.

## 4. `fiel + discorda` vira detector, não anedota

A célula achou `D-76` de graça. **Isso foi sorte de amostragem, não um sweep.** Ela só olha as
perguntas que estão no dourado, e só os documentos que a resposta por acaso citou.

O upgrade honesto: rodar a passada A **sozinha** sobre pares de documentos que falam do mesmo
assunto, sem passar pelo dourado. Custo real: o corpus tem 272 documentos, e comparar tudo com
tudo é inviável (36 mil pares). **O recorte que torna isso viável** é usar o índice denso que já
existe: só compare pares com similaridade acima de um piso — dois documentos que falam do mesmo
assunto e se contradizem são, por definição, vizinhos no espaço vetorial.

Aceite: `scripts/contradicoes.mjs` devolve pares com o trecho de cada lado e o veredito. Piso
calibrado para caber em ~100 chamadas.

⚠️ **Não faça isso antes do item 3.** O item 3 produz uma lista de contradições *já conhecidas e
verificadas contra a realidade*, que é o conjunto de teste ideal para calibrar este detector — sem
ele, você vai medir o detector contra si mesmo, que é o erro que a sessão de ontem cometeu e
levou 3 horas para desfazer.

## 5. Os 3 `contradiz` da corrida das 78 — barato, e não é o principal

A corrida achou 3 respostas que afirmam o oposto do dourado, e **as três têm a mesma forma**:
abrem com "Sim" onde a resposta é "Não". Em `D-47` (*"pergunto ao Jean antes de commitar?"*) a
resposta é literalmente só **"sim"**, sem nenhuma ressalva — o oposto direto da regra da casa
([[feedback_push_apos_concluir]]).

Isso é um defeito de redação da síntese, e agora ele é **mensurável**: mexeu no prompt, rode
`--juiz` e veja se os 3 viram 0 sem que `correta` caia em outro lugar.

⚠️ **Junte todas as mudanças de prompt e faça de uma vez.** A chave do cache é o hash do prompt:
mexer invalida tudo e custa as 78 de novo. É a dívida nº 6 do handoff de 31/07, ainda aberta.

## 6. 🚨 Dívida de instrumento: corrida que perde o pool tem que PARAR

Ontem a corrida das 78 morreu no meio e **produziu números mesmo assim**: 15 perguntas seguidas
(D-48→D-65) saíram `resposta-output` — pool esgotado — e o relatório contou as 15 como **`recusou`**,
que é o código de "o sistema acertou ao se recusar a responder". Um agregado com **19,2% de
recusa fantasma** foi impresso com casas decimais.

Metade disso já está consertada (resposta suprimida não vira mais `recusou`, e há teste). **A outra
metade não:** a corrida continua rodando depois que o pool morre, queimando tempo para produzir
linhas vazias. E `rodarClaude` engole o `api_error_status`, que é a única coisa que separa "a conta
acabou" de "a resposta é ruim" ([[claude_cli_token_pool_rotation]]).

Aceite: N falhas consecutivas de conta (sugestão: 3) **abortam a corrida** com mensagem explícita, e
o parcial gravado em `data/juiz-corridas/` fica marcado como `incompleto: true` para nunca ser
comparado com uma corrida cheia.

**Por que isso é prioridade e não higiene:** uma régua que produz número plausível quando o
instrumento quebrou é pior que régua nenhuma. Foi exatamente o modo de falha que este projeto
inteiro existe para eliminar, cometido pela própria ferramenta de medição.

---

## Plano de execução

Cada fase tem critério de aceite. **Não avance sem ele.**

**Fase 0 — Abortar em pool morto.** Item 6. É pré-requisito de tudo: sem ele, qualquer número
medido nas fases seguintes pode ser artefato. Aceite: teste que simula 3 falhas de conta e prova
que a corrida para e marca `incompleto`.

**Fase 1 — `lib/dourado-estado.mjs`, as 4 offline.** `D-67`, `D-71`, `D-72`, `D-73`. Puras e
testáveis, sem rede. Aceite: `npm test` verde com as 4 apurando de fixture.

**Fase 2 — As 4 com rede.** `D-66` (GitHub), `D-68`, `D-69`, `D-70` (GSC + projects). Aceite: duas
execuções no mesmo dia batem; sem rede, dizem `nao-apurado`.

**Fase 3 — A comparação B: taxa de erro do corpus.** Item 3. **É o produto desta frente.** Aceite:
lista nominal de documentos defasados, com trecho e valor certo. Ler a lista inteira antes de
publicar qualquer percentual.

**Fase 4 — Corrigir o corpus e remedir.** Cada linha da lista vira edição de memória/handoff.
Reindexar. Rodar `--juiz` e comparar a camada `estado` antes × depois. Aceite: a melhoria (ou a
ausência dela) sai por camada, não no agregado.

**Fase 5 — Detector de contradição.** Item 4, calibrado contra a lista da fase 3.

**Fase 6 — Publicar.** Handoff + `CLAUDE.md` + memória, declarando **no mesmo parágrafo** o que
passou a ser verificado contra a realidade e o que continua sendo prosa concordando com prosa.

---

## O que NÃO fazer

- **Não expanda o dourado para 150 perguntas.** Mais perguntas sobre a mesma base não-verificada
  multiplicam o teto, não o levantam. O ganho está em verificar 8, não em escrever mais 70.
- **Não mexa mais no prompt do juiz.** Ele passou os dois portões e não confundiu `contradiz` com
  `correta` nenhuma vez em 38 casos. Ajuste ali é otimizar o instrumento enquanto o objeto medido
  segue sem lastro.
- **Não rode o juiz em produção.** Ele é instrumento de medição: 3 chamadas por pergunta contra 2
  da aba inteira. Ancoragem roda toda entrega; o juiz roda quando se mexe na síntese.
- **Não gere o dourado de `estado` para dentro do JSON.** Item 1 — JSON gerado apodrece igual.
- **Não trate `n/a` como aprovação.** É "não olhei".
- **Não confunda a régua de concordância com verdade** — nem quando estiver rotulando à mão. Foi o
  erro do rotulador humano ontem, em 2 de 20 casos, e custou 3 horas para ser desfeito.
- **Não revise rótulo depois de ler o juiz e chame o resultado de calibração.** É ajustar o
  gabarito depois da prova. Se precisar corrigir a definição, corrija — e meça num **holdout cego**
  ([[llm_judge_blind_holdout]]).

---

## Custo e prazo, francamente

| | |
|---|---|
| Fase 0 (abortar em pool morto) | ~1 h, zero chamadas |
| Fases 1-2 (as 8 com lastro) | ~3 h, poucas chamadas (é código, não LLM) |
| **Fase 3 (taxa de erro do corpus)** | **~80-100 chamadas** — é o produto |
| Fase 4 (corrigir e remedir) | 78 chamadas × 3 se rodar o juiz cheio |
| Fase 5 (detector) | ~100 chamadas |
| **Total honesto** | **2 sessões**, e a fase 3 sozinha já paga a primeira |

A tentação vai ser fazer a fase 5 primeiro, porque detector de contradição é mais bonito de
mostrar. **Não faça.** Sem a fase 3 você não tem contra o que calibrá-lo, e um detector não
calibrado é mais um número não-verificado — que é, palavra por palavra, o pecado que esta base já
cometeu três vezes e documentou as três.

---

## Armadilhas de operação (todas continuam valendo)

- **Reindexar depois de escrever handoff ou memória:** `node --env-file=.env scripts/indexar.mjs`
  (de máquina com Ollama, nunca do container). Memórias moram em `~/.claude`, fora do repo.
  **Este handoff inclusive.**
- **⚠️ Escrever handoff no meio de uma medição muda o corpus.** A corrida limpa de ontem rodou com
  **272 docs** contra 270 da primeira, porque o handoff e as memórias da própria sessão entraram no
  índice. Mexe em IDF e vetor. **Número absoluto não reproduz entre sessões** — comparar sempre
  contra a mesma execução (`--min bm25`), nunca contra um número de handoff antigo.
- **Ler as respostas, não só o agregado.** Pegou um bug de classificação que teria publicado 83,3%
  no lugar de 97,4%, pegou 5 dos 46 achados de conformidade como falso positivo, e ontem pegou as
  15 recusas fantasma. `--ver`.
- **Erro não é cacheado, então é retentado** na corrida seguinte — é o que permitiu refazer só as
  15 que falharam.
- **`--ids D-66,D-70`** roda um recorte; `--limite N` só pega as N primeiras, que são todas
  `protocolo`.
- **`--motor todos` NÃO inclui o rerank.** `--motor rerank` explicitamente, com `--min bm25`.
- **Não dar push entre 00:00 e 01:00 BRT** (cron do autopublishing às 00:13).
- **Deploy é Docker no EasyPanel, não Vercel.**
- **`HUB_USER`/`HUB_PASS` estão no `.env` local** — dá para verificar produção sem pedir ao Jean.
  (A memória dizia o contrário até 31/07; foi o próprio juiz que expôs.)

## Primeiros 20 minutos

1. `npm test` (**208 verdes**) e `npx tsc --noEmit` — para saber se o que quebrar depois foi você.
2. `node --env-file=.env scripts/juiz-calibrar.mjs` — **38 chamadas, cache morno, ~2 min.** Se os
   dois portões não passarem, alguém mexeu no prompt do juiz e nenhum número desta base vale até
   isso ser entendido.
3. Abrir a corrida mais recente em `data/juiz-corridas/` e **ler os campos `motivo_b` dos casos
   `contradiz` e dos `fiel + discorda`**. São 5 linhas e é o melhor uso de 5 minutos deste handoff.
4. Abrir `data/dourado.json`, filtrar `camada: "estado"` e **ler as 8 perguntas seguidas**. É o
   objeto desta frente inteira.
5. Fase 0. Não pule para o código bonito.
