# Feature Specification: A cadeia da `atma` é a que o app da Atma escreve

**Feature Branch**: `017-cadeia-real-atma`

**Created**: 2026-09-04

**Status**: Draft

**Input**: Jean, 04/09/2026 — "você inventou o nome das etapas do funil. O primeiro é novo, o segundo contatado, o terceiro é pré-orçamento, que é quando eu envio o orçamento para a pessoa, o quarto é exames enviados. (…) exames enviados é igual ao orçamento. E aí tem o convertido, que é quando entra dinheiro, e o cancelado. Um detalhe é que todo cancelado foi contatado, todos eles." E: "Retire essa proibição" (sobre a D7 da 016, que barrava a curva CTR × posição).

## Contexto

A `/okr/atma` mede uma cadeia que **não existe**.

O perfil D em `lib/okr.mjs` declara `visitante → lead → contatado → orçamento ENVIADO → orçamento
ACEITO → tratamento INICIADO`. A Atma nunca teve um degrau de "aceite". A cadeia real está escrita
há meses, em **fonte única**, no repo do próprio produto:

```
Atma/Site/admin/src/lib/funil.ts  →  ETAPAS
novo → contatado → pre_orcamento → exames_enviados → convertido | cancelado
```

Seis etapas, `saida: true` só em `convertido` e `cancelado`. É a lista que o Kanban, a Lista, a
Agenda e o hub do CRM da Atma consomem. O hub do ROI Labs escreveu uma sétima etapa por conta
própria e depois passou três specs (014, 015, 016) explicando por que ela não fechava.

### A consequência que ninguém viu

`STATUS_ACEITE = new Set()` está vazio em `lib/okr.mjs` com um comentário longo dizendo "preencher
quando a Atma DECLARAR a regra de aceite". Não havia regra a declarar: **o degrau não existe.** O
`não apurado` que a ficha mostra há semanas não é falta de dado, é um degrau fantasma. A 016
chegou a propor uma faixa de mercado (`orcamento→tratamento`, *case acceptance*) para atravessar
esse buraco — teria coberto com benchmark um vão que a realidade não tem.

### O que o banco diz (`atma_db`, 04/09/2026, 43 leads)

| etapa | posição atual | evento gravado |
|---|---|---|
| `novo` | **0** | `default` da coluna `status` |
| `contatado` | 14 | — |
| `pre_orcamento` | 7 | 7 linhas em `orcamentos` (5 com `paciente_lead_id`) |
| `exames_enviados` | **0** | — |
| `convertido` | **0** | — |
| `cancelado` | 22 | — |

`status_historico` tem 50 linhas e **zero transições reais**: todas com `de IS NULL`, semeadas com
a posição de hoje. Não serve como log de evento.

### As duas regras que o Jean declarou, e o que cada uma destrava

1. **"Todo cancelado foi contatado, todos eles."** Com o `default 'novo'`, isso torna `contatado`
   *cumulativo* apurável sem tabela nova: `contatado = status <> 'novo'`. Hoje = **43 de 43**. O
   degrau que a ficha jura não ter coletor sempre esteve na mesma query que já roda.
2. **`exames_enviados` e `convertido` são escritos pelo app; ninguém chegou lá ainda.** Isso
   converte o zero de `convertido` de `não apurado` para **`0` apurado** — a distinção que a
   `celulasDeOrcamento()` inteira existe para preservar. Não é encanamento (D4), é persuasão (D3).

### O gargalo real, que aparece assim que os nomes ficam certos

`pre_orcamento → exames_enviados = 0 de 7`. Sete pessoas pediram preço; nenhuma mandou exames.
Esse degrau está medido, está na mesma tabela que a `/okr` já lê, e nunca apareceu na tela porque
a cadeia inventada não tinha esse degrau. A árvore da 016 vai parar exatamente ali — e parar ali,
nomeando o degrau, é o entregável.

### A D7 da 016, revogada

A 016 recusou a curva CTR × posição argumentando que ela seria "uma segunda faixa de mercado", e a
trava nº 1 da árvore é *no máximo uma faixa na descida*. Jean revogou: **"Retire essa proibição."**
A leitura correta da trava é mais estreita do que a D7 assumiu — o que a R6 proíbe é faixa
**multiplicada** por faixa dentro da descida. A curva CTR × posição não entra na descida: ela é
leitura paralela, do lado de fora, respondendo "e se eu não publicar nada?". Uma faixa lida ao
lado da conta não compõe com a faixa que está dentro dela.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A ficha mostra as etapas que o Jean vê no Kanban (Priority: P1)

Jean abre `/okr/atma` e reconhece cada linha da cadeia, porque são as mesmas seis palavras que
estão no CRM dele. Nenhum degrau da ficha existe fora do `ETAPAS` do produto.

**Por que P1**: enquanto os nomes divergirem, todo número derivado da cadeia mede outra coisa.

**Teste de aceitação**

1. **Dado** o perfil D, **quando** a ficha lista os marcos, **então** os degraus são
   `visitante → novo → contatado → pré-orçamento → exames enviados → convertido`, nessa ordem.
2. **Dado** o marco `aceito`, **quando** se procura por ele, **então** não existe — nem a chave,
   nem `STATUS_ACEITE`, nem a linha `orcamento→aceito` da régua.
3. **Dado** o `funil.ts` do repo da Atma, **quando** se comparam os slugs, **então** cada degrau
   não-`saida` da cadeia do hub tem correspondente exato lá.

### User Story 2 - `contato feito` deixa de ser "não apurado" (Priority: P1)

A ficha para de dizer "sem coletor" para um degrau que a query existente já responde.

**Por que P1**: é o degrau que a 016 atravessava com "ponte". Com ele apurado, a ponte vira medida
direta e a árvore ganha precisão sem custo de coleta.

