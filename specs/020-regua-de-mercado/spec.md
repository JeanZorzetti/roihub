# Feature Specification: 020 — a régua de mercado da Atma

**Feature Branch**: `020-regua-de-mercado`

**Created**: 2026-09-06

**Status**: Draft

**Input**: User description: "020 régua de mercado da Atma: seis benchmarks pesquisados com fonte
clicável para os degraus que a Atma realmente tem, e apagar a tabela morta `market_benchmarks` da
base da Atma. Escopo definido em `handoff/handoff-a-ficha-chamava-de-buraco-o-que-ja-estava-medido.md`
§5 (Régua de mercado) e §6. Fecha quando as seis réguas têm fonte clicável."

---

## Contexto medido — o que já foi conferido antes de escrever esta spec

Três premissas do handoff foram checadas na fonte em 06/09/2026. **Duas confirmaram, uma não.**

| premissa do handoff | verificação | resultado |
|---|---|---|
| `market_benchmarks` tem 12 linhas com `source: "A definir - aguardando pesquisa de mercado"` | `SELECT *` na base da Atma | ✅ **confirmado**, 12/12 linhas, todos os valores redondos (3,50 · 8,00 · 5,00 · 40,00 · 70,00 · 35,00 · 15,00 · 1,20 · 14,00 · 55,00 · 800,00) |
| metade mede degrau que a Atma não tem | idem | ✅ **confirmado**: `cadastro_to_agendamento`, `agendamento_to_comparecimento`, `comparecimento_to_conversao`, e ainda `taxa_cancelamento`, `tempo_medio_funil`, `bounce_rate`, `cac_medio` — 7 de 12 |
| a tabela é morta / "não é lida" | `grep` no roihub **e no app da Atma** | ❌ **FALSO fora do roihub** |

**A correção que muda o escopo desta spec.** A tabela não é morta. O app da Atma tem
`GET/PUT/POST /api/market-benchmarks` (`backend/src/routes/marketBenchmarks.js`, montada em
`server.js:305`) e uma tela de admin inteira em `/admin/benchmark-mercado` que:

1. busca as 12 linhas sem fonte,
2. busca o funil real da Atma (`/api/conversion-funnel/metrics`),
3. e chama `generateComparisons()` — **rende um veredito comparando o número real contra o número
   inventado.**

Ou seja: *"benchmark sem fonte é pior que benchmark nenhum, produz veredito com aparência de rigor"*
não é um risco a evitar — **já está no ar**, numa tela que ninguém desta spec tinha aberto. E um
`DELETE FROM market_benchmarks` cru não conserta isso: esvazia a tela e deixa o consumidor quebrado.

> É o mesmo defeito que gerou esta família de specs, aplicado a nós mesmos: a 018 escreveu
> *"não é lida"* sem consultar quem lê. Buraco de leitura se disfarça de buraco de medição, e
> afirmação sobre o dado escrita sem consultar o dado é exatamente o que a 018 existiu para matar.

**Estado da régua no roihub.** `REGUA.D` em `lib/benchmark.mjs` está **vazia** — zero linhas. A Atma
é a única cadeia apurada do portfólio inteiro e é a única sem régua nenhuma. Hoje
`distanciaDoMercado()` roda, percorre os três degraus e devolve `sem régua` nos três; a tela não
mostra comparação com mercado em lugar nenhum.

---

## Clarifications

### Session 2026-09-06

- Q: FR-002 (URL clicável) alcança as 7 linhas legadas dos perfis A/B/C da spec 015? → A: Não — vale
  só para linhas novas (perfil D). A dívida das 7 fica registrada para uma spec futura.
- Q: O que acontece com as 12 linhas de `market_benchmarks` e com a tela `/admin/benchmark-mercado`?
  → A: **Substituir**, não esvaziar — as 12 sem fonte saem e as linhas pesquisadas (com URL e data)
  entram na mesma tabela. A tela do admin volta a servir, e Atma e roihub passam a citar a MESMA
  régua.
- Q: Onde mora a recusa específica de um degrau sem fonte? → A: **Entrada própria na tabela `REGUA`**,
  com o motivo daquele degrau e as fontes descartadas. A recusa vira dado — visível na tela e legível
  por quem herdar a pesquisa — em vez de um motivo genérico igual para todos.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - O degrau ruim vira degrau ruim *comparado a quê* (Priority: P1)

