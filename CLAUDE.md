# roihub

Hub que rankeia os projetos do portfólio e diz o foco do dia. Next.js 16 (App Router) +
TypeScript, Node 22. No ar em `hub.roilabs.com.br`.

## As 5 coisas que toda sessão redescobre

1. **`listProjects()` é o contrato.** Nenhuma página importa `data/projects.json` direto —
   tudo passa por `lib/projects.ts`, que mescla a curadoria manual do JSON com os repos
   vindos da API do GitHub. Importar o JSON direto quebra a aba: ela perde os repos.
2. **Teste é `node --test`, sem framework.** Nada de jest/vitest — não estão instalados e
   não devem ser. Arquivos `test/*.test.mjs`, `assert/strict`. `npm test` roda a lista
   explícita do `package.json`; **arquivo de teste novo tem que ser adicionado lá à mão**,
   senão nunca roda. Suite inteira: ~1,6 s. **Desde 03/08 há check que pega o esquecimento**
   (`test/validade.test.mjs`), e ele mora num arquivo já registrado de propósito: teste que
   não roda não reprova nada. Compara nos dois sentidos — sobrar na lista é arquivo renomeado,
   e aí o run inteiro morre em `ENOENT` sem dizer qual foi.
3. **Deploy é Docker no EasyPanel**, `output: "standalone"` — **não é Vercel**.
   `vercel project ls` não prova nada sobre este repo. Push em `main` → build da imagem.
4. **Não dar push entre 23:30 e 01:00 BRT.** São DOIS crons na janela: o **estado noturno**
   às 23:37 BRT (`37 2 * * *` UTC, até ~10 min) e o **autopublishing** às 00:13 BRT
   (`13 3 * * *` UTC). Um deploy no meio derruba a publicação de 10 projetos ou a corrida do
   estado. A ordem é deliberada — ver "Estado noturno" abaixo.
5. **`.mjs` vs `.ts` é deliberado.** A lógica pura testável mora em `.mjs`
   (`lib/score.mjs`, `lib/projects.mjs`, `lib/crawl.mjs`…) para ser importada tanto pelo
   Next quanto pelo `node --test` sem transpilar. Só o que toca o Next/DB é `.ts`.

## Autopublishing (o que roda todo dia)

Cadeia: GitHub Actions (`scripts/run-autopublish.mjs`) → `POST HUB_URL/api/seo/autopublish`
→ `lib/autopublish-clients.ts` → `spawn("claude", ["-p", "--output-format", "json", …])`.

- **Motor = claude-cli**, instalado global na imagem (`Dockerfile:19`). Não há API paga
  neste projeto: o único LLM é a assinatura Claude via `claude setup-token`.
- **`CLAUDE_CODE_OAUTH_TOKENS` é plural** — pool de contas separadas por vírgula. O gargalo
  é rate limit de assinatura, não crédito; conta esgotada é pulada e a próxima tenta.
  Só o token da vez chega ao processo filho (`autopublish-clients.ts:184`).
- **`enabled` mora no banco**, não em arquivo. Ligar/desligar projeto é UPDATE.
- **A UI é a aba `/automacao`, não a `/seo`** (11/08). Sala de controle (kill switch global +
  pausa por projeto), histórico de publicação e um bloco só-leitura do estado noturno. As duas
  automações agendadas da casa ficavam em abas que não são sobre automação — a editorial dentro
  do SEO e o estado só no card da agenda. `app/automacao/action-fields.mjs` e `publications.tsx`
  são lidos por caminho literal em `test/autopublish.test.mjs`: mover de novo exige mexer lá.
- **A fila gira 1 passo por dia** (`projectQueue`) para o rate limit não cair sempre no
  mesmo projeto.
- **claude-cli não tem `json_schema` strict**: o JSON vem no meio do texto e
  `parseJsonBlock` tenta fence primeiro, depois cada `{` como candidato. Não trocar por
  "recorta do primeiro `{` ao último `}`" — o modelo escreve prosa com chaves.
- Erros são **códigos estáveis**, nunca a mensagem do modelo (o corpo pode conter o prompt
  inteiro): `llm-auth`, `llm-rate`, `llm-cli`, `llm-output`, `llm-parse`, `llm-timeout`.
  Regex de status em `run-autopublish.mjs:40` valida o conjunto — reason nova precisa
  entrar lá, senão vira `invalid-response`.

## 🚩 O hub fica INTERMITENTEMENTE INACESSÍVEL na janela da madrugada

Vale para os DOIS crons, e é anterior ao estado noturno. O autopublish falhou em **02/08 e 03/08**
com `request-failed` — que é o `catch` do `fetch` em `requestPhase`, não erro de LLM — e a 1ª
corrida do estado morreu em `curl: (28) Failed to connect to hub.roilabs.com.br port 443` às
**04:15 UTC**, com o autopublish conectando normalmente às **04:49 UTC**. A janela de queda é
curta; **reter resolve, e `estado-noturno.yml` já retenta** (5×, 120 s, só em falha de conexão).

- **`request-failed` no autopublish NÃO é o modelo falhando** — é o hub fora do ar. Ler como
  problema de LLM manda caçar bug no lugar errado. **`seo-autopublish.yml` ainda não tem retry.**
- **O Actions atrasa o agendamento em ~1h40.** `37 2 * * *` UTC disparou 04:15 e `13 3 * * *`
  disparou 04:49 — os dois com ~97 min de atraso. A ORDEM entre eles sobreviveu (é o que
  importa: a sonda tem que ler o pool antes do autopublish drenar), mas **não conte com a hora
  cheia**: o cron do Actions é o horário mais cedo possível, nunca o exato.

## Estado noturno (`lib/estado-noturno.mjs`) — o aparato que agora roda sozinho

`POST /api/estado` (Bearer `CRON_SECRET`), disparado por `.github/workflows/estado-noturno.yml`
às **23:37 BRT**. O Actions só dispara; o trabalho é server-side porque o `probe-pool` precisa do
claude-cli e do `CLAUDE_CODE_OAUTH_TOKENS`, e nenhum dos dois existe no runner do GitHub.

- **Quatro coletores, três de graça.** `CONF` (conformidade, ~140 req), `GTW`
  (`gateways-servido`, ~250 req), `REPO` (`gateways-repo`, 35 árvores do GitHub) são zero LLM;
  `POOL` (`sondar`) gasta **1 chamada por conta**. `validade.mjs` fica FORA de propósito: já roda
  no `npm test`, e card noturno sobre o que o CI já reprovou é ruído.
- **A entrega é o DIFF, nunca placar** — cada coletor devolve mapa `DOMINIO:slug:id → rótulo`, e
  só célula que APARECEU ou SUMIU vira card. "41 violações" saiu igual antes e depois do conserto
  do `GEO-01`: o agregado não se mexeu e só a LINHA mudou. Noite sem mudança é silenciosa.
- **🚩 FALHA FECHADA POR COLETOR, e é a corretude inteira desta frente.** Coletor que estoura
  devolve zero chave, e sem `dominiosOk` o diff leria a ausência como conserto: **"35 violações
  resolvidas" no dia em que o `GITHUB_TOKEN` expirar**. É a regra do `nao_apurado` — fonte que não
  respondeu SAI da corrida em vez de cair para um valor que dá notícia boa. `mesclarEstado`
  carrega os valores de ontem do domínio que falhou, senão amanhã as mesmas chaves voltam como
  achado novo. **Pool vazio ESTOURA** pelo mesmo motivo: env var ausente é "não olhei", não
  "nenhuma conta com problema". Coletor fora vira card mesmo sem diff.
- **A 1ª corrida NÃO gera card.** Sem anterior não há diff, e 40 "novidades" seriam a linha de
  base disfarçada de achado. Grava o mapa e cala; o diff começa no dia seguinte.
- **A ORDEM contra o autopublishing é deliberada:** 23:37 mede o pool **em repouso**. Depois das
  00:13 a sondagem mediria o pool drenado e chamaria de morta (403) a conta que só está em 429 —
  e é justamente essa distinção que a sonda existe para fazer.
- **`run_date` é PK de `hub_estado`**: o Actions pode repetir o dia, e sobrescrever é o certo
  porque `estadoAnterior` compara sempre com o DIA ANTERIOR, nunca com a linha que a própria
  corrida acabou de gravar. Rodar duas vezes no mesmo dia dá o mesmo diff.
