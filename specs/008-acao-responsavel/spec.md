# Feature Specification: Responsável pela ação do ranking

**Feature Branch**: `008-acao-responsavel`

**Created**: 2026-08-31

**Status**: Draft

**Input**: User description: "As ações precisam ter responsáveis, eu (Jean Zorzetti) ou a Maria Zorzetti. Quem fica eu decido de forma manual via seletor."

## Contexto: o que muda em relação à spec 005

A [spec 005](../005-agenda-responsavel/spec.md) deu responsável às **tarefas do banco**
(`hub_tasks`) e excluiu de propósito as ações do ranking — o FR-007 dela diz literalmente
"ações do ranking NÃO recebem responsável". Em 31/08/2026 a `/agenda` virou projeção pura do
ranking e parou de renderizar `hub_tasks`, então o responsável da 005 saiu da tela junto com o
filtro por responsável.

Esta feature **revoga o FR-007 da 005**: agora é a ação do ranking que precisa de dono. O
motivo é operacional e não técnico — a Maria virou dev, então existem dois executores para a
mesma fila, e uma linha sem dono não é executada por ninguém.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Atribuir responsável a uma ação (Priority: P1)

Jean abre a `/agenda`, vê a fila de ações na ordem do ranking e escolhe, linha a linha, quem
executa: ele ou a Maria. A escolha é manual e não tem regra automática — é uma decisão de
alocação, não uma classificação derivável do texto.

**Why this priority**: sem a atribuição não existe nada. É o requisito que entrega o pedido.

**Independent Test**: escolher "Maria Zorzetti" numa ação, recarregar a página e ver a ação
ainda atribuída à Maria.

**Acceptance Scenarios**:

1. **Given** uma ação sem responsável, **When** Jean escolhe "Maria Zorzetti" no seletor da
   linha, **Then** a linha passa a exibir Maria como responsável e continua exibindo depois do
   reload.
2. **Given** uma ação atribuída a Jean, **When** ele escolhe "Maria Zorzetti", **Then** a
   atribuição é substituída (uma ação tem um dono, nunca dois).
3. **Given** uma ação atribuída a alguém, **When** Jean escolhe a opção vazia, **Then** a ação
   volta a não ter responsável e é sinalizada como pendente de atribuição.
4. **Given** o ambiente sem banco (`DATABASE_URL` ausente), **When** a página carrega, **Then**
   a lista aparece completa e na ordem certa, sem seletor, com o mesmo aviso que hoje já cobre
   o check.

---

### User Story 2 - Enxergar quem é o dono sem abrir nada (Priority: P1)

O responsável aparece na própria linha da agenda e no card do projeto no ranking da home, ao
lado da ação — quem olha a tela sabe de quem é a fila sem clicar.

**Why this priority**: mesmo P1 da história 1. Atribuição que não se vê na tela não muda o
comportamento de ninguém; o valor pedido é saber de quem é a ação.

**Independent Test**: com uma ação atribuída à Maria, conferir que o rótulo "Maria" aparece na
linha da `/agenda` e no card do projeto na home.

**Acceptance Scenarios**:

1. **Given** uma ação atribuída, **When** a `/agenda` ou a home carregam, **Then** o nome do
   responsável aparece junto da ação nas duas telas.
2. **Given** uma ação sem responsável, **When** qualquer uma das duas telas carrega, **Then** a
   ausência é exibida explicitamente como pendência ("sem responsável"), e não como espaço em
   branco.

---

### User Story 3 - Isolar "o que é meu" (Priority: P2)

Jean (ou a Maria) filtra a agenda por responsável para ver só a própria fila, e também para
listar o que ainda está sem dono.

**Why this priority**: é o que torna a atribuição útil no dia a dia, mas a atribuição já
entrega valor sozinha (histórias 1 e 2 funcionam sem filtro).

**Independent Test**: com ações dos dois responsáveis e algumas sem dono, filtrar por "Maria
Zorzetti" e ver só as dela.

**Acceptance Scenarios**:

1. **Given** ações atribuídas a Jean, à Maria e sem dono, **When** o filtro "Jean Zorzetti"
   está ativo, **Then** só as ações de Jean aparecem.
2. **Given** o mesmo estado, **When** o filtro "sem responsável" está ativo, **Then** só as
   ações não atribuídas aparecem — é assim que se encontra o que precisa ser decidido.
3. **Given** um filtro de responsável ativo, **When** a página é recarregada ou o link é
   compartilhado, **Then** o filtro continua aplicado, como os filtros que já existem.
4. **Given** um filtro de responsável ativo, **When** Jean marca uma ação como feita, **Then**
   o filtro continua aplicado depois da ação.

---

### Edge Cases

- **Texto da ação reescrito no `data/projects.json`**: a atribuição é do texto da ação, não do
  projeto (decisão do Jean em 31/08). Reescrever a ação produz uma ação nova, sem dono, que
  reaparece na fila "sem responsável" para ser reatribuída — mesma semântica que o check já tem
  hoje. Isso é comportamento desejado, não perda de dado.
