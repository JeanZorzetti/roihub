# Feature Specification: A ficha responde em 30 segundos

**Feature Branch**: `019-ficha-em-30-segundos`

**Created**: 2026-09-05

**Status**: Draft

**Input**: `handoff/handoff-a-ficha-chamava-de-buraco-o-que-ja-estava-medido.md` (05/09/2026) — segunda
das três specs abertas ali (018 correção ✅ · **019 estrutura** · 020 régua). A 018 fechou o
pré-requisito desta: **nenhum número exibido está errado** (auditada contra o banco e contra a tela no
ar, build `58e153f`). Só depois disso a estrutura pode mudar — correção junto de redesenho impede
saber se a página melhorou porque os números ficaram certos ou porque o layout mudou, que é
exatamente a confusão que produziu quatro rodadas inúteis de design-review.

## Contexto

**A 018 provou que a ficha da atma está certa. Esta spec ataca o motivo de ela continuar sem servir.**

O leitor é um só — o dono —, lê **1×/semana em 60 segundos**, e a hierarquia de perguntas dele é
**buracos → placar → tarefa**. A tela de hoje entrega essa hierarquia embaralhada sob **5.267px de
altura em 360px** (medido em 03/09), com sete seções de derivação de método (N0–N6) entre o veredito
e a única frase que diz o que fazer.

### O que a 018 já entregou e não pode regredir

`/okr/atma`, confirmado no ar em 05/09 às 17:07:

```
cadeia: 52 → 21 → 4 → 0            lead → respondeu → orçamento → tratamento
CR(lead→respondeu)       40,38% (21/52), piso — 2 indeterminados, teto 23
CR(respondeu→orçamento)  19,05% (4/21)
CR(orçamento→tratamento)  0,00% (0/4)
Valor do tratamento      R$ 4.932,34 (média de 7 orçamentos de 4 pessoas, líquido de desconto)
98% contatados (declarado pelo operador, 05/09/2026)
Janela desta cadeia: 2026-07-31 → 2026-09-05 — sociedade desfeita; o banco … foi perdido
```

Isto é uma **foto**, não um contrato: consultado de novo em 06/09, o banco já dá `respondeu 22` e 9
orçamentos. A 018 continua correta — o que mudou foi o dado, não a regra.

### Os três defeitos de renderização da auditoria da 018 **já estão corrigidos**

O handoff §12 os manda para esta spec, mas o commit `64bb0a7` (05/09, 17:18) fechou os três antes
dela nascer: `R$ 4.932,337` com três casas (`toLocaleString` sem `style: "currency"`), o glossário
ainda ensinando a R7 revogada, e a nota do N4 afirmando que `visitante` "serve de denominador a toda
taxa do N3" com o nome do marco escrito à mão. **Nenhum dos três é escopo aqui** — se voltarem, é
regressão, não entrega (FR-035).

### O que sobrou, e é o que esta spec faz

**1. A ordem da primeira dobra não é a ordem das perguntas.** Hoje, na atma: veredito → mercado →
projeção → árvore de metas → motivos da perda → o que fazer. (O bloco "Descoberta" existe no código
mas **não renderiza aqui** — ele depende de `marcos[0]` ser `visitante`, e a 018 tirou `visitante`
de `PERFIS.D`; ele só aparece nos perfis A/B.) O motivo dominante da perda — `sem_resposta`, **29
dos 52 leads**, o maior isolado por larga margem — está **quatro blocos distante** da frase que diz
o que fazer. Os dois só produzem decisão quando estão colados.

**2. Não existe lista de buracos.** O handoff pede que ela "encolha para duas células, não trinta" —
mas `app/okr/[slug]/page.tsx:537` mostra **um** (`proximoBuraco`, o primeiro `marco` não apurado) e
nunca diz quantos são. A prioridade nº 1 do leitor não tem bloco na tela. `ehBuracoDeVerdade()`
(`lib/ficha.mjs:61`) e o rótulo `tela-nao-le` (018/FR-028) já existem e ninguém os usa para montar
uma lista.

**3. Método e aquisição ocupam a tela de decisão.** N0–N6 são a derivação; Descoberta (GSC) e
Comportamento (GA4) têm **relógio de trimestre**, não de segunda-feira. Os três estão na mesma
página de quem decide o que fazer nesta semana.

