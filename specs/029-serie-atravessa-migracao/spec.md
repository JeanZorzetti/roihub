# Feature Specification: A série atravessa a migração de domínio

**Feature Branch**: `029-serie-atravessa-migracao`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "A série diária do Search Console (`hub_gsc_dia`) deve continuar medindo o NEGÓCIO durante uma troca de domínio declarada, em vez de seguir só a `url` atual do card."

## O fato medido que motivou esta spec

Medido na Atma em 18/09/2026, consultando as duas propriedades do Search Console no mesmo ato:

| dia | `atma.roilabs.com.br` (domínio anterior) | `usealigner.com` (domínio novo) | soma |
|---|---|---|---|
| 2026-09-13 | 557 | 0 | 557 |
| 2026-09-14 | 687 | 32 | 719 |
| 2026-09-15 | 1.146 | 31 | 1.177 |

O 301 do domínio anterior leva semanas para transferir os sinais: quatro dias depois da troca, o
domínio ANTERIOR ainda carrega **97%** das impressões do negócio.

A corrida diária passou a ler só a `url` do card e gravou **35 impressões em 16/09** — cerca de 3%
do que o negócio de fato fez naquele dia. O histórico não foi corrompido (a guarda de host da 026
recusou sobrescrever os 248 dias antigos), mas **todo dia novo nasce com um número falso**.

A tela `/okr/atma/aquisicao` ainda não exibe o erro porque o segmento novo não tem duas semanas
fechadas e a 026 manda ler o último segmento COM forma. Quando ele tiver, a tela vai declarar uma
queda de 97% que nunca aconteceu — sobre a mesma série que hoje diz "estacionado em 8,8% do pico".

## Clarifications

### Session 2026-09-18

- P: Se o domínio anterior sumir do Search Console (propriedade removida da conta), o que a corrida
  faz? → R: trata como **encerrado** e segue só com o host que sobrou, reportando o que saiu.
  Propriedade que não existe é ausência ESTRUTURAL, e a distinção entre ela e a falha transitória é
  a mesma que `lib/gsc.ts` já mantém (`null` contra `{erro}`). Congelar a série para sempre por
  causa de uma limpeza de conta trocaria um dano por outro.
- P: E quando a `url` de um projeto muda SEM `dominioAnterior` declarado? → R: a série **continua
  cortada em dois**. A costura vale só para migração DECLARADA; sem declaração o hub estaria
  adivinhando que dois sites são o mesmo negócio, e a guarda da 026 — que já impediu 248 dias de
  serem reescritos — segue inteira.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - O dia mede o negócio, não o domínio (Priority: P1)

O dono abre a tela de aquisição durante a transição de domínio e lê quanto o negócio foi encontrado
na busca. O número do dia soma todos os hosts que o card declara como sendo o site — o atual e o
anterior — porque durante o 301 os dois servem o mesmo negócio para o mesmo público.

**Why this priority**: sem isso a corrida grava 3% da realidade todo dia, e nenhuma outra parte da
feature tem valor sobre um número falso. É o único item que, sozinho, já impede o dano.

**Independent Test**: rodar a corrida diária num projeto com `dominioAnterior` declarado e conferir
que o dia gravado é igual à soma das duas propriedades consultadas à mão, no mesmo dia.

**Acceptance Scenarios**:

1. **Given** um projeto que declara domínio atual e domínio anterior, e um dia em que o anterior fez
   1.146 impressões e o atual fez 31, **When** a corrida diária grava esse dia, **Then** a série
   registra 1.177 impressões para o dia.
2. **Given** um projeto sem `dominioAnterior` declarado, **When** a corrida grava, **Then** o número
   é o do único host declarado e nada muda em relação ao comportamento anterior.
3. **Given** um dia em que o domínio anterior já não tem impressão nenhuma, **When** a corrida grava,
   **Then** o dia vale exatamente o que o domínio atual mediu, sem inflar nada.
4. **Given** uma das duas propriedades falha na consulta, **When** a corrida tenta gravar o dia,
   **Then** o dia NÃO é gravado como soma parcial — falta de resposta não pode virar queda.

### User Story 2 - A fronteira da troca é visível na tela (Priority: P2)

O leitor da tela vê UMA série contínua e enxerga onde o instrumento mudou de casa, além de quais
domínios a série soma e desde quando cada um entrou. Ele não precisa saber que houve migração para ler o
gráfico, mas quando perguntar "por que aqui muda", a tela responde sem que ele saia dela.

