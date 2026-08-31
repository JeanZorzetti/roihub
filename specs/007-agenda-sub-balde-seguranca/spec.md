# Feature Specification: Sub-balde Segurança na Agenda

**Feature Branch**: `007-agenda-sub-balde-seguranca`

**Created**: 2026-08-31

**Status**: Draft

**Input**: User description: "Sub-balde \"Segurança\" dentro do balde Execução na /agenda. Predicado booleano independente `seguranca(titulo)` em lib/agenda.mjs, ortogonal ao eixo de esforço (tipoDe): identifica cards que expõem credencial/dado/superfície (token, credencial, segredo, secret, rotacionar, chave de api/secreta/privada, vazou/vazamento/vazada, exposto/exposta, CVE-NNNN, CORS, auth fora de caminho de URL, autenticação, vulnerab). Dentro do balde Execução, quando houver ao menos 1 card de segurança, particiona a lista em dois grupos com subtítulo <h3>: \"🔒 Segurança (N)\" primeiro (fura a fila, independente do rank do projeto), depois o resto — cada grupo mantendo a ordenação normal (ordenar/porUrgencia). Sem partição/subtítulo quando não há nenhum card de segurança (lista chapada como hoje). Não altera porUrgencia nem os três TIPOS existentes. Fonte completa da decisão e do design: roihub/handoff/handoff-sub-balde-seguranca.md (regex exato, casos de teste, arquivos a tocar, critérios de aceite já definidos com o Jean em 31/08/2026)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver os cards de segurança primeiro na Execução (Priority: P1)

Como dono da agenda (Jean ou Maria), ao abrir `/agenda` quero que qualquer card de Execução
sobre segredo/credencial/vulnerabilidade exposta apareça no topo do balde Execução, acima de
qualquer outro card — mesmo que o projeto dele tenha rank pior — porque um segredo vazado não
pode esperar a fila normal de prioridade.

**Why this priority**: É o único motivo de a feature existir — "furar a fila" é o requisito
central do pedido original.

**Independent Test**: Com pelo menos um card de Execução cujo título contenha um termo de
segurança (ex.: "Rotacionar o token de produção") e outro card comum de projeto com rank melhor,
abrir `/agenda` e confirmar que o card de segurança aparece antes do card de rank melhor dentro
do balde Execução.

**Acceptance Scenarios**:

