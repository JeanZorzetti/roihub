# Feature Specification: Quadros de Marketing e Ideias

**Feature Branch**: `006-quadros-marketing-ideias`

**Created**: 2026-08-29

**Status**: Draft

**Input**: User description: "Criar duas abas no roihub — Marketing e Ideias — para todo o ecossistema de empresas registrado no hub. A de Marketing (voltada para a Maria) recebe as demandas de execução, planejamento e estratégia de publicação (blog, Instagram, Facebook) e o que ela precisa estudar para dominar o assunto. A de Ideias (Maria e Jean) recebe planejamento de sites e serviços novos e melhorias em produtos que já existem. Nada sai desses quadros para a execução a não ser que alguém mande manualmente."

## Contexto

A Agenda do hub é uma lista de **compromissos**: tudo lá tem data, urgência e atrasa. Falta um lugar para o que ainda **não é compromisso** — a pauta que talvez vire post, a ideia de produto que talvez vire projeto, o processo que precisa ficar escrito.

Esta feature cria esse lugar como **dois quadros**, cada um com o público e o vocabulário do seu dono, e com uma garantia central: **um card de quadro nunca vira tarefa sozinho**. Ele fica no quadro até uma pessoa decidir o contrário.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quadro de Ideias (Priority: P1)

Jean e Maria registram ideias de produto — um site novo, um serviço novo, uma melhoria num produto que já existe — em seções que separam o tipo de ideia. Podem editar, mover de seção e arquivar. Nada disso aparece na Agenda nem no ranking.

**Why this priority**: É o menor pedaço que já entrega valor sozinho e o único que não depende de nenhum dos outros. Hoje essas ideias vivem em conversa e se perdem. Também é o quadro mais simples (sem data, sem imagem, sem calendário), então valida o modelo de card e de seção antes de qualquer investimento maior.

**Independent Test**: Criar três ideias em seções diferentes, mover uma de seção, arquivar outra, recarregar a página e confirmar que as três estão onde deveriam — e que a Agenda continua exatamente como estava.

**Acceptance Scenarios**:

1. **Given** o quadro de Ideias vazio, **When** o usuário cria um card com título, descrição, projeto do ecossistema e responsável, **Then** o card aparece na seção escolhida e continua lá depois de recarregar.
2. **Given** um card na seção "Melhoria", **When** o usuário escolhe outra seção e confirma, **Then** o card passa a aparecer na seção nova e some da anterior.
3. **Given** um card ativo, **When** o usuário clica em arquivar, **Then** o card sai da lista principal e passa a aparecer numa seção recolhida de arquivados.
4. **Given** cards de vários projetos e responsáveis, **When** o usuário aplica um filtro, **Then** só os cards correspondentes aparecem, e o filtro sobrevive ao recarregar e pode ser passado adiante como link.
5. **Given** qualquer card criado no quadro de Ideias, **When** o usuário abre a Agenda ou o ranking, **Then** esse card não aparece em nenhum dos dois.

---

### User Story 2 - Quadro de Marketing em fluxo (Priority: P2)

Maria registra as demandas de marketing de qualquer empresa do ecossistema num quadro de colunas que representam o andamento do trabalho, e move o card de coluna conforme ele avança até a publicação.

**Why this priority**: É a metade do pedido que tem dona esperando. Depende do modelo de card entregue na US1, mas é independente das colunas editáveis, das imagens, do calendário e da documentação — funciona com um conjunto inicial de colunas.

**Independent Test**: Criar um card de marketing escolhendo canal e projeto, movê-lo pelas colunas até a última, e confirmar que a posição sobrevive ao recarregar.

**Acceptance Scenarios**:

