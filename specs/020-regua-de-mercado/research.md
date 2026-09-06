# Research — 020, a régua de mercado da Atma

**Pesquisa feita em 06/09/2026.** Toda fonte abaixo foi **aberta e lida**, não só encontrada na
busca. Onde o resumo do buscador prometeu um número que a página não tinha, isso está registrado —
duas vezes aconteceu, e é o tipo de erro que produz régua falsa.

---

## O resultado, antes do detalhe

**Seis vereditos. Zero linhas exibíveis na ficha da Atma.**

| # | degrau | veredito | por quê, em uma linha |
|---|---|---|---|
| 1 | `lead→respondeu` | 🚫 **recusa** | ninguém publica isso; o que existe é B2B SaaS, outro ato e outra vertical |
| 2 | `respondeu→orçamento` | 🚫 **recusa** | ninguém publica; *quote-to-close* mede o degrau **seguinte** |
| 3 | `orçamento→tratamento` | 🚫 **recusa com citação** | as fontes são sólidas mas medem aceite **pós-consulta presencial**, e a Atma não tem consulta |
| 4 | `impressão→clique` | ⏳ **condicional** | fonte existe e é boa, mas CTR agregado sem controle de posição mede **mix de posição** |
| 5 | `clique→form_start` | 🚫 **recusa** | numerador GA4 (todos os canais) × denominador GSC (só orgânica) — FR-009 |
| 6 | `form_start→lead` | ✅ **linha** | Zuko/FormAssembly medem exatamente este ato; **mas é degrau de aquisição → exibição é a 022 (D2)** |

**A consequência que o dono precisa ouvir**: o comentário que já estava em `lib/benchmark.mjs` —
*"nenhum publica benchmark para esses degraus"* — **estava certo**, e agora está provado em vez de
suposto. A cadeia de Conversão da Atma fica sem régua comparável. O que a 020 entrega ali não é uma
comparação: é **o motivo específico de cada ausência**, que hoje a tela resume numa frase genérica
idêntica para todos.

Isso tem valor próprio, e não é consolo. O dono que pesquisar "case acceptance rate" vai achar **45%**
em cinco minutos e concluir que seus 0% são catástrofe. A recusa desta spec diz por que aquele 45%
não é a régua dele — e evita a decisão errada que o número certo, aplicado ao degrau errado, produz.

---

## D1 — `lead→respondeu`: recusa

**Decisão**: sem linha. Recusa registrada como dado, com as fontes descartadas.

**O que foi procurado**: taxa de *resposta* de lead — de quem entrou, quantos responderam ao contato.
Buscas em duas frentes: benchmark de resposta em saúde, e benchmark de *contact/connect rate* em
vendas.

**O que existe, e por que nenhum serve**:

| fonte encontrada | número | por que não é este degrau |
|---|---|---|
| Ruler Analytics / Umbrex — saúde | conversão de lead 4–6% | é **lead → cliente**, a cadeia inteira, não o primeiro degrau |
| Salesforce, State of Sales 2024 | MQL→SQL 13% | B2B SaaS. "Qualificado" é definição interna de cada empresa — a mesma razão pela qual o perfil C recusa `contato→conversa` |
| RevenueHero, Inbound Benchmark 2025 | mediana 62% de qualificados viram reunião | B2B SaaS, e mede **reunião agendada**, não resposta |
| Cognism, Cold Email Benchmark | reply rate 1–5%, topo 8–10% | **outbound frio**. A Atma responde a quem procurou ela — o ato é o inverso |
| LeadAngel / GreetNow | *speed to lead*: saúde responde em 2h05 | mede o tempo **da empresa**, não a resposta **do lead** |

**Razão da recusa**: `respondeu` na Atma é derivado de `patient_leads.motivo <> 'sem_resposta'` — "o
paciente voltou a falar com a gente em algum momento". Nenhuma das fontes mede esse ato para um
consumidor de saúde que chegou por busca orgânica e é contatado por WhatsApp. Usar o número de B2B
SaaS aqui seria comparar um paciente de ortodontia com um comprador de software.

**Nota amarga**: é o degrau **mais importante** da cadeia (29 das 51 perdas são `sem_resposta`) e é o
que fica sem régua. A ausência não muda o diagnóstico — a §7 já aponta este degrau por fato apurado,
sem precisar de mercado.

