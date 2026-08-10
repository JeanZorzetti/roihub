# Feature Specification: Observabilidade dos recursos de IA e saúde dos empregados nas automações

**Feature Branch**: `002-observabilidade-ia`

**Created**: 2026-08-10

**Status**: Draft

**Input**: User description: "Crie a spec 2 para observabilidade dos recursos de IA e saúde desses empregados nas automações. Pesquise o conceito atual de observabilidade no contexto da IA para ser uma spec bem completa"

**Pesquisa de base**: `pesquisa.md` (estado da arte de observabilidade de IA em 2026, inventário do
repo e as 6 decisões que ela fecha). Esta spec assume aquelas decisões.

---

## Contexto verificado no código (10/08)

"Recursos de IA" e "empregados" neste repo são **seis consumidores de claude-cli**, todos disputando
o **mesmo pool de contas de assinatura** (`CLAUDE_CODE_OAUTH_TOKENS`, plural):

| Empregado | Onde | Quando roda | O que se sabe hoje sobre ele |
|---|---|---|---|
| Autopublishing (draft + classificador YMYL) | `lib/autopublish-clients.ts` | cron 00:13 BRT, 10 projetos | tokens agregados por publicação em `seo_publications` |
| Reranker da `/busca` | `lib/reranker.mjs` | 1×/busca | **nada** |
| Síntese da resposta | `lib/resposta.mjs` | 1×/busca | **nada** |
| Juiz da síntese | `lib/juiz.mjs` | corridas de régua, 3×/pergunta | JSON por corrida em `data/juiz-corridas/` |
| Detector de defasagem | `scripts/corpus-defasado.mjs` | à mão (congelado) | JSON em `data/corpus-defasado/` |
| Sonda do pool | `lib/reranker.mjs` (`sondar`) | 23:37 BRT + à mão | `data/pool-sondagens.json`, **3 leituras ao todo** |

**Os quatro fatos que motivam a feature:**

1. **A telemetria já chega e é jogada fora.** `spawnClaude` (`lib/reranker.mjs:243`) resolve
   `payload.result` e descarta `total_cost_usd`, `duration_ms`, `num_turns`, `usage` e `session_id`,
   que o claude-cli devolve em toda chamada `--output-format json`.
2. **Quatro dos seis empregados não deixam rastro nenhum.** Em 31/07 a `/busca` ficou morta em
   produção e o sintoma reportado foi `rerank-output`/`resposta-output` — o código de "o modelo
   escreveu bobagem" — quando a causa era duas de três contas do pool mortas.
3. **O 403 da conta 3 continua sem data.** As três leituras de `data/pool-sondagens.json` cobrem
   ~10 h e duas estão a 13 minutos de distância; ~10 h não separam "morta de vez" de "morta desde
   ontem à noite" — e é essa distinção que decide entre **repor** conta (comprar) e **esperar** o
   429 recarregar.
4. **O pool é o orçamento, e ele já foi estourado.** Uma corrida do portão custa 85 chamadas contra
   3 contas que o autopublishing divide; uma corrida morta no meio virou pool em pó, e o
   `.cache/rerank.json` só retoma o que deu certo.

**Fora do escopo por decisão da pesquisa** (`pesquisa.md` §3): SDK/collector de OpenTelemetry
(adota-se o vocabulário, não a dependência), captura de texto de prompt ou resposta, e qualquer meta
numérica sobre a primeira janela de coleta.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Toda chamada de IA deixa um registro (Priority: P1)

Hoje quatro dos seis empregados trabalham sem folha de ponto. Quem opera o hub precisa poder olhar
uma janela de tempo e ver **cada chamada de IA que aconteceu**: qual empregado a fez, contra qual
conta do pool, quanto demorou, quantos tokens custou, e se terminou em sucesso ou num código de erro
estável — sem abrir SSH, sem `git log` e sem depender de alguém ter salvo um JSON à mão.