**4. O caminho feliz está calado.** A meta de R$ 50.000 ÷ R$ 4.932,34 = **10,1 tratamentos**, e esse
número **nunca chega à tela**: a cadeia da atma fecha ponta a ponta em `tratamento = 0`, `ancoraDe()`
escolhe esse último marco como âncora, e a **guarda 8** de `projetar()` (`lib/projecao.mjs:117`)
devolve `nao-apurado` para o bloco inteiro — inclusive para `n1Total`, que é
`meta.valor / meta.ticket` e **não usa a âncora para nada**. Mesma família de
`validacao_so_fala_de_problema_cala_o_caminho_feliz`: a divisão **para trás** pela cadeia é a que a
âncora zerada impede; a divisão da meta pelo ticket é bem definida e está sendo suprimida junto.

**5. O pipeline não aparece.** Nada na tela soma os orçamentos enviados, embora `preco` e `status`
já venham no SELECT desde a 018 (`lib/okr-coleta.ts:63`). Medido direto no banco em 06/09/2026:
**9 orçamentos, R$ 44.945,43**, de **5 pessoas** mais **um órfão sem `paciente_lead_id`**
(R$ 4.490,00) — perto de **90% da meta anual** parada em zero fechado.

> ⚠️ **Estes números não são os do handoff, e a diferença é o ponto.** O handoff registra 7
> orçamentos / R$ 37.465,43 / "2 vivos: ids 44 e 51", medidos horas antes; dois orçamentos novos
> entraram em 05/09, alguém palitou o lead que estava sem `motivo` (`respondeu` passou de 21 para
> **22**), e o id 44 hoje carrega `sem_interesse` — **está perdido**, não vivo. Nenhum número desta
> spec PODE ser cravado em código ou em teste: a janela de CONVERSAO cresce todo dia, e a constante
> de ontem já está errada hoje.

Dois fatos que só a consulta mostrou e que mudam a modelagem do bloco:

- **`orcamentos.status` não distingue nada**: 9 de 9 estão em `enviado` — a mesma limitação que a
  017 já tinha achado. "Fechado" **não** sai daí; sai do degrau `tratamento`, que é 0.
- **Existe orçamento sem dono.** `orcamentosSemLead` já é coletado (`lib/okr-coleta.ts:232`) e
  descartado. Sem lead, ele não tem `motivo` e não pode ser classificado vivo nem perdido.

**6. A época é a única costura possível da 016 e não está costurada.** Nos 37 dias de época as três
fontes têm dado (38.573 impressões → 599 cliques → 1.140 sessões → 63 `form_start` → 52 leads), e só
ali a árvore de metas pode descer de impressão até venda. A guarda de hoje
(`lib/arvore-metas.mjs:176`, `marcos[0]?.chave === "visitante"`) impede a taxa entre cadeias — está
certa e protege — mas fecha também o único recorte em que a descida inteira é honesta.

### A contradição que a primeira dobra tem que carregar inteira

**A demanda que chega é de preço** — sete das oito principais queries orgânicas. **A perda acontece
por silêncio** — `sem_resposta` 29 contra `preco_alto` **1**. Os dois fatos só produzem a decisão
certa (o gargalo é o follow-up, não a oferta) quando estão na mesma dobra.

## Clarifications

### Session 2026-09-05

- Q: O que acontece com "Onde trava" (veredito + régua) e "Árvore de metas" (016), que a FR-001 não menciona? → A: O veredito funde no bloco da cadeia como legenda dele (régua de mercado como uma linha abaixo); a árvore de metas desce para `/okr/[slug]/metodo` junto com N0–N6.
- Q: O bloco "Descoberta" de 28 dias sai da ficha agora que existe `/aquisicao` com 8 meses? → A: Fica como hoje (só nos perfis cujo `marcos[0]` é `visitante`, nunca na atma), rotulado com a janela curta e com link para a longa.
- Q: A publicação de `n1Total` com âncora zerada mora em `projetar()` ou só na tela da atma? → A: Em `projetar()` — vale para as 17 fichas e para o bloco de projeção de `/okr`.
- Q: Quais motivos contam como perda, para o "vivos" do valor em risco? → A: Perda = `sem_resposta`, `sem_interesse`, `perdido_concorrencia`, `preco_alto`; vivo = `contato_futuro`, `enviou_documentacao` e lead sem motivo. Lista declarada no card.
- Q: As subpáginas de janela longa herdam o `force-dynamic` da ficha? → A: Não — ISR de 1 hora, com a janela real carimbada na tela.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A primeira dobra responde as três perguntas (Priority: P1)

Jean abre `/okr/atma` e, **sem rolar**, diz em voz alta: qual degrau é o pior, por que ele é o pior, e
o que fazer sobre isso.

**Por que P1**: é o critério de aceitação da spec inteira (handoff §7). Todo o resto existe para
liberar espaço e insumo para esta dobra.

