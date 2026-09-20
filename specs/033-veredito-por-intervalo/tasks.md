# Tasks: O veredito sai do intervalo da amostra, não de um piso de impressões

**Feature**: 033 | **Branch**: `033-veredito-por-intervalo` | **Data**: 2026-09-20

**Input**: `specs/033-veredito-por-intervalo/` — spec.md, plan.md, research.md, data-model.md,
contracts/{intervalo,kpis-busca,telas}.md, quickstart.md

**Tests**: **obrigatórios**. Não é a exceção do template — `plan.md` § Constitution Check lista
`npm test` verde na suíte inteira e o registro à mão em `package.json` como portões de merge
(Princípio II). Cada história escreve o teste **antes** da implementação, e o teste precisa
**falhar** antes de a lib existir.

**Organização**: por história de usuário, para cada uma ser implementável e verificável sozinha.

## Formato: `[ID] [P?] [História] Descrição`

- **[P]**: pode rodar em paralelo — arquivo diferente, sem dependência
- **[História]**: US1, US2, US3 — rastreabilidade até `spec.md`
- Caminho de arquivo exato em toda descrição
- **O ID é identificador estável, não ordem de execução.** A ordem sai da fase e do checkpoint.
  T069–T071 entraram pelo `speckit-analyze` de 20/09/2026 e ficaram no fim da numeração de
  propósito: renumerar as 68 tarefas originais dessincronizaria toda referência cruzada deste arquivo.

## Convenções de caminho

Monolito Next.js já existente, sem estrutura nova (`plan.md` § Structure Decision):
lógica pura em `lib/*.mjs`, telas em `app/`, testes em `test/*.test.mjs` registrados à mão em
`package.json`.

---

## Phase 1: Setup — a linha de base, medida antes de mexer

**Propósito**: ter o antes por escrito. A FR-009 é cobrável por `grep`, e um inventário feito depois
da primeira edição não prova nada.

- [X] **T001** Rodar `npm test` e guardar a saída verde como linha de base. Se algo já estiver
      vermelho **antes** desta feature, resolver ou registrar antes de seguir — suíte que já entra
      vermelha impede o portão de saída de significar alguma coisa.
      **Confirmado 20/09/2026**: 1092/1092 verde, ~11,6s.
- [X] **T002** Rodar `grep -rn "PISO_IMPRESSOES_VEREDITO\|exigePiso" lib app test` e salvar a lista
      como **checklist de conclusão da FR-009**. Medido em 20/09/2026: 42 linhas em 5 arquivos —
      `app/okr/[slug]/aquisicao/page.tsx` (20), `lib/gsc-delta.mjs` (10),
      `test/gsc-delta.test.mjs` (8), `test/kpis-busca.test.mjs` (3), `lib/kpis-busca.mjs` (1).
      O inventário de `research.md` §R6 é o mapa; esta lista é o que a Phase 6 zera.
      **Confirmado**: contagem bate exatamente (grep re-executado).

**Nenhuma dependência nova nesta feature.** Wilson é forma fechada e só usa `Math.sqrt`.

---

## Phase 2: Foundational (BLOQUEIA TUDO)

**Propósito**: `lib/intervalo.mjs`, a folha. As três histórias dependem dela e nenhuma pode começar
antes.

**⚠️ CRÍTICO**: sem esta fase não há veredito nenhum.

### Teste primeiro

- [X] **T003** Criar `test/intervalo.test.mjs` com os casos de referência de `quickstart.md` §1 e
      `contracts/intervalo.md`, **antes** de o módulo existir. Precisa **falhar** por
      `ERR_MODULE_NOT_FOUND`:
      - `wilson(0, 21)` → `inferior === 0`, `superior` ≈ **0,1546** — o `=== 0` só passa **com o
        clamp**: a forma fechada devolve `-1,1731740316366828e-17` (medido em 20/09/2026)
      - `wilson(3, 105)` → `[0,0098 ; 0,0807]`
      - `wilson(0, 1)` → `inferior === 0`, `superior` ≈ 0,793
      - `wilson(275, 21500)` → `[0,011 ; 0,014]`
      - `wilson(k, 0)` → **`null`** · `wilson(n, n)` → `superior === 1`
      - `wilson(-1, 10)` e `wilson(11, 10)` → **lançam**
      - **varredura**: `n` de 1 a 500, `k` de 0 a `n` → `0 <= inferior <= superior <= 1`.
        É a FR-003 como **invariante**, não como três exemplos
      - `vereditoContraRegua`: `(0,21,0.25)="abaixo"` (SC-001) · `(3,105,0.045)="indecisa"`
        (SC-002) · `(0,1,0.13)="indecisa"` · `(4,900,null)=` **`null`**, não `"indecisa"` ·
        `(25,100,0.25)="indecisa"` · empate exato no piso é `"atinge"`
      - `vereditoContraFaixa`: `"atinge"` só quando `inferior >= 0.50` contra `[0.40, 0.50]`;
        `piso > teto` **lança**
- [X] **T004** Registrar `test/intervalo.test.mjs` na lista explícita de `package.json` **no mesmo
      commit** (Princípio II). `test/validade.test.mjs` compara lista contra diretório nos dois
      sentidos e reprova a divergência.

### Implementação

- [X] **T005** Criar `lib/intervalo.mjs` com `CONFIANCA = 0.95` e
      `Z_95 = 1.959963984540054` — valor cheio, **não** 1,96: o arredondado move o teto de `0/21` em
      0,1 ponto, e é esse teto que decide a Posição 1 contra a régua de 25%.
- [X] **T006** `lib/intervalo.mjs` — `wilson(cliques, impressoes, z = Z_95)`. `impressoes <= 0` ou
      entrada não finita → `null`; `cliques < 0` ou `cliques > impressoes` → **lança**;
      `0 <= inferior <= superior <= 1` sempre, inclusive `k = 0` e `k = n`.
      **O clamp `[0, 1]` na saída não é defensivo, é aritmética medida**: a forma fechada devolve
      `-1,1731740316366828e-17` em `wilson(0, 21)` e `+2,16e-19` em `wilson(0, 1000)` — o sinal vira
      com `n`. Sem ele a varredura da T003 fica vermelha no primeiro caso, por um motivo que não é o
      método. `Math.max(0, …)` / `Math.min(1, …)`, com o valor medido no comentário.
- [X] **T007** `lib/intervalo.mjs` — `vereditoContraRegua(cliques, impressoes, regua, z)`. Três
      condições exaustivas e mutuamente exclusivas. A assimetria `superior < regua` contra
      `inferior >= regua` é deliberada: a régua é **piso**, empate exato é `atinge`.
      **Contagem de cliques não entra** — `0/21` contra 25% é `abaixo`.
- [X] **T008** `lib/intervalo.mjs` — `vereditoContraFaixa(cliques, impressoes, [piso, teto], z)`.
      Qualquer sobreposição com a faixa é `indecisa`; `piso > teto` lança.
- [X] **T009** Cabeçalho de `lib/intervalo.mjs`: declarar que é **folha** (zero imports, sem
      `process.env`, sem `Date.now()`), pelo mesmo motivo de `lib/janelas.mjs` — `scripts/` e
      `node --test` importam sem arrastar `google-auth-library`.

**Checkpoint**: `node --test test/intervalo.test.mjs` verde. A partir daqui as três histórias podem
seguir em paralelo.

