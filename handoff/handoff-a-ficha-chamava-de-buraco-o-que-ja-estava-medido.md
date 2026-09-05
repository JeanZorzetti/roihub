# A ficha da Atma chamava de buraco o que já estava medido

**05/09/2026 — entendimento fechado, três specs abertas (018, 019, 020).**
**Atualizado 05/09 à noite: a 018 foi implementada (`4a36028`) e auditada — ver §12.**

Documento de decisão para `/okr/atma`. Nasceu de uma sessão de grilling depois que **quatro rodadas
de design-review** (`d010ab3`, `800e4e7`, `07e021e`, `cfccffd`) mais um redesenho (`c56f1d3`)
corrigiram mais de dez achados visuais e a página continuou sem servir.

A lição reaplicável, antes de qualquer detalhe: **quando um redesenho não resolve depois de duas
rodadas, o defeito não é de forma.** Aqui ele era de leitura — a tela publicava número errado e
chamava de "não apurado" dado que já estava gravado no banco há semanas.

---

## 1. Os três defeitos

**1. Publicava número errado.**
`contatado: 6` na tela. O log (`status_historico`) diz 17. O operador diz 51. E `ticket: 4.000`
no card contra R$ 5.352 bruto apurado nos sete orçamentos gravados.

**2. Inventava buraco.**
`motivo`, `status_historico`, `orcamentos.preco` e o histórico completo de `patient_leads` estavam
medidos e gravados. A página nunca os leu e chamava isso de "não apurado". A lista de buracos —
prioridade nº 1 do leitor — estava inflada por dívida de leitura, não por falta de medição.

> **Distinção que faltava:** "o negócio não mede" ≠ "a tela não lê". A segunda é backlog de
> engenharia, não informação para quem decide.

**3. Enterrava o que decide.**
57% das perdas têm um nome (`sem_resposta`) que nunca apareceu na tela, sob 5.267px de derivação
de método (as sete seções N0–N6).

---

## 2. Os números apurados

Medidos em 05/09/2026, direto nas fontes. Queries de reprodução no §8.

### Descoberta — GSC, jan/2026 → 02/09/2026 (8 meses)

Propriedade: `sc-domain:roilabs.com.br`, filtrando `page contains atma.roilabs.com.br`.
Não existe propriedade `atma` própria; `resolveProperty()` (`lib/gsc.ts:55`) sobe do subdomínio
para o domínio-pai e acha. **Set–dez/2025 = zero** (o site ainda não rankeava).

| | |
|---|---|
| impressões | 366.402 |
| cliques | 4.447 |
| CTR | **1,21%** |

Top query `atma aligner` — 962 cliques, posição 1,4 (marca).
**As sete seguintes são todas de preço**, ~320 cliques somados, posições 2,2 a 7,5,
com 2 a 7 mil impressões cada (`alinhador invisível preço`, `aparelho invisível mais barato`,
`aparelho invisivel preço`, `alinhadores invisíveis valores`, …).

### Comportamento — GA4 `properties/504053080`, set/2025 → 05/09/2026 (12 meses)

| | |
|---|---|
| sessões | 7.225 |
| `form_start` | 1.114 (15,4% das sessões) |
| `form_submit` | **1** — instrumentação morta |

Sessões por mês: set/25 122 → mai/26 **1.160** → jun **203** → jul **40** → ago **1.025** → set 53.
O colapso de jun-jul é a dissolução da sociedade (§3).

### Conversão — banco da Atma, 31/07/2026 → 05/09/2026 (37 dias)

| degrau | n | taxa | estado |
|---|---|---|---|
| leads | 51 | — | apurado |
| contatados | 51 | 100% | **declarado pelo operador** |
| **responderam** | **21** | **41,2%** | apurado via `motivo` |
| orçamentos enviados | 7 | 33,3% dos que responderam | apurado |
| vendas | **0** | 0% | apurado |

