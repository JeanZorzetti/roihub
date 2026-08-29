# Feature Specification: Responsável por tarefa na Agenda

**Feature Branch**: `005-agenda-responsavel`

**Created**: 2026-08-29

**Status**: Draft

**Input**: User description: "Crie separação por responsabilidade, minha (Jean Zorzetti) e da Maria Zorzetti, na agenda do roihub (hub.roilabs.com.br/agenda)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Atribuir responsável a uma tarefa (Priority: P1)

Jean ou Maria criam ou editam uma tarefa da agenda e escolhem quem é responsável por ela (Jean, Maria, ou ninguém em particular).

**Why this priority**: Sem a atribuição, não existe separação nenhuma — é o requisito mínimo que já entrega o valor pedido.

**Independent Test**: Criar uma tarefa escolhendo "Jean" como responsável e confirmar que ela é salva e exibida com esse responsável.

**Acceptance Scenarios**:

1. **Given** o formulário de nova tarefa, **When** o usuário escolhe "Jean Zorzetti" como responsável e salva, **Then** a tarefa aparece na agenda marcada como responsabilidade de Jean.
2. **Given** uma tarefa existente sem responsável, **When** o usuário abre a edição e define "Maria Zorzetti", **Then** a tarefa passa a aparecer marcada como responsabilidade de Maria.
3. **Given** o formulário de nova tarefa, **When** o usuário não escolhe responsável, **Then** a tarefa é salva sem dono e continua visível para os dois.

---

### User Story 2 - Filtrar a agenda por responsável (Priority: P2)

Jean ou Maria filtram a lista da agenda para ver só as tarefas atribuídas a uma pessoa específica, do mesmo jeito que já filtram por projeto, urgência ou origem.

**Why this priority**: Ter o dono salvo sem conseguir enxergar "o que é meu" separado do resto não resolve o pedido de separação — o filtro é o que torna a atribuição útil no dia a dia.

**Independent Test**: Com tarefas de ambos os responsáveis cadastradas, aplicar o filtro "Jean Zorzetti" e confirmar que só as tarefas dele aparecem (mais as ações do ranking, que não têm dono).

**Acceptance Scenarios**:

1. **Given** tarefas atribuídas a Jean, a Maria e sem responsável, **When** o usuário filtra por "Jean Zorzetti", **Then** só tarefas de Jean e ações do ranking (sem dono) aparecem na lista.
2. **Given** um filtro de responsável ativo, **When** o usuário limpa o filtro (chip "×" ou "limpar filtros"), **Then** todas as tarefas voltam a aparecer.
3. **Given** um filtro de responsável ativo, **When** a página é recarregada ou o link é compartilhado, **Then** o mesmo filtro continua aplicado (o filtro vive na URL, como os demais).

---

### Edge Cases

- Tarefa sem responsável definido: continua visível para os dois e não aparece quando um filtro de responsável específico está ativo (a não ser que exista uma opção "sem responsável").
- Ações do ranking (cards automáticos vindos de `data/projects.json`, sem linha no banco): nunca têm responsável atribuível — permanecem visíveis independente do filtro de responsável, do mesmo jeito que hoje ignoram outros filtros que não se aplicam a elas.
- Tarefa recorrente ou com data: o responsável é uma propriedade da tarefa, não da ocorrência — não muda entre execuções.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir escolher um responsável (Jean Zorzetti, Maria Zorzetti, ou nenhum) ao criar uma tarefa na agenda.
- **FR-002**: O sistema DEVE permitir alterar o responsável de uma tarefa existente ao editá-la.
- **FR-003**: O sistema DEVE persistir o responsável junto da tarefa, sobrevivendo a reload e a novas ocorrências de tarefas recorrentes.
- **FR-004**: O sistema DEVE exibir de forma visível, em cada card de tarefa, quem é o responsável (quando houver).
- **FR-005**: O sistema DEVE oferecer um filtro por responsável na barra de filtros existente, com as mesmas mecânicas dos filtros atuais (chip de filtro ativo, presença na URL, botão de limpar).
- **FR-006**: Tarefas sem responsável definido DEVEM continuar visíveis quando nenhum filtro de responsável estiver ativo.
- **FR-007**: Ações do ranking (cards derivados de `data/projects.json`, sem tarefa no banco) NÃO recebem responsável e permanecem visíveis independentemente do filtro de responsável.

### Key Entities

- **Tarefa (hub_tasks)**: ganha um atributo novo, responsável — quem (Jean, Maria ou ninguém) deve executar aquele card. Não afeta os atributos existentes (título, projeto, data, balde/tipo).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma tarefa criada com responsável definido aparece corretamente atribuída a essa pessoa em 100% dos casos, incluindo após reload da página.
- **SC-002**: Filtrar por um responsável reduz a lista às tarefas dele mais as ações sem dono, sem esconder nenhum balde (Conferência/Execução/Decisão) da tela.
- **SC-003**: Tarefas já existentes antes da mudança continuam aparecendo normalmente (sem responsável), sem exigir migração manual de dados.

## Assumptions

- Só existem dois responsáveis possíveis hoje (Jean Zorzetti e Maria Zorzetti); a lista não precisa ser configurável por um admin.
- "Responsável" é um campo simples (um valor por tarefa), não uma lista de múltiplos responsáveis por card.
- A separação pedida é por atribuição/filtro dentro da agenda atual (baldes de Conferência/Execução/Decisão continuam como estão) — não uma reestruturação em abas ou páginas separadas por pessoa.
- Ações do ranking (`data/projects.json`) não ganham responsável nesta feature; continuam compartilhadas entre os dois.
