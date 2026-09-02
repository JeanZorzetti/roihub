---
description: "Lista de tarefas — 011-okr-ficha-por-projeto"
---

# Tasks: Ficha N0-N6 por projeto — a árvore inteira, um projeto por vez

**Input**: documentos de desenho em `/specs/011-okr-ficha-por-projeto/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Testes**: incluídos e **obrigatórios** — o Princípio II e a FR-034 pedem `test/ficha.test.mjs`
registrado na lista de `npm test` no mesmo commit, e o `contracts/ficha-mjs.md` já enumera as
garantias G1-G15 que ele tem que provar.

## Formato: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência)
- **[Story]**: US1-US5, conforme a prioridade da spec
- Todo caminho de arquivo é do repositório `roihub/`

## Convenção de caminhos

Aplicação Next.js App Router de projeto único: regra em `lib/*.mjs` (testável por `node --test`),
borda (`pg`, GSC, React) em `lib/*.ts` e `app/**`. É o layout que a constituição impõe e que a 009
e a 010 já seguem.

⚠️ **`lib/ficha.mjs` e `app/okr/[slug]/page.tsx` são tocados por quase todas as fases.** Eles nunca
levam `[P]` entre si. O paralelismo real desta feature está na Fase 2 e entre os arquivos de borda.

---

## Phase 1: Setup

**Propósito**: abrir o gate do Princípio II e **congelar a linha de base** antes de existir código
para testar.

- [ ] T001 Registrar `test/ficha.test.mjs` na lista de `node --test` do script `test` em
  `package.json` e criar o arquivo com o cabeçalho `import test from "node:test"` +
  `import assert from "node:assert/strict"` e um primeiro caso vazio. `test/validade.test.mjs`
  reprova se o arquivo novo não estiver na lista — é o gate, e ele já existe (FR-034, SC-016).
- [ ] T001a **Antes de tocar em qualquer arquivo**, guardar a linha de base da `/okr` do HTML
  servido em produção: `curl -s "$HUB/okr" > /tmp/okr-antes.html`, mais a contagem
  `curl -s "$HUB/okr" | grep -c 'hero-name'`. A T034 compara contra este arquivo, e a captura
  precisa **preceder a T009** — a extração da coleta é a primeira coisa que pode mexer no HTML da
  `/okr`, e depois do primeiro push a SC-001 vira inconferível: não existe "antes" para comparar.
  Sufixo `a` de propósito, para não renumerar as 37 tarefas seguintes.

---

## Phase 2: Foundational (bloqueia todas as histórias)

**Propósito**: o contrato de dados, os catálogos e a espinha de sete níveis. Nenhuma história
começa antes de T007 fechar.

**⚠️ CRÍTICO**: sem a espinha de `montarNiveis()` não existe rota que responda 200 com sete
títulos, e é ela que a US1 renderiza.

- [ ] T002 [P] Declarar `fatores` em `PERFIS.D` de `lib/okr.mjs`, ao lado dos `marcos` cuja `chave`
  a cobertura referencia: `Leads` (cadeia, `["lead"]`), `CR(lead→consulta)` (cadeia,
  `["contatado","agendada","compareceu"]`), `CR(consulta→tratamento)` (cadeia, `["tratamento"]`),
  `Valor do tratamento` (valor, `meta.ticket`). **Perfis A, B e C não ganham `fatores`** — a
  ausência é o que a FR-019a lê para dizer "fatores do perfil ainda não declarados". Nada mais
  muda em `lib/okr.mjs` (FR-019, FR-019a).
- [ ] T003 [P] Adicionar o campo `ficha?` ao tipo `Project` em `lib/projects.ts` com o JSDoc do
  contrato, fazer ele atravessar `mergeProjects()` pelo **mesmo spread** de `perfil`/`meta`/`vendas`,
  e criar `listFichas(): Promise<{slug,nome}[]>` lendo a curadoria direto, sem `listRepos()`
  (FR-035, Complexity Tracking do plano — a única violação assumida do Princípio I).
- [ ] T004 [P] Adicionar o campo `ficha` da `atma` em `data/projects.json`: `declaradaEm`,
  `objetivo` (uma frase, **sem número**) e KRs cobrindo os dois casos que a US4 precisa provar —
  um `n3:` sobre célula apurada e um `n3:` sobre célula não apurada, com `dono` (FR-013, US4).
- [ ] T005 Criar `lib/ficha.mjs` com os typedefs `CelulaApurada|CelulaDeclarada|CelulaNaoApurada` e
  as quatro primitivas: `estadoDeApurado(celula, fonte)`, `declarada(valor, {em,oQue,rotulo})`
  (`em` ausente → `"data não registrada"`, a declaração não some), `naoApurada(motivo, consultar,
  rotulo)` (`consultar` obrigatório, não vazio — R4) e `combinar(insumos, calcular)` com a tabela
  de herança do [data-model §1](./data-model.md). Imports permitidos só de `./funil.mjs` e
  `./okr.mjs`. **Zero** `new Date()`, `Date.now()`, `process.env` ou `pg` (FR-009, FR-010, FR-033).
- [ ] T006 Acrescentar a `lib/ficha.mjs` os catálogos fixos: `CANAIS` (`organico`, `direto`, `pago`,
  `indicacao`, `outbound`, `social`) e `MEDIDORES` com as **quatro** famílias D1-D4 do §5 do
  template. São eles os espaços de chave de `n4:` e `n5:` na validação de KR — o catálogo inteiro,
  não só a família exibida (data-model §8, decisão 7 do plano).
- [ ] T007 Implementar `montarNiveis(entrada)` em `lib/ficha.mjs` devolvendo **sempre sete** níveis
  `N0..N6` na ordem, cada um com título, pergunta e ao menos uma `CelulaFicha`. Nesta tarefa os
  níveis saem com célula de espinha; cada história substitui o seu. Assinatura exata em
  [contracts/ficha-mjs.md](./contracts/ficha-mjs.md) — `montarFicha()` e `projetar()` chegam
  **prontas** por parâmetro, a ficha não as chama (FR-008, FR-033).

  **A célula de espinha nomeia a implementação, não o dado**: `motivo` =
  `"nível ainda não montado — feature 011 em implementação"`, `consultar` = `"specs/011-okr-ficha-por-projeto/tasks.md"`.
  Um `não apurado: sem perfil declarado` num projeto cuja cadeia está medida é o defeito desta
  feature com o sinal trocado — a ficha diria que não olhou onde o número existe. O texto de
  espinha some quando a história daquele nível fecha; se algum sobreviver ao deploy, ele diz que
  sobreviveu.
- [ ] T008 Em `test/ficha.test.mjs`: **G1** (sete níveis na ordem para qualquer entrada, inclusive
  projeto sem perfil, sem meta e sem `ficha`), **G2** (nenhum `estado` fora dos três; nenhuma
  `apurado` sem `fonte`; nenhuma `declarado` sem `declaradoEm`; nenhuma `nao-apurado` sem `motivo`
  **e** `consultar`; nenhuma `nao-apurado` com `valor`) e **G3** (`0 tratamentos × R$ 4.000
  declarados` → `declarado`, nunca `apurado`) — FR-008, FR-009, FR-010, SC-002/003/004/006.
- [ ] T009 Criar `lib/okr-coleta.ts` movendo de `app/okr/page.tsx`, **sem mudar comportamento**:
  `FONTES_PROPRIAS`, `lerFontePropria()`, a janela `INICIO`/`FIM`/`HOJE` e a coleta por projeto
  (cliques do GSC, leads com fonte própria antes do CRM, vendas do card). `app/okr/page.tsx` passa
  a importar de lá. É `.ts` porque toca `pg` e `google-auth-library`, e **não contém regra** — o
  `diff` da SC-001 tem que sair limpo depois desta tarefa (decisão 5 do plano, FR-032).
- [ ] T010 Em `test/ficha.test.mjs`: invariante `listFichas() ⊆ listProjects()` por `slug`,
  conferida contra a curadoria de `data/projects.json`. Se um dia um repo do GitHub puder trazer
  `ficha`, este teste reprova e a justificativa da Complexity Tracking deixa de valer.

**Checkpoint**: `npm test` verde, contrato de dados fechado, espinha de sete níveis montável.

---

## Phase 3: User Story 1 — Abrir a ficha pelo menu (P1) 🎯 MVP

**Meta**: a aba OKR vira link + disclosure, e `/okr/<slug>` existe, responde 200 nos sete títulos
e 404 no slug inexistente.

**Teste independente**: a partir de qualquer uma das 13 abas, alcançar `/okr` em **um**
acionamento e `/okr/atma` em **dois**, só com teclado, com o link "Pular para o conteúdo" ainda
como primeiro alvo.

- [ ] T011 [US1] `app/tabs.tsx`: a aba OKR passa a ser um **par** — o `<Link href="/okr">` que já
  existe **continua sendo link** (FR-002) e ganha um `<details>` irmão cujo `<summary>` é o
  controle. `open={rota === "/okr" || rota.startsWith("/okr/")}`, decidido no servidor (FR-003).
  Itens: `Portfólio` (`/okr`) + `listFichas()`, na ordem da curadoria. `aria-current="page"` no
  item que casa a rota. Com `listFichas().length === 0` a aba volta a ser link simples, sem
  `<details>` (FR-005). **Nenhum `"use client"`**, e o `<a class="sr-only skip">` continua antes
  do `<nav>` (FR-001, FR-004).
- [ ] T012 [P] [US1] `app/globals.css`: estilo do `<summary>` e da faixa do menu, com foco visível.
  A faixa quebra em linhas pela mesma regra de `flex-wrap` da `.tabs`. **Nenhum `overflow-x` novo**
  no `<main>` nem no `.card` — rolagem horizontal só dentro de `.tabela-rolavel` (SC-014).
- [ ] T013 [US1] Criar `app/okr/[slug]/page.tsx`: `export const dynamic = "force-dynamic"`,
  `const { slug } = await params` (Next 16), `notFound()` quando o slug não está em
  `listProjects()` — a lista **completa**, curados + GitHub (FR-007, SC-011). Renderiza os sete
  níveis de `montarNiveis()` e escreve a janela `INICIO → FIM` na tela, importada de
  `lib/okr-coleta.ts` (FR-012, SC-019) — a janela nasce num lugar só, senão são duas. Inclui o
  componente de célula, o único caminho que imprime valor: `apurado` → número **com a fonte na
  mesma linha**; `declarado` → número + `declarado em <data>`; `nao-apurado` → motivo + fonte a
  consultar. Sem `0`, sem `—`, sem célula em branco (FR-009, SC-003, SC-004).
- [ ] T013a [US1] **A montagem, em `app/okr/[slug]/page.tsx`** — é a página que chama, porque
  `lib/ficha.mjs` é puro e recebe tudo pronto ([contracts/ficha-mjs.md](./contracts/ficha-mjs.md)).
  Para o **projeto único**, na ordem: coleta de `lib/okr-coleta.ts` (cliques, leads, vendas) →
  `montarFicha({ slug, perfil, coletado })` → `posicaoDeAtaque(ficha)` → `projetar({ ficha, meta,
  hoje })` → `montarNiveis({ slug, ficha, projecao, veredito, declarada, meta, ... })`. **Nenhuma
  dessas quatro é reimplementada** (FR-030, FR-033): são as mesmas da 009 e da 010, chamadas com um
  projeto em vez de 40. Sem esta tarefa a T017 preenche níveis que nada alimenta — a ficha
  renderiza sete títulos sobre entrada vazia.
- [ ] T014 [US1] `app/okr/page.tsx`: o `<h2 className="hero-name">{p.nome}</h2>` dos cards **com
  perfil declarado** passa a envolver um `<Link href={"/okr/" + p.slug}>`. Mesmo `<h2>`, mesma
  posição, mesmo texto. Card **sem** perfil fica intocado. É a **única** mudança permitida na
  `/okr` (FR-006, FR-032, SC-001).

**Checkpoint**: `/okr/atma` responde 200 com sete títulos, `/okr/nao-existe` responde 404, e o menu
funciona com JavaScript desligado.

⚠️ **A Fase 3 sozinha não vai para `main`.** Push é deploy (Princípio IV), e neste ponto seis dos
sete níveis ainda carregam a célula de espinha da T007. Publicar aqui poria no ar uma ficha que
declara não ter olhado onde o número existe. Ou a Fase 3 sobe junto com a Fase 4 (a US2 é a que
acende N1-N4), ou o texto de espinha se mantém como a T007 o define — nomeando a implementação, não
o dado — e o deploy é consciente disso.

---

## Phase 4: User Story 2 — Ler a árvore inteira e sair com trabalho nomeado (P1)

**Meta**: N1, N2, N3 e N4 preenchidos, com estado e fonte em toda linha, e o veredito de N2 saindo
"não fecha" com os fatores faltantes nomeados.

**Teste independente**: numa ficha com meta, perfil e dois degraus apurados, conferir à mão que
cada um dos sete níveis exibe estado e fonte, e que nenhum número aparece sem uma das duas.

- [ ] T015 [US2] `avaliarN2(fatores, marcos, taxas, declaracoes)` em `lib/ficha.mjs`: fator de
  cadeia é `nao-apurado` quando **qualquer** degrau da cobertura está não apurado — nunca a taxa do
  pedaço medido (FR-020). `erroDeDefinicao` quando as coberturas dos fatores **de cadeia** têm
  buraco no meio, sobreposição, ou não terminam no último marco; degraus **acima** do primeiro
  fator são a entrada da cadeia (N4) e **não** produzem erro; fatores de **valor** ficam fora da
  conferência por definição (FR-021). Veredito `nao-apurado` nomeando os faltantes, nunca um
  `✓ fecha` derivado de ausência (FR-022).
- [ ] T016 [US2] `montarN4(canais, cliquesCelula, marcos)` em `lib/ficha.mjs`: `organico` recebe a
  célula `cliques` do Search Console com o rótulo **orgânico** (nunca "tráfego", nunca
  "visitantes"); os outros cinco saem `nao-apurado` com a fonte a consultar (FR-023). `semElo`
  **derivado** — verdadeiro quando o canal não é denominador de nenhuma taxa de N3 (perfil C sai
  `sem elo` no `organico`) (FR-025). **Nenhum total, nenhuma soma**; a diferença entre canais
  medidos e a entrada da cadeia sai `nao-apurado` e nunca é atribuída a "direto" (FR-024).
- [ ] T017 [US2] Preencher N1-N4 em `montarNiveis()`: **N1** contagem = último marco (apurado) e R$
  = contagem × `meta.ticket` via `combinar()` → sai **declarado** (FR-010); sem ticket →
  `nao-apurado: sem ticket declarado`. **N2** = `avaliarN2()`, ou `nao-apurado: fatores do perfil
  ainda não declarados` nos perfis A/B/C (FR-019a). **N3** = os `marcos` e `taxas` de
  `montarFicha()` **intactos**, com a fração colada em toda razão (FR-011, R2). **N4** =
  `montarN4()`. Sem perfil: N1-N5 saem `nao-apurado: sem perfil declarado`, **zero** números.
- [ ] T018 [US2] Em `test/ficha.test.mjs`: **G4** (fator com um degrau não apurado no trecho sai
  `nao-apurado` mesmo com os outros apurados), **G5** (buraco/sobreposição → `erroDeDefinicao`;
  degraus acima do primeiro fator **não** produzem erro), **G6** (veredito nunca `fecha` com fator
  faltando), **G7** (N4 sem total nem soma; diferença `nao-apurado`; perfil C marca `organico` como
  `sem elo`), **G12** (sem perfil: N1-N5 `nao-apurado`, zero números, N0 e N6 válidos) e **G13**
  (perfil A/B/C: só N2 cai, os outros seis normais) — SC-006/007/008/012/017.
- [ ] T019 [US2] `app/okr/[slug]/page.tsx`: renderizar N1-N4 — cada fator de N2 em linha própria com
  seu estado, o veredito da conta abaixo deles, os degraus de N3 com a fração colada, e os seis
  canais de N4 sem linha de total.

**Checkpoint**: a ficha da `atma` produz uma lista de trabalho, não uma tela de `não apurado`.

---

## Phase 5: User Story 3 — Descer só na família do gargalo (P2)

**Meta**: N5 exibe os medidores de **uma** família, com a família nomeada e o motivo da escolha.

**Teste independente**: dois projetos com gargalos de famílias diferentes exibem conjuntos de
medidores diferentes, e nenhum dos dois exibe as quatro famílias.

- [ ] T020 [US3] `escolherFamilia(veredito, ficha)` e `montarN5(familia, disponiveis)` em
  `lib/ficha.mjs`, pela tabela do [data-model §6](./data-model.md): posição 1 → família do marco
  zerado; posição 2 → família do buraco escolhido; posição 3 → família do degrau de **menor taxa**;
  posição 0 → nenhuma, motivo `sem perfil declarado`. O motivo é **sempre** escrito (FR-027).
  `montarN5()` devolve os medidores de uma família só (FR-026); todo medidor fora de `disponiveis`
  sai `nao-apurado` **na lista**, nunca omitido — o medidor que falta é o entregável (FR-028); e
  `posicao-media-com-corte-pais` sai `nao-apurado` mesmo existindo na API (FR-029).
- [ ] T021 [P] [US3] `lib/okr-coleta.ts`: expor `disponiveisN5` a partir do que **esta requisição**
  já carrega — `impressoes` da mesma série do GSC que já dá `cliques`, `lead-gravado` da célula de
  leads e `gateway-ligado` do campo `vendas` do card. **Nenhuma chamada nova, nenhuma env nova,
  nenhum número vindo de `/seo` ou `/infra`** (FR-028, FR-036, SC-019).
- [ ] T022 [US3] Em `test/ficha.test.mjs`: **G8** — N5 devolve medidores de **uma** família só, e
  `posicao-media-com-corte-pais` sempre `nao-apurado` (SC-005, FR-029).
- [ ] T023 [US3] `app/okr/[slug]/page.tsx`: renderizar N5 com a família nomeada, o motivo da escolha
  e a lista completa dos medidores dela — os não apurados inclusive.

---

## Phase 6: User Story 4 — Declarar objetivo e KRs, e descobrir quais não são verificáveis (P2)

**Meta**: N0 exibe o objetivo declarado com data e cada KR conferido contra a árvore.

**Teste independente**: declarar dois KRs, um sobre célula apurada e outro sobre célula não
apurada, e conferir que só o segundo sai marcado como não verificável.

- [ ] T024 [US4] `validarKrs(krs, espacos)` em `lib/ficha.mjs`, na ordem do
  [data-model §8](./data-model.md): (1) `celula` sem prefixo `n3:`/`n4:`/`n5:` → `chave-invalida`;
  (2) prefixo válido e chave ausente **no espaço daquele nível** → `chave-invalida` nomeando a
  chave — **é proibido** procurar nos outros níveis, casar por nome parecido ou por posição
  (FR-017); (3) célula alvo `nao-apurado` → `nao-verificavel` com o texto `sem baseline apurado —
  o trabalho é apurar a célula, não perseguir o número` (FR-015); (4) `dono` ausente → `sem-dono`,
  KR **continua visível**, dono nunca inferido nem herdado (FR-016); (5) índice ≥ 3 → `excedente`,
  exibido, nunca truncado (FR-018).
- [ ] T025 [US4] Preencher N0 em `montarNiveis()`: `ficha.objetivo` como célula **declarada** com a
  data (`declaradaEm` ausente → `data não registrada`), mais os KRs de `validarKrs()` (FR-014).
  Sem campo `ficha` no card → `nao-apurado: sem declaração no card`, e os outros seis níveis
  seguem. Projeto que **perdeu o perfil** → objetivo e KRs continuam exibidos como declarados e a
  validação sai `nao-apurado: sem cadeia para validar a célula`.
- [ ] T026 [US4] Em `test/ficha.test.mjs`: **G9** (KR sobre célula não apurada → `nao-verificavel`;
  sobre apurada → sem marca; **as duas no mesmo teste**), **G10** (chave inexistente no nível do
  prefixo → `chave-invalida` nomeando a chave, zero casamento por aproximação e zero busca nos
  outros níveis) e **G11** (KR sem dono marcado e visível; 4º KR `excedente` e visível). Incluir o
  caso da SC-020: a mesma chave `n4:`/`n5:` válida vira erro quando trocada de nível.
- [ ] T027 [US4] `app/okr/[slug]/page.tsx`: renderizar N0 — a frase rotulada **declarada** com a
  data, e a lista de KRs com as marcas visíveis (`não verificável`, `sem dono`, `erro de
  declaração`, `excedente`), nenhuma delas escondendo o KR.

---

## Phase 7: User Story 5 — Ver que nenhuma ação da semana diz que célula move (P3)

**Meta**: N6 exibe os itens da agenda daquele projeto — os mesmos da `/agenda` — com dono, data e
`célula que move: não declarada`.

**Teste independente**: abrir `/agenda?projeto=atma` e `/okr/atma` lado a lado e comparar item a
item, dono a dono.

- [ ] T028 [US5] `listDonoDatas(): Promise<Map<string,string>>` em `lib/db.ts`, lendo
  `hub_acao_dono.atualizado` — coluna que **já existe**. Chave = a mesma `acaoKey(slug, acao)` que
  `acoesDoRanking()` monta. **Não altera `listDonos()`**: a assinatura dela é lida pela `/agenda` e
  a SC-018 exige que itens e donos da ficha sejam exatamente os de lá (FR-030a, decisão 6 do plano).
- [ ] T029 [US5] Preencher N6 em `montarNiveis()` a partir de `itensAgenda`, `erroAgenda` e
  `datasDono`. `celulaQueMove` é **sempre** `"nao-declarada"` — inferir do texto é proibido, nem
  por busca de palavra, nem por parecença (FR-031). Data de cada item rotulada `dono definido em`;
  sem dono → `nao-apurado: a acao do card não é datada` (FR-030a). **Três textos que não se
  compartilham**: sem item → `sem ação declarada para este projeto`; fonte fora → `não apurado —
  banco indisponível (<código>)`; itens existem → a lista (FR-030b).
- [ ] T030 [US5] Em `test/ficha.test.mjs`: **G14** (`itensAgenda: null` + `erroAgenda` →
  `nao-apurado` com o motivo; `[]` → `sem ação declarada`; textos **diferentes**) e **G15**
  (`celulaQueMove` continua `nao-declarada` mesmo quando o título do item cita literalmente o nome
  de um degrau).
- [ ] T031 [US5] `app/okr/[slug]/page.tsx`: montar N6 pela **mesma composição** de
  [app/agenda/page.tsx:186-207](../../app/agenda/page.tsx#L186-L207), não só pela mesma função
  (FR-030, SC-018). Na ordem exata:

  1. `curados = (await evaluateAll()).filter((p) => p.curated)` — **é dessa ordem que sai o
     `#N · score`** de cada item. Passar `listProjects()` cru muda o `meta` de todos os itens e a
     ficha exibe `#7` onde a `/agenda` exibe `#3`: o rótulo de ranking não é a ordem, e essa
     confusão já apagou ranking da tela antes.
  2. `donos = await listDonos()` e `doneSet = await listDone()`, ambos com o mesmo `catch` da
     `/agenda` — falha de banco nunca derruba a lista.
  3. `acoesDoRanking(curados, donos)` → filtrar `projeto === slug`.
  4. **Separar feito de pendente por `doneSet.has(`${i.key}@${i.occ}`)`**, como a `/agenda` faz.
     Sem isso, ação concluída dentro de `ACAO_DONE_DIAS` aparece na ficha como trabalho a fazer
     enquanto a `/agenda` já a mostra como feita — e a SC-018 reprova por item a mais.
  5. Cruzar com `listDonoDatas()` (T028) e renderizar dono, data e `célula que move`.

  `acoesDoRanking()` já descarta `p.standby` e ação vazia — é o comportamento da `/agenda` e fica
  como está. Projeto em stand-by cai no texto `sem ação declarada para este projeto`.

---

## Phase 8: Polish & conferência

**Propósito**: rodar o [quickstart.md](./quickstart.md) inteiro, **no HTML servido pelo EasyPanel**.
Conferência em `next dev` não vale para nenhum item desta fase.

- [ ] T032 `npm test` verde, `test/ficha.test.mjs` na lista do `package.json`, suíte abaixo de ~2s
  (SC-016).
- [ ] T033 Varredura do HTML servido em `/okr/atma`, num projeto **sem perfil** e num de perfil
  **A/B/C**: zero `<td></td>`, zero `<td>—</td>`, zero `0` de preguiça, e todo bloco `não apurado`
  com motivo **e** fonte a consultar (SC-003, SC-004, SC-012, SC-017).
- [ ] T034 `diff` da `/okr` **contra o arquivo capturado na T001a**, pelo comando do quickstart §5:
  nenhuma diferença além dos links da FR-006, mesma contagem de `hero-name`, mesmos 40 projetos na
  mesma ordem (SC-001). Sem a captura da T001a esta tarefa não tem contra o que comparar.
- [ ] T035 Passagem de teclado completa **com JavaScript desligado** — "Pular para o conteúdo" como
  primeiro alvo, `/okr` em um acionamento, `/okr/atma` em dois, menu já aberto e marcado ao
  recarregar (SC-013) — e viewport de 390px com o menu aberto sem rolagem horizontal da página,
  conferido por `document.documentElement.scrollWidth <= clientWidth` (SC-014).
- [ ] T036 N6 lado a lado: `$HUB/agenda?projeto=atma` e `$HUB/okr/atma`, item a item, dono a dono,
  **e `#N · score` a `#N · score`**. Item extra, faltando, dono diferente ou rótulo de ranking
  diferente reprova. Conferir também um item marcado como **feito** na `/agenda`: ele não pode
  aparecer como pendente na ficha (SC-018, T031).
- [ ] T037 Diferença com e sem `ATMA_DATABASE_URL`: os níveis afetados viram `não apurado` e
  **nenhum `0` novo** aparece (SC-015). Em produção a env está ausente hoje — a ficha da `atma` lá
  tem a célula de leads em `não apurado` e a âncora da 010 recuada para `visitante`, e isso é o
  comportamento correto.
- [ ] T038 Push **fora** de 23:30-01:00 e 08:00-08:45 BRT (Princípio IV — push é deploy).

---

## Dependencies & Execution Order

### Entre fases

- **Setup (T001, T001a)**: sem dependência, abre a suíte. **T001a é a primeira coisa da feature** —
  ela captura o "antes" da SC-001 e tem que rodar antes da T009.
- **Foundational (T002-T010)**: depende de T001 e **bloqueia todas as histórias**.
- **US1 (T011-T014)**: depende da Fase 2. Sem rota e sem menu, nada é alcançável.
- **US2 (T015-T019)**: depende da Fase 2 e de **T013a** — é ela que alimenta `montarNiveis()`; sem
  a montagem, T017 preenche níveis sobre entrada vazia.
- **US3 (T020-T023)**: depende da Fase 2, de T013 e de T013a. Independente da US2.
- **US4 (T024-T027)**: depende da Fase 2, de T004 (a ficha curada) e de T013. N0 **não depende da
  cadeia nem da montagem** — roda mesmo com a US2 aberta.
- **US5 (T028-T031)**: depende da Fase 2 e de T013. N6 também **não depende da cadeia**.
- **Polish (T032-T038)**: depende das histórias que se pretende entregar.

### Dentro de cada história

- Regra em `lib/ficha.mjs` → teste em `test/ficha.test.mjs` → renderização na página.
- O teste de cada história é escrito **antes** de a página renderizar aquele nível: o módulo é puro
  e roda sem subir o Next, então a garantia é conferível antes de existir HTML.

### Conflitos de arquivo (o que **não** pode ir em paralelo)

- `lib/ficha.mjs`: T005, T006, T007, T015, T016, T017, T020, T024, T025, T029 — **um por vez**.
- `test/ficha.test.mjs`: T008, T010, T018, T022, T026, T030 — **um por vez**.
- `app/okr/[slug]/page.tsx`: T013, T013a, T019, T023, T027, T031 — **um por vez**.

### Oportunidades de paralelismo

- T002, T003 e T004 são três arquivos diferentes (`lib/okr.mjs`, `lib/projects.ts`,
  `data/projects.json`) e rodam juntos.
- T012 (`app/globals.css`) roda junto com T011 (`app/tabs.tsx`).
- T021 (`lib/okr-coleta.ts`) roda junto com T020 (`lib/ficha.mjs`).
- Fechada a Fase 2 e a T013, as histórias US2, US3, US4 e US5 são independentes entre si — cada uma
  preenche um nível diferente da mesma espinha, e a única serialização é a dos três arquivos
  compartilhados listados acima.

---

## Implementation Strategy

### MVP primeiro (US1 + US2)

1. Fase 1 (**T001a antes de tudo**) → Fase 2 → Fase 3.
2. **PARE e confira**: `/okr/atma` 200 com sete títulos, `/okr/nao-existe` 404, menu por teclado com
   JS desligado, `diff` da `/okr` limpo.
3. Nesse ponto a ficha é **alcançável**, mas ainda não é honesta: seis níveis carregam a célula de
   espinha. O primeiro deploy que vale a pena é **Fase 3 + Fase 4** — com N1-N4 acesos, a ficha da
   `atma` produz a lista do que falta medir, que é o entregável inteiro da feature.

### Entrega incremental

Cada história acende um pedaço da árvore sem apagar as outras:

- **US2** → N1-N4 (a conta de receita e os canais) → é o que faz a ficha da `atma` produzir trabalho.
- **US3** → N5 (a família do gargalo).
- **US4** → N0 e os KRs conferidos.
- **US5** → N6 (a agenda daquele projeto).

Ordem sugerida: US2 → US4 → US3 → US5. A US4 sobe antes da US3 porque a `ficha` curada da T004 já
existe desde a Fase 2 e N0 não depende da cadeia.

---

## Notes

- **Nada é medido de novo.** Nenhum coletor, nenhuma env, nenhuma tabela, nenhuma escrita (FR-036).
  Todo número desta feature vem (a) dos coletores da 009, (b) de declaração no card rotulada como
  declarada, ou (c) de divisão dos dois pela 010.
- **Onde o `0` é o defeito**: célula sem dado nunca vira `0`, `100%`, `—` ou branco. Banco fora
  produzindo "0 leads" é o melhor placar possível saindo do pior estado possível — é o defeito que
  a feature inteira existe para não ter (R1).
- `lib/funil.mjs`, `lib/projecao.mjs` e `lib/agenda.mjs` ficam **intocados**. Um terceiro estado
  dentro de `ehApurado()` mudaria a `/okr` inteira sem ninguém pedir (SC-001).
- Commit por tarefa ou por grupo lógico; a suíte roda em ~2s e não há razão para acumular.
