---

description: "Task list — 052 mapa por projeto (Sirius entra como segundo)"
---

# Tasks: O mapa de GSC por projeto — o Sirius entra como segundo

**Input**: Design documents from `specs/052-mapa-por-projeto/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mapa-por-projeto.md, quickstart.md

**Tests**: o plano pede testes (`node --test`, Princípio II): `cadeiaLigada` em `test/okr.test.mjs`, `deBusca` em
`test/projects.test.mjs`, `SLUGS_DE_CAMPO` em `test/crux.test.mjs` e o arquivo novo `test/mapa-projeto.test.mjs`.
Cada teste é escrito antes da função e tem de falhar antes dela existir.

**Organization**: por história. As linhas citadas de `app/gsc/mapa/page.tsx` são as de 21/09/2026 (2186
linhas), conferidas contra o arquivo na geração desta lista. Depois do `git mv` (T010) o arquivo é
`app/gsc/mapa/[slug]/page.tsx` e as linhas continuam as mesmas até a primeira edição. Localize pelo texto
citado, não só pelo número.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: US1–US4 da spec

---

## Phase 1: Setup

**Purpose**: fixar o "antes" da SC-002 antes de mexer em qualquer arquivo.

- [X] T001 Gravar o hash do commit anterior à 052 (`git rev-parse HEAD`, rodado antes de qualquer edição) no bloco de código de `specs/052-mapa-por-projeto/quickstart.md` §2, no lugar de `<commit anterior à 052>`

---

## Phase 2: Foundational (bloqueia as quatro histórias)

**Purpose**: a lógica pura e testável, a lista de projetos com mapa e a rota movida. Sem isso nenhuma
história abre.

**⚠️ CRITICAL**: nenhuma história começa antes desta fase fechar.

### Testes primeiro (têm de falhar)

- [X] T002 [P] Em `test/okr.test.mjs`, acrescentar os casos de `cadeiaLigada` (data-model § Cadeia ligada): `cadeiaLigada("D")` → `{ ligada: true, semColetor: [] }`; `cadeiaLigada("A")` → `{ ligada: false, semColetor: ["signup", "ativado", "trial pago"] }`, com os nomes e não as chaves; perfil desconhecido (`"Z"`) → `{ ligada: false, semColetor: [] }`. Rodar `node --test test/okr.test.mjs` e ver falhar
- [X] T003 [P] Criar `test/mapa-projeto.test.mjs` com `node:test` + `assert/strict`: (a) `frasesAlheias` devolve `[]` para as duas frases de evidência de research D5 (a de `42,1% das impressões da Atma`, linha 379, e a de `` `scripts/conferir-soma-hosts.mjs atma <ini> <fim> --pagina` … 12,50% ``, linha 382, com o slug em minúscula) contra `EVIDENCIAS`; (b) devolve a frase `O card da Atma não declara marca` quando ela aparece; (c) não diferencia maiúsculas (`ATMA`, `atma`); (d) `numerosDoMapa("… 1.234 impressões, 12,5% e posição 4,4 …")` → `["1.234", "12,5%", "4,4"]`, na ordem; (e) `numerosDoMapa` ignora os números do carimbo `Apurado ao abrir a página, em …`; (f) `textoDoMain(html)` devolve só o texto visível de `<main>`: o conteúdo de `<script>` e de `<style>` e o `<title>` ficam fora, e a nota de um `<li>` dentro de `<main>` fica; (g) `frasesAlheias` não parte a frase em `1.234` nem em `.mjs`
- [X] T004 Registrar `test/mapa-projeto.test.mjs` na lista `"test"` de `package.json`, no mesmo commit do T003 (Princípio II; `test/validade.test.mjs` reprova sem isso)
- [X] T005 [P] Em `test/projects.test.mjs` (já registrado), acrescentar os casos de `deBusca(projetos, slugs)`, importado de `../lib/projects.mjs`: (a) devolve na ordem de `slugs`, não na da lista (`[sirius, atma]` com `["atma", "sirius"]` → `[atma, sirius]`); (b) o repo sem card (`curated: false`, `url: "https://sirius-ebon.vercel.app/"`) fica fora, que é o caso "projeto no escopo sem card" da FR-003; (c) card sem `url` fica fora; (d) slug fora de `slugs` fica fora. Rodar `node --test test/projects.test.mjs` e ver falhar

### Implementação

- [X] T006 [P] Implementar `export function cadeiaLigada(perfil)` em `lib/okr.mjs`, logo depois de `PERFIS` (linha 398): toma `PERFIS[perfil]?.marcos`, tira o `visitante` inicial pela mesma regra de `lib/ficha-dados.ts:106` (`marcos[0]?.chave === "visitante"`), `ligada` = lista não vazia e todo degrau com `coletor`, `semColetor` = os `nome` dos degraus com `coletor: null`, na ordem do perfil. JSDoc com o porquê (research D3: o perfil já declara a ligação, um campo no card seria a segunda declaração do mesmo fato). T002 fica verde
- [X] T007 [P] Criar `lib/mapa-projeto.mjs` (puro, sem import do Next) com `EVIDENCIAS` (`RegExp[]`, as duas frases do T003a, com o comentário apontando research D5), `textoDoMain(html)` (tira os blocos `<script>` e `<style>` inteiros, depois as tags, e devolve só o texto de `<main>`, com o porquê de research D12 no comentário), `frasesAlheias(texto, alheio, permitidas)` (corta em `.`, `!` ou `?` seguidos de espaço e devolve as frases que contêm `alheio` sem diferenciar maiúsculas e não casam com nenhuma de `permitidas`) e `numerosDoMapa(texto)` (números pt-BR em ordem, sem o carimbo `Apurado ao abrir a página, em …`). T003 fica verde
- [X] T008 [P] Em `lib/projects.mjs`, `export function deBusca(projetos, slugs)`: `slugs.map((s) => projetos.find((p) => p.slug === s && p.curated && p.url)).filter(Boolean)`, com JSDoc do porquê (research D2: a guarda mora na função que as corridas e o mapa chamam, e a ordem vem de `slugs` porque `mergeProjects` preserva a do `projects.json`). Em `lib/projects.ts:123-129`: `SLUGS_DE_BUSCA = ["atma", "sirius"]`, com a decisão de 21/09/2026 no comentário (o Sirius volta ao escopo para ter mapa, e a mesma lista decide quem tem mapa: FR-003), e `projetosDeBusca()` passa a devolver `deBusca(await listProjects(), SLUGS_DE_BUSCA) as Project[]`, com `deBusca` no import de `@/lib/projects.mjs` que já traz `mergeProjects`. T005 fica verde
- [X] T009 Criar `scripts/conferir-mapa.mjs` (depende de T007), com dois modos que leem um arquivo HTML local e passam por `textoDoMain` antes de comparar: `numeros <antes.html> <depois.html>` imprime `iguais: N números` ou a primeira posição que diverge (com os dois valores) e sai com código 1; `alheio <html> <Nome>` imprime cada frase de `frasesAlheias(texto, Nome, EVIDENCIAS)` e sai com código 1 se houver alguma. Sem rede, sem `.env`: o HTML é baixado pelo `curl` do quickstart
- [X] T010 Mover a tela com `git mv app/gsc/mapa/page.tsx "app/gsc/mapa/[slug]/page.tsx"` (sem cópia; `git log --follow` segue) e corrigir os três imports relativos: `../../tabs` → `../../../tabs`, `../../okr/[slug]/celulas` → `../../../okr/[slug]/celulas`, `./mapa` → `../mapa`. `app/gsc/mapa/mapa.tsx` não muda
- [X] T011 Em `app/gsc/mapa/[slug]/page.tsx`, resolver o projeto pela rota (research D2), no padrão de `app/okr/[slug]/aquisicao/page.tsx:593-606`: `MapaDoBoardPage({ params }: { params: Promise<{ slug: string }> })`, `const { slug } = await params`, `const projetosComMapa = await projetosDeBusca()` (já curados, com `url` e na ordem de `SLUGS_DE_BUSCA`, pelo T008), `const p = projetosComMapa.find((x) => x.slug === slug)` e `if (!p) notFound()`. Trocar o `export const metadata` (linha 71) por `generateMetadata`, com `title: \`Board GSC — ${nomeCurto}\`` e `nomeCurto = p?.nome.split(" — ")[0] ?? slug`: o slug inexistente também passa por ali, como em `aquisicao/page.tsx:597`. Manter `export const dynamic = "force-dynamic"` (linha 64). Import de `projetosDeBusca` de `@/lib/projects` e de `notFound` de `next/navigation`

