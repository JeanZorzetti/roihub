# Specification Quality Checklist: A leitura por página do Search Console soma os hosts declarados

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-19
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

Duas ressalvas registradas em vez de escondidas, ambas decididas a favor de publicar:

1. **"Search Console", "hosts declarados" e "janela" aparecem na spec e nos critérios.** Não são
   escolha de tecnologia: são o vocabulário do domínio deste hub e a única forma de escrever um
   critério conferível ("o total fecha com a soma das propriedades"). Trocá-los por paráfrase
   tornaria a SC-004 impossível de verificar.

2. **Os números de partida foram medidos, não estimados** — 19/09/2026, as duas propriedades
   consultadas no mesmo ato, janela 20/08 a 16/09. É contra eles que SC-001, SC-002, SC-003 e
   SC-005 são conferidos; sem a medição na spec, o "antes" precisaria ser reconstruído depois do
   conserto, quando já não existe.

Uma decisão de escopo ficou tomada em vez de virar pergunta: a História 3 (autopublishing) entra na
spec porque compartilha a raiz, mas sobe pelo rollout que a constituição exige (`dry_run` + os
quatro canários). Separá-la das duas primeiras é permitido; deixá-la fora seria repetir o defeito
que a FR-007 fecha.
