# Calibração do detector de defasagem — os dois portões ainda reprovam, por um caso cada

Medido em 01/08/2026. Reprodutível: `node --env-file=.env scripts/defasagem-calibrar.mjs --ver`.

| portão | exigido | 31/07 | **01/08, depois de inverter a saída** | |
|---|---|---|---|---|
| holdout cego | ≥ 85% | 71,4% (10/14) | **84,6%** (11/13) | 🚩 |
| adversarial | ≥ 9/10 | 3/10 | **8/10** | 🚩 |

**Nenhum percentual de defasagem sai desta base — inclusive o 16,7%.** Mas a leitura de 31/07
mudou de tamanho: o instrumento absolvia 7 de 10 corrupções deliberadas e agora absolve 2.

---

## 1. O que mudou, e o que isso prova

Uma coisa só, e ela não é redação: **o `VEREDITO` deixou de ser a primeira linha da resposta.**

```
antes                        agora
VEREDITO: bate|desmente…     TRECHO:   a frase literal do documento
TRECHO:   …                  MOTIVO:   a comparação com o fato
MOTIVO:   …                  VEREDITO: bate|desmente|nao-fala
```

O modelo era obrigado a cravar o veredito antes de escrever o raciocínio que o justifica, e o
resultado foi visto três vezes: `VEREDITO: bate` com `MOTIVO: … o número "hoje 9, BATIDO" é
incompatível com o apurado hoje (2, não batido) — desmente.` A linha 3 chegava ao veredito certo
porque foi escrita depois de pensar; a linha 1 tinha sido escrita antes.

**Duas redações de REGRA já haviam falhado nesse mesmo formato** (71,4% e 50,0%), e a segunda foi
escrita mirando o modo de falha nomeado — o que normalmente significa que o problema não é o texto
das regras. Era o formato. Inverter três linhas levou o adversarial de **3/10 a 8/10**.

## 2. A segunda mudança: um achado sem citação não conta como achado

`desmente` é o único veredito que vira TAREFA (uma edição de memória ou de handoff), e ele passava
sem evidência nenhuma — bastava a linha do veredito. Agora `parseDefasagem` falha fechada em dois
casos novos, com código próprio:

| código | quando |
|---|---|
| `defasagem-incoerente` | `desmente` com `TRECHO: -` — acusação sem a frase citada |
| `defasagem-citacao` | o `TRECHO` não existe no documento — alucinação de citação |

É o mesmo princípio do `resposta-sem-citacao` da aba de busca: prosa fluente sem procedência tem a
autoridade da resposta e nenhuma da fonte.

**A comparação ignora tudo que não é letra ou dígito, e isso foi MEDIDO.** Na primeira corrida
invertida, com espaço apenas normalizado, **8 citações caíram e NENHUMA era fabricada** — o modelo
cita a prosa e larga o markdown (`**19/10** — gate do \`tapepro\`` volta como `19/10 — gate do
tapepro`), junta dois bullets, troca aspas. Reprovar isso seria trocar alucinação por diagramação.
Com a comparação por letra e dígito, sobraram **2 citações reprovadas, e as duas são fabricação de
verdade**:

- o documento diz `**31/08** — gate do \`sirius\``; o modelo citou `**19/10** — gate do \`sirius\``,
  colando a data do bullet seguinte;
- o documento diz `gate do \`tapepro\`: ≥ 5.000 imp`; o modelo citou `gate do \`sirius\`: ≥ 5.000
  imp` — **motivo certo, aspa errada** (o `MOTIVO` da mesma resposta fala corretamente do tapepro);
- num terceiro caso o modelo devolveu uma frase que está no `CLAUDE.md` do repo e **não estava no
  documento que ele recebeu**.

Sem este check, os três teriam entrado na conta como vereditos normais.

## 3. O que sobrou, e é UMA coisa

Todos os erros restantes apontam na mesma direção — `→ nao-fala`:

```
nao-fala → nao-fala   7
desmente → desmente   3
bate → nao-fala       2   ✗
bate → bate           1
```

E o adversarial que escapou é **o mesmo documento** que erra no holdout
(`handoff-compass-e-repos-sem-site.md`): com a data arrancada e a afirmação posta no presente, o
detector continua dizendo que o documento "trata de homepage/DNS de repos individuais, não do total
de projetos do hub". **O detector ainda julga o TEMA do documento, não a AFIRMAÇÃO dentro dele** —
só que agora isso acontece em 2 casos, não em 7.

Isso é exatamente o diagnóstico que a fase A previa para o caso de os portões não passarem: o
`nao-fala` não é mutuamente exclusivo com os outros dois na cabeça do modelo. **A próxima tentativa
não é uma terceira redação de regra — é quebrar em DUAS PASSADAS**, uma que só extrai a afirmação
do documento sobre o assunto e outra que só compara afirmação com fato. É o mesmo desenho do juiz,
que passou os dois portões.

⚠️ Custo dessa mudança: **dobra as chamadas de `corpus-defasado.mjs`** (hoje 1 por documento, ~10
por pergunta). O pool já serve autopublishing, rerank, síntese, juiz e defasagem, e morreu no meio
de uma corrida em 30/07.

## 4. Placar de todas as tentativas

| tentativa | holdout | adversarial |
|---|---|---|
| formato original (`VEREDITO` primeiro) | 71,4% | 3/10 |
| 2ª redação de regra: "julgue a AFIRMAÇÃO, não o assunto" | 50,0% | 4/10 |
| **`VEREDITO` por último + citação conferida** | **84,6%** | **8/10** |
| (próxima) duas passadas, como o juiz | — | — |

**As duas redações de regra falharam; a mudança de formato foi a que moveu o número.** Fica
registrado porque a tentação da próxima sessão vai ser escrever uma terceira redação.

## 5. Por que 84,6% e não 85% — a aritmética, sem maquiagem

11 acertos em 13 respostas parseáveis. **O 14º caso saiu por citação fabricada, e o portão exige
`validas.length === casos.length`**: citação descartada conta contra o detector, de propósito. Um
caso a mais acertado daria 92,3% e passaria o portão 1 sozinho — o que é outra forma de dizer que
**um holdout de 14 casos tem resolução grossa demais para a diferença entre 84,6% e 85%**.

Quer resolução melhor? **Acrescente pares novos, rotule antes de rodar e commite antes de rodar.**
Não conserte os 6 inválidos por construção: rótulo escrito depois de ler veredito é contaminado.

## 6. A primeira corrida deste check mediu o CHECK — pela quinta vez nesta base

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

## 7. Como o holdout foi montado (e por que não é monocultura)

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

## 8. O que fica bloqueado até estes dois números passarem

- `scripts/corpus-defasado.mjs` **não publica percentual**. A lista nominal continua útil para ler
  um a um; o agregado, não. E o 16,7% continua sendo **piso**, não estimativa — só que um piso
  medido com um instrumento que agora absolve 2 de 10 em vez de 7 de 10.
- O detector de contradição entre documentos (a "fase F", pares de documentos sem passar pelo
  dourado) **não roda**. Ele usa a mesma passada; rodá-lo agora seria medir o detector contra si
  mesmo — o erro que custou 3 horas em 30/07.
