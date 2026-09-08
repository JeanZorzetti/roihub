# Tasks: Medidores de Entrega — os Core Web Vitals de campo da Atma

**Feature**: 023 | **Branch**: `023-medidores-de-entrega` | **Data**: 2026-09-07

**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/crux-mjs.md](./contracts/crux-mjs.md) ·
[contracts/crux-fonte.md](./contracts/crux-fonte.md) · [quickstart.md](./quickstart.md)

**Testes**: SIM, e não por gosto — o Princípio II do repo exige `node --test` registrado à mão, e
o Princípio III manda a regra cara nascer em `.mjs` puro justamente para ser testável **sem gastar
uma chamada** à fonte. `test/crux.test.mjs` é obrigatório e entra na lista do `package.json` **no
mesmo commit** em que nasce (`test/validade.test.mjs` reprova se esquecermos).

**Organização**: por user story, para cada uma ser entregável e verificável sozinha.

> **Estado da execução (07/09/2026).** Todo o código, os testes e a ligação na tela estão
> entregues e verdes (`npm test` 760/760, `tsc --noEmit` limpo). **T001 e T002 bloqueiam o
> resto**: a `CRUX_API_KEY` não existe no `.env` e a Chrome UX Report API não está habilitada no
> Google Cloud — sem elas a fonte não pode ser medida, e os quatro medidores exibem, corretamente,
> `CRUX_API_KEY ausente`. `[x]` = feito, `[~]` = verificado só até onde a ausência da chave deixa.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência)
- **[Story]**: a que user story a tarefa pertence
- Todo caminho de arquivo é literal e relativo à raiz do repo

## Caminhos desta feature

Aplicação web única (App Router + `lib/`). **Nenhum diretório novo, nenhuma rota nova, nenhuma
tabela, nenhum cron, nenhuma dependência.**

```text
lib/crux.mjs                       NOVO    puro
lib/crux.ts                        NOVO    borda
test/crux.test.mjs                 NOVO    registrado em package.json
lib/ficha.mjs                      tocado  montarN5() propaga rotuloBuraco (D6)
lib/ficha-dados.ts                 tocado  disponiveisN5 recebe os 4 vitais
app/okr/[slug]/aquisicao/page.tsx  tocado  Pass Rate (US3)
package.json / .env.example        tocado
```

---

## Phase 1: Setup — a chave e a fonte, antes de qualquer código de tradução

**Purpose**: existir credencial e existir **fato medido** sobre o que a fonte devolve. A T002 é a
lição que a 022 pagou com a quota da URL Inspection: número de documentação não é número medido.

- [ ] **T001** [P] Habilitar a **Chrome UX Report API** no Google Cloud e criar uma **chave de API
  simples** (não é service account, não reusa a do Search Console). Pôr `CRUX_API_KEY=<chave>` no
  `.env` local e acrescentar ao `.env.example` o bloco **com a variável VAZIA**, no texto de
  [contracts/crux-fonte.md](./contracts/crux-fonte.md) §`.env.example` — valor real nunca entra
  neste arquivo (Princípio V).

- [ ] **T002** Rodar o **Passo 1 do [quickstart](./quickstart.md)** contra a origem da Atma e
  contra `/blog/quanto-custa-alinhador-invisivel`, e **anotar como fato medido** (vai para o
  handoff): (a) o **corpo real do `404`**, para confirmar que ele é mesmo "sem amostra" e não outra
  condição; (b) o `collectionPeriod` que a fonte devolve; (c) se
  `experimental_time_to_first_byte` veio; (d) se há `urlNormalizationDetails` — normalização
  silenciosa mediria outra página; (e) a quota real da chave, e se é por minuto, por dia ou as
  duas. **Bloqueia a T007**: se o `404` significar outra coisa, a tradução em `lib/crux.ts` muda.

- [x] **T003** Criar `lib/crux.mjs` com **apenas** `VITAIS` (data-model §1: `id`, `chaveCrux`,
  `limite`, `ideal`, `unidade` — `2500`/`200`/`0.1`/`600`, `ideal: 300` só no TTFB, `unidade: null`
  no CLS) e `SLUGS_DE_CAMPO = ["atma"]` (§8). Nada de `fetch`, `process.env` ou relógio neste
  arquivo, em tarefa nenhuma.

