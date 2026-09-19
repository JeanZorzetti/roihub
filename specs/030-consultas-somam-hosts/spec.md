# Feature Specification: A leitura por página do Search Console soma os hosts declarados

**Feature Branch**: `030-consultas-somam-hosts`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "Somar os hosts declarados no bloco de consultas do GSC (query+page), mesclando páginas iguais por caminho, para os KPIs do ramo CLIQUE voltarem a enxergar o site durante a migração de domínio"

## O fato que abre esta spec

Medido em 19/09/2026, consultando as duas propriedades do Search Console no mesmo ato, na janela
de descoberta (20/08 a 16/09), dimensão `page`:

| Host | Impressões | Cliques |
|---|---:|---:|
| `usealigner.com` (declarado em `url`) | 98 | 8 |
| `atma.roilabs.com.br` (declarado em `dominioAnterior`) | 24.566 | 426 |
| **Total do site** | **24.664** | **434** |

A aba de aquisição consulta **apenas** o host de `url`. Desde a troca de domínio em 11/09 ela
decide os KPIs do ramo CLIQUE sobre **0,4% das impressões do site**.

O efeito na tela não é um número errado — é um número **ausente**. Pela dimensão `query`, que é a
que a aba usa, o domínio novo devolve 36 impressões e zero cliques, e nenhuma de suas páginas tem
posição média dentro da faixa que o balizador cobre (≤ 10,9). O Índice de Conformidade sai sem
denominador. Um painel mudo é indistinguível de um painel que ninguém apurou.

Somando e mesclando os dois hosts, o veredito existe e é **13,04%** — 3 páginas de 23 atingem o
piso da própria posição, contra a meta de 75% a 80% do board. A soma não salva o número: ela
devolve o veredito.

**A 029 somou a SÉRIE. A leitura por página ficou de fora** — mais uma fonte do padrão já
registrado em `migracao_tratada_em_uma_fonte_so`, cuja lição é exatamente esta: consertar a
migração numa fonte só deixa o resto contando o site pela metade.

## As três leituras com o mesmo defeito

O defeito não é da aba de aquisição: é da decisão, repetida em três lugares, de olhar para **um**
endereço e filtrar o resultado por ele. Consertar só a leitura que foi reportada deixa as outras
duas quebradas — `guarda_no_chamador_volta_pela_porta_seguinte`, sexta ocorrência no repo.

| Leitura | Quem consome | O que quebra hoje |
|---|---|---|
| Consultas por termo e página | aba de aquisição — ramo CLIQUE inteiro do board | 7 KPIs sem denominador ou subcontados |
| Desempenho por página | ficha e OKR do projeto | a página de maior movimento some da ficha |
| Duas janelas comparadas | autopublishing (escolha de pauta) | URL já ranqueada é lida como pauta nova |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - O ramo CLIQUE volta a enxergar o site (Priority: P1)

O dono abre a aba de aquisição de um projeto que trocou de domínio e lê os KPIs de clique do
board sobre o site inteiro — as páginas do domínio novo e as do antigo, somadas, cada página
contada uma vez só.

**Why this priority**: é a tela que motivou a spec e a única que hoje publica ausência no lugar de
veredito. Sozinha ela já devolve os sete KPIs do ramo CLIQUE.

**Independent Test**: abrir a aba de aquisição da Atma e conferir que o total de impressões do
bloco de consultas fecha com a soma das duas propriedades consultadas à mão no mesmo dia.

**Acceptance Scenarios**:

1. **Given** um projeto com `url` e `dominioAnterior` declarados, **When** a aba de aquisição lê as
   consultas da janela, **Then** as linhas devolvidas cobrem os dois hosts e o total de impressões
   é igual à soma das duas propriedades.
2. **Given** a mesma página existindo nos dois hosts, **When** os KPIs por URL são calculados,
   **Then** ela aparece **uma vez**, com cliques e impressões somados e posição média ponderada
   por impressões.
3. **Given** um projeto sem `dominioAnterior`, **When** a aba lê as consultas, **Then** o resultado
   é idêntico ao de hoje — um host, uma propriedade, uma requisição.
4. **Given** uma das propriedades declaradas falhando na consulta, **When** a aba monta o bloco,
   **Then** nenhum número do bloco é publicado e a tela nomeia o host que falhou.

---

### User Story 2 - A ficha conta o site inteiro (Priority: P2)

O dono abre a ficha do projeto e a lista de páginas mostra o site inteiro, não a fatia que já
migrou.

**Why this priority**: mesma raiz, tela diferente, e hoje ela esconde a página que carrega 90% do
movimento do projeto. Entrega valor sozinha, mas a aba de aquisição é onde o board mora.

**Independent Test**: abrir a ficha da Atma e conferir que `/blog/quanto-custa-alinhador-invisivel`
aparece com as ~22.000 impressões, e não com as 5 do domínio novo.

**Acceptance Scenarios**:

1. **Given** um projeto com dois hosts declarados, **When** a ficha lê as páginas da janela,
   **Then** a lista traz as páginas dos dois hosts, mescladas por caminho.

---

### User Story 3 - O autopublishing para de tratar URL ranqueada como pauta nova (Priority: P3)

O robô de pauta lê o histórico de busca do site inteiro antes de decidir que um assunto é novo.

**Why this priority**: mesma raiz e o risco é real — uma URL que ranqueia no domínio antigo é
invisível para a leitura atual, e o robô pode publicar uma segunda página para o mesmo termo. Fica
em P3 porque a mudança toca o autopublishing, que a constituição obriga a subir por `dry_run` e
pelos quatro canários; o conserto compartilhado pode existir antes desse rollout.