**Teste de aceitação**

1. **Dado** `/okr/atma` a 1280×800, **quando** a página carrega, **então** a cadeia fechada (os
   quatro degraus da janela do dia, com a janela e a época ao lado), o motivo dominante da perda
   **com a ação colada nele** e a lista de buracos reais estão todos acima da dobra, nessa ordem.
2. **Dado** o mesmo a 360×640, **quando** a página carrega, **então** as três respostas estão nas
   duas primeiras rolagens — e a ordem entre elas é a mesma do desktop.
3. **Dado** o pior degrau apontado no bloco da cadeia, **quando** se compara com `veredito.celula`
   (`posicaoDeAtaque()`), **então** são o mesmo — não existe segunda régua de "pior" na tela.
4. **Dado** que `motivos.motivos[0]` é `sem_resposta` (29 de 52 em 06/09/2026, e o maior isolado
   em qualquer releitura), **quando** a dobra o exibe, **então** a ação recomendada aparece no
   **mesmo bloco**, não a quatro blocos de distância.
5. **Dado** um projeto sem `motivo` na fonte própria (`aftercare`), **quando** a dobra monta,
   **então** o bloco do motivo é **omitido**, não preenchido com placeholder — e a ordem dos demais
   não muda.

---

### User Story 2 - Os buracos reais viram uma lista, e ela é curta (Priority: P1)

O leitor vê **quantos** buracos existem e **quais**, em vez de um único "próximo dado a apurar" sem
denominador.

**Por que P1**: buracos são a primeira pergunta da hierarquia declarada. Hoje a tela responde com uma
célula e não diz se há mais uma ou trinta.

**Teste de aceitação**

1. **Dado** `ficha.marcos`, **quando** a dobra monta a lista, **então** ela contém exatamente as
   células que `ehBuracoDeVerdade()` aprova — `tela-nao-le` fora (018/FR-029), `falhou-agora`
   separado do permanente.
2. **Dado** a atma em 05/09/2026, **quando** a lista sai, **então** ela tem **duas ou menos** linhas,
   e cada uma nomeia a fonte a consultar.
3. **Dado** que a lista está vazia, **quando** a dobra monta, **então** ela diz "nenhum buraco de
   medição na cadeia" — nunca some em silêncio, porque sumir é indistinguível de não ter sido
   calculada.
4. **Dado** um buraco com rótulo `falhou-agora`, **quando** a lista o exibe, **então** ele aparece
   marcado como transitório e **não** compete com o buraco permanente pela atenção (regressão da
   rodada 3 do design-review).

---

### User Story 3 - O placar diz o que falta e o que está em risco (Priority: P1)

A dobra mostra **10,1 tratamentos até 31/12/2026** e **R$ 37.465,43 enviados · R$ 0 fechados · 2 ainda
vivos** — e diz, na mesma tela, que a meta não se divide para trás por uma cadeia que termina em zero.

**Por que P1**: é o "placar" da hierarquia, e hoje ele está integralmente calado — a projeção some
inteira por uma guarda que só deveria calar metade dela, e o pipeline nunca foi somado.

**Teste de aceitação**

1. **Dado** meta R$ 50.000 e ticket apurado R$ 4.932,34, **quando** `projetar()` roda com a cadeia
   fechando em `tratamento = 0`, **então** `n1Total` sai **apurado em 10,1** — a divisão não usa a
   âncora.
2. **Dado** o mesmo cenário, **quando** `projetar()` calcula `fatorObrigatorio` e
   `multiploNecessario`, **então** os dois continuam `não apurado` nomeando a âncora zerada — a
   divisão **para trás** pela cadeia é a que a âncora impede, e ela continua impedida.
3. **Dado** o mesmo cenário, **quando** a tela renderiza, **então** os dois lados aparecem juntos: o
   que a meta exige **e** por que a cadeia não a distribui.
4. **Dado** os orçamentos da janela com `preco` e o `motivo` do lead de cada um, **quando** a dobra
   monta o valor em risco, **então** exibe `<soma> enviados · <fechados> · <n> ainda vivos`, todos
   **derivados de query**. Em 06/09/2026 isso dá `R$ 44.945,43 enviados · R$ 0 fechados · 2 ainda
   vivos (R$ 11.970,00)` mais um órfão de R$ 4.490,00 — e nenhum desses valores PODE virar constante
   no código ou no teste.
5. **Dado** o valor em risco, **quando** ele aparece, **então** **não** é somado à meta nem
   apresentado como progresso — R$ 37.465 é 75% de R$ 50.000, e escrever isso como avanço é a
   projeção pra frente que a R6 proíbe.
