# Handoff — a definição de PRONTO, e por que ela vem antes da próxima fase (01/08/2026)

Este documento é **especificação de trabalho, não relatório**. Assume que quem chega não tem
contexto, e **esforço não é critério de corte**: onde o caminho barato e o caminho certo divergem,
ele defende o certo e diz o preço na cara.

Estado imediatamente anterior:
[`handoff-os-quatro-erros-sao-a-mesma-celula.md`](handoff-os-quatro-erros-sao-a-mesma-celula.md)
(o que foi executado em 01/08: fases B e E completas, C parcial) ·
spec que o originou: [`handoff-o-portao-tem-treze-casos.md`](handoff-o-portao-tem-treze-casos.md) ·
leituras: [`../docs/juiz-fase-b-2026-08-01.md`](../docs/juiz-fase-b-2026-08-01.md) ·
[`../docs/auditoria-congelado-2026-08-01.md`](../docs/auditoria-congelado-2026-08-01.md) ·
[`../docs/defasagem-fase-c-2026-08-01.md`](../docs/defasagem-fase-c-2026-08-01.md) ·
índice: [`../handoff.md`](../handoff.md).

---

## 1. A frase incômoda que abre este documento

> **Em 3 dias esta frente produziu 6 handoffs, 9 réguas e 4 documentos de calibração — e o número
> que ela existe para produzir nunca foi publicado uma única vez.**

A taxa de erro do corpus tem um valor conhecido (**16,7%, e é PISO**), medido em 31/07, e ele está
proibido de sair desde então porque o instrumento não passa nos próprios portões. Enquanto isso a
casa construiu: o juiz, o gabarito vivo, o inventário de gateways, a validade, a conformidade, o
lacre dos fixtures, os portões do detector e os portões do juiz.

**Nada disso é desperdício** — cada um pegou um defeito real, e vários pegaram defeitos que teriam
publicado número falso com autoridade de número apurado. **Mas o balanço é o que é: o sistema
aprendeu a medir muito melhor do que aprendeu a consertar.** Há uma camada de meta-medição — réguas
que medem réguas — crescendo mais rápido que o valor que ela protege.

E isso tem uma causa mecânica, não moral: **nenhum handoff desta frente jamais escreveu o que
significa terminar.** Cada um entrega 9 fases, executa 2 ou 3, e gera o próximo com 8. Um plano que
sempre cabe mais uma fase não é um plano, é um passatempo com boa engenharia.

**Este documento existe para consertar isso, e a seção 2 é a coisa mais importante que ele tem.**

---

## 2. 🎯 A DEFINIÇÃO DE PRONTO

Três níveis, e eles não são opcionais um do outro: o nível 2 é a feature, o nível 1 é o
pré-requisito dele, o nível 3 é o que faz a feature valer alguma coisa depois de pronta.

### Nível 1 — O INSTRUMENTO é confiável *(o detector de defasagem)*

Hoje: **não**. Portão 1 reprova por 1 caso não-parseável, portão 2 por 1 caso.

| # | critério | hoje | pronto |
|---|---|---|---|
| 1.1 | holdout com **casos que contam** | 33 | **≥ 40** |
| 1.2 | adversarial | 10 | **≥ 20** |
| 1.3 | **`ancora` em 100% dos casos**, holdout e adversarial | 26/49 | **49/49** |
| 1.4 | portão 1: acerto ≥ 85% **e zero sem veredito parseável** | 87,5%, 1 sem veredito | **passa** |
| 1.5 | portão 2: ≥ 90% dos adversariais pegos | 8/10 | **≥ 18/20** |
| 1.6 | 🔑 **células perigosas em ZERO** | ✅ já está | **mantém** |
| 1.7 | 🆕 **reprodutibilidade: a mesma corrida, com o corpus reindexado noutro dia, não move mais que 3 pontos** | **nunca foi medido** | **medido 2×** |

**1.6 é o critério que vale mais que o agregado, e ele é a descoberta de 01/08.** As duas células
que importam são `desmente → qualquer coisa` (**esconde** corpus podre) e `qualquer coisa →
desmente` (**fabrica** tarefa). Hoje as duas estão em zero, com 5/5 na diagonal de `desmente`. **Um
detector com 95% de acerto e um `desmente` perdido é pior que um com 87,5% e nenhum.** Escreva o
portão nesses termos, não só no percentual.

