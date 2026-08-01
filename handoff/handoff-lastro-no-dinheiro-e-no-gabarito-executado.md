# Handoff EXECUTADO — o dinheiro ganhou lastro, e as duas réguas novas reprovaram o que existia

Executado em 31/07/2026 (noite) → 01/08. Spec:
[`handoff-lastro-no-dinheiro-e-no-gabarito.md`](handoff-lastro-no-dinheiro-e-no-gabarito.md) ·
índice: [`../handoff.md`](../handoff.md).

**Fases A, B, C e D executadas. E e G não. F está BLOQUEADA — e quem a bloqueou foi a medição da
própria fase B, não falta de tempo.**

`npm test` 247 verdes · `npx tsc --noEmit` limpo · `validade` 0 achados em 231 documentos vivos ·
`dourado-estado --estado tudo` **8 de 8 apuradas**.

---

## 1. Os três achados que mudam decisão

### 1.1 💰 R$ 940 de faturamento que não existe — e `approved` + `live_mode: true` não separa

O Mercado Pago do `atma` tem **20 pagamentos aprovados de R$ 47**, entre 28 e 30/11/2025, todos
com `live_mode: true`. São **R$ 940**, e **zero venda**: os 20 têm payer
`test_user_…@testuser.com` e CPF `11111111111`. É o Jean validando o checkout.

Somar `approved` teria publicado R$ 940 de receita inexistente **com a autoridade de um número
apurado** — que é exatamente o defeito que esta frente veio consertar. Quem separa é o **payer**;
`live_mode` não separa nada, porque usuário de teste do MP transaciona contra a aplicação de
produção. Medido, não suposto.

**O card do `atma` estava certo ao dizer "venda não confirmada" — e agora isso é apurado.**

### 1.2 🚩 Os dois portões do detector de defasagem REPROVARAM, e isso inverte a leitura do 16,7%

| portão | exigido | medido |
|---|---|---|
| holdout cego | ≥ 85% | **71,4%** (10/14) |
| adversarial | ≥ 9/10 | **3/10** |

O modo de falha é **um só e tem nome: `nao-fala` engole tudo.** O detector decide pelo TEMA do
documento, não pela AFIRMAÇÃO dentro dele. Corrompi `project_roihub_conformidade` para dizer **12
projetos** em vez de 35 e ele respondeu `nao-fala`, com o motivo *"o documento trata da corrida de
conformidade e não afirma quantos projetos o hub tem hoje"*. Ele não erra ao acaso — ele **constrói
desculpas para absolver**.

**Consequência que inverte a conclusão de ontem:** um instrumento que absolve 7 de 10 corrupções
deliberadas **não superestima a defasagem, subestima**. Os 8 `desmente` foram os altos o bastante
para sobreviver a um detector que cala por padrão. **A taxa real do corpus é provavelmente MAIOR
que 16,7%**, e "é UM defeito só, `(hoje N)` em prosa" pode ser só o único defeito que este detector
sabe ver.

Detalhe estrutural, agora **reproduzido duas vezes** e não mais anedótico: o `MOTIVO` certo com o
`VEREDITO` errado — `VEREDITO: bate` com o motivo dizendo *"é incompatível com o apurado hoje —
desmente"*. Isso não se conserta melhorando a definição de `desmente`.

Tentei **uma** segunda redação, mirando o modo de falha nomeado e não os casos. Piorou o portão que
mais decide (71,4% → 50,0%) e foi revertida. Não há terceira: o portão existe para dizer *pare*.
Tudo em [`../docs/defasagem-calibracao.md`](../docs/defasagem-calibracao.md).

### 1.3 🆕 A curadoria de ontem perdeu 6 das 8 divergências — e ganhou uma quinta família

Concordância entre duas leituras cegas dos mesmos 35 cards: **família 77,1%, estado 85,7%**.

Dois achados, e o segundo é maior:

- **A quarta família se validou sozinha.** A derivação cega recebeu só as TRÊS da spec original e
  **reinventou `nao-vende`** com outro nome (`nao-comercial`). Encerra a dúvida: não é invenção de
  quem curou.
- **Faltava uma quinta: `produto`** — *quebra antes da cobrança, não há o que cobrar*. Quatro
  projetos que a curadoria tinha espalhado por **três famílias diferentes** dizendo a mesma coisa
  (`cardiorisk` e `tapevision` em `cobranca`, `cyberspace` em `nao-vende`, `reviewshield` em
  `trafego`). Chamar o `cardiorisk` de "não tem como cobrar" faria o hub propor trabalho de
  cobrança num projeto cujo defeito é **não existir produto**.

**6 das 8 divergências eram a DEFINIÇÃO, não o rótulo.** Por isso as definições agora são testes
com ordem de precedência, em
[`../docs/curadoria-familia-concordancia.md`](../docs/curadoria-familia-concordancia.md).

---

## 2. O que foi entregue, fase a fase

### Fase A — `D-67` contra o gateway ✅ (Mercado Pago; sirius e Kiwify não)

- **`lib/vendas.mjs`** — classifica cada pagamento e devolve o **motivo** de cada descarte, nunca
  um booleano. Estorno parcial abate do valor em vez de apagar a linha.
- **`scripts/vendas-mercadopago.mjs`** — deriva `vendas: [{data, valor, fonte, id}]` do gateway e
  imprime **o que o card afirmava ao lado do que o gateway pagou**. Default é só imprimir:
  `vendas` curado à mão é o `receitaNota` com cara de fato.
- **`D-67` reescrita.** `vendas` ausente e `vendas: []` **são coisas diferentes** — ausente é
  "nenhum gateway ligado", `[]` é "o gateway respondeu e não pagou nada". O denominador é o dos
  checados e os 34 sem fonte saem **nomeados na `ressalva`**. Confundir os dois seria tratar `n/a`
  como aprovação.
- **`MERCADOPAGO_ACCESS_TOKEN`** no `.env` e no `.env.example`.
- Blocker do `atma` *"MP nunca testado em produção"* → **desmentido pelo gateway** e rebaixado para
  `humano: false`.

**8 de 8 apuradas.**

🚩 **O `sirius` NÃO foi ligado, e o motivo é rede, não credencial.** O `.env` do repo tem a URL
completa e `31.97.23.166:5434` devolve **ETIMEDOUT** da máquina de dev — mesmo padrão do `:5499` do
sofia-next. **O esquema já foi lido e a query é conhecida**: `Organization` tem `tier`,
`stripeSubscriptionId`, `mercadoPagoSubscriptionId`, `billingStartDate` e — o campo que importa —
**`isTestAccount`** (*"exclude from revenue metrics (test users with paid tiers)"*). A contagem
honesta é `tier != FREE AND isTestAccount = false`. **Falta só alcançar a porta.**

E as **"3 vendas orgânicas"** do sirius viraram **"3 vendas orgânicas AFIRMADAS"** no card e no
`data/resumos.json`: o banco nunca foi consultado uma vez sequer, e chamar de *provada* a única
afirmação de receita do portfólio era o defeito mais caro da casa.

### Fase B — os dois portões ✅ (executada; o detector é que reprovou)

- **`scripts/defasagem-calibrar.mjs`** + os dois fixtures congelados.
- **Os 20 rótulos foram commitados ANTES de qualquer corrida** (`0f060c7`), para que "rotulei antes
  de ver o veredito" seja verificável no histórico e não uma palavra num comentário.
- Holdout deliberadamente **não-monocultura**: o material real tem 5 dos 5 achados na família
  `(hoje N)`. Entraram à força o passado datado, o documento de outro projeto, o número certo com
  ressalva de medição, a citação entre crases, e — categoria nova que a fase A criou — **"a fonte
  não olhou", que não é desmentir**.