O dono abre `/okr/atma`, lê a cadeia (`52 → 21 → 4 → 0`) e vê que `respondeu→orçamento` é 19,05%.
Hoje ele não tem como saber se 19,05% é um desastre ou é o normal do setor: a ficha diz **que** o
degrau é o pior da cadeia, e não diz **do tamanho de quê**. Ao fim desta história, cada degrau da
cadeia de Conversão ou carrega uma faixa de mercado com fonte clicável ao lado, ou diz em voz alta
que nenhuma fonte publica aquele degrau — e o leitor sabe qual dos dois está lendo.

**Why this priority**: é a única história cujo motor **já existe e já está ligado à tela**
(`distanciaDoMercado()` → `app/okr/[slug]/page.tsx`). O que falta é a tabela, que está vazia. Maior
valor pelo menor caminho, e entrega sozinha.

**Independent Test**: abrir `/okr/atma` e, para cada um dos três degraus da cadeia, apontar ou uma
faixa com link de fonte ou um motivo escrito de ausência. Nenhum degrau pode ficar em branco.

**Acceptance Scenarios**:

1. **Given** um degrau da cadeia de Conversão com os dois lados apurados e uma linha de régua
   pesquisada, **When** o dono abre `/okr/atma`, **Then** a tela mostra a faixa do mercado, o rótulo
   (`abaixo do piso` / `na média` / `acima da média` / `elite`) e uma **fonte clicável**.
2. **Given** um degrau para o qual a pesquisa **não** achou fonte publicada, **When** o dono abre a
   ficha, **Then** a tela diz `sem régua` **com o motivo registrado da recusa** — nunca uma faixa
   estimada, nunca silêncio.
3. **Given** um degrau com régua mas com uma das pontas não apurada, **When** o dono abre a ficha,
   **Then** a régua cala e devolve para a §7.2 (`apurar antes de melhorar`), preservando o
   comportamento que a 015 já garante.

---

### User Story 2 - Trocar o veredito falso pelo verdadeiro, na tela que já está no ar (Priority: P2)

Alguém abre `/admin/benchmark-mercado` no admin da Atma e lê uma tabela comparando o desempenho real
contra doze números que ninguém pesquisou. A tela tem a mesma aparência de rigor de uma tela certa.
Ao fim desta história a tela continua existindo e passa a servir: **as mesmas linhas pesquisadas pela
US1 substituem as 12 inventadas**, e a Atma e o roihub citam a mesma régua, com a mesma URL.

**Why this priority**: é dano ativo, não dívida. Fica abaixo da US1 porque **depende dela** (não há o
que escrever antes de pesquisar) e porque **atravessa a fronteira do repositório** — mexe no app da
Atma (`C:\dev\atma`), com deploy e testes próprios.

**Independent Test**: abrir `/admin/benchmark-mercado` e confirmar que nenhuma linha exibida tem
`source` começando com "A definir", que toda linha exibida abre numa URL, e que a tela não quebra.

**Acceptance Scenarios**:

1. **Given** as 12 linhas sem fonte, **When** a 020 é aplicada, **Then** nenhuma consulta a
   `market_benchmarks` devolve linha com `source` não verificável.
2. **Given** as linhas pesquisadas na US1, **When** a 020 é aplicada, **Then** elas estão gravadas em
   `market_benchmarks` com a **mesma faixa, mesma URL e mesma data de acesso** que o roihub usa —
   duas superfícies, uma régua.
3. **Given** a tela `/admin/benchmark-mercado` depois da mudança, **When** alguém a abre, **Then**
   ela renderiza as comparações contra as linhas reais e não quebra (nem 500, nem tabela vazia sem
   explicação).
4. **Given** os 7 de 12 degraus que a Atma **não possui** (`agendamento`, `comparecimento`,
   `avaliação inicial`, CAC, bounce, tempo de funil, cancelamento), **When** a 020 é aplicada,
   **Then** eles não voltam por nenhuma porta — degrau que a cadeia não tem não ganha régua.
5. **Given** alguém tentando gravar uma linha nova sem fonte pela rota de escrita
   (`PUT`/`POST bulk-update`), **When** a gravação é tentada, **Then** ela é recusada — a tabela não
   pode voltar ao estado que esta spec apagou.

---

### User Story 3 - A pesquisa dos degraus de aquisição, sem a tela (Priority: P3)