6. **Dado** um projeto sem orçamento na janela, **quando** a dobra monta, **então** o bloco de valor
   em risco é omitido — nunca `R$ 0,00 enviados`, que lê como fato apurado sobre um projeto que não
   tem a fonte.

---

### User Story 4 - N0–N6 saem para `/okr/[slug]/metodo` (Priority: P2)

A derivação de método continua inteira, uma tela adiante.

**Por que P2**: é o que devolve altura para a US1, mas a US1 é testável antes — reordenar a dobra não
depende de mover as sete seções.

**Teste de aceitação**

1. **Dado** `/okr/atma/metodo`, **quando** a rota carrega, **então** traz os sete níveis **e a árvore
   de metas**, com o mesmo conteúdo de hoje.
2. **Dado** a suíte de testes de N0–N6, **quando** ela roda depois desta spec, **então** passa **sem
   uma linha editada** — `montarNiveis()` não muda de saída. Teste de N0–N6 que precisou ser
   reescrito é sinal de que a mudança saiu do escopo.
3. **Dado** `/okr/atma`, **quando** se procura o índice de âncoras `N0…N6`, **então** ele não existe
   mais — no lugar há **um** link para o método.
4. **Dado** a ação que a dobra cita (vinda de `evaluateAll()`, o mesmo de `app/agenda/page.tsx`),
   **quando** ela aparece nas duas telas, **então** vem da mesma chamada — nunca duas fontes para a
   mesma ação.
5. **Dado** qualquer um dos 17 projetos, **quando** `/okr/<slug>/metodo` é aberta, **então** responde
   — a rota é do template, não da atma.

---

### User Story 5 - Descoberta e Comportamento saem para `/okr/[slug]/aquisicao`, na janela que a fonte tem (Priority: P2)

O que tem relógio de trimestre sai da tela que se lê na segunda-feira, e ganha a janela longa que a
018 adiou.

**Por que P2**: tira peso da dobra e cumpre o item que a 018 transferiu explicitamente (§12, item 3).

**Teste de aceitação**

1. **Dado** `/okr/atma/aquisicao`, **quando** a rota carrega, **então** o GSC vem em **8 meses** e o
   GA4 em **12 meses**, cada número com a janela ao lado.
2. **Dado** os 17 projetos, **quando** `/okr` monta o ranking e a ficha monta a célula `visitante`,
   **então** os números são **idênticos aos de antes desta spec** — `descoberta()` e
   `comportamento()` (28d/D-3) não mudam (herda a SC-007 da 018).
3. **Dado** que o mesmo degrau passa a ter dois números em duas telas, **quando** cada um aparece,
   **então** carrega a própria janela **e cita a outra tela pelo nome** — dois números do mesmo
   degrau sem rótulo é a mesma classe de defeito que duas fontes para o mesmo degrau (018/FR-032).
4. **Dado** que a fonte devolveu menos período do que a janela pediu (retenção do GA4, propriedade
   nova), **quando** a tela exibe, **então** mostra a janela que a fonte **deu**, nomeando o
   truncamento — nunca rotula de 12 meses um dado de 3.
5. **Dado** a `/okr/atma/aquisicao`, **quando** se procura uma taxa entre `cliques` (GSC) e `sessões`
   (GA4), **então** ela não existe: são cadeias diferentes, e na época são 599 contra 1.140 porque o
   GSC vê só orgânico.
6. **Dado** que a cadência de leitura dela é trimestral, **quando** a página abre, **então** ela diz
   isso — o leitor precisa saber que não é uma tela de segunda-feira.

---

### User Story 6 - A época costura a árvore de metas (Priority: P3)

Nos 37 dias em que as três fontes têm dado, a árvore da 016 — agora em `/okr/[slug]/metodo` — desce
de impressão até venda.

**Por que P3**: é a única entrega que não afeta o teste dos 30 segundos, e a que mais depende das
outras estarem no lugar. Se cair, a spec ainda fecha.

**Teste de aceitação**

1. **Dado** um projeto com `epoca` e as três fontes com dado nela, **quando** a árvore desce,
   **então** a camada de impressões entra usando **a janela da época**, não a de 28 dias nem a de 8
   meses.
2. **Dado** um projeto **sem** `epoca`, **quando** a árvore desce, **então** o comportamento é o de
   hoje, sem camada de impressões.
3. **Dado** que a fonte de impressões não cobre a época inteira, **quando** a árvore tenta a camada,
   **então** ela **para e nomeia** o que faltou — nunca compõe períodos diferentes.