1. **Given** o quadro de Marketing, **When** o usuário cria um card com título, descrição, projeto, responsável, canal e data de publicação, **Then** o card aparece na primeira coluna com o canal visível.
2. **Given** um card em qualquer coluna, **When** o usuário escolhe outra coluna e confirma, **Then** o card passa para ela imediatamente, sem recarregar a página à mão.
3. **Given** cards espalhados pelas colunas, **When** o usuário filtra por projeto, canal ou responsável, **Then** todas as colunas continuam visíveis na tela, mesmo as que ficaram vazias pelo filtro.
4. **Given** um card sem projeto definido, **When** ele é salvo, **Then** é aceito como demanda transversal (não é obrigado a pertencer a uma empresa).

---

### User Story 3 - Colunas e seções editáveis (Priority: P3)

Maria e Jean mudam as colunas do quadro sem depender de ninguém: acrescentam uma etapa nova, renomeiam, mudam a ordem e removem a que não usam mais.

**Why this priority**: O conjunto inicial de colunas é um palpite. Sem esta história, ajustar o fluxo depende de alguém programar e publicar uma versão nova — que é exatamente o atrito que o quadro existe para eliminar. Vem depois da US2 porque o quadro precisa existir antes de ser configurável.

**Independent Test**: Adicionar uma coluna, renomeá-la, movê-la de posição, tentar apagar uma coluna com card dentro e confirmar que a remoção é recusada com o motivo.

**Acceptance Scenarios**:

1. **Given** um quadro com as colunas iniciais, **When** o usuário adiciona uma coluna nova, **Then** ela aparece no quadro e passa a ser um destino válido para mover cards, sem nenhuma publicação de versão.
2. **Given** uma coluna com cards dentro, **When** o usuário tenta removê-la, **Then** a remoção é recusada e a mensagem diz quantos cards precisam ser movidos antes.
3. **Given** uma coluna vazia, **When** o usuário a remove, **Then** ela some do quadro e deixa de ser oferecida como destino.
4. **Given** uma coluna com cards dentro, **When** o usuário a renomeia, **Then** os cards continuam nela — nenhum card é perdido ou realocado pela renomeação.
5. **Given** um quadro com quatro colunas, **When** o usuário move uma coluna para a esquerda ou direita, **Then** a nova ordem vale para todos e sobrevive ao recarregar.

---

### User Story 4 - Arte da publicação anexada ao card (Priority: P4)

Maria anexa ao card as imagens do post que já produziu — inclusive um carrossel inteiro, em ordem — para que a arte esteja junto da demanda no dia de publicar.

**Why this priority**: É o que faz o card virar material de trabalho em vez de lembrete. Depende de o card existir, mas nenhuma outra história depende dela.

**Independent Test**: Anexar dez imagens a um card, conferir que aparecem na ordem dos slides, reordenar duas, remover uma e recarregar.

**Acceptance Scenarios**:

1. **Given** um card de marketing, **When** o usuário anexa uma imagem em formato aceito e dentro do limite de tamanho, **Then** ela aparece no card e continua lá depois de recarregar.
2. **Given** um card com várias imagens, **When** o usuário as visualiza, **Then** elas aparecem na ordem definida, e cada uma mostra nome e tamanho.
3. **Given** um card com um carrossel, **When** o usuário reordena ou remove um slide, **Then** a mudança vale imediatamente e a ordem dos demais é preservada.
4. **Given** um arquivo em formato não aceito ou acima do limite, **When** o usuário tenta anexá-lo, **Then** o envio é recusado e a mensagem diz o motivo — o card não fica em estado inconsistente.
5. **Given** um card com imagens, **When** o card é apagado, **Then** as imagens dele são apagadas junto, sem sobrar arquivo órfão ocupando espaço.

---

### User Story 5 - Calendário de publicação (Priority: P5)

Maria vê num mês inteiro o que está marcado para publicar, em vez de deduzir isso lendo card por card.

**Why this priority**: Transforma a data que já é registrada no card numa visão de planejamento. Depende de os cards terem data (US2), mas nada depende dela.

