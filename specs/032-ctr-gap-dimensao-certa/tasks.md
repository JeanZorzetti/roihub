# Tasks: Cada medida de busca é lida pela dimensão que a mede

**Feature**: `032-ctr-gap-dimensao-certa` | **Data**: 2026-09-19

**Input**: [spec.md](spec.md) · [plan.md](plan.md) · [research.md](research.md) ·
[data-model.md](data-model.md) · [contracts/medida-por-familia.md](contracts/medida-por-familia.md) ·
[quickstart.md](quickstart.md)

**Tests**: SIM. O Princípio II é não-negociável e o quickstart (§3) já enumera os casos. **Zero
arquivo de teste novo**: tudo entra em `test/kpis-busca.test.mjs` e `test/gsc-delta.test.mjs`, os
dois já registrados em `package.json` — nenhuma edição na lista do `package.json` nesta feature.

**Organização**: por user story, na **ordem de risco do plano** (Sequência de entrega), não na ordem
da spec.

## Formato: `[ID] [P?] [Story] Descrição`

- **[P]**: paralelizável — arquivo diferente, sem dependência de tarefa incompleta.
- **[Story]**: US1 ou US2. Setup, Foundational e Polish não levam rótulo.
- Quase nada é `[P]` aqui: a feature inteira mora em **dois** arquivos (`lib/kpis-busca.mjs` e
  `app/okr/[slug]/aquisicao/page.tsx`). Marcar paralelo o que disputa o mesmo arquivo seria
  convidar conflito onde não há ganho.

## Caminhos

Monolito Next existente. **Nenhum arquivo novo** em `lib/`, `test/` ou `app/`:

- `lib/kpis-busca.mjs` · `lib/gsc-delta.mjs` · `app/okr/[slug]/aquisicao/page.tsx`
- `scripts/conferir-soma-hosts.mjs` · `test/kpis-busca.test.mjs` · `test/gsc-delta.test.mjs`
- `GLOSSARIO.md`
- **NÃO TOCADOS**: `lib/gsc.ts` (já tem as duas leituras), `lib/okr-coleta.ts` (a ficha já lê
  páginas desde a 030), `package.json`, qualquer migração.

---

## Phase 1: Setup — a linha de base, medida antes de tocar em qualquer arquivo

**Propósito**: sem número de partida, "não mudou nada" é opinião. A 032 existe porque um critério
foi medido com outro instrumento — a primeira corrida mede o CHECK.

- [X] T001 Rodar `npm test` na raiz e anotar a linha de base no PR: esperado **1085 testes, 0 falhas, ~4,7 s** (quickstart §1)
- [X] T002 Rodar `npx tsc --noEmit` na raiz e confirmar saída limpa — é o portão que `npm test` NÃO cobre (quickstart §2, C5)
- [X] T003 [P] Rodar a testemunha nos dois modos e anotar as duas colunas: `node --env-file=.env scripts/conferir-soma-hosts.mjs atma 2026-08-20 2026-09-16 --pagina` e o mesmo com `--consulta` — esperado 24.664/434/29 contra 10.395/190/989 (quickstart §4)
- [X] T004 [P] Abrir `http://localhost:3000/okr/atma/aquisicao` com `npm run dev` e fotografar o estado ANTES: `0% … (6 avaliada(s))` no Índice de Conformidade e `27,3% … (2.757 de 10.098)` no Top 3 — o segundo é a SC-004 em forma de screenshot

**Checkpoint**: os números de partida existem. Sem eles a SC-004 não é conferível depois.

---

## Phase 2: Foundational — a fronteira de tipo (Ordem 0) ⚠️ BLOQUEANTE

**Propósito**: hoje `urlsComImpressao(paginas)` **não** reprova no `tsc` porque não tem `@param`.
Trocar a entrada da família por URL antes de anotar faria a migração passar em silêncio justamente
nas funções que o defeito atravessa — a fronteira que esta spec inteira existe para criar nasceria
com dois buracos.

**⚠️ CRÍTICO**: nenhuma tarefa de US1 ou US2 começa antes de T008 passar.

