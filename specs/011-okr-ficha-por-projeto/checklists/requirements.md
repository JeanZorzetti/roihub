# Specification Quality Checklist: Ficha N0-N6 por projeto

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-01
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — com as exceções conscientes abaixo
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

### Exceções conscientes ao "no implementation details"

Herdadas da constituição e da 010, não escolhas desta spec:

- **FR-033, FR-034, FR-035 e SC-016 citam `.mjs`, `node --test`, `package.json` e
  `lib/projects.ts`.** Os Princípios I, II e III são regras de projeto com força de requisito, e a
  009 (FR-013/FR-014) e a 010 (FR-015/FR-016/FR-017) já as declararam assim. Omiti-las aqui as
  tornaria invisíveis no `/speckit-analyze`.
- **FR-007 e vários SC citam códigos HTTP (200, 404).** É a forma testável do requisito, e a
  SC-001 da 010 já usa a mesma régua. 404 aqui não é detalhe de implementação: é a diferença entre
  "esse projeto não existe" e "esse projeto existe e não tem dado", que é a distinção que a feature
  inteira defende.

### Correções aplicadas durante a validação (01/09/2026)

Duas, ambas encontradas relendo a spec contra o `handoff/okr-kpi-template.md`:

1. **FR-019/FR-021 estavam errados, não só imprecisos.** A versão original exigia que *todo* fator
   de N2 declarasse cobertura de degraus de N3. Mas `Receita = Sessões × CR(sessão→pedido) × AOV ×
   (1 − devolução)` (perfil B) tem dois fatores que não atravessam degrau nenhum, e o mesmo vale
   para `ARPA`/`churn` (A) e `Valor do tratamento` (D). A régua única acusaria "erro de definição do
   perfil" em **três dos quatro** perfis, e um alerta que sempre aparece deixa de ser lido. Fatores
   passaram a ter dois tipos, **de cadeia** e **de valor**, e só os de cadeia entram na conferência
   de cobertura.
2. **Edge case "sem perfil" contradizia a FR-008.** Dizia que a ficha "para em N0/N1", enquanto a
   FR-008 exige os sete níveis sempre presentes. Reescrito: os sete aparecem, N1 a N5 saem
   `não apurado: sem perfil declarado`, e N0/N6 continuam válidos porque objetivo e ação não
   dependem da cadeia.

### `/speckit-clarify` — 5 perguntas, 5 respondidas (01/09/2026)

Todas integradas na seção `## Clarifications` da spec. Resumo do que mudou:

1. **FR-006 fica.** "Mantenha a `/okr` como está" = não redesenhar, não proíbe o caminho. O nome do
   projeto no card vira o link, e é a única exceção da SC-001. Descartadas: `/okr` byte-idêntica com
   17 nomes no menu (4-5 linhas de navegação em 390px), e menu só de curados (16 projetos sem
   nenhum caminho na interface).

2. **KR pode citar célula de N3, N4 ou N5**, com o nível no prefixo da chave. Restringir a N3
   proibiria KR nos seis projetos com `visitante = 0`, onde nenhuma etapa da cadeia se move enquanto
   ninguém chega — o contrário do que a §7 manda. FR-013 e FR-017 reescritas; SC-020 nova.

3. **N6 sai da agenda**, filtrada pelo slug, pela mesma `lib/agenda.mjs` da `/agenda`. Corrigiu de
   passagem um erro factual da spec original: `responsavel` **não** está no card, vem da tabela de
   donos. FR-030 reescrita, FR-030a (data, contra apodrecimento) e FR-030b (fonte fora ≠ zero ações)
   novas; US5 reescrita; SC-018 nova.

4. **N5 não liga `/seo` nem `/infra`.** Não por escopo: cada fonte tem janela própria (Crawl Stats é
   média de 90d, health é pontual) e usá-las na árvore de 28d criaria a segunda janela que a FR-012
   proíbe. FR-028 reescrita; SC-019 nova. N5 entrega **a lista do que medir** — entregável aceito.

5. **Só o perfil D decompõe N2** nesta feature. A, B e C saem `não apurado: fatores do perfil ainda
   não declarados` — motivo declarado, dentro da FR-009. FR-019a nova; SC-017 nova. O item 4 da
   versão anterior desta nota (decompor os quatro no mesmo passo) foi **revogado** pela resposta.

### Correções encontradas durante o `/speckit-clarify`

Duas, ambas de correção — não de esclarecimento:

- **FR-030 afirmava que `responsavel` vinha do card.** Vem de `hub_acao_dono`, no banco
  (`lib/agenda.mjs:235`). Corrigido junto da pergunta 3.
- **FR-021 exigia que os fatores de N2 cobrissem a cadeia N3 inteira, e isso está errado nos quatro
  perfis.** A conta de N2 sempre começa num volume do meio da cadeia — `Clientes pagantes` (A),
  `Sessões` (B), `Propostas` (C), `Leads` (D) — e os degraus acima são a **entrada**, respondida por
  N4. A régua original acusaria "erro de definição" em 4 de 4. Reescrita para exigir apenas
  contiguidade e término em N1.

### Aberto, deliberadamente, para depois desta feature

- **Reconciliar as fórmulas de N2 do `handoff/okr-kpi-template.md` com as cadeias de N3.** O perfil
  B nomeia `Sessões` como denominador e a cadeia começa em `visitante` (cliques do GSC), que é outra
  coisa; o C começa em `Propostas`, no meio da própria cadeia. É decisão sobre o template, não sobre
  esta tela — e é o que destrava os perfis A, B e C na FR-019a.
- **Ligar os medidores de D1 e D2** a partir do que `/seo` e `/infra` já leem, decidindo a janela e
  o corte por país de cada um.

### Ponto de atenção para o `/speckit-plan`

- **Nenhum número da `atma` neste documento serve de asserção de teste.** `535 / 39 / 7,29%` são a
  janela de 01/09/2026 e mudam todo dia. Pior: em **produção** eles nem são esses, porque
  `ATMA_DATABASE_URL` não está no EasyPanel e a célula de leads sai `não apurado` — o que recua a
  âncora da 010 de `lead` para `visitante`. Teste automatizado usa cadeia sintética; conferência com
  a `atma` é manual, datada, e feita no **HTML servido**, nunca no `next dev`. A SC-015 existe para
  cobrar exatamente essa diferença.