**Why this priority**: É a fundação de todo o resto. Sem a série por chamada, "saúde" é anedota:
não dá para datar o 403, não dá para dizer se a busca degradou, não dá para saber quanto do pool
sobrou antes de disparar uma corrida de régua. As outras histórias só existem em cima desta.

**Independent Test**: Rodar uma busca em produção e conferir que ela aparece como **duas** chamadas
registradas (rerank + síntese), com empregado, conta, duração, tokens e desfecho — e que uma busca
com `?rerank=0&resposta=0` não registra nenhuma.

**Acceptance Scenarios**:

1. **Given** o reranker e a síntese estão ligados, **When** uma busca é executada, **Then** duas
   chamadas ficam registradas, cada uma identificando o empregado (`rerank`, `resposta`), o modelo,
   a duração, os tokens de entrada e saída e o desfecho.
2. **Given** o autopublishing roda o ciclo diário, **When** um projeto é publicado, **Then** cada
   chamada de LLM daquele projeto fica registrada individualmente — não apenas o agregado da
   publicação em `seo_publications`.
3. **Given** uma chamada termina em erro, **When** o registro é gravado, **Then** ele carrega o
   **código estável** já usado pela casa (`llm-rate`, `rerank-conta`, `resposta-output`,
   `juiz-timeout`…) e **nunca** o texto devolvido pelo modelo.
4. **Given** um pedido lógico exigiu percorrer o pool (a 1ª conta devolveu 429 e a 2ª respondeu),
   **When** ele é registrado, **Then** as duas tentativas aparecem — uma falha e um sucesso — e não
   uma única linha de sucesso que esconderia a saturação.

---

### User Story 2 - A saúde de cada conta do pool é datada (Priority: P1)

Quem decide o orçamento de IA precisa responder, para cada conta do pool: **em que estado ela está e
desde quando**. Não "as três estão esgotadas" — mas "a conta 2 está em 429 desde as 21h de ontem
(recarrega) e a conta 3 está em 403 desde 02/08 (não recarrega)". A primeira leitura pede paciência;
a segunda pede uma conta nova.

**Why this priority**: É a pergunta que a sonda foi construída para responder e que ela ainda não
responde, porque o histórico mora num arquivo do repo com três leituras coladas. É também a única
história desta spec que muda uma decisão de dinheiro.

**Independent Test**: Consultar o estado do pool e obter, para cada conta, o estado atual
(`viva`/`rate-limit`/`desabilitada`/`auth`/`outro`) e a **data em que aquele estado começou** —
verificando que uma conta que mudou de estado entre duas sondagens tem a transição registrada.

**Acceptance Scenarios**:

1. **Given** a sonda noturna rodou por vários dias, **When** alguém consulta a saúde do pool,
   **Then** cada conta mostra o estado atual e **desde quando** está nele.
2. **Given** uma conta passa de `rate-limit` para `viva` entre duas sondagens, **When** a transição
   ocorre, **Then** ela fica registrada com data e hora — o histórico não é sobrescrito pela leitura
   mais recente.
3. **Given** uma conta está `desabilitada` (403), **When** o estado é apresentado, **Then** ele é
   visivelmente distinto de `rate-limit` (429), porque um recarrega sozinho e o outro não.
4. **Given** a variável de ambiente do pool está ausente ou vazia, **When** a sondagem roda,
   **Then** ela **falha fechada** — nunca reporta "nenhuma conta com problema".

---

### User Story 3 - Uma tela responde as perguntas do dia (Priority: P2)

A pessoa que abre o hub de manhã precisa ver, num lugar só: quanto do pool foi consumido nas últimas
24 h e por qual empregado; quantas chamadas falharam e sob quais códigos; a latência típica de cada
empregado; e o estado datado das contas. Sem isso, o registro da US1 é um banco que ninguém lê.

**Why this priority**: É o que transforma dado em decisão, mas depende inteiramente das US1/US2 — e
o dado bruto já tem valor sozinho para diagnóstico pontual. Por isso P2, não P1.

