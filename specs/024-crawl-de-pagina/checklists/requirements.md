# Specification Quality Checklist: O que há dentro das páginas da Atma

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-07
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

Quatro observações da validação:

1. **A FR-010 nomeia uma técnica proibida, não uma exigida.** "Nenhuma contagem de conteúdo deve
   usar remoção de `<script>` por expressão gulosa" parece detalhe de implementação, mas é o
   registro de um defeito **medido** (`D-84`: HTML minificado de uma linha devolvendo zero palavra
   numa página com `<h1>`). Proibir o método errado é requisito de corretude; a spec não diz qual
   método usar.

2. **Três Edge Cases estão marcados 🚩 porque são a feature inteira.** Menu contado como link
   contextual, pixel confundido com caractere e o regex guloso — os três produzem números que
   parecem certos. Sem eles nomeados, a implementação erra por omissão e ninguém percebe.

3. **A SC-003 é um teste de invariância, não de valor.** "A contagem não muda quando o menu muda
   de tamanho" prova que a navegação está fora da conta sem depender de saber o número certo. É a
   forma mais barata de verificar a FR-004.

4. **SC-001 depende de 021+022+023 estarem no ar.** Afirma "de 16 para 22 de 28", o que só vale
   com as três merged — e as três estão (PRs #5, #6, #8). Se alguma for revertida, o número de
   partida cai.
