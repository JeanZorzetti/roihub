# Specification Quality Checklist: Marca e não-marca

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-08
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

Cinco observações da validação:

1. **A spec corrige duas afirmações minhas anteriores, e as duas estão nomeadas no corpo.**
   (a) O handoff de 07/09 propôs "não-marca = total − marca"; o `CLAUDE.md` já registrava que os
   dois lados têm coberturas diferentes e que trocá-los "inventa quedas". (b) O mesmo handoff
   sugeriu urgência de calendário; o backfill por filtro de consulta a elimina. Deixar as duas
   correções visíveis é mais barato do que alguém reencontrá-las na implementação.

2. **A FR-006 é a única que exige uma medição em vez de um comportamento.** Ela existe porque a
   resposta ("filtrar sem pedir a dimensão preserva as buscas raras?") não é obtível por leitura —
   e dela depende se os KPIs são completos ou pisos. É o padrão "a primeira corrida mede o check",
   virado requisito.

3. **A FR-012 (lista visível na tela) parece cosmética e não é.** O erro de uma lista de marca
   pobre tem **direção**: infla o não-marca, que é o número que se quer ver crescer. Um KPI que
   erra para o lado que agrada precisa de auditabilidade, não de confiança.

4. **Zero [NEEDS CLARIFICATION].** A única decisão realmente humana — quais termos são marca — é
   um requisito de entrada (FR-001), não uma ambiguidade da spec: a feature funciona declarando
   "não declarada" enquanto a lista não existir.

5. **SC-001 fecha o teto declarado.** 24 de 28 é exatamente o limite que o handoff de 07/09
   definiu como realista, com as 4 ausências já justificadas (reescrita de título pelo Google,
   Referring Domains, Cobertura Semântica). Esta é a última spec da série do board.
