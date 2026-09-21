# Implementation Plan: O mapa de GSC por projeto — o Sirius entra como segundo

**Branch**: `052-mapa-por-projeto` (trabalho em `main`, como 034–051) | **Date**: 2026-09-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/052-mapa-por-projeto/spec.md`

## Summary

O mapa já é quase todo agnóstico. O que o prende à Atma são as leituras com o slug fixo e ~20 frases. O plano:

1. **Rota por projeto (US1, US2).** `app/gsc/mapa/page.tsx` muda para `app/gsc/mapa/[slug]/page.tsx` com
   `git mv`, sem cópia. O `atma` fixo vira o projeto do slug, que sai de `projetosDeBusca()` (a mesma lista das
   corridas) com card curado. Um slug fora dela, ou sem card, dá `notFound()`. `/gsc/mapa` redireciona para `/gsc/mapa/atma` com 307.
2. **Frases (FR-004).** Cada frase que afirma algo sobre o projeto medido passa a usar `nomeCurto`, "este
   projeto" ou `/okr/{slug}`. As duas frases que citam a Atma como evidência de uma regra ficam, e são
   listadas em `EVIDENCIAS` (research D5).
3. **Depois do clique (FR-010).** `cadeiaLigada(perfil)` em `lib/okr.mjs` decide o painel pelo que o perfil
   declara. Na Atma (perfil D, ligada) nada muda. No Sirius (perfil A) o painel nomeia os degraus sem
   coletor e não chama `dadosDaFicha`.
4. **Escopo (US4, FR-005, FR-006).** `SLUGS_DE_BUSCA` e `SLUGS_DE_CAMPO` ganham `sirius`. As três corridas
   cabem no tempo de hoje (research D8). O hiato da série se fecha sozinho, e a separação de marca chega
   aos 141 dias antigos na primeira corrida com a marca declarada (research D6 e D7, que corrigem uma
   premissa da spec).
5. **Seletor (US3, FR-011).** Um `<nav>` no cabeçalho com os projetos de `projetosDeBusca()`.
6. **Dado declarado (FR-007, FR-008).** A marca e o inventário do Sirius entram só depois do aceite do dono,
   pelo script que já existe. O código não espera por eles.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16 App Router, React 19) + `.mjs` puro, Node 22

**Primary Dependencies**: as instaladas: `mind-elixir`, `pg`, `google-auth-library`. Nenhuma nova.

**Storage**: nenhuma tabela ou coluna nova. `hub_gsc_dia`, `hub_indexacao` e `hub_pagina_corrida`/`hub_pagina`
passam a receber linhas do `sirius`. Dado declarado: `data/projects.json` (a `marca` do card) e
`data/inventario-de-termos.json` (a chave `sirius`), os dois depois do aceite.

**Testing**: `node --test`. Crescem `test/okr.test.mjs` (`cadeiaLigada`) e `test/crux.test.mjs`
(`SLUGS_DE_CAMPO`). Entra **um** arquivo novo, `test/mapa-projeto.test.mjs`, registrado em `package.json` no
mesmo commit.

**Target Platform**: container Linux no EasyPanel; dev no Windows.

**Project Type**: aplicação web única (App Router + `lib/`).

**Performance Goals**: o mapa da Atma segue em ~8 s a frio, com as mesmas leituras. O do Sirius faz as
mesmas leituras do Search Console e do banco e não faz a composição da ficha (~3,3 s a menos, research D3).

**Constraints**: os números da Atma idênticos antes e depois (SC-002); nenhuma `maxDuration` nova, e por
isso nenhum ajuste no proxy do EasyPanel; nenhum `0`/`0%` sobre ausência; nenhuma taxa clique → receita no
Sirius. Push fora de 23:30–01:00 e 08:00–08:45 BRT (Princípio IV). Push também fora de 05:15–06:40 BRT: as
três corridas rodam às 05:17, 05:47 e 06:17 e morreriam com o reinício do container.

**Scale/Scope**: 2 projetos, 113 folhas, ~20 frases, 3 corridas; Atma com 25 URLs no sitemap e Sirius com 114.

## Constitution Check

*GATE: revisto antes da Fase 0 e depois da Fase 1 — sem violação.*

| Princípio | Como esta feature cumpre |
|---|---|
| I. Contrato único de dados | O projeto do mapa e o seletor saem de `projetosDeBusca()`, que usa `listProjects()`. A marca entra no card, lido pelo mesmo contrato. Nenhum import de `data/projects.json`. |
| II. `node --test`, registrado à mão | `test/mapa-projeto.test.mjs` entra na lista do `package.json` no commit que o cria, e `test/validade.test.mjs` cobra isso. Os outros dois arquivos já estão registrados. |
| III. `.mjs` para lógica pura | `cadeiaLigada` (`lib/okr.mjs`), `EVIDENCIAS`, `frasesAlheias` e `numerosDoMapa` (`lib/mapa-projeto.mjs`) nascem em `.mjs`. As `.tsx` só resolvem a rota e escrevem. |
| IV. Push é deploy | Fora das janelas do princípio e das corridas da manhã. Nenhuma `maxDuration` muda. |
| V. Ambiente explícito, segredo nunca em log | Nenhuma variável nova. As rotas das corridas já validam o ambiente na entrada. A testemunha lê o HTML, não o `.env`. |

**Revisão pós-Fase 1**: o design acrescenta um arquivo de `lib/` e um script, e os dois são puros ou só de
leitura. Nenhuma dependência nova, nenhum segundo lugar para a lista de projetos, nenhuma cópia da tela.
Continua sem violação.

## Project Structure

### Documentation (this feature)

```text
specs/052-mapa-por-projeto/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/mapa-por-projeto.md
├── checklists/requirements.md
└── tasks.md            # speckit-tasks
```

### Source Code (repository root)

```text
app/gsc/mapa/[slug]/page.tsx    # o page.tsx de hoje, com git mv: slug → projeto, notFound, generateMetadata,
                                #   frases da D5, seletor, cadeiaLigada, DEMANDAS[slug], lerInventario(slug)
