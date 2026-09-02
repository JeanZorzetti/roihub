# Implementation Plan: Ficha N0-N6 por projeto — a árvore inteira, um projeto por vez

**Branch**: `011-okr-ficha-por-projeto` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

## Summary

Uma rota nova `/okr/<slug>` que renderiza os **sete** níveis N0-N6 de UM projeto, e um menu na aba
OKR que leva até ela. A `/okr` continua idêntica, exceto pelo nome do card virar link (FR-006).

Nada é medido de novo. A `/okr` de hoje já coleta `cliques` (GSC), `leads` (fonte própria ou CRM) e
`vendas` (card), já monta a cadeia com `montarFicha()` e a inversão com `projetar()`. Esta feature
**reaproveita essas três células inteiras** e acrescenta, por cima delas, quatro níveis que hoje não
têm tela: N0 (objetivo declarado), N2 (os fatores da conta de receita), N4 (volume por canal) e N5
(medidores da família do gargalo) — mais N6, que é a agenda daquele projeto pela mesma projeção da
`/agenda`.

O eixo do desenho é o **estado da célula**, não o valor: `apurado` (com fonte), `declarado` (com
data) ou `não apurado` (com motivo e fonte a consultar). A herança é o que impede a R1 de cair por
dentro — `0 tratamentos × R$ 4.000 declarados` é aritmética correta e resultado **declarado**. Por
isso o envelope de estado nasce em módulo novo (`lib/ficha.mjs`) e **não** em `lib/funil.mjs`:
`ehApurado()` reconhece qualquer `{valor}`, e um terceiro estado ali dentro mudaria o comportamento
da `/okr` sem ninguém pedir (SC-001).

O que entra de código: um `.mjs` puro (`lib/ficha.mjs`), a extração da coleta que hoje mora dentro
de `app/okr/page.tsx` para `lib/okr-coleta.ts`, a página `app/okr/[slug]/page.tsx`, o campo `ficha`
no contrato de `lib/projects.ts`, `fatores` no perfil D de `lib/okr.mjs`, e o menu em `app/tabs.tsx`.

## Technical Context

**Linguagem**: JS puro `.mjs` com JSDoc para a montagem da ficha; TypeScript `.tsx`/`.ts` só na
borda — página, `pg` e GSC (Princípio III). Node 22.

**Dependências**: nenhuma nova. Nenhum pacote, nenhum coletor, nenhuma env (FR-036).

**Armazenamento**: `data/projects.json`, campo `ficha` curado à mão, ao lado de `perfil` e `meta`.
Sem migração, sem tabela nova, sem escrita em runtime. Leitura adicional de `hub_acao_dono` (coluna
`atualizado`, que já existe) só para a data de N6.

**Testes**: `test/ficha.test.mjs`, `node:test` + `assert/strict`, registrado na lista de `npm test`
do `package.json` no mesmo commit (Princípio II, FR-034).

**Plataforma**: Next.js 16 App Router, React 19. Deploy Docker/EasyPanel (`output: "standalone"`),
dev em Windows. `dynamic = "force-dynamic"` na rota nova, igual à `/okr` — número de OKR vindo do
build é número de outra janela.

**Tipo de projeto**: aplicação web. Rota nova `app/okr/[slug]/page.tsx` (segmento dinâmico; no Next
16 `params` é `Promise` e precisa de `await`).

**Escala**: 40 projetos, ~6 degraus por cadeia, 4 fatores de N2, 6 canais de N4, ≤5 medidores de N5,
≤3 KRs. A ficha é O(1) por requisição sobre um projeto só — mais barata que a `/okr`, que faz o
mesmo para 40.

**Restrições**: R1 (`não apurado` nunca é `0`), R2 (fração colada em toda razão), R4 (consultar a
fonte antes de instrumentar), R6 (nada de benchmark como meta), R7 (uma janela declarada, 28 dias
fechando em D-3). Leitura pura: a página não edita card, banco nem ação.

