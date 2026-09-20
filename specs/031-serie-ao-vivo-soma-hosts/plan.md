# Implementation Plan: A leitura ao vivo da série soma os hosts declarados

**Branch**: `031-serie-ao-vivo-soma-hosts` | **Date**: 2026-09-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/031-serie-ao-vivo-soma-hosts/spec.md`

## Summary

Quatro leituras ao vivo do Search Console consultam **um** host — o de `url` — e a Atma, desde a
troca de domínio de 11/09, aparece com 127 das 370.559 impressões da janela longa (0,03%) numa aba
que também diz, dois blocos abaixo, "hosts somados" com 10.098. A soma por dia que a 029 construiu
(`somarSeriesPorHost`) e a lista de hosts (`hostsDeclarados`) existem, estão testadas, e **nenhuma
leitura ao vivo as chama**.

A abordagem: as quatro leituras (`gscSeries` ×3 chamadores e `gscTrend`) passam a receber a **lista
de hosts declarados**, e o laço "um host por vez, host sem propriedade vira `encerrado`, host que
falha derruba a leitura" — hoje escrito dentro de `lerPorHosts` (030) — é **extraído** em `lerHosts`
e reusado pelas três leituras. A soma é a função da 029, sem segunda implementação. Trocar o **tipo**
do parâmetro (`siteUrl` → `string[]`) faz o `next build` reprovar a próxima chamada `gscSeries(p.url)`:
a porta errada deixa de compilar em vez de ficar fechada por convenção.

Dois fatos que o código lido trouxe e a spec não sabia, ambos decididos em [research.md](research.md):

- `somarSeriesPorHost` com **um** host altera a posição do Google em ~8% dos dias (`3,9 × 1146 ÷ 1146 =
  3,8999999999999995`, medido em 20.000 casos) — a FR-006 exige o número de hoje, então a função é
  corrigida (D4).
- A tendência (`gscTrend`) não tem onde nomear o host que falhou; o contrato dela é `null`, e ele já
  cumpre a metade que importa da FR-004 — nada parcial é publicado (D6).

Projeto de um host continua com exatamente o resultado de hoje e uma requisição por janela. Dos 35
projetos curados, só a Atma declara `dominioAnterior`.

## Technical Context

**Language/Version**: TypeScript 5 + JavaScript ESM (`.mjs`), Node 22.18 (roda `.ts` direto no
`node --test`, como a 030 já faz)

**Primary Dependencies**: Next.js 16 (App Router), React 19, `google-auth-library`. Nenhuma
dependência nova — a soma é a função da 029 e a aritmética da tendência é uma adição.

**Storage**: nenhum. As leituras acontecem no render (aba, `/seo`, ficha) e na avaliação da home.
Zero migração, zero coluna; a série **gravada** (`hub_gsc_dia`) não muda.

**Testing**: `node --test` com `node:test` + `assert/strict`, lista explícita em `package.json`
(Princípio II). **Zero arquivo de teste novo**: os casos entram em `test/gsc-hosts.test.mjs` (reusa
o `clienteFalso` da 030) e `test/serie-soma-hosts.test.mjs`, ambos já registrados. Linha de base
medida hoje: **1065 testes verdes**, `tsc --noEmit` limpo.

**Target Platform**: Linux/Alpine em Docker no EasyPanel (`output: "standalone"`); dev em Windows.

**Project Type**: aplicação web monolítica (Next App Router) com lógica pura em `lib/*.mjs`.

**Performance Goals**: uma requisição por host por janela, e os **hosts** em SÉRIE dentro da
leitura (mesma credencial, mesmo endpoint — paralelizar host é o caminho curto para um 429). A
exceção é DENTRO de um host da tendência: as duas janelas continuam no `Promise.all` de hoje
(`gsc.ts:466`), porque a FR-006 manda um host sair byte a byte igual. O teto em voo é **2**
requisições, nunca 2×N. Só a Atma paga: +1 requisição por leitura de série, +2 na tendência. Ver [research.md](research.md) D10.

**Constraints**: soma parcial é proibida — falha de qualquer host declarado impede a publicação do
número. A janela default da série (`D-86 → D-3`) não muda um dia (`019/FR-025`). As datas de cada
leitura nascem UMA vez, fora do laço de hosts.

**Scale/Scope**: 35 projetos curados + repos do GitHub, 1 em migração (2 hosts). Quatro leituras,
cinco chamadores, três telas (aquisicao, `/seo`, ficha) e a home.

## Constitution Check

*GATE: passou antes da Fase 0 e revalidado após a Fase 1.*

| Princípio | Como esta feature atende | Antes F0 | Após F1 |
|---|---|---|---|
| **I. Contrato único de dados** | Nenhum import de `data/projects.json` — nem no código novo nem nos testes. Os hosts saem de `hostsDeclarados(p)` sobre o `p` que já vem de `listProjects()` em todos os chamadores. A leitura de `data/projects.json` que fundamentou D9 foi uma medição avulsa, fora do repo | ✅ | ✅ |
| **II. `node --test`, registrado à mão** | Casos novos em dois arquivos **já registrados**; nenhum arquivo novo, nenhuma edição em `package.json`. `test/validade.test.mjs` continua cobrando a divergência nos dois sentidos | ✅ | ✅ |
| **III. `.mjs` para lógica pura** | A soma e a correção do voto único moram em `lib/serie-gsc.mjs` (puro). `lib/gsc.ts` continua `.ts` porque toca `google-auth-library` e é importado por rota. Nenhuma lógica testável migra para `.ts` | ✅ | ✅ |
| **IV. Push é deploy** | Nenhuma mudança de `maxDuration`. Push fora de 23:30–01:00 e 08:00–08:45 BRT. `route.ts` (a corrida) é tocada **só no nome** de uma função — o comportamento dela é byte a byte o de hoje | ✅ | ✅ |
| **V. Ambiente explícito, segredo nunca em log** | Nenhuma variável nova. O `{erro}` ganha o **host** (dado público, do card) e continua truncado em 60 caracteres. `getClient()` fica **fora** do `try` do laço compartilhado: o `JSON.parse` da env cita um trecho da service account na mensagem de erro (D6) | ✅ | ✅ |

**Restrições técnicas**: sem linter/formatter (seguir o arquivo vizinho); comentário explica o
**porquê** com o fato medido; `spawn("claude")` com `shell: true` no Windows não é tocado.

**Resultado**: nenhuma violação. [Complexity Tracking](#complexity-tracking) fica vazio.

O gate obriga a registrar duas coisas em vez de calá-las. **(1)** A corrida que grava
(`app/api/gsc-serie/route.ts`) tem o mesmo laço de hosts escrito à mão: é a **quinta porta**, correta
hoje, e a spec a exclui (Assumptions) — [research.md](research.md) D3, para não ser redescoberta.
**(2)** A correção do voto único em `somarSeriesPorHost` também alcança a corrida, na 16ª casa e na
direção do valor do Google; `gravarDiasGsc` guarda por host, nunca por valor (D4).

## Project Structure

### Documentation (this feature)

```text
specs/031-serie-ao-vivo-soma-hosts/
├── plan.md                              # Este arquivo
├── research.md                          # Fase 0 — D1..D11
├── data-model.md                        # Fase 1 — E1..E6, sem tabela
├── quickstart.md                        # Fase 1 — como provar cada SC
├── contracts/
│   └── leitura-de-serie.md              # Fase 1 — C1..C6
├── checklists/
│   └── requirements.md                  # já existe (speckit-checklist)
└── tasks.md                             # Fase 2 — /speckit-tasks, NÃO criado aqui
```

### Source Code (repository root)

```text
lib/
├── gsc.ts                 # lerHosts<T>() extraído de lerPorHosts (C2) — o laço ÚNICO
│                          #   gscSeries(hosts, janela?, options?) — soma via somarSeriesPorHost (C3)
│                          #   gscSerieDeUmHost() — o gscSeries antigo, renomeado (C3.1)
│                          #   gscTrend(hosts, options?) — soma os cliques por janela (C4)
│                          #   queryClicks/queryTimeseries: `Client` → `RequestClient` (cliente falso)
├── serie-gsc.mjs          # somarSeriesPorHost: voto único devolve a posição como veio (C5)
├── evaluate.ts            # gscTrend(hostsDeclarados(p))
├── okr-coleta.ts          # gscSeries(hostsDeclarados(p)); serieGsc passa a GscSerieSomada
├── projects.mjs           # hostsDeclarados() — INALTERADA, é o resolvedor único (C1)
├── gsc-hosts.mjs          # NÃO TOCADO — a mescla por caminho é da 030
└── ...

app/
├── okr/[slug]/aquisicao/page.tsx   # gscSeries(hostsDeclarados(p), janela) + <HostsDaLeitura> nos
│                                   #   DOIS blocos (C6); revisão da cópia que se oculta (D8)
├── seo/page.tsx                    # gscSeries(hostsDeclarados(p))
└── api/gsc-serie/route.ts          # SÓ o nome: gscSeries → gscSerieDeUmHost (D3)

scripts/
└── conferir-soma-hosts.mjs         # + cliques somados no modo `date` (SC-005 conferível à mão)

test/
├── gsc-hosts.test.mjs              # + gscSeries/gscTrend com o clienteFalso da 030
└── serie-soma-hosts.test.mjs       # + voto único devolve a posição crua
```

**Structure Decision**: monolito Next existente, **sem arquivo novo em `lib/` nem em `test/`**. O
laço único vive em `lib/gsc.ts` ao lado de quem o usa, e a soma continua em `lib/serie-gsc.mjs` —
onde a 029 a pôs e onde a 030 já a cita como função irmã. Um módulo novo para as duas leituras seria
o quinto lugar onde procurar "como se soma um host".

## Sequência de entrega

As histórias P1 e a parte de série da P2 **não são mergeáveis separadas**: o rename de `gscSeries`
(D1/D3) faz os três chamadores mudarem no mesmo commit, e é isso que fecha a porta. A `gscTrend`
fecha sozinha. A ordem é a do risco, não a da spec.

| Ordem | Escopo | Entrega | Prova |
|---|---|---|---|
| 0 | Extrair `lerHosts` de `lerPorHosts`; `queryClicks`/`queryTimeseries` aceitam `RequestClient` | o laço único, **sem mudar comportamento** | `npm test` = os 1065 verdes, **antes** de qualquer leitura nova |
| 1 | `somarSeriesPorHost`: voto único devolve a posição crua (C5) | a FR-006 deixa de depender de sorte de ponto flutuante | `test/serie-soma-hosts.test.mjs` |
| 2 | `gscSeries(hosts, …)` + `gscSerieDeUmHost` + os três chamadores + `route.ts` (só o nome) | **US1, US2 e US3-série**: aba, ficha e `/seo` somam | testes com cliente falso; `tsc --noEmit`; SC-004, SC-006 |
| 3 | `<HostsDaLeitura>` nos dois blocos da aba; revisão da cópia que reaparece (`ux-writing`) | SC-003, FR-005 | tela conferida (`ui-verification`), seção 5 do quickstart |
| 4 | `gscTrend(hosts)` + `evaluate.ts` | **US3-tendência**: home e agenda | testes; SC-005 na home |
| 5 | `conferir-soma-hosts.mjs` imprime cliques somados | a testemunha cobre SC-005 | seção 4 do quickstart |

A ordem 0 não é fase de scaffolding: sem o laço único, as ordens 2 e 4 seriam as duas cópias novas
do contrato de falha que a 030 veio remover. Ela é o que a FR-007 cobra — e é a única ordem em que um
erro se esconde (refator sem prova), por isso a suíte roda antes de escrever uma linha da ordem 2.

## Riscos, e o que cada um dispara

| Risco | Sinal | O que fazer |
|---|---|---|
| O extrato de `lerHosts` muda `lerPorHosts` | os testes `lerPorHosts:*` da 030 reprovam | reverter o extrato; **não** ajustar asserção — é o critério de "sem mudança" |
| Soma parcial publicada | total encolhe sem host em `encerrados` | é o defeito da 029 de volta; bloqueia a entrega |
| Posição de voto único com ruído de ponto flutuante | `days` de um projeto de um host ≠ resposta crua | C5 + o caso do `3,9 × 1146` no teste |
| Janela default da série mexida | célula `visitante` dos 17 projetos move | teste do default `D-86 → D-3` (`019/FR-025`) |
| Datas calculadas dentro do laço | dois hosts somam períodos de um dia de diferença ao cruzar a meia-noite UTC | datas calculadas uma vez, fora do laço (D5) |
| `gscTrend` deixa a exceção subir | a home cai com env malformada | `catch` externo fica; teste com env inválida |
| `JSON.parse` da env dentro do `try` | `{erro}` cita a service account na tela | `getClient()` fora do `try` (D6) |
| `www.` no `url` de um projeto | série do projeto sai vazia | tripwire do quickstart (0 em 19/09/2026); conserto é em `hostsDeclarados`, não aqui |
| Cópia "só o domínio novo" reaparece | bloco "A troca de domínio" visível com hosts somados | revisão com `ux-writing` na ordem 3 (D8) |
| Alguém chama a primitiva de um host numa leitura ao vivo | `grep gscSerieDeUmHost` devolve algo além de `route.ts` | é a porta errada reaberta; mover o chamador para `gscSeries(hosts)` |

## Complexity Tracking

> Preenchido **apenas** se o Constitution Check tiver violações a justificar.

Nenhuma violação. Tabela vazia de propósito: a feature não acrescenta dependência, tabela, rota,
arquivo de teste, framework nem uma segunda lista de hosts — ela **remove** a repetição do laço de
hosts (um extrato que encolhe `lerPorHosts`) e liga duas funções que já existiam.