- [X] T005 Anotar `@param` JSDoc em toda função exportada de `lib/kpis-busca.mjs` que ainda não tem, **sem mudar comportamento nenhum**: `benchmark`, `ctr`, `consultasUnicas`, `noTop20`, `totalImpressoes`, `impressoesNoTop3`, `urlsComImpressao`, `activeIndexRatio`, `queryToPageRatio`, `ctrPorConsulta`, `ctrGap`, `termoPrincipal` — usando o typedef `LinhaBusca` que o arquivo já declara na linha 8 (C5, D2). Pular `porUrl`: T017 a deleta
- [X] T006 Declarar o typedef `LinhaPagina` em `lib/kpis-busca.mjs` ao lado de `LinhaBusca`: `{pagina: string, cliques: number, impressoes: number, posicao: number, hosts?: string[]}` — o campo `pagina` (e a ausência de `query`) é o que torna as duas formas disjuntas (E2, D2)
- [X] T007 Provar que a fronteira é contrato e não convenção: criar `probe-tipos.ts` na raiz com `kpisPorPagina(porTermo)`, rodar `npx tsc --noEmit`, confirmar **TS2345** nessa linha e apagar o probe (quickstart §2). Se o `tsc` passar, a porta continua aberta — anotar antes de seguir
- [X] T008 Portão da Ordem 0: `npm test` de volta nos 1085 verdes e `npx tsc --noEmit` limpo, **antes** de trocar a entrada de qualquer função

**Checkpoint**: a fronteira existe e é cobrada pelo compilador. US1 pode começar.

---

## Phase 3: User Story 1 — O Índice de Conformidade volta a dizer a verdade (P1) 🎯 MVP

**Goal**: o índice publicado sai da leitura por página e passa a avaliar todas as URLs dentro da
faixa do balizador — 12,5% com 24 avaliadas, com a home dentro, em vez de 0% com 6.

**Independent Test**: abrir a aba de aquisição da Atma e conferir que o índice publicado é o mesmo
que `scripts/conferir-soma-hosts.mjs --pagina` devolve na mesma janela. Diferença tem de ser zero.

**⚠️ T015–T026 fecham no MESMO commit.** Trocar a entrada da família por URL faz o `tsc` reprovar a
aba no mesmo instante — e é exatamente isso que a fronteira tem de fazer. Não são mergeáveis
separadas.

### Testes para a US1 (escrever primeiro, ver falhar)

- [X] T009 [US1] Em `test/kpis-busca.test.mjs`: `ctrGap` sobre linhas por página — a URL em posição 6,93 com CTR 22,49% **entra** no denominador e atinge o piso (4,5%); a de posição 11,82 fica **fora** dele e não conta como falha (SC-001, SC-003)
- [X] T010 [US1] Em `test/kpis-busca.test.mjs`: `ctrGap` com as páginas da janela medida devolve `fracao === 0.125` e `avaliadas === 24` — a SC-001 como asserção
- [X] T011 [US1] Em `test/kpis-busca.test.mjs`: `ctrGap` **não re-agrega** — uma linha com `posicao: 3.9` e 1.146 impressões sai com `3.9`, nunca `3.8999999999999995` (D3). É o mecanismo exato do defeito: a faixa acaba em 10,9 e um `11,000000000000002` cai fora dela
- [X] T012 [US1] Em `test/kpis-busca.test.mjs`: a trava da SC-004 — `kpisPorTermo` devolve os MESMOS valores de hoje para `impressoesNoTop3`, `strikingDistance`, `canibalizacao`, `consultasUnicas` e `noTop20` com a mesma entrada. É o teste que impede a migração vazar para a família errada
- [X] T013 [US1] Em `test/kpis-busca.test.mjs`: `kpisPorPagina(paginas, null)` devolve `activeIndexRatio: null` e mantém `urlsComImpressao` como contagem — sem denominador apurado a tela volta à contagem, não inventa razão
- [X] T014 [US1] Em `test/kpis-busca.test.mjs`: remover os casos de `porUrl` junto com a função (T017) — teste de função deletada é o que segura a função deletada no repo

### Implementação — o módulo puro (Ordem 1)

