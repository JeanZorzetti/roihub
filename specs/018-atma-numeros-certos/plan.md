# Implementation Plan: Nenhum número da `/okr/atma` está errado

**Branch**: `018-atma-numeros-certos` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-atma-numeros-certos/spec.md`

## Summary

Três defeitos de LEITURA, não de forma: a janela do GSC cobra do banco próprio e joga fora 60% do
que existe (51 leads viram 20), o ticket declarado (R$ 4.000) vence o apurado líquido
(R$ 4.932,34) e faz a meta dizer 12,5 vendas em vez de 10,1, e a cadeia gasta uma linha com
`contatado` — degrau de 100% declarado — enquanto o degrau que decide (`respondeu`, 21 de 51,
derivado de `motivo <> 'sem_resposta'`) nunca apareceu na tela.

Abordagem técnica: **nenhum coletor novo, nenhuma dependência nova, nenhuma chamada de rede
nova.** Três janelas nomeadas passam a morar num `lib/janelas.mjs` puro; a de Conversão passa a
ser `epoca → hoje` para projeto que declara `epoca` no card (só a `atma`), e as outras duas
continuam 28d/D-3 até a 019. O SELECT de `orcamentos` ganha duas colunas que sempre existiram
(`preco`, `desconto_vista`), `PERFIS.D.marcos` troca `visitante`/`contatado` por `respondeu`, e a
célula `não apurado` ganha um campo `rotuloBuraco` **opcional** — sem rótulo, comportamento
idêntico ao de hoje nos 72 call sites que ninguém revisou.

## Technical Context

**Language/Version**: TypeScript 5.9 (borda) + JavaScript ESM `.mjs` (lógica pura), Node 22

**Primary Dependencies**: Next 16 (App Router), React 19, `pg`, `google-auth-library` — **nenhuma
nova**. Proibido framework de teste (Princípio II).

**Storage**: Postgres da Atma via `ATMA_DATABASE_URL` (somente leitura: `patient_leads`,
`orcamentos`), Postgres do hub via `DATABASE_URL` (agenda/CRM), GSC e GA4 Data API por HTTP.
**Nenhuma migração, nenhum DDL, nenhuma escrita** nesta spec.

**Testing**: `node:test` + `assert/strict`, arquivos `test/*.test.mjs`, lista explícita em
`package.json` (`test/validade.test.mjs` compara lista × diretório nos dois sentidos).

**Target Platform**: Next 16 server components em Docker/Alpine no EasyPanel; dev em Windows.

**Project Type**: aplicação web única (sem `src/`, sem monorepo) — `app/` telas, `lib/` lógica,
`test/` testes, `scripts/` corridas manuais.

**Performance Goals**: `/okr/atma` continua com as mesmas 4 chamadas de rede em `Promise.all` +
2 queries na mesma conexão da Atma. Suíte de testes ≤ ~2 s (hoje ~1,6 s).

**Constraints**:
- Módulo de janela **puro**: sem env, sem banco, sem rede, sem relógio além do parâmetro (FR-001).
- `lib/projecao.mjs` não ganha regra nova (FR-034) — recebe o ticket já resolvido.
- Os **16 projetos sem `epoca` saem com os mesmos números de antes** (FR-006, SC-007).
- Nenhuma estrutura visual nova (FR-035): primeira dobra, `/okr/atma/metodo` e
  `/okr/atma/aquisicao` são a 019; réguas e `DELETE` de `market_benchmarks` são a 020.

**Scale/Scope**: 17 cards curados, 1 com fonte própria (`atma`), 51 leads e 7 orçamentos na época.
7 arquivos de `lib/`, 2 telas, 1 script, 6 arquivos de teste.

## Constitution Check

*GATE: passar antes da Fase 0; revalidado após a Fase 1.*

| # | Princípio | Como esta feature cumpre | Veredito |
|---|---|---|---|
| I | Contrato único de dados | `epoca` e `declaracoes` entram como campos de `Project` em `lib/projects.ts` e chegam às telas por `listProjects()`. Nenhum novo import de `data/projects.json` fora de `lib/projects.*`. | ✅ |
| II | `node --test`, registrado à mão | Um arquivo de teste novo (`test/janelas.test.mjs`) + 5 existentes tocados. O novo entra em `package.json` **no mesmo commit**; `test/validade.test.mjs` reprova se esquecerem. Nenhum framework instalado. | ✅ |
| III | `.mjs` para lógica pura | Janelas, ticket apurado, `respondeu`, piso e rótulo de buraco nascem em `.mjs` (`janelas`, `okr`, `funil`, `ficha`). `lib/okr-coleta.ts` continua só SQL + rede; `lib/ga4.ts` só perde um item de catálogo. | ✅ |
| IV | Push é deploy | Sem push em 23:30–01:00 e 08:00–08:45 BRT. Nada aqui altera `maxDuration` nem o autopublishing. | ✅ |
| V | Ambiente explícito, segredo nunca em log | Nenhuma variável nova. `ATMA_DATABASE_URL` já é validada **pelo nome** em `lerFontePropria()`; a época é data no card, não env. | ✅ |
| — | Sem linter/formatter, sem dependência nova | Zero pacote adicionado; estilo copiado do arquivo vizinho. | ✅ |
| — | Comentário explica o porquê, com o fato medido | Cada mudança carrega o número que a motivou (51 × 20, 4.932,34 × 4.000, 21/51, 17 × 51). | ✅ |

**Violações**: nenhuma. A tabela de Complexity Tracking fica vazia de propósito.

**Nota sobre a R7** (uma janela só para a árvore inteira): a R7 é regra **da spec 009**, não da
constituição. A 018 a substitui explicitamente por "cada cadeia lê a janela que a fonte tem, e
nenhuma taxa cruza cadeias" (FR-007/FR-008). Não há gate constitucional a justificar.

### Re-check pós-Fase 1

Repetido após `data-model.md` e `contracts/`: nenhum artefato de design introduz dependência,
framework de teste, import direto de `data/projects.json`, lógica testável em `.ts`, variável de
ambiente nova ou log de segredo. **Continua ✅, sem entradas em Complexity Tracking.**

## Project Structure

### Documentation (this feature)

```text
specs/018-atma-numeros-certos/
├── spec.md              # a especificação (já escrita)
├── plan.md              # este arquivo
├── research.md          # Fase 0 — as 10 decisões de implementação
├── data-model.md        # Fase 1 — campos de card, células, marcos, janelas
├── contracts/           # Fase 1 — os 4 contratos de módulo
│   ├── janelas-mjs.md
│   ├── cadeia-d.md
│   ├── ticket.md
│   └── rotulo-buraco.md
├── quickstart.md        # Fase 1 — como reproduzir e validar os números
└── tasks.md             # Fase 2 — /speckit-tasks, NÃO criado aqui
```

### Source Code (repository root)

```text
lib/
├── janelas.mjs          # NOVO — DESCOBERTA/COMPORTAMENTO/CONVERSAO, puro (FR-001..FR-006)
├── funil.mjs            # `naoApurado()` ganha rótulo opcional; `razao()` intocada (FR-028)
├── okr.mjs              # PERFIS.D (respondeu), celulaDeResposta, ticketDeOrcamentos,
│                        #   REGUA órfã fora de cena, fatores remapeados (FR-011..FR-021)
├── ficha.mjs            # resolverTicket, nota de contato, piso na taxa, lista de buracos,
│                        #   abandono = form_start − lead na época (FR-022..FR-033)
├── okr-coleta.ts        # SELECT +preco +desconto_vista; janela por cadeia (FR-003, FR-020)
├── ga4.ts               # `form_submit` sai de EVENTOS_D3 (FR-032)
├── arvore-metas.mjs     # camada de impressões só com cadeia que tem `visitante` (FR-007)
├── benchmark.mjs        # REGUA.D perde `lead→contatado` e `visitante→lead` (FR-019)
└── projects.ts          # Project ganha `epoca` e `declaracoes` (FR-004, FR-025)

app/okr/
├── page.tsx             # janela POR LINHA + aviso na frase de resumo (FR-009)
└── [slug]/page.tsx      # ticket resolvido antes de projetar(); janela por cadeia (FR-008)

scripts/
└── funil.mjs            # passa a importar lib/janelas.mjs (FR-001)

test/
├── janelas.test.mjs     # NOVO — janelas, época, não-regressão dos 16 (SC-007)
├── okr.test.mjs         # cadeia nova, respondeu, ticket apurado, A/B travados (SC-003, SC-004)
├── ficha.test.mjs       # piso, nota de contato, rótulo de buraco, abandono (SC-005, SC-006)
├── projecao.test.mjs    # 10,1 e não 12,5 (SC-002)
├── benchmark.test.mjs   # nenhuma linha da RÉGUA aponta para degrau fora da cadeia (SC-003)
└── arvore-metas.test.mjs# a árvore para no fim da cadeia de Conversão (FR-007)

data/projects.json       # card `atma`: epoca + declaracoes.tratamento
handoff/                 # linha de base da SC-000 + backlog de status_historico (FR-031)
```

**Structure Decision**: nenhuma estrutura nova. O repo é uma aplicação Next 16 única, com a
separação `.mjs` (puro, testável sem subir o Next) × `.ts` (borda: `pg`, `google-auth-library`,
componentes) que o Princípio III fixa. Toda regra desta spec cabe em `lib/*.mjs`; o único `.ts`
tocado por regra é `lib/projects.ts` (dois campos de tipo) e `lib/okr-coleta.ts` (duas colunas no
SELECT e a escolha de qual janela cada fonte recebe) — as duas mudanças são de borda, não de
regra. O único arquivo novo é `lib/janelas.mjs`, exigido literalmente pela FR-001 porque hoje
existem **duas** definições de janela no repo (`lib/okr-coleta.ts` e `scripts/funil.mjs`) que
divergiriam na primeira spec que mexer em uma delas.

## Complexity Tracking

> Vazia: o Constitution Check passou sem violações.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