**1.7 não existe e é o buraco mais sério da lista.** O corpus muda toda vez que alguém escreve um
handoff ou uma memória — muda o IDF, muda o vetor, muda o top-10, muda o trecho de 2400 chars que
o detector recebe. **Um portão que nunca foi medido duas vezes não sabe se mede o detector ou o
dia.** Já aconteceu nesta base: o recall caiu 83,0% → 82,4% sem uma linha de código mudar. O
fixture de defasagem é congelado (inclui o trecho), o que protege contra isso **por construção** —
mas isso é uma crença de projeto que nunca foi verificada, e a fase E de 01/08 existiu exatamente
para provar que crenças assim mentem.

### Nível 2 — A FEATURE entrega *(o corpus tem taxa de erro conhecida e ela é publicável)*

Hoje: **não**, e nunca esteve.

| # | critério | pronto |
|---|---|---|
| 2.1 | `corpus-defasado.mjs` roda a corrida completa sem abortar por pool | corrida limpa, registrada |
| 2.2 | a saída é **lista NOMINAL** — cada linha é um documento e uma frase | ✅ já é assim |
| 2.3 | o percentual sai **com o recorte na mesma frase** ("X% entre os N documentos que a busca recupera para as M perguntas com apuração viva") | publicado 1× |
| 2.4 | 🔑 **a fronteira sai junto, sempre**: quantas perguntas são julgadas contra fonte viva e quantas são prosa concordando com prosa | hoje 8 de 78 |
| 2.5 | os achados são **lidos um a um antes de virar número** — `VER-08`, a 1ª corrida mede o CHECK | 2 corridas, não 1 |

⚠️ **2.4 é a mais fácil de esquecer e a mais cara.** Publicar "a taxa de erro do corpus é X%" sem
dizer que **70 das 78 perguntas comparam texto com texto escrito pelo mesmo pipeline** transforma
uma medição honesta e parcial numa afirmação global falsa. Régua que não declara o próprio limite
vira meta em cima de um defeito.

### Nível 3 — O LOOP fecha *(o número serve para alguma coisa)*

Hoje: **não existe**, e é o que separa esta frente de um termômetro caro.

| # | critério | pronto |
|---|---|---|
| 3.1 | todo achado da corrida vira **ação nomeada**: consertar o documento vivo, ou registrar como lacuna | 100% dos achados |
| 3.2 | 🔑 **a segunda corrida prova que o conserto funcionou** — o achado consertado SOME | provado ≥ 1× |
| 3.3 | 🔑 **o número CAI entre duas corridas do mesmo instrumento** | provado ≥ 1× |
| 3.4 | existe cadência declarada (semanal? por entrega?) e ela está escrita numa norma | 1 protocolo |

**3.2 e 3.3 são o critério final desta feature.** Enquanto o número nunca tiver caído por causa de
um conserto, ninguém sabe se o sistema mede defasagem ou mede ruído. **Uma medição que nunca
mudou de valor em resposta a uma ação é indistinguível de uma constante.**

⚠️ **Handoff datado NÃO entra em 3.1 como "consertar".** Ele é registro do que se sabia quando a
decisão foi tomada, e reescrevê-lo destrói a única coisa que o corpus tem de auditável. Achado em
handoff vira **convenção daí pra frente** — e se a convenção precisa existir, ela vira norma viva.

---

### 🚦 A resposta curta à pergunta "quando acaba?"

> **A feature está PRONTA quando o detector passa nos dois portões com resolução de 40+/20 e
> células perigosas em zero (nível 1), a taxa de erro do corpus é publicada uma vez com o recorte
> e a fronteira na mesma frase (nível 2), e uma segunda corrida mostra o número CAINDO porque os
> achados da primeira foram consertados (nível 3).**
>
> **Custo honesto do caminho inteiro: ~20 a 26 horas de trabalho e ~350 chamadas do pool.**

**E o que está explicitamente FORA do pronto** — porque um escopo sem fronteira é o defeito que
este documento abre denunciando:

- ❌ **Fase I (detector de contradição entre documentos).** É a mais bonita de mostrar e não faz
  parte de "o corpus tem taxa de erro conhecida". Vira frente própria **depois**.
