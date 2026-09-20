---
description: "Task list — 031 · a leitura ao vivo da série soma os hosts declarados"
---

# Tasks: A leitura ao vivo da série soma os hosts declarados

**Input**: `specs/031-serie-ao-vivo-soma-hosts/` — [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/leitura-de-serie.md](contracts/leitura-de-serie.md), [quickstart.md](quickstart.md)

**Tests**: SIM, obrigatórios — Princípio II, não-negociável. **Diferença da 030**: nenhum arquivo de
teste novo e nenhuma edição em `package.json`. Os casos entram em `test/gsc-hosts.test.mjs` (reusa o
`clienteFalso` da 030) e `test/serie-soma-hosts.test.mjs`, ambos já registrados.

> ⚠️ **Medido em 19/09/2026: `gscSeries` e `gscTrend` não têm UM teste sequer.**
> `grep -rn "gscSeries\|gscTrend" test/` devolve só um comentário em `arvore-metas.test.mjs:269`.
> Os testes desta feature são a primeira cobertura que essas duas funções já tiveram, e o
> `tsc --noEmit` é o **único** portão que pega um chamador esquecido. Por isso ele é tarefa, não nota
> de rodapé.

**Organização**: por história. A Fase 3 fecha **US1, US2-série e US3-série juntas** e isso é
deliberado — ver o aviso de escopo lá. A Fase 2 é bloqueante e não é scaffolding: é o que a FR-007
cobra.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: US1, US2, US3 — só nas fases de história
- Caminho de arquivo exato em toda tarefa

## Path Conventions

Monolito Next (App Router) na raiz do repo. Lógica pura em `lib/*.mjs`, borda do Google em
`lib/gsc.ts`, testes em `test/*.test.mjs`. **Nenhum arquivo novo em `lib/` nem em `test/`** — ver
plan.md, *Structure Decision*.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: fixar a régua antes de mexer no que ela mede. A Fase 2 é um refator cujo critério de
sucesso é "nada mudou" — sem o número de antes, "nada mudou" é opinião.

- [X] T001 Registrar a linha de base: `npm test` (esperado **1065 testes verdes**) e `npx tsc --noEmit` (esperado **exit 0**, ~7 s). Os dois números são o critério de aceite da Fase 2
- [X] T002 [P] Acrescentar os **cliques somados** à saída do modo `date` de `scripts/conferir-soma-hosts.mjs` (hoje as linhas 114-121 imprimem só impressões). Sem isso a SC-005, que é de cliques, não é conferível à mão — quickstart §4
- [X] T003 Medição **ANTES**, com a testemunha já corrigida: `node --env-file=.env scripts/conferir-soma-hosts.mjs atma <inicio> <fim>` na janela longa que a aba pede. Anotar hosts, dias, impressões e cliques por host. É contra estes números que SC-001, SC-002, SC-004 e SC-005 são medidos depois. Referência de 19/09/2026 na janela 2026-01-17→2026-09-17: 7 dias / 127 impressões / 9 cliques em `usealigner.com`, 244 / 370.432 / 4.541 em `atma.roilabs.com.br`

**Checkpoint**: régua fixada, instrumento calibrado, zero linha de produção tocada.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: o laço de hosts único e a soma que devolve o número do Google. É a "ordem 0+1" do
plano: sem elas, as Fases 3 e 5 seriam **duas cópias novas** do contrato de falha que a 030 acabou
de consolidar — `guarda_no_chamador_volta_pela_porta_seguinte`, sétima ocorrência.

**⚠️ CRÍTICO**: nenhuma história começa antes desta fase fechar.

**Contrato de saída da fase**: `lerPorHosts` passa a ser uma casca sobre `lerHosts`, e nenhuma
leitura mudou de assinatura. O resultado esperado é **zero mudança visível** — e os testes da 030
são a prova. Asserção da 030 que precise ser "ajustada" é reprovação, não ajuste.