Os três degraus de aquisição — `impressão→clique`, `clique→form_start`, `form_start→lead` — são
**pesquisados e recebem veredito escrito** nesta spec, mas **não são exibidos** por ela. Quem herdar
a spec 022 encontra a pesquisa pronta e só precisa do encanamento.

**Why this priority**: a pesquisa é barata e a exibição é cara. Nenhum destes três degraus existe
como objeto `taxa` no código — `/okr/atma/aquisicao` soma GSC e GA4 à mão, e `distanciaDoMercado()`
só percorre `ficha.taxas` (a cadeia de Conversão). Ligar régua ali é encanamento novo, e misturar
isso com a pesquisa repetiria a confusão que a 018/019 separaram de propósito.

⚠️ **E um dos três já se sabe que não pode existir.** `clique→form_start` tem numerador GA4 (todos os
canais) e denominador GSC (só busca orgânica) — **exatamente o defeito que a FR-029 da 019 proibiu**
ao recusar a taxa gêmea `cliques→sessões` (599 cliques contra 1.140 sessões na época). Uma taxa assim
mede a diferença entre os instrumentos, não o negócio. Esta spec não reintroduz pela régua a taxa que
a 019 baniu do funil — ela **registra a recusa por escrito**, para que a 022 não a tente de novo.

**Independent Test**: abrir o documento de pesquisa e achar os três vereditos de aquisição, cada um
com fonte clicável ou motivo de recusa. Nenhuma tela muda.

**Acceptance Scenarios**:

1. **Given** `impressão→clique` (as duas pontas no GSC, mesmo instrumento, mesma janela), **When** a
   pesquisa é feita, **Then** o veredito registra faixa de CTR orgânico do setor com fonte clicável,
   ou a recusa com motivo.
2. **Given** `clique→form_start`, **When** a pesquisa é feita, **Then** o veredito é **recusa**, com
   o motivo (instrumentos diferentes, FR-029 da 019) — mesmo que exista fonte publicada para um
   degrau parecido.
3. **Given** `form_start→lead` na janela da época (o único recorte em que GA4 cobre a mesma janela do
   banco), **When** a pesquisa é feita, **Then** ou existe faixa com fonte, ou a recusa fica escrita.
4. **Given** os três vereditos, **When** a 020 fecha, **Then** nenhuma tela de aquisição mudou —
   a exibição é a 022.

---

### Edge Cases

- **A pesquisa não acha fonte para um degrau.** É o caso esperado, não a exceção: o comentário atual
  de `lib/benchmark.mjs` afirma que `lead→respondeu`, `respondeu→orçamento` e `orçamento→tratamento`
  não têm publicador. A ausência tem que virar estado visível com motivo, nunca uma faixa estimada
  para completar a contagem de seis.
- **A fonte existe mas mede outra coisa.** Já aconteceu duas vezes nesta família: InfluxMD mede
  *agendamento* (degrau que a Atma não tem) e a manchete de case acceptance de "50-60%" mistura
  paciente novo com base existente. Fonte que mede degrau vizinho não é fonte deste degrau.
- **A fonte é uma média global sem recorte de aquisição fria.** A régua da Atma é captação fria via
  SEO; misturar carteira existente infla o piso e passa a cobrar de quem capta frio o número de quem
  já tem paciente.
- **O link da fonte morre.** Uma régua cuja fonte deixa de abrir vira exatamente o que esta spec
  apaga. Precisa de data de acesso e de um caminho de re-verificação.
- **Amostra pequena.** `respondeu→orçamento` é 4 de 21 pessoas. Comparar 19,05% contra uma faixa de
  mercado carrega barra de erro grande — a régua compara, e nunca vira meta (R6).
- **Alguém compõe duas faixas.** É o defeito original que gerou a R6 (a projeção de €1,8M por
  multiplicação de percentis). A trava nº 1 do `lib/benchmark.mjs` é teste executável justamente
  porque comentário não segurou.

---

## Requirements *(mandatory)*

### Requisitos funcionais

**Pesquisa e qualidade da fonte**

- **FR-001**: Cada degrau candidato a régua DEVE receber um veredito de pesquisa registrado por
  escrito: **ou** uma linha de faixa com fonte, **ou** uma recusa com o motivo da recusa. Nenhum
  degrau candidato PODE ficar sem veredito.