4. **Dado** a árvore com a costura ligada, **quando** se conta as faixas de mercado na descida,
   **então** continua no máximo **uma** (trava da 016), e nenhuma delas vira meta de KR (R6).

### Edge Cases

- **A dobra fica vazia num projeto sem fonte própria.** `aftercare` não tem `motivo`, não tem
  orçamento e a cadeia dele é quase toda não apurada. A dobra DEVE degradar para: cadeia (com os
  degraus não apurados visíveis) + lista de buracos. Sem motivo, sem placar — e a lista de buracos,
  que nesse projeto é longa, é justamente a resposta certa para ele.
- **`veredito.celula` e o primeiro buraco divergem.** Já tratado hoje na frase "isso fecha um buraco
  de medição, mas não destrava X". Essa frase tem que sobreviver à reordenação — é ela que impede a
  dobra parecer dois planos de ataque.
- **O pipeline vivo muda sozinho.** "2 vivos" é resultado de query sobre `motivo`; um follow-up
  respondido amanhã muda para 3 sem ninguém tocar em código. Cravar 2 seria a mesma família de
  `constante_acoplada_ao_tamanho_da_lista`.
- **O que é "vivo" é taxonomia do cliente.** `contato_futuro` conta como vivo? `enviou_documentacao`?
  A lista de motivos de perda mora no card, não em `lib/` — mesma regra da palitagem da 017.
- **A janela de CONVERSAO cresce todo dia.** A dobra é lida semanalmente; os números de aceitação
  desta spec são de 05/09/2026 e serão outros na implementação. O que se testa é a **regra**, com o
  banco como oráculo — nunca a constante.
- **Rolar não é falha, mas a ordem é.** Se numa tela pequena as três respostas não couberem na
  primeira dobra, elas ainda têm que aparecer **nessa ordem**. Altura não é meta; sequência é.
- **GA4 de 12 meses pode não existir.** Retenção de propriedade é finita e configurável. A tela
  mostra o que a fonte deu (FR-027).
- **Orçamento sem lead.** Existe um hoje (R$ 4.490,00, `paciente_lead_id` nulo). Entra em
  `enviados`, fica fora de vivos e perdidos, e é nomeado (FR-015a).
- **`orcamentos.status` é constante.** 9 de 9 em `enviado`. Qualquer leitura que dependa dela para
  separar fechado de aberto nasce morta (FR-013a).
- **O `status` do lead contradiz o `motivo`.** O id 44 está em `exames_enviados` com motivo
  `sem_interesse`. Esta spec, como a 018, **não modela contradição**: manda no `motivo`, que é o
  campo que o operador de fato preenche, e o `status` não entra na classificação de vivo/perdido.

## Requirements *(mandatory)*

### Primeira dobra

- **FR-001**: `/okr/[slug]` DEVE abrir com três blocos, nesta ordem e sem nada entre eles e o `<h1>`:
  **(1) a cadeia fechada**, **(2) o motivo dominante da perda com a ação colada nele**, **(3) a lista
  de buracos reais**. A ordem é escolha explícita do leitor (buracos → placar → tarefa aplicados à
  tela de decisão), não preferência de layout.
- **FR-002**: O bloco da cadeia DEVE trazer os degraus, as taxas, a janela de CONVERSAO com a época
  declarada, e marcar o pior degrau. O "pior" DEVE ser o mesmo que `posicaoDeAtaque()` escolhe —
  nenhuma segunda régua PODE nascer nesta tela.
- **FR-002a**: O bloco "Onde trava" **deixa de existir como bloco**: o texto do veredito
  (`veredito.rotulo`/`veredito.motivo`) vira a **legenda do bloco da cadeia**. Duas frases de "pior
  degrau" na mesma dobra são a segunda régua que a FR-002 proíbe — hoje elas convivem porque estão
  em blocos diferentes, e o leitor tem que descobrir sozinho que falam do mesmo degrau.
- **FR-003**: O bloco do motivo e o bloco da ação DEVEM ser **um só**. Hoje "Por que não avançou" e
  "O que fazer" estão separados por quatro blocos; separados, nenhum dos dois decide nada.
- **FR-004**: A lista de buracos reais é **nova**. Hoje a tela mostra uma célula (`proximoBuraco`) e
  não diz quantas existem. Ela DEVE ser montada com `ehBuracoDeVerdade()` — `tela-nao-le` fora
  (018/FR-029), `falhou-agora` marcado como transitório.
- **FR-005**: Lista vazia DEVE dizer que está vazia. Sumir em silêncio é indistinguível de não ter
  sido calculada — é o defeito que a 018 acabou de matar do outro lado.
