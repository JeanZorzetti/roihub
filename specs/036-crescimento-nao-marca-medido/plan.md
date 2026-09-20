# Implementation Plan: Crescimento Não-Marca medido no board

**Branch**: `036-crescimento-nao-marca-medido` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/036-crescimento-nao-marca-medido/spec.md`

## Summary

A folha `crescimentoNaoMarca` do mapa ganha o nó `Medido:`, alimentado pela série separada que já
está gravada em `hub_gsc_dia` — zero requisição nova ao Search Console. `crescimentoNaoMarca()` deixa
de devolver `null` por quatro motivos diferentes e passa a devolver um estado **nomeado**, no mesmo
idioma discriminado que `completude()` e `marcaDeclarada()` já usam no mesmo arquivo. A formatação
que impede `4.195%` sai de dentro do componente e vira função pura, porque esta feature é o segundo
consumidor dela.

## Technical Context

**Language/Version**: Node 22, Next.js 16 (App Router), React 19
**Primary Dependencies**: nenhuma nova
**Storage**: `hub_gsc_dia`, já existente — **nenhuma** coluna, tabela ou migração nova
**Testing**: `node --test`, em `test/marca.test.mjs`, que **já** está registrado no `package.json`
**Target Platform**: Docker/EasyPanel, `output: "standalone"`
**Project Type**: single (Next.js app com `lib/` puro em `.mjs`)
**Performance Goals**: zero requisição nova ao Search Console; **uma** consulta a mais ao Postgres por render
**Constraints**: `/gsc/mapa` já é `force-dynamic` (page.tsx:55); a leitura do banco entra atrás de `dbOn()`
**Scale/Scope**: 1 folha do board; 0 arquivo novo, 4 tocados

### Decisão 1 — o `null` vira estado nomeado na FUNÇÃO, não frase nova no chamador

`crescimentoNaoMarca` devolve `null` por três motivos internos (`marca.mjs:204-208`) e o chamador
inventa um quarto. Há três caminhos para ligar a folha, e dois são armadilha:

| caminho | o que acontece |
|---|---|
| copiar a frase de `/okr/.../aquisicao` para o mapa | propaga para a segunda tela uma frase falsa em 3 dos 4 casos |
| escrever uma frase nova só no mapa | as duas telas passam a divergir sobre o mesmo `null`, e nada reprova |
| **estado nomeado na função pura** | as duas telas leem a mesma causa; corrigir uma corrige as duas |

O terceiro é o precedente vivo do arquivo: `completude()` devolve
`nao-declarada | fecha | contradicao | piso` e documenta no corpo por que **quatro estados e não um
booleano** (`marca.mjs:105-108`). Mesma razão, mesma forma. É também a regra que este repositório já
pagou: guarda escrita no chamador volta pela chamada seguinte.

Com o estado nomeado, a quarta ausência deixa de ser invisível: hoje um projeto **sem marca
declarada** cai em `fechados.length < 2` (porque `mesesFechados` descarta dia sem `impressoesNaoMarca`
numérico) e a tela acusa "ainda não há dois meses fechados". A causa é outra e o conserto é outro.

### Decisão 2 — `variacao()` sobe para `lib/`, porque esta feature é o segundo consumidor

`variacao()` mora dentro do componente (`app/okr/[slug]/aquisicao/page.tsx:729`), fora de qualquer
teste. Ela existe por um fato medido: em pt-BR `4195%` imprime `"4.195%"` e inverte o veredito ao
lado de "5% a 10%". Enquanto houve **um** consumidor, closure local era aceitável. Com dois, a regra
tem que ser uma só — senão o mapa recria o defeito que a 025 consertou na outra tela.

Vai para `lib/marca.mjs`, que é o módulo dono da razão que ela formata. Não se cria `lib/formato.mjs`
para uma função: módulo novo para um símbolo é estrutura à espera de uso que não existe.

### Decisão 3 — a linha de topo do nó é função pura, a nota fica no `.tsx`

A 034 e a 035 deixaram `topicDo*`/`noteDo*` dentro do `.tsx`, e está certo para elas: lá o topo é
formatação de um número que já é verdadeiro sozinho. Aqui o topo **carrega a correção** — é a linha
que precisa liderar com os absolutos quando a base está interrompida (FR-003), e é ela que a SC-006
julga. Regra de correção não pode morar onde `node --test` não alcança (Princípio III).

Então `linhaDeCrescimento(medida)` nasce em `lib/marca.mjs` e é testada; a **nota** (prosa longa,
com a janela, a forma da série e o porquê da faixa não se aplicar) fica no `.tsx` junto das outras
duas. A FR-014 se torna verificável: o teste alimenta a função com `baseInterrompida: true` e exige
que a razão **não** abra a linha.

### O que esta feature NÃO faz

- **Não cria mecanismo genérico "folha com coletor → nó medido".** São 26 folhas com coletor e 3
  ligadas depois desta; um motor para as 23 restantes seria escrito sem conhecer 23 contratos de
  ausência diferentes. A 034 e a 035 ligaram uma folha cada, à mão, e é o que se sabe que funciona.
- **Não liga a folha gêmea `buscasDeMarca`** (decisão registrada em Clarifications).
- **Não mexe na declaração de marca da Atma.** O nome novo (`usealigner`) ainda não é buscado; mudar
  `marca.termos` exige recorrer o backfill e reescreve o histórico. Fora do escopo.
- **Não conserta `ritmoNaoMarca` chamando `semanasNaoMarca` sem os hosts declarados.** Hoje é inerte
  (nada lê `ritmo.ultima.host`), e consertar um defeito inerte no meio de uma feature de tela é
  mudança sem teste que a prove necessária. Fica nomeado nos Edge Cases.
- **Não promove a meta do board a régua.** `balizador.tipo` segue `recusa`, a folha segue `◇ sem
  fonte`, e o nó não exibe glifo de veredito (FR-008).

## Constitution Check

*GATE: passou antes da Fase 0 e revalidado após a Fase 1.*

| Princípio | Como esta feature se comporta |
|---|---|
| **I. Contrato único de dados** | Nenhum import de `data/projects.json` acrescentado. A página já obtém a Atma por `listProjects()`; a leitura nova é de `hub_gsc_dia` via `lerDiasGsc()`, que é o ponto de leitura existente da série. |
| **II. `node --test` registrado à mão** | Nenhum arquivo de teste novo: os casos entram em `test/marca.test.mjs`, já registrado (37 casos desde a 025). `package.json` não é editado e `test/validade.test.mjs` segue verde. |
| **III. `.mjs` puro, `.ts` só na borda** | Os três símbolos novos (`variacao`, `linhaDeCrescimento`, e o retorno discriminado) nascem em `lib/marca.mjs`. O `.tsx` só escolhe estado e escreve prosa. |
| **IV. Push é deploy** | Nenhum push em 23:30–01:00 nem 08:00–08:45 BRT. Nenhuma alteração de `maxDuration`. |
| **V. Ambiente explícito, segredo nunca em log** | Nenhuma variável nova. A leitura do banco entra atrás de `dbOn()`, e a falha vira `{erro}` truncado em 60 caracteres — o mesmo contrato que `lerSerieSeparada` já usa, sem string de conexão em lugar nenhum. |

Nenhuma violação. **Complexity Tracking vazio.**

## Project Structure

### Documentation (this feature)

```text
specs/036-crescimento-nao-marca-medido/
├── spec.md              # feature specification
├── plan.md              # este arquivo
├── research.md          # o que foi medido antes de decidir
├── data-model.md        # o contrato dos cinco estados e a linha de topo de cada um
├── quickstart.md        # como conferir que está no ar
├── checklists/
│   └── requirements.md
└── tasks.md             # saída do /speckit-tasks
```

### Source Code (repository root)

```text
lib/
└── marca.mjs                      # TOCADO: crescimentoNaoMarca() devolve estado nomeado;
                                   #         + variacao(), + linhaDeCrescimento()

app/gsc/mapa/
└── page.tsx                       # TOCADO: + nó `crescimentoNaoMarca-medido`, + noteDoCrescimento

app/okr/[slug]/
└── aquisicao/page.tsx             # TOCADO: consome o estado nomeado; variacao() vira import

test/
└── marca.test.mjs                 # TOCADO: os cinco estados, a linha de topo e o 43×
```

Nenhum arquivo novo. Nenhuma dependência nova. Nenhuma migração. Nenhuma coluna.

## Phase 0 — Research

Ver [research.md](./research.md). As perguntas que precisavam de número antes de virar decisão — o
que o coletor devolve hoje, quais das quatro ausências são alcançáveis na base real, e o que a razão
esconde — foram medidas contra o banco e o Search Console reais em 20/09/2026.

## Phase 1 — Design

Ver [data-model.md](./data-model.md) — os cinco estados, a linha de topo de cada um e a regra de
ausência. Ver [quickstart.md](./quickstart.md) — o roteiro de verificação.

**Revalidação do Constitution Check após a Fase 1**: sem mudança. O desenho não introduziu arquivo
de teste, dependência, variável de ambiente, tabela nem fonte de dados de projeto.