**Independent Test**: Abrir a tela depois de um ciclo noturno completo e conferir que ela mostra o
consumo por empregado, a quebra de falhas por código e a saúde datada do pool, batendo com os
registros brutos da mesma janela.

**Acceptance Scenarios**:

1. **Given** o ciclo noturno rodou, **When** a tela é aberta, **Then** ela mostra o consumo das
   últimas 24 h quebrado **por empregado**, não só o total.
2. **Given** houve falhas na janela, **When** a tela é aberta, **Then** as falhas aparecem agrupadas
   por código estável, com contagem por código.
3. **Given** uma janela em que a coleta de telemetria falhou, **When** a tela é aberta, **Then** ela
   mostra **lacuna de telemetria** explicitamente, jamais "zero chamadas" ou "zero falhas".
4. **Given** um empregado não foi acionado na janela, **When** a tela é aberta, **Then** ele aparece
   como *não acionado*, distinto de *acionado e sem falhas*.

---

### User Story 4 - Mudança de regime vira card, sem virar ruído (Priority: P3)

Quando um sinal muda de patamar — um empregado que passa a falhar, uma conta que morre, a latência
do reranker que dobra — isso deve aparecer como card na agenda do dia, pelo mesmo mecanismo de
**diff** do estado noturno: só o que **apareceu** ou **sumiu** vira card. Noite sem mudança é
silenciosa.

**Why this priority**: Sem isso alguém precisa lembrar de olhar a tela. Mas alerta em cima de série
que ainda não foi calibrada gera ruído, e ruído mata o mecanismo de card que hoje funciona — logo,
depois das três primeiras.

**Independent Test**: Provocar uma mudança de estado (desligar uma conta do pool) e verificar que a
corrida seguinte gera exatamente um card; rodar de novo sem mudar nada e verificar que **nenhum**
card é gerado.

**Acceptance Scenarios**:

1. **Given** o estado de observabilidade é idêntico ao do dia anterior, **When** a corrida noturna
   roda, **Then** nenhum card é criado.
2. **Given** uma conta do pool mudou de estado desde ontem, **When** a corrida roda, **Then** um
   card é criado nomeando a conta, o estado novo e desde quando.
3. **Given** é a **primeira** corrida deste coletor, **When** ela roda, **Then** ela grava a linha de
   base e **não** gera card — a alternativa seria publicar a linha de base disfarçada de achado.
4. **Given** o coletor de observabilidade estourou, **When** a corrida roda, **Then** ele devolve
   zero chave e vira card de coletor caído — nunca deixa o diff ler a ausência como conserto.

---

### User Story 5 - Sonda o orçamento antes de gastar (Priority: P3)

Antes de disparar uma corrida cara (o portão do reranker são 85 chamadas; o juiz são 3 por
pergunta), quem vai rodar precisa saber quanto do pool está disponível **agora** e quanto a corrida
vai custar — para não descobrir no meio, com o parcial gravado e nenhum número publicável.

**Why this priority**: É a economia mais direta da feature (uma corrida morta custa o pool da noite),
mas hoje já existe uma versão manual — `probe-pool.mjs`, ~40 s. O ganho é automatizar o julgamento,
não criar a capacidade.

**Independent Test**: Consultar o orçamento antes de uma corrida conhecida e conferir que ele
apresenta contas vivas, consumo já feito na janela e o custo estimado da corrida em chamadas.

**Acceptance Scenarios**:

1. **Given** duas das três contas estão indisponíveis, **When** alguém consulta o orçamento antes de
   uma corrida de 85 chamadas, **Then** a consulta indica que a corrida é arriscada com a capacidade
   atual.
2. **Given** uma corrida foi abortada por 3 falhas de conta seguidas, **When** os registros dela são
   lidos, **Then** eles ficam marcados como **incompletos** e nenhum agregado é apresentado a partir
   deles.

