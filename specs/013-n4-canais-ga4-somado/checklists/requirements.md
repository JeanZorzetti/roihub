# Specification Quality Checklist: N4 por canal — GA4 somado ao GSC

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-02
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

**Todas as perguntas abertas foram resolvidas na sessão de clarificação de 02/09/2026** (registradas
na seção `## Clarifications` do spec.md). Checklist passou de 15/16 para 16/16.

As três decisões, e o que cada uma fechou:

1. **Unidade do total** → o orgânico continua vindo do GSC e a fonte nova serve só os cinco canais
   cegos (FR-005, FR-005a). Fechou o critério de aceite de FR-005/FR-006, que antes não era
   verificável.
2. **Lead de WhatsApp** → inferência rotulada agora, instrumentação como feature separada
   (FR-011a, FR-011b). Fechou o tamanho da entrega: a feature não sai do hub.
3. **O composto vira `visitante`?** → não (FR-005c). Esta surgiu ao aplicar a decisão 1 e era uma
   contradição real: a decisão 1 foi escolhida por não mexer em número já exibido, mas promover o
   composto a denominador mudaria toda taxa do N3. Resolvida mantendo a cadeia intocada; a promoção
   virou item de **Fora de escopo**, como migração futura datada.

**Ajuste de consistência decorrente**: SC-005 dizia que a soma dos canais nunca excede o total do
topo. Com FR-005c isso ficou invertido — o composto do N4 **deve** exceder o `visitante`, que é só
o orgânico. SC-005 foi reescrito para medir unicidade de fonte por canal, e SC-010 foi adicionado
para travar que nenhuma taxa do N3 muda de valor.

Nomes de fonte foram mantidos fora dos requisitos de propósito: "GA4" aparece no título e no input
do usuário, mas os FR falam em "fonte nova" / "fonte de canal" para não amarrar a spec a um vendor
antes do `/speckit-plan`.

**Deferido para o `/speckit-plan`** (não bloqueia): a `/okr` percorre todos os projetos e a rota é
`force-dynamic`. Ler a fonte nova por projeto a cada requisição multiplica chamadas externas numa
página que já foi reportada como indisponível em janela noturna. Decidir entre leitura por
requisição, cache ou coleta em lote é decisão de arquitetura, não de escopo.