**Checkpoint**: `npm test` verde; `/gsc/mapa/atma` e `/gsc/mapa/sirius` resolvem o projeto; um slug fora do escopo dá 404.

---

## Phase 3: User Story 1 — Abrir o mapa do Sirius e ler o número de cada folha (Priority: P1) 🎯 MVP

**Goal**: o mapa do Sirius com o board inteiro (113 nós, 65 folhas), cada folha com número e janela ou `∅`
com motivo, e o cabeçalho nomeando o projeto e os hosts medidos.

**Independent Test**: quickstart §3. `conferir-mapa.mjs alheio sirius.html Atma` → 0 frases; cabeçalho
"O que esta tela mede é o projeto Sirius CRM — siriuscrm.com.br"; seis faixas com números diferentes dos da
Atma; `/gsc/mapa/tapepro` → 404.

### Implementação

- [X] T012 [US1] Em `app/gsc/mapa/[slug]/page.tsx`, trocar toda leitura com `atma` fixo pelo projeto da rota (T011): apagar `const projects = await listProjects()` e `const atma = projects.find(...)` (linhas 713-714) e usar `p`; `lerInventario("atma", INVENTARIOS)` (782) → `lerInventario(slug, INVENTARIOS)`; `lerDiasGsc("atma", …)` (884) → `slug`; `lerCrawlDePagina("atma")` (1053) → `slug`; `lerIndexacao("atma")` (1056) → `slug`; `atma.slug` / `atma.url` (730, 1113, 1779, 1782) → `p.slug` / `p.url`. Como `p` nunca é `undefined` depois do `notFound()`, os guardas `atma ? … : …` / `atma && …` (720, 721, 727, 778, 882, 935, 936, 1112, 1754) perdem o ramo morto, `atma?.dominioAnterior` (1284, 1314, 1401) vira `p.dominioAnterior`, `marcaDeclarada(atma ?? {})` (835) vira `marcaDeclarada(p)` e o comentário de 830-834 sai. Tirar o import de `listProjects` se ficar sem uso
- [X] T013 [US1] No mesmo arquivo, remover os ramos de código morto "projeto atma não encontrado" (research D2): 898 e 1558 (o ternário interno `atma ? "sem banco configurado para o hub" : "projeto atma não encontrado no hub"` fica só com a primeira frase) e 1886 (o `: "projeto atma não encontrado"` final do `erroDaFicha`)
- [X] T014 [US1] TAM (FR-009, research D11), linha ~1827: `(DEMANDAS as Record<…>).atma` → `(DEMANDAS as Record<…>)[slug]`, e o motivo `"sem estimativa de demanda gravada"` → `"sem demanda estimada declarada para este projeto"`. A ordem dos motivos não muda: sem inventário, o primeiro segue sendo "inventário de termos não declarado para este projeto"
- [X] T015 [US1] "Depois do clique" (FR-010, research D3): em `app/gsc/mapa/[slug]/page.tsx`, `const cadeiaDoPerfil = cadeiaLigada(p.perfil)` (import de `@/lib/okr.mjs`); `dadosDaFicha("atma")` (718) vira `cadeiaDoPerfil.ligada ? dadosDaFicha(slug).catch(…) : null`, e o comentário de 715-717 ganha a condição. No bloco de 1882-1910 e no JSX de 1990-2012, quando `!cadeiaDoPerfil.ligada`, o nó e o painel mostram `∅ sem cadeia de R$ ligada ao hub: ${lista} não têm coletor`, com `lista` feita por `new Intl.ListFormat("pt-BR", { type: "conjunction" }).format(cadeiaDoPerfil.semColetor)`, sem `CadeiaDiagrama` e sem nenhuma taxa. Se `semColetor` vier vazio (perfil sem degraus ou desconhecido), o painel usa a frase do T016, "O perfil deste projeto não declara degraus de conversão…", e não a lista. Na Atma (perfil D, ligada) o caminho de hoje não muda
- [X] T016 [US1] Frases sobre o projeto medido (FR-004, tabela de research D5), no mesmo arquivo: `noteDoCrescimento` 256 "O card da Atma não declara" → "O card deste projeto não declara" e 268 "da série que o hub grava da Atma" → "da série que o hub grava deste projeto"; os links `/okr/atma/aquisicao` em `noteDaConformidade` (369, 370), `noteDoAlinhamento` (493), `noteDaIntegridade` (593) e `noDoPassRate` (690) → `` `/okr/${slug}/aquisicao` ``, passando `slug` como parâmetro novo desses quatro helpers e nas suas chamadas; `/okr/atma` em 1896, 1902, 1994 e 2008 → `/okr/${slug}` (no JSX de 1994, `href={\`/okr/${slug}\`}` e o texto do link idem); "O perfil da Atma não declara degraus" (1903, 2009) → "O perfil deste projeto não declara degraus". **Não tocar** 379 e 382: são as `EVIDENCIAS`
- [X] T017 [US1] Cabeçalho (contrato § Cabeçalho, item 2), linhas 2105-2113: `<strong>O que esta tela mede é o projeto {nomeCurto}</strong> — {hostsDeclarados(p).join(" + ")}` (o ramo `"projeto não encontrado"` sai); "O board `okr-Saw2eoSKZDPLJAk6xeDBuS` é o board dela, não do portfólio." → "O board `okr-Saw2eoSKZDPLJAk6xeDBuS` é de SEO: a mesma definição vale para cada projeto com mapa." Sem contagem: um número novo no HTML da Atma desalinharia a comparação da SC-002 (research D12). Reescrever os comentários que afirmam que o board é da Atma e que por isso a tela lê a Atma (linhas 44-47, 710 e 2106-2107): agora a tela lê o projeto da rota (052)
- [X] T018 [US1] Validar US1 localmente (quickstart §3), com as credenciais exportadas como no §2: `npx next dev -p 3002`; `curl -s -u "$HUB_USER:$HUB_PASS" localhost:3002/gsc/mapa/sirius > sirius.html`; `node scripts/conferir-mapa.mjs alheio sirius.html Atma` → nenhuma frase; `curl -sI -u "$HUB_USER:$HUB_PASS" localhost:3002/gsc/mapa/tapepro` → 404. Conferir no HTML o cabeçalho do Sirius, ao menos 112 `<li>` em `#board-lista` (os 113 nós de `mapaDoBoard()` menos a raiz, mais os filhos medidos), "Depois do clique" com signup, ativado e trial pago sem coletor e sem diagrama, TAM e penetração com `∅` e motivo, vitais e Pass Rate com número de campo ou `∅ sem dado na CrUX` (nunca "reprovado"), e nenhum `0`/`0%` sobre ausência (FR-013). Fora do escopo desta tarefa: consertar o que o mapa mostrar (spec § Fora do escopo)