1. **Given** o balde Execução tem 1 card de segurança (projeto rank #20) e 1 card comum
   (projeto rank #2), **When** a página `/agenda` é renderizada, **Then** o card de segurança
   aparece antes do card comum, sob um agrupamento visualmente destacado.
2. **Given** o balde Execução não tem nenhum card de segurança, **When** a página é renderizada,
   **Then** a lista aparece exatamente como hoje, sem nenhum agrupamento ou subtítulo extra.

---

### User Story 2 - Não perder a classificação de esforço existente (Priority: P2)

Como usuário que já confia na contagem "Execução (N)" e nos três baldes (Conferência, Execução,
Decisão) para saber quanto trabalho de cada tipo existe, quero que marcar um card como "de
segurança" não o tire da contagem nem do balde onde ele já estava.

**Why this priority**: Proteção contra regressão do que já existe e foi validado — segurança é
um destaque, não uma quarta categoria concorrente.

**Independent Test**: Comparar o contador do cabeçalho "🔨 Execução (N)" antes e depois de um
card virar "de segurança" pelo predicado — o número não muda, e o card continua dentro da seção
Execução (não migra para Conferência/Decisão nem para uma seção própria).

**Acceptance Scenarios**:

1. **Given** um card cujo título casa com o predicado de segurança e cujo esforço (`tipoDe`) é
   "execucao", **When** a agenda é montada, **Then** o card aparece dentro da seção Execução, e
   o contador do cabeçalho da seção inclui esse card no total.

---

### User Story 3 - Rótulo claro de por que um card veio primeiro (Priority: P3)

Como usuário lendo a lista rapidamente, quero um subtítulo curto acima do grupo de segurança
(e acima do resto, quando o grupo existir) para entender por que a ordem normal por rank não
está sendo seguida ali.

**Why this priority**: Sem rótulo, a ordem furada parece um bug de ranqueamento em vez de uma
decisão deliberada — mas a feature ainda funciona (US1) sem esse rótulo.

**Independent Test**: Com pelo menos um card de segurança presente, inspecionar a página
renderizada e confirmar que existe um subtítulo "🔒 Segurança (N)" acima do grupo furado e um
subtítulo para o restante da lista, ambos em nível de cabeçalho abaixo do título da seção.

**Acceptance Scenarios**:

1. **Given** o balde Execução tem 2 cards de segurança e 5 comuns, **When** a página é
   renderizada, **Then** aparece o subtítulo "🔒 Segurança (2)" seguido dos 2 cards, e depois um
   subtítulo para o restante seguido dos outros 5.

---

### Edge Cases

- Card cujo título contém um termo de segurança dentro de um caminho de URL (ex.:
  ".../api/auth/callback/github") — NÃO deve ser classificado como segurança; o termo precisa
  estar isolado, não embutido em um segmento de URL.
- Título `null`/`undefined` (card malformado) — o predicado não deve lançar erro, deve tratar
  como "não é de segurança".
- Todos os cards do balde Execução são de segurança — o grupo "resto" fica vazio e nenhum
  subtítulo de "resto" deve aparecer sem itens.
- Um card de segurança some da lista (foi resolvido/apagado) e o grupo de segurança fica vazio —
  a agenda volta a mostrar a lista chapada, sem subtítulo "Segurança (0)".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE classificar cada card por um predicado independente "é de
  segurança", derivado apenas do título do card, sem alterar a classificação de esforço
  (Conferência/Execução/Decisão) já existente.
- **FR-002**: O predicado de segurança DEVE reconhecer títulos que mencionem exposição ou
  manuseio de credencial/segredo/vulnerabilidade (token, credencial, segredo, chave de
  API/secreta/privada, vazamento, exposição, identificador de CVE, CORS, autenticação/auth como
  termo isolado, vulnerabilidade).
- **FR-003**: O predicado de segurança NÃO DEVE classificar como segurança um título só porque a
  substring "auth" aparece dentro de um caminho/URL (ex.: rota de callback OAuth).
- **FR-004**: Dentro do balde Execução, quando existir ao menos um card de segurança, o sistema
  DEVE exibi-los agrupados no topo da seção, antes de qualquer outro card do mesmo balde,
  independentemente do rank do projeto ou da urgência de data.
- **FR-005**: Dentro do grupo de segurança e dentro do grupo restante, a ordenação relativa entre
  os cards DEVE seguir a mesma regra de ordenação já usada na agenda hoje (urgência de data, rank
  do projeto, data).
- **FR-006**: Quando não existir nenhum card de segurança no balde Execução, o sistema DEVE
  exibir a lista exatamente como hoje, sem nenhum agrupamento, subtítulo ou indicação extra.
- **FR-007**: Quando existir ao menos um card de segurança, o sistema DEVE rotular visualmente os
  dois grupos (segurança e restante) para que a ordem não pareça arbitrária.
- **FR-008**: O contador total exibido no cabeçalho da seção Execução DEVE continuar contando
  todos os cards da seção, incluindo os de segurança — a existência do sub-agrupamento não deve
  alterar essa contagem.
- **FR-009**: A classificação de esforço (balde Conferência/Execução/Decisão) de um card NÃO
  DEVE mudar em função de ele ser ou não classificado como de segurança.
- **FR-010**: O predicado de segurança, ao receber um título ausente ou inválido, DEVE retornar
  "não é de segurança" em vez de falhar.

### Key Entities

- **Card da agenda**: item exibido em `/agenda`, já possui balde de esforço (Conferência/
  Execução/Decisão), urgência de data, rank de projeto (quando aplicável) e ordenação. Ganha um
  novo atributo derivado: se é ou não "de segurança".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ao abrir `/agenda` com pelo menos um card de segurança pendente no balde Execução,
  o usuário identifica esse card entre os 3 primeiros itens visíveis da seção, mesmo que o
  projeto associado não esteja entre os de maior prioridade.
- **SC-002**: Em dias sem nenhum card de segurança pendente (a maioria dos dias, conforme medição
  de 31/08/2026 — 2 em 61 cards existentes), a tela da Execução permanece idêntica à versão
  anterior à feature, sem elementos visuais adicionais.
- **SC-003**: A contagem exibida no cabeçalho da seção Execução bate exatamente com o número de
  cards de Execução existentes, com ou sem cards de segurança presentes.
- **SC-004**: Um título de card que menciona "auth" apenas como parte de uma URL de callback não
  é agrupado como card de segurança, evitando falso-positivo já observado na medição de
  31/08/2026.

## Assumptions

- A classificação usa apenas o título do card, não a descrição — mesmo critério já usado pela
  classificação de esforço existente, porque a descrição funciona como diário de bordo do que já
  foi feito, não do que falta.
- A heurística é por palavra-chave (regex), com a mesma expectativa de erro/correção que a
  classificação de esforço já em produção: se o override manual virar regra, a lista de palavras
  é revisada, não remendada caso a caso na renderização.
- Filtro dedicado por "segurança" na URL da agenda e classificação manual/override por card estão
  fora do escopo desta feature (ver seção 7 do handoff de origem) — entram apenas se a
  necessidade aparecer depois.
- Aplicar esse mesmo predicado aos baldes Conferência e Decisão está fora do escopo desta
  feature — o predicado nasce geral, mas só é usado dentro de Execução por enquanto.
- A fonte de decisão e os detalhes de design (regex, casos de teste, arquivos a tocar) já foram
  acordados com o usuário em 31/08/2026 e estão documentados em
  `roihub/handoff/handoff-sub-balde-seguranca.md`.