- ❌ **Fase H (inventário do conversível).** Mapa útil, não requisito.
- ❌ **Cobrir as 78 perguntas com fonte viva.** Hoje 8. Aumentar é bom e **não é este goal** —
  o goal exige *declarar* a fronteira, não *eliminá-la*.
- ❌ **Qualquer régua de LLM nova.** O pool é o orçamento e já morreu no meio de corrida. **Não
  some régua de LLM sem matar uma.**

---

## 3. O que fazer, na ordem que "o melhor" recomenda

A ordem abaixo **não é a mais barata**. Ela é a que produz a feature pronta com o menor risco de
publicar número errado — e onde barato e certo divergem, ela escolhe o certo e diz o preço.

### 🚨 Fase A — rotacionar o token do MP e o resto de `secrets_to_rotate` (só o Jean)

**Fora de ordem de propósito: não é melhoria, é dívida vencida, e é a única coisa deste documento
que fica mais cara a cada dia que passa.** `SEC-04` registra token de produção do Mercado Pago em
`origin/main` do repo **público** `JeanZorzetti/Atma`, e em todo o histórico. **Rodei
`scripts/vendas-mercadopago.mjs` em 01/08 e ele autenticou.** Tornar o repo privado não desfaz —
pode ter sido clonado ou indexado. E a exposição **aumentou**: há uma régua automatizada lendo a
conta de pagamento com essa credencial, e o `.env` do roihub tem uma cópia.

Rotacionar no painel do MP e atualizar **os três**, senão a régua quebra em silêncio e vira
`nao_apurado` sem ninguém entender: `Atma/Site/Frontend/.env.local` · env de produção do atma no
EasyPanel · `.env` do roihub. Depois: **dinheiro → e-mail transacional → senha de banco (reusada em
Compass, `sofia_db`, `siriusdb`) → JWT secret.**

**Preço honesto: ~1 h. Nada neste documento depende dela, e é exatamente por isso que ela vem
primeiro: nada a bloqueia, só a inércia.**

### Fase C — fechar o portão do detector *(1.1 a 1.3, 1.5)*

**É a fase braçal, sem gráfico bonito no fim, e é a que torna todas as outras decidíveis.**

- **C-1 — holdout de 33 para 40+ casos que contam.** **61 pares candidatos já estão gerados,
  recortados na janela de 2400 da produção e commitados** em `data/defasagem-candidatos.json`. O
  caro (gerar) está feito; falta a leitura. **Priorize os que darão `desmente`:** são 7 de 39 hoje,
  e é a célula que decide.
- **C-2 — adversarial de 10 para 20.** 10 não separam 8/10 de 9/10, e hoje reprova por um.
  ⚠️ **Mantenha a regra de que alguns adversariais são o ESPELHO de casos do holdout** (a mesma
  frase com a data arrancada), senão um detector que absolve por atacado passa nos dois de uma vez.
- **C-3 — `ancora` nos 10 adversariais.** Nenhum tem; a regra de construção **não roda ali**.
  Para os adversariais isso é seguro (o rótulo é `desmente` por construção, a frase corrompida é
  conhecida no ato da corrupção) — é dívida de rigor, não contaminação.
- **C-4 — o caso `defasagem-citacao` que trava o portão 1.** `project_roihub_conformidade` falha
  com citação não conferida. **Leia esse caso antes de qualquer outra coisa da fase C:** ou é
  fabricação real (e o portão está certo em reprovar, e o caso fica), ou é a conferência sendo
  estrita demais numa forma de markdown ainda não vista (e aí é conserto de check, não do detector).

⚠️ **As regras não se negociam, e são o que salvou a rodada de 01/08:** rotular lendo **exatamente**
a janela de 2400 que a produção recorta · `ancora` conferida contra o trecho **antes** de escrever
· **commitar antes de rodar**. ⚠️ **Não conserte os 6 inválidos por construção** e **não preencha a
`ancora` dos 7 legados do holdout** — escolher a frase depois de ver o veredito é rótulo
contaminado, e eles são o registro de que o check errou.

⚠️ **`D-68` e `D-69` (os do GSC) ficam fora dos pares novos**: são a família `(hoje N)`, que já
domina o material. Ampliar por ali reforça a monocultura e faz o portão medir uma regex.

