# Fase 0 — Pesquisa: N4 por canal, GA4 somado ao GSC

**Feature**: `013-n4-canais-ga4-somado` | **Data**: 2026-09-02

Todo `NEEDS CLARIFICATION` do Technical Context é resolvido aqui. As três perguntas de escopo já
tinham sido fechadas na sessão de clarificação da spec (02/09) e não voltam.

---

## D1 — Como falar com o GA4 sem dependência nova

**Decisão**: chamar a **GA4 Data API v1beta** (`runReport`) por HTTP, autenticando com
`google-auth-library` — a mesma biblioteca que `lib/gsc.ts` já usa — num `GoogleAuth` **próprio**,
com escopo `https://www.googleapis.com/auth/analytics.readonly`.

**Motivo**: `google-auth-library` já é dependência de produção (`package.json`). O pacote oficial
`@google-analytics/data` traz gRPC e protobuf para fazer um POST em JSON. A constituição não proíbe
dependência, mas ela custa imagem Docker e superfície de atualização para zero capacidade nova.

**Por que um `GoogleAuth` separado e não o de `lib/gsc.ts`**: o cliente do GSC é um
`clientPromise` memoizado com escopo `webmasters.readonly`. Reaproveitá-lo exigiria mudar o escopo
do cliente que hoje serve o número orgânico de **todos** os projetos — e a SC-008 exige que o
número orgânico saia idêntico depois da mudança. Um arquivo novo (`lib/ga4.ts`) não toca em uma
linha de `lib/gsc.ts`. É também o que torna a FR-008 (falha FECHADA) verdadeira por construção:
`lib/ga4.ts` inteiro pode explodir sem alcançar o caminho do GSC.