- **FR-001a**: A recusa DEVE ser **entrada de primeira classe na tabela de réguas**, carregando o
  motivo **daquele** degrau e as fontes que foram consideradas e descartadas, com o porquê. O motivo
  genérico de hoje (`"nenhuma fonte publica este degrau isolado"`, idêntico para todo degrau sem
  linha) NÃO satisfaz este requisito.
- **FR-001b**: A recusa DEVE chegar à tela. Um degrau recusado exibe o motivo específico dele, não um
  espaço em branco nem o texto genérico. *Razão*: recusa que só existe no documento da spec apodrece
  fora do código, e a próxima pessoa refaz a busca que já foi feita.
- **FR-002**: Toda linha de régua **criada por esta spec** (perfil D) DEVE carregar uma **URL
  clicável** verificada, além do nome do veículo. O formato atual (`fonte` como texto solto, ex.:
  `"ChartMogul; Orbix (...)"`) não satisfaz este requisito.
- **FR-002a**: As **7 linhas legadas** dos perfis A, B e C (spec 015) NÃO são alcançadas pela FR-002
  e NÃO PODEM ser removidas nem alteradas por esta spec. A dívida — fonte por nome de veículo, sem
  URL nem data de acesso — DEVE ficar registrada por escrito no repositório, nomeando as 7 linhas,
  para que uma spec futura a resolva. *Razão*: a 020 é sobre a Atma; nenhuma das 7 aparece na ficha
  da Atma, e re-verificá-las multiplicaria a pesquisa por ~2,3 sem mover o leitor desta spec.
- **FR-003**: Toda linha de régua DEVE registrar a **data de acesso** da fonte e o **recorte** que a
  fonte mede (setor, geografia, aquisição fria ou base existente, tamanho da amostra quando
  publicado).
- **FR-004**: Uma fonte que mede um degrau **vizinho** ao da Atma NÃO PODE virar linha desse degrau.
  Se a fonte mede `agendamento` e a Atma não agenda, a linha não existe e a recusa diz isso.
- **FR-005**: Faixa, nunca ponto — toda linha DEVE ter faixa de média e faixa de elite, mantendo o
  formato que `lib/benchmark.mjs` já exige.
- **FR-006**: Nenhum valor PODE ser estimado, interpolado ou arredondado "para ficar redondo". Valor
  sem fonte é ausência, e ausência é estado visível.

**Escopo dos degraus**

- **FR-007**: Os três degraus da cadeia de Conversão — `lead→respondeu`, `respondeu→orçamento`,
  `orçamento→tratamento` — DEVEM ser pesquisados e receber veredito (FR-001).
- **FR-008**: Os três degraus de aquisição — `impressão→clique`, `clique→form_start`,
  `form_start→lead` — DEVEM ser pesquisados e receber veredito (FR-001), **e NÃO PODEM ser exibidos
  por esta spec**. A exibição é a 022; a pesquisa fica pronta e datada para quem a herdar.
- **FR-009**: `clique→form_start` NÃO PODE virar linha de régua enquanto o numerador vier do GA4
  (todos os canais) e o denominador do GSC (só orgânica). A recusa DEVE citar a FR-029 da 019, que
  baniu a taxa gêmea `cliques→sessões` pelo mesmo motivo.
- **FR-010**: Nenhuma régua PODE comparar um degrau contra a cadeia inteira, nem compor duas faixas.
  A trava executável que já existe (`test/benchmark.test.mjs`) DEVE continuar verde.
- **FR-011**: Régua NÃO PODE virar meta de KR (R6). A saída continua sendo diagnóstico (`razao`,
  rótulo), nunca alvo.

**A tabela `market_benchmarks`**

- **FR-012**: Nenhuma superfície — do roihub ou da Atma — PODE exibir comparação contra linha cuja
  `source` não seja verificável.
- **FR-013**: As 12 linhas sem fonte DEVEM ser **substituídas** pelas linhas pesquisadas na US1 — não
  apenas removidas. `/admin/benchmark-mercado` DEVE ficar num estado legível: linhas com fonte real,
  ou uma declaração explícita de que não há régua para um degrau. **Tela vazia sem explicação, erro
  500 ou tabela quebrada reprovam este requisito.**
