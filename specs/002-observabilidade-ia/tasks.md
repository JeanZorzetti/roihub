---
description: "Task list for spec 002 — Observabilidade dos recursos de IA e saúde dos empregados"
---

# Tasks: Observabilidade dos recursos de IA e saúde dos empregados nas automações

**Input**: Design documents from `/specs/002-observabilidade-ia/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: incluídos e **obrigatórios**, não opcionais — a spec assume `node --test` sem framework
(Assumptions) e a lógica nova é cheia de decisão (código por empregado, sentinelas de conta,
transição de pool, lacuna × zero). O arquivo novo **tem que entrar na lista explícita do
`package.json`**: teste que não roda não reprova nada, e `test/validade.test.mjs` compara a lista nos
dois sentidos.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: US1–US5, conforme spec.md
- Um único repositório (`roihub`); caminhos relativos à raiz dele

**⛔ Janela de push proibida**: 23:30–01:00 BRT (estado noturno 23:37, autopublishing 00:13). Vale
para toda tarefa que termina em deploy.

---

## Phase 1: Setup

**Purpose**: o mínimo antes de escrever código

- [X] T001 [P] Documentar `HUB_AMBIENTE` (`prod`|`dev`, opcional — default vem de `NODE_ENV`) e `HUB_CORRIDA` (id de corrida de medição, opcional) em `.env.example`, junto das demais. Nenhum segredo novo: a feature reusa `DATABASE_URL`, `CRON_SECRET` e `CLAUDE_CODE_OAUTH_TOKENS` ([research.md D5, D8](./research.md)).
- [X] T002 Rodar `npm test` e guardar o resultado como linha de base — a suíte inteira é ~1,6 s, e um verde de antes é o que separa "quebrei agora" de "já estava assim".

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: os dois módulos e as três tabelas. Sem eles nenhuma user story tem onde gravar nem o que ler.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase

- [X] T003 Criar `lib/telemetria.mjs` (puro, zero I/O) com `hashConta`, `ambiente`, `codigo`, `montarRegistro`, conforme [contracts/telemetria.md](./contracts/telemetria.md). Garantias que o código tem que tornar impossíveis de violar: `montarRegistro` **nunca** copia `prompt`, `payload.result` ou stderr para o registro (só `prompt_hash` sha1 — a mesma chave de `chave()` do `reranker.mjs` — e `prompt_chars`); `hashConta("")` devolve o sentinela `cli-ambiente`; `codigo(empregado, erro)` troca o prefixo preservando o sufixo de classe, no mesmo padrão que `resposta.mjs`/`juiz.mjs` já usam. `operacao` e `turnos` entram aqui ou saem do schema — coluna que ninguém escreve nasce nula.
- [X] T004 Criar `test/telemetria.test.mjs` e **adicioná-lo à lista do `npm test` em `package.json`** (as duas coisas no mesmo commit). Cobrir: `codigo("juiz", Error("rerank-conta")) === "juiz-conta"`; classe fora do conjunto validado reprova; `montarRegistro` com um prompt contendo texto sensível **não** produz nenhum campo com esse texto; `hashConta` estável para o mesmo token e diferente para tokens distintos; sentinelas `cli-ambiente` e `cache`.
- [X] T005 Criar `lib/telemetria-db.mjs` com `conectar()`/`ensure()` idempotentes no molde de `lib/corpus-db.mjs` (`pg` importado direto — `.mjs` porque `reranker.mjs` e os scripts não importam `.ts`), criando `ia_chamadas`, `ia_resumo` e `ia_pool` exatamente como em [data-model.md](./data-model.md), com os dois índices de `ia_chamadas`.
- [X] T006 Implementar `registrar(registro)` em `lib/telemetria-db.mjs`: **nunca lança** (todo o corpo em `try/catch` que descarta) e é no-op silencioso sem `DATABASE_URL`. Comentário `ponytail:` nomeando o teto conhecido — a falha é engolida de propósito, e quem a torna visível é a ausência das linhas da sonda ([research.md D9](./research.md)), não um log.

**Checkpoint**: existe onde gravar e uma função que grava sem poder derrubar nada

---

## Phase 3: User Story 1 — Toda chamada de IA deixa um registro (Priority: P1) 🎯 MVP

**Goal**: os 6 empregados param de trabalhar sem folha de ponto — uma linha por tentativa, nos dois caminhos compartilhados de `spawn`

**Independent Test**: uma busca em produção aparece como **duas** chamadas (rerank + síntese) com empregado, conta, duração, tokens e desfecho; uma busca com `?rerank=0&resposta=0` não registra nada ([quickstart.md — US1](./quickstart.md))

- [X] T007 [US1] Em `lib/reranker.mjs`, fazer `spawnClaude` resolver o **payload inteiro** em vez de `payload.result` (hoje `usage`, `duration_ms`, `num_turns` e `session_id` são descartados na linha 243). `rodarClaude` passa a extrair `result` e continua devolvendo string — **nenhum dos 4 consumidores muda de contrato**. O `erro.status` e o `erro.trocaDeConta` continuam como estão.
- [X] T008 [US1] Instrumentar `rodarClaude` em `lib/reranker.mjs`: gerar `pedido` (`crypto.randomUUID()`) uma vez, e a cada volta do laço do pool chamar `registrar()` com a tentativa — **sucesso ou falha**, com `tentativa` 1-based e `conta = hashConta(token)`. Nova opção `empregado = "nao-declarado"` (default deliberado: chamador novo aparece na série sem código nenhum, que é o comportamento que a FR-006 pede). Sem `await` no caminho de retorno.
- [X] T009 [US1] Instrumentar `rodarCacheado` em `lib/reranker.mjs`: acerto de cache chama `registrar()` com `conta: "cache"`, duração 0 e tokens zerados, e **não** chama `rodarClaude` (FR-008). Sem isso, o custo medido de uma corrida some do histórico e a próxima leitura subestima o gasto.
- [X] T010 [P] [US1] Declarar o empregado nos consumidores de `rodarClaude` que moram em `lib/`: `rerank()` (`rerank`), `lib/resposta.mjs` (`resposta`), `lib/juiz.mjs` (`juiz`) — uma linha em cada, junto do `modelo`/`effort` que eles já passam para `rodarCacheado`.
- [X] T011 [P] [US1] Declarar o empregado nos dois consumidores fora de `lib/`: `sondar()` em `lib/reranker.mjs` (`sonda`) e `scripts/corpus-defasado.mjs` (`defasagem`).
- [X] T012 [US1] Instrumentar `claudeRun` em `lib/autopublish-clients.ts`: `empregado` nas opções (`autopublish-draft` quando `webSearch`, `autopublish-ymyl` caso contrário) e `registrar()` por tentativa dentro do laço `for (const token of tokens)`, reaproveitando o `usage` que ele já lê para `seo_publications`. **`seo_publications` não muda** — a série nova é um nível abaixo e as duas devem bater.
- [X] T013 [P] [US1] Estender `test/reranker.test.mjs` cobrindo o novo formato interno: `rodarClaude` continua devolvendo string; percorrer o pool com a 1ª conta em 429 produz **duas** tentativas com o mesmo `pedido` (uma falha, um sucesso), usando um `registrar` injetado — nada de banco no teste.
- [X] T014 [US1] Validar pelo [quickstart.md](./quickstart.md): busca em produção → 2 linhas; controle negativo com `?rerank=0&resposta=0` → nenhuma linha; ciclo de autopublishing → soma de tokens das chamadas bate com `input_tokens` da publicação do dia; check SC-007 (`prompt_hash` sha1 e nenhum campo com texto) devolve 0. Validado em 10/08 (ver handoff.md) — só o cenário de autopublishing fica para depois do 1º ciclo noturno pós-deploy.

**Checkpoint**: US1 completa — a série existe e é a fundação de todo o resto. MVP entregável.

---

## Phase 4: User Story 2 — A saúde de cada conta do pool é datada (Priority: P1)

**Goal**: responder "em que estado a conta está e **desde quando**" com precisão de 24 h, contra a melhor resposta de hoje ("em algum ponto de uma janela de ~10 h, há mais de uma semana")

**Independent Test**: consultar o pool e obter, por conta, o estado e a data em que ele começou; conta que mudou de estado entre duas sondagens tem a transição registrada e a linha antiga **permanece** ([quickstart.md — US2](./quickstart.md))

- [X] T015 [P] [US2] Implementar `transicaoPool(anterior, leitura, agora)` em `lib/telemetria.mjs` (puro) e cobrir em `test/telemetria.test.mjs`: estado igual → só `tocar` (atualiza `visto`); estado diferente ou conta nova → `inserir`; nunca as duas. Sondagem que repete a anterior **confirma o estado e não compra janela nova**.
- [X] T016 [US2] Implementar `atualizarPool(contas, agora)` e `poolDatado()` em `lib/telemetria-db.mjs`. Lista vazia **estoura** com a mesma mensagem de `coletarPool` (`pool vazio: CLAUDE_CODE_OAUTH_TOKENS ausente`) — env var ausente é "não olhei", nunca "nenhuma conta com problema" (FR-012).
- [X] T017 [US2] `scripts/probe-pool.mjs --gravar` passa a gravar em `ia_pool` via `atualizarPool` em vez de em `data/pool-sondagens.json` (FR-013: o histórico mora onde a produção escreve, não num arquivo versionado). Manter o JSON antigo no repo como registro datado das 3 leituras — não apagar, não continuar escrevendo.
- [X] T018 [US2] Garantir que `rate-limit` (429) e `desabilitada` (403) nunca colapsam num rótulo só em nenhuma saída desta fase (FR-011) — conferir em `lib/reranker.mjs` (`classificarConta`, já separa), `lib/telemetria-db.mjs` (`poolDatado`) e `scripts/probe-pool.mjs`; o `status_api` de `ia_chamadas` corrobora.
- [X] T019 [US2] Validar pelo [quickstart.md](./quickstart.md): duas sondagens seguidas sem mudança → nenhuma linha nova, só `visto` atualizado; sondagem com pool vazio → erro explícito. Validado em 10/08 (ver handoff.md).

**Checkpoint**: o 403 da conta 3 passa a ter data. US1 e US2 funcionam independentemente.

---

## Phase 5: User Story 3 — A aba `/ia` responde as perguntas do dia (Priority: P2)

**Goal**: transformar a série em decisão — consumo por empregado, falhas por código, latência típica e pool datado, numa aba própria

**Independent Test**: abrir `/ia` depois de um ciclo noturno e conferir que os números batem com os registros brutos da mesma janela ([quickstart.md — US3](./quickstart.md))

- [X] T020 [US3] Implementar `janela()`, `porEmpregado()` e `ultimaSonda()` em `lib/telemetria-db.mjs`: p50/p95 via `percentile_disc(...) WITHIN GROUP (ORDER BY duracao_ms)`, falhas agrupadas por código, `ambiente = 'dev'` **excluído por default** (FR-009), e fallback para `ia_resumo` quando o dia pedido já saiu dos 90 dias. `ultimaSonda()` é `SELECT max(inicio) FROM ia_chamadas WHERE empregado = 'sonda'` — o relógio do batimento de coração, e não uma contagem dentro da janela.
- [X] T021 [P] [US3] Implementar `estadoDoEmpregado(linhas, ultimaSonda, agora)` em `lib/telemetria.mjs` e cobrir em `test/telemetria.test.mjs`: os três estados da FR-016 (*não acionado* ≠ *acionado sem falhas* ≠ *sem telemetria*), com **lacuna vencendo tudo**. Lacuna é `ultimaSonda` ausente ou mais velha que **36 h**, nunca "sem sonda na janela de 24 h" — o Actions atrasa o cron em ~97 min (medido), e janela rígida põe a sonda para fora sozinha. Dois casos de teste obrigatórios: sonda de 26 h atrás **não** é lacuna; de 40 h atrás **é**.
- [X] T022 [US3] Criar `app/ia/page.tsx` (server component, `dynamic = "force-dynamic"`, no padrão de `app/crm/page.tsx`) com os 6 blocos de [contracts/estado-noturno-ia.md](./contracts/estado-noturno-ia.md): consumo por empregado, falhas por código, p50/p95, pool datado com 429 e 403 visualmente distintos, os três estados por empregado, e **lacuna explícita**. Corrida marcada como incompleta aparece nomeada e **sem agregado** (FR-017) — aviso ao lado do número perde para o número.
- [X] T023 [P] [US3] Adicionar `"ia"` à união e ao nav em `app/tabs.tsx`.
- [ ] T024 [US3] Validar pelo [quickstart.md](./quickstart.md), incluindo o teste que mais importa: derrubar a escrita de telemetria de propósito e confirmar as **duas** metades da FR-007 ao mesmo tempo — a busca continua respondendo **e** a janela aparece como lacuna, jamais como "zero falhas". **Parcialmente validado em 10/08** (ver handoff.md): números da aba batem com o SQL cru; mas a 2ª metade da FR-007 **falhou** — `/ia` devolve 500 (não lacuna) com o banco inacessível. Falta corrigir e revalidar, além do check pós-ciclo-noturno.

**Checkpoint**: US1–US3 completas. A série virou leitura.

---

## Phase 6: User Story 4 — Mudança de regime vira card, sem virar ruído (Priority: P3)

**Goal**: transição categórica vira card pelo mecanismo de diff que já funciona; noite sem mudança continua silenciosa

**Independent Test**: provocar uma mudança de estado gera exatamente 1 card; rodar de novo sem mudar nada gera **nenhum** ([quickstart.md — US4](./quickstart.md))

- [X] T025 [US4] Estender `diffEstado` em `lib/estado-noturno.mjs` com a guarda de **domínio novo**: célula cujo domínio não existe no `anterior` por inteiro NÃO entra no diff — grava e cala, como a 1ª corrida faz. `primeiraCorrida` cobre só a 1ª corrida do APARATO; com `hub_estado` já povoado ela devolve `false`, e um coletor recém-nascido publicaria a própria linha de base como achado (FR-019). São ~2 linhas (`conhecidos = new Set(Object.keys(antes).map(dominioDe))` no predicado `conta`). Cobrir em `test/estado-noturno.test.mjs`: domínio inédito → zero card; o MESMO domínio na corrida seguinte → diff normal.
- [X] T026 [P] [US4] Implementar `celulasIA(linhas, contas, ultimaSonda, agora)` em `lib/telemetria.mjs` e cobrir em `test/telemetria.test.mjs`: só `IA:empregado:<nome>` (quando houve ≥1 falha na janela, rótulo = código mais frequente) e `IA:coletor:telemetria` (pela mesma regra de 36 h da T021). **Teste explícito de que latência ou volume mudando de patamar NÃO produz célula** (FR-018, SC-005) — limiar sobre linha de base não calibrada fabrica card, e card ruidoso mata o mecanismo.
- [X] T027 [US4] Re-chavear `coletarPool` em `lib/estado-noturno.mjs` de índice posicional para hash da conta (`POOL:a1b2c3d4:rate-limit`) e passar a incluir a data no rótulo (`desabilitada desde 2026-08-02`), lendo de `poolDatado()`. Atualizar `test/estado-noturno.test.mjs`.
- [X] T028 [US4] Adicionar o quinto coletor (`IA`) em `app/api/estado/route.ts`, serial como os outros. **Falha fechada**: banco fora ou pool vazio estoura e o domínio sai do diff via `dominiosOk`; "zero linha na série" **não** é falha do coletor — é a célula `IA:coletor:telemetria`. Confundir as duas manda o diagnóstico para o lugar errado, como `request-failed` do autopublish.
- [X] T029 [P] [US4] Acrescentar `telemetria: "ok"|"lacuna"` à resposta de `POST /api/estado` em `app/api/estado/route.ts`, para o log do Actions mostrar a lacuna sem ninguém abrir a aba.
- [ ] T030 [US4] Validar pelo [quickstart.md](./quickstart.md): duas corridas seguidas sem mudança → a segunda sai **silenciosa**; o domínio `IA` estreando → **zero card** (T025). **Nomear no corpo do commit o card esperado de day one**: a primeira corrida pós-deploy emite 3 novos + 3 resolvidos no domínio `POOL` porque a chave trocou de índice para hash — a guarda da T025 **não** alcança isso (o domínio `POOL` já existe), e reescrever as chaves antigas dependeria da ordem da env var, que é a premissa que a FR-002a proíbe ([research.md — risco de migração](./research.md)). **Parcialmente validado em 10/08** (ver handoff.md): `hub_estado` estava **vazio** — esta foi a 1ª corrida real do aparato, não a "corrida do dia 1 pós-migração" que o texto acima assume (não havia `POOL` de chave posicional para migrar). `card: "nenhum"` confirmado na 1ª corrida. O teste "segunda corrida sai silenciosa" **não dá pra validar rodando duas vezes no mesmo dia** — `estadoAnterior` compara sempre com `run_date < hoje`, nunca com a própria corrida do dia (por design, `lib/db.ts:estadoAnterior`). Só valida com dois ciclos noturnos reais em dias distintos.

**Checkpoint**: o card fecha o ciclo sem introduzir ruído.

---

## Phase 7: User Story 5 — Sonda o orçamento antes de gastar (Priority: P3)

**Goal**: saber, antes de disparar 85 chamadas, quanto do pool está disponível **agora** — em vez de descobrir no meio, com o parcial gravado e nenhum número publicável

**Independent Test**: consultar o orçamento antes de uma corrida conhecida e obter contas vivas, consumo já feito na janela e custo previsto em chamadas ([quickstart.md — US5](./quickstart.md))

- [X] T031 [US5] Definir `HUB_CORRIDA` no início de `scripts/avaliar.mjs`, `scripts/avaliar-resposta.mjs` e `scripts/corpus-defasado.mjs` (`process.env.HUB_CORRIDA ??= \`<script>-${new Date().toISOString()}\``), para a coluna `corrida` deixar de ser sempre NULL. Sem isto a entidade *Corrida* não existe na série e a FR-017 (marca de incompleta, agregado suprimido) não tem sobre o que operar.
- [X] T032 [US5] Marcar corrida incompleta na série (FR-017): no caminho de aborto por 3 falhas de conta seguidas (`MAX_CONTA_SEGUIDAS`, usado por `scripts/avaliar.mjs`, `scripts/avaliar-resposta.mjs` e `scripts/corpus-defasado.mjs`), gravar **uma linha sentinela** com `desfecho = '<empregado>-corrida-incompleta'` e o mesmo `corrida` da T031. Sem tabela nova ([research.md D6](./research.md)).
- [X] T033 [US5] Implementar `orcamento({ chamadasPrevistas })` em `lib/telemetria-db.mjs`: contas vivas de `poolDatado()`, consumo já feito na janela (incluindo `dev`, porque o pool é o mesmo) e a comparação com `chamadasPrevistas`. **Devolver os números, não um adjetivo** — "arriscada" sem regra é o tipo de veredito que ninguém consegue conferir depois; quem lê decide com contas vivas × consumo × previsto na mão.
- [X] T034 [US5] Criar `scripts/orcamento.mjs` (`node --env-file=.env scripts/orcamento.mjs --chamadas 85`), imprimindo o resultado de T033. **Custo da consulta: zero chamada de LLM** — ele lê a série e o `ia_pool`; a sondagem é a da noite (SC-008).
- [X] T035 [US5] Validar pelo [quickstart.md](./quickstart.md): com duas de três contas indisponíveis, a consulta deixa evidente que 85 chamadas não cabem; corrida abortada não produz agregado nenhum, nem com aviso ao lado. Validado em 10/08 (ver handoff.md) — o sub-cenário "corrida abortada" não foi exercitado de ponta a ponta (exigiria forçar 3 falhas de conta seguidas numa corrida real).

