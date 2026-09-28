# Feature Specification: O plano só fala do futuro — núcleo de clusters, backlog priorizado e ligação com o OKR

**Feature Branch**: `058-plano-so-futuro`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: estrutura pedida pelo Jean em 28/09/2026 para `/gsc/mapa/tapepro/plano`:
*"1. Um núcleo único: mapa de tópicos e entidades. Cada cluster carrega intenção de busca, página
responsável, perguntas associadas, entidades citadas e status. […] 4. Backlog priorizado. Tarefas geradas
pelos gaps, com impacto × esforço, responsável, prazo e status. É isso que transforma 'painel' em
'planejador'. 5. Medição com baseline e meta, ligada aos OKRs do hub."* E a regra que corta tudo:
*"O objetivo único da página `/plano` é planejar. Por definição, planejar é referente ao futuro, não ao
presente ou passado."* Escopo confirmado pelo dono no mesmo dia: tirar do `/plano` o que é presente ou
passado, e acrescentar o núcleo, o backlog com impacto × esforço e a ligação com o OKR.

## O fato que abre esta spec

Lido no código e na tela em 28/09/2026:

1. **O `/plano` mistura três tempos.** Ao lado das metas (futuro), ele imprime o ponto de partida "Hoje:
   X% · distância até a meta" (presente), o estado de cada página que cobre um cluster (ativa, fora do
   índice: presente), "feito em DD/MM (marca do mapa)" (passado), quem aprovou cada meta e quando
   (passado) e a lista das versões anteriores (passado). O mapa já é a tela do presente e do passado;
   o plano repete parte dele.
2. **O ponto de partida é a única razão de o plano ler o Search Console por termo ao abrir.** As metas
   propostas não dependem dele: ele só anota a distância ao lado da meta.
3. **O cluster só tem volume e página.** Não tem intenção, nem perguntas, nem entidades. Ele é montado
   a cada abertura a partir da demanda congelada e do crawl, e não guarda nenhuma decisão do dono além
   de mover ou excluir termo. AEO e GEO não têm onde se pendurar.
4. **Não existe backlog.** As tarefas do plano são só páginas a criar e a indexação ou posição de página
   existente (057 FR-007a). As alavancas que o mapa dispara ficam no mapa (057 FR-011a). Nenhuma tarefa
   tem impacto nem esforço. O responsável é um só por versão, e a ordem é só a dos degraus da 054.
5. **O plano não conversa com o OKR.** A meta de cliques aos 180 dias não diz se basta para o que a
   árvore de metas de `/okr/{slug}` exige. As duas telas projetam o futuro do mesmo projeto sem se ver.
6. **Tape Pro, 28/09:** 0 de 23 URLs indexadas, 2 páginas de cluster, 46 termos na demanda congelada
   (15.560 buscas/mês), perfil B no OKR, sem GA4.

## Clarifications

### Session 2026-09-28

- Q: Em que unidade o esforço é medido, e o que ele limita por semana? → A: Em **horas**. A capacidade
  vira **horas por semana por pessoa** (Jean e Maria), e toda tarefa do backlog ocupa essa capacidade,
  não só a criação de página. O limite de 3 páginas novas por semana da 057 sai. O dono declara a
  estimativa padrão por alavanca e as horas de cada pessoa (FR-025, FR-025a).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — O plano só fala do que vai acontecer (Priority: P1)

O dono abre `/gsc/mapa/tapepro/plano` e lê só futuro: as metas com prazo, os clusters a atender, o
backlog e as semanas que ainda vão acontecer. Nenhuma leitura de hoje, nenhuma marca de feito, nenhum
histórico. Quando quer saber onde o projeto está, vai ao mapa, que continua mostrando tudo o que saiu do
plano.

**Why this priority**: é a definição da tela, dada pelo dono. É também a parte mais barata: tirar, não
construir.

**Independent Test**: abrir o plano da Tape Pro e não achar "Hoje:", "distância até a meta", estado de
página, "feito em", autor ou data de decisão, nem versão anterior. Abrir o mapa da Tape Pro e achar o
ponto de partida das metas de demanda, o estado das páginas dos clusters e as marcas de feito.

**Acceptance Scenarios**:

1. **Given** uma meta de demanda com ponto de partida lido, **When** o dono abre o plano, **Then** a
   meta mostra valor, prazo, origem e a conta, e não mostra o ponto de partida nem a distância.
2. **Given** uma página existente fora do índice, **When** o plano é montado, **Then** o plano mostra a
   tarefa futura que isso gera ("semana 1: consertar o índice de /produtos/fita-gomada") e não o estado
   da página.
3. **Given** uma tarefa com marca de feito vigente (055), **When** o dono abre o plano, **Then** a
   tarefa não aparece. **When** vence a data de reler e a regra ainda dispara, **Then** ela volta como
   tarefa futura.
4. **Given** um plano na semana 5, **When** o dono abre o calendário, **Then** ele começa na semana 5.
5. **Given** o mesmo projeto, **When** o dono abre o mapa, **Then** o mapa mostra o ponto de partida e a
   distância das metas de demanda, o estado das páginas que cobrem os clusters e as marcas de feito.

---

### User Story 2 — O núcleo: cada cluster diz o que vai atender (Priority: P1)

Cada cluster do plano vira a ficha do que será feito para ele: a intenção de busca que a página vai
atender, a página responsável (existente ou a criar), as perguntas que ela vai responder, as entidades que
ela vai citar e a próxima tarefa planejada. É o pai comum de SEO, AEO e GEO: uma decisão do dono no
cluster vale para os três.

**Why this priority**: sem o núcleo, cada pilar vira ilha (palavras do dono). É também o briefing da
tarefa de criar ou ajustar a página.

**Independent Test**: abrir o cluster "fita gomada" da Tape Pro e ler intenção, página responsável,
perguntas, entidades e a próxima tarefa, e mudar a intenção proposta sem sair da tela.

**Acceptance Scenarios**:

1. **Given** um cluster com termos, **When** o plano é montado, **Then** o hub propõe a intenção com a
   mesma regra que já classifica a intenção de título e consulta, e o dono confirma ou troca.
