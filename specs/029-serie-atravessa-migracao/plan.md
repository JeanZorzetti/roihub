# Implementation Plan: A série atravessa a migração de domínio

**Branch**: `029-serie-atravessa-migracao` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/029-serie-atravessa-migracao/spec.md`

## Summary

A corrida diária da série passa a medir **o conjunto de hosts que o card declara** (`hostsDeclarados`,
a mesma régua que o bloco de GA4 desta tela já usa) em vez do host da `url` atual, e grava a soma do
dia. A coluna `host` deixa de guardar um host e passa a guardar a **assinatura da soma** — os hosts
somados, ordenados e unidos por `+`. A guarda da 026 muda de "mesmo host" para "todos os hosts
gravados estão entre os declarados", o que preserva a proteção contra sobrescrita por um site
estranho (FR-006, FR-015) e libera a regravação legítima dos dias da transição.

Do lado da leitura, `segmentosPorHost` e `semanasNaoMarca` passam a receber os hosts declarados e
param de cortar a série quando a assinatura muda **dentro** desse conjunto: a série volta a ser uma
só, a semana da troca volta a ter valor, e o corte que a tela já desenha vira a marca datada da
fronteira em vez de um divisor de vereditos.

## Technical Context

**Language/Version**: Node 22, TypeScript 5 / Next.js 16 (App Router), React 19

**Primary Dependencies**: `google-auth-library` (Search Console), `pg` (Postgres). Nenhuma nova.

**Storage**: Postgres, tabela `hub_gsc_dia`, PK `(projeto, dia)` — **inalterada**

**Testing**: `node --test` sobre `test/*.test.mjs`, registrado à mão em `package.json` (Princípio II)

**Target Platform**: Linux/Alpine em Docker no EasyPanel; dev em Windows

**Project Type**: aplicação web única (Next.js), com rotas de cron disparadas pelo GitHub Actions

**Performance Goals**: a corrida vai de 1 para N consultas por projeto por perna, com N = hosts
declarados (hoje 2, e só na Atma). Total: de 4 para 8 requisições ao GSC por corrida. A rota tem
`maxDuration = 300` e gastava segundos — a folga é de ordens de grandeza.

**Constraints**: nenhuma migração destrutiva; os 248 dias gravados antes da troca não podem mudar de
valor (SC-005). Nenhum segredo em log (Princípio V).

**Scale/Scope**: 1 projeto afetado hoje (Atma, único com `dominioAnterior`); a regra vale para
qualquer projeto que declare um.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como esta feature o respeita |
|---|---|
| I. Contrato único de dados | A corrida segue lendo `projetosDeBusca()`; `hostsDeclarados()` já mora em `lib/projects.mjs` e é a única porta para a declaração de site. Nenhum import novo de `data/projects.json`. |
| II. `node --test` registrado à mão | Três arquivos de teste novos, todos acrescentados a `package.json` no mesmo commit. Nenhum framework. |
| III. `.mjs` para lógica pura | Toda a lógica nova (soma dos hosts, posição ponderada, assinatura, pertinência ao conjunto declarado) nasce em `lib/serie-gsc.mjs` e `lib/marca.mjs`. A rota `.ts` só orquestra rede e banco. |
| IV. Push é deploy | Entrega fora de 23:30-01:00 e 08:00-08:45 BRT. `maxDuration` não muda, então o proxy do EasyPanel não precisa de ajuste. |
| V. Ambiente explícito | A rota já valida `DATABASE_URL` e `GOOGLE_SERVICE_ACCOUNT_JSON` na entrada e responde 503 só com nomes. Nada a mudar. |

**Resultado: PASS.** Nenhuma violação, `Complexity Tracking` fica vazia.

## Project Structure

### Documentation (this feature)

```text
specs/029-serie-atravessa-migracao/
├── plan.md              # este arquivo
├── research.md          # as 5 decisões e o que foi medido para cada uma
├── data-model.md        # o que muda em hub_gsc_dia (e o que não muda)
├── quickstart.md        # como rodar, corrigir o histórico e conferir
├── contracts/
│   └── funcoes.md       # assinaturas puras e o JSON da corrida
└── tasks.md             # saída do /speckit-tasks
```

### Source Code (repository root)

```text
lib/
├── serie-gsc.mjs        # + somarSeriesPorHost(), assinaturaDeHosts(), dentroDoDeclarado()
├── marca.mjs            # ~ segmentosPorHost(dias, declarados), semanasNaoMarca(dias, declarados)
├── projects.mjs         # hostsDeclarados() — reusada, sem alteração
├── gsc.ts               # gscSeries()/gscSerieFiltrada() — reusadas por host, sem alteração
└── db.ts                # ~ guarda de host em gravarDiasGsc() e gravarMarcaGsc()

app/
├── api/gsc-serie/route.ts          # ~ laço por host, soma, relato de host encerrado, `desde`
└── okr/[slug]/aquisicao/page.tsx   # ~ passa os declarados para a leitura; copy da fronteira

test/
├── serie-soma-hosts.test.mjs       # novo
├── marca-segmento-declarado.test.mjs  # novo
└── serie-migracao-regressao.test.mjs  # novo
```

**Structure Decision**: nenhuma pasta nova. A feature mexe em quatro arquivos existentes de `lib/`,
uma rota, uma página e três testes novos — a mesma topografia das specs 021, 025 e 026, que são as
donas do código tocado aqui.

## Fases

### Fase 0 — Pesquisa

Cinco decisões, todas com o fato medido que as sustenta, em [research.md](./research.md):

1. Por que somar em vez de concatenar segmentos.
2. Onde a soma mora (função pura em `.mjs`).
3. Como a coluna `host` passa a representar um conjunto sem migração de schema.
4. Como a guarda da 026 sobrevive à mudança.
5. Como o histórico da transição é corrigido sem script paralelo à rota.

### Fase 1 — Desenho

- [data-model.md](./data-model.md): `hub_gsc_dia` sem DDL nova; a semântica de `host` passa de "o
  host medido" para "os hosts somados". Compatível para trás: uma linha antiga é um conjunto de um.
- [contracts/funcoes.md](./contracts/funcoes.md): assinaturas das funções puras e o JSON que a
  corrida devolve, com os dois campos novos (`somados`, `encerrados`).
- [quickstart.md](./quickstart.md): a ordem de execução e as três conferências que fecham a entrega.

### Fase 2 — Tarefas

Sai do `/speckit-tasks`. A ordem obrigatória é P1 (parar a hemorragia) → P3 (corrigir o histórico) →
P2 (a tela), porque a tela lida sobre dado errado só publicaria o erro mais rápido.

## Ordem de execução e por quê

1. **Escrita primeiro (US1)**: enquanto a corrida grava 3% da realidade, todo dia que passa é mais
   um dia para corrigir depois.
2. **Histórico depois (US3)**: só faz sentido corrigir para uma régua que já existe.
3. **Leitura por último (US2)**: a tela contínua sobre dados corrigidos é a entrega; a tela contínua
   sobre dados errados é uma queda de 97% desenhada com mais capricho.

## Riscos e o que os contém

| Risco | Contenção |
|---|---|
| A soma inflar dia anterior à troca | A propriedade nova do GSC não backfilla: medido, zero impressão antes de 14/09. Teste de regressão compara os 248 dias antes e depois (SC-005). |
| Falha parcial de uma propriedade virar queda | FR-004: nenhum dia é gravado se um host declarado FALHAR. Só a ausência estrutural (sem propriedade) segue com os demais, e é relatada (FR-004a). |
| A guarda afrouxar demais | A pertinência é ao conjunto DECLARADO, não a qualquer host. Host fora da declaração continua barrado, e é o teste que prova a 026 viva. |
| Duplo cômputo com `www.` | `hostsDeclarados` já deduplica; a assinatura normaliza e ordena antes de unir (FR-013). |

## Complexity Tracking

Sem violações da constituição. Nada a justificar.
