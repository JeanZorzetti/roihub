# Tasks: Quadros de Marketing e Ideias

**Feature**: `006-quadros-marketing-ideias` | **Data**: 2026-08-29

**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md),
[research.md](./research.md), [contracts/](./contracts/)

**Tests**: SIM. `test/pauta.test.mjs` é exigido pelo plano e pela cobertura mínima do
[quickstart §1](./quickstart.md). Só o módulo puro é testado — `node --test`, sem banco, sem DOM.

## Formato: `[ID] [P?] [História] Descrição`

- **[P]** — pode rodar em paralelo (arquivo diferente, sem dependência)
- Caminhos são relativos à raiz do repo

## Arquivos existentes que podem mudar — quatro

`app/tabs.tsx` · `lib/db.ts` · `package.json` · `app/globals.css`. Qualquer outro arquivo
existente aparecendo no `git status` no fim é violação de SC-004 e do escopo declarado no plano.

> `app/globals.css` **não estava no plano original** (que dizia "exatamente três"). Entrou na
> implementação porque kanban e grade de calendário não têm classe reaproveitável entre as `ag-*`
> e o repo não tem framework de CSS. São acréscimos com prefixo `q-` no fim do arquivo, sem tocar
> em regra existente — nenhuma aba atual muda de aparência. Registrado no plano.

---

## Fase 1: Fundação (bloqueia todas as histórias)

**Objetivo**: o módulo puro, o esquema e a navegação — o que toda história consome.

- [x] T001 Criar `lib/pauta.mjs` com as constantes do contrato: `QUADROS`, `CANAIS`,
      `TIPOS_CARD`, `VISTAS`, `COLUNAS_INICIAIS`, `MIMES_ACEITOS`, `ANEXO_MAX_BYTES`,
      `ANEXO_MAX_POR_CARD`, `ANEXO_CARENCIA_DIAS`. Zero import de `next`, `pg` ou `react`
      ([pauta-mjs.md](./contracts/pauta-mjs.md))
- [x] T002 Em `lib/pauta.mjs`: `validarAnexo({mime, tamanho, jaTem})` e
      `validarColunaRemovivel({cards, totalColunas})` — códigos de erro estáveis
      (`mime` | `tamanho` | `quantidade`; `tem-cards` | `ultima-coluna`), nunca mensagem livre
- [x] T003 Em `lib/pauta.mjs`: calendário puro — `gradeDoMes(ym)`, `mesVizinho(ym, n)`,
      `mesDe(iso)`, `rotuloMes(ym)`. Semana começa no domingo, igual a `WD_LABELS`
- [x] T004 Em `lib/pauta.mjs`: filtros — `lerFiltros(sp, {slugs, colunas})`, `filtrosAtivos(f)`,
      `comFiltro(f, chave, valor)`, `filtrar(cards, f)`. Desconhecido = sem filtro, nunca filtro
      que não casa. `comFiltro` omite `vista=kanban` e `arquivados=0`
- [x] T005 Em `lib/pauta.mjs`: agrupamento — `agruparPorColuna(cards, colunas)` devolvendo
      **todas** as colunas inclusive vazias (FR-030), e `agruparPorDia(cards, ym)` sem card sem data
- [x] T006 Em `lib/pauta.mjs`: retenção pura — `podeLiberar(card, hoje)`, `dataDeLiberacao(card)`,
      `resumoDeEspaco(anexos)`
- [x] T007 Criar `test/pauta.test.mjs` cobrindo a matriz do [quickstart §1](./quickstart.md):
      `gradeDoMes` (mês começando no domingo, fevereiro bissexto, virada de ano), `mesVizinho`,
      `validarAnexo` (mime, tamanho, 21º arquivo), `validarColunaRemovivel` (com cards, última,
      vazia), `agruparPorColuna` (coluna vazia sobrevive), `agruparPorDia` (card sem data fora),
      `lerFiltros` (desconhecido = sem filtro), `podeLiberar` (29 não, 30 sim, não arquivado nunca)
- [x] T008 **Registrar `test/pauta.test.mjs` na lista explícita do `package.json`** — arquivo não
      registrado nunca roda, e teste que não roda não reprova nada (Princípio II da constituição)
