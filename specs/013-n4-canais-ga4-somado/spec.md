# Feature Specification: N4 por canal — GA4 somado ao GSC

**Feature Branch**: `013-n4-canais-ga4-somado`

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "N4 por canal: somar GA4 ao GSC sem substituir. Hoje o marco `visitante` da cadeia OKR tem um único coletor — cliques orgânicos do Search Console — e os outros cinco canais do N4 (direto, pago, indicação, outbound, social) saem `não apurado` fixo porque não existe coletor para eles. Isso subestima o topo de todo projeto que recebe tráfego fora da busca orgânica, e no caso da Atma esconde exatamente o canal novo: depois do reposicionamento para preço, o paciente chega direto no WhatsApp e não preenche formulário. Objetivo: adicionar GA4 como fonte SOMADA ao GSC, nunca substituta, preservando a regra da casa de que `0` e `não apurado` são coisas diferentes e que canal sem coletor continua `não apurado` em vez de virar zero. A soma precisa deixar explícito na tela de que fonte veio cada parcela, e a sobreposição entre cliques orgânicos do GSC e sessões orgânicas do GA4 não pode ser contada duas vezes. Precisa também tratar o caso do lead de WhatsApp, que hoje só é detectável indiretamente por orçamento com `paciente_lead_id` nulo."

## Contexto que motivou a feature

O `visitante` da cadeia OKR é hoje, literalmente, **cliques orgânicos do Search Console**. Cinco dos
seis canais do N4 nunca tiveram coletor e imprimem `não apurado` fixo. A consequência medida em
02/09/2026:

- **A Atma tem 525 cliques orgânicos e 35 leads de formulário na janela**, e a taxa de 6,67% é
  tratada como a conversão do site — mas ela ignora todo mundo que chega por outro canal.
- Depois do reposicionamento da Atma para preço (a promessa de "achamos um doutor perto de você"
  saiu do ar com a saída do sócio comercial), **o paciente passou a chegar direto no WhatsApp e não
  preenche formulário**. `patient_leads` está seco desde 17/08. A ficha exibe isso como queda de
  funil; é troca de canal, e o canal novo é justamente um dos cinco cegos.
- O único vestígio medível do canal novo hoje é **orçamento com `paciente_lead_id` nulo** (2 de 7),
  que é inferência, não apuração.

O defeito não é da Atma: **todo projeto do portfólio que recebe tráfego fora da busca orgânica tem
o topo da cadeia subestimado**, e a subestimação é silenciosa.

## Clarifications

### Session 2026-09-02

- Q: GSC conta cliques num resultado de busca e a fonte nova conta sessões no site. Como compor o total do topo sem misturar unidades nem contar duas vezes? → A: Opção A — o canal orgânico continua vindo do Search Console e a fonte nova serve **apenas** os cinco canais que o GSC não enxerga. Não há sobreposição por construção; o total passa a ser **composto** e DEVE ser rotulado como composto na tela, nunca como "sessões".
- Q: O lead que chega por WhatsApp deve ser instrumentado nesta feature ou apenas rotulado como inferência? → A: Opção C — rotular a inferência agora, dentro do hub, e abrir a instrumentação da origem do contato como feature separada, mantendo a dívida explícita em vez de esquecida.
- Q: O total composto vira o `visitante` da cadeia, ou fica só como leitura no N4? → A: Opção A — `visitante` continua sendo o orgânico do Search Console e a cadeia não muda. O N4 exibe todos os canais e o total composto lado a lado, como leitura, sem alimentar o N3. Promover o composto a denominador fica como migração futura, datada e separada.

**Critério comum às duas decisões**: nenhuma delas altera número que já está na tela. Quando uma
leitura nova entra junto com uma mudança de significado, não dá para separar o que melhorou do que
só mudou de régua.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver o topo do funil por canal, com a fonte de cada parcela (Priority: P1)

O Jean abre a ficha OKR de um projeto e vê, no N4, quanto cada canal trouxe na janela — e ao lado
de cada número, de onde ele veio. Canal sem fonte configurada continua dizendo `não apurado` com a
fonte a consultar, nunca `0`.

**Why this priority**: é o motivo da feature existir. Sem isso o N4 é uma lista de seis linhas onde
cinco são sempre a mesma frase, e o total do topo mente por omissão em todo projeto multicanal.

**Independent Test**: configurar a fonte GA4 de um único projeto e conferir que os canais dele saem
com número e procedência, enquanto os projetos não configurados continuam exatamente como hoje.

**Acceptance Scenarios**:

1. **Given** um projeto com fonte GA4 configurada e tráfego em direto e social, **When** a ficha é
   aberta, **Then** as linhas de direto e social exibem o número e a fonte de onde ele veio.
2. **Given** um projeto sem fonte GA4 configurada, **When** a ficha é aberta, **Then** os cinco
   canais não-orgânicos continuam `não apurado` nomeando a fonte a consultar — nunca `0`.
3. **Given** um projeto com fonte GA4 configurada e zero sessões de pago na janela, **When** a ficha
   é aberta, **Then** a linha de pago exibe `0` apurado, e não `não apurado` — porque a fonte foi
   consultada e respondeu.
4. **Given** a fonte GA4 fora do ar no momento da requisição, **When** a ficha é aberta, **Then** os
   canais que dependem dela saem `não apurado` nomeando a falha — nunca `0`, e sem derrubar o
   número orgânico que o GSC já servia.

---

### User Story 2 - Somar sem contar duas vezes (Priority: P1)

O total do topo da cadeia passa a considerar todos os canais com fonte, sem que a sobreposição
entre a leitura do GSC e a do GA4 infle o número.

**Why this priority**: uma soma que conta o mesmo visitante duas vezes é pior que a subestimação de
hoje, porque parece melhor. E como o total composto é leitura — não denominador (FR-005c) — ele
precisa ser inequívoco justamente por ficar ao lado de um número menor que continua governando as
taxas.

**Independent Test**: para um projeto com as duas fontes, conferir que o total do topo bate com a
regra de composição declarada e que nenhum visitante entra por duas fontes.

**Acceptance Scenarios**:

1. **Given** um projeto com GSC e GA4 configurados, **When** o total do topo é montado, **Then**
   cada canal contribui a partir de exatamente uma fonte, e a tela declara qual.
2. **Given** a regra de composição, **When** o total é exibido, **Then** a janela declarada (R7) é a
   mesma para as duas fontes, e as duas leituras cobrem exatamente o mesmo intervalo de dias.
3. **Given** um projeto onde só uma das duas fontes está configurada, **When** o total é montado,
   **Then** ele não é apresentado como total fechado — a parcela ausente aparece como `não apurado`
   e a diferença entre soma medida e entrada da cadeia continua `não apurado`.

---

### User Story 3 - Enxergar o lead que chega por WhatsApp, rotulado como inferência (Priority: P2)

O canal que hoje só existe como suspeita ganha um lugar honesto na ficha: aparece com o volume que
o vestígio no banco permite deduzir, **marcado como inferência**, sem entrar na cadeia como número
apurado nem sustentar taxa nenhuma.

**Why this priority**: é o caso concreto que motivou a feature, mas as histórias 1 e 2 entregam
valor sem ela. Fica em P2 também porque a inferência é um paliativo declarado: a medição real
depende de instrumentar a origem do contato, o que está fora deste escopo (FR-011b).

**Independent Test**: abrir a ficha da Atma e verificar que o volume que chega fora do formulário
aparece com marca de inferência, e que nenhuma taxa da cadeia foi calculada a partir dele.

**Acceptance Scenarios**:

1. **Given** um orçamento sem lead vinculado, **When** a ficha da Atma é montada, **Then** ele nunca
   é somado como lead apurado do formulário.
2. **Given** a origem WhatsApp deduzida do vestígio no banco, **When** ela aparece na ficha,
   **Then** ela vem visivelmente marcada como inferência, ao lado do número.
3. **Given** uma origem marcada como inferência, **When** qualquer taxa da cadeia é calculada,
   **Then** o valor inferido não entra nem como numerador nem como denominador.
4. **Given** esta feature entregue, **When** alguém procura por que a origem não é apurada,
   **Then** encontra a dívida registrada com o motivo, e não o silêncio.

---

### Edge Cases

- **A janela das duas fontes não fecha no mesmo dia.** O Search Console fecha o dia com ~3 dias de
  atraso e a outra fonte não. Ler intervalos diferentes e somar produz um total que não corresponde
  a janela nenhuma. A janela única da R7 tem que valer para as duas leituras.
- **Um canal existe na fonte mas não no catálogo `CANAIS` do hub** (ex.: "email", "affiliate"). O
  volume dele não pode sumir em silêncio nem ser jogado num canal existente.
- **A fonte responde com sucesso e devolve zero linhas.** Isso é `0` apurado, não `não apurado` — e
  é diferente de "a fonte não foi consultada". Confundir os dois é o defeito central que a casa
  combate.
- **A fonte responde para uns canais e falha para outros.** Cada canal carrega seu próprio estado;
  falha parcial não pode zerar nem invalidar os canais que responderam.