---

### Edge Cases

- **A escrita da telemetria falha** (banco fora, disco cheio): a chamada de IA **não pode** falhar
  por causa do registro — o autopublishing e a busca continuam funcionando. Mas a lacuna precisa
  aparecer como lacuna; janela sem telemetria nunca é janela sem falhas.
- **A resposta veio do cache** (`.cache/rerank.json`, usado só nas medições): não houve chamada, mas
  se o acerto de cache não for registrado, o custo medido de uma corrida some do histórico e a
  próxima leitura subestima o gasto.
- **O observador consome o observado**: a sonda gasta 1 chamada por conta. Ela precisa ser
  distinguível do tráfego que mede, senão o consumo da medição vira consumo do produto.
- **Uma chamada lógica vira N tentativas** ao percorrer o pool. Contar só as tentativas infla o
  volume; contar só o sucesso esconde a saturação. Os dois números têm que ser deriváveis.
- **Chamadas do ambiente de desenvolvimento** (Windows/OneDrive, sem os tokens de produção) não
  podem poluir a série de produção — hoje `rodarClaude` sem pool cai na autenticação ambiente do
  CLI de propósito, para permitir medir na máquina do dev.
- **Duas corridas no mesmo dia**: como em `hub_estado` (PK `run_date`), repetir o dia tem que
  produzir o mesmo resultado, não somar duas vezes.
- **Um empregado novo entra no repo** sem ser instrumentado: ele aparece como ausente da série, o
  que é indistinguível de "não rodou". O registro precisa vir do caminho compartilhado do `spawn`,
  não de cada chamador lembrar de instrumentar.
- **A janela de queda do hub na madrugada** (`request-failed` do autopublish, e a 1ª corrida do
  estado morrendo em `curl: (28)`) é falha de **infraestrutura**, não de LLM. Se o registro tratar
  as duas como a mesma coisa, o diagnóstico vai de novo para o lugar errado.
- **Retenção**: a série cresce a cada busca. Sem uma política de retenção declarada, a tabela vira o
  maior objeto do banco em meses.

---

## Requirements *(mandatory)*

### Functional Requirements

**Coleta**

- **FR-001**: Toda invocação de LLM feita pelo hub MUST produzir um registro individual, qualquer
  que seja o empregado que a fez.
- **FR-002**: O registro MUST identificar: o **empregado** (autopublish-draft, autopublish-ymyl,
  rerank, resposta, juiz, defasagem, sonda), o **modelo**, o **effort**, a **conta do pool** usada
  (por identificador estável, nunca o token), o **início**, a **duração**, os **tokens de entrada e
  saída**, o **desfecho** e o **ambiente** (produção ou desenvolvimento).
- **FR-003**: O desfecho de erro MUST ser um dos códigos estáveis já usados pela casa
  (prefixo do empregado + sufixo da classe: `-auth`, `-rate`, `-cli`, `-output`, `-parse`,
  `-timeout`, `-conta`). Código novo MUST ser adicionado ao conjunto validado, como já ocorre com o
  regex de status de `run-autopublish.mjs`.
- **FR-004**: O registro MUST NOT conter o texto do prompt, do resultado ou do stderr. Identificação
  do conteúdo MUST usar hash e tamanho.
- **FR-005**: Cada **tentativa** contra uma conta MUST ser registrada, de forma que "quantas
  tentativas" e "quantos pedidos lógicos" sejam ambos deriváveis da mesma série.
- **FR-006**: A coleta MUST ser feita no caminho compartilhado de invocação, e não em cada chamador
  — empregado novo passa a ser observado sem que ninguém lembre de instrumentá-lo.
- **FR-007**: A falha da coleta MUST NOT fazer a chamada de IA falhar (registro best-effort), **e**
  MUST ficar visível como lacuna de telemetria naquela janela.
- **FR-008**: Chamadas atendidas por cache MUST ser registradas como tal, distintas de chamadas que
  chegaram ao modelo.