2. **Given** termos congelados em forma de pergunta ("como", "qual", "quanto", "onde", "o que", "por
   que", "para que"), **When** o plano é montado, **Then** eles aparecem como perguntas propostas do
   cluster, e o dono aceita, edita, acrescenta ou tira.
3. **Given** um cluster, **When** o dono declara as entidades que a página vai citar (produto, material,
   aplicação, norma, marca própria), **Then** elas ficam gravadas no cluster.
4. **Given** um cluster com intenção, perguntas e entidades, **When** o dono cria uma nova versão do
   plano, **Then** nada disso se perde.
5. **Given** um cluster sem nenhuma tarefa futura, **When** o dono abre o núcleo, **Then** o cluster diz
   "nada planejado", sem dizer por quê em termos de leitura.

---

### User Story 3 — Backlog priorizado (Priority: P2)

O plano tem uma lista única com toda tarefa futura do projeto, de qualquer origem: página de cluster,
página de apoio, indexação ou posição de página existente, pergunta sem resposta planejada e card que o
mapa dispara hoje. Cada tarefa tem impacto, esforço, responsável, prazo e estado, e a lista vem na ordem
em que vale a pena fazer.

**Why this priority**: é o que transforma painel em planejador (palavras do dono). Depende do núcleo
(US2) para calcular impacto e gerar as tarefas de pergunta.

**Independent Test**: abrir o backlog da Tape Pro, ler a primeira tarefa com impacto em cliques/mês,
esforço, responsável e prazo, trocar o responsável e ver a troca sobreviver a uma nova montagem do plano.

**Acceptance Scenarios**:

1. **Given** um card que o mapa dispara hoje, sem marca de feito vigente, **When** o plano é montado,
   **Then** ele entra no backlog como tarefa (alavanca e alvos), sem a leitura que o disparou.
2. **Given** uma pergunta do núcleo que a página responsável não responde, **When** o plano é montado,
   **Then** o backlog ganha a tarefa de cobrir a pergunta na página (alavanca "cobertura") e, depois
   dela, a de schema na mesma página (alavanca "schema").
3. **Given** duas tarefas na mesma página, de degraus diferentes (por exemplo, índice e snippet),
   **When** o backlog é ordenado, **Then** a do degrau anterior vem primeiro, qualquer que seja o
   impacto.
4. **Given** duas tarefas em páginas diferentes, sem dependência entre si, **When** o backlog é
   ordenado, **Then** vem primeiro a de maior impacto por esforço.
5. **Given** uma tarefa cujo alvo não pertence a nenhum cluster, **When** o impacto é calculado,
   **Then** ele sai "não calculável: alvo fora dos clusters", nunca 0.
6. **Given** uma tarefa com responsável ou esforço editados pelo dono, **When** o plano é remontado ou
   ganha nova versão, **Then** a edição continua lá enquanto a tarefa (mesma alavanca, mesmo alvo)
   existir.
7. **Given** Jean com 6 horas por semana e três tarefas dele de 3 horas cada, **When** o plano agenda,
   **Then** duas entram na semana corrente e a terceira na seguinte, na ordem do backlog.

---

### User Story 4 — O plano diz se basta para o OKR (Priority: P3)

Ao lado da meta de cliques aos 180 dias, o plano mostra quantos cliques por mês a árvore de metas do
`/okr/{slug}` exige para a meta que o dono declarou lá, e quanto do exigido o plano cobre. Os dois números
são futuro: o que o plano projeta e o que o OKR pede.

**Why this priority**: é a ligação com os OKRs que o dono pediu. Vem por último porque depende de o OKR
do projeto ter meta declarada, e a Tape Pro pode não ter.

**Independent Test**: num projeto com meta declarada no OKR, ler numa linha "o plano projeta X
cliques/mês aos 180 dias; o OKR exige Y; o plano cobre Z% do exigido".

**Acceptance Scenarios**:

1. **Given** um OKR com meta declarada e exigência de cliques calculada pela árvore de metas, **When** o
   dono abre o plano, **Then** a meta de cliques aos 180 dias mostra a exigência e a fração coberta, com
   link para o OKR.
2. **Given** um OKR sem meta declarada, ou com a árvore parada antes dos cliques, **When** o dono abre o
   plano, **Then** a linha diz "o OKR de {projeto} não exige cliques ainda: nada a comparar", com o
   motivo que o OKR já dá, e nunca inventa número.

---

### Edge Cases

- **Mapa sem leitura** (falha do Search Console, banco fora): o backlog diz "as tarefas que o mapa
  dispara não entraram: {motivo}" como consequência para o plano, e monta o resto.
- **Insumo ausente que muda o plano** (sem leitura de impressões por página): o aviso diz a consequência
  futura ("nenhuma página existente conta nas metas até a próxima leitura"), nunca a leitura.
- **O dono troca a página responsável de um cluster**: as tarefas da página antiga saem do backlog, com
  as edições delas. As do cluster que não dependem de página ficam.
- **Pergunta que outra página do site já responde**: o dono aponta essa página como a que responde, e a
  tarefa não é gerada.
- **Termo em forma de pergunta e de marca**: fica fora, como já fica fora da demanda.
- **Todas as tarefas da semana corrente com marca de feito**: "Esta semana" diz "nada mais planejado
  para esta semana" e mostra a próxima semana com tarefa.
- **Plano que ainda não começou**: o calendário começa na semana 1, na data de início.
- **Versão em rascunho**: o plano mostra a versão ativa e o rascunho em edição, nenhuma outra.
- **OKR com horizonte diferente do plano**: a comparação usa cliques por mês no prazo de 180 dias do
  plano contra a exigência mensal do OKR, e diz os dois horizontes.

## Requirements *(mandatory)*

### Functional Requirements

**Parte A — só futuro**

- **FR-001**: O `/plano` NÃO DEVE mostrar leitura do presente nem do passado: ponto de partida e
  distância das metas, estado atual das páginas (ativa, indexada sem impressão, fora do índice, sem
  leitura), marca de feito e data dela, autor e data das decisões de meta, versões anteriores e semanas
  já passadas.
- **FR-002**: O presente PODE entrar no plano como insumo: o estado da página continua decidindo o
  agendamento (057 FR-007a) e os cards do mapa continuam gerando tarefa. O plano mostra só a consequência
  futura (a tarefa, a semana, o que ela move), nunca a leitura que a causou.
- **FR-003**: Tudo o que sai do plano DEVE continuar legível no mapa do projeto: o ponto de partida e a
  distância das metas de demanda (inclusive a projeção de termos na página 1), o estado das páginas que
  cobrem clusters e as marcas de feito. Nada se perde; muda de tela.
- **FR-004**: Tarefa com marca de feito vigente (055) DEVE sair do plano. Ela volta como tarefa futura
  quando vence a data de reler e a regra da 054 ainda dispara.
- **FR-005**: O calendário DEVE começar na semana corrente (ou na semana 1, se o plano ainda não
  começou). O bloco "Esta semana" fica: é a próxima execução.
- **FR-006**: O plano DEVE mostrar só a versão ativa e, se existir, o rascunho em edição, com o estado
  de cada meta (proposta, aprovada, editada, recusada). Quem decidiu e quando continua gravado (057
  FR-009) e sai da tela. As versões anteriores continuam gravadas (057 FR-017) e saem da tela.
- **FR-007**: Abrir o plano NÃO DEVE ler o Search Console por termo. A leitura de impressões por página
  continua, porque decide o agendamento (FR-002).
- **FR-008**: A procedência da demanda congelada (fonte, região, data da consulta, custo) fica: é a
  origem do insumo, não uma leitura do site.

**Parte B — núcleo**

- **FR-010**: Cada cluster DEVE carregar: intenção de busca, página responsável, perguntas que a página
  vai responder, entidades que ela vai citar e a próxima tarefa planejada (ou "nada planejado").
- **FR-011**: A intenção DEVE usar as classes que o hub já usa para título e consulta (informacional,
  comercial, ambos). O hub propõe a partir dos termos do cluster com a mesma regra, e o dono confirma ou
  troca. Nenhuma taxonomia nova.
- **FR-012**: A página responsável DEVE ser a página que cobre o cluster (057 FR-007b) ou a página
  planejada pelo calendário. O dono pode apontar outra página do site.
- **FR-013**: As perguntas propostas DEVEM sair dos termos da demanda congelada que começam por palavra
  interrogativa (como, qual, quanto, onde, o que, por que, para que). O dono aceita, edita, acrescenta ou
  tira. Nenhuma fonte paga de perguntas nesta spec.
- **FR-014**: As entidades DEVEM ser declaradas pelo dono (produto, material, aplicação, norma, marca
  própria ou outra). Nenhuma extração automática nesta spec.
- **FR-015**: Intenção, perguntas, entidades e página responsável apontada pelo dono DEVEM sobreviver a
  nova versão do plano e a nova consulta de demanda, enquanto o cluster existir. Cada decisão grava quem
  e quando.
- **FR-016**: A tarefa de criar ou ajustar a página de um cluster DEVE trazer intenção, perguntas e
  entidades do cluster como briefing.

**Parte C — backlog**

- **FR-020**: O plano DEVE ter um backlog único com toda tarefa futura do projeto: página de cluster,
  página de apoio, indexação ou posição de página existente (057 FR-007a), pergunta sem resposta
  planejada (FR-022) e card que o mapa dispara hoje sem marca de feito vigente. Isso substitui o
  "aponta para o mapa" da 057 FR-011a.
- **FR-021**: Toda tarefa DEVE ser uma alavanca existente da 054 aplicada a um alvo. Nenhuma alavanca
  nova. A mesma alavanca no mesmo alvo vira uma tarefa só, com as origens somadas.
- **FR-022**: Uma pergunta do núcleo que a página responsável não responde DEVE gerar a tarefa
  "cobertura" (seção que responde a pergunta) na página e, depois dela, a tarefa "schema" na mesma
  página. A pergunta conta como respondida quando o dono marca a tarefa como feita (055).
- **FR-023**: Cada tarefa DEVE ter impacto, esforço, responsável (Jean ou Maria), prazo e estado.
- **FR-024**: O impacto DEVE ser os cliques por mês projetados aos 180 dias para os termos que a tarefa
  move: o volume dos termos que a página alvo cobre ou vai cobrir, vezes a fração de clique da régua na
  posição-alvo de 180 dias (a mesma conta da meta de cliques da 057). A conta fica à mostra. Tarefa cujo
  alvo não pertence a nenhum cluster tem impacto "não calculável", com o motivo, nunca 0.
- **FR-025**: O esforço DEVE ser medido em horas e vir de uma estimativa padrão por alavanca, declarada
  pelo dono com o selo "◇ política do dono, sem fonte", editável por tarefa.
- **FR-025a**: A capacidade DEVE ser declarada em horas por semana por pessoa (Jean e Maria), com o selo
  "◇ política do dono, sem fonte". Uma tarefa entra na semana do responsável dela, na ordem do backlog
  (FR-026), enquanto couber nas horas dele; a que não cabe vai para a semana seguinte. Tarefa maior que a
  capacidade semanal inteira do responsável fica "a fazer", com o aviso "não cabe numa semana de
  {pessoa}: dividir ou trocar o responsável". Isso substitui o limite de páginas novas por semana da 057
  FR-010. Sem capacidade declarada, nenhuma tarefa é agendada, e o plano diz isso antes de qualquer
  tarefa (como a 057 FR-018).
- **FR-026**: A ordem do backlog DEVE respeitar a dependência por alvo: numa mesma página, a tarefa de
  degrau anterior (índice → desempenho → página certa → posição → snippet) vem antes; tarefa que depende
  de página não vem antes da página nascer (057 FR-012). Entre tarefas sem dependência, vem primeiro a de
  maior impacto por esforço; impacto "não calculável" vai para o fim do seu degrau.
- **FR-027**: O estado de uma tarefa DEVE ser um de três, todos futuros: **agendada** (tem semana),
  **a fazer** (sem semana: passou do prazo de 180 dias na capacidade declarada, ou não cabe numa semana)
  ou **bloqueada** (espera outra tarefa, que é nomeada).
- **FR-028**: O prazo DEVE ser a semana em que a tarefa está agendada. O dono pode fixar uma data, e a
  data fixa vence a ordem.
- **FR-029**: Responsável, esforço e data fixa editados pelo dono DEVEM sobreviver a remontagem e a nova
  versão do plano, enquanto a tarefa (mesma alavanca, mesmo alvo) existir.

**Parte D — OKR**

- **FR-030**: A meta de cliques aos 180 dias DEVE mostrar a exigência de cliques por mês que a árvore de
  metas do `/okr/{slug}` calcula para a meta declarada lá, a fração que o plano cobre e o link para o
  OKR.
- **FR-031**: Sem meta declarada no OKR, ou com a árvore parada antes dos cliques, a linha DEVE dizer que
  não há o que comparar, com o motivo que o OKR já dá. Nenhum número é inventado nem trazido de faixa de
  mercado.

**Transversal**

- **FR-040**: As regras DEVEM ser as mesmas para todos os projetos com mapa. Nada escrito por projeto.
- **FR-041**: O plano DEVE ser legível por teclado e leitor de tela, e nenhum estado pode ser dito só
  por cor (como a 057 FR-020).

### O que muda na 057

- Clarify "Onde o plano lê o ponto de partida? → Na tela do plano": passa a ser **no mapa** (FR-003).
- US4 cenário 1 ("cada meta de demanda mostra o ponto de partida lido e a distância"): passa para o mapa.
- FR-011a: a semana corrente do plano deixa de só apontar para o mapa; os cards entram no backlog
  (FR-020). O bloco "Plano · semana N" do mapa continua.
- FR-010: a capacidade deixa de ser "páginas novas por semana" e passa a ser horas por semana por
  pessoa, consumidas por toda tarefa (FR-025a). A sugestão de subir a capacidade quando a indexação limpa
  das páginas novas passar de 90% sai junto.
- FR-014: o responsável passa a ser por tarefa (FR-023), com o da versão como padrão.
- FR-017 "as anteriores ficam legíveis": continuam gravadas, fora da tela do plano (FR-006).

### Key Entities

- **Cluster (núcleo)**: grupo de termos da demanda congelada. Ganha intenção, página responsável,
  perguntas e entidades, que persistem entre versões e consultas. A próxima tarefa é derivada, não
  gravada.
- **Pergunta**: texto, origem (termo congelado ou dono), cluster, página que responde (a responsável ou
  outra apontada pelo dono).
- **Entidade**: nome, tipo (produto, material, aplicação, norma, marca própria, outra), cluster.
- **Tarefa**: alavanca da 054 + alvo. Tem origens (calendário, card do mapa, pergunta), impacto com a
  conta, esforço, responsável, prazo, estado e a tarefa que a bloqueia. Derivada a cada montagem; só as
  edições do dono são gravadas, pela chave alavanca + alvo.
- **Esforço padrão**: horas por alavanca, com selo de política do dono. Pertence à versão do plano.
- **Capacidade**: horas por semana de cada pessoa, com selo de política do dono. Pertence à versão do
  plano.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O plano da Tape Pro não tem nenhuma das leituras de FR-001. Um teste sobre o que a tela
  recebe reprova se aparecer ponto de partida, estado de página, marca de feito, autor ou data de
  decisão, versão anterior ou semana passada.
- **SC-002**: Tudo o que saiu do plano aparece no mapa da Tape Pro: ponto de partida das três metas de
  demanda, estado das páginas dos clusters e marcas de feito.
- **SC-003**: 100% dos clusters da Tape Pro mostram intenção, página responsável, perguntas (ou "nenhuma
  declarada"), entidades (ou "nenhuma declarada") e próxima tarefa (ou "nada planejado").
- **SC-004**: 100% das tarefas do backlog têm impacto (ou "não calculável" com motivo), esforço,
  responsável, prazo e estado. Nenhuma tarefa tem impacto 0 por falta de dado.
- **SC-005**: Todo card que o mapa da Tape Pro dispara na mesma leitura, sem marca de feito vigente,
  está no backlog. A contagem de alavancas bate com a do mapa.
- **SC-006**: Nenhuma tarefa vem antes de outra de degrau anterior na mesma página. Um teste reprova se
  vier.
- **SC-007**: Uma edição de responsável, esforço ou data fixa sobrevive a uma nova versão do plano. Um
  teste reprova se ela se perder.
- **SC-007a**: Nenhuma semana do plano soma mais horas de uma pessoa do que a capacidade declarada
  dela. Um teste reprova se somar.
- **SC-008**: Num projeto com meta declarada no OKR, o dono responde "o plano entrega os cliques que o
  OKR pede?" lendo uma linha do plano, sem abrir o OKR.
- **SC-009**: Abrir o plano faz uma leitura externa a menos do que hoje: nenhuma leitura do Search
  Console por termo.

## Assumptions

- **A regra do dono (28/09/2026)**: `/plano` = futuro; mapa = presente e passado; `/okr` = resultado. O
  presente entra como insumo e nunca como leitura na tela do plano.
- **"Esta semana" é futuro imediato** e fica. A procedência da demanda também fica (FR-008).
- **Perguntas sem fonte paga**: People Also Ask exigiria a SERP paga da DataForSEO, e a exceção de 28/09
  vale só para volume de busca. As perguntas saem dos termos congelados e do dono. Na Tape Pro, com 0
  impressão, perguntas do Search Console viriam vazias.
- **Schema de pergunta**: desde 2023 o Google só mostra o resultado enriquecido de FAQ para sites de
  governo e saúde, e aposentou o de HowTo. A tarefa "schema" gerada por pergunta serve para os buscadores
  e os modelos de IA extraírem a resposta, não para ganhar destaque no Google.
- **Entidades**: declaradas agora porque o núcleo é o pai comum; quem as consome (consistência fora do
  site, citação em LLM) é a spec de GEO.
- **Impacto em cliques projetados**: usa a mesma régua de CTR e a mesma posição-alvo de 180 dias da
  057, sem número novo.
- **A comparação planejado × lido** (057 US3) já mora no mapa e não muda.
- **Tape Pro**: com 0 de 23 URLs indexadas, o backlog vai começar dominado pela indexação. É o esperado,
  não um defeito.

## Fora do escopo

- **GEO e AIO**: banco de prompts, share of voice em LLM, fontes citadas pelos modelos, consistência da
  entidade fora do site (Google Business, LinkedIn, diretórios, Wikidata). Spec separada, que começa pelo
  instrumento de medição (decisão de 28/09).
- **People Also Ask** e qualquer SERP paga.
- **Backlinks pagos** e coletor de domínios referenciadores.
- **Conversão por landing page**: fica no `/okr/{slug}`.
- **Alavanca nova** de qualquer tipo.
- Executar tarefa no site: o hub planeja, não altera site.
