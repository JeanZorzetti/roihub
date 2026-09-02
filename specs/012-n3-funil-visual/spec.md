# Feature Specification: N3 — Funil Visual

**Feature Branch**: `012-n3-funil-visual`

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "Item 2 do handoff de polimento da ficha /okr/[slug] (spec 011,
design-review de /okr/atma): N3 é a cadeia de degraus da árvore, hoje só texto corrido — 1
apurado (`6,67% (35/525)`), 4 não. A tela nunca mostra `525 → 35 → ? → ? → ? → 0` como forma, só
como 5 parágrafos. Adicionar um funil visual (SVG) acima das linhas de texto atuais, que continuam
existindo embaixo."

## Contexto: a cadeia existe em texto, nunca em forma

O card N3 da ficha (`specs/011-okr-ficha-por-projeto`) já renderiza cada degrau do perfil ativo
como uma linha: rótulo, valor (com a fração colada, R2) ou motivo de não apurado. A informação
está completa — mas só como prosa. Quem abre a ficha da `atma` lê cinco parágrafos antes de notar
que só o primeiro tem número; ninguém enxerga `525 → 35 → não apurado → não apurado → não apurado`
como a forma que é: um funil que afunila uma vez e para de vazar dado, não de gente.

O achado 2 do design-review (severidade 4) pede exatamente essa forma. **Reforço, não
substituição**: R1 (`handoff/okr-kpi-template.md:238`) exige que o motivo de um degrau não apurado
ocupe o lugar do número — apagar as linhas de texto para caber um gráfico violaria R1. O funil
soma-se ao que já existe, não troca.

**Escopo confirmado nesta sessão** (clarificação abaixo): o funil é exclusivo da ficha
(`/okr/[slug]`, card N3). A listagem `/okr` — que já tem uma tabela de marcos por projeto — não
muda nesta feature.

## Clarifications

### Session 2026-09-02

- Q: O funil também deve aparecer na listagem `/okr`, ou fica exclusivo da ficha por projeto? →
  A: Só na ficha. Menor escopo, consistente com o que o handoff já desenhou; `/okr` continua com a
  tabela atual de marcos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reconhecer o formato da cadeia num relance (Priority: P1)

Ao abrir a ficha de um projeto com perfil declarado, o usuário vê o card N3 e, antes de ler
qualquer linha, já sabe quantos degraus a cadeia tem e em qual deles o dado para de existir.

**Why this priority**: é o achado do design-review — hoje essa resposta exige ler os cinco
parágrafos um a um. Sem essa leitura rápida, a pergunta "onde é que a cadeia trava?" (que o
cabeçalho da ficha já responde em texto, via `escolherFamilia()`) não tem apoio visual no nível
que efetivamente mede a perda degrau a degrau.

**Independent Test**: abrir `/okr/atma` (perfil D, 6 marcos → 5 taxas, 1 apurada) e
`/okr/<projeto de perfil A/B/C>` (5 marcos → 4 taxas) lado a lado; confirmar que o funil de cada um
tem o número certo de segmentos e que o segmento apurado é visualmente distinto do vazio, sem ler
texto.

**Acceptance Scenarios**:

1. **Given** a ficha da `atma` (perfil D, 6 marcos → 5 taxas, 1 apurada), **When** o card N3
   renderiza, **Then** o funil mostra 5 segmentos em ordem, o primeiro preenchido e os outros
   quatro com o padrão vazio/hachurado.
2. **Given** um projeto de perfil A, B ou C (5 marcos → 4 taxas), **When** a ficha desse projeto
   renderiza, **Then** o funil mostra exatamente 4 segmentos — sem nenhuma mudança de código por
   perfil.

---

### User Story 2 - Não perder o motivo ao ganhar a forma (Priority: P1)

O funil é reforço visual: quem quer saber *por que* um degrau está vazio continua encontrando a
resposta exatamente onde já está hoje.

**Why this priority**: é a restrição que impede a feature de regredir R1. Sem ela, "melhorar a
tela" e "esconder o motivo atrás de uma barra bonita" ficam indistinguíveis no diff.

**Independent Test**: comparar o card N3 antes/depois — toda linha de texto que existia continua
presente, na mesma ordem, com o mesmo motivo; a única adição é o funil acima delas.

**Acceptance Scenarios**:

1. **Given** o card N3 de qualquer ficha, **When** o funil é adicionado, **Then** nenhuma linha de
   texto existente é removida, reordenada ou tem seu motivo resumido/truncado.
2. **Given** um degrau não apurado, **When** o usuário olha só o funil (sem ler texto), **Then**
   ele reconhece que o degrau está vazio (padrão hachurado), mas não precisa adivinhar o motivo por
   ali — o motivo continua uma leitura de texto abaixo, não uma tooltip nova a manter.

---

### Edge Cases

- Perfil sem nenhum degrau apurado (funil 100% hachurado): estado válido, não um erro a esconder —
  mesma régua de N3 hoje, que já mostra os cinco motivos sem inventar dado.
