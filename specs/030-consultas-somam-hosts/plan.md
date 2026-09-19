# Implementation Plan: A leitura por página do Search Console soma os hosts declarados

**Branch**: `030-consultas-somam-hosts` | **Date**: 2026-09-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/030-consultas-somam-hosts/spec.md`

## Summary

Três leituras por página do Search Console consultam **um** host — o de `url` — e filtram o
resultado por ele. Desde a troca de domínio da Atma em 11/09, isso faz o ramo CLIQUE do board
decidir sobre 0,4% das impressões do site, e o Índice de Conformidade sair **sem denominador**: um
painel mudo, indistinguível de um painel que ninguém apurou.

A abordagem: as três leituras passam a receber a **lista de hosts declarados** (a mesma que a 029 já
usa na série, `hostsDeclarados()` em `lib/projects.mjs`), fazem uma requisição por host e mesclam as
linhas **por caminho**, com cliques e impressões somados e posição ponderada por impressões. A
mescla nasce como função pura em `lib/gsc-hosts.mjs`, e a resolução de propriedade, o filtro, o teto
e o contrato de falha — hoje três cópias em `lib/gsc.ts` — passam a ter um caminho só. É a FR-007: a
spec fecha o defeito, não conserta uma das três portas.

Projeto com um host declarado continua com exatamente o resultado de hoje e uma requisição por
janela. Dos 35 projetos, só a Atma declara `dominioAnterior`.

## Technical Context

**Language/Version**: TypeScript 5 + JavaScript ESM (`.mjs`), Node 22

**Primary Dependencies**: Next.js 16 (App Router), React 19, `google-auth-library` (Search Console).
Nenhuma dependência nova — a FR-002 é aritmética.

**Storage**: nenhum. Esta feature **não grava**: as três leituras acontecem no render (aba e ficha)
ou dentro da corrida de autopublishing que já existe. Zero migração, zero coluna.

**Testing**: `node --test` com `node:test` + `assert/strict`, lista explícita em `package.json`
(Princípio II). Um arquivo novo: `test/gsc-hosts.test.mjs`.

**Target Platform**: Linux/Alpine em Docker no EasyPanel (`output: "standalone"`); dev em Windows.

**Project Type**: aplicação web monolítica (Next App Router) com lógica pura em `lib/*.mjs`.

**Performance Goals**: uma requisição por host por janela, em SÉRIE dentro da leitura (mesma
credencial, mesmo endpoint — paralelizar é o caminho curto para um 429). Hoje: +1 requisição por
leitura, só na Atma. Ver [research.md](research.md) D7.

**Constraints**: teto de 25.000 linhas **por propriedade** (`TETO_LINHAS`), 1.000 na leitura de
páginas; o truncamento é medido por requisição, nunca pelo total somado. Soma parcial é proibida:
falha de qualquer host declarado impede a publicação do bloco inteiro.

**Scale/Scope**: 35 projetos, 1 em migração (2 hosts). Três bordas de leitura, duas telas, um robô.

## Constitution Check

*GATE: passou antes da Fase 0 e revalidado após a Fase 1.*

| Princípio | Como esta feature atende | Antes F0 | Após F1 |
|---|---|---|---|
| **I. Contrato único de dados** | Nenhum import de `data/projects.json` fora de `lib/projects.*`. O acessor novo (`dominioAnteriorDoSlug`) mora **dentro** de `lib/projects.ts` e lê `curated` com o mesmo argumento que já autoriza `listFichas()`: o campo só existe na curadoria. A lista de hosts continua vindo de `hostsDeclarados()`, ponto único (FR-001) | ✅ | ✅ |
| **II. `node --test`, registrado à mão** | `test/gsc-hosts.test.mjs` novo, registrado em `package.json` **no mesmo commit**. Sem framework. `test/validade.test.mjs` cobra a divergência nos dois sentidos | ✅ | ✅ |
| **III. `.mjs` para lógica pura** | A mescla (`mesclarPorCaminho`) é testável sem subir o Next → nasce em `.mjs`, módulo sem imports, como `serie-gsc.mjs` e `kpis-busca.mjs`. `lib/gsc.ts` continua `.ts` porque toca `google-auth-library` e é importado por rota | ✅ | ✅ |
| **IV. Push é deploy** | Nenhuma mudança de `maxDuration`. A mudança no autopublishing sobe por `dry_run` + 4 canários. Push fora de 23:30–01:00 e 08:00–08:45 BRT | ✅ | ✅ |
| **V. Ambiente explícito, segredo nunca em log** | Nenhuma variável nova. O `{erro}` ganha o **host** (dado público, do card) e continua truncado em 60 caracteres — nunca credencial, propriedade privada nem valor de ambiente | ✅ | ✅ |

**Restrições técnicas**: sem linter/formatter (seguir o arquivo vizinho); comentário explica o
**porquê** com o fato medido; `spawn("claude")` com `shell: true` no Windows não é tocado.

**Resultado**: nenhuma violação. [Complexity Tracking](#complexity-tracking) fica vazio.

Uma observação que o gate obriga a registrar em vez de calar: **`gscSeries(p.url, ...)` tem o mesmo
defeito e fica fora do escopo** por decisão da própria spec (Assumptions). Documentada em
[research.md](research.md) D8 para não ser redescoberta — `migracao_tratada_em_uma_fonte_so`.

## Project Structure

### Documentation (this feature)

```text
specs/030-consultas-somam-hosts/
├── plan.md                              # Este arquivo
├── research.md                          # Fase 0 — D1..D9
├── data-model.md                        # Fase 1 — E1..E5, sem tabela
├── quickstart.md                        # Fase 1 — como provar cada SC
├── contracts/
│   └── leitura-por-pagina.md            # Fase 1 — C1..C6
├── checklists/
│   └── requirements.md                  # já existe (speckit-checklist)
└── tasks.md                             # Fase 2 — /speckit-tasks, NÃO criado aqui
```

### Source Code (repository root)

```text
lib/
├── gsc-hosts.mjs          # NOVO · puro · mesclarPorCaminho() — a mescla por caminho (C3)
├── gsc.ts                 # as três leituras passam a receber string[] e a somar (C4)
│                          #   gscConsultas · gscPaginas · gscQueryPages
│                          #   queryPageWindow e o corpo inline de gscPaginas viram UM caminho
├── projects.ts            # + dominioAnteriorDoSlug() (C2) — só para o autopublishing
├── projects.mjs           # hostsDeclarados() — INALTERADA, é o resolvedor único (C1)
├── autopublish.ts         # passa hosts em vez de siteUrl (US3)
├── kpis-busca.mjs         # NÃO TOCADO — porUrl deixa de duplicar por consequência (D4)
└── okr-coleta.ts          # passa hostsDeclarados(p) a gscPaginas (US2)

app/okr/[slug]/aquisicao/
└── page.tsx               # passa hostsDeclarados(p) a gscConsultas + declara os hosts na tela (US1, FR-008)

test/
├── gsc-hosts.test.mjs     # NOVO · a mescla, borda a borda
└── autopublish.test.mjs   # + hosts vazio em strict lança; dois hosts entram no histórico

package.json               # registra test/gsc-hosts.test.mjs (Princípio II)
```

**Structure Decision**: monolito Next existente, sem diretório novo. A separação obedece ao
Princípio III — a aritmética da mescla em `.mjs` puro, a borda do Google em `.ts`. Um módulo novo
(`lib/gsc-hosts.mjs`) em vez de acrescentar a função a `serie-gsc.mjs` (que se declara "a corrida
que grava a série") ou a `kpis-busca.mjs` (que a ficha e o robô não importam) — ver
[research.md](research.md) D3.

## Sequência de entrega

As histórias são independentes e a ordem é a da spec. Cada uma fecha sozinha.

| Ordem | Escopo | Entrega | Prova |
|---|---|---|---|
| 0 | `lib/gsc-hosts.mjs` + teste + caminho único em `lib/gsc.ts` | a mescla e o contrato de falha | `npm test` |
| 1 | **US1** — `gscConsultas` + aba de aquisição | os 7 KPIs do ramo CLIQUE voltam | SC-001..004, SC-006 |
| 2 | **US2** — `gscPaginas` + ficha/OKR | a ficha conta o site inteiro | SC-005 |
| 3 | **US3** — `gscQueryPages` + autopublishing | o robô lê os dois hosts | `dry_run` + 4 canários |

A ordem 0 não é fase de scaffolding: sem o caminho único, US1 seria o quarto conserto pelo chamador
neste mesmo arquivo. Ela é o que a FR-007 cobra.

## Riscos, e o que cada um dispara

| Risco | Sinal | O que fazer |
|---|---|---|
| Soma parcial publicada | total encolhe sem host em `encerrados` | é o defeito da 029 de volta; bloqueia a entrega |
| `truncado` medido no total somado | flag nunca dispara com 2 hosts | comparar por propriedade (D6) |
| Lista de hosts vazia virar `[]` em `strict` | pauta duplicada para URL que já ranqueia | lista vazia lança (C4.3) |
| Posição por média simples | campeã da Atma sai ≈14 e reprova no balizador | ponderar por impressões (D4) |
| Barra final / querystring normalizadas | páginas distintas fundidas | preservar `pathname + search` (D4) |
| Achar que a soma conserta a omissão das raras | selo `piso, não total` removido | ele fica (D9) |

## Complexity Tracking

> Preenchido **apenas** se o Constitution Check tiver violações a justificar.

Nenhuma violação. Tabela vazia de propósito: a feature não acrescenta dependência, tabela, rota,
framework de teste nem uma segunda lista de hosts — ela **remove** duas cópias de um caminho que
hoje existe três vezes.
