# Handoff — o detector responde ANTES de pensar, e o juiz não usa o gabarito que a casa apura (aberto em 01/08/2026, 00h40)

Este documento é **especificação de trabalho, não relatório**. Ele assume que quem chega não tem
contexto, e **esforço não é critério de corte**: onde o caminho barato e o caminho certo divergem,
ele defende o certo e diz o preço na cara.

Estado imediatamente anterior:
[`handoff-lastro-no-dinheiro-e-no-gabarito-executado.md`](handoff-lastro-no-dinheiro-e-no-gabarito-executado.md)
(fases A, B, C e D executadas) · spec que a originou:
[`handoff-lastro-no-dinheiro-e-no-gabarito.md`](handoff-lastro-no-dinheiro-e-no-gabarito.md) ·
calibração: [`../docs/defasagem-calibracao.md`](../docs/defasagem-calibracao.md) ·
curadoria: [`../docs/curadoria-familia-concordancia.md`](../docs/curadoria-familia-concordancia.md) ·
arquitetura: [`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md) ·
índice: [`../handoff.md`](../handoff.md).

---

## 1. Onde a casa está, sem propaganda

Oito réguas. A coluna que importa continua sendo a última — e agora tem uma coluna nova, que é a
que dói:

| régua | pergunta | LLM? | toca a REALIDADE? | **está CALIBRADA?** |
|---|---|---|---|---|
| `scripts/conformidade.mjs` | a norma é obedecida na produção? | zero | **sim** — HTTP contra 35 hosts | n/a (rede pura) |
| `scripts/dourado-estado.mjs` | o número que a casa afirma ainda é real? | zero | **sim em 7 das 8** | n/a |
| `scripts/vendas-mercadopago.mjs` 🆕 | o gateway pagou? | zero | **sim, em 1 dos 35** | n/a |
| `scripts/validade.mjs` | algum documento vivo congelou um `(hoje N)`? | zero | não | n/a |
| `lib/juiz.mjs` (`--juiz`) | a resposta bate com o que a casa acha que sabe? | 3×/pergunta | não | **✅ 87,5% / 10-10** |
| `scripts/avaliar.mjs` | o documento certo está entre os 10? | rerank | não | n/a |
| `scripts/avaliar-resposta.mjs` | a citação aponta para fonte reconhecida? | 1×/pergunta | não | n/a |
| `scripts/corpus-defasado.mjs` | quantos documentos o mundo desmente? | 1×/documento | **em parte** | **🚩 71,4% / 3-10 — REPROVADO** |

**247 testes verdes. Corpus: 284 documentos (98 protocolo, 52 handoff, 134 memória). Dourado: 78
perguntas, `estado` 8/8 apuradas. `validade`: 0 achados em 231 documentos vivos. Receita provada
medida contra gateway: R$ 0,00, em 1 de 35 projetos.**

O trabalho de 30, 31/07 e 01/08 foi bom. E é por isso que este documento tem que ser duro: **duas
das três coisas que faltam já estavam aqui ontem e ninguém olhou.**

---

## 2. As três frases que a próxima sessão NÃO pode repetir errado

### 2.1 🔑 O detector de defasagem responde ANTES de pensar — e isso está no formato de saída

Duas redações do prompt reprovaram. A segunda foi escrita mirando o modo de falha nomeado e
**piorou** o portão que mais decide (71,4% → 50,0%). Isso normalmente significa "o problema não é a
redação". Está certo — e o problema **está no formato de saída, não no texto das regras**:

```
Responda em exatamente três linhas:
VEREDITO: bate|desmente|nao-fala     ← linha 1
TRECHO:   ...                         ← linha 2
MOTIVO:   ...                         ← linha 3
```

**O modelo é obrigado a cravar o veredito antes de escrever o raciocínio que o justifica.** É
exatamente a forma do bug já observado três vezes:

> `VEREDITO: bate` · `MOTIVO: o número "hoje 9, BATIDO" é incompatível com o apurado hoje (2, não
> batido) — desmente.`

A linha 3 chega ao veredito certo porque foi escrita depois de pensar. A linha 1 foi escrita antes.
**Não há redação de regra que conserte um raciocínio que acontece depois da decisão.**

Isto é uma hipótese, não um fato — e ela é barata de refutar. **É a primeira coisa a fazer.**

### 2.2 🔑 O juiz e o avaliador NÃO usam o dourado apurado. A frente inteira de `dourado-estado` não chega à medição.

`lib/dourado-estado.mjs` existe por uma razão declarada no próprio cabeçalho: *"JSON escrito ontem
apodrece igual a prosa escrita ontem"*. Oito perguntas de `estado` são apuradas na hora da medição
justamente para o gabarito não envelhecer.

**E nenhuma das duas réguas que julgam a resposta chama `apurarEstado()`.**

- `scripts/avaliar-resposta.mjs:42` lê `data/dourado.json` e itera sobre ele.
- `lib/juiz.mjs:50` recebe `dourado.resposta` — **o texto escrito à mão**.

Ou seja: as 8 perguntas cuja resposta certa a casa sabe apurar continuam sendo julgadas contra a
prosa. `D-66` no `dourado.json` ainda diz *"Em 30/07 eram 36 repos ativos"*; quando forem 37, o juiz
vai **reprovar a resposta certa** e ninguém vai entender por quê.

Foi preciso encostar em `D-67` nesta sessão para o defeito aparecer — e ele apareceu por acidente,
o que é a pior forma de achar coisa assim. **A frente de 31/07 construiu o gabarito que não
apodrece e esqueceu de ligá-lo ao juiz.**

### 2.3 O dinheiro tem lastro em 1 de 35, e a régua nova roda com uma credencial vazada

`scripts/vendas-mercadopago.mjs` funciona e apurou R$ 0,00 no `atma`. Os outros **34 cards não têm
fonte de pagamento ligada**, e `D-67` os nomeia na `ressalva` justamente para que "não olhei" nunca
seja lido como "não vendeu".

Duas coisas ficam de pé, e as duas são desconfortáveis:

1. **O `sirius` foi tentado e falhou por REDE**, não por credencial: `31.97.23.166:5434` devolve
   `ETIMEDOUT` da máquina de dev. É a única afirmação de receita do portfólio e continua sendo
   prosa do card.
2. 🚨 **`SEC-04` registra que o repo PÚBLICO `JeanZorzetti/Atma` teve token de PRODUÇÃO do Mercado
   Pago em `origin/main` e em todo o histórico.** É o token que a régua nova usa hoje. **Nada foi
   rotacionado.** A casa acabou de construir uma régua sobre dinheiro em cima de uma credencial que
   ela mesma classificou como comprometida.

---

## 3. A tese deste handoff

> **A casa mede bem e liga mal.** O detector de defasagem falha por uma decisão de FORMATO tomada
> meses atrás e nunca questionada; o gabarito que não apodrece existe e não está plugado no juiz; a
> régua de dinheiro funciona e cobre 1 de 35 porque ninguém enumerou quantos projetos sequer têm
> gateway. **Nenhuma das três precisa de régua nova. As três precisam que o que já existe seja
> ligado ao que já existe.**

Três consequências, e elas ordenam o trabalho:

1. **Antes de escrever régua nova, ligue as que estão soltas.** Este documento não propõe nenhuma
   régua nova até a fase E. Não é economia — é que régua desligada é pior que régua ausente: ela dá
   a sensação de cobertura.
2. **O formato de saída é decisão de engenharia, não de redação.** Pedir veredito antes do
   raciocínio é o mesmo defeito que juntar as duas passadas do juiz numa só: economiza uma linha e
   destrói o sinal. A casa já aprendeu isso uma vez, no juiz, e não transferiu a lição.
3. **Credencial comprometida não é dívida técnica, é dívida de dinheiro.** A régua nova lê a conta
   de pagamento com um token que esteve público. Isso não espera a próxima frente bonita.

---

## 4. O desenho, com o argumento de cada decisão

### Fase A — 🔑 inverter a ordem da saída do detector e fechar o parse contra si mesmo

**É a fase mais barata deste documento e a que destrava mais coisa.** Ela decide sozinha se as fases
F e G existem.

**A.1 — Inverta.** `montarPromptDefasagem` passa a pedir, nesta ordem:

```
TRECHO:   a frase literal do documento que é incompatível com o fato, ou - se nenhuma
MOTIVO:   uma frase curta
VEREDITO: bate|desmente|nao-fala
```

O veredito vira a **última** linha, depois da evidência e do raciocínio. `parseDefasagem` já lê por
rótulo (`campo()`), então a ordem no texto não quebra o parser — a mudança é só no prompt e no
comentário que explica por quê.

**A.2 — Falha FECHADA na coerência interna.** Hoje o parse aceita `VEREDITO: desmente` com
`TRECHO: -`, e aceita `VEREDITO: bate` com um `TRECHO` que contradiz o fato. Passe a rejeitar:

- `veredito === "desmente"` **exige** `TRECHO` diferente de `-` e presente **literalmente** no
  trecho do documento. Não está? `defasagem-incoerente`.
- `TRECHO` que não existe no documento é **alucinação de citação**, e ela tem que ter código
  próprio — é o mesmo princípio do `resposta-sem-citacao` da aba de busca, que já é falha fechada.

Isso não conserta o modelo; **impede que um veredito sem evidência conte como achado**, que é o
único jeito de uma lista nominal valer alguma coisa.

**A.3 — Recalibre.** `node --env-file=.env scripts/defasagem-calibrar.mjs --ver`. Os fixtures estão
congelados e commitados (`0f060c7`), então a comparação é limpa. **Não mexa nos rótulos.**

**A.4 — Se ainda reprovar, pare e escreva por quê.** Não faça terceira, quarta e quinta redação: se
inverter a ordem e fechar o parse não passar os dois portões, o problema é mais fundo (provavelmente
o `nao-fala` não ser mutuamente exclusivo com os outros dois na cabeça do modelo), e a próxima
tentativa é **quebrar em duas passadas** — uma que só extrai a afirmação sobre o assunto, outra que
só compara afirmação com fato. É o mesmo desenho do juiz, que passou.

**Aceite:** holdout ≥ 85% **E** adversarial ≥ 9/10, com os dois números impressos. Enquanto os dois
não passarem, **nenhum percentual de defasagem sai** — inclusive o 16,7%, que hoje é **piso**.

⚠️ **Os 6 casos inválidos por construção continuam no fixture, de propósito.** Não os conserte para
"aproveitar" o holdout: rótulo escrito depois de ler veredito é contaminado. Se quiser mais casos
válidos, **acrescente pares novos**, rotule antes de rodar e commite antes de rodar.

**Preço honesto:** ~1 h e ~30 chamadas por tentativa. **Duas tentativas no máximo.**

### Fase B — 🔑 ligar o dourado APURADO ao juiz e ao avaliador

A frente de 31/07 construiu o gabarito que não apodrece. Esta fase faz ele chegar onde é usado.

**B.1 — `scripts/avaliar-resposta.mjs` chama `apurarEstado()`** e, para cada pergunta de camada
`estado`, substitui `resposta` pelo apurado antes de passar ao juiz. `armadilha` e `fontes`
continuam vindo do `dourado.json`: elas são curadoria e não se apuram.

**B.2 — Falha FECHADA, e este é o ponto delicado.** Se a apuração vier `nao_apurado` (sem rede,
fonte fora do ar), a pergunta **sai da corrida** — ela não cai de volta para o texto escrito. Cair
para a prosa seria pior que não medir: o número sairia com cara de completo e mediria a coisa que
esta frente inteira existe para não medir.

O relatório precisa imprimir, ao lado do agregado, **quantas perguntas de `estado` entraram com
gabarito apurado e quantas saíram** — do mesmo jeito que hoje imprime as suprimidas.

**B.3 — Marque a origem do gabarito no relatório.** Cada linha de `estado` sai com `gabarito:
apurado (fonte, data)`; as de `protocolo` e `episodio`, com `gabarito: escrito`. Sem isso ninguém
consegue ler um relatório antigo e saber contra o que ele mediu.

**B.4 — Conserte o `dourado.json` das outras 7 de `estado`.** `D-67` já foi reescrita nesta sessão.
As outras sete ainda carregam prosa datada que vai apodrecer (`D-66`: *"Em 30/07 eram 36 repos"*).
Duas opções, e a segunda é a certa: (a) reescrever o texto — apodrece de novo em uma semana; (b)
**esvaziar o campo `resposta` das 8 de `estado` e deixar o apurador ser a única fonte**, com o
`npm test` garantindo que pergunta de camada `estado` **não tem** `resposta` escrita. Faça a (b).
Texto que não existe não apodrece.

**Aceite:** `node --env-file=.env scripts/avaliar-resposta.mjs --juiz` roda com as 8 de `estado`
julgadas contra apuração da hora, o relatório declara a origem de cada gabarito, e `npm test` falha
se alguém escrever `resposta` numa pergunta de `estado`.

**Preço honesto:** ~2 h de código + 24 chamadas para uma corrida só de `estado` (`--ids`). **Não
rode as 78 aqui** — a comparação que interessa é da camada que mudou, e o agregado é dominado por
`protocolo` (65 das 78).

### Fase C — o dinheiro dos outros 34, e a pergunta que ninguém fez

A fase A da sessão anterior ligou uma fonte. Esta responde a pergunta que deveria ter vindo antes:
**quantos dos 35 projetos sequer TÊM um sistema de pagamento?**

Ninguém sabe. Sem esse número, "1 de 35 tem gateway ligado" pode significar "faltam 34" ou "faltam
2" — e a diferença entre as duas leituras é a diferença entre um portfólio que não cobra e um
portfólio que cobra e não mediu.

**C.1 — O inventário de gateways, e ele é ZERO LLM.** Para cada um dos 35: existe checkout/preço/
gateway no repo ou no site? Três baldes, com o **teste** ao lado, não o adjetivo:
`tem-gateway-ligado` (a régua já lê) · `tem-gateway-e-não-está-ligado` (existe conta, falta plugar)
· `não-tem-gateway` (e aí `familia: cobranca` ou `produto` já dizia isso). **Este balde do meio é o
backlog de dinheiro da casa, e hoje ele não existe em lugar nenhum.**

**C.2 — `sirius`, e o obstáculo é rede.** O `.env` do repo tem a URL completa; `31.97.23.166:5434`
dá `ETIMEDOUT` da máquina de dev. O esquema já foi lido e a query honesta é conhecida:

```sql
SELECT count(*) FROM "Organization"
WHERE "tier" <> 'FREE' AND "isTestAccount" = false;
```

`isTestAccount` é campo do próprio schema, com o comentário *"exclude from revenue metrics (test
users with paid tiers)"* — **o sirius já sabia do problema que o `atma` só revelou ontem.** Os
caminhos, em ordem de honestidade: abrir a porta no firewall do VPS · rodar a query de dentro do
container pelo EasyPanel · expor uma rota de leitura autenticada no próprio app. **Não invente
número enquanto nenhum dos três acontecer** — `vendas` ausente é a resposta certa.

**C.3 — `orcaobra`/Kiwify, que nunca foi tentado.** O card diz "ÚNICO dos 9 que fatura hoje" e
`receita: 7`. Isso nunca passou por régua nenhuma. A Kiwify tem API; o repo não está clonado na
máquina. **Trate a afirmação como não-checada até que esteja** — e, enquanto isso, o card deve
dizer AFIRMADO, como o do sirius passou a dizer.

**C.4 — A decisão que ficou pendente: `receitaProvada` entra no `computeScore`?** Hoje `receita` é
nota 0-10 de prioridade editorial e é ela que pesa no ranking. `receitaProvada` existe, é derivada e
não é curável à mão. A pergunta franca: **o hub deve continuar rankeando por um palpite quando tem
um fato ao lado?** O argumento contra misturar é bom (prioridade ≠ faturamento). O argumento a favor
é melhor: com 34 dos 35 sem gateway, `receitaProvada` hoje seria quase toda `null`, e **um campo
quase todo nulo no score é pior que nenhum**. Recomendação: **não entra agora, entra quando o
inventário C.1 disser que a cobertura passou de metade.** Escreva a condição no card, não na
memória de quem leu.

**Preço honesto:** C.1 ~3 h de leitura e verificação (zero LLM, zero pool). C.2 depende de infra e
pode não sair nesta sessão. C.3 ~1 sessão. **C.1 é a que muda a priorização de tudo.**

### Fase D — 🚨 rotacionar o token do Mercado Pago (e o resto de `secrets_to_rotate`)

Fora de ordem de propósito: **isto não é uma fase de melhoria, é uma dívida vencida.**

`SEC-04` registra token de **produção** do Mercado Pago em repo **público**, em todo o histórico,
junto de chave Resend e de uma senha de banco reusada em Compass, `sofia_db` e `siriusdb`. Tornar o
repo privado não desfaz — pode ter sido clonado ou indexado.

A frente do dinheiro **acabou de aumentar a superfície**: agora existe uma régua automatizada lendo
a conta de pagamento com essa credencial, e o `.env` do roihub tem uma cópia dela.

**O que fazer:** rotacionar o `MERCADOPAGO_ACCESS_TOKEN` no painel do MP, atualizar
`Atma/Site/Frontend/.env.local`, o env de produção do atma no EasyPanel e o `.env` do roihub — os
três, senão a régua quebra em silêncio e vira `nao_apurado` sem ninguém entender. Depois, a ordem de
urgência do próprio `SEC-04`: **dinheiro, e-mail transacional, senha de banco, JWT secret.**

**Preço honesto:** ~1 h, e é a única coisa deste documento que fica mais cara a cada dia que passa.

### Fase E — o inventário do conversível (herdado, e com uma pergunta nova)

Continua sendo o mapa que ordena tudo depois. Varra os 284 documentos e classifique cada afirmação
factual em três baldes: **conversível hoje** (fonte viva já ligada) · **conversível com trabalho**
(a fonte existe e não está ligada — a fase C é o primeiro item deste balde) · **não conversível**
(regra, decisão, julgamento: fica prosa **de propósito**, porque uma norma não tem fonte viva, ela
**é** a fonte).

**A pergunta nova, e ela é incômoda:** o corpus tem 284 documentos e a aba de busca responde "o que
eu faço hoje" a partir dele. **Quantos desses documentos falam dos 35 projetos, e quantos falam do
aparato que mede os 35 projetos?** Ninguém sabe. Se a segunda metade for grande, isso tem duas
consequências práticas, não filosóficas: (1) o reranker gasta contexto com documentos sobre réguas
quando a pergunta é sobre projeto; (2) **explica por que o detector de defasagem devolve tanto "o
documento trata da corrida de conformidade"** — porque muitos documentos tratam mesmo.

⚠️ **`VER-08` se aplica à própria fase E:** é um check novo, então a primeira corrida mede o check e
**entrega lista nominal, não percentual**. Planeje duas corridas.

**Aceite:** `docs/inventario-conversivel.md` com a lista nominal do balde 1 ordenada por **quantos
documentos repetem a mesma afirmação** — repetição é o multiplicador do erro — e a contagem
projeto × aparato, publicada só na segunda corrida.

**Preço honesto:** ~1 sessão inteira de leitura. 0 a 50 chamadas.

### Fase F — o detector de contradição entre documentos (só depois da A)

Rodar a passada de fidelidade sozinha sobre pares de documentos que falam do mesmo assunto, sem
passar pelo dourado. 284 documentos são ~40 mil pares; o recorte viável é o índice denso que já
existe — dois documentos que se contradizem são vizinhos no espaço vetorial. Piso de similaridade
calibrado para caber em ~100 chamadas.

**Continua sendo a fase mais bonita de mostrar e continua não sendo a primeira.** Ela usa a mesma
passada que tirou **3/10** no adversarial. É a fase A que decide se ela pode existir.

**Aceite:** `scripts/contradicoes.mjs` com a precisão medida no holdout impressa **no cabeçalho do
relatório**, ao lado de todo número.

### Fase G — remedir por camada e publicar com a fronteira declarada

Só agora, e **nunca no agregado**: `--juiz` na camada `estado` antes × depois, já com o gabarito
apurado da fase B. O agregado é dominado por `protocolo` (65 das 78) e esconde exatamente o que
mudou.

Publique com a fronteira **no mesmo parágrafo**: o que passou a ser verificado contra a realidade, e
o que continua sendo prosa concordando com prosa. Régua que não declara o próprio limite vira meta
em cima de um defeito.

---

## 5. O que NÃO fazer

- **Não escreva a terceira redação do prompt do detector sem antes inverter a ordem da saída.** Duas
  já falharam mexendo em regra; a hipótese não testada é o formato.
- **Não conserte os 6 casos inválidos do holdout para melhorar o número.** Eles saíram por regra
  mecânica e ficam no arquivo como registro de que o check errou. Quer holdout maior? Acrescente
  pares novos, rotule antes e **commite antes de rodar**.
- **Não publique percentual de defasagem antes da fase A**, inclusive o 16,7% — que hoje é **piso**,
  não estimativa: o detector absolve 7 de 10 corrupções deliberadas.
- **Não deixe o juiz cair para a prosa quando a apuração falhar.** `nao_apurado` tira a pergunta da
  corrida. Fallback silencioso aqui é o defeito com a pior relação dano/visibilidade do repo.
- **Não trate `vendas` ausente como R$ 0.** Ausente é "nenhum gateway ligado"; `[]` é "o gateway
  respondeu e não pagou nada". `D-67` já separa os dois — não desfaça isso ao ligar a segunda fonte.
- **Não invente venda do `sirius` para "fechar" a fase C.** Enquanto a porta não abrir, `vendas`
  ausente é a resposta certa e o card já diz por quê.
- **Não reescreva handoff antigo para o corpus "bater" com hoje.** Handoff é registro datado e é o
  único lugar onde se vê o que se sabia quando a decisão foi tomada. Conserta-se a norma, o card e a
  convenção daí pra frente.
- **Não refaça a curadoria de `familia`/`estado` sem refazer o holdout.** A taxonomia mudou (5
  famílias, com precedência) e a concordância de 77,1% foi medida na taxonomia velha.
- **Não expanda o dourado para 150 perguntas.** Mais perguntas sobre a mesma base não-verificada
  multiplicam o teto, não o levantam.
- **Não mexa no prompt do juiz da síntese.** Ele passou os dois portões e não confundiu `contradiz`
  com `correta` nenhuma vez em 38 casos. É a única régua de LLM calibrada da casa.
- **Não some régua de LLM sem matar uma.** O pool é o orçamento; ele já serve autopublishing,
  rerank, síntese, juiz e defasagem — e morreu no meio de uma corrida em 30/07.
- **Não trate `nao_apurado`/`n/a` como aprovação.** É "não olhei" ou "não há onde olhar".

---

## 6. Custo e prazo, francamente

| fase | esforço | chamadas |
|---|---|---|
| **A — inverter a saída do detector + parse fechado** | **~1 h, no máximo 2 tentativas** | **~30 a 60** |
| **B — ligar o dourado apurado ao juiz** | **~2 h de código** | **24 (só `estado`)** |
| **C — inventário de gateways + sirius + kiwify** | **~3 h (C.1) + 1 sessão (C.2/C.3)** | **0** |
| **D — 🚨 rotacionar o token do MP** | **~1 h** | **0** |
| E — inventário do conversível | ~1 sessão inteira de leitura | 0 a 50 |
| F — detector de contradição | ~3 h de código | ~100 |
| G — remedir `estado` + publicar | ~2 h | 24 |

**A ordem defendida é D → A → B → C → E → F → G**, e o argumento é este:

- **D vem primeiro e fora de ordem** porque é a única que fica mais cara a cada dia e porque a
  sessão anterior aumentou a exposição dela sem consertá-la. Uma hora.
- **A destrava todo percentual e decide se a F existe** — e custa uma hora com uma hipótese
  específica e falsificável, contra duas redações que já falharam no escuro.
- **B faz duas sessões de trabalho já feito chegarem à medição.** É o maior retorno por hora do
  documento, e é trabalho que já está pago.
- **C é o dinheiro**, e a parte que muda a priorização (C.1) não gasta uma chamada sequer.

**Se o pool estiver ruim, D → C.1 → B(código) não gastam nada** e ainda assim são três das quatro
melhores coisas a fazer.

**A tentação vai ser fazer a fase F primeiro** — detector de contradição é o que se mostra. Não
faça. **A segunda tentação, mais perigosa, é fazer a A com uma terceira redação de regra em vez de
inverter a ordem**: é o caminho que já falhou duas vezes e é o que parece trabalho.

---

## 7. Armadilhas de operação

- **Reindexar depois de escrever handoff ou memória**: `node --env-file=.env scripts/indexar.mjs`
  (de máquina com Ollama, nunca do container). Memórias moram em `~/.claude`, fora do repo. **Este
  handoff inclusive.**
- **🆕 `parseDefasagem` lê por RÓTULO, não por posição** (`campo()`), então inverter a ordem das três
  linhas no prompt não quebra o parser. Confira o teste antes de assumir o contrário.
- **🆕 O fixture de calibração é CONGELADO e tem `ancora`.** Caso cujo trecho não contém a âncora sai
  **antes** de qualquer chamada. Se você acrescentar par novo, preencha a `ancora` — sem ela o caso
  entra sem verificação de construção.
- **🆕 `data/projects.json` tem 5 famílias agora**, com **ordem de precedência** (`produto` primeiro).
  O enum vive em `lib/dourado-estado.mjs` (`FAMILIAS`) **e** em `lib/projects.ts` (tipo `Project`).
  Mexer num sem o outro passa no `npm test` e quebra o `tsc`.
- **`blockersLista` é `{texto, humano}` e tem TRÊS consumidores**: `lib/projects.ts`, `app/page.tsx`
  e `lib/evaluate.ts`. O `npm test` **não pega** quebra de formato — quem pega é `npx tsc --noEmit`.
- **Citação de exemplo vai entre crases.** O `validade.mjs` mascara span de crase justamente para o
  documento que ENSINA a norma poder citá-la.
- **`data/projects.json` é UTF-8 e o `Get-Content` do PowerShell mostra mojibake.** Edite pela
  ferramenta de arquivo; o round-trip `JSON.stringify(…, null, 2)` preserva byte a byte.
- **Nome de arquivo de corrida é UTC; `apurado_em` é BRT.** Comparar corridas pela data do nome
  atrasa ou adianta um dia — e é assim que se inventa uma regressão.
- **A janela de 28 dias do GSC desliza na meia-noite UTC.** O mesmo fim de tarde devolveu 33 e depois
  42 impressões para o tapepro. Não é instabilidade da fonte.
- **Impressão pede `dimensions: []`; clique não-branded pede `query`.** Com a dimensão `query` o GSC
  omite as raras e a soma vira **piso** (5 contra 33).
- **Escrever handoff no meio de uma medição muda o corpus** (mexe em IDF e vetor). **Número absoluto
  não reproduz entre sessões** — comparar sempre contra a mesma execução (`--min bm25`).
- **Ler as linhas, não o agregado.** Pegou o bug de classificação que teria publicado 83,3% no lugar
  de 97,4%, pegou 5 dos 46 achados de conformidade, pegou 3 dos 8 `desmente`, pegou 2 dos 3 do
  `validade` e pegou os 6 rótulos inválidos do holdout. `--ver`.
- **Erro não é cacheado, então é retentado** na corrida seguinte.
- **`--motor todos` NÃO inclui o rerank.** `--motor rerank` explicitamente, com `--min bm25`.
- **Arquivo de teste novo entra à mão na lista do `package.json`**, senão nunca roda (`D-73`).
- **Não dar push entre 00:00 e 01:00 BRT** (cron do autopublishing às 00:13).
- **Deploy é Docker no EasyPanel, não Vercel.**
- **`HUB_USER`/`HUB_PASS` estão no `.env` local** — dá para verificar produção sem pedir ao Jean.

---

## 8. Primeiros 20 minutos

1. `npm test` (**247 verdes**), `npx tsc --noEmit` e `node scripts/validade.mjs` (**0 achados**) —
   para saber se o que quebrar depois foi você.
2. `node --env-file=.env scripts/dourado-estado.mjs --estado tudo --diff` — **~20 s, zero LLM,
   8 de 8**. O retrato do que a casa acha × o que é.
3. `node --env-file=.env scripts/vendas-mercadopago.mjs` — **~5 s, zero LLM.** Reconfere que os 20
   pagamentos continuam sendo teste. **Se um dia aparecer uma linha `✓`, é a primeira venda real do
   portfólio provada por um sistema de pagamento.** ⚠️ Se ele falhar com erro de auth, é porque a
   fase D foi feita e o `.env` do roihub não foi atualizado junto.
4. `node --env-file=.env scripts/defasagem-calibrar.mjs --ver` — **cache morno, ~0 chamadas.** Leia
   os **4 erros do holdout** e os **7 adversariais que escaparam**, um a um, ANTES de tocar no
   prompt. Repare em quantos motivos começam com "o documento trata de…": é o modo de falha inteiro
   numa frase.
5. Abra `lib/defasagem.mjs` e olhe as três últimas linhas do prompt. **`VEREDITO:` é a primeira coisa
   que o modelo escreve.** Se você concordar que isso é o bug, a fase A é meia hora de trabalho e
   trinta chamadas — e ela decide o destino de metade deste documento.
