# Specification Quality Checklist: Cada medida de busca é lida pela dimensão que a mede

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-19
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — Q1 resolvida pelo dono em 19/09/2026
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

**A Q1 foi aberta de propósito e fechada pelo dono em 19/09/2026**: a concentração de impressões no
Top 3 fica na leitura por termo, e a SC-004 protege o número de hoje (27,3%). Era a única medida do
bloco cuja natureza é genuinamente ambígua — ela afirma algo sobre consultas, mas é lida como
fração de impressões — e decidir por conta própria arriscava criar uma segunda versão do mesmo
número na mesma tela (`transcricao_vira_terceira_fonte_de_numero`). A spec agora fecha.

Os números desta spec foram medidos **pelas duas leituras, na mesma janela e pela mesma função de
mescla que está em produção** — é o que permite afirmar que a diferença é da leitura e não do
código. A verificação de que a home é o caso que decide foi feita olhando a linha, não o agregado:
`first_run_measures_the_check` aplicado a uma comparação de instrumentos.

SC-004 ("nenhuma medida por termo muda de valor") existe como trava anti-regressão: é o que impede
a mudança de vazar para striking distance e canibalização, que precisam do termo.
