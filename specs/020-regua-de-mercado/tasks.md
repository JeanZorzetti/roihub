# Tasks: 020 — a régua de mercado da Atma

**Input**: design docs em `/specs/020-regua-de-mercado/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Testes: SIM, obrigatórios.** Não por opção — o Princípio II da constituição é não-negociável e o
`contracts/regua.md §5` define as travas 6 a 9 como **executáveis**. Trava que pede boa-fé é o que a
R6 já tentou e não segurou.

---

## Contexto que muda como estas tarefas devem ser lidas

A Fase 0 já rodou. **O resultado dela governa tudo abaixo**:

> Seis vereditos pesquisados. **Uma** linha publicável, e ela é de aquisição — cuja exibição a D2
> mandou para a 022. A cadeia de Conversão da Atma fica com **três recusas e zero linhas**.

Ninguém deve implementar isto esperando ver faixas aparecerem na ficha da Atma. **Não vão.** O que
aparece é o **motivo específico** de cada ausência, no lugar da frase genérica de hoje. Se ao final a
ficha mostrar uma faixa comparativa na cadeia de Conversão, **alguém inventou um número** — e é
exatamente o defeito que esta spec existe para apagar.

---

## Formato

`- [ ] [TaskID] [P?] [Story?] Descrição com caminho de arquivo`

- **[P]** = paralelizável (arquivo diferente, sem dependência pendente)
- **[US1] / [US2] / [US3]** = a história a que a tarefa pertence
- Sem rótulo de história = Setup, Foundational ou Polish

**Caminhos**: `roihub/` é `C:\Users\jeanz\OneDrive\Desktop\ROI Labs\roihub`. `atma/` é `C:\dev\atma`
— **repositório diferente, deploy diferente**.

---

## Phase 1: Setup — a linha de base, antes de qualquer edição

⚠️ **A primeira corrida de um check novo mede o check, não o sistema.** Estas duas tarefas existem
para que as SC tenham contra o que comparar depois.

- [X] T001 Registrar a linha de base da SC-001a rodando `leituraDoDegrau("D", …)` nos três degraus da cadeia hoje e transcrever os `motivo` devolvidos em `specs/020-regua-de-mercado/tasks.md` (esta seção), confirmando que os três são **idênticos** — é a frase genérica que a spec substitui
- [X] T002 [P] Confirmar a linha de base da SC-004 rodando o script do Passo 6 de `specs/020-regua-de-mercado/quickstart.md` contra `ATMA_DATABASE_URL` e anotando a contagem de linhas sem fonte verificável (esperado: **12 de 12**)

> **Já medido em 06/09/2026, antes de qualquer edição** — repetir só se a base tiver mudado:
> `market_benchmarks` = 12 linhas, 12/12 com `source = "A definir - aguardando pesquisa de mercado"`,
> `created_at` uniforme em `2026-07-30T20:41:59.826Z`. `REGUA.D` = **0 entradas**.
> Transcrição íntegra em `contracts/market-benchmarks-antes.md`.

---

## Phase 2: Foundational — o shape, que bloqueia todo o resto

**Bloqueante**: nenhuma história pode começar antes. `Linha` e `Recusa` são o vocabulário que as três
usam.

- [X] T003 Estender o typedef `Linha` em `roihub/lib/benchmark.mjs` com `url`, `acessadoEm` e `recorte`, marcando no próprio typedef que os três são **obrigatórios em linha nova** e ausentes nas 7 legadas (FR-002, FR-002a, FR-003)
- [X] T004 Criar o typedef `Recusa` em `roihub/lib/benchmark.mjs` — `{ recusa: { motivo, descartadas?: [{ fonte, url?, numero, porQue }] } }` — e documentar no comentário que `Linha` e `Recusa` são **mutuamente exclusivas** na mesma chave (FR-001a)
- [X] T005 Adicionar o passo 2 da ordem de avaliação em `leituraDoDegrau()` de `roihub/lib/benchmark.mjs`: entrada com `recusa` devolve `{ rotulo: "sem régua", motivo: recusa.motivo, descartadas }`, **antes** da checagem de par apurado, com o comentário explicando por quê (se o mercado não publica o degrau, mandar o leitor apurar algo já apurado é ruído) — ver `contracts/regua.md §1`
- [X] T006 Garantir em `faixaDoSpan()` de `roihub/lib/benchmark.mjs` que uma entrada com `recusa` devolve `null`, igual a chave ausente — recusa vazando como faixa faria a árvore de metas (016) projetar contra faixa inexistente

**Checkpoint**: `npm test` verde. Nada mudou de comportamento ainda — `REGUA.D` continua vazia.

---

## Phase 3: US1 — o degrau ruim vira degrau ruim comparado a quê (P1) 🎯 MVP

**Meta**: cada degrau da cadeia de Conversão da Atma carrega faixa com fonte clicável **ou** o motivo
específico da ausência. Nenhum fica em branco e nenhum repete a frase do vizinho.

**Teste independente**: abrir `/okr/atma` e, para os três degraus, apontar faixa+link ou motivo
escrito. Os três motivos têm de ser **diferentes entre si**.

### Testes primeiro (as travas de `contracts/regua.md §5`)

- [X] T007 [P] [US1] Escrever em `roihub/test/benchmark.test.mjs` a **trava 7**: duas recusas não podem ter o mesmo `motivo` — percorre `REGUA`, coleta todo `recusa.motivo` e falha se houver repetição (SC-001a)
- [X] T008 [P] [US1] Escrever em `roihub/test/benchmark.test.mjs` a **trava 8**: uma entrada com `recusa` não pode ter `media` nem `elite` — `Linha` e `Recusa` são mutuamente exclusivas
- [X] T009 [P] [US1] Escrever em `roihub/test/benchmark.test.mjs` a **trava 6**: toda linha **nova** (não-recusa, fora da lista nomeada de 7 legadas) tem `url` e `acessadoEm` não vazios — a lista das 7 vem de `data-model.md §1` e é literal no teste, para que uma legada nova não passe despercebida
- [X] T010 [P] [US1] Escrever em `roihub/test/benchmark.test.mjs` a **trava 9**: `faixaDoSpan()` sobre uma chave com `recusa` devolve `null`
- [X] T011 [US1] **Estender** o teste existente `"degrau sem linha devolve 'sem régua' MESMO com os dois lados apurados"` em `roihub/test/benchmark.test.mjs` para afirmar o `motivo` **específico** de `lead→respondeu` ⚠️ **Sem isto o teste continua verde testando nada** — ele usava `lead→respondeu` justamente por não haver entrada, e a T012 cria uma

### Implementação

- [X] T012 [US1] Adicionar a recusa de `lead→respondeu` em `REGUA.D` de `roihub/lib/benchmark.mjs`, com `motivo` e as fontes descartadas (Salesforce MQL→SQL 13%; RevenueHero mediana 62%; Cognism reply 1–5%) e o porquê de cada — conteúdo em `research.md §D1`
- [X] T013 [US1] Adicionar a recusa de `respondeu→orcamento` em `REGUA.D` de `roihub/lib/benchmark.mjs`, citando *quote-to-close* como o degrau **seguinte** e a triagem não padronizada — `research.md §D2`
- [X] T014 [US1] Adicionar a recusa de `orcamento→tratamento` em `REGUA.D` de `roihub/lib/benchmark.mjs`, com as **duas fontes descartadas e seus números** (Henry Schein One 45%/75% + URL; Gaidge/Planet DDS 64–68%/80%+ via Orthia) e a razão: medem aceite **pós-consulta presencial** e a Atma não tem consulta — `research.md §D3`
- [X] T015 [US1] Alterar o branch de ausência de régua em `roihub/app/okr/[slug]/page.tsx`: quando não houver `destaque` mas houver recusa com motivo, nomear o degrau e mostrar o motivo dele; **em UMA linha** ⚠️ a 019 mediu 801px a 1280×800 com três linhas de prosa — 1px abaixo da dobra. Trocar o texto, **nunca acrescentar linha**
- [X] T016 [US1] Escolher qual recusa aparece, em `distanciaDoMercado()` de `roihub/lib/benchmark.mjs` (campo `recusaEmDestaque`): a marcada como **`armadilha`**; empate ou nenhuma, a primeira da cadeia 🔁 **regra corrigida durante a implementação** — o rascunho dizia "a mais alto da cadeia" (§7.1) e teria mostrado `lead→respondeu`, cujas descartadas são métricas de B2B SaaS que nenhum dono de clínica encontra. A §7.1 responde "qual degrau consertar"; aqui a pergunta é "qual ausência calada faz o leitor buscar o número errado" — e é `orçamento→tratamento`, porque "case acceptance rate" devolve 45% no primeiro resultado do Google. Registrado em `contracts/regua.md §4`
- [X] T017 [US1] Garantir em `roihub/app/okr/[slug]/page.tsx` que projeto **sem** recusa com motivo continua caindo no texto genérico de hoje, inalterado — a mudança é da Atma, não dos outros 34

**Checkpoint US1**: `npm test` verde; `/okr/atma` mostra o motivo de `orçamento → tratamento` em uma
linha; os outros projetos inalterados. **Entrega sozinha.**

---

## Phase 4: US2 — trocar o veredito falso pelo verdadeiro (P2)

⚠️ **Depende da US1**: a FR-013a exige que a Atma cite **a mesma** faixa, URL e data que o roihub.
Escrever a Atma antes seria criar a segunda fonte da verdade que a FR-013a existe para impedir.

⚠️ **Repositório diferente** (`C:\dev\atma`), convenções, testes e deploy próprios. A constituição do
roihub não governa lá.

**Teste independente**: abrir `/admin/benchmark-mercado` — nenhuma linha com `source` "A definir",
toda linha exibida abre numa URL, e a tela não quebra.

- [X] T018 [US2] Criar `atma/backend/migrations/0NN_regua_pesquisada.sql` com `ALTER TABLE market_benchmarks ALTER COLUMN metric_value DROP NOT NULL` — confirmado `NOT NULL` no `information_schema` em 06/09; a recusa precisa de `NULL`, e sentinela (`-1`, `0`) seria lido como medida pelo próximo consumidor (`data-model.md §4`)
- [X] T019 [US2] Na mesma migration, `DELETE` das 12 linhas atuais — a transcrição íntegra e o SQL de reversão já estão em `specs/020-regua-de-mercado/contracts/market-benchmarks-antes.md` (FR-015)
- [X] T020 [US2] Na mesma migration, `INSERT` dos seis vereditos com `source` contendo a **URL** e a data de acesso, copiados de `REGUA.D` e de `research.md` — recusa entra com `metric_value NULL` e o motivo em `description` (FR-013, FR-013a)
- [X] T021 [US2] Confirmar na migration que **nenhum** dos 7 `metric_key` de degrau que a Atma não tem volta: `cadastro_to_agendamento`, `agendamento_to_comparecimento`, `comparecimento_to_conversao`, `taxa_cancelamento`, `tempo_medio_funil`, `bounce_rate`, `cac_medio` (FR-014)
- [X] T022 [US2] Implementar a guarda de escrita em `atma/backend/src/routes/marketBenchmarks.js` — `PUT /:id` e `POST /bulk-update` recusam com `400` quando `source` está vazio, contém "A definir" (sem diferenciar maiúsculas) ou não tem `http://`/`https://`; a resposta diz **qual regra** falhou e nunca ecoa valor de ambiente (`contracts/regua.md §6`, Princípio V)
- [X] T023 [P] [US2] Ajustar `atma/admin/src/app/admin/benchmark-mercado/page.tsx` para não quebrar com `metric_value NULL`: linha de recusa mostra o motivo em vez de comparação, e `generateComparisons()` **pula** linha sem valor em vez de comparar contra `null`
- [X] T024 [P] [US2] Ajustar `atma/admin/src/components/benchmark-editor.tsx` para o mesmo — editar linha sem valor não pode gravar `NaN`, e a UI mostra a fonte como link
- [ ] T025 [US2] Rodar a migration contra `ATMA_DATABASE_URL` e validar com o Passo 6 de `specs/020-regua-de-mercado/quickstart.md` — esperado **0** linhas sem fonte verificável, contra a base de 12

