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
- **A síntese é um segundo prompt, depois da fusão, de propósito.** Um prompt só que
  ordenasse e respondesse obrigaria a remedir os 88,0% a cada ajuste de redação. Separado, o
  recall e a resposta têm réguas independentes: `scripts/avaliar.mjs` e
  `scripts/avaliar-resposta.mjs`.
- **Falha FECHADA na citação:** resposta sem `[n]` válido não é renderizada, vira
  `resposta-sem-citacao` no rodapé. Prosa fluente sem procedência é o pior resultado deste
  componente — tem a autoridade da resposta e nenhuma da fonte. Recusa (`NÃO ESTÁ NO
  CORPUS`) não é erro e não vira aviso.
- **`avaliar-resposta.mjs` mede ancoragem, NÃO verdade.** Citar a fonte certa e resumi-la
  errado passa. Nada neste sistema mede verdade.
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
- **Reindexar depois de escrever handoff/memória**: `node --env-file=.env scripts/indexar.mjs`.
  Memória mora em `~/.claude`, fora do repo — sem reindexar ela some da aba em silêncio.

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
