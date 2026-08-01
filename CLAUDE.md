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
`data/dourado.json` (78 perguntas): **82,3% → 82,4% → 88,0%** de recall@10.

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

- **Mede consistência com o dourado, NÃO verdade sobre o mundo.** O dourado foi escrito por um
  agente lendo o mesmo corpus: se o corpus mente, o dourado repete e o juiz aprova. Verdade
  contra a realidade é o `conformidade.mjs`. Está escrito no cabeçalho do script e sai impresso
  no relatório de propósito — régua que não declara o próprio limite vira meta em cima de um
  defeito.
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

`node --env-file=.env scripts/dourado-estado.mjs [--estado tudo] [--diff]` — zero LLM. As 70
perguntas de protocolo/episódio continuam texto em `data/dourado.json` (regra não muda sozinha);
as 8 de `estado` são **apuradas na hora da medição**.

- **Nunca gere isto para dentro do JSON.** JSON escrito ontem apodrece igual a prosa escrita
  ontem: em `D-66` o corpus guardava quatro contagens defasadas do mesmo número (37, 39, 40, 39).
- **Falha FECHADA:** sem rede, ou com a fonte fora do ar, sai `nao_apurado` com o motivo — nunca
  o valor da execução anterior. `--estado offline` roda só o que sai de arquivo do repo.
- **8 das 8 têm fonte viva.** `D-70` e `D-71` saíram por curadoria nos cards (`familia`, `estado`,
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
- **`familia`/`estado` são CURADORIA, como o alvo do gate.** O que se apura é a DISTRIBUIÇÃO, e é
  isso que a `ressalva` de `D-70` declara. **A quarta família (`nao-vende`) não estava na spec** e
  nasceu da leitura dos 35: 7 projetos (CV, demo, pesquisa, vitrine) não tentam faturar por
  decisão — empurrá-los para uma das três inventaria um travamento que não existe.
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
- **Citação entre crases é literal, não afirmação.** Vinte minutos depois de passar limpo, o check
  reprovou a memória que ENSINA a norma citando `(hoje 21)` como exemplo. Span de crase é mascarado
  antes do casamento — check que reprova quem o documenta sai da lista na primeira sexta-feira.

## Conformidade (`scripts/conformidade.mjs`) — a norma que RODA

10 dos 97 protocolos viraram função e rodam contra os 35 projetos de `data/projects.json`
(~40 s, rede pura, **zero LLM** — não divide pool com o autopublishing).

- **Stack e infra são DETECTADOS do header/HTML**, não declarados: `projects.json` não tem esses
  campos e um campo manual descreveria o que o projeto era quando alguém digitou.
- **A primeira corrida de um check novo mede o CHECK.** Das 46 violações iniciais, 5 eram o check
  errado — `SEC-01` supunha next-auth num app com Auth0, `VER-02` adivinhava `/sitemap.xml` num
  projeto Astro que serve `sitemap-index.xml`. Ler as violações uma a uma antes do agregado.
- **`n/a` não é aprovação**, é "não olhei". O placar imprime os três estados de propósito.
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
