# Specification Quality Checklist: Projeção invertida — da meta para o fator obrigatório

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-01
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

Duas exceções conscientes ao "no implementation details", ambas herdadas da 009 e da
constituição, não escolhas desta spec:

- **FR-015 e FR-016 citam `.mjs`, `node --test` e `package.json`.** Os Princípios II e III da
  constituição são regras de projeto com força de requisito ("Violação de um MUST sem
  justificativa registrada é bloqueante"), e a 009 já as declarou como FR-013/FR-014. Omiti-las
  aqui as tornaria invisíveis no `/speckit-analyze`.
- **FR-017 cita `lib/projects.ts`.** O Princípio I nomeia o arquivo; é o contrato, não um
  detalhe de implementação.

Ponto de atenção para o `/speckit-plan`, não bloqueante para a spec:

- **SC-002 fixa `atma` como caso de referência com `lead = 39`.** Esse número é a janela medida
  em 01/09/2026 e vai mudar. O teste automatizado DEVE usar cadeia sintética; a conferência com
  `atma` é manual e datada, como a SC-004 da 009 já é.

  **Resolvido no `/speckit-plan`** (01/09/2026): a SC-002 foi emendada para dizer explicitamente
  que o percentual depende do `prazo` declarado e não é fixável, e o `quickstart.md` §2 usa cadeia
  sintética com `hoje` fixo. Ficou pior do que a nota previa: com `prazo: "2026-12-31"` o número
  real da `atma` é `7,42%`, não os `32,05%` do Contexto — que continuam corretos como ilustração
  porque lá a meta é declarada *na janela*.

## Emendas aplicadas no `/speckit-plan` (01/09/2026)

Seis, todas saídas de um `/grilling` sobre as tensões internas da spec. Registradas aqui porque o
`/speckit-analyze` compara spec × plan e precisa saber que a divergência foi deliberada:

1. **US2-AC3** — cadeia fechada mostra múltiplo, não "fator atual 41%".
2. **FR-004** — normalização conta de hoje; `valor` é o que falta a partir da declaração.
3. **FR-005** — vale ao pé da letra; a âncora pode ser o degrau final.
4. **FR-006/FR-007** — teto de 100% restrito ao ramo com degrau depois da âncora.
5. **FR-001/FR-010/Key Entities** — `+declaradaEm`, `+multiploNecessario`, mutuamente exclusivo
   com `fatorObrigatorio`.
6. **SC-002** — o número conferível depende do `prazo`.

O fato que forçou 1, 3 e 4: **nenhum dos 17 projetos com perfil declarado tem cadeia fechada** —
16 não têm o campo `vendas` e o único que tem (`atma`) tem três degraus não apurados acima dele.

## Emenda aplicada no `/speckit-analyze` (01/09/2026)

7. **FR-014 e US1 — "coluna" virou "bloco no card".** O plan já decidia isso na D6 desde
   01/09/2026, mas a spec ficou para trás e continuou pedindo "coluna… na mesma linha do projeto".
   Um leitor da spec sozinho implementaria coluna de tabela, que quebra em 390px e colidiria com a
   `.tabela-rolavel` que já mede degraus dentro de cada card. O requisito é **onde** a informação
   aparece, não a forma geométrica.

Achados do mesmo `/speckit-analyze` corrigidos fora da spec, listados aqui porque explicam por que
o `tasks.md` é mais longo que o `plan.md` sugeriria:

- **`hoje` ≠ `FIM`** (tasks T015). `FIM = isoDaysAgo(3)` — a janela do GSC fecha em D-3. Usá-lo
  como "hoje" alongaria o prazo em 3 dias e o número da tela deixaria de bater com a conferência à
  mão, que é o critério inteiro da SC-002.
- **G7 sem asserção** (tasks T009). A garantia existia no contrato e nenhum teste a cobria.
- **O check da SC-003 mede uma string** (tasks T015). O rótulo `fator obrigatório` só pode ser
  emitido no ramo apurado; impresso antes da checagem da meta, o grep do quickstart §3 dá 40 e
  passa a medir o rótulo em vez da feature.
- **Direção da normalização sem teste** (tasks T023). Com janela encurtada, `n1Janela > n1Total`;
  sem essa asserção, inverter a fórmula passa verde.
- **`multiploDeVolume` cita metade da FR-008** (tasks T019). O campo é um só (D4), mas o texto
  DEVE nomear volume **e** ticket.
- **R-h**, veredito `limite` (`contracts/projecao-mjs.md`). A spec chama o fator exatamente `1` de
  "impossível na prática"; o data-model o separa em veredito próprio. A regra fixa que a palavra
  "impossível" não aparece ali — aritmeticamente `1` cabe.