- [x] **T004** Criar `test/crux.test.mjs` com o teste que **amarra as duas listas** —
  `VITAIS.map(v => v.id)` é subconjunto de `MEDIDORES.D2` (`lib/ficha.mjs:153`) — **e** registrar
  `test/crux.test.mjs` na string `"test"` de `package.json:9`, **no mesmo commit** (Princípio II).
  Rodar `npm test` inteiro e ver verde antes de seguir.

**Checkpoint**: `npm test` verde com o arquivo novo na lista, e a fonte já respondeu de verdade.

---

## Phase 2: Foundational — a leitura e o encanamento (BLOQUEIA todas as stories)

**Purpose**: os três estados da fonte e o caminho que leva uma célula até a ficha. Nada aqui exibe
número; tudo aqui é pré-requisito de US1 e US3.

**⚠️ Nenhuma user story começa antes desta fase fechar.**

- [x] **T005** [P] `dataCrux(d)` em `lib/crux.mjs` — `{year, month, day}` (**`month` 1-based**) para
  `YYYY-MM-DD`; campo ausente ou não finito devolve **`null`**, nunca `"NaN-NaN-NaN"`. Casos no
  `test/crux.test.mjs`: uma data válida e uma inválida. Função separada de propósito: misturar essa
  base com a do `Date` do JS é o erro de um mês que ninguém vê olhando a tela.

- [x] **T006** `medirRecord(record)` em `lib/crux.mjs` — devolve `Map<chaveCrux, Medida>` com
  `vital`, `p75`, `janela`, `dispositivo: "todos"`, `experimental`. **Sem `veredito`** (é US2).
  Regras: `p75` string (`"0.08"`) normaliza para número; `p75` ausente, `null` ou não finito
  **não cria entrada** (é daí que a FR-004 sai por construção); `experimental` =
  `chaveCrux.startsWith("experimental_")` (D5), nunca uma lista fixa. Testes: os quatro presentes;
  **sem `experimental_time_to_first_byte` os outros três saem intactos** (FR-008); `p75` string
  normalizado; `p75` inválido ausente do `Map`.

- [x] **T007** [P] Criar `lib/crux.ts` — a borda, no contrato de
  [crux-fonte.md](./contracts/crux-fonte.md): `cruxOn()` (gêmeo de `dbOn()`, `CRUX_API_KEY`
  existente e não só espaço em branco) e `lerCampo(alvo)` devolvendo os quatro estados. Tradução de
  status: `200` com `record` → `"record"`; **`404` → `"sem-amostra"`**; `401/403/429/5xx`, timeout,
  rede, JSON inválido e `200` sem `record` → `"falhou"`; chave ausente → `"sem-chave"` **sem
  `fetch` nenhum**. `AbortSignal.timeout(...)` explícito. `erro` **truncado em 60 caracteres**
  (padrão de `app/api/gsc-serie/route.ts:60`). **`lerCampo()` nunca lança** — nem em `JSON.parse`,
  nem em `AbortError` (FR-012). A chave vai na query string e **em lugar nenhum mais**: nenhum
  `console.log` do corpo, nenhum valor/prefixo/comprimento em mensagem (Princípio V).

- [x] **T008** `montarN5()` em `lib/ficha.mjs:527-542` propaga `rotuloBuraco` da célula disponível
  para a célula não apurada (D6, ~3 linhas) — `estadoDeApurado()` (`lib/ficha.mjs:25-28`) hoje
  descarta o campo. **Não** inferir por regex sobre o texto do motivo: acoplamento por string que
  qualquer revisão de UX writing quebra em silêncio. Caso novo em `test/ficha.test.mjs`: um
  disponível com `{naoApurado, rotuloBuraco: "falhou-agora"}` chega ao N5 **com** o rótulo, e um sem
  o campo chega **sem**.