---

## D2 — `respondeu→orçamento`: recusa

**Decisão**: sem linha.

**O que existe**: *quote-to-close rate* é métrica publicada e bem definida (Count.co, KPITree) — mas
mede **orçamento enviado → negócio fechado**, que é o degrau nº 3, não este. Nada publica "de quem
respondeu, quantos receberam preço".

**Razão da recusa**: o degrau é específico de como a Atma registra a conversa. Entre "respondeu" e
"orçamento" há uma triagem (o paciente descreve o caso, manda foto, a clínica avalia) que cada
operação faz diferente e ninguém padroniza. É a mesma razão pela qual o perfil A recusa
`signup→ativado`: etapa que cada um define do seu jeito não tem benchmark comum.

---

## D3 — `orçamento→tratamento`: recusa **com** as citações

**Decisão**: sem linha, **e as duas fontes ficam gravadas na recusa** — porque são exatamente o que
alguém encontra ao pesquisar, e a recusa só serve se explicar por que elas não valem aqui.

**Fonte A — Henry Schein One, *Catalyst Index* 2026** (verificada abrindo a página, 06/09/2026):

> "the average dental practice accepts 45% of presented treatment plans, while top-performing
> organizations reach 75%"

Faixa de leitura publicada: abaixo de 45% = abaixo da média · 45–55% = média · 55–74% = forte ·
75%+ = top 10%. Publicado em 08/06/2026. **Não divulga tamanho de amostra** e **não separa paciente
novo de paciente de carteira** — confirmado lendo a página.

**Fonte B — Gaidge Analytics + Planet DDS (2025), citadas por Orthia**: ortodontia especificamente,
"treatment recommended to accepted: 80%+ for top performers, 64–68% average". Fonte **secundária**;
não abri a primária, e não abri porque não muda a decisão.

**Razão da recusa — a que importa**: as duas medem o aceite de um plano apresentado **depois de uma
consulta presencial**. A cadeia da Atma **não tem consulta**: o paciente recebe um preço por mensagem
e decide sozinho. Não são o mesmo degrau, e a diferença não é de calibragem, é de estágio faltando.

Aplicar 45% à Atma seria cobrar de quem manda preço por WhatsApp o número de quem sentou o paciente
na cadeira — a **mesma forma** do erro que o código já recusa em dois lugares:

- `visitante→lead`: *"onde a fonte separa cliente novo de recorrente, a linha usa o de novo — misturar
  os dois infla o piso e passa a cobrar de quem capta frio o número de quem tem carteira"*;
- `orcamento→aceito` (spec 017): a manchete de 50–60% foi recusada por misturar paciente novo com base
  existente.

**Procurei o substituto certo e não achei**: busca por conversão de teledentistria / consulta virtual
/ orçamento remoto → início de tratamento em aligner DTC. O único número que apareceu (26,8% de
conversão de consulta online contra 5,6% presencial) vem de um estudo de plataforma, com definição de
"conversão" não declarada, e mede consulta agendada — não preço enviado. Não é citável.

**Consequência prática, e é a mais útil desta pesquisa**: a Atma está em **0% (0 de 4)**. Sem esta
recusa escrita, o 45% do Google vira a régua por padrão, e o gargalo real (`sem_resposta`, 29 de 51,
lá em cima na cadeia) fica escondido atrás de um degrau que ainda nem tem população para medir.

---

## D4 — `impressão→clique`: linha **condicional**, não recusa

**Decisão**: a fonte existe e é boa. A linha **se recusa a ser lida** enquanto a posição média não for
declarada — usando o mecanismo `condicional` que `lib/benchmark.mjs` já tem (é o que segura
`trial→cobranca` no perfil A).

