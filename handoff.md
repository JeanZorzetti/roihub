# ROI Hub — handoff

> ▶️ **PRÓXIMO PASSO — fase 4: contextual retrieval, medido igual** (o piso a bater é
> `--min 0.83`, o teto é 93,3% de recall@50). Depois: abrir as 5 lacunas (`BKP`, `CST`, `OBS`,
> `PRV`, `A11Y`), **com a checagem definida antes da norma**.
>
> ✅ **A RECUPERAÇÃO VIROU NÚMERO (31/07) —
> [`handoff/handoff-fase3-hibrido-medido.md`](handoff/handoff-fase3-hibrido-medido.md)**.
> Fase 3 fechada: `node scripts/avaliar.mjs` mede BM25 (82,3% recall@10), denso (76,7%) e
> **híbrido (83,0%)** sobre 258 docs, com `lib/corpus.mjs` · `lib/bm25.mjs` · `lib/denso.mjs` ·
> `lib/busca.mjs` e `test/busca.test.mjs` no `npm test` (**153 verdes**). Zero dependência nova,
> zero Postgres: 258 docs indexam em 40 ms na memória.
> 🚨 **O vetor perde sozinho em tudo, menos onde o BM25 é cego** — −5,6 pontos no agregado,
> **+18,7 na camada `estado`**. Medir por camada é o que impediu de descartar o único ganho real.
> **`c = 60` da RRF (o valor de manual) deixava a fusão ABAIXO do BM25 sozinho**; com `c = 10`
> passa. **Reranker recusado por falta de prova** — teto medido de 10,3 pontos, sem cross-encoder
> local viável. E o que sobrou de buraco (camada `estado`, 42,7%) **não é índice ruim, é fonte
> errada**: "quantos projetos hoje" mora no GitHub/GSC/banco, não em texto.
> ✅ **E virou aba (31/07) — [`handoff/handoff-busca-hibrida-no-ar.md`](handoff/handoff-busca-hibrida-no-ar.md)**:
> `/busca` no hub, híbrida (`BM25 + vetor`), ~200 ms morno. Corpus e vetores em
> `hub_corpus`/`hub_embeddings` — é o que põe as **123 memórias** (que moram em `~/.claude`, fora
> do repo) dentro do container. Reindexar: `node --env-file=.env scripts/indexar.mjs`.
> ✅ **CONFIRMADO NO AR EM 31/07 18h30: rodapé `BM25 + vetor` numa consulta real** — o container
> tem a env **e** alcança `sofia_ollama`, 0,9 s por busca. Fase 3 fechada sem pendência.
> ▶️ Para reconferir: **BUSCAR alguma coisa**, não só abrir — sem `?q=` o rodapé não chama o
> Ollama. A aba pede basic auth (`HUB_USER`/`HUB_PASS` só na EasyPanel, pedir ao Jean).
> ⚠️ **O piso `--min 0.83` foi aposentado (31/07 18h)**: os **mesmos 259 docs** da fase 3 rendem
> **82,4%** hoje, não 83,0%, **sem mudança de código** — handoff e memória são reescritos toda
> sessão e isso mexe em vetor e IDF. (Testada e **descartada por medição** a hipótese óbvia de
> que os 4 docs novos é que sujavam: custo real deles = **0,0 ponto**.) Agora é `--min bm25`,
> o BM25 da mesma execução. Ele expõe o problema real: **o vetor ganha do BM25 por 0,1 ponto**,
> fração de uma pergunta em 78.
>
> ✅ **O CONJUNTO DOURADO EXISTE (31/07) — 78 perguntas —
> [`handoff/handoff-conjunto-dourado.md`](handoff/handoff-conjunto-dourado.md)**.
> Fase 2b fechada: [`data/dourado.json`](data/dourado.json), pergunta real + resposta conhecida +
> `fontes` (o alvo de recall@k) + `armadilha` (a resposta plausível e errada) + `camada`
> (protocolo 65 · estado 8 · episódio 5, separadas porque recall medido em bloco esconde qual
> índice está ruim). `test/dourado.test.mjs` na lista do `npm test` (**147 verdes**) amarra as
> fontes ao corpus: fonte `AREA-NN` tem que existir em `data/protocolos/`, e **área com protocolo
> tipado tem que ter pergunta** — as 13 cobertas. Nenhum script de avaliação foi escrito:
> `recall@k` sem índice é código morto, nasce na fase 3.
> **⚠️ As fases 3+ já podem começar** — o que estava proibido era começá-las antes disto.
>
> ✅ **OS PROTOCOLOS ESTÃO TIPADOS (31/07) — 97 registros —
> [`handoff/handoff-protocolos-tipados.md`](handoff/handoff-protocolos-tipados.md)**
> (plano: [`handoff/handoff-tipar-protocolos.md`](handoff/handoff-tipar-protocolos.md)).
> Fase 2 fechada: `data/protocolos/<AREA>-<NN>.json`, um arquivo por protocolo, **todos com
> `verificacao.como`**, mais `test/protocolos.test.mjs` na lista do `npm test` (**140 verdes**).
> DEP 16 · AGT 12 · UI 11 · CNT 10 · VER 7 · INT 7 · SEO 6 · DNS 6 · SEC 6 · PRT 6 · DAT 4 ·
> PRF 4 · GEO 2. Triagem dos 123 arquivos de memória em
> [`docs/protocolos-triagem.md`](docs/protocolos-triagem.md).
> 🚨 **O achado: o protocolo mais caro do repo estava em CÓDIGO, não em memória.** As regras
> editoriais que governam **10 sites publicando sozinhos toda noite** (fonte real, nunca
> concorrente direto, BLUF 40–60 palavras, tabela em comparação, gate YMYL) só existiam no
> prompt do `autopublish-clients.ts` — `CNT` era a área mais subdimensionada do portfólio
> (estimada ~4, tipada **10**). A fase 5 não pode assumir que toda norma nasceu em `memory/`.
> **Nenhum candidato caiu por falta de checagem** (o handoff anterior previa perder alguns): as
> memórias já nascem com *How to apply*, então o trabalho caro foi **traduzir prosa em comando**.
> ⏸️ **Continua aberto e adiado por decisão:** o `UND_ERR_HEADERS_TIMEOUT` (agora normatizado em
> `INT-02`, patch **ainda não aplicado**) do
> [`handoff/handoff-harness-decidido.md`](handoff/handoff-harness-decidido.md) § D — pode estar
> custando artigo toda noite no `polarisia` e no `reviewshield`; confirmar custa ~10 min.
>
> ✅ **HARNESS DECIDIDO (31/07) — fica o `spawn("claude")`.** O Claude Agent SDK só autentica
> por `ANTHROPIC_API_KEY`/Bedrock/Vertex/Foundry; `CLAUDE_CODE_OAUTH_TOKEN` não existe na doc
> dele. Fora por [[budget_claude_cli_only]] — e a mesma doc diz que rodar o CLI como
> subprocesso com `-p --output-format json` **é o padrão**, que é o que este repo já faz.
> OpenCode/Aider/Codex/`nanocodex` saem na triagem de ToS. `CLAUDE.md` +
> `.claude/settings.json` escritos. Detalhe e fontes em
> [`handoff/handoff-harness-decidido.md`](handoff/handoff-harness-decidido.md).
>
> ✅ **A ABA `/resumo` ESTÁ NO AR (31/07, 10h30) —
> [`handoff/handoff-resumo-entregue-e-as-26-decisoes.md`](handoff/handoff-resumo-entregue-e-as-26-decisoes.md)**
> (plano: [`handoff/handoff-pagina-resumo-executivo.md`](handoff/handoff-pagina-resumo-executivo.md)).
> Sexta aba, **35 resumos executivos**, seis campos fixos, `npm test` verde (132) e push.
> `estado` e `dinheiro` **não vieram de card**: os 35 hosts curlados **sem `-k`** (todos 200) e os
> quatro backends mortos re-resolvidos — `cardioapi`, `aitradingapi`, `arquiteturaapi` e `pathback`
> seguem **NXDOMAIN em 31/07**.
> 🚨 **O achado é o agregado, não a página: 26 dos 35 estão parados numa DECISÃO, não numa tarefa.**
> **1 de 35** tem receita provada (`sirius`, e o card não registra as datas das 3 vendas); **2** têm
> checkout vivo (`orcaobra`, e o `atma` nunca testado em produção); **5** estão em
> `no-ar-inutilizavel`. As 26 decisões são três famílias — *não tem como cobrar* (9), *não tem quem
> venda* (5), *não tem tráfego* (o resto) — e **só a terceira** é tratada pelas abas que já existem.
> ⚠️ **A agenda não guarda decisão** (ela quer data e checkbox; "matar ou investir o `orion`?" não
> tem nenhum dos dois). Nada foi construído para isso — pergunta aberta pro Jean: **as 26 viram uma
> triagem ou o `/resumo` é só onde elas moram?**
>
> ✅ **A LEVA DO AGENTE FOI EXECUTADA (31/07, 12h) —
> [`handoff/handoff-fabrica-e-leva-de-um-linha-31-07.md`](handoff/handoff-fabrica-e-leva-de-um-linha-31-07.md)**
> (plano: [`handoff/handoff-proximo-passo-pos-sirius.md`](handoff/handoff-proximo-passo-pos-sirius.md)).
> 🚨 **A tarefa nº 1 não existia.** URL Inspection nas 26 URLs do `fabrica` antes de mexer:
> **24 em `Submitted and indexed`, incluindo 20 dos 21 artigos.** Não havia bloqueio de indexação —
> o `errors: 1` do sitemap é real, persiste, e **não era o que segurava os artigos**. O `fabrica`
> sai da fila de SEO técnico: o gargalo dele é **tráfego**, não descoberta. Sobram 2 Request
> Indexing manuais (`/termos` e `/blog/como-atrair-pacientes-clinica-de-estetica`).
> ✅ **Entregue e verificado no ar:** OG card próprio no `orcaobra` (era placeholder do lovable.dev)
> e no `potencialarquitetado` (apontava para domínio NXDOMAIN); H1 do `cardiorisk` alinhado ao
> `<title>`; **`/sitemap.xml` E `/robots.txt`** criados no `vertice` e no `compass` (o card só citava
> o sitemap — o robots também estava 404 nos dois) e submetidos ao GSC.
> 🚨 **Segundo achado: 3 projetos publicavam quebrado.** Os pushes deram `● Error` em 5–9 s —
> **Root Directory `/` com o app em subpasta** ([[vercel_root_dir_slash_push_kills_subfolder_site]]).
> Corrigido via API no `reforma-maestro` (`frontend-next`) e no `vertice` (`app`): **build por git
> voltou nos dois.** O `compass` continua só por CLI de dentro de `web/` — com `rootDirectory` ele
> compila e quebra ao publicar (`ENOENT .next/routes-manifest-deterministic.json`, Next 16.2.6).
> 🙋 **Jean, 5 min, inalterado:** verificar `goiania.roilabs.com.br` no **Bing Webmaster Tools** —
> maior score acionável (44) e mata o IndexNow 403 que reaparece a cada build. Depois: as 4 chaves
> do Stripe do `compass`, o `GOOGLE_CLIENT_ID` do `reviewshield` e — o mais antigo e perigoso —
> **rotacionar os segredos vazados** ([[secrets_to_rotate]]).
> 🤖 **Agente, próxima sessão: `polarisia`, spec 012 T001–T017** (home V4) — única tarefa de sessão
> longa que sobrou sem dependência de credencial.
>
> 🎯 **PRÓXIMO PASSO — DUAS COISAS, e uma delas é uma data.**
>
> 1️⃣ ✅ **A FRENTE DO `sirius` FOI EXECUTADA (31/07, 08h30) —
> [`handoff/handoff-sirius-agaas-ctr-31-07.md`](handoff/handoff-sirius-agaas-ctr-31-07.md)**
> (plano original: [`handoff/handoff-proximo-passo-31-07.md`](handoff/handoff-proximo-passo-31-07.md)).
> 🚨 **A premissa do passo 1 era FALSA:** o `hreflang` **já existia e já é servido** nos dois pares
> (`curl` sem `-k`, 31/07) — `lib/seo/canonical.ts`. Cada página ser `canonical` de si mesma **com** o
> par completo é o comportamento correto, não canibalização. **Zero linha de `hreflang` escrita.**
> ✅ Feito no lugar: **CTR do `agaas`** (`titleEn` → `AgaaS Meaning: Agentic-as-a-Service vs
> Traditional SaaS`, meta em BLUF, conteúdo abrindo com a definição, **slug intocado**) e **dono do
> `crm roi`** (o post; link no componente compartilhado `CalculadoraROI` cobre as 5 calculadoras).
> 🚨 **`crm roi` estava partido em QUATRO URLs, não duas** — o plano só tinha visto duas.
> ✅ Remedição própria confirma o gate: **2 cliques não-branded**, e `agaas` (85 imp, pos 8,1) é a
> **única** query não-branded de página 1 com volume. O gate é CTR de UMA página.
> ⚠️ **`sirius` NÃO é Vercel** (não está em `vercel project ls`; a CSP cita `*.easypanel.host`) — o
> `CLAUDE.md` do repo diz "Deploy: Vercel" e está desatualizado. Clone agora existe em `C:\dev\sirius`.
> ⚠️ **CI de `main` já estava vermelho antes:** 54 erros de `tsc` pré-existentes, nenhum nos arquivos
> alterados.
> ▶️ **Próxima leitura: ~14/08** — cliques não-branded em 28d, por query × país. Conteúdo solar
> (~215 imp em pos 26–41) só depois disso.
>
> ✅ **A FRENTE DO ATMA ENCERROU (31/07, 07h50) —
> [`handoff/handoff-atma-reindexado.md`](handoff/handoff-atma-reindexado.md).**
> O Jean pediu a reindexação na UI e a URL Inspection confirma: **as 5 URLs voltaram para
> `Submitted and indexed`**, `verdict: PASS`, com **`lastCrawlTime` do próprio 31/07** — contra os
> 04–06/06 congelados de antes. É o desfecho bom da tabela, não o "crawl novo mas segue not indexed".
> **O maior ativo orgânico da ROI Labs (era ~1.600 imp/dia, caiu para 10–20) está de volta ao índice.**
> ⚠️ **Agora é TEMPO, não trabalho:** tráfego é indicador atrasado. **Reconferir a série em ~14 dias**
> — e **não baixar o `decay 10`** do card antes de a série reagir.
> 🔧 Ler o estado sem abrir a UI: `node --env-file=.env scripts/inspect-url.mjs <url> [...]` (novo).
> 💡 **O que o horário do crawl entregou:** a home e o artigo campeão foram rastreados às 22h55 BRT,
> o minuto exato do **resubmit do sitemap pela API** — o "empurrão secundário" reindexou 2 das 5
> sozinho. Da próxima vez, submeter o sitemap primeiro.
> As tarefas 2 e 3 já haviam fechado, verificadas no ar
> ([`handoff/handoff-proximo-passo-atma-executado.md`](handoff/handoff-proximo-passo-atma-executado.md)):
> `orion` serve zero `aggregateRating`/endereço/telefone/depoimento/selo falso (`94a6bdb`, prova de
> build novo = `AggregateOffer` em `99.90/999.90`); `pathfinder` serve `/sitemap.xml` em **200 com
> corpo `<?xml` e 36 `<loc>`** (`aee6e09`).
> ⚠️ **Armadilha que continua valendo:** o push do `pathfinder` **não publica** — a Vercel dele não
> escuta o git. Deploy é `npx vercel deploy --prod --yes` de dentro de `frontend/`. O `orion` publica
> sozinho no push (EasyPanel, ~10 min).
> ⚠️ **O backend do `pathfinder` continua morto** (`/api/*` → NXDOMAIN): consertamos a descoberta,
> não o produto.
> ⚠️ **O Atma não está "pronto":** restam o MercadoPago nunca testado em produção e o resíduo de DNS
> `clerk.`/`www.`. Ninguém viu a desindexação porque a home responde **200** e o `checkHealth` só olha
> `res.ok` — essa cegueira do hub segue de pé.
> ✅ **`orion`: o `aggregateRating` fabricado SAIU** (30/07, `94a6bdb`) — junto com endereço,
> telefones, `sameAs`, depoimentos inventados e os selos "ISO 27001"/"AWS Partner". O risco era do
> DOMÍNIO, não do projeto; falta só confirmar no HTML servido.
>
> ✅ **A curadoria do hub FECHOU: 20 → 35.** Não sobra nenhum projeto não-curado —
> `CURADO: 35 · NÃO-CURADO: 0 · hosts duplicados: ZERO`, 130/130 testes.
> Só **3 dos 15** estão de fato no índice do Google (`aprovai`, `roi-labs-links`, `qprime`);
> `compass` e `pathfinder` são `URL is unknown to Google`. Receita original em
> [`handoff/handoff-curar-os-15.md`](handoff/handoff-curar-os-15.md).
> ⚠️ **O Clerk do Atma já tinha sido arrancado** (`726e45f`, 30/07) — o briefing anterior mandava
> nascer com ele como blocker e o card teria nascido mentindo. Premissa velha em 24h.
> ⚠️ **Defeito de régua registrado e NÃO consertado:** o critério `seo` é "tração merece atenção",
> então quem desaba tira nota BAIXA — o Atma tirou **0,7** por ter colapsado. Compensei à mão com
> `decay 10`. Mexer nos pesos é decisão do Jean.
>
> ✅ **A frente de nomenclatura FECHOU (30/07, 22h BRT).**
> [`handoff/handoff-renomear-subdominios-executado.md`](handoff/handoff-renomear-subdominios-executado.md)
> — **9 renomeações + 2 limpezas**, todas verificadas pelo corpo. **Zero duplicados.**
> A frente de domínio próprio já havia fechado na 2ª leva; agora todo host vivo também tem **nome de
> produto**. Os 10 hosts antigos ficam em **308** por semanas — não apagar antes de o `Crawl requests`
> deles cair. Receita original em
> [`handoff/handoff-renomear-subdominios.md`](handoff/handoff-renomear-subdominios.md); histórico das
> levas em [`handoff/handoff-proximo-passo-leva-2.md`](handoff/handoff-proximo-passo-leva-2.md).
> 🚨 **A ordem é literal: push → deploy manual → verificação.** Os 3 estáticos que publicam de
> `site/` têm `Root Directory = /`, então o push serve a raiz do repo e derruba o host novo para
> **404**. Verificar antes do push dá verde no deploy errado.
> 🚨 **`redirect` da API da Vercel só aceita destino no MESMO projeto** — cross-project dá
> `400 bad_request`. Saída: `DELETE` no projeto velho + `POST` no novo já com o `redirect`.
> ⚠️ **Decisão do Jean, já tomada e reafirmada: ZERO arquivamentos** — *"quero todos ativos, vou
> monetizar/produtizar todos"*. Não relitigar; o custo aceito é NXDOMAIN futuro em quem for abandonado.
> 🗑️ Único resíduo aberto: **`housingpro.com.br` usa o DNS do Registro.br** (`d/e.sec.dns.br`), não
> Cloudflare nem Hostinger — limpeza é à mão, no painel. Já responde 404 e não está em propriedade
> nenhuma do GSC, então **impacto zero**: é higiene, não pendência.
>
> 2️⃣ **A data, que não depende de sessão:**
> [`handoff/handoff-proximo-passo-02-08.md`](handoff/handoff-proximo-passo-02-08.md)
> (30/07): domingo **02/08, 10:00 BRT**.
> É o **primeiro run do robô de crawl stats** (`LastTaskResult 267011` = nunca rodou), e ele é as
> duas coisas ao mesmo tempo: o **único instrumento de medição** do conserto do NXDOMAIN — existe
> **um só** export do `roilabs.com.br` no repo, o de 25/07, que é o baseline de *antes* — e **código
> que nunca executou de ponta a ponta** (Chrome + 10 exports + `analyze.py` + `narrate.py` +
> `git push`, sozinho).
> 🚨 **O sinal certo é `Crawl requests` dos hosts mortos CAINDO, não o OK%** — janela de 90 dias.
>
> ✅ **NXDOMAIN dos 14 subdomínios: APLICADO e verificado.** Medido em 30/07 com
> `cloudflare-redirects.mjs --verify`: `pathfinder`/`orion`/`vertice`/`atma` em **200**, `atmaadmin`
> 307→`/admin`, `atmaapi` **200**, `sirius`/`sofiaia` em 301 com path preservado, e
> **`goiania`/`tapepro` intactos em 200** — o teste de segurança passou. Só `www.sirius` e
> `www.goiania` ficaram em `http://` (Universal SSL cobre 1 label; curar exige ACM pago — **decidido
> não fazer**). Receita e execução em
> [`handoff/handoff-nxdomain-subdominios.md`](handoff/handoff-nxdomain-subdominios.md).
>
> ⛔ **`alibi_ai` excluído (Jean, 30/07)** — era o último host em `RESSUSCITAR`, agora é morto
> permanente (`MORTOS` no script). **Mudança semântica, não operacional:** a Regra 4 é montada com
> `[...MORTOS, ...RESSUSCITAR]`, a expressão publicada é idêntica e o host já responde 301.
> **Não rode o script por causa disso.**
>
> ✅ **36 repos ativos, 34 com site**, 2 sem `homepage` (`roihub`, `repo-de-teste`) — decisão fechada.
> Caiu de 41 porque `cardioqwen3code`, `synth-bot-buddy` e `housingpro` foram **apagados**, não
> porque algo saiu do ar.
> A frente "repos sem site" está **encerrada**.
>
> **O que sobra não é código do roihub:** Compass (Etapas 2 e 3 — GitHub OAuth, Resend, Stripe),
> 2 cards da agenda vencidos (`sirius` gate 28/07, `nimblabs` ~20/07) + `tapepro` sem ação, e
> domínio próprio dos sites novos. Backlog de código real está **nos projetos rankeados**.

