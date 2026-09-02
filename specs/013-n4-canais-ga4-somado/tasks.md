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
- [X] T002 Pré-requisito operacional (fora do código): adicionar a conta de serviço de
      `GOOGLE_SERVICE_ACCOUNT_JSON` como **Visualizador** na propriedade GA4 da `atma` e anotar o
      `propertyId`, conforme `specs/013-n4-canais-ga4-somado/quickstart.md` §0. Sem isso a API
      devolve 403 e os quatro canais saem `não apurado` — comportamento correto, não regressão
      — **fechado em 02/09/2026**: Data API habilitada por API (a própria conta tem
      `serviceUsageAdmin`, `serviceusage…:enable` dispensa console) e acesso de Visualizador
      concedido na propriedade `504053080`. Ver "Fechamento do T002" no fim deste arquivo

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
- [X] T012 [US1] Adicionar `"ga4": { "propertyId": "..." }` ao card da `atma` em
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
- [~] T029 Executar quickstart §2 — projeto **sem** GA4: N3 e N4 idênticos byte a byte aos de antes
      da mudança (SC-004, SC-010) e canal orgânico idêntico em todos (SC-008)
      — **NÃO EXECUTÁVEL, encerrado por substituição**: o retrato do "antes" só existia antes do
      primeiro deploy e não foi tirado. O que a SC-004/SC-010 realmente mede (valores, não markup)
      foi provado por outros três caminhos — ver "T029 — o que foi provado" no fim deste arquivo.
      `[~]` = encerrado sem execução, deliberadamente. **Não reabrir para reconstruir.**
- [X] T030 Executar quickstart §4 — GA4 fora do ar (`propertyId` inválido ou credencial sem acesso):
      toda ficha continua abrindo e o número orgânico continua exibido (SC-006, FR-008)
- [X] T031 Executar quickstart §6 — varredura dos 35 projetos conferindo que nenhum canal sem fonte
      exibe `0` (SC-003)
- [X] T032 Conferir que `GOOGLE_SERVICE_ACCOUNT_JSON` e o `propertyId` não aparecem em log, erro ou
      resposta — `grep` por `console.` em `lib/ga4.ts` deve sair vazio (FR-013, Princípio V)
- [X] T033 Registrar a dívida da FR-011b (instrumentar a origem do contato) onde ela fica
      encontrável: na `divida` da própria célula inferida e na seção "Fora de escopo" da spec, que
      já a documenta — conferir que a linha da ficha aponta o motivo, e não o silêncio (SC-007)
- [X] T034 Push e conferência no **HTML servido pelo EasyPanel**, nunca `next dev` (quickstart §7).
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

---

## Conferência ao vivo — 02/09/2026, HTML servido pelo EasyPanel

Feita com `curl -su "$HUB_USER:$HUB_PASS"` contra `hub.roilabs.com.br`, nunca `next dev`.

| Item | Resultado |
|---|---|
| **SC-006** — toda ficha abre | 17/17 projetos com `perfil` responderam **200** |
| **SC-003** — nenhum canal sem fonte exibe `0` | **zero** ocorrências de número em `Direto/Pago/Indicação/Outbound/Social` nos 17 |
| Detector da varredura auto-validado | acha número onde ele existe (`orgânico` 525 atma, 55 sirius, 29 polarisia, 24 estetiacrm) — não é falso negativo |
| **FR-005b** — total composto rotulado | `total composto (orgânico)` · fonte `Search Console` — cobertura declarada, nunca "sessões" |
| **FR-005d** — nota do nível | impressa uma vez abaixo do `<h2>` de N4 |
| Motivos distintos por situação | `sem propriedade GA4 configurada para este projeto` (4 canais) × `a fonte GA4 não distingue prospecção ativa` (outbound) |

### Defeito encontrado e corrigido na conferência

A ficha da `atma` imprimia `contato fora do formulário: 0 inferido`. Medido no banco
(`ATMA_DATABASE_URL`): os **2** orçamentos com `paciente_lead_id` nulo são de **01/09**, e a janela
da cadeia é **03/08 → 30/08** (D-3). Estão fora da janela — o `0` era aritmeticamente correto e
enganoso do mesmo jeito. Corrigido para a célula só existir com volume, como o data-model §4
(célula 10) já mandava: *"só quando o vestígio existe"*. Régua nova em `test/ficha.test.mjs`.

**Consequência para a leitura da Atma**: o canal novo (contato direto por WhatsApp) começou a
aparecer no banco **depois** do fim da janela atual. Ele entra na ficha sozinho conforme a janela
desliza — não é ausência de vestígio, é vestígio recente demais para a janela declarada.

### T012 e T030 fechados — 02/09/2026

`propertyId` da Atma curado: **`properties/504053080`** (confirmado no admin do GA4). Com a Data API
ainda desabilitada, isso executou o **quickstart §4 com dado real**, não simulado:

| Conferência §4 | Resultado no HTML servido |
|---|---|
| a página abre | **200** |
| o número orgânico continua lá, mesmo valor | `orgânico 525 (Search Console)` |
| os 4 canais dizem `não apurado` nomeando a falha, nenhum `0` | `fonte GA4 indisponível (403)` · consultar `GA4 Data API` |
| a mensagem não carrega credencial | varredura por `private_key`/`client_email`/`gserviceaccount`/nome da env: **nenhuma ocorrência** |

