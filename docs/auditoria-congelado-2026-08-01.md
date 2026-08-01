# Fase E — auditoria de tudo que se diz congelado, determinístico ou reprodutível (01/08/2026)

Motivo: em 01/08 descobriu-se **por acidente** que o fixture do juiz se dizia congelado e lia
`data/dourado.json` na hora da corrida. *"Se uma mentiu, outras podem"* — e por acidente é a pior
forma de descobrir.

**Método, e ele não é negociável:** para cada estrutura que se apresenta como imutável, **mudar a
origem e ver se o número muda**. Nenhum item abaixo foi aprovado por leitura de comentário.

**Zero chamadas de LLM.** A única corrida de LLM desta fase foi um portão existente rodando com
cache morno, para provar que a mudança de chave não queimou pool.

---

## Placar

| estrutura | afirma ser | **provado?** | resultado |
|---|---|---|---|
| `dourado_congelado` (8 de `estado`) | congelado inline | ✅ **sim** | resiste; teste já existia |
| gabarito de `protocolo`/`episodio` nos fixtures | *não* se diz congelado | ⚠️ **premissa, não garantia** | **consertado com lacre** |
| `.cache/rerank.json` | reprodutível por prompt+modelo | 🚩 **NÃO** | **`effort` ficava fora da chave — consertado** |
| `data/defasagem-*.json` (`congelado_em`) | apurado e trecho inlinados | ✅ **sim** | 0 casos dependem de arquivo externo |
| `ancora` como regra de construção | verifica todo caso | 🚩 **NÃO** | **7 de 20 casos entram sem verificação** — item da fase C |
| `Object.freeze` em `autopublish-projects.mjs` | objeto imutável | ✅ n/a | freeze raso, mas ninguém muta — **não é defeito** |
| `PROJECT_SLUGS` congelado | array imutável | ✅ sim | array de strings, freeze basta |

---

## 1. O congelamento de ontem cobriu 8 de 35 entradas — e isso estava declarado

**Medido:** `dourado_congelado` tem 8 entradas em `juiz-calibracao.json` e 3 em
`juiz-adversarial.json`. **27 entradas de fixture continuam lendo `data/dourado.json` na hora da
corrida** (20 no holdout+regressão, 7 no adversarial), todas de camada `protocolo` ou `episodio`.

**Prova mecânica:** reescrevi a `resposta` de `D-03` em memória e o gabarito que o portão usa mudou
junto — sem tocar numa linha do juiz.

**Mas isto NÃO é uma segunda mentira**, e dizer que é seria o mesmo erro que a fase existe para
evitar. `scripts/juiz-calibrar.mjs:33-39` declara a decisão em texto:

> `protocolo` e `episodio` continuam vindo do JSON de propósito: regra e episódio não mudam
> sozinhos, e duplicá-los criaria duas verdades para manter.

**O argumento é bom.** E a fase E manda **provar**, não acreditar — então provei, no histórico:

> 3 versões de `data/dourado.json` (`8c34007` → `0da4cae` → `48d9f71`), 21 ids lidos do arquivo
> mutável, **0 mudaram de texto.**

**Premissa SUSTENTADA pelo histórico disponível.** Com a ressalva honesta de que o histórico tem
dois dias e três commits — isso sustenta a premissa, não a prova para sempre.

### O conserto: lacre, não segunda cópia

O que faltava não era congelar (o argumento contra duplicar continua de pé): era **impedir que
mude em silêncio**. `dourado_lacrado` guarda **o hash do gabarito, não o texto** — não cria segunda
verdade para manter, e transforma a premissa comportamental em garantia mecânica.

- 20 lacres em `juiz-calibracao.json`, 7 em `juiz-adversarial.json`.
- Teste novo em `test/dourado.test.mjs`.
- **O check foi provado antes de contar como check:** reescrevi `D-03` no arquivo e o teste
  reprovou nomeando o caso e imprimindo o hash novo para colar caso a mudança seja deliberada.
  Revertido, volta verde.

⚠️ Mudar um gabarito de propósito agora exige **atualizar o lacre** — que é exatamente a decisão
que não pode ser tomada sem querer.

---

## 2. 🚩 O achado real: `effort` ficava fora da chave do cache

`lib/reranker.mjs` justificava a própria chave assim:

> O modelo entra na chave porque o juiz roda em `opus` e a síntese em `sonnet`: servir o veredito
> de um modelo para o outro esconderia justamente a troca que se quer medir.

**O argumento está certo e o `effort` ficou de fora** — `chave = sha1(modelo + prompt)`. E quatro
dos cinco chamadores rodam com `effort: "medium"` declarado **dentro do `run`**, onde a chave não
tem como enxergar:

| chamador | modelo | effort | entrava na chave? |
|---|---|---|---|
| `rerank` | sonnet | `low` (default) | modelo sim, effort **não** |
| `lib/resposta.mjs:62` | sonnet | `medium` | modelo sim, effort **não** |
| `lib/juiz.mjs:133` | **opus** | `medium` | modelo sim, effort **não** |
| `scripts/corpus-defasado.mjs:89` | sonnet | `medium` | modelo sim, effort **não** |
| `scripts/defasagem-calibrar.mjs:61` | sonnet | `medium` | modelo sim, effort **não** |

