# Fase C — dar poder de resolução ao portão do detector (01/08/2026)

Estado anterior: holdout com **13 casos que contavam**, onde **um caso valia 7,7 pontos** e o
número oscilou 71,4% → 88,9% → 91,7% → 84,6% enquanto a qualidade real só subia.

**Resultado: 13 → 33 casos que contam. Um caso agora vale 3,0 pontos.**

---

## 1. O que foi feito, e sob quais regras

19 pares novos rotulados à mão, **commitados antes da primeira corrida contra eles** (`bcd50a0`),
para que *"rotulei antes de ver o veredito"* seja verificável no histórico e não uma palavra num
comentário.

Regras de construção, todas cumpridas nos 19:

- **rotulado lendo exatamente a janela que a produção recorta** (`trechoRelevante`, 2400 chars) —
  ignorar isso foi o que invalidou 6 dos 20 originais;
- **`ancora` preenchida em todos os 19**, e conferida por script contra o trecho congelado
  **antes** de escrever o fixture: 19 de 19 presentes;
- os 6 inválidos por construção continuam no arquivo e **não foram consertados**;
- **os 7 casos legados sem `ancora` continuam sem** — preencher a âncora de um caso já rodado é
  escolher a frase depois de ter visto o veredito.

| | antes | depois |
|---|---|---|
| casos no arquivo | 20 | **39** |
| inválidos por construção | 6 | 6 |
| **casos que contam** | **13** | **33** |
| **peso de um caso** | **7,7 pts** | **3,0 pts** |
| distribuição | 5 / 7 / 8 | **7 `desmente` / 14 `bate` / 18 `nao-fala`** |

⚠️ **Ficou abaixo dos 40 pedidos.** 33 é progresso real, não a meta: um caso ainda vale 3 pontos,
e a diferença entre 87,5% e 85% continua sendo um caso. **A fase C não está fechada.**

---

## 2. A distribuição foi o ponto, não a contagem

O material real é monocultura — 5 dos 5 achados são a família `(hoje N)` — e calibrar contra isso
mede uma regex. Os pares novos cobrem, de propósito, o modo de falha que **sobrou** e os que
quebram um detector que casa por palavra:

| o que o par testa | exemplo | rótulo |
|---|---|---|
| **tema é outro, afirmação incompatível assim mesmo** | `D-66` × `proximo-passo-02-08`: "40 repos ativos, 39 projetos" dentro de um doc sobre crawl stats | `desmente` |
| **o espelho: tema é outro, afirmação CORRETA** | `D-72` × `deep-research-harness`: "o deploy ser Docker/EasyPanel e não Vercel" | `bate` |
| **número errado CITADO para explicá-lo, não afirmado** | `D-66` × `lastro-executado`: "para dizer 12 projetos **em vez de 35**" — o doc afirma 35 | `bate` |
| **a palavra do fato, sobre outro objeto** | `D-72` × `quatro-sites`: "Vercel" por toda parte, sempre de **outros** projetos | `nao-fala` |
| **assunto vizinho que não é a mesma afirmação** | `D-67` × `portfolio_nao_cobra`: conta gateways, não receita | `nao-fala` |
| **taxonomia superada afirmada no presente** | `D-70` × `dourado-com-lastro-executado`: "não tem quem venda", família que não existe mais | `desmente` |
| **medição datada no passado** | `D-66` × `hub-github`: "Data: 2026-07-28 … Resultado medido: 67 repos → 37 projetos" | `bate` |

O caso da taxonomia superada **veio da fase B** — foi lá que se descobriu que a síntese derivava de
um documento com a família extinta. O achado de uma fase virou caso de teste da outra.

---

## 3. 🔑 O resultado, e ele muda a leitura da fase D

```
── portão 1: holdout cego — 33 pares rotulados antes de o detector vê-los
acerto    87.5%  (28/32)   ← portão: >= 85% E zero sem veredito

  nao-fala → nao-fala        17
  bate → bate                 6
  desmente → desmente         5
  bate → nao-fala             4   ✗
```

**Os quatro erros são a MESMA célula, e é a célula inofensiva.**

- **`desmente` perdido (ESCONDE corpus podre): 0.**
- **`desmente` fabricado (FABRICA tarefa): 0.**
- 5 de 5 `desmente` corretos. 17 de 17 `nao-fala` corretos.

O comentário do próprio script já dizia o que isso significa: *"um detector que troca `bate` por
`nao-fala` é utilizável — os dois significam 'não há nada a consertar aqui'"*. **Para a saída do
produto — a lista nominal de defasagem — o detector acertou 32 de 32.**

⚠️ **Isto NÃO é licença para publicar percentual.** Duas razões, e nenhuma é formalidade:

1. **O erro que resta é o mesmo mecanismo que produziria um erro grave.** `bate → nao-fala` é o
   detector não reconhecendo que o documento fala do assunto. É o vizinho de `desmente → nao-fala`,
   que **esconde** corpus podre. Ele cai no lado seguro nesta amostra; nada garante que continue.
2. **33 casos ainda não separam 87,5% de 85%.** Um caso vale 3 pontos.

**O que muda para a fase D:** o desenho de duas passadas continua certo, mas o alvo dele fica mais
preciso. Não é "o detector fabrica achado" — ele nunca fez isso aqui. É **"o detector não decide se
o documento fala do assunto"**, que é exatamente o que a passada 1 (cega ao fato: *"que afirmação,
se alguma, este documento faz sobre X?"*) existe para resolver. **A fase D está atacando a coisa
certa, e agora há um número que diz qual célula ela precisa mexer.**

---

## 4. 🚩 Achado de brinde: o portão imprimia um número e decidia por outro

A corrida imprimia, com quatro linhas de distância:

```
acerto    87.5%  (28/32)   ← portão: >= 85%
🚩 portão 1 (holdout cego >= 85%)   REPROVOU  87.5%
```

**87,5% ≥ 85% e o portão reprovou.** A condição real sempre foi **duas**:

```js
const p1 = validas.length === casos.length && acertos.length / validas.length >= 0.85;
```

Zero caso sem veredito parseável **E** taxa acima do piso. A segunda condição estava no rótulo; a
primeira, só no código. O que reprovou foi 1 caso `defasagem-citacao` — e essa condição é **certa**
(caso que não parseia não conta como aprovado, senão dá para ir excluindo os difíceis). **O defeito
era só a apresentação, e é a mesma classe do resto: régua que não declara o próprio critério.**

Consertado: o critério inteiro aparece junto do número, e o veredito diz **qual** das duas
condições caiu (`REPROVOU 87.5% — 1 sem veredito parseável`).

---

## 5. O que falta para fechar a fase C

| # | item | por quê |
|---|---|---|
| C-1 | levar o holdout de 33 a **40+ casos que contam** | um caso ainda vale 3,0 pontos |
| C-2 | levar o adversarial de **10 a 20** | 10 não separam 8/10 de 9/10; hoje reprova por 1 |
| C-3 | mais casos `desmente` | 7 de 39; a célula que decide é a menos povoada |
| C-4 | âncora nos 10 adversariais | nenhum tem; a regra de construção não roda ali |

**Material pronto para C-1:** 80 pares candidatos já gerados a partir das 6 perguntas de `estado`
com apuração viva, com o trecho recortado no orçamento da produção. 19 foram rotulados; **61 estão
esperando leitura**, e gerá-los custou 0 chamadas.

⚠️ **`D-68` e `D-69` (os do GSC) ficaram de fora dos pares novos de propósito** — são justamente a
família `(hoje N)` que já domina o material. Ampliar por ali reforçaria a monocultura.
