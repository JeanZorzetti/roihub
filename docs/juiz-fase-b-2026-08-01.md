# Fase B — os 4 casos que o juiz apontou para dentro da casa (01/08/2026)

Leitura dos 4 casos não-`correta` da primeira corrida do juiz contra **gabarito apurado**
(`data/juiz-corridas/2026-08-01-0423.json`, 8 perguntas da camada `estado`).

**Zero chamada de LLM.** Todo o material já estava em disco; o que se gastou foi leitura e três
sondas determinísticas sobre o corpus (`carregarCorpus` + `trechoRelevante` com o orçamento real
de produção).

⚠️ **Nada aqui vira percentual.** `VER-08`: essa corrida foi a primeira da camada `estado`
julgada contra fonte viva, e a primeira corrida de um check novo mede o CHECK.

---

## O quadro

| caso | veredito | fiel? | classificação | onde o defeito mora |
|---|---|---|---|---|
| `D-67` | `contradiz` | não | **corpus errado** (forma) | a cobertura da medição escrita colada ao número |
| `D-70` | `incompleta` | sim | **corpus errado** (versão) | taxonomia superada convive sem marca; a vigente não chegou |
| `D-71` | `incompleta` | sim | **falha de síntese** | a resposta estava no trecho recebido e não foi usada |
| `D-72` | `incompleta` | sim | **lacuna de recuperação** | o documento citado não contém a informação; 10+ que contêm não chegaram |

Nenhuma delas é **gabarito errado**. As 8 apurações de `estado` rodaram limpas (`8 apuradas, 0 não
apuradas`) e nenhuma foi contestada pela leitura.

---

## 🔑 O achado transversal: `fiel + discorda` é necessário, não suficiente

O handoff que originou esta fase afirma que `fiel + discorda` é *"a única célula deste sistema que
aponta **para dentro do corpus**"*. **A leitura dos 3 casos desmente a forma forte dessa frase:
apenas 1 dos 3 aponta para o corpus.** Os outros dois apontam para camadas anteriores:

- `D-70` → corpus (a síntese derivou corretamente de um documento que está desatualizado);
- `D-71` → **síntese** (o corpus estava certo, chegou certo, e a resposta não o usou);
- `D-72` → **recuperação** (o corpus tem a informação em 10+ documentos e nenhum chegou ao top-10).

A célula continua valiosa — ela isola respostas em que o modelo **não errou o raciocínio** — mas
ela não distingue sozinha *"o corpus está errado"* de *"o corpus está certo e não chegou"*. **O que
separa os dois é uma sonda barata e determinística: a informação existe no corpus? e ela estava no
trecho que a síntese recebeu?** As duas perguntas se respondem sem uma chamada de LLM, e foi assim
que os 4 casos abaixo saíram classificados.

⚠️ **Consequência de operação:** ler `fiel + discorda` como "achei corpus errado" e sair
consertando documento teria consertado **um** caso e escrito conserto errado para dois.

---

## Os casos, um a um

### `D-67` — `contradiz` · **corpus errado (forma)**

**Pergunta:** quantos dos 35 projetos têm receita provada?
**Apurado:** `0 de 1 projeto(s) checado(s) … têm venda com data: nenhum. Receita provada: R$ 0,00`,
com ressalva nomeando os 34 sem fonte de pagamento ligada.
**A resposta abriu com:** *"1 de 35 projetos tem receita provada"*.

**A origem é uma frase, num documento, e ela chegou inteira ao trecho.** Em
`handoff-o-veredito-vem-antes-do-raciocinio.md:36`:

> **Receita provada medida contra gateway: R$ 0,00, em 1 de 35 projetos.**

O `em 1 de 35 projetos` qualifica a **cobertura da medição** — mediu-se 1 dos 35 —, não o
resultado. A sonda confirma que o trecho entregue à síntese continha `R$ 0,00` **e** `em 1 de 35`
lado a lado. O modelo grudou o quantificador no fato e leu "1 dos 35 tem receita".

**Isto não é defeito novo: é a norma que a casa já escreveu sendo violada em prosa.** O
`CLAUDE.md` diz, sobre o dourado de estado: *"`ressalva` é campo, não frase dentro do fato. A
limitação da medição escrita junto do número vira afirmação"* — e cita que foi exatamente ela que
produziu 1 dos 3 falsos positivos da primeira corrida do detector. **A norma existia, valia para o
JSON, e a mesma construção reapareceu na prosa de um handoff no dia seguinte.**