- [x] T009 Em `lib/db.ts` `ensure()`: `CREATE TABLE IF NOT EXISTS hub_pauta_coluna`, `hub_pauta`,
      `hub_pauta_anexo` + os dois índices, exatamente como [data-model.md](./data-model.md).
      Nenhuma tabela existente é alterada
- [x] T010 Em `lib/db.ts` `ensure()`: semeadura idempotente das colunas iniciais com
      `ON CONFLICT (quadro, nome) DO NOTHING` — Marketing (📝 Pauta · 🔨 Produzindo · 📅 Agendado ·
      ✅ Publicado) e Ideias (🌱 Produto novo · 🔧 Melhoria · 🗄️ Gaveta). FR-016
- [x] T011 Em `lib/db.ts`: tipos `PautaCard`, `PautaColuna`, `PautaAnexo` e as leituras
      `listColunas(quadro)`, `listCards(quadro)`, `listAnexos(pautaIds)`, `resumoAnexos()`
- [x] T012 Em `lib/db.ts`: escritas de card — `insertPauta`, `updatePauta`, `movePauta`,
      `removePauta`, `arquivarPauta`, `restaurarPauta`
- [x] T013 Em `lib/db.ts`: escritas de coluna — `insertColuna`, `renameColuna`, `swapColunaOrdem`
      (transação), `removeColuna`, `contarCardsDaColuna`
- [x] T014 Em `lib/db.ts`: anexos — `insertAnexo`, `listAnexoBytes(id)`, `removeAnexo`,
      `swapAnexoOrdem`, e `liberarAnexosVencidos(dias)` com o `UPDATE` idempotente do data-model
- [x] T015 Em `app/tabs.tsx`: acrescentar as abas `marketing` e `ideias` ao union de `active` e à
      navegação. **Único arquivo de UI existente que muda**

**Checkpoint**: `npm test` verde com o arquivo novo registrado; esquema criado no primeiro acesso.

---

## Fase 2: US1 — Quadro de Ideias (P1) 🎯 MVP

**Objetivo**: `/ideias` completo — criar, editar, apagar, mover de seção, arquivar, filtrar.

**Teste independente**: criar três ideias em seções diferentes, mover uma, arquivar outra,
recarregar e conferir; abrir `/agenda` e o ranking e não achar nenhuma delas.

- [x] T016 Criar `app/quadro-actions.ts` (`"use server"`) com `addCard`/`updateCard` seguindo o
      contrato de campos ([server-actions.md](./contracts/server-actions.md)): `titulo` 200,
      `descricao` 4000, `projeto` validado contra `listProjects()`, `responsavel` contra
      `RESPONSAVEL_IDS`, entrada inválida vira valor neutro sem lançar
- [x] T017 Em `app/quadro-actions.ts`: `moverCard` (recusa coluna de outro quadro), `delCard`,
      `arquivarCard`, `restaurarCard`. Todas terminam em `revalidatePath` da rota do quadro
- [x] T018 Criar `app/editar-card.tsx` (client component, molde de `app/agenda/edit-task.tsx`):
      `<dialog>` com título, descrição, seção/coluna, projeto, responsável — e canal, data e URL
      só quando o quadro é `marketing`
- [x] T019 Criar `app/quadro.tsx` — componente comum: barra de filtros por GET, chips de filtro
      ativo com `comFiltro`, formulário de adicionar, lista de cards e área recolhida de arquivados
- [x] T020 Criar `app/ideias/page.tsx` — fino: lê colunas e cards, delega para `app/quadro.tsx` em
      layout de seções empilhadas (R-008), com o banner de `!dbOn()` no mesmo texto da Agenda/CRM
- [x] T021 Garantir que o quadro de Ideias não oferece marcação de concluído (FR-008) e que
      `canal`/`data` não aparecem lá

**Checkpoint**: US1 entregável sozinha. SC-001, SC-002, SC-003.

---

## Fase 3: US2 — Quadro de Marketing em fluxo (P2)

**Objetivo**: `/marketing` em kanban com as quatro colunas semeadas.

**Teste independente**: criar card com canal e projeto, mover pelas colunas, recarregar.

