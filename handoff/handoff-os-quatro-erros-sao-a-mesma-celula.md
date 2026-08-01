# Handoff — os quatro erros que sobraram são a mesma célula, e é a inofensiva (01/08/2026)

Este documento é **especificação de trabalho, não relatório**. Assume que quem chega não tem
contexto, e **esforço não é critério de corte**: onde o caminho barato e o caminho certo divergem,
ele defende o certo e diz o preço na cara.

Executa: [`handoff-o-portao-tem-treze-casos.md`](handoff-o-portao-tem-treze-casos.md) — fases
**B** e **E** completas, **C** parcial. Leituras desta sessão:
[`../docs/juiz-fase-b-2026-08-01.md`](../docs/juiz-fase-b-2026-08-01.md) ·
[`../docs/auditoria-congelado-2026-08-01.md`](../docs/auditoria-congelado-2026-08-01.md) ·
[`../docs/defasagem-fase-c-2026-08-01.md`](../docs/defasagem-fase-c-2026-08-01.md) ·
índice: [`../handoff.md`](../handoff.md).

---

## 1. O que mudou de estado

| fase | o que era | o que é agora |
|---|---|---|
| **A — rotacionar o token do MP** | dívida vencida | 🚨 **INTACTA. Rodei hoje e ele AUTENTICOU.** |
| **B — ler os 4 do juiz** | 4 casos sem ler | ✅ lidos e classificados, 0 chamadas |
| **C — holdout 13 → 40** | 13 casos, 1 caso = 7,7 pts | ⚠️ **parcial: 33 casos, 1 caso = 3,0 pts** |
| **E — auditar "congelado"** | não feita | ✅ feita; 1 achado real, 1 premissa provada |
| D, F, G, H, I | — | **não tocadas** |

**254 testes verdes · `tsc` limpo · `validade` 0 achados em 235 vivos · receita provada medida
contra gateway: R$ 0,00.**

---

## 2. A tese deste handoff

> **O detector não fabrica achado e não esconde achado. Ele erra em decidir se o documento FALA do
> assunto — e com 33 casos isso deixou de ser impressão e virou matriz.** Os quatro erros do
> holdout ampliado são todos `bate → nao-fala`: zero `desmente` perdido, zero `desmente` fabricado.
> **Para a lista nominal, que é a saída do produto, o detector acertou 32 de 32.**

Três consequências, e elas ordenam o trabalho:

1. **A fase D está atacando a coisa certa, e agora sabe qual célula mexer.** A passada 1 (cega ao
   fato: *"que afirmação, se alguma, este documento faz sobre X?"*) é exatamente a pergunta que os
   4 erros erram. Não é sorte de desenho — é o alvo medido.
2. **Isso NÃO libera percentual, e a tentação de achar que libera é o risco desta sessão.**
   `bate → nao-fala` é o mesmo mecanismo de `desmente → nao-fala`, que **esconde corpus podre**.
   Hoje ele cai no lado seguro; nada garante que continue, e 33 casos não separam 87,5% de 85%.
3. **A fase C não fechou.** 33 não são 40, e o adversarial continua em 10.

---

## 3. As quatro frases que a próxima sessão NÃO pode repetir errado

### 3.1 🚨 O token de PRODUÇÃO do Mercado Pago vazado AINDA FUNCIONA — reconferido em 01/08

`node --env-file=.env scripts/vendas-mercadopago.mjs` **autenticou hoje** e leu os 20 pagamentos.
`SEC-04` registra token de produção do MP em `origin/main` do repo **público**
`JeanZorzetti/Atma`, e em todo o histórico. **Nada foi rotacionado.** Tornar o repo privado não
desfaz — pode ter sido clonado ou indexado.

**É a única coisa deste documento que fica mais cara a cada dia e a única que nenhum agente pode
fazer.** Ordem do `SEC-04`: dinheiro → e-mail transacional → senha de banco (reusada em Compass,
`sofia_db`, `siriusdb`) → JWT secret. Rotacionar exige atualizar **os três**:
`Atma/Site/Frontend/.env.local`, o env de produção do atma no EasyPanel, e o `.env` do roihub —
senão a régua quebra em silêncio e vira `nao_apurado`.

### 3.2 🔑 `fiel + discorda` é NECESSÁRIO, não suficiente — e 2 dos 3 não eram corpus

O handoff anterior chamava `fiel + discorda` de *"a única célula que aponta para dentro do
corpus"*. **A leitura dos 3 casos desmente a forma forte disso: só 1 aponta para o corpus.**