- **Reusa `CRON_SECRET`** (isenção no `middleware.ts`, ao lado do autopublish): quem já publica
  artigo em 10 repos não ganha capacidade nova gravando card de agenda. Segredo próprio é para
  capacidade MAIOR — é o caso do `CRM_INGEST_SECRET`.

## Observabilidade de IA (`lib/telemetria.mjs`/`lib/telemetria-db.mjs`) — aba `/ia`

specs/002-observabilidade-ia (10/08). O incidente de 31/07 (token[0] estourado, busca inteira
degradada e ninguém viu por dias) só existia porque `usage`/`duration_ms`/`num_turns` do
claude-cli eram lidos e jogados fora. A entrega não foi construir coleta — foi parar de
descartar. `lib/telemetria.mjs` (puro) + `lib/telemetria-db.mjs` (`pg`, dono de `ia_chamadas`/
`ia_resumo`/`ia_pool`) copiam o par `corpus.mjs`/`corpus-db.mjs`.

- **Dois pontos de instrumentação, nunca os chamadores.** `rodarClaude`/`rodarCacheado` em
  `lib/reranker.mjs` servem rerank, resposta, juiz, defasagem e sonda; `claudeRun` em
  `lib/autopublish-clients.ts` serve os dois empregados do autopublishing. Empregado novo que
  esquece de se declarar aparece como `nao-declarado` — visível, nunca invisível (FR-006).
- **Dois sentinelas na coluna `conta`, e não são "faltando".** `cli-ambiente` é chamada sem pool
  configurado (autenticação ambiente do CLI — mede na máquina do dev); `cache` é acerto de
  `.cache/rerank.json` (não houve conta porque não houve chamada). Consumo do pool filtra
  `conta NOT IN ('cache','cli-ambiente')`.
- **🚩 Lacuna ≠ zero falhas, e a folga é 36h, não 24h.** A sonda é a batida do coração
  (`empregado = 'sonda'`, `ultimaSonda()` = `max(inicio)`). Escrita que falha em silêncio faria a
  janela aparecer como "zero falhas" — o melhor placar possível produzido pelo pior estado
  possível. 36h = 24h + duas vezes o atraso medido do Actions (~97min, ver seção acima): janela
  rígida de 24h põe a sonda para fora sozinha e declara cego um sistema saudável. Mesma constante
  em `estadoDoEmpregado`/`celulasIA` (`lib/telemetria.mjs`) e no coletor `IA` do estado noturno.
- **A guarda de domínio novo no diff é POR COLETOR, não só por corrida.** `hub_estado` já estava
  povoado quando o domínio `IA` nasceu: sem a guarda, a estreia publicaria a própria linha de base
  como achado — o mesmo defeito que `primeiraCorrida` existe para barrar, um nível abaixo.
  `diffEstado` (`lib/estado-noturno.mjs`) ganhou `conhecidos = new Set(Object.keys(antes).map(dominioDe))`;
  não vale quando `antes` está vazio (1ª corrida do APARATO inteiro — aí quem segura é
  `primeiraCorrida`, como sempre foi). **Não vale para `POOL`**: aquele domínio já existe, e a
  troca de índice posicional para hash da conta (FR-002a) produziu 3 "novos" + 3 "resolvidos" no
  primeiro deploy — ruído de uma noite só, nomeado no commit, não achado.
- **Retenção 90 dias + resumo permanente.** `POST /api/estado` roda `consolidar(ontem)` e
  `expirar(90)` DEPOIS do diff/card, nessa ordem — inverter perderia o último dia. `ia_resumo`
  sobrevive à expiração do detalhe (PK `dia, ambiente, empregado`, upsert idempotente); é ele que
  responde "quanto consumiu em maio" quando maio já não tem `ia_chamadas`. `ia_pool` NUNCA expira
  — é quem responde "morta desde quando" além dos 90 dias.
- **`empregado = 'sonda'` por dia ≤ número de contas do pool** (SC-008) — a observabilidade não
  pode virar consumidora do pool que ela mede. `scripts/telemetria-sanidade.mjs` confere isso e
  SC-007 (nenhuma coluna guarda texto livre) contra produção, fora do `npm test`.
- **`HUB_CORRIDA`** agrupa `scripts/avaliar.mjs`/`avaliar-resposta.mjs`/`corpus-defasado.mjs`;
  corrida abortada por `MAX_CONTA_SEGUIDAS` grava uma linha sentinela
  (`desfecho = '<empregado>-corrida-incompleta'`) e some de todo agregado — sem tabela nova.
  `scripts/orcamento.mjs --chamadas N` lê contas vivas × consumo já feito × previsto ANTES de
  gastar o pool, sem adjetivo ("arriscada" sem regra é veredito que ninguém confere depois).

## Busca (`/busca`) — o SEGUNDO consumidor do claude-cli

`BM25 → + vetor (Ollama) → + reranker (claude-cli) → síntese (claude-cli)`, medido em
`data/dourado.json` (85 perguntas desde 01/08). **Medição corrente (03/08 manhã, 349 docs, 85
perguntas, ZERO LLM): BM25 81,1% · híbrido 79,3% em @10.** Os 82,3% → 82,4% → 88,0% que este
arquivo citava foram medidos com **78** perguntas e 263 docs e **não se comparam** (denominador
novo não se compara com número velho; piso relativo sempre).

- **🚩 O RERANKER ESTÁ SEM GANHO MEDIDO, e a causa é do lado do BM25.** Os 81,1% dele são de
  03/08 de madrugada, contra um híbrido de 77,1% que **não existe mais**: a lista de vazios em
  `tokenizar` (abaixo) levou o BM25 sozinho de 77,7% a **81,1%** — o mesmo número que o reranker
  alcançava gastando 1 chamada de claude-cli por busca. O `+4,0 sobre o híbrido` não se cita mais.
  Remedir custa 85 chamadas contra **1 conta viva de 3**, então o rodapé da `/busca` marca o número
  do rerank como defasado DENTRO do texto — aviso ao lado perde para percentual.
- **🚩 O `--min bm25` REPROVOU o híbrido nesta medição: 79,3% contra 81,1% em @10.** O vetor estava
  em parte compensando o defeito do BM25, e com ele consertado a fusão DILUI em @10. **Não desligue
  o vetor por isso**: ele ganha em @20 (85,1% contra 83,5%) e @50 (**88,3% contra 87,8%**), e é o
  top-50 da fusão que alimenta o reranker. A camada `estado` em @20 é 56,1% contra 48,3%. Decidir
  a fusão exige a corrida do rerank, que é justamente a que o pool não paga hoje.

- **🚩 A GRAMÁTICA DA PERGUNTA era o termo mais raro da consulta, e por isso um detector de
  handoff** (`VAZIOS` em `lib/bm25.mjs`, 03/08). O BM25 estava **certo** — premia quem tem as
  palavras raras da consulta —, só que as palavras raras eram o registro conversacional, não o
  assunto: `posso` aparece em 9 das 85 perguntas com **idf 5,5** e existe em UM handoff e em ZERO
  protocolo, então sozinho dava a um doc arbitrário um pico que nenhum termo de conteúdo alcança.
  `quantos` (7 perguntas, idf 2,7) está em **29% dos handoffs e 0% dos protocolos**; `onde` em 70%
  contra 8%; `ele` em **91% contra 9%**. Era isso que segurava a camada `estado` (perguntas em
  língua natural) em **0,0% em @1** enquanto `protocolo` (perguntas em jargão) fazia 89,5% em @10.
  Tirar os vazios: **77,7% → 81,1%** no geral, **`estado` 30,6% → 46,1%** em @10 e 0,0% → 11,1% em
  @1, e os **8 zeros em @10 viraram 2**. Zero LLM, zero rede, ~1 linha.
  - **Filtra na `tokenizar`, que indexa E consulta.** Tirar só do lado da consulta deixaria o
    `d.len` (denominador do BM25) inflado pelos mesmos vazios, que é metade do defeito.
  - **`nao` fica FORA da lista de propósito** — a casa escreve norma como negação, e o idf dele é
    0,1: não paga o risco. `diz`, `novo` e `proprio` também ficam fora: verbo e adjetivo carregam
    assunto. **Palavra nova só entra medida contra o dourado**, como as âncoras do detector.