- **Projeto que perde a ação** (campo `acao` esvaziado): a linha some da agenda, como já
  acontece hoje; a atribuição órfã fica no banco sem efeito e não deve aparecer em lugar nenhum.
- **Projeto curado sem ação**: não vira linha e portanto não recebe nem cobra responsável.
- **Ação marcada como feita**: continua exibindo quem era o responsável — o histórico de
  "Feitas" perderia sentido se o dono sumisse ao marcar.
- **Banco fora do ar durante a leitura**: a agenda não pode cair. Sem as atribuições, todas as
  ações aparecem como "sem responsável", da mesma forma que hoje aparecem como pendentes quando
  os checks não carregam.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir atribuir a cada ação do ranking exatamente um responsável
  entre Jean Zorzetti e Maria Zorzetti, ou nenhum.
- **FR-002**: A atribuição DEVE ser manual, feita por um seletor na própria linha da ação. O
  sistema NÃO PODE inferir, sugerir ou preencher responsável automaticamente a partir do texto
  da ação, do projeto ou de qualquer heurística.
- **FR-003**: A atribuição DEVE persistir entre reloads e deploys, sem exigir edição de arquivo
  nem push — o seletor é a única forma de mudá-la.
- **FR-004**: A atribuição DEVE ser identificada pelo texto da ação (ação reescrita = ação nova,
  sem dono), coerente com a regra que o check da agenda já segue.
- **FR-005**: O sistema DEVE exibir o responsável de cada ação na `/agenda` e no card do projeto
  no ranking da home.
- **FR-006**: O sistema DEVE exibir explicitamente as ações sem responsável como pendência de
  atribuição, em vez de omitir o campo.
- **FR-007**: O sistema DEVE oferecer filtro por responsável na barra de filtros da `/agenda`,
  incluindo a opção "sem responsável", com as mesmas mecânicas dos filtros existentes (valor na
  URL, chip de filtro ativo, botão de limpar, sobrevive às server actions).
- **FR-008**: O sistema DEVE aceitar como responsável apenas os valores conhecidos; valor
  desconhecido vindo do formulário ou da querystring é descartado e tratado como "nenhum", como
  as demais entradas de usuário já são tratadas.
- **FR-009**: A `/agenda` DEVE continuar sendo projeção do `data/projects.json`: esta feature
  NÃO PODE reintroduzir criação, edição ou remoção de tarefa na aba. O seletor de responsável
  passa a ser o segundo write da aba, ao lado do check, e nada além disso.
- **FR-010**: Ausência de banco DEVE degradar a tela, nunca derrubá-la: a lista continua
  completa e na ordem do ranking, sem seletor e sem atribuição.

### Key Entities

- **Atribuição de ação**: liga a identidade de uma ação do ranking a um responsável. Vive fora
  do `data/projects.json` porque é editada pela tela, não por push. Uma ação tem no máximo uma
  atribuição; atribuição sem ação correspondente é inerte.
- **Responsável**: pessoa que executa. Lista fechada de dois — Jean Zorzetti e Maria Zorzetti.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Atribuir um responsável e recarregar a página preserva a atribuição em 100% dos
  casos.
- **SC-002**: Em qualquer momento é possível listar, em um clique, todas as ações sem
  responsável — o número dessas ações é o indicador de que a regra "toda ação tem dono" está
  sendo cumprida.
- **SC-003**: Filtrar por um responsável mostra exclusivamente as ações dele, sem esconder
  nenhum dos três baldes (Conferência/Execução/Decisão) da tela.
- **SC-004**: Nenhuma ação passa a exigir edição de arquivo e push para trocar de dono: 100% das
  trocas de responsável acontecem pela tela.
- **SC-005**: A tela continua utilizável sem banco: a lista completa aparece, sem seletor e sem
  erro.

## Assumptions

- Só existem dois responsáveis, e a lista não precisa ser administrável pela tela — ela já
  existe no código desde a spec 005 e é reaproveitada.
- "Sem responsável" é um estado válido e transitório (ação nova ou reescrita), não um erro que
  bloqueia a tela. A regra "toda ação precisa ter responsável" é cobrada pela visibilidade
  (FR-006/SC-002), não por validação que impeça o uso da agenda.
- A decisão de 11/07 de que o hub é **só dev** continua valendo. O que mudou é que a Maria
  também é dev, então ação dela é ação de dev e entra no ranking normalmente; captação e
  comercial seguem fora do hub.
- A ordem da fila continua sendo o ranking. Responsável é uma partição da lista, não um critério
  de ordenação — nenhuma ordem nova é criada nesta feature.
- O ranking da home exibe o responsável, mas não atribui: o seletor mora só na `/agenda`, para
  não haver duas telas escrevendo a mesma coisa.