- [X] T004 [P] Escrever em `test/serie-soma-hosts.test.mjs` os casos do voto único (quickstart §2), que devem **FALHAR** antes da T005: `3,9` com `1146` impressões, um host, devolve **exatamente** `3,9` (hoje devolve `3,8999999999999995`); dois votos continuam na ponderada; dia sem impressão continua `null` e nunca `0`
- [X] T005 Corrigir `somarSeriesPorHost` em `lib/serie-gsc.mjs:72-99` (C5): acumular a **contagem de votos** além de `somaPos`/`impPos`, e devolver `position` como veio quando `votos === 1`, sem passar por `× imp ÷ imp`. É a mesma régua que `mesclarPorCaminho` já usa em `lib/gsc-hosts.mjs:72`, e sem ela a FR-006 depende de sorte de ponto flutuante — medido: **1.574 de 20.000** dias de um host saem com a posição alterada
- [X] T006 [P] Alargar `queryTimeseries` (`lib/gsc.ts:115`) e `queryClicks` (`lib/gsc.ts:82`) de `Client` para `RequestClient` (`Pick<Client, "request">`, já declarado na linha 8). É o que permite testar a série e a tendência com o `clienteFalso` da 030 sem subir o Next; alargar é seguro porque exige menos, não mais
- [X] T007 Extrair de `lerPorHosts` (`lib/gsc.ts:213-247`) o laço genérico `lerHosts<T>(hosts, buscar, client?)` cumprindo C2.1–C2.8: cliente resolvido uma vez, `listSites` uma vez, uma chamada de `buscar` por host **em série** na ordem declarada, host sem propriedade em `encerrados`, host que lança aborta com `{erro: "<host>: <msg ≤ 60>"}`, falha em `listSites()` nomeando todos os hosts, e `getClient()` **fora** do `try` — o `JSON.parse` da env cita um trecho da service account na mensagem (D6, Princípio V)
- [X] T008 Reescrever `lerPorHosts` em `lib/gsc.ts` sobre `lerHosts`, mantendo o que é dela e não do laço: `truncado` por propriedade contra o `rowLimit` DESTA requisição e a chamada a `mesclarPorCaminho`. Assinatura pública **inalterada** — `gscConsultas`, `gscPaginas` e `gscQueryPages` não são tocadas nesta fase
- [X] T009 Rodar `npm test` e `npx tsc --noEmit` e comparar com a T001: **1065 + os 3 casos novos da T004**, `tsc` em 0. Os testes `lerPorHosts:*` de `test/gsc-hosts.test.mjs:192-247` têm de passar **sem edição** — é esse o critério de "o extrato não mudou nada"

**Checkpoint**: um laço, uma soma correta, tela inalterada. É daqui que as histórias partem.

---

## Phase 3: User Story 1 - A janela longa mostra o histórico que existe (Priority: P1) 🎯 MVP

**Goal**: a aba de aquisição da Atma publica os oito meses que o Search Console tem do site, e os
dois blocos da tela param de discordar sobre o mesmo site.

**Independent Test**: abrir `/okr/atma/aquisicao` e conferir que a janela recebida cobre os 244 dias
pedidos, e não 7.

> ⚠️ **Escopo desta fase: ela fecha US1, US2-série e US3-série no MESMO commit.** Não é preguiça de
> organização — `gscSeries` é uma função só com três chamadores, e trocar o **tipo** do primeiro
> parâmetro (`siteUrl` → `string[]`) faz os três pararem de compilar juntos. Foi o que se escolheu:
> a porta errada deixa de existir em vez de ficar fechada por convenção (D1). As tarefas T015 e T016
> carregam rótulo `[US2]` e `[US3]` porque entram aqui por obrigação do compilador; a **validação**
> de cada uma é a fase da sua própria história.

### Tests for User Story 1 ⚠️

> Escrever primeiro, ver falhar, só então implementar.