**Independent Test**: Marcar datas em cards de meses diferentes, abrir o calendário e navegar entre os meses conferindo que cada card aparece no dia certo.

**Acceptance Scenarios**:

1. **Given** cards com data de publicação, **When** o usuário abre a vista de calendário, **Then** vê a grade do mês com cada card no seu dia e o canal identificado.
2. **Given** o calendário aberto, **When** o usuário navega para o mês anterior ou seguinte, **Then** vê os cards daquele mês e os filtros aplicados continuam valendo.
3. **Given** um card sem data, **When** o calendário é exibido, **Then** ele não aparece em dia nenhum e continua acessível no quadro.
4. **Given** o calendário aberto, **When** o usuário compartilha o endereço da página, **Then** quem abrir vê o mesmo mês e os mesmos filtros.

---

### User Story 6 - Documentação de marketing (Priority: P6)

Maria escreve na mesma aba o que não é tarefa: como a casa faz cada tipo de publicação, e o que ela precisa estudar para dominar o assunto.

**Why this priority**: Foi pedido explicitamente ("o que preciso aprimorar para entender mais sobre marketing") e é o que impede que o conhecimento fique só na cabeça de quem executa. Vem por último entre as vistas porque não bloqueia nenhuma execução.

**Independent Test**: Criar um documento de processo e um de estudo, anexar uma imagem a um deles, e confirmar que nenhum dos dois aparece no fluxo de colunas nem no calendário.

**Acceptance Scenarios**:

1. **Given** a aba de Marketing, **When** o usuário abre a vista de documentação, **Then** vê os documentos separados dos cards de fluxo.
2. **Given** a vista de documentação, **When** o usuário cria um documento com título e texto longo, **Then** ele é salvo e não aparece em nenhuma coluna do fluxo nem no calendário.
3. **Given** um documento, **When** o usuário anexa uma imagem a ele, **Then** ela aparece junto do texto, com as mesmas regras de formato e tamanho dos demais anexos.

---

### User Story 7 - Liberar o espaço das imagens arquivadas (Priority: P7)

Depois que uma publicação foi feita e o card arquivado, as imagens de trabalho deixam de ser necessárias e são liberadas sozinhas, mas o registro escrito do que foi publicado permanece para sempre.

**Why this priority**: Sem isto, o espaço ocupado cresce indefinidamente. Não bloqueia nenhuma outra história e só passa a importar depois que houver volume de anexos, então é a última.

**Independent Test**: Arquivar um card com imagens, conferir que durante a carência ele pode ser restaurado com as imagens intactas, e que passada a carência as imagens somem enquanto título, descrição, canal, data, nomes dos arquivos e link do post continuam legíveis.

**Acceptance Scenarios**:

1. **Given** um card com imagens, **When** o usuário o arquiva, **Then** o card sai do quadro ativo, as imagens continuam disponíveis e a tela informa em que data elas serão liberadas.
2. **Given** um card arquivado dentro da carência, **When** o usuário o restaura, **Then** ele volta ao quadro com todas as imagens intactas.
3. **Given** um card arquivado há mais tempo que a carência, **When** o quadro é aberto, **Then** as imagens dele foram liberadas sem nenhuma ação manual.
4. **Given** um card cujas imagens já foram liberadas, **When** o usuário o consulta, **Then** ainda lê o título, a descrição, o canal, a data, o link da publicação no ar e a lista de arquivos que existiram (nome, formato, tamanho, ordem) — só as imagens não abrem mais.
5. **Given** qualquer momento, **When** o usuário abre a aba de Marketing, **Then** vê quanto espaço os anexos ocupam e quantos cards publicados ainda não foram arquivados.

---

### Edge Cases