**Why this priority**: a soma sozinha esconde a troca; um gráfico contínuo sem fronteira nomeada
convida à conclusão errada quando o domínio anterior finalmente zerar e a série "cair" por
composição, não por volume.

**Independent Test**: abrir a tela de um projeto em transição e verificar que a série não é cortada
em dois vereditos, que a semana da troca não some, e que a fronteira aparece datada.

**Acceptance Scenarios**:

1. **Given** uma série que atravessa uma troca declarada, **When** a tela lê o ritmo de não-marca,
   **Then** o veredito usa a série inteira e não o último segmento com forma.
2. **Given** a mesma série, **When** a tela desenha as semanas, **Then** a semana que contém a troca
   aparece com valor (não vazia), e a fronteira é marcada e datada.
3. **Given** um dia da transição, **When** o leitor pergunta de onde veio o número, **Then** a tela
   nomeia os hosts somados e desde quando cada um entra na soma.

### User Story 3 - Os dias da transição já gravados são corrigidos (Priority: P3)

Os dias gravados entre a troca e a entrega desta feature ficaram com o número de um só domínio.
Depois de corrigidos, a série inteira passa a obedecer a mesma régua, sem que a proteção que impede
sobrescrever um dia com o número de OUTRO site seja perdida.

**Why this priority**: sem isso a série mistura duas réguas — dias antigos de um host e dias novos
somados — e a comparação semana a semana mede a mudança da régua. É correção de histórico: vale
menos que parar a hemorragia, mas a leitura não fecha sem ela.

**Independent Test**: rodar a correção e conferir que 14/09 vale 719 e 15/09 vale 1.177, enquanto
qualquer dia anterior à troca permanece com o valor que já tinha.

**Acceptance Scenarios**:

1. **Given** 16/09 gravado com 35 impressões (só o domínio novo), **When** a correção roda,
   **Then** o dia passa a valer a soma dos dois domínios naquele dia.
2. **Given** um dia anterior à troca, em que o domínio novo não existia, **When** a correção roda,
   **Then** o valor do dia não muda.
3. **Given** um projeto que NÃO declara `dominioAnterior`, **When** a correção roda, **Then** nenhum
   dia dele é tocado.
4. **Given** a correção já aplicada, **When** ela roda de novo, **Then** nada muda na segunda vez.

### Edge Cases

- **Uma das propriedades responde e a outra falha**: o dia não entra. Soma parcial é indistinguível
  de queda real, e é exatamente o defeito que esta spec existe para matar.
- **O domínio anterior volta a crescer**: é dado legítimo da transição e entra na soma como qualquer
  outro. Nada na régua depende de o anterior estar caindo.
- **Mais de uma troca de domínio na vida do projeto**: fora de escopo declarado — o card carrega um
  `dominioAnterior`, não uma lista. Um segundo salto reabre esta spec.
- **O domínio anterior é reaproveitado por outro projeto**: enquanto o card o declarar como seu, ele
  conta. Deixar de contar é ato de curadoria — apagar a declaração —, nunca inferência do hub.
- **Dia sem impressão em nenhum dos dois**: zero medido continua zero medido, e não vira ausência.
- **Contagem dobrada**: o mesmo host declarado duas vezes (com e sem `www.`) não pode somar duas
  vezes o mesmo dado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A corrida diária da série MUST medir todos os hosts que o card declara como sendo o
  site do projeto, e não apenas o host da `url` atual.
- **FR-002**: O valor de um dia MUST ser a soma dos hosts declarados naquele dia, para impressões e
  cliques.
- **FR-003**: A posição média do dia MUST ser ponderada pelas impressões de cada host — média de
  médias trocaria a posição de um domínio de 31 impressões pela de um de 1.146.
- **FR-004**: Um dia MUST NOT ser gravado quando qualquer host declarado FALHAR na consulta; a falha
  é reportada por projeto, com o nome do host que faltou.
- **FR-004a**: Host declarado que não tem propriedade no Search Console MUST ser tratado como
  encerrado — o dia é gravado com os hosts restantes e o host ausente é reportado. Ausência
  estrutural não é falha, e as duas MUST NOT ser colapsadas num motivo só.
- **FR-005**: A separação marca / não-marca MUST seguir a mesma régua da FR-001 a FR-003: as três
  pernas somam os mesmos hosts declarados, no mesmo ato e na mesma janela.
- **FR-006**: A proteção contra sobrescrever um dia com o número de outro site MUST continuar
  valendo para host NÃO declarado pelo card, e MUST deixar passar a regravação de um dia cujo
  conjunto de hosts declarados o inclui.