- [X] T010 [P] [US1] Escrever em `test/gsc-hosts.test.mjs` os testes de `gscSeries` com o `clienteFalso` já existente (linha 177), quickstart §3: dois hosts somam e o total fecha com a soma das respostas; a mesma data nos dois vira **uma** linha com posição ponderada; um host faz **uma** requisição e devolve `days` idênticos à resposta crua; um host falhando dá `{erro}` começando pelo host e **nenhum** dia; um host sem propriedade soma os vivos e nomeia o `encerrado`; lista vazia e todos sem propriedade dão `null` sem gastar requisição; o default é `D-86 → D-3`. **Devem FALHAR** antes da T011

### Implementation for User Story 1

- [X] T011 [US1] Implementar `gscSeries(hosts: string[], janela?, options?)` em `lib/gsc.ts` sobre `lerHosts` + `somarSeriesPorHost`, cumprindo C3.1–C3.9. As datas do default (`D-86 → D-3`, byte a byte o de hoje — `019/FR-025`) são calculadas **uma vez, fora do laço**: dentro dele, dois hosts somariam janelas de um dia de diferença ao cruzar a meia-noite UTC (D5). Dia sem impressão PERMANECE, com `position: 0` (o Google devolve essas linhas — contrato C3.7, corrigido na implementação). O import de `somarSeriesPorHost` é **relativo** (`./serie-gsc.mjs`), como o de `mesclarPorCaminho` em `lib/gsc.ts:2`: `test/gsc-hosts.test.mjs:9` importa `../lib/gsc.ts` e o alias `@/` não resolve no `node --test` — com ele, a suíte INTEIRA fica vermelha (a mesma armadilha que a T027 registra para `lib/evaluate.ts`, na direção oposta). **A soma recebe `respostas.map((r) => ({host: r.host, days: r.dados}))`, nunca `respostas` cru**: `lerHosts` devolve `dados` e a soma lê `days`, e o tipo do JSDoc é fraco o bastante para aceitar os dois — cru, ela devolve `[]` e o `tsc` fica verde (C3, regra 2)
- [X] T012 [US1] Renomear o `gscSeries` de um host (`lib/gsc.ts:346-362`) para `gscSerieDeUmHost`, **sem tocar no corpo** (C3.1). O rename é o que faz `gscSeries(p.url)` parar de compilar no próximo chamador
- [X] T013 [US1] Trocar **só o nome** em `app/api/gsc-serie/route.ts` — import na linha 9 e chamada na linha 94. O laço de hosts escrito à mão nessa rota (linhas 93-109) **não é tocado**: é a quinta porta, correta hoje, e vira spec própria (D3). `git diff` desse arquivo tem de mostrar duas linhas
- [X] T014 [US1] Passar `hostsDeclarados(p)` e a janela como objeto em `app/okr/[slug]/aquisicao/page.tsx:527` — `hostsDeclarados` já está importado no arquivo (linha 4), nenhuma lista nova (FR-001)
- [X] T015 [US2] Passar `hostsDeclarados(p)` em `lib/okr-coleta.ts:184` — já importado na linha 3. **Entra aqui porque o rename obriga**; a validação da US2 é a Fase 4
- [X] T016 [US3] Passar `hostsDeclarados(p)` em `app/seo/page.tsx:40` e acrescentar o import de `@/lib/projects.mjs`. **Entra aqui porque o rename obriga**; a validação da US3 é a Fase 5
- [X] T017 [US1] Rodar `npx tsc --noEmit` até exit 0. Este é o portão que substitui os testes que `gscSeries` nunca teve: chamador esquecido não aparece em `npm test`, só aqui. Conferir de passagem que os estreitamentos de tipo dos consumidores seguem válidos — `"days" in serie` (`page.tsx:673`, `okr-coleta.ts:191`, `ficha-dados.ts:145`), `"erro" in s` (`app/seo/page.tsx:43`) e `"property" in serie` (`page.tsx:864`)
- [X] T018 [US1] Criar o componente `HostsDaLeitura({hosts, encerrados})` em `app/okr/[slug]/aquisicao/page.tsx` a partir da frase que já existe no bloco de consultas (linhas 1740-1753) e usá-lo nos **dois** blocos — série e consultas (C6, FR-005). Componente e não JSX repetido: dois trechos com a mesma frase divergem na primeira edição, e a SC-003 é justamente os dois blocos declararem a mesma lista
- [X] T019 [US1] Revisar, com o skill `ux-writing`, a cópia que deixa de ser verdadeira em `app/okr/[slug]/aquisicao/page.tsx`: o parágrafo "As fontes ao vivo medem **só o domínio novo**" (linha 1405) já era falso desde a 030, e o bloco "A troca de domínio" (linha 1376) some sozinho quando a janela recebida alcança a pedida. Decidir o que ele diz **quando a união ainda for truncada** — hoje ele diria "instrumento novo" sobre um site que tem os dois hosts (D8)