**Checkpoint**: o mapa do Sirius abre e se sustenta sozinho. É o MVP.

---

## Phase 4: User Story 2 — O mapa da Atma continua igual (Priority: P1)

**Goal**: o endereço antigo leva à Atma, e todo número da Atma é igual antes e depois, na mesma hora e janela.

**Independent Test**: quickstart §2, com os dois servidores (3001 antes, 3002 depois) no mesmo minuto.

### Implementação

- [X] T019 [US2] Criar `app/gsc/mapa/page.tsx` novo, com `import { redirect } from "next/navigation"` e `export default function Page() { redirect("/gsc/mapa/atma"); }`: 307, **não** `permanentRedirect` (research D1: o 308 fica no navegador e impediria `/gsc/mapa` de virar seletor depois). Comentário de uma linha com esse porquê. O link de `app/gsc/page.tsx:123` não muda
- [X] T020 [US2] Validar SC-002 pelo quickstart §2: worktree em `C:/dev/roihub-antes` (fora do OneDrive) no hash do T001, `cp .env` para lá e `npm ci` no worktree; `npx next dev -p 3001` no worktree e `-p 3002` no repo; `HUB_USER`/`HUB_PASS` exportados do `.env` sem imprimir; baixar `localhost:3001/gsc/mapa` → `antes.html` e `localhost:3002/gsc/mapa/atma` → `depois.html` no mesmo minuto; `node scripts/conferir-mapa.mjs numeros antes.html depois.html` → `iguais: N números`. `curl -sI -u "$HUB_USER:$HUB_PASS" localhost:3002/gsc/mapa` → `307` com `location: /gsc/mapa/atma`. O diff do texto de `<main>` sem os números só pode trazer as trocas de T016/T017 e o seletor (T022). Nenhuma folha troca de estado, e "Depois do clique" da Atma segue com `CadeiaDiagrama`. Parar o servidor da 3001 e remover o worktree (`git worktree remove --force C:/dev/roihub-antes`)

