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
   senão nunca roda. Suite inteira: ~1,6 s.
3. **Deploy é Docker no EasyPanel**, `output: "standalone"` — **não é Vercel**.
   `vercel project ls` não prova nada sobre este repo. Push em `main` → build da imagem.
4. **Não dar push entre 00:00 e 01:00 BRT.** O cron do autopublishing dispara 00:13 BRT
   (`13 3 * * *` UTC no `.github/workflows/seo-autopublish.yml`); um deploy no meio derruba
   a publicação de 10 projetos.
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
- **A fila gira 1 passo por dia** (`projectQueue`) para o rate limit não cair sempre no
  mesmo projeto.
- **claude-cli não tem `json_schema` strict**: o JSON vem no meio do texto e
  `parseJsonBlock` tenta fence primeiro, depois cada `{` como candidato. Não trocar por
  "recorta do primeiro `{` ao último `}`" — o modelo escreve prosa com chaves.
- Erros são **códigos estáveis**, nunca a mensagem do modelo (o corpo pode conter o prompt
  inteiro): `llm-auth`, `llm-rate`, `llm-cli`, `llm-output`, `llm-parse`, `llm-timeout`.
  Regex de status em `run-autopublish.mjs:40` valida o conjunto — reason nova precisa
  entrar lá, senão vira `invalid-response`.

## Busca (`/busca`) — o SEGUNDO consumidor do claude-cli

`BM25 → + vetor (Ollama) → + reranker (claude-cli) → síntese (claude-cli)`, medido em
`data/dourado.json` (85 perguntas desde 01/08; os 82,3% → 82,4% → **88,0%** de recall@10 foram
medidos com 78 — **denominador novo não se compara com número velho**, piso relativo sempre).

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
  fantasma: aviso perde para percentual.
- **Reindexar depois de escrever handoff/memória**: `node --env-file=.env scripts/indexar.mjs`.
  Memória mora em `~/.claude`, fora do repo — sem reindexar ela some da aba em silêncio.

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
  servindo HTML, por isso o check julga o CORPO como o `VER-02`, e o `orion` sai como "sem llms.txt"
  **apenas** porque serve GPTBot, o que prova que o check separa as duas faltas. **`DEP-08` 11 de
  15**: `curl -D -` confirma zero dos três headers na borda. **Os 28 são PISO** — a falta de GPTBot
  só é acusada quando o `robots.txt` existe (`!ctx.robots.erro`), então host sem robots nenhum passa
  batido. E `DEP-08` é **11 de 15 projetos `next`**, nunca "11 de 35": os 20 `n/a` são "não é next".
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