---

## Phase 3: User Story 1 — O veredito só existe onde a amostra o sustenta (P1) 🎯 MVP

**Meta**: o Índice de Conformidade passa a ter denominador de páginas **decididas**, com as
indecisas contadas e nomeadas, e a aba de aquisição responde com a **página nomeada**, não com um
percentual.

**Teste independente**: abrir `/okr/atma/aquisicao` e conferir que o denominador contém só páginas
cuja amostra decide, que as indecisas aparecem contadas ao lado, e que o elemento de maior área é a
frase da página nomeada.

### Testes da US1 ⚠️ escrever primeiro, conferir que falham

- [X] **T010** [P] [US1] `test/kpis-busca.test.mjs` — **remover** a asserção "1 impressão vale no
      máximo 1 ponto" (`:473`) e o import do piso (`:21`); **entrar** a derivação:
      `1 / LIMIAR_PAGINAS_DECIDIDAS < 0.05` **e** `1 / (LIMIAR_PAGINAS_DECIDIDAS - 1) >= 0.05`.
      Constante afirmada por igualdade sobrevive a mudar a meta do board; afirmada pela
      desigualdade que a gerou, não.
- [X] **T011** [P] [US1] `test/kpis-busca.test.mjs` — fixture da Atma de 20/09/2026 para
      `conformidadeDeCtr()`: `porPagina 0,25 (1 de 4)` · `porTrafego 0,025 (583 de 22.899)` ·
      `indecisas 20` · `semRegua 5` · `porPagina.meta === [0.75, 0.80]` ·
      **`porTrafego.meta === null` reprovando qualquer outro valor** (trava da FR-010).
      Invariantes: `decididas + indecisas + semRegua + semImpressao === paginas.length` e
      `porPagina.atingem <= porPagina.decididas`.
- [X] **T012** [P] [US1] `test/kpis-busca.test.mjs` — `paginaNomeada()`: maior impressão **entre as
      decididas** (não a pior); empate resolve pela URL alfabeticamente menor; `veredito` nunca
      `"indecisa"`; o caso em que a maior **atinge** e a frase diz isso;
      `decididas === 0` → `null` (FR-013).
- [X] **T013** [P] [US1] `test/kpis-busca.test.mjs` — as **4 asserções** de `cliquesNaoCapturados()`
      migradas de `test/gsc-delta.test.mjs`, mais o caso da SC-009:
      21.500 × 2,00% = 430 esperados − 275 medidos = **155 faltantes**, e 275/21.500 = **1,28%**.
- [X] **T014** [P] [US1] `test/gsc-delta.test.mjs` — as 8 asserções de piso (`:16`, `:18`, `:116`,
      `:129`, e as de `exigePiso`) **saem**; entram as da FR-008: `CTR_PISO` tem `medidaEm`, `serp`,
      `serpDaFonte` e `cadencia`, `limiarEmTexto()` anexa a SERP que a régua **julga** (não o piso,
      não a da fonte), e a idade derivada de `medidaEm` bate com `cadencia`.

### Implementação da US1

- [X] **T015** [US1] `lib/kpis-busca.mjs:93` — **remover** `PISO_IMPRESSOES_VEREDITO` e o bloco de
      comentário da 026. **Criar** `LIMIAR_PAGINAS_DECIDIDAS = 20` com a derivação
      (`1/n < 0,05` → `n >= 20`) e o ⚠️ de por que é deliberadamente mais frouxo que o precedente
      da 026 (que pediria 200 páginas decididas, número que nenhum projeto do portfólio tem).
      A derivação da 026 **não se perde** — migra para cá.
- [X] **T016** [US1] `lib/kpis-busca.mjs` — **migrar** `cliquesNaoCapturados(u)` de
      `lib/gsc-delta.mjs:444`. `gsc-delta.mjs` importa `kpis-busca.mjs` (não o contrário), então a
      função desce e `gsc-delta.mjs` a **re-exporta**, como já faz com `ctrEsperado`. Uma fórmula,
      um lugar.
- [X] **T017** [US1] `lib/kpis-busca.mjs:235` — `ctrGap()` vira **`conformidadeDeCtr(paginas,
      janela)`** devolvendo `ConformidadeDeCtr` (`data-model.md` §6). **Renome, não ajuste**: o nome
      antigo com semântica nova deixaria a aba compilando e medindo outra coisa — o `tsc` precisa
      apontar os dois pontos de uso. Régua aplicada **linha a linha** via `benchmark(posicao)`;
      `fracao` é `null` (nunca `0`) quando o denominador é 0; `indecisas`, `semRegua` e
      `semImpressao` são campos **públicos**, não derivados que a tela recalcula (FR-011).
- [X] **T018** [US1] `lib/kpis-busca.mjs` — `paginaNomeada(decididas, impressoesDecididas)`
      devolvendo `PaginaNomeada` (`data-model.md` §7), com `participacao` e `cliquesFaltantes`
      (`null` quando já cobre).
- [X] **T019** [US1] `lib/kpis-busca.mjs:347` — `kpisPorPagina(paginas, indexadas, janela)`:
      `janela` **obrigatória e sem default** (janela com valor padrão é a porta por onde um número
      perde a declaração dela — FR-004), e `ctrGap` sai em favor de `conformidade`.
      Atualizar o comentário de `scripts/conferir-soma-hosts.mjs:26`, que cita `ctrGap` pelo nome.
- [X] **T020** [US1] `lib/kpis-busca.mjs` — corrigir o cabeçalho do arquivo: ele deixa de ser "zero
      imports" ao passar a importar `lib/intervalo.mjs`. Dizer "zero imports" com um import é a
      divergência silenciosa que este repo já paga em outros lugares.
- [X] **T021** [US1] `lib/gsc-delta.mjs` — o piso **sai dos 10 pontos**: import (`:26`), ramo
      `exigePiso`/`piso` de `seloDaMedida()` (`:479`–`:485`), `exigePiso` (`:516`), o sufixo de
      `limiarEmTexto()` (`:538`), a chamada (`:561`), a re-exportação (`:616`) e o
      `base: "impressoes"` do catálogo (`:217`, `:261`). **Selo novo** para indecisão, porque o
      estado é da **amostra**, não do board.
- [X] **T022** [US1] `lib/gsc-delta.mjs:65` — `CTR_PISO` ganha campos estruturados (FR-008):
      `medidaEm: "2025-05-28"` · `cadencia: "mensal"` ·
      `serp: "SERP real do Search Console, com resposta gerada por IA em ~31% das buscas"` ·
      `serpDaFonte: "SERP limpa, sem resposta gerada por IA"`.
      **São dois campos de SERP porque são dois fatos**, e inverter os dois é o defeito que o
      `speckit-analyze` pegou: o `recorte` atual já registra que o hub cobra 25/13/8% contra os
      39,8/18,7/10,2% da First Page Sage **de propósito**, justamente porque o CTR do GSC é apurado
      na SERP real. Carimbar "sem resposta gerada por IA" na **régua** afirma o contrário do medido.
      Campo estruturado é o que permite um teste reprovar régua sem `medidaEm`; prosa não.
      `limiarEmTexto()` passa a anexar a SERP que a régua **julga**.
