# Implementation Plan: Cada medida de busca é lida pela dimensão que a mede

**Branch**: `032-ctr-gap-dimensao-certa` | **Date**: 2026-09-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/032-ctr-gap-dimensao-certa/spec.md`

## Summary

A aba de aquisição faz **uma** leitura do Search Console para os KPIs de busca — `query`+`page` — e
alimenta com ela tanto as medidas de termo quanto as de URL. A dimensão `query` omite as consultas
raras: medido na Atma em 19/09/2026 e reconferido antes deste plano, ela devolve 10.395 das 24.664
impressões (42,1%) e 14 das 29 URLs. O Índice de Conformidade publica **0% com 6 URLs avaliadas**
quando a leitura completa dá **12,5% com 24** — porque a home, a única página que atinge o piso,
aparece na posição 11,82 por termo (fora da faixa do balizador, que acaba em 10,9) e na posição 6,93
por página, com 22,49% de CTR.

A abordagem: a aba passa a fazer **as duas leituras** no mesmo `Promise.all`, com a mesma janela e a
mesma lista de hosts, e `lib/kpis-busca.mjs` deixa de ter um agregado só. Nascem `kpisPorTermo` e
`kpisPorPagina`, cada um exigindo a sua leitura no `@param` — e a fronteira passa a ser cobrada pelo
compilador, porque as duas formas de linha são disjuntas (`query`+`page` contra `pagina`).
`gscPaginas` já existe desde a 016 e já soma hosts desde a 030: **nenhuma função de borda nova**.

Três fatos que o código trouxe e a spec não sabia, todos decididos em [research.md](research.md):

- **O JSDoc de um `.mjs` chega ao chamador `.tsx` e reprova no `tsc`** — medido com um probe em
  19/09: `kpisDeBusca(paginas, null)` reprova, `urlsComImpressao(paginas)` não, porque esta não tem
  `@param`. A fronteira da spec pode deixar de compilar em vez de virar convenção (D2).
- **`porUrl()` fica sem chamador e é deletada** (D4). Ela é a função que soma linhas por termo para
  formar a URL — a operação que a FR-001 proíbe na família por URL, e a que fabricou o 0%.
- **A amostra do Pass Rate de Core Web Vitals muda de valor** (D11): ela é por URL e migra junto.
  A SC-004 não a protege, e isso é consequência aceita, não regressão.

## Technical Context

**Language/Version**: TypeScript 5.9 + JavaScript ESM (`.mjs`), Node 22.18 (roda `.ts` direto no
`node --test`, como a 030 e a 031 já fazem).

**Primary Dependencies**: Next.js 16 (App Router), React 19, `google-auth-library` 10. Nenhuma
dependência nova — as duas leituras já existem na borda.

**Storage**: nenhum. As duas leituras acontecem no render da aba. Zero migração, zero coluna; a série
gravada (`hub_gsc_dia`) não é tocada.

**Testing**: `node --test` com `node:test` + `assert/strict`, lista explícita em `package.json`
(Princípio II). **Zero arquivo de teste novo**: os casos entram em `test/kpis-busca.test.mjs` e
`test/gsc-delta.test.mjs`, já registrados. Linha de base medida hoje: **1085 testes verdes em
~4,7 s**. `npx tsc --noEmit` é portão desta feature ao lado da suíte (D2) — a suíte não tipa nada.

**Target Platform**: Linux/Alpine em Docker no EasyPanel (`output: "standalone"`); dev em Windows.

**Project Type**: aplicação web monolítica (Next App Router) com lógica pura em `lib/*.mjs`.

**Performance Goals**: **+1 requisição por host** na aba (a leitura por página, que a ficha já fazia
separado). Teto em voo sobe de 2 para **3** — série, consultas e páginas em paralelo no mesmo
`Promise.all`, cada uma com os hosts EM SÉRIE dentro (`lerHosts`), nunca 3×N. A latência não soma:
manda a mais lenta. Precedente: `lib/okr-coleta.ts` dispara série + páginas em paralelo desde a 030.
Só a Atma paga host a mais — é o único card com `dominioAnterior`.

**Constraints**: as duas leituras usam **a mesma variável** de janela e de hosts (FR-006); nenhuma
medida mistura as duas (FR-002); nenhuma medida por termo muda de valor (SC-004); a régua de CTR e a
janela de descoberta não mudam (Assumptions).

**Scale/Scope**: 1 projeto no escopo (`SLUGS_DE_BUSCA = ["atma"]`), 29 páginas e 989 pares na janela
medida. Uma tela (aba de aquisição), um módulo puro (`lib/kpis-busca.mjs`), um mapa de procedência
(`lib/gsc-delta.mjs`), uma testemunha (`scripts/conferir-soma-hosts.mjs`).

## Constitution Check

*GATE: passou antes da Fase 0 e revalidado após a Fase 1.*

| Princípio | Como esta feature atende | Antes F0 | Após F1 |
|---|---|---|---|
| **I. Contrato único de dados** | Nenhum import de `data/projects.json` no código novo. Os hosts saem de `hostsDeclarados(p)` sobre o `p` de `listProjects()`, nos dois chamadores. A testemunha (`scripts/`) já lê o JSON à mão por decisão da 029 — não é página, rota nem componente, e esta feature não acrescenta import nenhum lá | ✅ | ✅ |
| **II. `node --test`, registrado à mão** | Casos novos em dois arquivos **já registrados**; nenhum arquivo novo, nenhuma edição na lista do `package.json`. `test/validade.test.mjs` continua cobrando a divergência nos dois sentidos | ✅ | ✅ |
| **III. `.mjs` para lógica pura** | As duas famílias moram em `lib/kpis-busca.mjs` (puro, sem import, sem env, sem relógio — há teste que prova). A aba só liga. Nenhuma conta nova em `.tsx` | ✅ | ✅ |
| **IV. Push é deploy** | Nenhuma mudança de `maxDuration`. Push fora de 23:30–01:00 e 08:00–08:45 BRT. Nada no autopublishing, nada em cron | ✅ | ✅ |
| **V. Ambiente explícito, segredo nunca em log** | Nenhuma variável nova. A frase de falha ganha o **nome da leitura** (dado público) ao lado do host que a 030/031 já publicam, e continua truncada em 60 caracteres. `getClient()` continua fora do `try` de `lerHosts` | ✅ | ✅ |

**Restrições técnicas**: sem linter/formatter (seguir o arquivo vizinho); comentário explica o
**porquê** com o fato medido; a `.mjs` continua pura.

**Resultado**: nenhuma violação. [Complexity Tracking](#complexity-tracking) fica vazio.

O gate obriga a registrar duas coisas em vez de calá-las. **(1)** `lib/gsc-delta.mjs` descreve o
coletor de cada folha do board e hoje diz que `activeIndexRatio` "devolve um PISO porque a dimensão
`query` omite as raras" — depois desta feature isso é falso para essa folha, e mapa errado manda
ligar coletor que já está ligado (D16). **(2)** O teste do mapa confere que a chave é folha do
board, **não** que o símbolo exista no arquivo: a deleção de `porUrl` (D4) passa verde mesmo com
`MEDIDO_POR` apontando para o vazio. Os dois viraram linha da tabela de riscos.

## Project Structure

### Documentation (this feature)

```text
specs/032-ctr-gap-dimensao-certa/
├── plan.md                              # Este arquivo
├── research.md                          # Fase 0 — D1..D16
├── data-model.md                        # Fase 1 — E1..E7, sem tabela
├── quickstart.md                        # Fase 1 — como provar cada SC
├── contracts/
│   └── medida-por-familia.md            # Fase 1 — C1..C8
├── checklists/
│   └── requirements.md                  # já existe (speckit-checklist)
└── tasks.md                             # Fase 2 — /speckit-tasks, NÃO criado aqui
```

### Source Code (repository root)

```text
lib/
├── kpis-busca.mjs         # kpisPorTermo() — o antigo kpisDeBusca, só a família de termo (C2)
│                          #   kpisPorPagina() — urlsComImpressao + ctrGap + activeIndexRatio (C3)
│                          #   ctrGap(paginas) — linha a linha, sem re-agregar (C4)
│                          #   urlsComImpressao/activeIndexRatio: entrada por página + @param (C5)
│                          #   porUrl() — DELETADA (C6)
│                          #   benchmark/ctr/BENCHMARK/consultasUnicas/noTop20/impressoesNoTop3/
│                          #   strikingDistance/canibalizacao/termoPrincipal — INALTERADAS
├── gsc.ts                 # NÃO TOCADO — gscPaginas e gscConsultas já existem e já somam hosts
├── gsc-delta.mjs          # MEDIDO_POR (símbolos novos) + RESSALVA_DO_COLETOR (activeIndexRatio)
└── okr-coleta.ts          # NÃO TOCADO — a ficha já lê páginas desde a 030

app/okr/[slug]/aquisicao/
└── page.tsx               # + gscPaginas(hostsDeclarados(p), curtaGsc) no MESMO Promise.all (C1)
                           #   duas famílias, duas bases, dois portões de piso (C7)
                           #   lerPassRate() e impressoesPorUrl passam a ler páginas (D10, D11)
                           #   falha por leitura, cabeçalho com UMA declaração de hosts (D8, D14)

scripts/
└── conferir-soma-hosts.mjs  # --pagina imprime a tabela por URL e a fração (C8)

test/
├── kpis-busca.test.mjs    # + as duas famílias; SC-004 como trava; casos de porUrl saem com ela
└── gsc-delta.test.mjs     # + a ressalva de activeIndexRatio deixa de citar a dimensão query

GLOSSARIO.md               # + "base da medida" e "leitura por página / por termo" (regra do arquivo)
```

**Structure Decision**: monolito Next existente, **sem arquivo novo em `lib/`, `test/` nem `app/`**.
As duas famílias moram no módulo que já as continha — um `lib/kpis-por-pagina.mjs` ao lado seria o
segundo lugar onde procurar "como o hub calcula CTR Gap", e a régua (`benchmark`) teria de ser
importada de lá para cá ou duplicada. A feature **encolhe** o módulo: uma função a menos do que
começou.

## Sequência de entrega

As ordens 1 e 2 **não são mergeáveis separadas**: trocar a entrada da família por URL faz o `tsc`
reprovar a aba no mesmo instante — e é exatamente isso que a fronteira tem de fazer. Elas fecham no
mesmo commit. A ordem é a do risco, não a da spec.

| Ordem | Escopo | Entrega | Prova |
|---|---|---|---|
| 0 | `@param` em **toda** função exportada de `kpis-busca.mjs`, sem mudar comportamento | a fronteira de tipo passa a existir (C5) | `npm test` = os 1085 verdes e `tsc --noEmit` limpo, **antes** de trocar qualquer entrada |
| 1 | `kpisDeBusca` → `kpisPorTermo`; `kpisPorPagina` nasce; `ctrGap`/`urlsComImpressao`/`activeIndexRatio` passam a ler páginas; `porUrl` deletada | **US1**: o índice sai da leitura certa | `test/kpis-busca.test.mjs` (12,5% / 24 avaliadas / home dentro) |
| 2 | A aba: `gscPaginas` no `Promise.all`, as duas famílias, `lerPassRate` e `impressoesPorUrl` por página | a tela lê o que o módulo calcula | `tsc --noEmit`; seção 5 do quickstart (SC-001, SC-003) |
| 3 | Base ao lado de cada medida, piso por família, falha por leitura, `<details>` e GLOSSARIO (`information-design` + `ux-writing`) | **US2**: duas bases na mesma lista deixam de ler como bug | tela conferida (`ui-verification`), seções 5 e 6 do quickstart (SC-005, FR-005) |
| 4 | `lib/gsc-delta.mjs`: `MEDIDO_POR` e `RESSALVA_DO_COLETOR` | a procedência para de descrever o coletor antigo | `test/gsc-delta.test.mjs` |
| 5 | A testemunha imprime a tabela por URL e a fração | a SC-001 fica conferível à mão sem script descartável | seção 4 do quickstart |

A ordem 0 não é scaffolding: sem os `@param`, a troca de entrada da ordem 1 passaria em silêncio nas
funções que hoje aceitam qualquer coisa (`urlsComImpressao`, `activeIndexRatio`) — e a fronteira que
esta spec inteira existe para criar nasceria com dois buracos. É também a única ordem em que um erro
se esconde (anotação sem prova), por isso a suíte e o `tsc` rodam antes de escrever uma linha da
ordem 1.

## Riscos, e o que cada um dispara

| Risco | Sinal | O que fazer |
|---|---|---|
| Uma medida por termo muda de valor | Top 3 sai de 27,3%; striking distance muda de tamanho | é a SC-004 reprovada — a migração vazou para a família errada; reverter a função, não ajustar a asserção |
| `MEDIDO_POR` aponta para `porUrl` deletada | nenhum: o teste do mapa não confere símbolo (D4) | `grep -rn "kpis-busca.mjs#" lib` na ordem 4, à mão |
| A família por URL re-agrega | posição de uma página com uma casa a mais de ruído; página na borda de 10,9 entra ou sai | é a deriva da 031 de volta (D3) — `ctrGap` não chama agregação nenhuma |
| Função da família sem `@param` | `tsc` limpo com a lista errada passada de propósito (seção 2 do quickstart) | a porta ficou aberta; anotar antes de seguir |
| Leitura por página com janela própria | as duas bases não fecham com a mesma soma de dias | FR-006 quebrada: as duas leituras citam a MESMA variável |
| Falha de uma leitura esconde as duas famílias | bloco inteiro some com uma das duas viva | FR-005 quebrada (D8) |
| Medida na tela sem base | duas listas com denominadores diferentes e nenhuma explicação | é o bloco lendo como bug — a US2 existe para isso |
| Pass Rate muda e ninguém avisa | fração de CWV diferente da de ontem | esperado (D11); declarar na entrega, não "consertar" |
| Truncamento da leitura por página | `truncado` ligado com 1.000 páginas | a ressalva vale para ela também (D15); hoje a Atma tem 29 |
| Rate limit no render | `{erro}` intermitente nas três leituras | teto em voo é 3 (D12); hosts continuam em série dentro de cada leitura |
| Projeto sem consultas raras inverte veredito | duas leituras iguais e número diferente do de ontem | é regressão: com as duas leituras iguais nada pode mudar |

## Complexity Tracking

> Preenchido **apenas** se o Constitution Check tiver violações a justificar.

Nenhuma violação. Tabela vazia de propósito: a feature não acrescenta dependência, tabela, rota,
arquivo, framework nem uma segunda régua de CTR — ela liga uma leitura que já existia, separa em
duas o agregado que já existia e **deleta** a função que produzia o número errado.
