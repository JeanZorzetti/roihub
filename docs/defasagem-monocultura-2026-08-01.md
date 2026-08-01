# O holdout saiu da monocultura de FATO — e as células perigosas apareceram

Medido em 01/08/2026. Reprodutível: `node --env-file=.env scripts/defasagem-calibrar.mjs --ver`.
Rótulos congelados em `d3cdde2`, **commitados antes da primeira corrida contra eles**.

| | antes (50 casos, 8 fatos) | **agora (80 casos, 15 fatos)** |
|---|---|---|
| holdout cego | 83,3% (35/42) | **80,6%** (58/72) 🚩 |
| adversarial | 14/20 | 14/20 🚩 (fixture intocado) |
| células `FABRICA` (`bate → desmente`) | **0** | **3** |
| células `ESCONDE` (`desmente → nao-fala`) | **0** | **1** |
| célula `desmente` do gabarito | 7 | **10** |

**Os dois portões continuam reprovando e nenhum percentual de defasagem sai daqui.** Mas o que
esta corrida derruba não é o número: é a frase que ordenava a frente inteira.

---

## 1. A propriedade "todos os erros caem no lado seguro" era um artefato do universo de 8 fatos

Desde 01/08 o handoff repetia, com razão sobre o material que tinha: *"os 4 (depois 7) erros
restantes são TODOS `bate → nao-fala`; o detector nem fabrica tarefa nem esconde corpus podre"*.
Essa leitura vinha de um holdout cujos 50 casos saíam de **8 perguntas** (`D-66`…`D-73`) — as
únicas que existiam quando ele foi construído. Ele foi deliberadamente diversificado na dimensão
da FAMÍLIA de defeito e nunca na dimensão do FATO, porque até ontem não havia outro fato.

Separando a mesma corrida pelas duas metades do fixture:

| material | pares parseáveis | acerto | células perigosas |
|---|---|---|---|
| 8 fatos velhos (`D-66`…`D-73`) | 42 | **83,3%** (35/42) — idêntico à corrida anterior | 0 |
| 7 fatos novos (`D-79`…`D-85`) | 30 | **76,7%** (23/30) | **4** |

Os 83,3% da metade velha reproduzindo byte a byte é o controle: o fixture inlina `apurado` e
`trecho`, então nada além do material novo mudou. **Todo o movimento — os 2,7 pontos perdidos e as
4 células perigosas — vem de perguntas que o detector nunca tinha sido medido contra.**

## 2. As 7 divergências do material novo, lidas uma a uma

⚠️ **A primeira corrida contra um fixture AMPLIADO mede o FIXTURE.** Estas leituras estão escritas
depois de ver o veredito e por isso **não voltam para o gabarito**: rótulo revisado depois da prova
é contaminado, e a regra vale contra mim como valia contra o detector.

### Onde o DETECTOR errou

1. **`D-84` × `SEO-02` — `bate` → `desmente`, e é fabricação limpa.** O protocolo diz *"CannibalScan,
   30/07/2026: … Medido no roihub no mesmo dia: 21 dos 38 sites vivos **estavam** nessa condição"*.
   Data no mesmo span, verbo no passado — a regra do prompt manda `bate`. O detector comparou os
   21 de 38 com o 1 de 35 de hoje e acusou. **É o caso mais caro dos quatro:** `SEO-02` é protocolo
   VIVO (não handoff datado), então o achado viraria uma edição de norma em cima de nada.
2. **`D-83` × `handoff-proximo-passo-corpus-verdade.md` — `desmente` → `nao-fala`, a primeira
   célula `ESCONDE` desta base.** O documento afirma no presente que *"O cruzamento
   `protocolo.aplica_se_a × projeto` … nunca foi executada uma única vez"*, e hoje ele roda (10
   protocolos × 35 projetos, 41 violações). O detector respondeu *"o handoff discute a estratégia
   de próxima fase, não relata contagem de violações"* — **julgou o TEMA**, o modo de falha já
   nomeado. A novidade é que agora ele cai no lado que ESCONDE, e não no seguro: com a família
   `desmente` restrita a `(hoje N)`, isso não tinha como aparecer.

### Onde o RÓTULO é o lado fraco

3. **`D-81` × `handoff-o-cruzamento-achou-o-check-errado.md` — `bate` → `desmente`.** O documento
   diz *"um único **faturou** (`atma`)"*; o apurado diz, com todas as letras, *"0 faturou(aram) com
   data: nenhum"* e põe a `atma` em *"1 com gateway ligado e régua lendo"*. Rotulei `bate` lendo
   `faturou` como o nome antigo do mesmo balde. **O detector leu a palavra, e a palavra está errada
   no corpus** — os 20 pagamentos da `atma` são o Jean testando ([[mercadopago_approved_is_not_a_sale]]).
   🚩 **`faturou` significa duas coisas diferentes na casa**, e o `CLAUDE.md` usa a errada
   (*"1 faturou (`atma`)"*). Isso é achado de corpus, não de detector.
