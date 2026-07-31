# Handoff — construir o juiz de VERDADE (aberto em 31/07/2026, para a próxima sessão)

Este handoff é **especificação de trabalho**, não relatório. Ele assume que quem chega não tem
contexto e que **esforço não é critério de corte** — onde o caminho barato e o caminho certo
divergem, o documento defende o certo e diz o preço na cara.

Estado imediatamente anterior: [`handoff-normas-que-rodam.md`](handoff-normas-que-rodam.md)
(frente 1 executada). O argumento que criou esta frente:
[`handoff-proximo-passo-corpus-verdade.md`](handoff-proximo-passo-corpus-verdade.md).
Arquitetura: [`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md) ·
índice: [`../handoff.md`](../handoff.md).

---

## O buraco, dito sem eufemismo

A aba `/busca` responde perguntas sobre a memória do portfólio, em prosa fluente, com citação
obrigatória e falha fechada. Números medidos em 31/07: **recall@10 88,0%**, respondeu **97,4%**,
citação ancorada **94,9%**, teto da síntese **100%**.

Nenhum desses números diz que a resposta está **certa**.

- `scripts/avaliar.mjs` mede **recuperação**: o documento certo está entre os 10?
- `scripts/avaliar-resposta.mjs` mede **ancoragem**: a citação aponta para um documento que o
  dourado reconhece?

**Citar a fonte certa e resumi-la errado passa com 100% nas duas réguas.** Esse é o modo de falha
mais caro do componente, porque a saída é indistinguível de uma resposta correta: mesma prosa,
mesma citação, mesma autoridade. Um humano só pega abrindo a fonte — que é exatamente o custo que
a aba existe para eliminar.

E não é hipótese. O corpus **já produziu duas afirmações erradas escritas com confiança** em duas
sessões consecutivas (uma atribuição errada que viveu três commits; um número de classificação
errado que quase virou meta). A taxa de erro do corpus **não é baixa nem conhecida — ela é NÃO
MEDIDA**, e a síntese multiplica o alcance de cada erro individual.

---

## O que já existe (leia antes de escrever qualquer linha)

### `data/dourado.json` — 78 perguntas, e ele é melhor do que está sendo usado

```
campos:  id · pergunta · resposta · camada · fontes · armadilha
camadas: protocolo 65 · estado 8 · episodio 5
78 de 78 têm `resposta` preenchida.  78 de 78 têm `armadilha` preenchida.
```

Exemplo real (`D-01`):

```json
{
  "pergunta": "O sitemap do fabrica volta com errors: 1 no GSC e tem 21 artigos escritos. Resubmeto e peço reindexação das URLs?",
  "resposta": "Não. Inspecionar as 26 URLs do sitemap ANTES: em 31/07 vinte e quatro já estavam Submitted and indexed… O errors: 1 é real e persiste, mas não estava bloqueando indexação nenhuma.",
  "camada": "protocolo",
  "fontes": ["SEO-04", "VER-06", "site_200_is_not_indexed_url_inspection", "handoff-fabrica-e-leva-de-um-linha-31-07.md"],
  "armadilha": "Tratar errors: 1 como bloqueio, resubmeter, e depois creditar ao resubmit uma indexação que já existia há três semanas."
}
```

🔑 **`armadilha` é o campo mais valioso do arquivo e nunca foi lido por código nenhum.** Ele
declara, por pergunta, **o erro específico que se espera que um sistema ingênuo cometa**. Um juiz
que só compara com `resposta` mede paráfrase. Um juiz que também pergunta *"a resposta caiu
NESTA armadilha?"* mede a única coisa que interessa: o sistema evita o erro que a instituição já
pagou para aprender?

Trate isso como a decisão de desenho central deste handoff.

### `scripts/avaliar-resposta.mjs` — a infraestrutura já está montada

O script já faz **o caminho exato da aba** (fusão → rerank → top-10 → síntese), já tem `--limite`,
`--ver`, cache em disco, e já separa os três estados de saída (respondeu / recusou / suprimida) e
o teto (`top-10 tinha fonte do dourado`). **O juiz entra como uma etapa a mais, não como script
novo** — e a separação "teto" existe justamente para não contar falha de recuperação como falha
de síntese. Preserve isso.

### `scripts/avaliar.mjs` — o padrão de quebra por camada já existe

Linhas 105-107: ele imprime `protocolo / estado / episodio` separados. **Foi essa quebra que
impediu o vetor de ser descartado** (perde 5,6 pontos no agregado, ganha 18,7 em `estado`). A
régua da síntese não faz isso. Copie o padrão.

### `lib/resposta.mjs` — o contrato de saída

`responder()` devolve `{ texto, fontes, erro }`. `texto` vazio tem três causas distintas e elas
**já estão separadas**: recusa legítima (`erro: ""`), síntese sem citação
(`resposta-sem-citacao`) e falha de CLI. O juiz não pode colapsar as três.

---

## A pergunta que o juiz responde — e a que ele NÃO responde

**Responde:** *"O que o sistema escreveu bate com o que a instituição sabe?"*

**NÃO responde:** *"O que a instituição sabe é verdade?"*

O dourado foi escrito por um agente lendo o mesmo corpus. Um juiz que compara resposta com
dourado mede **consistência interna**. Se o corpus está errado, o dourado provavelmente repete o
erro e o juiz aprova com nota máxima.

**Isso não é motivo para não construir o juiz — é motivo para não mentir sobre o que ele mede.**
Ele pega "resumiu errado", que é hoje 100% invisível. Não pega "o corpus mente", que é a frente 1
([`conformidade.mjs`](../scripts/conformidade.mjs), já no ar) e a frente 6 (detecção de
contradição, não construída).

📌 **Escreva essa distinção no cabeçalho do script**, como está no `avaliar-resposta.mjs` hoje. A
régua que não declara o próprio limite vira meta a bater em cima de um defeito — já aconteceu
nesta base.

---

# ▶️ O desenho, com o argumento de cada decisão

## 1. Duas passadas, não uma. A diferença entre elas é o sinal mais valioso do sistema

O desenho barato é uma chamada: *"compare a resposta gerada com a dourada, classifique"*. **Não
faça isso**, e o motivo não é rigor acadêmico — é que a passada única joga fora o único mecanismo
que este sistema pode ter para achar erro **no próprio corpus**.

**Passada A — FIDELIDADE (juiz cego ao dourado).**
Entrada: pergunta + resposta gerada + **os trechos que ela citou**. Nada mais.
Pergunta ao juiz: *cada afirmação da resposta é sustentada pelo trecho que ela cita?*

Isto **não é** ancoragem. Ancoragem pergunta "citou o documento certo?"; fidelidade pergunta "o
que ela diz sobre o documento é o que o documento diz?". É aqui que mora o "citou certo e resumiu
errado".

**Passada B — CONCORDÂNCIA (juiz vê o dourado).**
Entrada: pergunta + resposta gerada + `resposta` dourada + `armadilha`.
Saída: veredito factual + a armadilha foi evitada?

**O cruzamento das duas é o achado:**

| Passada A | Passada B | O que significa |
|---|---|---|
| fiel | concorda | resposta boa |
| infiel | discorda | a síntese errou — bug de prompt/recorte |
| infiel | concorda | ⚠️ **acertou por sorte**; o corpus não sustenta o que ela disse |
| **fiel** | **discorda** | 🚨 **ou o dourado está errado, ou o corpus está errado** |

A última linha é o motivo de fazer duas passadas. **É o primeiro mecanismo deste sistema que
aponta o dedo para dentro do corpus** — uma resposta fielmente derivada das fontes que contradiz
o que a instituição julga saber é, por definição, uma contradição entre dois documentos. É a
frente 6 (detecção de contradição) nascendo de graça como subproduto da frente 2, e é por isso
que ela vale as chamadas extras.

## 2. Quatro vereditos separados, nunca uma nota

```
correta      — bate com o dourado no que importa
incompleta   — nada errado, falta o essencial (ex.: dá a regra, omite o passo que decide)
contradiz    — afirma o oposto do dourado em algum ponto material
recusou      — NÃO ESTÁ NO CORPUS
```

**`incompleta` e `contradiz` têm consequências opostas e não podem virar a mesma nota.** Incompleta
custa uma consulta a mais. Contradiz manda a próxima sessão fazer a coisa errada com confiança —
é o dano que este projeto inteiro existe para evitar. Um score único de "qualidade" apaga
exatamente essa diferença.

`recusou` fica separado dos três porque **recusa não é erro**: em `D-66` o modelo achou quatro
contagens defasadas de projetos no corpus (37, 39, 40, 39) e recusou corretamente. Contar isso
como falha puniria o sistema por acertar.

Some a isso o binário independente:

```
armadilha:  evitou | caiu
```

**Esse é o número mais duro que este sistema pode produzir hoje**, e provavelmente será o mais
baixo. Publique-o inteiro.

## 3. Calibrar o juiz contra rótulo humano ANTES de acreditar nele

Um juiz LLM não medido é só mais um número não-verificado — o pecado que esta base já cometeu
duas vezes e documentou as duas.

**Antes de rodar as 78:** rotule **20 respostas à mão** (Jean, ou um agente com verificação
independente), usando os mesmos quatro vereditos. Rode o juiz nas mesmas 20. Meça concordância.

- **≥ 85%** → o juiz serve; siga.
- **< 85%** → o prompt do juiz está errado. Conserte antes de gastar as 78. Um juiz que discorda
  do humano em 1 de 4 casos não mede a síntese, mede a si mesmo.

Guarde os 20 rótulos em `data/juiz-calibracao.json`. **Eles são reutilizáveis para sempre** — toda
mudança futura no prompt do juiz remede contra eles em segundos.

## 4. Controle adversarial: o juiz que aprova tudo dá 97% e não vale nada

Esta é a checagem que quase todo mundo pula e é a que decide se o número significa alguma coisa.

**Injete respostas sabidamente erradas e confirme que o juiz as reprova.** Pegue ~10 respostas
corretas e corrompa cada uma de um jeito diferente e realista:

- inverta a conclusão (`"Não. Inspecione antes"` → `"Sim, resubmeta"`)
- troque um número material (24 URLs indexadas → 4)
- troque o sujeito (atribua ao `atma` o que era do `fabrica`)
- **faça a resposta cair exatamente na `armadilha` declarada** — este é o caso de teste que o
  campo `armadilha` estava esperando desde que foi escrito
- mantenha a citação correta e mude só o resumo ← **o modo de falha que motivou o juiz inteiro**

**Critério de aceite: o juiz precisa reprovar ≥ 9 de 10.** Se ele aprovar as corrompidas, o
"97% correta" da corrida real é ruído com casas decimais. Sem este controle, **não publique
número nenhum.**

Isto vira `test/juiz.test.mjs` com as corrupções fixas — e aí a regressão do juiz é detectada
para sempre, não só nesta sessão.

## 5. Modelo do juiz ≠ modelo do gerador

A síntese roda em `sonnet` (`MODELO_RERANK`, `lib/reranker.mjs:22`). **Não julgue com o mesmo
modelo que gerou**: modelo avaliando a própria saída tem viés de auto-preferência conhecido, e
aqui ele empurraria o número para cima exatamente onde a resposta é fluente — que é o caso que
mais importa pegar.

Use um modelo mais capaz para o juiz (`opus`), via `JUIZ_MODEL`, com fallback declarado. Custa
mais por chamada; o juiz roda em corrida de medição, não em produção. **O custo do juiz é o preço
de saber; o custo de errar é uma sessão inteira trabalhando em cima de um número falso.**

⚠️ Antes de escolher, releia [[claude_cli_token_pool_rotation]]: o pool é o mesmo do
autopublishing e **duas das três contas já estiveram mortas ao mesmo tempo sem sintoma**. O juiz
tem que percorrer o pool (`rodarClaude` já faz isso desde 31/07) e a corrida tem que ser
retomável.

## 6. Quebra por camada, obrigatória

```
protocolo  65  (83%)
estado      8  (10%)
episodio    5  ( 6%)
```

**O agregado é dominado por `protocolo` e vai esconder tudo o que importa.** `estado` é a camada
que apodrece por construção — em `D-66` o corpus guardava quatro contagens defasadas do mesmo
número. `episodio` são as 5 perguntas de "por que aconteceu", onde a síntese tem mais espaço para
inventar causa.

Se o juiz publicar um número só, ele repete o erro que a régua de recuperação **já evitou** e a
régua da síntese **já comete**. Imprima as três camadas × os quatro vereditos.

## 7. Persistir toda corrida em disco

Grave `data/juiz-corridas/AAAA-MM-DD-HHMM.json` com pergunta, resposta gerada, citações, os dois
vereditos e o modelo usado.

Sem isso, **"melhorou?" não tem resposta** — e esta base já mediu 83,0% e 82,4% no mesmo corpus
sem uma linha de código mudar, porque handoffs e memórias são reescritos e isso mexe em vetor e
IDF. Régua sem histórico não distingue melhoria de ruído. É a mesma dívida nº 1 do
`conformidade.mjs`, e as duas se resolvem do mesmo jeito.

---

## Plano de execução

Cada fase tem critério de aceite. **Não avance sem ele.**

**Fase 0 — Rótulo humano (20 perguntas).**
`data/juiz-calibracao.json`. Não é código, é a fundação. Aceite: 20 rotulados com os 4 vereditos.

**Fase 1 — `lib/juiz.mjs`, passada B (concordância + armadilha).**
Puro e testável: `montarPromptJuiz()` e `parseVeredito()` fora do I/O, no molde de
`montarPromptResposta`/`citacoes`. Aceite: **concordância ≥ 85% com os 20 rótulos**.

**Fase 2 — Controle adversarial.**
`test/juiz.test.mjs` com as 10 corrupções. Aceite: **reprova ≥ 9 de 10**.
🚩 Reprovou menos? **Pare.** O problema é o juiz, e nenhum número depois disso vale.

**Fase 3 — Passada A (fidelidade, cega ao dourado).**
Aceite: a tabela cruzada A×B sai preenchida, e **cada caso `fiel + discorda` é lido à mão**. Eles
são candidatos a erro no corpus ou no dourado — o retorno mais alto desta frente inteira.

**Fase 4 — Integrar no `avaliar-resposta.mjs`, com `--juiz`.**
Fora do default de propósito: hoje o script custa 1 chamada por pergunta; com juiz, 3. Quebra por
camada + persistência. Aceite: as 78 rodam, o relatório sai com camadas e vereditos separados, e
**as respostas `contradiz` são lidas uma a uma antes de publicar qualquer número.**

**Fase 5 — Publicar.**
Handoff + `CLAUDE.md` + memória. Declarando **no mesmo parágrafo** o que o juiz mede e o que ele
não mede.

---

## O que NÃO fazer

- **Não rode as 78 antes da calibração e do adversarial.** São ~156 chamadas para produzir um
  número que você ainda não sabe se significa algo. As fases 0-2 custam ~40 chamadas e decidem se
  vale gastar as 156.
- **Não junte fidelidade e concordância num prompt só.** Economiza uma chamada e destrói a célula
  `fiel + discorda`, que é o retorno mais alto da frente. Mesmo argumento que manteve o reranker
  separado da síntese: acoplar réguas obriga a remedir tudo a cada ajuste.
- **Não deixe o juiz ver `fontes` na passada A.** Ver a lista de fontes esperada contamina o
  julgamento de fidelidade — ele passa a avaliar recuperação de novo, que já tem régua.
- **Não substitua `avaliar-resposta.mjs`.** Ancoragem é determinística e grátis; verdade é cara e
  probabilística. As duas convivem: ancoragem roda toda entrega, o juiz roda quando se mexe na
  síntese.
- **Não trate `recusou` como erro.** Ver `D-66`.
- **Não conserte o prompt da síntese no meio da medição.** A chave do cache é o hash do prompt:
  mexer invalida tudo e custa 78 chamadas para remedir. Junte as mudanças de prompt e faça de uma
  vez (é a dívida nº 6 do handoff de 31/07, ainda aberta).
- **Não confunda este juiz com verdade sobre o mundo.** Para isso existe `conformidade.mjs`, que
  já roda 10 normas contra 35 projetos e produz fato verificado contra a realidade.

---

## A ponte que fica aberta depois (vale mais que o juiz)

As **8 perguntas de camada `estado`** ("quantos projetos o hub tem hoje", "qual o gate do
sirius") são as que o corpus responde pior — e são as únicas do dourado cuja resposta certa
**existe fora do corpus**: no GitHub, no GSC, no banco, e agora no
[`conformidade.mjs`](../scripts/conformidade.mjs).

Isso significa que, para essas 8, é possível um dourado com **lastro externo** em vez de lastro
em prosa — um dourado que o juiz não pode aprovar por concordância com um erro. É o caminho para
sair de "consistência interna" e chegar em "verdade" de verdade, e ele só ficou visível agora que
a frente 1 existe.

**Não é escopo desta sessão.** É a razão de fazer a quebra por camada direito: quando `estado`
tiver um número próprio, dá para atacá-lo com dado vivo em vez de texto.

---

## Custo e prazo, francamente

| | |
|---|---|
| Chamadas por corrida completa | **~156** (2 passadas × 78) + rerank/síntese com cache morno |
| Fases 0-2 (calibração + adversarial) | ~40 chamadas |
| Rótulo humano | ~1 h de atenção real |
| **Juiz mínimo** (1 passada, sem calibração) | cabe em 1 sessão — **e não é o que este handoff pede** |
| **Juiz confiável** (fases 0-5) | **2 sessões**, honestamente |

O handoff anterior disse que "a frente 2 cabe inteira numa sessão". **Cabe a versão que produz um
número.** A versão que produz um número *em que se pode confiar* não cabe — e um número não
confiável sobre corretude é pior que nenhum, porque vira meta.

---

## Armadilhas de operação (todas continuam valendo)

- **Reindexar depois de escrever handoff ou memória:** `node --env-file=.env scripts/indexar.mjs`
  (de máquina com Ollama, nunca do container). Memórias moram em `~/.claude`, fora do repo.
  **Este handoff inclusive.**
- **Ler as respostas, não só o agregado.** Isso pegou um bug de classificação que teria publicado
  83,3% no lugar de 97,4%, e pegou 5 dos 46 achados de conformidade como falso positivo. `--ver`.
- **Erro não é cacheado, então é retentado** na corrida seguinte.
- **`--motor todos` NÃO inclui o rerank.** `--motor rerank` explicitamente, com `--min bm25`
  (piso absoluto não reproduz entre sessões).
- **Não dar push entre 00:00 e 01:00 BRT** (cron do autopublishing às 00:13).
- **Deploy é Docker no EasyPanel, não Vercel.**
- **`HUB_USER`/`HUB_PASS` estão no `.env` local** — dá para verificar produção sem pedir ao Jean.
- **O rodapé da aba é a ÚLTIMA `.foot` da página.**

## Primeiros 20 minutos

1. `npm test` (**193 verdes**) e `npx tsc --noEmit` — para saber se o que quebrar depois foi você.
2. `node --env-file=.env scripts/avaliar-resposta.mjs --limite 5 --ver` — barato, e **leia as 5**.
   Se vierem vazias com `resposta-output`, o pool de tokens está esgotado e não é bug de código
   ([[claude_cli_token_pool_rotation]]).
3. Abrir `data/dourado.json` e **ler 10 campos `armadilha` seguidos**. É o melhor uso de 5
   minutos deste handoff: é lá que está o desenho do juiz.
4. Fase 0. Não pule para o código.