- [X] T015 [US1] Trocar a entrada de `ctrGap` em `lib/kpis-busca.mjs`: recebe `LinhaPagina[]`, aplica `ctr()` + `benchmark()` **linha a linha**, sem chamar agregação nenhuma. Preservar palavra por palavra as regras da 021 (sem benchmark ou sem impressão fica fora do denominador; `null` quando ninguém sobra) e o campo de saída `url`, que a lista "abaixo" já renderiza (C4, D3)
- [X] T016 [US1] Trocar a entrada de `urlsComImpressao` e `activeIndexRatio` em `lib/kpis-busca.mjs` para `LinhaPagina[]` — contam `pagina`, não `page`. `queryToPageRatio` **não** muda: o numerador é `consultasUnicas` e ele mantém o selo de piso (D6, FR-004)
- [X] T017 [US1] Deletar `porUrl` de `lib/kpis-busca.mjs` (C6, D4) — é literalmente "some as linhas por termo para formar a URL", a operação que a FR-001 proíbe e a que fabricou o 0%. Deixá-la sem chamador é manter à mão o caminho errado
- [X] T018 [US1] Renomear `kpisDeBusca` → `kpisPorTermo(linhas, ehMarca)` em `lib/kpis-busca.mjs`, removendo `urlsComImpressao` e `ctrGap` do retorno. `impressoesNoTop3` **fica aqui** — decisão do dono (C2, D9)
- [X] T019 [US1] Criar `kpisPorPagina(paginas, indexadas)` em `lib/kpis-busca.mjs` devolvendo `{urlsComImpressao, ctrGap, activeIndexRatio}`, com `@param {LinhaPagina[]}` (C3, D5)
- [X] T020 [US1] Rodar `node --test test/kpis-busca.test.mjs` e ver T009–T014 verdes (quickstart §3)

### Implementação — a aba (Ordem 2)

- [X] T021 [US1] Em `app/okr/[slug]/aquisicao/page.tsx` linha ~560: acrescentar `gscPaginas(hostsDeclarados(p), curtaGsc)` ao `Promise.all` que já existe, citando **literalmente** as mesmas expressões que `gscConsultas` recebe na linha 579 (C1, FR-006). Importar `gscPaginas` de `@/lib/gsc` na linha 15. Teto em voo sobe para 3, hosts continuam em série dentro de `lerHosts` (D12)
- [X] T022 [US1] Em `page.tsx` linha ~613: trocar `kpisDeBusca(linhasBusca, ehMarca)` por `kpisPorTermo(linhasBusca, ehMarca)` e acrescentar `kpisPorPagina(paginasBusca, denomIdx)`; atualizar o import da linha 20 (`kpisDeBusca` e `porUrl` saem, `kpisPorTermo` e `kpisPorPagina` entram). O `denomIdx` continua vindo do banco, não das leituras (D6)
- [X] T023 [US1] Em `page.tsx` linhas ~678-679: `activeIndexRatio` passa a sair de `kpisPorPagina`; `queryToPageRatio` continua sobre `linhasBusca` com o selo de piso
- [X] T024 [US1] Em `page.tsx` linhas ~525-527: `lerPassRate` passa a receber as linhas por página e ordenar por impressão sobre 29 URLs em vez de 14. `CAP_URLS_PASS_RATE` continua 10 — o custo de rede não muda, o valor do Pass Rate pode mudar e isso é esperado (D11)
- [X] T025 [US1] Em `page.tsx` linhas ~692-694: `impressoesPorUrl` passa a sair da leitura por página, canonizada pela mesma regra da 024/D3. `termoPorUrl` **continua** em `linhasCanon` por termo — termo não existe na leitura por página (D10, FR-001)
- [X] T026 [US1] Rodar `npx tsc --noEmit` — tem de sair limpo. Enquanto reprovar, a fronteira está fazendo o trabalho dela e a migração não acabou

### Implementação — a testemunha (Ordem 5)

- [X] T027 [P] [US1] Em `scripts/conferir-soma-hosts.mjs`: o modo `--pagina` passa a imprimir a tabela por URL (posição, CTR, piso da posição, atinge) e a fração final. Importar `benchmark()` de `lib/kpis-busca.mjs` e **não** importar `ctrGap` nem `mesclarPorCaminho` — a testemunha não pode ser o código que ela confere (C8, D13)

### Prova da US1

- [X] T028 [US1] `node --env-file=.env scripts/conferir-soma-hosts.mjs atma 2026-08-20 2026-09-16 --pagina` imprime **12,50% · 24 avaliadas · 3 atingem**, com `https://usealigner.com/` entre as avaliadas (posição 6,93 · CTR 22,49% · piso 4,5%) — quickstart §4
- [X] T029 [US1] `npm run dev` e abrir `/okr/atma/aquisicao`: o Índice de Conformidade diz `12,5% … (24 avaliada(s))`. Continuar em 0% significa que a leitura não trocou (quickstart §5.1, SC-001/SC-003)
- [X] T030 [US1] Conferir que o Top 3 **não se moveu**: `27,3% das impressões no Top 3 (2.757 de 10.098)`. Qualquer outro número aqui é a SC-004 reprovada — reverter a função que vazou, nunca ajustar a asserção (quickstart §5.3)

**Checkpoint**: US1 fechada. O KPI que abriu esta linha de trabalho publica o número certo, e a
testemunha o confirma fora do código que o calcula. **Este é o MVP** — entregável sozinho.

---

