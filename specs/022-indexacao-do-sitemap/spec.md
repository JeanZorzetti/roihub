# Feature Specification: Indexação do sitemap — quanto do que o site declara está no índice

**Feature Branch**: `022-indexacao-do-sitemap`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "Indexação: quantas das URLs que o site declara no sitemap estão de
fato no índice do Google. Liga `lib/indexacao.mjs` ao sitemap de cada projeto, grava o resultado e
mostra na aba de aquisição. Destrava 4 medidas do board. Quota da API é ~2000 inspeções/dia por
propriedade, então site grande exige amostra DECLARADA na tela."

## Contexto

O board de OKR pede quatro medidas que dependem todas do mesmo número ausente — **quantas URLs do
site estão no índice do Google**:

| Medida do board | Hoje |
|---|---|
| Taxa de Indexação Limpa (Sitemap Indexation Ratio), meta 95% | não existe |
| Taxa de Rejeição de Rastreio ("rastreada/descoberta, não indexada"), meta < 5% | não existe |
| Active Index Ratio (grupo IMPRESSÕES-4), meta ≥ 70% | exibido como **contagem**, sem denominador |
| Query-to-Page Ratio (IMPRESSÕES-3) | não existe, falta o mesmo denominador |

`lib/indexacao.mjs` **já fala com a URL Inspection API** e já devolve `verdict`, `coverageState` e
`lastCrawlTime`, já distinguindo "sem propriedade no GSC" de "não indexada". Ele tem dois
consumidores hoje — um script de linha de comando e o apurador de `D-84` — e **nenhuma tela**.
Esta feature não constrói coleta: liga o que existe ao sitemap de cada projeto e grava.

`lib/conformidade.mjs` já sabe achar o sitemap (`urlDoSitemap` a partir do `robots.txt`),
reconhecer XML de HTML servido por catch-all (`julgarSitemap`), extrair `<loc>` e **descer um
nível quando o arquivo é um `<sitemapindex>`**. O que falta é reunir isso em uma leitura completa
da lista, em vez do primeiro item.

## ⚠️ A restrição que molda a feature inteira

A quota da URL Inspection API é de **~2.000 inspeções por dia por propriedade** — e
**21 dos 35 projetos são subdomínios de `roilabs.com.br`**, todos resolvidos para a mesma
propriedade `sc-domain:roilabs.com.br`. Os 21 **dividem a mesma quota**, não têm 2.000 cada.

Isso torna impossível inspecionar todo sitemap de todo projeto todo dia, e força duas coisas:
**rodízio** entre projetos e **amostra declarada** na tela. Um número que cobre 200 de 1.200 URLs
e se apresenta como "a taxa de indexação do site" é a armadilha que este projeto já pagou em
`amostra_procurada_fora_do_percentual` e `zero_na_janela_nao_e_zero_no_mundo`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Que fatia do que o site declara está no índice (Priority: P1)

Ao abrir a aba de aquisição de um projeto, aparece quantas URLs o site declara no sitemap,
quantas foram inspecionadas, e que fatia dessas está no índice do Google — com a data da
inspeção e o tamanho da amostra ditos na própria frase, não em nota de rodapé.

**Why this priority**: é o denominador que faltava. Sem ele, três outras medidas do board ficam
sem razão e a aba exibe contagem onde deveria exibir fração.

**Independent Test**: rodar a corrida para um projeto com sitemap conhecido e conferir que o
total declarado bate com o número de `<loc>` do arquivo, e que a fração exibida é
`indexadas ÷ inspecionadas` — nunca `indexadas ÷ declaradas` quando houve amostra.

**Acceptance Scenarios**:

1. **Given** um projeto cujo sitemap declara 40 URLs e todas foram inspecionadas, **When** a aba
   carrega, **Then** aparece a fração indexada sobre 40, sem rótulo de amostra.
2. **Given** um projeto cujo sitemap declara 1.200 URLs e 200 foram inspecionadas, **When** a aba
   carrega, **Then** a tela diz **explicitamente** que 200 de 1.200 foram inspecionadas e que a
   fração vale para a amostra, não para o site.
3. **Given** um projeto sem sitemap alcançável, **When** a aba carrega, **Then** diz que não há
   sitemap — e **não** exibe 0% de indexação.
4. **Given** um projeto cujo host está fora de toda propriedade do GSC, **When** a aba carrega,
   **Then** diz "não há onde olhar" e aponta domínio próprio como o passo — **não** "não
   indexado".

---

### User Story 2 - O que o Google leu e recusou (Priority: P2)