- **Dois dos 10 adversariais são o ESPELHO de dois casos do holdout**: a mesma frase com a data
  arrancada e a citação tirada das crases. Sem isso, um detector que absolvesse por atacado passaria
  nos dois portões de uma vez.

### Fase C — o holdout da curadoria ✅

Derivação cega por um segundo agente, dump sem `familia`/`estado`/`vendas`, só as três famílias da
spec e permissão explícita para dizer que nenhuma serve. Concordância medida, divergentes levados ao
Jean, decisões aplicadas, definições reescritas como teste com precedência.

**Placar honesto: a curadoria perdeu 6 das 8 divergências de família e 3 das 5 de estado.** É o que
um portão serve para produzir; vergonha seria ter construído em cima sem ele.

Distribuição nova: `cobranca` 12 · `trafego` 11 · `nao-vende` 6 · `produto` 4 · `venda` 2 ·
estado 25/8/2.

### Fase D — o protocolo ✅

**`data/protocolos/VER-08.json`** — *"a primeira corrida de um check novo mede o CHECK"*.
`verificacao.tipo: "manual"`, e o `como` **declara que não é executável**: nenhum comando distingue
"achado real" de "check errado". O que se checa é documental — a primeira corrida deixou lista
nominal lida uma a uma? O primeiro número saiu da SEGUNDA corrida?

O protocolo traz o **corolário que faltava**: exclusão de caso de conjunto de calibração só vale por
regra **mecânica checável sem olhar o resultado**.

---

## 3. 🚩 A quinta vez aconteceu nesta mesma sessão, na minha própria calibração

A spec dizia "a quarta vez chegou". Chegou a quinta, e foi o check que eu acabei de escrever.

**6 dos 20 pares do holdout eram inválidos POR CONSTRUÇÃO.** Rotulei lendo uma janela do documento
que escolhi à mão, enquanto o fixture congelou a janela que a **produção** recorta
(`trechoRelevante`, 2400 chars). Em 6 casos a frase que meu rótulo citava **não estava no que o
detector recebeu**. Rótulo assim não mede detector nenhum: mede a minha leitura de um texto que ele
nunca viu.

O conserto ficou **mecânico de propósito**: cada caso declara a `ancora`, a frase literal de que o
rótulo depende, e sai antes de qualquer chamada se o trecho congelado não a contiver. Excluir por
âncora ausente é conserto de **construção**; excluir porque o detector discordou seria ajustar o
gabarito depois da prova.

**Os 6 inválidos continuam no arquivo.** Apagá-los esconderia que o check errou.

---

## 4. O que NÃO foi feito, e por quê

### Fase F — detector de contradição: **BLOQUEADA pela medição, não pela agenda**

A spec já dizia: *"É o holdout da fase B que decide se ela pode rodar."* Ele decidiu: **não**. Ela
usa a mesma passada de fidelidade que acabou de reprovar 3/10 no adversarial. Rodá-la agora seria
medir o detector contra si mesmo — o erro de 30/07 que levou 3 horas para desfazer.

**Não desbloqueie a F "só para ver o número".** O que a destrava é o prompt do detector passar nos
dois portões, e o alvo já está nomeado: a linha `VEREDITO:` não está sendo derivada do raciocínio.

### Fase E — inventário do conversível: **não feita**

É ~1 sessão inteira de leitura dos 278 documentos, e ela não cabia aqui junto com A+B+C+D. Continua
sendo o mapa que ordena tudo que vem depois.

⚠️ E há uma restrição nova que a própria fase D criou: **o aceite da E é uma contagem por balde, e
`VER-08` proíbe publicar o agregado da primeira corrida de um check novo.** A primeira passada da E
entrega **lista nominal**, não percentual. Planeje duas corridas, não uma.

### Fase G — remedir `estado` com `--juiz`: **não feita**

