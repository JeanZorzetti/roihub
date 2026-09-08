# Feature Specification: Medidores de Entrega — os Core Web Vitals de campo da Atma

**Feature Branch**: `023-medidores-de-entrega`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "a spec 023 que você citou no handoff — Core Web Vitals — para a
Atma"

## Contexto

A ficha da Atma **já declara** a família de causa **D2 — "Entrega: a página chega inteira?"**, e
`MEDIDORES.D2` em `lib/ficha.mjs` lista oito medidores: `lcp`, `inp`, `cls`, `ttfb`, `uptime`,
`taxa-5xx`, `build`, `certificado`.

> **Correção de 07/09 (decisão [D11](./research.md), achada na análise cruzada).** Esta seção
> afirmava que "qualquer KR pode apontar para `n5:lcp` hoje e a chave é válida". **É falso**: o
> espaço de chaves de `n5:` é montado só a partir da família **exibida**
> (`lib/ficha.mjs:667`), e a família D2 **nunca é escolhida** — nenhum perfil declara
> `familia: "D2"` e todos os caminhos de `escolherFamilia()` devolvem D1, D3 ou D4. Hoje
> `n5:lcp` sai como `chave-invalida`, e a família de Entrega, declarada desde a 011, nunca teve
> como aparecer na tela. A D11 conserta isso e é o que torna a FR-002 observável.

**Nenhum dos oito é apurado.** `montarN5()` devolve, para cada um,
`naoApurada("sem coletor nesta requisição", "apuração manual de <id>")`. A família inteira é uma
promessa que a tela faz e não cumpre — o mesmo estado em que os medidores D3 estavam antes da
spec 014 ligá-los ao GA4.

Esta feature liga **quatro dos oito** (`lcp`, `inp`, `cls`, `ttfb`) a dados de campo, e com isso
fecha o grupo 1 do checklist do board:

| Medida do board | Meta | Hoje |
|---|---|---|
| LCP (Largest Contentful Paint) | ≤ 2,5s no p75 | "sem coletor nesta requisição" |
| INP (Interaction to Next Paint) | ≤ 200ms no p75 | idem |
| CLS (Cumulative Layout Shift) | ≤ 0,1 no p75 | idem |
| TTFB (Time to First Byte) | ≤ 600ms, ideal < 300ms | idem |
| Core Web Vitals Pass Rate | ≥ 90% das URLs prioritárias com "Bom" | idem |

Os outros quatro medidores de D2 (`uptime`, `taxa-5xx`, `build`, `certificado`) **não estão no
board** e ficam fora desta spec — continuam dizendo, honestamente, que não têm coletor.

**Escopo: só a Atma.** As corridas de busca percorrem `projetosDeBusca()`
(`SLUGS_DE_BUSCA = ["atma"]`), e esta nasce com o filtro em vez de recebê-lo depois, como
aconteceu com a 021 e a 022.

## Por que dado de CAMPO, e não Lighthouse

O board pede "no 75º percentil" e "90% das URLs com status Bom no relatório do GSC". As duas
coisas são, por definição, **de campo**: percentil exige uma distribuição de visitas reais, que
uma execução de laboratório não tem.

E a casa já pagou por isso duas vezes: `lighthouse_local_windows_onedrive_unreliable` mede ±30%
de variação nesta máquina, e `goiania_lcp_root_causes` registra que **uma leitura de PageSpeed
não decide nada**. Um número de laboratório colocado na ficha como se fosse o desempenho do site
seria pior que a ausência atual — teria a autoridade de um medidor apurado e a estabilidade de
um dado que muda a cada execução.

## ⚠️ A restrição que molda esta spec

**Dado de campo só existe onde há visitantes suficientes.** A fonte não responde para uma URL
com pouco tráfego — e isso **não é lentidão, nem velocidade: é ausência de observação**.