A tela separa as URLs não indexadas pelo motivo que o Google dá: "rastreada, mas não indexada"
(ele leu e recusou), "descoberta, mas não indexada" (ele nem leu), e as demais. O board pede que
a soma das duas primeiras fique abaixo de 5% do inventário.

**Why this priority**: sai da mesma inspeção da US1, sem uma requisição a mais, e é o que separa
trabalho técnico de trabalho editorial. `D-84` já mostrou que as classes têm prognósticos
incompatíveis — "rastreada e não indexada" significa que o Googlebot leu o conteúdo e recusou, e
**nenhum conserto técnico move isso**.

**Independent Test**: conferir que uma URL com `coverageState` "Crawled - currently not indexed"
cai no balde de rejeição e uma "Submitted and indexed" não.

**Acceptance Scenarios**:

1. **Given** URLs inspecionadas com motivos diferentes, **When** a aba carrega, **Then** cada
   motivo aparece com sua contagem e a taxa de rejeição de rastreio é exibida contra a meta de 5%.
2. **Given** que "rastreada e não indexada" e "descoberta e não indexada" têm consertos
   diferentes, **When** a tela os exibe, **Then** eles aparecem **separados**, nunca somados num
   único balde de "não indexadas".

---

### User Story 3 - Os dois KPIs que estavam capados passam a ter razão (Priority: P3)

Com o total de URLs indexadas disponível, o Active Index Ratio deixa de ser contagem e vira a
razão que o board pede, e o Query-to-Page Ratio passa a existir.

**Why this priority**: é consequência da US1, não trabalho novo de coleta. Fica depois porque
depende dela e porque os dois números só fazem sentido com o denominador já na tela.

**Independent Test**: conferir que o Active Index Ratio exibido é `URLs com ao menos uma
impressão ÷ URLs indexadas` e que ele desaparece (com motivo) quando o denominador não foi
apurado.

**Acceptance Scenarios**:

1. **Given** um projeto com indexação apurada, **When** a aba carrega, **Then** o Active Index
   Ratio aparece como fração contra a meta de 70% do board, e o Query-to-Page Ratio contra as
   faixas do board (artigo 30-80, produto 10-25 consultas por URL).
2. **Given** um projeto cuja indexação ainda não foi apurada, **When** a aba carrega, **Then** os
   dois voltam a exibir a contagem de hoje com o motivo do denominador ausente — nunca uma razão
   com denominador chutado.

---

### Edge Cases

- **A quota é compartilhada por 21 projetos.** Uma corrida que peça o sitemap inteiro de todos
  estoura a cota da propriedade e as últimas inspeções falham — produzindo "não indexadas" que
  são, na verdade, "não perguntadas". Esse é o pior modo de falha desta feature: **erro de quota
  jamais pode ser gravado como não-indexação.**
- **`<sitemapindex>` aninhado**: o arquivo lista sitemaps, não páginas. Ler só o primeiro filho
  subconta o site — o check `VER-04` já desce um nível, mas para um item só.
- **Sitemap que responde 200 com HTML** (catch-all servindo `index.html`): não é um sitemap
  vazio, é a ausência de sitemap. `julgarSitemap` já sabe distinguir.
- **URL declarada no sitemap que responde 404**: continua contando no denominador do que o site
  *declara* — e é justamente um achado, não um erro de medição.
- **Sitemap com mais URLs do que a quota diária inteira**: a amostra tem que ser **estável entre
  corridas**, senão a fração oscila por troca de amostra e parece movimento do site.
- **Projeto sem `robots.txt`**: o sitemap ainda pode existir no caminho convencional.
- **A API é somente leitura.** Não existe "solicitar indexação" programático; esse passo é manual
  na UI do Search Console, e a tela não deve sugerir o contrário.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST descobrir a lista de URLs que cada projeto declara, a partir do
  sitemap anunciado no `robots.txt` e, na ausência dele, do caminho convencional.
- **FR-002**: O sistema MUST percorrer **todos** os sitemaps filhos quando o arquivo for um
  índice de sitemaps, não apenas o primeiro.
- **FR-003**: O sistema MUST distinguir "sitemap ausente ou inválido" de "sitemap com zero URLs".
- **FR-004**: O sistema MUST inspecionar o estado de indexação das URLs e registrar, por URL, o
  veredito, o motivo de cobertura e a data do último rastreio.
- **FR-005**: O sistema MUST respeitar um orçamento de inspeções **por propriedade**, não por
  projeto, e MUST distribuir esse orçamento entre os projetos que compartilham a propriedade.
- **FR-006**: Quando o inventário de um projeto excede o orçamento, o sistema MUST inspecionar
  uma amostra **estável entre corridas** e MUST registrar o tamanho da amostra e o total
  declarado.