- [x] T022 Criar `app/marketing/page.tsx` — escolhe a vista pela querystring e delega; vista
      padrão `kanban`
- [x] T023 Em `app/quadro.tsx`: layout de colunas lado a lado para o Marketing, usando
      `agruparPorColuna` — **coluna vazia continua na tela**, rotulada (FR-030)
- [x] T024 Em `app/quadro.tsx`: filtro por canal além de projeto e responsável (FR-028), e campos
      de canal/data/URL no formulário de adicionar quando o quadro é `marketing`
- [x] T025 Estilos do kanban em `app/globals.css` seguindo o estilo dos vizinhos `ag-*`
      (sem formatter, sem framework de CSS)

**Checkpoint**: US2 entregável. SC-002.

---

## Fase 4: US3 — Colunas e seções editáveis (P3)

**Objetivo**: adicionar, renomear, reordenar e remover colunas pela tela, sem deploy.

**Teste independente**: adicionar coluna, renomear, mover de posição, tentar apagar com card
dentro e ver a recusa com a contagem.

- [x] T026 Em `app/quadro-actions.ts`: `addColuna` (nome 1–40, `ordem` = última + 1, nome repetido
      cai no `UNIQUE` e sai sem gravar) e `renameColuna` (só `nome` e `icone`)
- [x] T027 Em `app/quadro-actions.ts`: `moverColuna(id, dir)` trocando `ordem` com a vizinha numa
      transação
- [x] T028 Em `app/quadro-actions.ts`: `delColuna` passando por `validarColunaRemovivel()` —
      recusa com contagem (FR-013) e recusa da última (FR-014); a recusa volta como aviso na tela,
      não como exceção
- [x] T029 Em `app/quadro.tsx`: cabeçalho de coluna com `+` para adicionar, renomear inline,
      setas ‹ › de reordenar e × de remover, com o aviso de recusa visível

**Checkpoint**: US3 entregável. SC-005, SC-006.

---

## Fase 5: US4 — Arte da publicação anexada ao card (P4)

**Objetivo**: carrossel de até 20 imagens por card, ordenável.

**Teste independente**: anexar dez imagens, conferir ordem, reordenar duas, remover uma, recarregar.

- [x] T030 Criar `app/api/pauta/anexo/[[...id]]/route.ts` com `runtime = "nodejs"` e
      `dynamic = "force-dynamic"`. **Não acrescentar isenção no `middleware.ts`** — a rota herda o
      Basic auth do `HUB_PASS` (FR-023)
- [x] T031 `POST /api/pauta/anexo` — `formData.getAll("imagens")`, `validarAnexo()` por arquivo,
      `ordem` = maior do card + 1 na ordem recebida, `303` para `voltar`. `voltar` só aceita
      caminho relativo começando com `/` e que não comece com `//` (redirect aberto)
- [x] T032 `POST /api/pauta/anexo` — respostas: `303` limpo, `303` com `?erro=<codigo>` quando
      algum arquivo é recusado (os aceitos gravam), `404` para `pauta_id` inexistente, `503` sem
      `DATABASE_URL`
- [x] T033 `GET /api/pauta/anexo/<id>` — `200` com `Content-Type`/`Content-Length` gravados;
      **`410 Gone`** quando `bytes IS NULL`; `404` para id inexistente;
      `Cache-Control: private, max-age=3600` (nunca `public`)
- [x] T034 `POST /api/pauta/anexo/<id>/remover` e `/mover` — mesmo padrão de `voltar` e `303`;
      mover troca `ordem` com o vizinho numa transação
- [x] T035 Em `app/quadro.tsx`/`app/editar-card.tsx`: formulário `multipart/form-data` nativo,
      grade de miniaturas com nome e tamanho de cada anexo, setas de reordenar e × de remover,
      e tradução dos códigos `mime`/`tamanho`/`quantidade` em mensagem de tela

**Checkpoint**: US4 entregável. SC-007, SC-008.

---

## Fase 6: US5 — Calendário de publicação (P5)

**Objetivo**: `?vista=calendario` — um mês por vez, card no seu dia.

**Teste independente**: datas em dois meses, navegar entre eles, filtros preservados.