Isso importa muito aqui porque a Atma é, medida pela 021, **um site de uma página só**: 8 URLs
com impressão em 28 dias, e uma delas (`/blog/quanto-custa-alinhador-invisivel`) com 13.262 das
impressões — o que `atma_uma_pagina_uma_query_de_preco` já registrava. A expectativa realista é
que a **origem** tenha dado e que **quase nenhuma URL individual** tenha.

Consequência direta: o **Pass Rate por URL prioritária, que o board pede, pode ser não apurável
na Atma** — não por defeito da feature, mas porque o site não tem tráfego distribuído o
bastante. A tela precisa dizer isso, e não fabricar um denominador de uma URL só.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Os quatro medidores de Entrega deixam de mentir por omissão (Priority: P1)

Quem abre a ficha da Atma e desce até N5, na família Entrega, vê LCP, INP, CLS e TTFB com o valor
de campo do site e a comparação com a meta do board — em vez de quatro linhas dizendo "sem
coletor nesta requisição".

**Why this priority**: é a feature inteira. A família D2 existe na tela desde a 011 e nunca teve
um número; qualquer KR que aponte para `n5:lcp` hoje é inverificável.

**Independent Test**: abrir a ficha da Atma e conferir que os quatro medidores exibem valor com
unidade e a meta ao lado; e que um medidor sem dado na fonte exibe **o motivo**, nunca zero.

**Acceptance Scenarios**:

1. **Given** que a fonte tem dado de campo para a origem da Atma, **When** a ficha carrega,
   **Then** LCP, INP, CLS e TTFB aparecem no percentil 75 com a meta do board ao lado.
2. **Given** que a fonte não tem amostra suficiente para uma métrica, **When** a ficha carrega,
   **Then** aquele medidor diz **"sem amostra suficiente na fonte"** — e não 0, não "bom", não
   "ruim".
3. **Given** que a fonte está fora do ar, **When** a ficha carrega, **Then** o medidor diz que a
   apuração falhou agora — distinto de "não há dado".
4. **Given** um valor apurado, **When** ele é exibido, **Then** a tela declara que é **p75 de
   campo** e qual janela a fonte cobre.

---

### User Story 2 - Passa ou não passa, contra a meta do board (Priority: P2)

Cada medidor aparece classificado contra o limite do board — LCP ≤ 2,5s, INP ≤ 200ms, CLS ≤ 0,1,
TTFB ≤ 600ms — para que a leitura não exija lembrar cinco números de cabeça.

**Why this priority**: sai da mesma leitura da US1, sem chamada nova. Sem a classificação, o
valor cru obriga quem lê a saber os limites; com ela, a família Entrega responde "a página chega
inteira?" em um olhar, que é a pergunta que o nível N5 faz.

**Independent Test**: conferir que um LCP de 2,4s é classificado como dentro da meta e um de 2,6s
como fora, e que TTFB exibe os dois limites do board (600ms e o ideal de 300ms).

**Acceptance Scenarios**:

1. **Given** os quatro valores apurados, **When** a ficha carrega, **Then** cada um aparece
   marcado como dentro ou fora da meta do board.
2. **Given** um medidor sem dado, **When** a ficha carrega, **Then** ele **não** é classificado —
   ausência não é reprovação nem aprovação.

---

### User Story 3 - O Pass Rate, ou o motivo honesto de não haver um (Priority: P3)

O board pede que 90% das URLs prioritárias tenham status "Bom". A tela mostra essa fração quando
houver URLs com dado suficiente — e, quando não houver, diz **quantas URLs tinham dado de campo**
e por que a fração não pode ser calculada.

**Why this priority**: é a medida mais provável de sair não apurável na Atma, e a que mais
facilmente viraria um número inventado. Fica por último porque depende das duas anteriores e
porque o valor dela aqui é, provavelmente, a explicação — não o número.

**Independent Test**: conferir que a fração só aparece quando há mais de uma URL com dado, e que
o caso de uma URL só produz a explicação, não "100%".

