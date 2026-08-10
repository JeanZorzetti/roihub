# Phase 0 — Pesquisa e decisões técnicas

**Entrada**: `spec.md` (com as 5 clarificações da sessão de 10/08) e `pesquisa.md` (estado da arte,
inventário do repo e as 6 decisões de produto que ela fecha).

`pesquisa.md` já resolveu o que seria a pesquisa externa desta fase — não há **NEEDS CLARIFICATION**
aberto na Technical Context. O que segue são as decisões de **implementação** que faltavam, tomadas
lendo o código de 10/08.

---

## D1 — Onde a coleta acontece: os dois `spawn`, não os chamadores

**Decisão**: instrumentar `rodarClaude`/`rodarCacheado` (`lib/reranker.mjs`) e `claudeRun`
(`lib/autopublish-clients.ts`). Nenhum chamador ganha código de telemetria.

**Racional**: FR-006 é literal — empregado novo tem que ser observado sem ninguém lembrar de
instrumentá-lo. Os dois caminhos cobrem os 6 empregados: `rodarClaude` serve rerank, resposta, juiz,
defasagem e sonda (a sonda chama `rodarClaude` com um token só no `process.env`); `claudeRun` serve
autopublish-draft e autopublish-ymyl.

**Alternativas consideradas**: (a) um wrapper `comTelemetria(run)` que cada chamador aplica —
rejeitado, é o modo de falha que a FR-006 nomeia; (b) unificar os dois `spawn` primeiro — rejeitado,
a duplicação é deliberada (medição em node puro e aba têm que rodar o mesmo caminho) e unificar está
fora do escopo por decisão da spec.

**Consequência no código**: `spawnClaude` do `reranker.mjs` hoje resolve `payload.result` e descarta
o resto. Ele passa a resolver o **payload inteiro**; `rodarClaude` extrai `result` e devolve string,
então **nenhum dos 4 consumidores muda de contrato**.

---

## D2 — Identidade da conta: hash do token, calculado onde o token é conhecido

**Decisão**: `sha256(token).slice(0, 8)`, computado dentro do laço que percorre o pool — em
`rodarClaude` e em `claudeRun` —, nunca no chamador e nunca persistido junto do segredo.

**Racional**: fechado pela clarificação da spec. Reordenar `CLAUDE_CODE_OAUTH_TOKENS` não pode
misturar históricos; trocar o token de uma conta **deve** criar identidade nova, porque credencial
nova é conta nova para efeito de rate limit.

**Dois sentinelas, e eles são obrigatórios**:
- `cli-ambiente` — `rodarClaude` sem pool configurado cai na autenticação ambiente do CLI de propósito
  (é o que permite medir na máquina do dev). Não há token do qual derivar identidade, e atribuir a
  chamada a uma conta arbitrária seria pior que não atribuir.
- `cache` — acerto de `.cache/rerank.json`: não houve conta porque não houve chamada.

**Alternativa rejeitada**: colunas booleanas separadas (`cache`, `sem_conta`) em vez de sentinelas na
mesma coluna. Rejeitada por ser mais schema para a mesma informação; o custo é que toda agregação de
consumo do pool filtra `conta NOT IN ('cache','cli-ambiente')`, o que fica escrito no contrato e tem
teste.

---

## D3 — O código de erro é reescrito com o prefixo do empregado no momento do registro

**Decisão**: `desfecho` = `ok` ou código estável `<prefixo-do-empregado>-<classe>`. A troca de prefixo
é feita por uma função pura (`codigo(empregado, erro)`) na hora de gravar.

**Racional**: FR-003 pede prefixo do empregado + sufixo da classe, mas `rodarClaude` é compartilhado e
seus erros nascem com `rerank-*` — é por isso que `resposta.mjs` e `juiz.mjs` **já fazem exatamente
essa troca de prefixo** hoje, para o rodapé não dizer "rerank-timeout" numa corrida do juiz. A
telemetria copia o padrão que já existe em vez de renomear na origem, o que quebraria contrato e
testes de 4 consumidores.

Os dois empregados do autopublishing compartilham o prefixo `llm-*` (o código nasce em
`claudeError`), e é a coluna `empregado` que os separa — `autopublish-draft` e `autopublish-ymyl`. O
sufixo é que carrega a classe, e ele já é o conjunto validado pelo regex de `run-autopublish.mjs`:
`-auth`, `-rate`, `-cli`, `-output`, `-parse`, `-timeout`, `-conta`.

