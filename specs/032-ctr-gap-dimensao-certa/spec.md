# Feature Specification: Cada medida de busca é lida pela dimensão que a mede

**Feature Branch**: `032-ctr-gap-dimensao-certa`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "O CTR Gap publica 0% porque é alimentado por uma leitura que omite consultas raras; medido pela leitura completa ele é 12,5%"

## O fato que abre esta spec

Medido em 19/09/2026 na Atma, janela de descoberta (20/08 a 16/09), **passando pela mesma função
de mescla que está no ar** — só a leitura muda:

| | leitura por termo e página (o que alimenta a tela) | leitura por página (completa) |
|---|---:|---:|
| impressões | 10.395 (42,1%) | 24.664 (100%) |
| cliques | 190 (43,8%) | 434 |
| URLs | 14 | 29 |
| URLs avaliadas pelo balizador | 6 | 24 |
| **atingem o piso da própria posição** | **0,00%** | **12,50%** |

A tela publica hoje **"0% das URLs atingem o CTR mínimo da posição (6 avaliadas)"**. É falso: há
páginas que atingem.

**O caso que decide é a home.** Na leitura por termo ela aparece na posição média 11,8 — fora da
faixa que o balizador cobre (≤ 10,9) — e **sai do denominador**. Na leitura completa ela está na
posição 6,9 com 22,49% de CTR e **passa**. A leitura incompleta expulsa da avaliação justamente a
única página que atinge o piso, e o veredito publicado vira zero.

A causa é conhecida e já estava escrita como ressalva na 030: o Search Console **omite as consultas
raras** quando a leitura é por termo. Somar hosts não conserta isso — a 030 dizia exatamente isso
e mesmo assim seus critérios de sucesso foram medidos pela outra leitura. É
`criterio_medido_com_outro_instrumento`.

## A regra que falta

Algumas medidas são **por URL** e outras são **por termo**. Hoje as duas famílias saem da mesma
leitura por termo, e a família por URL paga o preço da omissão.

| Medida | Natureza | Leitura correta |
|---|---|---|
| CTR relativo por posição / Índice de Conformidade | por URL | por página |
| URLs com impressão (e a razão de índice ativo que a usa) | por URL | por página |
| Lista de URLs abaixo do benchmark | por URL | por página |
| Amostra de URLs para a taxa de aprovação de entrega | por URL | por página |
| Consultas únicas, consultas no Top 20 | por termo | por termo |
| A um empurrão do Top 3 (striking distance) | por termo | por termo |
| Canibalização, termo principal da URL | por termo | por termo |

A concentração de impressões no Top 3 é o caso de fronteira, **decidido em 19/09/2026: fica na
leitura por termo** — ver a última seção.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - O Índice de Conformidade volta a dizer a verdade (Priority: P1)

O dono abre a aba de aquisição e lê quantas das suas páginas atingem o CTR mínimo da posição em
que estão, calculado sobre todas as impressões que o Search Console tem do site.

**Why this priority**: é o KPI que abriu esta linha de trabalho e o único que hoje publica um
veredito falso. Um "0%" errado é pior que a ausência que a 030 consertou: ausência convida a
investigar, um zero convida a agir no lugar errado.

**Independent Test**: abrir a aba de aquisição da Atma e conferir que o índice publicado é o mesmo
que a leitura por página devolve, medida à mão na mesma janela.

**Acceptance Scenarios**:

1. **Given** um projeto com histórico de busca, **When** o Índice de Conformidade é calculado,
   **Then** ele usa a leitura por página e avalia todas as URLs com posição dentro da faixa do
   balizador.
2. **Given** uma página cujos cliques vêm de consultas raras, **When** o índice é calculado,
   **Then** esses cliques entram no CTR dela.
3. **Given** a home da Atma na janela medida, **When** o índice é calculado, **Then** ela é
   avaliada e atinge o piso — hoje ela é excluída.
4. **Given** a mesma janela, **When** o número da tela é comparado com a leitura por página medida
   à mão, **Then** a diferença é zero.

---

### User Story 2 - Cada número declara sobre que base foi medido (Priority: P1)

Ao lado de cada medida, a tela diz quantas impressões entraram nela, para que dois números da mesma
aba nunca pareçam contraditórios sem explicação.

**Why this priority**: sem isso, o bloco passa a ter medidas com bases diferentes na mesma lista —
umas sobre 24.664 impressões, outras sobre 10.395 — e a próxima pessoa lê como bug. É a mesma
exigência de assinatura que a 029 e a 030 já cumprem para hosts.