**Checkpoint US2**: Passo 6, 7 e 8 do quickstart passam. `/admin/benchmark-mercado` carrega e não
compara contra número inventado.

---

## Phase 5: US3 — a pesquisa de aquisição, sem a tela (P3)

**Meta**: os três degraus de aquisição têm veredito registrado, datado e achável — e **nenhuma tela
muda**.

**Teste independente**: achar os três vereditos em `research.md`, cada um com fonte clicável ou motivo
de recusa. Nenhuma tela de aquisição alterada.

- [X] T026 [P] [US3] Verificar que `research.md §D4` (`impressão→clique`, condicional, AWR) está completo com URL, data de acesso e as **duas armadilhas** registradas — navboost sem número de saúde, e o relatório trimestral da AWR publicando variação em pp, não CTR absoluto
- [X] T027 [P] [US3] Verificar que `research.md §D5` (`clique→form_start`) registra a recusa **estrutural** citando a FR-029 da 019 e os números da época (599 cliques GSC × 1.140 sessões GA4) — para que a 022 não a tente de novo
- [X] T028 [P] [US3] Verificar que `research.md §D6` (`form_start→lead`) traz a citação literal da Zuko ("66% of people who start a form successfully complete it"), a corroboração FormAssembly (68% / 1,6 bi de interações) e a **pendência honesta** de não haver número de elite verificado
- [X] T029 [US3] Confirmar que **nenhuma** das três entrou em `REGUA.D` de `roihub/lib/benchmark.mjs` — não há marcos para essas chaves, e criar marco fantasma é o defeito que a 017 matou (D2)
- [X] T030 [US3] Confirmar que `roihub/app/okr/[slug]/aquisicao/page.tsx` está **inalterado** por esta spec — `git diff` limpo nesse arquivo

