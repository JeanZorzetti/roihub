---

description: "Tarefas da 021 — série do GSC gravada e os sete KPIs de busca"
---

# Tasks: Série do GSC gravada e os sete KPIs de busca

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md` em `/specs/021-serie-gsc-gravada/`

**Testes**: obrigatórios. O Princípio II da constituição é não-negociável, e todo arquivo de teste
novo entra na lista de `package.json` **no mesmo commit** que o cria.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência)

---

## Phase 1: Fundação (bloqueia tudo)

**Purpose**: a fonte de dados que as duas metades da feature consomem.

- [ ] **T001** Exportar `queryPageWindow` em `lib/gsc.ts` (hoje é função de módulo, não exportada).
      Assinatura inalterada — só o `export`. Comentário explicando **por que** ela passou a ser
      pública: a 021 precisa de UMA janela, a de `descoberta()`, e não do par que `gscQueryPages`
      monta para o autopublishing (D1 em `research.md`).
- [ ] **T002** Em `lib/gsc.ts`, adicionar `gscConsultas(siteUrl, janela, options)` — conecta via
      `gscConnection`, chama `queryPageWindow` **uma vez** com `janela.inicio`/`janela.fim`, e
      devolve `LinhaBusca[]` já nomeado (`{query, page, cliques, impressoes, posicao}`) em vez de
      `keys[0]`/`keys[1]`. Distinguir sem propriedade (`null`) de falha (`{erro}`), como
      `gscSeries` já faz — `okr-coleta.ts` depende dessa distinção para escolher o motivo.
- [ ] **T003** Sinalizar truncamento (FR-011): `gscConsultas` marca o retorno quando vieram
      25 000 linhas, o teto de `rowLimit`. Sem isso o corte da API vira "fim dos dados".

**Checkpoint**: existe uma chamada que devolve as consultas da janela de descoberta, nomeadas.

---

## Phase 2: US1 — A série diária gravada (P1) 🎯 MVP

**Goal**: o histórico começa a existir. Nenhum KPI novo na tela; é o relógio que passa a correr.

- [ ] **T004** `lib/db.ts`: `CREATE TABLE IF NOT EXISTS hub_gsc_dia` no `ensure()`, conforme
      `data-model.md` §1. PK `(projeto, dia)`. **Sem** coluna de CTR — ele é `cliques ÷ impressoes`
      e uma coluna só cria chance de divergir.
- [ ] **T005** `lib/db.ts`: `gravarDiasGsc(projeto, dias[])` com
      `ON CONFLICT (projeto, dia) DO UPDATE`, no padrão de `gravarEstado` (`lib/db.ts:755`).
      Regravar dia provisório é requisito (FR-003), não tolerância.
- [ ] **T006** `lib/db.ts`: `ultimoDiaGsc(projeto)` → `string | null`. É o que decide entre
      backfill longo e janela curta (FR-006, D5).
- [ ] **T007** `app/api/gsc-serie/route.ts`: a corrida. Valida `DATABASE_URL` e
      `GOOGLE_SERVICE_ACCOUNT_JSON` na entrada e responde `503` com **apenas os nomes** ausentes
      (Princípio V). Percorre `listProjects()` filtrando por `url` (Princípio I). Para cada
      projeto: `ultimoDiaGsc` decide a janela, `gscSeries`/`queryPageWindow` traz os dias,
      `gravarDiasGsc` grava.
- [ ] **T008** Isolamento de falha em T007 (FR-004): projeto sem propriedade grava zero linhas e
      **não** derruba os demais. A resposta lista, por projeto, quantos dias entraram e quais
      falharam — sem nenhum segredo.
- [ ] **T009** `middleware.ts`: isentar `/api/gsc-serie` do Basic auth e exigir
      `Bearer CRON_SECRET`, exatamente como `/api/estado` já faz na mesma condição.
- [ ] **T010** `.github/workflows/serie-gsc.yml`: cópia de `estado-noturno.yml` com cron
      `17 8 * * *` UTC (05:17 BRT — fora das duas janelas do Princípio IV) e `workflow_dispatch`.
      Manter o retry **só** em falha de conexão (7/28/35/52/56); erro HTTP não repete.
- [ ] **T011** [P] `test/gsc-serie.test.mjs`: a decisão de janela (com e sem linha anterior) e o
      mapeamento de linhas do GSC para o formato de gravação. Registrar em `package.json`.

**Checkpoint**: rodar a corrida duas vezes seguidas deixa o banco no mesmo estado. US1 entregável
sozinha.

---

## Phase 3: US2 + US3 — Striking Distance e CTR vs benchmark (P2)

**Goal**: a aba passa a dizer o que fazer primeiro. As duas histórias saem da mesma chamada e do
mesmo módulo puro, por isso a mesma fase.

- [ ] **T012** `lib/kpis-busca.mjs` (NOVO, puro — sem `pg`, sem `fetch`, sem `process.env`;
      Princípio III): `BENCHMARK` e `benchmark(posicao)` conforme `data-model.md` §3.
      Acima de 10,9 devolve `null` — o board não define piso lá, e inventar um reprovaria a cauda
      longa inteira.
- [ ] **T013** `strikingDistance(linhas)`: posição 4,0–10,9, ordenado por impressões desc.
- [ ] **T014** `ctrPorConsulta(linhas)`: anexa `ctr`, `benchmark` e `atinge` a cada linha.
      `impressoes = 0` ⇒ CTR **indefinido**, nunca 0% (`data-model.md` §1).
- [ ] **T015** `ctrGap(linhas)`: fração de URLs que atingem o benchmark da própria posição.
      Linhas sem benchmark (posição > 10,9) ficam **fora** do denominador, não contam como falha.
      `null` quando não sobra nenhuma URL.
- [ ] **T016** [P] `test/kpis-busca.test.mjs`: **as bordas de faixa uma a uma** — 3,9 / 4,0 / 6,9 /
      7,0 / 10,9 / 11,0 — mais impressões zero, lista vazia e a linha sem benchmark fora do gap.
      Registrar em `package.json` no mesmo commit (Princípio II).
- [ ] **T017** `app/okr/[slug]/aquisicao/page.tsx`: chamar `gscConsultas` na janela de
      `descoberta()` e renderizar Striking Distance e o CTR Gap.
- [ ] **T018** Estados vazios com motivo (FR-010, US2 cenário 2): "sem candidata na faixa",
      "sem propriedade no GSC" e "falhou agora" são **três** telas diferentes. Lista vazia sem
      explicação não passa.

**Checkpoint**: dá para nomear a consulta a trabalhar primeiro. US2 e US3 entregáveis.

---

## Phase 4: US4 + US5 — Escala e canibalização (P3)

- [ ] **T019** `lib/kpis-busca.mjs`: `consultasUnicas(linhas)` → `{valor, piso: true}`. A flag não
      é opcional — a dimensão `query` omite as raras (FR-009).
- [ ] **T020** `lib/kpis-busca.mjs`: `noTop20`, `impressoesNoTop3` e `urlsComImpressao`
      (contagem, **não** razão — o denominador de indexadas não existe, FR-013).
- [ ] **T021** `lib/kpis-busca.mjs`: `canibalizacao(linhas)` — só consultas com 2+ `page`
      distintas, com posição e impressões de cada URL.
- [ ] **T022** [P] Estender `test/kpis-busca.test.mjs`: consulta com URL única **não** aparece na
      canibalização; total de impressões zero devolve `null` em vez de dividir por zero.
- [ ] **T023** `app/okr/[slug]/aquisicao/page.tsx`: renderizar os quatro números e a lista de
      canibalização. O rótulo de piso fica **visível ao leitor**, não em comentário de código.

---

## Phase 5: Fechamento

- [ ] **T024** `npm test` verde na suíte **inteira**, não só nos arquivos tocados (Portão 1).
- [ ] **T025** Conferir os quatro portões: teste verde · testes novos em `package.json` · nenhum
      import de `data/projects.json` fora de `lib/projects.*` · nenhum segredo em log ou resposta.
- [ ] **T026** Disparar a corrida por `workflow_dispatch` e conferir **no banco** que as linhas
      entraram; rodar de novo e conferir que nada duplicou (SC-003).
- [ ] **T027** Abrir `/okr/<slug>/aquisicao` de um projeto com tráfego e conferir a tela — os
      sete KPIs presentes, o rótulo de piso visível, nenhum número com denominador ausente
      (SC-001, SC-005). Sem conferir a tela, não está pronto.
- [ ] **T028** Push respeitando a janela do Princípio IV (nunca 23:30–01:00 nem 08:00–08:45 BRT).
      Handoff co-localizado em `handoff/`.

---

## Dependências

- **Phase 1 bloqueia tudo.** T002 é a fonte das Phases 3 e 4.
- **US1 (Phase 2) não bloqueia US2–US5**: os sete KPIs saem da leitura ao vivo, não da tabela.
  Podem ser feitas em qualquer ordem — mas US1 primeiro, porque é a única cujo valor depende do
  calendário.
- T012 bloqueia T013–T015. T019–T021 são independentes entre si.
- T016 e T022 tocam o mesmo arquivo: não paralelizar entre si.

## Estratégia de entrega

Cada fase é um incremento que pode ir para `main` sozinho. A ordem recomendada é a numérica, e a
razão é uma só: **todo dia sem T004–T010 é um dia de histórico que não volta.**