**Checkpoint**: US1 e US2 de pé. Os números da Atma não mudaram.

---

## Phase 5: User Story 3 — Trocar de projeto sem digitar endereço (Priority: P2)

**Goal**: o cabeçalho lista os projetos com mapa, marca o atual e liga os outros.

**Independent Test**: no mapa da Atma, Tab até o link do Sirius e Enter abre o mapa dele. O inverso também (SC-006).

### Implementação

- [X] T021 [US3] Invocar as skills `accessibility` e `ux-writing` antes de escrever o seletor (regra global, plan § Na implementação)
- [X] T022 [US3] Em `app/gsc/mapa/[slug]/page.tsx`, no cabeçalho, logo abaixo do `<h1 className="ficha-nome">`, escrever um `<nav aria-label="Projetos com mapa">` com uma `<ul>` de `projetosComMapa` (T011), que já vem curada e na ordem de `SLUGS_DE_BUSCA` (T008). O item atual vai sem link, com `aria-current="page"`, e os outros são `<a href={\`/gsc/mapa/${x.slug}\`}>{nomeCurto de x}</a>`. Reusar classes que já existem em `app/globals.css`; CSS novo só se nenhuma servir. A lista sai da leitura do T011, sem segunda chamada
- [X] T023 [US3] Conferir só com o teclado em `localhost:3002/gsc/mapa/atma` e `/gsc/mapa/sirius`: um Tab chega ao outro projeto, o foco fica visível e Enter abre. O item atual não recebe foco