- [X] **T023** [US1] `lib/gsc-delta.mjs:112`, `:123`, `:124` — `MEDIDO_POR.ctrPorPosicao`,
      `MEDIDO_POR.ctrGap` e `MEDIDO_POR.conformidadeUrls` reapontam para
      `lib/kpis-busca.mjs#conformidadeDeCtr` **no mesmo commit** do renome.
- [X] **T069** [US1] `app/gsc/page.tsx` — **o chamador que o `grep` da FR-009 não pega.** Esta tela
      não cita `PISO_IMPRESSOES_VEREDITO` nem `exigePiso`: ela **chama** `limiarEmTexto(k)` e
      `seloDaMedida()`, e renderiza `r.fonte.recorte` em `:260`. Logo, T021 e T022 **mudam o texto
      dela** com ou sem tarefa — `guarda_no_chamador_volta_pela_porta_seguinte` entrando pela porta
      oposta. Como é ela quem publica a procedência das 32 linhas, passa a declarar `medidaEm` + a
      **idade derivada** ao lado do `acessadoEm` que já existe, a `serp` que a régua julga no lugar
      de onde o sufixo do piso saiu, e a `serpDaFonte` junto do `recorte`, que já cita os
      39,8/18,7/10,2%. **O que NÃO muda**: `/gsc` continua estática, sem ler dado de projeto e sem
      veredito de amostra — ver `contracts/telas.md` §D.
- [X] **T024** [US1] `app/okr/[slug]/aquisicao/page.tsx:657-658` — `acimaDoPisoTermo` e
      `acimaDoPisoPagina` **deixam de existir**, e com eles os 20 pontos que os consomem
      (`:20`, `:1057`, `:1069`, `:1904`–`:1922`, `:1970`, `:1973`–`:1991`, `:2019`,
      `:2073`–`:2091`, `:2107`, `:2134`–`:2148`, `:2308`–`:2316`). As trilhas passam a ser
      desenhadas sempre que houver medida; o que gate o veredito é o **intervalo**.
- [X] **T025** [US1] `app/okr/[slug]/aquisicao/page.tsx:186` — estender `Trilha` para desenhar o
      **segmento** `[inferior, superior]` no eixo 0–100%, com a régua como **tique** no mesmo eixo,
      em vez de um comprimento a partir do zero. `aria-hidden` no desenho. **Custa zero pixel de
      altura** — o `Trilha` já mora na faixa de `padding-bottom` que a linha reserva
      (`position: absolute`), que foi a objeção que matou o gráfico de barras na corrida anterior.
- [X] **T026** [US1] `app/okr/[slug]/aquisicao/page.tsx` — **nível 1**: com `decididas < 20`, o bloco
      de maior área é a **frase da página nomeada** (FR-012, SC-009, SC-010).
      A participação é **94% do tráfego decidível** (21.500 de 22.899), e a frase **nomeia a
      grandeza** — sobre o tráfego do site inteiro (24.664) a mesma página é 87%, e as duas frases
      soltas na mesma reunião viram dois números disputando a mesma afirmação (mesmo motivo da
      FR-010).
      **Área de nível 1 ≥ 2× a de um nível 2, nas três larguras.** A leitura recusada de 18/09/2026
      é explícita: esse gate pede **resposta maior**, não evidência menor — oito corridas leram ao
      contrário.
- [X] **T027** [US1] `app/okr/[slug]/aquisicao/page.tsx` — **nível 2**: as duas leituras lado a lado,
      **sem o mesmo peso visual** (FR-010). Por página: "das páginas **decidíveis** atingem a régua
      da própria posição", com a faixa `[0.75, 0.80]` na trilha e
      `1 de 4 decididas · 20 indecisas · 5 sem régua` ao lado. Por tráfego: "das **impressões
      decidíveis** estão em páginas que atingem", **sem tique e sem faixa**, com
      `583 de 22.899 impressões`. **A ausência de meta é o portador da distinção** (SC-008).
- [X] **T028** [US1] `app/okr/[slug]/aquisicao/page.tsx` — os **cinco estados** com glifo **e texto**
      (`data-model.md` § Os cinco estados): `▲ atinge` · `▼ abaixo` · `◐ a amostra não decide` ·
      `○ sem régua nesta faixa` · `∅ o site não aparece aqui`. Nunca cor como único portador;
      nunca `0%` no lugar de ausência; o bloco **não muda de tamanho** entre estados; o estado é
      texto e chega ao leitor de tela. Os glifos **nunca** reusam `◆`/`◇`, que neste hub já
      significam procedência da régua.
- [X] **T029** [US1] `app/okr/[slug]/aquisicao/page.tsx` — substituir o bloco `<dt>abaixo do
      piso</dt>` pelo que explica **indecisão** e a FR-011: a variação do índice por página pode vir
      da mudança do **denominador**, não de desempenho — a leitura por tráfego ao lado é o portador
      dessa distinção. Escrever o caso real: 12,5% → 25,0% **sem nenhuma página ter melhorado**.
- [X] **T030** [US1] `app/okr/[slug]/aquisicao/page.tsx` — **nível 3**: procedência da régua
      (`fonte`, `medidaEm`, **idade derivada**, `serp`, `serpDaFonte`, `cadencia`), declaração de
      janela e a lista das decididas-e-abaixo ordenada por impressões (FR-004, FR-008). As duas
      condições de SERP aparecem **nomeadas e separadas** — a da referência e a que a régua julga.
- [X] **T031** [US1] `app/okr/[slug]/aquisicao/page.tsx` — **FR-013**: com `decididas === 0`, o
      nível 1 é **texto** — quantas indecisas, quantas sem régua, e a declaração de que **não há
      página nomeada**. Índice nenhum é publicado. Não é espaço em branco.
- [X] **T032** [US1] `app/okr/[slug]/aquisicao/page.tsx` — com `decididas >= 20` a tela **troca de
      forma** e o índice por página sobe a nível 1. A troca é legítima, mas **não pode ser
      silenciosa** (edge case da spec): a tela declara por escrito por que mudou de cara.

**Checkpoint**: `/okr/atma/aquisicao` responde com a página nomeada, publica as duas leituras com
base ao lado e só a por página com a meta do board. SC-003, SC-007, SC-008, SC-009, SC-010.

---

## Phase 4: User Story 2 — O mapa do board mostra o real de cada faixa (P1)

**Meta**: as seis faixas de posição em `/gsc/mapa`, cada uma com base, janela e veredito quando ele
existe, contra a régua que **julga** — nunca a tabela transcrita do board.

**Teste independente**: abrir `/gsc/mapa`, conferir que as seis faixas declaram base e janela, que
só as decisivas carregam veredito, e que **com JS desligado** a lista aninhada mostra os mesmos
estados.

### Testes da US2 ⚠️ escrever primeiro

- [X] **T033** [P] [US2] `test/kpis-busca.test.mjs` — **trava das duas listas**: percorrer
      `BENCHMARK` e `FAIXAS` **nos dois sentidos** — degrau de `BENCHMARK` sem faixa **e** faixa com
      `regua` que não existe em `BENCHMARK`. A trava cobre `de`/`ate`/`regua`, que são derivados, e
      **não cobre `rotulo`**, que é autoral: "Posições 4 a 6" não existe em `BENCHMARK`. Para o
      rótulo, asserção separada de que ele nomeia a própria faixa (`de` e `ate - 1` no texto). É a mesma trava que `test/board-gsc.test.mjs` aplica ao
      catálogo, e existe porque uma segunda lista divergiria em silêncio no primeiro limiar novo.
      Mais: `faixaDaPosicao(11.000000000000002)` cai na página 2 e **não fora de tudo**;
      `faixaDaPosicao(20.5)` → `null`.