**Critério de conferência**: HTML servido pelo EasyPanel, nunca `next dev`. Em produção
`ATMA_DATABASE_URL` está ausente, então a ficha da `atma` lá tem a célula de leads em `não apurado`
e a âncora da 010 recuada para `visitante` — isso é o comportamento correto, e é o que a SC-015
mede.

## Constitution Check

*GATE: passa antes da Fase 0 e revalidado após a Fase 1.*

| Princípio | Como esta feature cumpre | Pós-Fase 1 |
|---|---|---|
| **I. Contrato único de dados** | `ficha` entra no tipo `Project` de `lib/projects.ts` e chega pela `listProjects()`. A barra de abas precisa da lista de fichas curadas e recebe uma função nova **dentro** de `lib/projects.ts` (`listFichas()`), não ao lado — ver Complexity Tracking. Nenhum import de `data/projects.json` fora de `lib/projects.*`. | ✅ ver [contracts/ficha-no-card.md](./contracts/ficha-no-card.md) |
| **II. `node --test` registrado à mão** | `test/ficha.test.mjs` novo, na lista de `npm test` no mesmo commit. `test/validade.test.mjs` reprova se eu esquecer. Nenhum framework instalado. | ✅ |
| **III. `.mjs` puro, `.ts` na borda** | `lib/ficha.mjs` é pura: sem env, sem banco, sem rede, sem relógio — `hoje` e a janela entram como parâmetro. `lib/okr-coleta.ts` é `.ts` porque toca `pg` e `google-auth-library`; ela não contém regra, só busca. A página só renderiza. | ✅ ver [contracts/ficha-mjs.md](./contracts/ficha-mjs.md) |
| **IV. Push é deploy** | Feature de leitura. Sem cron, sem `maxDuration`, sem rota de API. Push fora de 23:30-01:00 e 08:00-08:45 BRT. | ✅ |
| **V. Ambiente explícito, segredo nunca em log** | Nenhuma env nova (FR-036). A coleta reaproveita `lerFontePropria()`, que já reporta **o nome** da variável ausente e nunca o valor. Os motivos de `não apurado` nomeiam campos e tabelas, nunca credenciais. | ✅ |

**Uma violação registrada**, na tabela de Complexity Tracking: a segunda função de leitura em
`lib/projects.ts`.

Nota sobre a R6, que é regra do template e não da constituição, mas é o gate real da árvore: nenhum
caminho desta feature produz número que não seja (a) medido pelos coletores da 009, (b) declarado à
mão no card e rotulado como declarado, ou (c) divisão dos dois pela 010. N2, N4 e N5 **não** ganham
coletor — eles ganham a lista do que falta.

## Decisões de desenho

Detalhadas em [research.md](./research.md); resumo com o motivo de uma linha:

1. **Estado da célula é envelope novo em `lib/ficha.mjs`, não terceiro construtor em
   `lib/funil.mjs`.** `ehApurado()` reconhece qualquer `{valor}`; um `{valor, declaradoEm}` passaria
   por apurado na `/okr` inteira, e a FR-010 cairia com a aritmética certa.
2. **A aba OKR vira link + disclosure irmão, não um `<summary>` que engole o próprio destino.**
   `<summary>OKR</summary>` custaria dois acionamentos para chegar em `/okr`, e a FR-002 proíbe.
3. **`<details open={rotaEhOkr}>` nativo, zero JS de cliente** — a FR-004 pede teclado e sem JS, e o
   elemento nativo já entrega foco, Enter/Espaço e estado inicial decidido no servidor.
4. **`fatores` de N2 moram em `PERFIS.D` de `lib/okr.mjs`**, ao lado dos `marcos` cuja `chave` a
   cobertura referencia. Tabela paralela em outro arquivo divergiria na primeira etapa renomeada.
5. **A coleta sai de `app/okr/page.tsx` para `lib/okr-coleta.ts`.** O comentário do próprio arquivo
   já previa: "se aparecer uma segunda [entrada], isto vira `lib/`". Apareceu a segunda tela.
