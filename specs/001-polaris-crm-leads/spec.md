# Feature Specification: CRM do roihub recebe leads do Polaris

**Feature Branch**: `001-polaris-crm-leads`

**Created**: 2026-08-10

**Status**: Draft

**Input**: User description: "Melhorar o CRM do roihub para receber e gerenciar leads gerados pelo Polaris (sofia-next, polarisia.com.br). roihub já tem pipelines (orion, atma, roilabs) e um endpoint de ingestão POST /api/crm/leads protegido por CRM_INGEST_SECRET. O Polaris hoje envia leads de 3 formulários (contato, intake de site, early access) só para o Sirius CRM externo via POST /api/crm/lead. Os leads do Polaris devem passar a chegar no CRM do roihub, visíveis no kanban junto com Orion/Atma/ROI Labs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lead do Polaris aparece no CRM do hub (Priority: P1)

Um visitante do site do Polaris preenche qualquer um dos formulários existentes (contato, intake de "peça seu site", ou early access). A pessoa responsável por atender leads, que já usa o CRM do roihub para acompanhar Orion/Atma/ROI Labs, vê esse novo lead aparecer no kanban do hub, numa pipeline própria do Polaris, sem precisar checar outro sistema.

**Why this priority**: É o valor central da feature — sem isso, nada mais importa. Hoje o lead só existe no Sirius CRM, fora do fluxo de trabalho unificado do hub.

**Independent Test**: Enviar o formulário de contato do Polaris e verificar que um card correspondente aparece em `/crm` no roihub, na pipeline do Polaris, com nome e email corretos.

**Acceptance Scenarios**:

1. **Given** o visitante preenche o formulário de contato do Polaris com nome e email válidos, **When** o formulário é enviado, **Then** um card de lead aparece na pipeline "Polaris" do CRM do roihub com esses dados.
2. **Given** o visitante preenche o formulário de intake de site ("peça seu site"), **When** o formulário é enviado, **Then** um card de lead aparece na pipeline "Polaris" do CRM do roihub.
3. **Given** o visitante se inscreve na lista de early access, **When** o formulário é enviado, **Then** um card de lead aparece na pipeline "Polaris" do CRM do roihub.

---

### User Story 2 - Origem do lead é identificável (Priority: P2)

A pessoa que trabalha os leads no CRM consegue saber, olhando o card, de qual formulário do Polaris ele veio (contato, intake de site, ou early access), sem precisar abrir cada card individualmente para descobrir.

**Why this priority**: Os três formulários representam intenções de compra diferentes (dúvida geral vs. pedido de orçamento vs. interesse em lista de espera); tratar todos como o mesmo tipo de lead prejudica a priorização de atendimento.

**Independent Test**: Enviar um lead por cada um dos 3 formulários e confirmar que os 3 cards resultantes no CRM são distinguíveis por origem sem abrir o detalhe do card.

**Acceptance Scenarios**:

1. **Given** três leads foram enviados, um por cada formulário do Polaris, **When** a pessoa olha a pipeline "Polaris" no kanban, **Then** ela consegue identificar a origem de cada um (contato / intake de site / early access).

---

### User Story 3 - Reenvio não duplica o lead (Priority: P3)

Uma falha de rede faz o formulário do Polaris tentar enviar o lead novamente. O CRM do roihub não cria um segundo card para o mesmo envio.

**Why this priority**: Sem isso, uma reconexão de rede comum vira "sujeira" na pipeline (leads fantasmas), poluindo a fila de atendimento.

**Independent Test**: Enviar a mesma requisição de lead duas vezes com o mesmo identificador de origem e confirmar que apenas um card existe no CRM depois das duas tentativas.

**Acceptance Scenarios**:

1. **Given** um lead já foi registrado no CRM do roihub, **When** o mesmo envio é repetido (mesmo identificador de origem), **Then** nenhum card novo é criado — o card existente permanece único.

---

### Edge Cases