- [x] **T009** Alargar o tipo de `disponiveisN5` em `lib/ficha-dados.ts:187` e o JSDoc de
  `montarN5()` (`lib/ficha.mjs:525`) para
  `{ valor: number | string; fonte?: string } | { naoApurado: string; fonte?: string; rotuloBuraco?: "falhou-agora" }`
  — hoje o `valor` é `number` e a célula formatada é `string`. `CelulaFicha["apurado"].valor`
  (`lib/ficha-dados.ts:25`) **já** aceita `number | string`; o estreitamento é só deste `Record`.
  **`fonte` também no ramo ausente** — ver a nota da T012 sobre `consultar`.
  **Zero mudança** em `combinar()`, `validarKrs()` ou em componente de tela (D4).

- [x] **T009a** 🔴 **Sem esta tarefa a US1 inteira é invisível.** `montarNiveis()`
  (`lib/ficha.mjs:623-624, 663`) acrescenta a família **D2** às células de N5 quando
  `MEDIDORES.D2.some((id) => id in disponiveisN5)` **e** a família escolhida não for ela própria
  (D11). Hoje `escolherFamilia()` (`lib/ficha.mjs:379-407`) **nunca devolve `"D2"`** — nenhum
  perfil declara `familia: "D2"` (`lib/okr.mjs:384-447`) e todos os fallbacks dão D1/D3/D4 — então
  as quatro células seriam computadas e descartadas.

  **A condição é haver medida, não o slug**: `lib/ficha.mjs` é puro e não conhece
  `SLUGS_DE_CAMPO` (Princípio III), e exibir D2 incondicionalmente poria **8 linhas permanentes de
  "não apurado"** nas outras 34 fichas — o ruído com cara de pendência que
  `medidorCabeNoPerfil()` (`lib/ficha.mjs:520-521`) já rejeitou. Acrescentar também as chaves
  novas a `espacosKr["n5:"]` (`lib/ficha.mjs:667`), que é o que torna `n5:lcp` uma chave de KR
  válida de verdade. Casos em `test/ficha.test.mjs`: **com** medida de Entrega o N5 traz as duas
  famílias e `n5:lcp` existe no espaço de KR; **sem** medida, o N5 sai idêntico ao de hoje.

- [x] **T009b** A nota de N5 (FR-002b): dizer **qual família é o gargalo** e que Entrega aparece
  por ser pré-condição — sem ela o leitor vê dois grupos de medidores e não sabe por quê.
  `nivel()` já aceita `nota` (`lib/ficha.mjs:171`), mas o N5 é montado como objeto literal
  (linha 663) e `/metodo` só renderiza `nota` para N3 e N4
  (`app/okr/[slug]/metodo/page.tsx:107,110`) — acrescentar `n.id === "N5"` ali, 1 linha.
  Texto no `.mjs`, nunca na tela (Princípio III).

**Checkpoint**: `npm test` verde; a fonte é legível em três estados, a ficha sabe carregar
`string` e `rotuloBuraco`, **e a família D2 tem como aparecer**. Nenhum medidor mudou na tela
ainda — T009a/T009b são verificáveis sozinhas: com uma medida de Entrega falsa em
`disponiveisN5`, o bloco aparece; sem ela, a ficha sai idêntica.

---

## Phase 3: User Story 1 — Os quatro medidores deixam de mentir por omissão (P1) 🎯 MVP

**Goal**: LCP, INP, CLS e TTFB aparecem na família **D2 — Entrega** do N5 da ficha da Atma com o
valor de campo e a janela da fonte, em vez de "sem coletor nesta requisição". Ausência aparece como
**motivo**, nunca como zero.

**Independent Test**: abrir `/okr/atma/metodo`, descer até N5/D2 e ver os quatro com unidade e
rodapé; forçar cada um dos três estados (quickstart Passo 4) e ver **textos diferentes**, nenhum
`0`, e a ficha inteira de pé.

