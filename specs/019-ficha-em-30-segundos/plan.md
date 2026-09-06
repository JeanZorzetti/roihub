# Implementation Plan: A ficha responde em 30 segundos

**Branch**: `019-ficha-em-30-segundos` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-ficha-em-30-segundos/spec.md`

## Summary

A 018 deixou **todos os números certos**; esta spec muda **onde eles aparecem** e liga dois que
estavam calados. Nada é recalculado (FR-036), com uma exceção escrita: `n1Total`/`n1Janela`, hoje
suprimidos pela guarda 8 de `projetar()`.

Abordagem técnica — **nenhuma dependência nova, nenhum arquivo de teste novo, nenhuma chamada de
rede nova na ficha**:

1. **Reordenar a ficha** (FR-001..FR-007): três blocos acima de tudo — cadeia (com o veredito
   virando legenda dela), motivo + ação num bloco só, lista de buracos. O que sai (N0–N6, árvore,
   índice de âncoras) **muda de rota, não de código**.
2. **Partir a guarda 8** (FR-008..FR-012): `meta ÷ ticket` não toca a âncora e volta a sair
   apurada; `meta ÷ cadeia` continua não apurada nomeando a âncora zerada. O conserto mora dentro
   de `projetar()`, portanto vale para os 17 projetos e para `/okr`.
3. **Somar o pipeline** (FR-013..FR-017): `enviados · fechados · vivos`, derivado de query. Exige
   **uma coluna a mais** no SELECT de leads (`id`) — sem ela não há como ligar orçamento a
   `motivo` — e a lista de motivos de perda **declarada no card**.
4. **Duas subpáginas de template** (FR-018..FR-029): `/okr/[slug]/metodo` (N0–N6 + árvore) e
   `/okr/[slug]/aquisicao` (GSC 8 meses, GA4 12 meses), as duas em ISR de 1 hora. A orquestração
   que hoje vive dentro de `FichaPage` sobe para um módulo compartilhado — duas cópias divergiriam
   na primeira mudança de veredito, e a FR-021 proíbe exatamente isso.
5. **Costurar a época** (FR-030..FR-033): a camada de impressões da árvore passa a exigir
   **coincidência de janela**, não o nome do primeiro marco. Sem chamada nova: a época da atma (37
   dias) cabe inteira dentro dos 84 dias que `gscSeries()` **já** busca — basta fatiar a série.

## Technical Context

**Language/Version**: TypeScript 5.9 (borda) + JavaScript ESM `.mjs` (lógica pura), Node 22

**Primary Dependencies**: Next 16 (App Router), React 19, `pg`, `google-auth-library` — **nenhuma
nova**. Framework de teste proibido (Princípio II).

**Storage**: Postgres da Atma via `ATMA_DATABASE_URL` (somente leitura: `patient_leads`,
`orcamentos`), Postgres do hub via `DATABASE_URL` (agenda/CRM), GSC e GA4 Data API por HTTP.
**Nenhuma migração, nenhum DDL, nenhuma escrita.**

**Testing**: `node:test` + `assert/strict`. **Zero arquivo de teste novo** — toda regra desta spec
cai em módulo que já tem suíte registrada (`okr`, `projecao`, `janelas`, `arvore-metas`, `ficha`).

**Target Platform**: Next 16 server components em Docker/Alpine no EasyPanel; dev em Windows.

**Project Type**: aplicação web única (sem `src/`, sem monorepo) — `app/` telas, `lib/` lógica,
`test/` testes, `scripts/` corridas manuais.

**Performance Goals**:

- `/okr/[slug]` mantém **exatamente** as chamadas de rede de hoje (`force-dynamic`): nenhuma
  janela longa nela.
- `/okr/[slug]/metodo` e `/okr/[slug]/aquisicao`: `revalidate = 3600` (FR-028a).
- A camada de impressões da época **não** adiciona chamada: fatia a série de 84 dias já buscada.
- Suíte ≤ ~2 s (hoje ~1,6 s).

**Constraints**:

- `montarNiveis()` **não pode mudar de saída** (FR-019) — a suíte de N0–N6 passa sem edição.
- `descoberta()`/`comportamento()` (28d/D-3) **não mudam** (FR-024); o default de `gscSeries()`
  **não muda** (FR-025) — as janelas longas entram como parâmetro opcional.
- Nenhuma constante de contagem no código ou no teste (FR-016, SC-004): o banco é o oráculo.
- `status_historico` fora de escopo (FR-034); os três defeitos de renderização já fechados em
  `64bb0a7` são regressão, não entrega (FR-035).
- Réguas e `market_benchmarks` são a 020 (FR-037) e não bloqueiam.

**Scale/Scope**: 17 cards curados, 1 com fonte própria (`atma`). 8 arquivos de `lib/`, 1 tela
reescrita, 2 telas novas, 1 módulo de orquestração extraído, 5 arquivos de teste **já
registrados**, 1 card de `data/projects.json`.

## Constitution Check

*GATE: passar antes da Fase 0; revalidado após a Fase 1.*

| # | Princípio | Como esta feature cumpre | Veredito |
|---|---|---|---|
| I | Contrato único de dados | As duas rotas novas leem por `listProjects()`, como a ficha. `motivosDePerda` entra como campo de `Project` em `lib/projects.ts`, não como leitura solta do JSON. Nenhum import de `data/projects.json` fora de `lib/projects.*`. | ✅ |
| II | `node --test`, registrado à mão | **Nenhum arquivo de teste novo**: buracos e valor em risco entram em `test/okr.test.mjs`, a guarda partida em `test/projecao.test.mjs`, as janelas longas em `test/janelas.test.mjs`, a costura da época em `test/arvore-metas.test.mjs`. Todos já na lista do `package.json`; `test/validade.test.mjs` continua fechando os dois sentidos. Nenhum framework instalado. | ✅ |
| III | `.mjs` para lógica pura, `.ts` só na borda | `buracosDeVerdade()`, `valorEmRisco()`, a guarda partida e a coincidência de janela nascem em `.mjs`. `lib/ficha-dados.ts` é orquestração (`pg`, `google-auth-library`, `evaluateAll`) — borda por definição, e **nenhuma regra nova mora nele**: é o mesmo corpo que hoje está dentro de `FichaPage`, movido. | ✅ |
| IV | Push é deploy | Sem push em 23:30–01:00 e 08:00–08:45 BRT. Nada aqui altera `maxDuration` nem toca o autopublishing. | ✅ |
| V | Ambiente explícito, segredo nunca em log | Nenhuma variável nova. As rotas novas herdam a validação por nome de `lerFontePropria()`/`getClient()`; ISR não muda quem valida o quê. | ✅ |
| — | Sem linter/formatter, sem dependência nova | Zero pacote adicionado; estilo copiado do arquivo vizinho. | ✅ |
| — | Comentário explica o porquê, com o fato medido | Cada mudança carrega o fato que a motivou (5.267px em 360px; 29 de 52 `sem_resposta` a quatro blocos da ação; 9 de 9 `orcamentos.status = enviado`; 37 dias de época dentro dos 84 do GSC). | ✅ |

**Violações**: nenhuma. Complexity Tracking fica vazia de propósito.

**Notas de precedência**:

- A FR-011 **revoga por escrito** a FR-034 da 018 (`lib/projecao.mjs` não ganha regra nova). Era
  regra de spec, não de constituição — não há gate constitucional a justificar.
- A extração de `lib/ficha-dados.ts` é **movimento, não abstração nova**: existe porque três telas
  precisam da mesma composição e a FR-021 exige uma chamada só de `evaluateAll()`. A segunda cópia
  é que seria o defeito.

### Re-check pós-Fase 1

Repetido após `data-model.md` e `contracts/`: nenhum artefato de design introduz dependência,
framework de teste, import direto de `data/projects.json`, regra testável em `.ts`, variável de
ambiente nova ou log de segredo. **Continua ✅, sem entradas em Complexity Tracking.**

## Project Structure

### Documentation (this feature)

```text
specs/019-ficha-em-30-segundos/
├── spec.md              # a especificação (já escrita)
├── plan.md              # este arquivo
├── research.md          # Fase 0 — as 9 decisões de implementação
├── data-model.md        # Fase 1 — buraco, valor em risco, janela longa, costura da época
├── contracts/           # Fase 1 — os 4 contratos de módulo
│   ├── buracos.md
│   ├── projecao-guarda-8.md
│   ├── valor-em-risco.md
│   └── rotas-e-janelas-longas.md
├── checklists/requirements.md
├── quickstart.md        # Fase 1 — como reproduzir e validar contra o banco
└── tasks.md             # Fase 2 — /speckit-tasks, NÃO criado aqui
```

### Source Code (repository root)

```text
lib/
├── okr.mjs              # NOVO export `buracosDeVerdade(marcos)` (o filtro que já existe na
│                        #   linha 451, extraído) + `valorEmRisco()` (FR-004, FR-013..FR-017)
├── projecao.mjs         # guarda 8 partida: n1Total/n1Janela sobrevivem à âncora zerada
│                        #   (FR-008..FR-010) — revoga 018/FR-034
├── arvore-metas.mjs     # camada de impressões por COINCIDÊNCIA DE JANELA (FR-030..FR-033)
├── janelas.mjs          # + descobertaLonga() 8 meses, comportamentoLongo() 12 meses (FR-023)
├── okr-coleta.ts        # SELECT de leads ganha `id`; expõe linhas de orçamento e o mapa
│                        #   lead→motivo para o valor em risco (FR-015, FR-015a)
├── gsc.ts               # gscSeries() ganha `inicio`/`fim` OPCIONAIS — default intocado (FR-025)
├── ga4.ts               # + ga4Cobertura(): primeiro/último dia com dado, para a FR-027
├── ficha-dados.ts       # NOVO — a orquestração que hoje vive dentro de FichaPage, movida:
│                        #   coleta → montarFicha → posicaoDeAtaque → projetar → montarNiveis,
│                        #   com UMA chamada de evaluateAll() para as três telas (FR-021)
└── projects.ts          # Project ganha `motivosDePerda?: string[]` (FR-015, FR-015b)

