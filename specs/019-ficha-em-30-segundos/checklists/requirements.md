# Specification Quality Checklist: A ficha responde em 30 segundos

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-05
**Revalidated**: 2026-09-06 (após `/speckit-clarify`, 5 perguntas)
**Feature**: [spec.md](../spec.md)

## Content Quality

- [ ] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [ ] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [ ] No implementation details leak into specification

## Notes

**Status: 13/16 itens passando, sem mudança de estado nesta revalidação.** Os três desmarcados são
desvio deliberado, não pendência — ver abaixo.

**Os três itens desmarcados** são o mesmo desvio: esta spec cita caminhos de arquivo, nomes de função
e rotas (`lib/projecao.mjs:117`, `ehBuracoDeVerdade()`, `/okr/[slug]/metodo`) porque é uma spec de
**reestruturação de uma tela existente** — "mover N0–N6 para outra rota" e "publicar `n1Total` apesar
da guarda 8" não são enunciáveis sem nomear o que existe. O mesmo desvio está na 017 e na 018; é a
convenção deste repo, e a constituição manda seguir o estilo do arquivo vizinho. As Success Criteria
que importam para o leitor (SC-001, SC-003, SC-004) são comportamentais e verificáveis sem abrir
código.

### Sessão de clarificação — 5 perguntas, todas respondidas

1. **Blocos órfãos da FR-001** → veredito funde na cadeia como legenda; árvore de metas (016) desce
   para `/metodo`. Tocou FR-002a, FR-006, FR-018, US4, US6, SC-005.
2. **Bloco "Descoberta" na ficha** → fica como hoje (só perfis A/B), com rótulo de janela e link.
   Tocou FR-024a. Descoberto na varredura: **ele nunca renderiza na atma** — a 018 tirou `visitante`
   de `PERFIS.D.marcos`, e o bloco depende de `marcos[0] === "visitante"`.
3. **Onde mora o conserto da projeção** → dentro de `projetar()`, valendo para as 17 fichas e para o
   bloco de projeção de `/okr`. Tocou FR-008a. Verificado que `posicaoDeAtaque()` lê só `ficha`,
   nunca `projecao` — o ranking não muda, e a SC-007 continua de pé.
4. **Taxonomia de perda/vivo** → perda = `sem_resposta`, `sem_interesse`, `perdido_concorrencia`,
   `preco_alto`; vivo = `contato_futuro`, `enviou_documentacao`, sem motivo. Declarada no card.
   Tocou FR-015, FR-015a, FR-015b.
5. **Cache das subpáginas** → ISR de 1 hora, não `force-dynamic`. Tocou FR-028a.

### O que a consulta ao banco mudou na spec (06/09/2026)

A Q4 foi respondida **consultando `ATMA_DATABASE_URL`**, não repetindo o handoff — e o banco andou
em 24 horas. Quatro números da spec estavam desatualizados no dia seguinte:

| | handoff / auditoria 05/09 | banco em 06/09 |
|---|---|---|
| orçamentos | 7 · R$ 37.465,43 | **9 · R$ 44.945,43** |
| pessoas com orçamento | 4 | **5** + 1 órfão sem `paciente_lead_id` |
| leads sem `motivo` | 2 → `respondeu` 21 | **1** → `respondeu` **22** |
| "2 vivos: ids 44 e 51" | — | id 44 tem `sem_interesse` — **perdido** |

Dois achados estruturais que vieram junto e entraram como requisito:

- **`orcamentos.status` é constante** (9 de 9 em `enviado`): "fechado" não pode sair dela, sai do
  degrau `tratamento` (FR-013a).
- **Existe orçamento sem lead** (R$ 4.490,00): entra em `enviados`, fica fora de vivos/perdidos,
  nomeado à parte (FR-015a).

Consequência para a SC-004: ela deixou de citar constantes e passou a exigir que a tela bata com a
query **no momento da verificação**, com a observação de que um teste contra constante reprovaria
hoje mesmo. Era exatamente a armadilha que o próprio Edge Cases da spec descrevia.

### Fora do escopo, por decisão registrada

- `status_historico` (FR-034) — o §6 do handoff o coloca na 019, o §14 (posterior) tira. Vale o §14.
- Os três defeitos de renderização do §12 (FR-035) — já corrigidos no commit `64bb0a7`.
- As seis réguas de mercado e o `DELETE` de `market_benchmarks` (FR-037) — spec 020, não bloqueia.

### Achado que o handoff não registra

A "lista de buracos" que o §5 manda encolher **não existe** na tela — hoje há uma única célula
(`proximoBuraco`). A US2 **cria** a lista; ela não é redução de algo existente.