---

## Phase 6: Polish & Cross-Cutting

- [X] T031 [P] Substituir em `roihub/lib/benchmark.mjs` o comentário que afirma *"nenhum publica benchmark para esses degraus"* pelo resultado **provado**, com link e data — a afirmação estava certa, e agora está verificada em vez de suposta (FR-016)
- [X] T032 [P] Reavaliar em `roihub/lib/benchmark.mjs` as duas citações órfãs guardadas pela 018 (`visitante→lead` via PatientGain/Runner Agency; `lead→contatado` via InfluxMD): nenhuma vira linha — `visitante` saiu da cadeia D e InfluxMD mede *agendamento*, degrau que a Atma não tem — e a recusa fica escrita ao lado delas (FR-017)
- [X] T033 [P] Registrar em `roihub/handoff/okr-regua-de-mercado.md` a dívida da FR-002a, **nomeando as 7 linhas legadas**: `A: visitante→signup`, `A: trial→cobranca`, `B: produto→carrinho`, `B: carrinho→checkout`, `B: checkout→pago`, `C: conversa→proposta`, `C: proposta→contrato` — fonte por nome de veículo, sem URL nem data
- [X] T034 Rodar `npm test` inteiro em `roihub/` e confirmar verde, com contagem de testes **maior** que antes (travas 6 a 9 + a extensão da T011)
- [X] T035 Rodar os 9 passos de `specs/020-regua-de-mercado/quickstart.md` e registrar o resultado de cada um
- [X] T036 Confirmar a SC-006 — nenhum número apurado mudou: cadeia `52 → 21 → 4 → 0`, ticket R$ 4.932,34, janela `2026-07-31 → 2026-09-05`, `98% contatados (declarado)`
- [X] T037 Medir a dobra a 1280×800 e confirmar que *"o que fazer"* continua **acima de 800px** — a 019 mediu 801px com três linhas de prosa, e é a margem real
- [ ] T038 Commit e push em `roihub/`, **fora** das janelas 23:30–01:00 e 08:00–08:45 BRT (Princípio IV)
- [ ] T039 Esperar ~15 min e conferir a tela no ar **duas** vezes, procurando a string `"consulta presencial"`, que só existe na versão nova ⚠️ uma checagem única 14 min após o push já "provou" uma conclusão errada na auditoria da 018
- [X] T040 Escrever `roihub/handoff/handoff-020-regua-de-mercado.md` com o resultado da pesquisa, o que ficou para a 022 (exibição de aquisição) e o que ficou para a spec da dívida das 7 legadas