- **FR-006**: A régua de mercado continua **subordinada ao veredito**: uma linha **dentro do bloco
  da cadeia**, abaixo da legenda, diagnóstico ("2,9× o piso"), nunca alvo (R6). Ela não vira bloco
  próprio e não disputa espaço com os três da FR-001.
- **FR-007**: O índice de âncoras `N0…N6` sai da ficha (não há mais N0–N6 nela) e é substituído por
  **um** link para `/okr/[slug]/metodo`.

### Placar — projeção e valor em risco

- **FR-008**: `projetar()` DEVE publicar `n1Total` (`meta.valor / meta.ticket`) mesmo com a âncora
  zerada. A divisão não toca a âncora; suprimi-la junto é validação falando só do problema.
- **FR-008a**: O conserto mora **dentro de `projetar()`**, não na tela da atma. A guarda 8 é a mesma
  para os 17 projetos, e `app/okr/page.tsx:131` renderiza `<Projecao>` para cada um — consertar só
  na ficha deixaria o portfólio calado pelo mesmo motivo. **Consequência declarada**: o bloco de
  projeção de `/okr` muda de texto para todo projeto de cadeia zerada. Isso está coberto pela
  exceção da FR-036 e **não** afeta o ranking: `posicaoDeAtaque()` lê só `ficha`, nunca `projecao`
  (verificado em `lib/okr.mjs:435-470`).
- **FR-009**: `n1Janela` (`n1Total × janelaDias / diasRestantes`) DEVE seguir a mesma regra — depende
  de meta, ticket e calendário, não da cadeia.
- **FR-010**: `fatorObrigatorio` e `multiploNecessario` DEVEM continuar `não apurado` com âncora
  zerada, nomeando o motivo. É a divisão **para trás** pela cadeia, e é ela que a R6/spec 010 proíbe
  quando não há volume por onde dividir.
- **FR-011**: Esta spec **revoga a FR-034 da 018** ("`lib/projecao.mjs` NÃO DEVE ganhar regra nova"),
  de propósito e por escrito. A 018 a impôs para não misturar correção com estrutura; o handoff já
  registrava que reformular a projeção era 019.
- **FR-012**: A tela DEVE exibir **os dois lados juntos**: quanto a meta exige (10,1 tratamentos até
  31/12/2026) e por que a cadeia não a distribui (fecha em zero).
- **FR-013**: Bloco novo de **valor em risco**: `enviados · fechados · vivos`. Os dois primeiros em
  dinheiro, o terceiro em pessoas (com o valor delas ao lado).
- **FR-013a**: "Fechado" **NÃO PODE** sair de `orcamentos.status` — 9 de 9 linhas estão em `enviado`,
  e a coluna nunca conheceu outro valor em cinco semanas de produção (mesmo achado da 017 que matou
  o marco `orçamento ACEITO`). "Fechado" vem do degrau `tratamento`. Derivar de `status` produziria
  um zero com cara de apurado sobre uma coluna que não mede.
- **FR-014**: O valor em risco NUNCA é somado à meta nem apresentado como progresso.
- **FR-015**: "Vivo" = orçamento cujo lead não carrega motivo de perda. A **lista de motivos de perda
  DEVE ser declarada no card**, nunca em `lib/` — a taxonomia é do cliente (mesma regra da palitagem
  da 017). Para a `atma`, a lista é `sem_resposta`, `sem_interesse`, `perdido_concorrencia`,
  `preco_alto`; ficam vivos `contato_futuro`, `enviou_documentacao` e o lead sem motivo.
- **FR-015a**: Orçamento **sem `paciente_lead_id`** entra em `enviados` e fica **fora** de vivos e de
  perdidos, nomeado à parte ("1 orçamento sem lead vinculado — R$ X"). Sem lead não há `motivo`, e
  classificá-lo para qualquer lado seria inventar o dado. `orcamentosSemLead` já é coletado
  (`lib/okr-coleta.ts:232`) e hoje descartado.
- **FR-015b**: Projeto cuja lista de motivos de perda não esteja declarada no card exibe `enviados` e
  **omite** vivos/perdidos, nomeando o que falta declarar — nunca assume uma taxonomia por default.
- **FR-016**: Todo número do valor em risco é derivado de query. Nenhuma constante de contagem PODE
  entrar no código.
- **FR-017**: Sem orçamento na janela, o bloco é **omitido**. `R$ 0,00 enviados` lê como fato apurado
  sobre um projeto que não tem a fonte.

### `/okr/[slug]/metodo`

