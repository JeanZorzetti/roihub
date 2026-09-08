# Tasks: Marca e não-marca — separar a demanda que já é sua da que ainda não é

**Feature**: `025-marca-e-nao-marca` | **Input**: `specs/025-marca-e-nao-marca/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api-gsc-serie.md](./contracts/api-gsc-serie.md),
[quickstart.md](./quickstart.md)

**Tests**: obrigatórios. O Princípio II da constituição exige `node --test` com lista explícita em
`package.json`, e o plan declara `test/marca.test.mjs` novo + `test/kpis-busca.test.mjs` alterado.
As quatro armadilhas desta spec (alternação, dia omitido, mês parcial, ponta provisória) **são
regras puras** e cabem todas em milissegundos — descobri-las em produção custa um mês de KPI errado
para o lado que agrada.

**Organização**: por user story, para cada uma ser entregável e testável sozinha.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência)
- **[Story]**: US1 / US2 / US3
- Caminhos exatos em toda tarefa

## Path Conventions

Aplicação web única na raiz do repo `roihub` (App Router + `lib/`), conforme `plan.md`
§Project Structure. **Nenhuma camada nova, nenhuma tabela nova, nenhuma rota nova, nenhum cron
novo, nenhum segredo novo, nenhuma dependência nova** (D12).

---

## Phase 1: Setup

**Purpose**: o arquivo novo nasce já registrado — o Princípio II não perdoa depois.

- [X] **T001** Criar `lib/marca.mjs` com o cabeçalho de módulo puro (zero imports, sem
  `process.env`, sem `pg`, sem `fetch`, **sem relógio interno** — `hoje` é sempre parâmetro, como o
  ano vigente foi na 024) e criar `test/marca.test.mjs`, **acrescentando `test/marca.test.mjs` à
  lista explícita do script `test` em `package.json` no mesmo commit**. Rodar `npm test` e confirmar
  que o arquivo novo aparece na saída — `test/validade.test.mjs` reprova se ficar de fora.

**Checkpoint**: `npm test` verde, com o arquivo novo na lista.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: a declaração de marca, as colunas e a regra de casamento. **Nada das três stories
começa antes disto.**

**⚠️ `regexDeMarca` é fonte única para dois consumidores** (a corrida e a tela). Duas
implementações divergiriam na primeira variante nova, e a tela mostraria uma lista (FR-012) que não
é a que classificou os números (D3).

- [X] **T002** [P] Acrescentar o campo `marca?: { termos: string[]; pais: string; declaradaEm?: string }`
  ao tipo `Project` em `lib/projects.ts`, com o comentário de curadoria do `data-model.md` §2 —
  ausente é **não declarada**, nunca "zero buscas de marca" (FR-004). Princípio I: quem lê é
  `listProjects()`, nunca `data/projects.json` direto.
- [X] **T003** [P] Acrescentar o bloco `marca` ao card da `atma` em `data/projects.json`:
  `{ "termos": ["atma", "atma aligner", "atma alinhadores"], "pais": "bra", "declaradaEm": "2026-09-08" }`.
  **Só a atma** — os outros 34 cards ficam intactos (FR-013). `pais` é obrigatório (D2/D7).
- [X] **T004** [P] Acrescentar as 7 colunas ao `ensure()` de `lib/db.ts`, junto do
  `CREATE TABLE hub_gsc_dia` da 021, como `ALTER TABLE hub_gsc_dia ADD COLUMN IF NOT EXISTS` —
  `pais TEXT`, `impressoes_pais INT`, `cliques_pais INT`, `impressoes_marca INT`,
  `cliques_marca INT`, `impressoes_nao_marca INT`, `cliques_nao_marca INT`. **Nenhum `NOT NULL`,
  nenhum `DEFAULT 0`**: um default de zero transformaria 480 dias de "nunca perguntei" em "nenhuma
  busca de marca", que é a mentira exata que a FR-004 proíbe. `impressoes` / `cliques` / `posicao`
  **não mudam de significado** — continuam o site inteiro sem corte, e alimentam a tela de 8 meses e
  a célula `visitante` da ficha. ⚠️ Sem crase nos comentários SQL: é template literal do JS.
- [X] **T005** Escrever em `test/marca.test.mjs` os testes de `regexDeMarca` e `marcaDeclarada`
  (**devem falhar antes da T006**), cobrindo a tabela da `quickstart.md` §2 com
  `["atma", "atma aligner"]`: `atma` casa · `atma aligner` casa · `ATMA Aligner` casa (flag `i`) ·
  `preço atma alinhador` casa (`\b` no meio) · **`atmasfera` NÃO casa** · `alinhador invisível` NÃO
  casa. Mais a asserção que fecha a D3: o padrão traz o **termo longo primeiro**
  (`\b(atma aligner|atma)\b`) — alternação *leftmost-first* com o curto na frente casaria só `atma`,
  o padrão ainda "funcionaria", e o erro só apareceria numa contagem meses depois. E os três motivos
  de `marcaDeclarada`: `ausente`, `sem-termos`, `sem-pais` — um `null` mudo faria "não curei ainda"
  parecer com "curei errado".
- [X] **T006** Implementar `regexDeMarca(termos)` e `marcaDeclarada(projeto)` em `lib/marca.mjs`.
  `regexDeMarca` devolve **o padrão como string, sem flags**, com termos escapados, deduplicados e
  ordenados do mais longo para o mais curto; **sem dobra de acento** — quem cura escreve a variante
  acentuada, e dobrar automaticamente casaria termos que ninguém declarou, invisivelmente, porque a
  tela mostra a lista declarada e não a expandida. `marcaDeclarada` devolve `{ termos, pais, padrao }`
  ou `null` com o motivo. `npm test` verde.

**Checkpoint**: a regra de casamento está provada e as colunas existem. As três stories podem
começar.

---

## Phase 3: User Story 1 — A série passa a saber quem buscou pelo nome (P1) 🎯 MVP

**Goal**: a corrida das 05:17 grava, por dia, a fatia de marca e a de não-marca ao lado do total, e
a resposta registra se a soma fecha com o total.

**Independent Test**: para um dia qualquer já gravado, existe valor de marca ao lado do total, e a
fatia cobre a mesma janela que a série do total já cobre.

**⚠️ A decisão que carrega a feature inteira**: **não-marca é MEDIDA, não subtraída** (D1). O total
vem sem dimensão de consulta e **inclui** as raras; a fatia de marca vem por consulta e as
**exclui**. `total − marca` devolveria não-marca **mais** o resto anonimizado — inflando exatamente
o KPI que se quer ver crescer (5 contra 33 no tapepro, já medido).

### Tests for User Story 1

- [X] **T007** [US1] Acrescentar a `test/marca.test.mjs` os testes de `adensarDias` e `completude`
  (devem falhar antes da T008). `adensarDias`: devolve **todos** os dias da janela pedida, com
  `{ impressoes: 0, cliques: 0 }` onde o GSC não deu linha (D5) — sem isso, "nenhuma busca de marca
  nesse dia" e "não declarada" ficam indistinguíveis dentro do banco, a inversão da FR-004 pelo lado
  de dentro. `completude`: os **quatro** estados — `fecha` (resíduo 0), `piso` (resíduo > 0, com
  `fracao`), **`contradicao`** (resíduo < 0, **nunca arredondado para zero**) e `nao-declarada`, com
  asserção explícita de que `contradicao` **não** colapsa em `piso`: defeito de filtro e limitação da
  fonte pedem consertos opostos, e colapsá-los faria um bug de regex se disfarçar de limitação da
  fonte (D8/D13).

### Implementation for User Story 1

- [X] **T008** [US1] Implementar `adensarDias(inicio, fim, linhas)` e `completude(dias)` em
  `lib/marca.mjs`. Puras, janela e `hoje` por parâmetro. `npm test` verde.
- [X] **T009** [US1] Acrescentar `gscSerieFiltrada()` a `lib/gsc.ts`: a série diária
  (`dimensions: ["date"]`, `rowLimit: 2000`) com o filtro `page contains https://<host>/` que
  `queryTimeseries` já usa, **mais** `country equals <pais>` e um filtro de consulta opcional
  (`query includingRegex` / `query excludingRegex`, padrão prefixado com `(?i)`). Mantém o contrato
  de erro da 021: `null` é ausência estrutural (host fora de toda propriedade), `{erro}` é falha
  transitória — não colapsar os dois.
