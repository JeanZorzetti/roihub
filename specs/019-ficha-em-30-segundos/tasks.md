# Tasks: A ficha responde em 30 segundos

**Input**: documentos de design em `/specs/019-ficha-em-30-segundos/`

**Prerequisites**: `plan.md` ✅ · `spec.md` ✅ · `research.md` ✅ · `data-model.md` ✅ ·
`contracts/` (4) ✅ · `quickstart.md` ✅

**Tests**: **obrigatórios** — a spec e os contratos listam as tabelas de teste caso a caso
(`buracos.md`, `projecao-guarda-8.md`, `valor-em-risco.md`, `rotas-e-janelas-longas.md`) e a SC-010
exige `npm test` verde. **Zero arquivo de teste novo**: as cinco suítes tocadas
(`okr`, `projecao`, `janelas`, `arvore-metas`, `ficha`) já estão registradas no `package.json`
(linha 9, conferido) — nenhuma edição da lista de scripts é necessária nesta spec.

**Organization**: por user story, na ordem de prioridade da spec (US1/US2/US3 = P1, US4/US5 = P2,
US6 = P3). Cada fase fecha num checkpoint verificável sozinho.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: a user story à qual a tarefa pertence
- Todo caminho de arquivo é exato e relativo à raiz do repo

## Path Conventions

Aplicação Next 16 única, sem `src/`: `app/` telas · `lib/` lógica (`.mjs` puro, `.ts` borda) ·
`test/` testes · `data/` cards · `handoff/` registros de medição.

---

## Phase 1: Setup — medir ANTES de editar

**Purpose**: linha de base. Medir depois do conserto mede o conserto
(`first_run_measures_the_check`). Nenhuma edição de código nesta fase.

- [X] T001 [P] **SC-000 (primeira tarefa, sem exceção)**: medir com Playwright em
      `https://hub.roilabs.com.br/okr/atma` a altura total do documento a **1280×800** e a
      **360×640**, mais o que está acima da dobra a 1280×800. Registrar em
      `handoff/handoff-019-linha-de-base.md` com **data, build (`git rev-parse --short HEAD`) e as
      duas capturas**. Referência de 03/09/2026: 5.267px em 360px — se hoje der outra coisa, vale a
      de hoje e a diferença já é informação.
- [X] T002 [P] **Linha de base da SC-007**: capturar `/okr` (o ranking dos 17 e a célula
      `visitante` de cada card) **antes** de qualquer edição, no mesmo arquivo de handoff. É a
      regressão que importa: mexer na tela da atma não pode mudar o placar de mais ninguém.
- [X] T003 [P] Rodar `npm test` e registrar o verde de partida e o tempo (~1,6 s hoje) no handoff —
      o teto declarado no plano é ~2 s.

**Checkpoint**: linha de base registrada com data e build. Só agora se edita código.

---

## Phase 2: Foundational — a orquestração compartilhada (BLOQUEIA US4 e US5)

**Purpose**: três telas passam a precisar da mesma composição. Duas cópias divergiriam na primeira
mudança de veredito, e a FR-021 proíbe exatamente isso. **É movimento de código, não abstração
nova — nenhuma regra nasce aqui.**

⚠️ **CRÍTICO**: US4 e US5 não começam antes de T006. US1, US2 e US3 podem começar em paralelo a
esta fase (tocam outros arquivos), mas US1 fica mais barata depois de T006.

