# Specification Quality Checklist: Crescimento Não-Marca medido no board

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-20
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

Três ressalvas conscientes, aceitas em vez de "corrigidas":

1. **A spec nomeia símbolos do código** (`crescimentoNaoMarca`, `mesesFechados`, `variacao`,
   `marcaDeclarada`, `MEDIDO_POR`). É o mesmo caso da 035: o defeito que motiva metade da feature
   **é** um contrato de retorno — um `null` que carrega três causas — e descrevê-lo em abstrato
   ("a tela às vezes não mostra o número") não seria testável.

2. **FR-003/FR-003b parecem decisão de redação, não requisito.** São requisito: a linha de topo é o
   que a tela exibe sem expandir, e a SC-006 é julgada exatamente sobre ela. A escolha entre abrir
   pela razão ou pelos absolutos muda o que o leitor conclui sobre a Atma estar acima ou abaixo da
   meta — foi levada ao dono e confirmada antes do plano.

3. **A SC-004 fala em "duas leituras ao Search Console", que é contagem de chamada.** Fica porque é
   a única formulação verificável de "esta feature não pode custar rede nova"; o número dois é o
   estado de hoje da página, não um alvo de arquitetura.

## Ressalva de validade

O valor esperado da medida **muda em 04/10/2026**, quando setembro fechar: a comparação passa de
jul→ago (base interrompida, `43×`) para ago→set (base íntegra, ≈ −54% pelo ritmo medido). Os dois
comportamentos são especificados — FR-003 e FR-003b —, e a `quickstart.md` §2 avisa que o esperado
muda e que isso **não** é regressão.