- [X] **T010** [US1] Em `lib/db.ts`: (a) `gravarMarcaGsc(projeto, dias)` como
  `UPDATE ... FROM (VALUES ...)` chaveado por `(projeto, dia)`, **nunca `INSERT`** — reusar
  `gravarDiasGsc` sobrescreveria o total de ~477 dias com valores que a chamada de marca não tem
  (D6); dia sem linha de total é **pulado** e a contagem volta como `semLinhaDeTotal`, porque dia sem
  total não tem denominador; (b) estender `lerDiasGsc()` para devolver as 7 colunas com nomes de
  domínio (`DiaSeparado`, `data-model.md` §3), **assinatura inalterada**.
- [X] **T011** [US1] Reescrever o laço de `app/api/gsc-serie/route.ts` conforme
  `contracts/api-gsc-serie.md` §1. **O laço continua percorrendo `projetosDeBusca()` e só ele**
  (FR-014) — é exatamente este laço que está sendo reescrito, e um requisito que sobrevive por
  acidente é um requisito que a próxima reescrita derruba. Grava o total como hoje (sem alteração);
  lê a declaração de marca
  do card; **não declarada ⇒ o total já está gravado e o slug sai em `semMarca` com o motivo**
  (FR-004); declarada ⇒ pede as **três** pernas na **mesma corrida e na mesma janela** de
  `DIAS_BACKFILL` (480, de `lib/serie-gsc.mjs`) — total do corte, `includingRegex`, `excludingRegex`
  —, adensa as três e grava com `gravarMarcaGsc`. Acrescenta `marca`, `conferencia` e `semMarca` à
  resposta `200`; `veredito: "contradicao"` **continua devolvendo 200** — o dado gravado é honesto e
  o alarme é o campo, não o status. Falha só das pernas de marca deixa o total gravado e o projeto em
  `falhas`; erro truncado em 60 caracteres, sem valor de ambiente (Princípio V). **`maxDuration`
  inalterado em 300.**
  ⚠️ As três pernas na mesma corrida **são** a medição: pernas de corridas diferentes mediriam o
  deslizamento da janela do GSC na meia-noite UTC (33 e depois 42 na mesma tarde), e o corte de país
  nas três é o que impede a diferença de medir o próprio corte — `"atma"` é palavra comum em
  sânscrito, então o edge case do termo genérico acontece no projeto **piloto** (D2/D13).
