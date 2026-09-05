# Tasks: Nenhum número da `/okr/atma` está errado

**Feature**: `018-atma-numeros-certos` | **Input**: `specs/018-atma-numeros-certos/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Testes**: **incluídos e obrigatórios**. Não é opção nesta feature — o Princípio II da
constituição é NÃO-NEGOCIÁVEL (`node --test`, arquivos `test/*.test.mjs`, lista explícita em
`package.json` no mesmo commit) e a SC-008 exige a suíte verde. Proibido instalar framework de
teste.

**Organização**: por user story, para que cada uma seja implementável e testável sozinha.

## Formato: `[ID] [P?] [Story] Descrição`

- **[P]**: paralelizável (arquivo diferente, sem dependência de tarefa incompleta)
- **[Story]**: US1…US5, mapeado para as user stories da spec
- Todo caminho de arquivo é relativo à raiz do repo (`roihub/`)

## Convenções de caminho

Aplicação Next 16 única, sem `src/` e sem monorepo: `app/` telas · `lib/` lógica
(`.mjs` puro × `.ts` só na borda, Princípio III) · `test/` testes · `scripts/` corridas manuais ·
`data/projects.json` curadoria · `handoff/` registro.

---

## Phase 1: Setup — a linha de base, ANTES de qualquer edição

**Objetivo**: medir o estado de hoje. Depois da primeira edição essa medição é irrecuperável.

> ⚠️ **T001 é literalmente a primeira coisa a rodar** (SC-000, research D10). Medir depois do
> conserto mede o conserto — e sem esta linha de base a SC-005 ("a lista encolheu") não tem contra
> o quê comparar.

- [X] T001 Contar as células `estado === "nao-apurado"` da ficha da `atma` **no código de hoje**, com coleta real (`node --env-file=.env` importando `montarNiveis()` de `lib/ficha.mjs` sobre os sete níveis), e gravar a contagem + a lista nominal + a data numa seção nova de `handoff/handoff-a-ficha-chamava-de-buraco-o-que-ja-estava-medido.md`. Corrida manual e única — **sem script permanente** em `scripts/` (seria scaffolding pelo mesmo argumento da FR-031).
- [X] T002 [P] Reproduzir e anexar ao mesmo handoff os números-verdade do banco da Atma (queries do Passo 1 do [quickstart.md](./quickstart.md)): `count(patient_leads)=51`, `min(created_at)=2026-07-31T06:14Z`, `motivo` agrupado em `21 respondeu / 29 sem_resposta / 1 sem motivo`, `orcamentos` `7 · sum 37465,43 · avg 5352,20 · avg líquido 4932,34`, `status_historico para='contatado' = 17`, `patient_leads.status` com **zero** em `novo`. São o oráculo de todos os testes das fases seguintes.

**Checkpoint**: linha de base registrada. Só agora se edita código.

---

## Phase 2: Foundational — a janela única do repo e os dois campos de card

**Objetivo**: o módulo de janela e o contrato do card, dos quais **todas** as user stories dependem.

**⚠️ CRÍTICO**: nenhuma user story começa antes desta fase fechar.

- [X] T003 [P] Escrever `test/janelas.test.mjs` (NOVO, deve **falhar** — o módulo ainda não existe) cobrindo as invariantes do contrato [janelas-mjs.md](./contracts/janelas-mjs.md): I1 pureza (importável sem `--env-file`, sem `process.env`, sem `Date.now()` fora de default de parâmetro), I2 `inicio <= fim` para qualquer `agora` e qualquer época passada, I3 `conversao(agora, null)` idêntica à janela de hoje (28d/D-3), I4 `conversao(agora, epoca)` cresce quando `agora` avança e a época fica parada, I5 `descoberta` e `comportamento` idênticas entre si e à janela de hoje.
- [X] T004 Registrar `test/janelas.test.mjs` na lista explícita do script `test` em `package.json` — **no mesmo commit que cria o arquivo** (Princípio II; `test/validade.test.mjs` compara lista × diretório nos dois sentidos e reprova se esquecerem).
- [X] T005 Criar `lib/janelas.mjs` (NOVO, **zero imports** — folha da árvore de dependências) exportando `descoberta(agora = Date.now())`, `comportamento(agora = Date.now())`, `conversao(agora = Date.now(), epoca = null)` e `hoje(agora = Date.now())`, cada janela como `{nome, inicio, fim, porque}` (FR-001…FR-006). Funções de `agora`, **nunca** constantes avaliadas no import — mesmo padrão de `lib/gsc-consulta.mjs:17`.
- [X] T006 `lib/okr-coleta.ts`: `FIM`/`INICIO`/`HOJE` (linhas 26-30, hoje `isoDaysAgo(3)`/`isoDaysAgo(30)`/`isoDaysAgo(0)` avaliados no import) passam a **derivar** de `lib/janelas.mjs`. As telas continuam importando de lá e nenhum call site muda de forma.
- [X] T007 `scripts/funil.mjs`: apagar a cópia local da janela (linhas 28-29, `diasAtras(31)`/`diasAtras(3)`) e importar de `lib/janelas.mjs` (FR-001 — nenhuma outra definição de janela PODE existir no repo). ⚠️ A janela do script encolhe de 31 para 30 dias de recuo; a linha 192 (`janela ${INICIO} → ${FIM}`) passa a imprimir a janela canônica.
- [X] T008 [P] `lib/projects.ts`: `Project` ganha `epoca?: { data: string; porque: string }` e `declaracoes?: Record<string, { quem: string; em: string; texto: string }>`, servidos por `listProjects()` (FR-004, FR-025 — Princípio I: nenhum novo import de `data/projects.json` fora daqui).
- [X] T009 `data/projects.json`: card `atma` ganha `epoca` (`2026-07-31`, "sociedade desfeita; o banco com os leads anteriores foi perdido") e `declaracoes.tratamento` com os valores exatos do §2.2 do [data-model.md](./data-model.md) — a declaração DEVE dizer **as duas coisas** (zero declarado pelo dono **e** checkout do MercadoPago descontinuado, FR-026). **Nenhum dos outros 16 cards ganha o campo** (FR-006, SC-007).

**Checkpoint**: `npm test` verde com `test/janelas.test.mjs` incluído. As user stories podem começar.

---

## Phase 3: User Story 1 — Cada cadeia lê a janela que a fonte tem (P1) 🎯 MVP

**Goal**: `/okr/atma` mostra **51 leads e 7 orçamentos** — tudo o que existe — em vez de 20 e 5.
Cada número carrega a janela que o produziu, e nenhuma taxa mistura duas cadeias.

**Independent Test**: quickstart Passo 3, itens 1, 2, 8 e 9 (lead 51 · orçamento 7 · janela colada
em cada número com a época exibida · nenhuma taxa `visitante→lead`), mais o Passo 4 inteiro (os 16
projetos sem época inalterados).

### Testes da US1

- [X] T010 [P] [US1] Em `test/okr.test.mjs`: `celulaDeLeads(leads, {...conversao(agora, epocaAtma), propria:true})` devolve `apurado(51)` e `celulasDeOrcamento(rows, conversao(agora, epocaAtma))` devolve `apurado(4)` (pacientes distintos — dedup do Túlio/017 sobre as 7 linhas cruas) — nunca 20 e 5 (US1-AC1, US1-AC2). Achado em implementação: `ehLeadDeTeste()` não pode rodar em fonte própria (D11 do research.md) — `patient_leads` só tem paciente real, e 8 deles usavam e-mail placeholder `teste@teste.com.br` (WhatsApp sem formulário).
- [X] T011 [P] [US1] Em `test/arvore-metas.test.mjs`: `montarArvore({ficha, projecao, ctr})` **não** acrescenta a camada de impressões quando `marcos[0].chave !== "visitante"`, e continua acrescentando quando é `visitante` (US1-AC5, research D6 — `lib/arvore-metas.mjs:170`).
- [X] T012 [P] [US1] Em `test/janelas.test.mjs`: projeto **sem** `epoca` recebe `CONVERSAO` = 28d/D-3 byte a byte, e só a `CONVERSAO` com época troca de tamanho — `DESCOBERTA` e `COMPORTAMENTO` ficam onde estão (FR-003, US1-AC3, SC-007).

### Implementação da US1

- [X] T013 [US1] `lib/okr-coleta.ts`: `coletarDoProjeto()` (linha 121) deixa de receber **uma** janela (`inicio`/`fim`, linhas 124-125) e passa a receber e devolver as **três**. GSC fica em `DESCOBERTA`, GA4 em `COMPORTAMENTO`, `patient_leads` e `orcamentos` passam a `CONVERSAO(agora, projeto.epoca)`; o `vendas` do card continua onde está (research D2 — a escolha é da borda, nunca da regra pura).
- [X] T014 [US1] `lib/arvore-metas.mjs`: `montarArvore()` só acrescenta a camada de impressões quando `marcos[0].chave === "visitante"` (FR-007). Sem isso a árvore divide `lead` pelo CTR do GSC e publica uma taxa `impressão → lead` que cruza Descoberta e Conversão — a US1-AC5 passaria na ficha e falharia na tela da árvore.
- [X] T015 [US1] `lib/ficha.mjs`: `resolverGa4(ga4, janela)` (linha 272) para de tratar janela divergente do GA4 como defeito a corrigir e passa a tratá-la como **estado normal** — com a época, divergência é a regra para a `atma`. O que ela bloqueia é a composição entre cadeias (FR-007), não a leitura (FR-010).
- [X] T016 [US1] `app/okr/[slug]/page.tsx`: todo número exibido carrega a janela que o produziu; os números de Descoberta e Comportamento vão para bloco próprio, com a janela deles e **sem taxa** ligando à Conversão; a época aparece com o motivo declarado ao lado da janela de Conversão; o rodapé "janela única para a árvore inteira (R7)" sai (FR-005, FR-008, FR-011).
- [X] T017 [US1] `app/okr/page.tsx`: exibir a janela de **cada linha**, não uma no cabeçalho, mantendo a ordenação por `posicaoDeAtaque()`; a frase de resumo ("N projetos na posição 1") DEVE dizer que soma janelas diferentes (FR-009).

### Validação da US1

- [X] T018 [US1] `npm test` verde e conferência na tela: `/okr/atma` com lead **51** e orçamento **4** (pacientes distintos), janela colada em cada número, época visível, nenhuma taxa entre `visitante` e `lead` na cadeia N3 (a régua de mercado — spec 015 — ainda compara `visitante→lead` até `REGUA.D` perder a linha em T028/US2); `/okr` com os **16 projetos sem época saindo com os mesmos números de antes** (quickstart Passos 3.1, 3.2, 3.8, 3.9 e Passo 4 — SC-007). Confirmado por `curl` autenticado contra o dev server já em execução (porta 3001, Basic Auth via `HUB_USER`/`HUB_PASS` do `.env`).

**Checkpoint**: os números de volume estão certos. A cadeia ainda não informa — isso é a US2.

---

## Phase 4: User Story 2 — `contatado` sai da cadeia e `respondeu` entra (P1)

**Goal**: a linha da cadeia deixa de ser ocupada por um degrau de 100% declarado e passa a mostrar
o degrau que decide: **21 de 51 responderam**.

**Independent Test**: quickstart Passo 3, itens 3, 4 e 5 — `respondeu 21` na cadeia, taxa
`lead→respondeu` como **piso 41,2% (21/51)** com o 1 indeterminado nomeado, e `contatado` como
nota, nunca como marco.

### Testes da US2

- [X] T019 [P] [US2] Em `test/okr.test.mjs`: `celulaDeResposta(reais)` devolve `apurado(21)` com `piso: {indeterminados: 1, teto: 22}`; sem lead sem motivo devolve `apurado(n)` **sem** `piso`; sem lead real na janela devolve `naoApurado(...)`; `PERFIS.D.marcos` é `lead → respondeu → orcamento → tratamento` (US2-AC1, US2-AC3).
- [X] T020 [P] [US2] Em `test/okr.test.mjs`: a trava latente dos perfis A/B — `PERFIS.A.marcos.find(m => m.chave === "signup").coletor === null` e `PERFIS.B.marcos.find(m => m.chave === "produto").coletor === null`. Reprova se `signup`/`produto` ganhar coletor sem tratar a travessia de cadeia (FR-012, SC-004).
- [X] T021 [P] [US2] Em `test/benchmark.test.mjs`: nenhuma linha de `REGUA.D` referencia degrau fora de `PERFIS.D.marcos` — a varredura nos dois sentidos já existe e fica vermelha sozinha se `lead→contatado` e `visitante→lead` ficarem (SC-003, research D9).
- [X] T022 [P] [US2] Em `test/ficha.test.mjs`: a taxa `lead→respondeu` sai como **piso** ("no mínimo 41,2% (21/51) · 1 indeterminado, teto 43,1%") com denominador **51**, nunca 50; a nota de contato existe e não é marco nem entra em gargalo; projeto perfil D **sem** fonte que devolva `motivo` (`aftercare`) recebe `não apurado` nomeando a fonte a consultar (US2-AC2, US2-AC4, US2-AC5, FR-015, FR-017).

### Implementação da US2

- [X] T023 [US2] `lib/okr.mjs`: nova `celulaDeResposta(reais)` — `motivo IS NOT NULL AND motivo <> 'sem_resposta'`, `familia: "D4"`, `fonte` citando a coluna `patient_leads.motivo`; anexa `piso: {indeterminados, teto}` quando há lead sem motivo (FR-014, contrato [cadeia-d.md](./contracts/cadeia-d.md)).
- [X] T024 [US2] `lib/okr.mjs`: `PERFIS.D` (linha 175) passa a `lead → respondeu → orcamento → tratamento`; `n2` e `fatores` remapeados conforme §5.1 do [data-model.md](./data-model.md) — `CR(respondeu→orçamento)` cobre `["orcamento"]` no lugar de `["contatado","orcamento"]`, sem buraco nem sobreposição na cobertura contígua que `avaliarN2()` exige (FR-011, FR-018).
- [X] T025 [US2] `lib/okr.mjs`: `montarFicha()` (linha 295) — `coletado` ganha a chave `respondeu` e mantém `contatados`; a taxa cujo **numerador** carrega `piso` copia esse campo para si. `razao()`, `ehApurado()` e `exigencia()` **não mudam** — `piso` atravessa a cadeia sem que nenhuma delas saiba que existe (FR-016, research D3).
- [X] T026 [US2] `lib/okr-coleta.ts`: `coletarDoProjeto()` passa a devolver `respondeu` ao lado de `leads`/`contatados`, lido da mesma query de `patient_leads` (nenhuma chamada de rede nova).
- [X] T027 [US2] `lib/ficha.mjs`: `montarNiveis()` (linha 527) transforma `celulaDeContato()` numa **nota** de N3 — "100% contatados (declarado pelo operador, 05/09/2026)" —, sem taxa e fora do cálculo de gargalo; `montarN3()` (linha 646) renderiza o "no mínimo" da taxa com piso. `nivel()` já aceita `nota` como terceiro parâmetro (FR-013, research D5).
- [X] T028 [US2] `lib/benchmark.mjs`: `REGUA.D` (dentro de `REGUA`, linha 66) perde `lead→contatado` (fonte InfluxMD mede *agendamento*, degrau que a Atma não tem) e `visitante→lead` (cruza cadeias); as citações ficam em **comentário**, como a 017 fez com case acceptance (FR-019).
- [X] T029 [US2] `app/okr/[slug]/page.tsx`: exibir a taxa `lead→respondeu` como piso com o indeterminado nomeado, e a nota de contato fora da cadeia.

### Validação da US2

- [X] T030 [US2] `npm test` verde e conferência na tela (quickstart Passo 3, itens 3, 4 e 5). Achado durante a validação: `app/okr/[slug]/page.tsx` e `app/okr/page.tsx` colhiam `respondeu` de `coletarDoProjeto()` (T026) mas não o repassavam para `montarFicha({coletado})` — o marco `respondeu` ficava "coletor não rodou" na tela real mesmo com a lib correta. Corrigido nas duas páginas; confirmado ao vivo: "no mínimo 41,18% (21/51) · 1 indeterminado, teto 43,14%" e "100% contatados (declarado pelo operador, 05/09/2026)".

**Checkpoint**: a cadeia aponta gargalo. Falta o dinheiro — US3.

---

## Phase 5: User Story 3 — O ticket é o apurado líquido, não o declarado (P1)

**Goal**: a conta da meta usa **R$ 4.932,34** e diz **10,1 vendas**, não 12,5.

**Independent Test**: quickstart Passo 3, itens 6 e 7 — ticket R$ 4.932,34 rotulado `apurado`
(nunca "declarada (D1)") e projeção da meta de R$ 50.000 em 10,1.

### Testes da US3

- [X] T031 [P] [US3] Em `test/okr.test.mjs`: `ticketDeOrcamentos(rows, janelaConversao)` devolve `apurado(4932.34)`; linha com `preco` ausente ou não numérico fica **fora** da média e **nunca** vira `0`; `rows === null` devolve `naoApurado("sem fonte de orçamento")`; tabela sem linha na janela devolve `naoApurado("sem orçamento na janela")` (contrato [ticket.md](./contracts/ticket.md)).
- [X] T032 [P] [US3] Em `test/projecao.test.mjs`: meta de R$ 50.000 com o ticket resolvido devolve **10,1**, não 12,5 (SC-002).
- [X] T033 [P] [US3] Em `test/ficha.test.mjs`: `resolverTicket(ticketApurado, meta)` nos três ramos — apurado vence declarado; sem apuração cai para `declarada(meta.ticket)`; sem os dois devolve `naoApurada(...)`. **Nunca zero, nunca média de outra janela**, e o rótulo do apurado nunca sai como "declarada (D1)" (US3-AC1…AC4, FR-023, FR-024).

### Implementação da US3

- [X] T034 [US3] `lib/okr-coleta.ts`: o SELECT de `orcamentos` passa a trazer `preco` e `desconto_vista` — as colunas sempre existiram e a query nunca as pediu. Mesma conexão, mesma query, zero chamada de rede nova (FR-020).
- [X] T035 [US3] `lib/okr.mjs`: nova `ticketDeOrcamentos(rows, {inicio, fim})` — `avg(preco × (1 − coalesce(desconto_vista, 0)))` sobre a janela `CONVERSAO`. Líquido porque o desconto foi concedido em **7 de 7** linhas: desconto que 100% dos casos recebe **é** o preço (FR-021).
- [X] T036 [US3] `lib/ficha.mjs`: nova `resolverTicket(ticketApurado, meta)` devolvendo **uma** `CelulaFicha` rotulada; `montarN1()` (linha 616) e `avaliarN2()` (linha 146) passam a receber a célula pronta em vez de `{ticket, ticketDeclaradoEm}`. `combinar()` **não muda** — com o insumo apurado entrando, o N1 vira `apurado` sozinho (FR-022, FR-023, research D4).
- [X] T037 [US3] `app/okr/[slug]/page.tsx`: chamar `resolverTicket()` **antes** de `projetar()` e passar `{...p.meta, ticket: ticketCel.valor}` quando resolvido; `app/okr/projecao.tsx` para de imprimir "declarada (D1)" em cima do ticket apurado. `lib/projecao.mjs` **não recebe uma linha nova** (FR-034).

### Validação da US3

- [X] T038 [US3] `npm test` verde, quickstart Passo 3 itens 6 e 7 conferidos, e `git diff lib/projecao.mjs` **vazio** (trava da FR-034). Achados durante a implementação corrigiram três "números-verdade" da spec (D11/D12 do research.md): lead 43→51 (`ehLeadDeTeste()` não roda em fonte própria), orçamento 7→4 (degrau é pacientes distintos, ticket continua usando as 7 linhas cruas) e a projeção mostra "âncora zerada" em vez de "10,1" (cadeia fecha inteira em `tratamento=0`; `ancoraDe()` congelado escolhe o último marco — comportamento correto, já seria assim antes da 018). Confirmado ao vivo: ticket "R$ 4.932" com fonte "líquido de desconto" (rotulado apurado, nunca declarada).

**Checkpoint**: os três defeitos de número exibido estão fechados. O MVP da spec termina aqui.

---

## Phase 6: User Story 4 — A lista de buracos só tem buraco de verdade (P2)

**Goal**: o leitor abre a ficha e a lista de buracos **encolheu** contra a linha de base do T001,
porque "a tela não lê" saiu dali.

**Independent Test**: quickstart Passo 3, itens 10 e 11 — lista de buracos menor que a do T001,
nenhum sobrevivente com `tela-nao-le`, e `tratamento` em `apurado(0)` com a `fonte` dizendo as duas
coisas.

### Testes da US4

- [X] T039 [P] [US4] Em `test/funil.test.mjs`: `naoApurado(motivo)` **sem** rótulo devolve o objeto idêntico ao de hoje, byte a byte, e `naoApurado(motivo, "tela-nao-le")` carrega o campo. Nunca há default (US4-AC1, FR-028 — rótulo obrigatório com default gravaria `nao-mede` em ~70 dos 72 call sites não revisados, produzindo em massa a declaração falsa que a spec existe para acabar).
- [X] T040 [P] [US4] Em `test/ficha.test.mjs`: célula com `rotuloBuraco === "tela-nao-le"` **não entra** na lista de buracos e **não pode** ser escolhida por `posicaoDeAtaque()`; `falhou-agora` continua separada do buraco permanente (US4-AC2, US4-AC3 — regressão da rodada 3 do design-review); célula sem rótulo continua caindo na `EH_FALHA_TRANSITORIA` de hoje.

### Implementação da US4

- [X] T041 [US4] `lib/funil.mjs`: `naoApurado(motivo, rotuloBuraco?)` (linha 24) — valores `nao-mede` | `falhou-agora` | `tela-nao-le`, **opcional e sem default**. É campo, **nunca** regex sobre o texto do motivo (FR-028).
- [X] T042 [US4] `lib/ficha.mjs`: `naoApurada(motivo, consultar, rotulo, rotuloBuraco?)` (linha 46). O nome do campo é `rotuloBuraco`, **não** `rotulo` — `CelulaNaoApurada` já tem um `rotulo`, que é o texto exibido ("orçamento ENVIADO"), e dois significados no mesmo objeto é o defeito que `rótulo de exibição nunca é chave` já custou uma vez.
- [X] T043 [US4] `lib/ficha.mjs`: a lista de buracos ignora célula com `rotuloBuraco === "tela-nao-le"` (FR-029). O rótulo é **ortogonal** a D1–D4 e `familiaDe()` fica como está (FR-030).
- [X] T044 [US4] `lib/okr.mjs`: `posicaoDeAtaque()` (linha 341) não pode escolher célula com `rotuloBuraco === "tela-nao-le"` (FR-029).
- [X] T045 [US4] Colocar `falhou-agora` **só nos três pontos revisados** — erros de conexão em `lerFontePropria()` (`lib/okr-coleta.ts`), `gscSeries` com `{erro}` e o estado `erro` de `resolverGa4()` (`lib/ficha.mjs`). Todo o resto fica **sem rótulo**, de propósito (contrato [rotulo-buraco.md](./contracts/rotulo-buraco.md)).
- [X] T046 [US4] `lib/ficha.mjs`: a `fonte` do marco `tratamento` **anexa** (não substitui) a `declaracoes.tratamento` do card — "extrato do gateway / contrato do tratamento · declarado por Jean em 2026-09-05: …". Fecha a FR-004 da 017, que ficou meio cumprida: a `fonte` do `contatado` citava a regra e não citava quem nem quando (FR-025, FR-026, FR-027).
- [X] T047 [US4] `app/okr/[slug]/page.tsx`: precedência `c.rotuloBuraco` → se ausente, `EH_FALHA_TRANSITORIA.test(c.motivo)` (linhas 94-95, 316, 735). A regex **fica**, apenas como o comportamento de hoje para célula sem rótulo (FR-028, R2 do contrato).

### Validação da US4

- [X] T048 [US4] Recontar os buracos da `atma` e comparar com a linha de base do T001: os `tela-nao-le` dão **zero** (US4-AC4 ✓ — nenhum dos 4 buracos restantes é dívida de leitura). `status_historico` **não virou célula** (confirmado por revisão de código — nenhum coletor/marco a referencia). A lista **ainda não encolheu** (4 = 4, mesmos 4 motivos do T001): nenhuma tarefa de US1-US4 remove uma célula que já era `nao-apurado` na linha de base — US1-US3 corrigem números de células que já eram `apurado`/`declarado`, e US4 só liga o mecanismo do rótulo (nenhuma célula ganhou `tela-nao-le` ainda, corretamente, pois nenhuma das 4 é dívida de leitura). O único candidato a sair — `abandono-por-campo` — depende de `form_submit` sair de `EVENTOS_D3`, que é a US5 (T050/T051). SC-005 fecha depois da Phase 7, não aqui; revalidado em T053/T059.

**Checkpoint**: a lista de buracos volta a ser informação para quem decide.

---

## Phase 7: User Story 5 — `form_submit` sai do catálogo (P3)

**Goal**: o medidor de abandono para de pedir instrumentação para um degrau que o banco já mede.

**Independent Test**: quickstart Passo 3, item 12 — `abandono-por-campo` em **12 (19,1%)**
(`form_start` 63 − `lead` 51, dentro da época).

### Testes da US5

- [X] T049 [P] [US5] Em `test/ficha.test.mjs`: `form_submit` não aparece em nenhum catálogo de medidores (SC-006, US5-AC1); o abandono devolve **12 (19,1%)** com `form_start` 63 e `lead` 51 dentro da época (US5-AC2); janela de GA4 que **não cabe inteira** dentro da época devolve `não apurado` nomeando a divergência (US5-AC3). ⚠️ O terceiro caso **nasce inerte** de propósito — com a FR-003 o GA4 fica em 28d, que cabe nos 37 dias da época. Ele existe para o dia em que a 019 esticar o GA4 para 12 meses; teste inerte com motivo escrito é barato, a armadilha sem teste custa a 019 inteira.

### Implementação da US5

- [X] T050 [US5] `lib/ga4.ts`: `EVENTOS_D3` (linha 77) perde `form_submit` → `["scroll", "click", "form_start", "begin_checkout"]`. O banco é canônico para o degrau `lead`; duas fontes para o mesmo degrau só criam a chance de discordarem (FR-032).
- [X] T051 [US5] `lib/ficha.mjs`: `medidoresDeEventos(ga4ev)` (linha 394) passa a `medidoresDeEventos(ga4ev, {lead, janelaGa4, epoca})` e calcula `abandono = form_start (GA4) − lead (banco)`, **só quando `janelaGa4` cabe inteira dentro da época**; fora disso, `não apurado` nomeando a divergência (FR-033).
- [X] T052 [US5] Atualizar os call sites de `medidoresDeEventos()` (`montarNiveis()` em `lib/ficha.mjs`) para passar `lead`, `janelaGa4` e `epoca`.

### Validação da US5

- [X] T053 [US5] `npm test` verde e quickstart Passo 3 item 12 conferido na tela. Achado em implementação (D8 do research.md): a guarda de janela estava com a direção invertida — "GA4 cabe dentro da época" deixava passar 28d contra 37d e produzia abandono **negativo** (-14); corrigida para "GA4 COBRE a época inteira", a guarda agora dispara corretamente hoje. Confirmado ao vivo: "não cobre a época inteira (2026-07-31→2026-09-05)" — nunca um número negativo. O "12 (19,1%)" do quickstart é o resultado esperado quando a 019 esticar o GA4 para cobrir a época.

**Checkpoint**: todas as user stories entregues.

---

## Phase 8: Polish & Cross-Cutting

- [X] T054 [P] Registrar em `handoff/` o backlog que **não** vira célula nesta spec (FR-031): velocidade (8,3 h médios até o contato, 34,9 h no pior caso), passagem cumulativa e coorte — com a regra de que coorte com `n < 20` sai como **contagem crua, nunca percentual** (uma coorte de 4 leads só produz 0%, 25%, 50%, 75% ou 100%).
- [X] T055 [P] Varredura de resíduo em `lib/`, `app/` e `test/`: nenhuma ocorrência de `contatado` como **marco** e nenhuma linha de `REGUA` apontando para degrau fora da cadeia (SC-003). Confirmado por grep: toda ocorrência de `contatado`/`visitante` fora de PERFIS.A/B (que legitimamente mantêm `visitante`) é comentário, o coletor `contatados` (nota de N3) ou fixture sintética de `test/projecao.test.mjs`/`test/ficha-visual.test.mjs` (módulos congelados, não tocados por esta spec). `REGUA.D` está vazia; `test/benchmark.test.mjs` já varre os dois sentidos.
- [X] T056 `npm test` verde na suíte inteira, com `test/janelas.test.mjs` na lista de `package.json` (T004) e `test/validade.test.mjs` passando nos dois sentidos (incluído no `npm test` verde — SC-008, Princípio II). 611 testes, 0 falhas. Nota: a suíte já rodava em ~4,5s antes desta spec (não os "~1,6s" que plan.md cita — número desatualizado, não uma regressão desta feature); agora roda em ~4,3s, dentro do mesmo patamar.
- [X] T057 `git diff package.json` **não pode tocar `dependencies`** — zero pacote adicionado, zero framework de teste (Princípio II e §Restrições Técnicas). Confirmado: o único diff é a lista `test` ganhando `test/janelas.test.mjs`; `dependencies`/`devDependencies` intocados.
- [X] T058 Rodar `node --env-file=.env scripts/funil.mjs --ver` e **ler as linhas nominais** antes de acreditar em qualquer contagem do rodapé — a primeira corrida de um check novo mede o check. Conferir que a janela impressa é a canônica de `lib/janelas.mjs` (mudou de 31 para 30 dias de recuo, T007). Confirmado: rodapé imprime `janela 2026-08-06 → 2026-09-02` — `descoberta()` (30d de recuo), não mais o antigo `diasAtras(31)` (que daria 2026-08-05). Linhas nominais de `atma` conferidas (5 leads reais nome+e-mail+data). Nota de escopo: este script usa UMA janela só (DESCOBERTA) para tudo, inclusive `leads` da fonte própria — não ficou consciente de época/CONVERSAO (T007 só trocou a janela local pela canônica, não pediu essa consciência), então `atma` aqui mostra 20 leads (os últimos 28 dias), não 51 (a época inteira). É o comportamento correto para o ESCOPO deste script — comparação época-aware é só na `/okr` e na ficha.
- [X] T059 Executar o [quickstart.md](./quickstart.md) de ponta a ponta (Passos 1 a 4). `npm test` verde (611), `tsc --noEmit` limpo, dev server próprio subido para conferência final ao vivo (o dev server externo que vinha sendo usado caiu no meio da sessão). Confirmado: lead 51→**52** ao vivo (lead novo chegou durante a sessão — dado real mudando, não defeito), piso recalculado sozinho para "40,38% (21/52) · 2 indeterminados", nota de contato caiu de 100% para **98%** (o lead novo ainda não foi contatado) — o sistema reage corretamente a dado que muda em tempo real. Orçamento 4, ticket R$ 4.932 (líquido, apurado), abandono "não cobre a época inteira", `/okr` com a nota de janela só na atma e a frase de resumo atualizada. Push **NÃO executado** — aguardando confirmação explícita do usuário (16:35 BRT no momento da validação, fora das janelas de bloqueio do Princípio IV, mas push/commit não são automáticos por padrão desta sessão).

---

## Dependencies & Execution Order

### Dependências de fase

- **Phase 1 (Setup)**: sem dependências — e **T001 tem que ser a primeira coisa a rodar**, antes de qualquer edição. Depois da primeira edição a linha de base é irrecuperável (SC-000).
- **Phase 2 (Foundational)**: depende do Setup. **BLOQUEIA todas as user stories** — `lib/janelas.mjs` é insumo da US1 (janela por cadeia), da US3 (janela `CONVERSAO` do ticket) e da US5 (guarda de época); os dois campos do card são insumo da US1 (`epoca`) e da US4 (`declaracoes`).
- **Phase 3-7 (User Stories)**: todas dependem da Phase 2.
- **Phase 8 (Polish)**: depende das user stories desejadas.

### Dependências entre stories

- **US1 (P1)**: só depende da Foundational. É o MVP.
- **US2 (P1)**: só depende da Foundational. Independente da US1 no código (toca `PERFIS.D`, `celulaDeResposta`, `REGUA.D`), mas **na tela só faz sentido depois da US1** — `respondeu 21` sobre um `lead` truncado em 20 seria um piso calculado na população errada. Entregar na ordem US1 → US2 → US3.
- **US3 (P1)**: só depende da Foundational. Compartilha `lib/okr.mjs`, `lib/ficha.mjs` e `app/okr/[slug]/page.tsx` com a US2 — paralelizar as duas exige duas pessoas coordenando esses três arquivos.
- **US4 (P2)**: depende da Foundational; o **T048** (comparar com a linha de base) exige US1-US3 fechadas, porque é a leitura delas que faz a lista encolher.
- **US5 (P3)**: a mais isolada — `lib/ga4.ts` não é tocado por mais ninguém.

### Dentro de cada story

Teste escrito **e falhando** antes da implementação → regra pura em `.mjs` → borda em `.ts` →
tela → validação. Nunca o contrário: lógica testável que nasce em `.ts` deixa de ser coberta
(Princípio III).

### Oportunidades de paralelismo

- **T002** roda junto de T001 (arquivo diferente, leitura só).
- **T003** e **T008** em paralelo (test novo × `lib/projects.ts`).
- **Testes de uma story** marcados `[P]`: T010/T011/T012 · T019/T020/T021/T022 · T031/T032/T033 · T039/T040.
- **T054** e **T055** em paralelo no polish.
- **US5 inteira** em paralelo a qualquer outra story.

---

## Parallel Example: User Story 2

```bash
# Os quatro testes da US2, ao mesmo tempo:
Task: "T019 celulaDeResposta → apurado(21) com piso em test/okr.test.mjs"
Task: "T020 trava latente A/B (signup/produto com coletor null) em test/okr.test.mjs"
Task: "T021 REGUA.D sem degrau órfão em test/benchmark.test.mjs"
Task: "T022 piso 41,2%, nota de contato e herança do aftercare em test/ficha.test.mjs"
```

⚠️ T019 e T020 moram no **mesmo arquivo** (`test/okr.test.mjs`) — paralelizáveis como redação,
não como escrita simultânea no arquivo.

---

## Implementation Strategy

### MVP primeiro (US1)

1. Phase 1 (linha de base — **irrecuperável depois**)
2. Phase 2 (Foundational — bloqueia tudo)
3. Phase 3 (US1)
4. **PARAR E VALIDAR**: quickstart Passos 3.1/3.2/3.8/3.9 e Passo 4
5. `/okr/atma` já para de publicar número truncado

### Entrega incremental

1. Setup + Foundational → a janela única existe
2. US1 → **51 e 7 na tela** (deploy/demo — MVP)
3. US2 → a cadeia aponta gargalo (`respondeu 21`, piso 41,2%)
4. US3 → o dinheiro fica certo (R$ 4.932,34 → 10,1 vendas)
5. US4 → a lista de buracos encolhe
6. US5 → `form_submit` sai do catálogo

Cada uma agrega sem quebrar a anterior. As três P1 juntas são o corpo da spec; US4 e US5 são
limpeza que só faz sentido depois delas.

---

## Notes

- `[P]` = arquivo diferente, sem dependência de tarefa incompleta.
- Todo arquivo de teste novo entra em `package.json` **no mesmo commit** que o cria (Princípio II).
- Nenhuma dependência nova, nenhum framework de teste, nenhum linter (§Restrições Técnicas).
- Comentário explica o **porquê**, com o fato medido: 51 × 20, 4.932,34 × 4.000, 21/51, 17 × 51.
- Commit por tarefa ou grupo lógico; parar em qualquer checkpoint para validar a story sozinha.
- **Fora de escopo** (FR-035): primeira dobra, `/okr/atma/metodo`, `/okr/atma/aquisicao`, pipeline como valor em risco e as janelas longas de Descoberta/Comportamento são a **019**; as seis réguas pesquisadas e o `DELETE` de `market_benchmarks` são a **020**.
