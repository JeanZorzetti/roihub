# Handoff — o holdout saiu da monocultura, e as células perigosas apareceram (01/08/2026)

> Executa [`handoff-proximo-passo-o-holdout-e-monocultura.md`](handoff-proximo-passo-o-holdout-e-monocultura.md)
> na íntegra: gerar candidatos dos 7 fatos novos, rotular à mão ANTES de rodar, e congelar.
> Índice: [`../handoff.md`](../handoff.md) · medição completa:
> [`../docs/defasagem-monocultura-2026-08-01.md`](../docs/defasagem-monocultura-2026-08-01.md).

`npm test` **269 verdes** · `npx tsc --noEmit` limpo · `npm run validade` limpo · holdout com
**80 casos em 15 fatos** (era 50 em 8), congelado em `d3cdde2` **antes** da primeira corrida.

---

## 0. Os itens 1, 2 e 4 continuam parados em você

Nada aqui os tocou, e nenhum foi contornado:

| # | o que é | por que não é agente |
|---|---|---|
| 1 | 🚨 **Invalidar o token antigo do MP e exigir 401** | painel do Mercado Pago. Aberto há 3 dias, e é o único que pode custar dinheiro enquanto não é feito |
| 2 | **Destravar `31.97.23.166:5434`** | infra da VPS. As 3 vendas AFIRMADAS do `sirius` seguem sem conferência no banco |
| 4 | **As 4 chaves da Stripe do `context`** | credencial de painel |

## 1. O que ficou de pé

**O holdout do detector deixou de medir 8 perguntas.** 30 pares novos, dos 7 fatos que entraram
ontem (`D-79`…`D-85`), rotulados à mão e commitados antes de qualquer chamada.

| | antes | agora |
|---|---|---|
| casos que contam | 44 | **74** |
| fatos | 8 | **15** |
| célula `desmente` do gabarito | 7 | **10** |
| holdout cego | 83,3% (35/42) | **80,6%** (58/72) 🚩 |
| adversarial | 14/20 | 14/20 🚩 (intocado) |

**Os dois portões continuam reprovando e nenhum percentual de defasagem sai.** O que mudou não é o
número — é a frase que ordenava a frente.

## 2. 🚩 "O detector só erra para o lado seguro" era artefato de 8 fatos

O handoff de hoje de manhã dizia, com razão sobre o material que tinha: *os 7 erros restantes são
TODOS `bate → nao-fala`; ele nem fabrica tarefa nem esconde corpus podre; as células perigosas estão
em ZERO*. Contra 15 fatos ele **fabricou 3 e escondeu 1**.

Separando a MESMA corrida pelas duas metades do fixture:

| material | pares | acerto | células perigosas |
|---|---|---|---|
| 8 fatos velhos | 42 | **83,3%** — idêntico à corrida anterior | 0 |
| 7 fatos novos | 30 | **76,7%** | **4** |

Os 83,3% reproduzindo byte a byte são o controle: o fixture inlina `apurado` e `trecho`, então nada
além do material novo mudou. **Todo o movimento vem de pergunta contra a qual ele nunca tinha sido
medido** — que é a definição de um portão que media a si mesmo.

## 3. As duas coisas que a próxima sessão precisa saber

### 3.1 🔑 A regra do passado datado está escrita e não pega sozinha

A fabricação mais cara foi contra **`SEO-02`, que é protocolo VIVO**, não handoff datado. Ele diz
*"CannibalScan, 30/07/2026: … Medido no roihub no mesmo dia: 21 dos 38 sites vivos **estavam** nessa
condição"* — data no mesmo span, verbo no passado, exatamente o caso que o prompt manda tratar como
`bate`. O detector comparou os 21 de 38 com o 1 de 35 de hoje e acusou. **Achado ali vira edição de
norma em cima de nada.**

Antes de redesenhar qualquer coisa: hoje a regra do passado datado é **uma frase sem exemplo** no
prompt, enquanto a do `TRECHO → MOTIVO → VEREDITO` é estrutura. Medir se um exemplo fecha esse caso
é mais barato que a fase D — **e é a única mudança de prompt que ainda não foi tentada e reprovada.**

### 3.2 🔑 Duas das 3 fabricações são o RÓTULO, e uma delas é achado de CORPUS

⚠️ **A primeira corrida contra um fixture ampliado mede o FIXTURE.** Lidas uma a uma:

- **`D-81` × `handoff-o-cruzamento-achou-o-check-errado.md`** — o documento diz *"um único
  **faturou** (`atma`)"*; o apurado diz *"0 faturou(aram) com data: nenhum"* e põe a `atma` em
  *"1 com gateway ligado e régua lendo"*. Rotulei `bate` lendo `faturou` como o nome antigo do mesmo
  balde. **O detector leu a palavra, e a palavra está errada no corpus:** os 20 pagamentos da `atma`
  são o Jean testando. 🚩 **`faturou` significa duas coisas diferentes na casa, e o `CLAUDE.md` usava
  a errada** — corrigido nesta sessão. Achado de corpus, não de detector.