- [X] **T012** [US1] **Precondição — a corrida precisa do código rodando**, e a T022 (deploy da
  feature inteira) vem depois: ou o push da US1 já subiu (janela do Princípio IV respeitada, e o hub
  leva ~15 min — conferir a tela duas vezes, uma checagem cedo "prova" que não subiu), ou a corrida
  roda **local** com `npm run dev` e `DATABASE_URL` + `GOOGLE_SERVICE_ACCOUNT_JSON` + `CRON_SECRET`
  no ambiente. Rodar a corrida e ler `conferencia` **na ordem da `quickstart.md` §4**:
  `impressoesMarca > 0` **primeiro** — marca zerada com resíduo ≈ 0 diria `fecha` e estaria errado (é
  `includingRegex` exigindo a consulta inteira, e não-marca engoliu tudo); só então o `veredito`, a
  `fracao` e o `semLinhaDeTotal` (~239 é o esperado na primeira corrida: a janela de marca pede 480
  dias e a série do total começa em 11/01/2026). Rodar **duas vezes** para a FR-015, sem cruzar a
  meia-noite UTC. **Anotar o número** — é a SC-003.

**Checkpoint**: US1 funcional e verificável sozinha. A pergunta que a spec deixou aberta tem número.

---

## Phase 4: User Story 2 — Os dois KPIs, com o rótulo do que a fonte não conta (P2)

**Goal**: a aba de aquisição mostra crescimento de impressões não-marca e proporção de buscas de
marca contra as metas do board, marcados **piso** quando a soma não fecha.

**Independent Test**: o crescimento compara meses fechados equivalentes, e um mês parcial nunca é
comparado com um mês inteiro.

### Tests for User Story 2