- **FR-007**: O sistema MUST registrar, por dia, quais hosts entraram na soma — sem isso a série não
  consegue distinguir "o anterior zerou" de "o anterior saiu da conta".
- **FR-008**: A tela MUST ler a série como uma só ao produzir o veredito de ritmo, em vez de escolher
  o último bloco contíguo de mesmo host.
- **FR-009**: A tela MUST marcar e datar a fronteira da troca de domínio na série.
- **FR-010**: A tela MUST nomear, para a janela exibida, os hosts somados e **desde quando cada um
  entra na soma**. A contribuição de cada host em impressões MUST NOT ser exibida enquanto a série
  guardar a soma do dia e não a parcela por host — o número existiria na tela e não no dado.
  ⚠️ Revisto durante a implementação (18/09): a redação original pedia a contribuição de cada um, o
  que exigiria uma linha por host (o modelo rejeitado em `research.md` D4). Quem entrou e quando é
  derivável da assinatura gravada e responde à mesma pergunta do leitor.
- **FR-011**: A semana que contém a troca de domínio MUST entrar na leitura com valor, deixando de
  ser descartada como semana partida entre dois sites.
- **FR-012**: Uma correção idempotente MUST regravar os dias já medidos sob um host só desde a data
  da troca declarada, e MUST NOT tocar dia anterior a ela nem projeto sem `dominioAnterior`.
- **FR-013**: Host declarado duas vezes sob formas equivalentes MUST contar uma vez só.
- **FR-014**: Projeto sem `dominioAnterior` MUST manter exatamente o comportamento atual da corrida.
- **FR-015**: A costura MUST valer somente para migração DECLARADA. Série cujo host muda sem
  declaração MUST continuar sendo lida como dois blocos separados, com a proteção contra
  sobrescrita intacta.
- **FR-016**: A correção de histórico MUST refazer também a separação marca / não-marca dos dias que
  regravar — o veredito do topo da tela é lido em impressões de não-marca, e corrigir só o total
  deixaria o número visível errado com o total certo por baixo.

### Key Entities

- **Série diária do projeto**: uma linha por projeto por dia, com impressões, cliques e posição do
  NEGÓCIO naquele dia, mais o registro de quais hosts foram somados para chegar a esse número.
- **Declaração de site do projeto**: o conjunto de hosts que o card afirma serem o site — o atual e,
  quando declarado, o anterior, com a data da troca e o porquê. É curadoria humana, nunca inferência.
- **Fronteira de migração**: a data declarada da troca, o host que saiu e o que entrou; é o que a
  tela marca e o que a correção de histórico usa como piso.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Na Atma, o dia 15/09/2026 lido na tela vale 1.177 impressões — a soma conferida nas
  duas propriedades — e não 1.146 nem 31.
- **SC-002**: Nenhum dia da série de um projeto em transição difere da soma conferida à mão nas
  propriedades do Search Console daquele dia.
- **SC-003**: A tela de aquisição produz um único veredito de ritmo sobre a série inteira, sem a
  frase "a série está encerrada" para um projeto que segue sendo medido.
- **SC-004**: Um leitor que não sabe da troca de domínio lê o gráfico sem chegar a uma conclusão
  errada sobre queda de volume, e encontra na própria tela quais domínios a série soma e desde
  quando cada um entrou.
- **SC-005**: Nenhum dia anterior à troca declarada muda de valor por causa desta feature.
- **SC-006**: Rodar a correção de histórico duas vezes produz o mesmo resultado da primeira.

## Assumptions

- **A janela da soma é a declaração, não o calendário**: enquanto o card declarar `dominioAnterior`,
  os dois hosts somam. Encerrar a soma é apagar a declaração — ato humano de curadoria, como a lista
  de termos de marca da 025. O hub não decide sozinho que o 301 "já terminou".
- **A regra já existe na casa**: o bloco de Comportamento (GA4) desta mesma tela já mede o negócio
  como o conjunto dos hosts declarados. Esta feature estende a mesma régua à busca, em vez de
  inventar uma segunda definição de "o site".
- **Um `dominioAnterior` por projeto**: a estrutura do card comporta uma troca. Duas trocas em
  sequência exigem spec nova.
- **O histórico anterior à troca está correto**: os 248 dias gravados sob o domínio anterior foram
  medidos quando ele era o único site do projeto, e nada nesta feature os revisita.
- **Escopo dos projetos afetados**: só os que declaram `dominioAnterior` — hoje, a Atma. Os demais
  seguem idênticos, o que também é o critério de regressão.
