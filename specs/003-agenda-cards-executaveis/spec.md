# Feature Specification: Separar a agenda por tipo de trabalho (Conferência / Execução / Decisão)

**Feature Branch**: `003-agenda-cards-executaveis`

**Created**: 2026-08-11 · **Reescrita**: 2026-08-29 · **Status**: Implementada

**Input** (11/08, primeira tese): "Eu quero que em `https://hub.roilabs.com.br/agenda` só tenha cards executaveis, crie uma nova pagina para os cards desse tipo"

**Input** (29/08, tese que prevaleceu): "Separe as tarefas de: 1. Conferência 2. Execução (escrita de codigo) 3. Decisão" — e, quando a resposta veio como relatório no terminal: "Eu pedi para separar no próprio `https://hub.roilabs.com.br/agenda`".

## Por que a tese de 11/08 foi substituída

A dor é a mesma das duas vezes: a agenda mistura coisas que exigem trabalho diferente, e o usuário reavalia card por card toda vez que abre a página. Mas o desenho de 11/08 não resolvia:

1. **Dois baldes eram poucos.** "Não-executável" juntava um gate de data (que só pede uma medição na data certa) com uma decisão travada do Jean (que não tem data nenhuma e não sai sozinha). São trabalhos diferentes — e o de decisão é o que trava projeto.
2. **Uma segunda página esconde em vez de separar.** O próprio spec de 11/08 reconhecia o risco ("cards que apodrecem escondidos já é um problema conhecido neste hub") e mesmo assim mandava metade dos cards para uma tela que ninguém abre de manhã.
3. **Excluir as tarefas do Postgres era o maior furo.** O spec assumia que "tarefa que o próprio usuário escreveu já é, por definição, uma ação assumida". Na prática, em 29/08 as tarefas do banco eram **28 dos 45 cards pendentes**, e **13 delas eram cards `Estado YYYY-MM-DD`** gerados pelo cron noturno — ninguém os escreveu à mão, e são conferência pura. Deixar o Postgres de fora deixaria o problema intacto em 62% da agenda.

## User Scenarios & Testing

### User Story 1 - Abrir a agenda e ver três tipos de trabalho (Priority: P1)

Como usuário do hub, ao abrir `/agenda` quero encontrar os cards agrupados pelo que eles exigem de mim — conferir um número, escrever código, ou decidir — para escolher o bloco de trabalho do dia sem reler 45 cards.

**Why this priority**: É o pedido central. Sem isso a feature não existe.

**Independent Test**: Abrir `/agenda` e confirmar que existem exatamente três seções, nesta ordem: Conferência, Execução, Decisão; e que a soma dos contadores é igual ao total de cards pendentes.

**Acceptance Scenarios**:

1. **Given** a agenda com cards de origens diferentes (tarefa datada, tarefa recorrente, card do cron noturno, ação do ranking), **When** a página carrega, **Then** cada card aparece em exatamente uma das três seções.
2. **Given** um card cujo título pede medição ("Remedir cliques não-branded", "Gate 28/07: medir posição branded"), **When** a página carrega, **Then** ele está em Conferência.
3. **Given** um card cujo título pede decisão ("Decidir se vira produto cobrável", "DECISÃO DO JEAN: o que o cyberspace vai ser?"), **When** a página carrega, **Then** ele está em Decisão.
4. **Given** qualquer outro card, **When** a página carrega, **Then** ele está em Execução — Execução é o balde padrão.

---

### User Story 2 - Não perder a urgência ao trocar o eixo (Priority: P1)

Como usuário do hub, quero continuar vendo o que está atrasado mesmo com a página agrupada por tipo — hoje as atrasadas são o sinal mais forte da agenda e não podem sumir na troca de eixo.

**Why this priority**: Mesma prioridade da US1 porque é a regressão que a US1 causaria sozinha. Em 29/08 havia 14 cards atrasados; perdê-los de vista seria trocar um problema por outro.

**Independent Test**: Com pelo menos um card vencido, abrir `/agenda` e confirmar que ele aparece no topo do seu balde, com marca visível de atraso, e que o cabeçalho do balde informa quantos atrasados há ali.

**Acceptance Scenarios**:

1. **Given** cards vencidos, de hoje, da semana e sem data no mesmo balde, **When** a seção renderiza, **Then** a ordem é atrasadas → hoje → próximos 7 dias → mais tarde → sem data.
2. **Given** um card vencido, **When** a linha renderiza, **Then** a data aparece marcada como atraso, e não apenas colorida (a cor sozinha não carrega o significado).
3. **Given** um balde com pelo menos um card atrasado, **When** o cabeçalho renderiza, **Then** ele informa a contagem de atrasados além do total.

---

### User Story 3 - Corrigir a classificação quando ela erra (Priority: P2)

Como usuário do hub, quando um card cair no balde errado, quero fixá-lo no balde certo sem reescrever o título — e quero enxergar que aquele card está fixado, para não confundir com o que a classificação decidiu sozinha.

**Why this priority**: Classificação derivada de texto erra. Sem correção, o usuário perde a confiança nos três baldes e a separação vira ruído. P2 porque a feature entrega valor mesmo com alguns cards no lugar errado.

**Independent Test**: Criar uma tarefa cujo título cairia em Execução, fixá-la em Decisão no seletor, recarregar e confirmar que ela aparece em Decisão com marca de fixada; depois devolvê-la a "automático" e confirmar que volta para Execução.

**Acceptance Scenarios**:

