# Handoff — a lista nominal tem 30% de ruído, e é ISSO que decide se a frente continua (01/08/2026)

> Para a próxima sessão. Sessão anterior:
> [`handoff-o-holdout-saiu-da-monocultura.md`](handoff-o-holdout-saiu-da-monocultura.md) (holdout de
> 50 casos em 8 fatos → 80 em 15, entregue e no ar). Índice: [`../handoff.md`](../handoff.md) ·
> medição: [`../docs/defasagem-monocultura-2026-08-01.md`](../docs/defasagem-monocultura-2026-08-01.md).

`npm test` **269 verdes** · `npx tsc --noEmit` limpo · `npm run validade` limpo · corpus reindexado
(302 docs) · holdout **80 casos em 15 fatos**, adversarial 20 casos em 8.

---

## 0. Leia isto antes de escolher outra coisa

Os itens 1, 2 e 4 **não são tarefa de agente** e estão abertos há 3 dias. Continuam aqui para não
serem silenciosamente pulados nem "contornados":

| # | o que é | por que não é agente |
|---|---|---|
| 1 | 🚨 **Invalidar o token antigo do MP e exigir 401** | painel do Mercado Pago, sua mão. Gerar a nova sem invalidar a velha **não é rotação, é adição**. É o único item da casa que pode custar dinheiro enquanto não é feito |
| 2 | **Destravar `31.97.23.166:5434`** | infra da VPS. As 3 vendas AFIRMADAS do `sirius` seguem sem conferência no banco |
| 4 | **As 4 chaves da Stripe do `context`** | credencial de painel |

**Contornar qualquer um deles é o defeito**, não o atalho.

## 1. 🚩 O número que ordena esta sessão, e ele é NOVO

O produto desta frente **não é o percentual** — é a **lista nominal**: cada linha é uma edição de
memória ou handoff. Até ontem a defesa dela era *"o detector nem fabrica tarefa nem esconde achado;
todos os erros caem no lado seguro"*. Com o holdout em 15 fatos essa defesa caiu, e agora dá para
medir a lista nominal diretamente:

| | valor |
|---|---|
| `desmente` que o detector emitiu no holdout | **10** |
| desses, corretos | **7** |
| **precisão da lista nominal** | **70%** |
| `desmente` do gabarito que ele achou | 7 de 8 → recall **87,5%** |

> **3 de cada 10 linhas da lista nominal são tarefa fabricada.** Não é hipótese nem projeção do
> agregado: é a contagem direta das células `bate → desmente` (3) contra `desmente → desmente` (7).

Isso muda o que está em jogo. O portão de 85% podia ser discutido como régua acadêmica —
`bate` e `nao-fala` prescrevem a mesma ação, então errar entre os dois não custa nada. **A precisão
de 70% não tem essa saída:** ela é exatamente o custo de quem lê a lista.

⚠️ E é a mesma ordem de grandeza medida por leitura humana em 31/07: a 1ª corrida deu 8 `desmente`
e **ler os 8 baixou para 5** — 62,5% de precisão. **Duas medições independentes, ~2/3 de precisão.**
A ampliação do holdout não descobriu um defeito novo; ela confirmou o que a leitura já dizia e que
o fixture estreito estava escondendo.

## 2. A decisão que esta sessão tem que tomar (e não é técnica)

Custo medido da frente, sem arredondar para baixo:

| | |
|---|---|
| aberta em | 31/07 21:14 (`731eb07`) |
| último commit | 01/08 15:51 (`347c67d`) |
| commits na frente | **18** |
| handoffs escritos | **10 de 66** |
| corridas nominais gravadas | 4 · **105 documentos julgados** |
| `desmente` brutos | 13 |
| **defeitos reais de corpus achados** | **~7**, e 3 deles eram a MESMA memória |
| o número que a frente existe para publicar | **nunca saiu** |

**Sete achados em ~19 h de trabalho, com um instrumento que ainda erra 3 em 10.** Não é fracasso —
cada um dos sete era real, e três réguas laterais (validade, conformidade, gateways) nasceram aqui e
valem por si. Mas é o dado que faltava para responder "vale continuar?", e a resposta honesta
depende de qual pergunta a casa quer responder:

| se o objetivo é… | então |
|---|---|
| **publicar uma taxa de erro do corpus** | continue: sem os dois portões o número não vale, e não há atalho |
| **achar memória podre para consertar** | 🚩 **o `validade.mjs` já faz isso melhor**: zero LLM, zero pool, segundos, dentro do `npm test`, e impede o defeito de NASCER em vez de caçá-lo depois |

**Escreva a escolha no topo do próximo handoff.** A frente já foi congelada uma vez (01/08, por
teto de material) e descongelada porque o material dobrou; congelá-la de novo é decisão legítima, e
deixá-la rodando por inércia não é.

## 3. Se a resposta for CONTINUAR — a ordem, com o preço de cada passo

### 3.1 🔑 Um EXEMPLO para a regra do passado datado *(barato, e é a única não tentada)*

A fabricação mais cara do holdout é contra **`SEO-02`, protocolo VIVO**, que diz *"CannibalScan,
30/07/2026: … Medido no roihub no mesmo dia: 21 dos 38 sites vivos **estavam** nessa condição"* —
data no mesmo span, verbo no passado, o caso que o prompt já manda tratar como `bate`. O detector
comparou os 21 de 38 com o 1 de 35 de hoje e acusou.