### Validação da US1

- [X] T020 [US1] Rodar a testemunha da T003 de novo e conferir contra a tela: o total de impressões do bloco de 8 meses fecha com a soma das duas propriedades, **diferença zero** (SC-004). Diferença diferente de zero é achado, não arredondamento
- [X] T021 [US1] Conferir a tela em `http://localhost:3000/okr/atma/aquisicao` (quickstart §5), com o skill `ui-verification`: a régua diz "a fonte cobre **244** de 244 dia(s) — a janela inteira" e não "truncada" (SC-002); impressões do bloco ÷ total da testemunha ≥ 99%, contra os 0,03% de hoje (SC-001); os blocos de **série** e de **consultas** declaram a mesma lista (SC-003); o bloco "A troca de domínio" e a linha "Recebida: … dos 28 dias" sumiram sozinhos; o gráfico mensal mostra os meses do domínio antigo
- [ ] T022 [US1] **NÃO EXECUTADA — pede retirar a permissão da service account numa propriedade real do Search Console, e isso muda o acesso de um sistema de produção. A lógica está provada por teste (`gscSeries: UM host falhando`, e a mesma regra em `lerHosts`); o que ficou sem prova é a FRASE renderizada na tela em estado de erro.** Provar a SC-006 retirando o acesso da service account a uma das duas propriedades: **nenhum número da série é publicado** e a frase nomeia o host. Bloco com total encolhido é reprovação — é `guarda_salva_o_historico_e_entrega_a_subcontagem`, onde a guarda salvou o histórico e entregou 3% do número

**Checkpoint**: a contradição da tela acabou. US2-série e US3-série já estão funcionando; falta prová-las.

---

## Phase 4: User Story 2 - A ficha conta o site inteiro (Priority: P1)

**Goal**: a célula de visitantes da ficha, e os números de OKR que saem dela, contam o site e não a
fatia que já migrou.

**Independent Test**: abrir a ficha da Atma e conferir que a célula de visitantes reflete o site
somado, não os poucos dias do domínio novo.

**Nota de escopo**: o chamador já foi trocado na T015. Esta fase é a **prova** — e a prova é o que
a história entrega, porque é a ficha que vira decisão.

- [X] T023 [US2] Conferir em `lib/okr-coleta.ts:191-201` e `lib/ficha-dados.ts:145-162` que a forma nova atravessa inteira: `totals28(s.days, …)` alimenta `cliques` e `impressoes`; o `motivoGsc`/`rotuloGsc` continua distinguindo `{erro}` (falhou-agora) de `null` (sem propriedade); e a fatia da época que produz o `ctr` (`ficha-dados.ts:146-149`) agora recorta uma série somada — a janela declarada continua sendo a que a série DEU, não a pedida
- [X] T024 [US2] Conferir a ficha da Atma em `http://localhost:3000/okr/atma` (quickstart §6): a célula `visitante` bate com a soma dos **cliques** dos dois hosts na mesma janela de 28 dias, medida pela testemunha da T002 (SC-005). Reprovado se refletir só o domínio novo

**Checkpoint**: o número que vira decisão conta o site inteiro.

