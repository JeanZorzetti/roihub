# Feature Specification: Nenhum número da `/okr/atma` está errado

**Feature Branch**: `018-atma-numeros-certos`

**Created**: 2026-09-05

**Status**: Draft

**Input**: `handoff/handoff-a-ficha-chamava-de-buraco-o-que-ja-estava-medido.md` (05/09/2026) — sessão de
grilling depois de quatro rodadas de design-review (`d010ab3`, `800e4e7`, `07e021e`, `cfccffd`) e um
redesenho (`c56f1d3`) que corrigiram mais de dez achados visuais sem a página passar a servir.
Primeira das três specs abertas ali (018 correção · 019 estrutura · 020 régua), **nessa ordem e
separadas de propósito**: correção junto de redesenho impede saber se a página melhorou porque os
números ficaram certos ou porque o layout mudou.

## Contexto

**Quando um redesenho não resolve depois de duas rodadas, o defeito não é de forma.** Aqui era de
leitura: a tela publicava número errado e chamava de "não apurado" dado gravado no banco há semanas.

### O que a janela única faz com a Atma (medido em 05/09/2026)

A `INICIO`/`FIM` de `lib/okr-coleta.ts` é uma janela só para todas as fontes — 28 dias fechando em
D-3, porque o GSC atrasa 3 dias. Aplicada ao banco próprio, ela **joga fora 60% do que existe**:

| | na janela `2026-08-06 → 2026-09-02` | no banco inteiro |
|---|---|---|
| leads | **20** | **51** |
| orçamentos | **5** | **7** |