- **Projeto sem domínio próprio** (host de fornecedor, `*.vercel.app`) fica fora da propriedade do
  GSC. Já sai `não apurado` hoje; a fonte nova não pode transformar isso em `0`.
- **O número orgânico muda de valor** ao ganhar uma segunda leitura. Toda taxa da cadeia usa
  `visitante` como denominador — uma mudança silenciosa reescreve o histórico de conversão de todos
  os projetos de uma vez.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE exibir cada um dos seis canais do N4 com seu próprio estado
  (`apurado` / `declarado` / `não apurado`), independente dos demais.
- **FR-002**: O sistema DEVE exibir, junto de todo canal apurado, a procedência do número.
- **FR-003**: O sistema DEVE manter `não apurado` — nunca `0` — para canal cuja fonte não está
  configurada, não respondeu, ou respondeu com erro.
- **FR-004**: O sistema DEVE registrar `0` apurado quando a fonte respondeu com sucesso e o volume
  do canal na janela foi zero.
- **FR-005**: O sistema DEVE garantir que cada canal receba volume de **exatamente uma** fonte, de
  modo que nenhum visitante seja contado duas vezes no total do topo. Especificamente: o canal
  orgânico é servido pelo Search Console e a fonte nova serve **somente** os cinco canais restantes.
- **FR-005a**: O sistema NÃO PODE usar a fonte nova para produzir o volume do canal orgânico, nem
  para substituir, corrigir ou reconciliar o número que o Search Console já serve.
- **FR-005b**: O total composto do N4, por somar grandezas de origens diferentes (cliques em
  resultado de busca e sessões no site), DEVE ser rotulado na tela como **composto**, e NÃO PODE ser
  apresentado sob o nome de uma única grandeza.
- **FR-005c**: O marco `visitante` da cadeia CONTINUA sendo o volume orgânico do Search Console. O
  total composto do N4 é **leitura**, e NÃO PODE alimentar o N3 nem servir de denominador a
  qualquer taxa da cadeia.
- **FR-005d**: A tela DEVE deixar explícito que o total composto do N4 e o `visitante` da cadeia são
  números diferentes, com abrangências diferentes — exibi-los sem essa distinção faria a diferença
  entre eles parecer erro de medição.
- **FR-006**: O sistema DEVE aplicar a MESMA janela declarada (R7) às duas fontes, e DEVE recusar a
  soma quando as duas leituras não cobrirem o mesmo intervalo.
- **FR-007**: O sistema DEVE preservar o comportamento atual — inclusive o valor exibido — para todo
  projeto que não tenha a fonte nova configurada.
- **FR-008**: O sistema DEVE tratar falha da fonte nova como falha FECHADA: ela não pode derrubar,
  zerar ou substituir o número que o Search Console já servia.
- **FR-009**: O sistema DEVE nomear, e nunca descartar em silêncio, o volume que vier num canal fora
  do catálogo de canais do hub.
- **FR-010**: O sistema DEVE permitir configurar a fonte nova por projeto, e a ausência dessa
  configuração DEVE ser distinguível de "configurada e sem tráfego".
- **FR-011**: O sistema DEVE distinguir, na tela, número **apurado** de número **inferido**, e valor
  inferido NÃO PODE entrar na cadeia como apurado nem sustentar uma taxa.
- **FR-011a**: A origem WhatsApp DEVE ser exibida nesta feature como **inferência rotulada**,
  derivada do vestígio já existente no banco do projeto, sem qualquer alteração no site do projeto.
- **FR-011b**: A instrumentação da origem do contato — que tornaria essa origem apurada — está
  **fora do escopo** desta feature e DEVE ficar registrada como dívida explícita, com o motivo de
  não ter sido feita aqui.
- **FR-012**: O sistema DEVE manter a diferença entre a soma medida dos canais e a entrada da cadeia
  como `não apurado` enquanto houver qualquer canal sem fonte.
- **FR-013**: A configuração da fonte nova DEVE ser validada pelo nome da variável de ambiente,
  nunca pelo valor, e nenhuma credencial pode aparecer em log, erro ou resposta.

### Key Entities

- **Canal**: uma das seis origens de tráfego do N4 (orgânico, direto, pago, indicação, outbound,
  social). Carrega volume na janela, estado de apuração e procedência.
- **Fonte de canal**: de onde o volume de um canal foi lido. Uma fonte serve um ou mais canais de um
  projeto; um canal é servido por no máximo uma fonte.
- **Configuração de fonte por projeto**: o vínculo entre um projeto do portfólio e a fonte que
  responde por seus canais. Sua ausência é um estado significativo, não um defeito.