**Preço honesto: ~4 a 5 h de leitura e rotulagem à mão, ~30 chamadas.**

### Fase D — as duas passadas do detector *(1.4, 1.5)*

**Só depois da C**, e agora com alvo medido em vez de adivinhado: os 4 erros restantes são todos
`bate → nao-fala`, ou seja, **o detector não decide se o documento FALA do assunto.**

- **passada 1 (cega ao fato):** *"que afirmação, se alguma, este documento faz sobre X?"* — devolve
  a frase literal ou `nenhuma`. **Não vê o fato apurado**, então não tem como construir desculpa.
  **É exatamente a pergunta que os 4 erros erram.**
- **passada 2 (cega ao documento):** *"esta afirmação é compatível com este fato?"* — devolve
  `bate|desmente`. Não vê o tema do documento, então não tem como absolver por assunto.

É a versão extrema do que já funcionou três vezes: **separar a extração da evidência do julgamento
dela.** `nao-fala` deixa de competir com os outros dois — vira uma saída da passada 1.

⚠️ **Custo real, e ele é político: dobra as chamadas de `corpus-defasado.mjs`** (hoje 1 por
documento, ~10 por pergunta). O pool já serve autopublishing, rerank, síntese, juiz e defasagem, e
**morreu no meio de uma corrida em 30/07.** Duas saídas honestas: **(a)** rodar a passada 1 uma vez
por documento e **cachear por documento** — ela não depende do fato, só do assunto, e isso pode ser
barato de verdade; **(b)** aceitar o custo e matar outra régua de LLM. **A (a) é melhor e deve ser
tentada primeiro.**

⚠️ **Mudar o prompt invalida o `.cache`** (~24 chamadas por tentativa) — **e desde 01/08 mudar o
`effort` também**, que é o conserto desta sessão funcionando como deve.

**Preço honesto: ~4 h de código, ~60 chamadas (o cache por documento pode cortar bem).**

### Fase R — 🆕 reprodutibilidade do portão *(1.7)*

**Não estava em handoff nenhum, e é o buraco mais sério da lista.** Um portão nunca medido duas
vezes não sabe se mede o detector ou o dia.

**O teste é mecânico:** rode `defasagem-calibrar.mjs`, escreva um handoff qualquer, **reindexe**
(`scripts/indexar.mjs`), rode de novo. **Se o número mudar, o fixture não está congelado como
acredita** — e a fase E de 01/08 existiu justamente para provar que "congelado" mente. O fixture
inlina apurado **e** trecho, então o esperado é **zero movimento**; provar isso vale a hora.

⚠️ **Rode com o cache MORNO nas duas vezes**, senão você mede a variância do modelo em vez da do
corpus — e essa é uma segunda medição, legítima e separada.

**Preço honesto: ~1 h, ~0 chamadas (cache morno).**

### Fase G — a corrida completa e a publicação com a fronteira declarada *(2.1 a 2.5)*

⚠️ **`VER-08` se aplica duas vezes:** a corrida de `estado` de 01/08 foi a **primeira** julgada
contra gabarito apurado, e **a primeira corrida de um check novo mede o CHECK.** Os números dela
(37,5% correta, 37,5% incompleta) **não se publicam**. **Planeje duas corridas.**

**Publique com a fronteira no MESMO parágrafo:** 8 das 78 são julgadas contra fonte viva; **70
continuam sendo prosa concordando com prosa**, porque o dourado de `protocolo` e `episodio` saiu do
mesmo corpus que gerou a resposta.

E há um achado à parte, que **não é do juiz e tem caso nominal desde a fase B**: na camada `estado`
o top-10 trouxe a fonte do dourado em apenas **75%** e a citação ancorou em **50%**. Isso é
**RECUPERAÇÃO**, não síntese, e está escondido no agregado porque `protocolo` domina (65 das 78).
`D-72` é o caso nominal: a resposta citou o único documento que recebeu, e ele **não continha a
informação**, enquanto 10+ que continham nunca chegaram. **Régua própria:**
`scripts/avaliar.mjs --motor rerank --min bm25`, recortado por camada.

**Preço honesto: ~3 h, ~78 chamadas por corrida (planeje duas).**

### Fase L — 🆕 o LOOP, que é o que faz tudo isso valer *(3.1 a 3.4)*