## Phase 4: User Story 2 — Cada número declara sobre que base foi medido (P1)

**Goal**: com duas bases na mesma lista — 24.664 e 10.395 —, cada medida nomeia a sua, para a
diferença parar de ler como bug.

**Independent Test**: abrir a aba e conferir que toda medida do bloco de busca nomeia a base de
impressões sobre a qual foi calculada.

**Dependência**: US1 (as duas leituras precisam existir na aba antes de terem base para declarar).

- [X] T031 [US2] Em `page.tsx`: calcular `basePagina = totalImpressoes(paginasBusca)` ao lado do `baseCurta` da linha ~616 — duas bases nomeadas, E5 (`impressoes` + `leitura`), `null` quando a leitura não respondeu e **nunca** `0` por ausência
- [X] T032 [US2] Em `page.tsx`: cada `<Leitura>` do bloco declara a base e a leitura que a produziu — as de URL sobre a base por página, as de termo sobre a base por termo (FR-003, C7.1). Usar `information-design` para a forma e `ux-writing` para o texto
- [X] T033 [US2] Em `page.tsx` linha ~622: `acimaDoPiso` deixa de ser um portão só e passa a ser **um por leitura**, aplicado à base da leitura que alimenta cada medida. A linha "de 100 impressões — o piso da régua do board" **nomeia** a leitura (D7, C7.2). O portão mora no cálculo da base, não em cada linha — seis vezes nesta tela um veredito consertado no chamador voltou pela porta seguinte
- [X] T034 [US2] Em `page.tsx`: cada família renderiza com a sua leitura e a ausência **nomeia a leitura que faltou**, preservando `null` (sem propriedade → conserto é domínio) contra `{erro}` (falha de agora → a mensagem já começa pelo host). Colapsar as duas esconderia metade do bloco sem motivo (FR-005, D8, C7.3)
- [X] T035 [US2] Em `page.tsx` linha ~1802: manter **um** `<HostsDaLeitura>` no cabeçalho, alimentado pela leitura que respondeu. Duas linhas "hosts somados" seriam duas versões do mesmo fato (D14, C7.4)
- [X] T036 [US2] Em `page.tsx` linha ~2136: o `<details>` declara o truncamento das **duas** leituras (a por página tem teto de 1.000 linhas, a por termo 25.000), e a frase "o Search Console omite as consultas raras" passa a valer **só** para as medidas por termo (D15, C7.5, FR-004)
- [X] T037 [P] [US2] Em `GLOSSARIO.md`: entradas para "base da medida", "leitura por página" e "leitura por termo" — termo novo entra no mesmo commit que o usa, é a regra do arquivo
- [X] T038 [US2] Verificar a falha isolada: com o dev rodando, derrubar **uma** leitura de cada vez (um `throw` temporário no `buscar` de `gscPaginas`, depois o mesmo em `gscConsultas`). Reprova qualquer versão em que a falha de uma esconda as medidas da outra, ou em que a frase diga só o host sem dizer qual leitura caiu (quickstart §6)
- [X] T039 [US2] `ui-verification` na aba da Atma, incluindo largura de celular: a base ao lado de cada leitura não pode empurrar a coluna do valor (quickstart §5.2 e §5.5, SC-005)

**Checkpoint**: US2 fechada. As duas bases convivem na mesma lista e são legíveis.

---

## Phase 5: Polish & Cross-Cutting

- [X] T040 Em `lib/gsc-delta.mjs` linha 109: `MEDIDO_POR.ctrPorPosicao` deixa de apontar para `lib/kpis-busca.mjs#porUrl+benchmark` (símbolo deletado em T017) e passa a citar a função nova. Conferir também `ctrGap`, `conformidadeUrls` e `activeIndexRatio` (D4, D16)
- [X] T041 Em `lib/gsc-delta.mjs` linha ~165: `RESSALVA_DO_COLETOR.activeIndexRatio` deixa de citar `DIMENSAO_QUERY` — depois desta feature ele conta sobre a leitura por página e só a metade de janela (`E_A_JANELA`) continua verdadeira. Ajustar também o comentário do bloco (linhas 151-152), que hoje diz que `noTop20` e `activeIndexRatio` "herdam a MESMA limitação". Mapa que descreve o coletor errado manda o próximo a ligar um coletor que já está ligado (D16)
- [X] T042 Em `test/gsc-delta.test.mjs`: caso que fixa a ressalva nova de `activeIndexRatio` e prova que ela não cita mais a dimensão `query`
- [X] T043 `grep -rn "kpis-busca.mjs#" lib` à mão — o teste do mapa confere que a chave é folha do board, **não** que o símbolo exista no arquivo, então T017 passaria verde apontando para o vazio. Este grep é o conserto manual que o risco registrou
- [X] T044 Portão final: `npm test && npx tsc --noEmit` — os 1085 mais os casos novos, zero falha, `tsc` limpo (quickstart §8)
- [X] T045 `grep -rn "kpisDeBusca\|porUrl" lib app test scripts` — só pode sobrar o `porUrl` local e homônimo de `lib/crux.mjs`, que não tem parentesco nenhum com o deletado (C2, C6)
- [ ] T046 Push em `main` **fora** das janelas do Princípio IV (23:30–01:00 e 08:00–08:45 BRT) — hora BRT conferida pelo PowerShell, não pelo `date` do Git Bash
- [ ] T047 Após ~15 min do deploy no EasyPanel, conferir a tela **duas** vezes: o Índice de Conformidade em 12,5%, as bases declaradas e o Top 3 parado em 27,3%

