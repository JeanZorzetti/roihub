# Implementation Plan: A árvore de OKR do portfólio

**Branch**: `009-okr-arvore` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

## Summary

Uma rota `/okr` que, por projeto, escolhe a cadeia do **perfil** declarado, preenche as células
com as fontes que o hub já lê, e devolve a **posição de ataque do §7** — o veredito de qual é a
única coisa que adianta fazer agora naquele projeto.

O grosso já existe. `lib/funil.mjs` implementa R1, R3 e R5; `scripts/funil.mjs` implementa R2 na
impressão e sabe coletar das três fontes; `/seo` já é uma página que consulta o GSC por request.
O que esta feature adiciona é **o que falta para o template virar executável**: os quatro perfis,
a atribuição de família D1-D4, e a função determinística do §7.

## Technical Context

**Linguagem**: JS puro `.mjs` com JSDoc para a lógica; TypeScript `.tsx` só na página (Princípio III).

**Dependências**: nenhuma nova. `pg` e `google-auth-library` já estão no projeto.

**Fontes de dado, todas já existentes**:

| Célula | Fonte | Como o hub já lê |
|---|---|---|
| cliques (entrada) | Search Console, 28d fechando em D-3 | `gscSeries()` + `totals28()`, igual `/seo` |
| leads | `crm_leads` no Postgres | `listLeads()` de `lib/db.ts`, igual `/crm` |
| leads (fonte própria) | `patient_leads` da Atma | hoje só em `scripts/funil.mjs`; ver D5 |
| vendas | campo `vendas` do card | `listProjects()` (o campo sobrevive ao spread do `mergeProjects`) |
| perfil | campo `perfil` novo no card | curadoria manual, como `familia` e `estado` |

**Testes**: `test/okr.test.mjs`, `node:test` + `assert/strict`, registrado em `package.json` no
mesmo commit (Princípio II).

**Escala**: 35 projetos. Uma consulta ao GSC por projeto (já é o custo de `/seo`) e **uma** query
de leads para todos. `dynamic = "force-dynamic"`, sem cache — igual `/seo` e `/crm`.

## Constitution Check

| Princípio | Como esta feature cumpre |
|---|---|
| **I. Contrato único de dados** | A página chama `listProjects()`. Nenhum import de `data/projects.json` fora de `lib/projects.*`. O campo `perfil` entra no tipo `Project` de `lib/projects.ts`, dentro do contrato — não ao lado dele. |
| **II. `node --test` registrado à mão** | `test/okr.test.mjs` novo, adicionado à lista de `npm test` no `package.json` no mesmo commit. `test/validade.test.mjs` reprova se eu esquecer. |
| **III. `.mjs` puro, `.ts` na borda** | Perfis, cadeia, famílias e §7 nascem em `lib/okr.mjs`, testáveis sem subir o Next. `app/okr/page.tsx` só busca e renderiza. |
| **IV. Push é deploy** | Feature de leitura, sem cron e sem `maxDuration`. Push fora de 23:30-01:00 e 08:00-08:45 BRT. |
| **V. Ambiente explícito, segredo nunca em log** | A página não recebe segredo. Fonte ausente vira `não apurado` com o **nome** da variável ou da fonte, nunca valor — e isso já é o que a R8 pede. |

Sem violação. Tabela de Complexity Tracking vazia.

## Decisões de desenho

### D1 — `lib/okr.mjs` novo, não `lib/funil.mjs` estendido

`lib/funil.mjs` tem um contrato fechado e correto: célula, `razao()`, `ehLeadDeTeste()`, e os três
degraus fixos que `scripts/funil.mjs` consome hoje. Mexer nele para caber quatro cadeias
diferentes quebraria o script sem ganho.

`lib/okr.mjs` **importa** `lib/funil.mjs` e não reimplementa nada dele. R1, R3 e R5 continuam
morando num lugar só. Se `okr.mjs` reescrevesse `razao()`, existiriam duas regras de `0/0` no
repo e uma delas ficaria para trás na primeira correção.

### D2 — Perfil é campo curado no card, sem inferência

`perfil: "A" | "B" | "C" | "D"` em `data/projects.json`, escrito à mão como `familia` e `estado`
já são. Inferir perfil do texto do card seria a mesma armadilha do `blockers` que media o texto
e não o bloqueio: `grep manual|jean` devolvia 18 cards contra os 5 reais.

Projeto sem `perfil` **não cai em perfil padrão** — sai numa faixa própria como
`não apurado: sem perfil declarado`. Um perfil errado produz uma cadeia errada, e cadeia errada
é pior que cadeia ausente: ela parece medida.

### D3 — A cadeia é declarativa; o coletor é opcional por degrau

Cada perfil declara seus degraus na ordem, e cada degrau declara **de onde o número viria**.
Degrau com coletor ligado recebe a célula apurada; degrau sem coletor recebe
`naoApurado("<fonte a consultar>")`.

Isso é o FR-019 resolvido, e é o que faz a tela virar lista de encanamento em vez de tabela de
buracos anônimos. A ordem da R4 (tabela do projeto → gateway → CRM → e-mail → GA4/GSC → WhatsApp
→ só então instrumentar) fica escrita no próprio degrau.

### D4 — §7 é função pura de uma ficha, e retorna a célula que decidiu

`posicaoDeAtaque(ficha)` devolve `{ posicao, rotulo, celula, motivo }`. Devolver só o número
tornaria o veredito inauditável: "posição 2" sem dizer qual `não apurado` a causou é a mesma
opinião que a tela existe para substituir.

A ordem é a do §7 e o **curto-circuito é a semântica**: achou fator zerado, para. Não continua
procurando taxa baixa, porque otimizar uma taxa num projeto com fator zerado é exatamente o
desperdício que o template nomeia.

### D5 — A fonte própria da Atma fica no script nesta feature

`scripts/funil.mjs` lê `patient_leads` por `ATMA_DATABASE_URL`. Trazer isso para a página exigiria
um segundo pool de Postgres para banco externo dentro do request do Next.

Nesta feature a página lê `patient_leads` **pela mesma via do script**, se e somente se a env
existir; sem ela, a célula de leads da Atma é `não apurado: ATMA_DATABASE_URL ausente` — nome da
variável, nunca valor (Princípio V). Falha fechada: banco externo fora **não** vira "0 leads".

### D6 — Contagem de vendas é rotulada como contagem

FR-018. A célula N1 exibe `N vendas` e, ao lado, `R$ não apurado: sem ticket declarado`. Exibir a
contagem sob um rótulo de dinheiro seria fabricar a métrica primária — a versão mais cara do
erro que a R1 descreve.

### D7 — A página é leitura pura

Sem server action, sem escrita, sem `perfil` editável pela tela. O perfil se edita no card, que é
onde a curadoria mora e onde ela entra no git com diff.

## Project Structure

### Documentation (this feature)

```
specs/009-okr-arvore/
├── spec.md      ← escrito
├── plan.md      ← este arquivo
└── tasks.md
```

### Source Code (repository root)

```
lib/
├── funil.mjs        (intocado — importado por okr.mjs)
├── okr.mjs          NOVO: PERFIS, montarFicha(), familiaDe(), posicaoDeAtaque()
└── projects.ts      +perfil, +vendas no tipo Project

app/
├── okr/
│   └── page.tsx     NOVO
└── tabs.tsx         +aba "OKR"

data/
└── projects.json    +perfil nos 35 cards

test/
└── okr.test.mjs     NOVO (registrado em package.json)
```

## Complexity Tracking

Nenhuma violação constitucional a justificar.