- O que acontece quando o bot preenche o campo honeypot dos formulários do Polaris? (Hoje isso já é bloqueado antes de chegar a qualquer CRM — deve continuar assim, nenhum lead falso deve chegar ao roihub.)
- O que acontece quando o CRM do roihub está temporariamente indisponível no momento do envio? O visitante não deve ser afetado (FR-006); o lead correspondente fica ausente do CRM até o problema ser resolvido — não há fila de reprocessamento automático prevista nesta spec.
- O que acontece se o mesmo visitante enviar o mesmo formulário duas vezes de propósito (ex.: se arrependeu e reenviou com dados diferentes)? Cada envio distinto do usuário deve virar um lead distinto — a deduplicação é apenas para reenvios técnicos (retry), não para o mesmo formulário preenchido de novo intencionalmente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O CRM do roihub MUST reconhecer uma pipeline própria para leads originados do Polaris, distinta das pipelines existentes (Orion, Atma, ROI Labs).
- **FR-002**: Todo lead originado do Polaris MUST chegar ao CRM do roihub identificando de qual formulário ele veio (contato, intake de site, ou early access).
- **FR-003**: Todo lead originado do Polaris MUST carregar um identificador estável e único por envio, de forma que reenvios do mesmo envio nunca criem um segundo card (mesma regra de deduplicação já usada pela ingestão da Orion).
- **FR-004**: O CRM do roihub MUST reter, para cada lead do Polaris, ao menos nome e email; telefone, empresa e a mensagem/contexto original do formulário MUST ser preservados quando fornecidos pelo visitante.
- **FR-005**: O bloqueio de bots (honeypot) já existente nos formulários do Polaris MUST continuar impedindo que submissões de bot cheguem ao CRM do roihub.
- **FR-006**: Quando o CRM do roihub estiver indisponível ou rejeitar o envio, o formulário do Polaris MUST mesmo assim ser aceito como sucesso para o visitante (entrega best-effort) — uma falha interna do CRM nunca deve aparecer como erro para quem preencheu o formulário.
- **FR-007**: O envio ao Sirius CRM (sistema externo atual) MUST ser substituído pelo envio ao CRM do roihub — deixa de existir um segundo sistema de leads em paralelo para os formulários do Polaris.

### Key Entities

- **Lead do Polaris**: um contato interessado gerado por um dos formulários do site do Polaris. Atributos: nome, email, telefone (opcional), empresa (opcional), origem (qual formulário gerou o lead), mensagem/contexto original, identificador estável de deduplicação.
- **Pipeline Polaris**: o funil, dentro do CRM do roihub, pelo qual passam os leads originados do Polaris — da mesma forma que Orion, Atma e ROI Labs já têm seus próprios funis.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos envios bem-sucedidos nos 3 formulários do Polaris resultam em um lead visível no CRM do roihub em até 1 minuto.
- **SC-002**: Reenvios técnicos do mesmo envio (ex.: retry após timeout de rede) nunca resultam em mais de um card no CRM para aquele envio.
- **SC-003**: A pessoa que atende leads consegue identificar a origem (contato / intake de site / early access) de qualquer lead do Polaris sem abrir o detalhe do card.
- **SC-004**: Nenhuma submissão de bot (honeypot preenchido) chega a criar um lead no CRM do roihub.

## Assumptions

- O envio ao Sirius CRM é removido dos 3 formulários do Polaris nesta feature; o CRM do roihub passa a ser o único destino de leads do Polaris (decisão confirmada — substituição, não dual-write).
- A entrega ao CRM do roihub é best-effort: uma falha ou indisponibilidade do hub não bloqueia nem falha a submissão do visitante no Polaris (decisão confirmada). Não há retry automático em fila nesta spec — um lead perdido por indisponibilidade fica apenas ausente do CRM.
- As etapas do funil da pipeline "Polaris" seguem o mesmo padrão já usado pelas pipelines existentes (`novo`, `contato`, `proposta`, `ganho`, `perdido`), por consistência com o resto do CRM — não há indício de que o funil do Polaris precise de etapas diferentes.
- A autenticação do envio do Polaris para o CRM do roihub reaproveita o mesmo segredo de ingestão já usado pela Orion (`CRM_INGEST_SECRET`), em vez de introduzir um segredo dedicado por origem — é o padrão já estabelecido no sistema (um segredo por capacidade de ingestão, não por chamador).
- Os 3 formulários existentes do Polaris (contato, intake de site, early access) estão todos no escopo desta feature — não há motivo para excluir algum deles.
- Usuários finais (visitantes do Polaris) não interagem diretamente com o CRM do roihub; apenas a equipe interna que já usa `/crm` no hub.