> ⚠️ **Duas linhas desta tabela mudaram depois da 018 (§12).** `orçamentos enviados` conta **pessoa**,
> não documento: os 7 orçamentos são de **4 pessoas** (21 pediu 1; 22, 44 e 51 pediram 2 cada), e a
> cadeia conta gente porque `lead` conta gente. E chegou 1 lead novo em 05/09 — são **52**, com 2 sem
> `motivo`, então `respondeu` sai como `21 · piso {indeterminados: 2, teto: 23}`. Os "2 ainda vivos"
> continuam valendo: ids 44 e 51.

Motivos (`patient_leads.motivo`, preenchido em 50 de 51):

| motivo | n | % |
|---|---|---|
| `sem_resposta` | **29** | 56,9% |
| `sem_interesse` | 9 | 17,6% |
| `contato_futuro` | 8 | 15,7% |
| `enviou_documentacao` | 2 | 3,9% |
| **`preco_alto`** | **1** | 2,0% |
| `perdido_concorrencia` | 1 | 2,0% |
| (sem motivo) | 1 | 2,0% |

Dinheiro (`orcamentos.preco`, sete linhas):
pipeline **R$ 37.465,43** · ticket bruto **R$ 5.352,20** · líquido do desconto à vista
(concedido em 7 de 7, 5–10%) **~R$ 4.932** · clínicas: Personali, Smart Aligner, M. Matos.

**Dos 7 orçamentos, 4 já estão perdidos** (2 `perdido_concorrencia`, 1 `sem_resposta`,
2 `sem_interesse`). **O pipeline vivo da Atma hoje são 2 pessoas.**

### Época — 31/07 → hoje, único recorte com todas as fontes

38.573 impressões → 599 cliques (**1,55%**) → 1.140 sessões → 63 `form_start` (**5,53%**)
→ 51 leads (**80,9% dos `form_start`**).

`form_start` = 80,9% dos leads prova que o evento **é** o formulário de lead, não newsletter.

---

## 3. A época de 31/07/2026

A Atma era uma sociedade. A sociedade foi desfeita e **o banco com todos os leads anteriores foi
perdido**. A Atma é agora de um dono só.

Consequências que o modelo de dados precisa carregar:

- **Todos os 51 leads são pós-época.** Não existe um único registro anterior. O corte é limpo.
- Os **~1.051 `form_start` de set/2025 a jul/2026** correspondem a leads que existiram e são
  **irrecuperáveis**. Na razão de agosto (57 `form_start` → 39 leads, 68%) seriam ~700 pessoas.
- O colapso de tráfego jun-jul tem nome: foi a separação.
- **Antes de 31/07 o follow-up era feito por um sócio comercial; depois, pelo dono sozinho.**
  Comparar conversão pré e pós-época compara duas empresas diferentes.

---

## 4. A contradição estratégica

**A demanda que chega é de preço.** Sete das oito principais queries orgânicas são busca por preço.
O reposicionamento da Atma para competir em preço está certo — do lado da aquisição.

**A perda acontece por silêncio.** `sem_resposta` 29 contra `preco_alto` **1**, em 51 leads.

Os dois fatos precisam estar na mesma dobra da ficha, porque só juntos produzem a decisão certa:
o gargalo não é a oferta, é o follow-up.

**Meta:** R$ 50.000 até 31/12/2026. Ao ticket apurado líquido são **10,1 vendas** — não as 12,5 que
a página calcula com o ticket declarado de R$ 4.000. O pipeline enviado (R$ 37.465) já é **75% da
meta anual**, parado em zero fechado.

---

## 5. As decisões

### Leitor e função
Um leitor só, o dono, **1×/semana, 60 segundos**. Hierarquia de perguntas:
**buracos → placar → tarefa** (nessa ordem, foi escolha explícita).

### Janelas — três cadeias separadas, uma costura
Não existe janela única (a R7 morre nesta forma). Cada fonte na sua janela máxima:

| cadeia | fonte | janela |
|---|---|---|
| Descoberta | GSC | 8 meses |
| Comportamento | GA4 | 12 meses |
| Conversão | banco | 37 dias |

**Nenhuma taxa cruza cadeias.** `cliques → sessões` nunca foi degrau: na época são 599 cliques
contra 1.140 sessões, porque o GSC vê só busca orgânica e o GA4 vê todos os canais. Separar não
perde nada real — expõe que ali não havia nada.

**A época é a única costura.** Nos 37 dias as três têm dado, e só ali a árvore de metas da spec 016
pode descer de impressão até venda.

### Cadeia canônica

```
lead → respondeu → orçamento → venda
```

- **`contatado` sai da cadeia.** Um degrau de 100% não informa: não pode ser gargalo, não pode
  melhorar, e ocupa a linha do degrau real. Vira nota: "100% contatados (declarado)".
- **`respondeu` entra**, derivado de `motivo <> 'sem_resposta'`. Um `CASE WHEN` transforma um campo
  de texto no degrau mais importante da cadeia — sem coletor novo, sem instrumentação, sem esperar.
- O **1 lead sem motivo** não vira "respondeu" nem "não respondeu": é `não apurado` de verdade.

### Fontes

- **Banco canônico** para o degrau lead. `form_submit` sai do catálogo de medidores (1 disparo em
  12 meses, 0 na época). Duas fontes para o mesmo degrau só criam a chance de discordarem.
- **Ticket = apurado líquido (~R$ 4.932)**, não o declarado. Apurado vence declarado, e essa regra
  não pode valer para leads e não valer para dinheiro. Líquido porque o desconto foi concedido em
  100% dos casos — desconto que todo mundo recebe é o preço.
- **`status_historico`** entra para passagem cumulativa, velocidade (8,3h médios até o contato,
  34,9h no pior caso) e coorte.
- **Coorte com n < 20 sai como contagem crua, nunca como percentual.** Uma coorte de 4 leads só
  produz 0%, 25%, 50%, 75% ou 100%.

### Buracos — três rótulos

1. **o negócio não mede** — ação: instrumentar. (Hoje: venda.)
2. **falhou agora** — transitório, já separado na rodada 3 do design-review.
3. **a tela não lê** — **sai da lista**, vira backlog de engenharia.

### Estrutura

- **Primeira dobra:** cadeia fechada → motivo da perda **com a ação colada nele** → buracos reais
  (hoje são duas células, não trinta).
- **N0–N6 saem** para `/okr/atma/metodo`. O motor continua calculando os sete níveis intactos.
- **Descoberta e Comportamento saem** para `/okr/atma/aquisicao` — relógio de trimestre, não de
  segunda-feira.
- **Pipeline aparece como valor em risco**, nunca somado à meta: "R$ 37.465 enviados · R$ 0
  fechados · 2 ainda vivos".

### Régua de mercado

Seis benchmarks reais, só para degraus que a Atma tem: impressão→clique, clique→`form_start`,
`form_start`→lead, lead→respondeu, respondeu→orçamento, orçamento→venda.
Fonte pública citável + comparável interno (goiânia, estetia). Mora no roihub.

**`market_benchmarks` na base da Atma é apagada** — 12 linhas com `source: "A definir - aguardando
pesquisa de mercado"`, metade medindo degraus que a Atma não possui (`agendamento`,
`comparecimento`, `avaliação inicial`). Benchmark sem fonte é pior que benchmark nenhum: produz
veredito com aparência de rigor.

**R6 continua valendo:** benchmark é diagnóstico ("2,9× o piso"), nunca meta de KR.

---

## 6. As três specs