---

## Phase 5: User Story 3 - O painel de SEO e a tendência do portfólio somam (Priority: P2)

**Goal**: o `/seo` e o indicador de tendência da home olham o site inteiro, e um projeto em migração
para de parecer em colapso ao lado dos outros 34.

**Independent Test**: abrir o painel de SEO e conferir que o projeto em migração não aparece com a
série zerada.

**Nota de escopo**: a metade `/seo` já foi entregue na T016 e é validada na T028. A **tendência**
(`gscTrend`) é independente e fecha sozinha — é o único pedaço desta spec que poderia ir para
produção separado do resto.

### Tests for User Story 3 ⚠️

- [X] T025 [P] [US3] Escrever em `test/gsc-hosts.test.mjs` os testes de `gscTrend` com o `clienteFalso`: dois hosts somam os cliques **por janela** (`current` e `previous` separados); um host faz **duas** requisições, as duas em voo juntas como hoje, e devolve o número de hoje; um host falhando devolve `null` e **não** a soma do que respondeu; env malformada não derruba a home. **Devem FALHAR** antes da T026

### Implementation for User Story 3

- [X] T026 [US3] Implementar `gscTrend(hosts: string[], options?)` em `lib/gsc.ts:458-474` sobre `lerHosts`, cumprindo C4.1–C4.5: as duas janelas por host (`D-31→D-3` e `D-59→D-32`) **no `Promise.all` de hoje, não em série** — o que roda em série são os hosts (C2.3), e o teto em voo continua 2 requisições e nunca 2×N (C4.6) —, soma dos cliques **por janela**, as quatro datas calculadas uma vez fora do laço, e o `catch` externo mantido — `GscTrend` não tem campo de erro e qualquer falha continua virando `null`, que é o que faz o consumidor cair no `seoSeed` (D6). Nomear o host é impossível nesta forma, e ampliá-la reescreveria home e agenda por uma frase que ninguém exibe
- [X] T027 [US3] Passar `hostsDeclarados(p)` em `lib/evaluate.ts:23` e acrescentar o import de `@/lib/projects.mjs`. `lib/evaluate.ts` não é carregado por nenhum teste (`test/score.test.mjs` importa só `lib/score.mjs`), então o alias `@/` não é problema aqui — mas **não** mova essa leitura para dentro de `lib/gsc.ts`, que é importado por `node --test` e quebraria com o alias

### Validação da US3

- [X] T028 [US3] Conferir `http://localhost:3000/seo` e a home (quickstart §6): o card da Atma não aparece zerado nem em colapso, e o `current` da tendência bate com os cliques de `D-31 → D-3` pela testemunha