**Ação:** ⚠️ handoff datado **não se reescreve** — `handoff-o-veredito-vem-antes-do-raciocinio.md`
fica como está. O que se conserta é a **convenção daí pra frente**: cobertura de medição não entra
na mesma oração do número, nem em prosa. Escrever `R$ 0,00 (medido em 1 dos 35; 34 sem fonte
ligada)` custa os mesmos caracteres e não é lido como resultado.

**Achado de brinde, e é de outra camada:** a resposta atribuiu *"3 vendas orgânicas AFIRMADAS"* à
citação `[8]` = `landing_200_backend_nxdomain`, que não menciona `sirius` nem essa frase. A sonda
mostra que a frase estava em `handoff-lastro-no-dinheiro-e-no-gabarito-executado.md`, **também
presente no top-10**. A síntese acertou o conteúdo e **errou o índice da citação** — é fabricação
de procedência, não de fato, e o juiz pegou (`fiel: false`).

---

### `D-70` — `fiel + incompleta` · **corpus errado (versão)**

**Pergunta:** dos 35, o que está travado e em quê?
**Apurado:** 27 de 35 com blocker · por família **11 / 8 / 4 / 4** · estado 25 no-ar, 8
no-ar-inutilizável, 2 protótipo.
**A resposta entregou:** três famílias — *"não tem como cobrar"*, **"não tem quem venda"**, *"não
tem tráfego"* — mais cinco casos avulsos, e afirmou que família/estado *"saiu do gabarito de
`estado` como `nao_apurado`"*.

**Duas coisas estão desatualizadas, e as duas vieram do corpus.**

1. **"não tem quem venda" é uma família que não existe mais.** A taxonomia vigente tem cinco
   (`cobranca`, `trafego`, `produto`, `nao-vende`, `venda`), com ordem de precedência, depois do
   holdout cego de 01/08. A sonda confirma que `quem venda` **estava no trecho** entregue à síntese
   (via `handoff-dourado-com-lastro-externo-executado.md`), e que **nenhum dos três documentos
   citados contém a taxonomia vigente** — nem o termo `nao-vende`, nem `produto` como família, nem
   a contagem `27`.
2. **`nao_apurado` para família/estado deixou de ser verdade em 01/08**, quando `D-70` passou a
   apurar a distribuição a partir de `data/projects.json`.

**A síntese derivou corretamente de documentos que não sabem do dia de hoje.** É defasagem de
corpus por convivência de versões: a spec que **propôs** a taxonomia de 3-4 famílias e o executado
que a **substituiu** moram no corpus lado a lado, e nada no texto marca qual venceu.

**Ação — e ela é um item, não um conserto de handoff:** a taxonomia vigente das 5 famílias existe
hoje em `lib/dourado-estado.mjs` (`FAMILIAS`), em `lib/projects.ts` e no `CLAUDE.md`, **e em
nenhum documento vivo do corpus**. Enquanto for assim, toda pergunta sobre famílias recupera a
versão superada, porque é a única escrita em prosa. **Escrever a taxonomia vigente como norma
(documento vivo, sujeito ao `validade.mjs`) é o conserto real** — e é decisão de curadoria, então
fica registrada aqui como item em vez de ser inventada nesta sessão.

---

### `D-71` — `fiel + incompleta` · **falha de SÍNTESE** (não é corpus, não é gabarito)

**Pergunta:** o que está bloqueado esperando o Jean e não pode ser feito por agente?
**Apurado:** 7 bloqueios humanos, **nomeados** (goiania/IndexNow 403 · fabrica/2 URLs desconhecidas
· reviewshield/`GOOGLE_CLIENT_ID` · cyberspace/decisão · compass/4 chaves Stripe ·
compass/GitHub OAuth + Resend · qprime/subdomínio).
**A resposta entregou:** só o **critério** — *"painel de terceiro, credencial ou decisão de
negócio"* — e a existência da seção `SÓ O JEAN PODE FAZER`. **Zero itens nomeados.**

**O documento certo chegou, foi citado, e continha a lista.**
`handoff-proximo-passo-pos-sirius.md:19-27` traz uma **tabela markdown com os 6 itens nominais** e a
sonda confirma que `GOOGLE_CLIENT_ID` / `SÓ O JEAN PODE` **estavam no trecho de 2400 chars entregue
à síntese**. Não houve falha de recuperação nem de recorte: a síntese leu o cabeçalho da seção,
resumiu o critério e **descartou a tabela**.

**Ação:** nenhum conserto de corpus — o corpus está certo. Vira **item de régua da síntese**:
pergunta que pede enumeração ("o que está bloqueado", "quais projetos") e recebe critério em vez de
lista é um modo de falha próprio, e hoje nenhuma régua o pega — `avaliar-resposta.mjs` mede
ancoragem (a citação apontava para a fonte certa: passaria com 100%) e o juiz só o classifica como
`incompleta` depois de 3 chamadas.