**Teste de aceitação**

1. **Dado** 43 leads, nenhum em `novo`, **quando** a ficha calcula `contatado`, **então** devolve
   `apurado(43)`, não `não apurado`.
2. **Dado** um lead em `cancelado`, **quando** se conta `contatado`, **então** ele conta — a regra
   é declarada, não inferida do `status_historico` (que não tem transição real).
3. **Dado** um lead em `novo`, **quando** se conta `contatado`, **então** ele **não** conta.
4. **Dado** que 100% é o teto, **quando** a régua de mercado comparar, **então** ela compara e não
   realimenta o veredito (R6 — a 015 já garante isso; este teste protege contra regressão).

### User Story 3 - O zero de `convertido` é um zero medido, não um buraco (Priority: P2)

A ficha distingue "ninguém converteu" de "o app não grava conversão", porque o Jean declarou qual
dos dois é.

**Teste de aceitação**

1. **Dado** `convertido = 0` e a declaração de que o app escreve o status, **quando** a ficha lê o
   degrau, **então** devolve `apurado(0)` com a declaração citada na `fonte`.
2. **Dado** `apurado(0)` como divisor, **quando** a árvore desce, **então** o `0` é recusado como
   divisor (FR-003 da 016 continua valendo) e a árvore para **nomeando o degrau**.
3. **Dado** que a árvore parou, **quando** a tela renderiza, **então** o motivo é
   `pré-orçamento → exames enviados: 0 de 7 apurados`, não "sem coletor".

### User Story 4 - Traduzir CTR necessário em posição (Priority: P3)

A alavanca de posição para de dizer "você precisa de 3,1% de CTR" e passa a dizer "isso é a
posição 5-6".

**Teste de aceitação**

1. **Dado** um CTR necessário, **quando** a alavanca traduz, **então** devolve uma **faixa** de
   posição com fonte por linha, nunca um ponto.
2. **Dado** que a alavanca é leitura paralela, **quando** a árvore monta as camadas, **então**
   nenhuma camada usa `CTR_POR_POSICAO` como divisor — o teste da 016 continua verde.

### Edge Cases

- **2 orçamentos órfãos.** `orcamentos` tem 7 linhas e só 5 com `paciente_lead_id`. Contar
  orçamentos pela tabela (7) e leads pela `patient_leads` (43) mistura duas populações. A cadeia
  DEVE declarar qual das duas ela conta.
- **`pre_orcamento` cumulativo não é apurável.** A regra do Jean cobre só `contatado`. Um lead que
  chegou a `pre_orcamento` e depois cancelou aparece como `cancelado` — a posição atual apaga a
  passagem, e `status_historico` não a guarda. A tabela `orcamentos` é o único log de evento e ela
  vale 7.
- **100% de contato.** Não há lead em `novo`. Pode ser diligência ou pode ser que `novo` seja
  atualizado no mesmo instante da criação. A ficha reporta o que mede; a leitura fica com o Jean.
- **[NEEDS CLARIFICATION] Algum cancelado chegou a mandar exames?** Se sim, `exames_enviados`
  cumulativo é subestimado e o `0` vira `não apurado`. Se não, o `0` é apurado e o gargalo
  `pre_orcamento → exames_enviados` está provado.

## Requirements *(mandatory)*

- **FR-001**: `PERFIS.D.marcos` DEVE espelhar as etapas não-`saida` de `Atma/Site/admin/src/lib/funil.ts`, com `visitante` na frente (o degrau do GSC, que não é etapa de CRM).
- **FR-002**: O marco `aceito` e a constante `STATUS_ACEITE` DEVEM ser removidos, e não renomeados — não existe degrau correspondente no produto.
- **FR-003**: `contatado` DEVE ganhar coletor derivado de `patient_leads.status <> 'novo'`, com a regra declarada citada na `fonte` do marco.
- **FR-004**: A `fonte` de todo degrau cujo valor vem de declaração humana (e não de tabela) DEVE nomear quem declarou e quando.
- **FR-005**: `REGUA.D` DEVE ter suas chaves remapeadas para os spans reais. A linha `orcamento→aceito` DEVE ser removida ou re-chaveada; nenhuma linha PODE referenciar um degrau inexistente.
- **FR-006**: `celulasDeOrcamento()` DEVE declarar qual população conta (linhas de `orcamentos` × leads com orçamento) e a ficha DEVE exibir a contagem de órfãs quando > 0.
- **FR-007**: `CTR_POR_POSICAO` DEVE existir em `lib/benchmark.mjs`, com faixa e fonte por linha.
- **FR-008**: `alavancaDePosicao()` DEVE devolver faixa de posição além do CTR necessário, e DEVE permanecer fora da conta da árvore.
- **FR-009**: A trava de "no máximo uma faixa de mercado por descida" DEVE continuar valendo **dentro** da árvore. O teste "duas faixas DEVEM falhar" da 016 não pode ser afrouxado.
- **FR-010**: `lib/projecao.mjs` NÃO DEVE ser alterado. (`lib/okr.mjs` sai da lista de intocáveis da 016 — é justamente o arquivo com o defeito.)

### Success Criteria

- **SC-001**: Nenhuma ocorrência de `aceito` ou `tratamento` como chave de degrau no repo do hub.
- **SC-002**: `/okr/atma` mostra `contato feito — 43` apurado, com a regra citada.
- **SC-003**: A árvore de metas desce até `exames enviados` e para nomeando `pré-orçamento → exames enviados: 0 de 7`.
- **SC-004**: A alavanca de posição exibe faixa de posição, e o teste que garante que ela nunca vira divisor continua verde.
- **SC-005**: `npm test` verde, com o teste novo registrado no `package.json`.