- **Coluna com cards sendo removida**: recusado, com a contagem de cards que precisam ser movidos antes. Nenhum card pode ficar sem coluna.
- **Última coluna do quadro**: um quadro não pode ficar sem nenhuma coluna — a remoção da última é recusada.
- **Coluna renomeada**: os cards continuam nela; a identidade da coluna não é o nome.
- **Card sem projeto**: aceito e tratado como demanda transversal do ecossistema, não como erro.
- **Card sem data no quadro de Marketing**: fica no quadro e simplesmente não aparece no calendário.
- **Arquivo recusado** (formato fora da lista ou acima do limite): o card não muda de estado e a mensagem diz qual das duas regras foi violada.
- **Card apagado com anexos**: os anexos vão junto; não fica arquivo órfão.
- **Card restaurado no último dia da carência**: volta com as imagens; o relógio da carência recomeça se ele for arquivado de novo.
- **Persistência indisponível**: as duas abas mostram o mesmo aviso de configuração que a Agenda e o CRM já mostram, em vez de erro cru.
- **Filtro que esvazia uma coluna**: a coluna continua na tela, vazia e rotulada — o filtro não pode esconder que a etapa existe.
- **Ideia sem conclusão**: ideia não é "feita"; só pode ser arquivada. Não existe marcação de concluído no quadro de Ideias.

## Requirements *(mandatory)*

### Functional Requirements

#### Quadros e cards

- **FR-001**: O sistema DEVE oferecer duas áreas novas na navegação do hub, "Marketing" e "Ideias", acessíveis com as mesmas credenciais já usadas no hub.
- **FR-002**: O sistema DEVE permitir criar, editar e apagar cards em cada quadro, com título, descrição longa, projeto do ecossistema (opcional) e responsável (opcional).
- **FR-003**: A lista de projetos oferecida DEVE ser o mesmo ecossistema já registrado no hub, incluindo projetos que passarem a existir depois desta entrega, sem cadastro paralelo.
- **FR-004**: A lista de responsáveis oferecida DEVE ser a mesma já usada na Agenda, sem cadastro paralelo.
- **FR-005**: Cards do quadro de Marketing DEVEM aceitar também um canal de publicação, uma data de publicação e o endereço da publicação no ar.
- **FR-006**: O sistema DEVE permitir mover um card entre as colunas ou seções **do próprio quadro**, por ação explícita do usuário.
- **FR-007**: O sistema DEVE permitir arquivar um card e desarquivá-lo, mantendo os arquivados numa área recolhida e separada dos ativos.
- **FR-008**: Cards do quadro de Ideias NÃO DEVEM ter marcação de "concluído" — o único encerramento é o arquivamento.

#### Isolamento (o requisito central)

- **FR-009**: Nenhum card criado nestes quadros PODE aparecer na Agenda, no ranking ou em qualquer outra aba existente do hub.
- **FR-010**: Esta feature NÃO PODE alterar, criar ou remover tarefas da Agenda, nem alterar a curadoria de projetos que alimenta o ranking.
- **FR-011**: O comportamento das abas existentes do hub DEVE permanecer idêntico ao de antes desta entrega.

#### Colunas configuráveis

- **FR-012**: O sistema DEVE permitir adicionar, renomear, reordenar e remover colunas/seções de cada quadro, sem exigir publicação de uma versão nova do sistema.
- **FR-013**: O sistema DEVE recusar a remoção de uma coluna que contenha cards, informando quantos precisam ser movidos antes.
- **FR-014**: O sistema DEVE recusar a remoção da última coluna de um quadro.
- **FR-015**: Renomear uma coluna NÃO PODE mover, perder ou desassociar os cards que estão nela.
- **FR-016**: Cada quadro DEVE nascer com um conjunto inicial de colunas já utilizável, sem exigir configuração antes do primeiro uso.

#### Anexos