**Acceptance Scenarios**:

1. **Given** URLs com dado de campo suficiente, **When** a ficha carrega, **Then** a fração das
   que passam nos três vitais aparece contra a meta de 90%.
2. **Given** que só a origem tem dado e nenhuma URL individual tem, **When** a ficha carrega,
   **Then** a tela diz que o Pass Rate por URL não é apurável neste site e explica que a fonte
   exige tráfego por URL — **nunca** exibe 100% por ter uma amostra de um.

---

### Edge Cases

- **A fonte não tem amostra para a origem inteira.** Improvável na Atma, que tem tráfego, mas o
  caso existe e não pode virar zero.
- **Dado de origem versus dado de URL são coisas diferentes** e não se misturam numa média: a
  origem é a distribuição de todas as visitas do site, a URL é a daquela página. Exibir um no
  lugar do outro sem dizer qual é seria a confusão de denominador que a 022 já enfrentou.
- **TTFB pode ser servido como métrica experimental pela fonte**, sujeita a mudar ou sumir. Um
  medidor experimental precisa ser rotulado como tal, e o desaparecimento dele não pode derrubar
  os outros três.
- **A janela da fonte é dela, não nossa.** O dado de campo cobre um período próprio (tipicamente
  28 dias corridos) que não é a janela de descoberta da ficha. Rotular um pelo outro é a mesma
  mentira de janela que a FR-027 da 019 proíbe.
- **CLS não tem unidade de tempo.** É um índice adimensional, e formatá-lo como "0,1s" seria
  errado.
- **Um site rápido no desktop e lento no celular** aparece como média morna no agregado. A tela
  precisa declarar qual recorte de dispositivo está exibindo.
- **A chave de API ausente** deve produzir "não configurado", com o nome da variável, e não
  falha silenciosa nem "site sem dados".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST obter, para a origem do projeto, os valores de campo no percentil 75
  de LCP, INP, CLS e TTFB.
- **FR-002**: Os quatro medidores MUST aparecer na família D2 do N5 da ficha, substituindo o
  estado "sem coletor nesta requisição".
- **FR-002a**: A família de Entrega MUST ser exibida no N5 **sempre que houver medida de Entrega
  para o projeto**, independentemente de qual família a cadeia elegeu como gargalo — Entrega é
  pré-condição, não degrau de funil. Projeto **sem** medida de Entrega MUST NOT ganhar o bloco:
  oito linhas permanentes de "não apurado" são ruído com cara de pendência.
- **FR-002b**: Quando o N5 exibir duas famílias, a tela MUST declarar qual delas é o gargalo da
  cadeia e por que a outra está ali.
- **FR-003**: O sistema MUST distinguir três estados por medidor: **apurado**, **sem amostra
  suficiente na fonte** e **falhou agora** — nunca colapsando os dois últimos.
- **FR-004**: Nenhum medidor sem dado MUST ser exibido como zero, como aprovado ou como
  reprovado.
- **FR-005**: Cada valor exibido MUST declarar que é percentil 75 de campo e qual janela a fonte
  cobre.
- **FR-006**: Cada medidor apurado MUST ser classificado contra a meta do board: LCP ≤ 2,5s,
  INP ≤ 200ms, CLS ≤ 0,1, TTFB ≤ 600ms.
- **FR-007**: O TTFB MUST exibir também o alvo ideal de 300ms do board, distinto do limite de
  600ms.
- **FR-008**: O sistema MUST rotular como **experimental** qualquer métrica que a fonte sirva
  como tal, e a ausência de uma métrica experimental MUST NOT impedir a exibição das demais.
- **FR-009**: O Pass Rate MUST ser exibido apenas quando houver mais de uma URL com dado de
  campo; caso contrário a tela MUST explicar por que não é apurável.
- **FR-010**: A tela MUST declarar o recorte de dispositivo do dado exibido.
- **FR-011**: Ausência da credencial de acesso à fonte MUST produzir um estado "não configurado"
  que nomeia **apenas** a variável ausente, nunca o valor.