- [x] T036 Em `app/quadro.tsx`: vista de calendário usando `gradeDoMes` e `agruparPorDia`, com
      grade CSS de sete colunas e o canal visível em cada card
- [x] T037 Navegação de mês com `mesVizinho`, preservando os filtros ativos na querystring
      (FR-027) — links, não client component
- [x] T038 Estilos da grade do calendário em `app/globals.css`

**Checkpoint**: US5 entregável. SC-009.

---

## Fase 7: US6 — Documentação de marketing (P6)

**Objetivo**: `?vista=docs` — textos de processo e estudo, fora do fluxo.

**Teste independente**: criar um doc de processo e um de estudo, anexar imagem, conferir que
nenhum aparece no kanban nem no calendário.

- [x] T039 Em `app/quadro-actions.ts`: `tipo = 'doc'` ignora `coluna_id`, `canal` e `data`
- [x] T040 Em `app/quadro.tsx`: vista `docs` — lista de documentos com texto longo e anexos,
      e exclusão de `tipo = 'doc'` das consultas do kanban e do calendário (FR-026)

**Checkpoint**: US6 entregável.

---

## Fase 8: US7 — Liberar o espaço das imagens arquivadas (P7)

**Objetivo**: carência de 30 dias a partir do arquivamento; registro permanente.

**Teste independente**: arquivar com imagens, restaurar dentro da carência, e forçar o vencimento
no banco para ver os bytes sumirem com o registro intacto.

- [x] T041 Em `app/quadro-actions.ts`: `liberarVencidos()` — não é action de formulário; chamada na
      carga das páginas de quadro. **Não pendurar em cron** (R-005)
- [x] T042 Chamar `liberarVencidos()` na carga de `app/marketing/page.tsx` e `app/ideias/page.tsx`
- [x] T043 Em `app/quadro.tsx`: aviso no card arquivado com a data de liberação vinda de
      `dataDeLiberacao()` (FR-031) e botão de restaurar (FR-034)
- [x] T044 Em `app/quadro.tsx`: card com anexos liberados continua legível — título, descrição,
      canal, data, URL da publicação e a lista dos arquivos que existiram com nome, formato,
      tamanho e ordem (FR-033)
- [x] T045 Em `app/quadro.tsx`: contador permanente de espaço no topo da aba, com `resumoDeEspaco`,
      e quantos cards publicados ainda não foram arquivados (FR-036)

**Checkpoint**: US7 entregável. SC-010, SC-011, SC-012.

---

## Fase 9: Fechamento

- [x] T046 `npm test` verde **inteiro** — SC-004
- [x] T047 `npm run build` passando (o deploy é imagem Docker)
- [x] T048 `git status` sem mudança em `app/agenda/*`, `lib/evaluate.ts`, `data/projects.json`,
      `middleware.ts` ou `.github/*` — só `app/tabs.tsx`, `lib/db.ts` e `package.json` entre os
      existentes (mais `app/globals.css`, se os estilos forem necessários — anotar como desvio)
- [x] T049 Commit + push. **Não entre 23:30 e 01:00 BRT nem entre 08:00 e 08:45 BRT** (Princípio IV
      da constituição)

---

## Dependências

```
Fase 1 (T001-T015) ─┬─► US1 (T016-T021) ─┬─► US2 (T022-T025) ─┬─► US3 (T026-T029)
                    │                    │                   ├─► US5 (T036-T038)
                    │                    │                   └─► US6 (T039-T040)
                    └────────────────────┴─► US4 (T030-T035) ──► US7 (T041-T045)
```

- T001–T006 são o mesmo arquivo: sequenciais entre si.
- T007 depende de T001–T006; T008 é independente de tudo menos da existência do arquivo.
- T009–T014 são o mesmo arquivo (`lib/db.ts`): sequenciais. **[P]** com T015 (`app/tabs.tsx`).
- US2, US4 e as vistas compartilham `app/quadro.tsx` — não paralelizar entre si.

## Paralelismo possível

- **T008 [P]** com qualquer coisa (`package.json` isolado)
- **T015 [P]** com T009–T014 (`app/tabs.tsx` isolado)
- **T025 [P]**, **T038 [P]** — `app/globals.css`, mas não entre si