24 chamadas (8 × 3, só `estado`), e o corpus mudou muito hoje — este handoff, dois docs novos e um
protocolo novo entram no índice e mexem em IDF e vetor. **Número absoluto não reproduz entre
sessões.** Compare sempre contra a mesma execução, e nunca no agregado: ele é dominado por
`protocolo` (65 das 78) e esconde exatamente a camada que mudou.

A parte da G que **foi** entregue é a que mais importa: a fronteira declarada, na seção 5.

---

## 5. A fronteira, declarada — o que tem lastro e o que continua sendo prosa

| régua | toca a REALIDADE? |
|---|---|
| `scripts/conformidade.mjs` | **sim** — HTTP contra 35 hosts |
| `scripts/dourado-estado.mjs` | **sim em 7 das 8**; `D-70`/`D-71` são curadoria com holdout medido, não fonte viva |
| **`scripts/vendas-mercadopago.mjs`** 🆕 | **sim** — o gateway, em 1 dos 35 projetos |
| `scripts/validade.mjs` | não — mas impede o defeito de nascer |
| `scripts/avaliar.mjs` · `avaliar-resposta.mjs` · `--juiz` | não — texto contra texto |
| `scripts/corpus-defasado.mjs` | **em parte, e com detector REPROVADO** |

**Onde o dinheiro tem lastro:** 1 de 35 projetos (`atma`, Mercado Pago), e o resultado é R$ 0,00.
**Onde não tem:** os outros 34, e entre eles a única afirmação de receita do portfólio (`sirius`,
3 vendas) — que segue sendo prosa do card.

**Onde o gabarito tem lastro:** `familia`/`estado` têm agora concordância medida entre duas leituras
independentes (77,1% / 85,7%), com os divergentes decididos pelo Jean e as definições escritas como
teste. Isso é **melhor** que ontem e **não é** fonte viva: continua sendo julgamento humano, e a
`ressalva` de `D-70` continua declarando isso.

**Onde não há régua nenhuma:** o percentual de defasagem do corpus. Ele não sai, e o 16,7% deve ser
tratado como piso, não como estimativa.

---

## 6. 🚨 Achado de segurança que apareceu de raspão e não é desta frente

`SEC-04` registra que o repo **público** `JeanZorzetti/Atma` teve token de **produção** do Mercado
Pago em `origin/main` **e em todo o histórico**. O token que a fase A usou hoje sai de
`Atma/Site/Frontend/.env.local` e é `APP_USR-` de produção.

**Nada foi rotacionado nesta sessão.** [[secrets_to_rotate]] continua sendo o item mais antigo e
mais perigoso da lista do Jean, e agora há uma régua nova lendo dinheiro com essa credencial.

---

## 7. Primeiros 20 minutos da próxima sessão

1. `npm test` (**247**), `npx tsc --noEmit`, `node scripts/validade.mjs` (**0 achados**).
2. `node --env-file=.env scripts/dourado-estado.mjs --estado tudo --diff` — ~20 s, zero LLM,
   **8 de 8**.
3. `node --env-file=.env scripts/vendas-mercadopago.mjs` — ~5 s, zero LLM. Reconfere que os 20
   pagamentos continuam sendo teste. **Se um dia aparecer uma linha `✓`, é a primeira venda real do
   portfólio a ser provada por um sistema de pagamento.**
4. `node --env-file=.env scripts/defasagem-calibrar.mjs --ver` — **cache morno, ~0 chamadas.** Leia
   os 4 erros do holdout e os 7 adversariais que escaparam antes de mexer no prompt.
5. Decida o caminho: **alcançar a porta do banco do sirius** (fase A, a afirmação de dinheiro mais
   alta do portfólio) ou **atacar a linha `VEREDITO:` do detector** (fase B, que destrava a F e todo
   percentual). As duas são zero-pool na leitura e caras na execução; a primeira é a que fala de
   dinheiro.