- **FR-013a**: A faixa, a URL e a data de acesso gravadas em `market_benchmarks` DEVEM ser **as
  mesmas** que o roihub publica. Duas superfícies citando réguas divergentes é o defeito que a 018 já
  matou uma vez (`form_submit` como segunda fonte do degrau `lead`) — uma régua, duas telas.
- **FR-014**: Os 7 degraus que a Atma não possui (`agendamento`, `comparecimento`, `avaliação
  inicial`, `taxa_cancelamento`, `tempo_medio_funil`, `bounce_rate`, `cac_medio`) NÃO PODEM voltar em
  nenhuma forma.
- **FR-015**: A operação sobre a base da Atma DEVE ser reversível — o conteúdo das 12 linhas fica
  registrado antes da remoção (elas são o registro de um erro que esta família de specs cita).
- **FR-015a**: A escrita em `market_benchmarks` (`PUT /:id` e `POST /bulk-update`) DEVE **recusar**
  linha sem fonte verificável. Sem essa trava, a próxima pessoa reabastece a tabela com "A definir" e
  esta spec vira um `DELETE` que durou uma semana.

**Consistência com o que já existe**

- **FR-016**: O comentário de `lib/benchmark.mjs` que afirma *"nenhum publica benchmark para esses
  degraus"* DEVE ser substituído pelo resultado da pesquisa desta spec — confirmado ou refutado, com
  a fonte. Afirmação sobre o dado escrita sem consultar o dado é o defeito que a 018 matou.
- **FR-017**: As duas citações órfãs guardadas em comentário na 018 (`visitante→lead` via PatientGain
  / Runner Agency, `lead→contatado` via InfluxMD) DEVEM ser reavaliadas: ou viram linha de um degrau
  que a Atma tem, ou a recusa fica escrita ao lado delas.
- **FR-018**: A régua NÃO PODE alterar a cadeia canônica, os marcos de `PERFIS`, as janelas por fonte
  nem qualquer número apurado. Esta spec só acrescenta referência externa.

### Key Entities

- **Linha de régua**: a faixa de mercado de **um** degrau. Hoje tem `media`, `elite`, `fonte` (texto)
  e, opcionalmente, `nota` e `condicional`. Esta spec acrescenta URL, data de acesso e recorte.
- **Recusa de régua**: um degrau candidato para o qual a pesquisa não produziu linha. **É uma entrada
  na mesma tabela das linhas**, não a ausência de uma — carrega o motivo específico daquele degrau e
  as fontes descartadas com o porquê, e é exibida na tela (FR-001a, FR-001b). Distinta de
  `sem par apurado`, que é buraco de medição e continua devolvendo para a §7.2.
- **`market_benchmarks`**: tabela na base da Atma, 12 linhas, consumida pela rota
  `/api/market-benchmarks` e pela tela `/admin/benchmark-mercado` do app da Atma. **Não** é lida pelo
  roihub.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Os **6** degraus candidatos têm veredito escrito — 6 de 6, sem exceção. Contagem
  verificável lendo um único documento.
- **SC-001a**: Os degraus **recusados** exibem, na tela, o motivo **específico** deles. Verificação:
  dois degraus recusados não podem mostrar o mesmo texto. Linha de base hoje: todo degrau sem linha
  mostra a mesma frase.
- **SC-002**: **100% das linhas de régua criadas por esta spec abrem numa fonte clicável** que mede o degrau
  declarado. Verificação: abrir cada link e conferir que o número citado está na página.
- **SC-003**: Abrindo `/okr/atma`, o degrau destacado da cadeia informa em **uma linha** se está
  abaixo, dentro ou acima da faixa do mercado, com a fonte a um clique — ou diz por que não há régua.
- **SC-004**: **Zero** superfícies exibindo comparação contra número sem fonte. Medido em duas telas:
  `/okr/atma` (roihub) e `/admin/benchmark-mercado` (admin da Atma). Linha de base hoje: **12
  comparações sem fonte numa das duas telas**.
- **SC-005**: A suíte de testes segue verde, incluindo a trava que reprova composição de duas faixas.
- **SC-006**: Nenhum número apurado exibido muda por causa desta spec. Comparação antes/depois das
  células da cadeia da Atma: idênticas.

---

## Assumptions

- **O leitor é o mesmo da 019**: o dono da Atma, 1×/semana, 60 segundos, hierarquia
  buracos → placar → tarefa. A régua serve ao "placar", nunca ao "buracos".
