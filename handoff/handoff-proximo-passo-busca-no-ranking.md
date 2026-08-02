# Handoff — tornar a `/busca` utilizável PARA o ranking, sem deixá-la entrar no score (01/08/2026)

> Para a próxima sessão. Sessão anterior:
> [`handoff-4-deploys-o-easypanel-aceitou.md`](handoff-4-deploys-o-easypanel-aceitou.md)
> (as 4 hipóteses de deploy viraram 2, as duas dentro do painel do EasyPanel).
> Índice: [`../handoff.md`](../handoff.md).
> Documentação da feature: [`../docs/busca/`](../docs/busca/).

Este documento é **especificação de trabalho, não relatório**. Assume que quem chega não tem
contexto, e onde o caminho barato e o caminho certo divergem ele defende o certo e diz o preço.

`npm test` **270 verdes** · `npm run validade` limpo · corpus **309 docs** · dourado **85 perguntas**.

---

## 0. A decisão que esta spec toma ANTES de qualquer código

**A busca NÃO entra no `computeScore`. Não é preguiça, é a mesma régua que o próprio
`lib/score.mjs` já aplicou.**

O score tem quatro entradas (`receita`, `blockers`, `seo`, `decay`) e **todas são apuradas ou
curadas**: HTTP ao vivo, GSC, `insights.json`, nota editorial escrita à mão. Em 01/08 o
`receitaProvada` — que é **fato derivado de gateway, não palpite** — foi RECUSADO no score por um
motivo mais fraco que este: cobertura baixa demais empurraria 33 projetos para o mesmo lugar.

A busca é pior candidata que aquele: **ela mede recuperação, não verdade** (é a frase que está no
rodapé da própria aba). Um número saído de síntese de LLM dentro do score transformaria erro
silencioso do corpus em **posição de ranking** — e ninguém conseguiria auditar de onde a posição
veio. Score se alimenta de coisa determinística.

**O que a busca resolve é o outro lado, e é real:** o ranking diz QUAL projeto e QUANTO. Ele não
diz **o que a casa já sabe sobre esse projeto**. Hoje, para responder isso, alguém abre a home,
lê o nome do projeto, vai na aba Busca e digita de novo. Esse é o trabalho desta spec.

⚠️ **Se uma sessão futura quiser mesmo pôr a busca no score, a condição é a mesma dos outros:
um número APURADO, com fonte viva, reproduzível sem LLM.** Não existe hoje. Ligar por inércia é o
defeito.

---

## 1. O que hoje impede, e é UMA coisa medida

**Os 35 cards de `data/projects.json` estão FORA do corpus.** `lib/corpus.mjs :: carregarCorpus()`
lê três origens — `data/protocolos/*.json`, `handoff/*.md` e as memórias de `~/.claude`. **Nenhuma
linha lê `projects.json`.**

Consequência prática, e é ela que torna a aba inútil ao lado do ranking: perguntar
`quais os blockers do goiania` devolve **handoffs que falam do goiania**, nunca o card que tem os
blockers escritos. O dado está a um `require` de distância e a busca não o vê.

Cada card carrega, por projeto: `receitaNota`, `decayNota`, `acaoDesc`, `blockersLista[].texto`,
`familia`, `estado`. **É a curadoria mais densa da casa sobre estado de projeto**, e é justamente o
que o ranking exibe — e o que a busca não indexa.

Três impedimentos menores, todos já conhecidos:

- **A reindexação é manual** (`scripts/indexar.mjs`). Documento novo some da aba em silêncio.
- **A busca completa leva ~12 s** (2 chamadas de claude-cli). Não cabe dentro de um render da home.
- **As duas abas não se cruzam em lugar nenhum da UI** — nem um link.

---

## 2. O trabalho, em ordem, com o preço

### 2.1 🚩 Pôr os 35 cards no corpus — é o item que muda o resultado

Em `lib/corpus.mjs`, uma quarta origem, `tipo: "projeto"`, **`id` = `slug`** (o mesmo vocabulário
das `fontes` do dourado, como manda o comentário do arquivo).

Texto do doc: `nome`, `acaoDesc`, `receitaNota`, `decayNota`, os `blockersLista[].texto`, `familia`
e `estado`. **Não** ponha `receita`/`blockers`/`decay` numéricos: são notas 0-10 e viram ruído de
token — quem pergunta por número quer o score da home, não um documento.

**Preço, e ele não é zero:**

1. **O corpus vai de 309 para 344 documentos, e isso mexe em IDF e nos vetores.** Toda comparação
   com os 88,0% passa a ser inválida. **Remedir com piso RELATIVO**, nunca contra o número velho:
   `node --env-file=.env scripts/avaliar.mjs --motor rerank --min bm25`. Já está medido que o
   absoluto anda sozinho (83,0% → 82,4% sem uma linha de código).
