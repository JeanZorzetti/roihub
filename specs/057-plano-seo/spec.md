# Feature Specification: Plano de SEO por projeto — das metas dos 18 KPIs até a tarefa da semana

**Feature Branch**: `057-plano-seo`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: *"A Tape Pro, eu não mexi muito nela ainda, meio que está na primeira versão.
[…] a parte de board do Google Search Console é um diagnóstico do que já existe e já coletou muitos
dados. Eu sinto falta de uma feature nova no Hub, que é o planejamento. E aí eu quero construir esse
planejamento para ser aplicado na Tape Pro, já que ela está quase do zero. Na parte de SEO, precisamos de
um planejador robusto o suficiente para atingir as 18 KPIs de https://hub.roilabs.com.br/gsc/mapa/atma"*,
com a imagem "Modern SEO Cluster" (SEO, AEO, GEO, AIO, SXO). Decisões do dono em 28/09/2026: **GEO e AIO
ficam para uma spec separada**, que começa pelo instrumento de medição (opção b); **as metas saem do
volume de busca do nicho e o dono aprova** (opção c).

## O fato que abre esta spec

Lido em 28/09/2026:

1. **O mapa só reage ao que já foi lido.** A 054 transforma cada leitura em ação ("se abaixo de X, fazer
   Y"), e a 055 marca o que foi feito. As duas pressupõem um site com dados. Num site sem impressão, as
   folhas ficam "sem leitura" ou disparam todas ao mesmo tempo, e nada diz **aonde chegar, até quando e em
   que ordem construir**.
2. **A Tape Pro não tem mapa.** `/gsc/mapa/tapepro` devolve 404: a lista de projetos com corrida e mapa
   (`SLUGS_DE_BUSCA`) tem só `atma` e `sirius`.
3. **A Tape Pro está parada, não "no começo".** O GSC tem dados desde 21/07/2026. O `insights.json` de
   27/09 registra **0 impressão na última semana**, tendência plana em 12 e 26 semanas, previsão de 0 até
   19/11 e crawl com só 62,2% de respostas OK. O sitemap tem **23 URLs**, com `lastmod` de 29/07, e o
   repositório `JeanZorzetti/tape` tem **9 posts**. O último commit é de 29/07.
4. **O card do projeto parte de uma premissa falsa.** Ele diz *"Nada de SEO até 19/10 — o robô publica
   1/dia"*. A entrada `tapepro` existe em `lib/autopublish-projects.mjs`, mas não entra artigo no repo desde
   29/07. Qualquer plano que conte com "volume automático" começa errado.
5. **O hub não sabe o tamanho da demanda de um site sem impressão.** A estimativa atual
   (`scripts/estimar-demanda.mjs`, 050) usa as impressões do próprio GSC como piso de volume. Com zero
   impressão, o piso é zero e a meta de TAM, de Top 20 e de footprint sai zero. A meta tem que vir de
   fora do GSC: do volume de busca do nicho (Google Ads, via DataForSEO, que o OpenSEO já consome).
6. **Parte das 18 metas do board não tem fonte.** O board da Atma escreve metas como "15% a 25% no Top 3
   por trimestre" e "+3 a +10 domínios". O hub as marca como "◇ meta do board, sem fonte". Para um site do
   zero, uma meta relativa ("crescer 10%") sobre uma base 0 não diz nada. O plano precisa de metas
   absolutas, com a conta à mostra.

## Clarifications

### Session 2026-09-28

- Q: GEO e AIO (citação por IA, visibilidade em LLM) entram no plano? → A: Não. Vão para uma spec
  separada, que começa criando a medição. Esta spec cobre SEO, AEO e a parte de experiência do SXO que o
  mapa já mede.
- Q: De onde vêm as metas de um projeto do zero? → A: Do volume de busca do nicho. O hub propõe e o dono
  aprova ou edita cada meta.
- Q: Quantas páginas novas por semana a Tape Pro consegue publicar? → A: O que o hub recomendar. A
  capacidade inicial é **3 páginas novas por semana** (1 página de cluster + 2 de apoio), produzidas à
  mão pelo dono. Motivo: o site tem 23 URLs, o crawl tem só 62,2% de respostas OK e site novo indexa
  devagar. Três páginas indexadas por semana valem mais que sete na fila de "descoberta, não indexada",
  e volume alto de páginas parecidas cai na política de conteúdo em escala do Google. A capacidade é
  editável, e o plano sobe o número quando a indexação limpa das páginas novas passar de 90%.
- Q: Qual a fonte do volume de busca, já que o crédito grátis da DataForSEO acabou (saldo US$ −0,003 em
  28/09)? → A: Recarregar US$ 50 na DataForSEO e usar a API. O volume é exato, não em faixa, e há uma
  fonte só.
- Q: Qual é a posição-alvo das metas que vêm da demanda? → A: A mesma para todos os clusters, em dois
  degraus: Top 20 aos 90 dias e Top 10 (faixa 7–10 da régua) aos 180 dias. Não há consulta de
  dificuldade de palavra.
- Q: As premissas de maturação ganham selo novo? → A: Não. Usam o selo existente "◇ política do dono,
  sem fonte" (FR-013).
- Q: Como os termos viram clusters? → A: Por regra fixa: o termo entra no cluster do termo semente que
  ele contém, e o dono move o que ficar errado antes de aprovar. Não há sobreposição de SERP nem LLM
  (FR-005).
- Q: Quando uma página que já existe conta como criada na semana 0? → A: Só quando está **indexada**
  (inspeção de URL) **e** teve ao menos 1 impressão na janela do Search Console. Página não indexada
  gera a tarefa **indexação** na semana 1. Página indexada sem impressão gera as tarefas de **posição**
  na semana 1. Nos dois casos, a maturação conta a partir da semana em que a tarefa recebe a marca de
  feito da 055, não da semana 0 (FR-007a). Motivo: em 28/09 a Tape Pro tinha as duas páginas de cluster
  no ar desde julho, 0 impressão desde 07/08, e o plano prometia 100% dos termos na página 1 com a semana
  vazia.
- Q: O que a semana mostra além das tarefas de página? → A: As tarefas do calendário (páginas e
  FR-007a) **mais** os cards que o mapa (054) dispara na leitura atual e que não têm marca de feito
  vigente (055). A mesma alavanca vira uma tarefa só, com os alvos somados, na ordem de ataque (FR-011a).
- Q: Quantos termos uma página conta quando amadurece (achado da D2)? → A: Só os termos cujas palavras
  estão todas no título ou no H1 dela, lidos no crawl, em qualquer ordem e sem acento. Termo de cluster
  com ≥ 100 buscas/mês que nenhuma página cobre vira candidato a página de apoio (semente + modificador).
  O piso de 100 leva o selo "◇ política do dono, sem fonte" e é editável (FR-005a, FR-007b). Motivo: com
  a contagem por cluster, 2 páginas da Tape Pro prometiam 100% dos 70 termos na página 1 aos 180 dias.

### Session 2026-09-28 (speckit-analyze)

- Q: A folha de striking distance (posições 4–10,9) ganha meta de demanda? → A: Não. Ela é fila de
  oportunidade: um termo que sobe para o Top 3 sai dela, e uma meta de "mais termos em 4–10,9" contaria
  isso como piora. Ela mantém a meta da 054. A demanda ganha uma projeção de cabeçalho, **termos do
  inventário na página 1 (1,0–10,9)**, lida com a mesma função da penetração no Top 3 e no Top 20.
- Q: Página que já existe conta para a meta de 90 dias? → A: Sim, como criada na semana 0, desde que
  esteja indexada e com impressão (clarificação de 28/09, FR-007a). Com a premissa padrão de 12 semanas
  até estabilizar, nenhuma página nova do plano amadurece antes dos 90 dias, e a tela diz isso junto da
  meta.
- Q: O dono muda o prazo? → A: Não. Os prazos são os dois degraus fixos, 90 e 180 dias. O dono muda a
  data de início do plano.
- Q: Atma e Sirius consultam volume pago? → A: Não. Usam a demanda que o hub já tem (piso do GSC, 050). A
  consulta paga não sobrescreve demanda de outra fonte.
- Q: Onde o plano lê o ponto de partida? → A: Na tela do plano, com uma leitura do Search Console por
  termo (a mesma do mapa), só para as metas de demanda. As demais folhas mostram o ponto de partida no
  próprio mapa.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ver a demanda do nicho e aprovar as metas (Priority: P1)

O dono abre o plano da Tape Pro. O hub parte dos termos semente do projeto (produtos, segmentos e foco
editorial que o hub já declara para ele) e mostra os termos do nicho agrupados em clusters, com o volume
mensal de busca no Brasil e a data da consulta. A partir desses números, propõe uma meta e um prazo para
cada um dos 18 KPIs. Cada meta mostra a conta de onde saiu. O dono aprova, edita ou recusa meta a meta.

**Why this priority**: sem meta absoluta não existe plano, só lista de tarefas. É também o que falta para
as folhas de TAM, Top 20 e footprint terem denominador num site sem impressão.

**Independent Test**: abrir o plano da Tape Pro e ler, por exemplo, "cluster fita gomada · 14 termos ·
X buscas/mês · meta de impressões em 180 dias: Y = X × fração de visibilidade na posição-alvo" e aprovar
essa meta sem sair da tela.

**Acceptance Scenarios**:

1. **Given** um projeto com termos semente declarados, **When** o dono pede a proposta, **Then** o hub
   consulta o volume uma vez, grava a consulta com data, região e custo, e mostra os clusters com o volume
   de cada termo.
2. **Given** a proposta pronta, **When** o dono olha um KPI contado em impressões, cliques, consultas ou
   termos, **Then** a meta vem da demanda, com a conta escrita (volume, posição-alvo, fração esperada
   naquela posição, prazo).
3. **Given** um KPI que já tem régua publicada no hub (CTR por posição, vitais, largura do título),
   **When** o dono olha a meta, **Then** a meta é a própria régua, com o selo da régua, e não uma
   estimativa nova.
4. **Given** um KPI sem régua e sem relação com volume (por exemplo, domínios referenciadores), **When** o
   dono olha a meta, **Then** ela continua sendo a do board, com o selo "◇ meta do board, sem fonte", e o
   dono pode trocá-la.
5. **Given** uma meta proposta, **When** o dono a aprova, edita ou recusa, **Then** o hub grava quem
   decidiu, quando e o valor anterior. Uma meta recusada não entra no plano.

---

### User Story 2 — Ler o plano semana a semana (Priority: P1)

Com as metas aprovadas, o hub monta o plano: uma sequência de semanas até o prazo, com as tarefas na
ordem de ataque que a 054 já usa (índice → desempenho → página certa → posição → snippet). Num site do
zero, a maior parte do trabalho é o que ainda não existe: as páginas de cada cluster. Por isso, a
cobertura vira um calendário de páginas a criar, cluster por cluster, antes das tarefas que dependem da
página já existir. Cada tarefa tem alavanca, alvo (cluster, termo ou URL), responsável, semana e o marco
que o KPI deve atingir naquela data.

**Why this priority**: é o pedido ("planejamento"). A meta sozinha diz aonde chegar. O plano diz o que
fazer segunda-feira.

**Independent Test**: abrir o plano da Tape Pro e ler, sem clicar, a tarefa da semana atual, quem é o
responsável e o marco esperado ("semana 3: 23 → 35 URLs no sitemap, 30 indexadas").

**Acceptance Scenarios**:

1. **Given** metas aprovadas e a capacidade declarada (páginas por semana que o projeto consegue
   publicar), **When** o plano é montado, **Then** o número de páginas por semana nunca passa da
   capacidade, e o prazo que não cabe na capacidade aparece como "não cabe no prazo com esta capacidade".
2. **Given** um cluster sem página, **When** o plano é montado, **Then** a criação da página vem antes de
   qualquer tarefa de posição ou snippet daquele cluster.
3. **Given** uma página criada na semana N, **When** o plano calcula os marcos, **Then** impressão e
   posição daquela página só contam a partir de um atraso de indexação e maturação declarado como
   premissa do plano, nunca na mesma semana.
4. **Given** várias metas que pedem a mesma alavanca, **When** o plano é montado, **Then** a alavanca vira
   uma tarefa só por semana, com todos os KPIs que a pediram, como a 054 já faz no painel.
5. **Given** capacidade zero (por exemplo, o robô de publicação parado), **When** o plano é montado,
   **Then** o plano diz isso na primeira linha e não mostra nenhum marco de cobertura como alcançável.
6. **Given** um cluster cuja página existe mas está fora do índice ou sem impressão, **When** o plano é
   montado, **Then** a semana 1 tem a tarefa de indexação ou de posição para aquela URL, e nenhum marco
   conta aquele cluster antes de a tarefa ter marca de feito e a maturação passar.
7. **Given** um projeto sem página nova a criar e com regras do mapa disparando, **When** o dono abre a
   semana corrente, **Then** ela mostra as tarefas desses cards e nunca "nada a fazer".

---

### User Story 3 — Comparar planejado com lido toda semana (Priority: P2)

A cada semana, o plano compara cada marco com a leitura que o mapa do projeto faz. O dono vê, por KPI,
se está no marco, abaixo, acima, sem leitura ou se o marco ainda não chegou. As tarefas usam a mesma
marca de feito da 055 (responsável e data para reler).

**Why this priority**: sem a comparação, o plano vira documento esquecido. Ela depende de o plano (US2)
existir e de o projeto ter mapa.

**Independent Test**: na semana 4 do plano da Tape Pro, abrir o plano e ler que "URLs indexadas" tem
marco 30 e leitura 22, "abaixo do marco", com a tarefa de indexação dessa semana ainda sem marca de feito.

**Acceptance Scenarios**:

1. **Given** um marco vencido e a leitura do mapa, **When** o dono abre o plano, **Then** o KPI mostra o
   marco, a leitura e o estado, e o estado não depende só da cor.
2. **Given** uma folha sem leitura no mapa, **When** o plano compara, **Then** o estado é "sem leitura",
   com o motivo que o mapa já imprime, e nunca "no marco".
3. **Given** um KPI abaixo do marco por duas semanas seguidas, **When** o dono abre o plano, **Then** o
   plano sugere refazer a proposta daquele KPI, mas não muda a meta sozinho. A semana anterior é lida na
   hora, com a janela deslocada 7 dias, e nada é gravado ao abrir a tela.
4. **Given** uma tarefa marcada como feita pela 055, **When** vence a data de reler e a regra da 054 ainda
   dispara, **Then** a tarefa volta ao plano como "ainda dispara", igual ao mapa.

---

### User Story 4 — Plano para qualquer projeto com mapa (Priority: P3)

O mesmo planejador serve para Atma e Sirius, que já têm dados. Nesses projetos, a proposta de meta parte
da leitura atual e do volume do nicho, e o plano começa pelo que a 054 já dispara.

**Why this priority**: a Tape Pro é o primeiro uso. Generalizar é barato se nada for escrito por projeto,
mas não precisa estar pronto para a Tape Pro andar.

**Independent Test**: abrir o plano do Sirius e ver as metas propostas partindo da leitura de hoje, não
de zero.

**Acceptance Scenarios**:

1. **Given** um projeto com mapa e leitura, **When** o dono pede a proposta, **Then** cada meta de demanda
   mostra o ponto de partida lido e a distância até a meta. A demanda desses projetos é a que o hub já tem
   (piso do GSC, 050), sem consulta paga.

---

### Edge Cases

- **Termo semente sem volume** (o Google Ads devolve nulo ou abaixo do mínimo que ele reporta): o termo
  fica no cluster com "volume abaixo do mínimo reportado", não com 0, e não soma na meta.
- **Termo de marca** (tapepro, tape pro): fica fora das metas de demanda, com a mesma lista de exclusão de
  marca que o inventário de termos já usa.
- **Termo de outra intenção** (fita adesiva para consumidor final, quando o foco é B2B): o dono pode tirar
  o termo ou o cluster antes de aprovar. O que sai não entra na meta, e o motivo fica gravado.
- **Consulta de volume que falha ou fica sem saldo**: o plano não é montado com números parciais. A tela
  diz qual consulta falhou e mantém a proposta anterior, se houver.
- **Volume velho** (consulta com mais de 90 dias): a proposta mostra a idade e sugere nova consulta, sem
  consultar sozinha.
- **Meta editada à mão abaixo do ponto de partida**: o hub aceita, mas avisa que a meta já foi atingida.
- **Projeto sem mapa** (como a Tape Pro hoje): o plano não abre sem mapa. A inclusão do projeto no mapa é
  pré-requisito desta feature (FR-001).
- **O prazo passa e a meta não foi atingida**: o plano fecha aquele ciclo com o resultado lido e pede nova
  proposta. A meta antiga fica no histórico, não é sobrescrita.
- **Página criada fora do plano** (post à mão, robô voltando a publicar): ela conta na leitura do mapa. Se
  cobrir um cluster do plano, a tarefa de criação daquele cluster aparece como coberta pela leitura.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A Tape Pro DEVE ganhar mapa antes do plano, entrando na mesma lista que decide quem tem
  corrida de busca e mapa. Nenhuma rota nova de mapa é criada para isso.
- **FR-002**: O plano DEVE partir de termos semente que o hub já declara por projeto (produtos,
  segmentos, foco editorial). O dono pode acrescentar ou tirar termos semente antes da consulta.
- **FR-003**: O volume de busca DEVE ser consultado **só por ação explícita do dono** e gravado com data,
  região, idioma, fonte e custo. Abrir o plano ou o mapa NÃO DEVE consultar volume.
- **FR-003a**: Antes de consultar, o hub DEVE mostrar o número de termos, o custo estimado e o saldo da
  fonte. Com saldo insuficiente, o hub NÃO DEVE consultar e DEVE dizer quanto falta.
- **FR-004**: A região padrão da consulta DEVE ser a que o projeto declara servir (Tape Pro:
  `areaServed: "BR"`, Brasil). O dono pode trocar antes de consultar.
- **FR-005**: Os termos DEVEM ser agrupados em clusters, e cada cluster DEVE mostrar a soma do volume, o
  número de termos e a página do site que o cobre, ou "sem página". O agrupamento DEVE seguir uma regra
  fixa, sem custo e sem variar entre rodadas: o termo entra no cluster do termo semente que ele contém.
  Se contém um produto e um segmento, entra no cluster do produto, marcado com o segmento (candidato a
  página de apoio). Se contém dois produtos, entra no do termo semente mais longo. Se não contém nenhum,
  fica em "sem cluster" até o dono decidir. O dono DEVE poder mover um termo de cluster antes de aprovar,
  e a mudança fica gravada.
- **FR-005a**: Um termo de cluster com volume ≥ **piso de página de apoio** (padrão 100 buscas/mês, selo
  "◇ política do dono, sem fonte", editável) que nenhuma página do site cobre (FR-007b) DEVE virar
  candidato a página de apoio, com o rótulo semente + modificador, na fila por volume depois das páginas
  de cluster, dentro da capacidade (FR-010). Termo marcado com segmento continua candidato pela regra de
  FR-005. Termos que o dono tirou (marca de concorrente, outra intenção) não entram na fila.
- **FR-006**: Cada um dos 18 KPIs DEVE ter exatamente uma meta proposta com uma origem declarada:
  **demanda** (KPIs contados em impressões, cliques, consultas ou termos), **régua publicada** (onde o
  hub já tem régua, a meta é a régua) ou **board** (o resto, com o selo "◇ meta do board, sem fonte").
- **FR-007**: Toda meta com origem na demanda DEVE mostrar a conta: volume do cluster, posição-alvo,
  fração esperada naquela posição e prazo. A fração de clique por posição DEVE ser a mesma régua de CTR
  que o hub já usa para julgar. Nenhum número dessa régua é escrito duas vezes. A posição-alvo é a mesma
  para todos os clusters: **Top 20 no prazo de 90 dias** e **faixa 7–10 no prazo de 180 dias**. A meta
  de clique de 180 dias usa a fração da faixa 7–10. A de 90 dias não conta clique fora da página 1,
  porque não há régua para isso. Uma página que já existe conta como criada na semana 0 só nas condições
  de FR-007a. Quando nenhuma página nova amadurece antes de um prazo, a meta daquele prazo diz isso. A
  folha de striking distance (4–10,9) não recebe meta de demanda, e a projeção de termos na página 1
  (1,0–10,9) ocupa o lugar dela.
- **FR-007a**: Uma página que já cobre um cluster DEVE ser classificada, pela última leitura, em um de
  três estados: **ativa** (indexada e com ≥ 1 impressão na janela do Search Console), **indexada sem
  impressão** ou **fora do índice**. Só a ativa conta como criada na semana 0. A fora do índice gera a
  tarefa **indexação** na semana 1. A indexada sem impressão gera as tarefas de **posição** na semana 1.
  Nesses dois casos, a maturação (FR-013) conta da semana em que a tarefa recebe a marca de feito da 055.
  Enquanto a tarefa não tem marca, a página não amadurece e não entra em nenhum marco. Página sem leitura
  de indexação fica "sem leitura", nunca "ativa", e também gera a tarefa de indexação.
- **FR-007b**: Uma página DEVE contar, nas metas e nos marcos de demanda, só os termos que ela **cobre**:
  todas as palavras do termo aparecem no título ou no H1 dela, lidos no crawl, em qualquer ordem, sem
  acento e sem diferença de caixa. Os demais termos do cluster só contam quando alguma página os cobre.
  A conta de cada meta de demanda DEVE dizer quantos termos e quanto volume cada página cobre.
- **FR-008**: Cada meta DEVE ter prazo, um de dois degraus fixos: 90 ou 180 dias a partir do início do
  plano. O dono muda a data de início, não o degrau.
- **FR-009**: O dono DEVE aprovar, editar ou recusar cada meta separadamente. O hub DEVE gravar quem
  decidiu, quando, o valor proposto e o valor final. Editar uma meta NÃO DEVE apagar o responsável nem o
  histórico das tarefas já ligadas a ela.
- **FR-010**: O plano DEVE ter uma capacidade declarada (páginas novas por semana e quem executa), com
  padrão de 3 por semana. Nenhuma semana DEVE ter mais criação de página do que a capacidade. O plano
  DEVE sugerir aumentar a capacidade só quando a indexação limpa das páginas criadas pelo plano passar de
  90%, e nunca a aumenta sozinho.
- **FR-011**: As tarefas DEVEM seguir a ordem de ataque e as alavancas da 054, sem criar alavanca nova. A
  criação de página de cluster é a alavanca "cobertura", já existente.
- **FR-011a**: A semana corrente DEVE mostrar, junto das tarefas do calendário, os cards que o mapa do
  projeto dispara na leitura atual (regras da 054) e que não têm marca de feito vigente (055). Um card
  com marca some até a data de reler e volta como "ainda dispara" se a regra continuar disparando
  (FR-016). Tarefa do calendário e card com a mesma alavanca viram UMA tarefa, com os alvos e os KPIs dos
  dois. As semanas futuras não projetam card: o mapa só lê o presente. As regras e os textos do card são
  os da 054, sem cópia no plano.
- **FR-012**: Uma tarefa que depende de página (links internos, título, schema, frescor) NÃO DEVE ser
  agendada antes da semana em que a página do cluster nasce.
- **FR-013**: Os marcos semanais DEVEM usar premissas de maturação declaradas na tela (semanas até indexar
  e semanas até a posição estabilizar), com o selo existente "◇ política do dono, sem fonte". O dono pode editar. Nenhum selo novo é criado.
- **FR-014**: Cada tarefa DEVE ter alavanca, alvo, responsável (Jean ou Maria, como na 055), semana e os
  KPIs que ela move, com o marco de cada um.
- **FR-015**: O plano DEVE comparar cada marco vencido com a leitura do mapa e dar um de cinco estados:
  **marco não chegou**, **no marco**, **abaixo do marco**, **acima do marco** ou **sem leitura** (com o
  motivo). "Sem leitura" nunca aparece como "no marco", e nenhum estado usa "ok" ou ✓ (glossário da 055).
- **FR-016**: A marca de feito DEVE ser a da 055, não um mecanismo novo. Tarefa vencida cuja regra ainda
  dispara volta como "ainda dispara".
- **FR-017**: O plano NUNCA DEVE mudar uma meta aprovada sozinho. Refazer a proposta cria uma nova versão
  do plano, e as anteriores ficam legíveis.
- **FR-018**: Com capacidade zero, ou com o prazo impossível na capacidade declarada, o plano DEVE dizer
  isso antes de qualquer tarefa.
- **FR-019**: As regras de proposta e de montagem DEVEM ser as mesmas para todos os projetos. Nenhuma
  regra é escrita por projeto, e o que muda de um projeto para outro são os termos semente, a região e a
  capacidade.
- **FR-020**: O plano DEVE ser legível por teclado e leitor de tela, e nenhum estado pode ser dito só por
  cor.

### Key Entities

- **Consulta de demanda**: uma ida à fonte de volume. Tem projeto, data, região, idioma, fonte, custo e os
  termos com volume mensal. É imutável. Uma nova consulta é uma nova linha.
- **Cluster**: grupo de termos com a mesma intenção. Tem volume somado, termos, a página que o cobre (ou
  nenhuma) e, por termo, a página que cobre aquele termo (FR-007b) ou nenhuma.
- **Meta**: pertence a um KPI e a uma versão do plano. Tem valor, prazo, origem (demanda, régua ou board),
  a conta que a produziu, estado (proposta, aprovada, editada, recusada), quem decidiu e quando.
- **Plano**: versão numerada por projeto. Tem as metas aprovadas, a capacidade declarada, as premissas de
  maturação e as semanas.
- **Tarefa**: uma alavanca da 054 aplicada a um alvo numa semana. Tem responsável, KPIs movidos com o marco
  de cada um e a marca de feito da 055.
- **Marco**: valor esperado de um KPI numa semana, derivado da meta, da capacidade e das premissas.
  Comparado com a leitura do mapa, dá um dos cinco estados de FR-015.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `/gsc/mapa/tapepro` abre, com as 32 folhas mostrando um estado cada (dispara, crítica,
  dentro, não decide ou sem leitura).
- **SC-002**: O plano da Tape Pro mostra 18 de 18 KPIs com meta, prazo e origem declarada. Toda meta com
  origem na demanda mostra a conta até o volume consultado.
- **SC-003**: O dono lê a tarefa da semana atual, o responsável e o marco sem clicar em nada.
- **SC-004**: Nenhuma semana do plano da Tape Pro tem mais páginas novas do que a capacidade declarada, e
  nenhuma tarefa de posição ou snippet vem antes da página do cluster dela. Um teste reprova se isso
  acontecer.
- **SC-005**: Abrir o plano ou o mapa não faz nenhuma consulta de volume. Só a ação explícita do dono faz.
- **SC-006**: Toda meta aprovada tem autor e data, e nenhuma meta aprovada muda sem nova versão do plano.
- **SC-007**: Na primeira comparação semanal depois da aprovação, 100% dos marcos vencidos da Tape Pro
  aparecem com um dos cinco estados de FR-015.
- **SC-008**: Com a leitura de 28/09 da Tape Pro (2 páginas de cluster no ar, 0 impressão desde 07/08),
  a semana 1 do plano tem ao menos uma tarefa, e nenhuma meta de demanda projeta mais termos do que as
  páginas cobrem pelo título ou pelo H1. Um teste com esse cenário reprova "semana vazia" e reprova 100%
  na página 1 com 2 páginas.

## Assumptions

- **Fonte de volume**: Google Ads Search Volume via DataForSEO, a mesma fonte do OpenSEO, que não tem API
  própria. A decisão de 28/09/2026 (opção c) abre exceção **só para o volume de busca** à regra do handoff
  de deixar bases pagas de fora até o portfólio faturar. Backlinks pagos continuam fora. O crédito grátis
  acabou (saldo US$ −0,003 em 28/09), e o dono decidiu recarregar US$ 50, a recarga mínima. Cada consulta
  custa em torno de US$ 0,05 a 0,09, com até 1.000 termos por requisição, então a recarga cobre centenas
  de propostas.
- A inspeção de URL (`/api/indexacao`) hoje grava só a contagem por projeto e dia (`hub_indexacao`).
  FR-007a precisa do veredito por URL, e guardá-lo é tarefa do plano de implementação. A impressão por
  página vem da leitura do Search Console por página que o mapa já faz.
- A chave da DataForSEO hoje mora no `.env` do OpenSEO local. Levá-la para o ambiente do hub é tarefa do
  plano de implementação, seguindo o Princípio V (validar na entrada, `503` só com o nome da variável).
- A Tape Pro é B2B nacional (`areaServed: "BR"`, foco "comprador e distribuidor, não consumidor final").
  Termos de consumidor final são candidatos a sair antes da aprovação.
- A fração de visibilidade por posição usa a régua de CTR do hub (`lib/kpis-busca.mjs#BENCHMARK`). Ela
  cobra menos que a tabela do board, e a meta sai conservadora de propósito.
- As premissas de maturação começam como estimativa do dono, com o selo "◇ política do dono, sem fonte", e são refinadas com o
  que a própria Tape Pro medir. O plano não finge que elas têm fonte.
- O robô de autopublicação está parado desde 29/07. A capacidade inicial da Tape Pro é de 3 páginas por
  semana à mão (clarificação de 28/09). Religar o robô não faz parte desta spec. Se ele voltar, as
  páginas dele contam na leitura, mas não na capacidade do plano.
- O hub planeja e acompanha, mas não executa: nenhum site é alterado por esta feature.

## Fora do escopo

- **GEO e AIO** (citação por IA, visibilidade em LLM, AI Overview, AI Mode): spec separada, que começa
  pelo instrumento de medição.
- A parte de **conversão do SXO** (CRO, orçamento enviado, venda): é a cadeia depois do clique, que já
  tem casa em `/okr/{slug}`.
- Religar ou consertar o autopublishing da Tape Pro.
- Coletores novos para as folhas sem coletor (reescrita do título, cobertura semântica, domínios
  referenciadores).
- Abrir tarefa na agenda do hub a partir do plano.