- **FR-012**: A falha da apuração de Entrega MUST NOT derrubar o restante da ficha.
- **FR-013**: O CLS MUST ser formatado como índice adimensional, sem unidade de tempo.
- **FR-014**: A coleta MUST percorrer apenas os projetos de `projetosDeBusca()`.

### Key Entities

- **Medida de campo**: um vital (LCP, INP, CLS ou TTFB) de um alvo (a origem ou uma URL), com o
  valor no percentil 75, a janela que a fonte cobre e o recorte de dispositivo.
- **Alvo**: a origem do site ou uma URL específica. São escopos diferentes de medição e nunca se
  somam.
- **Veredito de meta**: a comparação de uma medida com o limite do board — dentro, fora, ou
  ausente por falta de amostra.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 5 medidas do board saem de ausentes para exibidas ou explicadas — o placar vai de
  11 para 16 de 28.
- **SC-002**: A família D2 da ficha da Atma deixa de ter 4 de 8 medidores dizendo "sem coletor
  nesta requisição".
- **SC-003**: Nenhum valor de laboratório aparece na ficha; 100% dos números exibidos são de
  campo, e a tela diz isso.
- **SC-004**: Zero medidores exibidos como 0 por falta de amostra.
- **SC-005**: Quem abre a ficha consegue dizer, sem consultar o board, se cada vital está dentro
  ou fora da meta.
- **SC-006**: Quando o Pass Rate não for apurável, a tela explica o motivo em uma frase — e quem
  lê entende que é característica do site, não defeito do hub.

## Assumptions

- **A fonte é a CrUX API do Google** (dado de campo do Chrome, percentil 75 nativo, cota gratuita
  com chave do Google Cloud). É a única fonte de campo gratuita que serve p75 por origem e por
  URL. A cota e os limites **devem ser confirmados na primeira corrida**, como a 022 fez com a
  quota da URL Inspection — número de documentação não é número medido.
- **Uma credencial nova** (`CRUX_API_KEY`) entra no `.env` e no `.env.example`. É a primeira
  fonte desta série de specs que não reusa a credencial do Search Console.
- **Recorte de dispositivo agregado** (todos) na primeira versão, declarado na tela. Separar
  celular de desktop é uma chamada a mais e entra quando o agregado esconder alguma coisa — não
  por antecipação.
- **O histórico NÃO precisa ser acumulado por esta spec.** Diferente da 021, onde gravar era
  urgente porque o dia não gravado não voltava, a fonte de campo **serve o próprio histórico**
  (p75 semanal dos últimos meses). Gravar aqui seria cache, não calendário — e por isso fica
  fora do escopo até haver uma razão medida para ter.
- Reusa o padrão de corrida das 021/022 (cron dispara endpoint autenticado, trabalho no servidor,
  escrita idempotente) **se** a apuração for gravada; se for lida no render, segue o padrão de
  `gscConsultas` na aba. A escolha entre as duas é decisão de plano, não de spec.
- A ficha continua na janela curta; esta spec não move janela de nada.

## Out of Scope

- **Os outros quatro medidores de D2** (`uptime`, `taxa-5xx`, `build`, `certificado`): não estão
  no board. `certificado` já é verificado pelo check `VER-01` da conformidade, sem estar ligado à
  ficha — candidato barato a uma spec futura, pelo mesmo padrão de "já existe e não está ligado".
- **Consertar** qualquer vital. Esta feature mede. O que fazer com um LCP ruim é decisão
  editorial e técnica, e `goiania_lcp_root_causes` já mostra que a causa raiz não sai de um
  número só.
- **Dados de laboratório** (PageSpeed Insights, Lighthouse): rejeitados pelo motivo na seção "Por
  que dado de CAMPO".
- **Alertas ou metas móveis**: a tela compara com o limite fixo do board e para aí.