- **🚩 As duas perguntas que sobraram em 0,0% NÃO são a mesma classe, e "descasamento de
  vocabulário" só vale para uma** (03/08 tarde). A coluna que decide é o **`df`**, não o idf —
  `scripts/diagnosticar-pergunta.mjs <id> | --zeradas`, zero LLM, ~1 s, imprime idf **e df** de cada
  token, o que o alvo casa e o top-10 com atribuição. **`D-73` é SATURAÇÃO**: o alvo casa 4 de 6
  tokens e mesmo assim fica fora do top-10, porque esses quatro estão em **20–38% do corpus**
  (`test` 28%, `mjs` 37%, `novo` 38%) — a casa inteira escreve "npm test verde" e "rodei à mão". O
  único token que discrimina (7% do corpus) não existe em nenhum dos dois alvos, e no 1º colocado
  ele aparece dentro de "secret de CI". **Lista de sinônimo não move isto** — o alvo já casa os
  tokens. **`D-85` é o oposto: `SEO-05` casa ZERO tokens**, score 0, nenhum reranqueador ou ajuste
  de `k1`/`b` alcança. E o dourado ali pede doc que responde **metade**: os números por propriedade
  não estão em documento nenhum — são apurados por `d85()` lendo `docs/Crawl-stats`, e **`docs/` não
  entra em `carregarCorpus()`**. Decidir `D-85` é decisão de GABARITO, não de motor.
- **🚩 O handoff que DIAGNOSTICA uma pergunta do dourado vira resultado dela.** O handoff de 03/08
  manhã citou a pergunta de `D-85` literalmente e com isso injetou no corpus o token mais raro dela
  (5 dos 350 docs); reindexado, ele saiu em **2º lugar na medição do próprio defeito que descreve**.
  Medido nas 85 com n-grama literal de 5 tokens: 7 perguntas citadas, 3 em top-10 sem serem fonte —
  **mas ler as 3 derruba para 1**: as outras duas casam MENSAGEM DE ERRO (o mesmo stack trace na
  pergunta e no doc), que é recuperação legítima. **A primeira corrida do n-grama mediu o n-grama**,
  e ele erra dos dois lados — também perde `D-85`, cuja citação tem 4 tokens. **Movimento no recall:
  ZERO por enquanto** (o intruso de `D-66` está em 4º e não expulsou fonte); o custo é um slot
  queimado, e vira número quando uma fonte estiver em 10ª. **Ao escrever sobre uma pergunta do
  dourado, nomeie pelo id e não reproduza os termos raros dela.** Handoff datado não se reescreve —
  o slot já queimado fica.
- **São DUAS chamadas por busca** (rerank + resposta), do mesmo pool do autopublishing.
  `?rerank=0` e `?resposta=0` desligam cada uma (link no rodapé desliga as duas).
- **Quem chama o claude-cli percorre o pool inteiro, nunca só `tokens[0]`.** Em 31/07 a busca
  ficou morta em produção porque `rodarClaude` parava na primeira conta e ela tinha estourado o
  limite mensal — reportado como `rerank-output`/`resposta-output`, o código de "o modelo
  escreveu bobagem". **Só `api_error_status` (429/401/403) separa "a conta acabou" de "a resposta
  é ruim"**: "You've hit your monthly spend limit" e "organization has disabled Claude
  subscription access" não têm uma palavra de rate limit nem de auth.
- **A síntese é um segundo prompt, depois da fusão, de propósito.** Um prompt só que
  ordenasse e respondesse obrigaria a remedir os 88,0% a cada ajuste de redação. Separado, o
  recall e a resposta têm réguas independentes: `scripts/avaliar.mjs` e
  `scripts/avaliar-resposta.mjs`.
- **Falha FECHADA na citação:** resposta sem `[n]` válido não é renderizada, vira
  `resposta-sem-citacao` no rodapé. Prosa fluente sem procedência é o pior resultado deste
  componente — tem a autoridade da resposta e nenhuma da fonte. Recusa (`NÃO ESTÁ NO
  CORPUS`) não é erro e não vira aviso.
- **`avaliar-resposta.mjs` mede ancoragem, NÃO verdade.** Citar a fonte certa e resumi-la
  errado passa nela com 100%. Quem mede isso é o juiz (abaixo) — e nem ele mede verdade.
- **O ranking do reranker é para FUNDIR, não para obedecer.** Obedecer foi medido com dois
  prompts diferentes e perdeu as duas vezes (@10 76,7% contra 82,4% da fusão): o modelo
  acerta o conjunto e erra a ordem, porque não vê o score do BM25. `rrf(…, c=10)` — o mesmo
  `c` da fusão BM25+vetor — ganha em todos os k.
- **Piso é relativo, nunca absoluto:** `node --env-file=.env scripts/avaliar.mjs --motor
  rerank --min bm25`. O número absoluto não reproduz entre sessões porque handoff e memória
  são reescritos, o que mexe em vetor e IDF (83,0% → 82,4% sem mudança de código).
- **`--motor todos` NÃO inclui o rerank** de propósito: 78 chamadas por acidente queimariam
  o pool. O `.cache/rerank.json` faz corrida morta retomar de onde parou — uma foi morta no
  meio e o pool virou pó.
- **Corrida que perde o pool PARA.** Pool inteiro esgotado tem código próprio (`rerank-conta` →
  `resposta-conta` / `juiz-conta`); 3 falhas de conta seguidas abortam a corrida, gravam o
  parcial com `incompleto: true` e **não imprimem agregado nenhum** — nem com aviso ao lado. O
  relatório de 31/07 trazia o aviso das 15 suprimidas e ainda assim publicou 19,2% de recusa
  fantasma: aviso perde para percentual. **`avaliar.mjs` foi o ÚLTIMO a ganhar isso (02/08), e o
  buraco custou duas noites de pool**: ele colecionava as falhas e imprimia o aviso AO LADO do
  percentual, então o portão do rerank saiu `77,7%` com 42/85 caídas na fusão e depois `77,4%` com
  59/85 — média de reranqueado com híbrido puro, e a segunda ainda REPROVOU o reranker no `--min`
  por um resultado que em sua maioria não era dele. **Uma corrida do portão custa 85 chamadas
  contra 3 contas que o autopublishing divide: o teto é o POOL, não o prompt** — e o
  `.cache/rerank.json` só retoma o que deu certo, então falha não fica barata na próxima. **O
  portão fechou em 03/08 (81,1%), e a prova de que o número vale é a linha que NÃO saiu**: o aviso
  de `avaliar.mjs:147` sai sempre que há falha, então ausência dele = 85 de 85 reranqueadas.
- **🚩 SONDE O POOL com 1 chamada por conta ANTES de gastar as 85 do portão** —
  `node --env-file=.env scripts/probe-pool.mjs [--gravar]`, ~40 s. E não leia o pool como bloco: em
  02/08 22:12, 03/08 07:46 e 03/08 07:59 o quadro foi idêntico — **conta 1 viva, conta 2 em 429,
  conta 3 em 403**. **429 é rate limit e recarrega esperando; 403 é `subscription access disabled` e
  NÃO** — "as 3 esgotadas" escondia que uma pode estar morta de vez, e com isso "somar conta ao
  pool" vira reposição em vez de expansão. `classificarConta` separa os dois porque `trocaDeConta`
  não pode: ela responde "troco de conta?" e diz `true` para os três status, que é o certo para a
  busca e cego para quem decide comprar conta.
  - **⏳ O 403 da conta 3 continua NÃO DATADO, e a 3ª leitura não mudou isso**: ela saiu 13 min
    depois da 2ª. Três leituras cobrem ~10 h (com um ciclo de autopublishing no meio) e ~10 h não
    separam "morta de vez" de "morta desde ontem à noite". Quem data é o **histórico**
    (`data/pool-sondagens.json`, gravado por `--gravar`) chegando a uma janela longa — não mais uma
    leitura colada na anterior. Sondagem que repete a anterior confirma o estado e não compra
    janela.