- **FR-009**: Registros de ambiente de desenvolvimento MUST ser separáveis dos de produção em
  qualquer agregação.

**Saúde do pool**

- **FR-010**: O sistema MUST manter o histórico de estado de cada conta do pool ao longo do tempo,
  com a data de início do estado corrente — não apenas a última leitura.
- **FR-011**: O sistema MUST distinguir `rate-limit` (429, recarrega) de `desabilitada` (403, não
  recarrega) em toda apresentação, porque as duas prescrevem ações opostas.
- **FR-012**: Pool ausente ou vazio MUST falhar fechado (erro explícito), nunca ser lido como
  "nenhuma conta com problema".
- **FR-013**: O histórico de sondagens MUST persistir onde a produção escreve (o mesmo banco do
  resto do estado), e não num arquivo versionado no repo.

**Leitura**

- **FR-014**: Users MUST be able to ver, para uma janela de tempo, o consumo por empregado, a
  contagem de falhas por código e a latência típica por empregado.
- **FR-015**: Users MUST be able to ver o estado datado de cada conta do pool.
- **FR-016**: A apresentação MUST distinguir três estados por empregado: *não acionado*, *acionado
  sem falhas* e *sem telemetria* — pelo mesmo motivo pelo qual o placar de conformidade imprime
  `n/a` separado de aprovado.
- **FR-017**: Corridas abortadas por esgotamento do pool MUST ser marcadas como incompletas, e
  nenhum agregado MUST ser apresentado a partir de uma corrida incompleta sem essa marca.

**Diff e alerta**

- **FR-018**: A mudança de estado de observabilidade MUST alimentar o mecanismo de card já existente
  (diff contra o dia anterior), e apenas células que apareceram ou sumiram MUST virar card.
- **FR-019**: A primeira corrida do coletor MUST gravar a linha de base sem gerar card.
- **FR-020**: Coletor que estoura MUST devolver zero chave e virar card de coletor caído, carregando
  os valores do dia anterior — nunca deixar o diff ler a ausência como conserto.

**Orçamento**

- **FR-021**: Users MUST be able to consultar, antes de uma corrida cara, a capacidade disponível do
  pool e o custo previsto da corrida em chamadas.

**Retenção**

- **FR-022**: A série de registros MUST ter política de retenção declarada, com resumo agregado
  preservado além da janela de detalhe.

### Key Entities

- **Chamada de IA**: uma invocação do modelo por um empregado. Atributos: empregado, modelo,
  effort, conta usada, início, duração, tokens de entrada/saída, desfecho (sucesso ou código
  estável), hash e tamanho do prompt, indicador de cache, ambiente, identificador da corrida a que
  pertence.
- **Empregado**: o consumidor de IA que fez a chamada — a unidade pela qual consumo, falha e
  latência são atribuídos. Cada empregado tem um prefixo de código de erro próprio.
- **Conta do pool**: uma das credenciais de assinatura em `CLAUDE_CODE_OAUTH_TOKENS`, identificada
  por um rótulo estável (nunca pelo segredo). Atributos: estado corrente, data de início do estado,
  histórico de transições.
- **Corrida**: o agrupamento de chamadas de um mesmo trabalho (um ciclo de autopublishing, uma
  corrida de régua, uma busca). Atributos: empregado, início, fim, total de chamadas, marca de
  incompleta.
- **Janela de observabilidade**: o recorte de tempo sobre o qual se agrega, com um estado próprio
  para *sem telemetria*.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das invocações de LLM feitas pelo hub em produção aparecem na série — verificável
  contando as chamadas de um ciclo noturno de autopublishing contra o número de projetos processados.
- **SC-002**: Dado um incidente como o de 31/07 (contas do pool mortas com a busca reportando
  `-output`), a causa é identificável a partir da série sozinha, sem acesso ao servidor.
