# Tasks — 055 Marcar a alavanca como feita e ver todos os degraus

Testes antes do código em cada fase (Princípio II). Tudo em `test/proxima-acao.test.mjs`, já registrado.

## Fase 1 — US1: os cinco degraus

- [x] T001 [US1] Teste: `plano(ds)` do Sirius devolve 5 degraus em ordem; `desempenho` com
  `estado: "vazio"`, `contagem.semLeitura === 5`, `semDisparo === 0`, e o motivo da CrUX agrupado com
  LCP, INP, CLS e TTFB. Reescrever o teste de 22/09 que exigia 4 degraus.
- [x] T002 [US1] Teste: degrau vazio só com folhas sem disparo diz `semDisparo` = total e `semLeitura` 0; o
  `checklistGsc` (regra nula) não entra em degrau nenhum.
- [x] T003 [US1] `lib/proxima-acao.mjs#plano`: 5 degraus sempre, `estado`, `contagem`,
  `semLeituraPorMotivo`, e `primeira`.
- [x] T004 [US1] `page.tsx`: desenhar o degrau vazio numa linha e usar `primeira` no lugar de
  `gi === 0 && i === 0`; tirar os degraus do rodapé "Sem ação:".

## Fase 2 — US2 e US3: a marca

- [x] T005 [US2] Teste: `lerMarca` (datas por `addDaysISO` da agenda) (aceita o válido; recusa slug, alavanca,
  responsável, dias e leituras fora do contrato).
- [x] T006 [US2] Teste: marca no prazo → entrada `aguardando` no fim do degrau, `naMarca` por motivo,
  degrau todo marcado vira `aguardando`, `primeira` pula para o degrau 3 no Sirius.
- [x] T007 [US3] Teste: marca vencida e ainda disparando → `voltou`, na ordem normal, e pode ser a
  `primeira`; marca de alavanca que não dispara → entrada some; leitura que falhou → entrada fica com
  `leituraFalhou`; motivo novo → `novo: true`; marca de alavanca inexistente → ignorada.
- [x] T008 [US2] `lib/proxima-acao.mjs`: `lerMarca`, `textoDoDegrauVazio`, marcas no `plano`.
- [x] T009 [US2] `lib/db.ts`: tabela `hub_mapa_marca` no `ensure()`; `listMarcas`, `setMarca`,
  `delMarca`.
- [x] T010 [US2] `app/gsc/mapa/[slug]/actions.ts`: `marcar`, `desmarcar`.
- [x] T011 [US2] `page.tsx`: ler as marcas, passar `{marcas, hoje}` ao `plano`, forms de marcar e
  desfazer, texto das entradas aguardando e voltou.
- [x] T012 [US2] `app/globals.css`: `.mapa-acao-aguardando`, `.mapa-degrau-vazio`, `.mapa-marca`
  com contraste ≥ 4,5:1 (sem `opacity`).

## Fase 3 — Entrega

- [x] T013 `npm test` verde; `tsc --noEmit` sem erro nos arquivos tocados.
- [x] T014 Commit e push fora das janelas do Princípio IV.
- [x] T015 Quickstart em produção: 5 degraus, marca das duas entradas do degrau 1 do Sirius, Atma
  sem marca, desfazer, passagem de teclado.