| spec | escopo | fecha quando |
|---|---|---|
| **018 · correção** ✅ | época · `contatado` fora da cadeia · `respondeu` dentro · ticket apurado · `form_submit` fora do catálogo · três rótulos de buraco | nenhum número exibido está errado |
| **019 · estrutura** | primeira dobra nova · `/okr/atma/metodo` · `/okr/atma/aquisicao` · época como costura da 016 · pipeline como valor em risco · **+ alargar Descoberta e Comportamento (herdado da 018)** · **+ ler `status_historico`** | teste dos 30 segundos |
| **020 · régua** | 6 benchmarks pesquisados com fonte · apagar `market_benchmarks` | as 6 réguas têm fonte clicável |

**Nessa ordem, e separadas de propósito.** Se a correção vier junto do redesenho, não há como saber
se a página melhorou porque os números ficaram certos ou porque o layout mudou — que é exatamente
a confusão que produziu quatro rodadas inúteis.

A 020 não bloqueia as outras duas.

---

## 7. Teste de aceitação

**Pré-requisito (018):** nenhum número exibido na página está errado. Verificável rodando as
queries do §8.

**Critério (019):** abrir a ficha e, em 30 segundos, dizer em voz alta **qual degrau é o pior, por
que ele é o pior, e o que fazer sobre isso** — sem rolar a página.

Altura não é meta. Se couber em 1.500px e não passar no teste dos 30 segundos, não adiantou.

---

## 8. Como reproduzir os números

Todas as queries rodaram de `roihub/` com `ATMA_DATABASE_URL` do `.env` local.

```sql
-- cadeia de conversão (37d, época)
SELECT count(*) FROM patient_leads;                                  -- 51

SELECT count(DISTINCT registro_id) FROM status_historico
  WHERE para = 'contatado';                                          -- 17  (o log subconta)

SELECT CASE WHEN motivo = 'sem_resposta' THEN 'nao respondeu'
            WHEN motivo IS NULL          THEN 'sem motivo'
            ELSE 'respondeu' END AS grupo, count(*)
  FROM patient_leads GROUP BY 1;                                     -- 29 / 1 / 21

SELECT count(*), sum(preco), avg(preco) FROM orcamentos;             -- 7 · 37465,43 · 5352,20
```

GSC — `POST` em `searchAnalytics/query` na propriedade `sc-domain:roilabs.com.br` com
`dimensionFilterGroups: page contains atma.roilabs.com.br`.

GA4 — `POST` em `analyticsdata.googleapis.com/v1beta/properties/504053080:runReport`,
dimensão `eventName` / `yearMonth`, métrica `eventCount` / `sessions`.
Autenticação por `GOOGLE_SERVICE_ACCOUNT_JSON` via `google-auth-library` — **não há `googleapis`
instalado no projeto**.

---

## 9. Decisão de operação, fora do código

**Atualizar `status` a cada contato.** Hoje o log erra o contato em 3× (17 contra 51) e se
contradiz em pelo menos dois registros (`exames_enviados` com motivo `sem_interesse`; outro com
`sem_resposta`).

Se esse hábito não for adotado, a página não deve fingir que o degrau vai virar apurado — fica
`declarado` para sempre, e é honesto assim.

---

## 10. Pontas soltas

- **`form_start` caiu 3×** — 15,4% das sessões nos 12 meses contra 5,53% na época. Ninguém sabe
  por quê. Não é escopo destas specs; é o próximo achado a perseguir.
- **47% do tráfego da época não é busca orgânica** (599 cliques GSC contra 1.140 sessões GA4) e o
  canal não foi apurado nesta sessão.
- **`status` está sujo** — as specs não modelam contradição; o dado passa como está.
- **`seo_metrics_history` (0 linhas) e `crm_leads` (0 linhas)** na base da Atma são tabelas mortas.
- Os **~700 leads perdidos** com a sociedade não têm caminho de recuperação conhecido.

---

## 11. O que levar para a Sirius