O atraso do GSC é defeito de UMA fonte e está cobrando de todas: o banco próprio não atrasa, e os 3
dias finais custam leads e orçamentos que já estão gravados. A R7 ("uma janela só, igual para a
árvore inteira") **morre nesta forma** — não porque janela única seja errada, mas porque as três
fontes da Atma têm tamanhos diferentes e truncar ao menor descarta dado real.

| cadeia | fonte | janela que a fonte tem | janela **nesta spec** |
|---|---|---|---|
| Descoberta | GSC | 8 meses (jan/2026 → hoje-3; set–dez/2025 = zero real) | continua 28d/D-3 |
| Comportamento | GA4 `properties/504053080` | 12 meses | continua 28d/D-3 |
| Conversão | `ATMA_DATABASE_URL` | 37 dias, desde a época de 31/07/2026 | **muda: época → hoje** |

**Só a janela comprovadamente errada troca de tamanho aqui.** As três cadeias ficam declaradas
como conceito e a trava contra taxa entre cadeias entra agora, mas esticar o GSC para 8 meses
trocaria o número de `visitante` dos **17 projetos** do portfólio — e `/okr` ordena por
`posicaoDeAtaque()` sobre essas células. Mudança dessa amplitude não anda escondida dentro de uma
spec chamada "correção": as janelas longas de Descoberta e Comportamento são a 019, onde elas têm
tela (`/okr/atma/aquisicao`) e alguém para lê-las.

### A época de 31/07/2026

A Atma era uma sociedade; a sociedade foi desfeita e **o banco com todos os leads anteriores foi
perdido**. `min(created_at) = 2026-07-31T06:14Z` — o corte é limpo, **todos os 51 leads são
pós-época**, e não existe um único registro anterior. Antes de 31/07 o follow-up era de um sócio
comercial; depois, do dono sozinho. Comparar conversão pré e pós-época compara duas empresas.

Os ~1.051 `form_start` de set/2025 a jul/2026 correspondem a leads que existiram e são
irrecuperáveis (~700 pessoas na razão de agosto). GSC e GA4 enxergam esse período; o banco não.

### Os três defeitos que esta spec fecha

**1. Publica número errado.** Além do truncamento acima, `meta.ticket` vale **R$ 4.000 declarado**
enquanto `orcamentos` grava `preco` e `desconto_vista` em 7 de 7 linhas:

```
avg(preco)                          = R$  5.352,20   bruto
avg(preco * (1 - desconto_vista))   = R$  4.932,34   liquido, desconto em 7 de 7, 5-10%
sum(preco)                          = R$ 37.465,43   pipeline enviado
```

R$ 50.000 ÷ 4.932,34 = **10,1 vendas**, não as 12,5 que `lib/projecao.mjs` calcula hoje com o
declarado. **Apurado vence declarado** — e essa regra não pode valer para leads e não valer para
dinheiro. Líquido porque desconto concedido a 100% dos casos **é** o preço.

**2. Inventa buraco.** `motivo`, `status_historico`, `orcamentos.preco` e o histórico completo de
`patient_leads` estavam medidos e gravados; a página nunca os leu e chamava isso de "não apurado".
A lista de buracos — prioridade nº 1 do leitor — estava inflada por dívida de leitura.

> **"o negócio não mede" ≠ "a tela não lê".** A segunda é backlog de engenharia, não informação
> para quem decide.

**3. Enterra o que decide.** 57% das perdas têm um nome que nunca apareceu na tela.

```
sem_resposta 29 · sem_interesse 9 · contato_futuro 8 · enviou_documentacao 2
preco_alto 1 · perdido_concorrencia 1 · (sem motivo) 1          -- 51 leads
```

**A demanda que chega é de preço** (7 das 8 principais queries orgânicas). **A perda acontece por
silêncio** (`sem_resposta` 29 contra `preco_alto` 1). O gargalo não é a oferta, é o follow-up — e
os dois fatos só produzem essa decisão quando estão na mesma dobra.

### O degrau que não é degrau

`patient_leads.status` não tem nenhum lead em `novo` (cancelado 37 · contatado 6 · pre_orcamento 5 ·
exames_enviados 3). `celulaDeContato()` devolve, portanto, **100%**. Um degrau de 100% não informa:
não pode ser gargalo, não pode melhorar, e ocupa a linha do degrau real. Pior, ele é **declarado,
não apurado** — `status_historico` conta 17 transições para `contatado` contra os 51 que o operador
afirma, e se contradiz em pelo menos dois registros (`exames_enviados` com motivo `sem_interesse`).

O degrau real estava na coluna ao lado: **`respondeu`**, derivado de `motivo <> 'sem_resposta'`.
Um `CASE WHEN` transforma um campo de texto no degrau mais importante da cadeia — sem coletor novo,
sem instrumentação, sem esperar ninguém adotar hábito.

### `form_submit`: duas fontes para o mesmo degrau

`EVENTOS_D3` (`lib/ga4.ts:77`) inclui `form_submit`, e `medidoresDeEventos()` (`lib/ficha.mjs:410`)
monta `abandono-por-campo` do PAR `form_start`/`form_submit`. O evento disparou **1 vez em 12 meses
e 0 na época**, contra 51 leads gravados no banco no mesmo período. O medidor publica há semanas um
"não apurado" que pede instrumentação para um degrau que o banco já mede — é o defeito nº 2 em
forma de medidor. **O banco é canônico para o degrau `lead`**; duas fontes para o mesmo degrau só
criam a chance de discordarem.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cada cadeia lê a janela que a fonte tem (Priority: P1)

Jean abre `/okr/atma` e vê 51 leads e 4 orçamentos (pacientes distintos — 7 linhas cruas, deduplicadas
pelo mesmo dedup do Túlio da 017) — tudo o que existe — em vez de 20 e 5. Cada número carrega a
janela que o produziu, e nenhuma taxa mistura duas.

**Por que P1**: é o defeito de maior amplitude. Enquanto a janela do GSC cobrar do banco, todo
degrau de conversão sai subcontado e nenhum outro conserto aparece.

**Teste de aceitação**

1. **Dado** o banco da Atma com 51 leads a partir de 31/07/2026, **quando** a ficha calcula o
   degrau `lead`, **então** devolve `apurado(51)`, não 20.
2. **Dado** 7 linhas em `orcamentos`, **quando** a ficha calcula o degrau, **então** devolve
   `apurado(7)`, não 5.
3. **Dado** que só o GSC publica atraso, **quando** a cadeia de Conversão fecha, **então** fecha em
   `hoje`, e só a de Descoberta fecha em `hoje-3`.
4. **Dado** um número exibido, **quando** se procura sua janela, **então** ela está ao lado dele —
   nenhum número aparece sem a janela que o produziu.
5. **Dado** os degraus `visitante` (GSC) e `lead` (banco), **quando** a ficha monta taxas, **então**
   **não existe** taxa entre eles: são cadeias diferentes e a costura é a época (019).

---

### User Story 2 - `contatado` sai da cadeia e `respondeu` entra (Priority: P1)

A linha da cadeia deixa de ser ocupada por um degrau de 100% declarado e passa a mostrar o degrau
que decide: 21 de 51 responderam.

**Por que P1**: é a diferença entre uma cadeia que aponta gargalo e uma que aponta nada. Sem isto a
US1 entrega os números certos numa cadeia que continua sem informar.

**Teste de aceitação**

1. **Dado** o perfil D, **quando** a ficha lista os marcos, **então** `contatado` não é um deles.
2. **Dado** que 51 de 51 estão fora de `novo`, **quando** a ficha exibe o contato, **então** ele
   aparece como **nota** — "100% contatados (declarado pelo operador, 05/09/2026)" — nunca como
   degrau, nunca com taxa, nunca como candidato a gargalo.
3. **Dado** `motivo` em 50 de 51 leads, **quando** a ficha calcula `respondeu`, **então** devolve
   `apurado(21)`: `motivo IS NOT NULL AND motivo <> 'sem_resposta'`.
4. **Dado** o lead sem motivo, **quando** a ficha calcula a taxa `lead→respondeu`, **então** exibe
   **41,2% como PISO** (21/51), com o indeterminado nomeado — o lead sem motivo não vira
   "respondeu" nem "não respondeu", e só pode mover a taxa para cima (43,1%).
5. **Dado** um projeto perfil D sem fonte própria (`aftercare`), **quando** a ficha monta a cadeia,
   **então** `respondeu` sai `não apurado` nomeando a fonte a consultar — a regra é da Atma, não do
   template, e não se herda de graça.

---

### User Story 3 - O ticket é o apurado líquido, não o declarado (Priority: P1)

A conta da meta usa R$ 4.932,34 e diz 10,1 vendas.

**Por que P1**: é número exibido e errado, e é o multiplicador de todo o resto da árvore.

**Teste de aceitação**

1. **Dado** 7 orçamentos com `preco` e `desconto_vista`, **quando** a ficha resolve o ticket,
   **então** devolve `apurado(4932,34)` — a média de `preco * (1 - desconto_vista)`.
2. **Dado** ticket apurado e `meta.ticket` declarado, **quando** os dois existem, **então** vence o
   apurado, e a ficha diz qual usou.
3. **Dado** um projeto sem orçamento na janela, **quando** a ficha resolve o ticket, **então** cai
   para `meta.ticket` rotulado `declarado` — nunca para zero, nunca para média inventada.
4. **Dado** meta de R$ 50.000, **quando** `projetar()` converte em contagem, **então** devolve
   **10,1**, e o ticket entra rotulado `apurado`, não `declarada (D1)`.

---

### User Story 4 - A lista de buracos só tem buraco de verdade (Priority: P2)

O leitor abre a ficha e a lista de buracos tem duas células, não trinta — porque "a tela não lê"
saiu dali.

**Teste de aceitação**

1. **Dado** um `não apurado` **sem** rótulo, **quando** a ficha o processa, **então** ele se
   comporta exatamente como hoje — nenhum dos 72 call sites existentes muda de comportamento por
   não ter sido revisado.
2. **Dado** um `não apurado` com rótulo `tela-nao-le`, **quando** a ficha monta a lista de buracos,
   **então** ele **não aparece** — vai para backlog de engenharia.
3. **Dado** o GSC fora do ar, **quando** a célula falha, **então** o rótulo é `falhou-agora` e ela
   continua separada do buraco permanente (regressão da rodada 3 do design-review).
4. **Dado** a Atma depois desta spec, **quando** se conta os `tela-nao-le` dela, **então** dá
   **zero**: as quatro fontes passaram a ser lidas, e `status_historico` — que ninguém lê — não
   vira célula só para ser escondida. O backlog de velocidade e coorte fica em `handoff/`.
5. **Dado** a linha de base da SC-000, **quando** se conta os buracos da `atma` depois, **então**
   a lista **encolheu** — é a tese da spec (a lista estava inflada por dívida de leitura) que está
   sendo testada, não um teto que alguém chutou.

---

### User Story 5 - `form_submit` sai do catálogo (Priority: P3)

O medidor de abandono para de pedir instrumentação para um degrau que o banco já mede.

**Teste de aceitação**

1. **Dado** `EVENTOS_D3`, **quando** se lista os eventos, **então** `form_submit` não está lá.
2. **Dado** o GA4 cobrindo a época inteira (64 `form_start` nos 37 dias, 51 leads no banco),
   **quando** a ficha calcula abandono, **então** devolve **12 (19,1%)** — `form_start` menos
   `lead`, só quando as duas janelas coincidem.
3. **Dado** uma janela de GA4 que NÃO cobre a época inteira, **quando** a ficha tenta o abandono,
   **então** sai `não apurado` nomeando a divergência de janela — nunca compõe períodos
   diferentes. **Achado em implementação (05/09/2026): esse ramo DISPARA hoje**, não fica inerte —
   a guarda exige o GA4 COBRIR a época (não caber dentro dela), e COMPORTAMENTO (28d, FR-003) é
   MENOR que a época da atma (37d). A leitura original ("28d cabe dentro de 37d, o ramo não
   dispara") estava com a direção da guarda invertida: comparar 28 dias de `form_start` com 37
   dias de `lead` dava um número **negativo** (mais lead de WhatsApp que form_start no recorte
   curto), não um resultado inerte. `/okr/atma` mostra "não apurado" para este medidor até a 019
   esticar o GA4 para cobrir a época — só aí o ramo apurado passa a disparar.

### Edge Cases

- **A venda é `apurado(0)` e mesmo assim não tem instrumento.** `vendas: []` no card diz "olhei,
  zero", e o zero é verdade (7 orçamentos, 4 já perdidos, 2 vivos, nenhum fechado). Mas o checkout
  do MercadoPago está descontinuado: **nada registraria a próxima venda**. A célula continua
  `apurado(0)` e a `fonte` DEVE dizer as duas coisas (FR-025/FR-026). Virar `não apurado` apagaria
  um zero que o dono sabe ser verdadeiro e devolveria a cadeia para "sem coletor", que é o que a
  017 acabou de matar. Renderizar isso como buraco na primeira dobra é escopo da 019.
- **`status` está sujo.** 17 transições no log contra 51 contatos declarados, e pelo menos dois
  registros se contradizem. Esta spec não modela contradição: o dado passa como está, e por isso
  `contatado` sai da cadeia em vez de virar apurado.
- **Coorte com n < 20.** Uma coorte de 4 leads só produz 0%, 25%, 50%, 75% ou 100%. Quando a
  coorte entrar (com `status_historico`, fora desta spec), ela sai como contagem crua, nunca como
  percentual.
- **`REGUA.D` fica com duas linhas órfãs.** `lead→contatado` (fonte InfluxMD, que mede
  *agendamento* — degrau que a Atma não tem) e `visitante→lead` (cruza cadeias). As duas saem
  aqui; as seis réguas pesquisadas são a 020.
- **`market_benchmarks` na base da Atma** tem 12 linhas com `source: "A definir"`. Não é lida por
  esta spec e é apagada pela 020.

## Requirements *(mandatory)*

<!-- Fechados na sessão de grilling de 05/09/2026 (17 decisões, 4 rodadas). Onde a decisão
     contrariou o rascunho, o requisito diz por quê — a razão é o que sobrevive à próxima spec. -->

### Janelas e época

- **FR-001**: As três janelas nomeadas — `DESCOBERTA` (GSC), `COMPORTAMENTO` (GA4) e `CONVERSAO`
  (fonte própria) — DEVEM morar num `lib/janelas.mjs` **puro** (sem env, sem banco, sem rede, sem
  relógio além do parâmetro), importado por `lib/okr-coleta.ts` **e** por `scripts/funil.mjs`.
  Nenhuma outra definição de janela PODE existir no repo: hoje o script tem cópia própria
  (`diasAtras(31)`/`diasAtras(3)`), e duas verdades sobre "a janela" divergem na primeira spec que
  mexer em uma delas.
- **FR-002**: As janelas são **fixas e declaradas**, nunca "o máximo que a fonte devolveu". Janela
  que cresce porque a fonte passou a entregar mais faz número mudar sem ninguém decidir, e comparar
  a mesma tela em dois meses passa a comparar tamanhos diferentes.
- **FR-003**: **Só `CONVERSAO` troca de tamanho nesta spec.** `DESCOBERTA` e `COMPORTAMENTO`
  continuam em 28 dias fechando em D-3 até a 019. Esticar o GSC para 8 meses trocaria a célula
  `visitante` dos 17 projetos e o ranking do portfólio inteiro — amplitude que não anda escondida
  dentro de uma correção.
- **FR-004**: O card do projeto DEVE aceitar `epoca: { data, porque }`. Para a `atma`:
  `2026-07-31`, "sociedade desfeita; o banco com os leads anteriores foi perdido".
- **FR-005**: `CONVERSAO` de projeto **com** `epoca` é `epoca.data → hoje`, e a ficha DEVE exibir a
  época com o motivo declarado. Ela cresce dia a dia e isso **não** contradiz a FR-002: o que a
  FR-002 proíbe é janela definida pelo que a fonte devolveu; a época é uma data que alguém escreveu
  no card e que aparece na tela. Uma janela rolante de 37 dias faria os leads de agosto caírem fora
  com o tempo — jogando fora exatamente o que a época existe para preservar.
- **FR-006**: `CONVERSAO` de projeto **sem** `epoca` continua 28d/D-3. Nenhum dos outros 16
  projetos PODE mudar de número por causa desta spec.
- **FR-007**: **Nenhuma taxa PODE ter numerador e denominador de cadeias diferentes.** Vale para a
  cadeia da ficha e para as camadas da árvore de metas. Enquanto a costura da época não existir
  (019), a árvore desce **só dentro da cadeia de Conversão**, parando e nomeando onde a cadeia
  acaba.
- **FR-008**: Todo número exibido DEVE carregar a janela que o produziu.
- **FR-009**: `/okr` DEVE exibir a janela de **cada linha**, não uma janela única no cabeçalho, e
  continua ordenando por `posicaoDeAtaque()` — que diagnostica cada projeto dentro da própria
  cadeia e não compara projetos entre si. O que a janela diferente contamina é a frase de resumo
  ("N projetos na posição 1"), que DEVE dizer que soma janelas diferentes.
- **FR-010**: `resolverGa4()` (`lib/ficha.mjs`) DEVE parar de tratar janela divergente do GA4 como
  defeito a corrigir e passar a tratá-la como **estado normal** — com a época, a divergência vira a
  regra para a `atma`. O que ela bloqueia é a composição entre cadeias (FR-007), não a leitura.

### Cadeia canônica

- **FR-011**: `PERFIS.D.marcos` DEVE passar a ser `lead → respondeu → orçamento → tratamento`.
  `visitante` sai da cadeia (é `DESCOBERTA`) e `contatado` sai (é degrau de 100%). Os números de
  Descoberta e Comportamento continuam exibidos, em bloco próprio, com a janela deles e sem taxa
  ligando à Conversão.
- **FR-012**: Os perfis **A e B mantêm `visitante`** — a travessia de cadeia existe lá também
  (`visitante`→`signup`, `visitante`→`produto`), mas os coletores são `null` e a taxa nunca chega a
  ser calculada: o defeito é latente, não vivo. DEVE existir um **teste que falha** se `signup` ou
  `produto` ganhar coletor sem tratar a travessia, senão o primeiro projeto A/B com fonte própria
  reintroduz a taxa entre cadeias em silêncio.
- **FR-013**: `celulaDeContato()` continua existindo e DEVE alimentar uma **nota**, não um marco:
  "100% contatados (declarado pelo operador, 05/09/2026)". Sem taxa, fora do cálculo de gargalo.
- **FR-014**: Novo marco `respondeu`, coletor derivado de `patient_leads.motivo`:
  `motivo IS NOT NULL AND motivo <> 'sem_resposta'`. `familia: "D4"`, `fonte` citando a coluna.
- **FR-015**: A taxa `lead→respondeu` DEVE ser publicada como **piso** enquanto houver lead sem
  motivo, com a contagem de indeterminados visível. Lead sem motivo NÃO conta como respondeu nem
  como não-respondeu. O denominador continua sendo o degrau `lead` inteiro (51) — trocar para 50
  faria a cadeia ter duas populações, que é o defeito dos orçamentos órfãos da 017 outra vez.
- **FR-016**: O piso **PODE** ser divisor na árvore de metas, e a saída DEVE herdar o "no mínimo"
  como **flag no rótulo que a célula já carrega** — não um quarto estado ao lado de
  `apurado`/`declarado`/`inferido`/`ponte`. Parar a árvore inteira por 1 indeterminado em 51
  (1,9pp) entrega menos que uma conta declaradamente conservadora; usá-lo sem rótulo é como o
  R$ 4.000 virou 12,5 vendas — número certo, procedência apagada.
- **FR-017**: Projeto perfil D **sem** fonte própria que devolva `motivo` DEVE receber
  `não apurado` nomeando a fonte a consultar — a regra é do cliente, o template não a herda
  (mesmo tratamento que `contatado` recebeu na 017).
- **FR-018**: `PERFIS.D.n2` e `PERFIS.D.fatores` DEVEM ser remapeados para a cadeia nova. O fator
  hoje coberto por `["contatado","orcamento"]` passa a `["respondeu","orcamento"]`, sem buraco nem
  sobreposição de cobertura.
- **FR-019**: `REGUA.D` NÃO PODE referenciar degrau inexistente: `lead→contatado` e
  `visitante→lead` saem. As citações ficam em comentário, como a 017 fez com case acceptance.

### Ticket

- **FR-020**: O SELECT de `orcamentos` em `lib/okr-coleta.ts` DEVE trazer `preco` e
  `desconto_vista` — as colunas sempre existiram e a query nunca as pediu.
- **FR-021**: O ticket DEVE ser apurado como a média de `preco * (1 - coalesce(desconto_vista, 0))`
  sobre os orçamentos da janela `CONVERSAO`. Líquido porque o desconto foi concedido em 7 de 7.
- **FR-022**: Apurado vence declarado, num lugar só: resolvido antes de entrar em
  `lib/projecao.mjs`, que continua recebendo o ticket pronto e sem regra nova dentro.
- **FR-023**: A ficha DEVE rotular qual ticket usou (`apurado` ou `declarado`), e o rótulo do
  apurado NÃO PODE sair como "declarada (D1)".
- **FR-024**: Sem orçamento na janela, o ticket cai para `meta.ticket` rotulado `declarado` — nunca
  zero, nunca média de outra janela.

### Declarações humanas

- **FR-025**: O card DEVE aceitar `declaracoes`, um **map chaveado pela `chave` do marco**:
  `{ tratamento: { quem, em, texto } }`. A ficha anexa a declaração à `fonte` do marco. Mora no
  card, não no perfil, porque `PERFIS.D` é compartilhado com `aftercare` e o nome do dono da Atma
  não pode vazar para outro projeto.
- **FR-026**: A declaração do `tratamento` da `atma` DEVE dizer **as duas coisas**: o zero é
  declarado pelo dono em 05/09/2026, **e** o checkout do MercadoPago está descontinuado — nada
  registraria a próxima venda.
- **FR-027**: Isto fecha a **FR-004 da 017** ("a `fonte` de todo degrau vindo de declaração humana
  DEVE nomear quem declarou e quando"), que ficou meio cumprida: a `fonte` do `contatado` cita a
  regra e não cita quem nem quando.

### Rótulos de buraco

- **FR-028**: A célula `não apurado` PODE carregar um `rotulo` **opcional**: `nao-mede`,
  `falhou-agora` ou `tela-nao-le`. **Sem rótulo = comportamento de hoje**, e só `tela-nao-le` muda
  comportamento. Rótulo obrigatório com default gravaria `nao-mede` em ~70 dos 72 call sites que
  ninguém olhou — produzindo em massa a declaração falsa que esta spec existe para acabar. O rótulo
  é campo, **nunca** regex sobre o texto do motivo.
- **FR-029**: Célula com rótulo `tela-nao-le` NÃO PODE entrar na lista de buracos da ficha nem ser
  escolhida por `posicaoDeAtaque()`.
- **FR-030**: O rótulo é ortogonal a D1–D4: a família diz **onde** está a causa, o rótulo diz **de
  quem** é o trabalho. `familiaDe()` continua como está.
- **FR-031**: `status_historico` NÃO vira célula. Nada o lê hoje, e criar uma célula só para
  escondê-la da lista é scaffolding. O backlog (velocidade, passagem cumulativa, coorte) fica
  registrado em `handoff/`.

### `form_submit`

- **FR-032**: `form_submit` DEVE sair de `EVENTOS_D3` (`lib/ga4.ts`). O banco é canônico para o
  degrau `lead`.
- **FR-033**: `abandono-por-campo` DEVE ser recalculado como `form_start` (GA4) menos `lead`
  (banco), só quando a janela do GA4 COBRE a época inteira (nunca quando cabe dentro dela — as
  duas são o contrário uma da outra). **Achado em implementação**: com a FR-003 o GA4 fica em 28d
  e a época da atma tem 37 dias, o guard DISPARA hoje ("não apurado"), não nasce inerte — comparar
  28 dias de `form_start` com 37 dias de `lead` produzia um número negativo. O guard existe para
  proteger contra compor períodos diferentes tanto hoje (28d vs 37d) quanto na 019 (12 meses de
  GA4 vs 37 dias de banco).

### Travas

- **FR-034**: `lib/projecao.mjs` NÃO DEVE ganhar regra nova (recebe o ticket resolvido e pronto).
- **FR-035**: Nada de estrutura visual nesta spec: primeira dobra, `/okr/atma/metodo`,
  `/okr/atma/aquisicao`, pipeline como valor em risco e as janelas longas de Descoberta e
  Comportamento são a 019; as seis réguas pesquisadas e o `DELETE` de `market_benchmarks` são a 020.
- **FR-036**: A trava de "no máximo uma faixa de mercado por descida" (016) continua valendo. A R6
  continua valendo: benchmark é diagnóstico, nunca meta de KR.

### Success Criteria

- **SC-000** *(primeira tarefa, antes de qualquer edição)*: a contagem de buracos da `atma` hoje
  está registrada. Medir depois do conserto mede o conserto — a primeira corrida tem que ser a
  linha de base.
- **SC-001**: `/okr/atma` exibe `lead 51`, `respondeu 21 (piso 41,2%)`, `orçamento 4`
  (pacientes distintos), `tratamento 0` e ticket `R$ 4.932,34` — todos reproduzíveis pelas
  queries do §8 do handoff.
- **SC-002**: Com o ticket apurado (R$ 4.932,34) entrando em `lib/projecao.mjs` — que continua sem
  regra nova (FR-034) —, `n1Total = meta.valor / ticket` passa a valer **10,1**, não 12,5.
  **Achado em implementação, 05/09/2026**: a cadeia real da `atma` fecha ponta a ponta
  (`lead`/`respondeu`/`orçamento`/`tratamento` todos apurados) terminando em `tratamento = 0` —
  `ancoraDe()` (congelado, inalterado por esta spec) escolhe esse **último** marco como âncora
  quando a cadeia fecha inteira, e a guarda 8 de `projetar()` devolve `nao-apurado` ("âncora zerada
  — meta não se divide por volume nenhum") **antes** de `n1Total` chegar à tela. Isso já era assim
  antes da 018 (`contatado`/`orçamento` já eram apurados desde a 017) — o "12,5" nunca foi,
  provavelmente, o que a página realmente mostrava. `/okr/atma` hoje mostra corretamente "âncora
  zerada": é leitura verdadeira de uma cadeia medida até o fim que termina em zero venda, não um
  defeito desta spec. Reapresentar isso como progresso até a meta (em vez de bloqueio) é reformular
  `lib/projecao.mjs`/a UI da projeção — fora do escopo da 018 (FR-034) e do handoff §5 ("pipeline
  como valor em risco, nunca somado à meta"), que é explicitamente a 019.
- **SC-003**: Nenhuma ocorrência de `contatado` como marco, e nenhuma linha da `REGUA` referencia
  degrau fora da cadeia.
- **SC-004**: Nenhuma taxa exibida cruza cadeias — teste que falha se numerador e denominador
  vierem de janelas diferentes, e teste que falha se `signup`/`produto` (A/B) ganhar coletor.
- **SC-005**: A lista de buracos da `atma` **encolheu** contra a linha de base da SC-000, e nenhum
  sobrevivente carrega `tela-nao-le`.
- **SC-006**: `form_submit` não aparece em nenhum catálogo de medidores.
- **SC-007**: Os **16 projetos sem `epoca` saem com os mesmos números de antes** — teste de
  regressão do portfólio. Uma spec de correção da `atma` não muda o placar de mais ninguém.
- **SC-008**: `npm test` verde, com os testes novos registrados no `package.json`.