- **Corrida pode morrer por TEARDOWN, sem o `🚨` e sem exit code** (aconteceu em 02/08 22:22, dentro
  do rerank). Isso NÃO é o aborto falhando: o aborto exige 3 falhas de CONTA seguidas, e ali havia
  conta respondendo. Quem salva é o `.cache/rerank.json` — a retomada fechou em 107 s.
- **O corpus tem QUATRO origens desde 02/08** — protocolos, handoffs, memórias e **os 35 cards de
  `data/projects.json`** (`tipo: "projeto"`, `id` = slug, 345 docs). Sem os cards, "quais os
  blockers do goiania" devolvia handoff que FALA do goiania e nunca o card que TEM os blockers.
  **Nota 0-10 (`receita`, `blockers`, `decay`, `seoSeed`) não entra no texto**: quem pergunta por
  número quer o score da home. **O rótulo é `blockers:` no plural** porque o BM25 casa token
  literal e não deriva plural — com `blocker:` o card saía em 17º na própria pergunta que motivou
  a mudança, com o plural em 2º.
- **🚩 O dourado NÃO PODE premiar os cards: nenhuma das 85 perguntas tem slug em `fontes`.** Então
  o agregado só sabe cobrar o custo do denominador maior e nunca creditar o ganho — medido na
  MESMA corrida, sem LLM: BM25 78,1% → 77,7% e híbrido 77,4% → 77,1% em @10. **A leitura é o diff
  nominal**: 2 das 85 perderam uma fonte, as duas saindo da posição 10 para 11ª/13ª, e em uma
  delas (`D-73`) **não há card nenhum no top-10** — é deriva de IDF do corpus maior, não card
  expulsando handoff. Pergunta de projeto no dourado exige, no mesmo commit, o teste que amarra
  slug a `projects.json`.
- **Reindexar depois de escrever handoff/memória**: `node --env-file=.env scripts/indexar.mjs`.
  Memória mora em `~/.claude`, fora do repo — sem reindexar ela some da aba em silêncio.
- **Reindexar só roda NESTA máquina, e por isso não dá para pendurar no cron do autopublishing**
  (a ideia do handoff de 01/08, conferida em 02/08 e descartada): o cron roda em GitHub Actions, que não tem
  `~/.claude` (e `indexar.mjs` aborta sem memórias, de propósito) nem o Ollama — `OLLAMA_URL` é
  `127.0.0.1:11434`. **O card é a exceção que não precisa disso**: `data/projects.json` está na
  imagem (`Dockerfile` copia `data/`, e o tracing do `/busca` agora inclui o arquivo), e a aba une
  disco + banco, então card editado chega fresco no BM25 a cada deploy — só o vetor dele fica
  velho até alguém reindexar.

## Juiz da síntese (`lib/juiz.mjs`) — a régua de CORRETUDE

`node --env-file=.env scripts/avaliar-resposta.mjs --juiz` (3 chamadas por pergunta, contra 1 sem
juiz — por isso fora do default). Calibração: `scripts/juiz-calibrar.mjs`.

- **Mede consistência com o dourado, NÃO verdade sobre o mundo — em 70 das 85.** O dourado de
  `protocolo` e `episodio` foi escrito por um agente lendo o mesmo corpus: se o corpus mente, o
  dourado repete e o juiz aprova. **As 15 de `estado` são a exceção desde 01/08**: o gabarito delas
  é apurado na hora da medição (`apurarEstado()`), então ali o juiz compara a resposta com a fonte
  viva. A fronteira sai impressa no relatório de propósito — régua que não declara o próprio limite
  vira meta em cima de um defeito.
- **`nao_apurado` TIRA a pergunta da corrida, nunca cai de volta para a prosa.** Cair para o texto
  escrito seria pior que não medir: o número sairia com cara de completo medindo exatamente a coisa
  que esta frente existe para não medir. O relatório imprime quantas entraram e quantas saíram, e
  cada linha declara `gabarito: apurado (fonte, data)` ou `gabarito: escrito` — sem isso ninguém lê
  uma corrida de meses atrás e sabe contra O QUE ela mediu.
- **Os fixtures do juiz congelam o gabarito das de `estado` (`dourado_congelado`).** Eles se diziam
  congelados e liam `dourado.json` na hora da corrida: reescrever a `resposta` de D-67 mudava o
  número do portão sem tocar no juiz — e as de `estado` estão nos 20 rótulos de regressão. Agora
  `data/dourado.json` nem tem esse texto, e há teste que reprova quem usar caso de `estado` no
  fixture sem congelar o gabarito junto.
- **Duas passadas, nunca uma.** A (fidelidade, cega ao dourado e às fontes esperadas) e B
  (concordância + armadilha). Juntá-las economiza uma chamada e destrói a célula **`fiel +
  discorda`** — o único sinal deste sistema que aponta para dentro do corpus: resposta derivada
  corretamente das fontes que contradiz o que a instituição julga saber é contradição entre dois
  documentos. Já achou uma na primeira corrida (D-76: um handoff velho dizendo que o sirius não
  tem hreflang convive com o novo que provou que tem).
- **Julga em `opus`, a síntese roda em `sonnet`** (`JUIZ_MODEL`). Modelo avaliando a própria
  saída tem viés de auto-preferência justamente onde a resposta é fluente. **Sem fallback
  silencioso**: se o modelo do juiz falhar, a corrida sai com `juiz-output` em vez de cair para o
  modelo que gerou.
- **`armadilha` do `data/dourado.json` é eixo independente do veredito**, não sinônimo. Uma
  resposta pode contradizer o dourado e não cometer o erro declarado, e o contrário também. Foi o
  eixo mais estável na calibração (armadilha 100%, veredito 87,5%).
- **Nunca publique número do juiz sem os dois portões** (`scripts/juiz-calibrar.mjs`): holdout
  cego ≥ 85% pega o juiz que reprova demais, adversarial ≥ 9/10 pega o que aprova tudo. Um juiz
  que aprova tudo dá 97% e não vale nada. **Rótulo revisado depois de ler o juiz é contaminado** e
  fica marcado com `veredito_original` — só o holdout decide.
- **`recusou` não é erro e não é veredito de LLM**: sai do contrato de `responder()` (texto vazio
  sem erro). Resposta SUPRIMIDA tem `erro` e não pode entrar como recusa — seria creditar como
  acerto um componente quebrado.

## Dourado de `estado` (`lib/dourado-estado.mjs`) — o gabarito que não apodrece

`node --env-file=.env scripts/dourado-estado.mjs [--estado tudo|caro] [--diff]` — zero LLM. As 70
perguntas de protocolo/episódio continuam texto em `data/dourado.json` (regra não muda sozinha);
as **15** de `estado` são **apuradas na hora da medição**.

- **O campo `resposta` das de `estado` está VAZIO no `data/dourado.json`, e há teste que segura.**
  Ficou 24 h construído sem chegar a régua nenhuma: `avaliar-resposta.mjs` lia o JSON e o juiz
  recebia a prosa. `D-66` dizia "em 30/07 eram 36 repos ativos" e, no dia em que fossem 37, o juiz
  reprovaria a resposta CERTA sem ninguém entender por quê. **Texto que não existe não apodrece** —
  reescrever o texto teria apodrecido de novo em uma semana. `armadilha` e `fontes` continuam
  escritas: são curadoria e não se apuram.
- **Nunca gere isto para dentro do JSON.** JSON escrito ontem apodrece igual a prosa escrita
  ontem: em `D-66` o corpus guardava quatro contagens defasadas do mesmo número (37, 39, 40, 39).
- **Falha FECHADA:** sem rede, ou com a fonte fora do ar, sai `nao_apurado` com o motivo — nunca
  o valor da execução anterior. `--estado offline` roda só o que sai de arquivo do repo.
- **15 das 15 têm fonte viva, e 7 delas entraram em 01/08 por LIGAÇÃO, não construção** (`D-79` a
  `D-85`): `validade.mjs`, `gateways.mjs`, `gateways-repo.mjs`, `conformidade.mjs`, `inspect-url.mjs`
  e os exports de `docs/Crawl-stats` já apuravam com zero LLM e nenhum estava ligado. O trabalho foi
  mover a lógica de script top-level para `lib/` — script que só imprime não se importa.