- Projeto sem perfil declarado: N3 hoje colapsa para uma única célula "não apurado — sem perfil
  declarado" (nenhuma cadeia a desenhar). O funil não renderiza nesse caso — não há degrau nenhum
  para virar segmento, e um funil de zero segmentos não é forma, é ruído.
- Degrau com `0/0` (sem denominador): já cai em não apurado antes de chegar à ficha (R3); o funil
  trata como qualquer outro segmento não apurado, nunca como zero.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O card N3 DEVE renderizar um funil horizontal acima das linhas de texto já
  existentes, com um segmento por **taxa** da cadeia do perfil ativo — isto é, um segmento por par
  de marcos consecutivos, na mesma ordem e em correspondência 1:1 com as linhas de texto que N3 já
  renderiza. Cadeia de N marcos tem N−1 segmentos, nunca N (ver Key Entities).
- **FR-002**: O número de segmentos DEVE vir do tamanho real da cadeia do perfil ativo — nunca
  fixo em 5. Perfis diferentes têm contagens diferentes: A, B e C têm 5 marcos (**4 segmentos**),
  D tem 6 marcos (**5 segmentos**).
- **FR-003**: Cada segmento DEVE indicar seu estado — apurado (preenchido) ou não apurado (trilho
  vazio, padrão hachurado, nunca cor sozinha) — usando o mesmo estado que já rege a linha de texto
  correspondente, nunca um estado novo nem inferido.
- **FR-004**: As linhas de texto existentes abaixo do funil DEVEM continuar exatamente como estão
  hoje — mesma ordem, mesmo motivo, mesma fração colada (R2). O funil é aditivo.
- **FR-005**: Quando o projeto não tem perfil declarado (N3 hoje é uma célula única "não apurado"
  explicando a ausência), o funil NÃO É renderizado — só a linha de texto atual permanece.
- **FR-006**: O funil é exclusivo da ficha (`/okr/[slug]`); a listagem `/okr` não é alterada por
  esta feature.
- **FR-007**: O funil DEVE ser SVG inline, sem biblioteca de gráfico nova — a direção corte-seco
  declara orçamento de JS zero (`.art/log.json`, `js_kb: 0`) para o chrome desta tela.
- **FR-008**: O SVG do funil, sendo reforço de uma informação já lida por completo no texto abaixo,
  DEVE ser marcado como decorativo para tecnologia assistiva (não duplicar a leitura de cada
  degrau duas vezes para quem usa leitor de tela).

### Key Entities *(include if feature involves data)*

São **duas** entidades, e confundi-las é o erro que esta seção existe para prevenir: o marco é o
ponto, a taxa é o vazamento entre dois pontos. N3 mede o segundo. A cadeia da `atma` tem **6
marcos** (`525 → 35 → ? → ? → ? → 0`) e **5 taxas** — e são cinco as linhas de texto que N3 já
renderiza hoje.

- **Marco (degrau) da cadeia**: um ponto da árvore de conversão do perfil ativo (ex.: visitante,
  lead, consulta, tratamento). Tem nome, estado (apurado/declarado/não apurado) e, quando apurado,
  um valor — os mesmos três estados que já regem toda a ficha (FR-009 da spec 011). **Não é o
  segmento**: é dele que sai a *altura* do segmento.
- **Taxa entre dois marcos consecutivos**: a razão `marco[i+1] / marco[i]`, com o numerador de uma
  sendo o denominador da seguinte. É a unidade de N3 — uma linha de texto hoje, **um segmento do
  funil** a partir desta feature. Só existe apurada quando os dois marcos que a formam existem
  apurados; caso contrário é `não apurado` com motivo. Uma cadeia de N marcos tem N−1 taxas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ao olhar só o funil (sem ler nenhuma linha de texto), o usuário identifica quantos
  degraus a cadeia tem e em qual deles o dado apurado para.
- **SC-002**: 100% dos segmentos marcados como "não apurado" usam o padrão vazio/hachurado — nenhum
  aparece preenchido nem com valor numérico.
- **SC-003**: O mesmo componente de funil renderiza corretamente para os quatro perfis (A, B, C, D)
  sem branch de código específico por perfil — só a contagem de segmentos muda.
- **SC-004**: O peso de JavaScript que a ficha envia ao navegador não aumenta com esta feature (o
  funil é markup SVG, não script).

## Assumptions

- O tamanho de cada segmento preenchido comunica proporção ("encolhe conforme desce a cadeia"); a
  fórmula exata de escala (valor absoluto vs. normalizado) é decisão de implementação, não de
  escopo — fica para o `/speckit-plan`.
- Um funil inteiramente hachurado (nenhum degrau apurado) é um resultado esperado e válido, não um
  estado de erro a esconder ou substituir por texto.
- O funil não introduz nenhum estado, rótulo ou motivo que não exista já nas linhas de texto — só
  muda a forma como a mesma informação aparece primeiro.
