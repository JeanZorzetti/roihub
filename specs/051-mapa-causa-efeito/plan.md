# Implementation Plan: O mapa de GSC como árvore de causa e efeito

**Branch**: `051-mapa-causa-efeito` (trabalho em `main`, como 034–050) | **Date**: 2026-09-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/051-mapa-causa-efeito/spec.md`

## Summary

Três acréscimos ao `/gsc/mapa` e uma correção em `/okr/atma`, todos sobre funções que já existem:

1. **A cadeia depois do clique (US1).** O mapa chama `dadosDaFicha("atma")` — a MESMA composição de
   `/okr/atma` — e desenha a cadeia com o MESMO `CadeiaDiagrama`. Nenhuma segunda conta, nenhum segundo
   desenho. Um nó "Depois do clique" entra no ramo CLIQUE com a etiqueta `soma`.
2. **Três classes (US2).** `classe` (e `acaoSemanal` nas alavancas) entra no `CATALOGO`, que é a lista
   única de folhas. `mapaDoBoard()` publica a classe como etiqueta e como linha da nota.
3. **A fila 80/20 (US3).** `filaDoMapa()` em `gsc-delta.mjs` monta itens com a `linha()` que já existe e
   os ordena com a `ordenar()` que já existe e ninguém chamava. Em cliques, um item por URL decidida abaixo
   da régua (`conformidadeDeCtr().abaixo` + `cliquesNaoCapturados`). Em pp, a largura de título.
4. **Último orçamento por pessoa (FR-012a/b).** `valorEmRisco()` e `ticketDeOrcamentos()` passam a valer
   cada pessoa pelo orçamento mais recente, com uma função só para as duas.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16 App Router, React 19) + `.mjs` puro, Node 22

**Primary Dependencies**: as instaladas — `mind-elixir` (mapa), `pg`, `google-auth-library`. Nenhuma nova.

**Storage**: nenhum novo. Lê o que já é lido: Search Console ao vivo, `hub_*`, `ATMA_DATABASE_URL`.

**Testing**: `node --test` nos arquivos já registrados — `test/gsc-delta.test.mjs`, `test/board-gsc.test.mjs`,
`test/okr.test.mjs`. Nenhum arquivo de teste novo.

**Target Platform**: container Linux no EasyPanel; dev no Windows.

**Project Type**: aplicação web única (App Router + `lib/`).

**Performance Goals**: o mapa já é `force-dynamic` e leva ~8 s a frio. `dadosDaFicha()` custa ~3,3 s a frio
em `/okr/atma`: ela DISPARA no topo da página e só é aguardada no fim, em paralelo com as leituras do mapa —
nunca em série.

**Constraints**: nenhuma taxa entre janelas diferentes (cliques em 28 dias × cadeia na época); nenhum total
na fila; nenhuma segunda lista de folhas; janelas de push do Princípio IV.

**Scale/Scope**: 1 projeto (Atma), 32 folhas, ~30 URLs, 13 orçamentos de 7 pessoas.

## Constitution Check

*GATE: revisto antes da Fase 0 e depois da Fase 1 — sem violação.*

| Princípio | Como esta feature cumpre |
|---|---|
| I. Contrato único de dados | O mapa chega à Atma por `dadosDaFicha()`, que usa `listProjects()`. Nenhum import de `data/projects.json`. |
| II. `node --test`, registrado à mão | Só amplia arquivos de teste já registrados em `package.json`. |
| III. `.mjs` para lógica pura | Classe, fila e regra do último orçamento nascem em `gsc-delta.mjs`, `board-gsc.mjs` e `okr.mjs`. As `.tsx` só desenham. |
| IV. Push é deploy | Push fora de 23:30–01:00 e 08:00–08:45 BRT. |
| V. Segredo nunca em log | Nenhuma variável nova; nenhum valor de ambiente vai para a tela. |

## Project Structure

### Documentation (this feature)

```text
specs/051-mapa-causa-efeito/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/mapa-e-risco.md
├── checklists/requirements.md
└── tasks.md            # speckit-tasks
```

### Source Code (repository root)

```text
lib/gsc-delta.mjs          # CATALOGO ganha classe/acaoSemanal; CLASSES; filaDoMapa()
lib/board-gsc.mjs          # mapaDoBoard(): etiqueta, nota e metadata da classe
lib/okr.mjs                # ultimoPorPessoa(); valorEmRisco() e ticketDeOrcamentos() usam
lib/ficha.mjs              # rótulo do ticket (por pessoa, pelo último orçamento)
app/gsc/mapa/page.tsx      # painel: cadeia + fila + legenda; nó "Depois do clique"; etiqueta soma
app/okr/[slug]/risco.tsx   # rótulos: enviado conta documento; aberto/perdido pelo último orçamento
test/gsc-delta.test.mjs    # classes válidas; fila ordenada por moeda, sem total, com o que fica fora
test/board-gsc.test.mjs    # contrato de etiquetas: procedência, classe, divergência
test/okr.test.mjs          # último orçamento por pessoa no risco e no ticket
```

**Structure Decision**: aplicação única. Nenhum arquivo novo de código: tudo entra onde a lógica vizinha já
mora. `CadeiaDiagrama` é importado de `app/okr/[slug]/celulas.tsx` sem ser movido.

## Complexity Tracking

Nenhuma violação a justificar.
