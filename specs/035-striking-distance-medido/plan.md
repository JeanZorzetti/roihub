# Implementation Plan: Striking Distance medido no board

**Branch**: `035-striking-distance-medido` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/035-striking-distance-medido/spec.md`

## Summary

A folha `strikingDistance` do mapa ganha o nó `Medido:`, alimentado pela leitura por **termo** que a
página já faz para a folha vizinha — zero requisição nova. A medida nasce como função irmã em
`lib/kpis-busca.mjs`, com a guarda de marca operando sobre o campo que essa leitura devolve, e com
uma trava que impede a forma de linha errada de virar número. `MEDIDO_POR` passa a apontar para o
coletor que a tela usa de fato.

## Technical Context

**Language/Version**: Node 22, Next.js 16 (App Router), React 19
**Primary Dependencies**: nenhuma nova — nem sequer `google-auth-library` é tocada
**Storage**: nenhuma — a medida é derivada em render, sem tabela e sem arquivo
**Testing**: `node --test`, em `test/kpis-busca.test.mjs`, que **já** está registrado no `package.json`
**Target Platform**: Docker/EasyPanel, `output: "standalone"`
**Project Type**: single (Next.js app com `lib/` puro em `.mjs`)
**Performance Goals**: **zero** requisição adicional ao Search Console por render (SC-003)
**Constraints**: a rota já é `force-dynamic` desde a 033 — a credencial não existe no build
**Scale/Scope**: 1 folha do board; 0 arquivo novo, 4 tocados

### A decisão técnica que carrega a feature: por que uma função irmã, e não um parâmetro

`strikingDistance()` existe e está correta — para a forma de linha dela. Há três formas de ligar a
folha, e duas são armadilhas:

| caminho | o que acontece |
|---|---|
| passar as linhas por termo para `strikingDistance()` | compila, mede 347, **guarda de marca desligada**: `c.query` é `undefined` e a marca sobe ao topo da fila com 70 dos 113 cliques |
| mapear `{termo} → {query}` no chamador | funciona **desta vez**, e repõe a guarda no chamador — o padrão que este repositório já pagou seis vezes (`guarda no chamador volta pela porta seguinte`) |
| **função irmã que lê `termo`** | a forma certa é a assinatura; quem passar a forma errada não compila um número |

A terceira é o precedente vivo do repositório: a 034 criou `penetracaoNoTop3` ao lado de
`impressoesNoTop3` em vez de parametrizar uma das duas, e escreveu no próprio corpo por quê
(`lib/kpis-busca.mjs:195`). Mesma razão, mesma forma.

**A trava da FR-004.** Só a assinatura não basta em JavaScript: `strikingDistancePorTermo()` chamada
com linhas de `query`+`page` leria `l.termo === undefined` e devolveria zero com ar de medida. A
função valida a forma **uma vez**, no topo: se nenhuma linha carrega `termo` como string, devolve
`null` — não um número. A tela nomeia esse estado. O teste alimenta a função com a forma errada e
exige `null`; um número ali reprova a suíte (SC-005).

### O que esta feature NÃO faz

- **Não toca `strikingDistance()`.** Ela está certa para `query`+`page`, é o que
  `/okr/atma/aquisicao` consome, e nenhum chamador a alimenta com a forma trocada hoje. Blindá-la
  contra um defeito que não existe é código especulativo — e mudar o retorno dela para `null` em
  algum caminho quebraria `kpis.strikingDistance.lista.length` naquela página.
- **Não cria arquivo de teste novo.** `test/kpis-busca.test.mjs` já existe e já está na lista do
  `package.json`; os casos entram nele. Sem arquivo novo, o Princípio II é satisfeito sem editar
  `package.json`.
- **Não altera a faixa, o balizador, nem a meta.** `[4, 11)` é reusada, `balizador.tipo` segue
  `recusa`, e a folha segue `◇ sem fonte`.
- **Não sincroniza os números das duas telas.** Board mede consultas (344), `/okr` mede pares
  consulta×página (362). A nota declara a diferença (FR-007); igualá-las exigiria uma das duas
  medir a grandeza errada.

## Constitution Check

*GATE: passou antes da Fase 0 e revalidado após a Fase 1.*

| Princípio | Como esta feature se comporta |
|---|---|
| **I. Contrato único de dados** | Nenhum import de `data/projects.json` acrescentado. A página já obtém a Atma por `listProjects()` e já calcula `hostsDeclarados()`; a feature reusa as duas variáveis existentes, não abre fonte nova. |
| **II. `node --test` registrado à mão** | Nenhum arquivo de teste novo: os casos entram em `test/kpis-busca.test.mjs`, já registrado. `test/validade.test.mjs` continua verde sem edição em `package.json`. |
| **III. `.mjs` puro, `.ts` só na borda** | `strikingDistancePorTermo()` nasce em `lib/kpis-busca.mjs` — pura, testável sem subir o Next. Nada de lógica nova em `.ts`: `app/gsc/mapa/page.tsx` só formata e escolhe estado. |
| **IV. Push é deploy** | Nenhum push em 23:30–01:00 nem 08:00–08:45 BRT. Nenhuma alteração de `maxDuration`. |
| **V. Ambiente explícito, segredo nunca em log** | Nenhuma variável nova, nenhuma leitura nova de env. A medida consome uma leitura que a página já fez. |

Nenhuma violação. **Complexity Tracking vazio.**

## Project Structure

### Documentation (this feature)

```text
specs/035-striking-distance-medido/
├── spec.md              # feature specification
├── plan.md              # este arquivo
├── research.md          # as alternativas medidas antes de decidir
├── data-model.md        # o contrato da medida e os cinco estados da tela
├── quickstart.md        # como conferir que está no ar
├── checklists/
│   └── requirements.md
└── tasks.md             # saída do /speckit-tasks
```

### Source Code (repository root)

```text
lib/
├── kpis-busca.mjs       # TOCADO: + strikingDistancePorTermo() (função irmã, pura)
└── gsc-delta.mjs        # TOCADO: MEDIDO_POR.strikingDistance aponta para o coletor real

app/gsc/mapa/
└── page.tsx             # TOCADO: + nó `strikingDistance-medido`, + topicDoStriking/noteDoStriking

test/
└── kpis-busca.test.mjs  # TOCADO: casos da faixa, da guarda de marca e da forma de linha errada
```

Nenhum arquivo novo. Nenhuma dependência nova. Nenhuma migração.

## Phase 0 — Research

Ver [research.md](./research.md). As três perguntas que precisavam de número antes de virar decisão
(dimensão, escopo do numerador, piso de impressões) foram medidas contra o Search Console real em
20/09/2026, não estimadas.

## Phase 1 — Design

Ver [data-model.md](./data-model.md) — a forma do retorno, os cinco estados da tela e a regra de
ausência. Ver [quickstart.md](./quickstart.md) — o roteiro de verificação.

**Revalidação do Constitution Check após a Fase 1**: sem mudança. O desenho não introduziu arquivo
de teste, dependência, variável de ambiente nem fonte de dados de projeto.