**Alternativa rejeitada**: gravar a mensagem e classificar depois. Rejeitada por FR-004 — o corpo do
erro pode conter o prompt inteiro.

---

## D4 — Tentativa é a linha; pedido lógico é o `pedido`

**Decisão**: uma linha por **tentativa** contra uma conta, todas carregando o mesmo `pedido`
(`crypto.randomUUID()` gerado no início de `rodarClaude`/`claudeRun`).

**Racional**: FR-005 quer os dois números deriváveis da mesma série — `count(*)` são tentativas,
`count(distinct pedido)` são pedidos lógicos. Contar só tentativa infla o volume; contar só o sucesso
esconde a saturação, que foi exatamente o que aconteceu em 31/07.

---

## D5 — `ambiente` é campo, e o discriminador é `NODE_ENV` com override

**Decisão**: `ambiente = process.env.HUB_AMBIENTE ?? (process.env.NODE_ENV === "production" ? "prod" : "dev")`.

**Racional**: o container do Next roda com `NODE_ENV=production`; os scripts locais rodam com
`node --env-file=.env`, sem `NODE_ENV`. O discriminador certo já existe e custa uma linha. O override
existe para o caso de alguém rodar `npm run start` local e não querer marcar `prod`.

**Consequência declarada na spec**: `dev` fica **fora de toda agregação por default**, exceto a de
consumo do pool — o pool é o mesmo, e sem as corridas de régua (85 chamadas o portão, 3 por pergunta
o juiz) "quanto do pool foi gasto" não fecha. É a latência e a taxa de erro que não se misturam.

---

## D6 — Corrida incompleta se marca com uma linha sentinela, não com uma tabela

**Decisão**: nenhuma tabela `ia_corridas`. A coluna `corrida` (vinda de `HUB_CORRIDA`, nula fora de
medição) agrupa; uma corrida abortada por 3 falhas de conta seguidas grava **uma linha final** com
`desfecho = '<empregado>-corrida-incompleta'`. Agregação por corrida exclui toda corrida que tenha
essa linha.

**Racional**: FR-017 exige que a série saiba que a corrida está incompleta; a marca já existe hoje no
JSON de cada corrida (`incompleto: true`), e o que faltava era ela chegar à série. Uma linha resolve;
uma quarta tabela para 2 colunas não paga.

**Precedente**: `avaliar.mjs` foi o último a ganhar o aborto (02/08) e o buraco custou duas noites de
pool, com agregados publicados em cima de corridas majoritariamente caídas. Aviso perde para
percentual — então aqui a marca **remove o agregado**, não o acompanha.

---

## D7 — Lacuna de telemetria: a sonda é a batida do coração

**Decisão**: uma janela é *lacuna* quando a **última sondagem conhecida** está ausente ou tem mais de
**36 h**. Janela com sonda recente e nenhuma outra linha é *zero chamadas* de verdade.

**A folga de 36 h não é arredondamento.** A primeira redação desta decisão dizia "a janela de 24 h não
tem linha de sonda", e isso fabricaria card: **o Actions atrasa o agendamento em ~97 min** — fato
medido e já documentado no `CLAUDE.md` (`37 2 * * *` disparou 04:15 e `13 3 * * *` disparou 04:49) —,
então uma noite atrasada põe a sonda fora da janela e o sistema saudável se declara cego. O relógio é
`max(inicio) WHERE empregado = 'sonda'`, não uma contagem dentro do recorte. 36 h = 24 h + duas vezes
o atraso observado.

**Racional**: `pesquisa.md` §3.3 inverte o sinal do `nao_apurado` — se a escrita falhar em silêncio, a
janela aparece como **zero falhas**, o melhor placar possível produzido pelo pior estado possível.
Distinguir "não houve chamada" de "não houve registro" exige um evento que **sempre** acontece, e o
observador que já gasta 1 chamada por conta por noite é exatamente isso (§3.5: o observador consome o
observado — aqui isso vira uma propriedade útil, não só um custo).

**Consequência**: a aba tem três estados por empregado (FR-016) — *não acionado*, *acionado sem
falhas*, *sem telemetria* —, pelo mesmo motivo pelo qual o placar de conformidade imprime `n/a`
separado de aprovado.

---

## D8 — Retenção e resumo penduram no caminho noturno que já existe

