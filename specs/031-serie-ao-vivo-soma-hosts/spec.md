# Feature Specification: A leitura ao vivo da série soma os hosts declarados

**Feature Branch**: `031-serie-ao-vivo-soma-hosts`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "A série lida ao vivo na tela continua de um host só, e contradiz o bloco que já soma — ligar a soma que a 029 já construiu"

## O fato que abre esta spec

Medido em 19/09/2026, consultando as duas propriedades do Search Console no mesmo ato, na janela
longa que a aba de aquisição pede (2026-01-17 a 2026-09-17, 244 dias):

| Host | Dias com dado | Impressões | Cliques |
|---|---:|---:|---:|
| `usealigner.com` — **o que a tela publica hoje** | 7 | 127 | 9 |
| `atma.roilabs.com.br` | 244 | 370.432 | 4.541 |
| **Total do site** | **244** | **370.559** | **4.550** |

**A tela publica 0,03% das impressões da janela longa** e anuncia "a fonte cobre 7 de 244 dias —
janela truncada", como se o Search Console não tivesse o histórico. Ele tem: 244 dias completos,
no host anterior.

E a contradição está na MESMA tela, a dois blocos de distância: o bloco de consultas, consertado
pela 030, diz "hosts somados: atma.roilabs.com.br + usealigner.com" com 10.098 impressões,
enquanto o bloco de oito meses diz 127. Dois números do mesmo site, na mesma página, que não
conversam — e nada na tela explica por quê.

## O que a 029 fez e o que ficou de fora

A 029 somou a série **gravada** (a corrida que alimenta a tabela do dia) e construiu
`somarSeriesPorHost` em `lib/serie-gsc.mjs` — soma por DIA, com posição ponderada por impressões,
coberta por testes. **A função existe, está testada e não está ligada a nenhuma leitura ao vivo.**

É o padrão de `dourado_estado_dobrou_por_ligacao`: o aparato apura, ninguém ligou.

## As quatro leituras ao vivo com o mesmo defeito

Nenhuma delas é a que foi reportada. Consertar só o bloco de oito meses deixaria as outras três
contando o site pela metade — `guarda_no_chamador_volta_pela_porta_seguinte`, sétima ocorrência.

| Leitura ao vivo | Quem consome | O que publica hoje |
|---|---|---|
| Série da janela longa | aba de aquisição — bloco de 8 meses | 127 de 370.559 impressões |
| Série padrão | painel de SEO | a fatia já migrada do site |
| Série da coleta | **ficha e OKR dos projetos** — a célula `visitante` | a fatia já migrada do site |
| Tendência | saúde do portfólio | compara janelas de um host só |

A terceira é a mais cara: ela alimenta a ficha, que é onde o número do projeto é lido para decidir.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A janela longa mostra o histórico que existe (Priority: P1)

O dono abre a aba de aquisição de um projeto que trocou de domínio e vê os oito meses de
histórico que o Search Console tem do site, em vez dos poucos dias do endereço novo.

**Why this priority**: é a contradição visível — dois blocos da mesma tela discordando sobre o
mesmo site. Enquanto ela existir, nenhum dos dois números é crível.

**Independent Test**: abrir a aba de aquisição da Atma e conferir que a janela recebida cobre os
244 dias pedidos, e não 7.

**Acceptance Scenarios**:

1. **Given** um projeto com dois hosts declarados, **When** a aba lê a série da janela longa,
   **Then** os dias devolvidos cobrem os dois hosts, somados por dia, e o total de impressões é
   igual à soma das duas propriedades.
2. **Given** um dia em que os dois hosts tiveram impressão, **When** a série é somada, **Then**
   aquele dia aparece **uma vez**, com as métricas somadas e a posição ponderada por impressões.
3. **Given** a mesma tela, **When** o bloco de consultas e o bloco da janela longa são lidos lado a
   lado, **Then** os dois declaram a mesma lista de hosts somados.
4. **Given** um projeto sem domínio anterior, **When** a aba lê a série, **Then** o resultado é
   idêntico ao de hoje.

---

### User Story 2 - A ficha conta o site inteiro (Priority: P1)

A célula de visitantes da ficha, e os números de OKR que saem dela, contam o site e não a fatia
que já migrou.

**Why this priority**: mesma prioridade da US1 e não menor — a ficha é onde o número vira decisão.
Um projeto em migração aparece hoje como se tivesse perdido o tráfego inteiro.

**Independent Test**: abrir a ficha da Atma e conferir que a célula de visitantes reflete o site
somado, não os poucos dias do domínio novo.

**Acceptance Scenarios**:

1. **Given** um projeto com dois hosts declarados, **When** a coleta lê a série do projeto,
   **Then** os dias somam os dois hosts.

---

### User Story 3 - O painel de SEO e a tendência do portfólio somam (Priority: P2)

O painel de SEO e o indicador de tendência do portfólio olham o site inteiro.

**Why this priority**: mesma raiz, e são telas de varredura — o erro aqui faz um projeto em
migração parecer em colapso ao lado dos outros 34. Fica em P2 porque quem decide abre a ficha.

