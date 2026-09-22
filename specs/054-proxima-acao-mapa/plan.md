# Implementation Plan: A próxima ação de cada KPI no mapa de GSC

**Branch**: `main` (push é deploy, como 051–053) | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/054-proxima-acao-mapa/spec.md`

## Summary

Um módulo puro novo, `lib/proxima-acao.mjs`, guarda as 32 regras "se X, fazer Y" (uma por folha do
catálogo), as 13 alavancas e os 5 degraus da ordem de ataque. A página do mapa passa a registrar a
leitura que já calcula em cada bloco num objeto `leituras`, chama `avaliar()` e `plano()`, pendura
uma etiqueta de estado em cada uma das 32 folhas e troca o bloco "Primeiro na fila" por "O que fazer
primeiro". Zero leitura nova de fonte; `filaDoMapa()` continua sendo chamada e passa a ordenar os
alvos dentro das entradas (Q2).

## Technical Context

**Language/Version**: JavaScript ESM (`.mjs`) + TypeScript na borda, Node 22

**Primary Dependencies**: Next.js 16 (App Router), React 19, `mind-elixir` 5.15.1 (já instalado)

**Storage**: N/A — nenhuma tabela nova; as leituras vêm de `hub_indexacao`, `hub_pagina`,
`hub_gsc_dia`, Search Console e CrUX, já lidas pela página

**Testing**: `node --test` + `assert/strict`, arquivo registrado à mão em `package.json`

**Target Platform**: container Linux (EasyPanel), rota `force-dynamic`

**Project Type**: web app (Next.js) com lógica pura em `lib/*.mjs`

**Performance Goals**: zero requisição externa nova (SC-005); o custo novo é O(32) por abertura

**Constraints**: push fora de 23:30–01:00 e 08:00–08:45 BRT (Princípio IV); nenhum selo novo
(research D3); ◇ nunca com glifo de veredito (FR-006)

**Scale/Scope**: 32 folhas, 13 alavancas, 5 degraus; pior caso real 16 disparos (Sirius, 22/09)

## Constitution Check

| Princípio | Como a 054 cumpre |
|---|---|
| I. Contrato único de dados | não lê projeto; usa `projetosDeBusca()` que a página já usa |
| II. `node --test` registrado | `test/proxima-acao.test.mjs` entra em `package.json` no mesmo commit |
| III. `.mjs` para lógica pura | regras, avaliação, etiqueta e plano em `lib/proxima-acao.mjs`; a página só monta e desenha |
| IV. Push é deploy | push fora das janelas; conferência em produção depois de ~15 min |
| V. Ambiente explícito | nenhuma variável nova; nenhum segredo tocado |

Gate: **passa**. Reavaliado depois do desenho: passa (nenhuma dependência nova, nenhuma rota nova).

## Project Structure

### Documentation (this feature)

```text
specs/054-proxima-acao-mapa/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/proxima-acao.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
lib/proxima-acao.mjs              # NOVO — regras, alavancas, degraus, avaliar, etiqueta, plano
test/proxima-acao.test.mjs        # NOVO — registrado em package.json
app/gsc/mapa/[slug]/page.tsx      # leituras{} por bloco; etiquetas nas folhas; bloco novo no lugar da fila
app/globals.css                   # 3 classes no escopo do bloco (se o markup da fila não bastar)
GLOSSARIO.md                      # termos novos: Próxima ação, Sem ação, Meta do board sem fonte, Degrau
handoff/gsc-template-de-melhoria.md  # vira ponteiro, sem limiar (research D11)
```

**Structure Decision**: um módulo puro + uma página existente. Nenhum componente novo: o bloco reusa
`ficha-bloco`, `mapa-fila` e `mb-tag`, que já têm estilo no escopo `[data-info="gsc"]`.

## Complexity Tracking

Nenhuma violação a justificar.