A Atma é o piloto; a Sirius é o segundo em potencial de receita e vai ser modelada a partir do que
der certo aqui. Três regras que já se sabe que viajam:

1. **Antes de redesenhar, conferir se a tela está lendo tudo que o banco já grava.** Buraco de
   leitura se disfarça de buraco de medição, e nenhum redesenho conserta isso.
2. **Degrau de 100% não é degrau.** Se toda a população passa, ele não pode ser gargalo e está
   ocupando a linha do degrau real.
3. **Uma janela única só é possível quando todas as fontes têm o mesmo tamanho.** Quando não têm,
   separar em cadeias é mais honesto que truncar ao menor — e a interseção, quando existe, é o
   único lugar onde a meta pode descer inteira.
4. **Commit não é deploy.** Ver §12 — a 018 passou no critério de aceitação com o código certo e a
   tela no ar continuou publicando os números velhos.

---

## 12. Auditoria da 018 — 05/09/2026

Rodada com as funções reais contra o banco real (não lendo o código) e contra a tela no ar
(`curl` autenticado com `HUB_USER`/`HUB_PASS`).

### O que passou

Seis células conferidas contra SQL na mesma janela, todas batendo: `lead` 52 · `respondeu` 21 com
`piso {indeterminados:2, teto:23}` · `orçamento` 4 pessoas · ticket R$ 4.932,34 · nota de contato
98% (51/52, calculada, não cravada em 100%) · janela CONVERSAO `2026-07-31 → 2026-09-05`.
O ticket apurado chega mesmo em `projetar()` — a meta virou **10,1 tratamentos**, não 12,5.

A árvore de metas tem **guarda explícita contra cruzar janelas**: a camada de impressões só entra
se `marcos[0].chave === "visitante"`, e a cadeia D nova começa em `lead` (`lib/arvore-metas.mjs`).
A taxa `impressão → lead` que cruzaria Descoberta com Conversão não pode nascer.

### 🚨 O achado que anula os outros: a 018 não está no ar

`origin/main` está em `4a36028`, mas `https://hub.roilabs.com.br/okr/atma` serve o build
**anterior à 018**. A tela publica hoje: `visitante → lead (form do site)`, `CR(lead→orçamento)`,
`Leads 20`, `Valor do tratamento R$ 4.000 declarado`, e o texto *"Janela única para a árvore
inteira (R7): 2026-08-06 → 2026-09-02"*. Sem `respondeu`, sem época, sem ticket apurado.

**Push está em dia; falta o deploy.** O repo tem `Dockerfile` e nenhum workflow de deploy — o
rebuild é no EasyPanel. Enquanto ele não rodar, o critério de aceitação da 018 está satisfeito no
código e falso na tela.

### Corrigido nesta auditoria

1. **Comentário falso sobre `status_historico`** (`lib/okr.mjs`) — afirmava "0 transições reais
   gravadas". A tabela tem **82 transições de 52 leads, 01/08 → 05/09**. A migration rodou; o que
   falta é o hub LER. Escrever afirmação sobre o dado sem consultar o dado é o defeito que esta
   spec existe para matar, agora dentro dela mesma.
2. **Unidade do ticket sem rótulo** — a média é por documento (7) e o degrau conta pessoa (4), 75%
   de diferença. `ticketDeOrcamentos()` passa a devolver `docs` e `pessoas`, e o rótulo virou
   *"média de 7 orçamentos de 4 pessoas da janela CONVERSAO, líquido de desconto"*. A escolha por
   documento e o viés de peso estão em `contracts/ticket.md §4b`. **+4 testes** (615 no total).
3. **Janelas longas transferidas para a 019** — registrado no §6. `janelas.mjs` nomeia as três mas
   dá 28d a Descoberta e Comportamento, porque alargá-las mexeria na célula `visitante` dos 17
   outros projetos e no ranking do portfólio. Razão boa; a grelha não a levantou porque escopou
   para a Atma. A 019 herda.