**Independent Test**: abrir a aba e conferir que cada medida do bloco nomeia a sua base.

**Acceptance Scenarios**:

1. **Given** o bloco de busca, **When** ele é lido, **Then** cada medida declara a base de
   impressões e, nas de termo, o selo de piso que ela já carrega.

---

### Edge Cases

- **Uma leitura a mais por host.** Projeto em migração passa a fazer duas leituras por host na
  janela de descoberta. É custo de rede, não de quota de escrita, e a janela é a mesma.
- **A leitura por página também tem teto de linhas** e também pode truncar; a declaração de
  truncamento vale para ela como já vale para a outra.
- **Posição diverge entre as duas leituras** para a mesma URL — a campeã sai 9,2 por termo e 7,3
  por página. Não é erro: são amostras diferentes. Por isso a mesma medida nunca pode misturar as
  duas.
- **Projeto sem consultas raras suficientes** para a diferença importar continua com os dois
  números iguais; a mudança não pode inverter nenhum veredito que já estava correto.
- **A leitura por página não tem termo**, então nada que dependa de termo pode migrar para ela —
  a fronteira da tabela acima é o contrato.
- **Uma das duas leituras falha.** As medidas da que falhou não são publicadas; as da outra seguem.
  Colapsar as duas numa falha só esconderia metade do bloco sem motivo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: As medidas por URL MUST ser calculadas sobre a leitura por página; as medidas por
  termo MUST continuar na leitura por termo. A fronteira é a tabela desta spec.
- **FR-002**: Nenhuma medida MUST misturar as duas leituras no mesmo número.
- **FR-003**: Cada medida do bloco MUST declarar na tela a base de impressões sobre a qual foi
  calculada.
- **FR-004**: As medidas por termo MUST continuar carregando o selo de piso que já têm — esta spec
  não remove a ressalva, ela para de aplicá-la onde não precisa existir.
- **FR-005**: A falha de uma das leituras MUST suprimir apenas as medidas que dependem dela, e
  MUST nomear qual leitura falhou.
- **FR-006**: As duas leituras MUST usar a mesma janela e a mesma lista de hosts declarados.

### Key Entities

- **Leitura por página**: uma linha por página, com cliques, impressões e posição — completa.
- **Leitura por termo e página**: uma linha por par, sem as consultas raras que a fonte omite.
- **Base da medida**: as impressões que entraram num número, exibidas ao lado dele.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O Índice de Conformidade da Atma publica **12,5% com 24 URLs avaliadas** na janela
  medida, em vez de 0% com 6. Conferível contra a leitura por página medida à mão.
- **SC-002**: As medidas por URL passam a ser calculadas sobre **100% das impressões** que o
  Search Console tem do site na janela. Hoje: 42,1%.
- **SC-003**: A home da Atma aparece entre as URLs avaliadas e atinge o piso. Hoje é excluída.
- **SC-004**: Nenhuma medida por termo muda de valor — conferível comparando a aba antes e depois.
- **SC-005**: Cada medida do bloco exibe a sua base de impressões.

## Assumptions

- A soma de hosts da 030 permanece e vale para as duas leituras.
- A janela continua sendo a de descoberta (28 dias). Esta spec não mexe em janela.
- A régua de CTR por faixa de posição não muda — esta spec troca a alimentação, não o balizador.
- A divergência entre a régua do hub e a tabela do board segue declarada onde já está.

## Decisão de fronteira — resolvida em 19/09/2026

**A concentração de impressões no Top 3 FICA na leitura por termo** (decidido pelo dono).

A tela publica hoje "27,3% das impressões no Top 3 (2.757 de 10.098) · parâmetro do board: 40% a
50%". Esse número **não muda** com esta spec, e a SC-004 o protege.

**Por quê**: a medida afirma algo sobre **consultas** — onde elas aparecem — e consulta só existe
na leitura por termo. Migrá-la para a leitura por página daria uma base completa ao custo de trocar
a grandeza: a posição passaria a ser a média da PÁGINA, e a frase deixaria de ser verdadeira sobre
o que ela diz medir. A base parcial continua declarada pelo selo de piso que ela já carrega.

**Descartado**: publicar as duas versões nomeadas. Seriam dois números para a mesma coisa na mesma
tela — exatamente o defeito de `transcricao_vira_terceira_fonte_de_numero`.

**Consequência a aceitar**: depois desta spec o bloco terá medidas com bases diferentes lado a
lado — umas sobre 24.664 impressões, outras sobre 10.395. É isso que a FR-003 e a US2 existem para
tornar legível; sem elas a diferença lê como bug.