- **FR-007**: A tela MUST declarar, junto do número, quantas URLs foram inspecionadas de quantas
  declaradas, sempre que houver amostragem.
- **FR-008**: Falha de inspeção (erro de rede, erro de quota) MUST ser registrada como **falha**
  e MUST ficar fora do numerador e do denominador da taxa — nunca contada como não indexada.
- **FR-009**: O sistema MUST separar os motivos de não-indexação em classes distintas, no mínimo
  "rastreada, não indexada", "descoberta, não indexada" e as demais.
- **FR-010**: A tela MUST exibir a taxa de rejeição de rastreio contra a meta de 5% e a taxa de
  indexação contra a meta de 95%.
- **FR-011**: O Active Index Ratio MUST passar a ser exibido como razão quando o denominador
  existir, e MUST voltar à contagem, com o motivo, quando não existir.
- **FR-012**: O Query-to-Page Ratio MUST ser exibido contra as faixas do board (30-80 para
  artigo/blog, 10-25 para produto/landing) apenas quando o denominador existir.
- **FR-013**: A corrida MUST prosseguir para os demais projetos quando um projeto falha, sem
  derrubar a corrida inteira.
- **FR-014**: A leitura na tela MUST trazer a data da apuração — um inventário de indexação de
  semanas atrás não pode se apresentar como o estado de hoje.
- **FR-015**: O sistema MUST registrar quando um projeto foi pulado por esgotamento de orçamento,
  de forma distinguível de "apurado e deu zero".

### Key Entities

- **URL declarada**: uma entrada do sitemap de um projeto, com o estado que o Search Console
  reportou (indexada, rastreada e recusada, descoberta e não lida, outra, ou falha) e a data do
  último rastreio.
- **Apuração de indexação**: a corrida de um projeto num dia — total declarado, total
  inspecionado, e a data. É o que permite dizer "200 de 1.200" com honestidade.
- **Orçamento de propriedade**: o teto de inspeções que uma propriedade do Search Console aceita
  por dia, dividido entre os projetos que a compartilham.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 4 medidas do board saem de ausentes/capadas para exibidas — o placar do board vai
  de 7 para 11 de 28.
- **SC-002**: Nenhuma taxa é exibida sem que o tamanho da amostra e o total declarado estejam na
  mesma frase, quando houver amostragem.
- **SC-003**: Uma corrida completa não excede o orçamento de nenhuma propriedade, e isso é
  verificável na saída da corrida.
- **SC-004**: Duas corridas seguidas do mesmo projeto, sem mudança no site, produzem o mesmo
  conjunto amostrado — a fração não se move por troca de amostra.
- **SC-005**: Zero URLs com falha de inspeção contadas como não indexadas.
- **SC-006**: Quem abre a aba consegue dizer, em menos de 30 segundos, se o problema do projeto é
  "o Google não conhece as páginas" ou "o Google conhece e recusou" — hoje as duas coisas são
  invisíveis.

## Assumptions

- **Rodízio entre projetos**, no padrão que o autopublishing já usa (a fila gira um passo por dia
  para o limite não cair sempre no mesmo projeto). A alternativa — todos os projetos todo dia —
  é impossível dentro da quota compartilhada por 21 subdomínios.
- **Cadência semanal por projeto** é suficiente: indexação se move em dias e semanas, não em
  horas, e a aba de aquisição já é declaradamente de leitura trimestral. Uma corrida diária dos
  mesmos projetos gastaria a quota para observar ruído.
- **A amostra, quando necessária, segue a ordem do próprio sitemap** — que é a prioridade que o
  site declara. Amostra aleatória oscilaria entre corridas e violaria a SC-004.
- Reusa `lib/indexacao.mjs` e as funções de sitemap de `lib/conformidade.mjs`. Nenhuma
  credencial nova: a mesma do Search Console que a 021 já usa.
- Reusa o padrão de corrida da 021 (cron dispara endpoint autenticado, trabalho no servidor,
  escrita idempotente), fora das janelas do Princípio IV.
- Os projetos considerados são os mesmos que `listProjects()` devolve com `url`.
- O número "~2.000 inspeções/dia por propriedade" é a cota pública documentada pelo Google e
  **deve ser confirmada contra o comportamento real na primeira corrida** — a feature trata o
  teto como configurável, não como constante de fé.

## Out of Scope

- **Solicitar indexação**: a API é somente leitura; esse passo é manual na UI do Search Console.
- **Descobrir URLs fora do sitemap**: o denominador desta feature é o que o site *declara*.
  Páginas órfãs são um problema real e ficam para a spec do crawl (024).
- **Corrigir** qualquer uma das causas de não-indexação. Esta feature mede.