2. **Reindexar** — 35 documentos novos precisam de embedding (`scripts/indexar.mjs`).
3. **Risco que só a LINHA mostra:** 35 cards são textos curtos e parecidos entre si. Eles podem
   subir em bloco e empurrar handoff para fora do top-10. **Leia o diff nominal das perguntas do
   dourado antes de olhar o agregado** — foi exatamente assim que o defeito do `GPTBot` apareceu,
   com o placar parado em 41.

**Dois pontos que quebram em silêncio se esquecidos:**

- **`ONDE` em [`app/busca/page.tsx:66`](../app/busca/page.tsx) precisa da entrada `projeto`**, senão
  a procedência do card sai como id cru e a linha de baixo do resultado não diz de onde veio.
- **Nenhum teste amarra fonte de projeto a `projects.json`.** `test/dourado.test.mjs:116` amarra
  fonte no formato de protocolo, e a linha 128 amarra fonte `.md` a handoff existente — slug de
  projeto passa pelos dois sem ser verificado, igual às memórias. **Se entrar pergunta de projeto no
  dourado, o teste que amarra o slug entra no mesmo commit.**

### 2.2 O link, do ranking para a busca — 1 linha, zero LLM

Em [`app/page.tsx`](../app/page.tsx), no bloco do foco do dia: `foco.nome` (linha 132) e
`foco.blockersLista` (linha 153) já estão renderizados. Um `<a href="/busca?q=…">` ao lado.

**Isto não espera o 2.1** e é o melhor retorno por linha escrita da spec inteira: zero chamada de
LLM, zero latência, e a URL da busca já é compartilhável por construção (formulário `GET`).

⚠️ **Aponte o link para a lista, não para a resposta**: `&rerank=0&resposta=0` responde em ~0,3 s.
Um link no ranking que leva a uma espera de 12 s é um link que ninguém clica duas vezes.

### 2.3 Reindexação que não depende de alguém lembrar

O passo manual é o que faz documento novo sumir sem barulho — e com os cards no corpus fica pior,
porque **card editado é a coisa que mais muda na casa**.

O caminho barato: pendurar `scripts/indexar.mjs` no fim do autopublishing, que já roda todo dia às
00:13 BRT e já tem o ambiente. **Preço: o card indexado fica até 24 h velho.** É melhor que hoje
(velho para sempre até alguém lembrar) e não custa nenhuma infra nova.

⚠️ Só embeda o que falta (`lib/denso.mjs :: embedar`), então o custo diário é proporcional ao que
mudou, não ao corpus.

---

## 3. O portão: o que precisa bater para considerar FECHADO

```
node --env-file=.env scripts/indexar.mjs
node --env-file=.env scripts/avaliar.mjs --motor rerank --min bm25
npm test
```

| medida | como se lê |
|---|---|
| recall@10 **relativo ao BM25 da MESMA corrida** | não pode cair. O absoluto não se compara com 88,0% — denominador e corpus mudaram |
| diff NOMINAL das 85 perguntas | **nenhuma pergunta pode perder a fonte que já achava**. Card novo pode ENTRAR no top-10; handoff que respondia não pode sair |
| `npm test` | 270 verdes, mais o teste novo se entrar pergunta de projeto |

**Controle específico deste trabalho:** rode uma pergunta de projeto (`quais os blockers do
goiania`) e confira que o card aparece **e** que os handoffs que já vinham continuam lá. Card que
expulsa o handoff é o modo de falha desta mudança, não o sucesso dela.

---

## 4. O que NÃO fazer

- ❌ **Pôr qualquer saída da busca dentro de `computeScore`** (§0). Score é determinístico.
- ❌ **Chamar o claude-cli no render da home.** São 35 projetos por pageview, do mesmo pool que o
  autopublishing usa — a busca já custa 12 s com duas chamadas.
- ❌ **Comparar o recall novo com 88,0%.** Corpus de 344 não se compara com corpus de 309, do mesmo
  jeito que 85 perguntas não se comparam com 78. Piso relativo, sempre.
- ❌ **Ler o agregado antes das linhas.** O card entrando em bloco é invisível no percentual.
- ❌ **Indexar os campos numéricos do card** (`receita`, `blockers`, `decay`) — nota 0-10 vira ruído.
- ❌ **Mexer no `data/dourado.json` de `estado`**: o campo `resposta` deles é VAZIO de propósito e há
  teste que segura. Texto que não existe não apodrece.
- ❌ Reescrever handoff datado · resubmeter sitemap · descongelar o detector sem responder "para quê".

⏰ **Não dar push entre 00:00 e 01:00 BRT** — o cron do autopublishing dispara 00:13.

---

## 5. O que continua aberto e não é isto

Os **4 deploys presos no EasyPanel** (`aftercare`, `context`, `reviewshield`, `estetia`) seguem em
404 e **sobraram duas hipóteses, as duas dentro do painel** — build que falhou, ou token que deploya
um serviço que não é o que serve o domínio. É trabalho de painel, não de agente, e o portão do
`GEO-01` (25 → 21) não fecha sem ele. Detalhe em
[`handoff-4-deploys-o-easypanel-aceitou.md`](handoff-4-deploys-o-easypanel-aceitou.md).