**Checkpoint**: todas as user stories independentemente funcionais.

---

## Phase 8: Polish & Cross-Cutting

**Purpose**: retenção, conferência e a documentação que impede a próxima sessão de redescobrir isto

**Fusível de 90 dias**: T036/T037 não têm urgência de dias — nenhum dado se perde antes de 90 dias
após a US1 entrar no ar. Mas têm que entrar **dentro** dessa janela, senão o primeiro detalhe a expirar
expira sem resumo.

- [X] T036 Implementar `consolidar(dia)` e `expirar(90)` em `lib/telemetria-db.mjs` e chamá-las em `app/api/estado/route.ts`, **depois** do diff e **nessa ordem** — inverter perderia o último dia. `consolidar` roda sobre o **dia anterior** (dia fechado não muda mais, e é isso que dá idempotência, como `run_date` é PK de `hub_estado`). Acrescentar `resumo` e `expiradas` à resposta da rota.
- [X] T037 [P] Implementar `resumirDia(linhas)` (puro) em `lib/telemetria.mjs` e cobrir em `test/telemetria.test.mjs`, provando que o resumo consolidado é recomputável a partir do detalhe (FR-023) — incluindo `pedidos` (distinct `pedido`), que é metade da FR-005 depois dos 90 dias. Sem banco no teste; conferir uma vez em produção com a query de [quickstart.md — Retenção](./quickstart.md).
- [X] T038 [P] Criar `scripts/telemetria-sanidade.mjs` (roda contra o banco, fora do `npm test` pelo mesmo motivo do conformidade — teste não abre conexão com produção) com dois checks: (a) SC-007, nenhuma coluna da série guarda texto livre — se precisar de regex nova para passar, o schema mudou e a garantia da FR-004 vazou; (b) SC-008, `empregado = 'sonda'` por dia ≤ número de contas — a observabilidade não pode ter virado consumidora do pool.
- [X] T039 [P] Documentar a frente em `CLAUDE.md` — seção nova no padrão das existentes: os dois pontos de instrumentação, os dois sentinelas de `conta`, a regra "lacuna ≠ zero falhas" com a folga de 36 h e o porquê, a guarda de domínio novo no diff, e a retenção 90 dias + resumo permanente.
- [X] T040 [P] Escrever `specs/002-observabilidade-ia/handoff.md` co-localizado, no padrão da spec 001, com o que ficou aberto e o card de day one já observado.
- [ ] T041 `npm test` verde + commit + push **fora da janela 23:30–01:00 BRT**. Depois do primeiro ciclo noturno, ler as linhas uma a uma antes de olhar qualquer agregado: **a primeira corrida de um check novo mede o check**, e uma frente de observabilidade tem a forma exata desse erro.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sem dependências
- **Foundational (Fase 2)**: depende do Setup — **bloqueia todas as user stories**
- **US1 (Fase 3)**: depende da Fase 2. É a fundação real: US3, US4 e US5 leem a série que ela produz
- **US2 (Fase 4)**: depende da Fase 2. **Independente da US1** — o `ia_pool` é alimentado pela sonda, não pela série
- **US3 (Fase 5)**: depende de US1 (consumo/latência/falhas) e de US2 (pool datado)
- **US4 (Fase 6)**: depende de US1 e US2 (as células saem das duas); T026 depende de `ultimaSonda()` (T020)
- **US5 (Fase 7)**: depende de US1 (consumo da janela) e US2 (contas vivas); T032 depende de T031
- **Polish (Fase 8)**: depende de US1; T036 exige a rota da US4 já tocada (ou toca-a sozinha, se a US4 for adiada)