- [x] **T010** [P] [US1] `formatarValor(vital, p75)` em `lib/crux.mjs` — LCP: `p75/1000`, 1 casa,
  vírgula, sufixo `" s"` (`2437` → `"2,4 s"`); INP e TTFB: arredondado + `" ms"` (`187.4` →
  `"187 ms"`); CLS: 2 casas, vírgula, **sem sufixo** (`0.083` → `"0,08"`). A FR-013 sai da
  **ausência de `unidade`** no vital, não de um `if (id === "cls")` espalhado. Os três casos no
  teste, com o do CLS assertando que a string **não contém `s`**.

- [x] **T011** [US1] `rodape(medida, alvo)` em `lib/crux.mjs` — versão US1, sempre na mesma ordem:
  `p75 de campo · CrUX <inicio>→<fim> · todos os dispositivos` (FR-005, FR-010), mais
  ` · experimental na fonte` quando `experimental` (FR-008). **Janela `null` omite o trecho** —
  nunca datas inventadas. O `alvo` aparece no texto, porque é ele que impede ler a distribuição do
  site inteiro como se fosse a de uma página. Testes: com janela, sem janela, experimental.

- [x] **T012** [US1] `celulasDeVitais(leitura, alvo)` em `lib/crux.mjs` — **sempre devolve as
  quatro chaves** (`lcp`, `inp`, `cls`, `ttfb`), no contrato que `disponiveisN5` já aceita:
  `{valor, fonte}` ou `{naoApurado, rotuloBuraco?}`. Mapa de estados de
  [crux-mjs.md](./contracts/crux-mjs.md): `"record"` → apurada onde há `Medida`, e
  `sem amostra suficiente na fonte para <vital>` onde a métrica faltou; `"sem-amostra"` → as quatro
  com `sem amostra suficiente na fonte de campo para <alvo>` e **sem** `rotuloBuraco`; `"falhou"` →
  as quatro com `CrUX indisponível (<erro>)` **com** `rotuloBuraco: "falhou-agora"`; `"sem-chave"`
  → as quatro com `CRUX_API_KEY ausente`, **só o nome da variável** (FR-011), **sem**
  `rotuloBuraco`.

  ⚠️ **A célula ausente carrega `fonte` também** — corrige a contradição entre o data-model §5
  ("`consultar` é preenchido pela borda de `montarN5()`") e o contrato, que lista só
  `{naoApurado, rotuloBuraco?}`. `montarN5()` repassa `celula.fonte ?? "coleta desta requisição"`
  como `consultar` (`lib/ficha.mjs:538` → `lib/ficha.mjs:27`); sem `fonte`, a célula
  `CRUX_API_KEY ausente` sairia mandando "consultar: coleta desta requisição", que é a instrução
  errada e esvazia a R4. `fonte` = `CrUX API para <alvo>`.

- [x] **T013** [US1] Testes de `celulasDeVitais` em `test/crux.test.mjs`, um por invariante:
  os quatro estados produzem **textos diferentes** (a FR-003 é a distinção, não o código);
  **só `"falhou"` tem `rotuloBuraco`**; `"sem-chave"` não vaza valor, prefixo nem comprimento;
  um `record` com **zero** métricas conhecidas produz **quatro ausências, não um erro**;
  **toda célula ausente tem `fonte` não vazia** (senão a R4 quebra em silêncio ao passar por
  `montarN5()`); e **nenhum caminho produz `valor: 0`** (FR-004/SC-004).

- [x] **T014** [US1] Ligar na ficha: em `lib/ficha-dados.ts`, quando
  `SLUGS_DE_CAMPO.includes(slug)`, chamar `lerCampo({tipo: "origem", valor: p.url})` **uma vez por
  render** e espalhar `celulasDeVitais(leitura, alvo)` dentro de `disponiveisN5` (linha 187).
  **Fora da lista, nem a chamada acontece** (FR-014, D8) — os quatro medidores seguem dizendo "sem
  coletor nesta requisição", que é o que já dizem e é verdade.

  **Sem somar latência em série**: não existe `Promise.all` aproveitável aqui — o de
  `lib/ficha-dados.ts:77` é da agenda e o dado do projeto vem de um `await coletarDoProjeto()`
  sequencial (linha 87). Seguir o padrão que o próprio arquivo já usa para a agenda: **iniciar a
  promise cedo** (antes do `await` da linha 87) e **aguardar tarde**, imediatamente antes de
  compor `disponiveisN5` (linha 187). A ficha é `force-dynamic` e já paga GSC + GA4 + Postgres por
  request; mais um `await` em fila é latência somada à toa. E **um erro dela não pode derrubar a
  ficha** (FR-012).