**Checkpoint**: as três histórias da tela funcionando.

---

## Phase 6: User Story 4 — As corridas diárias voltam a cobrir o Sirius (Priority: P1)

**Goal**: série diária, indexação e crawl gravam uma linha do Sirius por dia, e o campo (CrUX) também o lê.
O escopo de busca já entrou no T008.

**Independent Test**: quickstart §4, no dia do deploy e no seguinte.

### Testes primeiro

- [X] T024 [P] [US4] Em `test/crux.test.mjs:49`, `assert.deepEqual(SLUGS_DE_CAMPO, ["atma", "sirius"])`. Rodar e ver falhar

### Implementação

- [X] T025 [US4] Em `lib/crux.mjs:39`, `SLUGS_DE_CAMPO = ["atma", "sirius"]`. Comentário com o porquê de a lista seguir separada de `SLUGS_DE_BUSCA` (research D9: outra fonte, outra quota) e com o efeito em `/okr/sirius` (`lib/ficha-dados.ts:93`). T024 fica verde
- [ ] T026 [US4] Depois do deploy (Phase 8, T034), disparar por `workflow_dispatch` as três corridas `.github/workflows/serie-gsc.yml`, `.github/workflows/indexacao.yml` e `.github/workflows/paginas.yml` (`gh workflow run <arquivo>`), fora de 23:30–01:00, 08:00–08:45 e 05:15–06:40 BRT (hora pelo PowerShell, não pelo `date` do Git Bash). Conferir que cada resposta traz `sirius` nas mesmas listas em que traz `atma` (contrato § Corridas) e que nenhuma estourou o tempo (research D8)
- [ ] T027 [US4] Rodar as consultas de quickstart §4 no banco do hub: `max(dia)` de `hub_gsc_dia`, `hub_indexacao` e `hub_pagina_corrida` para `atma` e `sirius` com a data do dia; zero lacunas na série do Sirius desde 06/09 (FR-012); `hub_indexacao` do Sirius com `motivo IS NULL` e `inspecionadas = declaradas`; `/okr/sirius/aquisicao` sem "⚠️ Fora do escopo" e com os KPIs do Search Console. No dia seguinte, depois das 06:30 BRT, repetir as três consultas de `max(dia)`: a SC-003 fala das corridas agendadas