- **SC-003**: Para qualquer conta do pool, a resposta a "desde quando está neste estado" tem
  precisão de no máximo 24 h — hoje a melhor resposta disponível é "em algum ponto de uma janela de
  ~10 h, há mais de uma semana".
- **SC-004**: Antes de uma corrida cara, é possível saber quantas contas estão vivas e quanto já foi
  consumido na janela, sem gastar mais que 1 chamada por conta.
- **SC-005**: Uma corrida do coletor sem mudança de estado gera **zero** cards.
- **SC-006**: Uma janela em que a coleta falhou é apresentada como lacuna, e **nunca** como zero
  falhas — verificável derrubando a escrita de telemetria de propósito.
- **SC-007**: Nenhum registro contém texto de prompt, resultado ou stderr — verificável por check
  automático sobre uma amostra da série.
- **SC-008**: A observabilidade não consome mais que 1 chamada por conta por dia (a sonda já
  existente); tudo o mais é derivado de payload que já vem nas chamadas de trabalho.

**Não é critério de sucesso desta spec**: qualquer meta sobre o *valor* dos números na primeira
janela (taxa de falha, latência, consumo). A primeira corrida de um check novo mede o check — regra
confirmada quatro vezes nesta base — e meta sobre a linha de base é meta em cima de um defeito de
coleta.

---

## Assumptions

- **"Recursos de IA" e "empregados" são os seis consumidores de claude-cli listados acima.** Não há
  outro modelo em uso no hub além do claude-cli e do Ollama (embeddings). O Ollama entra apenas se e
  quando a indexação passar a rodar em produção — hoje ela só roda na máquina do dev
  (`OLLAMA_URL` é `127.0.0.1:11434`), então está fora desta spec.
- **Não se adota SDK nem collector de OpenTelemetry** — adota-se o vocabulário dos atributos
  `gen_ai.*` na nomeação dos campos, para manter a porta aberta sem pagar infra. Decisão de
  `pesquisa.md` §3.2.
- **O custo em dólar é nominal e secundário.** Com claude-cli o gasto marginal é zero; a unidade de
  orçamento é **chamada por conta por janela de rate limit**. `estimated_cost_usd` continua
  existindo em `seo_publications` e não é a métrica que esta feature otimiza.
- **`seo_publications` não é substituída.** Ela continua sendo o registro de *publicação* (uma linha
  por projeto por dia, com o commit e o resultado editorial). A série nova é de *chamada*, num nível
  abaixo — as duas coexistem e devem bater entre si.
- **A coleta reaproveita o caminho noturno já existente** (`POST /api/estado`, Bearer
  `CRON_SECRET`, 23:37 BRT) em vez de introduzir um cron ou um segredo novos: quem já sonda o pool e
  grava card de agenda não ganha capacidade nova gravando telemetria. Segredo próprio é para
  capacidade maior — o critério que criou o `CRM_INGEST_SECRET`.
- **A escrita de telemetria é best-effort para o caminho de trabalho** (mesma decisão da spec 001
  para o CRM): nenhuma publicação e nenhuma busca pode falhar porque o registro falhou. Mas, ao
  contrário da spec 001, **a lacuna resultante não pode ser silenciosa** — aqui o dado ausente
  produz a leitura mais otimista possível, e essa é a assimetria que a spec 001 não tinha.
- **Duas implementações de `spawn` continuam existindo** (`lib/autopublish-clients.ts` e
  `lib/reranker.mjs`) — a duplicação é deliberada, para que a medição em node puro e a aba rodem o
  mesmo caminho. A instrumentação precisa cobrir as duas; unificá-las está fora do escopo.
- **Os testes seguem `node --test`**, sem framework, com o arquivo novo adicionado à lista explícita
  do `package.json` — teste que não roda não reprova nada.
- **O consumo do dev não é o consumo de produção**, e o `.env` local não tem os tokens de produção;
  a separação por ambiente é um campo, não uma inferência.