- [~] **T015** ⚠️ **Parcial** — verificado o estado `sem-chave` na tela (`/okr/atma/metodo`: bloco de Entrega presente, nota do gargalo, 4 medidores com `CRUX_API_KEY ausente`, os outros 4 ainda em "sem coletor"). Os estados `record`/`sem-amostra`/`falhou` dependem da T001.

   [US1] Verificar na tela — quickstart **Passo 2** (`/okr/atma/metodo`: **o bloco de
  Entrega existe**, ao lado da família do gargalo e com a nota explicando as duas; valor com
  unidade, CLS sem `s`, rodapé com p75/janela/dispositivo, os outros 4 medidores de D2
  **continuam** "sem coletor", colapsados no `<details>` de `agruparPorMotivo`) e **Passo 4** (forçar `sem amostra`, chave inválida → falhou agora,
  `CRUX_API_KEY` removida → não configurado; e conferir o que **não** aparece: nenhum `0`, nenhum
  `dentro`/`fora`, e a ficha inteira de pé).

**Checkpoint**: US1 fechada e demonstrável sozinha. A família D2 sai de 8 medidores mudos para 4
falando.

---

## Phase 4: User Story 2 — Passa ou não passa, contra a meta do board (P2)

**Goal**: cada medidor apurado é classificado contra o limite do board, para a leitura não exigir
lembrar cinco números de cabeça.

**Independent Test**: `node --test test/crux.test.mjs` fixa `2500 → dentro` e `2501 → fora`; na
tela, cada apurado termina em `dentro`/`fora` e o TTFB mostra **os dois** limites.

- [x] **T016** [US2] Acrescentar `veredito` a `Medida` em `medirRecord()` (`lib/crux.mjs`):
  `p75 <= vital.limite ? "dentro" : "fora"` (FR-006). Limite **inclusivo**, porque o board diz "≤".
  Testes de borda no `test/crux.test.mjs`: `2500` é `dentro`, `2501` é `fora`. Ausência continua
  sem veredito **por construção** — não existe `Medida` sem `p75` (US2-AC2).

- [x] **T017** [US2] `rodape()` acrescenta o trecho de meta ao fim, na mesma ordem:
  ` · meta ≤ 2,5 s: dentro`. No TTFB, o ideal entra **ao lado** do limite, nunca no lugar:
  ` · meta ≤ 600 ms (ideal < 300 ms): dentro` (FR-007). Testes: um vital comum, o TTFB com os dois
  números, e um `fora`.

- [~] **T018** ⚠️ **Parcial** — as bordas 2500/2501 estão fixadas pelo teste do módulo puro; a classificação na tela depende da T001.

   [US2] Verificar — quickstart **Passo 3**: na tela, cada medidor apurado termina em
  `dentro` ou `fora`; a borda de 2,5 s é provada pelo teste do módulo puro, que roda em
  milissegundos em vez de depender do desempenho do site naquele instante.

**Checkpoint**: US1 + US2 funcionam. A família Entrega responde "a página chega inteira?" em um
olhar.

---

## Phase 5: User Story 3 — O Pass Rate, ou o motivo honesto de não haver um (P3)

**Goal**: a fração das URLs prioritárias com "Bom" contra a meta de 90% — **ou**, quando o site não
tem tráfego distribuído, a explicação de por que ela não é apurável. Nunca `100%` de uma amostra de
um.

**Independent Test**: `comDado === 1` devolve `motivo` e `fracao: null`; na aba de aquisição da
Atma, a frase aparece com o número de URLs consultadas e o de URLs com dado.