O motivo na tela mudou de `sem propriedade GA4 configurada para este projeto` para `fonte GA4
indisponível (403)` — as três situações da FR-010 produzindo três textos distintos, ao vivo.

**Quando a API for habilitada, os canais acendem sem novo deploy**: a rota é `force-dynamic` e a
leitura acontece por requisição (D4).

### Fechamento do T002 (02/09/2026) — os canais acenderam

Os três passos fecharam. Registro do que cada um exigiu, porque os 403 se parecem:

1. **Habilitar a Data API não precisou de console nem `gcloud`.** A própria conta de serviço tem
   `serviceUsageAdmin` no projeto: `POST serviceusage.googleapis.com/v1/projects/845396101677/`
   `services/analyticsdata.googleapis.com:enable` (escopo `cloud-platform`) devolveu
   `operations/acat.…` e a API subiu na hora.
2. **O acesso à propriedade é o único passo genuinamente manual.** A Admin API só deixa criar
   `accessBinding` quem já é admin *daquela* propriedade — a conta não enxergava nenhuma, logo não
   podia se auto-adicionar. Feito à mão em *GA4 → Administrador → Acesso à propriedade*.
3. `propertyId` já estava curado no card.

**Como saber em qual passo se está**: o 403 do passo 1 diz `has not been used in project …`; o do
passo 2 diz `User does not have sufficient permissions for this property`. Só o texto separa.

**Conferência no HTML servido pelo EasyPanel** (`curl -u` em `/okr/atma`, sem deploy novo — rota
`force-dynamic`, D4), quickstart §3:

| Item | Resultado |
|---|---|
| canais com número + procedência | **5** apurados: orgânico 525 (Search Console), Direto 130, Pago 0, Indicação 0, Social 6 — os quatro últimos com fonte `GA4 · properties/504053080` (SC-001) |
| `outbound` | segue `não apurado — a fonte GA4 não distingue prospecção ativa` (D3) ✔ |
| total composto | `(orgânico + 4 canais)` = **661**; à mão 525+130+0+0+6 = 661 ✔ |
| fora do catálogo | `AI Assistant 46 · Unassigned 1` = 47, **fora** do total ✔ |
| orgânico do GA4 | `Sessões orgânicas do GA4 ignoradas: 765` — descartado e nomeado (FR-005a, SC-008) ✔ |
| N3 intacto | `visitante → lead 6,67% (35/525)` — denominador continua 525, não 661 (SC-010) ✔ |
| `diferença` | `não apurado — canais sem fonte: outbound` — encolheu de cinco canais para um, e segue não apurada por causa do outbound (FR-012) ✔ |

`Pago 0` e `Indicação 0` são a assimetria do FR-004 funcionando: a fonte foi consultada e respondeu
zero, então o zero é apurado e a linha fica. A janela conferida foi `2026-08-03 → 2026-08-30` (D-30
→ D-3).

### Bloqueio operacional (T002) — histórico, resolvido acima

A conta de serviço é `nimblabs@review-dispute-agent-498311.iam.gserviceaccount.com`. Sondadas as
duas APIs com ela, **antes** do fechamento:

- **GA4 Data API**: `403 — has not been used in project 845396101677 before or it is disabled`
- **GA4 Admin API**: mesmo erro (por isso o `propertyId` não pôde ser descoberto por API)

O screenshot do admin do GA4 traz o **fluxo** (`12127687264`) e o **measurement ID**
(`G-EMCS41DMSP`) — nenhum dos dois é o `propertyId` que a Data API exige. Falta:

1. habilitar **Google Analytics Data API** no projeto GCP `review-dispute-agent-498311`;
2. adicionar a conta de serviço como **Visualizador** na propriedade GA4 da Atma;
3. o **ID da propriedade** (Administrador → Detalhes da propriedade) — ou habilitar também a
   **Admin API**, e aí o número é descoberto sozinho.

### T029 — o que foi provado, e o que não dá mais para provar

O quickstart §2 pede o retrato `/tmp/antes.html` **antes** de tocar no código. Ele não foi tirado, e
o deploy já substituiu o HTML anterior — então o `diff` byte a byte não é mais reconstruível sem
buildar o commit antigo, o que a régua da casa não aceita como conferência (`next dev` não vale).

O que **foi** provado no lugar, e cobre o que a SC-004/SC-010 realmente mede (valores, não markup):

- **N3 idêntico com e sem GA4**, por `assert.deepEqual` das células de N3 em `test/ficha.test.mjs` —
  prova estrutural, mais forte que um diff de uma ficha só porque vale para qualquer entrada.
- **N4 de projeto sem GA4**: os 17 projetos com perfil continuam com `orgânico` apurado (ou não
  apurado onde já era) e os cinco demais canais em `não apurado`, nenhum exibindo `0`.
- **`montarN4()` com três argumentos** (a assinatura de antes) devolve o resultado de antes — T008.

O que **mudou de propósito** no N4, e portanto nunca seria "idêntico": o texto do motivo dos quatro
canais do GA4 (`sem coletor para este canal` → `sem propriedade GA4 configurada para este projeto`),
mais as células novas (total composto, fora do catálogo quando houver, nota do nível). É a feature.

**Lição de processo**: o retrato do "antes" é barato e só existe antes. Tirar por padrão no começo
de qualquer feature que mexa em tela, não quando o quickstart lembra.