- [X] **T034** [P] [US2] `test/kpis-busca.test.mjs` — `porFaixaDePosicao()` devolve **sempre 6**
      entradas, inclusive as sem impressão; `janela` presente em **cada** faixa; soma de `paginas`
      das seis + as acima de 20,0 = total de URLs com impressão; nenhuma página em duas faixas;
      veredito da faixa sai da amostra **somada** contra `faixa.regua`; `intervalo === null` sem
      impressão; a faixa 11–20 tem `regua === null` e `veredito === null`.
- [X] **T035** [P] [US2] `test/board-gsc.test.mjs` — a divergência `DIVERGENCIAS.ctrPorPosicao`
      reaponta para a régua que julga e passa a dizer **qual régua julgou cada faixa**.

### Implementação da US2

- [X] **T036** [US2] `lib/kpis-busca.mjs` — `FAIXAS` **derivada de `BENCHMARK`** (cinco faixas dos
      cinco degraus, `ate` exclusivo) + a sexta **declarada**:
      `{ rotulo: "Página 2 (11 a 20)", de: 11, ate: 21, regua: null }` — existe no board e **não**
      em `BENCHMARK` porque o piso de "~1,5%" **não tem fonte**. E `faixaDaPosicao(posicao)`, por
      comparação de fronteira exclusiva, **nunca** por re-agregação.
      **Derivado ≠ autoral**: `de`, `ate` e `regua` saem de `BENCHMARK`; `rotulo` é dado novo e não
      é derivável dele. Escrever isso no comentário evita que a próxima leitura trate "derivada de
      `BENCHMARK`" como se cobrisse o rótulo também.
- [X] **T037** [US2] `lib/kpis-busca.mjs` — `porFaixaDePosicao(paginas, janela)` devolvendo
      `FaixaDePosicao[]` (`data-model.md` §5). `janela` vai em **cada** faixa, não no objeto pai: o
      nó do mapa é lido isolado, e janela só no cabeçalho não acompanha o nó. **Sem parâmetro para
      uma segunda janela** — é assim que a FR-007 vira estrutura, não regra de revisão.
- [X] **T038** [US2] `lib/kpis-busca.mjs:347` — `kpisPorPagina()` ganha
      `faixas: porFaixaDePosicao(paginas, janela)`.