- [x] **T019** [US3] `CAP_URLS_PASS_RATE = 10` (constante exportada, para o teste medir o corte sem
  chamar a rede) e `passRate(leiturasPorUrl, consultadas)` em `lib/crux.mjs`, sobre **LCP, INP e
  CLS apenas**

  **Por que 10**: a 021 mediu **8 URLs com impressão em 28 dias** na Atma — um cap de 10 cobre o
  site inteiro com folga, então nesta corrida o cap **não corta nada** e o `motivo` não precisa
  falar de URLs não consultadas. O número existe para o dia em que o site crescer, não para hoje;
  subir só depois que a quota da T002 for medida. — o TTFB é experimental e não entra na definição de "Bom" do board. `comDado` =
  leituras `"record"` com os três medidos; `passam` = as que têm os três `dentro`;
  **`comDado < 2` ⇒ `fracao: null` + `motivo`**; `comDado >= 2` ⇒ `fracao = passam / comDado` +
  `motivo: null`. O `motivo` cita `comDado` **e** `consultadas`, não só a ausência (SC-006).

- [x] **T020** [US3] Testes de `passRate` em `test/crux.test.mjs`: `comDado === 0`;
  `comDado === 1` (**devolve `motivo`, nunca `1`** — US3-AC2, o proibido nominalmente);
  `comDado >= 2` com a fração correta; a **invariante do XOR** (`fracao` e `motivo` nunca ambos
  preenchidos, nunca ambos `null`); e uma URL cujo record só tem TTFB **não** conta como `comDado`.

- [x] **T021** [US3] Pass Rate em `app/okr/[slug]/aquisicao/page.tsx`, ao lado dos KPIs de board da
  021/022 (D7 — **não** entra em `MEDIDORES.D2`, que é espaço de chaves de `n5:` casado por
  igualdade exata e misturaria os dois escopos que a spec proíbe misturar). As URLs saem de
  `porUrl(linhasBusca)` (`lib/kpis-busca.mjs:43`), que a página **já tem em mãos**, **ordenadas
  por impressão decrescente** e cortadas em `CAP_URLS_PASS_RATE` — é isso que "URL prioritária" do
  board significa aqui, e sem a ordenação o corte sortearia o denominador. As que ficarem de fora
  entram **no texto como "não consultadas"**, nunca como reprovadas (D7). Chamadas **em série**,
  pelo mesmo motivo de
  `app/api/gsc-serie/route.ts:36-38` — um punhado de POSTs simultâneos com a mesma chave é o
  caminho mais curto para o `429`. Só quando `SLUGS_DE_CAMPO.includes(slug)`. `revalidate = 3600`
  já está na página (linha 19); a falha segue o idioma de `lerApuracao()` (linhas 47-54) e **não
  derruba a aba**.

- [~] **T022** ⚠️ **Parcial** — verificado `comDado < 2` em `/okr/atma/aquisicao`: "das 8 URLs consultadas, 0 têm dado de campo", nunca 100%. O ramo `comDado >= 2` depende da T001.

   [US3] Verificar — quickstart **Passo 5** (`/okr/atma/aquisicao`): com `comDado < 2`,
  a frase explicando e **nunca `100%`**; com `comDado >= 2`, a fração contra 90% **com o
  denominador declarado**; sempre quantas URLs foram consultadas e quantas responderam; nunca as
  duas coisas ao mesmo tempo nem nenhuma das duas.

**Checkpoint**: as três stories funcionam de forma independente.

---

## Phase 6: Polish & verificação de escopo

- [x] **T023** Quickstart **Passo 6** — abrir a ficha de um projeto **fora** de `SLUGS_DE_CAMPO`
  (`/okr/goiania/metodo`): **nenhum bloco de Entrega aparece** (a T009a condiciona à presença de
  medida, não ao slug — FR-002a), o N5 sai idêntico ao de antes desta feature, e a aba Network
  mostra **zero** POST para `chromeuxreport.googleapis.com`. Escopo que só existe no texto não é
  escopo (FR-014), e nota de rodapé permanente em ficha alheia é ruído, não honestidade.

