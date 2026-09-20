# Tasks: O inventário de termos e a penetração no Top 3

**Feature**: 034 | **Branch**: `034-inventario-de-termos` | **Data**: 2026-09-20

**Input**: `specs/034-inventario-de-termos/` — spec.md, plan.md, research.md, data-model.md

**Tests**: **obrigatórios**, pelo mesmo motivo da 033 — `plan.md` § Constitution Check lista `npm
test` verde na suíte inteira e o registro à mão em `package.json` como portões de merge (Princípio
II). O teste vem antes da lib e precisa **falhar** antes dela existir.

**Organização**: por história de usuário. Cada uma fecha e é verificável sozinha.

## Formato: `[ID] [P?] [História] Descrição`

- **[P]**: arquivo diferente, sem dependência — pode ir em paralelo
- Caminho exato em toda descrição

---

## Fase 1 — US1: o inventário existe, declarado e congelado (P1)

- [x] **T001** [US1] `test/inventario.test.mjs`: escrever os casos de `lerInventario()` antes da lib
      — ausência devolve `null`; lista vazia lança; termo duplicado lança; procedência sem `janela`,
      sem `piso`, sem `congeladoEm` ou sem `excluiMarca` lança; termo que casa a marca declarada
      lança. Rodar e ver **falhar**.
- [x] **T002** [US1] Registrar `test/inventario.test.mjs` na lista de `npm test` em `package.json`
      (Princípio II — teste fora da lista nunca roda).
- [x] **T003** [US1] `lib/inventario.mjs`: `lerInventario(slug, arquivo)` puro, com as recusas de
      T001. `null` = sem inventário (estado válido); exceção = arquivo inválido (erro de curadoria).
- [x] **T004** [US1] `scripts/derivar-inventario.mjs`: recebe o slug, exige `marca.termos` no card,
      consulta as duas propriedades na dimensão `query` na janela de 8 meses, une por termo
      ponderando posição por impressão, exclui marca por `regexDeMarca()`, aplica o piso e imprime o
      resumo. **Só grava com `--gravar`** (FR-002).
- [x] **T005** [US1] Rodar `node --env-file=.env scripts/derivar-inventario.mjs atma --piso 20
      --gravar` e conferir à mão: 725 termos, nenhum de marca própria, procedência completa.

**Checkpoint US1**: `npm test` verde e `data/inventario-de-termos.json` versionado com procedência.

---

## Fase 2 — US2: a folha do mapa publica o número (P2)

- [x] **T006** [P] [US2] `test/gsc-hosts.test.mjs`: casos de `mesclarPorTermo()` — dois hosts com o
      mesmo termo somam impressão e ponderam posição; linha sem impressão não vota; voto único
      devolve a posição como veio (sem erro de ponto flutuante); sem voto devolve `posicao: null`.
- [x] **T007** [US2] `lib/gsc-hosts.mjs`: `mesclarPorTermo(respostas)` ao lado de
      `mesclarPorCaminho()`, com as mesmas regras de voto e sem `new URL()`.
- [x] **T008** [P] [US2] `test/kpis-busca.test.mjs`: casos de `penetracaoNoTop3()` — denominador é o
      inventário inteiro; termo do inventário ausente da janela conta em `total` e não em `noTop3`;
      termo fora do inventário é ignorado mesmo em posição 1; `cobertura < total` liga `piso`;
      inventário `null` devolve `null` e **nunca** `{fracao: 0}`.
- [x] **T009** [US2] `lib/kpis-busca.mjs`: `penetracaoNoTop3(linhas, inventario)` ao lado de
      `impressoesNoTop3` e **fora** de `kpisPorTermo()` — aquele agregador lê `query`+`page` e a
      medida devolveria 0 para sempre. O docblock guarda a razão para a próxima pessoa.
- [x] **T010** [US2] `lib/gsc.ts`: `gscTermos(hosts, janela)` sobre `lerHosts()`, dimensão
      `["query"]`, mesclando por `mesclarPorTermo()`. Contrato de ausência e falha igual ao das
      leituras vizinhas (`null` × `{erro}`).
- [x] **T011** [US2] `lib/gsc-delta.mjs`: `MEDIDO_POR.penetracaoTop3 =
      "lib/kpis-busca.mjs#penetracaoNoTop3"`, com o comentário dizendo o que mudou desde 19/09 —
      o coletor removido então contava impressões; este conta termos.
- [x] **T012** [US2] `app/gsc/mapa/page.tsx`: injetar na folha `penetracaoTop3` os filhos com o
      medido, no padrão das seis faixas da 033 — `topic` curto com número e estado por glifo **e**
      texto, `note` com janela, cobertura e o que "piso" significa.
- [x] **T013** [US2] Conferir que o selo da folha continua `◇ sem fonte` e que **nenhum** glifo de
      veredito (`▼`/`▲`/`◐`) aparece ao lado do número (FR-009).

**Checkpoint US2**: `/gsc/mapa` mostra `10,2% (74 de 725)` com janela e cobertura, sem veredito.

---

## Fase 3 — US3: os 34 sem inventário não ganham número falso (P3)

- [x] **T014** [US3] `app/gsc/mapa/page.tsx`: caminho de ausência com as duas frases distintas —
      "inventário não declarado para este projeto" × falha de leitura do Search Console.
- [x] **T015** [US3] Conferir que nenhum projeto sem inventário exibe `0%` em lugar nenhum da tela.

---

## Fase 4 — fechamento

- [x] **T016** `npm test` na suíte inteira + `npx tsc --noEmit` limpo.
- [ ] **T017** Commit e push respeitando a janela do Princípio IV (nada em 23:30–01:00 nem
      08:00–08:45 BRT).
- [ ] **T018** Conferir a tela **no ar**, duas vezes (o deploy leva ~15 min), e comparar o número
      publicado com uma consulta ao vivo do mesmo dia.
- [x] **T019** `quickstart.md`: como refazer o inventário e como conferir o número contra a fonte.

## Verificação (20/09/2026)

- `npm test` — **1.160 de 1.160**, incluindo `test/inventario.test.mjs` (14 novos) e os casos novos
  em `test/gsc-hosts.test.mjs` e `test/kpis-busca.test.mjs`. Cada bloco foi visto **falhar** antes
  da lib existir.
- `npx tsc --noEmit` — limpo.
- `/gsc/mapa` no dev, autenticado: a folha rende
  `Medido: 10,2% · 74 de 725 termos monitorados · piso (454 apurados na janela)`, com o selo
  `◇ sem fonte` intacto e nenhum glifo de veredito. O painel imprime
  `Medido em lib/kpis-busca.mjs#penetracaoNoTop3 (termos do inventário em posição ≤ 3, dimensão query)`.
- Playwright em 1280 e 360: sem estouro lateral, console com **0 erro e 0 aviso**.
- O número bate com a consulta ao vivo do mesmo dia (mesma janela, mesmos hosts): 74 de 725.