4. **`D-84` × `handoff-proximo-passo-o-holdout-e-monocultura.md` — `bate` → `desmente`.** O handoff
   de hoje diz *"12 homes fora do índice, três delas em `URL is unknown to Google` (`orcaobra`,
   `lumina`, `pathfinder`)"*. O total (12) bate; a `lumina` está em `Discovered - currently not
   indexed`, e os `URL is unknown` são **dois**. Rotulei `bate` chamando isso de diferença em
   detalhe. É defensável, mas o detector apontou um número errado para a mesma coisa — e apontou
   certo.

### Onde os dois são o mesmo erro velho

5. **`D-79` e `D-85` × `handoff-a-camada-estado-dobrou.md` — `bate` → `nao-fala`.** A tabela dos
   sete fatos descreve a REGRA de cada um sem citar número, o que o prompt manda tratar como `bate`.
   O detector respondeu *"o documento é o handoff da camada estado, não trata dos números"*. É o
   `bate → nao-fala` de sempre, agora contra fato novo.
6. **`D-81` × `handoff-lastro-no-dinheiro-e-no-gabarito.md` — `nao-fala` → `bate`.** Direção
   inofensiva: os dois vereditos prescrevem a mesma ação (nada a consertar).

## 3. O que isto muda na ordem do trabalho

- **A frase "o detector só erra para o lado seguro" morreu, e com ela o argumento de que a lista
  nominal é confiável enquanto o percentual não é.** Em 30 pares de fatos novos ele fabricou 3
  tarefas e escondeu 1 achado.
- **A fase D (o defeito é decidir SE o documento fala do assunto) continua sendo o alvo certo**, e
  agora tem evidência dos dois lados: `→ nao-fala` esconde (caso 2) e a leitura literal sem
  contexto de data fabrica (caso 1). São os dois lados do mesmo eixo — e **não é uma terceira
  redação de regra nem uma segunda decomposição**, as duas já reprovaram medidas.
- **`SEO-02` nomeia o conserto mais barato disponível:** o prompt já tem a regra do passado datado,
  e o detector a ignorou quando a data estava no span e o verbo no passado. Antes de mexer no
  desenho, vale medir se a regra do passado datado tem exemplo no prompt — hoje ela é só uma frase.

## 4. Como o material novo foi construído (a regra, não a boa intenção)

`node --env-file=.env scripts/corpus-defasado.mjs --candidatos --ids D-79,…,D-85 --estado caro`

O modo `--candidatos` **para na seleção** e grava o par sem veredito e sem âncora. Ele vive dentro
do `corpus-defasado.mjs`, e não num script próprio, porque o que dá valor ao par é ter sido
recortado **exatamente** como a produção recorta (`trechoRelevante`, 2400): um segundo script com
a seleção copiada é a próxima ocorrência de *"em 6 dos 20 primeiros rótulos a frase citada não
estava no que o detector recebeu"* esperando para acontecer.

- **Par que já passou pelo detector é excluído**, e a exclusão é mecânica: `--candidatos` varre
  `data/corpus-defasado/*.json`, o holdout e os candidatos, e joga fora todo `(pergunta, documento)`
  que já apareceu. Dos 70 pares selecionados, 36 já tinham veredito lido por alguém. **Sobraram 34
  limpos**, e nenhum dos 42 pares julgados hoje entrou.
- **`ancora` conferida antes de escrever**: o script de rotulagem aborta se a frase não for
  substring literal do trecho congelado. Uma falhou (a linha de `D-85` é cortada no meio da palavra
  pelo recorte da produção) e foi corrigida ANTES da corrida. **Zero dos 30 casos novos saiu
  inválido por construção** — contra 6 de 20 na primeira vez que isso foi feito à mão.
- **4 dos 34 candidatos ficaram de fora**: são a MESMA linha de tabela de
  `handoff-a-camada-estado-dobrou.md` julgada contra 4 fatos diferentes, todos `bate`. Sete cópias
  de uma armadilha só é uma monocultura nova dentro do fixture. Continuam em
  `data/defasagem-candidatos.json`, sem rótulo.
- **Commitados antes de rodar** (`d3cdde2`), para que "rotulei antes de ver o veredito" seja
  verificável no histórico e não uma palavra num comentário.

## 5. O que continua bloqueado

Tudo que já estava. Os dois portões reprovam, `scripts/corpus-defasado.mjs` **não publica
percentual** — inclusive o 16,7% — e o detector de contradição entre documentos não roda.

O adversarial segue em **14/20 e intocado**: ele tem 20 casos e todos saem das mesmas 8 perguntas.
**A monocultura de fato foi resolvida em um dos dois portões, não nos dois.**