4. **Tabela de conversão do §2 datada** — orçamento por pessoa, 52 leads.

### Pendente

- **Rodar o deploy** e reconferir a tela.
- **Uma resposta anômala**, não reproduzida: a primeira requisição autenticada a `/okr/atma` (16:56)
  devolveu **68.031 bytes do site de marketing da Atma** — `<title>Atma Aligner - Alinhadores
  Invisíveis…`, H1 "Transforme Seu Sorriso". As seis seguintes devolveram a ficha correta (66.442
  bytes, estáveis). Pode ter sido cache de borda; pode ser o proxy servindo o upstream errado sob
  concorrência, que é a classe de bug de [[nginx_shared_root_two_hosts_leaks_whole_site]]. Se
  reaparecer, é incidente de roteamento, não de aplicação.

---

## 12. Linha de base da SC-000 (018, T001/T002) — 05/09/2026, ANTES de qualquer edição

Medido rodando `montarNiveis()` com coleta real (banco da Atma via `ATMA_DATABASE_URL`, GSC, GA4),
no código de hoje, antes da primeira edição desta spec. Corrida manual e única — o script viveu em
`.tmp-t001-baseline.mjs` na raiz do repo e foi apagado logo depois (nunca commitado; seria
scaffolding pelo mesmo argumento da FR-031).

**Metodologia**: réplica de `coletarDoProjeto()` + `montarFicha()` + `posicaoDeAtaque()` +
`projetar()` + `montarNiveis()` para o projeto `atma`, fora do Next (sem path alias), para não
depender do dev server que já estava rodando noutra sessão. N6 foi medido com `itensAgenda: []`
de propósito — nenhuma tarefa da 018 toca `lib/agenda.mjs`/`evaluateAll()`, então o valor de N6 é
constante entre esta medição e a de T048 e não distorce a comparação.

**Janela usada (28d/D-3, a de hoje)**: `2026-08-06 → 2026-09-02`.

**Contagem de células `estado === "nao-apurado"` em N0–N6: 4.**

| # | nível | rótulo | motivo |
|---|---|---|---|
| 1 | N4 | outbound | a fonte GA4 não distingue prospecção ativa |
| 2 | N4 | diferença | canais sem fonte: outbound |
| 3 | N5 | abandono-por-campo | GA4 lido na janela: `form_start` 37 e `form_submit` ZERO — sem o par não há abandono |
| 4 | N6 | N6 | sem ação declarada para este projeto (artefato da metodologia — `itensAgenda: []`) |

Nota importante: a contagem de buracos de hoje é **pequena**, porque a 017 já tinha fechado
`contatado`/`orcamento` como coletores apurados. O que esta spec corrige (janela truncada, ticket
declarado vencendo o apurado, `contatado` ocupando a linha de `respondeu`) não aparece como célula
`nao-apurado` hoje — aparece como número **errado, mas com estado `apurado`/`declarado`**. A
SC-005 ("a lista encolheu") vai medir contra estes 4, e o candidato a sair é o nº 3
(`abandono-por-campo`), que a US5 resolve.

**Números-verdade do banco (T002, Passo 1 do quickstart, 05/09/2026)** — confirmados por query
direta em `ATMA_DATABASE_URL`, o oráculo dos testes das fases seguintes:

- `count(patient_leads) = 51`
- `min(created_at) = 2026-07-31T06:14:27Z`
- `motivo` agrupado: **21 respondeu · 29 sem_resposta · 1 sem motivo**
- `orcamentos`: **7 · sum 37.465,43 · avg bruto 5.352,20 · avg líquido 4.932,34**
- `status_historico WHERE para='contatado'` (DISTINCT registro_id) = **17**
- `patient_leads.status`: cancelado 37 · contatado 6 · pre_orcamento 5 · exames_enviados 3 ·
  **novo: 0** (100% fora de `novo`, base de `celulaDeContato()`)

