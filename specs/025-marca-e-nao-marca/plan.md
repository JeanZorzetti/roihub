# Implementation Plan: Marca e não-marca — separar a demanda que já é sua da que ainda não é

**Branch**: `025-marca-e-nao-marca` | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-marca-e-nao-marca/spec.md`

## Summary

Duas medidas do board — **Crescimento de Impressões Não-Marca** e **Proporção de Buscas de Marca** —
não existem porque `hub_gsc_dia` guarda o site inteiro sem separação. A separação já decide na casa
(o card do sirius traz *"cliques não-branded = 2 (branded = 4)"*, medido à mão), ela só não é
automática.

**A decisão que carrega a feature inteira é recusar a subtração.** O `CLAUDE.md` já mediu por que
`total − marca` não é não-marca (*"5 contra 33 no tapepro"*): o total inclui as consultas
anonimizadas e a fatia de marca não, então a subtração devolve não-marca **mais** o resto
anonimizado — inflando exatamente o KPI que se quer ver crescer. Então a corrida **mede as duas
fatias**, cada uma na sua requisição, e a soma delas contra o total do mesmo corte vira a resposta
para a pergunta que a spec diz não ter resposta em documentação (D1, D8).

Três entregas, na ordem em que se destravam:

1. **A série sabe quem buscou pelo nome** — sete colunas em `hub_gsc_dia` e três pernas novas na
   corrida que o cron das 05:17 já dispara. O backfill não é um evento: as pernas de marca puxam a
   janela de 480 dias **toda corrida**, o que preenche a história e a reclassifica sozinha quando a
   lista de termos muda (D4). FR-001..FR-006, FR-014, FR-015.
2. **Os dois KPIs, com o rótulo do que a fonte não conta** — a aba de aquisição lê o banco (D11) e
   exibe crescimento e razão contra as metas do board, marcados **piso** quando a soma não fecha.
   FR-007..FR-010, FR-012.
3. **A canibalização para de acusar a própria marca** — a mesma regra de casamento filtra a lista e
   **diz quantas** removeu; o parágrafo de ressalva sai da tela. FR-011, FR-013.

**A restrição que molda o plano é a armadilha de "a primeira corrida mede o CHECK", que esta base
já pagou quatro vezes.** Por isso o corte por país vale para as três pernas (D2) e as três são
pedidas na mesma corrida e na mesma janela (D13): com o total sem corte, ou com pernas de corridas
diferentes, a diferença mediria o corte de país ou o deslizamento da janela do GSC — nunca a
anonimização, que é o que se quer saber.

Nenhuma tabela nova, nenhuma rota nova, nenhum workflow novo, nenhum segredo novo, nenhuma
dependência nova.

## Technical Context

**Language/Version**: TypeScript + JavaScript (ESM), Node 22

**Primary Dependencies**: Next.js 16 (App Router), React 19, `pg`, `google-auth-library`.
**Nenhuma dependência nova.**

**Storage**: Postgres. `hub_gsc_dia` (021) ganha 7 colunas nulas por
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` dentro do `ensure()` de `lib/db.ts` — o padrão que
`hub_tasks` já usa para `descricao`, `tipo`, `responsavel` e `gerador`.

**Testing**: `node --test` sobre `test/*.test.mjs`, lista explícita em `package.json`
(Princípio II). Um arquivo novo: `test/marca.test.mjs`. `test/kpis-busca.test.mjs` ganha os casos
do filtro e ajusta três asserções pela mudança de forma da D10.

**Target Platform**: Linux/Alpine em Docker no EasyPanel; dev em Windows.

**Project Type**: Aplicação web única (App Router + `lib/`), sem separação front/back.

**Performance Goals**: 3 requisições extras por projeto por corrida, ~480 linhas cada, para
**1 projeto** (`SLUGS_DE_BUSCA = ["atma"]`). Ordem de segundos dentro do `maxDuration = 300` que a
rota já declara — sem encostar no limite do proxy do EasyPanel.

**Constraints**: a atribuição vale **dentro do corte de país declarado** e a tela é obrigada a
dizer qual (FR-005). A soma das fatias pode não fechar com o total, e nesse caso as duas são
**pisos** rotulados (FR-007). Janelas de deploy proibidas do Princípio IV.

**Scale/Scope**: 1 projeto, ~480 dias por perna, cadência diária. A estrutura aceita os outros 34
no dia em que entrarem em `SLUGS_DE_BUSCA` e ganharem `marca` no card.

## Constitution Check

*GATE: revisto contra `.specify/memory/constitution.md`. Reavaliado após a Fase 1 — sem mudança.*