### Dependência real entre stories

A spec chama US1 e US2 de P1 e as outras de P2/P3, e a ordem de dependência confirma: **US3, US4 e
US5 só existem em cima da US1**. Parar depois da Fase 3 já entrega valor (diagnóstico pontual com
SQL cru); parar depois da Fase 4 fecha a única história que muda decisão de dinheiro.

### Oportunidades de paralelismo

- T001 é independente de tudo
- **US1 e US2 podem ser feitas em paralelo** por pessoas diferentes depois da Fase 2 — arquivos
  distintos (`reranker.mjs`/`autopublish-clients.ts` × `probe-pool.mjs`/`telemetria-db.mjs`), com o
  cuidado de que as duas mexem em `lib/telemetria-db.mjs` (T016 × T006) e em `test/telemetria.test.mjs`
- T010 e T011 em paralelo (declarações de empregado, 5 arquivos distintos)
- T023 (nav) em paralelo com T022 (página)
- T026 e T029 em paralelo com T025/T027/T028 (arquivos distintos)
- T037, T038, T039, T040 todos em paralelo

## Parallel Example: User Story 1

```bash
# Depois de T007–T009 (todos em lib/reranker.mjs, sequenciais entre si):
Task: "T010 declarar empregado em rerank(), resposta.mjs e juiz.mjs"
Task: "T011 declarar empregado em sondar() e scripts/corpus-defasado.mjs"
Task: "T013 estender test/reranker.test.mjs para o novo retorno do spawn"
```

## Implementation Strategy

### MVP (só US1)

1. Fase 1 (Setup) → 2. Fase 2 (Foundational) → 3. Fase 3 (US1)
4. **PARAR e VALIDAR**: rodar os cenários de US1 do quickstart, inclusive o controle negativo
5. Ler as primeiras 50 linhas da série uma a uma. A primeira corrida mede o check.

### Entrega incremental

1. Setup + Foundational → há onde gravar
2. + US1 → **toda chamada deixa rastro** (MVP; já responde o incidente de 31/07 com SQL cru)
3. + US2 → o 403 fica datado (a história que muda decisão de compra)
4. + US3 → a aba `/ia` (o dado vira leitura diária)
5. + US4 → o card (ninguém precisa lembrar de olhar)
6. + US5 → o orçamento (a corrida cara deixa de morrer no meio)
7. + Polish → a série não vira o maior objeto do banco

## Notes

- `[P]` = arquivo diferente, sem dependência pendente
- Commit por tarefa ou grupo lógico; `npm test` verde antes de cada push
- **Nenhuma meta numérica sobre a primeira janela** — nem taxa de falha, nem latência, nem consumo
- Nenhuma dependência nova em `package.json` além do arquivo de teste na lista do `npm test`