## 13. Quatro correções aos números-verdade, achadas rodando o código de verdade (05/09/2026)

Os números do §3/§4 acima vieram de SQL cru e de aritmética manual — não de rodar a regra de
negócio que a tela realmente aplica. Quatro diferenças apareceram ao implementar a 018 (detalhe e
racional completos em `specs/018-atma-numeros-certos/research.md`, D8, D11 e D12):

1. **Lead: 51 é certo, mas quase saiu 43.** 8 dos 51 leads têm nome real (`"Lucas Pimentel - Wpp"`)
   e e-mail placeholder `teste@teste.com.br` — são leads de WhatsApp sem formulário, reais, mas
   `ehLeadDeTeste()` os classificava como teste nosso (colisão com `DOMINIOS_INTERNOS`). Corrigido:
   fonte PRÓPRIA de um projeto não aplica mais esse filtro (D11).
2. **Orçamento: 7 é o número do TICKET, não do degrau.** As 7 linhas de `orcamentos` cobrem só 4
   pacientes distintos (22, 44 e 51 pedem preço duas vezes) — `celulasDeOrcamento()` já deduplica
   por paciente desde a 017 (o caso Túlio). O **degrau** é 4; o **ticket** (`avg` sobre as 7 linhas
   cruas) continua certo em R$ 4.932,34.
3. **Projeção: "10,1" é aritmética, não o que a tela mostra.** Com a cadeia fechando ponta a ponta
   em `tratamento = 0`, `ancoraDe()` (congelado) escolhe esse último marco como âncora e
   `projetar()` devolve "âncora zerada — meta não se divide por volume nenhum". Isso já era assim
   antes da 018 (`contatado`/`orçamento` já eram apurados desde a 017) — o "12,5" citado no §4
   nunca foi, provavelmente, o que a página de fato mostrava. Reformular essa leitura como
   "pipeline em risco" é a 019 (§5 acima, "Estrutura").
4. **Abandono: a guarda de janela estava ao contrário.** "GA4 (28d) cabe dentro da época (37d),
   o guard não dispara" tinha a direção errada — comparar `form_start` de 28 dias com `lead` de 37
   dava **-14** (negativo). A guarda certa exige o GA4 COBRIR a época inteira, não caber dentro
   dela; hoje ela DISPARA (`/okr/atma` mostra "não apurado"), e só para de disparar quando a 019
   esticar o GA4. O "12 (19,1%)" citado segue correto — é `form_start` 64 medido nos 37 dias
   inteiros da época, o resultado esperado quando as janelas cobrirem uma a outra.

## 14. Backlog de `status_historico` — não vira célula nesta spec (FR-031, T054)

`status_historico` segue com dado gravado que nada lê, e criar célula só para escondê-la da lista
seria scaffolding (mesmo argumento da FR-031 que já vale para o script de baseline do T001). Fica
registrado aqui para quem herdar o próximo passo:

- **Velocidade**: 8,3 h médios até o contato, 34,9 h no pior caso — medido direto da tabela, não
  exposto em célula nenhuma da ficha hoje.
- **Passagem cumulativa**: quantos leads passam de cada status para o seguinte, e quanto tempo
  levam — dado bruto na tabela, sem leitura agregada.
- **Coorte**: leads agrupados por semana de entrada, medindo taxa de resposta/orçamento por coorte
  ao longo do tempo. **Regra que qualquer implementação futura tem que respeitar**: coorte com
  `n < 20` sai como **contagem crua, nunca como percentual** — uma coorte de 4 leads só produz 0%,
  25%, 50%, 75% ou 100%, e publicar isso como taxa é fabricar precisão que a amostra não tem.

Nenhum destes três vira célula, marco ou medidor nesta spec (018). Candidato natural para uma
spec futura de "profundidade de funil" — não a 019 (estrutura da própria página) nem a 020
(régua de mercado).