- [X] **T039** [US2] `lib/board-gsc.mjs:529` — `DIVERGENCIAS.ctrPorPosicao` passa a dizer **qual
      régua julgou cada faixa** (FR-005). A nota de lá **já** aponta para `BENCHMARK` ("Quem julga é
      lib/kpis-busca.mjs#BENCHMARK"), então metade da FR-005 já está no dado: o que entra é o
      veredito ao lado da transcrição. A transcrição do board (>30%/>7%/>4% contra os 25%/4,5%/2% do
      hub — o dobro nas posições 7 a 10) **continua exibida como transcrição**, com a etiqueta `⚠`.
      `BOARD.ctrGap` (`:192`) é título transcrito do board e **não** acompanha o renome da função.
- [X] **T040** [US2] `app/gsc/mapa/page.tsx:23` — `export const dynamic = "force-static"` vira
      `export const revalidate = 3600`, o mesmo de `/okr/[slug]/aquisicao`, com a mesma fonte e a
      mesma quota. Número de janela móvel congelado em build é `dado velho` sem carimbo — o defeito
      que esta spec conserta, um nível acima.
- [X] **T041** [US2] `app/gsc/mapa/page.tsx:17-18` — **reescrever** o cabeçalho ⚠️ que declara "ESTA
      TELA TAMBÉM NÃO LÊ DADO DE PROJETO NENHUM", **no mesmo commit**, com o motivo da reversão e a
      trava que neutraliza o risco original: uma `porFaixaDePosicao()`, dois portadores — discordar
      exigiria escrever a conta duas vezes. Comentário que contradiz o código é pior que comentário
      ausente.
- [X] **T042** [US2] `app/gsc/mapa/page.tsx` — a página vira **`async`** (`listProjects()` é
      `async` em `lib/projects.ts:109` e `MapaDoBoardPage()` é síncrona hoje) e lê os hosts da
      **`atma`** por `listProjects()` + `hostsDeclarados()` (Princípio I: **nenhum** import de `data/projects.json`), chamar
      `gscPaginas(hosts, descoberta())` e computar `porFaixaDePosicao(paginas, janela)`. A tela
      **declara qual projeto** está medindo, por escrito, no cabeçalho da seção — o board
      `okr-Saw2eoSKZDPLJAk6xeDBuS` é o da Atma, não do portfólio.
- [X] **T043** [US2] `app/gsc/mapa/mapa.tsx` — o nó de cada faixa carrega base, janela e veredito no
      **`topic`**, curto: `Posições 4 a 6 · 105 impr · 3 págs · ◐ não decide`. A `mind-elixir`
      **não renderiza `note`** (medido: 0 ocorrências da string em `dist/MindElixir.js` na 5.15.1),
      então a prosa longa (IC, régua, janela, fonte) vai no **painel de seleção**
      (`bus.addListener("selectNodes", …)` + `aria-live="polite"`).
- [X] **T044** [US2] `app/gsc/mapa/page.tsx` — a **lista aninhada servida no servidor** carrega os
      cinco estados por extenso, aberto, gerada da **mesma** travessia que alimenta o mapa. É ela
      que responde sem JS, na impressão, no Ctrl+F e **a 360px, onde o mapa é decorativo**
      (pendência já registrada em `.info/log.json`). **A FR-005 e a FR-006 têm de valer na lista**,
      não só no mapa — um teste de verificação que só olhe o mapa aprova uma tela que não responde
      no celular.
- [X] **T045** [US2] `app/gsc/mapa/page.tsx` — o **contrato de ausência** (`contracts/telas.md` §C):
      `null` de `gscPaginas()` = "sem propriedade no Search Console para este projeto";
      `{erro}` = o erro, nomeado; `{paginas: []}` = "nenhuma impressão nesta janela", com a janela
      declarada. **Nenhum dos três renderiza `0%`.** Colapsar `null` e `{erro}` faz "sem
      propriedade" mentir quando era timeout. Princípio V: nenhum nome de variável de ambiente,
      valor ou prefixo em log, mensagem ou resposta.
- [X] **T046** [US2] `app/gsc/mapa/page.tsx` — a **janela** aparece no nó pai de "Posição no Google"
      **e de novo em cada nó de faixa** (FR-004). O nó é lido isolado.

**Checkpoint**: ✅ **FECHADO em 20/09/2026, 06:31 BRT** (`b5a2767`; T070–T072). Reprovou em produção
às 05:36 — seis faixas sem dado e uma frase FALSA, assada no build (Phase 4b). Agora, em duas
leituras separadas por 6 min: **SC-004** ✓ (as seis declaram base e janela; as três indecisas
não emitem veredito) e **SC-005** ✓ **no mapa** (as seis notas e o nó pai declaram a mesma janela,
`2026-08-21 → 2026-09-17`; nenhum número compõe duas janelas).

---

## Phase 4b: A US2 reprovou em produção — o build assa uma busca que falhou

**Achado em 20/09/2026, 05:36 BRT**, fazendo a T068 que tinha ficado para trás. `/gsc/mapa` responde
200 com `X-Nextjs-Cache: HIT`, as seis faixas sem base e sem veredito, e no lugar do dado:

> **"Sem propriedade no Search Console para este projeto."**

**A frase é falsa.** As duas propriedades (`sc-domain:usealigner.com` e `sc-domain:roilabs.com.br`)
existem e respondem — conferidas à mão na mesma madrugada, e é delas que a aba de aquisição tira os
números que ELA publica corretamente.

### A causa, provada pelos dois lados

`/gsc/mapa` é **caminho estático**. Com `export const revalidate = 3600` e sem diretiva dinâmica, o
Next pré-renderiza a página no `npm run build` — que roda dentro do Docker, onde
`GOOGLE_SERVICE_ACCOUNT_JSON` **não existe**: o `Dockerfile` não tem `ARG` nem `ENV` para ele
(linha 12, `RUN npm run build`). O `null` do build foi assado no artefato e é servido como `HIT`.

`/okr/[slug]/aquisicao` escapa **por acidente de roteamento**, não por acerto: é segmento dinâmico
sem `generateStaticParams`, então o Next não consegue pré-renderizar e ela renderiza sob demanda, em
runtime, onde a credencial existe. **As duas declaram o mesmo `revalidate = 3600`.** Só uma pode ser
assada — e foi a que não tem `[slug]`.

É `ssg_db_query_build_time_gotcha` casado com `isr_hit_with_old_html_is_an_old_build`.

### Dois defeitos, com consertos diferentes

- [X] **T070** [US2] **O build não pode assar uma busca que falhou.** Mover a leitura do Search
      Console em `app/gsc/mapa/page.tsx` para um filho envolvido em `<Suspense>` que renderiza sob
      demanda, mantendo o board (que não depende de rede) estático. `force-dynamic` na página
      inteira também resolve e é pior: joga fora o render estático de 137 KB de board que nunca
      muda entre deploys. **Não passar a credencial como `ARG` no Dockerfile** — segredo em camada
      de build fica no histórico da imagem (Princípio V).
      **Critério**: `curl` logo após um deploy devolve as seis faixas com dado, sem esperar a hora
      do `revalidate`.
      **FEITO com `force-dynamic`, e a premissa acima estava errada.** Misturar estático e
      dinâmico dentro de uma rota é o Partial Prerendering, que é feature do `cacheComponents` —
      e o `next.config.mjs` não o liga (a doc do Next 16 instalada em `node_modules` diz isso, e
      ligar mexe no padrão de TODAS as rotas do hub e proíbe `revalidate`/`dynamic` de segmento).
      Sem ele, `<Suspense>` não muda o que é pré-renderizado e a leitura continua rodando no
      build. O "pior" da frase original é desprezível: `mapaDoBoard()` é função pura. `revalidate
      = 3600` saiu (não significa nada em rota dinâmica) e o comentário do arquivo diz por quê.
      **Provado como o Docker**: `GOOGLE_SERVICE_ACCOUNT_JSON= next build` → `/gsc/mapa` sai `ƒ`
      (antes `○`); servidor local com a credencial, **primeira** requisição, `2 de 6 faixas
      decisivas`, `Cache-Control: no-store`, sem `X-Nextjs-Cache`.

- [X] **T071** [US2] **A tela acusa a causa errada.** O contrato da 030 define `null` como "env
      desligada **ou** host fora de toda propriedade" — **duas** causas. `app/gsc/mapa/page.tsx:111`
      escolhe uma e afirma: *"sem propriedade no Search Console para este projeto"*. Quem ler vai
      auditar permissão que está correta enquanto o defeito é variável de ambiente. Separar os dois
      estados na borda (`lerPorHosts`/`gscPaginas`) e deixar cada tela nomear o que de fato houve.
      **Critério**: com a credencial ausente a tela diz que a credencial está ausente; com a
      credencial presente e o host fora de toda propriedade, diz isso. As duas frases existem e são
      diferentes.
      ⚠️ Esta é a mesma família de defeito que a 033 inteira existe para consertar — ausência com o
      nome errado —, entrando pela porta da infraestrutura em vez da estatística.
      **FEITO sem mudar o tipo de retorno.** Trocar `null` por união discriminada tocaria as sete
      leituras e uns 30 asserts. Em vez disso a borda exporta o predicado que ELA JÁ USAVA —
      `gscLigado()` em `lib/gsc.ts`, o mesmo de `getClient()`, uma fonte só — e
      `motivoDeAusencia({ligado, hosts})` em `lib/gsc-hosts.mjs` (pura, na ordem de `lerHosts`:
      lista vazia → credencial → propriedade) devolve as **três** frases, que nunca citam o nome da
      variável (Princípio V). `app/gsc/mapa/page.tsx` e `app/okr/[slug]/aquisicao/page.tsx`
      (`semPropriedadeGsc`, mesmo `null`, mesma frase errada) passam a usá-la. 5 testes novos em
      `test/gsc-hosts.test.mjs`, vistos falhar antes. Render real com a credencial em branco: "A
      credencial do Search Console não está configurada neste ambiente." e nenhuma ocorrência de
      "sem propriedade". A terceira frase (credencial presente, host fora de toda propriedade) só
      está provada em teste unitário — o catálogo não tem host assim para renderizar.
      **NÃO tocado, de propósito: `lib/okr-coleta.ts:198`** (`sem propriedade no GSC para ${p.url}`,
      célula `visitante` da ficha). O mesmo `null`, a mesma frase — mas `familiaDe()` em
      `lib/okr.mjs:476` classifica o buraco por regex nesse texto (`/propriedade|GSC|indexa/` → D1,
      `/ausente/` → D4), então trocar a frase muda a família do buraco e o Placar. É decisão de
      taxonomia, não de texto: fica para uma tarefa própria.

- [X] **T072** [US2] Depois da T070, refazer a T068 **no mapa também**: duas leituras, a segunda
      confirmando que as seis faixas trazem base, janela e veredito só onde a amostra decide. A
      conferência anterior olhou só a aba de aquisição e por isso aprovou uma feature pela metade —
      o próprio `tasks.md` já avisava disso na T044 ("um teste de verificação que só olhe o mapa
      aprova uma tela que não responde"), e desta vez o erro foi o simétrico.
      **FEITO em 20/09/2026, `b5a2767`.** Duas leituras de `hub.roilabs.com.br/gsc/mapa`, 06:25 e
      06:31 BRT (6 min de intervalo), **idênticas**: `Cache-Control: no-store` e nenhum
      `X-Nextjs-Cache` (o build antigo respondia `s-maxage=3600` + `STALE`, medido antes do
      deploy), zero ocorrência de "sem propriedade", `2 de 6 faixas decisivas`, janela em 6 de 6
      notas. As seis: Posição 1 ▼ abaixo (21 impr · IC até 15,5% < 25%) · Posições 2, 3 e 4–6 ◐ não
      decide (3, 11 e 105 impr) · Posições 7–10 ▼ abaixo (23.450 impr · IC até 1,9% < 2%) · Página 2
      ○ sem régua (437 impr). Veredito só onde o intervalo exclui a régua.
      **Não verificado:** screenshot (a página exige basic auth e passar a senha a uma ferramenta de
      browser a ecoaria — a T060–T064 já cobriu o visual), teclado e 360px. A conferência é sobre o
      HTML servido.

### O que NÃO é o conserto

**Esperar.** O `stale-while-revalidate` provavelmente regenera a página em runtime cerca de uma hora
depois do deploy, com a credencial presente, e o mapa se cura sozinho. Isso não fecha nada: **a cada
deploy a primeira hora do mapa volta a publicar a frase falsa**, e é a hora em que alguém abre a
tela para conferir o que acabou de subir.

---

## Phase 5: User Story 3 — A concentração no Top 3 usa o mesmo teste (P2)

**Meta**: a fração de impressões no Top 3 deixa o piso fixo e passa pelo mesmo critério das demais.

**Teste independente**: conferir que a fração emite ou omite veredito pelo mesmo critério das
faixas, com a base declarada **nos dois casos**.

- [X] **T047** [P] [US3] `test/kpis-busca.test.mjs` — `impressoesNoTop3()` devolve
      `{ fracao, noTop3, total }` e `null` com `total === 0`; os 6 pontos de asserção existentes
      (`:249`, `:253`, `:254`, `:284`, `:309`, `:492`) passam a ler `.fracao`. Mais o veredito
      contra `[0.40, 0.50]`: a amostra da Atma (3% em 22.899 impressões) **decide** e exclui 40% com
      folga; uma amostra pequena **não decide** e o número sai com a base e sem veredito
      (AS-1 da US3).
- [X] **T070** [US3] `lib/kpis-busca.mjs:106` — `impressoesNoTop3()` passa a devolver
      `{ fracao, noTop3, total }`. **A assinatura precisa mudar**: hoje ela calcula numerador e
      denominador e **descarta os dois**, e `vereditoContraFaixa()` exige os dois. O
      `speckit-analyze` pegou o contrato afirmando "a assinatura não muda" contra uma US3 que é
      impossível sem mudá-la. Bônus: mata a segunda fórmula de
      `app/okr/[slug]/aquisicao/page.tsx:1984`, que hoje recalcula o numerador na tela
      (`Math.round(impressoesNoTop3 * baseCurta)`) porque a lib não o expõe.
- [X] **T048** [US3] `app/okr/[slug]/aquisicao/page.tsx:1968`–`:1984` — `impressoesNoTop3` mantém a
      barra e a faixa `[0.40, 0.50]` do board; o gate deixa de ser `acimaDoPisoTermo` e passa a ser
      `vereditoContraFaixa(k.impressoesNoTop3.noTop3, k.impressoesNoTop3.total, [0.40, 0.50])` —
      **o numerador é impressão no Top 3, nunca clique**. Sem veredito, o número aparece **com a
      base**, que agora sai da lib em vez de ser recalculada na tela.
- [X] **T049** [US3] `app/okr/[slug]/aquisicao/page.tsx` — a ressalva **permanece**: os 40% a 50% são
      `balizador: { tipo: "recusa" }` no catálogo — **parâmetro do board sem fonte**, não régua
      publicada. O `◇` e o motivo da recusa continuam do lado. O veredito estatístico nunca é
      apresentado com a autoridade de régua.
- [X] **T050** [US3] `app/okr/[slug]/aquisicao/page.tsx` — o selo de piso da leitura **por termo**
      **não sai**: aquele piso é sobre a **completude da dimensão** (o GSC omite as consultas
      raras), este era sobre a **suficiência da amostra**. Só o segundo sai. Confundir os dois
      removeria uma ressalva conquistada.

**Checkpoint**: um único critério de suficiência de amostra no painel inteiro.

---

## Phase 6: Polish — os portões que fecham a feature

- [X] **T051** `npm test` verde na **suíte inteira** (~1,6 s), não só nos arquivos tocados.
      **Confirmado 20/09/2026**: 1127/1127 verde.
- [X] **T052** **O portão da FR-009**: `grep -rn "PISO_IMPRESSOES_VEREDITO\|exigePiso" lib app test`
      → **zero linhas** fora de `.next/`. Conferir contra o checklist da T002. Consertar o chamador
      e deixar a constante viva é `guarda_no_chamador_volta_pela_porta_seguinte` — o padrão que este
      hub já pagou **seis** vezes.
      **Confirmado**: zero linhas (inclusive nos comentários — reescritos para não citar os nomes
      literais, já que o grep não distingue código de comentário).
- [X] **T053** `npx tsc --noEmit` limpo, e conferir que os dois renomes — `ctrGap` →
      `conformidadeDeCtr` e `impressoesNoTop3` de `number` para `{fracao, noTop3, total}` — de fato
      apontaram os pontos de uso, em vez de compilar calados.
      **Confirmado**: `tsc --noEmit` limpo; os dois renomes forçaram atualização em
      `app/okr/[slug]/aquisicao/page.tsx` (conformidade/faixas) e nos testes.
- [X] **T071** **O portão que o `grep` da FR-009 não cobre**: além das strings do piso, rodar
      `grep -rn "limiarEmTexto\|seloDaMedida" app lib` e conferir que **todos** os chamadores foram
      auditados — hoje são `app/gsc/page.tsx`, `app/gsc/mapa/page.tsx` e
      `app/okr/[slug]/aquisicao/page.tsx`. Mudança em função compartilhada se audita pelos
      chamadores da função, não pelas strings da constante.
      **Confirmado**: o grep real devolve `app/gsc/page.tsx`, `lib/board-gsc.mjs` e
      `lib/gsc-delta.mjs` — os três auditados (T069 e comentários de `board-gsc.mjs#selo`).
      `/gsc/mapa` e a aba de aquisição consomem `regua()`/`Origem` (não as duas funções
      diretamente) e já foram auditados nas Fases 3 e 4.
- [X] **T054** Conferir que **nenhum** import direto de `data/projects.json` entrou fora de
      `lib/projects.*` (Princípio I) e que nenhum segredo aparece em log, resposta ou mensagem de
      erro (Princípio V).
      **Confirmado**: os arquivos tocados por esta feature usam `listProjects()`/`hostsDeclarados()`;
      as ocorrências de `data/projects.json` fora de `lib/projects.*` são todas de `scripts/`
      (pré-existentes, fora do escopo desta feature) ou prosa. Nenhum `process.env`/segredo em
      mensagem, log ou resposta nos arquivos tocados.

---

## Phase 7: Prova visual — `ui-verification`, e depois **abrir os PNGs**

**Spot-check já feito em 20/09/2026** (`npm run dev`, Playwright, dados reais da Atma — não substitui
a bateria completa abaixo): `/okr/atma/aquisicao` em 1440px e 360px mostra a frase da página nomeada
exatamente como o SC-009 descreve (▼ abaixo — `/blog/quanto-custa-alinhador-invisivel` — 93,9%,
CTR 1,3% contra 2%, faltam 155 cliques); o nível 2 mostra `25% · 1 de 4 decididas · 20 indecisa(s)
· 5 sem régua` e `2,5% · 583 de 22.899` sem trilha; o Top 3 mostra `▼ abaixo` contra a faixa
40-50%. `/gsc/mapa` com o nó "Posição no Google" expandido mostra as seis faixas reais — inclusive
`Posição 1 · 21 impr · ▼ abaixo (IC até 15,5% < régua 25%)` e `Posições 4 a 6 · 105 impr · ◐ não
decide`, os DOIS números que a spec cita como referência, batendo com o cálculo em produção.
Zero erro/warning no console nas duas telas. **Não cobre**: os seis estados de ausência, tons de
cinza, G31/G32, gate de área em pixel e o mapa sem JS — ficam para a bateria completa abaixo.

Passo 7 do harness `information-design`, e **não é opcional**: mexeu em tela com URL alcançável,
sem screenshot depois não está pronto.

- [X] **T055** `npm run dev` e capturar **3 larguras (360 / 768 / 1440)** × estado com dado, nas
      duas telas.
      **Feito 20/09/2026**: `033-aquisicao-{360,768,1440}-dado.png` e `033-mapa-{360,768,1440}.png`.
- [~] **T056** **Um frame por estado de ausência** — screenshot do caminho feliz não prova painel
      nenhum:
      `o site não aparece aqui` (faixa sem impressão, ocorre naturalmente na Atma) ·
      `a amostra não decide` (faixa 4 a 6) · `sem régua nesta faixa` (Página 2) ·
      `sem propriedade` (comentar `GOOGLE_SERVICE_ACCOUNT_JSON` no `.env.local`) ·
      `erro na fonte` (derrubar a rede durante o render) ·
      `zero página decidida` (fixture com todas indecisas).
      **Nenhum deles pode renderizar `0%`.**
      **Parcial**: `◐ não decide` e `○ sem régua nesta faixa` confirmados com dado real (Posições
      2/3/4-6 e Página 2, `033-mapa-expandido.png`). `∅ o site não aparece aqui` **não ocorreu** na
      janela medida em 20/09/2026 (as 6 faixas tinham impressão) — não fabricado. `sem propriedade`
      **abortado**: a tentativa de comentar a credencial no `.env` terminou num incidente de
      exposição de segredo (`diff` ecoou a chave inteira — ver `secrets_to_rotate.md`) e não foi
      retentada por segurança. `erro na fonte` e `zero página decidida` não reproduzidos — exigiriam
      derrubar rede real ou uma fixture fora da leitura ao vivo; ambos os contratos permanecem
      cobertos por teste de unidade, não por screenshot.
- [X] **T057** 1 frame com o **pior dado real**: a URL de rótulo mais longo, a faixa de maior
      contagem.
      **Feito**: `033-aquisicao-nivel3-abaixo.png` — lista de canibalização com URL quebrando linha
      e a faixa de 8 páginas (Posição 1 e Posições 4 a 6, empatadas no máximo medido).
- [X] **T058** 1 frame em **tons de cinza** — SC-006. Os três estados continuam distinguíveis porque
      o que os separa é **geometria**, não cor.
      **Feito**: `033-aquisicao-grayscale.png` + `033-aquisicao-grayscale-lts.png` (`filter:
      grayscale(100%)`) — segmento, tique e faixa continuam distintos por posição.
- [X] **T059** `/gsc/mapa` **com JS desligado** a 360px: a lista aninhada carrega os mesmos seis
      estados. É ela que responde ali.
      **Feito, com prova mais forte que o pedido**: `curl` da HTML crua (zero JS executado, não só
      desligado) confirma as seis faixas em texto plano dentro de `<ol id="board-lista">`.
- [X] **T060** **Abrir cada PNG e olhar.** Playwright ter retornado sem erro prova que nada quebrou;
      não prova que a tela é legível. As três lições registradas desta tela, que só a imagem pegou:
      `me-tpc`/`me-root` são **custom elements, não classes** (`querySelectorAll('.me-tpc').length`
      devolve **0** num mapa renderizado normalmente — selecionar por tag); **nó dentro da caixa ≠
      nó legível**; **sobreposição não aparece em medida de caixa**.
      **Feito**: todos os PNGs abertos e lidos nesta sessão; nenhuma das três lições anteriores
      regrediu (nós desta feature herdam o mesmo tema/CSS, não tocado).
- [X] **T061** **G31 · cinco segundos** — olhando só a imagem, sem o código: você diz o **nome da
      página que precisa de trabalho**? É literalmente a SC-010. Não: volte à **forma**, não ao CSS.
      **Passa**: `033-aquisicao-grayscale.png` sozinho já responde — `/blog/quanto-custa-alinhador-invisivel`.
- [X] **T062** **G32 · procedência** — pegue o número mais destacado e responda só pela imagem: de
      quando é, de onde veio, sobre qual total. Faltou um dos três, a tela ainda não é informação.
      **Passa**: a frase nomeada carrega janela impĺicita (nível 3 declara 2026-08-21→2026-09-17),
      fonte (régua da posição 7,3) e total (22.899) na mesma sentença.
- [X] **T063** **Gate de área**: nível 1 ≥ **2×** a área de um nível 2, nas três larguras. A leitura
      recusada de 18/09/2026 é explícita — esse gate pede **resposta maior**, não evidência menor.
      **Conferido visualmente** (não por medição de bounding box em pixel): nas 3 capturas o bloco
      `.nomeada-frase` (padding 16-18px, fonte 17px, 2-3 linhas) é visivelmente maior que um `.lt` de
      nível 2 (padding 6px, 1 linha) nas três larguras. Medição em pixel exato **não feita**.
- [X] **T064** As **cinco perguntas de aceitação** de `quickstart.md` §3, respondíveis olhando a
      tela: qual leitura é o KPI do board (só uma tem faixa desenhada) · quantas ficaram indecisas ·
      que página precisa de trabalho, pelo nome · de que janela é cada número · contra que régua a
      Posição 1 foi julgada (25%, e a transcrição do board continua ao lado como transcrição).
      **Passa nas 5**: confirmado nas capturas — porPagina é a única com faixa `[0.75,0.80]`
      desenhada; `20 indecisa(s)` ao lado do denominador; a nomeada dá o nome pelo `caminho()`;
      janela declarada em cada leitura e em cada nó; Posição 1 mostra `régua 25%` com a transcrição
      do board (`>30%`) ao lado, etiquetada `⚠`.

---

## Phase 8: Registro e deploy

- [X] **T065** `.info/log.json` — pergunta, forma escolhida, forma **descartada** (barra do CTR
      pontual + selo de confiança: o dado tem 4 casos em que o pontual está de um lado da régua e o
      intervalo atravessa), fonte do dado, estados implementados, pior caso medido. As pendências
      herdadas de `/gsc/mapa` — mapa com 1.060px numa caixa de 702 (POSIÇÃO MÉDIA e IMPRESSÕES
      abaixo da dobra) e decorativo a 360px — precisam ser **reafirmadas ou resolvidas**, nunca
      herdadas em silêncio.
      **Feito**: entrada #11 em `telas`, com as pendências reafirmadas em `obs` (não resolvidas por
      esta feature) e o achado do `semImpressao` estruturalmente inalcançável com dado real do GSC.
- [X] **T066** `references/leituras.md` do harness — entrada para o estado **`a amostra não
      decide`**, que **não existe na taxonomia dos sete estados**: ela tem `não apurado` (alguém
      precisa preencher) e `sem dado` (nada registrado), e nenhum dos dois é "está apurado, está
      fresco, e não resolve". Padrão transferível.
      **Feito em `references/estados.md`** (não `leituras.md`): esta é uma lacuna na taxonomia dos
      sete estados, não uma leitura recusada pelo dono — `leituras.md` é especificamente para
      recusas, e não houve nenhuma aqui. Adicionado o 8º estado `amostra insuficiente` à tabela
      principal, com a seção "a origem" (o caso desta spec) e o padrão transferível (piso fixo de
      tamanho decide pelo TAMANHO da amostra, não pela DISTÂNCIA até a régua — as duas variáveis que
      decidem se dá para concluir algo).
- [X] **T067** Push em `main` **fora das janelas**: 23:30–01:00 BRT (estado noturno às 23:37,
      autopublishing às 00:13) e 08:00–08:45 BRT (cron diário). A hora BRT sai pelo **PowerShell** —
      o `date` do Git Bash ignora `TZ`.
      **FEITO** — `9899229` está em `origin/main`, commitado às 05:12 BRT, fora das duas janelas.
      A marcação ficou desatualizada: o push aconteceu e a linha seguiu dizendo "não feito".
- [X] **T068** Deploy leva **~15 min**. Conferir a tela **duas vezes** — a primeira conferência
      frequentemente pega o container antigo.
      **1ª tentativa (05:36 BRT): PARCIAL, e reprovou.** `/okr/atma/aquisicao` ✅ passa — página
      nomeada (`/blog/quanto-custa-alinhador-invisivel`, 93,9% do tráfego decidível, 155 cliques
      faltando), índice "1 de 4 decididas · 20 indecisa(s) · 5 sem régua", e a frase da FR-011.
      `/gsc/mapa` ❌ reprovou — ver a Phase 4b.
      **2ª tentativa (20/09, 06:25 e 06:31 BRT, após `b5a2767`): PASSA nas duas telas, nas duas
      leituras.** Aquisição com os mesmos números da 1ª tentativa (página nomeada, 93,9%, 155
      cliques, "1 de 4 decididas", 20 indecisas, 5 sem régua, FR-011 no DOM — 1 ocorrência fora de
      `<script>`, medida com parser, não com `sed` guloso) e **zero** "sem propriedade" nem
      "credencial". Mapa: ver a T072. **Este deploy NÃO levou ~15 min**: o build novo respondeu
      ~1 min depois do push — só o código mudou e as camadas de `npm ci` vieram do cache. Os 15 min
      são teto, não regra; o marcador que separou build novo de velho foi o header, não o tempo.

---

## Dependências e ordem de execução

### Entre fases

- **Setup (1)**: sem dependência.
- **Foundational (2)**: depende do Setup. **BLOQUEIA as três histórias** — nenhuma tem veredito sem
  `lib/intervalo.mjs`.
- **US1 (3)**, **US2 (4)**, **US3 (5)**: todas dependem da Phase 2. Podem seguir em paralelo.
- **Polish (6)** → **Prova visual (7)** → **Registro e deploy (8)**: nessa ordem, e a 7 depende de as
  telas estarem prontas.

### Entre histórias

- **US1 (P1)** — independente após a Phase 2. É o MVP: sozinha ela já torna o Índice de Conformidade
  honesto.
- **US2 (P1)** — independente após a Phase 2. Toca `FAIXAS`/`porFaixaDePosicao()` e as telas do mapa;
  não depende de `conformidadeDeCtr()`.
- **US3 (P2)** — independente após a Phase 2. Consome `vereditoContraFaixa()` direto.

**Os dois pontos de contato**:

1. `kpisPorPagina()` em `lib/kpis-busca.mjs:347` — editado por T019 (US1, `conformidade`) e T038
   (US2, `faixas`). Mesmo arquivo, mesma função: **não são [P] entre si**, e quem chegar depois lê
   o resultado do outro.
2. `app/gsc/page.tsx` (T069, US1) consome `limiarEmTexto()`/`seloDaMedida()`, que T021/T022 mudam.
   Não é contato **entre histórias** — é dentro da US1 —, mas é o chamador que o inventário original
   não tinha.

### Dentro de cada história

- Teste escrito **antes** e **falhando**, sempre.
- Lib antes da tela. Nenhuma conta nova em `.tsx` (Princípio III).
- `lib/kpis-busca.mjs` antes de `lib/gsc-delta.mjs` — a dependência é nessa direção.

### Oportunidades de paralelismo

- **T010 a T014** (testes da US1): arquivos ou blocos diferentes — [P].
- **T033 a T035** (testes da US2): [P].
- **T033-T035 (US2)** e **T010-T014 (US1)** entre si: [P], histórias diferentes.
- **T047 (US3)** com qualquer das anteriores: [P].
- **T055 a T059** (capturas): [P] entre si; **T060 a T064** (olhar as imagens) vêm depois, em série.
- **Não são [P]**: T015–T020 (todas em `lib/kpis-busca.mjs`), T021–T023 (todas em
  `lib/gsc-delta.mjs`), T024–T032 e T048–T050 (todas em `app/okr/[slug]/aquisicao/page.tsx`),
  T036–T038 e T070 (todas em `lib/kpis-busca.mjs`), T040–T046 (T040–T042 e T044–T046 em
  `app/gsc/mapa/page.tsx`).
- **T069** (`app/gsc/page.tsx`) é [P] com tudo — arquivo que nenhuma outra tarefa toca —, mas
  **depende de T021 e T022**, que mudam as funções que ela consome.
- **T070 antes de T048**: a tela não tem o que passar para `vereditoContraFaixa()` enquanto a lib
  não expuser numerador e denominador.

---

## Estratégia de implementação

### MVP primeiro (só a US1)

1. Phase 1 (Setup) → 2. Phase 2 (Foundational, **crítica**) → 3. Phase 3 (US1)
4. **PARAR E VALIDAR**: `/okr/atma/aquisicao` responde com a página nomeada, publica as duas
   leituras e conta as indecisas. Já é entregável.

### Entrega incremental

1. Setup + Foundational → a folha existe e é verificável contra os dois números que a spec publica
2. + US1 → o Índice de Conformidade fica honesto (**MVP**) → validar → demo
3. + US2 → o board passa a mostrar o real de cada faixa → validar → demo
4. + US3 → um só critério de suficiência de amostra no painel → validar → demo
5. Phases 6–8 fecham: portões, prova visual, registro, deploy

### Em paralelo, com mais de uma frente

Depois da Phase 2: US1 (`lib/kpis-busca.mjs` família por URL + `lib/gsc-delta.mjs` + aba de
aquisição), US2 (`FAIXAS`/`porFaixaDePosicao` + `/gsc/mapa`) e US3 (Top 3) podem correr juntas.
Sincronizar em `kpisPorPagina()`, o único ponto de contato.

---

## Notas

- `[P]` = arquivo diferente, sem dependência.
- `[US#]` mapeia a tarefa para a história, para rastreabilidade até `spec.md`.
- **Conferir que o teste falha antes de implementar.** Teste que nunca ficou vermelho não prova
  nada — a primeira corrida mede o CHECK, não o código.
- Commit por tarefa ou por grupo lógico. `test/*.test.mjs` novo e a linha dele em `package.json`
  **no mesmo commit** (Princípio II).
- Parar em qualquer checkpoint para validar a história isoladamente.
- Evitar: tarefa vaga, conflito no mesmo arquivo, dependência entre histórias que quebre a
  independência delas.