**Checkpoint**: SC-003 medida no banco.

---

## Phase 7: Dado declarado do Sirius (FR-007, FR-008): ⛔ só depois do aceite do dono

**Purpose**: marca e inventário. O código das fases 2 a 6 vai ao ar sem isto (research D10). A marca vai de
preferência no mesmo push do escopo, para que a primeira corrida já reclassifique os 141 dias antigos
(research D7).

- [X] T028 [US1] ⛔ Aceite da FR-007: acrescentar ao card `sirius` de `data/projects.json` o campo `"marca": { "termos": ["sirius", "siriuscrm"], "pais": "<país aceito>", "declaradaEm": "<data do aceite, YYYY-MM-DD>" }`. O país é o que o dono aceitou, não o `bra` da proposta por padrão: ele decide o que as folhas de marca leem (FR-007). `npm test` verde (o formato é validado por `marcaDeclarada()` em `lib/marca.mjs`)
- [X] T029 [US1] Depende de T028. Prévia do inventário **sem** gravar: `node --env-file=.env scripts/derivar-inventario.mjs sirius --piso 20 --meses 8`. Mostrar ao dono a lista, a retenção de impressões não-marca e os 5 primeiros termos (a prévia de 21/09 tem 18 termos e 90,3%)
- [X] T030 [US1] ⛔ Aceite da FR-008: a mesma linha com `--gravar`, que escreve a chave `sirius` em `data/inventario-de-termos.json`. Conferir a `procedencia` contra data-model § Inventário (piso 20, dimensão `query`, hosts `["siriuscrm.com.br"]`, `excluiMarca` igual à marca). `npm test` verde. Em `/gsc/mapa/sirius`, a penetração sai medida e o TAM passa ao segundo motivo da FR-009

---

## Phase 8: Polish & Cross-Cutting

- [X] T031 [P] Atualizar os comentários que citam o caminho antigo da tela para `app/gsc/mapa/[slug]/page.tsx`: `lib/board-gsc.mjs:48` e `lib/inventario.mjs:19`
- [X] T032 `npm test` (suíte inteira) e `npx tsc --noEmit` limpos (quickstart §1)
- [X] T033 `ui-verification` em `/gsc/mapa/sirius` e `/gsc/mapa/atma`: larguras de 1440, 768 e 360 px, o seletor só com o teclado (SC-006), o console limpo e a árvore de acessibilidade do `<nav>` (quickstart §6)
- [ ] T034 Commit (mensagem em inglês) e push em `main` fora de 23:30–01:00, 08:00–08:45 e 05:15–06:40 BRT (Princípio IV e plan § Constraints). O deploy leva ~15 min: conferir `/gsc/mapa/sirius`, `/gsc/mapa/atma` e o 307 de `/gsc/mapa` em produção duas vezes antes de seguir para T026
- [ ] T035 SC-004, sete dias depois do deploy (quickstart §5): no mapa do Sirius em produção, nenhuma das 11 folhas que leem o banco (crescimento não-marca, marca, schema, título, intenção, profundidade, frescor, links, indexação limpa, rejeição de rastreio e active index) diz "nenhuma corrida gravada"

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)**: nenhuma. Tem de rodar antes de qualquer edição, porque grava o "antes".
- **Foundational (2)**: depende de Setup. Bloqueia todas as histórias.
- **US1 (3)**: depende de Foundational.
- **US2 (4)**: depende de Foundational. O T020 compara o arquivo final, então roda depois de US1 e US3 (as
  trocas de texto de T016, T017 e T022 fazem parte do diff esperado).