- **FR-017**: O sistema DEVE permitir anexar até 20 imagens a um card, mantendo a ordem definida pelo usuário — o suficiente para o maior carrossel aceito pelas redes de destino.
- **FR-018**: O sistema DEVE permitir reordenar e remover anexos individualmente.
- **FR-019**: O sistema DEVE aceitar apenas os formatos de imagem declarados e recusar arquivos acima do limite de tamanho, informando o motivo da recusa.
- **FR-020**: O sistema DEVE exibir nome, formato e tamanho de cada anexo.
- **FR-021**: Apagar um card DEVE apagar os anexos dele.
- **FR-022**: Os anexos DEVEM sobreviver a publicações de novas versões do sistema.
- **FR-023**: Os anexos DEVEM estar sujeitos à mesma proteção de acesso do restante do hub — não podem ficar publicamente acessíveis.

#### Vistas do quadro de Marketing

- **FR-024**: A aba de Marketing DEVE oferecer três vistas da mesma informação — fluxo de colunas, calendário e documentação — alternáveis sem sair da aba.
- **FR-025**: A vista de calendário DEVE mostrar um mês por vez, com cada card no seu dia de publicação, e permitir navegar entre meses.
- **FR-026**: A vista de documentação DEVE permitir registrar textos que não são cards de fluxo — processo e estudo — e que não aparecem nas colunas nem no calendário.
- **FR-027**: A vista escolhida, o mês exibido e os filtros aplicados DEVEM sobreviver ao recarregar e ser transmissíveis por link.

#### Filtros

- **FR-028**: Os dois quadros DEVEM oferecer filtro por projeto e por responsável; o de Marketing, também por canal.
- **FR-029**: Filtro ativo DEVE ser visível e removível individualmente, com uma opção de limpar tudo.
- **FR-030**: Filtro que esvazia uma coluna ou seção NÃO PODE removê-la da tela.

#### Retenção das imagens

- **FR-031**: Arquivar um card DEVE registrar a data do arquivamento e informar ao usuário quando as imagens serão liberadas.
- **FR-032**: Passado o prazo de carência a partir do arquivamento, o sistema DEVE liberar o espaço ocupado pelas imagens daquele card, sem exigir ação manual.
- **FR-033**: A liberação NÃO PODE apagar o registro do card: título, descrição, projeto, responsável, canal, data, endereço da publicação e a lista dos arquivos que existiram (nome, formato, tamanho e ordem) DEVEM permanecer indefinidamente.
- **FR-034**: Durante a carência, o usuário DEVE poder restaurar o card com as imagens intactas.
- **FR-035**: O prazo de liberação DEVE contar a partir do arquivamento, nunca a partir do envio da imagem — uma arte enviada com semanas de antecedência não pode expirar antes de ser usada.
- **FR-036**: A aba DEVE exibir permanentemente o espaço ocupado pelos anexos e quantos cards publicados ainda não foram arquivados.

### Key Entities