- [X] **T013** [US2] Acrescentar a `test/marca.test.mjs` os testes de `mesesFechados`,
  `crescimentoNaoMarca` e `razaoDeMarca` (devem falhar antes da T014) — as **duas formas de fabricar
  queda** da D9, com a série de 11/01 a 31/03 da `quickstart.md` §3:
  1. `mesesFechados(serie, "2026-04-05")` → `["2026-02", "2026-03"]`, **nunca `"2026-01"`** — janeiro
     tem 21 dos 31 dias, e se entrasse, fevereiro apareceria com um crescimento que é só calendário;
  2. com `hoje = "2026-04-01"`, **março também sai** — faltam os 3 dias de folga e o GSC ainda vai
     subir a ponta;
  3. `crescimentoNaoMarca` devolve `null` com um só mês fechado, e **uma asserção explícita de que
     não é `0`** (FR-009 — "ainda não apurável");
  4. meses **não consecutivos** não se comparam: um buraco na série torna o mês anterior incompleto
     pela regra (1) e ele simplesmente não entra;
  5. `razaoDeMarca` devolve `null` com denominador zero ou nenhum dia declarado — nunca `0%`.
- [X] **T014** [US2] Implementar `mesesFechados(dias, hoje)`, `crescimentoNaoMarca(dias, hoje)` e
  `razaoDeMarca(dias)` em `lib/marca.mjs`. Mês fechado exige **as duas** condições: calendário
  completo na série **e** três dias de folga depois do último dia do mês. Mês parcial **não existe**
  na lista — em vez de existir com uma marca de "incompleto" que alguém acabaria comparando.
  `npm test` verde.

### Implementation for User Story 2

- [X] **T015** [US2] Bloco novo em `app/okr/[slug]/aquisicao/page.tsx`, alimentado por
  `lerDiasGsc(slug)` — **a tela lê o BANCO, não o Search Console** (D11), e esta é a primeira chamada
  que a função tem desde que a 021 a escreveu. Exibe:
  - **Crescimento de impressões não-marca** contra a faixa de **5% a 10%/mês** do board, com os dois
    meses comparados **nomeados** (`2026-08 → 2026-09`) e nenhum deles sendo o mês corrente (FR-008);
    primeiro mês fechado sai como "ainda não apurável", nunca `0%` (FR-009);
  - **Proporção de buscas de marca** com a **janela declarada** por extenso, como todo bloco da aba
    (FR-010);
  - o **rótulo de completude**, por `completude()` sobre **a mesma janela que o bloco exibe**, com a
    janela **nomeada na tela**: a `conferencia` da corrida soma a janela inteira de 480 dias, então
    tela e log podem divergir de veredito **legitimamente** — e sem a janela escrita ao lado, a
    divergência lê como bug e alguém vai caçar um defeito que não existe. Com `piso`, os dois
    números saem marcados **piso** e o tamanho da diferença aparece (FR-007); `contradicao` sai como
    alarme, não como ressalva educada;
  - a **lista de termos em uso** e o **corte de país** (FR-005/FR-012) — é o que permite a quem lê
    desconfiar da classificação, e a única defesa contra a lista pobre, cujo erro é **favorável e por
    isso perigoso**;
  - projeto **sem lista**: os dois KPIs saem como **não declarada com o motivo nomeado**
    (`ausente` / `sem-termos` / `sem-pais`), nunca como `0%` (FR-004/FR-013).

**Checkpoint**: US1 e US2 funcionam independentemente. As 2 medidas do board saem de ausentes para
exibidas — o placar vai de 22 para 24 de 28 (SC-001).

---

## Phase 5: User Story 3 — A canibalização para de acusar a própria marca (P3)

**Goal**: consultas de marca saem da lista de canibalização, a tela diz **quantas** saíram, e o
parágrafo de ressalva sai da tela para a atma.

**Independent Test**: uma consulta contendo termo de marca não aparece na canibalização, e uma
consulta genérica atendida por duas URLs continua aparecendo.

### Tests for User Story 3

- [X] **T016** [US3] Em `test/kpis-busca.test.mjs`: acrescentar os casos do filtro de marca e
  **ajustar as quatro asserções** que a mudança de forma da D10 quebra — hoje comparam contra array:
  `canibalizacao()` nas linhas ~172, ~180 e ~184, **e `k.canibalizacao` em ~196** (o plan diz "três"
  e conta só as três primeiras). Casos novos: `ehMarca`
  ausente ⇒ lista intacta e `removidas: null` (FR-013); `ehMarca` presente ⇒ consultas de marca fora
  da lista e `removidas` contando; **`removidas: 0` (declarada, nada casou) ≠ `removidas: null`** (não
  declarada); consulta genérica com duas URLs **continua** na lista.