- **US3 (5)**: depende de Foundational e de T017 (mesmo trecho do cabeçalho).
- **US4 (6)**: T024–T025 dependem só de Foundational. T026–T027 dependem do deploy (T034).
- **Dado declarado (7)**: depende do aceite do dono, não de código. T029 depende de T028, e T030 de T029.
- **Polish (8)**: T031–T033 depois das histórias; T034 antes de T026; T035 é D+7.

### Dentro de cada fase

- T002 → T006, T005 → T008 e T003 → T004 → T007 → T009: o teste primeiro, vermelho, depois a função.
- T010 → T011 → T012–T017 → T022: todos no mesmo arquivo `app/gsc/mapa/[slug]/page.tsx`, **em série**.
- T024 → T025.

### Parallel Opportunities

- T002, T003 e T005: arquivos de teste diferentes.
- T006, T007 e T008: `lib/okr.mjs`, `lib/mapa-projeto.mjs` e `lib/projects.mjs` + `lib/projects.ts`.
- T024–T025 (`test/crux.test.mjs`, `lib/crux.mjs`) em paralelo com toda a US1, que mexe só na página.
- T031 em paralelo com T032.
- Nenhuma tarefa de US1 é [P]: todas editam a mesma página.

---

## Parallel Example: Foundational

```bash
# Testes vermelhos, em paralelo:
Task: "Casos de cadeiaLigada em test/okr.test.mjs"             # T002
Task: "Criar test/mapa-projeto.test.mjs"                        # T003
Task: "Casos de deBusca em test/projects.test.mjs"              # T005

# Depois, as três funções puras, em paralelo:
Task: "cadeiaLigada(perfil) em lib/okr.mjs"                                              # T006
Task: "EVIDENCIAS, textoDoMain, frasesAlheias, numerosDoMapa em lib/mapa-projeto.mjs"    # T007
Task: "deBusca em lib/projects.mjs; SLUGS_DE_BUSCA e projetosDeBusca em lib/projects.ts" # T008
```

## Parallel Example: US1 + US4

```bash
# A página (US1, em série) enquanto o campo entra em outro arquivo:
Task: "T012–T017 em app/gsc/mapa/[slug]/page.tsx"
Task: "T024–T025 em test/crux.test.mjs e lib/crux.mjs"
```

---

## Implementation Strategy

### MVP (US1)

1. Phase 1 → Phase 2 → Phase 3.
2. **Parar e validar** com T018: o mapa do Sirius abre, sem "Atma" fora das evidências, e com 404 fora do escopo.
3. Não dá push só com o MVP: o `git mv` tira `/gsc/mapa` do ar até T019. O menor push seguro é US1 + US2.

### Entrega (plan § Ordem de entrega)

1. **Um push de código**: Phases 2–6 (sem T026–T027) + T031–T034. Pode ir sem o aceite; o Sirius sai com
   os estados de ausência que já existem.
2. **Marca** (T028): de preferência dentro do mesmo push; se o aceite atrasar, um push próprio, e a corrida
   seguinte reclassifica a série sem perda (research D7).
3. **Inventário** (T029 → aceite → T030): push próprio.
4. **Corridas** (T026–T027) no dia do push e no seguinte; **SC-004** (T035) em D+7.

---

## Notes

- Toda frase nova usa "este projeto", `nomeCurto` ou `/okr/{slug}`. "Atma" no HTML do Sirius só dentro das
  `EVIDENCIAS`, e a testemunha (T009) reprova o resto.
- Nenhuma `maxDuration` muda, então nada muda no proxy do EasyPanel.
- Nenhum import de `data/projects.json` fora de `lib/projects.*` (Princípio I).