- **🚩 `rede` tem TRÊS níveis: `offline` < `tudo` (GitHub/GSC) < `caro`.** `corpus-defasado.mjs` e
  `avaliar-resposta.mjs` chamam com `tudo`: pendurar o inventário de gateways ali faria **toda**
  corrida de régua disparar ~250 requisições contra produção — o mesmo motivo pelo qual o
  conformidade está fora do `npm test`. **Fonte cara tem modo próprio, nunca só mais uma entrada em
  `APURADORES`.** Perguntas que leem a mesma varredura compartilham cache por execução (`memo` no
  ctx), e há teste que conta as árvores pedidas ao GitHub.
- **A 1ª corrida dos 7 mediu o CHECK, duas vezes:** `D-85` listou **34 "hosts com problema"** e
  nenhum era de agora — grep por `problem` casa os TRÊS estados que o GSC emite (`No problems`,
  `Problemas no passado`, `Alguns problemas`) e o CSV vem localizado; `D-81` decompunha 10 com SDK
  em subgrupos que somavam **9** (o balde `ligado` sumia do texto). Decomposição que não fecha é
  conta errada.
- **🚩 `D-84` é REMEDIÇÃO DATADA, não tarefa — e as "12 fora do índice" são QUATRO classes.** Os 12
  já têm sitemap válido, **submetido em 30–31/07 e baixado pelo Google em 31/07–01/08 com
  `errors: 0`** (`GET /webmasters/v3/sites/{prop}/sitemaps`): a inspeção que devolveu os 12 rodou 1 a
  2 dias DEPOIS da ação. **Mesmo erro do `D-85`, com janela de 24 h em vez de 90 dias** —
  resubmeter é a ação que parece trabalho e não move célula. As classes têm prognósticos
  incompatíveis e **só uma tem alavanca técnica**: `URL is unknown` 2 (alavanca já puxada),
  `Discovered` 5 (fraca), **`Crawled - currently not indexed` 4 — o Googlebot leu 486–1038 palavras
  e RECUSOU, nenhum conserto técnico move isso**, `Duplicate canonical` 1 (diagnosticável).
  **Meta numérica na terceira classe é meta em cima de um defeito.** Achado lateral: **3 SPAs servem
  ZERO palavra no HTML inicial** (`pathfinder`, `matchfios`, `lumina`) — mas `orcaobra` serve 472 e
  também está `unknown`, então shell vazio não explica os 12. ⚠️ **Contar palavra com `sed
  's/<script[^>]*>.*<\/script>//g'` MEDE O SED**: HTML minificado é uma linha, o `.*` guloso come até
  o ÚLTIMO `</script>` e devolve 0 palavra em página com `<h1>`. Spec em
  `handoff/handoff-proximo-passo-o-d84-e-data-nao-acao.md`.
- **🚩 Os 33,6% de OK do `roilabs.com.br` são de JUNHO, e o conserto já foi entregue.** É o pior
  OK% da casa e o host com mais crawl (2596 req) — e a `ressalva` "date antes de caçar bug" era
  literal. A quebra por resposta diz que não é 404 nem 5xx (0,02%): **53,5% é DNS error**, com 60,7%
  de "Unknown (failed requests)". O export é de **25/07 e cobre 90 dias**, janela que engole a
  limpeza NXDOMAIN dos subdomínios aposentados — `scripts/cloudflare-redirects.mjs` fechou o buraco
  (76,6% do crawl na época) e hoje **os 19 hosts da `Hosts table.csv` resolvem, 17 servem**. Só
  sobram `www.sirius` e `www.goiania`, e as duas falham no HANDSHAKE por construção: o cert Universal
  da Cloudflare cobre apex + **um** label. `DNS-05` as exclui pelo mesmo motivo — os dois checks
  concordam em não olhar, e conserto é ACM pago. Leitura em
  `docs/estado-conformidade-crawl-2026-08-01.md`. **Export commitado à mão envelhece sozinho e nada
  no repo acorda ninguém**: só a data do arquivo na `ressalva` segura o número.
- **Os outros 8 fatos.** `D-70` e `D-71` saíram por curadoria nos cards (`familia`, `estado`,
  `blockersLista: [{texto,humano}]`); **`D-67` saiu pelo GATEWAY** em 31/07 —
  `scripts/vendas-mercadopago.mjs` deriva `vendas: [{data,valor,fonte,id}]` do Mercado Pago. A
  pergunta nunca foi "o que o Jean lembra", era "o que o sistema de pagamento registra".
  `receita` é nota 0-10 de prioridade, nunca faturamento.
- **`vendas` ausente ≠ `vendas: []`.** Ausente é "nenhum gateway foi ligado neste projeto"; `[]` é
  "o gateway respondeu e não pagou nada". `D-67` conta só os checados e **nomeia na `ressalva` os
  34 sem fonte** — confundir os dois é tratar `n/a` como aprovação.
- **`approved` + `live_mode: true` NÃO é venda.** Os 20 pagamentos de R$ 47 do atma (28–30/11/2025)
  passam nos dois e são o Jean testando: payer `test_user_…@testuser.com`, CPF 11111111111. Somar
  `approved` teria publicado **R$ 940 de faturamento inexistente com autoridade de número apurado**.
  Quem separa é o payer, e é `lib/vendas.mjs` que decide — com o motivo de cada descarte na saída.
- **`familia`/`estado` são CURADORIA, e passaram por holdout cego em 01/08**: concordância **77,1%
  (família) e 85,7% (estado)** entre duas leituras independentes dos mesmos 35 cards
  (`docs/curadoria-familia-concordancia.md`). A derivação cega **reinventou `nao-vende` sozinha** —
  a quarta família não é invenção de quem curou — e **precisou de uma quinta, `produto`** (o defeito
  é ANTERIOR à cobrança), que a curadoria tinha espalhado por três famílias. **6 das 8 divergências
  eram a DEFINIÇÃO, não o rótulo**: por isso as famílias agora são testes **com ordem de
  precedência** (aplique de cima para baixo, pare no primeiro que casar) e `no-ar-inutilizavel` = **o
  caminho principal não completa de ponta a ponta**. Refazer o holdout sempre que a taxonomia mudar.
- **`blockersLista` é `{texto, humano}` e o `humano` não se deriva do texto.** Grep por
  `manual|jean` devolve 18 cards contra os 8 reais: mede o texto, não o bloqueio. Quem consome:
  `lib/evaluate.ts` (flag de robô entra com `humano: false`) e `app/page.tsx`.
- **Impressão pede `dimensions: []`; clique não-branded pede `query`.** Com a dimensão `query` o
  GSC omite as raras e a soma vira piso: 5 contra 33 no tapepro. Trocar os dois inventa quedas.
- **A janela do GSC desliza na meia-noite UTC** — o mesmo fim de tarde deu 33 e depois 42.
  `apurado_em` é carimbado em BRT como todo o resto da casa.
- **`(hoje N)` não se escreve em prosa.** Alvo e data do gate são curadoria e ficam escritos; o
  número de hoje se apura. Foi a única família de defasagem real que a fase 3 encontrou — e agora
  é `scripts/validade.mjs` (abaixo) que impede o próximo de nascer.