**É a fase que nunca existiu em handoff nenhum desta frente, e sem ela o nível 2 é um termômetro.**

1. **Cada achado da corrida limpa vira ação nomeada**, numa das três: *documento vivo se conserta*
   · *é handoff datado, vira convenção daí pra frente* · *é lacuna real, vira item*.
2. **Consertar os do primeiro balde de verdade** — inclusive os 2 que a fase B já nomeou e que
   continuam abertos: **B-1** (cobertura de medição fora da oração do número, também em prosa) e
   **B-2** (a taxonomia vigente das 5 famílias **não existe em documento vivo nenhum**, só em
   `lib/dourado-estado.mjs`, `lib/projects.ts` e no `CLAUDE.md` — por isso toda pergunta sobre
   famílias recupera a versão superada, que é a única escrita em prosa).
3. **Reindexar e rodar de novo.** **O achado consertado tem que SUMIR e o número tem que CAIR.**
4. **Escrever a cadência como norma** (protocolo com `verificacao.como`), senão ela não roda.

⚠️ **Se o número NÃO cair, o resultado é bom e é o mais valioso do documento:** significa que o
detector achava o que não era, ou que o conserto não conserta. **Nos dois casos é melhor descobrir
com 2 corridas do que depois de 6 meses de relatório mensal.**

**Preço honesto: ~4 h + 1 corrida (~78 chamadas). É a fase que fecha a feature.**

### Fase F — o dinheiro *(paralela, 0 chamadas, e não depende de nada acima)*

**F.1 — `orcaobra`/Kiwify.** É o **único projeto do portfólio com gateway vivo (`pay.kiwify.com.br`
servido na home) e nenhuma régua lendo.** O card diz "ÚNICO dos 9 que fatura hoje" e `receita: 7`,
e **isso nunca passou por régua nenhuma**. A Kiwify tem API. **Enquanto não passar, o card diz
AFIRMADO.**

**F.2 — `sirius`.** Não cobra pelo site: fatura por tier de organização no próprio banco.
`31.97.23.166:5434` dá `ETIMEDOUT` da máquina de dev. A query honesta é conhecida:

```sql
SELECT count(*) FROM "Organization"
WHERE "tier" <> 'FREE' AND "isTestAccount" = false;
```

`isTestAccount` é campo do próprio schema, com o comentário *"exclude from revenue metrics"* — **o
sirius já sabia do problema que o `atma` só revelou em 31/07.** Caminhos, em ordem de honestidade:
abrir a porta no firewall do VPS · rodar de dentro do container pelo EasyPanel · expor rota de
leitura autenticada. **Não invente número enquanto nenhum dos três acontecer.**

**F.3 — completar o inventário pelo REPO, não só pelo site.** `gateways.mjs` olha o HTML servido;
não vê gateway montado por JS depois de um clique, nem chave num `.env`, nem SDK num
`package.json`. **Os 30 do balde `sem-gateway` são "não achei caminho servido", nunca "não cobra".**

**Preço honesto: F.1 ~1 sessão · F.2 depende de infra e pode não sair · F.3 ~3 h. 0 chamadas.**

---

## 4. A ordem defendida, e o argumento de cada posição

**A → C → D → R → G → L**, com **F em paralelo** sempre que o pool estiver ruim.

- **A vem primeiro** porque nada a bloqueia e ela fica mais cara todo dia. Uma hora.
- **C antes de D, e essa continua sendo a decisão que dá vontade de pular** — e agora dá **mais**
  vontade, porque a matriz de 01/08 ficou bonita. **Não pule.** Uma matriz limpa em 33 casos, com
  um caso valendo 3 pontos, é exatamente a forma que a sorte tem quando se parece com progresso.
- **D depois da C**, com a passada 1 cacheada por documento antes de aceitar dobrar o pool.
- **R depois da D e antes da G**, porque publicar um número de um portão que nunca reproduziu é o
  defeito que esta base inteira existe para não cometer.
- **G antes da L** porque não há o que consertar antes de existir lista limpa.
- **L por último e inegociável.** Sem ela nada disto virou valor: vira um termômetro caro que
  ninguém leu.

**Com o pool ruim: A → C(rotulagem) → R → F → L(passo 1 e 2) não gastam quase nada** — e são cinco
das sete melhores coisas a fazer.

