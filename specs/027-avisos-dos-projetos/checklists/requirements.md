# Specification Quality Checklist: Avisos no Telegram — Atma, ROI Labs, Vértice e Coopluz

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-16
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Iteração 1 (16/09): escopo fechado com o dono antes da escrita (Atma: paciente, parceria e
  queda; ROI Labs: candidatura, consumidor, pagamento/assinatura e formulário institucional;
  Vértice e Coopluz: lead). Nenhum marcador foi necessário.
- Iteração 2 (16/09): o FR-003 prometia a origem do lead de paciente (site ou WhatsApp), mas a
  Atma não grava esse dado: o validador aceita só nome, e-mail e telefone como obrigatórios. A
  origem saiu do requisito, do cenário US1-3 e do edge case. A cidade virou "quando houver".
- Iteração 3 (16/09, durante o plan): o código mostrou quatro limites que a spec não dizia.
  (a) O cadastro manual de paciente no painel da Atma usa a mesma rota do formulário, e a FR-003
  passou a excluí-lo. (b) O ROI Labs só avisa o cliente na 1ª recusa de renovação da sequência, e
  a FR-012 passou a seguir essa regra. (c) O cancelamento tem três caminhos (cliente, equipe e
  varredura), e a FR-013 exclui o da equipe. (d) Os eventos novos do ROI Labs saem pelo mesmo
  alerta interno, então também chegam por e-mail e push, o que a FR-014 agora diz. Todos os itens
  continuam passando.
- "Formulário do site institucional" foi fundido com "candidatura a cadeira": o simulador não
  envia nada (ver "O que a medição corrigiu no pedido").
- "Telegram" nos requisitos não é detalhe de implementação: é o canal pedido. "VPS" no FR-009 é o
  fato de hospedagem que dá sentido ao requisito (o vigia não pode cair junto com o vigiado), não
  uma escolha de solução.
- Nomes de pipeline, plataformas de deploy e caminhos de página aparecem só no Contexto e nas
  Assumptions, como fato medido. É o mesmo padrão das specs 021–026 deste repo.
