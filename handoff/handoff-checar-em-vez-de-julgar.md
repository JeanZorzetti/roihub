# Handoff — parar de somar juiz e começar a converter afirmação em CHECK (aberto em 31/07/2026)

Este documento é **especificação de trabalho, não relatório**. Ele assume que quem chega não tem
contexto, e **esforço não é critério de corte**: onde o caminho barato e o caminho certo divergem,
ele defende o certo e diz o preço na cara.

Estado imediatamente anterior:
[`handoff-dourado-com-lastro-externo-executado.md`](handoff-dourado-com-lastro-externo-executado.md)
(frente 3 executada) · spec que a originou:
[`handoff-dourado-com-lastro-externo.md`](handoff-dourado-com-lastro-externo.md) ·
frente 2: [`handoff-juiz-de-verdade-executado.md`](handoff-juiz-de-verdade-executado.md) ·
frente 1: [`handoff-normas-que-rodam.md`](handoff-normas-que-rodam.md) ·
arquitetura: [`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md) ·
índice: [`../handoff.md`](../handoff.md).

---

## 1. O que existe hoje, dito sem propaganda

Quatro réguas, e cada uma responde uma pergunta diferente:

| régua | pergunta | LLM? | teto declarado |
|---|---|---|---|
| `scripts/avaliar.mjs` | o documento certo está entre os 10? | rerank | 88,0% recall@10 |
| `scripts/avaliar-resposta.mjs` | a citação aponta para documento que o dourado reconhece? | 1×/pergunta | ancoragem |
| `scripts/avaliar-resposta.mjs --juiz` | o que ela escreveu bate com o que a casa sabe? | 3×/pergunta | concordância |
| `scripts/conformidade.mjs` | **a norma é obedecida na produção?** | **zero** | 10 protocolos × 35 projetos |
| `scripts/dourado-estado.mjs` | **o número que a casa afirma ainda é o número real?** | **zero** | 5 das 8 de `estado` |
| `scripts/corpus-defasado.mjs` | quantos documentos o mundo desmente? | 1×/documento | 1ª corrida feita |

As duas linhas em negrito são as únicas que tocam a realidade. As outras três medem o sistema
contra texto — e o texto foi escrito por agentes lendo texto escrito por agentes.

**228 testes verdes. Corpus: 276 documentos (97 protocolo, 48 handoff, 131 memória).**

---

## 2. A frase que a próxima sessão NÃO pode repetir errado

Ontem saiu o primeiro número sobre a qualidade da memória institucional:

> **8 de 30 documentos que falam do assunto desmentiam a fonte viva. Ler os 8 baixou para 5 —
> 16,7%.**

**Isso NÃO é "a taxa de erro do corpus".** É a taxa entre os documentos que a busca recupera para
**5 perguntas de camada `estado`** — 50 documentos julgados de 276. Generalizar para o corpus é
inventar. Escreva sempre com o recorte junto, porque o número vai ser citado por uma síntese que
não vai carregar a ressalva sozinha.

E há um agravante que vale mais que o número: **das 8 sinalizações, 3 eram o CHECK errado.**

| falso positivo | como falhou |
|---|---|
| `handoff-deep-research-harness` | o documento diz "hoje 2", o apurado é 2 — o juiz se confundiu com a ressalva "piso: query anonimizada" que eu tinha embutido no meio do texto apurado |
| `handoff-autopublish` | comparou o gate dos canários do autopublish com o gate do tapepro |
| `handoff-normas-que-rodam` | devolveu `VEREDITO: desmente` com o `MOTIVO` dizendo, literalmente, "o veredito correto é nao-fala, não desmente" |

**Precisão do detector nos próprios flags: 62,5%.** Um detector com essa precisão rodado sobre 272
documentos produz uma lista em que **um terço é ruído** — e lista com ruído não é lida duas vezes.
Foi assim que o `conformidade.mjs` começou (5 das 46 violações eram o check errado) e é a terceira
vez que esta base aprende a mesma coisa.

---

## 3. A tese deste handoff

> **O ganho não está em somar mais uma régua de LLM. Está em converter afirmação em CHECK.**

Olhe o que sobrevive: `conformidade.mjs` e `dourado-estado.mjs` custam **zero pool**, rodam em
segundos, não têm variância entre execuções, não precisam de calibração e **não apodrecem**. Cada
afirmação convertida em função é permanente. Cada régua de LLM adicionada é um custo recorrente,
com variância, que precisa de dois portões antes de valer alguma coisa — e que morre quando o pool
morre.

Ontem o pool morreu **no meio da própria corrida que mediria o corpus**. A corrida abortou sozinha
(era o item 6 da spec anterior, feito primeiro justamente por isso) e só terminou porque o cache
estava morno. **Isso não é acidente operacional: é a restrição de projeto.** Qualquer plano que
precise de 234 chamadas (78 × 3 do juiz cheio) é um plano que não termina.

Disso saem três consequências, e elas ordenam o trabalho inteiro:

1. **Antes de escalar um detector de LLM, prove que ele é confiável** — com os mesmos dois portões
   que o juiz teve que passar. Sem isso, escalar multiplica ruído com a autoridade de um número.
2. **Prefira o check determinístico ao juiz sempre que a afirmação for conversível.** "(hoje 21)"
   não precisa de LLM para ser pego: é regex mais uma fonte viva.
3. **Inventarie o que é conversível.** Ninguém sabe hoje quantas afirmações do corpus têm fonte
   viva disponível. Esse inventário é o mapa de todo o trabalho futuro, e ele custa leitura, não
   pool.

---

## 4. O desenho, com o argumento de cada decisão

### Fase 0 — separar FATO de RESSALVA (barato, e corrige 1 dos 3 falsos positivos)

`lib/dourado-estado.mjs` devolve `{ resposta, fonte, apurado_em, nao_apurado }`. A `resposta` de
`D-68` hoje é:

```
Gate 31/08: ≥ 5 cliques nao-branded/28d. Hoje: 2 — piso: query anonimizada pelo GSC não aparece. …
```

A ressalva está **dentro do fato**, e foi ela que fez o juiz ler discordância onde havia acordo
perfeito (2 contra 2). O conserto é estrutural, não de redação: `ressalva` vira campo próprio, e
`montarPromptDefasagem` passa a mostrá-la separada — "este é o fato; esta é a limitação da
medição" — em vez de deixar o modelo decidir o que na frase é afirmação.

**Aceite:** `D-68` volta a ser comparado só pelo número; o caso do
`handoff-deep-research-harness` sai de `desmente` sem que nenhum outro entre. Teste de unidade com
o objeto apurado, sem gastar chamada.

⚠️ Mexer no prompt invalida o `.cache/rerank.json` para todos os 50 documentos já julgados. **Junte
com a Fase 1 e refaça uma vez só** — é a mesma dívida (nº 6 do handoff de 31/07) que já custou uma
rodada inteira.

### Fase 1 — 🔑 os dois portões do detector de defasagem (pré-requisito de tudo)

O juiz da síntese só pôde publicar número depois de passar em **holdout cego ≥ 85%** e
**adversarial ≥ 9/10**. O detector de defasagem publicou um número **sem portão nenhum** e a
primeira leitura já mostrou 37,5% de flag errado. Não é para "melhorar o prompt até parecer bom" —
é para medir, com gabarito, quanto ele erra.

Construa `scripts/defasagem-calibrar.mjs` no molde de `scripts/juiz-calibrar.mjs`:

- **Holdout cego:** rotule à mão 20 pares (documento × fato apurado) **antes** de ver o veredito
  do modelo, e com distribuição proposital — hoje o material real é monocultura (5 dos 5 achados
  são a mesma família "(hoje N)"). Force dentro do holdout: documento datado que descreve o
  passado (**não** é `desmente`), documento que fala de outro gate (**não** é), documento que
  afirma o número certo com ressalva (**não** é), documento com número errado afirmado no presente
  (**é**), documento que nega uma prática que a fonte viva prova existir (**é**).
- **Adversarial:** 10 documentos corrompidos de propósito (trocar o número, inverter a negação,
  trocar o projeto). Detector que não pega ≥ 9 aprova corpus podre.
- **Rótulo revisado depois de ler o veredito é contaminado** e fica marcado, como no juiz. Ajustar
  o gabarito depois da prova é o erro que custou 3 horas em 30/07.

**Aceite:** os dois portões passam e ficam versionados em `data/`. **Sem isso, nenhum percentual
de defasagem pode ser publicado** — nem o 16,7% de ontem, que fica marcado como preliminar até
aqui.

**Preço honesto:** ~1 sessão de leitura humana (rotular 20 pares com atenção é o trabalho, não a
parte de código) + ~30 chamadas. É caro e é o que separa "temos um número" de "temos uma régua".

### Fase 2 — os 3 campos que destravam `D-67`, `D-70` e `D-71` (curadoria, zero código)

Os apuradores **já leem** os campos; eles só não existem no `data/projects.json`:

| pergunta | campo que falta | quem sabe a resposta |
|---|---|---|
| `D-67` receita provada | `vendas: [{ data, valor }]` | Jean — e **só** ele: inventar data de venda é fabricar registro |
| `D-70` o que está travado | `familia: "cobranca" \| "venda" \| "trafego"` e `estado: "no-ar" \| "no-ar-inutilizavel" \| "prototipo"` | derivável dos handoffs por agente, **confirmado** pelo Jean |
| `D-71` esperando o Jean | `blockersLista: [{ texto, humano: true }]` | derivável (painel de terceiro, login manual), confirmado |

**Por que isto vem antes do detector bonito:** três perguntas saem de "prosa concordando com
prosa" para "computada" sem gastar **uma chamada sequer**, e a regra da casa "dinheiro sem data é
R$ 0" para de ser citada e passa a **rodar**. É o melhor retorno por unidade de esforço em todo
este documento.

**Não faça o atalho de extrair da prosa.** `receitaNota` diz "3 vendas orgânicas" e `acaoDesc` diz
"MANUAL (Jean, login Microsoft)" — regex sobre isso reconstrói o dourado com o mesmo material que
ele deveria checar, e já foi medido: grep por `manual|jean` devolve **18 cards contra os 5 reais**.

**Aceite:** `node --env-file=.env scripts/dourado-estado.mjs --estado tudo` imprime **8 de 8
apuradas**, e `npm test` cobre cada campo novo com fixture.

### Fase 3 — a norma que impede a defasagem de nascer (zero LLM)

Os 5 achados reais são **um defeito só**: `(hoje N)` escrito em prosa. Era verdade no dia; a
palavra *hoje* num documento que sobrevive ao dia continua se afirmando presente para sempre.

Corrigir os 5 documentos não resolve nada — o 6º nasce amanhã. O que resolve é um **check**, no
molde do `conformidade.mjs`: varrer os documentos **vivos** (memórias, protocolos, cards do
`projects.json` — **nunca** handoffs, que são registro datado) procurando afirmação de presente
com número:

```
/\((?:hoje|atualmente|agora)[^)]*\d/i      ·      /\bhoje\s+(?:são|é|temos|está)\b.*\d/i
```

e reprovar quando o número não vier acompanhado de data ou de ponteiro para a apuração.

**Por que zero LLM é uma decisão de projeto, não economia:** este check tem que rodar em **toda
entrega**, como o `npm test`. Régua que divide pool com o autopublishing roda uma vez por mês e
vira enfeite.

**Aceite:** `scripts/validade.mjs` roda em segundos, lista arquivo e linha, e passa limpo depois de
`PRT-03` e dos cards do sirius/tapepro (já corrigidos ontem). Entra na lista explícita do
`package.json` — ou nunca roda ([`D-73`](../data/dourado.json)).

⚠️ **A primeira corrida deste check vai medir o CHECK.** Leia os achados um a um antes de tratar
qualquer um como defeito de documento. Terceira vez que escrevo isso nesta base; da quarta, vira
protocolo.

### Fase 4 — o inventário do que é conversível (o mapa de tudo que vem depois)

Ninguém sabe quantas afirmações do corpus **poderiam** ser checadas contra o mundo. Sem esse
número, toda priorização daqui pra frente é palpite.

Varra os 276 documentos e classifique cada afirmação factual em três baldes:

1. **Conversível hoje** — existe fonte viva ligada no repo (GitHub, GSC, HTTP, arquivo). Vira
   check.
2. **Conversível com trabalho** — a fonte existe no mundo mas não está ligada (banco de produção,
   Stripe, Kiwify, Bing). Vira backlog com preço.
3. **Não conversível** — é regra, decisão ou julgamento. Fica prosa **de propósito**, e isso é
   legítimo: uma norma não tem fonte viva, ela **é** a fonte.

**A parte cara é a leitura, não o código**, e é ela que não pode ser pulada: o balde 3 é onde mora
a tentação de "medir tudo", que é como se constrói régua que mede a própria sombra.

**Aceite:** `docs/inventario-conversivel.md` com contagem por balde e por tipo de documento, e a
lista nominal do balde 1 ordenada por quantos documentos repetem a mesma afirmação — repetição é
o multiplicador do erro, e a spec anterior já tinha visto isso ("a síntese multiplica o alcance de
cada erro individual").

### Fase 5 — o detector de contradição entre documentos (só depois da Fase 1)

Rodar a passada de fidelidade **sozinha** sobre pares de documentos que falam do mesmo assunto,
sem passar pelo dourado. 276 documentos são 38 mil pares; o recorte que torna isso viável é o
índice denso que já existe — dois documentos que se contradizem são, por definição, vizinhos no
espaço vetorial. Piso de similaridade calibrado para caber em ~100 chamadas.

**Continua sendo a fase mais bonita de mostrar e continua não sendo a primeira.** Agora ela tem
conjunto de calibração (os 5 reais + os 3 falsos positivos de ontem), mas **8 exemplos com 5 da
mesma família não calibram nada** — é o holdout da Fase 1 que decide se ela pode rodar.

**Aceite:** `scripts/contradicoes.mjs` devolve pares com o trecho de cada lado e o veredito, com a
precisão medida no holdout impressa **no cabeçalho do relatório**, ao lado de todo número.

### Fase 6 — remedir, e declarar o que continua sem lastro

Só agora: `--juiz` na camada `estado` antes × depois, **por camada, nunca no agregado** (o
agregado é dominado por `protocolo`, 65 das 78, e esconde exatamente o que mudou).

E publique com a fronteira explícita **no mesmo parágrafo**: o que passou a ser verificado contra
a realidade, e o que continua sendo prosa concordando com prosa. Régua que não declara o próprio
limite vira meta em cima de um defeito.

---

## 5. O que NÃO fazer

- **Não publique nenhum percentual de defasagem antes da Fase 1.** Inclusive o 16,7% de ontem: ele
  é preliminar e está marcado como tal. Número com detector de 62,5% de precisão é um palpite com
  casas decimais.
- **Não rode a Fase 5 antes da Fase 1.** Você mediria o detector contra si mesmo — o erro que a
  sessão de 30/07 cometeu e levou 3 horas para desfazer.
- **Não reescreva handoff antigo para o corpus "bater" com hoje.** Handoff é registro datado e é o
  único lugar onde se vê o que se sabia quando a decisão foi tomada. Conserta-se a norma, o card e
  a convenção daí pra frente. Isso já foi decidido ontem e não deve ser reaberto.
- **Não extraia `D-67`/`D-70`/`D-71` da prosa.** Se o campo não existe, a resposta certa é
  `nao_apurado` — que é o que o código faz hoje, com o campo que falta escrito no motivo.
- **Não expanda o dourado para 150 perguntas.** Mais perguntas sobre a mesma base não-verificada
  multiplicam o teto, não o levantam.
- **Não mexa no prompt do juiz da síntese.** Ele passou os dois portões e não confundiu `contradiz`
  com `correta` nenhuma vez em 38 casos.
- **Não trate `nao_apurado`/`n/a` como aprovação.** É "não olhei" ou "não há onde olhar".
- **Não some régua de LLM sem matar uma.** O pool é o orçamento; hoje ele já serve autopublishing,
  rerank, síntese, juiz e defasagem — e morreu no meio de uma corrida ontem.

---

## 6. Custo e prazo, francamente

| fase | esforço | chamadas |
|---|---|---|
| 0 — fato × ressalva | ~1 h | 0 (invalida o cache dos 50) |
| **1 — os dois portões do detector** | **~1 sessão, e a maior parte é leitura humana** | **~30** |
| 2 — os 3 campos do `projects.json` | ~3 h, sendo o grosso confirmação com o Jean | **0** |
| 3 — check de validade | ~2 h | **0** |
| 4 — inventário do conversível | ~1 sessão inteira de leitura | 0 a 50 |
| 5 — detector de contradição | ~3 h de código | ~100 |
| 6 — remedir `estado` + publicar | ~2 h | 24 (8 × 3, só `estado`) |
| **Total honesto** | **2 a 3 sessões** | **~200, e nenhuma corrida de 234 de uma vez** |

**A tentação vai ser fazer a Fase 5 primeiro** — detector de contradição é o que se mostra. Não
faça. E a segunda tentação, mais perigosa, é **pular a Fase 1 porque "o detector pareceu razoável
nos 50"**: ele errou 3 de 8 flags, o que é a definição de não ser razoável, e o único motivo de
sabermos disso é que alguém leu as 8 linhas.

Se só couber **uma** coisa na próxima sessão: **Fase 2** (zero chamadas, destrava 3 das 8) ou
**Fase 1** (destrava todo o resto). Nessa ordem se o pool estiver ruim; invertida se estiver bom.

---

## 7. Armadilhas de operação

- **Reindexar depois de escrever handoff ou memória**: `node --env-file=.env scripts/indexar.mjs`
  (de máquina com Ollama, nunca do container). Memórias moram em `~/.claude`, fora do repo. **Este
  handoff inclusive** — o corpus foi de 272 para 276 documentos durante a sessão de ontem.
- **🆕 Nome de arquivo de corrida é UTC; `apurado_em` é BRT.** A corrida das 21:10 BRT de 31/07 se
  chama `data/corpus-defasado/2026-08-01-0008.json`. Comparar corridas pela data do nome **atrasa
  ou adianta um dia** — e é assim que se inventa uma regressão.
- **🆕 A janela de 28 dias do GSC desliza na meia-noite UTC.** O mesmo fim de tarde devolveu 33 e
  depois 42 impressões para o tapepro. Não é instabilidade da fonte.
- **🆕 Impressão pede `dimensions: []`; clique não-branded pede `query`.** Com a dimensão `query` o
  GSC omite as raras e a soma vira **piso** (5 contra 33). Trocar os dois inventa quedas.
- **Escrever handoff no meio de uma medição muda o corpus** (mexe em IDF e vetor). **Número
  absoluto não reproduz entre sessões** — comparar sempre contra a mesma execução (`--min bm25`).
- **Ler as linhas, não o agregado.** Pegou o bug de classificação que teria publicado 83,3% no
  lugar de 97,4%, pegou 5 dos 46 achados de conformidade, pegou as 15 recusas fantasma e ontem
  pegou 3 dos 8 `desmente`. `--ver`.
- **Erro não é cacheado, então é retentado** na corrida seguinte — foi o que permitiu terminar a
  corrida de ontem depois de o pool morrer.
- **`--motor todos` NÃO inclui o rerank.** `--motor rerank` explicitamente, com `--min bm25`.
- **Não dar push entre 00:00 e 01:00 BRT** (cron do autopublishing às 00:13).
- **Deploy é Docker no EasyPanel, não Vercel.**
- **`HUB_USER`/`HUB_PASS` estão no `.env` local** — dá para verificar produção sem pedir ao Jean.

---

## 8. Primeiros 20 minutos

1. `npm test` (**228 verdes**) e `npx tsc --noEmit` — para saber se o que quebrar depois foi você.
2. `node --env-file=.env scripts/dourado-estado.mjs --estado tudo --diff` — **~20 s, zero LLM**.
   As 5 apuradas ao lado do dourado escrito. É o retrato do que a casa acha × o que é, e é o
   melhor uso de 2 minutos deste handoff.
3. `data/corpus-defasado/2026-08-01-0008.json` — leia os 8 `desmente` e **decida por si** quais
   são o check errado antes de olhar a tabela da seção 2. Se sua leitura bater com a de lá, o
   holdout da Fase 1 vai ser rápido; se não bater, a definição de `desmente` é que precisa de
   conserto, e aí a Fase 1 é ainda mais urgente.
4. `data/dourado.json`, filtrar `camada: "estado"` e ler as 8 seguidas — 3 delas ainda não têm
   fonte viva, e é a Fase 2 que resolve.
5. Fase 0 + Fase 1 juntas (o cache manda), **ou** Fase 2 se o pool estiver ruim. Não pule para o
   detector bonito.