- [~] **T024** ⚠️ **Parcial** — a checagem de AUSÊNCIA da SC-003 passa (nenhum número de Lighthouse/PageSpeed em tela). O placar 11→16 depende da T001: hoje as 5 medidas estão **explicadas**, não exibidas.

   Quickstart **Passo 7** — o placar do board: **11 → 16 de 28**, com o Pass Rate
  contando como **explicado** se for o caso. E a checagem de **ausência** da SC-003: nenhum número
  de Lighthouse ou PageSpeed em tela nenhuma — `lighthouse_local_windows_onedrive_unreliable`
  (±30% nesta máquina) e `goiania_lcp_root_causes` (uma leitura não decide nada) já pagaram por
  isso.

- [ ] **T025** Registrar no handoff os **fatos medidos** da T002 que a spec deixou em aberto: se o
  TTFB experimental existe para a Atma, o `collectionPeriod` real, a quota medida da chave e se
  houve normalização de URL. Número de documentação não é número medido — é o que a 022 ensinou.

- [ ] **T026** `npm test` **inteiro** verde, commit e push. **Fora das janelas proibidas**
  (23:30–01:00 e 08:00–08:45 BRT, Princípio IV). Push é deploy e o roihub demora ~15 min —
  conferir a tela **duas vezes** antes de concluir que não subiu.

---

## Dependências & ordem de execução

### Entre fases

- **Setup (1)**: começa imediatamente. **T002 bloqueia T007** — a tradução de status depende do que
  o `404` de fato é.
- **Foundational (2)**: depende do Setup. **BLOQUEIA todas as stories.**
- **US1 (3)**: depois da fase 2. É o MVP. **T009a bloqueia a US1 inteira** — sem ela as células
  são computadas e descartadas, e o Passo 2 do quickstart não tem o que conferir. T009a e T009b
  não dependem de nada da CrUX: podem ser feitas e verificadas **antes** de a fonte existir.
- **US2 (4)**: depois da fase 2. Toca `medirRecord`/`rodape`, que a US1 criou — na prática vem
  depois da US1, e sem ela a US1 já entrega valor (números sem classificação).
- **US3 (5)**: depois da fase 2. **Independente da US1 e da US2** — outra tela, outro alvo, outra
  função. Pode ser feita em paralelo por outra pessoa.
- **Polish (6)**: depois das stories desejadas.

### Dentro de cada story

- Módulo puro **antes** da borda que o consome; teste no **mesmo commit** da função.
- `formatarValor` → `rodape` → `celulasDeVitais` → ligação em `ficha-dados.ts` (cada uma consome a
  anterior).
- `passRate` → tela de aquisição.

### Paralelismo real

- **T001** e **T003** são arquivos diferentes.
- **T005** (`dataCrux`) e **T007** (`lib/crux.ts`) são arquivos diferentes.
- **T010** é a única função sem dependência dentro da US1.
- **US3 inteira** (T019–T022) não toca nenhum arquivo da US1 exceto `lib/crux.mjs` — se duas
  pessoas trabalharem ao mesmo tempo, é só esse arquivo que precisa de coordenação.

---

## Estratégia de entrega

**MVP** = Fases 1 + 2 + 3. Nesse ponto a família D2 da Atma já tem quatro números de campo e três
estados honestos, e a promessa que a tela faz desde a 011 passa a ser cumprida. Parar aqui é uma
entrega válida.

**Incremento 2** = US2. Sai da mesma leitura, sem chamada nova.

**Incremento 3** = US3. Provavelmente entrega **uma frase**, e isso é o resultado correto: a Atma
tem 8 URLs com impressão em 28 dias e uma concentra 13.262 delas.

---

## Notas

- `[P]` = arquivo diferente, sem dependência.
- **Nenhuma tarefa cria tabela, migração, rota, cron, workflow ou dependência.** Se alguma parecer
  precisar, a decisão D1 foi contrariada — reabrir a pesquisa, não improvisar.
- **A ficha nunca pode virar erro por causa de um medidor** (FR-012). Vale para exceção **e para
  lentidão** — daí o timeout explícito da T007.
- Commit por tarefa ou por grupo lógico; teste **sempre** no mesmo commit da função (Princípio II).