---

## Dependências

```
Phase 1 (T001-T002)  ──►  Phase 2 (T003-T006)  ──┬──►  Phase 3 · US1 (T007-T017)  ──►  Phase 4 · US2 (T018-T025)
                                                  │                                       ▲
                                                  └──►  Phase 5 · US3 (T026-T030)         │
                                                                                          │
                                          US2 depende de US1 (FR-013a: mesma régua) ──────┘

Phase 6 (T031-T040) ──► depois de tudo
```

| história | depende de | entrega sozinha? |
|---|---|---|
| **US1** (P1) | Foundational | ✅ **sim — é o MVP** |
| **US2** (P2) | **US1** (FR-013a copia de `REGUA`) | ❌ não |
| **US3** (P3) | Foundational | ✅ sim (a pesquisa já está feita; são verificações) |

---

## Paralelismo

**Dentro da US1** — as 4 travas são arquivos de teste independentes entre si, mas todas tocam
`test/benchmark.test.mjs`. Escrevê-las juntas em uma passada é mais barato que quatro edições do mesmo
arquivo; o `[P]` marca que **não há dependência lógica**, não que sejam quatro commits.

```
T007, T008, T009, T010  →  mesma passada em test/benchmark.test.mjs
T012, T013, T014        →  mesma passada em lib/benchmark.mjs (as três recusas)
```