Hoje a regra do passado datado é **uma frase sem exemplo**, enquanto o que funcionou
(`TRECHO → MOTIVO → VEREDITO`) é estrutura. **Dar-lhe um exemplo é a última mudança de prompt que
ainda não foi tentada e reprovada**, custa ~100 chamadas (o fixture inteiro, cache frio) e tem caso
nomeado para dizer se funcionou.

⚠️ **Não é uma quarta redação de regra.** Redação foi mexer no texto do critério; isto é acrescentar
um exemplo ao critério que já está lá. Se a distinção parecer sofisma na hora de escrever, **é
sinal de que virou a quarta redação — pare.**

### 3.2 O adversarial ainda é monocultura de fato

20 casos, todos das mesmas 8 perguntas. **A metade do portão que pega o detector que ABSOLVE tudo
nunca foi medida contra `D-79`…`D-85`.** Corromper documento real desses 7 é barato — o `desmente` é
conhecido no ato da corrupção, então não há rótulo a discutir.

⚠️ **Mantenha a regra dos ESPELHOS:** alguns adversariais são o mesmo caso do holdout com a data
arrancada, senão um detector que absolve por atacado passa nos dois portões de uma vez.
⚠️ **Piso é PROPORCIONAL** (≥ 90%): ampliar sem isso já deixou "14/20 = 70%" passar como 9/10.

### 3.3 A fase D continua nomeada, e continua cara

O defeito é o detector não decidir **se o documento fala do assunto** — e agora ele erra dos dois
lados: `bate → nao-fala` 9 (inofensivo) e `desmente → nao-fala` 1 (esconde). A passada 1 cega ao
fato é a resposta desenhada para isso.

🚩 **Mas ela já foi tentada como decomposição em duas chamadas e REPROVOU** (83,3% → 65,9%, e as
células perigosas saíram de zero). Só volte a isso **depois** de 3.1, e sabendo que o caminho que
funcionou três vezes foi forçar evidência antes da decisão **dentro da mesma chamada**.

## 4. O que NÃO fazer

- ❌ **Revisar os rótulos de 01/08 para o portão subir.** Ajustar gabarito depois da prova é o erro
  que já custou 3 horas em 30/07. As leituras das 7 divergências estão no doc de propósito, para
  quem quiser discordar **com o gabarito parado**.
- ❌ **Uma quarta redação da regra** (2 tentativas, 71,4% e 50,0%) ou **uma segunda decomposição**
  (83,3% → 65,9%). As duas foram medidas contra o mesmo fixture congelado.
- ❌ **Publicar percentual de defasagem**, inclusive o 16,7%. Os dois portões reprovam.
- ❌ **Consertar os 6 inválidos por construção do holdout velho** nem preencher a âncora dos legados:
  são o registro de que o check errou.
- ❌ **Rotular a partir de `data/corpus-defasado/*.json`**: ele guarda o trecho CITADO (77 chars) e o
  veredito, não o recorte de 2400 que o modelo recebeu.
- ❌ **Reescrever handoff datado** para o corpus bater com hoje.

## 5. Como saber que funcionou

- `node --env-file=.env scripts/defasagem-calibrar.mjs --ver` — cache morno, ~0 chamadas se nada
  mudou no prompt. **Leia a MATRIZ, não o percentual**, e agora leia especificamente as duas células
  que decidem: `bate → desmente` (fabrica) e `desmente → nao-fala` (esconde).
- **A primeira corrida contra fixture AMPLIADO mede o FIXTURE.** Aconteceu em 10 → 20, em 33 → 44 e
  de novo agora. Leia as divergências uma a uma antes de tratar qualquer uma como defeito do detector
  — em 01/08, **2 das 3 fabricações eram o RÓTULO**, e uma delas virou achado de corpus (`faturou`
  significava duas coisas na casa).
- **Bancada nova sai de `corpus-defasado.mjs --candidatos`**: para na seleção, grava o par sem
  veredito nem âncora, e exclui mecanicamente todo par que já passou pelo detector. Rotular à mão,
  conferir a âncora contra o trecho, **commitar antes de rodar**.
- **Nenhum percentual sai enquanto os dois portões não passarem.** Fato novo aumenta a bancada; ele
  não move portão.

## 6. Se sobrar sessão (fora da frente do detector)

1. **`D-83` acusou `GEO-01` em 28 de 35 e `DEP-08` em 11.** Números do check que já rodava — a
   novidade é só a agregação. `n/a` não é aprovação, e 5 das 46 violações da primeira corrida do
   conformidade eram o check errado.
2. **`D-84`: 12 homes fora do índice.** ⚠️ O handoff de hoje errou o detalhe (põe `lumina` em
   `URL is unknown to Google`; ela está em `Discovered - currently not indexed`, e os `URL is
   unknown` são **dois**: `orcaobra` e `pathfinder`). `portfolio` está em `*.vercel.app` e fica fora
   de toda propriedade — falta de domínio próprio, não sinal de SEO.
3. **`D-85`: `roilabs.com.br` com OK em 33,6%** no export de 25/07 — o host com mais crawl (2596
   req) e o pior OK% da casa. ⚠️ **Date antes de caçar bug:** o export cobre 90 dias.
4. Para 20 fatos apuráveis faltam ~5, e **esses exigem fonte nova** — não há mais script pronto
   para ligar.

⏰ **Não dar push entre 00:00 e 01:00 BRT** — o cron do autopublishing dispara 00:13.