- [X] **T017** [US3] Mudar `canibalizacao(linhas, ehMarca = null)` em `lib/kpis-busca.mjs` para
  devolver `{ lista, removidas }`, e fazer `kpisDeBusca(linhas, ehMarca)` repassar o argumento.
  Ordenação por impressões inalterada. **Uma função só** — uma `canibalizacaoFiltrada()` ao lado sairia
  de sincronia na primeira mudança de ordenação (D10). `npm test` verde.
- [X] **T018** [US3] Em `app/okr/[slug]/aquisicao/page.tsx`: consumir a forma nova
  (`kpis.canibalizacao.lista`), passar `ehMarca` construído com
  `new RegExp(regexDeMarca(termos), "i")` quando a declaração existir, exibir *"N consultas de marca
  removidas"* (FR-011 — **sumir em silêncio é indistinguível de filtro largo demais**) e **remover o
  parágrafo de ressalva** (linhas ~446-455: o comentário de 07/09 e o `<p className="foot">` que pedem
  ao leitor para ignorar as linhas de marca) quando a lista existir. Sem lista declarada, o parágrafo
  e o comportamento de hoje ficam intactos (FR-013/SC-006).

**Checkpoint**: as três stories funcionam independentemente.

---

## Phase 6: Polish & Cross-Cutting

- [X] **T019** Registrar em `CLAUDE.md` o número da conferência da T012 (SC-003) — o veredito, a
  `fracao` e a data. **É o produto mais duradouro desta feature**: a resposta a uma pergunta que só a
  medição responde, e a próxima spec não pode ter que remedi-la.
- [X] **T020** `npm test` e `npm run validade` verdes, e `npm run build` sem erro de tipo — as colunas
  novas de `lerDiasGsc` atravessam a borda `.ts`.
- [X] **T021** Verificação de tela da `quickstart.md` §5, **nas duas pontas**: `/okr/atma/aquisicao`
  com os dois KPIs, a lista de termos, o corte `bra`, o rótulo de completude, a canibalização sem
  `atma aligner` **e** com a contagem de removidas, uma consulta genérica de duas URLs **ainda**
  presente, e o parágrafo de ressalva **fora** da tela; e `/okr/sirius/aquisicao` com o comportamento
  de hoje **intacto** — ressalva presente, canibalização sem filtro, os dois KPIs novos como **não
  declarada** com o motivo nomeado, nunca `0%`.
- [ ] **T022** Deploy: push em `main` **fora das duas janelas proibidas do Princípio IV**. Push é
  deploy, o hub leva ~15 min para subir, e a corrida das 05:17 é a próxima prova.
- [X] **T023** [P] Corrigir `handoff/handoff-os-28-do-board-o-que-falta.md` — **é o documento que a
  própria spec cita como fonte do erro, e continua sendo a primeira leitura de quem chega**:
  (a) linhas ~149-150, trocar *"a corrida diária faz **uma requisição a mais** … grava **duas
  colunas** … Não-marca é a subtração"* pelo que a 025 decidiu — **três pernas medidas, não-marca
  nunca subtraída** (D1), pelo motivo já medido no tapepro (5 contra 33); (b) linhas ~49 e ~74,
  virar o ❌ de *Crescimento de Impressões Não-Marca* e *Brand Demand Ratio* para ✅ com o link da
  aba; (c) apagar a afirmação de urgência de calendário, que o backfill por filtro de consulta
  eliminou (D4). Sem isso, o repo guarda a receita que esta feature existe para recusar.
- [X] **T024** [P] Escrever `specs/025-marca-e-nao-marca/handoff-025-marca-e-nao-marca.md` com os
  números da corrida (o veredito, a `fracao`, o `semLinhaDeTotal`) e o que ficou **fora** do escopo
  com o motivo — mesmo formato do `handoff-024-crawl-de-pagina.md`. **Confirmar a SC-001**: o placar
  do board vai de **22 para 24 de 28**, que é o teto realista declarado em 07/09, com as 4 ausências
  restantes já justificadas. Esta é a última spec da série do board.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: sem dependências.