---

## 5. O que NÃO fazer

- **Não faça a fase D com o holdout de 33 casos** achando que a matriz limpa autoriza. Um caso vale
  3 pontos, e `bate → nao-fala` é o mesmo mecanismo de `desmente → nao-fala`, que **esconde** corpus
  podre — hoje ele só cai no lado seguro.
- **Não publique percentual de defasagem antes dos dois portões**, inclusive o 16,7%, que é **piso**.
- **Não publique os números da corrida de `estado` de 01/08.** Foi a primeira e mediu o check.
- **Não escreva a quarta redação de regra do detector.** Três falharam. O que funcionou 3× foi mudar
  a **estrutura** da saída.
- **Não reordene a saída do detector** (`TRECHO → MOTIVO → VEREDITO`). Há teste, e o comentário em
  `lib/defasagem.mjs` diz por quê.
- **Não afrouxe a conferência de citação para melhorar o número.** As que caem hoje são fabricação
  real — o modelo trocou `tapepro` por `sirius` DENTRO da aspa com o motivo certo.
- **Não afrouxe a condição "zero sem veredito parseável"** do portão 1: é ela que impede excluir o
  caso difícil até o número subir.
- **Não conserte os 6 inválidos por construção nem preencha a âncora dos 7 legados do holdout.**
- **Não atualize `dourado_lacrado` sem querer.** Se o teste do lacre reprovar, ou o gabarito mudou
  de propósito (atualize o hash e diga por quê) ou alguém acabou de mover um portão sem perceber.
- **Não deixe o juiz cair para a prosa quando a apuração falhar.** `nao_apurado` tira a pergunta da
  corrida. Fallback silencioso é o defeito com a pior relação dano/visibilidade do repo.
- **Não mexa no prompt do juiz da síntese.** 87,5% / 10-10. É a única régua de LLM calibrada.
- **Não reescreva handoff antigo** para o corpus bater com hoje. É registro datado e o único lugar
  onde se vê o que se sabia quando a decisão foi tomada.
- **Não some régua de LLM sem matar uma.** O pool é o orçamento e já morreu no meio de corrida.
- **Não leia `sem-gateway` como "não cobra"**, nem `vendas` ausente como R$ 0, nem `nao_apurado` ou
  `n/a` como aprovação.
- **Não abra a fase I nem a H antes do nível 3.** Elas estão explicitamente fora do pronto.

---

## 6. Custo e prazo, francamente

| fase | esforço | chamadas | nível de PRONTO |
|---|---|---|---|
| **A — 🚨 rotacionar o token do MP** | **~1 h (só o Jean)** | **0** | — (dívida) |
| **C — holdout 33 → 40+, adversarial 10 → 20** | **~4 a 5 h de rotulagem à mão** | ~30 | 1.1–1.3, 1.5 |
| **D — duas passadas do detector** | ~4 h de código | ~60 (cache/doc pode cortar) | 1.4–1.6 |
| **R — 🆕 reprodutibilidade do portão** | ~1 h | ~0 (cache morno) | 1.7 |
| **G — corrida completa + fronteira + recall por camada** | ~3 h | ~78 × 2 corridas | 2.1–2.5 |
| **L — 🆕 o loop: conserto → o número cai** | ~4 h | ~78 | 3.1–3.4 |
| F — orcaobra/Kiwify · sirius · inventário pelo repo | ~1 sessão + ~3 h | 0 | paralela |

**Total do caminho até PRONTO: ~20 a 26 h e ~350 chamadas.** É muito, e é o preço honesto de um
número que se pode publicar sem mentir. **Cortar aqui significa publicar mais cedo um número que
não se sustenta — que é o defeito que esta base inteira existe para não cometer.**

---

## 7. Armadilhas de operação

- **`rodarCacheado(prompt, run, ligado, { modelo, effort })`** — o 4º argumento é objeto desde
  01/08, e as opções vão para a chave **e** para o `run`. Passar o effort só dentro do `run` volta a
  esconder a troca. **Mudar o `effort` agora invalida o cache**; a chave sem effort é legado, ainda
  lida, nunca escrita.