**A consequência é concreta e cai exatamente na fase D.** O handoff avisa que *"mudar o prompt do
detector invalida o `.cache` — cada tentativa custa ~24 chamadas"*, e quem lê isso conclui que o
resto é seguro. **Não é:** trocar o `effort` do detector devolveria as 24 respostas do effort
anterior, de graça e em silêncio, e a leitura seria *"mudar o effort não mudou nada"* — uma
conclusão errada com cara de medição barata.

Hoje não houve colisão real porque os prompts dos componentes são diferentes o bastante para não
se cruzarem. **Isso é sorte de construção, não garantia** — é o mesmo tipo de "não aconteceu ainda"
que o resto desta auditoria existe para não aceitar.

### O conserto, e ele custou 0 chamadas

1. **`effort` entra na chave.** `chave(prompt, modelo, effort)`.
2. **A chave sem effort virou formato legado: continua sendo LIDA, nunca escrita.** Reidratar o
   cache do zero custaria ~100 chamadas do pool — o orçamento que já matou corrida no meio.
3. **As opções vão para a chave E para o `run` na mesma linha.** Era a raiz: enquanto o chamador
   declarasse o effort só dentro do `run` (`(p) => rodarClaude(p, { effort: "medium" })`), chave e
   execução podiam divergir sem ninguém ver. Agora não têm como.
4. Teste novo em `test/reranker.test.mjs`.

**Verificado na prática, não no papel:** `node --env-file=.env scripts/defasagem-calibrar.mjs
--ver` rodou depois da mudança e devolveu **exatamente os mesmos números** — holdout 84,6% (11/13),
adversarial 8/10 — **sem gastar uma chamada**. Prova dupla: o fallback legado funciona e não houve
regressão.

---

## 3. Os fixtures de defasagem: congelados de verdade, com um buraco de construção

**Congelamento — aprovado.** Os 20 casos do holdout e os 10 adversariais têm `apurado` **e**
`doc.trecho` inlinados, recortados com o mesmo orçamento da produção (2400). **0 casos dependem de
arquivo externo:** mudar corpus, `dourado.json` ou qualquer apuração não move o portão.

**🚩 A regra de construção, essa, não roda em todos.** O script exclui, antes de qualquer chamada,
o caso cujo trecho não contém a `ancora`. Mas:

- **7 dos 20 casos do holdout não têm `ancora`** e entram **sem verificação nenhuma de construção**;
- **os 10 adversariais também não têm** — ali a âncora nem é consultada.

O handoff lista *"preencher a `ancora` de cada caso"* entre as regras que **não se negociam** para
a fase C. **Ela não está satisfeita nos casos que já existem** — foi ela que pegou os 6 inválidos,
e ela cobre 13 dos 20. Adicionar 20 pares novos com âncora sem preencher as 7 que faltam deixaria o
portão medindo dois padrões de rigor ao mesmo tempo.

⚠️ **Isto é item da fase C, e não se conserta reescrevendo rótulo:** preencher a `ancora` de um
caso já rodado é escolher a frase depois de ter visto o veredito. Para os 7, a saída honesta é
âncora derivada do **rótulo original** ou o caso sai do denominador.

**Nota de estrutura, à parte:** o `id` do caso é o id da **pergunta**, não do caso — `D-67` e
`D-72` aparecem duas vezes cada no holdout. Isso não afeta número nenhum (o portão itera a lista),
mas torna impossível falar de um caso específico sem ambiguidade.

---

## 4. Verificado e sem achado

- **`Object.freeze(project)` em `autopublish-projects.mjs:28`** — freeze **raso**: `layoutRenders`
  é array e continua mutável. **Não é defeito hoje**: o único consumidor
  (`autopublish-render.mjs:107`) lê com `.includes()` e ninguém escreve. Registrado, não consertado.
- **`PROJECT_SLUGS`** — array de strings, freeze raso basta.
- **`.cache/embeddings-nomic_embed_text.json`** — cache de embeddings, chaveado por modelo no nome
  do arquivo; troca de modelo troca de arquivo.
- **`VER-05` ("bytes é determinístico")** — afirmação sobre Lighthouse, não estrutura deste repo.

---

## 5. O que sai daqui

| # | item | estado |
|---|---|---|
| E-1 | lacre dos 27 gabaritos lidos do arquivo mutável | ✅ **feito, com teste provado** |
| E-2 | `effort` na chave do cache, legado ainda lido | ✅ **feito, com teste, 0 chamadas** |
| E-3 | preencher a `ancora` dos 7 casos sem ela | ⏳ **fase C** — não se conserta depois de rodado |
| E-4 | `id` de caso ≠ `id` de pergunta nos fixtures de defasagem | ⏳ cosmético, junto da fase C |

**A fase entregou um resultado negativo grande** (a decisão de não congelar `protocolo`/`episodio`
estava certa e o histórico a sustenta) **e um positivo que ninguém procurava** (o `effort`). O
resultado negativo custou o mesmo trabalho do positivo, e é por isso que ele estava aqui.
