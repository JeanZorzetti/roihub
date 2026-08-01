# Handoff — o instrumento melhorou, o portão que julga o instrumento não (aberto em 01/08/2026, 04h50)

Este documento é **especificação de trabalho, não relatório**. Assume que quem chega não tem
contexto, e **esforço não é critério de corte**: onde o caminho barato e o caminho certo divergem,
ele defende o certo e diz o preço na cara.

Estado imediatamente anterior:
[`handoff-o-formato-era-o-bug.md`](handoff-o-formato-era-o-bug.md) (o que foi executado) ·
spec que o originou: [`handoff-o-veredito-vem-antes-do-raciocinio.md`](handoff-o-veredito-vem-antes-do-raciocinio.md) ·
calibração: [`../docs/defasagem-calibracao.md`](../docs/defasagem-calibracao.md) ·
arquitetura: [`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md) ·
índice: [`../handoff.md`](../handoff.md).

---

## 1. Onde a casa está

Nove réguas. A coluna que decide continua sendo a última:

| régua | pergunta | LLM? | toca a REALIDADE? | **CALIBRADA?** |
|---|---|---|---|---|
| `scripts/conformidade.mjs` | a norma é obedecida na produção? | zero | **sim** — HTTP × 35 hosts | n/a (rede pura) |
| `scripts/gateways.mjs` 🆕 | o projeto sequer TEM como cobrar? | zero | **sim** — HTTP × 35 hosts | n/a (rede pura) |
| `scripts/dourado-estado.mjs` | o número que a casa afirma ainda é real? | zero | **sim, 8 de 8** | n/a |
| `scripts/vendas-mercadopago.mjs` | o gateway pagou? | zero | **sim, em 1 dos 35** | n/a |
| `scripts/validade.mjs` | algum documento vivo congelou um `(hoje N)`? | zero | não | n/a |
| `lib/juiz.mjs` (`--juiz`) | a resposta bate com o que a casa sabe? | 3×/pergunta | **agora sim, em 8 das 78** | **✅ 87,5% / 10-10** |
| `scripts/avaliar.mjs` | o documento certo está entre os 10? | rerank | não | n/a |
| `scripts/avaliar-resposta.mjs` | a citação aponta para fonte reconhecida? | 1×/pergunta | não | n/a |
| `scripts/corpus-defasado.mjs` | quantos documentos o mundo desmente? | 1×/documento | **em parte** | **🚩 84,6% / 8-10 — REPROVADO** |

**252 testes verdes · `tsc` limpo · corpus 286 documentos · `validade` 0 achados em 234 vivos ·
receita provada medida contra gateway: R$ 0,00.**

---

## 2. A tese deste handoff

> **O detector melhorou muito e o portão que o julga não melhorou nada.** Na calibração de 01/08 o
> detector saiu de **3 para 9 vereditos `desmente` corretos** em 10 corrupções deliberadas. No mesmo
> movimento, o holdout marcou 71,4% → 88,9% → 91,7% → **84,6%**, subindo e descendo enquanto a
> qualidade real só subia. **Um portão que oscila 7 pontos porque um caso mudou de lado não decide
> coisa nenhuma — ele tem 13 casos válidos.**

Três consequências, e elas ordenam o trabalho:

1. **Nenhuma decisão sobre o detector vale enquanto o holdout tiver 13 casos.** Tentar a próxima
   redação ou o próximo desenho agora é ajustar contra ruído, e ruído sempre "melhora" quando você
   insiste. O trabalho certo é **caro e chato**: rotular pares novos à mão, antes de rodar.
2. **O sinal mais valioso que este sistema já produziu nunca foi lido.** A fase B de hoje ligou o
   gabarito vivo ao juiz e a primeira corrida devolveu **3 casos `fiel + discorda`** — resposta
   derivada CORRETAMENTE do corpus que contradiz a fonte viva. Isso é o corpus errado, e é a coisa
   que a frente inteira do dourado existe para encontrar. **Custa zero chamada e ninguém olhou.**
3. **A dívida do token continua vencida e a superfície continua crescendo.** Ela não espera fase
   bonita nenhuma.

---

## 3. As quatro frases que a próxima sessão NÃO pode repetir errado

### 3.1 🚨 O token de PRODUÇÃO do Mercado Pago vazado AINDA FUNCIONA

`SEC-04` registra token de produção do MP em `origin/main` do repo **público** `JeanZorzetti/Atma`,
e em todo o histórico. **Rodei `scripts/vendas-mercadopago.mjs` hoje e ele autenticou.** Nada foi
rotacionado. Tornar o repo privado não desfaz — pode ter sido clonado ou indexado.

E a casa **aumentou a exposição** desde então: existe uma régua automatizada lendo a conta de
pagamento com essa credencial, e o `.env` do roihub tem uma cópia dela.

### 3.2 🔑 O que consertou o detector foi FORÇAR A EVIDÊNCIA ANTES DA DECISÃO — três vezes seguidas

Não é uma frase de efeito, é a decomposição medida. Cada linha é uma corrida:

| mudança | vereditos `desmente` corretos (de 10) | limpos após o check de citação |
|---|---|---|
| formato original (`VEREDITO` na linha 1) | 3 | 3 |
| **inverter** para `TRECHO → MOTIVO → VEREDITO` | **6** | 3 |
| + conferência de citação tolerante a markdown | 7 | 4 |
| + **contrato de citação no prompt** ("copie um trecho contínuo, literal") | **9** | **8** |

Repare no último degrau: **exigir que o modelo copiasse a frase literal antes de julgar levou o
`D-66` da conformidade — o caso-símbolo do modo de falha, aquele que absolvia dizendo "o documento
trata da corrida de conformidade" — a acertar `desmente`.** Ele parou de julgar o tema porque foi
obrigado a olhar para uma frase específica primeiro.

**A lição transferível: toda régua de LLM desta casa deve pedir evidência e raciocínio ANTES do
rótulo.** Vale para o próximo classificador que alguém escrever aqui.

### 3.3 🔑 O holdout tem 13 casos válidos e não consegue distinguir 84,6% de 85%

20 pares foram rotulados, **6 saíram inválidos por construção** (o rótulo citava frase que o
detector nunca recebeu), e das 14 restantes uma cai por citação fabricada. **Sobram 13.**

Com 13 casos, **um caso vale 7,7 pontos percentuais**. Foi exatamente isso que aconteceu entre a
penúltima e a última corrida: 91,7% (11/12) virou 84,6% (11/13) porque um caso a mais passou a
parsear e errou. **A qualidade subiu e o número desceu.** Um portão assim não separa progresso de
sorte, e publicar decisão em cima dele é o defeito que esta base inteira existe para não cometer.

### 3.4 🔑 O portão do juiz se dizia congelado e lia um arquivo MUTÁVEL

`juiz-calibracao.json` e `juiz-adversarial.json` pegavam o gabarito de cada caso em `dourado.json`
**na hora da corrida**. As 8 perguntas de `estado` estão nos 20 rótulos de regressão. Bastava
alguém reescrever a `resposta` de `D-67` para o número do portão mudar sem que uma linha do juiz
fosse tocada.

Está consertado (`dourado_congelado`, com teste). Mas o achado é maior que o conserto: **a palavra
"congelado" apareceu num arquivo que não estava congelado, e ninguém tinha checado.** Isso é uma
classe de defeito, não um caso.

---

## 4. O desenho, com o argumento de cada decisão

### Fase A — 🚨 rotacionar o token do MP e o resto de `secrets_to_rotate` (só o Jean)

Fora de ordem de propósito: **não é melhoria, é dívida vencida**, e é a única coisa deste documento
que fica mais cara a cada dia que passa.

Rotacionar o `MERCADOPAGO_ACCESS_TOKEN` no painel do MP e atualizar **os três**, senão a régua
quebra em silêncio e vira `nao_apurado` sem ninguém entender:

1. `Atma/Site/Frontend/.env.local`
2. o env de produção do atma no EasyPanel
3. o `.env` do roihub

Depois, a ordem de urgência do próprio `SEC-04`: **dinheiro → e-mail transacional → senha de banco
(reusada em Compass, `sofia_db` e `siriusdb`) → JWT secret.**

**Preço honesto:** ~1 h. **Nenhuma outra coisa neste documento depende dela, e é por isso que ela
vem primeiro: nada a bloqueia, só a inércia.**

### Fase B — ler os 3 `fiel + discorda` e o `contradiz`, um a um

**É a coisa de maior retorno por hora do documento e custa ZERO chamada.** A fase B de hoje fez o
juiz comparar a resposta com a fonte viva pela primeira vez, e a primeira corrida devolveu:

- **`contradiz` (1):** `D-67` — a resposta abre afirmando que 1 dos 35 tem receita provada; o
  apurado diz zero entre os checados.
- **`fiel + discorda` (3):** `D-70`, `D-71`, `D-72` — a síntese derivou **corretamente** dos
  trechos que citou e mesmo assim discorda do apurado.

`fiel + discorda` é a única célula deste sistema que aponta **para dentro do corpus**. As três de
hoje têm a mesma forma: a resposta está certa em relação ao que os documentos dizem, e os
documentos **não sabem o número de hoje**. Isso é a defasagem do corpus, medida por outro caminho
que não o detector — e o detector é justamente o instrumento que não passa nos portões.

**O que fazer com cada uma:** ou o documento se conserta (se for norma ou card), ou a lacuna é
real e vira item. ⚠️ **Handoff datado NÃO se reescreve** — conserta-se a norma, o card e a
convenção daí pra frente.

**Aceite:** as 4 lidas, cada uma classificada em *corpus errado* · *gabarito errado* · *lacuna
real*, com a ação escrita ao lado. Nenhuma vira percentual.

**Preço honesto:** ~1 h de leitura. **0 chamadas.** O relatório já está em
`data/juiz-corridas/2026-08-01-0423.json`.

### Fase C — 🔑 dar poder de resolução ao portão do detector

**Esta é a fase cara, chata e certa, e ela vem ANTES de qualquer mudança nova no detector.**

**C.1 — Leve o holdout a pelo menos 40 pares VÁLIDOS.** Hoje o arquivo tem 20 casos, **14 válidos
por construção** e **13 que chegaram a contar** na última corrida (um caiu por citação fabricada).
A regra de construção é a que já existe e não se negocia:

- rotular lendo **exatamente a janela que a produção recorta** (`trechoRelevante`, 2400 chars) —
  foi ignorar isso que invalidou 6 dos 20 originais;
- preencher a `ancora` de cada caso (a frase literal de que o rótulo depende) — sem ela o caso
  entra sem verificação de construção;
- **commitar antes de rodar**, para que "rotulei antes de ver o veredito" seja verificável no
  histórico e não uma palavra num comentário.

⚠️ **Os 6 inválidos continuam no arquivo e NÃO se consertam.** Eles são o registro de que o check
errou. Quer mais casos? Acrescente pares novos.

⚠️ **A distribuição importa mais que o tamanho.** O material real é monocultura (5 dos 5 achados
são a família `(hoje N)`), e calibrar contra isso mede uma regex. Os pares novos têm que cobrir, de
propósito, o modo de falha que SOBROU: **documento cujo tema é outro e que contém a afirmação
incompatível assim mesmo.** É onde o detector ainda erra, e é o que o holdout atual quase não tem.

**C.2 — Leve o adversarial a 20.** Mesma lógica: 10 corrupções não separam 8/10 de 9/10. E mantenha
a regra de que **alguns adversariais são o ESPELHO de casos do holdout** (a mesma frase com a data
arrancada), senão um detector que absolve por atacado passa nos dois portões de uma vez.

**Aceite:** `data/defasagem-calibracao.json` com ≥ 40 casos válidos e `data/defasagem-adversarial.json`
com 20, ambos commitados **antes** da primeira corrida contra eles, e a corrida de referência
publicada com o número novo — que **provavelmente não vai ser 84,6%**, e isso não é regressão: é a
primeira medição com resolução suficiente.

**Preço honesto:** **~4 a 6 h de leitura e rotulagem à mão, ~60 chamadas.** É o item mais caro do
documento e o único que torna todos os outros decidíveis. **Não terceirize a rotulagem para o
modelo que vai ser medido.**

### Fase D — as duas passadas do detector (só depois da C)

Todos os erros que sobraram apontam na mesma direção — `→ nao-fala` — e o mesmo documento
(`handoff-compass-e-repos-sem-site.md`) erra nos dois portões. O detector ainda julga o **tema** do
documento em vez da **afirmação** dentro dele.

O desenho é o do juiz, que passou os dois portões:

- **passada 1 (cega ao fato):** "que afirmação, se alguma, este documento faz sobre X?" — devolve a
  frase literal ou `nenhuma`. **Não vê o fato apurado**, então não tem como construir desculpa.
- **passada 2 (cega ao documento):** "esta afirmação é compatível com este fato?" — devolve
  `bate|desmente`. Não vê o tema do documento, então não tem como absolver por assunto.

É a versão extrema do que já funcionou três vezes hoje: **separar a extração da evidência do
julgamento dela**. O `nao-fala` deixa de competir com os outros dois — ele passa a ser uma saída da
passada 1, não um veredito.

⚠️ **Custo real, e ele é político:** **dobra as chamadas de `corpus-defasado.mjs`** (hoje 1 por
documento, ~10 por pergunta). O pool já serve autopublishing, rerank, síntese, juiz e defasagem, e
**morreu no meio de uma corrida em 30/07**. Duas saídas honestas: (a) rodar a passada 1 uma vez por
documento e **cachear por documento** (ela não depende do fato, só do assunto — isso pode ser
barato de verdade); (b) aceitar o custo e matar outra régua de LLM. **A (a) é melhor e deve ser
tentada primeiro.**

**Aceite:** os dois portões passam com os fixtures ampliados da fase C. Enquanto não passarem,
**nenhum percentual de defasagem sai — inclusive o 16,7%, que é PISO.**

### Fase E — auditar toda afirmação de "congelado" e "determinístico" do repo

O fixture do juiz **se dizia congelado e lia um arquivo mutável**. Se uma mentiu, outras podem.

Varra o repo por toda estrutura que se apresenta como imutável, reprodutível ou congelada e
**prove** a propriedade em vez de acreditar no comentário: fixtures, caches, `.cache/*.json`,
qualquer coisa com `congelado_em`, e todo teste que compara contra arquivo de dados.

**O teste é mecânico:** mude o arquivo de origem e veja se o número muda. Se mudar, não estava
congelado.

**Preço honesto:** ~2 h, 0 chamadas. **É barato e é o tipo de coisa que só se descobre por
acidente — e por acidente é a pior forma de descobrir.**

### Fase F — o dinheiro, agora com o inventário na mão

**F.1 — `orcaobra`/Kiwify, e ele subiu de prioridade.** O inventário de hoje achou
`<a href="https://pay.kiwify.com.br/r85uk0S">` servido na home: **é o ÚNICO projeto do portfólio
com gateway vivo e nenhuma régua lendo.** O card diz "ÚNICO dos 9 que fatura hoje" e `receita: 7`,
e isso **nunca passou por régua nenhuma**. A Kiwify tem API. **Enquanto não passar, o card diz
AFIRMADO.**

**F.2 — `sirius`, e o inventário mudou o diagnóstico.** Ele **não cobra pelo site** — fatura por
tier de organização no próprio banco, e nenhuma página dele carregaria gateway. `31.97.23.166:5434`
dá `ETIMEDOUT` da máquina de dev. A query honesta é conhecida:

```sql
SELECT count(*) FROM "Organization"
WHERE "tier" <> 'FREE' AND "isTestAccount" = false;
```

`isTestAccount` é campo do próprio schema, com o comentário *"exclude from revenue metrics"* — **o
sirius já sabia do problema que o `atma` só revelou em 31/07.** Caminhos, em ordem de honestidade:
abrir a porta no firewall do VPS · rodar de dentro do container pelo EasyPanel · expor uma rota de
leitura autenticada. **Não invente número enquanto nenhum dos três acontecer.**

**F.3 — completar o inventário pelo REPO, não só pelo site.** `scripts/gateways.mjs` olha o HTML
servido. Ele não vê gateway montado por JS depois de um clique, nem chave de gateway num `.env`,
nem SDK num `package.json`. **Os 30 do balde `sem-gateway` são "não achei caminho servido", nunca
"não cobra"** — e a diferença entre as duas leituras é a mesma que motivou o inventário.

**Preço honesto:** F.1 ~1 sessão · F.2 depende de infra e pode não sair · F.3 ~3 h. **0 chamadas.**

### Fase G — remedir a corrida completa e publicar com a fronteira declarada

⚠️ **`VER-08` se aplica: a corrida de hoje foi a PRIMEIRA da camada `estado` julgada contra
gabarito apurado, e a primeira corrida de um check novo mede o CHECK.** Os números dela
(37,5% correta, 37,5% incompleta) **não se publicam** — servem para achar defeito na ligação, que é
o que a fase B faz. Planeje duas corridas.

E há um achado à parte, que não é do juiz: **na camada `estado`, o top-10 tinha a fonte do dourado
em apenas 75% e a citação ancorou em 50%.** Isso é problema de **RECUPERAÇÃO**, não de síntese, e
está escondido no agregado porque `protocolo` domina (65 das 78). Merece régua própria
(`scripts/avaliar.mjs --motor rerank --min bm25`, recortado por camada).

**Publique com a fronteira no MESMO parágrafo:** 8 das 78 são julgadas contra fonte viva; **70
continuam sendo prosa concordando com prosa**, porque o dourado de `protocolo` e `episodio` saiu do
mesmo corpus que gerou a resposta. Régua que não declara o próprio limite vira meta em cima de um
defeito.

### Fase H — o inventário do conversível (herdado, ainda o mapa que ordena tudo)

Varra os 286 documentos e classifique cada afirmação factual em três baldes: **conversível hoje**
(fonte viva já ligada) · **conversível com trabalho** (a fonte existe e não está ligada) · **não
conversível** (regra, decisão, julgamento — fica prosa **de propósito**, porque uma norma não tem
fonte viva, ela **é** a fonte).

**A pergunta incômoda continua sem resposta:** dos 286, quantos falam dos **35 projetos** e quantos
falam do **aparato que mede os 35 projetos**? Se a segunda metade for grande, isso tem duas
consequências práticas: o reranker gasta contexto com documentos sobre réguas quando a pergunta é
sobre projeto, e **explica por que o detector devolve tanto "o documento trata da corrida de
conformidade"** — porque muitos documentos tratam mesmo.

⚠️ `VER-08` também aqui: **primeira corrida entrega lista nominal, não percentual.**

### Fase I — o detector de contradição entre documentos (só depois da D)

Pares de documentos que falam do mesmo assunto, sem passar pelo dourado. 286 documentos são ~41 mil
pares; o recorte viável é o índice denso que já existe — dois documentos que se contradizem são
vizinhos no espaço vetorial.

**Continua sendo a fase mais bonita de mostrar e continua não sendo a primeira.** Ela usa a mesma
passada que ainda não passa nos portões.

---

## 5. A ordem defendida, e o argumento

**A → B → C → D → E → F → G → H → I**

- **A vem primeiro** porque nada a bloqueia e ela fica mais cara todo dia. Uma hora.
- **B vem antes de tudo que é técnico** porque custa zero chamada, o dado já está em disco, e é o
  único lugar onde o sistema já apontou para um erro DENTRO do corpus. Deixar isso sem ler enquanto
  se escreve código novo é o padrão que este handoff existe para quebrar.
- **C antes de D, e essa é a decisão que dá vontade de pular.** Ampliar fixture é trabalho braçal
  sem gráfico bonito no fim. Mas com 13 casos, a fase D **não é avaliável**: qualquer resultado dela
  cabe dentro do ruído do portão, e a sessão vai "concluir" o que quiser concluir.
- **E é barato e desproporcional:** achei uma mentira de "congelado" por acidente hoje. Duas horas
  para saber se há outras.
- **F é o dinheiro**, e o `orcaobra` subiu: é o único gateway vivo sem régua no portfólio inteiro.

**Se o pool estiver ruim: A → B → C(rotulagem) → E → F não gastam uma chamada sequer** — e são
cinco das seis melhores coisas a fazer.

**A tentação vai ser fazer a I primeiro** (detector de contradição é o que se mostra). Não faça.
**A segunda tentação, mais perigosa, é fazer a D com o holdout de 13 casos** e declarar vitória com
um número que sobe 7 pontos porque um caso mudou de lado.

---

## 6. O que NÃO fazer

- **Não escreva a quarta redação de regra do detector.** Três já falharam. O que funcionou foi
  mudar a ESTRUTURA da saída, três vezes seguidas.
- **Não reordene a saída do detector** (`TRECHO → MOTIVO → VEREDITO`). Há teste, e o comentário em
  `lib/defasagem.mjs` diz por quê.
- **Não afrouxe a conferência de citação para melhorar o número.** As 2 que caem hoje são
  fabricação real — o modelo trocou `tapepro` por `sirius` DENTRO da aspa com o motivo certo, e
  citou uma frase do `CLAUDE.md` que não estava no documento recebido.
- **Não conserte os 6 casos inválidos por construção.** Rótulo escrito depois de ler veredito é
  contaminado. Acrescente pares novos.
- **Não publique percentual de defasagem antes dos dois portões**, inclusive o 16,7% — que é
  **piso**, não estimativa.
- **Não publique os números da corrida de `estado` de 01/08.** Foi a primeira e mediu o check.
- **Não escreva `resposta` numa pergunta de camada `estado`** do `data/dourado.json`. Há teste.
  Texto que não existe não apodrece.
- **Não acrescente caso de `estado` a fixture do juiz sem congelar o gabarito** em
  `dourado_congelado`. Há teste. Sem isso o juiz julga contra string vazia.
- **Não deixe o juiz cair para a prosa quando a apuração falhar.** `nao_apurado` tira a pergunta da
  corrida. Fallback silencioso é o defeito com a pior relação dano/visibilidade do repo.
- **Não leia `sem-gateway` como "não cobra"**, nem `vendas` ausente como R$ 0, nem `nao_apurado`
  ou `n/a` como aprovação.
- **Não mexa no prompt do juiz da síntese.** 87,5% / 10-10, reconferido hoje depois do
  congelamento do fixture. É a única régua de LLM calibrada da casa.
- **Não reescreva handoff antigo para o corpus "bater" com hoje.** É registro datado e o único
  lugar onde se vê o que se sabia quando a decisão foi tomada.
- **Não some régua de LLM sem matar uma.** O pool é o orçamento e já morreu no meio de uma corrida.
- **Não refaça a curadoria de `familia`/`estado` sem refazer o holdout.**

---

## 7. Custo e prazo, francamente

| fase | esforço | chamadas |
|---|---|---|
| **A — 🚨 rotacionar o token do MP** | **~1 h (só o Jean)** | **0** |
| **B — ler os 3 `fiel + discorda` e o `contradiz`** | **~1 h** | **0** |
| **C — holdout 13 → 40 e adversarial 10 → 20** | **~4 a 6 h de rotulagem à mão** | **~60** |
| **D — duas passadas do detector** | **~4 h de código** | **~60 (cache por documento pode cortar)** |
| E — auditar todo "congelado" do repo | ~2 h | 0 |
| F — orcaobra/Kiwify · sirius · inventário pelo repo | ~1 sessão + ~3 h | 0 |
| G — remedir as 78 + recall por camada | ~3 h | ~78 |
| H — inventário do conversível | ~1 sessão inteira de leitura | 0 a 50 |
| I — detector de contradição | ~3 h de código | ~100 |

---

## 8. Armadilhas de operação

- **Reindexar depois de escrever handoff ou memória**: `node --env-file=.env scripts/indexar.mjs`
  (de máquina com Ollama, nunca do container). Memórias moram em `~/.claude`, fora do repo.
  **Este handoff inclusive.**
- **🆕 `parseDefasagem(texto, docTrecho)` recebe DOIS argumentos.** Sem o segundo, a conferência de
  citação não roda e volta a passar achado sem prova. Os dois chamadores já passam.
- **🆕 A conferência de citação ignora tudo que não é letra ou dígito.** Foi medido: com espaço
  apenas normalizado, 8 citações caíram e nenhuma era fabricada. O corpus é markdown; o modelo cita
  o texto que lê e larga a formatação.
- **🆕 Mudar o prompt do detector invalida o `.cache`** — cada tentativa custa ~24 chamadas. Rodar
  duas vezes seguidas com o mesmo prompt custa ~0.
- **🆕 `scripts/gateways.mjs` pede uma rota que não pode existir antes de acreditar em qualquer
  200.** SPA serve o shell em `/comprar` e `/assinar` ao mesmo tempo. Se o controle vier 200, todo
  200 daquele host vale zero.
- **🆕 Casar gateway pela PALAVRA marca catálogo de integração como cobrança.** Só URL.
- **O fixture de calibração é CONGELADO e tem `ancora`.** Caso cujo trecho não contém a âncora sai
  **antes** de qualquer chamada.
- **`data/projects.json` tem 5 famílias**, com ordem de precedência (`produto` primeiro). O enum
  vive em `lib/dourado-estado.mjs` (`FAMILIAS`) **e** em `lib/projects.ts`. Mexer num sem o outro
  passa no `npm test` e quebra o `tsc`.
- **`blockersLista` é `{texto, humano}` e tem TRÊS consumidores.** O `npm test` não pega quebra de
  formato — quem pega é `npx tsc --noEmit`.
- **Arquivo de teste novo entra à mão na lista do `package.json`**, senão nunca roda.
- **Citação de exemplo vai entre crases** — `validade.mjs` mascara span de crase.
- **`data/*.json` é UTF-8 e o `Get-Content` do PowerShell mostra mojibake.** O round-trip
  `JSON.stringify(…, null, 2)` preserva.
- **Nome de arquivo de corrida é UTC; `apurado_em` é BRT.** Comparar corridas pela data do nome
  inventa regressão.
- **A janela de 28 dias do GSC desliza na meia-noite UTC.** O mesmo fim de tarde deu 33 e 42.
- **Impressão pede `dimensions: []`; clique não-branded pede `query`.**
- **Escrever handoff no meio de uma medição muda o corpus** (mexe em IDF e vetor). Comparar sempre
  contra a mesma execução (`--min bm25`).
- **Ler as linhas, não o agregado.** `--ver`.
- **`--motor todos` NÃO inclui o rerank.**
- **Não dar push entre 00:00 e 01:00 BRT** (cron do autopublishing às 00:13).
- **Deploy é Docker no EasyPanel, não Vercel.**
- **`HUB_USER`/`HUB_PASS` estão no `.env` local** — dá para verificar produção sem pedir ao Jean.

---

## 9. Primeiros 20 minutos

1. `npm test` (**252 verdes**), `npx tsc --noEmit` e `node scripts/validade.mjs` (**0 achados**) —
   para saber se o que quebrar depois foi você.
2. `node --env-file=.env scripts/vendas-mercadopago.mjs` — **~5 s, zero LLM.** ⚠️ **Se ele
   autenticar, a fase A NÃO foi feita.** Se falhar com erro de auth, foi feita e o `.env` do roihub
   não foi atualizado junto.
3. `node scripts/gateways.mjs --ver` — **~1 min, zero LLM, zero pool.** O retrato do dinheiro:
   1 ligado, 1 servido sem régua, 3 só preço, 30 nada.
4. **Abra `data/juiz-corridas/2026-08-01-0423.json` e leia os 4 casos da fase B.** Não é comando, é
   leitura, e é a coisa de maior retorno por hora deste documento.
5. `node --env-file=.env scripts/defasagem-calibrar.mjs --ver` — **cache morno, ~0 chamadas.** Leia
   os 2 erros do holdout e os 2 adversariais que escaparam. **Todos dizem `nao-fala`.** E leia o
   cabeçalho da própria saída: o arquivo tem 20 casos, **6 saem inválidos por construção**, 14
   rodam e **13 contam**. Essa contagem é o argumento inteiro da fase C — o denominador do portão
   que decide tudo cabe numa mão e meia.