- **`dourado_lacrado` trava por HASH** os 27 gabaritos que os portões leem de `dourado.json`.
  Reescrever a `resposta` de um caso reprova o `npm test` nomeando o caso e imprimindo o hash novo.
- **O portão 1 tem DUAS condições:** `>= 85%` **e** zero sem veredito parseável.
- **`parseDefasagem(texto, docTrecho)` recebe DOIS argumentos.** Sem o segundo, a conferência de
  citação não roda e volta a passar achado sem prova.
- **A conferência de citação ignora tudo que não é letra ou dígito.** Foi medido: com espaço apenas
  normalizado, 8 citações caíram e nenhuma era fabricada.
- **`trechoRelevante` tem TRÊS orçamentos na casa:** 900 no default (reranker), **2400** em
  `lib/resposta.mjs:17` e `scripts/corpus-defasado.mjs:38`. **Medir com o default é medir o
  componente errado** — aconteceu em 01/08 e trocou a classificação de um caso inteiro.
- **Reindexar depois de escrever handoff ou memória:** `node --env-file=.env scripts/indexar.mjs`
  (de máquina com Ollama, nunca do container). Memórias moram em `~/.claude`, fora do repo.
  **Este handoff inclusive.**
- **Escrever handoff no meio de uma medição muda o corpus** (mexe em IDF e vetor). Comparar sempre
  contra a mesma execução (`--min bm25`).
- **`scripts/gateways.mjs` pede uma rota que não pode existir antes de acreditar em qualquer 200.**
  SPA serve o shell em `/comprar` e `/assinar` ao mesmo tempo.
- **Casar gateway pela PALAVRA marca catálogo de integração como cobrança.** Só URL.
- **`data/projects.json` tem 5 famílias**, com ordem de precedência (`produto` primeiro). O enum
  vive em `lib/dourado-estado.mjs` **e** em `lib/projects.ts`. Mexer num sem o outro passa no
  `npm test` e quebra o `tsc`.
- **`blockersLista` é `{texto, humano}` e tem TRÊS consumidores.** Quem pega quebra de formato é
  `npx tsc --noEmit`, não o `npm test`.
- **Arquivo de teste novo entra à mão na lista do `package.json`**, senão nunca roda.
- **Citação de exemplo vai entre crases** — `validade.mjs` mascara span de crase.
- **`data/*.json` é UTF-8 e o `Get-Content` do PowerShell mostra mojibake.** O round-trip
  `JSON.stringify(…, null, 2)` preserva.
- **Nome de arquivo de corrida é UTC; `apurado_em` é BRT.** Comparar corridas pela data do nome
  inventa regressão.
- **A janela de 28 dias do GSC desliza na meia-noite UTC.** O mesmo fim de tarde deu 33 e 42.
- **Impressão pede `dimensions: []`; clique não-branded pede `query`.**
- **Ler as linhas, não o agregado.** `--ver`.
- **`--motor todos` NÃO inclui o rerank.**
- **Não dar push entre 00:00 e 01:00 BRT** (cron do autopublishing às 00:13).
- **Deploy é Docker no EasyPanel, não Vercel.**
- **`HUB_USER`/`HUB_PASS` estão no `.env` local** — dá para verificar produção sem pedir ao Jean.

---

## 8. Primeiros 20 minutos

1. `npm test` (**254 verdes**), `npx tsc --noEmit` e `node scripts/validade.mjs` (**0 achados em
   235 vivos**) — para saber se o que quebrar depois foi você.
2. `node --env-file=.env scripts/vendas-mercadopago.mjs` — **~5 s, zero LLM.** ⚠️ **Se ele
   autenticar, a fase A NÃO foi feita.** Autenticou em 01/08.
3. **Leia a seção 2 deste documento inteira antes de escrever uma linha de código.** É a única
   parte que muda o que você vai fazer nas próximas 20 horas.
4. `node --env-file=.env scripts/defasagem-calibrar.mjs --ver` — **cache morno, ~0 chamadas.**
   **Leia a MATRIZ, não o percentual.** Os 4 erros são todos `bate → nao-fala` e a linha
   `desmente → desmente` está em 5/5.
5. **Abra `data/defasagem-candidatos.json`** (61 pares, já recortados na janela de 2400) e comece a
   rotular **pelos que darão `desmente`**. É a fase C, é o que destrava a D, e o material já está
   em pé.
