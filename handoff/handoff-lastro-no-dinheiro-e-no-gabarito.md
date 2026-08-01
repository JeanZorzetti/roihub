# Handoff — o texto já tem régua; falta lastro no DINHEIRO e no gabarito que eu mesmo escrevi (aberto em 31/07/2026, 23h)

Este documento é **especificação de trabalho, não relatório**. Ele assume que quem chega não tem
contexto, e **esforço não é critério de corte**: onde o caminho barato e o caminho certo divergem,
ele defende o certo e diz o preço na cara.

Estado imediatamente anterior:
[`handoff-checar-em-vez-de-julgar-executado.md`](handoff-checar-em-vez-de-julgar-executado.md)
(fases 0, 2 e 3 executadas) · spec que a originou:
[`handoff-checar-em-vez-de-julgar.md`](handoff-checar-em-vez-de-julgar.md) ·
frente do dourado: [`handoff-dourado-com-lastro-externo-executado.md`](handoff-dourado-com-lastro-externo-executado.md) ·
frente do juiz: [`handoff-juiz-de-verdade-executado.md`](handoff-juiz-de-verdade-executado.md) ·
arquitetura: [`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md) ·
índice: [`../handoff.md`](../handoff.md).

---

## 1. O que existe hoje, dito sem propaganda

Sete réguas. A coluna que importa é a última:

| régua | pergunta que responde | LLM? | toca a REALIDADE? |
|---|---|---|---|
| `scripts/avaliar.mjs` | o documento certo está entre os 10? | rerank | não — mede texto contra texto |
| `scripts/avaliar-resposta.mjs` | a citação aponta para documento que o dourado reconhece? | 1×/pergunta | não |
| `scripts/avaliar-resposta.mjs --juiz` | o que ela escreveu bate com o que a casa **acha** que sabe? | 3×/pergunta | não |
| `scripts/corpus-defasado.mjs` | quantos documentos o mundo desmente? | 1×/documento | **em parte** — só nas 5 perguntas com apuração |
| `scripts/conformidade.mjs` | a norma é obedecida na produção? | **zero** | **sim** — HTTP contra 35 hosts |
| `scripts/dourado-estado.mjs` | o número que a casa afirma ainda é o número real? | **zero** | **sim, em 7 das 8** |
| `scripts/validade.mjs` | algum documento vivo congelou um número de hoje? | **zero** | não — mas impede o defeito de nascer |

**238 testes verdes. Corpus: 278 documentos (97 protocolo, 50 handoff, 131 memória). Dourado: 78
perguntas (65 protocolo, 8 estado, 5 episódio). `validade`: 0 achados em 230 documentos vivos.**

O trabalho de 30 e 31/07 foi bom e a base está melhor do que estava. E é exatamente por isso que
este documento precisa ser duro: **as duas coisas que faltam são as duas que ninguém quer olhar.**

---

## 2. As duas frases que a próxima sessão NÃO pode repetir errado

### 2.1 O 16,7% continua PRELIMINAR — e a fase 0 consertou 1 de 3 causas, não 3

A primeira corrida do `corpus-defasado.mjs` deu 8 `desmente` em 30 documentos; ler os 8 baixou para
5. **Precisão do detector nos próprios flags: 62,5%.** Em 31/07 a causa de UM dos três falsos
positivos foi consertada estruturalmente (a ressalva saiu de dentro do fato apurado).

**Os outros dois continuam de pé e não têm conserto estrutural conhecido:**

| falso positivo | como falhou | consertado? |
|---|---|---|
| `handoff-deep-research-harness` | confundiu a ressalva de medição embutida no fato com discordância | **sim** — `ressalva` virou campo |
| `handoff-autopublish` | comparou o gate dos canários do autopublish com o gate do tapepro | **não** |
| `handoff-normas-que-rodam` | devolveu `VEREDITO: desmente` com o `MOTIVO` dizendo "o veredito correto é nao-fala" | **não** |

Um detector com 62,5% de precisão rodado sobre 272 documentos produz uma lista em que um terço é
ruído, e lista com ruído não é lida duas vezes. **Nenhum percentual de defasagem se publica antes
dos dois portões.**

### 2.2 🆕 O gabarito de `D-70` agora depende de julgamento MEU, e isso é uma circularidade nova

Em 31/07 as perguntas `D-70` e `D-71` saíram de `nao_apurado` porque eu curei `familia`, `estado` e
`blockersLista: {texto,humano}` nos 35 cards. O apurador conta a distribuição — e a distribuição é
apuração honesta. **Mas os valores contados são leitura minha de `receitaNota` + `decayNota` +
`acao`.**

Isto é diferente, em espécie, das outras 5 apuradas. `D-66` conta repos na API do GitHub; `D-68` lê
o GSC; `D-73` compara `package.json` com o disco. Nenhuma delas passa pelo meu julgamento. `D-70`
passa — e `D-70` é **gabarito**: se minha classificação estiver errada, o juiz vai aprovar com nota
máxima uma resposta errada, e o erro terá a autoridade de um número apurado.

**Seis cards divergem do dourado escrito** (`whatsmeow` e `vertice` saíram de "não tem quem venda";
`moderador`, `cannibal_scan` e `seo-forecaster` foram para "cobrança"; `goiania` foi para "venda").
Divergir não é errado — o dourado escrito também envelhece. **O problema é que não há régua
nenhuma decidindo qual dos dois está certo.**

---

## 3. A tese deste handoff

> **As réguas de texto estão maduras. As duas fronteiras abertas são: (a) o hub prioriza 35
> projetos por um número de RECEITA que nunca foi checado contra um sistema de pagamento, e (b) o
> gabarito mais novo é julgamento humano sem holdout. Nenhuma das duas se resolve com mais LLM.**

Três consequências, e elas ordenam o trabalho inteiro:

1. **Dinheiro tem fonte viva, e ela nunca foi ligada.** Mercado Pago, Kiwify e o banco do sirius
   sabem a data de cada venda. A resposta "o Jean não lembra as datas" fecha a pergunta errada: a
   pergunta não é o que o Jean lembra, é o que o sistema de pagamento registra.
2. **Todo gabarito derivado de julgamento precisa do mesmo portão que o juiz teve.** A base já sabe
   disso para LLM. Curadoria humana não é exceção — é só um juiz mais caro e mais confiante.
3. **A quarta vez chegou.** "A primeira corrida de um check novo mede o CHECK" foi aprendida no
   `conformidade.mjs` (5 de 46), no `corpus-defasado.mjs` (3 de 8), e em 31/07 no `validade.mjs`
   (2 de 3, mais um quarto achado 20 minutos depois). A spec anterior escreveu: *"terceira vez que
   escrevo isso nesta base; da quarta, vira protocolo."* **Virou. Escreva o protocolo.**

---

## 4. O desenho, com o argumento de cada decisão

### Fase A — 🔑 `D-67` contra o sistema de pagamento, não contra a memória do Jean

**Esta é a fase mais importante do documento, e é a que estava sendo tratada como fechada.**

O estado atual: `D-67` devolve `nao_apurado` porque falta `vendas: [{ data, valor }]` nos cards, e
em 31/07 o Jean disse que não tem as datas de cabeça. A conclusão registrada foi "fica
`nao_apurado`, e é a resposta certa".

**É a resposta certa para a pergunta errada.** Olhe o que a casa já sabe:

| projeto | sistema de pagamento | o que o card afirma hoje |
|---|---|---|
| `orcaobra` | **Kiwify** (checkout vivo, 200) | "ÚNICO dos 9 que fatura hoje", `receita: 7` |
| `atma` | **Mercado Pago** (checkout próprio, API responde 400 de validação) | "Venda não confirmada", `receita: 6` |
| `sirius` | banco de produção (Next15 + Prisma) | "3 vendas orgânicas — único projeto com receita real provada", `receita: 9` |
| `tapepro` | Growth Partner, 15% aquisição / 10% recorrência | "sem venda registrada", `receita: 6` |

Cada uma dessas linhas é uma afirmação sobre dinheiro **que nenhuma régua desta casa jamais
checou**. E o campo `receita` — nota 0-10 — é peso no `computeScore`, ou seja: **o hub diz ao Jean
o que fazer hoje usando um palpite sobre faturamento.** Se o sirius não tem 3 vendas, ou se o
orcaobra tem 11, o ranking dos 35 está errado desde sempre e ninguém saberia.

**O que fazer, na ordem:**

1. **Ligar UMA fonte, inteira, antes de ligar a segunda.** Comece pelo **Mercado Pago**: este
   harness tem as ferramentas `mcp__mercadopago__*` disponíveis, e a memória
   [[roilabs_mercadopago_prod_env_vars]] já registra onde moram as credenciais de produção. Kiwify
   e o banco do sirius vêm depois, cada um no seu commit.
2. **`vendas: [{ data, valor, fonte }]` no card** — `fonte` é obrigatório e é o nome do sistema,
   nunca "Jean disse". Venda sem `fonte` não conta, pela mesma régua de `nao_apurado`.
3. **O apurador de `D-67` já lê `vendas` e já ignora venda sem data** (há teste). Não reescreva;
   preencha.
4. **Separe `receita` de `receitaProvada`.** Hoje um campo só carrega duas coisas: prioridade
   editorial (0-10, julgamento) e evidência de faturamento (fato). Enquanto forem o mesmo número,
   nenhum dos dois é auditável. `receita` continua sendo a nota do score; `receitaProvada` sai da
   soma de `vendas` e **não é curável à mão**.

**Aceite:** `node --env-file=.env scripts/dourado-estado.mjs --estado tudo` imprime **8 de 8
apuradas**, e pelo menos um projeto tem `vendas` vindo de um sistema de pagamento real, com a data
que o sistema registrou. E o `--diff` mostra, lado a lado, o que o card afirmava contra o que o
gateway pagou.

**Preço honesto:** ~1 sessão por fonte, e a primeira é a mais cara (credencial, formato, fuso da
data, estorno, teste). Zero chamadas de LLM. **É caro e é a única frente deste documento que fala
de dinheiro de verdade.**

⚠️ **Estorno e teste sujam o número.** Venda estornada é venda que não existiu; pagamento de teste
(o próprio Jean validando o checkout) é ruído. O apurador precisa do status, não só do valor — e
`atma` é o caso vivo: a rota grava cliente e relatório no banco **antes** de chamar o MP, então a
base tem registro sem pagamento correspondente.

### Fase B — 🔑 os dois portões do detector de defasagem (pré-requisito de todo percentual)

Herdada intacta da spec anterior, e continua sendo o único jeito de o 16,7% deixar de ser palpite.

Construa `scripts/defasagem-calibrar.mjs` no molde de `scripts/juiz-calibrar.mjs` (que hoje gasta
38 chamadas: 8 holdout + 20 regressão + 10 adversariais):

- **Holdout cego:** rotule à mão **20 pares** (documento × fato apurado) **antes** de ver o
  veredito do modelo, com distribuição proposital — o material real é monocultura (5 dos 5 achados
  são a família `(hoje N)`). Force dentro do holdout: documento datado descrevendo o passado
  (**não** é `desmente`), documento que fala de outro gate (**não** — foi o falso positivo do
  `handoff-autopublish`), documento que afirma o número certo com ressalva (**não** — agora que a
  `ressalva` é campo, este caso tem que passar), documento com número errado afirmado no presente
  (**é**), documento que nega prática que a fonte viva prova existir (**é**).
- **Adversarial:** 10 documentos corrompidos de propósito (trocar o número, inverter a negação,
  trocar o projeto). Detector que não pega ≥ 9 aprova corpus podre.
- **Rótulo revisado depois de ler o veredito é contaminado**, fica marcado e **não decide** — é a
  mesma regra do juiz, e ajustar o gabarito depois da prova é o erro que custou 3 horas em 30/07.

**Aceite:** holdout ≥ 85% e adversarial ≥ 9/10, versionados em `data/`. Sem isso, **nenhum
percentual de defasagem sai** — nem o 16,7%.

⚠️ **Refaça o `.cache/rerank.json` UMA VEZ SÓ, aqui.** A fase 0 de 31/07 mudou
`montarPromptDefasagem`, o que invalida os 50 documentos já julgados (`.cache/rerank.json`, 250 KB).
Rodar o detector antes dos portões só para "ver o número mudar" queima o cache duas vezes e não
prova nada.

**Preço honesto:** ~1 sessão, e **a maior parte é leitura humana** — rotular 20 pares com atenção é
o trabalho; o código é a parte fácil. ~30 chamadas.

### Fase C — 🆕 o holdout da CURADORIA, que é o portão que `D-70` nunca teve

A fase 2 de 31/07 ligou `D-70` e `D-71` com julgamento meu sobre 35 cards. Sem isto, a base trocou
"prosa concordando com prosa" por "número concordando com o julgamento de um agente" — que é melhor,
mas não é lastro.

**O desenho, e ele é deliberadamente incômodo:**

1. **Derivação cega e independente.** Um segundo agente classifica `familia` e `estado` dos 35
   cards **sem ver os valores atuais** (leia `receitaNota` + `decayNota` + `acao` + `blockersLista`
   de um dump que não inclua os campos novos). Zero chamadas se for feito por leitura na própria
   sessão; o que não pode é olhar a resposta antes.
2. **Meça a concordância entre as duas derivações**, campo a campo, e **imprima o número**. Duas
   leituras independentes que concordam em 34 de 35 são um gabarito; que concordam em 22 de 35
   significam que a taxonomia é ambígua e o problema é a **definição**, não o rótulo.
3. **O Jean decide os divergentes** — e só os divergentes. Levar 35 perguntas ao Jean é desperdiçar
   a única régua que não escala; levar os 6 a 13 que divergem é usá-la onde ela decide.
4. **A quarta família (`nao-vende`) entra no teste.** Ela não estava na spec: nasceu da leitura dos
   35 (CV, demo, pesquisa, vitrine — 7 projetos que não tentam faturar por decisão). Se a derivação
   cega não reinventá-la sozinha, ela é invenção minha e precisa ou de definição melhor ou de
   morrer.

**Aceite:** `docs/curadoria-familia-concordancia.md` com a matriz das duas derivações, o percentual
de concordância e a lista nominal dos divergentes decididos pelo Jean. E a definição de cada família
escrita como **teste**, não como adjetivo: "cobrança = não existe caminho de pagamento no repo NEM
gateway ligado" é testável; "não tem como cobrar" é opinião.

**Preço honesto:** ~3 h, quase tudo leitura. Zero chamadas. **É a fase que ninguém vai querer fazer,
porque ela audita trabalho recém-entregue e a resposta pode ser "refaça".**

### Fase D — o protocolo da primeira corrida (a quarta vez chegou)

Quatro checks, quatro vezes o mesmo aprendizado, sempre em prosa, sempre reaprendido:

| check | primeira corrida | quanto era o CHECK errado |
|---|---|---|
| `conformidade.mjs` | 46 violações | 5 |
| `corpus-defasado.mjs` | 8 `desmente` | 3 |
| `validade.mjs` (31/07) | 3 achados | 2 — mais um 4º tipo novo 20 min depois |

Escreva `data/protocolos/VER-XX.json` no formato da casa, com `norma`, `motivo`, `origem` e — o
campo que importa — **`verificacao.como` que não seja executável, e diga isso**. Nem toda norma
vira função; o que ela não pode é continuar sendo folclore oral repetido em handoff.

A norma, em uma frase: **a primeira corrida de um check novo mede o check; os achados se leem um a
um e se datam como "medindo o check" antes de qualquer um virar tarefa; nenhum percentual sai dessa
corrida.**

**Preço:** ~30 min. **É a coisa mais barata deste documento e a que evita a quinta vez.**

### Fase E — o inventário do que é conversível (o mapa de tudo que vem depois)

Ninguém sabe quantas afirmações do corpus **poderiam** ser checadas contra o mundo. Sem esse número,
toda priorização daqui pra frente é palpite — inclusive a ordem deste documento.

Varra os 278 documentos e classifique cada afirmação factual em três baldes:

1. **Conversível hoje** — existe fonte viva já ligada (GitHub, GSC, HTTP, arquivo do repo). Vira
   check.
2. **Conversível com trabalho** — a fonte existe no mundo e não está ligada (Mercado Pago, Kiwify,
   banco de produção, Bing). Vira backlog **com preço**. A fase A é o primeiro item deste balde, e
   a existência dele é o argumento de que ela vem primeiro.
3. **Não conversível** — é regra, decisão ou julgamento. Fica prosa **de propósito**: uma norma não
   tem fonte viva, ela **é** a fonte.

**A parte cara é a leitura, não o código**, e é ela que não pode ser pulada: o balde 3 é onde mora a
tentação de "medir tudo", que é como se constrói régua que mede a própria sombra.

**Aceite:** `docs/inventario-conversivel.md` com contagem por balde e por tipo de documento, e a
lista nominal do balde 1 ordenada por **quantos documentos repetem a mesma afirmação** — repetição é
o multiplicador do erro.

**Preço honesto:** ~1 sessão inteira de leitura. 0 a 50 chamadas.

### Fase F — o detector de contradição entre documentos (só depois da Fase B)

Rodar a passada de fidelidade **sozinha** sobre pares de documentos que falam do mesmo assunto, sem
passar pelo dourado. 278 documentos são ~38 mil pares; o recorte que torna isso viável é o índice
denso que já existe — dois documentos que se contradizem são, por definição, vizinhos no espaço
vetorial. Piso de similaridade calibrado para caber em ~100 chamadas.

**Continua sendo a fase mais bonita de mostrar e continua não sendo a primeira.** O conjunto de
calibração disponível (5 achados reais + 3 falsos positivos) tem 8 exemplos com 5 da mesma família:
não calibra nada. É o holdout da fase B que decide se ela pode rodar.

**Aceite:** `scripts/contradicoes.mjs` devolve pares com o trecho de cada lado e o veredito, com a
precisão medida no holdout impressa **no cabeçalho do relatório**, ao lado de todo número.

### Fase G — remedir, e declarar o que continua sem lastro

Só agora: `--juiz` na camada `estado` antes × depois, **por camada, nunca no agregado** (o agregado
é dominado por `protocolo`, 65 das 78, e esconde exatamente o que mudou).

E publique com a fronteira explícita **no mesmo parágrafo**: o que passou a ser verificado contra a
realidade, e o que continua sendo prosa concordando com prosa. Régua que não declara o próprio
limite vira meta em cima de um defeito.

---

## 5. O que NÃO fazer

- **Não trate `D-67` como fechada porque o Jean não lembra as datas.** A pergunta é o que o gateway
  registra, não o que alguém lembra. Fechar aqui é aceitar que a única régua sobre dinheiro nesta
  casa é a memória de uma pessoa.
- **Não publique nenhum percentual de defasagem antes da fase B**, inclusive o 16,7%. Número com
  detector de 62,5% de precisão é um palpite com casas decimais.
- **Não rode a fase F antes da B.** Você mediria o detector contra si mesmo — o erro de 30/07, que
  levou 3 horas para desfazer.
- **Não trate a curadoria de 31/07 como lastro antes da fase C.** Ela é boa-fé e é leitura de um
  agente; o gabarito ficou mais forte, mas o portão dele ainda não existe.
- **Não reescreva handoff antigo para o corpus "bater" com hoje.** Handoff é registro datado e é o
  único lugar onde se vê o que se sabia quando a decisão foi tomada. Conserta-se a norma, o card e a
  convenção daí pra frente.
- **Não extraia `vendas`, `familia` ou `humano` da prosa com regex.** Já foi medido: grep por
  `manual|jean` devolve 18 cards contra os 8 reais — mede o texto, não o bloqueio.
- **Não expanda o dourado para 150 perguntas.** Mais perguntas sobre a mesma base não-verificada
  multiplicam o teto, não o levantam.
- **Não mexa no prompt do juiz da síntese.** Ele passou os dois portões e não confundiu `contradiz`
  com `correta` nenhuma vez em 38 casos.
- **Não trate `nao_apurado`/`n/a` como aprovação.** É "não olhei" ou "não há onde olhar".
- **Não some régua de LLM sem matar uma.** O pool é o orçamento; ele já serve autopublishing,
  rerank, síntese, juiz e defasagem — e morreu no meio de uma corrida em 30/07.
- **Não afrouxe o `validade.mjs` para calar um achado.** Em 31/07 a absolvição por data na linha
  teria absolvido o único defeito real (o card do aftercare tem três datas na mesma linha). Achado
  incômodo se resolve datando o documento, não relaxando a regex.

---

## 6. Custo e prazo, francamente

| fase | esforço | chamadas |
|---|---|---|
| **A — `D-67` contra o gateway** | **~1 sessão por fonte; a 1ª é a mais cara** | **0** |
| **B — os dois portões do detector** | **~1 sessão, e a maior parte é leitura humana** | **~30** |
| **C — holdout da curadoria** | **~3 h de leitura, e pode terminar em "refaça"** | **0** |
| D — protocolo da primeira corrida | ~30 min | 0 |
| E — inventário do conversível | ~1 sessão inteira de leitura | 0 a 50 |
| F — detector de contradição | ~3 h de código | ~100 |
| G — remedir `estado` + publicar | ~2 h | 24 (8 × 3, só `estado`) |
| **Total honesto** | **4 a 5 sessões** | **~200, e nenhuma corrida de 234 de uma vez** |

**A ordem defendida é A → B → C → D → E → F → G**, e o argumento é este: A é a única frente que toca
dinheiro e não gasta pool; B destrava todo percentual; C protege o gabarito criado ontem antes que
alguém construa em cima dele; D custa meia hora e evita a quinta repetição. E, F e G são o trabalho
bonito, e são os últimos de propósito.

**Se o pool estiver ruim, A → C → D não gastam uma chamada sequer** e ainda assim são as três
melhores coisas a fazer. Isso não é coincidência: o que sobrevive nesta base é o que custa zero pool.

**A tentação vai ser fazer a fase F primeiro** — detector de contradição é o que se mostra. Não
faça. A segunda tentação, mais perigosa, é **pular a fase C porque a curadoria é recente e foi feita
com cuidado**: cuidado não é portão, e "foi feito com cuidado" é exatamente o que se dizia do
detector que errou 3 de 8.

---

## 7. Armadilhas de operação

- **Reindexar depois de escrever handoff ou memória**: `node --env-file=.env scripts/indexar.mjs`
  (de máquina com Ollama, nunca do container). Memórias moram em `~/.claude`, fora do repo. **Este
  handoff inclusive.**
- **🆕 `blockersLista` é `{texto, humano}` e tem TRÊS consumidores**: `lib/projects.ts` (tipo
  `Blocker`), `app/page.tsx` (render do foco do dia) e `lib/evaluate.ts` (flags de crawl entram com
  `humano: false`). Mexer no formato sem os três quebra a home, e o `npm test` **não pega** — quem
  pega é o `npx tsc --noEmit`.
- **🆕 Citação de exemplo vai entre crases.** O `validade.mjs` mascara span de crase justamente para
  o documento que ENSINA a norma poder citá-la. Escrever `(hoje 21)` sem crase num documento vivo
  reprova o check.
- **🆕 `data/projects.json` é UTF-8 e o `Get-Content` do PowerShell mostra mojibake.** Editar a
  partir do que o terminal imprime corrompe o arquivo. Edite pela ferramenta de arquivo e valide com
  `JSON.parse` depois; o round-trip `JSON.stringify(…, null, 2)` preserva a formatação byte a byte
  (conferido em 31/07).
- **Nome de arquivo de corrida é UTC; `apurado_em` é BRT.** A corrida das 21:10 BRT de 31/07 se
  chama `data/corpus-defasado/2026-08-01-0008.json`. Comparar corridas pela data do nome atrasa ou
  adianta um dia — e é assim que se inventa uma regressão.
- **A janela de 28 dias do GSC desliza na meia-noite UTC.** O mesmo fim de tarde devolveu 33 e depois
  42 impressões para o tapepro. Não é instabilidade da fonte.
- **Impressão pede `dimensions: []`; clique não-branded pede `query`.** Com a dimensão `query` o GSC
  omite as raras e a soma vira **piso** (5 contra 33). Trocar os dois inventa quedas.
- **Escrever handoff no meio de uma medição muda o corpus** (mexe em IDF e vetor). **Número absoluto
  não reproduz entre sessões** — comparar sempre contra a mesma execução (`--min bm25`).
- **Ler as linhas, não o agregado.** Pegou o bug de classificação que teria publicado 83,3% no lugar
  de 97,4%, pegou 5 dos 46 achados de conformidade, pegou as 15 recusas fantasma, pegou 3 dos 8
  `desmente` e pegou 2 dos 3 primeiros achados do `validade`. `--ver`.
- **Erro não é cacheado, então é retentado** na corrida seguinte — foi o que permitiu terminar a
  corrida de 30/07 depois de o pool morrer.
- **`--motor todos` NÃO inclui o rerank.** `--motor rerank` explicitamente, com `--min bm25`.
- **Arquivo de teste novo entra à mão na lista do `package.json`**, senão nunca roda (`D-73`).
- **Não dar push entre 00:00 e 01:00 BRT** (cron do autopublishing às 00:13).
- **Deploy é Docker no EasyPanel, não Vercel.**
- **`HUB_USER`/`HUB_PASS` estão no `.env` local** — dá para verificar produção sem pedir ao Jean.

---

## 8. Primeiros 20 minutos

1. `npm test` (**238 verdes**), `npx tsc --noEmit` e `node scripts/validade.mjs` (**0 achados**) —
   para saber se o que quebrar depois foi você.
2. `node --env-file=.env scripts/dourado-estado.mjs --estado tudo --diff` — **~20 s, zero LLM**. As
   7 apuradas ao lado do dourado escrito. É o retrato do que a casa acha × o que é, e é o melhor uso
   de 2 minutos deste handoff.
3. **Leia `D-70` no `--diff` com desconfiança.** A distribuição é apurada; a classificação por card
   é julgamento de um agente feito em 31/07. Se você discordar de algum, **você acabou de começar a
   fase C** — anote a divergência antes de olhar a tabela da seção 3-bis do handoff executado.
4. `data/corpus-defasado/2026-08-01-0008.json` — leia os 8 `desmente` e **decida por si** quais são
   o check errado. Se sua leitura bater com a da seção 2.1, o holdout da fase B vai ser rápido; se
   não bater, a definição de `desmente` é que precisa de conserto.
5. Abra o Mercado Pago (`mcp__mercadopago__*`) e responda a pergunta mais barata da fase A: **existe
   pagamento aprovado no atma?** A resposta muda o `receita: 6` do card ou confirma o "venda não
   confirmada" — e das duas, a que confirma vale tanto quanto a que corrige.