- `D-70` → **corpus** (taxonomia de 3 famílias superada, com a família extinta "não tem quem
  venda" chegando ao trecho; a taxonomia vigente não estava em documento nenhum do top-10);
- `D-71` → **síntese** (a tabela dos bloqueios **estava** no trecho de 2400 chars que ela recebeu,
  e ela resumiu o cabeçalho da seção);
- `D-72` → **recuperação** (o documento citado **não contém `00:13` em lugar nenhum**; 10+
  documentos que contêm nunca chegaram ao top-10).

**O que separa os três é uma sonda determinística, não um julgamento:** *a informação existe no
corpus?* e *ela estava no trecho recebido?* — as duas se respondem com 0 chamadas. Ler a célula
como "achei corpus errado" e sair consertando documento teria consertado **um** caso e escrito
conserto errado para dois.

### 3.3 🔑 O portão imprimia 87,5% e reprovava dizendo "≥ 85%"

A condição real sempre foi **duas**: zero caso sem veredito parseável **E** taxa ≥ 85%. Só a
segunda estava no rótulo. O que reprovou foi 1 `defasagem-citacao`.

**A condição é certa e fica** — caso que não parseia não conta como aprovado, senão dá para ir
excluindo o difícil até o número subir. **O defeito era a apresentação**, e é a mesma classe do
resto desta base: régua que não declara o próprio critério. Consertado, com o motivo impresso.

### 3.4 🔑 O `effort` ficava fora da chave do cache — e o comentário que o omitia justificava incluí-lo

`lib/reranker.mjs` explicava a própria chave: *"o modelo entra porque o juiz roda em `opus` e a
síntese em `sonnet`: servir o veredito de um modelo para o outro esconderia justamente a troca que
se quer medir"*. **O `effort` ficou de fora**, e 4 dos 5 chamadores rodam em `medium` declarado
**dentro do `run`**, onde a chave não enxergava.

**A consequência cai exatamente na fase D:** trocar o `effort` do detector devolveria as ~24
respostas do effort anterior, de graça e em silêncio, e a leitura seria *"mudar o effort não mudou
nada"*. Consertado sem gastar chamada: as opções vão para a chave **e** para o `run` na mesma
linha, e a chave sem effort virou **formato legado — ainda lido, nunca escrito**.

---

## 4. O desenho, com o argumento de cada decisão

### Fase A — 🚨 rotacionar o token do MP (só o Jean)

Fora de ordem de propósito: **não é melhoria, é dívida vencida.** Nada a bloqueia.
**Preço honesto:** ~1 h.

### Fase C (resto) — fechar o que ficou aberto

**33 casos que contam, meta 40.** Um caso ainda vale 3,0 pontos, e a diferença entre 87,5% e 85%
continua sendo um caso.

- **C-1 — +7 casos válidos.** **Já existem 80 pares candidatos gerados** (6 perguntas de `estado`
  com apuração viva, trecho recortado no orçamento da produção). 19 rotulados, **61 esperando
  leitura**, e gerá-los custou 0 chamadas. O material está em pé; falta a leitura.
- **C-2 — adversarial de 10 para 20.** 10 não separam 8/10 de 9/10, e hoje ele reprova por um.
- **C-3 — mais `desmente`.** 7 de 39. **É a célula que decide e a menos povoada.**
- **C-4 — âncora nos 10 adversariais.** Nenhum tem; a regra de construção não roda ali.

⚠️ **As regras não se negociam, e são o que salvou esta rodada:** rotular lendo a janela de 2400
da produção · `ancora` conferida contra o trecho **antes** de escrever · **commitar antes de
rodar**. ⚠️ **Não preencha a `ancora` dos 7 legados** — escolher a frase depois de ver o veredito
é contaminação.

⚠️ **`D-68` e `D-69` (GSC) ficaram fora dos pares novos de propósito:** são a família `(hoje N)`,
que já domina o material. Ampliar por ali reforça a monocultura e mede uma regex.

**Preço honesto:** ~2 a 3 h de leitura, ~10 chamadas (os candidatos já estão em disco).

### Fase D — as duas passadas do detector (só depois da C)

O desenho é o do juiz, e agora tem alvo medido: **os 4 erros são o detector não decidir se o
documento fala do assunto.**

- **passada 1 (cega ao fato):** *"que afirmação, se alguma, este documento faz sobre X?"* — devolve
  a frase literal ou `nenhuma`. **É a pergunta que os 4 erros erram.**
- **passada 2 (cega ao documento):** *"esta afirmação é compatível com este fato?"* — `bate|desmente`.

⚠️ **Custo, e ele é político: dobra as chamadas de `corpus-defasado.mjs`.** Duas saídas: (a) rodar
a passada 1 uma vez por documento e **cachear por documento** — ela não depende do fato, só do
assunto; (b) aceitar o custo e matar outra régua de LLM. **A (a) é melhor e deve ser tentada
primeiro.** ⚠️ **Mudar o prompt invalida o `.cache`** (~24 chamadas por tentativa) — e agora
**mudar o `effort` também**, que é o conserto desta sessão funcionando como deve.

**Aceite:** os dois portões passam com os fixtures da fase C fechada. Enquanto não passarem,
**nenhum percentual de defasagem sai — inclusive o 16,7%, que é PISO.**

### Fase B (resíduo) — 4 itens que a leitura gerou

| # | item | camada | custo |
|---|---|---|---|
| B-1 | convenção: cobertura de medição **fora** da oração do número, também em prosa | norma | ~15 min |
| B-2 | taxonomia vigente das 5 famílias como **documento vivo** (hoje só em código e CLAUDE.md) | corpus | curadoria do Jean |
| B-3 | régua para "pergunta de enumeração respondida com critério" (`D-71`) | síntese | ~2 h |
| B-4 | `avaliar.mjs --motor rerank --min bm25` **recortado por camada** (`D-72`) | recuperação | ~1 h + 78 chamadas |

**B-2 é o mais valioso e é decisão do Jean:** enquanto a taxonomia vigente não existir em prosa,
toda pergunta sobre famílias recupera a versão superada, porque é a única escrita.

### Fases F a I — herdadas, intactas

**F (o dinheiro).** `orcaobra`/Kiwify é o **único gateway vivo do portfólio sem régua lendo** — o
card diz "fatura hoje" e isso nunca passou por régua nenhuma; **enquanto não passar, o card diz
AFIRMADO**. `sirius` fatura por tier no banco (`ETIMEDOUT` da máquina de dev). Inventário pelo
REPO, não só pelo site. **0 chamadas.**

**G (remedir e publicar com a fronteira declarada).** ⚠️ `VER-08`: a corrida de `estado` de 01/08
foi a primeira e **mediu o CHECK** — seus números não se publicam. **Publique sempre com a
fronteira no mesmo parágrafo:** 8 das 78 são julgadas contra fonte viva; **70 continuam sendo prosa
concordando com prosa.**

**H (inventário do conversível)** e **I (contradição entre documentos)** — inalteradas. **A I
continua sendo a mais bonita de mostrar e continua não sendo a primeira**: usa a passada que ainda
não passa nos portões.

---

## 5. A ordem defendida, e o argumento

**A → C(resto) → D → B-2/B-4 → F → G → H → I**

- **A vem primeiro** porque nada a bloqueia e ela fica mais cara todo dia. Uma hora.
- **C antes de D continua sendo a decisão que dá vontade de pular** — e agora dá mais vontade,
  porque a matriz é boa. **Não pule.** Uma matriz limpa em 33 casos com um caso valendo 3 pontos é
  exatamente a forma que "sorte" tem quando se parece com progresso.
- **D depois da C**, com a passada 1 cacheada por documento.
- **F é o dinheiro**, custa 0 chamadas e o `orcaobra` segue sem régua.

**Se o pool estiver ruim: A → C(rotulagem) → B-2 → F não gastam quase nada** — os 61 candidatos já
estão em disco.

---

## 6. O que NÃO fazer

- **Não publique percentual de defasagem porque a matriz ficou limpa.** Zero `desmente` errado em
  33 casos é bom sinal, não é portão. Os dois portões continuam reprovando.
- **Não leia `bate → nao-fala` como inofensivo em definitivo.** É o mesmo mecanismo do erro que
  esconde corpus podre; hoje cai no lado seguro.
- **Não escreva a quarta redação de regra do detector.** Três falharam. O que funcionou foi mudar a
  ESTRUTURA da saída.
- **Não reordene a saída do detector** (`TRECHO → MOTIVO → VEREDITO`). Há teste.
- **Não afrouxe a conferência de citação para melhorar o número.** As que caem são fabricação real.
- **Não conserte os 6 inválidos por construção nem preencha a âncora dos 7 legados.**
- **Não afrouxe a condição "zero sem veredito parseável"** do portão 1. Ela é o que impede excluir
  o caso difícil até o número subir.
- **Não mexa no prompt do juiz da síntese.** 87,5% / 10-10. É a única régua de LLM calibrada.
- **Não reescreva handoff antigo** para o corpus bater com hoje.
- **Não some régua de LLM sem matar uma.**
- **Não leia `sem-gateway` como "não cobra"**, nem `vendas` ausente como R$ 0, nem `nao_apurado`
  ou `n/a` como aprovação.
- **Não atualize `dourado_lacrado` sem querer.** Se o teste do lacre reprovar, ou o gabarito mudou
  de propósito (atualize o hash e diga por quê) ou alguém acabou de mover um portão sem perceber.

---

## 7. Custo e prazo, francamente

| fase | esforço | chamadas |
|---|---|---|
| **A — 🚨 rotacionar o token do MP** | **~1 h (só o Jean)** | **0** |
| **C — fechar: +7 holdout, adversarial 10 → 20** | **~2 a 3 h de leitura** | **~10** |
| **D — duas passadas do detector** | ~4 h de código | ~60 (cache por documento pode cortar) |
| B-2 — taxonomia como documento vivo | curadoria | 0 |
| B-4 — recall recortado por camada | ~1 h | ~78 |
| F — orcaobra/Kiwify · sirius · inventário pelo repo | ~1 sessão + ~3 h | 0 |
| G — remedir as 78 + fronteira declarada | ~3 h | ~78 |
| H — inventário do conversível | ~1 sessão | 0 a 50 |
| I — detector de contradição | ~3 h | ~100 |

---

## 8. Armadilhas de operação

- **🆕 Mudar o `effort` invalida o `.cache`** desde 01/08 — antes não invalidava, e essa era a
  armadilha. Chave = `modelo + effort + prompt`; a chave sem effort é **legado, ainda lido**.
- **🆕 `rodarCacheado(prompt, run, ligado, { modelo, effort })`** — o 4º argumento virou objeto e
  as opções vão para a chave E para o `run`. Passar o effort só dentro do `run` volta a esconder.
- **🆕 `dourado_lacrado` trava por HASH os gabaritos que os portões leem de `dourado.json`.**
  Reescrever a `resposta` de um caso reprova o `npm test` nomeando o caso e imprimindo o hash novo.
- **🆕 O portão 1 tem DUAS condições.** `>= 85%` **e** zero sem veredito parseável.
- **Reindexar depois de escrever handoff ou memória**: `node --env-file=.env scripts/indexar.mjs`
  (de máquina com Ollama, nunca do container). **Este handoff inclusive.**
- **`parseDefasagem(texto, docTrecho)` recebe DOIS argumentos.** Sem o segundo, a conferência de
  citação não roda.
- **A conferência de citação ignora tudo que não é letra ou dígito.** Foi medido.
- **O fixture de calibração é CONGELADO e tem `ancora`.** Caso cujo trecho não contém a âncora sai
  **antes** de qualquer chamada.
- **`scripts/gateways.mjs` pede uma rota que não pode existir antes de acreditar em qualquer 200.**
- **Casar gateway pela PALAVRA marca catálogo de integração como cobrança.** Só URL.
- **`data/projects.json` tem 5 famílias**, com ordem de precedência. O enum vive em
  `lib/dourado-estado.mjs` **e** em `lib/projects.ts`. Mexer num sem o outro passa no `npm test` e
  quebra o `tsc`.
- **`blockersLista` é `{texto, humano}` e tem TRÊS consumidores.** Quem pega quebra de formato é
  `npx tsc --noEmit`, não o `npm test`.
- **Arquivo de teste novo entra à mão na lista do `package.json`**, senão nunca roda.
- **Citação de exemplo vai entre crases** — `validade.mjs` mascara span de crase.
- **`data/*.json` é UTF-8 e o `Get-Content` do PowerShell mostra mojibake.** O round-trip
  `JSON.stringify(…, null, 2)` preserva.
- **Nome de arquivo de corrida é UTC; `apurado_em` é BRT.**
- **A janela de 28 dias do GSC desliza na meia-noite UTC.**
- **Impressão pede `dimensions: []`; clique não-branded pede `query`.**
- **Escrever handoff no meio de uma medição muda o corpus** (mexe em IDF e vetor). Comparar sempre
  contra a mesma execução (`--min bm25`).
- **Ler as linhas, não o agregado.** `--ver`.
- **`--motor todos` NÃO inclui o rerank.**
- **Não dar push entre 00:00 e 01:00 BRT** (cron do autopublishing às 00:13).
- **Deploy é Docker no EasyPanel, não Vercel.**

---

## 9. Primeiros 20 minutos

1. `npm test` (**254 verdes**), `npx tsc --noEmit` e `node scripts/validade.mjs` (**0 achados**) —
   para saber se o que quebrar depois foi você.
2. `node --env-file=.env scripts/vendas-mercadopago.mjs` — **~5 s, zero LLM.** ⚠️ **Se ele
   autenticar, a fase A NÃO foi feita.** Autenticou em 01/08.
3. `node --env-file=.env scripts/defasagem-calibrar.mjs --ver` — **cache morno, ~0 chamadas.**
   **Leia a MATRIZ, não o percentual:** os 4 erros são todos `bate → nao-fala`, e a linha
   `desmente → desmente` está em 5/5. É o argumento inteiro da seção 2.
4. `node scripts/gateways.mjs --ver` — **~1 min, zero LLM.** 1 ligado, 1 servido sem régua
   (`orcaobra`), 3 só preço, 30 nada.
5. **Abra os 61 candidatos que sobraram** e comece a rotular pelos `desmente`. É a fase C, é o que
   destrava a D, e o material já está recortado na janela certa.