⚠️ **Divergência de conteúdo, à parte:** o handoff lista 6 itens e o apurado lista 7, e não são o
mesmo conjunto (o handoff tem `atma` e um item "todos/rotacionar segredos"; o apurado tem `qprime`
e `cyberspace`, e quebra `fabrica` em item próprio). O handoff é datado de 31/07 e **não se
reescreve** — a fonte de verdade é `blockersLista` em `data/projects.json`, que é o que `D-71`
apura.

---

### `D-72` — `fiel + incompleta` · **lacuna de RECUPERAÇÃO**

**Pergunta:** onde o roihub roda e como se publica uma mudança?
**Apurado:** Docker (`Dockerfile` + `output: "standalone"`), não é Vercel, push em `main` dispara o
build **e a janela proibida de push: 00:13 BRT**.
**A resposta entregou:** Docker/EasyPanel/push em `main` — corretos — e **omitiu a janela
proibida**, fechando com *"NÃO ESTÁ NO CORPUS detalhes do processo de deploy"*.

**A recusa parcial estava tecnicamente certa do ponto de vista dela.** A resposta citou um único
documento, `handoff-autopublish.md`, e a sonda mostra que **esse documento não contém `00:13` em
lugar nenhum** — o trecho usou 100% do orçamento de 2400 chars e o alvo não está lá porque não
está no documento.

**Enquanto isso, `00:13` aparece em pelo menos 10 documentos do corpus** — `DEP-12`,
`handoff-conjunto-dourado.md`, `handoff-busca-hibrida-no-ar.md`, `handoff-compass-e-repos-sem-site.md`
e outros. **Nenhum chegou ao top-10.**

**Ação:** item de **recuperação**, não de corpus nem de síntese. Confirma por um segundo caminho o
que a fase G do handoff já suspeitava — *"na camada `estado`, o top-10 tinha a fonte do dourado em
apenas 75% e a citação ancorou em 50%… problema de RECUPERAÇÃO, escondido no agregado porque
`protocolo` domina (65 das 78)"*. **A régua recortada por camada (`scripts/avaliar.mjs --motor
rerank --min bm25`) deixa de ser hipótese e passa a ter um caso nominal.**

---

## Nota de método: uma medição minha que estava errada, e o que ela ensinou

A primeira sonda desta leitura chamou `trechoRelevante(texto, termos)` **sem o terceiro argumento**
e mediu contra o default de `lib/reranker.mjs`, `ORCAMENTO = 900` — o orçamento do **reranker**.
Síntese e detector usam **2400** (`lib/resposta.mjs:17`, `scripts/corpus-defasado.mjs:38`).

Com 900, o recorte de `D-71` não continha a tabela e a leitura ia sair **"falha de recorte"**. Com
os 2400 reais, contém — e a classificação correta é **falha de síntese**. Uma classificação
inteira dependia de um argumento default.

**O que fica:** `trechoRelevante` tem **três orçamentos diferentes na mesma casa** (900 no default,
2400 em dois chamadores) e nenhum chamador é obrigado a declarar o seu. Medido sobre 8.959 pares
(pergunta × documento longo) do dourado inteiro, com 2400: **82,7% do orçamento é efetivamente
usado** (handoff 91,4%, memória 74,7%) e **10,5% dos recortes colapsam numa janela só** — ou seja,
o recorte **não** é o gargalo que a primeira medição sugeriu, e a hipótese morre aqui em vez de
virar fase.

Fica um fato secundário, sem ação por enquanto: **a primeira ocorrência dos termos cai, em média,
a 2,1% do início do documento** — `indexOf` ancora quase sempre na abertura. Com 3 janelas e 82,7%
do orçamento gasto, o efeito prático não apareceu nestes 4 casos.

---

## Itens que saem desta fase

| # | item | camada | custo | depende de |
|---|---|---|---|---|
| B-1 | convenção: cobertura de medição **fora** da oração do número, também em prosa | norma | ~15 min | — |
| B-2 | escrever a taxonomia vigente das 5 famílias como **documento vivo** | corpus | curadoria | decisão do Jean |
| B-3 | régua para "pergunta de enumeração respondida com critério" | síntese | ~2 h | — |
| B-4 | `avaliar.mjs --motor rerank --min bm25` **recortado por camada** | recuperação | ~1 h + 78 chamadas | pool |

**Nenhum deles é a fase C**, e nenhum deles a bloqueia.