**Decisão**: no `POST /api/estado`, depois dos coletores: (1) consolidar o **dia anterior** em
`ia_resumo` (upsert idempotente, PK `(dia, ambiente, empregado)`), (2) `DELETE FROM ia_chamadas WHERE
inicio < now() - interval '90 days'`.

**Racional**: nenhum cron novo e nenhum segredo novo — quem já sonda o pool e grava card não ganha
capacidade nova consolidando a própria série. É o critério que criou o `CRM_INGEST_SECRET` aplicado ao
contrário. Consolidar **d-1**, e não o dia corrente, dá idempotência de graça: rodar duas vezes no
mesmo dia produz o mesmo resumo, como `run_date` é PK de `hub_estado`.

FR-023 (o resumo é conferível antes de o detalhe expirar) sai de graça: os dois coexistem por 90 dias,
e o teste recomputa o resumo a partir do detalhe da mesma janela.

**Janela de 90 dias**: a mesma do GSC Crawl Stats, para as leituras da casa se compararem entre si.

---

## D9 — Escrita best-effort: erro engolido, mas nunca invisível

**Decisão**: `registrar()` nunca lança — todo o corpo dentro de `try/catch` que descarta. A visibilidade
da falha vem de D7 (ausência das linhas da sonda), não de um log que ninguém lê.

**Racional**: FR-007 tem duas metades, e a segunda é a que a spec 001 não tinha. Um `catch` silencioso
sozinho satisfaz "a chamada não falha" e **viola** "a lacuna aparece como lacuna". A batida de coração
da sonda é o que fecha a segunda metade sem acoplar a corretude a logging.

**Caso real coberto**: script local sem `DATABASE_URL` — a corrida inteira de régua não deixa rastro, e
a aba mostra aquele dia como lacuna, não como "o pool não foi usado".

---

## O que esta fase NÃO decide, de propósito

- **Nenhum limiar numérico.** Latência, volume e taxa não geram card nesta feature (FR-018). Limiar
  sobre linha de base não calibrada fabrica card, e card ruidoso mata o mecanismo de card que hoje
  funciona.
- **Nenhuma meta sobre o valor dos números da primeira janela.** A primeira corrida de um check novo
  mede o check — regra confirmada quatro vezes nesta base (`pesquisa.md` §3.6).
- **Ollama fica fora.** A indexação só roda na máquina do dev (`OLLAMA_URL` é `127.0.0.1:11434`); entra
  se e quando rodar em produção.
- **Custo em dólar continua secundário.** A unidade de orçamento é chamada × conta × janela de rate
  limit (`pesquisa.md` §3.1). `estimated_cost_usd` continua em `seo_publications` e não é o que esta
  feature otimiza.

## D10 — Domínio novo fica fora do diff na estreia

**Decisão**: `diffEstado` ganha uma guarda — célula cujo domínio não existe por inteiro no estado
anterior não entra no diff. Grava e cala, como a primeira corrida.

**Racional**: `primeiraCorrida` cobre a primeira corrida do **aparato**, e `hub_estado` já está
povoado. Sem a guarda, o coletor `IA` estrearia publicando a própria linha de base como achado — que
é literalmente o que a FR-019 proíbe e o defeito que esta feature inteira existe para não cometer. A
regra já é da casa ("40 novidades seriam a linha de base disfarçada de achado"); o que faltava era
aplicá-la por coletor, e não só por corrida.

**Custo**: ~2 linhas no predicado `conta`.

---

## Risco conhecido de migração (day one)

Re-chavear o domínio `POOL` do estado noturno de índice posicional (`POOL:1:rate-limit`) para hash
(`POOL:a1b2c3d4:rate-limit`) faz **toda** célula de pool sumir e reaparecer na primeira corrida depois
do deploy: um card com 3 "novos" e 3 "resolvidos" que não é achado nenhum.

**A guarda do D10 não alcança isso** — o domínio `POOL` já existe, e a guarda só cobre domínio
inédito. A alternativa seria reescrever as chaves antigas usando a ordem atual de
`CLAUDE_CODE_OAUTH_TOKENS`, o que faria a migração depender exatamente da premissa que a FR-002a
manda não confiar: que a ordem da lista não mudou desde a última corrida. Entre um card de ruído numa
noite e uma migração que pode trocar o histórico de duas contas em silêncio, fica o card.

Ruído de **uma noite só**, conhecido de antemão. A tarefa de implementação (T030) nomeia esse card
esperado no corpo do commit.
