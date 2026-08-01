# Calibração do detector de defasagem — os dois portões REPROVARAM

Medido em 31/07/2026. Reprodutível: `node --env-file=.env scripts/defasagem-calibrar.mjs --ver`.

| portão | exigido | medido | |
|---|---|---|---|
| holdout cego | ≥ 85% | **71,4%** (10/14) | 🚩 |
| adversarial | ≥ 9/10 | **3/10** | 🚩 |

**Nenhum percentual de defasagem sai desta base — inclusive o 16,7% que já circulou.**

---

## 1. O que isso significa, dito na direção incômoda

O 16,7% foi lido até aqui como "a memória institucional está 83% certa". A calibração diz outra
coisa: o instrumento que produziu esse número **absolve 7 de 10 documentos que eu corrompi de
propósito**. Um detector com esse viés não superestima a defasagem — ele a **subestima**.

Os 8 `desmente` da primeira corrida foram os altos o bastante para sobreviver a um detector que
cala por padrão. **A taxa real do corpus é provavelmente MAIOR que 16,7%, não menor**, e a frase
"é UM defeito só, `(hoje N)` em prosa" fica sem lastro: pode ser que seja o único defeito que este
detector sabe ver.

## 2. O modo de falha é UM, e tem nome: `nao-fala` engole tudo

Não são erros espalhados. A matriz é direcional:

```
nao-fala → nao-fala   6
desmente → desmente   2
bate     → bate       2
bate     → nao-fala   2   ✗
desmente → nao-fala   1   ✗ ESCONDE
nao-fala → bate       1   ✗
```

Três dos quatro erros do holdout, e a maioria dos 7 adversariais que escaparam, são a mesma coisa:
**o detector decide pelo TEMA do documento, não pela AFIRMAÇÃO nele.** Se o documento "é sobre"
outro assunto, ele devolve `nao-fala` mesmo com a frase incompatível na frente dele. Exemplos
literais da corrida:

- corrompi `project_roihub_conformidade` para dizer **12 projetos** em vez de 35 → `nao-fala`,
  com o motivo "o documento trata da corrida de conformidade e não afirma quantos projetos o hub
  tem hoje".
- corrompi um handoff para dizer **"zero bloqueios esperando o Jean"** → `bate`, porque
  "o documento é datado e descreve o passado".
- corrompi outro para dizer **"deploy na Vercel (não é Docker, não é EasyPanel)"** → `nao-fala`,
  porque seria "o perfil detectado pelo recommender", não uma afirmação.

O detector não está errando ao acaso: ele está **construindo desculpas para absolver**.

## 3. O bug estrutural: o MOTIVO certo com o VEREDITO errado

Já tinha acontecido uma vez (primeira corrida, um `VEREDITO: desmente` cujo `MOTIVO` dizia "o
veredito correto é nao-fala"). **Reproduziu-se duas vezes nesta calibração**, e agora está medido
em vez de anedótico:

> `VEREDITO: bate` · `MOTIVO: o número "hoje 9, BATIDO" é incompatível com o apurado hoje (2, não
> batido) — desmente.`

O raciocínio chega ao veredito certo e a linha `VEREDITO:` sai errada. Isso **não se conserta
melhorando a definição de `desmente`** — é a linha do veredito que não está sendo derivada do
raciocínio. Qualquer tentativa futura tem que atacar isto, não o vocabulário.

## 4. Duas redações tentadas, as duas reprovaram

| prompt | holdout | adversarial |
|---|---|---|
| atual (`lib/defasagem.mjs`, mantido) | **71,4%** | **3/10** |
| "julgue a AFIRMAÇÃO, não o assunto; basta uma frase" | 50,0% | 4/10 |

A segunda redação foi escrita mirando o modo de falha nomeado acima, não os casos — e mesmo assim
**piorou o portão que mais decide**: passou a acusar `nao-fala` como `bate` e como `desmente`.
Mantida a primeira, por medir melhor onde importa. Não há terceira tentativa registrada: o portão
existe para dizer *pare*, e ele disse.

## 5. A primeira corrida deste check mediu o CHECK — pela quinta vez nesta base

6 dos 20 pares saíram **inválidos por construção**, e a causa é minha: rotulei lendo uma janela do
documento que escolhi à mão, enquanto o fixture congelou a janela que a **produção** recorta
(`trechoRelevante`, 2400 chars). Em 6 casos a frase que meu rótulo citava não estava no que o
detector recebeu. Rótulo assim não mede detector nenhum — mede a minha leitura de um texto que ele
nunca viu.

O conserto ficou **mecânico de propósito**, e é checável sem olhar veredito nenhum: cada caso
declara a `ancora`, a frase literal de que o rótulo depende, e o caso sai antes de qualquer chamada
se o trecho congelado não a contiver. **Excluir por âncora ausente é conserto de construção;
excluir porque o detector discordou seria ajustar o gabarito depois da prova.**

Os 6 inválidos continuam no arquivo, com âncora e tudo. Apagá-los esconderia que o check errou.

## 6. Como o holdout foi montado (e por que não é monocultura)

20 pares (documento × fato apurado), rotulados à mão e **commitados antes de qualquer corrida** —
`0f060c7`, para que "rotulei antes de ver o veredito" seja verificável no histórico e não uma
palavra num comentário.

O material real é monocultura: 5 dos 5 achados da primeira corrida são a família `(hoje N)`, e
calibrar contra isso mediria uma regex. Entraram à força:

| categoria | é `desmente`? |
|---|---|
| número errado afirmado no presente | **sim** |
| negação do que a fonte viva mostra | **sim** |
| passado datado explicitamente ("Medição de 29/07: …") | não |
| documento de OUTRO projeto com vocabulário parecido | não |
| número certo com ressalva de medição | não |
| citação entre crases como exemplo da norma | não |
| a fonte viva **não olhou** (≠ desmentiu) | não |

Distribuição: 5 `desmente` / 7 `bate` / 8 `nao-fala`.

Os 10 adversariais corrompem documento real (trocar o número, inverter a negação, trocar o
projeto). **Dois deles são o espelho de dois casos do holdout** — a mesma frase com a data
arrancada e a citação tirada das crases —, senão um detector que absolvesse por atacado passaria
nos dois portões de uma vez.

## 7. O que fica bloqueado até estes dois números passarem

- `scripts/corpus-defasado.mjs` **não publica percentual**. A lista nominal continua útil para ler
  um a um; o agregado, não.
- O detector de contradição entre documentos (a "fase F", pares de documentos sem passar pelo
  dourado) **não roda**. Ele usa a mesma passada; rodá-lo agora seria medir o detector contra si
  mesmo — o erro que custou 3 horas em 30/07.