**Alternativas consideradas**: `@google-analytics/data` (rejeitada: dependência para um POST);
reutilizar o cliente do GSC com escopos somados (rejeitada: mexe no caminho do orgânico);
Measurement Protocol / export para BigQuery (rejeitadas: não respondem "sessões por canal na
janela").

**Credencial**: `GOOGLE_SERVICE_ACCOUNT_JSON`, a que já existe. Nenhuma variável nova.
Pré-requisito **operacional**, fora do código: a conta de serviço precisa ser adicionada como
**Visualizador** na propriedade GA4 de cada projeto. Sem isso a API responde 403 e os canais saem
`não apurado` nomeando a falha — que é exatamente o comportamento desenhado (FR-003, AS-4 da US1),
não uma regressão.

---

## D2 — Qual dimensão do GA4 responde "canal"

**Decisão**: `sessionDefaultChannelGroup` × métrica `sessions`, no intervalo `INICIO..FIM`.

**Motivo**: é a classificação que o próprio GA4 aplica à sessão, sem o hub reimplementar regra de
atribuição a partir de `source`/`medium`. Reimplementar produziria uma segunda régua de canal que
divergiria da tela do GA4 na primeira campanha com UTM torto — e aí ninguém saberia qual das duas
está certa.

**Alternativas consideradas**: `sessionSource`/`sessionMedium` crus (rejeitada: obriga o hub a
classificar); `firstUserDefaultChannelGroup` (rejeitada: mede aquisição do usuário, não o volume da
janela — não casa com "quanto cada canal trouxe na janela"); `totalUsers` como métrica (rejeitada:
usuário atravessa janela, sessão não).

---

## D3 — O mapa de canais, e o que ele deliberadamente NÃO mapeia

**Decisão**: mapa fixo, declarado em código puro:

| Grupo do GA4 | Canal do hub |
|---|---|
| `Direct` | `direto` |
| `Referral` | `indicacao` |
| `Organic Social` | `social` |
| `Paid Search`, `Paid Social`, `Paid Shopping`, `Paid Video`, `Paid Other`, `Display`, `Cross-network` | `pago` |
| `Organic Search` | **descartado, e nomeado na nota do nível** — o orgânico vem do Search Console (FR-005a) |
| qualquer outro (`Email`, `Affiliates`, `Organic Video`, `Organic Shopping`, `Audio`, `SMS`, `Mobile Push Notifications`, `Unassigned`, …) | **fora do catálogo** — nomeado com o volume, nunca somado a um canal existente (FR-009) |

**`outbound` continua sem fonte, de propósito.** O GA4 não tem grupo que corresponda a prospecção
ativa. A tentação era mapear `Email` → `outbound`: e-mail no GA4 é campanha de e-mail marketing,
não abordagem fria. Mapear seria "jogar num canal existente", exatamente o que o edge case da spec
proíbe. Então `outbound` sai `não apurado` nomeando que a fonte não o distingue — e é ele que
mantém a célula `diferença` em `não apurado` (FR-012), corretamente.

**Consequência na SC-001**: com GA4 ligado, os canais apurados vão de **1 para 5** (orgânico +
direto + pago + indicação + social). A SC-001 pede "pelo menos 4". Passa sem inventar canal.

**Alternativas consideradas**: mapear tudo o que sobra para `outbound` (rejeitada: transforma "não
sei classificar" em número de um canal específico — o defeito central que a casa combate);
descartar o resto em silêncio (rejeitada: FR-009); criar canais novos (rejeitada: Fora de escopo).

---

## D4 — Onde a leitura acontece, e por que não precisa de cache

**Decisão**: uma chamada ao GA4 por requisição da ficha `/okr/[slug]`, sem cache, sem lote.

**Motivo — e é a resposta ao item deferido no checklist da spec**: o N4 **só existe na ficha de um
projeto**. `montarN4()` é chamada por `montarNiveis()`, que tem um único chamador:
`app/okr/[slug]/page.tsx`. A `/okr` (portfólio, 35 projetos) **não monta N4** e não passa a chamar
o GA4. O medo registrado no checklist — "ler a fonte nova por projeto a cada requisição multiplica
chamadas externas" — não se materializa: o multiplicador é 1, não 35.

Uma requisição de ficha hoje já faz uma chamada ao GSC, uma ao GitHub (via `listProjects()`), uma
ao Postgres do hub e uma ao Postgres da Atma. A quinta chamada externa não muda a ordem de
grandeza, e cache traria de volta o problema que `force-dynamic` existe para evitar: número de uma
janela exibido dentro da janela declarada de outra (R7).

**Alternativas consideradas**: cache de 10 min como o `sitesCache` do GSC (rejeitada por ora:
otimização sem gargalo medido — o `sitesCache` existe porque a listagem de propriedades é a mesma
para os 35 projetos, enquanto o `runReport` é por projeto); coleta em lote no estado noturno
(rejeitada: guardaria número de outra janela).

---

## D5 — O quarto estado: `inferido`

**Decisão**: acrescentar `inferido` ao envelope de célula da ficha, ao lado de `apurado`,
`declarado` e `nao-apurado`. Construtor `inferida(valor, { de, rotulo })`, onde `de` é o vestígio
de que o número foi deduzido.

**Motivo**: a FR-011 exige que a tela distinga apurado de inferido. As três alternativas dentro do
que já existe falham:

- **`declarada()`** — declarado é o que um humano escreveu no card, com data. A origem WhatsApp não
  foi escrita por ninguém: foi deduzida de linha de banco. Chamar de declaração mentiria sobre a
  procedência e roubaria o significado de `declaradoEm`.
- **`apurada()` com o aviso no rótulo** — apurado é o estado que a cadeia consome. A SC-009 exige
  que remover a inferência não mude taxa nenhuma; se ela nasce apurada, só um acordo verbal a
  mantém fora das contas.
- **`naoApurada()` com o número dentro do motivo** — número dentro de string é número invisível
  para qualquer conferência, e a SC-007 pede linha própria com volume.

**Custo**: um construtor em `lib/ficha.mjs` e um ramo em `<Cel>`. `combinar()` **não** é alterada:
a célula inferida não entra em soma nenhuma, porque não é canal — é linha própria, fora do total
composto e fora do espaço `n4:` que `validarKrs()` casa por igualdade exata. Com isso a SC-009 vale
por construção, e não por disciplina.

**Alternativas consideradas**: campo booleano `inferido` numa célula apurada (rejeitada: um
`if (!c.inferido)` esquecido em qualquer consumidor futuro põe inferência na cadeia — o estado
separado falha ruidosamente, o booleano falha em silêncio).

---

## D6 — O vestígio do WhatsApp já está sendo lido

**Decisão**: contar as linhas de `orcamentos` na janela com `paciente_lead_id` nulo.

**Motivo**: R4 — o dado já cai onde dá para lê-lo. `lib/okr-coleta.ts` **já** faz
`SELECT ... status, paciente_lead_id FROM orcamentos` e hoje descarta a terceira coluna. Não há
query nova, não há conexão nova, não há mudança no site da Atma. Medido em 02/09: 2 de 7 orçamentos
sem lead vinculado.

**Por que é inferência e não apuração**: `paciente_lead_id` nulo diz "este orçamento não veio de um
lead de formulário". Ele **não** diz "veio do WhatsApp" — pode ser cadastro manual, importação, ou
lead apagado. O rótulo na tela nomeia a origem deduzida, e o texto ao lado nomeia a dívida
(FR-011b): apurar exige instrumentar a origem do contato no site do projeto, em outro repositório,
valendo só a partir da data em que for ligado. A dívida fica **na própria linha da ficha** — que é
onde alguém pergunta por que o número não é apurado — e não só neste documento.

---

## D7 — O total composto, e por que ele não pode usar `combinar()` cru

**Decisão**: o total composto soma **as células de canal que têm fonte**, e o rótulo declara a
cobertura: `total composto (orgânico + 4 canais)`. A célula `diferença` continua `não apurado`
enquanto houver canal sem fonte (FR-012).

**Motivo**: `combinar()` propaga o estado mais fraco — um `nao-apurado` entre os insumos devolve
`nao-apurado`. Como `outbound` nunca terá fonte (D3), passar os seis canais a `combinar()`
produziria um total composto **permanentemente** não apurado, e a FR-005b não teria o que rotular.
Somar só o que tem fonte, com a cobertura escrita no rótulo, é o que a AS-3 da US2 descreve: o
total não é apresentado como fechado, a parcela ausente aparece como `não apurado`, e a diferença
para a entrada da cadeia continua `não apurado`.

Nenhuma célula não apurada é tratada como zero em ponto nenhum: elas ficam **fora da soma** e
continuam impressas na sua própria linha.

**Alternativas consideradas**: `combinar()` com os seis (rejeitada acima); tratar canal sem fonte
como 0 dentro da soma (rejeitada: é literalmente o defeito que a R1 proíbe).

---

## D8 — A guarda de janela (FR-006)

**Decisão**: o coletor devolve, junto das linhas, a janela que **de fato** pediu ao GA4;
`montarN4()` compara com a janela da cadeia e, se divergirem, devolve os canais do GA4 como
`não apurado` nomeando a divergência.

**Motivo**: hoje as duas leituras saem das mesmas constantes `INICIO`/`FIM` de `lib/okr-coleta.ts`,
então a divergência é impossível — e é justamente por isso que a guarda é barata: um `if`. Ela
existe para o dia em que alguém acrescentar cache, um parâmetro de janela na URL ou uma coleta
noturna. Sem ela, esse dia produz uma soma de dois intervalos diferentes que não corresponde a
janela nenhuma, e nada na tela acusa.

**Alternativas consideradas**: confiar nas constantes (rejeitada: a FR-006 diz "DEVE recusar", e um
requisito que nenhum código pode reprovar não é requisito); ler a janela de volta da resposta do
GA4 (rejeitada: a API não a devolve de forma confiável para essa checagem).

---

## D9 — Configuração por projeto dentro do contrato único

**Decisão**: campo `ga4?: { propertyId: string }` na curadoria (`data/projects.json`) e no tipo
`Project` de `lib/projects.ts`. A ficha lê pelo projeto que `listProjects()` já lhe entregou.

**Motivo**: Princípio I — "qualquer nova fonte de dados de projeto DEVE ser incorporada dentro
desse contrato, não ao lado dele". Um mapa `PROPRIEDADES_GA4` paralelo em `lib/ga4.ts` seria a
segunda lista de projetos que o princípio existe para impedir (o `FONTES_PROPRIAS` de
`okr-coleta.ts` é a exceção herdada, e ele carrega SQL, não identidade de projeto).

**Ausente ≠ zero (FR-010)**: sem o campo, `lib/ga4.ts` devolve `null` sem tocar a rede, e os cinco
canais saem `não apurado` com o motivo `sem propriedade GA4 configurada para este projeto` — texto
diferente do de falha e diferente do de zero apurado. Três situações, três textos.

**`propertyId` não é segredo** (é o número visível no admin do GA4) e por isso mora no JSON
versionado. O segredo continua sendo só `GOOGLE_SERVICE_ACCOUNT_JSON`, validado pelo **nome**
(FR-013, Princípio V): nenhuma mensagem de erro carrega valor, prefixo ou comprimento.