app/okr/
├── page.tsx             # nenhuma edição de regra — herda o texto novo de <Projecao> (FR-008a)
├── projecao.tsx         # renderiza n1Total mesmo com veredito `nao-apurado` (FR-012)
├── arvore.tsx           # sem mudança — muda de página, não de componente
└── [slug]/
    ├── page.tsx         # REESCRITA da ordem: cadeia+veredito+régua → motivo+ação → buracos →
    │                    #   placar (projeção + valor em risco) → link único para o método
    ├── buracos.tsx      # NOVO — a lista (FR-004, FR-005)
    ├── risco.tsx        # NOVO — enviados · fechados · vivos · órfão (FR-013..FR-017)
    ├── metodo/page.tsx  # NOVA ROTA — N0–N6 + árvore, revalidate=3600 (FR-018..FR-021, FR-028a)
    └── aquisicao/page.tsx # NOVA ROTA — GSC 8m + GA4 12m, revalidate=3600 (FR-022..FR-029)

test/                    # TODOS já registrados no package.json — nenhum arquivo novo
├── okr.test.mjs         # buracosDeVerdade, valorEmRisco, órfão, taxonomia ausente
├── projecao.test.mjs    # n1Total apurado com âncora zerada; fator/múltiplo seguem não apurados
├── janelas.test.mjs     # janelas longas; as curtas byte a byte iguais (SC-007)
├── arvore-metas.test.mjs# costura da época; sem `epoca` para onde para hoje; nunca compõe períodos
└── ficha.test.mjs       # montarNiveis() sem mudança de saída (FR-019) — trava, não edição