- **Origem inferida**: volume atribuído a um canal por dedução e não por leitura direta (o caso do
  orçamento sem lead vinculado). Carrega obrigatoriamente a marca de inferência.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Para um projeto com a fonte nova configurada, o número de canais do N4 com estado
  `apurado` sobe de 1 para pelo menos 4.
- **SC-002**: 100% dos canais exibidos como apurados mostram a procedência do número na mesma linha.
- **SC-003**: Nenhum canal sem fonte configurada exibe `0` — verificável varrendo todos os projetos
  do portfólio.
- **SC-004**: Para todo projeto sem a fonte nova configurada, os valores exibidos no N3 e no N4
  permanecem idênticos aos de antes da mudança.
- **SC-005**: Nenhum canal recebe volume de mais de uma fonte — verificável somando as parcelas por
  procedência e conferindo que cada canal aparece uma única vez. (O total composto do N4 **excede**
  o `visitante` da cadeia por construção, já que este é só o orgânico: excedente aqui é o
  comportamento correto, não erro.)
- **SC-006**: Com a fonte nova fora do ar, toda ficha do portfólio continua abrindo e o número
  orgânico continua sendo exibido.
- **SC-007**: Na ficha da Atma, o volume que chega fora do formulário deixa de ser invisível e passa
  a ter linha própria marcada como inferência.
- **SC-008**: O número do canal orgânico exibido depois da mudança é idêntico, para todos os
  projetos, ao exibido antes dela — a fonte nova não toca esse canal.
- **SC-009**: Nenhuma taxa da cadeia muda de valor por causa de um número inferido — verificável
  removendo as inferências e conferindo que toda taxa permanece igual.
- **SC-010**: Toda taxa do N3, em todos os projetos, permanece idêntica à de antes da mudança —
  inclusive nos projetos com a fonte nova configurada. A feature acrescenta leitura ao N4 e não
  toca a cadeia.

## Assumptions

- A janela permanece a única declarada pela R7 (28 dias fechando em D-3), para as duas fontes.
- O catálogo de canais do hub continua sendo os seis atuais; a feature não cria canal novo, mas
  precisa lidar com volume que chegue rotulado fora dele (FR-009).
- A configuração de fonte por projeto mora na curadoria do projeto, junto dos demais campos que já
  descrevem como o projeto é medido, e é incorporada ao contrato único de leitura de projetos
  (Princípio I da constituição) em vez de ao lado dele.
- A credencial da fonte nova segue o padrão já usado para o Search Console: validada por nome de
  variável, nunca por valor (Princípio V).
- Projetos sem domínio próprio continuam sem leitura orgânica; a feature não resolve isso.
- Nenhuma métrica de terceiro entra como meta — a R6 continua valendo. A feature mede volume, não
  compara com benchmark.
- O histórico anterior à ligação da fonte nova não existe e não será reconstruído.
- A leitura do canal orgânico permanece intocada (FR-005a): a feature **adiciona** canais, nunca
  reinterpreta o que já estava medido. A comparabilidade histórica das taxas é preservada de
  propósito.
- O total do topo passa a somar grandezas diferentes (cliques em resultado de busca + sessões no
  site). Isso é aceito conscientemente em troca de zero dupla contagem e zero quebra de histórico;
  o preço é que o total só pode ser lido como composto (FR-005b). Unificar a grandeza, se um dia
  for desejado, é migração declarada com data — nunca efeito colateral desta feature.

## Fora de escopo

- **Instrumentar a origem do contato de WhatsApp** para torná-la apurada. Fica como feature
  separada (FR-011b). Motivo de não estar aqui: exige mudança no site do projeto, em outro
  repositório, e só passaria a contar a partir da data em que fosse ligada — o passado não volta.
  Enquanto isso, a origem aparece como inferência rotulada.
- **Promover o total composto a `visitante` da cadeia** (FR-005c). Mudaria o denominador de toda
  taxa do N3 no mesmo momento em que a fonte nova chega — e aí não daria para separar "a conversão
  caiu" de "a conta mudou". Fica como migração futura, datada e isolada, a ser feita quando os
  projetos já tiverem a fonte configurada.
- **Unificar a grandeza do topo da cadeia** (migrar o orgânico para a fonte nova). Mudaria o
  `visitante` de todos os projetos de uma vez e com ele toda taxa histórica.
- **Criar canais novos** além dos seis do catálogo atual. Volume que chegar rotulado fora do
  catálogo é nomeado, não descartado (FR-009), mas não gera canal.