**Independent Test**: abrir o painel de SEO e conferir que o projeto em migração não aparece com a
série zerada.

**Acceptance Scenarios**:

1. **Given** um projeto com dois hosts declarados, **When** o painel ou a tendência leem a série,
   **Then** as duas janelas comparadas cobrem os dois hosts.

---

### Edge Cases

- **O mesmo dia nos dois hosts.** Durante a transferência os dois endereços recebem impressão no
  mesmo dia. O dia é um só na série: métricas somadas, posição ponderada por impressões. Média de
  médias devolveria uma posição que nenhum dos dois domínios mediu.
- **Dia que só um host tem.** Antes de 11/09 só o host antigo tem dados; depois os dois. A série
  somada não pode ter buracos onde um host cala — o dia existe com o que houver.
- **A janela recebida.** A tela declara a janela que a fonte de fato cobriu. Com a soma, ela passa
  a ser a união dos dias dos hosts, e é esse número que a frase de truncamento deve usar.
- **Um host falha.** Mesmo contrato da 029 e da 030: nada é publicado com um host faltando, e a
  falha nomeia o host. Série parcial lê como queda de tráfego — foi exatamente o que a guarda da
  029 impediu e a subcontagem entregou.
- **Host declarado sem propriedade no Search Console** é ausência estrutural, não falha do momento.
- **Projeto de um host só** não paga requisição a mais nem muda de número.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Toda leitura ao vivo de série do Search Console MUST consultar todos os hosts
  declarados do projeto, usando a mesma lista que o bloco de consultas e a série gravada já usam.
- **FR-002**: Os dias MUST ser somados pela função de soma por dia que já existe e já é testada.
  Uma segunda implementação de soma por dia é proibida — duas divergiriam na primeira correção.
- **FR-003**: A janela recebida que a tela declara MUST ser a da série somada, não a de um host.
- **FR-004**: Nenhum número da série MUST ser publicado quando qualquer host declarado falhar —
  nas **quatro** leituras, sem exceção. A falha MUST nomear o host nas leituras que têm onde
  exibi-lo: as três de série. A **tendência do portfólio** não tem — a forma que ela devolve não
  carrega motivo e nenhum consumidor lê um; ali a falha continua sendo o silêncio de hoje, que já
  cumpre a metade que importa. Dar voz a ela é decisão de produto, não de plano.
- **FR-005**: As telas que exibem série e consultas juntas MUST declarar a **mesma** lista de hosts
  somados nos dois blocos.
- **FR-006**: Projeto com um único host declarado MUST produzir exatamente o resultado de hoje, com
  uma única requisição por janela.
- **FR-007**: As quatro leituras ao vivo MUST resolver os hosts no mesmo lugar, de modo que ligar
  um host novo passe a valer para todas de uma vez.

### Key Entities

- **Dia da série**: data, cliques, impressões e posição, de um host ou já somado.
- **Série somada**: um dia por data, com a lista de hosts que contribuíram.
- **Janela recebida**: o primeiro e o último dia que a fonte de fato cobriu, depois da soma.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A aba de aquisição de um projeto em migração publica a série longa sobre **100% das
  impressões que o Search Console tem do site**. Medido hoje na Atma: 0,03% (127 de 370.559).
- **SC-002**: A janela recebida declarada pela tela cobre **244 de 244 dias** pedidos na Atma.
  Hoje: 7.
- **SC-003**: Os dois blocos da aba de aquisição declaram a mesma lista de hosts, conferível na
  tela sem abrir o código.
- **SC-004**: O total de impressões da série fecha com a soma das propriedades conferida à mão no
  mesmo dia, com diferença zero.
- **SC-005**: A célula de visitantes da ficha de um projeto em migração deixa de refletir só o
  domínio novo — conferível comparando com a soma medida à mão.
- **SC-006**: Com um host indisponível, **nenhum número é publicado em nenhuma das quatro
  leituras**. O host é nomeado onde a tela tem onde dizê-lo: a aba de aquisição (`Search Console
  indisponível (<host>: …)`) e a ficha (o motivo da célula não apurada). O painel de SEO colapsa
  `{erro}` no mesmo estado vazio de hoje e a home cai no `seoSeed` — nos dois, o silêncio é o
  contrato que já existe e não muda nesta spec.

## Assumptions

- A lista de hosts declarados e a função de soma por dia já existem e são reusadas, não recriadas.
- As janelas (longa, padrão e a da tendência) não mudam de tamanho nesta spec.
- A série **gravada** já soma desde a 029 e esta spec não muda o que ela lê — é só a leitura ao
  vivo. A correção do voto único na função de soma **alcança** a corrida que grava, na 16ª casa
  decimal e na direção do valor do Google; nada acorda por isso, porque a gravação guarda por host
  e nunca por valor.
- Um projeto tem no máximo dois hosts declarados hoje.
- O custo de rede dobra apenas para projetos que declaram domínio anterior; hoje, um.
