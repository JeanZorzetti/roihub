# Specification Quality Checklist: 020 — a régua de mercado da Atma

**Purpose**: Validar completude e qualidade da especificação antes do planejamento
**Created**: 2026-09-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Sem detalhe de implementação (linguagem, framework, API)
  - ⚠️ **Exceção deliberada**: a spec nomeia `lib/benchmark.mjs`, `REGUA.D`, `market_benchmarks` e
    `/admin/benchmark-mercado`. Não é vazamento de implementação — é o **estado medido** do sistema
    (`REGUA.D` vazia; a tabela lida por um app terceiro), sem o qual os requisitos ficam sem lastro.
    O mesmo padrão das specs 017/018/019 desta família.
- [x] Focado em valor de usuário e necessidade de negócio
- [x] Escrito para quem decide, não só para quem implementa
- [x] Todas as seções obrigatórias preenchidas

## Requirement Completeness

- [x] Nenhum marcador `[NEEDS CLARIFICATION]` remanescente — as três dúvidas de escopo foram
      respondidas pelo dono em 06/09/2026 e viraram D1, D2 e D3, com a alternativa recusada registrada
- [x] Requisitos testáveis e não ambíguos (FR-001 a FR-018)
- [x] Critérios de sucesso mensuráveis (SC-001 a SC-006), com linha de base declarada na SC-004
- [x] Critérios de sucesso agnósticos de tecnologia
- [x] Cenários de aceitação definidos nas três histórias
- [x] Casos de borda identificados (6, incluindo o que a experiência desta família já produziu)
- [x] Escopo delimitado — seção "Fora de escopo" explícita
- [x] Dependências e premissas identificadas, e **as premissas do handoff foram verificadas na
      fonte** (uma delas refutada)

## Feature Readiness

- [x] Todo requisito funcional tem critério de aceitação rastreável
- [x] Histórias cobrem os fluxos primários e são independentemente entregáveis
- [x] A feature atende aos resultados mensuráveis da seção Success Criteria
- [x] Escopo fechado: D1 (roihub + app da Atma), D2 (exibição de aquisição vai para a 022),
      D3 (seis vereditos, não seis réguas). Liberado para `/speckit-clarify` e `/speckit-plan`

## Notas

**O achado que mais importa desta rodada**: a premissa do handoff de que `market_benchmarks` é
tabela morta é **falsa**. O app da Atma tem rota e tela de admin que a leem e geram veredito
comparativo contra o funil real. A spec foi escrita já corrigida; a Q1 existe porque a correção
atravessa a fronteira do repositório e essa decisão não é minha.

**Linha de base para a SC-004, medida em 06/09/2026, antes de qualquer edição**: 12 comparações
sem fonte vivas em `/admin/benchmark-mercado`; 0 réguas em `REGUA.D` no roihub.

**Rodada de `/speckit-clarify` (06/09/2026, 3 perguntas)**: as três respostas ampliaram requisitos em
vez de só resolvê-los — FR-002a (as 7 linhas legadas ficam intactas, dívida registrada), FR-013a +
FR-015a (a tabela da Atma é *substituída*, não esvaziada, e ganha trava de escrita) e FR-001a +
FR-001b (a recusa vira dado de primeira classe e chega à tela). A Q2 mudou a natureza da US2: ela
deixou de ser um `DELETE` e virou uma escrita, o que a torna **dependente** da US1.