**Por que não é recusa**: [Advanced Web Ranking — Google Organic CTR
tool](https://www.advancedwebranking.com/free-seo-tools/google-organic-ctr) publica CTR orgânico por
**posição, indústria e dispositivo**, atualizado mensalmente desde 2015, gratuito e sem login. É
exatamente a fonte que este degrau pede.

**Por que é condicional**: a Atma tem **1,21% de CTR** em 366.402 impressões — mas isso é a média de
*todas* as posições. Comparar um CTR agregado contra qualquer faixa publicada mede **mix de posição**,
não desempenho: 1,21% em posição 15 é normal, em posição 3 é desastre. As posições da Atma são
conhecidas (`atma aligner` em 1,4; as sete queries de preço entre 2,2 e 7,5), então a condição é
satisfazível — só não por esta spec.

**Duas armadilhas registradas para quem implementar** (as duas custaram uma verificação hoje):

1. **`navboost.com/ctr-by-industry` não tem número de saúde.** O resumo da busca afirmou que tinha.
   Abrindo a página: só *Pharmaceutical* (38,1% na posição 1), derivado de dados de campanha
   First Page Sage 2019–2023, ~73% B2B. Não serve e não foi usado.
2. **O relatório trimestral da AWR publica *variação* em pontos percentuais, não CTR absoluto**, e o
   de Q3 2025 (20/11/2025) não tem recorte de saúde. Quem citar "AWR" precisa citar a **ferramenta**,
   não o relatório de mudanças.

⚠️ **Sinal de fundo que a régua vai ter que carregar**: AI Overviews. A Ahrefs mediu ~58% de queda de
cliques no primeiro resultado orgânico quando há AI Overview, e saúde é das categorias que mais os
disparam. Uma faixa de CTR de antes disso já não descreve a SERP de hoje — a data de acesso (FR-003)
existe exatamente para essa fonte envelhecer visivelmente.

---

## D5 — `clique→form_start`: recusa, decidida antes da pesquisa

**Decisão**: sem linha, e a recusa é **estrutural**, não de disponibilidade de fonte. Mesmo que exista
benchmark publicado, este degrau não pode ser lido.

**Razão**: numerador vem do GA4 (todos os canais), denominador do GSC (só busca orgânica). Na época
são **599 cliques do GSC contra 1.140 sessões do GA4** — 47% do tráfego não é orgânico. Uma taxa assim
mede a diferença entre os dois instrumentos, não o negócio.

É a taxa gêmea de `cliques→sessões`, que a **FR-029 da 019** baniu do funil pelo mesmo motivo. Esta
spec não a reintroduz pela porta da régua. A recusa fica gravada para que a 022 não a tente de novo.

---

## D6 — `form_start→lead`: **linha**, e a única

**Decisão**: linha com fonte verificada. **Não é exibida pela 020** — é degrau de aquisição, e a D2 da
spec manda a exibição para a 022. Fica pesquisada, datada e pronta.

**Fonte primária — [Zuko Analytics](https://www.zuko.io/blog/25-conversion-rate-statistics-you-need)**
(verificada abrindo a página, 06/09/2026), citação literal:

> "66% of people who start a form successfully complete it"

E, distinguido explicitamente na mesma página do outro número que costuma ser confundido com este:

> "only 45% of people who visit a form convert successfully"

**Corroboração — FormAssembly**, 68% de conclusão sobre **1,6 bilhão de interações** (via Crazy Egg,
que também data Zuko e Typeform). O benchmarking setorial da Zuko cobre **93.022.997 sessões** em 17
setores.

**Por que esta fonte serve e as outras não serviram**: a definição bate exatamente. O `form_start` do
GA4 dispara na primeira interação com um campo; o "starter" da Zuko é quem interagiu com pelo menos um
campo. Mesmo ato, mesma unidade.

**Faixa proposta**: média **[66%, 68%]** (Zuko · FormAssembly).

🚩 **Pendência honesta**: **não achei número de elite verificado** para starter→completion. O shape
`Linha` de `lib/benchmark.mjs` exige `elite`, e inventar um piso de elite para preencher o campo é
literalmente o defeito que esta spec apaga. Duas saídas, e a escolha é da 022, não daqui:
(a) achar a fonte do quartil superior da Zuko, ou (b) admitir linha só-média no shape.

**Para calibrar a expectativa de quem implementar**: a Atma está em **80,9%** (51 leads / 63
`form_start` na época) — **acima de toda faixa publicada**. Este degrau não é gargalo, e é justamente
por isso que ele não é urgente.

---

## Achado transversal — o que esta pesquisa custou e o que ensina

**Duas de sete páginas abertas não continham o número que a busca prometeu** (navboost, cufinder). Uma
terceira devolveu 403 (GrowthRx). Se a régua tivesse sido montada a partir dos resumos de busca, **duas
das seis linhas seriam falsas** — com nome de veículo, aparência de rigor e nenhum número por trás.

É a mesma família do defeito que gerou toda esta sequência de specs: *afirmação sobre o dado escrita
sem consultar o dado*. Por isso a FR-002 exige URL e a verificação é abrir o link — não achar o link.

---

## Decisões de implementação derivadas (Fase 1)

| # | decisão | razão |
|---|---|---|
| **I1** | A recusa é **entrada na `REGUA`**, não ausência de entrada | FR-001a. Sem isso a tela repete a mesma frase genérica para 3 degraus com 3 motivos diferentes |
| **I2** | O shape `Linha` ganha `url`, `acessadoEm` e `recorte`; a recusa ganha `recusa: { motivo, descartadas[] }` | FR-002, FR-003, FR-001a |
| **I3** | `leituraDoDegrau()` passa a **preferir o motivo da entrada** ao texto genérico | FR-001b |
| **I4** | O comentário de `lib/benchmark.mjs` sobre "ninguém publica" vira o resultado **provado**, com link | FR-016 |
| **I5** | As 7 linhas legadas de A/B/C **não são tocadas**; a dívida é registrada nomeando as 7 | FR-002a |
| **I6** | `market_benchmarks` recebe as linhas **verificáveis** e as recusas; os 7 degraus que a Atma não tem somem | FR-013, FR-013a, FR-014 |
| **I7** | A escrita na rota da Atma recusa `source` não verificável | FR-015a |

### ⚠️ Tensão que a Fase 1 tem que resolver (não resolvida aqui)

A D1 da spec mandou **substituir** as 12 linhas de `market_benchmarks` pelas pesquisadas. **A pesquisa
devolveu uma única linha publicável, e ela é de aquisição.** Não há 12 linhas certas para pôr no lugar
de 12 erradas.

O `data-model.md` decide o que a tabela da Atma passa a conter. A leitura defensável: ela guarda **os
seis vereditos** — linha onde há linha, recusa onde há recusa — e não 12 métricas. O que **não** é
opção é deixar as 12 antigas.

---

## Fontes, com data de acesso

Todas acessadas em **06/09/2026**.

| fonte | uso | link |
|---|---|---|
| Zuko Analytics — 25 Conversion Rate Statistics | ✅ linha `form_start→lead` (66%) | https://www.zuko.io/blog/25-conversion-rate-statistics-you-need |
| Zuko Analytics — Industry Benchmarking | corroboração, 93.022.997 sessões | https://www.zuko.io/benchmarking/industry-benchmarking |
| Crazy Egg — 75+ Online Form Statistics | corroboração FormAssembly 68% / 1,6 bi | https://www.crazyegg.com/blog/form-statistics/ |
| Advanced Web Ranking — Google Organic CTR tool | ⏳ fonte da linha condicional `impressão→clique` | https://www.advancedwebranking.com/free-seo-tools/google-organic-ctr |
| Advanced Web Ranking — CTR Q3 2025 | ❌ descartada: publica variação em pp, sem recorte de saúde | https://www.advancedwebranking.com/blog/ctr-google-2025-q3 |
| Henry Schein One — Catalyst Index 2026 | 🚫 descartada na recusa de `orçamento→tratamento` (45% / 75%) | https://www.henryscheinone.com/insights/blogs/dso-dental-practice-case-acceptance-rate/ |
| Orthia — Orthodontic New Patient Conversion | 🚫 descartada; secundária de Gaidge/Planet DDS (64–68% / 80%+) | https://orthia.io/blog/orthodontic-new-patient-conversion-rate |
| navboost — CTR by Industry | ❌ **não contém** número de saúde, ao contrário do que a busca prometeu | https://navboost.com/ctr-by-industry/ |
| cufinder — Dentists Benchmarks | ❌ **sem CTR orgânico** e sem metodologia declarada | https://cufinder.io/blog/benchmarks/dentists/ |
| GrowthRx — Case Acceptance Benchmarks | ❌ HTTP 403, não foi possível verificar | https://getgrowthrx.com/blog/dental-case-acceptance-rate-benchmarks |