> ✅ **Compass NO AR** em `https://compass.polarisia.com.br` (29/07, 14h) — banco ligado, DNS
> corrigido, `/pricing` 200 e o ápice do Polaris intacto. O item "compass" **sai da fila de ops**.
>
> 🎯 **PENDÊNCIA que sobrou — Etapas 2 e 3 do
> [`C:\dev\compass\handoff.md`](https://github.com/JeanZorzetti/compass/blob/main/handoff.md):**
> o app está de pé mas **não é usável nem cobrável**.
> - **Etapa 2 · login** — `AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET` (callback
>   `https://compass.polarisia.com.br/api/auth/callback/github`) e `AUTH_RESEND_KEY`. `/login`
>   responde 200, mas **sem provider ninguém entra**.
> - **Etapa 3 · cobrança** — `STRIPE_SECRET_KEY`, os dois `price_…` e o `STRIPE_WEBHOOK_SECRET`.
>   Crie o webhook **já no domínio final** (webhook morto = cliente paga e não vira assinante).
>
> As duas são **painel de terceiro, com o Jean** (GitHub, Resend, Stripe) — não há código a escrever.
> Enquanto elas não saem, "distribuição" continua sem sentido: não há como o usuário logar.
>
> 🔴 **Dívida aberta:** o Postgres escolhido foi o do **VPS EasyPanel** (`2.24.207.200:5451`), e o
> servidor **não suporta TLS** — senha e dados trafegam em texto puro até a Vercel, com a senha de
> `secrets_to_rotate`. Resolver **antes do primeiro pagante**, não antes do primeiro login.
>
> ✅ **[`handoff/handoff-quatro-sites.md`](handoff/handoff-quatro-sites.md) foi EXECUTADO** na 4ª
> sessão de 29/07: **4 de 4 no ar**, `homepage` gravada e confirmada com 200 —
> `roi-labs-links.vercel.app`, `lumina-demo-beryl.vercel.app` (rotulada **demo**),
> `cannibalscan.vercel.app` (com `robots`/`llms`/`sitemap`/`FAQPage`) e `aprovai-locacao.vercel.app`
> (nome próprio, para não encostar no `aprovai.vercel.app` de terceiro).
> **Sem `homepage`: 6 → 2**, e os 2 são os de decisão (`roihub`, `repo-de-teste`) — o `<details>` da
> home fica vazio e some sozinho, sem mexer no código do hub.
> ⚠️ Achado que vale para qualquer repo "site pronto, é só deployar": a página do `roi-labs-links`
> **estava quebrada** (gradiente Tailwind copiado à mão sem os `--tw-gradient-*-position` → texto
> branco sobre fundo branco) e ninguém sabia, porque nunca tinha sido aberta.
>
> **O que sobrou dos sites é painel/DNS**, não código — domínio próprio (`links.roilabs.com.br` na
> Cloudflare, `cannibalscan.nimblabs.com` na Hostinger, e a `homepage` tem de mudar **junto**) e
> submeter o CannibalScan ao GSC. Fica atrás do Compass na fila.
>
> ✅ **Feito na 3ª sessão:** `roihub` e `repo-de-teste` saíram da lista "repos sem site" — a
> `homepage` vazia deles é decisão, não pendência (`semSitePorDecisao` em `lib/projects.mjs`, teste
> 7/7).
>
> **Estado anterior** em [`handoff/handoff-proximo-passo-30-07.md`](handoff/handoff-proximo-passo-30-07.md)
> (29/07). Dos três itens que ele listava, **nenhum sobrou**: o `compass` foi resolvido acima —
> ⚠️ o diagnóstico dele ("um A record + 9 segredos") estava **errado nas duas metades**.
> ⛔ **SplitJud foi
> ENCERRADO** (repo deletado pelo Jean → sem repo não há projeto; não reanexar vhost, não apontar
> DNS), e os 6 boilerplate Lovable foram excluídos. **47 → 41 repos ativos, 12 → 6 sem `homepage`.**
>
> <details>
> <summary>Resumo do handoff de 30/07 como estava escrito (histórico)</summary>
>
> **Resumo: não há frente de código aberta — não abra o repo.** Sobraram **três** itens, todos de
> **painel e DNS**. Por ordem:
> (1) 🔴 **SplitJud fora do ar, e o `www` está servindo o site ZUMBI** (`185.158.133.1`, build Vite
> pré-split) para usuário e Googlebot enquanto o IP do site bom (`187.127.2.204`) está morto.
> ✅ **O passo bloqueante caiu:** o Astro roda no **EasyPanel `2.24.207.200`, que está VIVO** e só
> perdeu o vhost (o 404 de 28/07 foi lido ao contrário — 404 prova que o servidor é aquele). Agora é
> tarefa de painel: **reanexar os domínios aos serviços `site`/`app`**, depois apontar os três nomes
> para `2.24.207.200` no **Registro.br** (não Cloudflare). ⛔ Só então apagar o zumbi;
> (2) 🟠 **`compass` já está verde na Vercel** (`compass-ten-plum.vercel.app`) — falta **um A record**
> (`compass → 76.76.21.21`, na **Hostinger**; o domínio já está `verified`) e **9 segredos** (não 8),
> sem os quais `/pricing` fica em 500. Hoje só existem 4 env vars no projeto;
> (3) 🟡 **12 repos sem `homepage`** — mas só **2** dependem de painel: **6 são boilerplate Lovable**
> a arquivar/excluir, 2 são decisão fechada e 1 é o splitjud. ⚠️ Os 2 do painel **não têm atalho por
> CLI**: o CannibalScan não tem página publicada e `aprovai.vercel.app` **é de terceiro**.
> 🟢 Domínio próprio para os 6 sites novos segue opcional.
>
> **Encerrados em 29/07, não reabrir:** o **hub fica fora do próprio ranking** ("roihub é 100% admin,
> não terá site público" — Jean), então a `homepage` vazia do repo é intencional e a checagem de saúde
> **não** deve tratar 401/403 como "no ar"; e o **ProLife saiu do hub** (repos `ProLife` e `mhedicos`
> deletados pelo Jean), o que tira `prolifemed.com.br` do A1.
>
> **Executado em 29/07:** `homepage` preenchida em 8 repos medidos com 200 (`context-keeper`,
> `estetia`, `estetia-demo`, `review-dispute`, `nimblabs`, `roilabs`, `tape`, `aftercare-nimblabs`) +
> `meridian` (EasyPanel) + os **6 repos "não é site" que viraram site**
> ([`handoff-seis-sites.md`](handoff/handoff-seis-sites.md), 6/6 no ar). `cannibal-scan`, `jizreel` e
> `medlly` deletados pelo Jean; `repo-de-teste` fica mas não entra no hub.
> **Repos com `homepage`: 20 → 35. Sem: 31 → 13.** Medição completa em
> [`handoff-compass-e-repos-sem-site.md`](handoff/handoff-compass-e-repos-sem-site.md).
>
> </details>
>
> **Frente anterior** em [`handoff/handoff-21-projetos-no-ar.md`](handoff/handoff-21-projetos-no-ar.md):
> executada em 29/07 — 12 protótipos deployados com os builds consertados, `sirius` e `sofia-ia`
> resolvidos por `homepage` errada, `orion-nova-ui` com a migration que faltava, 9 repos excluídos pelo
> Jean. Guarda as armadilhas caras da sessão (OneDrive quebra `vercel --prod`; `yes | vercel project
> rm` apaga projetos vizinhos; app "fora do ar" pode estar rodando no EasyPanel).
>
> **Estado anterior** (28/07, 3ª sessão) em [`handoff/handoff-proximo-passo.md`](handoff/handoff-proximo-passo.md):
> **o ML fechou (F0–F4) e não há frente de código aberta** — o último
> card podre (`aftercare`) foi reescrito em 28/07 e o que ele pedia já foi ligado no mesmo dia
> (`editorialFocus` B2B, uma linha, não uma feature). O que sobrou é **espera medida**: (1) ver em
> `/seo` se a pauta do robô migrou pro cluster B2B e no `/insights` se **cliques saem do 0** antes do
> D+180 (28/11); (2) duas verificações que só o Jean faz (`/insights` em prod e o run automático de
> 02/08, o primeiro com o `narrate.py` encadeado); e (3) **A1 — três sites de produção fora do ar**
> (`prolifemed.com.br`, `seven-md.com.br`, `compass.polarisia.com.br`), que é **ops de DNS/vhost, não
> commit**: nenhuma sessão de código resolve isso, só acesso ao host.
>
> O hub deixou de ter lista fixa de 10 projetos: agora todo repo do GitHub com `homepage`
> preenchida é um projeto — detalhe técnico em [`handoff/handoff-hub-github.md`](handoff/handoff-hub-github.md).

## Índice dos handoffs (`handoff/`)

Este arquivo é a porta de entrada e o histórico do hub. Os handoffs temáticos vivem em
[`handoff/`](handoff/) — **nome do arquivo preservado**, só mudou a pasta (28/07).

| arquivo | assunto | estado |
|---|---|---|
| [`handoff-proximo-passo-31-07.md`](handoff/handoff-proximo-passo-31-07.md) | **comece por aqui numa sessão de trabalho**: o próximo passo é o `sirius` e o gate de 31/08 (≥5 cliques não-branded/28d, hoje 2). Traz a medição por query/país/página que desmonta o plano do card — `agaas` é query internacional, `crm roi` e `crm solar` estão canibalizados, e o par PT/EN serve **zero `hreflang`** — mais a ordem de execução (hreflang → dono do `crm roi` → CTR do `agaas` → só então conteúdo solar) | 🟢 vivo (31/07) — frente ativa |
| [`handoff-atma-reindexado.md`](handoff/handoff-atma-reindexado.md) | o desfecho da frente mais cara do portfólio — as 5 URLs do Atma medidas em `Submitted and indexed` com crawl de 31/07, o script novo `scripts/inspect-url.mjs`, e por que o resubmit do sitemap (22h55 BRT) reindexou 2 delas antes do pedido manual. O que NÃO concluir: tráfego ainda não reagiu, `decay` fica em 10 | ✅ encerrado 31/07 — só resta reconferir a série em ~14 dias |
| [`handoff-proximo-passo-atma-executado.md`](handoff/handoff-proximo-passo-atma-executado.md) | o que as 3 tarefas viraram em 30/07 e o que sobrou (pedido manual de indexação do Atma + verificar 2 deploys no ar). Traz os 2 achados que só apareceram abrindo o código: o `AggregateOffer` do `orion` também era inventado (4 planos de R$ 299–1.499 contra 3 planos reais) e o sitemap do `pathfinder` listava rotas inexistentes — consertar o DNS do backend teria devolvido um sitemap de 404s | ✅ executado 30/07 — o que sobrava fechou em 31/07 |
| [`handoff-proximo-passo-atma.md`](handoff/handoff-proximo-passo-atma.md) | a receita das 3 tarefas — **ainda é onde estão as 5 URLs do Atma na ordem de valor** e como MEDIR se a reindexação pegou (`coverageState`, não tráfego). O passo manual foi feito pelo Jean em 31/07 e medido no handoff do topo | ✅ executado 30–31/07 |
| [`handoff-curar-os-15-executado.md`](handoff/handoff-curar-os-15-executado.md) | a medição por trás da frente acima: a curadoria fechou (20 → 35, zero não-curados) e destravou o achado mais caro do portfólio — **o Atma desindexado, −98% de impressões, com a queda datada em 09→10/06** — mais o `aggregateRating` fabricado do `orion` num subdomínio de `roilabs.com.br` e o sitemap em 502 `DNS_HOSTNAME_NOT_FOUND` do `pathfinder`. Traz o estado de índice dos 15 e o defeito da régua de score | 🟢 vivo (30/07) — frente ativa |
| [`handoff-curar-os-15.md`](handoff/handoff-curar-os-15.md) | a receita e a régua que originaram a curadoria acima: o grep de host morto que funciona (por URL absoluta, não por nome de env var), a calibração de `receita` e por que `seo`/`decay` são automáticos | ✅ executado 30/07 — 15/15 curados |
| [`handoff-renomear-subdominios.md`](handoff/handoff-renomear-subdominios.md) | encurtar 8 subdomínios para nome de produto, limpar o `synth-bot-buddy` (repo apagado, host em 200) e decidir 2 nomes. Traz a receita do **308 do host antigo** (renomear sem gerar NXDOMAIN) e o PATCH da API da Vercel, que a CLI não expõe | ✅ executado 30/07 — 9 renomeações, zero duplicados |
| [`handoff-proximo-passo-leva-2.md`](handoff/handoff-proximo-passo-leva-2.md) | a 2ª leva de domínios executada de ponta a ponta (15 projetos) e as **5 correções que só apareceram rodando**: título igual não diz qual pasta é deployada, sitemap em 200 não prova deploy, `builds` legado exige `routes`, `git push` desfaz deploy manual, canonical cruzado entre projetos homônimos | ✅ executado 30/07 — **35 próprio × 1 fornecedor** |
| [`handoff-proximo-passo-dominios.md`](handoff/handoff-proximo-passo-dominios.md) | a 1ª leva e a receita de 6 passos que originou tudo: por que host de fornecedor deixa o projeto fora do GSC (a prova do CannibalScan) e o critério de triagem | ✅ executado 30/07 — superado pelos dois acima |
| [`handoff-proximo-passo-02-08.md`](handoff/handoff-proximo-passo-02-08.md) | **comece por aqui**: o próximo passo é uma data (02/08, 1º run do robô de crawl), como medir o NXDOMAIN sem cair na janela de 90 dias, e o que sobra fora do roihub. Inclui a medição dos 3 cards podres da agenda (30/07): branded do Sirius passou, `repo` do tapepro estava errado, sitemap do CannibalScan nunca submetido | 🟢 vivo (30/07) — frente ativa |
| [`handoff-nxdomain-subdominios.md`](handoff/handoff-nxdomain-subdominios.md) | os 14 subdomínios em NXDOMAIN do `roilabs.com.br`: receita, script e as 6 promoções | ✅ executado 29–30/07 — falta só medir com export novo |
| [`handoff-proximo-passo-30-07.md`](handoff/handoff-proximo-passo-30-07.md) | briefing anterior: os 3 itens de painel/DNS, o que foi encerrado, e como medir DNS sem errar | ⚠️ superado 30/07 — os 3 itens saíram; guarda as armadilhas de DNS |
| [`handoff-dns-e-paineis.md`](handoff/handoff-dns-e-paineis.md) | a medição detalhada por trás do briefing acima: IPs, NS, fingerprint do zumbi do splitjud, os 12 repos sem `homepage` | 🟢 vivo (29/07) — referência do item ativo |
| [`handoff-compass-e-repos-sem-site.md`](handoff/handoff-compass-e-repos-sem-site.md) | a medição que gerou a frente acima: `compass`, repos sem `homepage`, os 2 sites mortos em `187.127.2.204` | ✅ executado 29/07 — 9 `homepage` preenchidas |
| [`handoff-seis-sites.md`](handoff/handoff-seis-sites.md) | as 6 landing pages novas (lib/CLI/API que viraram site) e o padrão que as gerou | ✅ executado 29/07 — 6/6 no ar |
| [`handoff-21-projetos-no-ar.md`](handoff/handoff-21-projetos-no-ar.md) | recolocar no ar os projetos apagados da Vercel + armadilhas de deploy | ✅ executado 29/07 — 19/20 no ar |
| [`handoff-proximo-passo.md`](handoff/handoff-proximo-passo.md) | espera medida do ML + A1 (ops de DNS/vhost) | ⚠️ superado 29/07 por `handoff-proximo-passo-30-07.md` — o A1 encolheu (`prolifemed` saiu com a exclusão do repo); a **espera medida do ML segue válida** |
| [`handoff-ml.md`](handoff/handoff-ml.md) | motor de ML (`ml/`), F0–F4, decisões de modelagem | 🟢 vivo — F0–F4 completos |
| [`handoff-hub-github.md`](handoff/handoff-hub-github.md) | projetos vêm do GitHub (repo com `homepage`), não de lista fixa | 🟢 vivo (28/07) |
| [`handoff-crawl-stats-semanal.md`](handoff/handoff-crawl-stats-semanal.md) | robô Playwright que abastece `/infra` + `/insights` toda semana | 🟢 vivo — agendado dom. 10:00 |
| [`handoff-autopublish.md`](handoff/handoff-autopublish.md) | como o robô de 1 artigo/dia funciona (guardrails, operação) | 📘 referência |
| [`handoff-polimento-editorial.md`](handoff/handoff-polimento-editorial.md) | qualidade do artigo gerado (não encanamento) | 📘 referência |
| [`handoff-insights-automatico.md`](handoff/handoff-insights-automatico.md) | o `/insights` parar de envelhecer (acoplado ao robô de crawl) | ✅ executado 25/07 |
| [`handoff-crawl-plano-acao.md`](handoff/handoff-crawl-plano-acao.md) | plano de ação de crawl por projeto (datado no CSV) | ✅ executado 25/07 |
| [`handoff-ativacao-total.md`](handoff/handoff-ativacao-total.md) | ligar os 10 projetos do autopublishing + horário do cron | ✅ executado 25/07 |
| [`handoff-correcao-e-rollout.md`](handoff/handoff-correcao-e-rollout.md) | correção dos 3 primeiros artigos + rollout | ✅ executado 25/07 |

**O que é:** hub administrativo dos 10 projetos full-SEO em `hub.roilabs.com.br` (EasyPanel, repo privado `JeanZorzetti/roihub`, deploy por push). Rankeia por score de prioridade 0–100 e responde: **em qual projeto trabalhar hoje**. SplitJud fica de fora por decisão do Jean (10/07/2026) — projeto dividido com o Aldo.

## 28/07 (2ª sessão) — F4: o hub passou a explicar em português; handoffs organizados em `handoff/`

- **Organização dos handoffs.** Os 10 temáticos saíram da raiz pra [`handoff/`](handoff/) (nome de
  arquivo preservado — as referências cruzadas entre eles continuam válidas de graça) e este
  arquivo ganhou o índice no topo, com o estado de cada um (vivo / referência / executado).
- **F4 — narrativa (`ml/narrate.py`)**: cada card do `/insights` abre com 2–3 frases em pt-BR
  escritas pelo `claude-cli` em cima do próprio `insights.json`. **Uma chamada por run** com todos
  os projetos no mesmo prompt — o gargalo é rate limit de assinatura, não token, então 11 prompts
  pequenos só multiplicariam a chance de 429. 11/11 no primeiro run.
- **O prompt leva fatos, não o JSON cru** (`project_facts`): uma linha por sinal. E leva as regras
  duras do portfólio (só os números do JSON, nunca mídia paga, `insufficient-data` é série curta e
  não queda, banda larga é incerteza do modelo) — sem elas o modelo lê "sem dados" como notícia ruim.
- **A ordem importa e é por design:** o `analyze.py` reescreve o arquivo inteiro com
  `narrative: None`, então narrativa velha nunca sobrevive a número novo — e por isso o `/insights`
  não precisa de checagem de staleness nenhuma. O preço: sem rodar o narrate depois, o card fica
  sem prosa. Por isso o robô de crawl encadeia os dois — mas a falha do narrate **não** entra no
  exit code dele (enfeite em cima do número; rate limit não é robô quebrado).
- Já saiu insight de negócio do primeiro run: **sirius** com impressões subindo e cliques caindo
  14%/sem = problema de CTR (title/meta), não de ranking; **nimblabs** com posição média piorando
  de 64,8 → 69,1 enquanto impressões crescem = conteúdo novo indexando fundo.
- Verificado: 24/24 pytest (6 novos, todos em função pura — nenhum spawna o CLI), 128/128 npm test,
  tsc limpo, build 5 rotas ƒ, e a página renderizada em dev com as 11 narrativas reais.

## 28/07 (noite) — F3: o hub passou a responder o kill-gate sozinho (+ as 2 tarefas de ops)

Sessão fechou 3 das 4 frentes do handoff anterior (`7d2ec87`). O que ficou de aprendizado:

- **F3 — forecast + kill-gates** (`ml/forecast.py`, render em `/insights`). Holt amortecido
  (ETS(A,Ad,N)) em `log1p` da série semanal do GSC, **sem statsmodels**: 68 pontos semanais não
  sustentam sazonalidade nenhuma, e impressão de site novo cresce multiplicativamente (1 → 540 em
  9 semanas), onde tendência aditiva na escala crua subestima a curva e projeta negativo. Intervalo
  de **80%** com a variância h-passos exata (Hyndman tab. 7.8) — a aproximação sem trend dá banda
  estreita, e banda estreita numa decisão de **matar um bet** é falsa confiança. Decisões que não
  devem ser reabertas estão em `handoff/handoff-ml.md` (bloco "STATUS 28/07").
- **O primeiro run já mudou uma decisão de negócio, não só a tela:** Aftercare **passou** o D+90
  (540 imp/sem contra o gate de 100) **um mês antes** de 30/08; ReviewShield **não cruza** (~84,
  banda 35–200) até 02/09; Context Keeper saiu do zero absoluto (49 imp/sem, era 0 em 11/07 — o
  Request Indexing pegou) mas ainda é curto demais pra projetar.
- **Nova instância da armadilha dos cards podres:** o `acao` do aftercare manda fazer à mão a
  leitura que o hub agora faz sozinho. **Toda automação nova candidata um card a apodrecer** —
  quem ligar a automação atualiza o card no mesmo commit.
- **A2 — robô de crawl stats agendado** (domingo 10:00 BRT, primeiro disparo 02/08). `schtasks`
  **não serve**: o CLI não expõe `StartWhenAvailable` ("run if missed"), que era exatamente o
  requisito. `Register-ScheduledTask` expõe, e o `-WorkingDirectory` ainda resolve o gotcha do
  Task Scheduler iniciar em `System32` (o `git add` cairia no lugar errado). Até aqui o `/infra`
  congelava em 25/07.
- **A3 — `Atma` arquivado.** Repo arquivado é ignorado pelo hub e o histórico continua lá: **é a
  forma canônica de aposentar um projeto**, melhor que limpar a `homepage` (paliativo de 28/07).
- Verificado: 18/18 pytest (7 novos), 128/128 npm test, tsc limpo, build 5 rotas ƒ, e a página
  renderizada em dev com os dados reais das 3 apostas.

## 13/07 — auditoria dos 10 cards de ação: 3 estavam improcedentes/errados; convenção "Repo:" adotada

- **Gatilho (Jean):** "já é a quarta tarefa improcedente que pego da agenda". Auditei os 10 `acao`/`acaoDesc` do
  projects.json contra os repos e a prod ANTES de reescrever — cada afirmação nova tem verificação datada.
- **Padrão da falha (é processo, não código):** os cards são texto curado à mão; o trabalho acontece
  (ou uma investigação conclui) e ninguém volta pra atualizar o card — o hub segue mandando executar
  o que já morreu. Agravante: nenhum card dizia **em qual repo** executar.
- **Caso pior (13/07):** o card do **estetiacrm** ("233 console.* → pino") foi executado **no monorepo roilabs**
  por engano — sem "Repo:" no texto, o executor assumiu o repo errado. A premissa numérica era quase certa
  **no Doc-CRM**: 1.084 console.* versionados, ~222 em runtime (lib 76, components 74, app 52, hooks 18).
  E "pino" era prescrição errada: Doc-CRM builda `output: standalone` (worker_threads do transport não é
  traçado no bundle; quebra só em prod). Card reescrito: logger JSON zero-dep, referência em
  `ROI Labs/app/src/lib/log.ts` (shipped 13/07 no roilabs).
- **goiania:** "Consertar IndexNow 403" → causa JÁ achada 13/07 (Bing não conhece o subdomínio; Yandex 202
  prova chave/arquivo ok). Card virou o desbloqueio real: **manual**, verificar o host no Bing Webmaster Tools.
- **roilabs:** "Investigar crawl 40,6% OK" → investigação CONCLUÍDA 13/07, zero bug vivo (Crawl Stats = média
  de 90 dias; 222/234 requisições pré-fix; www 301 e /obrigado noindex sondados hoje). Card virou a tarefa viva
  e verificada: logo de 173.709 bytes em `site/public/roilabs-logo.png` (conferido em disco hoje).
- **Válidos, mantidos:** sirius (gate 28/07), fabrica (sitemap GSC — pendente por handoff de hoje), polarisia
  (spec 012), reviewshield (/checker p78), context (**llms.txt confirmado 404 hoje**), aftercare (gate ~29/08),
  nimblabs (backlink npm; adicionado aviso pra DATAR as falhas antes de investigar o "60,3% OK" — mesmo gotcha
  de 90 dias do roilabs).
- **Convenção nova:** todo card com tarefa de dev começa com `Repo: …` (ou `MANUAL (Jean…)`). Ao fechar
  trabalho de um projeto, **atualizar o card no projects.json faz parte do fechamento** — o rodapé da /agenda
  já dizia isso; agora é regra de handoff.
- Verificado: JSON parseia (10 projetos, todos com acao+acaoDesc), suíte verde. projects.json é import
  estático — o push publica via redeploy automático.

## 12/07 — recorrência DIÁRIA na agenda (weekday=7) + 10 tarefas de artigo/dia

- Pedido do Jean: 10 tarefas contínuas, 1 por projeto, "publicar um novo artigo por dia". A agenda só tinha recorrência semanal (weekday 0-6) → **`weekday = 7` agora = diária** (ocorrência sempre = hoje; cai no bucket "Hoje" e reseta a cada dia). Diff mínimo: 1 branch em `nextOccurrence()` (lib/agenda.mjs), label "todo dia" no meta, opção nos 2 selects (add + modal), regex `^[0-7]$` no actions.ts, e CHECK do banco trocado de 0-6 → 0-7 (par DROP IF EXISTS + ADD no `ensure()`, idempotente — padrão aditivo; já apliquei no PROD direto).
- **10 tarefas inseridas** (ids 6–15): "Publicar 1 artigo novo no blog", weekday=7, uma por slug do projects.json, com descrição de cadência. Inserção idempotente (checa título+projeto+weekday antes).
- Ação da fabrica "Publicar artigos 4–20..." **EXECUTADA** (blog do estetia-demo 3→20 artigos, ver handoff s5 lá) → marcada feita em hub_done (`acao:fabrica:e0c29431`) e card atualizado: nova acao = submeter sitemap + indexação no GSC.
- Verificado: tsc 0 erros, testes (incl. 2 casos novos de `nextOccurrence(7,…)`).

## 12/07 — ação do Context Keeper era fantasma: publish já tinha saído em 10/06

- Pedido do Jean: executar "npm publish do daemon com os 4 fixes e2e" e atualizar a /agenda. Verificado no registry ANTES de publicar: `@jeanzorzetti/context-keeper@1.2.0` (e MCP 0.2.0) publicados em **10/06 16:32 UTC** — tarball conferido (contém `quality.js`/providers/hook + `response_format: json_object` no groq.js, o fix do bug 4). Nada a publicar; a ação do ranking estava desatualizada (memória/projects.json).
- Atualização: `projects.json` do card `context` → blocker removido (`blockers` 5→2, lista vazia), acaoDesc com ✅ e nova acao "Hashear User.apiToken (hoje plaintext no banco)" (confirmado no código: `findUnique({ where: { apiToken } })`). Ação antiga marcada feita em `hub_done` (`acao:context:9547cb72`) pro histórico.
- Verificação da página ao vivo bloqueada por basic auth (HUB_PASS só no EasyPanel); dados conferidos direto nas duas fontes da página (projects.json na main + hub_done no PG).

## 11/07 — SEM Google Ads em nenhum projeto (decisão do Jean)

- Portfólio é **100% SEO** — nada de tráfego pago, nem branded defense. A ação "Subir Google Ads branded 'sirius crm'" (reintroduzida em `33ea5f2` após a investigação do declining) foi trocada por: validar entity SEO em prod (Rich Results Test) + medir posição branded no GSC ~28/07; sem recuperação → reforçar entity SEO on-site.
- Regra pra edições futuras do projects.json (soma à regra "só tarefa DEV"): **acao/blockers nunca propõem mídia paga**.

## 11/07 — /agenda ordena as ações pelo ranking da home

- Pedido do Jean: "Ações dos projetos" estava na ordem do arquivo projects.json, não na prioridade da home. `evaluate()`/`evaluateAll()` extraídos de `app/page.tsx` para `lib/evaluate.ts` (fonte única de score) — home e agenda usam a MESMA avaliação ao vivo (saúde + GSC + insights), então a ordem nunca diverge. Cada ação ganhou meta `#N · score S`.
- Custo: /agenda agora faz os mesmos 10 health checks + 10 gscTrend da home a cada load (paralelo, 1 usuário — ok; se pesar, cachear o evaluateAll por request/minuto).
- Tarefas do banco (buckets datados) seguem ordenadas por data/id — prioridade por projeto dentro do bucket não foi pedida (adicionar se fizer falta).
- Verificado E2E local: DOM da /agenda com pendentes #2..#10 na ordem exata da home (#1 goiania em Feitas por já estar riscada).

## 11/07 — home risca ações já feitas na agenda

- Pedido do Jean: a home não refletia o check da /agenda. Agora a home lê o mesmo `hub_done` (`listDone()`, chave `acao:{slug}:{hash8(acao)}@1970-01-01`) e risca a ação no hero (✓ + cinza) e na coluna "Próxima ação". Sem `DATABASE_URL`/DB fora → nada riscado (catch → set vazio, hub nunca cai por DB).
- Home ganhou `force-dynamic` explícito (antes dependia só do `no-store` do health check; agora tem query PG).
- Riscar ≠ concluir: conclusão real segue sendo trocar a ação no projects.json (rodapé explica).
- Verificado E2E local com DB real (goiania riscada de verdade + sirius com row de teste, removida depois).

## 11/07 — data de início no GSC por projeto (`gscInicio`)

- Pedido do Jean: marcar quando cada projeto entrou no GSC pra ter régua de revisão de performance/crawl. Decisão (confirmada): **campo opcional `gscInicio: "AAAA-MM-DD"` no projects.json** — sem DB, sem arquivo novo; editar+push como todo metadado manual.
- Exibição via `sinceGsc()` em `app/viz.tsx`: "/seo" mostra "· GSC desde 28/06 · D+13" ao lado da URL do card; "/infra" mostra no "cobre: Nome (GSC desde … · D+N)". Projeto sem o campo não mostra nada.
- Preenchido por enquanto **só goiânia (28/06/2026)** — os outros 9 entram quando o Jean confirmar as datas.

## 11/07 — agenda: modal de edição de tarefa

- Pedido do Jean: clicar na tarefa → modal de edição. Título da tarefa (só as do banco; "ações do ranking" continuam texto) virou botão que abre `<dialog>` nativo com os mesmos campos do form de adicionar (título, data, recorrência, projeto) → server action `update` → `UPDATE hub_tasks`.
- **+ campo `descricao`** (pedido seguinte): coluna nova via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` no `ensure()` (o padrão aditivo combinado), textarea no modal (2000 chars), exibida em cinza sob o título quando a tarefa está pendente (some quando feita). Form de adicionar NÃO tem o campo — descrição entra pelo modal. As 3 tarefas seed já foram descritas direto no banco (passo-a-passo da rotina de sexta; alerta do serper quebrado 06/07 no rank tracking; pré-requisitos do checkpoint da malha).
- Único client component da aba: `app/agenda/edit-task.tsx` (precisa de `showModal()`); resto segue 100% server. Parsing de campos unificado em `taskFields()` no actions.ts (add e update validam igual).
- Done antigo não é limpo ao mudar data/recorrência: linhas órfãs em `hub_done` são inertes (lookup usa a ocorrência nova).
- Verificado: tsc + build + 24/24 testes.

## 11/07 — aba Agenda (checklist com persistência em Postgres)

- Pedido do Jean: "calendário com checklist" interativo. Duas correções dele mudaram o desenho: o vault Obsidian só cobre roilabs/goiânia (2 de 10 — o hub é o único agregador dos 10) e o "sem-DB" era decisão minha, não requisito dele → **agora tem Postgres**.
- **DB: `roihub_db` DEDICADO** (`2.24.207.200:5445`, user `roihub_db` — o Jean criou na EasyPanel em 11/07; a 1ª versão usava o servidor do roilabs_db com prefixo `hub_`, tabelas de lá já dropadas): `hub_tasks` (titulo, projeto?, due?, weekday? 0-6 = recorrente semanal) e `hub_done` (key, occurrence, PK composto). Sem migration formal por design: schema auto-criado no 1º uso (`CREATE TABLE IF NOT EXISTS` em `lib/db.ts`, pool pg singleton) — schema novo no futuro = editar o `ensure()` (aditivo) ou rodar SQL manual. Schema + seeds já aplicados no banco dedicado em 11/07. Sem `DATABASE_URL` → banner de setup + ações do ranking em modo leitura.
- `/agenda`: buckets Atrasadas / Hoje / Próximos 7 dias / Mais tarde / Sem data + **"Ações dos projetos"** (espelha a `acao` do projects.json de graça — key com hash do texto, mudou a ação = check reseta) + "✓ Feitas" recolhido com undo. Form de nova tarefa (data OU recorrência semanal + projeto opcional). Tudo server actions + forms, zero JS no cliente; helpers de data puros em `lib/agenda.mjs` (fuso São Paulo, testados).
- Recorrente reseta a cada ocorrência (done por data); ocorrência perdida some sem cobrar (ponytail: sem nag de recorrente atrasado — upgrade se fizer falta).
- Seeds no DB (11/07): rotina de sexta (crawl+analyze.py), conferir rank tracking (toda segunda), checkpoint da malha 15/07.
- Verificado: 24/24 testes, build limpo, **E2E local com DB real** (marcar→Feitas, desmarcar, adicionar, apagar via Playwright).
- ⚠️ **Ops pendente (Jean, 2 min): setar `DATABASE_URL` na EasyPanel do hub + redeploy** — valor no `.env` local (externo `2.24.207.200:5445/roihub_db`; do serviço na mesma EasyPanel o hostname interno do postgres novo na porta 5432 também vale). Senha PG segue na lista de rotação.

## 11/07 — hub é só do Jean (dev): tarefas comerciais fora da equação

- Decisão do Jean: captação/comercial é da Maria Eduarda e NÃO entra no ranking. `projects.json` limpo: goiânia perdeu o blocker "contatar fornecedor" (9→4, ação virou os secrets do checkpoint 15/07 + redirects do crawl), sirius perdeu "subir Google Ads" (7→2, ação virou investigar o trend declining do /insights), reviewshield perdeu "primeiro outreach US" (6→4). Receita segue intocada — mede valor na mesa, não tarefa.
- **Regra pra edições futuras do projects.json: blockers/acao = só tarefa DEV.** Tarefas da Duda vivem no vault (`backlog-pendencias` seção "Não-dev").
- Ranking resultante (sim. com seoSeed): goiania 64 > sirius 56 > fabrica 55 > roilabs 55 > …

## 11/07 — decay do score agora vem do insights.json (ML)

- **Pedido do Jean**: o ranking da home não reagia às abas novas; o `/insights` já tinha `health` 0–100 por projeto sem alimentar o score. Semântica confirmada com ele: saúde baixa = precisa de atenção = decay ALTO (mapeamento invertido).
- `decayFromHealth(health, generatedAt)` em `lib/score.mjs`: `10 − saúde/10`, só quando o insights.json foi gerado há ≤ 10 dias (mesma régua de "velho" do /insights); senão `null` → cai no `decay` manual do projects.json. Site fora do ar continua forçando 10 (precedência máxima).
- Flags do insights (hoje só `crawl-waste`, com o detail do crawl) entram como linhas ⚠ nos blockers exibidos do foco — **não** mudam a nota `blockers` (manual).
- Meter do foco ganha sufixo "· ML" quando o decay é automático; rodapé explica a regra.
- Efeito medido na simulação (seoSeed, dados de 10/07): top 4 estável (receita+blockers dominam); polarisia (saúde 80) cai 5º→8º; context/nimblabs/estetiacrm/reviewshield (crawl-waste) sobem. Ou seja: rodar `ml/analyze.py` na sexta agora move o ranking sozinho.
- Testes 19/19 (`decayFromHealth` coberto) + tsc limpo.

## Estado atual (fim da sessão de 10/07, tarde)

- **App no ar** em `hub.roilabs.com.br` com basic auth. **GSC conectado em prod** (rodapé "conectado — 10 propriedades", confirmado pelo Jean 10/07).
- **Aba SEO de progressão SHIPPED** nesta sessão: `/seo` com small multiples (1 card por projeto), verificada local com dados reais (10/10 cards com GSC).
  - Por card: 3 stats 28d vs 28d anteriores (cliques Δ%, impressões Δ%, posição média Δ absoluto com leitura invertida — cair é verde) + 2 mini-gráficos de colunas de 12 semanas (cliques/sem e impressões/sem, séries separadas — nunca 2 escalas num eixo).
  - Sem DB: `gscSeries()` busca 84 dias diários da API (16 meses de histórico disponível), `lib/series.mjs` agrega em semanas e janelas 28d na hora, a cada load (`force-dynamic`).
  - Posição média ponderada por impressões (média simples mente); semana/janela sem impressão → `—`.
  - Tooltip = `<title>` nativo do SVG (sem JS no cliente); tabela-gêmea em `<details>` cobre teclado/a11y. Upgrade pra tooltip JS só se fizer falta.
  - Cards ordenados por impressões 28d desc; projeto sem propriedade GSC → estado vazio honesto com pill SEED.
  - Navegação por abas (Ranking | SEO) no topo das duas páginas; chrome compartilhado em `app/tabs.tsx` (Tabs + GscFoot).

- **Aba Infra (crawl stats) SHIPPED 10/07** (`d930830`): `/infra` lê os exports manuais de "Estatísticas de rastreamento" do GSC (a API NÃO expõe crawl stats). 1 card por propriedade: requisições 28d Δ%, resposta média 28d ponderada (cair = melhor), % por classe de resposta (OK/redirect/404/5xx/outros) com alerta (OK < 85% ou 5xx ≥ 1%), 2 charts de 12 semanas, tabela semanal por card. Verificado local com 9 propriedades reais.
  - **Rotina de sexta do Jean**: GSC → Configurações → Estatísticas de rastreamento → Exportar; descompactar em `docs/` (qualquer subpasta) e **commit+push** — o nome da pasta (`{host}-Crawl-stats-AAAA-MM-DD`) identifica host e data, o app acha sozinho (scan recursivo).
  - Cada export cobre 90 dias; exports de semanas seguintes se emendam por data (merge, export mais novo vence no dia sobreposto) — histórico cresce sem DB.
  - Achados do 1º export (10/07): roilabs.com.br só 40,6% OK (32,5% redirect + 22,7% outros!), goiania 65,2% OK (33,6% redirect — eco do gotcha trailing-slash do nginx), nimblabs 60,3% OK. Candidatos a investigação.

## Arquivos-chave

- `lib/gsc.ts` — auth + sites.list (cache 10 min) + `gscTrend` (home) + `gscSeries`/`queryTimeseries` (aba SEO, `dimensions:["date"]`).
- `lib/series.mjs` — agregação pura da série GSC (bucketWeeks, totals28, addDays), JS+JSDoc.
- `lib/crawl.mjs` — parse dos CSVs de crawl stats (localizados pt-BR: parse por POSIÇÃO de coluna; classe "(5xx)" agrupada no label), merge de exports, buckets.
- `app/viz.tsx` — WeekChart/Stat/Delta/InvDelta compartilhados entre /seo e /infra (100% server, tooltip `<title>` SVG).
- `app/seo/page.tsx` e `app/infra/page.tsx` — as abas.
- `data/projects.json` — critérios manuais; editar + push = redeploy.
- `ml/forecast.py` — Holt amortecido + kill-gates da tese nimblabs (relógios vêm de
  `nimblabs/docs/PORTFOLIO-EN-STRATEGY.md` §6: data da **submissão do sitemap**, não do deploy).
- `ml/narrate.py` — F4: 1 chamada de claude-cli por run escreve o `narrative` de cada projeto. Roda
  DEPOIS do analyze.py (que zera as narrativas); `--dry-run` mostra o prompt sem chamar o CLI.
- `npm test` — 128/128 (score + series + crawl + agenda + autopublish + projects). Node 22: listar
  arquivos explícitos no script (dir não resolve). ML: `C:\venvs\roihub-ml\Scripts\python -m pytest ml/test_ml.py -q` (24/24).
- Dockerfile copia `docs/` pra imagem (a /infra lê via fs em runtime).

## Commits (todos na main, deploy automático)

- `879c5fa` app inicial completo (score+health+GSC+auth+Docker)
- `3b4c7f3` GSC auto-descoberta de propriedades (sites.list, cache 10 min, filtro por host)
- `3d2c552` linha de status GSC no rodapé
- `c4e1e50` fix: env malformada mostrava 500 em vez do estado de erro
- (10/07 tarde) aba SEO de progressão — ver `git log`

## Decisões de arquitetura

- **Sem DB**: critérios manuais em `data/projects.json` versionado. Histórico SEO vem da API do GSC a cada load — 10 projetos × 1 request, latência ok pra 1 usuário.
- **Página dinâmica** (sem ISR): 1 usuário, health `no-store`; site fora do ar → decay forçado 10 + banner.
- **Service account REUSADA** do projeto GCP `review-dispute-agent-498311` (API já ativa). ⚠️ Se esse projeto GCP for deletado, o hub perde o GSC.
- Basic auth fail-closed: sem `HUB_PASS` em produção → 503.
- Score em `lib/score.mjs`, agregação em `lib/series.mjs` (JS puro com JSDoc pra rodar no node:test sem tooling).

## Aba Insights (ML) — SHIPPED 10/07 (noite)

- **F0–F2 do `handoff/handoff-ml.md` implementados**: `ml/` (Python 3.13, venv em `C:\venvs\roihub-ml`) gera `data/insights.json` (versionado) e a aba `/insights` renderiza — health 0–100 explicável, tendência Theil-Sen 4/12/26 sem, changepoints PELT, anomalias MAD, diagnóstico crawl↔SEO. Detalhes/gotchas/pendências (F3 forecast, F4 narrativa) em `handoff/handoff-ml.md`.
- **Rotina de sexta agora**: export de crawl em `docs/` → `C:\venvs\roihub-ml\Scripts\python ml\analyze.py` → commit+push.
- pytest 11/11 em `ml/test_ml.py`; extração validada 100% contra os totais 28d do hub.

## Próximos candidatos

- **A1 (ops, não código): 3 sites de produção fora do ar** — detalhe e diagnóstico já feito em
  `handoff/handoff-proximo-passo.md`. É o item de maior impacto e nenhuma sessão de código o resolve.
- Calibrar o threshold do gate D+180 (10 cliques/sem, constante em `GATE_SPECS`) quando 28/11 se
  aproximar: é o único número do sistema que não sai de um documento.
- **Medir o custo da home em prod** (38 projetos × 1 health check + 2 queries GSC; 2,2–3,0 s em
  dev). Medir antes de otimizar; se doer, cachear o health check por minutos resolve.
- Conferir `/seo`, `/infra` e `/insights` em prod depois do deploy (deploy é automático no push).
- `.env` local com a credencial agora existe (gitignorado) — dev local mostra dados reais.
- Se a aba SEO pedir interação real (crosshair, filtro de janela), aí sim entra client JS — hoje é 100% server.

## Gotchas (vários valem pra qualquer projeto novo nesta máquina)

- **TypeScript pinado `^5`**: npm resolve TS 7 por padrão e o build do Next 16 quebra com ele.
- **`turbopack.root` obrigatório** no next.config: há um `package-lock.json` solto em `C:\Users\jeanz` que faz o Next inferir o root errado.
- **PS 5.1 + git commit**: aspas duplas dentro de here-string `-m` quebram o argumento — usar o Bash tool ou não usar `"` na mensagem.
- **Matar dev server**: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where { $_.CommandLine -match "next" } | ForEach { Stop-Process -Id $_.ProcessId -Force }` — kill simples deixa órfão segurando a porta 3000.
- **`node --test <dir>` não resolve no Node 22** — listar os arquivos de teste explícitos no script.
- GSC atrasa ~3 dias; janelas de 28d e semanas fecham em D-3.
- Falha de GSC nunca derruba o hub — home cai pro `seoSeed` (pill SEED), `/seo` mostra estado vazio; `gscStatus` reporta o motivo no rodapé das duas.
- Warning "middleware → proxy" no build é só deprecation do Next 16 (e o "1 Issue" no dev overlay é DeprecationWarning de zlib de dependência — ignorar).
