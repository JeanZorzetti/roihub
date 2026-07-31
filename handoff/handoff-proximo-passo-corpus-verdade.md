# Handoff — o próximo passo é fazer o sistema MEDIR VERDADE (31/07/2026, 18h BRT)

Estado imediatamente anterior: [`handoff-resposta-com-citacao.md`](handoff-resposta-com-citacao.md)
(a síntese com citação, entregue hoje). Antes dele:
[`handoff-reranker-no-ar.md`](handoff-reranker-no-ar.md) ·
[`handoff-busca-hibrida-no-ar.md`](handoff-busca-hibrida-no-ar.md).
Arquitetura: [`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md) ·
índice: [`../handoff.md`](../handoff.md).

Este handoff não é relatório do que foi feito — é **argumento sobre o que fazer**, escrito para
quem chega sem contexto. Ele assume que esforço não é critério de corte.

---

## Onde o sistema está, sem eufemismo

Em três sessões o hub ganhou memória institucional consultável: 265 documentos (97 protocolos
tipados, 42 handoffs, 126 memórias), recuperação híbrida com reranker (**88,0% de recall@10**) e,
desde hoje, **resposta sintetizada com citação obrigatória** (respondeu 97,4%, citação ancorada
94,9%). 181 testes verdes. Duas chamadas de claude-cli por busca, ~12 s.

E aqui está a frase que importa mais que todos esses números:

> **Nada neste sistema mede verdade.** O dourado mede recuperação. A régua nova mede ancoragem.
> Uma afirmação errada, escrita com confiança num handoff, é indexada, recuperada em 88% dos
> casos, citada com precisão de 94,9% e **redigida em prosa fluente pelo claude-cli**. O sistema
> ficou excelente em entregar rápido o que estiver lá — certo ou errado.

Isso não é hipótese. **Já aconteceu duas vezes, documentado:**

1. Na sessão do reranker, uma atribuição errada foi escrita com confiança, commitada, pushada, e
   **viveu três commits** até uma medição por conta própria derrubá-la. Se não tivesse sido
   rodada, a sessão seguinte teria gastado tempo numa correção **medida como inútil**.
2. Hoje, na primeira medição da síntese, o número "83,3% respondeu / 8 recusas" estava **errado
   por bug meu de classificação** e só caiu porque as 8 foram LIDAS. Publicado, teria virado meta
   a bater nas próximas sessões — em cima de um defeito.

Duas ocorrências em duas sessões. **A taxa de erro do corpus não é baixa nem conhecida — ela é
NÃO MEDIDA**, e a síntese acabou de multiplicar o alcance de cada erro individual.

Então a pergunta certa para a próxima sessão não é "como melhorar o recall". É:
**como este sistema passa a saber quando está errado?**

---

# ▶️ As frentes, ranqueadas com argumento

## 1º — Executar as normas: transformar os 97 protocolos em verificação que RODA

**Esta é a frente que muda a natureza do sistema, e é a mais cara. Faça mesmo assim.**

Os 97 protocolos não são prosa: são registros tipados com um campo que quase ninguém percebeu —
`verificacao.como`, **um comando de shell que decide se a norma está sendo cumprida**. A
distribuição já está pronta para ser executada:

```
verificacao.tipo        automatica 73 · semiautomatica 9 · manual 15
verificacao.falha       bloqueia 78 · alerta 19
aplica_se_a.stack       * 47 · next 29 · astro 11 · node 11 · react 6 · prisma 5 …
aplica_se_a.infra       * 59 · easypanel 18 · vercel 15 · windows-onedrive 7 · docker 6 …
frequencia              "por entrega" 31 · mensal 4 · semanal 1 · "sob suspeita" 7 …
```

E `data/projects.json` tem **35 projetos** com `slug`, `url`, `repo`, `blockers`. O cruzamento
`protocolo.aplica_se_a × projeto` é uma matriz que **já existe nos dados e nunca foi executada
uma única vez.**

**O que isso entrega que nada mais entrega:** hoje o hub responde "qual é a norma sobre X"
quando alguém pergunta. Depois disso, ele responde **"quais projetos violam qual norma AGORA"
sem ninguém perguntar** — e, de quebra, começa a auditar o próprio corpus: norma que não roda
está mal escrita; norma que passa em 35/35 desde sempre é norma morta ou trivial; norma que
falha em massa é ou um achado caro ou uma norma errada. **Executar a norma é a única operação
neste sistema que produz informação nova sobre o mundo real** — todo o resto reorganiza texto
que já estava escrito.

**Por que é caro, dito na cara:** `verificacao.como` é *comando com prosa dentro*, não contrato
de máquina. Exemplo real (`VER-01`):

```
echo | openssl s_client -connect HOST:443 -servername HOST | openssl x509 -noout -subject -issuer -dates  # issuer auto-assinado = cert nunca emitido
```

`HOST` é placeholder, o critério de falha está num **comentário em português**, e o comando
pressupõe um shell POSIX. Para rodar isso são necessários: (a) parametrização (`HOST`, `URL`,
`REPO`, `DIR`) ligada aos campos de `projects.json`; (b) um **critério de aprovação legível por
máquina** — hoje ele está em prosa; (c) sandbox e timeout, porque são comandos de rede contra
produção; (d) uma decisão explícita sobre os 15 `manual` (viram tarefa na aba Agenda, não check).
São 73 checks para converter. **Estimativa honesta: 2 a 4 sessões**, e a primeira delas deve
converter **10, não 73** — as 10 de `falha_significa: bloqueia` + `frequencia: por entrega`, que
são as que decidem se uma entrega pode fechar.

**Como saber que valeu:** o resultado não é uma tabela verde. É o primeiro **achado caro** —
uma violação real que ninguém sabia. O reranker levou 5,6 pontos de recall; a curadoria de 30/07
levou o Atma desindexado (−98% de impressões). Um runner de conformidade é da segunda categoria.
Se rodar 10 checks contra 35 projetos e não achar **nada**, isso também é informação: as normas
descrevem o passado e não vigiam o presente.

## 2º — Um juiz de VERDADE para a síntese, aceitando o que ele não pode medir

O handoff anterior pediu explicitamente: *"as mesmas 78 perguntas, medindo se a resposta contém o
fato correto — não recall"*. **Eu não entreguei isso.** Entreguei ancoragem (a citação aponta
para uma fonte que o dourado reconhece?), que é grátis e determinística, e é um **proxy**. A
diferença entre as duas réguas é exatamente o modo de falha que mais importa: **citar a fonte
certa e resumi-la errado passa com 100% na régua de hoje.**

`data/dourado.json` já tem o campo `resposta` — a resposta conhecida, escrita à mão, para as 78
perguntas. O juiz é construível numa sessão: para cada pergunta, comparar a resposta gerada com a
resposta dourada e classificar em **correta / incompleta / contradiz / recusou**. Custo: mais 78
chamadas por corrida (com cache, iterar sai barato — a lição do `.cache/rerank.json` vale igual).

**A limitação, dita antes de alguém descobrir sozinho:** o dourado foi escrito por um agente
lendo o mesmo corpus. Um juiz que compara resposta com dourado mede **consistência interna**, não
realidade. Se o corpus está errado, o dourado provavelmente repete o erro e o juiz aprova.
**Ele pega "resumiu errado"; não pega "o corpus mente".** Só a frente 1 pega isso. Por isso o
juiz é 2º e não 1º — mas é 2º e não 5º porque é barato, rápido, e sem ele estamos confiando numa
prosa sintetizada com base numa régua que não olha o conteúdo.

**Faça junto, é o mesmo trabalho:** quebrar a régua da síntese **por camada** (protocolo /
estado / episódio). A régua de recuperação faz isso desde a fase 3 e foi ela que impediu o vetor
de ser descartado (perde 5,6 no agregado, ganha 18,7 pontos em `estado`). A régua da síntese
**não faz** — está agregada, e o agregado esconde exatamente onde a síntese quebra.

## 3º — Dar interface de AGENTE ao corpus (MCP + rota HTTP)

A camada 7 da arquitetura promete três cascas: **MCP (agente), rota HTTP (hub e outros agentes),
aba (Jean)**. Existe uma: a aba. E ela está atrás de basic auth, num browser.

**Quem mais precisa desta memória é a próxima sessão de Claude — e ela é a única que não tem
acesso.** Hoje um agente que quer saber "qual a armadilha do sitemap em 200" faz `grep` em 265
arquivos espalhados entre o repo e `~/.claude`, ou re-deriva do zero. Um `/api/busca` (JSON,
`CRON_SECRET` ou token dedicado, o middleware já tem o padrão) mais um servidor MCP fino em cima
dele transformam 265 documentos em algo que se **pergunta** em vez de se **procurar**.

**Este é o único item da lista cujo retorno COMPÕE:** cada sessão futura fica mais barata, e o
efeito cresce com o tamanho do corpus — que só aumenta. Esforço: pequeno para a rota (a lógica
inteira já está em `.mjs` justamente para ser importável fora do Next), médio para o MCP.
Cuidado real: a rota herda o custo de 2 chamadas de claude-cli por consulta e **divide pool com
o autopublishing** (ver frente 5) — a rota deve expor `rerank` e `resposta` como parâmetros e o
default para agente provavelmente é `rerank=1&resposta=0`: agente sabe ler 10 trechos, o que ele
não sabe é onde eles estão.

## 4º — Camada `estado`: rotear para a fonte viva em vez de indexar mais texto

Inalterado das duas sessões anteriores, e continua certo. `estado` dá **51,0% em @10** e **74,0%
em @50** — o segundo número é o que decide: **um quarto dessas perguntas não está no corpus em k
nenhum**, e nenhuma melhoria de índice alcança o que não foi escrito. "Quantos projetos hoje",
"qual o gate do sirius" moram no GitHub, no GSC e no banco, **e o hub já lê as três nas outras
abas**.

A síntese confirmou o diagnóstico de um jeito novo e mais claro: em `D-66` ("quantos projetos o
hub tem hoje?") o modelo achou **quatro contagens defasadas** no corpus (37, 39, 40, 39) e
recusou, corretamente, dizendo que não há número atual. Isso não é falha de recuperação nem de
síntese: **é o corpus guardando fotografia de um número que muda toda semana.** Prosa sobre
estado apodrece por construção.

São 8 das 78 perguntas — teto agregado de +6,3 pontos, parece pequeno. **Mas é a classe de
pergunta que o Jean realmente faz**, e é a única estruturalmente sem resposta. Não deixe o
agregado decidir. Esforço: médio-baixo, é plumbing sobre dados que já existem no processo.

## 5º — O conflito de recursos que ninguém mediu: a busca e o autopublishing dividem o mesmo pool

Cada busca com resposta gasta **2 chamadas de claude-cli** do `CLAUDE_CODE_OAUTH_TOKENS` — o
mesmo pool que às 00:13 BRT publica em **10 projetos**. O autopublishing é receita; a busca é
conforto. Hoje não há orçamento, cota, nem prioridade: uma tarde de 30 buscas são 60 chamadas
que podem faltar de madrugada, e **ninguém saberia** — o sintoma seria "conta esgotada, projeto
pulado", indistinguível de rate limit normal.

Não é urgente porque o volume de busca é baixo hoje. **É importante porque o modo de falha é
silencioso e cai no lado que gera dinheiro.** Conserto barato: contar chamadas por dia e derrubar
a síntese (não a busca) quando passar de um teto; ou marcar a janela 23:00–01:30 como somente
`?resposta=0`. Conserto certo: fila com prioridade, autopublishing sempre na frente.

## 6º — Detecção de contradição na escrita (camada 5), o que impede a base de apodrecer

A arquitetura já diz, com todas as letras, que esta é **"a única feature que impede a base de
apodrecer"** — e ela nunca foi construída. Toda sessão reescreve handoffs e memórias; nada
compara o fato novo com o indexado nem levanta bandeira quando os dois se contradizem. Os quatro
números de projetos do `D-66` são o exemplo mais limpo: **quatro afirmações incompatíveis
convivendo no índice, todas recuperáveis, nenhuma marcada como superada.**

Fica em 6º **por ordem de dependência, não por importância**: depois da frente 1 existe um
mecanismo que decide quem está certo (executar), e depois da 2 existe um juiz. Construir
detecção de contradição antes disso é construir um alarme sem critério — ele vai marcar
divergência e não vai saber qual lado está errado.

---

## O que NÃO fazer (e por que, para não ser reaberto)

- **Fase 4, contextual retrieval.** Custa 1331 chamadas por reindexação contra 1 por busca, e
  levanta o teto de recuperação (@50 = 92,9%) que **deixou de ser a parte que aperta**: o teto
  medido da síntese é **100%** — em todas as 78 perguntas havia fonte do dourado no top-10. Ela
  melhora a metade densa, que sozinha ganha do BM25 por 0,1 ponto. Se um dia for feita: janela
  ociosa do pool, fora das 00:00–01:00 BRT, medida com `--motor rerank --min bm25`.
- **Obedecer o ranking do reranker.** Medido duas vezes, com dois prompts: @10 76,7% e 78,8%
  contra 82,4% da fusão, com o @1 despencando para 19,5%. Ele acerta o conjunto e erra a ordem.
  `rrf(c=10)` funde e ganha em todos os k.
- **Fundir ordenação e síntese num prompt só.** Economiza 1 chamada e **acopla os 88,0% de recall
  à redação da resposta** — toda mexida na prosa passaria a exigir remedir a recuperação inteira.
  O custo economizado é menor que o custo de remedir.
- **Piso absoluto de recall.** Não reproduz entre sessões: os mesmos 259 docs deram 83,0% e
  depois 82,4% sem uma linha mudar, porque handoff e memória são reescritos e isso mexe em vetor
  e IDF. Sempre `--min bm25`.
- **Atualizar o dourado para creditar as memórias novas.** Medido com e sem os docs novos: 82,4%
  nos dois, **0 pergunta afetada**.
- **`qwen3-embedding` na VPS.** 2 min 20 s por chunk → 51 h de indexação. O modelo é
  `nomic-embed-text`.

---

## Dívida que eu contraí hoje, listada por honestidade

A síntese foi construída sob mentalidade de mínimo esforço. Onde isso deixou débito real:

1. **A régua mede ancoragem porque era grátis.** É a frente 2 acima. É o maior débito.
2. **A régua da síntese não quebra por camada** — o agregado esconde onde ela falha.
3. **A aba não cacheia resposta nenhuma.** Duas pessoas (ou dois refreshes) na mesma pergunta
   pagam 2 chamadas cada. Um cache por hash de `pergunta + ids do top-10` no Postgres resolveria,
   e ainda deixaria histórico do que foi perguntado — que é dado de produto que hoje se perde.
4. **`.cache/rerank.json` guarda dois tipos de saída** (ordenação e resposta) sob um nome que diz
   um. Funciona porque a chave é o hash do prompt, mas o nome mente para quem chegar depois.
5. **Os códigos de erro da resposta são renomeados na saída** (`rerank-timeout` →
   `resposta-timeout`) porque `rodarClaude` é compartilhado. É band-aid: o certo é o runner não
   ser dono de código de erro de ninguém.
6. **A recusa parcial abre com "NÃO ESTÁ NO CORPUS quanto a…"**, o que faz a resposta parecer que
   se nega antes de responder. É prompt, e eu não consertei **porque mexer no prompt invalida o
   cache inteiro e custa 78 chamadas para remedir**. Quando for mexer, mexa em tudo de uma vez.
7. **Nada é streamado.** Os ~12 s são tela parada. Streaming exige client component ou route
   handler — decisão de arquitetura, não ajuste.
8. **Os `[n]` não são links.** Deveriam rolar até o card citado. Trivial, e é o gesto que faz a
   citação ser realmente conferida.
9. **`?resposta=0` e `?rerank=0` somem ao buscar de novo** — o formulário só manda `q`. Wart
   pré-existente, agora com dois flags.

---

## Primeiros 20 minutos da próxima sessão (nesta ordem)

1. **Verificar em produção o que foi deployado hoje** (`84a005f` + `f38dcdf`, EasyPanel builda no
   push). Pedir `HUB_USER`/`HUB_PASS` ao Jean — eles só existem na EasyPanel — e **buscar alguma
   coisa** em `hub.roilabs.com.br/busca?q=…`. Abrir a aba não prova nada: sem `?q=` nem o Ollama
   nem o claude-cli são chamados. Conferir que o bloco `Resposta` aparece com `[n]` e que a
   numeração casa com os cards. ⚠️ **O rodapé é a ÚLTIMA `.foot` da página** — cada card usa a
   mesma classe, e um grep por texto de aviso casa com o CONTEÚDO de um resultado e produz falso
   diagnóstico. Já quase aconteceu duas vezes.
2. `npm test` (181 verdes) e `npx tsc --noEmit`, antes de qualquer mudança — para saber se o que
   quebrar depois foi você.
3. `node --env-file=.env scripts/avaliar-resposta.mjs --limite 5 --ver` — barato, e **ler as 5
   respostas**. O agregado não pega resposta fluente e errada; a leitura pega.
4. Só então escolher a frente. Se o tempo da sessão for curto, **a frente 2 cabe inteira numa
   sessão e a frente 1 não** — mas não fatie a 1 em "começar a estrutura": converta 10 checks de
   verdade e rode contra os 35 projetos. Estrutura sem execução não produz achado.

## Armadilhas de operação (todas continuam valendo)

- **Reindexar depois de escrever handoff ou memória:** `node --env-file=.env scripts/indexar.mjs`
  (~10 s, de máquina com Ollama, nunca do container). As 126 memórias moram em `~/.claude`,
  **fora do repo** — sem reindexar, elas somem da aba em silêncio. **Este handoff inclusive.**
- **`--motor todos` NÃO inclui o rerank**, de propósito: 78 chamadas por acidente queimariam o
  pool do autopublishing. `--motor rerank` explicitamente.
- **`avaliar-resposta.mjs` gasta 1 chamada por pergunta ALÉM do rerank.** Com cache morno o
  rerank sai de graça. `--limite N` antes de gastar 78 (~20 min).
- **Mudar prompt invalida o cache inteiro** (a chave é o hash do prompt). Reclassificar sem mexer
  no prompt é grátis — foi o que salvou 5 respostas hoje.
- **Erro não é cacheado, então é retentado** na corrida seguinte: os 5 `rerank-output` da
  primeira medição sumiram sozinhos na segunda.
- **Recorte de tamanho fixo tem viés contra doc longo** — 400 chars derrubaram `fonte@10` de
  handoff para 28,3% enquanto protocolo subia. Vale para **qualquer** prompt que compare
  documentos de tamanhos diferentes.
- **Não dar push entre 00:00 e 01:00 BRT** (cron do autopublishing às 00:13).
- **Deploy é Docker no EasyPanel, não Vercel.** `vercel project ls` não prova nada sobre este
  repo.

## Datas firmes que continuam correndo

- **Domingo 02/08, 10:00 BRT** — 1º run do robô de crawl
  ([`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)).
- **~02/08** — reconferir o `errors: 1` do sitemap do `fabrica`.
- **~14/08** — remedir `sirius` (CTR do `agaas`) **e** a série de impressões do `atma`.
  ⚠️ Não baixar o `decay 10` do `atma` antes disso.
- **31/08** — gate do `sirius`: ≥ 5 cliques não-branded/28d (hoje 2).
- **19/10** — gate do `tapepro`: ≥ 300 imp/28d (hoje 21).

## Só o Jean pode fazer

Bing Webmaster Tools no `goiania`, as 4 chaves do Stripe do `compass`, `GOOGLE_CLIENT_ID` do
`reviewshield`, os 2 Request Indexing do `fabrica`, fechar o Ollama exposto sem auth na VPS
(decidido: depois) e — o mais antigo e perigoso — **rotacionar os segredos vazados**
([[secrets_to_rotate]]), com o `HUB_PASS` colado num chat em 31/07 na fila. **Enquanto o
`HUB_PASS` não for passado a cada sessão, nenhuma entrega desta aba fecha com "verificado em
produção"** — e essa distinção é a única coisa que impede este projeto de repetir o erro que ele
mesmo normatizou em `VER-01`.