- **FR-018**: Rota nova, do **template** (vale para os 17 projetos), com os sete níveis N0–N6 **e a
  árvore de metas da 016**. A árvore é derivação — mostra como a meta se distribui pelos degraus —,
  não decisão de segunda-feira, e sai da ficha junto com o resto do método.
- **FR-019**: `montarNiveis()` NÃO PODE mudar de saída. A suíte de N0–N6 tem que passar sem edição —
  teste reescrito aqui é sinal de escopo estourado, não de progresso.
- **FR-020**: Link nos dois sentidos entre ficha e método.
- **FR-021**: A ação citada na dobra e a citada em N6 vêm da **mesma** chamada de `evaluateAll()`.
  Duas fontes para a mesma ação é o defeito que a 018 matou nos degraus.

### `/okr/[slug]/aquisicao`

- **FR-022**: Rota nova, do template, com Descoberta (GSC) e Comportamento (GA4).
- **FR-023**: Janelas longas — **8 meses** para Descoberta, **12 meses** para Comportamento — DEVEM
  ser declaradas em `lib/janelas.mjs`, ao lado das curtas. A FR-001 da 018 continua valendo: **uma só
  definição de janela no repo**, e o módulo continua puro.
- **FR-024**: `descoberta()` e `comportamento()` (28d/D-3) NÃO mudam. A célula `visitante` da ficha e
  o ranking de `/okr` saem idênticos aos de antes desta spec.
- **FR-024a**: O bloco "Descoberta" da ficha **fica onde está** — renderizado só quando `marcos[0]`
  é `visitante` (perfis A/B; nunca a atma, que a 018 fez começar em `lead`). Ele passa a declarar a
  janela curta e a linkar a longa. Tirá-lo dos perfis A/B deixaria a cadeia deles começando em
  `signup` sem volume nenhum acima; e na atma não há o que mover.
- **FR-025**: `gscSeries()` busca 84 dias fixos e `totals28()` fatia 28. A leitura de 8 meses NÃO
  PODE mudar o default de `gscSeries()` — o mesmo default alimenta o portfólio inteiro.
- **FR-026**: O mesmo degrau com dois números em duas telas EXIGE rótulo em cada, **e cada tela cita
  a outra pelo nome**. Sem isso, é a mesma classe de defeito de duas fontes para o mesmo degrau.
- **FR-027**: Quando a fonte devolver menos período do que a janela pediu, a tela exibe **a janela que
  a fonte deu**, nomeando o truncamento. Nunca rotula de 12 meses um dado de 3.
- **FR-028**: A página DEVE declarar que a cadência de leitura dela é **trimestral**, não semanal.
- **FR-028a**: As duas subpáginas NÃO herdam o `force-dynamic` da ficha: usam **ISR de 1 hora**, com
  a janela real carimbada na tela. Buscar 8 meses de GSC e 12 de GA4 a cada request para uma página
  de relógio trimestral é custo sem leitor. O motivo do `force-dynamic` da ficha (número vindo do
  build é número de outra janela) continua valendo lá, onde a janela fecha em `hoje`; aqui a janela
  fecha em D-3 e uma hora de defasagem não muda dígito nenhum.
- **FR-029**: Nenhuma taxa entre `cliques` (GSC) e `sessões` (GA4). São cadeias diferentes: na época
  são 599 contra 1.140, porque o GSC vê só busca orgânica.

### A época como costura da 016

- **FR-030**: Para projeto com `epoca`, a árvore de metas PODE descer de impressão até venda usando
  **a janela da época** para a camada de impressões — o único recorte em que as três fontes têm dado.
- **FR-031**: A guarda de hoje (`marcos[0]?.chave === "visitante"`) DEVE ser substituída por uma que
  exija a **coincidência de janela**, não o nome do primeiro marco. Nome de marco não prova que as
  janelas batem; foi a trava certa na 018 porque era a única disponível.
- **FR-032**: Projeto **sem** `epoca` mantém o comportamento de hoje, sem camada de impressões.
- **FR-033**: Fonte que não cobre a época inteira faz a árvore **parar e nomear**. Nunca compor
  períodos diferentes (018/FR-007 continua íntegra).

### Travas

- **FR-034**: `status_historico` **fica fora desta spec**. Velocidade (8,3h médios, 34,9h no pior
  caso), passagem cumulativa e coorte são uma spec futura de profundidade de funil (handoff §14). O
  §6 do handoff diz o contrário; o §14 é posterior e mais específico, e a 019 é a spec cujo critério
  é a página dizer **menos**.
- **FR-035**: Os três defeitos de renderização da auditoria da 018 (dinheiro com 3 casas, glossário
  ensinando a R7, nota do N4 sobre `visitante`) foram corrigidos em `64bb0a7` e **não são escopo**.
  Se reaparecerem, é regressão.