- **A cadeia canônica é a da 018/019** (`lead → respondeu → orçamento → tratamento`) e não muda aqui.
- **A janela de cada cadeia é a da 018** (Descoberta 8m/GSC, Comportamento 12m/GA4, Conversão 37d
  desde a época de 31/07/2026), alargadas pela 019. A régua não cria janela nova.
- **"Fonte clicável" significa URL pública**, acessível sem login e sem paywall. Fonte que exige conta
  não é citável para quem audita a ficha depois.
- **A pesquisa pode não achar fonte para vários dos 6 degraus.** O sucesso desta spec não é "6 linhas
  existem", é "6 vereditos existem" — ver FR-001 e a Q3 abaixo.
- **A base da Atma é acessível** por `ATMA_DATABASE_URL` (confirmado em 06/09/2026) e o código do app
  da Atma está disponível localmente em `C:\dev\atma` (confirmado).
- **`status_historico` continua fora** — é a 021.

---

## Dependências e riscos

- **Fronteira de repositório**: a US2 toca o app da Atma (`C:\dev\atma`), não o roihub. Deploy,
  testes e janela de push são outros. Ver Q1.
- **Fonte externa é mutável**: benchmarks publicados mudam de URL e de número. FR-003 (data de acesso)
  existe por isso, e a régua envelhece — não é dado apurado.
- **Encanamento ausente para a US3**: os degraus de aquisição não existem como `taxa`. O custo da US3
  é majoritariamente estrutural, não de pesquisa.

---

## Decisões de escopo — fechadas em 06/09/2026

As três perguntas que mudavam escopo foram levadas ao dono e respondidas. Ficam registradas com a
alternativa recusada, porque é a razão que sobrevive à próxima spec.

### D1 — A 020 atravessa a fronteira do repositório: roihub **e** app da Atma

O handoff dizia *"`market_benchmarks` é apagada"* sob a premissa de que ninguém a lê. **Ela é lida.**
Decisão: régua no roihub **+** substituição das 12 linhas pelas pesquisadas **+** trava de escrita no
app da Atma. A tela `/admin/benchmark-mercado` volta a servir em vez de esvaziar (clarificação de
06/09).

*Recusado*: apagar as linhas sem tocar no consumidor. Trocaria um veredito falso por uma tela
quebrada — mais barato e pior, porque o estrago fica invisível para quem apagou.

*Recusado também*: esvaziar a tabela e deixar a tela num empty state. Honesto, mas deixa uma tela de
admin sem função no ar e faz a régua real viver só no roihub, abrindo a porta para as duas
divergirem.

### D2 — A exibição das réguas de aquisição é a 022, não a 020

Os três degraus de aquisição não existem como objeto `taxa`, e `clique→form_start` já se sabe que não
pode existir (FR-009). Decisão: **pesquisar os seis** (FR-008) e **exibir só os três da cadeia de
Conversão**.

*Recusado*: as três histórias juntas. Misturaria pesquisa com refatoração de página — a mesma mistura
que produziu quatro rodadas inúteis de design-review e que a 018/019 separaram de propósito.

### D3 — O critério de fechamento é **seis vereditos**, não seis réguas

Cada degrau candidato termina com linha de faixa **ou** recusa escrita com motivo.

*Recusado*: "seis réguas com fonte, obrigatoriamente" — a redação literal do handoff §6. Se a
pesquisa achar três fontes boas, esse critério só se cumpre inventando as outras três, que é
exatamente o defeito que esta spec existe para apagar. **O handoff §6 fica corrigido por esta
decisão.**

---

## Fora de escopo

- **Exibir as réguas de aquisição** em `/okr/atma/aquisicao` — spec 022 (D2). A pesquisa fica pronta.
- **`status_historico`** (velocidade, passagem cumulativa, coorte) — spec 021.
- **Mudar a cadeia canônica, marcos, janelas ou qualquer número apurado** — FR-018.
- **Régua para os outros 34 projetos do portfólio.** Os perfis A, B e C já têm linhas (015); esta
  spec é sobre a Atma (perfil D), a única cadeia apurada.
- **Consertar as outras telas do admin da Atma.** Só `/admin/benchmark-mercado`, e só no que depende
  de `market_benchmarks`.
- **Recuperar os ~700 leads perdidos com a dissolução da sociedade** — sem caminho conhecido.
