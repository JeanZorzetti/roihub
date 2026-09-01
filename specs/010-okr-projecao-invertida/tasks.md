# Tasks: Projeção invertida — da meta para o fator obrigatório

**Input**: documentos de desenho em `/specs/010-okr-projecao-invertida/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Testes**: incluídos e **obrigatórios** — a spec os exige nominalmente (FR-016, SC-006, SC-008) e
a constituição registra cada arquivo à mão em `npm test` (Princípio II).

## Formato: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência)
- **[Story]**: a qual user story a tarefa pertence (US1, US2, US3)
- Caminho de arquivo exato em toda descrição

## Convenção de caminhos

Aplicação Next.js já existente, sem separação frontend/backend: lógica pura em `lib/*.mjs`, borda
em `app/okr/page.tsx`, testes em `test/*.test.mjs`, curadoria em `data/projects.json`.
Todos os caminhos são relativos à raiz do repo `roihub/`.

---

## Phase 1: Setup

**Purpose**: abrir o arquivo de teste novo já dentro do portão do Princípio II — antes de existir
lógica para testar, porque `test/validade.test.mjs` compara a lista de `npm test` com o diretório
**nos dois sentidos**: arquivo criado e não registrado reprova a suíte.

- [X] **T001** Criar `test/projecao.test.mjs` com um caso mínimo e **no mesmo commit** acrescentar
  `test/projecao.test.mjs` ao fim da lista do script `"test"` em `package.json` (hoje termina em
  `test/okr.test.mjs`). Rodar `npm test` e confirmar verde **antes** de escrever qualquer lógica.
  — FR-016, SC-008, Princípio II

**Checkpoint**: `npm test` verde com o arquivo novo registrado. Nenhuma linha de lógica ainda.

---

## Phase 2: Foundational (bloqueia todas as user stories)

**Purpose**: a primitiva de divisão, o campo no contrato de dados e a eleição da âncora. As três
user stories dividem por âncora; nenhuma começa antes disto.

**⚠️ CRITICAL**: T002-T009 completos antes de qualquer trabalho de US1/US2/US3.

- [X] **T002** Implementar `exigencia(necessario, ancora)` em `lib/funil.mjs`, **colada logo
  abaixo de `razao()`** (D7), exportada, com o JSDoc do contrato explicando por que ela aceita
  numerador > denominador e `razao()` não. Ordem das saídas: âncora não apurada →
  `âncora: <motivo>`; necessário não apurado → `necessário: <motivo>`; `ancora.valor === 0` →
  `âncora zerada — meta não se divide por volume nenhum`; caso contrário `apurado(n/d)`, **sem
  teto**. Nada existente em `funil.mjs` é alterado. — contracts/projecao-mjs.md, FR-015, G3, G5

- [X] **T003** [P] Casos de `exigencia()` em `test/funil.test.mjs` (arquivo já registrado), ao
  lado dos de `razao()`: fração normal; fração > 1 **apurada** (a diferença para `razao()`, e é o
  teste que impede as duas regras de convergirem); âncora `0`; cada ponta não apurada com o
  prefixo certo no motivo. — G3, G5

- [X] **T004** [P] Acrescentar `meta?: { valor?: number; ticket?: number; prazo?: string;
  declaradaEm?: string }` ao tipo `Project` em `lib/projects.ts`, ao lado de `perfil` e `vendas`,
  com o JSDoc de `contracts/meta-no-card.md`. Confirmar que o campo atravessa o spread de
  `mergeProjects()` sem tocar em `lib/projects.mjs` e que **nenhum** import de
  `data/projects.json` nasce fora de `lib/projects.*`. — FR-017, Princípio I

- [X] **T005** Criar `lib/projecao.mjs` com cabeçalho explicando a inversão (a R6 proíbe pra
  frente, não pra trás), os imports permitidos —
  `import { apurado, naoApurado, ehApurado, razao, exigencia } from "./funil.mjs";` — e os
  `@typedef` de `Celula`, `Ancora`, `Normalizacao` e `Projecao` conforme `data-model.md`.
  Proibido importar função de `lib/okr.mjs` (a ficha entra pronta) e proibido reimplementar
  célula, razão ou cadeia. — FR-015, D1

- [X] **T006** Implementar `ancoraDe(marcos)` em `lib/projecao.mjs`: percorre do topo, para no
  primeiro `não apurado`, devolve o **último apurado da sequência contígua** — o degrau final
  incluído (FR-005 literal, D2) — com `{ chave, nome, indice, valor, ehFinal }`. `null` quando não
  há nenhum. — FR-005

- [X] **T007** [P] Testes de `ancoraDe()` em `test/projecao.test.mjs`: âncora antes do buraco com
  degrau apurado depois dele (`tratamento: 0` após três `não apurado` → âncora é `lead`,
  **SC-007**); cadeia inteira apurada → âncora final com `ehFinal: true`; nenhum degrau apurado →
  `null`; só o degrau final apurado após buraco → `null`. — SC-007, FR-005

- [X] **T008** Implementar o esqueleto de `projetar({ ficha, meta, hoje, janelaDias = 28 })` em
  `lib/projecao.mjs` com as **8 guardas na ordem da própria divisão** (data-model.md §4):
  `ficha.semPerfil` → `sem perfil declarado`; `meta` ausente → `sem meta declarada`; `valor`
  ausente ou `≤ 0`; `ticket` ausente ou `≤ 0` → `sem ticket declarado — R$ não vira contagem sem
  valor por unidade`; `prazo` inválido; `prazo` vencido → `prazo vencido em <data>`; âncora `null`
  → `sem âncora — nenhum degrau medido para dividir`; âncora `0` → `âncora zerada — meta não se
  divide por volume nenhum`. Toda guarda devolve `veredito: "nao-apurado"` com **todos** os campos
  numéricos não apurados. `declaradaEm` não tem guarda. `hoje` é parâmetro — nada de `Date.now()`
  dentro do módulo. — FR-003, FR-012, FR-013, G1, G2, G10, Princípio III

- [X] **T009** [P] Testes das guardas em `test/projecao.test.mjs`, um por guarda, cada um
  conferindo que **nenhum** campo numérico sai apurado e que o motivo é o texto exato do
  `data-model.md`. Incluir o caso `sem ticket` (**SC-009**: nunca `0`, nunca `100%`) e o par
  `declaradaEm: "2025-01-01"` vs `"2026-09-01"` produzindo saída **idêntica** (**G10**).
  Fechar com uma asserção que vale para **todo** caso testado neste arquivo: `veredito` pertence ao
  conjunto `["nao-apurado","cabe","limite","impossivel","multiplo","folga"]` e nunca é `undefined`
  (**G7**) — um helper de asserção reusado pelos testes das três stories. — SC-003, SC-009, G1, G7, G10

**Checkpoint**: `exigencia()` testada, `meta` no contrato, âncora eleita, guardas fechando. As três
stories podem começar.

---

## Phase 3: User Story 1 — Saber quanto cada fator precisa valer (P1) 🎯 MVP

**Goal**: com meta declarada e ao menos um degrau apurado, a `/okr` mostra o N1 necessário na
janela e o fator obrigatório do ponto medido até o fim da cadeia, com a fração colada e os degraus
nomeados.

**Independent Test**: cadeia sintética do `quickstart.md` §2 (`535 → 39`, prazo de 28 dias) devolve
âncora `lead = 39`, `veredito: "cabe"`, fator ≈ `0,3205` e 4 degraus a medir — conferível à mão por
`50000 ÷ 4000 = 12,5` e `12,5 ÷ 39`.

### Testes da US1 (escrever primeiro, ver falhar)

- [X] **T010** [P] [US1] Em `test/projecao.test.mjs`: `n1Total = valor ÷ ticket` apurado, e a
  normalização de 28 dias deixando `n1Janela === n1Total` (uma janela cheia). — FR-003, FR-004

- [X] **T011** [P] [US1] Em `test/projecao.test.mjs`, cadeia sintética do quickstart §2 com
  `hoje: "2026-09-01"` e `prazo: "2026-09-29"`: âncora `lead = 39`, `veredito: "cabe"`,
  `fatorObrigatorio ≈ 0,3205`, `degrausAMedir.length === 4` e os quatro pares `{de,para}` nomeados
  (`lead→contatado`, `contatado→agendada`, `agendada→compareceu`, `compareceu→tratamento`).
  Fator exatamente `1` → `veredito: "limite"`. — SC-002, FR-006, FR-009, G6

### Implementação da US1

- [X] **T012** [US1] Implementar a normalização em `lib/projecao.mjs`: `diasRestantes` contado de
  **`hoje`** (inclusive) até `prazo` — nunca de `declaradaEm` (D3) —, `janelas = diasRestantes ÷
  janelaDias`, `n1Janela = n1Total × (janelaDias ÷ diasRestantes)` e o campo `conta` com a conta
  escrita para a tela. — FR-004, D3

- [X] **T013** [US1] Implementar `fatorObrigatorio` em `lib/projecao.mjs`:
  `exigencia(n1Janela, apurado(ancora.valor))` **só** quando `ancora.ehFinal === false`; com
  `ehFinal === true` sai `não apurado: âncora é o próprio N1 — não há trecho a exigir`. Vereditos
  `cabe` (`0 < f < 1`) e `limite` (`f === 1`), e `motivo` com a prova aritmética pronta para a
  tela. No `limite`, o texto é `100% em todos os degraus restantes — limite, não meta` e **não**
  contém a palavra "impossível": aritmeticamente `1` cabe (R-h). — FR-006, G3, G4, R-h

- [X] **T014** [US1] Implementar `degrausAMedir` em `lib/projecao.mjs`: as transições
  `{de, para}` entre a âncora e o fim da cadeia, nominalmente, a partir de `ficha.marcos`. Vazio
  quando `ancora.ehFinal`. Garantir a bicondicional da **G6** (não-vazio ⟺ `fatorObrigatorio`
  apurado). — FR-009, G6

- [X] **T015** [US1] Bloco de projeção no card em `app/okr/page.tsx`, **abaixo do veredito da
  009**, na mesma seção do projeto (D6 — bloco, não coluna literal, que quebra em 390px). Chamar
  `projetar({ ficha, meta: p.meta, hoje })` com `hoje` = **data corrente ISO** (`isoDaysAgo(0)`),
  passada como parâmetro — sem `Date.now()` dentro do `.mjs`.

  ⚠️ `hoje` **NÃO é `FIM`**. `FIM = isoDaysAgo(3)` porque a janela do GSC fecha em D-3; usá-lo como
  hoje alonga o prazo em 3 dias (124 em vez de 121 no caso do `data-model.md` §6) e o número da
  tela deixa de bater com a conferência à mão, que é o critério inteiro da SC-002.

  Renderizar: N1 necessário, âncora com nome e valor, fator obrigatório **com a fração colada** no
  formato `7,42% (2,89/39)` (R-a, FR-011), `valor` e `ticket` rotulados como **declarados** com
  `declarada em <declaradaEm>` ao lado (R-c, FR-002, D10), e a lista nominal dos degraus a medir.
  Projeto sem meta: uma linha `.foot` com `não apurado — sem meta declarada`, **nunca** bloco vazio
  nem `0` (R-d, FR-013).

  O rótulo `fator obrigatório` só pode ser emitido no ramo **apurado** — é essa string que a SC-003
  conta no HTML servido (quickstart §3). Rótulo impresso antes da checagem da meta faz o grep dar
  40 e o check passa a medir o rótulo em vez da feature. Nenhum veredito da 009 muda de lugar.
  — FR-011, FR-013, FR-014, SC-001, SC-003, SC-004

- [X] **T016** [US1] Acrescentar `"meta": { "valor": 50000, "ticket": 4000, "prazo": "2026-12-31",
  "declaradaEm": "2026-09-01" }` **somente** ao card `atma` em `data/projects.json` (Q4 — os
  outros 39 seguem sem). Conferir que a contagem de `"meta"` em `data/projects.json` é 1.
  — FR-001, SC-003

**Checkpoint**: `/okr` responde 200 com a `atma` exibindo âncora, N1 necessário, fator com fração e
os 4 degraus; os outros 39 exibem `sem meta declarada`. US1 entregável sozinha.

---

## Phase 4: User Story 2 — Descobrir que a meta é impossível antes de gastar o trimestre (P1)

**Goal**: fator obrigatório `> 1` sai como **meta impossível na janela**, com prova aritmética e o
múltiplo de volume/ticket — e o ramo da cadeia fechada mostra múltiplo/folga **sem nunca** dizer
impossível.

**Independent Test**: mesma cadeia sintética com `valor: 400000` (`100 ÷ 39 = 2,56`) → `impossivel`
com `multiploDeVolume ≈ 2,6`; cadeia inteira apurada com `valor: 400000` → `multiplo ≈ 10`, jamais
`impossivel`.

### Testes da US2 (escrever primeiro, ver falhar)

- [X] **T017** [P] [US2] Em `test/projecao.test.mjs`: `valor: 400000` na cadeia com furo →
  `veredito: "impossivel"`, `fatorObrigatorio` **apurado acima de 1** e `multiploDeVolume ≈ 2,6`;
  o `motivo` contém a prova (`taxa não passa de 100%`) e nomeia volume **e** ticket, e **não**
  contém copy, performance nem indexação. — SC-005, FR-007, FR-008, D8

- [X] **T018** [P] [US2] Em `test/projecao.test.mjs`, cadeia **fechada** (`contatado: 30,
  agendada: 20, compareceu: 15, tratamento: 10`) com `valor: 400000`: âncora `tratamento` com
  `ehFinal: true`; `fatorObrigatorio` **não apurado** com `âncora é o próprio N1 — não há trecho a
  exigir`; `multiploNecessario ≈ 10`; `veredito: "multiplo"`; `degrausAMedir` vazio; e asserção
  explícita de que `veredito !== "impossivel"` e de que a palavra "impossív" **não** aparece no
  `motivo`. Repetir com múltiplo `< 1` → `veredito: "folga"` e `folga = 1 ÷ multiplo`. Asserção
  cruzada: `fatorObrigatorio` e `multiploNecessario` nunca apurados juntos. — G4, G9, D9, FR-010

### Implementação da US2

- [X] **T019** [US2] Implementar o ramo da impossibilidade em `lib/projecao.mjs`: com
  `ehFinal === false` e fator `> 1`, `veredito: "impossivel"` e `multiploDeVolume` = o próprio
  fator relido (D4 — mesma divisão, sem número de referência novo), com a prova de que taxa não
  passa de 100%.

  O campo é um só, mas o `motivo` DEVE conter as **duas** palavras — `volume` e `ticket` — porque o
  nome `multiploDeVolume` cita metade do que a FR-008 exige, e um texto que só fale de volume
  esconde o outro fator que resolveria a meta. Asserção literal das duas palavras em T017.
  — FR-007, FR-008, D4, D8

- [X] **T020** [US2] Implementar o ramo do múltiplo em `lib/projecao.mjs`: com `ehFinal === true`,
  `multiploNecessario = exigencia(n1Janela, apurado(ancora.valor))`, `folga = 1 ÷ multiplo` quando
  `< 1`, vereditos `multiplo` e `folga`, `degrausAMedir` vazio e **nenhum** caminho de código
  levando a `impossivel` neste ramo. — FR-010, D9, G9

- [X] **T021** [US2] Renderização dos dois ramos em `app/okr/page.tsx`: fator `> 1` **nunca**
  formatado como percentual de célula — o percentual só aparece dentro da frase de prova (R-b, D8);
  o texto do caso impossível nomeia volume e ticket e não sugere trabalho de taxa (R-e); no ramo do
  múltiplo a palavra "impossível" não aparece, por maior que seja o múltiplo (R-g). Múltiplo e
  folga também levam a fração colada (R-a). — SC-005, FR-008, FR-011

**Checkpoint**: US1 e US2 funcionam independentes. O ramo do múltiplo existe coberto **só** por
teste sintético — nenhum projeto o alcança hoje (risco registrado no plan).

---

## Phase 5: User Story 3 — Comparar meta anual com funil de 28 dias (P2)

**Goal**: a meta é normalizada para a janela **antes** de dividir, e a tela mostra as duas leituras
— o total do prazo e a parcela da janela — com a conta escrita.

**Independent Test**: a mesma meta com prazo de 28 e de 112 dias produz fatores obrigatórios na
razão de 4 para 1.

### Testes da US3 (escrever primeiro, ver falhar)

- [X] **T022** [P] [US3] Em `test/projecao.test.mjs`: mesma entrada com `prazo: "2026-09-29"`
  (28 dias) e `prazo: "2026-12-22"` (112 dias), `hoje: "2026-09-01"` → fatores na razão **4:1**
  (≈ `0,3205` e ≈ `0,0801`). — SC-006, G8

- [X] **T023** [P] [US3] Em `test/projecao.test.mjs`: prazo **vencido** → `veredito: "nao-apurado"`
  com `prazo vencido em <data>`, sem divisão por janela negativa nem por zero; prazo restante menor
  que uma janela → `normalizacao.encurtada === true`, o campo `conta` refletindo o prazo restante
  real e — a asserção que fixa a **direção** da fórmula — `n1Janela > n1Total` (7 dias restantes
  exigem 4× o total do prazo na janela). Sem ela, inverter para `diasRestantes ÷ janelaDias` passa
  verde. — US3-AC2, US3-AC3, D3

### Implementação da US3

- [X] **T024** [US3] Completar `Normalizacao` em `lib/projecao.mjs`: `encurtada` quando
  `diasRestantes < janelaDias`, e `conta` com a conta escrita (`12,5 × 28/121 = 2,89`) pronta para
  a tela. A guarda de prazo vencido já entrou em T008 — aqui só se confirma que ela precede
  qualquer divisão. — FR-004, US3-AC3

- [X] **T025** [US3] Exibir em `app/okr/page.tsx` as **duas leituras** lado a lado — total do prazo
  e parcela da janela — com a conta de normalização visível, e o aviso de janela encurtada quando
  `encurtada`. — FR-004, US3-AC1, US3-AC3

**Checkpoint**: as três user stories funcionam independentes.

---

## Phase 6: Polish & validação

- [X] **T026** [P] Acrescentar à seção **"O que isto NÃO vê"** de `app/okr/page.tsx` o item de que
  o fator obrigatório **caber em 100% não significa ser alcançável**, apenas que não é
  aritmeticamente impossível — a distância entre "cabe" e "acontece" é leitura humana.
  — FR-018, R-f

- [X] **T027** Rodar `npm test` inteiro (não só o arquivo tocado) e confirmar verde, incluindo
  `test/validade.test.mjs`. — SC-008, Princípio II

- [X] **T028** Rodar `quickstart.md` §2 na íntegra (`node -e` com a cadeia sintética): caso base,
  normalização 4:1, meta impossível, sem ticket, cadeia fechada e meta velha. Conferir **à mão**
  `50000 ÷ 4000 = 12,5` e `12,5 ÷ 39 = 0,3205` — se a conta na cabeça não bater com a saída, a
  saída está errada. — SC-002, SC-005, SC-006, SC-009, G4, G9, G10

- [X] **T029** Subir `npm run dev`, abrir `/okr` e rodar a varredura do `quickstart.md` §3: a
  contagem de `fator obrigatório` no HTML servido tem que ser **1** (só a `atma`), conferida contra
  a contagem de `"meta"` em `data/projects.json`; nenhuma taxa de três dígitos renderizada como
  célula (SC-005); nenhuma ocorrência de `múltiplo necessário` (G9 — nenhuma cadeia fechada hoje);
  todo fator com fração colada (SC-004); nenhum veredito da 009 mudou de posição (SC-001).
  — SC-001, SC-003, SC-004, SC-005

- [X] **T030** Conferir os portões de fechamento: nenhum import de `data/projects.json` fora de
  `lib/projects.*` (Princípio I), `test/projecao.test.mjs` registrado em `package.json`
  (Princípio II), `lib/projecao.mjs` sem env/banco/rede/relógio (Princípio III). Push em `main`
  **fora** de 23:30-01:00 e 08:00-08:45 BRT — push é deploy (Princípio IV).
  — FR-015, FR-016, FR-017

---

## Dependencies & Execution Order

### Dependências de fase

- **Setup (T001)**: sem dependência, começa imediatamente — e tem que vir primeiro, senão
  `test/validade.test.mjs` reprova a suíte no momento em que o arquivo de teste nascer.
- **Foundational (T002-T009)**: depende do Setup. **BLOQUEIA** todas as user stories.
- **US1 (T010-T016)**, **US2 (T017-T021)**, **US3 (T022-T025)**: dependem da Foundational.
- **Polish (T026-T030)**: depende de todas as stories desejadas.

### Dependências entre stories

- **US1 (P1)**: começa após a Foundational. Sem dependência de outra story.
- **US2 (P1)**: começa após a Foundational. Toca `projetar()` e `page.tsx` nos mesmos arquivos que
  a US1 — testável sozinha, mas **serializada** com a US1 por conflito de arquivo.
- **US3 (P2)**: idem — T012 (US1) e T024 (US3) mexem na mesma `Normalizacao`; em paralelo, T024
  espera T012.

### Dentro de cada story

- Testes escritos e **falhando** antes da implementação.
- `lib/projecao.mjs` antes de `app/okr/page.tsx` — a tela consome o retorno, não o contrário.
- `data/projects.json` (T016) por último na US1: com meta declarada e sem lógica, o card exibe
  número errado em vez de `não apurado`.

### Oportunidades de paralelismo

Tudo marcado `[P]` toca arquivo diferente:

- **Foundational**: T003 (`test/funil.test.mjs`) ∥ T004 (`lib/projects.ts`) ∥ T007/T009
  (`test/projecao.test.mjs`, depois de T006/T008).
- **Testes por story**: T010 ∥ T011; T017 ∥ T018; T022 ∥ T023 — todos em
  `test/projecao.test.mjs`, então em paralelo **só** se cada um for um bloco `describe` separado;
  caso contrário, sequencial.
- **Polish**: T026 é independente de T027-T029.

⚠️ `lib/projecao.mjs` e `app/okr/page.tsx` são tocados por US1, US2 e US3. Nenhum `[P]` cruza esses
dois arquivos.

---

## Implementation Strategy

### MVP primeiro (só a US1)

1. T001 (Setup) → T002-T009 (Foundational) → T010-T016 (US1).
2. **PARE e valide**: `quickstart.md` §2 caso base + §3 na `atma`. A tela já sai de "apurar antes
   de melhorar" e passa a nomear 4 degraus a medir — que é o pedido inteiro da spec.
3. US2 e US3 entram depois, cada uma somando um ramo sem alterar o que a US1 entregou.

### Ordem recomendada de entrega

US1 (o pedido) → US2 (o achado que economiza um trimestre) → US3 (a correção que impede a feature
de mentir por um fator de 4 a 13) → Polish.

⚠️ A US3 é P2 mas **não é opcional para uso real**: sem ela, meta de prazo longo contra funil de 28
dias declara "impossível" em projeto viável. Rodar a US1 em produção com prazo diferente de 28 dias
antes da US3 produz número errado com cara de certo.

---

## Cobertura: requisito → tarefa

| FR | Tarefa | FR | Tarefa |
|---|---|---|---|
| FR-001 | T016 | FR-010 | T018, T020 |
| FR-002 | T015 | FR-011 | T015, T021 |
| FR-003 | T008, T010 | FR-012 | T008 |
| FR-004 | T012, T024, T025 | FR-013 | T008, T015 |
| FR-005 | T006, T007 | FR-014 | T015 |
| FR-006 | T011, T013 | FR-015 | T005, T030 |
| FR-007 | T017, T019 | FR-016 | T001, T027 |
| FR-008 | T017, T019, T021 | FR-017 | T004, T030 |
| FR-009 | T011, T014 | FR-018 | T026 |

| SC | Tarefa | Garantia | Tarefa |
|---|---|---|---|
| SC-001 | T015, T029 | G1 | T008, T009 |
| SC-002 | T011, T028, T029 | G2 | T008 |
| SC-003 | T015, T016, T029 | G3 | T002, T003, T013 |
| SC-004 | T015, T029 | G4 | T018, T020 |
| SC-005 | T017, T021, T029 | G5 | T002, T003 |
| SC-006 | T022 | G6 | T014 |
| SC-007 | T007 | G7 | T009 |
| SC-008 | T001, T027 | G8 | T022 |
| SC-009 | T009, T028 | G9 | T018, T020, T029 |
| | | G10 | T009, T028 |

**30 tarefas.** Nenhuma dependência nova, nenhuma migração, nenhuma rota nova, nenhuma escrita em
runtime.