- **`ressalva` é campo, não frase dentro do fato.** A limitação da medição ("é PISO: query
  anonimizada não entra") escrita junto do número vira afirmação: foi ela que fez o detector de
  defasagem ler discordância entre um documento que dizia "hoje 2" e um apurado de 2 — 1 dos 3
  falsos positivos da primeira corrida. `montarPromptDefasagem` mostra as duas separadas.

## Taxa de erro do corpus (`scripts/corpus-defasado.mjs`) — a comparação B

`o CORPUS × o apurado`, contra os top-10 da mesma busca da aba: 1 chamada por documento, cache
morno retoma corrida morta. As outras réguas comparam a RESPOSTA com o dourado; só esta aponta
para fora do texto.

- **🧊 A FRENTE ESTÁ CONGELADA POR DECISÃO (01/08), e o número que a congelou é a PRECISÃO DA LISTA
  NOMINAL: 70%.** O produto desta frente nunca foi o percentual — é a lista nominal, onde cada linha
  é uma edição de memória ou handoff. No holdout de 15 fatos o detector emitiu **10 `desmente` e 7
  estavam certos** (`bate → desmente` 3 contra `desmente → desmente` 7); recall 87,5% (7 de 8).
  **3 de cada 10 linhas são tarefa fabricada**, e a leitura humana de 31/07 tinha medido 62,5% —
  duas medições independentes, ~2/3. O portão de 85% ainda dava para discutir como régua acadêmica
  (`bate` e `nao-fala` prescrevem a mesma ação); **70% de precisão não tem essa saída, é o custo de
  quem lê a lista**. Custo da frente até aqui: 18 commits, ~19 h, 105 documentos julgados,
  **~7 defeitos reais e 3 deles a MESMA memória**. **Descongelar exige responder ANTES para quê:**
  para publicar taxa de erro do corpus não há atalho e os dois portões mandam; para achar memória
  podre, **`scripts/validade.mjs` já faz melhor** — zero LLM, segundos, dentro do `npm test`, e
  impede o defeito de NASCER em vez de caçá-lo depois. Não descongelar por inércia.
- **🚩 OS DOIS PORTÕES AINDA REPROVAM (01/08, holdout em 74/20): holdout 80,6% (58/72) com 2 casos
  sem veredito parseável, adversarial 14/20** — `scripts/defasagem-calibrar.mjs`, detalhe em
  `docs/defasagem-monocultura-2026-08-01.md` e `docs/defasagem-calibracao.md`. **Nenhum
  percentual de defasagem sai daqui, inclusive o 16,7%.**
- **🚩 "O detector só erra para o lado seguro" era ARTEFATO DE 8 FATOS.** O holdout tinha 50 casos e
  todos saíam de 8 perguntas; com 15 fatos (80 casos) ele **fabricou 3 tarefas e escondeu 1 achado**,
  as duas células que estavam em zero. Separando a mesma corrida: **83,3% nos 8 fatos velhos
  (idêntico à corrida anterior — o fixture inlina apurado e trecho) e 76,7% nos 7 novos**. Todo o
  movimento vem de pergunta contra a qual ele nunca tinha sido medido. **O adversarial continua
  monocultura: 20 casos, as mesmas 8 perguntas.**
- **A regra do PASSADO DATADO está no prompt e não pega sozinha.** O `desmente` fabricado mais caro
  foi contra `SEO-02`, protocolo VIVO, que diz "CannibalScan, 30/07/2026: … 21 dos 38 sites vivos
  **estavam** nessa condição" — data no mesmo span, verbo no passado. Achado ali vira edição de
  norma em cima de nada.
- **`--candidatos` gera bancada nova sem julgar** (`corpus-defasado.mjs --candidatos --ids …`): para
  na seleção, grava o par sem veredito nem âncora e **exclui mecanicamente todo par que já passou
  pelo detector** (varre `data/corpus-defasado/*.json` + os dois fixtures) — veredito lido por
  alguém é rótulo contaminado. Mora no mesmo script de propósito: o valor do par é ter o recorte
  IDÊNTICO ao da produção, e uma segunda cópia da seleção é a próxima divergência esperando.
- **🚩 DUAS PASSADAS FOI TENTADO E REPROVOU — não tente de novo.** Quebrar em passada 1 (extrai a
  afirmação, cega ao fato) + passada 2 (julga, cega ao documento) custa o DOBRO de chamadas e, no
  mesmo fixture congelado, deu **65,9% contra 83,3%** — e **quebrou a célula que decide**, saindo
  de zero para `bate→desmente` 5 e `desmente→nao-fala` 1. **Cego ao documento é cego ao contexto
  que torna a afirmação compatível**: a passada 2 chamou `desmente` uma afirmação que citava o
  mesmo mecanismo com outro nome. O que funcionou 3× foi forçar evidência antes da decisão DENTRO
  da mesma chamada, não decompor em duas. Está atrás de `--duas-passadas` só para o número ser
  reproduzível sem gastar ~130 chamadas do pool de novo.
- **O portão é REPRODUTÍVEL, e agora isso é medido 2× (movimento ZERO):** o fixture inlina apurado
  **e** trecho, então reindexar o corpus não move nenhuma célula — `docs/defasagem-reprodutibilidade-2026-08-01.md`.
  **`corpus-defasado.mjs` NÃO herda isso**: ele roda a busca de verdade, então reescrever handoff
  muda quais documentos ele julga. Comparar corridas dele exige o achado nominal sumindo, nunca o
  percentual descendo.
- **Piso de portão é PROPORCIONAL, nunca absoluto.** O do adversarial era `>= 9`, escrito quando o
  fixture tinha 10 casos; ao dobrar para 20 ele imprimiu "passou 14/20" — 70%, contra os 80% que
  reprovava no dia anterior. **A primeira corrida de um portão AMPLIADO mede o portão.**
- **Os 61 pares candidatos não têm UM `desmente` natural.** Lidos um a um em 01/08: entre os
  documentos que a busca recupera para as 6 perguntas de `estado`, nenhum afirma no presente algo
  que a fonte viva desminta. A célula `desmente` fica em 7 e **não cresce com este material**.
- **🧊 FRENTE CONGELADA em 01/08, e o motivo é o CONJUNTO, não o detector** —
  `docs/defasagem-mineracao-2026-08-01.md`. Minerar `desmente` do histórico do git foi testado e
  **reprovou: 8 pares legítimos, meta era 15**. Duas razões, e as duas fecham o caminho:
  **(a) `git log -p` não adiciona nada** — handoff datado não se reescreve, então a afirmação de
  30/07 já está VIVA no corpus; o que o histórico acha a mais é versão velha de `CLAUDE.md`/`docs/`,
  que **não estão em `carregarCorpus()`**, e treinar em documento que o produto nunca julga é
  fabricar bancada. **(b) O teto são 8 fatos, não a varredura**: só a camada `estado` tem fonte
  viva, cada fato rende ~1 afirmação defasada, 8 × 1,1 = 9. Para 25 casos seria preciso **dobrar a
  camada `estado`** — 20 fatos apuráveis. Da mineração, **7 dos 8 pares são o mesmo fato (D-66)**.
- **🚩 A SELEÇÃO por embedding era o gargalo, e agora são DUAS VIAS (01/08).** A busca recupera por
  TEMA, então número defasado citado de passagem num doc sobre outro assunto nunca chegava ao
  detector: a memória `project_cannibalscan` afirmava `Hub: 39 projetos` (hoje 35) dentro de um doc
  sobre deploy da Vercel. A 2ª via (`docsQueCitam`, `lib/defasagem.mjs`) traz quem CITA a quantidade
  com outro número — zero LLM, zero rede, âncoras declaradas em `CITACOES_D66` e `CITACOES`.
  - **A ÂNCORA É ESTREITA porque isso foi MEDIDO:** `(\d+) projetos` solto seleciona **43**
    documentos e quase todos são quantidade HOMÔNIMA ("10 projetos" é o autopublishing, "21" são os
    apagados da Vercel) — cada um custaria uma chamada do pool para o modelo dizer `nao-fala`. Com as
    duas âncoras de D-66 são **6 documentos**. Âncora nova só entra medida contra o corpus.
  - **Cinco perguntas têm âncora (`D-66`, `D-80`–`D-83`), e a ausência nas outras 10 é deliberada:**
    em `D-68`/`D-69` o ALVO do gate ("≥ 5 cliques") é curadoria correta para sempre e casaria como se
    fosse o valor de hoje — foi um dos 5 defeitos do check da mineração. Em `D-85`, "10 propriedades
    GSC" **não é o mesmo fato** que "10 propriedades com export no repo": casar sinônimo fabrica
    acusação. Das 6 candidatas medidas em 01/08, **2 foram rejeitadas pela largura**: `(\d+)
    protocolos?` solto casa **13** documentos (97 escritos, 85 tipados, 29 candidatos) contra 3 com
    `× N projetos` junto, e `(\d+) com gateway ligado` casa o **denominador** ("1 de 35 com gateway
    LIGADO").
  - **A 2ª via pode trazer ZERO e não ser falha:** na corrida de 01/08 os dois candidatos (`30 sem
    caminho de cobrança`) já tinham vindo pela busca. Ela só paga quando o TEMA do documento esconde
    o número.
  - **🚩 O PERCENTUAL SAI SÓ DA BUSCA.** A 2ª via só seleciona documento cujo número JÁ diverge: é
    amostra PROCURADA, não recuperada. Somá-la ao denominador faria a "taxa de erro do corpus" subir
    sozinha toda vez que a âncora melhorasse — o número mediria a consulta. O campo `via` separa as
    duas na saída; a lista NOMINAL junta, porque lá cada linha é uma edição.
  - **1ª corrida (D-66, 01/08): 3 documentos novos, 3 `nao-fala`, ZERO acusação fabricada.** Os 3
    estavam certos — 2 handoffs datados de 29/07 e o `project_roihub`, cujo "41 repos ativos" mora
    dentro de um bullet `★ Estado 30/07`. **Data grudada no span absolve**, a mesma regra do
    `validade.mjs`. O `desmente` do dia saiu pela 1ª via (`handoff-proximo-passo-02-08.md`).
- **O portão 1 são DUAS condições: `>= 85%` E zero caso sem veredito parseável.** Imprimir só a
  primeira fazia a saída se contradizer ("acerto 87.5% … portão >= 85% … REPROVOU 87.5%"). Caso que
  não parseia não conta como aprovado — senão dá para ir excluindo o difícil até o número subir.
- **O holdout saiu de 13 → 33 → 74 casos que contam (01/08), e de 8 para 15 FATOS.** Os 30 pares
  novos foram rotulados na janela de 2400 da produção, com `ancora` conferida mecanicamente antes de
  escrever (**zero inválido por construção**, contra 6 de 20 na primeira vez à mão) e **commitados
  antes da primeira corrida contra eles** (`d3cdde2`).
- **O defeito continua sendo decidir SE o documento fala do assunto, e agora ele erra dos DOIS
  lados.** `bate → nao-fala` (9) é o de sempre; `desmente → nao-fala` (1) é o MESMO mecanismo caindo
  no lado que esconde corpus podre — apareceu na primeira pergunta cuja família de `desmente` não é
  `(hoje N)`: um documento que afirma no presente que o cruzamento protocolo × projeto "nunca foi
  executada uma única vez", e hoje ele roda. É o alvo da fase D (passada 1, cega ao fato) — **não uma
  terceira redação de regra nem uma segunda decomposição**, as duas já reprovaram medidas.
- **🚩 Duas das 3 fabricações são o RÓTULO, não o detector — e uma delas é achado de CORPUS.** O
  documento diz "um único **faturou** (`atma`)" e o apurado diz "0 faturou(aram) com data: nenhum",
  pondo a `atma` em "gateway ligado e régua lendo". `faturou` significa duas coisas diferentes na
  casa e **este `CLAUDE.md` usa a errada** — os 20 pagamentos da `atma` são teste. Ler divergência
  como defeito do detector antes de ler o corpus foi o que quase escondeu isso.
- **O `VEREDITO` é a ÚLTIMA linha do prompt, e isso é decisão de ENGENHARIA.** Com ele na primeira
  linha o modelo cravava a decisão antes de escrever o raciocínio que a justifica — saía `VEREDITO:
  bate` com o `MOTIVO` terminando em "— desmente", reproduzido 3×. **Duas redações de REGRA já
  falharam nesse formato (71,4% e 50,0%); inverter três linhas levou o adversarial de 3/10 a 8/10.**
  Não reordene "para ficar igual ao do juiz" — há teste que segura.
- **Achado sem citação não conta como achado:** `desmente` sem `TRECHO` é `defasagem-incoerente`, e
  `TRECHO` que não está no documento é `defasagem-citacao`. **A conferência ignora tudo que não é
  letra ou dígito**, e isso foi medido: com espaço apenas normalizado, 8 citações caíram e nenhuma
  era fabricada — o modelo cita a prosa e larga o markdown. Sobraram 2, e as duas são fabricação
  real (trocou `tapepro` por `sirius` na aspa com o motivo certo; citou uma frase do `CLAUDE.md` que
  não estava no documento).
- **O que sobrou é UM modo de falha e ele tem o conserto nomeado:** o detector ainda julga o TEMA do
  documento, não a afirmação dentro dele — todos os erros restantes são `→ nao-fala`, e o mesmo
  documento erra nos dois portões. **A próxima tentativa NÃO é uma terceira redação de regra, é
  quebrar em DUAS PASSADAS** (extrair a afirmação / comparar com o fato), como o juiz. Custo: dobra
  as chamadas de `corpus-defasado.mjs`.
- **Só roda contra pergunta com apuração de verdade.** Comparar documento com dourado escrito à
  mão seria a mesma prosa concordando com prosa.
- **A saída é lista NOMINAL, não percentual** — cada linha é uma edição de memória ou handoff.
  Primeira corrida: 8 de 30 `desmente`, e **ler os 8 baixou para 5** (3 eram o check errado).
- **Handoff datado NÃO se reescreve** para o corpus bater com hoje: é o único lugar onde se vê o
  que se sabia quando a decisão foi tomada. Conserta-se a norma e o card, e a convenção daí pra
  frente.

## Validade (`scripts/validade.mjs`) — a norma que impede a defasagem de NASCER

`npm run validade` (repo + memórias) e `node scripts/validade.mjs --repo`. Zero LLM, zero rede,
segundos — e por isso roda dentro do `npm test`, não ao lado dele.

- **Varre só documento VIVO**: protocolos não revogados, `data/projects.json`, memórias. **Handoff
  nunca**: é registro datado e o único lugar onde se vê o que se sabia quando a decisão foi tomada.
- **A absolvição é avaliada DENTRO do trecho casado, nunca na linha.** Na linha, `PRT-03` — o
  achado que originou a norma — seria absolvido pela data do gate ("até 19/10/2026 (hoje 21)"),
  que é o prazo, não a data do número. Data que não gruda no número não data coisa nenhuma.
- **A primeira corrida mediu o CHECK, como nas outras duas vezes:** 3 achados, 1 defeito limpo
  (o card do aftercare congelando "hoje são 0" cliques) e 2 de fronteira (um status HTTP, um
  "agora 6 asserts" num bullet já datado). Os três saíram datando ou apontando a apuração — mais
  barato que afrouxar a regex, que é como um check vira enfeite.
- **Citação entre crases é literal, não afirmação — e BLOCO CERCADO também (01/08).** Vinte minutos
  depois de passar limpo, o check reprovou a memória que ENSINA a norma citando `(hoje 21)` como
  exemplo. Span de crase é mascarado antes do casamento — check que reprova quem o documenta sai da
  lista na primeira sexta-feira. ` ``` ` é a MESMA classe (saída de terminal colada não afirma nada)
  e faltava: a máscara agora roda no texto INTEIRO antes de quebrar em linhas, preservando `\n` para
  o achado não apontar a linha errada. `semLiteral` é exportada e a 2ª via do detector usa a MESMA.

## Inventário de cobrança (`scripts/gateways.mjs`) — quantos projetos sequer TÊM gateway

`node scripts/gateways.mjs [--ver]` — zero LLM, zero pool, HTTP contra os 35 sites. Fora do
`npm test` pelo mesmo motivo do conformidade: teste não faz 250 requisições contra produção.

- **A pergunta que veio depois de ligar a primeira fonte e devia ter vindo antes.** Sem ela,
  "1 de 35 tem gateway ligado" tanto pode significar "faltam 34" quanto "faltam 2" — e a diferença
  é a diferença entre um portfólio que NÃO COBRA e um que cobra e não mediu. **Medido em 01/08
  (3ª corrida): 1 ligado (`atma`), 1 com gateway servido e sem régua lendo (`orcaobra`/Kiwify), 6
  com preço servido e nenhum gateway (`sirius`, `polarisia`, `estetiacrm`, `context`, `orion`,
  `vertice`), 27 sem caminho de cobrança.** A leitura é "faltam 2", não "faltam 34": o portfólio
  majoritariamente **não cobra**.
- **🚩 O CRUZAMENTO com `gateways-repo.mjs` é a leitura, não cada metade sozinha** —
  `docs/gateways-cruzamento-2026-08-01.md`. Dos 10 com SDK escrito, **1 tem gateway LIGADO e régua
  lendo (`atma`) e 9 não — e nem esse 1 faturou**: os 20 pagamentos da `atma` são teste, então
  `receita provada = R$ 0,00`. Dizer "1 faturou" foi o achado que o holdout de 01/08 devolveu;
  desses 9, **6 já servem preço e só falta LIGAR** (`sirius`, `polarisia`, `estetiacrm`, `context`,
  `orion`, `vertice`) e 3 estão mais longe (`reviewshield`, `aftercare`, `compass`). `orcaobra` é o
  único inverso — Kiwify por link externo **não deixa dependência no `package.json`**, então o
  inventário do código sozinho não o veria. **`goiania` e `roilabs` são o MESMO repo**
  (`JeanZorzetti/roilabs`, a mesma linha do mesmo `app/.env.example`): card ≠ repositório, e somar
  os dois infla onde há vertical dentro de monorepo.
- **🚩 As TRÊS primeiras corridas mediram o CHECK** (sexta, e de novo na oitava vez nesta base). Os
  dois da 3ª corrida só apareceram porque o inventário do REPO deu um palpite independente sobre
  quem devia estar em qual balde — **check sozinho não tem contra o quê errar**:
  **`/preco` no singular não estava em `CAMINHOS`** (o `polarisia` serve `/preco` com 200, tem
  `mercadopago` no `package.json` e caía em "NÃO TEM GATEWAY"), e **preço em ÂNCORA não é rota**
  (`context` e `vertice` são landing de uma página só: `href="#pricing"` na home, sem `/precos`
  para pedir). A âncora casa contra o `href`, **nunca contra a palavra no corpo** — "plano" está em
  qualquer marketing. Controle de que o conserto não inflou: **os 3 que mudaram de balde têm os 3
  SDK escrito no repo**, e nenhum sem SDK entrou. `sem-gateway` foi de 30 para 27.
- **As duas primeiras corridas também mediram o CHECK**, e os dois defeitos são reutilizáveis:
  1. **200 em rota inexistente**: `tapevision` e `potencialarquitetado` marcaram os SEIS caminhos,
     inclusive `/comprar` e `/assinar` juntos — é o shell da SPA. Validar o CORPO não bastou,
     porque o corpo É a home. **O controle é pedir uma rota que não pode existir**; se ela vem 200,
     todo 200 daquele host vale zero.
  2. **Palavra ≠ URL**: `estetiacrm` marcou mercadopago + asaas + pagseguro porque o **catálogo de
     integrações do próprio produto** os cita ("56 integrações nativas com WhatsApp, Google,
     Stripe, Asaas") — gateways que o CRM integra PARA OS CLIENTES DELE. O `orcaobra`, no mesmo
     varrimento, tinha `<a href="https://pay.kiwify.com.br/…">`. **O que separa vender de falar
     sobre vender é a URL apontar para o host do gateway**, então o casamento é só contra URL.
- **`sem-gateway` é "não achei caminho servido", nunca "não cobra".** Não vê gateway montado por JS
  depois de um clique, nem cobrança que não passa pelo site — o `sirius` fatura por tier de
  organização no próprio banco e nenhuma página dele carregaria gateway.
- **`scripts/gateways-repo.mjs` é a outra metade, e ele INVERTE a leitura** (cruzamento em
  `docs/gateways-cruzamento-2026-08-01.md`). Lê `package.json` e
  `.env*` de todos os repos pela API do GitHub (zero LLM, zero pool). Medido em 01/08: **10 com SDK
  de pagamento** (`sirius`, `polarisia`, `estetiacrm`, `reviewshield`, `context`, `aftercare`,
  `atma`, `compass`, `orion`, `vertice`), 2 só com env var (`goiania`, `roilabs`), 23 nada. **Pelo
  HTML eram 30 sem caminho de cobrança; pelo código são 10 projetos com integração escrita e nunca
  ligada** — essa é a lacuna cara. Dois defeitos de check na 1ª corrida, os dois reutilizáveis:
  **`repo` em `projects.json` é o NOME sem o dono** (404 em 35 de 35 — "tudo quebrado" é o formato
  de um check quebrado) e **linha COMENTADA contava como env var** (`# STRIPE_SECRET_KEY` marcava o
  `orion`), mesma classe do "palavra ≠ URL".

## Conformidade (`scripts/conformidade.mjs`) — a norma que RODA

10 dos 97 protocolos viraram função e rodam contra os 35 projetos de `data/projects.json`
(~40 s, rede pura, **zero LLM** — não divide pool com o autopublishing).

- **Stack e infra são DETECTADOS do header/HTML**, não declarados: `projects.json` não tem esses
  campos e um campo manual descreveria o que o projeto era quando alguém digitou.
- **A primeira corrida de um check novo mede o CHECK.** Das 46 violações iniciais, 5 eram o check
  errado — `SEC-01` supunha next-auth num app com Auth0, `VER-02` adivinhava `/sitemap.xml` num
  projeto Astro que serve `sitemap-index.xml`. Ler as violações uma a uma antes do agregado.
- **`n/a` não é aprovação**, é "não olhei". O placar imprime os três estados de propósito.
- **41 violações em 01/08, e as duas grandes foram conferidas FORA do script** (`curl` à mão,
  `docs/estado-conformidade-crawl-2026-08-01.md`): **`GEO-01` 28 de 35** — `llms.txt` devolve 404
  servindo HTML, por isso o check julga o CORPO como o `VER-02`. **`DEP-08` 11 de
  15**: `curl -D -` confirma zero dos três headers na borda. **Os 28 são PISO** — a falta de GPTBot
  só é acusada quando o `robots.txt` existe (`!ctx.robots.erro`), então host sem robots nenhum passa
  batido. E `DEP-08` é **11 de 15 projetos `next`**, nunca "11 de 35": os 20 `n/a` são "não é next".
- **🚩 `GEO-01` media a PALAVRA `GPTBot`, não a permissão — e o agregado escondeu (01/08).** O
  check era `/GPTBot/i.test(corpo)`, e o `orion` passava nessa metade servindo `User-Agent: GPTBot`
  seguido de **`Disallow: /`**: o site inteiro fora do ChatGPT, lido como conformidade. Mesma classe
  do "palavra ≠ URL" do `gateways.mjs`. Agora `julgarGptbot()` devolve `ausente` | `barrado` |
  `permitido`, com teste no `npm test`. **O agregado não se mexeu — 41 antes e 41 depois** — porque
  o `orion` já falhava por `llms.txt`; só a LINHA mudou. Ler as linhas, nunca o placar.
  **`barrado` é só o bloqueio TOTAL** (`Disallow: /` sem nenhum `Allow:` no grupo): o `reviewshield`
  libera `/blog` e `/llms.txt` de propósito, e reprovar política parcial seria o check opinando
  sobre escopo. **Nenhum projeto NÃO TOCADO mudou de balde** — o controle do §4.1 do handoff.
- **Fora do `npm test` de propósito:** teste não faz 140 requisições contra produção.

## Ambiente

`.env` (não versionado) tem o pool de tokens, `GITHUB_TOKEN`, `DATABASE_URL`,
`UNSPLASH_ACCESS_KEY`, `CRON_SECRET`. Modelo em `.env.example`. **Ao debugar erro de API,
deploy ou banco: ler os `.env` antes de olhar o código.**

Dev é Windows/OneDrive; produção é Linux/Alpine. `spawn("claude")` no Windows só acha o
binário via `shell: true` (o CLI é um shim `.cmd`) — o código já trata, não "simplificar".

## Convenções de código

- Comentário explica **por que**, com o fato medido que motivou a linha (ver o estilo em
  `autopublish-clients.ts`). Comentário que narra o que a linha faz é ruído.
- Sem linter e sem formatter configurados — siga o estilo do arquivo vizinho.
- Fechar entrega = `npm test` verde + commit + push, sem perguntar.

## Agent skills

### Issue tracker

Issues vivem no GitHub Issues de `JeanZorzetti/roihub`, via `gh` CLI. **O repo é PÚBLICO** —
toda issue é visível e indexável. Ver `docs/agents/issue-tracker.md`.

### Triage labels

Os 5 rótulos canônicos, sem renomear: `needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`. Ver `docs/agents/triage-labels.md`.

### Domain docs

Single-context: um `CONTEXT.md` na raiz + `docs/adr/`. Nenhum dos dois existe ainda, e isso
não é problema — `/domain-modeling` cria quando houver termo ou decisão de verdade para
registrar. Ver `docs/agents/domain.md`.