1. **Given** uma tarefa do banco, **When** o usuário escolhe um balde no seletor e salva, **Then** o card passa a aparecer nesse balde, independentemente do que o título diz.
2. **Given** uma tarefa com balde fixado, **When** a linha renderiza, **Then** existe marca visível de que o balde foi fixado à mão.
3. **Given** uma tarefa com balde fixado, **When** o usuário devolve o seletor para "automático" e salva, **Then** o card volta a ser classificado pelo título.
4. **Given** uma ação do ranking (`data/projects.json`), **When** o usuário abre o card, **Then** não há balde a fixar — a ação não tem linha no banco, e a correção dela é editar o `projects.json`.

---

### Edge Cases

- **Card com título vazio ou sem verbo reconhecível**: cai em Execução. Execução é o padrão, não um balde de sobra — o custo de olhar um card que não precisava de código é menor que o de esconder trabalho real numa aba de espera.
- **Título que cita medição no passado** ("stub em 302, medido em 30/07"): não é conferência. O particípio conta o histórico do card, não o que falta fazer.
- **Título que contém as duas coisas** ("Gate 31/08: decidir se religa"): vai para Decisão. Decisão pendente trava a medição; o inverso não é verdade.
- **Card do cron noturno** (`Estado YYYY-MM-DD`): é conferência por construção, e não depende da classificação por texto — o cron grava o balde na origem.
- **Texto da ação muda no `projects.json`** (ex.: `dourado-estado.mjs` atualiza um número): a classificação é recalculada a cada carregamento, nunca congela.
- **Balde fica vazio**: a seção continua aparecendo, dizendo que está vazia. Sumir com a seção esconderia a informação de que não há nada a decidir — que é uma informação boa.

## Requirements

### Functional Requirements

- **FR-001**: O sistema MUST classificar todo card pendente de `/agenda` — tarefas do Postgres (datadas, recorrentes e sem data) e ações do ranking — em exatamente um de três baldes: Conferência, Execução, Decisão.
- **FR-002**: `/agenda` MUST renderizar os três baldes na mesma página, nesta ordem: Conferência, Execução, Decisão, cada um com a contagem de cards.
- **FR-003**: A classificação MUST derivar do título do card, não da descrição — a descrição destes cards é um diário de bordo do que já foi feito e classificaria o card pelo passado.
- **FR-004**: Quando o título indicar decisão e conferência ao mesmo tempo, o sistema MUST classificar como Decisão.
- **FR-005**: Execução MUST ser o balde padrão de qualquer título que não caia nas outras duas regras.
- **FR-006**: Dentro de cada balde, os cards MUST ser ordenados por urgência de data: atrasadas, hoje, próximos 7 dias, mais tarde, sem data.
- **FR-007**: Card atrasado MUST ser marcado de forma perceptível sem depender de cor, e o cabeçalho do balde MUST informar quantos atrasados ele contém.
- **FR-008**: Uma tarefa do Postgres MUST poder ter o balde fixado à mão, e esse valor MUST prevalecer sobre a classificação derivada.
- **FR-009**: Tarefa com balde fixado MUST exibir marca visível dessa condição, distinguindo-a das classificadas automaticamente.
- **FR-010**: O balde fixado MUST ser removível — devolver ao automático faz o card voltar a ser classificado pelo título.
- **FR-011**: Ações do ranking MUST ser sempre classificadas de forma derivada — não têm linha no banco, logo não têm onde guardar override.
- **FR-012**: O card gravado pela corrida noturna (`/api/estado`) MUST nascer com o balde Conferência fixado na origem, sem depender da classificação por texto.
- **FR-013**: A classificação MUST ser recalculada a cada carregamento — nenhum balde derivado é persistido.
- **FR-014**: O valor de balde recebido do formulário MUST ser validado contra a lista de baldes conhecidos; valor desconhecido ou vazio equivale a "automático".

### Key Entities

- **Card da agenda**: tarefa do Postgres (`hub_tasks`) ou ação de projeto curado (`data/projects.json`). Ganha dois rótulos derivados a cada leitura — o **balde** (o que o card exige) e a **urgência** (quando) — que são eixos independentes.
- **Balde fixado**: campo opcional da tarefa do Postgres. Ausente na esmagadora maioria; existe para a exceção em que a derivação erra.

## Success Criteria

- **SC-001**: Abrindo `/agenda`, o usuário identifica em uma olhada quantos cards exigem conferir, quantos exigem escrever código e quantos estão travados numa decisão dele.
- **SC-002**: Nenhum card pendente desaparece: a soma das três seções é igual ao total de cards pendentes que a página mostrava antes da mudança.
- **SC-003**: Um card atrasado continua identificável como atrasado em no máximo 1 rolagem até seu balde — nenhuma informação de urgência foi perdida na troca de eixo.
- **SC-004**: Um card classificado errado é corrigido em no máximo 3 interações (abrir, escolher balde, salvar), sem editar o texto do card.
- **SC-005**: Quando o texto de um card muda, o balde acompanha no carregamento seguinte, sem intervenção manual.

## Assumptions

- Os três nomes são os do usuário ("Conferência", "Execução", "Decisão") e não devem ser renomeados sem pedido — são o vocabulário com que ele já pensa a agenda.
- Uma classificação derivada de texto erra em alguns cards, e isso é aceitável **porque** existe o override do FR-008. Se o override virar regra em vez de exceção, o defeito é da regra de classificação, e ela deve ser trocada — não remendada caso a caso.
- O eixo de data continua existindo dentro de cada balde (FR-006), então nenhuma informação da agenda anterior foi descartada: o que era seção virou ordenação.
- A tese de 11/08 (segunda página para cards represados) fica **descartada**, não adiada. Se a lista de Decisão crescer a ponto de atrapalhar, a resposta é decidir os itens, não movê-los para outra tela.
