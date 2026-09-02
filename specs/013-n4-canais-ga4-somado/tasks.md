# Tasks: N4 por canal — GA4 somado ao GSC

**Input**: documentos de desenho em `specs/013-n4-canais-ga4-somado/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: SIM. O plano nomeia `test/ficha.test.mjs` — arquivo **já registrado** em `npm test` — como
a régua que reprova a feature sem subir o Next (Princípio II, quickstart §1). Nenhum arquivo de
teste novo: `test/validade.test.mjs` continua concordando com o diretório e `package.json` não muda.

**Organization**: por user story. US1 e US2 são P1 e compartilham `montarN4`; US3 é P2 e toca
arquivos disjuntos das outras duas.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: paralelizável (arquivo diferente, sem dependência pendente)
- **[Story]**: US1 / US2 / US3

## Path Conventions

Aplicação web única, raiz do repo `roihub/`: `lib/`, `app/`, `data/`, `test/`. Nenhum diretório novo
(plan.md → Project Structure).

---

## Phase 1: Setup

**Purpose**: confirmar que a feature não precisa de instalação nenhuma antes de começar.

- [X] T001 Confirmar que `google-auth-library` está em `dependencies` de `package.json` e que
      `test/ficha.test.mjs` já consta na lista de arquivos de `npm test` — a feature NÃO adiciona
      dependência nem arquivo de teste (plan.md → Technical Context, D1)
- [ ] T002 Pré-requisito operacional (fora do código): adicionar a conta de serviço de
      `GOOGLE_SERVICE_ACCOUNT_JSON` como **Visualizador** na propriedade GA4 da `atma` e anotar o
      `propertyId`, conforme `specs/013-n4-canais-ga4-somado/quickstart.md` §0. Sem isso a API
      devolve 403 e os quatro canais saem `não apurado` — comportamento correto, não regressão

**Checkpoint**: nada a instalar; credencial e propriedade prontas.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: a borda de rede e o contrato de projeto que US1 e US2 consomem.

**⚠️ CRITICAL**: US1 e US2 não começam antes desta fase. US3 NÃO depende dela.

- [X] T003 [P] Adicionar `ga4?: { propertyId: string }` ao tipo `Project` em `lib/projects.ts`, com
      o comentário de que AUSENTE é "não configurado" e nunca "sem tráfego" (data-model §5, FR-010,
      Princípio I — nenhum mapa `PROPRIEDADES_GA4` paralelo)
- [X] T004 [P] Criar `lib/ga4.ts` com `ga4Canais(propertyId, {inicio, fim})` conforme
      `contracts/ga4-leitura.md`: `GoogleAuth` próprio memoizado com escopo `analytics.readonly`,
      `POST v1beta/{property}:runReport` com `sessionDefaultChannelGroup` × `sessions`, normalização
      de `propertyId`, e a ordem das guardas — (1) sem `propertyId` → `null` sem tocar a rede,
      (2) sem `GOOGLE_SERVICE_ACCOUNT_JSON` → `{ erro: "GOOGLE_SERVICE_ACCOUNT_JSON ausente" }`
      **o nome, nunca o valor**, (3) qualquer exceção → `{ erro: code ou 60 chars }`. Zero regra,
      zero log, `linhas: []` quando a resposta não traz `rows` (FR-004, FR-008, FR-013, Princípio V)
- [X] T005 Adicionar `ga4` ao retorno de `coletarDoProjeto()` em `lib/okr-coleta.ts`, obtido de
      `p.ga4?.propertyId` e chamado **dentro do mesmo `Promise.all` do GSC**, sem alterar nenhum dos
      seis campos atuais (`contracts/ga4-leitura.md` → Integração; depende de T003 e T004)

**Checkpoint**: `coletarDoProjeto()` entrega `LeituraGa4` (ou `null`) sem que nada na tela mude.

---

## Phase 3: User Story 1 - Ver o topo do funil por canal, com a fonte de cada parcela (Priority: P1) 🎯 MVP

**Goal**: os cinco canais que hoje imprimem a mesma frase passam a trazer número e procedência
quando o projeto tem GA4 configurado, e continuam `não apurado` — nunca `0` — quando não tem.

**Independent Test**: configurar `ga4` só na `atma` e conferir que os canais dela saem com número e
fonte, enquanto os outros 34 projetos saem byte a byte como hoje (quickstart §2 e §3).

### Tests for User Story 1

> Escrever antes da implementação e conferir que FALHAM.

- [X] T006 [US1] Asserções de `mapearCanaisGa4()` em `test/ficha.test.mjs`, uma por garantia do
      `contracts/n4-canais.md`: quatro chaves sempre presentes com `0` quando o grupo não veio;
      `Organic Search` nunca em `porCanal` e sempre em `organicoIgnorado`; grupo desconhecido inteiro
      em `foraDoCatalogo` com o nome preservado; `sessoes` não numérico ou negativo tratado como
      desconhecido e **não** como `0`; `[]` devolve função total
- [X] T007 [US1] Asserções da tabela de decisão de `montarN4()` em `test/ficha.test.mjs`, uma linha
      por situação — `ga4` `null`/`undefined`, `{erro}`, `{linhas: []}`, `{linhas:[...]}` — mais as
      duas colunas constantes: `organico` idêntico nas quatro situações (SC-008) e `outbound` sempre
      `não apurado` nomeando que a fonte não o distingue (D3)
- [X] T008 [US1] Asserção de compatibilidade em `test/ficha.test.mjs`: `montarN4()` chamado com
      **três** argumentos continua produzindo o resultado de hoje, o que mantém verdes as asserções
      já existentes no arquivo (FR-007, SC-004)

### Implementation for User Story 1

- [X] T009 [US1] Exportar a constante `GRUPOS_GA4` e implementar `mapearCanaisGa4(linhas)` em
      `lib/ficha.mjs`, junto do bloco `── N4 ──` (mapa do `contracts/n4-canais.md`; `outbound` NÃO
      aparece no mapa, de propósito)
- [X] T010 [US1] Estender `montarN4(canais, cliquesCelula, marcos, ga4, janela)` em `lib/ficha.mjs`
      (hoje na linha 207): o ramo `organico` fica **intocado**, os quatro canais do GA4 passam a ler
      `mapearCanaisGa4()`, e `outbound` recebe `não apurado` · `a fonte GA4 não distingue prospecção
      ativa` · consultar `apuração manual de outbound`. Motivos distintos por situação conforme
      data-model §3: `sem propriedade GA4 configurada para este projeto` × `fonte GA4 indisponível
      (<erro>)` (FR-001, FR-003, FR-004, FR-005, FR-005a)
- [X] T011 [US1] Passar `ga4` e a janela declarada (R7) no chamador de `montarN4()` em
      `lib/ficha.mjs` (hoje linha 344), sem alterar o argumento `cliquesCelula` (depende de T005)
- [ ] T012 [US1] Adicionar `"ga4": { "propertyId": "..." }` ao card da `atma` em
      `data/projects.json` — curadoria, não segredo (T002 fornece o número)
- [X] T013 [US1] Conferir em `app/okr/[slug]/page.tsx` que `<Cel>` já imprime `fonte` na mesma linha
      de toda célula `apurado` (FR-002, SC-002). Só mexer se não imprimir

**Checkpoint**: `npm test` verde; ficha da `atma` com 5 canais apurados (SC-001 pede ≥ 4) e 34
projetos inalterados.

---

## Phase 4: User Story 2 - Somar sem contar duas vezes (Priority: P1)

**Goal**: o N4 ganha total composto, rótulo de composição e a nota que separa esse total do
`visitante` da cadeia — sem que nenhuma taxa do N3 mude de valor.

**Independent Test**: para a `atma`, somar as parcelas por procedência e conferir que cada canal
aparece uma única vez, que o total é rotulado como composto e que o N3 saiu idêntico (quickstart §3).

### Tests for User Story 2

- [X] T014 [US2] Asserção da guarda de janela em `test/ficha.test.mjs`: `ga4.janela` diferente da
      janela da cadeia → os quatro canais do GA4 saem `não apurado` nomeando `janela do GA4 (a→b)
      difere da janela da cadeia (c→d)`, e o `organico` continua intocado (FR-006, D8)
- [X] T015 [US2] Asserções de `montarN4Nivel(canais, extras)` em `test/ficha.test.mjs`: total
      composto soma **só** células `apurado` e sai `não apurado` quando nenhuma é; rótulo declara a
      cobertura e nunca o nome de uma grandeza só; `fonte` do total é a junção das fontes das
      parcelas; `diferença` permanece `não apurado` nomeando **quais** canais faltam enquanto houver
      canal sem fonte; `fora do catálogo` só aparece com volume, lista grupo e valor, e **não** entra
      no total (FR-005b, FR-009, FR-012, D7)

### Implementation for User Story 2

- [X] T016 [US2] Implementar a guarda de janela dentro de `montarN4()` em `lib/ficha.mjs`: quando
      `ga4.janela` não bate com a janela da cadeia, os canais do GA4 caem em `não apurado` sem tocar
      no `organico` (FR-006)
- [X] T017 [US2] Reescrever `montarN4Nivel(canais, extras)` em `lib/ficha.mjs` (hoje linha 482) para
      devolver `{ celulas, nota }` na ordem das 10 células do data-model §4, incluindo o total
      composto, o `fora do catálogo` e a `diferença` nomeando os canais sem fonte
- [X] T018 [US2] Montar a `nota` do nível em `montarN4Nivel()` com a frase da FR-005d
      (data-model §4), acrescida de `sessões orgânicas do GA4 ignoradas: N` quando
      `organicoIgnorado > 0` (FR-005a, FR-005c)
- [X] T019 [US2] Passar `extras` (`foraDoCatalogo`, `propriedade`, `organicoIgnorado`) no chamador
      `nivel("N4", montarN4Nivel(canais))` de `lib/ficha.mjs` (hoje linha 352), sem que nada disso
      alcance `montarFicha()`, `posicaoDeAtaque()`, `projetar()` ou `segmentosDoFunil()` (SC-010)
- [X] T020 [US2] Imprimir a `nota` uma vez abaixo do `<h2>` de N4 em `app/okr/[slug]/page.tsx`,
      mantendo `agruparPorMotivo()` restrito a `nao-apurado` (FR-005d)

**Checkpoint**: total composto na tela, rotulado; toda taxa do N3 idêntica à de antes (SC-010).

---

## Phase 5: User Story 3 - Enxergar o lead que chega por WhatsApp, rotulado como inferência (Priority: P2)

**Goal**: o volume que chega fora do formulário ganha linha própria marcada como inferência, visível
e fora de toda conta da cadeia.

**Independent Test**: abrir a ficha da `atma` e verificar que a linha aparece marcada como
inferência e que nenhuma taxa mudou de valor por causa dela (quickstart §5).

### Tests for User Story 3

- [X] T021 [US3] Asserções de `inferida(valor, {de, divida, rotulo})` em `test/ficha.test.mjs`:
      devolve `{estado:"inferido", valor, rotulo, de, divida}` e **lança** quando `de` ou `divida`
      são vazios — mesma régua de `naoApurada()`, que exige `consultar`
- [X] T022 [US3] Asserções dos invariantes do data-model §1 em `test/ficha.test.mjs`: célula
      `inferido` não entra no total composto de `montarN4Nivel()`, não é canal, e um KR apontando
      para ela continua saindo `chave-invalida` em `validarKrs()` (FR-011, SC-009)

### Implementation for User Story 3

- [X] T023 [US3] Adicionar o construtor `inferida()` e o JSDoc de `CelulaInferida` em
      `lib/ficha.mjs`, sem alterar `estadoDeApurado()`, `declarada()`, `naoApurada()` nem
      `combinar()` (data-model §1)
- [X] T024 [US3] Adicionar `orcamentosSemLead: { valor:number } | null` ao retorno de
      `coletarDoProjeto()` em `lib/okr-coleta.ts`, contando as linhas de `orcamentos` na janela com
      `paciente_lead_id` nulo — a coluna **já vem** no `SELECT` de `FONTES_PROPRIAS.atma` e hoje é
      descartada (R4, D6). `null` quando não há fonte de orçamento; `null` nunca vira `0`
- [X] T025 [US3] Alimentar `extras.inferencias` de `montarN4Nivel()` a partir de
      `orcamentosSemLead` em `lib/ficha.mjs`, com `rotulo: "contato fora do formulário"`,
      `de: "orçamento sem lead vinculado"` e a `divida` da FR-011b escrita na própria célula
      (depende de T017 e T024)
- [X] T026 [US3] Adicionar `"inferido"` à união `CelulaFicha` e o ramo correspondente em `<Cel>` de
      `app/okr/[slug]/page.tsx` — valor em destaque, `inferido de {de}` e a dívida em `.foot`,
      visualmente distinto de `apurado`; garantir que `agruparPorMotivo()` continua ignorando a
      célula inferida para que o número não desapareça dentro de um `<summary>` (FR-011, SC-007)
- [X] T027 [US3] Marca visual da célula inferida em `app/globals.css`, no corte-seco da casa
      (raio 0, sombra 0), distinta da célula apurada

**Checkpoint**: linha de inferência visível na `atma`; removê-la não muda taxa nenhuma (SC-009).

---

## Phase 6: Polish & Cross-Cutting

- [X] T028 Rodar `npm test` e conferir a suíte inteira verde, incluindo as asserções antigas de
      `test/ficha.test.mjs` que não foram tocadas (quickstart §1)
- [ ] T029 Executar quickstart §2 — projeto **sem** GA4: N3 e N4 idênticos byte a byte aos de antes
      da mudança (SC-004, SC-010) e canal orgânico idêntico em todos (SC-008)
- [ ] T030 Executar quickstart §4 — GA4 fora do ar (`propertyId` inválido ou credencial sem acesso):
      toda ficha continua abrindo e o número orgânico continua exibido (SC-006, FR-008)
- [ ] T031 Executar quickstart §6 — varredura dos 35 projetos conferindo que nenhum canal sem fonte
      exibe `0` (SC-003)
- [X] T032 Conferir que `GOOGLE_SERVICE_ACCOUNT_JSON` e o `propertyId` não aparecem em log, erro ou
      resposta — `grep` por `console.` em `lib/ga4.ts` deve sair vazio (FR-013, Princípio V)
- [X] T033 Registrar a dívida da FR-011b (instrumentar a origem do contato) onde ela fica
      encontrável: na `divida` da própria célula inferida e na seção "Fora de escopo" da spec, que
      já a documenta — conferir que a linha da ficha aponta o motivo, e não o silêncio (SC-007)
- [ ] T034 Push e conferência no **HTML servido pelo EasyPanel**, nunca `next dev` (quickstart §7).
      Push fora de 23:30–01:00 e 08:00–08:45 BRT (Princípio IV)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sem dependências
- **Foundational (Fase 2)**: depende do Setup — **bloqueia US1 e US2**; NÃO bloqueia US3
- **US1 (Fase 3)**: depende da Fase 2
- **US2 (Fase 4)**: depende de US1 (T016 e T019 mexem no que T010 e T011 criaram)
- **US3 (Fase 5)**: independente de US1/US2 até T025, que depende de T017 (US2)
- **Polish (Fase 6)**: depende das histórias entregues

### User Story Dependencies

- **US1 (P1)**: primeira. É o MVP.
- **US2 (P1)**: sequencial a US1 — mesmo arquivo, mesma função (`montarN4`/`montarN4Nivel`).
- **US3 (P2)**: pode ser desenvolvida em paralelo a US1/US2 até T025; a integração final espera T017.
- **Nenhuma história toca o N3.** O total composto não vira denominador (FR-005c).

### Within Each User Story

- Testes escritos e FALHANDO antes da implementação
- Camada pura (`lib/ficha.mjs`) antes da borda de render (`page.tsx`)
- Borda de rede (`lib/ga4.ts`) e coleta antes da regra que a consome

### Parallel Opportunities

- **T003 e T004** em paralelo: `lib/projects.ts` e `lib/ga4.ts` são arquivos disjuntos.
- **US3 (T021, T023, T024, T026, T027)** pode correr em paralelo a US1/US2: toca
  `lib/okr-coleta.ts` (campo diferente), `app/globals.css` e um ramo de `<Cel>` — nenhum conflito
  com `montarN4()`.
- **Dentro de US1 e US2 não há [P]**: quase tudo mora em `lib/ficha.mjs` e `test/ficha.test.mjs`.
  Marcar paralelo aí seria convidar conflito no mesmo arquivo.

```bash
# Fase 2, os dois arquivos independentes ao mesmo tempo:
Task: "Adicionar campo ga4 ao tipo Project em lib/projects.ts"
Task: "Criar lib/ga4.ts com ga4Canais() conforme contracts/ga4-leitura.md"
```

---

## Implementation Strategy

### MVP (US1 apenas)

1. Fase 1 (Setup) → Fase 2 (Foundational) → Fase 3 (US1)
2. **PARAR E VALIDAR**: quickstart §2 e §3 — `atma` com canais apurados, 34 projetos idênticos
3. Já entrega o valor central: cinco linhas que diziam a mesma frase passam a dizer número e fonte

### Entrega incremental

1. Setup + Foundational → base pronta, tela inalterada
2. + US1 → canais apurados com procedência → **MVP, deployável**
3. + US2 → total composto rotulado + nota do nível → deployável
4. + US3 → inferência do WhatsApp visível → deployável

Cada degrau é conferível pelo quickstart e nenhum deles muda número que já estava na tela.

---

## Notes

- **A cadeia não muda em tarefa nenhuma.** Se alguma tarefa acabar alterando `montarFicha()`,
  `posicaoDeAtaque()`, `projetar()` ou `segmentosDoFunil()`, ela saiu do escopo (FR-005c, SC-010).
- **A célula do `organico` é intocável.** Nenhum caminho de `montarN4()` pode ler `ga4` para
  produzi-la (FR-005a, SC-008) — T007 existe para reprovar isso.
- `0` e `não apurado` são coisas diferentes em toda tarefa desta lista. É a R1, e é o defeito
  central que a feature combate.
- Commit por tarefa ou por grupo lógico; parar em qualquer checkpoint deixa a tela consistente.