**Dentro da US2** — T023 e T024 são arquivos diferentes do admin da Atma e podem ir em paralelo depois
que T018–T022 fecharem.

**Dentro da US3** — T026, T027 e T028 são verificações independentes de seções distintas.

**Phase 6** — T031, T032 e T033 tocam arquivos diferentes.

---

## Estratégia de entrega

**MVP = Phase 1 + Phase 2 + Phase 3 (US1).** Dezessete tarefas, um repositório, um deploy. Entrega
sozinha e satisfaz SC-001, SC-001a, SC-003, SC-005 e SC-006.

**Incremento 2 = Phase 4 (US2).** Atravessa a fronteira do repositório. Fecha a SC-004 (a métrica de
"zero superfícies com veredito sem fonte" só zera com as duas telas).

**Incremento 3 = Phase 5 (US3) + Phase 6.** Verificação e registro. Barato, e é o que impede a
pesquisa de apodrecer antes da 022.

---

## Fora de escopo (não vire tarefa)

| item | onde vive |
|---|---|
| **Exibir** as réguas de aquisição em `/okr/atma/aquisicao` | spec **022** (D2) |
| `status_historico` — velocidade, passagem cumulativa, coorte | spec **021** |
| Re-verificar as 7 linhas legadas de A/B/C com URL | spec futura (FR-002a, dívida registrada na T033) |
| Mudar cadeia canônica, marcos, janelas ou número apurado | proibido (FR-018) |
| Achar o número de elite de `form_start→lead` | spec **022** — está registrado como pendência em `research.md §D6` |
| Consertar outras telas do admin da Atma | só `/admin/benchmark-mercado`, e só o que depende de `market_benchmarks` |
