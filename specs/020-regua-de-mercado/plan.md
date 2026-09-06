# Implementation Plan: 020 — a régua de mercado da Atma

**Branch**: `020-regua-de-mercado` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-regua-de-mercado/spec.md`

---

## Summary

Pesquisar os seis degraus candidatos a régua de mercado da Atma e **registrar o veredito de cada um**
— faixa com fonte clicável onde existe, recusa com motivo específico onde não existe — e substituir as
12 linhas sem fonte de `market_benchmarks` na base da Atma, que hoje alimentam uma tela de admin que
compara o funil real contra números inventados.

**A pesquisa já foi feita** (Fase 0, `research.md`) e o resultado governa o resto do plano:

> Seis vereditos. **Uma** linha publicável — e ela é de aquisição, cuja exibição a D2 mandou para a
> 022. A cadeia de Conversão da Atma fica com **três recusas e zero linhas**.

Isso não é falha de implementação: é a confirmação medida do que `lib/benchmark.mjs` já afirmava sem
provar. O que a 020 entrega na ficha, portanto, **não é uma comparação — é o motivo específico de cada
ausência**, no lugar de uma frase genérica repetida. Valor concreto: quem pesquisar "case acceptance
rate" acha **45%** em cinco minutos e conclui que seus 0% são catástrofe; a recusa escrita explica por
que aquele número não é a régua dele.

---

## Technical Context

**Language/Version**: JavaScript ESM (`.mjs`) para lógica pura, TypeScript na borda do Next. Node 22.
No app da Atma: CommonJS/Express (Node), Next.js no admin.

**Primary Dependencies**: nenhuma nova, dos dois lados. `pg` já existe no roihub; `express` e
`executeQuery` já existem na Atma. **Adicionar dependência para isto seria injustificável.**

**Storage**: `REGUA` é constante em código (`lib/benchmark.mjs`), não banco. `market_benchmarks` é
Postgres na base da Atma, alcançada por `ATMA_DATABASE_URL`.

**Testing**: `node --test` com `node:test` + `assert/strict`, arquivos `test/*.test.mjs` registrados à
mão em `package.json` (Princípio II). **Nenhum framework.** `test/benchmark.test.mjs` já existe e já
está registrado.

**Target Platform**: roihub — Next 16 em Docker/EasyPanel, deploy por push em `main`. App da Atma —
backend Express + admin Next, deploy próprio.

**Project Type**: web (dois repositórios, ver Structure Decision).

**Performance Goals**: N/A. `REGUA` é tabela estática lida em memória; nenhum caminho quente.

**Constraints**:
- A linha de ausência na ficha continua sendo **UMA** linha — a 019 mediu 801px a 1280×800 com três
  linhas de prosa, 1px abaixo da dobra.
- Janela de push proibida: 23:30–01:00 e 08:00–08:45 BRT (Princípio IV).
- `metric_value` é `numeric NOT NULL` — confirmado no `information_schema`.

**Scale/Scope**: 3 entradas novas em `REGUA.D` · ~6 linhas em `market_benchmarks` (de 12) · 1 branch
de renderização alterado · 1 migration na Atma · 1 guarda de escrita · ~8 testes novos.

---

## Constitution Check

*GATE: passa antes da Fase 0; revalidado após a Fase 1.*

| Princípio | Aplicável? | Como o plano satisfaz | Status |
|---|---|---|---|
| **I — Contrato único de dados** (`listProjects()` é o único ponto de leitura de projetos; ninguém importa `data/projects.json` direto) | Sim, tangencialmente | A 020 não lê projetos. Não acrescenta fonte de dados de projeto nem importa o JSON. | ✅ passa |
| **II — Teste é `node --test`, registrado à mão** | **Sim, central** | Testes novos vão em `test/benchmark.test.mjs`, **já registrado** em `package.json`. Nenhum arquivo de teste novo → nada a registrar. Nenhum framework instalado. | ✅ passa |
| **III — `.mjs` para lógica pura, `.ts` só na borda** | **Sim, central** | Toda a lógica (`REGUA`, `leituraDoDegrau`, `faixaDoSpan`) já é `.mjs` e continua. Só o branch de render em `app/okr/[slug]/page.tsx` é `.ts` — é borda do Next, correto. | ✅ passa |
| **IV — Push é deploy; janela noturna intocável** | **Sim** | Push fora de 23:30–01:00 e 08:00–08:45 BRT. O quickstart (Passo 9) manda esperar ~15 min e conferir **duas** vezes. | ✅ passa |
| **V — Ambiente explícito, segredo nunca em log** | **Sim** | `ATMA_DATABASE_URL` lido de `.env`, **nunca impresso** — os probes desta sessão imprimiram só resultados. A recusa de escrita da Atma responde `400` nomeando a **regra**, nunca valor de ambiente. | ✅ passa |

**Restrições técnicas da constituição**:

- *Sem linter/formatter* → seguir o estilo do arquivo vizinho. `lib/benchmark.mjs` tem estilo próprio
  e denso; as entradas novas o imitam.
- *Comentário explica o porquê, com o fato medido* → cada recusa carrega o número descartado e a
  razão. Comentário que narra o que a linha faz é ruído e não entra.
- *Dev é Windows, produção é Linux* → nada aqui depende de `spawn`.

**Portões antes do merge em `main`**: (1) `npm test` verde inteiro; (2) nenhum arquivo de teste novo a
registrar; (3) nenhum import de `data/projects.json`; (4) nenhum segredo em log ou resposta. Os quatro
estão cobertos.

### Revalidação pós-Fase 1

Nenhum artefato da Fase 1 introduziu violação. **Um ponto merece registro explícito, e não é
violação**: a spec toca um **segundo repositório** (`C:\dev\atma`). A constituição do roihub não
governa aquele repo — o trabalho lá segue as convenções dele (Express, `migrations/*.sql` numeradas).
A fronteira está declarada na D1 da spec e não é ambígua.

---

## Project Structure

### Documentation (this feature)

```text
specs/020-regua-de-mercado/
├── plan.md                              # este arquivo
├── spec.md                              # o quê e o porquê, com D1/D2/D3 e as clarificações
├── research.md                          # Fase 0 — os seis vereditos, com fontes e descartes
├── data-model.md                        # Fase 1 — Linha estendida, Recusa nova, market_benchmarks
├── quickstart.md                        # Fase 1 — 9 passos de validação
├── contracts/
│   ├── regua.md                         # contrato de leitura + o que a tela mostra
│   └── market-benchmarks-antes.md       # FR-015: as 12 linhas transcritas + SQL de reversão
├── checklists/requirements.md
└── tasks.md                             # Fase 2 (/speckit-tasks)
```

### Source Code

**Repositório A — roihub** (`C:\Users\jeanz\OneDrive\Desktop\ROI Labs\roihub`)

```text
lib/
└── benchmark.mjs                # REGUA.D ganha 3 recusas; shape Linha ganha url/acessadoEm/recorte;
                                 # leituraDoDegrau() passa a preferir recusa.motivo ao genérico;
                                 # FR-016: o comentário "ninguém publica" vira resultado PROVADO
app/okr/[slug]/
└── page.tsx                     # o branch de ausência de régua passa a nomear degrau e motivo
                                 # — UMA linha, não duas (restrição da 019)
test/
└── benchmark.test.mjs           # já registrado; ganha as travas 6-9 e estende o teste existente
                                 # de `lead→respondeu`, que muda de significado
handoff/
└── okr-regua-de-mercado.md      # FR-002a: nomear as 7 linhas legadas como dívida
```

**Repositório B — app da Atma** (`C:\dev\atma`)

```text
backend/
├── migrations/
│   └── 0NN_regua_pesquisada.sql   # DROP NOT NULL em metric_value; DELETE das 12; INSERT dos vereditos
└── src/routes/
    └── marketBenchmarks.js        # FR-015a: PUT e POST bulk-update recusam `source` não verificável
admin/src/
├── app/admin/benchmark-mercado/page.tsx   # não quebra com metric_value NULL; mostra recusa e link
└── components/benchmark-editor.tsx        # idem, no editor
```

**Structure Decision**: dois repositórios, deploys independentes, **ordem obrigatória**. O roihub vem
primeiro porque é ele que produz o conteúdo canônico (`REGUA.D`) que a migration da Atma copia — a
FR-013a exige que as duas superfícies citem **a mesma** faixa, mesma URL e mesma data. Escrever a
Atma antes seria criar a segunda fonte da verdade que a FR-013a existe para impedir.

---

## Sequenciamento

| fase | escopo | entrega sozinha? | depende de |
|---|---|---|---|
| **A** | US1 — `REGUA.D` com as 3 recusas, shape estendido, render, testes | ✅ sim | — |
| **B** | FR-002a — dívida das 7 legadas registrada | ✅ sim | — |
| **C** | US2 — migration + guarda de escrita + admin da Atma | ❌ não | **A** (a FR-013a copia de `REGUA`) |
| **D** | US3 — pesquisa de aquisição registrada e datada para a 022 | ✅ sim | — (já feita na Fase 0) |

A **A** é o coração e roda sozinha. A **C** atravessa a fronteira do repositório e não pode preceder a
**A**.

---

## Riscos

| risco | probabilidade | mitigação |
|---|---|---|
| A tela ficar com 2 linhas onde a 019 deixou 1, empurrando "o que fazer" abaixo da dobra | média | Passo 4 do quickstart mede a 1280×800; a 019 registrou 801px como a margem real |
| O teste existente de `lead→respondeu` continuar verde **testando nada** | **alta** | É a armadilha mais provável desta spec — o teste passa pelo caminho novo sem afirmar nada. Estendê-lo é tarefa própria, não "ajuste" |
| A migration da Atma rodar contra a base errada | baixa | `ATMA_DATABASE_URL` é explícito; o Passo 6 do quickstart confere o conteúdo pós-escrita |
| A régua envelhecer sem ninguém ver | **certa, é da natureza** | `acessadoEm` obrigatório (FR-003) torna a idade visível na própria linha |
| Alguém reabastecer `market_benchmarks` com "A definir" | média | FR-015a: a guarda de escrita. Sem ela a spec vira um `DELETE` que durou uma semana |
| Conferir o deploy uma vez só e concluir errado | **alta, já aconteceu** | Passo 9: esperar ~15 min, conferir **duas** vezes, buscando string exclusiva da versão nova |

---

## Complexity Tracking

Nenhuma violação da constituição a justificar. A tabela fica vazia de propósito.

O único ponto que poderia parecer complexidade extra — a `Recusa` como entidade em vez de simples
ausência de chave — é **requisito** (FR-001a/FR-001b), não escolha de arquitetura, e a alternativa
mais simples (deixar a recusa só no `research.md`) foi explicitamente recusada na clarificação de
06/09: recusa fora do código não chega à tela e apodrece.