**Checkpoint**: as telas de varredura contam o mesmo site que a ficha.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T029 [P] Portão FR-006, o que NÃO pode mudar: `node --test test/serie-migracao-regressao.test.mjs` verde sem edição, e `git diff app/api/gsc-serie/route.ts` mostrando **só** as duas linhas do rename
- [X] T030 [P] Portão da porta errada: `grep -rn "gscSerieDeUmHost" app lib` devolve só a definição em `lib/gsc.ts` e as duas linhas de `app/api/gsc-serie/route.ts`. Qualquer leitura ao vivo aparecendo aí é a porta errada reaberta
- [X] T031 [P] Portão FR-005: `grep -c "HostsDaLeitura" "app/okr/[slug]/aquisicao/page.tsx"` ≥ 3 (definição + dois usos). Menos que isso é a declaração divergindo entre os blocos
- [X] T032 [P] Portão FR-001: `grep -rn "dominioAnterior" --include=*.ts --include=*.mjs --include=*.tsx app lib` não devolve **linha nova** fora de `lib/projects.*` — lido pela intenção (nenhuma segunda lista de hosts), como a 030 registrou no achado 7: a tela e `scripts/backfill-host-gsc.mjs` já citavam o campo antes desta spec
- [X] T033 [P] Portão Princípio I: `grep -rn "data/projects.json" --include=*.ts --include=*.mjs --include=*.tsx app lib` não devolve import fora de `lib/projects.*`
- [X] T034 [P] Tripwire do `www.` (D9): `gh api "users/JeanZorzetti/repos?per_page=100&type=owner" --paginate --jq '.[] | select(.archived==false and ((.homepage//"") | test("^(https?://)?www[.]"))) | .name'` — esperado **vazio**, e a metade curada tem comando próprio: `grep -c '"url": *"https\?://www\.' data/projects.json` → esperado **0**. Duas fontes, dois instrumentos: o `gh api` não enxerga `data/projects.json` e declarar os dois com um comando só é medir metade e afirmar o todo. Medido em 19/09/2026: 0 de 35 repos, **0 de 36 URLs curadas**. Projeto com `www.` no `url` teria a série vazia, porque `hostsDeclarados` tira o `www.` e o filtro do Google não casaria
- [X] T035 [P] Conferir que cada comentário novo em `lib/gsc.ts`, `lib/serie-gsc.mjs` e `app/okr/[slug]/aquisicao/page.tsx` traz o **fato medido** que o motivou (127 de 370.559 = 0,03%; 7 de 244 dias; `3,9 × 1146 ÷ 1146` = `3,8999999999999995` em 1.574 de 20.000 casos). Comentário que narra o que a linha faz é ruído e sai
- [X] T036 [P] Ler o diff inteiro procurando segredo em log, resposta ou mensagem de erro (Princípio V): o `{erro}` carrega o **host** (dado público do card) e nada mais, e `getClient()` continua **fora** do `try` — dentro dele, uma env malformada publicaria na tela um trecho do JSON da service account, porque é isso que a mensagem do `JSON.parse` cita
- [X] T037 Rodar `npm test` (suíte inteira, não só os arquivos tocados) e `npx tsc --noEmit`. Verde e exit 0, com a contagem de testes ≥ 1065 + os casos novos
- [X] T038 Commit e push do diff (`lib/gsc.ts`, `lib/serie-gsc.mjs`, `lib/okr-coleta.ts`, `lib/evaluate.ts`, `app/okr/[slug]/aquisicao/page.tsx`, `app/seo/page.tsx`, `app/api/gsc-serie/route.ts`, `scripts/conferir-soma-hosts.mjs`, `test/`) em `main` **fora** de 23:30–01:00 e 08:00–08:45 BRT (Princípio IV)
- [X] T039 Conferir `https://hub.roilabs.com.br/okr/atma/aquisicao` no ar **duas** vezes, ~15 min após o push — uma checagem cedo "prova" que não subiu

> **Conferido em 19/09/2026** (push `5e7d55d` às ~23:18 BRT, antes da janela vedada): produção respondeu
> `http=200` com "a fonte cobre 244 de 244 dia(s)", 370.559 impressões e "hosts somados" nos dois
> blocos — na 2ª tentativa do monitor (~23:21) e de novo 5 min depois. O código antigo mostrava "7 de
> 244", então esse texto só sai do deploy novo. Conferida em produção **só a aba de aquisição**: a ficha
> (424), o `/seo` (424) e a tendência da home (449 vs 341) foram provados no dev local contra a
> testemunha, não no ar. **T022 segue aberta** — ver a nota na própria tarefa.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sem dependência
- **Foundational (Fase 2)**: depende da Fase 1 (a régua) — **BLOQUEIA as três histórias**
- **US1 (Fase 3)**: depende da Fase 2. Arrasta a implementação de US2-série e US3-série
- **US2 (Fase 4)**: depende da Fase 3 (T015). Só validação
- **US3 (Fase 5)**: a metade `/seo` depende da Fase 3 (T016); a metade `gscTrend` (T025-T027) depende **só** da Fase 2 e pode ir em paralelo com a Fase 3
- **Polish (Fase 6)**: depende das histórias entregues

### Within Each Story