data/projects.json       # card `atma`: motivosDePerda
handoff/                 # linha de base da SC-000 (alturas medidas ANTES de editar)
```

**Structure Decision**: nenhuma estrutura nova. Continua a aplicação Next 16 única, com a separação
`.mjs` (puro, testável sem subir o Next) × `.ts` (borda) do Princípio III. Um arquivo novo de
`lib/`: `ficha-dados.ts` (borda, movimento de código existente); **nenhum `.mjs` novo** — toda
regra desta spec cabe em módulo que já existe e já tem suíte. As rotas novas são
`app/okr/[slug]/<sub>/`, do **template**, nunca `app/okr/atma/…`: rota exclusiva de um projeto
seria a primeira vez que o hub faz isso (Assumptions da spec).

## Complexity Tracking

> Vazia: o Constitution Check passou sem violações.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Riscos declarados (não são violações — são o que vigiar)

1. **A coluna `id` de `patient_leads` nunca foi pedida.** Sem ela, orçamento não se liga a
   `motivo` e a FR-015 não tem como sair. É uma coluna a mais num SELECT que já roda, mas é a
   única mudança desta spec que depende de o banco da Atma ter o que se supõe que tenha.
   **Primeira tarefa da US3, antes de qualquer código de tela.**
2. **ISR de 1 h no `/metodo`.** A FR-028a manda ISR nas duas subpáginas; a justificativa escrita é
   o custo das janelas longas, que só o `/aquisicao` tem. O `/metodo` carrega números da janela de
   Conversão, que cresce todo dia. Uma hora não muda dígito numa cadeia de 52 leads, e a ficha
   continua `force-dynamic` — mas se a leitura do método virar diária, é o primeiro item a revisar.
3. **`n1Total` publicado muda o texto de `/okr` para todo projeto de cadeia zerada** (FR-008a,
   consequência declarada). Não afeta o ranking: `posicaoDeAtaque()` lê só `ficha`, nunca
   `projecao` (`lib/okr.mjs:435-470`, verificado).
