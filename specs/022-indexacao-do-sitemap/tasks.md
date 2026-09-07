---

description: "Tarefas da 022 — indexação do sitemap: o denominador que faltava ao board"
---

# Tasks: Indexação do sitemap — quanto do que o site declara está no índice

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api-indexacao.md` em
`/specs/022-indexacao-do-sitemap/`

**Testes**: obrigatórios. O Princípio II da constituição é não-negociável, e todo arquivo de teste
novo entra na lista de `package.json` **no mesmo commit** que o cria — `test/validade.test.mjs`
reprova quem esquecer.

**Organização**: por user story, na ordem em que se destravam. Cada fase vai para `main` sozinha.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência)
- **[Story]**: `[US1]`, `[US2]`, `[US3]` — fases de user story apenas

---

## Phase 1: Fundação (bloqueia tudo)

**Purpose**: o inventário e a persistência. Nenhuma inspeção é gasta aqui — ler sitemap é `fetch`
HTTP, não quota do GSC. Sem dependência nova: `npm ci` é o setup inteiro.

- [X] **T001** [P] Criar `lib/sitemap.mjs` com `locs(corpo)` — todas as `<loc>` **na ordem do
      arquivo, sem deduplicar** — e `ehIndice(corpo)` (`/<sitemapindex/i`). Módulo puro:
      sem `pg`, sem `fetch`, sem `process.env` (Princípio III).
- [X] **T002** `lib/sitemap.mjs`: `lerSitemap(url, buscar)` → `{urls, motivo, filhos,
      profundidadeExcedida}`. Quando o corpo é `<sitemapindex>`, buscar **todos** os filhos e
      concatenar na ordem (FR-002) — `VER-04` de `lib/conformidade.mjs` desce um nível **para um
      item só**, e é isso que subconta o site. `buscar` é injetada (`lib/conformidade.mjs:216`),
      nunca importada por dentro: é o que permite testar sem rede.
- [X] **T003** `lib/sitemap.mjs`: dedupe preservando a **primeira** ocorrência, e teto de
      profundidade 1 — índice dentro de índice devolve o que achou com
      `profundidadeExcedida: true`. Reordenar mudaria a amostra entre corridas e violaria a
      SC-004; `<loc>` repetida entre filhos dobraria o denominador em silêncio (D6).
- [X] **T004** `lib/sitemap.mjs`: `motivo` por `julgarSitemap()` (`lib/conformidade.mjs:45`),
      reusada e não reescrita — corpo não-XML ⇒ `sem_sitemap` (é a **ausência** de sitemap, não um
      sitemap vazio); XML válido com zero `<loc>` ⇒ `sitemap_vazio`; senão `null` (FR-003).
- [X] **T005** [P] Criar `test/sitemap.test.mjs` e **registrar em `package.json` no mesmo
      commit**: sitemap simples, `<sitemapindex>` com 3 filhos (soma, não o primeiro), `<loc>`
      repetida entre filhos, HTML de catch-all ⇒ `sem_sitemap`, XML vazio ⇒ `sitemap_vazio`,
      índice aninhado ⇒ `profundidadeExcedida`.
- [X] **T006** `lib/db.ts`: `CREATE TABLE IF NOT EXISTS hub_indexacao` no `ensure()`, colunas de
      `data-model.md` §1, PK `(projeto, dia)`. **Sem coluna de taxa** — ela é
      `indexadas ÷ (inspecionadas − falhas)` e uma coluna só cria chance de divergir da divisão.
- [X] **T007** `lib/db.ts`: `gravarIndexacao(projeto, apuracao)` com
      `ON CONFLICT (projeto, dia) DO UPDATE SET ..., criado = now()`, no padrão de `gravarDiasGsc`
      (`lib/db.ts:798`). Rodar duas vezes no mesmo dia regrava, não duplica.
- [X] **T008** `lib/db.ts`: `lerIndexacao(projeto)` → a **última** apuração ou `null`, no tipo
      `Apuracao` de `contracts/api-indexacao.md`. `dia` é obrigatório na saída: a FR-014 obriga a
      tela a datar o número.
- [X] **T009** `lib/db.ts`: `ultimasApuracoes()` → `{projeto, dia}[]`. É a fila do rodízio (D2),
      derivada da própria tabela — **sem** tabela de cursor, que pode divergir do que foi gravado
      quando a corrida morre no meio.

**Checkpoint**: dá para listar o inventário real de um projeto sem tocar no GSC (passo 3 do
`quickstart.md`) e o banco já aceita a linha do dia.

---

## Phase 2: US1 — Que fatia do que o site declara está no índice (P1) 🎯 MVP

**Goal**: o denominador passa a existir. A aba de aquisição diz `indexadas ÷ inspecionadas`, com a
data e o tamanho da amostra na mesma frase.

**Independent Test**: rodar a corrida para um projeto de sitemap conhecido e conferir que
`declaradas` bate com o número de `<loc>` do arquivo, e que a fração exibida é
`indexadas ÷ inspecionadas` — **nunca** `indexadas ÷ declaradas` quando houve amostra.

- [X] **T010** [US1] Criar `lib/indexacao-corrida.mjs` (puro) com `filaDoDia(candidatos)`: ordena
      por `ultimaApuracao` ascendente, `null` primeiro, desempate por `slug` para ser
      determinística (D2).
- [X] **T011** [US1] `lib/indexacao-corrida.mjs`: `repartir(fila, tetoPorPropriedade,
      tetoDaCorrida)` — percorre a fila e dá a cada projeto
      `min(declaradas, saldo da propriedade, saldo da corrida)`, decrementando o saldo **por
      propriedade**. Cota `0` ⇒ `motivo: 'sem_orcamento'` (FR-005, FR-015). É o coração da SC-003:
      21 projetos na mesma propriedade dividem 2.000, não têm 2.000 cada.
- [X] **T012** [US1] `lib/indexacao-corrida.mjs`: `amostra(urls, cota)` = `urls.slice(0, cota)`.
      Prefixo do sitemap, sem embaralhar e sem semente — estável entre corridas por construção
      (SC-004, D3).
- [X] **T013** [US1] `lib/indexacao-corrida.mjs`: `classificar(linha)` nas cinco classes, **nesta
      ordem**: `erro` não vazio ⇒ `falha` (primeiro de tudo — resposta de erro tem `verdict: ""` e
      cairia em "outra"), `estaIndexada(linha)` (`lib/indexacao.mjs:84`, reusada) ⇒ `indexada`,
      `/^Crawled - currently not indexed/i` ⇒ `rastreada_nao_indexada`,
      `/^Discovered - currently not indexed/i` ⇒ `descoberta_nao_indexada`, resto ⇒ `outra`.
      É a FR-008 no código.
- [X] **T014** [US1] `lib/indexacao-corrida.mjs`: `agregar(linhas)` — as cinco contagens mais
      `taxa` (`indexadas ÷ (inspecionadas − falhas)`) e `rejeicao`, **ambas `null`** quando o
      denominador é 0. Denominador zero é "não apurado", nunca 0%.
- [X] **T015** [P] [US1] Criar `test/indexacao-corrida.test.mjs` e **registrar em `package.json`
      no mesmo commit**. No mínimo: **SC-003** — 21 projetos fictícios de 1.000 URLs na mesma
      propriedade com teto 2.000, soma das cotas exatamente 2.000 e não 21.000; **SC-004** —
      `amostra` duas vezes sobre o mesmo inventário devolve o mesmo array, e devolve o mesmo
      prefixo depois de o sitemap ganhar URLs no fim; **SC-005** —
      `classificar({erro: "429 quota exceeded"})` ⇒ `falha`, e `agregar` com 3 falhas em 10 linhas
      divide por **7**, com 10 falhas devolve `null`; **a invariante** —
      `inspecionadas = indexadas + rastreadas + descobertas + outras + falhas` para toda entrada.
- [X] **T016** [US1] Criar `app/api/indexacao/route.ts` com `maxDuration = 800`: valida
      `DATABASE_URL` e `GOOGLE_SERVICE_ACCOUNT_JSON` na **entrada** e responde `503` com **apenas
      os nomes** ausentes (Princípio V). Lê `INSPECOES_POR_PROPRIEDADE` (padrão 2000) e
      `INSPECOES_POR_CORRIDA` (padrão 400) do ambiente — tetos configuráveis, nunca literais (D10).
- [X] **T017** [US1] `app/api/indexacao/route.ts` — **planejamento antes de gastar**: percorre
      `listProjects()` filtrando por `url` (Princípio I, chave = `slug`), lê o sitemap de cada um
      com `lerSitemap`, resolve a propriedade com `melhorPropriedade()`
      (`lib/gsc-consulta.mjs:7`) **uma vez por projeto**, monta a fila com `filaDoDia` e as cotas
      com `repartir`. Nenhuma inspeção sai antes deste bloco terminar (D1).
- [X] **T018** [US1] `app/api/indexacao/route.ts` — execução: `inspecionarIndexacao` sobre a
      `amostra` de cada projeto, `classificar` + `agregar`, `gravarIndexacao`. Projeto com
      `sem_sitemap`/`sitemap_vazio`/`sem_propriedade`/`sem_orcamento` grava a linha do dia com o
      **motivo** e `inspecionadas = 0` — `sem_orcamento` grava `declaradas` preenchido, porque ler
      o sitemap não custou quota (FR-015).
- [X] **T019** [US1] `app/api/indexacao/route.ts` — isolamento de falha (FR-013): projeto que
      estoura não derruba a corrida; entra em `falhas` com a mensagem **truncada e sem valor de
      ambiente**. Corpo da resposta exatamente como `contracts/api-indexacao.md`, incluindo
      `propriedades[*].{orcamento, gastas, falhasDeQuota}` — é a prova verificável da SC-003 e o
      instrumento que mede o teto real (D10).
- [X] **T020** [US1] `middleware.ts`: isentar `/api/indexacao` do Basic auth e exigir
      `Bearer CRON_SECRET`, exatamente como `/api/gsc-serie` já faz na mesma condição.
- [X] **T021** [US1] Criar `.github/workflows/indexacao.yml`: cópia de `serie-gsc.yml` com cron
      `47 8 * * *` UTC (05:47 BRT — fora de 23:30–01:00 e de 08:00–08:45, e 30 min depois da série
      da 021) e `workflow_dispatch`. Retry **só** em falha de conexão (7/28/35/52/56); erro HTTP
      não repete.
- [X] **T022** [US1] `app/okr/[slug]/aquisicao/page.tsx`: ler a última apuração com
      `lerIndexacao(slug)` — **zero** chamada à URL Inspection API no render (D9), e nada de
      `no-store` nesta árvore. Exibir a fração `indexadas ÷ inspecionadas` com a **data da
      apuração** (FR-014).
- [X] **T023** [US1] `app/okr/[slug]/aquisicao/page.tsx`: quando `inspecionadas < declaradas`, a
      frase diz "N de M inspecionadas" e que a fração vale **para a amostra** — na mesma frase, não
      em nota de rodapé (FR-007, SC-002). Sem amostragem, nenhum rótulo de amostra.
- [X] **T024** [US1] `app/okr/[slug]/aquisicao/page.tsx`: os quatro não-apurados como **quatro
      telas diferentes**, cada uma com seu passo — `sem_sitemap` ("não há sitemap", aponta o build)
      · `sitemap_vazio` · `sem_propriedade` ("não há onde olhar", aponta domínio próprio) ·
      `sem_orcamento` ("ainda não apurado nesta rodada"). **Nenhum deles exibe 0%** (D5, cenários
      3 e 4 da US1).

**Checkpoint**: a US1 é entregável sozinha. Duas corridas seguidas deixam o banco no mesmo estado
e a tela declara a amostra.

---

## Phase 3: US2 — O que o Google leu e recusou (P2)

**Goal**: separar trabalho técnico de trabalho editorial. Sai da **mesma** inspeção da US1, sem
uma requisição a mais — as contagens já estão gravadas desde a T018.

**Independent Test**: uma URL com `coverageState` "Crawled - currently not indexed" cai no balde
de rejeição e uma "Submitted and indexed" não.

- [X] **T025** [US2] Estender `test/indexacao-corrida.test.mjs`: `classificar` para as duas
      classes de rastreio, para "Submitted and indexed", e para um `coverageState` desconhecido
      ⇒ `outra`. Mesmo arquivo da T015 — **não paralelizar com ela**.
- [X] **T026** [US2] `app/okr/[slug]/aquisicao/page.tsx`: "rastreada, não indexada" e "descoberta,
      não indexada" exibidas **separadas**, cada uma com sua contagem, mais `outras`. Somá-las num
      balde único de "não indexadas" reprova o cenário 2 da US2: `D-84` já mostrou que os
      prognósticos são incompatíveis — nenhum conserto técnico move "rastreada e recusada".
- [X] **T027** [US2] `app/okr/[slug]/aquisicao/page.tsx`: taxa de rejeição de rastreio
      (`rastreadas + descobertas`) contra a meta de **5%** e taxa de indexação contra a meta de
      **95%** do board (FR-010). `null` quando o denominador não existe — nunca uma meta batida
      por ausência de dado.
- [X] **T028** [US2] `app/okr/[slug]/aquisicao/page.tsx`: hierarquia visual que responde a SC-006
      em menos de 30 s — "o Google não conhece as páginas" (descobertas altas) vs "o Google conhece
      e recusou" (rastreadas altas). Números certos numa tela ilegível não cumprem a US2.

**Checkpoint**: US1 e US2 funcionam independentes. O board ganha a Taxa de Rejeição de Rastreio.

---

## Phase 4: US3 — Os dois KPIs que estavam capados (P3)

**Goal**: com o denominador na mão, o Active Index Ratio deixa de ser contagem e o Query-to-Page
Ratio passa a existir.

**Independent Test**: o Active Index Ratio exibido é `urlsComImpressao ÷ indexadas` e **desaparece
com o motivo** quando o denominador não foi apurado.

- [X] **T029** [US3] `lib/kpis-busca.mjs`: `activeIndexRatio(linhas, indexadas)` =
      `urlsComImpressao(linhas) ÷ indexadas`, com o denominador **injetado, nunca buscado**.
      `indexadas` `null` ou `≤ 0` ⇒ `null` (FR-011).
- [X] **T030** [US3] `lib/kpis-busca.mjs`: `queryToPageRatio(linhas, indexadas)` =
      `consultasUnicas(linhas).valor ÷ indexadas`, `null` sem denominador. Herda o **piso** de
      `consultasUnicas` — o GSC omite consultas raras da dimensão `query` (FR-012).
- [X] **T031** [P] [US3] Estender `test/kpis-busca.test.mjs`: as duas razões com denominador
      válido, com `indexadas = 0`, com `null`, e com lista de linhas vazia. Arquivo já registrado
      em `package.json` pela 021.
- [X] **T032** [US3] `app/okr/[slug]/aquisicao/page.tsx`: Active Index Ratio como fração contra os
      **70%** do board e Query-to-Page Ratio contra as faixas (30–80 artigo/blog, 10–25
      produto/landing), com o rótulo de **piso** visível ao leitor. Sem apuração, os dois voltam à
      contagem de hoje **com o motivo do denominador ausente** — razão com denominador chutado é
      falha, não detalhe.

**Checkpoint**: as 4 medidas do board saem de ausentes/capadas para exibidas (SC-001).

---

## Phase 5: Fechamento

- [X] **T033** `npm test` verde na suíte **inteira**, não só nos arquivos tocados (passo 1 do
      `quickstart.md`).
- [X] **T034** Conferir os quatro portões: teste verde · `test/sitemap.test.mjs` e
      `test/indexacao-corrida.test.mjs` na lista de `package.json` · nenhum import de
      `data/projects.json` fora de `lib/projects.*` · nenhum segredo em log, resposta ou mensagem
      de erro.
- [X] **T035** Rodar `lerSitemap` contra um sitemap real (passo 3 do `quickstart.md`) e conferir
      que o tamanho de `urls` bate com a **soma de todos os filhos** do `<sitemapindex>`. Bater só
      com o primeiro significa FR-002 não cumprida e site subcontado.
- [ ] **T036** Depois do deploy, disparar `indexacao.yml` por `workflow_dispatch` **uma vez, à
      mão**, e **ler a resposta antes de confiar no cron**: `gastas ≤ orcamento` em toda
      propriedade, `pulados` separado de `apurados`, e `falhasDeQuota`. A primeira corrida mede o
      check, não o mundo.
- [ ] **T037** Se `falhasDeQuota > 0` com `gastas < orcamento`, o teto real do Google é menor que
      2.000: baixar `INSPECOES_POR_PROPRIEDADE` **por env, sem deploy** (D10). Registrar o número
      observado no handoff — é a confirmação que a spec pediu.
- [ ] **T038** Idempotência **no banco**: rodar a corrida duas vezes no mesmo dia e conferir zero
      linhas em `select projeto, count(*) from hub_indexacao where dia = current_date group by 1
      having count(*) > 1`.
- [ ] **T039** Abrir `/okr/<slug>/aquisicao` em **quatro** projetos — sitemap pequeno, sitemap
      grande amostrado, sem sitemap, host fora do GSC — e conferir cada tela do passo 5 do
      `quickstart.md`. Sem conferir a tela, não está pronto.
- [X] **T040** Push respeitando a janela do Princípio IV (nunca 23:30–01:00 nem 08:00–08:45 BRT).
      Handoff co-localizado em `handoff/`, com o placar do board atualizado de 7 para 11 de 28.

---

## Dependências

### Entre fases

- **Phase 1 bloqueia tudo.** T002 (o inventário completo) é a entrada de `repartir` — sem ele o
  orçamento é calculado sobre um denominador errado.
- **Phase 2 (US1) bloqueia Phase 3 e Phase 4.** A US2 lê contagens que só a corrida da US1 grava;
  a US3 precisa de `indexadas` como denominador. Não são histórias independentes aqui, e a spec já
  diz isso — a US3 é "consequência da US1, não trabalho novo de coleta".
- **Phase 3 e Phase 4 são independentes entre si** e podem ir em qualquer ordem depois da US1.
- **Phase 5** depende de tudo que se pretende entregar.

### Dentro das fases

- T001 → T002 → T003/T004. T005 depois de T004.
- T006 → T007/T008/T009 (mesmo arquivo, `lib/db.ts`: **não paralelizar entre si**).
- T010–T014 são o mesmo arquivo `lib/indexacao-corrida.mjs`: sequenciais entre si, todas antes da
  T015.
- T016 → T017 → T018 → T019 (mesmo arquivo, `route.ts`).
- T022 → T023 → T024 → T026 → T027 → T028 → T032 tocam **o mesmo** `page.tsx`: sequenciais,
  nunca em paralelo.
- T015 e T025 tocam o mesmo arquivo de teste: **não paralelizar**.

### Paralelismo real

Pouco, e de propósito: quase toda tarefa desta feature toca um de quatro arquivos. As únicas
genuinamente paralelas são **T001** (arquivo novo), **T005** (teste do módulo pronto),
**T015** (teste, enquanto a rota é escrita) e **T031** (arquivo de teste de outra feature).

---

## Estratégia de entrega

### MVP — só a US1

Phase 1 + Phase 2. Entrega o denominador, a corrida dentro da quota e a tela honesta sobre a
amostra. Sozinha já move 1 das 4 medidas do board e destrava as outras 3.

### Incremental

1. Phase 1 → o inventário existe e é conferível sem gastar quota.
2. Phase 2 → **MVP**: Taxa de Indexação Limpa na tela, com data e amostra declaradas.
3. Phase 3 → Taxa de Rejeição de Rastreio, com os dois motivos separados.
4. Phase 4 → Active Index Ratio vira razão, Query-to-Page Ratio nasce.

### A ordem importa por um motivo só

Diferente da 021, **não** é o calendário: indexação se move em dias e semanas, e nenhum dia sem
corrida é um dia perdido para sempre. O que manda a ordem aqui é o risco: a T011 e a T013 são as
duas linhas de código onde esta feature pode mentir de forma cara — estourar a quota de uma
propriedade compartilhada por 21 projetos, e contar erro de quota como não-indexação. As duas são
puras e testadas na T015, **antes** de uma única inspeção ser gasta.
