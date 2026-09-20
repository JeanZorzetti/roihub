# Specification Quality Checklist: O veredito sai do intervalo da amostra

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-20
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — Q1 resolvida pelo dono em 20/09/2026
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

**A spec nomeia o método pela propriedade, não pelo nome.** A FR-003 exige "um método válido para
amostra pequena e proporção próxima de zero, que não produza limite fora da faixa possível". Isso é
testável sem citar a fórmula, e deixa a escolha para o plano — que é onde ela pertence. O método
usado na medição de abertura foi o intervalo de Wilson; a aproximação normal simples reprova a
FR-003 porque devolve limite inferior negativo com poucos cliques.

**A janela foi justificada por fora do repo, não por inércia.** A 030 caiu na armadilha de medir o
critério com um instrumento e cobrá-lo de outro (`criterio_medido_com_outro_instrumento`). Aqui a
janela de 28 dias tem três razões independentes registradas na spec: quatro semanas inteiras
eliminam viés de dia da semana, é o recorte que a fonte oferece e que a prática de comparação
período contra período usa, e é a cadência com que a própria régua de mercado é reconstruída. A
razão que estava escrita no repo ("esticar trocaria a célula `visitante` dos 17 projetos") é
operacional e continua verdadeira, mas não era evidência.

**A não-combinabilidade das janelas está provada por um número impossível**, não por argumento: a
faixa 7 a 10 tem 23.450 impressões em 28 dias e 10.970 em 8 meses. Janela que contém a outra não
pode ter menos. É a prova de que o conjunto medido muda com a janela, e é o que sustenta a FR-007.

**A Q1 foi fechada pelo dono em 20/09/2026: publicar as duas leituras, nomeadas.** Era a opção com
o maior risco declarado — dois números para a mesma coisa na mesma tela é o defeito de
`transcricao_vira_terceira_fonte_de_numero`. A spec aceita a decisão e neutraliza o risco pela
FR-010: cada leitura nomeia a grandeza que mede, só a por página carrega a meta do board, e as duas
não podem ter o mesmo peso visual. A SC-008 é o teste disso — um leitor que só viu a tela tem de
saber qual das duas é o KPI.

**O limiar de 20 páginas é derivado, e a derivação mais rigorosa foi recusada por escrito.** A meta
do board tem 5 pontos de largura, então uma página só não pode atravessá-la: `1/n < 0,05` dá
`n ≥ 20`. O precedente do hub (`PISO_IMPRESSOES_VEREDITO`, da 026) foi mais duro — exigiu ~10
unidades para atravessar a faixa — e aplicá-lo aqui pediria 200 páginas decididas, que nenhum
projeto do portfólio tem. Adotar 200 tornaria o índice permanentemente não publicável, que é mentir
por omissão. A divergência entre os dois critérios está escrita na spec em vez de ficar para alguém
descobrir comparando os dois arquivos.

**A decisão melhorou a spec em vez de só custar.** Ao escrever os papéis apareceu um efeito que
nenhuma das duas leituras sozinha mostraria: o índice por página **sobe de 12,5% para 25,0% sem
que nenhuma página tenha melhorado**, só porque 20 indecisas saíram do denominador. É uma melhora
falsa saindo de um conserto correto — exatamente o padrão de
`razao_medida_do_fundo_aprova_quem_quebrou`. A leitura por tráfego (2,5%) é o que a denuncia, e a
FR-011 nasceu daí.