- [X] T004 **BLOQUEANTE da US3** — rodar contra `ATMA_DATABASE_URL` (somente leitura):
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'patient_leads' ORDER BY ordinal_position;`
      Confirmar o nome real da chave primária e registrá-lo no handoff. **Se não se chamar `id`, o
      nome real entra no SELECT da T017 e em `contracts/valor-em-risco.md`.** Nunca se assume —
      precedente `tela_nao_le_nao_e_buraco_de_medicao` (quatro design-reviews perdidos por não abrir
      o `information_schema` primeiro).
- [X] T005 Criar `lib/ficha-dados.ts` com `export async function dadosDaFicha(slug): Promise<DadosDaFicha | null>`,
      movendo o corpo de `FichaPage` (`app/okr/[slug]/page.tsx:403-547`) sem alterar uma decisão:
      `evaluateAll()` **uma vez** → `lerFontePropria()` → `montarFicha()` → `posicaoDeAtaque()` →
      `resolverTicket()` → `projetar()` → `montarArvore()` → `montarNiveis()`. Devolver os **mesmos
      nomes de campo** de hoje (`p, ficha, veredito, mercado, projecao, arvore, niveis, janelas,
      motivos, orcamentos, buracos, pendentes, cliques, impressoes, ctr, entrega, ctrAlvo`) para o
      diff da página ser de ordem, não de renomeação. `null` quando o projeto não existe.
- [X] T006 Ligar `app/okr/[slug]/page.tsx` a `dadosDaFicha(slug)` (`notFound()` no `null`),
      **sem mexer na ordem dos blocos**. `export const dynamic = "force-dynamic"` **fica**. A tela
      tem que renderizar byte a byte o que renderizava.
- [X] T007 Verificar: `npm test` verde e `/okr/atma` visualmente idêntica à captura da T001.
      Diferença aqui é defeito de movimentação, não entrega.

**Checkpoint**: orquestração extraída, tela intacta, suíte verde. US4/US5 liberadas.

---

## Phase 3: User Story 1 — A primeira dobra responde as três perguntas (P1) 🎯 MVP

**Goal**: `/okr/atma` a 1280×800 abre com cadeia → motivo+ação → buracos, sem nada entre eles e o
`<h1>`, e a ordem se mantém a 360×640.

**Independent Test**: abrir `/okr/atma` a 1280×800 **sem rolar** e dizer em voz alta qual degrau é o
pior, por que, e o que fazer. A 360×640, as três respostas nas duas primeiras rolagens, **na mesma
ordem**.

> **Nota de independência**: no slot 3 esta fase mantém a célula única `proximoBuraco` de hoje; a
> US2 a substitui pela lista. A US1 é testável antes da US2 — reordenar não depende de extrair a
> lista.

### Implementação

- [X] T008 [US1] Em `app/okr/[slug]/page.tsx`, **bloco 1 — Cadeia**: degraus + taxas + janela de
      CONVERSAO com a época declarada + o pior degrau marcado, imediatamente após o `<h1>`.
      `veredito.rotulo`/`veredito.motivo` viram **legenda desse bloco**: o `<section>` "Onde trava"
      **deixa de existir** (FR-002a).
- [X] T009 [US1] Ainda em `page.tsx`, a régua de mercado vira **uma linha dentro do bloco da
      cadeia**, subordinada ao veredito, rotulada como diagnóstico e nunca como alvo (FR-006, R6).
- [X] T010 [US1] **Bloco 2 — motivo + ação num `<section>` só** (FR-003): `motivos.motivos[0]`
      colado à ação vinda de `evaluateAll()`. Sem `motivo` na fonte (ex.: `aftercare`) o bloco é
      **omitido**, nunca preenchido com placeholder, e a ordem dos demais não muda (US1-AC5).
- [X] T011 [US1] **Bloco 4 — placar** logo abaixo dos buracos: `<Projecao>` e (quando a US3 chegar)
      `<ValorEmRisco>`. "Quanto falta" deixa de ser bloco separado do valor em risco.
- [X] T012 [US1] Remover `<nav className="tabs ficha-indice">` (o índice `N0…N6`) e pôr no lugar
      **um** link para `/okr/[slug]/metodo` (FR-007). As sete `<section>` de N0–N6 e o bloco "Árvore
      de metas" **saem na US4**, não aqui — remover antes da rota existir perderia conteúdo.
- [X] T013 [US1] Confirmar que o bloco "Descoberta" **fica onde está** (FR-024a), agora declarando a
      janela curta (28d/D-3) e linkando a longa em `/okr/[slug]/aquisicao`. Ele só renderiza quando
      `marcos[0]` é `visitante` — perfis A/B, nunca a atma.
- [X] T014 [US1] Verificar a régua única (US1-AC3): o pior degrau marcado no bloco da cadeia é
      `veredito.celula` de `posicaoDeAtaque()`, via `indiceTrava()`, que sobrevive intacta. Não
      existe segunda régua de "pior" na tela.

**Checkpoint**: as três respostas acima da dobra a 1280×800, mesma ordem a 360×640. Medir de novo
a altura e comparar com a T001.

---

## Phase 4: User Story 2 — Os buracos reais viram uma lista, e ela é curta (P1)

**Goal**: o leitor vê **quantos** buracos existem e **quais**, cada um nomeando a fonte a consultar.

**Independent Test**: `/okr/atma` mostra a lista com ≤ 2 linhas, nenhuma com `tela-nao-le`, e o
`falhou-agora` agrupado à parte. Num projeto sem buraco, a linha "nenhum buraco de medição na
cadeia" aparece.

### Testes primeiro (`test/okr.test.mjs` — já registrado) ⚠️

- [X] T015 [P] [US2] Escrever em `test/okr.test.mjs`, e ver **falhar**, os cinco casos de
      `contracts/buracos.md`: (1) `tela-nao-le` **não** aparece; (2) `falhou-agora` aparece com
      `transitorio: true`; (3) `nao-mede` e sem rótulo aparecem com `transitorio: false`;
      (4) todos apurados → `[]`, **nunca `null`**; (5) na mesma ficha, `posicaoDeAtaque().celula` é
      o primeiro D4 da lista, ou o primeiro item — **zero divergência entre as duas leituras**.

### Implementação

- [X] T016 [US2] Em `lib/okr.mjs`, extrair o filtro da linha 451 para
      `export function buracosDeVerdade(marcos)`, devolvendo
      `{chave, nome, fonte, motivo, familia, transitorio}` — note o rename `familiaDoBuraco` →
      `familia` no objeto devolvido. Ordem dos marcos preservada (é a ordem da cadeia; quem prioriza
      D4 é `posicaoDeAtaque()`, do lado dela). Fazer `posicaoDeAtaque()` **consumir a mesma
      função** — duas listas de "onde falta dado" na mesma tela é a segunda régua que a FR-002
      proíbe.
- [X] T017 [US2] Criar `app/okr/[slug]/buracos.tsx`: cada linha nomeia **a fonte a consultar**
      (US2-AC2); `transitorio` sai num agrupamento próprio abaixo dos permanentes, rotulado como
      transitório, sem competir pela atenção (US2-AC4, regressão da rodada 3 do design-review);
      lista vazia diz **"nenhum buraco de medição na cadeia"** (FR-005) — sumir em silêncio é
      indistinguível de não ter sido calculada.
- [X] T018 [US2] Mover para dentro de `<Buracos>` a frase "isso fecha um buraco de medição, mas não
      destrava X" (quando `veredito.posicao === 1` e `veredito.celula` ≠ primeiro buraco). Sem ela a
      dobra parece dois planos de ataque.
- [X] T019 [US2] Trocar em `app/okr/[slug]/page.tsx` a célula única do slot 3 pelo `<Buracos>`.

**Checkpoint**: `npm test` verde; a lista da atma com ≤ 2 linhas (SC-002), conferida na tela.

---

## Phase 5: User Story 3 — O placar diz o que falta e o que está em risco (P1)

**Goal**: a dobra mostra o que a meta exige **e** por que a cadeia não a distribui, mais o pipeline
somado.

**Independent Test**: `/okr/atma` exibe `n1Total` apurado ("10,1 tratamentos até 31/12/2026", no
valor que a conta der no dia) **e**, na mesma tela, a frase da âncora zerada; e exibe
`enviados · fechados · vivos` batendo com a query 3 do quickstart **rodada no momento da
verificação**.

⚠️ **T004 é pré-requisito de T024.**

### 5a — A guarda 8 partida (FR-008..FR-012)

- [X] T020 [P] [US3] Escrever em `test/projecao.test.mjs`, e ver **falhar**, os seis casos de
      `contracts/projecao-guarda-8.md`: (1) `ehApurado(n1Total)` com a cadeia fechando em
      `tratamento = 0`, e o valor é `meta.valor / meta.ticket` — **a conta, nunca a constante**;
      (2) `n1Janela` apurado e `normalizacao.conta` legível; (3) `fatorObrigatorio` e
      `multiploNecessario` **não apurados**, com o motivo citando a âncora zerada;
      (4) `veredito === "nao-apurado"`; (5) **guardas 1–7 byte a byte o de hoje** (a trava de
      não-regressão dos 16 projetos sem meta); (6) cadeia com âncora não zerada → ramos de taxa e
      múltiplo inalterados.
- [X] T021 [US3] Em `lib/projecao.mjs`, mover a guarda 8 (`lib/projecao.mjs:117`) para **depois** do
      cálculo de `n1Total`, `n1Janela` e `normalizacao`, e devolver o retorno parcial do contrato:
      `n1Total`/`n1Janela`/`normalizacao` apurados, `ancora` (o objeto real, com valor 0 — a tela
      precisa do nome do degrau), `fatorObrigatorio`/`multiploNecessario`/`folga`/`multiploDeVolume`
      não apurados com o motivo `"âncora zerada — meta não se divide por volume nenhum"`,
      `degrausAMedir: []`, `veredito: "nao-apurado"`. **Guardas 1–7 não se tocam** — cada uma nomeia
      um fator que falta na própria divisão da meta; só a 8 fala da cadeia. Comentar no código que a
      **FR-011 revoga por escrito a FR-034 da 018**.
- [X] T022 [US3] Em `app/okr/projecao.tsx`, remover o `return` cedo em
      `p.veredito === "nao-apurado"`. Renderizar em duas partes: (1) se `ehApurado(p.n1Total)`, a
      linha da meta com o rótulo de ticket apurado/declarado que já existe; (2) **sempre em
      seguida**, a frase de `p.motivo`. Fator, múltiplo, folga e degraus a medir continuam guardados
      por `ehApurado()`. Projeto sem meta nenhuma continua caindo na linha de hoje.
- [X] T023 [US3] Verificar a **consequência declarada (FR-008a)**: `/okr` muda de texto para todo
      projeto de cadeia zerada, e o **ranking não muda** — `posicaoDeAtaque()` lê só `ficha`, nunca
      `projecao` (`lib/okr.mjs:435-470`). Comparar com a captura da T002.

### 5b — O pipeline somado (FR-013..FR-017)

- [X] T024 [US3] (depende da T004) Em `lib/okr-coleta.ts:55`, acrescentar a PK ao SELECT de
      `patient_leads` — `SELECT id, nome, email, status, motivo, to_char(created_at,'YYYY-MM-DD') AS criado …`
      (ou o nome real confirmado na T004). Expor as linhas de orçamento e o mapa `lead → motivo`.
      Mesma conexão, mesma query, **zero chamada de rede nova**.
- [X] T025 [P] [US3] Em `lib/projects.ts`, `Project` ganha `motivosDePerda?: string[]`, com o
      comentário do porquê (a taxonomia de perda é do cliente, não do template — FR-015).
- [X] T026 [P] [US3] Em `data/projects.json`, card `atma`:
      `"motivosDePerda": ["sem_resposta", "sem_interesse", "perdido_concorrencia", "preco_alto"]`.
      Nenhum outro card ganha a lista — herdar a taxonomia da Atma de graça é o defeito que a 017
      matou.
- [X] T027 [P] [US3] Escrever em `test/okr.test.mjs`, e ver **falhar**, os dez casos de
      `contracts/valor-em-risco.md`, todos com linhas **sintéticas**: 2 orçamentos do mesmo lead →
      `enviados.n === 2` e `vivos.pessoas === 1`; `motivo` na lista → perdido; `motivo: null` →
      **vivo**; `motivo` fora da lista → vivo; `paciente_lead_id: null` → entra em `enviados`, sai
      em `semLead`, fora de vivos/perdidos; `motivosDePerda === null` → `vivos`/`perdidos` `null` e
      `enviados` continua; `preco: "6355.93"` com `desconto_vista: "0.1"` → soma correta;
      `preco: null` → fora da soma, **não vira `0`**; nenhuma linha na janela → `null`; linha fora
      da janela → ignorada. **Nenhuma constante de contagem real** (FR-016, SC-004): um teste contra
      "9 orçamentos" reprovaria hoje mesmo — ontem eram 7.
- [X] T028 [US3] Em `lib/okr.mjs`, implementar
      `valorEmRisco(linhasOrc, leadsPorId, janela, motivosDePerda, tratamento)`, **pura** (recebe
      linhas, não abre conexão): janela por comparação de string `YYYY-MM-DD` como
      `celulasDeOrcamento()` já faz; dinheiro por `Number(preco) * (1 - Number(desconto_vista) || 0)`
      porque `pg` devolve `numeric` como **string**; `fechados` vem do **degrau `tratamento`**,
      nunca de `orcamentos.status` (FR-013a — 9 de 9 linhas em `enviado`, uma coluna que só conheceu
      um valor não separa nada); `status` do lead não entra em nada (o id 44 contradiz o `motivo` e
      esta spec não modela contradição).
- [X] T029 [US3] Criar `app/okr/[slug]/risco.tsx`:
      `R$ <enviados> enviados · R$ <fechados> fechados · <n> ainda vivos (R$ <valor>)`, mais, quando
      houver, `1 orçamento sem lead vinculado — R$ X` (FR-015a). Dinheiro pelo `reais()` que já
      existe em `app/okr/projecao.tsx` — **nunca `toLocaleString` cru**, cujo default de até 3 casas
      publicou `R$ 4.932,337` na 018. A **lista de motivos de perda usada aparece no bloco,
      textualmente**. Sem orçamento na janela, o bloco **não renderiza** (FR-017). Projeto sem
      `motivosDePerda` exibe `enviados` e **omite** vivos/perdidos, nomeando o que falta declarar
      (FR-015b).
- [X] T030 [US3] Montar `<ValorEmRisco>` no slot 4 de `app/okr/[slug]/page.tsx`, ao lado de
      `<Projecao>`. **Proibido** na tela e no módulo: qualquer razão `enviados ÷ meta`, barra de
      progresso ou frase do tipo "75% da meta" (FR-014).

**Checkpoint**: `npm test` verde; SC-003 e SC-004 conferidos na tela contra a query rodada **na
hora**; SC-007 conferida contra a captura da T002.

---

## Phase 6: User Story 4 — N0–N6 saem para `/okr/[slug]/metodo` (P2)

**Goal**: a derivação de método continua inteira, uma tela adiante, e a ficha devolve altura.

**Independent Test**: `/okr/<slug>/metodo` responde para os **17** projetos com N0–N6 **e** a árvore
de metas; `/okr/atma` não tem mais nem o índice nem as sete seções.

⚠️ Depende da Phase 2 (T006).

- [X] T031 [US4] Criar `app/okr/[slug]/metodo/page.tsx` com `export const revalidate = 3600`
      (FR-028a), montando os sete níveis a partir de `dadosDaFicha(slug)` — **mesmo conteúdo de
      hoje** — mais o `<Arvore>` da 016, sem mudar o componente. `notFound()` para slug
      inexistente.
- [X] T032 [US4] Links nos dois sentidos (FR-020): da ficha para o método (o link único da T012) e
      do método de volta para a ficha.
- [X] T033 [US4] Remover de `app/okr/[slug]/page.tsx` as sete `<section>` de N0–N6 e o bloco "Árvore
      de metas" — agora que a rota existe.
- [X] T034 [US4] **Trava, não edição**: rodar `test/ficha.test.mjs` e confirmar que a suíte de N0–N6
      passa **sem uma linha editada** (FR-019, US4-AC2). Teste de N0–N6 reescrito é sinal de escopo
      estourado — nesse caso, **parar** e revisar.
- [X] T035 [US4] Verificar a FR-021: a ação citada na dobra e a citada em N6 vêm da **mesma** chamada
      de `evaluateAll()`, a de `dadosDaFicha()`. Nunca duas fontes para a mesma ação.
- [X] T036 [US4] Abrir `/okr/<slug>/metodo` nos **17** slugs (SC-005) — a rota é do template, nunca
      `app/okr/atma/…`.

**Checkpoint**: 17 rotas respondendo, N0–N6 e árvore fora da ficha, `test/ficha.test.mjs` intacto.

---

## Phase 7: User Story 5 — Descoberta e Comportamento em `/okr/[slug]/aquisicao` (P2)

**Goal**: o que tem relógio de trimestre sai da tela que se lê na segunda-feira, e ganha a janela
longa que a 018 adiou.

**Independent Test**: `/okr/<slug>/aquisicao` responde nos 17; na atma, 8 meses de GSC e 12 de GA4,
cada número com **a janela que a fonte deu** ao lado.

⚠️ Depende da Phase 2 (T006).

### Testes primeiro (`test/janelas.test.mjs` — já registrado) ⚠️

- [X] T037 [P] [US5] Escrever em `test/janelas.test.mjs`, e ver **falhar**: `descobertaLonga()` = 8
      meses fechando em D-3 e `comportamentoLongo()` = 12 meses fechando em D-3, no formato
      `{nome, inicio, fim, porque}`; e as três janelas curtas saindo **byte a byte** iguais às de
      hoje (SC-007).

### Implementação

- [X] T038 [P] [US5] Em `lib/janelas.mjs`, acrescentar `descobertaLonga(agora)` e
      `comportamentoLongo(agora)` ao lado das três de hoje. Módulo continua **puro**;
      `descoberta()`, `comportamento()` e `conversao()` **não mudam** (FR-024).
- [X] T039 [P] [US5] Em `lib/gsc.ts:232`, `gscSeries(siteUrl, inicio = isoDaysAgo(86), fim = isoDaysAgo(3))`
      — parâmetros **opcionais**, default byte a byte o de hoje (FR-025). Um segundo
      `gscSerieLonga()` duplicaria autenticação, `resolveProperty` e tratamento de erro para trocar
      duas datas. `totals28()` não se toca.
- [X] T040 [P] [US5] Em `lib/ga4.ts`, acrescentar
      `ga4Cobertura(propertyId, janela): Promise<{primeiro, ultimo} | {erro} | null>` — dimensão
      `date`, métrica `sessions`, min e max locais. **Não** acrescentar `date` às dimensões de
      `ga4Canais()`: mudaria a forma do retorno para todos os consumidores para servir um só (mesmo
      argumento da 016 em `gscPaginas`). `ga4Canais()` já recebe janela — nada a mudar lá.
- [X] T041 [US5] Criar `app/okr/[slug]/aquisicao/page.tsx` com `export const revalidate = 3600`
      (FR-028a): Descoberta = GSC em 8 meses via `descobertaLonga()` → `gscSeries(url, inicio, fim)`;
      Comportamento = GA4 em 12 meses via `comportamentoLongo()` → `ga4Canais()` + `ga4Cobertura()`.
- [X] T042 [US5] **FR-027 — janela pedida × janela recebida**: cada número carrega a janela que a
      fonte **deu**. GSC: `days[0].date` / `days.at(-1).date`, zero chamada extra. GA4:
      `ga4Cobertura()`. Truncamento é nomeado — **nunca se rotula de 12 meses um dado de 3**.
- [X] T043 [US5] **FR-026** — cada tela cita a outra pelo nome: a ficha diz "28 dias — série de 8
      meses em Aquisição"; a Aquisição diz "8 meses — a célula `visitante` da ficha usa 28 dias".
- [X] T044 [US5] **FR-028** — a página declara que a cadência de leitura dela é **trimestral**, não
      semanal.
- [X] T045 [US5] **FR-029/SC-008** — nenhuma taxa entre `cliques` (GSC) e `sessões` (GA4): são
      cadeias diferentes (na época, 599 contra 1.140, porque o GSC vê só orgânico). Deixar a
      asserção que falha se alguma razão cruzar as duas séries.
- [X] T046 [US5] **SC-007, a regressão do portfólio**: `/okr` e a célula `visitante` dos 17 saem
      **idênticos** à captura da T002 — `descoberta()`/`comportamento()` não mudaram e o default de
      `gscSeries()` está intocado.

**Checkpoint**: 17 rotas respondendo, janelas reais ao lado de cada número, `/okr` sem uma troca de
posição.

---

## Phase 8: User Story 6 — A época costura a árvore de metas (P3)

**Goal**: nos dias em que as três fontes têm dado, a árvore desce de impressão até venda — sem
chamada de rede nova.

**Independent Test**: a árvore da atma (em `/okr/atma/metodo`) desce até impressões usando a janela
da época; projeto sem `epoca` para exatamente onde para hoje.

### Testes primeiro (`test/arvore-metas.test.mjs` — já registrado) ⚠️

- [X] T047 [P] [US6] Escrever em `test/arvore-metas.test.mjs`, e ver **falhar**, os quatro casos de
      `contracts/rotas-e-janelas-longas.md §5`: (1) `ctr.janela` contendo a de Conversão → camada de
      impressões entra usando a janela da época; (2) projeto sem `epoca` → a árvore para onde para
      hoje; (3) **`ctr.janela.inicio` depois do início da época → `parou` preenchido nomeando o que
      faltou, e nenhuma camada de impressões**; (4) na descida completa, no máximo **uma** faixa de
      mercado (trava da 016, R6). **O caso 3 é a bomba-relógio desta decisão**: para a atma ele vira
      o caso real em **2026-10-23**, quando a época ultrapassar os 84 dias do GSC.

### Implementação

- [X] T048 [US6] Em `lib/arvore-metas.mjs`, `montarArvore()` passa a receber a janela de Conversão,
      e `ctr` passa a carregar a janela que o produziu: `{valor, impressoes, janela: {inicio, fim}}`.
- [X] T049 [US6] Substituir a guarda de `lib/arvore-metas.mjs:176`
      (`marcos[0]?.chave === "visitante"`) por **coincidência de janela** (FR-031): a camada entra
      só quando `ctr.janela.inicio <= conversao.inicio && ctr.janela.fim >= conversao.fim` —
      **contém, não iguala**. Nome de marco não prova que as janelas batem; foi a trava certa na 018
      porque era a única disponível.
- [X] T050 [US6] Quando não contém, a árvore **para e nomeia** (FR-033):
      `parou = { nome: "impressões", motivo: "a série do Search Console começa em <data>, depois do início da época (<data>) — compor períodos diferentes seria inventar o dado" }`.
      **Nunca compõe períodos** (018/FR-007 continua íntegra).
- [X] T051 [US6] Em `lib/ficha-dados.ts`, **fatiar** a série de 84 dias que `gscSeries()` já busca
      pelo intervalo da época, para produzir `ctr` com a janela certa — **sem chamada de rede nova**
      (a época da atma, 37 dias, cabe inteira nos 84). Projeto sem `epoca` mantém o comportamento de
      hoje (FR-032).

**Checkpoint**: ⚠️ **SC-009 NÃO acende hoje** — implementada e coberta por teste, mas a árvore da
atma para no PRIMEIRO degrau (`orcamento→tratamento` = 0/6, taxa zero não divide; a régua desse span
é a 020), e a costura só roda depois de uma descida completa. Além disso a contenção da FR-031
falha por construção com época declarada: a janela de Conversão fecha em D-0 e o GSC em D-3.
Projeto sem `epoca` para exatamente onde parava (conferido). Ver §4 do
`handoff/handoff-019-ficha-em-30-segundos.md`.

---

## Phase 9: Polish & verificação final

**Purpose**: fechar contra o quickstart, não contra a impressão.

- [X] T052 `npm test` verde e dentro de ~2 s (SC-010). Confirmar que **nenhum arquivo de teste novo**
      foi criado e que a lista do `package.json` não precisou de edição.
- [X] T053 Rodar a tabela inteira do `quickstart.md §3` (SC-001 a SC-009), com as queries do §1
      **executadas no momento da verificação** — o banco é o oráculo, e os números de 06/09/2026 já
      estarão errados.
- [X] T054 **SC-001, o critério da spec**: `/okr/atma` a 1280×800 **sem rolar**, dizer em voz alta as
      três respostas; capturar a dobra com as três apontadas. **Altura não é meta** (FR-038): se
      couber em 1.500px e não passar no teste dos 30 segundos, não adiantou.
- [X] T055 Medir de novo a altura a 1280×800 e 360×640 e registrar o antes/depois no handoff da
      T001.
- [X] T056 Conferir a FR-036 varrendo a tela: **nenhum número exibido mudou por causa desta spec**,
      com a exceção escrita de `n1Total`/`n1Janela`, que passam de suprimidos a apurados.
- [X] T057 Push (Princípio IV: **nada entre 23:30–01:00 e 08:00–08:45 BRT**), e conferir a tela no ar
      **duas vezes, espaçadas** — o roihub deploya por push mas leva ~15 min, e a primeira checagem
      mente (`roihub_push_nao_deploya`).
- [X] T058 Escrever o handoff final em `handoff/`, co-localizado, com o antes/depois de altura, as
      queries do dia e o que ficou para a 020 (réguas de mercado e `market_benchmarks`, FR-037).

---

## Dependencies & Execution Order

### Dependências de fase

- **Phase 1 (Setup)**: sem dependência — e **T001 vem antes de qualquer edição**, sem exceção.
- **Phase 2 (Foundational)**: depende da Phase 1. **T004 bloqueia a US3 (5b); T006 bloqueia US4 e
  US5.**
- **Phase 3 (US1)**, **Phase 4 (US2)**, **Phase 5 (US3)**: P1, podem correr em paralelo entre si
  (arquivos majoritariamente distintos); todas convergem em `app/okr/[slug]/page.tsx`, que é o
  ponto de serialização.
- **Phase 6 (US4)** e **Phase 7 (US5)**: P2, independentes entre si depois da T006.
- **Phase 8 (US6)**: P3, depende da T048/T051 tocarem `lib/ficha-dados.ts` (Phase 2) e rende melhor
  depois da US4, porque a árvore mora em `/metodo`. **Se cair, a spec ainda fecha.**
- **Phase 9**: depois de todas as stories desejadas.

### Dependências entre stories

- **US1 (P1)**: independente. Ships com a célula única no slot 3; a US2 a substitui.
- **US2 (P1)**: independente — `buracosDeVerdade()` não depende de nada da US1.
- **US3 (P1)**: 5a independente; **5b depende da T004**.
- **US4 (P2)**: depende da T006; a T033 (remover N0–N6 da ficha) depende da T031 existir.
- **US5 (P2)**: depende da T006.
- **US6 (P3)**: depende da Phase 2; encaixa melhor depois da US4.

### Conflitos de arquivo (não paralelizar)

| Arquivo | Tarefas que o tocam |
|---|---|
| `app/okr/[slug]/page.tsx` | T006, T008–T014, T019, T030, T033, T043 |
| `lib/okr.mjs` | T016, T028 |
| `lib/ficha-dados.ts` | T005, T051 |
| `test/okr.test.mjs` | T015, T027 |

### Oportunidades de paralelismo

- T001, T002, T003 juntas.
- T025, T026 juntas (tipo e card, arquivos distintos).
- T037, T038, T039, T040 juntas (janelas, GSC e GA4 são arquivos distintos).
- T015, T020, T027, T047 podem ser escritos em paralelo **desde que** T015 e T027 não sejam editados
  no mesmo momento (mesmo arquivo).

---

## Implementation Strategy

### MVP primeiro (US1 + US2 + US3 = os três P1)

1. Phase 1 (linha de base medida e registrada)
2. Phase 2 (orquestração extraída, tela intacta)
3. Phases 3, 4, 5 — **PARAR E VALIDAR**: `/okr/atma` a 1280×800 passa no teste dos 30 segundos
4. Deploy (fora das janelas de push), conferir duas vezes

Isso já entrega o critério de aceitação da spec inteira. US4 e US5 devolvem altura; US6 é a única
que, se cair, não impede a spec de fechar.

### Entrega incremental

1. Setup + Foundational → base pronta
2. + US1/US2/US3 → **MVP: a dobra responde**
3. + US4 → método fora da ficha
4. + US5 → aquisição com janela longa
5. + US6 → árvore costurada pela época

---

## Notas

- **Nenhum número desta spec pode virar constante** (FR-016, SC-004). Os valores de 06/09/2026
  (9 orçamentos, R$ 44.945,43, 2 vivos) estarão errados na implementação — o handoff de 05/09
  registrava 7 e R$ 37.465,43. Testa-se a **regra**; o banco é o oráculo, sempre na hora da
  verificação.
- **Zero dependência nova, zero framework de teste, zero migração, zero DDL, zero escrita.**
- **Zero arquivo de teste novo**: as cinco suítes já estão registradas; `test/validade.test.mjs`
  continua fechando lista × diretório nos dois sentidos.
- A working tree tem outros escritores (`roihub_working_tree_has_other_writers`): conferir
  **conteúdo** de arquivo, nunca `git diff`.
- Commit por tarefa ou por grupo lógico; parar em qualquer checkpoint para validar a story sozinha.