**Independent Test**: rodar o autopublishing da Atma em `dry_run` e conferir que as URLs do domínio
antigo aparecem no histórico lido, em vez de resultarem em pauta marcada como nova.

**Acceptance Scenarios**:

1. **Given** um projeto com dois hosts declarados, **When** o autopublishing lê as janelas de
   busca, **Then** as URLs dos dois hosts entram no histórico que decide se a pauta é nova.

---

### Edge Cases

- **A mesma página nos dois hosts.** Cinco páginas da Atma existem nos dois hoje. Empilhar as
  respostas sem mesclar transformaria cada uma em duas linhas do KPI: a campeã apareceria com
  22.059 impressões na posição 7,3 e, ao lado, com 5 impressões na posição 21 — e o balizador
  reprovaria a segunda por ruído. A chave de agrupamento é o **caminho**, não a URL crua.
- **A posição ao mesclar.** Posição é média ponderada por impressões, nunca média simples: a linha
  de 5 impressões na posição 21 não pode arrastar a página que vive na posição 7.
- **Uma propriedade falha.** Mesmo contrato da 029: nada é publicado com um host faltando. Um total
  que encolhe sem explicação é pior que um erro declarado.
- **Host declarado sem propriedade no Search Console.** É ausência estrutural, não falha
  transitória — os dois estados pedem conserto diferente e não podem colapsar num só.
- **O teto de linhas por requisição** vale por propriedade, não pelo total: o resultado é truncado
  se **qualquer** propriedade truncar.
- **Domínio antigo já zerado.** Quando o 301 terminar de transferir, o host antigo devolve zero
  linhas e a soma continua correta sem nenhuma mudança — a lista de hosts é declarada no card, não
  inferida do tráfego.
- **A dimensão `query` omite consultas raras.** Medido na Atma: `query`+`page` devolve 10.359 das
  24.566 impressões (42%) e nenhum dos 8 cliques do domínio novo. Somar hosts **não** conserta
  isso, e a ressalva de piso continua valendo onde já vale.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Toda leitura por página do Search Console MUST consultar **todos** os hosts
  declarados do projeto, usando a mesma lista que a série já usa. Uma segunda lista de hosts é
  proibida — ela divergiria da primeira no primeiro projeto novo.
- **FR-002**: As linhas devolvidas MUST ser mescladas pelo **caminho** da página, com cliques e
  impressões somados e posição média ponderada por impressões.
- **FR-003**: A página mesclada MUST ser identificada pelo host declarado em `url` (o atual),
  para que a tela nomeie o endereço que o visitante vê hoje.
- **FR-004**: Nenhum número da leitura MUST ser publicado quando qualquer host declarado falhar na
  consulta; a falha MUST nomear o host.
- **FR-005**: O resultado MUST declarar truncamento quando qualquer uma das propriedades atingir o
  teto de linhas da requisição.
- **FR-006**: Projeto com um único host declarado MUST produzir exatamente o resultado de hoje,
  com uma única requisição por janela.
- **FR-007**: As três leituras MUST resolver os hosts no mesmo lugar, de modo que ligar um host
  novo passe a valer para as três de uma vez. Consertar uma e deixar as outras é o defeito que esta
  spec fecha, não o que ela entrega.
- **FR-008**: A tela MUST declarar quais hosts foram consultados, e não apenas o total. Um número
  somado sem a assinatura de quem o compôs não é conferível.

### Key Entities

- **Host declarado**: o endereço atual do projeto e o anterior, quando houver. Vive no card do
  projeto, nunca inferido do tráfego.
- **Linha de busca**: consulta, página, cliques, impressões e posição, dentro de uma janela.
- **Página mesclada**: o caminho, com as métricas somadas de todos os hosts declarados, a posição
  ponderada e a lista de hosts que contribuíram.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A aba de aquisição de um projeto em migração publica os KPIs de clique sobre **≥ 99%
  das impressões que o Search Console tem do site**. Medido hoje na Atma: 0,4%.
- **SC-002**: O Índice de Conformidade da Atma deixa de sair sem denominador e passa a avaliar 23
  páginas. Hoje: nenhuma.
- **SC-003**: Nenhuma página aparece duas vezes na lista de URLs. Sem a mescla, 5 páginas da Atma
  apareceriam duplicadas.
- **SC-004**: O total de impressões do bloco fecha com a soma das propriedades conferida à mão no
  mesmo dia, com diferença zero.
- **SC-005**: A ficha da Atma mostra a página de maior movimento do site com as ~22.000 impressões
  que ela tem, e não com as 5 do domínio novo.
- **SC-006**: Com um host declarado indisponível, a tela não publica número nenhum do bloco e nomeia
  o host — verificável desligando uma propriedade na conferência.

## Assumptions

- A lista de hosts declarados já existe e é a fonte de verdade da 029 — esta spec a reusa, não cria
  outra.
- A janela continua sendo a de descoberta (28 dias, D-30 a D-3). Esta spec não mexe em janela.
- A série diária já soma os hosts desde a 029 e **não** é tocada aqui.
- Um projeto tem no máximo dois hosts declarados (atual e anterior). Uma lista de N hosts funciona
  pelo mesmo caminho, mas nenhum projeto tem três hoje.
- O custo de rede dobra para projetos em migração (uma requisição por host por janela) e continua
  igual para todos os outros — apenas a Atma declara `dominioAnterior` hoje.
- A mudança no autopublishing sobe pelo rollout que a constituição exige (`dry_run` e os quatro
  canários), e pode ser separada das duas primeiras histórias.