- **Card de quadro**: uma pauta, uma ideia ou um documento. Pertence a um quadro (Marketing ou Ideias) e a uma coluna dele. Tem título, descrição longa, e opcionalmente projeto do ecossistema, responsável, canal, data de publicação e endereço da publicação. Pode estar ativo ou arquivado. É a entidade que **nunca atravessa** para a Agenda ou para o ranking nesta entrega.
- **Coluna do quadro**: etapa ou seção configurada pelo usuário, pertencente a um quadro, com nome e posição. É o destino de um card. Sua identidade não é o nome — renomear não afeta os cards.
- **Anexo**: imagem pertencente a um card, com posição no carrossel, nome, formato e tamanho. O conteúdo visual é temporário (liberado após a carência); o registro do anexo é permanente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um card criado em qualquer um dos dois quadros aparece na coluna escolhida e continua lá depois de recarregar, em 100% das tentativas.
- **SC-002**: Mover um card de coluna se completa em no máximo duas interações e o resultado é visível sem o usuário recarregar a página à mão.
- **SC-003**: Zero cards dos quadros novos aparecem na Agenda ou no ranking, verificado com os dois quadros povoados.
- **SC-004**: Todas as abas existentes do hub continuam se comportando como antes, verificado pela suíte de testes do projeto passando integralmente.
- **SC-005**: Adicionar, renomear ou reordenar uma coluna é feito inteiramente pela tela, sem nenhuma publicação de versão nova.
- **SC-006**: Nenhuma tentativa de remover coluna deixa card sem coluna: 100% das remoções com cards dentro são recusadas com a contagem informada.
- **SC-007**: Um carrossel de 20 imagens é anexado e exibido na ordem definida em 100% dos casos, e a ordem sobrevive ao recarregar.
- **SC-008**: 100% dos arquivos fora dos formatos aceitos ou acima do limite são recusados com o motivo declarado, sem deixar o card inconsistente.
- **SC-009**: Todo card com data aparece no dia correto do calendário, e navegar entre meses preserva os filtros ativos.
- **SC-010**: Passada a carência, 100% dos cards arquivados continuam legíveis quanto ao que foi publicado (texto, canal, data, link e lista de arquivos), com as imagens liberadas.
- **SC-011**: Nenhum card é restaurado sem suas imagens dentro do prazo de carência.
- **SC-012**: O espaço ocupado pelos anexos está visível na aba a qualquer momento, sem o usuário precisar consultar ninguém.

## Assumptions

- **Acesso**: o hub tem um único acesso compartilhado; não há login por pessoa. "Aba voltada para a Maria" significa responsável padrão e filtro, **não permissão** — Jean e Maria enxergam e editam os dois quadros.
- **Responsáveis**: continuam sendo os dois já existentes na Agenda, sem tela de administração de pessoas.
- **Envio para a Agenda e para o ranking**: fora do escopo desta entrega, por decisão explícita. O modelo do card é mantido compatível para que essa ponte seja uma feature futura barata, mas nada nesta entrega escreve na Agenda ou na curadoria do ranking.
- **Colunas iniciais do Marketing**: Pauta, Produzindo, Agendado e Publicado. São um ponto de partida editável, não uma decisão fixa.
- **Seções iniciais de Ideias**: Produto novo, Melhoria e Gaveta. Mesmo mecanismo de configuração do Marketing, mesmos valores padrão editáveis.
- **Canais iniciais**: blog, Instagram, Facebook, e uma opção aberta para os demais.
- **Formatos de imagem aceitos**: PNG, JPEG e WebP, com limite de 3 MB por arquivo e 20 arquivos por card. JPEG é o formato recomendado para carrossel — PNG chega a ser dez vezes maior para a mesma arte, e o limite de tamanho existe para tornar esse custo visível.
- **Carência antes de liberar as imagens**: 30 dias a partir do arquivamento.
- **Origem das imagens**: a arte é produzida fora do hub (Canva ou equivalente) e o original permanece lá. O anexo aqui é cópia de trabalho, e por isso pode ser liberado sem perda.
- **Volume esperado**: uso de duas pessoas, dezenas de cards ativos por vez — não há requisito de paginação nem de busca em escala.
- **Layout do quadro de Ideias**: reproduz o formato já usado na Agenda (seções empilhadas com lista de cards e edição em janela), por familiaridade. Isso significa **copiar o formato**, não reaproveitar nem modificar a Agenda.
- **Momento da liberação de espaço**: acontece durante o uso normal das abas novas, não em processo agendado. Os processos noturnos existentes do hub não são alterados, e uma folga de horas ou dias na liberação é irrelevante diante de uma carência de 30 dias.

## Out of Scope

- Envio de card para a Agenda ou para a curadoria do ranking (feature futura).
- Arrastar cards com o mouse entre colunas.
- Publicação automática em qualquer rede social.
- Edição de imagem dentro do hub.
- Login por pessoa, papéis ou permissões diferenciadas.
- Calendário ou documentação no quadro de Ideias.
- Qualquer uso de modelo de linguagem.
