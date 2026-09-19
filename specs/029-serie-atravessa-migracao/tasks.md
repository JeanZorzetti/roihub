---

description: "Task list — 029 a série atravessa a migração de domínio"
---

# Tasks: A série atravessa a migração de domínio

**Input**: Design documents from `/specs/029-serie-atravessa-migracao/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/funcoes.md, quickstart.md

**Tests**: incluídos. A constituição exige (Princípios II e III) e a lógica nova é toda pura: soma
por host, posição ponderada, assinatura e pertinência ao conjunto declarado.

**Organization**: por história, na ordem P1 → P3 → P2 do plano — parar a hemorragia, corrigir o
histórico, só então mexer na tela.

**Estado medido em 18/09/2026**: repo `roihub`, `main` limpo. Banco com 248 dias sob
`atma.roilabs.com.br` e 1 sob `usealigner.com` (16/09, valendo 35 contra ~1.180 reais).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: US1 (o dia mede o negócio), US2 (a fronteira na tela), US3 (histórico corrigido)

---

## Phase 1: Setup

- [X] T001 Conferir a premissa antes de tudo: rodar a consulta às duas propriedades e registrar os
      números do dia no topo de `research.md` se divergirem dos citados (a série se move; a spec
      cita 15/09 = 1.146 + 31)
- [X] T002 [P] `GLOSSARIO.md`: acrescentar **assinatura de hosts** (os hosts somados num dia,
      ordenados e unidos por `+`) e **fronteira de migração** (o dia em que a assinatura muda dentro
      do conjunto declarado), com o que cada um NÃO é

---

## Phase 2: Foundational (bloqueia US1 e US3)

- [X] T003 `lib/serie-gsc.mjs`: `somarSeriesPorHost()` conforme `contracts/funcoes.md` — dia ausente
      num host entra com o que existe; `position` ponderada por impressão; `null` sem impressão
- [X] T004 `lib/serie-gsc.mjs`: `assinaturaDeHosts()` e `dentroDoDeclarado()` — normaliza, dedupe,
      ordena, une por `+`; assinatura `null` é ignorância e passa na guarda
- [X] T005 `test/serie-soma-hosts.test.mjs`: cobre T003 e T004 — soma com dia faltando num host,
      ponderação (1.146@2,8 + 31@8,3 não dá 5,55), host só, lista vazia, assinatura fora de ordem,
      `www.` duplicado, assinatura `null`
- [X] T006 Registrar `test/serie-soma-hosts.test.mjs` em `package.json` no MESMO commit (Princípio
      II; `test/validade.test.mjs` reprova a suíte se faltar)

---

## Phase 3: US1 — o dia mede o negócio (P1) 🎯 MVP

- [X] T007 `lib/db.ts`: guarda de `gravarDiasGsc()` passa a aceitar `declarados` e a testar
      pertinência via `string_to_array(host,'+')`; sem `declarados` mantém `IS NOT DISTINCT FROM`
- [X] T008 `lib/db.ts`: o mesmo em `gravarMarcaGsc()` (a guarda dela é a da linha ~1055)
- [X] T009 `app/api/gsc-serie/route.ts`: laço por `hostsDeclarados(p)` chamando `gscSeries()` por
      host; `null` (sem propriedade) vira `encerrados` e a corrida segue; `{erro}` aborta o projeto
      sem gravar nada (FR-004/FR-004a)
- [X] T010 `app/api/gsc-serie/route.ts`: somar com `somarSeriesPorHost()`, gravar com a assinatura,
      e passar `declarados` às duas gravações
- [X] T011 `app/api/gsc-serie/route.ts`: as três pernas de marca por host, somadas na mesma janela e
      no mesmo ato (FR-005) — o corte de país continua nas três
- [X] T012 `app/api/gsc-serie/route.ts`: campos novos da resposta (`somados`, `encerrados`) conforme
      o contrato
- [X] T013 `scripts/conferir-soma-hosts.mjs`: consulta as propriedades dos hosts declarados e
      imprime dia · por host · soma. É a testemunha independente do quickstart, e a única coisa que
      prova que o banco bate com o Google
- [X] T014 Rodar a corrida e conferir com T013: o dia de hoje grava a soma e a assinatura tem os
      dois hosts

**Checkpoint**: a hemorragia parou — nenhum dia novo nasce com 3% da realidade.

---

## Phase 4: US3 — o histórico da transição corrigido (P3)

- [X] T015 `app/api/gsc-serie/route.ts`: `desde` opcional no corpo, substituindo o início da janela
      do total; data inválida responde `400` sem tocar em nada
- [X] T016 `test/serie-migracao-regressao.test.mjs`: projeto sem `dominioAnterior` produz o
      comportamento atual byte a byte; assinatura de host fora do declarado continua sendo barrada
      pela guarda
- [X] T017 Registrar `test/serie-migracao-regressao.test.mjs` em `package.json`
- [X] T018 Snapshot do antes: gravar em `specs/029-serie-atravessa-migracao/antes.csv` os 248 dias
      anteriores a 11/09 (dia, impressões, cliques) — é contra ele que a SC-005 é conferida
- [X] T019 Rodar `desde=2026-09-11` e conferir 14/09 = 719, 15/09 = 1.177, 16/09 = soma do dia
- [X] T020 Conferir a SC-005 contra `antes.csv`: nenhum dia anterior a 11/09 mudou de valor
- [X] T021 Rodar `desde=2026-09-11` de novo e conferir que nada mudou na segunda vez (SC-006)

**Checkpoint**: a série inteira obedece a mesma régua, e o histórico anterior à troca está intacto.

---

## Phase 5: US2 — a fronteira na tela (P2)

- [X] T022 `lib/marca.mjs`: `segmentosPorHost(dias, declarados)` — assinaturas dentro do mesmo
      conjunto declarado não abrem segmento novo; fora dele, abrem (FR-008/FR-015)
- [X] T023 `lib/marca.mjs`: `semanasNaoMarca(dias, declarados)` — a semana só recebe `host: null`
      quando mistura declarado com não declarado; a semana da troca volta a ter valor (FR-011)
- [X] T024 `lib/marca.mjs`: `ritmoDoSegmentoAtual(dias, declarados)` repassa `declarados`
- [X] T025 ⚠️ **Entregue em `test/serie-migracao-regressao.test.mjs`, não em arquivo próprio.** A
      cobertura é a planejada (um segmento com declarados, dois sem eles, semana da troca com valor,
      host fora do declarado abrindo segmento), mas ela é a MESMA pergunta do teste de regressão —
      "o que muda e o que não pode mudar" — e dois arquivos que nascem lendo a mesma série
      divergem no primeiro conserto que só um receber.
- [X] T026 Registrado: `test/serie-migracao-regressao.test.mjs` em `package.json` (o arquivo
      previsto em T025 não existe, pelo motivo acima)
- [X] T027 `app/okr/[slug]/aquisicao/page.tsx`: passar `hostsDeclarados(p)` às três funções e ao
      cálculo do corte
- [X] T028 `app/okr/[slug]/aquisicao/page.tsx`: a fronteira deixa de ser "a série está encerrada" e
      passa a ser marca datada — quem entrou, quando, e que a série segue viva (FR-009)
- [X] T029 `app/okr/[slug]/aquisicao/page.tsx`: nomear na procedência os hosts somados e a
      contribuição de cada um na janela exibida (FR-010)
- [X] T030 `app/okr/[slug]/aquisicao/page.tsx`: revisar a copy da 026 que afirma que os dois lados
      do corte "não se somam nem se comparam" — a régua mudou, e comentário que descreve a régua
      antiga vira mentira documentada

**Checkpoint**: uma série, uma leitura, a fronteira visível e datada.

---

## Phase 6: Fechamento

- [X] T031 `npm test` verde (suíte inteira, não só os arquivos tocados)
- [X] T032 Conferir a tela no navegador: veredito único, semana de 14/09 com barra, fronteira
      datada, e nenhuma frase de série encerrada
- [X] T033 Commit e push respeitando a janela do Princípio IV (fora de 23:30-01:00 e 08:00-08:45
      BRT); o deploy do EasyPanel leva ~15 min e a tela precisa ser conferida DUAS vezes
- [X] T034 `handoff/` — registrar o que a corrida passou a medir e o que a assinatura significa,
      para quem abrir a tela daqui a três meses

---

## Dependências

- T003/T004 bloqueiam T005, T007-T011 e T022-T024
- T007/T008 bloqueiam T014 e T019 (sem a guarda nova, a regravação é recusada)
- Phase 4 depende da Phase 3 inteira; Phase 5 depende da Phase 4 (tela sobre dado corrigido)
- T018 tem de rodar ANTES de T019 — snapshot depois da regravação não prova nada

## Paralelizáveis

- T002 com qualquer coisa
- T005 pode ser escrito junto com T003/T004 (TDD), desde que registrado em T006
- T022-T024 são o mesmo arquivo: NÃO paralelizar entre si