- **FR-036**: Nenhum número exibido PODE mudar por causa desta spec. A 018 os deixou certos; esta
  mexe em **onde** eles aparecem. Exceção única e declarada: `n1Total`/`n1Janela`, que passam de
  suprimidos a exibidos (FR-008/FR-009).
- **FR-037**: As seis réguas pesquisadas com fonte e o `DELETE` de `market_benchmarks` são a **020**,
  que não bloqueia esta.
- **FR-038**: **Altura não é meta.** Se couber em 1.500px e não passar no teste dos 30 segundos, não
  adiantou. A sequência dos blocos é requisito; a altura é consequência.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-000** *(primeira tarefa, antes de qualquer edição)*: a altura da `/okr/atma` está medida em
  360×640 e 1280×800, e registrada. Medir depois do conserto mede o conserto — a primeira corrida tem
  que ser a linha de base (mesma disciplina da SC-000 da 018).
- **SC-001** *(o critério da spec)*: abrindo `/okr/atma` a 1280×800 **sem rolar**, é possível dizer
  qual degrau é o pior, por que ele é o pior, e o que fazer sobre isso. Verificável por captura de
  tela da dobra, com as três respostas apontadas nela.
- **SC-002**: a lista de buracos reais da atma tem **duas ou menos** linhas, e nenhuma carrega
  `tela-nao-le`.
- **SC-003**: `/okr/atma` exibe **10,1 tratamentos até 31/12/2026** e, na mesma tela, o motivo de a
  meta não se dividir para trás. Hoje exibe só o segundo.
- **SC-004**: `/okr/atma` exibe `enviados · fechados · vivos` batendo com a query direta em
  `ATMA_DATABASE_URL` **no momento da verificação** (em 06/09/2026: R$ 44.945,43 · R$ 0 · 2 vivos,
  mais 1 órfão de R$ 4.490,00), com o órfão nomeado à parte, e em nenhum lugar da tela esse valor é
  somado à meta. **Teste que compare contra constante reprova** — reprovaria hoje mesmo, com os
  números do handoff de ontem.
- **SC-005**: `/okr/<slug>/metodo` responde para os 17 projetos e traz N0–N6 **mais a árvore de
  metas**; a suíte de N0–N6 passa **sem uma linha editada**, e nenhuma árvore aparece na ficha.
- **SC-006**: `/okr/<slug>/aquisicao` responde para os 17 projetos; na atma traz 8 meses de GSC e 12
  de GA4, cada número com a janela real ao lado.
- **SC-007** *(regressão do portfólio)*: os 17 projetos saem com a **mesma** célula `visitante` e o
  **mesmo** ranking em `/okr` de antes desta spec. Herda a SC-007 da 018: mexer na tela da atma não
  muda o placar de mais ninguém.
- **SC-008**: nenhuma taxa exibida em nenhuma das três telas cruza cadeias — teste que falha se
  numerador e denominador vierem de janelas diferentes.
- **SC-009**: a árvore de metas da atma desce de impressão até venda dentro da época; num projeto sem
  `epoca`, ela para exatamente onde para hoje.
- **SC-010**: `npm test` verde, com os testes novos registrados no `package.json` no mesmo commit
  (Princípio II da constituição).

## Assumptions

- **As subpáginas são do template, não da atma.** O handoff escreve `/okr/atma/metodo` e
  `/okr/atma/aquisicao` porque a atma é o caso concreto; a rota real é `/okr/[slug]/…` e vale para os
  17 projetos. Criar rota exclusiva de um projeto seria a primeira vez que o hub faz isso.
- **A dobra de referência é 1280×800**, com 360×640 como segunda verificação. O handoff não nomeia
  viewport; 1280×800 é onde o dono lê e onde "sem rolar" tem significado testável.
- **A janela longa vive só nas subpáginas.** Alargar Descoberta e Comportamento na ficha trocaria a
  célula `visitante` dos 17 projetos e o ranking do portfólio — decisão de amplitude que a 018 já
  recusou por não ter tela para os números longos. Agora ela tem, e é lá que eles moram.
- **Os números de aceitação são de 05/09/2026.** A janela de CONVERSAO cresce todo dia; a
  implementação re-deriva contra o banco. O que a spec fixa é a regra, não a constante.
- **O ticket, a cadeia e os rótulos vêm prontos da 018.** Esta spec não recalcula nada — só reordena,
  move e publica o que já está certo.
- **A 020 não bloqueia.** Sem as seis réguas, `mercado.destaque` continua saindo como hoje.