| Princípio | Como esta feature cumpre |
|---|---|
| **I. Contrato único de dados** | A declaração de marca é campo do card e entra pelo tipo `Project` de `lib/projects.ts`, **dentro** de `listProjects()` — não uma segunda fonte ao lado. A corrida continua percorrendo `projetosDeBusca()` (FR-014). Nenhum import de `data/projects.json`. A chave gravada é o **slug**. |
| **II. `node --test` registrado à mão** | `test/marca.test.mjs` novo, acrescentado à lista de `package.json` **no mesmo commit**; `test/kpis-busca.test.mjs` ganha os casos do filtro de marca. `test/validade.test.mjs` reprova se esquecermos. |
| **III. `.mjs` puro, `.ts` só na borda** | Tudo o que dá para errar em silêncio nasce em `lib/marca.mjs`, puro: a regra de casamento (D3), o adensamento (D5), o mês fechado (D9) e o veredito de completude (D8). Sem `fetch`, sem `pg`, sem `process.env`, **sem relógio interno** — `hoje` é parâmetro, como o ano vigente foi na 024. A borda `.ts` só pede, grava e renderiza. |
| **IV. Push é deploy** | Nenhum cron novo. A corrida continua às 05:17 BRT (`17 8 * * *`), fora das duas janelas proibidas. `maxDuration` **inalterado** em 300 — o proxy do EasyPanel não muda. |
| **V. Ambiente explícito, segredo nunca em log** | A validação de entrada da rota é a mesma e devolve `503` com **apenas os nomes** ausentes. Reusa o `CRON_SECRET` que o middleware já conhece: a capacidade não cresce — é o mesmo Search Console que a rota já lê. Erros continuam truncados em 60 caracteres, sem valor de ambiente. |

**Sem violações.** A tabela de Complexity Tracking fica vazia de propósito.

## Decisões técnicas

Detalhe e alternativas rejeitadas em [research.md](./research.md). Em resumo:

- **D1 — Não-marca é MEDIDA, não subtraída.** Três pernas com `dimensions: ["date"]`: total do
  corte, `query includingRegex`, `query excludingRegex`. Custa uma requisição a mais e transforma a
  pergunta aberta da spec num número apurado.
- **D2 — O corte por país vale para as três pernas.** Com o total sem corte, a soma jamais fecharia
  e a diferença mediria o corte, não a anonimização. E `"atma"` é palavra comum em sânscrito: o
  edge case do "termo de marca que também é palavra genérica" acontece no projeto **piloto**.
- **D3 — `regexDeMarca(termos)`, uma fonte para dois consumidores.** A corrida prefixa `(?i)` e
  manda ao GSC; a tela faz `new RegExp(padrao, "i")`. Casamento por **palavra inteira**, termos
  longos primeiro, sem dobra de acento. Duas implementações divergiriam na primeira variante nova.
- **D4 — As pernas de marca puxam a janela inteira toda corrida.** Mata o backfill como evento
  (FR-003) **e** reclassifica a história sozinha quando a lista muda — que é o que a lista sendo
  curadoria exige.
- **D5 — Dia sem linha é `0`, não `NULL`.** Sem o adensamento, "nenhuma busca de marca" e "não
  declarada" ficariam indistinguíveis dentro do banco.
- **D6 — Escrita é `UPDATE`, nunca `INSERT`.** Reusar `gravarDiasGsc` sobrescreveria o total de
  ~477 dias com valores que a chamada de marca não tem.
- **D7 — A declaração mora no card**, com o país junto. Sem `pais` é declaração inválida ⇒ **não
  declarada com o motivo nomeado**, nunca meia-medição.
- **D8 — O resíduo é derivado, não coluna.** Quatro estados: `fecha`, `piso`, **`contradicao`**
  (resíduo negativo = defeito de filtro, não limitação da fonte) e `nao-declarada`.
- **D9 — Mês fechado exige calendário completo E três dias de folga.** São duas formas de fabricar
  queda: o mês parcial (janeiro tem 21 dias na série) e a ponta provisória do GSC.
- **D10 — `canibalizacao()` ganha `ehMarca` e passa a devolver `{ lista, removidas }`.**
  `removidas: null` (não declarada) ≠ `0` (declarada, nada casou).
- **D11 — A tela lê o banco**, e vira o primeiro consumidor de `lerDiasGsc()` — que a 021 escreveu
  e ninguém chamava.
- **D13 — As três incertezas do Search Console falham alto.** Nenhuma fica em aberto sem detector;
  a `quickstart.md` checa `impressoesMarca > 0` **antes** de acreditar num resíduo zero.

## Project Structure

### Documentation (this feature)