- Teste escrito e **falhando** antes da implementação
- Soma pura (`.mjs`) antes da borda (`.ts`), borda antes do chamador, chamador antes da tela
- `tsc --noEmit` antes de qualquer validação de tela: sem ele, o chamador esquecido aparece como página branca, não como erro
- Validação de tela por último, e só ela fecha a história

### Parallel Opportunities

- T002 (script) é independente de tudo e pode rodar a qualquer momento antes da T003
- T004 (`test/serie-soma-hosts.test.mjs`) e T006 (`lib/gsc.ts`) são arquivos diferentes: paralelas
- T005 (`lib/serie-gsc.mjs`) e T007 (`lib/gsc.ts`) são arquivos diferentes: paralelas
- T010 e T025 disputam `test/gsc-hosts.test.mjs`: **uma de cada vez**
- T011/T012 (série) e T026 (tendência) disputam `lib/gsc.ts`: **uma de cada vez**
- T014, T015 e T016 são três arquivos diferentes: paralelas entre si, todas depois da T012
- Fase 6: T029–T036 são leituras independentes, todas em paralelo

## Parallel Example: depois da Fase 2

```bash
# Três arquivos diferentes, nenhuma dependência entre eles:
Task: "T014 [US1] hostsDeclarados(p) em app/okr/[slug]/aquisicao/page.tsx:527"
Task: "T015 [US2] hostsDeclarados(p) em lib/okr-coleta.ts:184"
Task: "T016 [US3] hostsDeclarados(p) em app/seo/page.tsx:40"
```

---

## Implementation Strategy

### MVP (US1)

1. Fase 1 (T001–T003) — a régua e a medição de antes
2. Fase 2 (T004–T009) — **crítica**, e é o que a FR-007 cobra
3. Fase 3 (T010–T022)
4. **PARAR e VALIDAR**: SC-001, SC-002, SC-003, SC-004, SC-006
5. Entregar — a contradição da tela acabou, e a ficha e o `/seo` já vieram junto

### Entrega incremental

1. Fase 1 + Fase 2 → um laço, uma soma correta, tela inalterada
2. + Fase 3 → a aba mostra os 8 meses (MVP), com a ficha e o `/seo` arrastados
3. + Fase 4 → a ficha provada: é o número que vira decisão
4. + Fase 5 → a tendência da home soma (a única parte separável de verdade)

---

## Notes

- **A corrida que grava (`app/api/gsc-serie/route.ts`) fica FORA**, por decisão da spec
  (Assumptions) e registrada em research.md D3 como a **quinta porta**. O laço de hosts dela é o
  mesmo contrato da T007 escrito à mão, correto hoje; migrá-lo apagaria ~25 linhas mas ela escreve
  no banco e push é deploy. Vira spec própria. Escrito aqui para não ser redescoberto daqui a um mês
  — `migracao_tratada_em_uma_fonte_so`
- **A T005 alcança a corrida**, e é o único ponto em que ela sente esta feature: a `posicao` gravada
  dos dias de um voto só pode mudar na 16ª casa decimal, na direção do valor do Google.
  `gravarDiasGsc` (`lib/db.ts:965-978`) guarda por **host**, nunca por valor, e o `ON CONFLICT` só
  sobrescreve — nada acorda (D4)
- **`gscSerieFiltrada`** (as três pernas de marca) continua primitiva de um host, usada só pela
  corrida. Não é tocada
- Soma parcial é proibida em qualquer ponto: um total que encolhe sem explicação lê como queda de
  tráfego. Falha de qualquer host declarado impede a publicação do número
- O selo `piso, não total` **continua** no bloco de consultas: ele é da dimensão `query`, e a série
  usa `date`, que não tem esse corte
- Nenhuma dependência nova, nenhuma tabela, nenhuma migração, nenhuma variável de ambiente, nenhum
  arquivo novo — a feature **remove** a repetição do laço de hosts e liga duas funções que já existiam
- Commit por tarefa ou por grupo lógico; parar em qualquer checkpoint para validar a história