- **Foundational (T002-T006)**: depende do Setup. **BLOQUEIA as três stories.**
- **US1 (T007-T012)**: depois da Foundational. Sem dependência das outras stories.
- **US2 (T013-T015)**: depois da Foundational. **T015 depende funcionalmente da T011** para ter dado
  no banco — mas o módulo puro (T013/T014) é independente e testável sozinho.
- **US3 (T016-T018)**: depois da Foundational (precisa de `regexDeMarca`, T006). **Não depende de US1
  nem de US2** — a canibalização continua vindo de `gscConsultas()` ao vivo, não do banco (D11).
- **Polish (T019-T024)**: T019 e T024 dependem da T012 (precisam do número); T023 não depende de
  nada além da decisão da D1 e pode sair a qualquer momento; o resto depende de todas as stories
  desejadas.

### A precondição da T012

A corrida real precisa do código **rodando**. Duas saídas, e a tarefa exige escolher uma: subir a
US1 antes (push respeitando o Princípio IV, ~15 min até a tela mudar) ou rodar local com
`npm run dev` e as três env vars. A **T022 continua sendo o deploy da feature inteira** — não é a
mesma coisa que o push do MVP.

### Within Each User Story

- Teste primeiro, falhando, depois implementação (T005→T006, T007→T008, T013→T014, T016→T017).
- Módulo puro antes da borda: `lib/marca.mjs` antes de `lib/gsc.ts`, `lib/db.ts`, rota e tela.
- `lib/db.ts` (T010) antes da rota (T011).

### Parallel Opportunities

- **T002, T003, T004** em paralelo — três arquivos diferentes (`lib/projects.ts`,
  `data/projects.json`, `lib/db.ts`).
- **T023 e T024** em paralelo — dois handoffs, dois arquivos.
- Depois da Foundational, **US1 e US3 em paralelo**: só se cruzam em
  `app/okr/[slug]/aquisicao/page.tsx` (T015 e T018), o único arquivo compartilhado entre stories —
  **T015 e T018 nunca em paralelo**.
- `test/marca.test.mjs` é tocado por T005, T007 e T013: sequenciais, nunca `[P]` entre si.

```bash
# Foundational, em paralelo:
Task: "T002 campo marca no tipo Project em lib/projects.ts"
Task: "T003 bloco marca no card da atma em data/projects.json"
Task: "T004 7 ALTER TABLE no ensure() de lib/db.ts"
```

---

## Implementation Strategy

### MVP (US1 sozinha)

Setup → Foundational → US1 → **suba ou rode local** (precondição da T012) → **PARE e valide** com a
`quickstart.md` §4. A US1 sozinha já entrega o produto mais duradouro da feature: o número da
conferência. As duas medidas do board ainda não aparecem, mas a série existe e o backfill se
resolveu sozinho (D4).

### Incremental

1. Setup + Foundational → base pronta
2. US1 → corrida real, `conferencia` lida na ordem certa → **MVP**
3. US2 → os dois KPIs na tela, com o rótulo que a T012 apurou
4. US3 → a ressalva vira filtro (a menor das três em esforço, a mais direta em resultado)

### Sem urgência de calendário

Ao contrário da 021, **esperar não custa histórico**: as pernas de marca puxam a janela de 480 dias
toda corrida (D4), então o backfill não é um evento que se perde por atrasar — e a lista de termos
nova reclassifica a história inteira na corrida seguinte.

---

## Notes

- **A primeira corrida mede a primeira corrida.** Se algum número da T012 sair estranho, rode de novo
  no dia seguinte antes de mexer no código — a janela do GSC desliza na meia-noite UTC.
- **`npm test` verde não prova a T012.** Os módulos puros não conhecem o Search Console; a suíte prova
  a regra, a corrida prova a fonte.
- **`residuo: 0` sozinho não prova que fecha.** Sempre `impressoesMarca > 0` antes.
- **A lista pobre não tem conserto técnico** — é curadoria, e a defesa é a FR-012 pôr a lista na tela.
- Commit por tarefa ou grupo lógico. `test/marca.test.mjs` e a linha de `package.json` **no mesmo
  commit**, sempre.