6. **N6 chama `acoesDoRanking()` de `lib/agenda.mjs`**, sem reimplementar (FR-030). A data vem de
   `hub_acao_dono.atualizado` por uma função nova em `lib/db.ts`, que **não** altera `listDonos()` —
   mudar a assinatura da compartilhada arrastaria a `/agenda` e a `agenda.test.mjs` sem necessidade.
7. **O espaço de chaves de N5 é o catálogo das quatro famílias**, não só a família exibida. KR
   válido não pode virar erro de declaração porque o gargalo se moveu de família.

## Project Structure

### Documentation (this feature)

```text
specs/011-okr-ficha-por-projeto/
├── plan.md              # este arquivo
├── research.md          # Fase 0 — as decisões acima, com as alternativas recusadas
├── data-model.md        # Fase 1 — as entidades e a máquina de estados da célula
├── quickstart.md        # Fase 1 — como conferir, em produção
├── contracts/
│   ├── ficha-mjs.md         # a API de lib/ficha.mjs e as garantias testáveis
│   ├── ficha-no-card.md     # o campo `ficha` em data/projects.json e no tipo Project
│   └── rota-e-menu.md       # /okr/<slug>, 404, e o contrato de navegação
├── checklists/requirements.md
└── tasks.md             # NÃO criado por /speckit-plan
```

### Source Code (repository root)

```text
lib/
├── ficha.mjs          # NOVO — puro. Monta N0-N6, valida KRs, confere cobertura de N2.
├── okr.mjs            # +`fatores` em PERFIS.D. Nada mais muda.
├── okr-coleta.ts      # NOVO — recebe FONTES_PROPRIAS/lerFontePropria + a coleta por projeto
├── projects.ts        # +campo `ficha` no tipo Project, +listFichas()
├── db.ts              # +listDonoDatas() — lê hub_acao_dono.atualizado, coluna que já existe
├── funil.mjs          # INTOCADO
├── projecao.mjs       # INTOCADO
└── agenda.mjs         # INTOCADO

app/
├── tabs.tsx           # a aba OKR vira link + <details> irmão
├── globals.css        # estilo do menu, e o que impede rolagem horizontal em 390px
├── okr/page.tsx       # só a FR-006 (nome vira link) + passa a importar a coleta de lib/
└── okr/[slug]/page.tsx  # NOVO — a ficha

data/projects.json     # +campo `ficha` na atma (objetivo, krs, declaradaEm)
test/ficha.test.mjs    # NOVO — registrado em package.json no mesmo commit
package.json           # +test/ficha.test.mjs na lista de `npm test`
```

**Structure Decision**: aplicação web Next.js App Router de projeto único, sem separação
backend/frontend. A regra de negócio nasce em `lib/*.mjs` testável por `node --test`; a borda
(`pg`, GSC, React) fica em `.ts`/`.tsx`. É o layout que a constituição impõe e que a 009 e a 010 já
seguem.

## Complexity Tracking

| Violação | Por que é necessária | Alternativa mais simples, e por que foi recusada |
|---|---|---|
| **`listFichas()` — segunda função de leitura em `lib/projects.ts`** (Princípio I) | A barra de abas é renderizada nas 12 telas e precisa saber quais projetos têm ficha curada. `listProjects()` chama `listRepos()` (API do GitHub), e as três telas que hoje não leem projeto (`/busca`, `/ia`, `/automacao`) passariam a pagar essa chamada no cold start só para desenhar um menu. | (a) `Tabs` chamando `listProjects()`: custo de rede numa barra de navegação, em toda tela. (b) Prop nova em `Tabs`: 12 arquivos editados para o mesmo dado. Fica dentro do contrato porque mora **em `lib/projects.ts`** e porque as duas listas concordam por construção — `ficha` só existe na curadoria manual, e repo vindo do GitHub nunca tem o campo. Não há o risco de "lista sem os repos" que o Princípio I guarda. |