- **`D-84` × `handoff-proximo-passo-o-holdout-e-monocultura.md`** — o handoff de hoje diz *"12 homes
  fora do índice, três delas em `URL is unknown to Google` (`orcaobra`, `lumina`, `pathfinder`)"*.
  O total bate; a `lumina` está em `Discovered - currently not indexed` e os `URL is unknown` são
  **dois**. Chamei de diferença em detalhe; o detector apontou número errado para a mesma coisa, e
  apontou certo.

**Os rótulos NÃO foram revisados.** Rótulo mexido depois de ler o veredito é contaminado, e a regra
vale contra mim como vale contra o detector — as leituras ficam no doc, o gabarito fica onde estava.

### 3.3 A primeira célula `ESCONDE` desta base

`D-83` × `handoff-proximo-passo-corpus-verdade.md`: o documento afirma no presente que *"O cruzamento
`protocolo.aplica_se_a × projeto` … nunca foi executada uma única vez"*, e hoje ele roda (10
protocolos × 35 projetos, 41 violações). O detector respondeu *"discute a estratégia de próxima
fase, não relata contagem de violações"* — **julgou o TEMA**, o modo de falha de sempre. A novidade
é o lado onde ele caiu. Com a família `desmente` restrita a `(hoje N)`, isso não tinha como aparecer.

## 4. Como a bancada foi construída (a regra, não a boa intenção)

```
node --env-file=.env scripts/corpus-defasado.mjs --candidatos --ids D-79,D-80,D-81,D-82,D-83,D-84,D-85 --estado caro
```

`--candidatos` **para na seleção** e grava o par sem veredito e sem âncora. Mora dentro do
`corpus-defasado.mjs`, e não num script próprio, porque o que dá valor ao par é ter sido recortado
**exatamente** como a produção recorta: um segundo script com a seleção copiada é a próxima
ocorrência de *"em 6 dos 20 primeiros rótulos a frase citada não estava no que o detector recebeu"*.

- **Par que já passou pelo detector é excluído mecanicamente** — varre `data/corpus-defasado/*.json`
  e os dois fixtures. Dos 70 selecionados, **36 já tinham veredito lido**; sobraram 34, e nenhum dos
  42 pares contaminados de hoje entrou.
- **`ancora` conferida antes de escrever**, com o rotulador abortando se a frase não for substring
  literal do trecho congelado. Uma falhou e foi corrigida ANTES da corrida. **Zero dos 30 saiu
  inválido por construção** (contra 6 de 20 na primeira vez à mão).
- **4 dos 34 ficaram sem rótulo de propósito:** são a MESMA linha de tabela de
  `handoff-a-camada-estado-dobrou.md` julgada contra 4 fatos, todos `bate`. Sete cópias de uma
  armadilha só é uma monocultura nova dentro do fixture. Continuam em `defasagem-candidatos.json`.
- **Commitado antes de rodar** (`d3cdde2`): "rotulei antes de ver o veredito" é verificável no
  histórico, não uma palavra num comentário.

## 5. O que NÃO fazer

- ❌ **Revisar os rótulos de 01/08 para o portão subir.** Ajustar gabarito depois da prova é o erro
  que já custou 3 horas em 30/07 — e agora tem as leituras escritas para quem quiser discordar.
- ❌ **Uma quarta redação da regra do prompt** ou **uma segunda decomposição em duas passadas.**
  Medidas, reprovadas: 71,4% / 50,0% e 83,3% → 65,9%.
- ❌ **Publicar percentual de defasagem.** Os dois portões reprovam.
- ❌ **Consertar os 6 inválidos por construção do holdout velho.** São o registro de que o check errou.
- ❌ **Reescrever handoff datado** para o corpus bater com hoje.

## 6. O próximo passo, na ordem

1. **O adversarial ainda é monocultura de fato: 20 casos, as mesmas 8 perguntas.** A metade que pega
   o detector que ABSOLVE tudo nunca foi medida contra `D-79`…`D-85`. Corromper documento real
   desses 7 é barato (o `desmente` é conhecido no ato da corrupção) e fecha a simetria — ⚠️ mantendo
   a regra de que alguns adversariais são o ESPELHO de casos do holdout.
2. **Medir o exemplo de passado datado no prompt** (§3.1) antes de qualquer redesenho: é a única
   mudança de prompt ainda não tentada, e tem um caso nomeado (`SEO-02`) para dizer se funcionou.
3. **`D-83` acusou `GEO-01` em 28 de 35 e `DEP-08` em 11** — números do check que já rodava. `n/a`
   não é aprovação, e 5 das 46 violações da primeira corrida do conformidade eram o check errado.
4. **`D-85`: `roilabs.com.br` com OK em 33,6%** no export de 25/07 — o host com mais crawl (2596
   req) e o pior OK% da casa. ⚠️ **Date antes de caçar bug:** o export cobre 90 dias.
5. Para 20 fatos apuráveis faltam ~5, e **esses exigem fonte nova** — não há mais script pronto
   para ligar.

⏰ **Não dar push entre 00:00 e 01:00 BRT** — o cron do autopublishing dispara 00:13.