```text
specs/025-marca-e-nao-marca/
├── spec.md                        # aprovado 08/09/2026
├── plan.md                        # este arquivo
├── research.md                    # D1..D13, decisões e alternativas rejeitadas
├── data-model.md                  # as 7 colunas, o campo do card e as formas em memória
├── quickstart.md                  # como provar que funciona — e o que NÃO é prova
├── contracts/
│   └── api-gsc-serie.md           # POST /api/gsc-serie, lerDiasGsc(), lib/marca.mjs
├── checklists/
│   └── requirements.md            # já aprovado
└── tasks.md                       # próximo passo (/speckit-tasks)
```

### Source Code (repository root)

```text
lib/
├── marca.mjs                 # NOVO, puro — regexDeMarca, marcaDeclarada, adensarDias,
│                             #   mesesFechados, crescimentoNaoMarca, razaoDeMarca, completude
├── gsc.ts                    # + gscSerieFiltrada(): a série diária com corte de país e
│                             #   filtro de consulta opcional (includingRegex/excludingRegex)
├── kpis-busca.mjs            # canibalizacao(linhas, ehMarca) → { lista, removidas } (D10)
├── db.ts                     # + 7 ALTER TABLE no ensure(), + gravarMarcaGsc(),
│                             #   lerDiasGsc() devolve as colunas novas
└── projects.ts               # + campo `marca` no tipo Project

data/
└── projects.json             # + "marca" no card da atma (curadoria)

app/
└── okr/[slug]/aquisicao/page.tsx   # bloco novo (2 KPIs + lista de termos + rótulo de piso)
                                    # e a canibalização filtrada; sai o parágrafo de ressalva

app/api/gsc-serie/route.ts    # as três pernas por projeto + `marca`, `conferencia`, `semMarca`

test/
├── marca.test.mjs            # NOVO — registrado em package.json no mesmo commit
└── kpis-busca.test.mjs       # + filtro de marca; 3 asserções ajustadas pela D10

CLAUDE.md                     # o número da conferência (SC-003), quando a 1ª corrida devolver
```

**Structure Decision**: a estrutura existente, sem camada nova — e o corte do Princípio III é o que
decide o sucesso aqui. **As quatro armadilhas desta spec são regras, não rede**: alternação com o
termo curto na frente, dia omitido virando `NULL`, mês parcial comparado com mês inteiro, ponta
provisória lida como fechada. Todas produzem números que *parecem certos* e todas cabem num teste
de milissegundos em `lib/marca.mjs`. Descobri-las em produção custa um mês de KPI errado — e, no
caso do não-marca, um KPI errado **para o lado que agrada**.

## Riscos aceitos, e por quê

| Risco | Mitigação |
|---|---|
| **A soma pode não fechar com o total** (5 contra 33 no tapepro) | É o risco que a feature existe para **medir**, não para evitar. A corrida registra o resíduo (FR-006) e a tela rotula os dois números como piso com o tamanho da diferença (FR-007) |
| **`includingRegex` pode exigir casamento da consulta inteira**, zerando a perna de marca | Falha alto: `marca ≈ 0` e `nao-marca ≈ total`. A `quickstart.md` manda checar `impressoesMarca > 0` **antes** de ler o veredito — um resíduo zero com marca zerada diria "fecha" e estaria errado |
| **`excludingRegex` pode não ser o complemento exato** | Resíduo **negativo**, que tem estado próprio (`contradicao`) e nunca é arredondado para zero — defeito de filtro e limitação da fonte pedem consertos opostos |
| **Lista de marca pobre erra para o lado que agrada** — variante esquecida infla o não-marca | Não há conserto técnico: é curadoria. Por isso a FR-012 põe a lista **na tela**, e a D4 faz a lista nova reclassificar a história inteira na corrida seguinte, em vez de deixar dois períodos com réguas diferentes |
| **Reclassificação silenciosa**: editar `termos` muda números já lidos | Aceito e preferido ao congelamento. `declaradaEm` fica ao lado da lista na tela, e a lista visível é a que classificou — o par (número, lista) é sempre coerente |
| **O primeiro mês fechado sai sem crescimento** | É a FR-009: "ainda não apurável", com asserção de teste explícita de que **não é `0%`** |
| **A janela do GSC desliza na meia-noite UTC** (33 e depois 42 na mesma tarde) | As três pernas na mesma corrida e na mesma janela (D13). A data de apuração é carimbada em BRT como no resto da casa |
| **A perna de marca cobre 480 dias, o total só desde 11/01/2026** | ~239 dias saem em `semLinhaDeTotal` na primeira corrida. É esperado e sai **contado** na resposta, não engolido — dia sem total não tem denominador |
| Mudança de forma de `canibalizacao()` quebra um consumidor | Um arquivo e três asserções, no mesmo commit. `npm test` reprova se ficar pela metade |

## Complexity Tracking

Sem violações da constituição a justificar.