---

## Dependências

```text
Phase 1 (Setup: T001-T004)
        ↓
Phase 2 (Foundational: T005-T008)  ⚠️ BLOQUEIA TUDO
        ↓
Phase 3 (US1: T009-T030)  🎯 MVP — entregável sozinho
        ↓
Phase 4 (US2: T031-T039)  precisa das duas leituras na aba
        ↓
Phase 5 (Polish: T040-T047)
```

**Dentro da US1** a ordem é rígida, e não por gosto:

- T009–T014 (testes) antes de T015–T019 — vermelho primeiro, senão o teste prova o que já passava.
- T015–T019 (o módulo) antes de T021–T026 (a aba) — o rename é o que força a revisão do chamador.
- **T015 até T026 no mesmo commit**: entre eles o `tsc` fica vermelho de propósito.
- T027 (testemunha) é o único trecho independente da US1.

**Entre stories**: US1 e US2 são ambas P1, mas **não são paralelas** — a US2 declara as bases que a
US1 cria. É sequência, não prioridade.

## Onde dá para paralelizar

Pouco, e isso é a forma da feature, não uma falha do plano: dois arquivos concentram 90% do diff.

```text
Phase 1:  T003 (testemunha, rede)       ∥  T004 (tela ANTES, browser)
Phase 3:  T027 (scripts/)               ∥  T021-T026 (page.tsx)
Phase 4:  T037 (GLOSSARIO.md)           ∥  T031-T036 (page.tsx)
Phase 5:  T040/T041 (lib/gsc-delta.mjs) →  T042 (test/gsc-delta.test.mjs)
```

Tudo o que toca `lib/kpis-busca.mjs` (T005, T006, T015–T019) e `app/okr/[slug]/aquisicao/page.tsx`
(T021–T026, T031–T036) é **serial**.

## Estratégia de entrega

**MVP = Phase 1 + Phase 2 + Phase 3.** Fecha a US1 inteira: o índice sai da leitura certa, a
testemunha confirma fora do código, e o número falso sai do ar. É a entrega que justifica a spec.

**Incremento 2 = Phase 4.** Sem ela o bloco fica com duas bases lado a lado e nenhuma explicação —
entregável, mas lê como bug para quem chegar depois. Não deixar para outro dia.

**Incremento 3 = Phase 5.** A procedência e os portões. `lib/gsc-delta.mjs` errado não quebra tela
nenhuma — manda o próximo a ligar um coletor que já está ligado, que é pior porque parece trabalho.

## Critério independente de cada story

| Story | Como provar sozinha |
|---|---|
| **US1** | A aba da Atma publica `12,5% … (24 avaliada(s))` e `scripts/conferir-soma-hosts.mjs --pagina` imprime o mesmo na mesma janela. Diferença zero. A home entre as avaliadas |
| **US2** | Toda medida do bloco nomeia a base; derrubar uma leitura esconde só a família dela, nomeando qual caiu |

## O que NÃO pode mudar (quickstart §7)

- Os valores por termo — SC-004, travada em T012 e conferida em T030.
- `BENCHMARK` e a janela de descoberta (28 dias).
- `denomIdx`, que vem do banco e não das leituras.
- Projeto **sem** consultas raras: com as duas leituras iguais, nenhum veredito correto inverte.
- `lib/okr-coleta.ts` e a ficha.

**Muda de propósito**: o Pass Rate de Core Web Vitals (T024, D11). A amostra passa de 14 para 29
URLs e "não consultadas" vai de 4 para 19. Declarar na entrega — não é regressão e não se "conserta".