app/gsc/mapa/page.tsx           # novo conteúdo: redirect("/gsc/mapa/atma")
app/gsc/mapa/mapa.tsx           # sem mudança (importado como ../mapa)
lib/projects.ts                 # SLUGS_DE_BUSCA = ["atma", "sirius"] + a decisão de 21/09 no comentário
lib/crux.mjs                    # SLUGS_DE_CAMPO = ["atma", "sirius"]
lib/okr.mjs                     # cadeiaLigada(perfil)
lib/mapa-projeto.mjs            # NOVO: EVIDENCIAS, frasesAlheias(), numerosDoMapa()
scripts/conferir-mapa.mjs       # NOVO: testemunha das SC-002 (numeros) e SC-005 (alheio) sobre o HTML
test/okr.test.mjs               # cadeiaLigada: D ligada, A com os três nomes, perfil desconhecido
test/crux.test.mjs              # SLUGS_DE_CAMPO
test/mapa-projeto.test.mjs      # NOVO: frase de evidência passa, frase sobre o projeto reprova, carimbo fora dos números
package.json                    # registra test/mapa-projeto.test.mjs
data/projects.json              # card sirius: marca — SÓ depois do aceite (FR-007)
data/inventario-de-termos.json  # chave sirius via derivar-inventario.mjs --gravar — SÓ depois do aceite (FR-008)
```

**Structure Decision**: aplicação única. A tela é movida, não copiada: o histórico do `git log --follow`
continua no arquivo novo. Os dois arquivos novos de `lib/` e `scripts/` existem porque a SC-005 pede
comparação "contra a lista das frases de evidência permitidas", e uma lista só reprova alguma coisa se
estiver em código. `/gsc` (a árvore de procedência) não muda: o link para `/gsc/mapa` continua chegando à
Atma pelo redirect.

**Na implementação**: pela regra global, `accessibility` e `ux-writing` antes de escrever o seletor e as
frases, e `ui-verification` antes de dizer que está pronto (quickstart §6).

## Ordem de entrega

1. **Código** (um push): a rota, as frases, `cadeiaLigada`, o seletor, os dois escopos e as testemunhas.
   Pode ir sem o aceite: o Sirius sai com os estados de ausência que já existem.
2. **Marca** (um push, depois do aceite de FR-007): de preferência junto com o passo 1, para a primeira
   corrida já reclassificar a série (research D7).
3. **Inventário** (depois do aceite de FR-008): prévia sem `--gravar`, o aceite, depois `--gravar` e push.
4. **Corridas**: `workflow_dispatch` das três no dia do push e a conferência do quickstart §4.

## Complexity Tracking

Nenhuma violação a justificar.
