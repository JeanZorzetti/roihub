# Feature Specification: Vitais de campo próprios (RUM) para quem a CrUX não mede

**Feature Branch**: `056-vitais-rum-proprio`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: *"Crie o coletor desses dados faltantes"* (26/09/2026, sobre o degrau
"2 · Desempenho · abaixo do limite atrapalha; acima dele, não rende mais" de `/gsc/mapa/sirius`).
Entre RUM próprio e só registrar a espera, o dono escolheu **RUM próprio**. Entre o RUM disparar a
régua e só informar, escolheu **disparar, com ressalva**.

## O fato que abre esta spec

Lido em 26/09/2026 no mapa do Sirius em produção:

1. **O degrau 2 inteiro está sem leitura.** A linha diz "∅ sem ação · 5 folhas sem leitura: LCP, INP,
   CLS e TTFB (a origem não tem visita suficiente na CrUX); % de URLs com status Bom (0 de 10 URLs
   prioritárias com os três vitais na CrUX)". A CrUX responde 404 para `siriuscrm.com.br` e para as
   10 URLs de maior impressão.
2. **O motivo é o tamanho do site, e ele não muda sozinho tão cedo.** O Search Console contou 56
   cliques em 27/08 → 23/09. A CrUX só publica uma origem depois de um limiar de tráfego que ela não
   divulga. Sem outra fonte, o degrau 2 do Sirius fica vazio por tempo indeterminado, e o dono não
   sabe se a velocidade do site atrapalha o ranking.
3. **Laboratório continua recusado.** A 023 (SC-003) proíbe número de PageSpeed ou Lighthouse em
   tela, e o motivo segue valendo: a régua é p75 **de campo**, percentil exige visitas reais, e a
   casa já mediu ±30% de variação em laboratório nesta máquina. A 055 deixou "trazer leitura para os
   vitais do Sirius" fora do escopo por ser fato da origem. Esta spec traz a leitura com uma fonte de
   campo que a casa controla.

## Clarifications

### Session 2026-09-26

- Q: Qual coletor de campo? → A: RUM próprio. As páginas públicas do projeto medem os vitais de cada
  visita e mandam a medida ao hub, que guarda e calcula o p75 de 28 dias.
- Q: O RUM dispara a régua ◆ como a CrUX? → A: Dispara, com a ressalva "RUM próprio" e o número de
  visitas, e só quando a amostra decide (FR-008).
- Q: O "n mínimo de visitas" é um número fixo? → A: Não. É o intervalo de confiança da própria
  amostra, o método da 033. p75 acima do limite é o mesmo que mais de 25% das visitas acima do
  limite; a regra dispara quando o intervalo de 95% dessa fração fica inteiro acima de 25%, fica
  dentro quando fica inteiro abaixo, e não decide no resto. O piso fixo de 100 impressões foi
  aposentado pela 033 pelo mesmo motivo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Cada visita às páginas públicas do Sirius vira medida no hub (Priority: P1)

Um visitante abre uma página pública do Sirius (home, preço, blog, calculadoras) e sai. O navegador
dele mede LCP, CLS e TTFB, e o INP quando ele clicou ou digitou, e manda as medidas ao hub. O hub
grava uma medida por métrica e por visita, com o host, o caminho e a hora, e nada que identifique o
visitante.

**Why this priority**: sem medida gravada não há o que ler. É a parte que o CrUX faz para os sites
grandes e que falta para o Sirius.

**Independent Test**: abrir uma página pública do Sirius num navegador, clicar em algo, trocar de aba.
Em até um minuto o hub tem uma medida nova de cada vital para aquele host e caminho.

**Acceptance Scenarios**:

1. **Given** uma página pública do Sirius, **When** um visitante a abre e sai, **Then** o hub grava uma
   medida de LCP, uma de CLS e uma de TTFB para aquele caminho, e uma de INP se houve interação.
2. **Given** a mesma visita, **When** a medida é gravada, **Then** ela não contém endereço IP, cookie,
   identificador de visitante nem os parâmetros da URL (`?` e `#`).
3. **Given** uma página da área logada do Sirius, **When** alguém a usa, **Then** nenhuma medida sai:
   o Google não ranqueia a área logada, e misturá-la mudaria o p75 do site que ranqueia.

---

### User Story 2 — O degrau 2 do mapa lê o RUM quando a CrUX não tem amostra (Priority: P1)

O dono abre `/gsc/mapa/sirius`. As folhas LCP, INP, CLS e TTFB mostram o p75 de 28 dias do RUM
próprio, com o número de visitas e a janela, e dizem que a fonte é o RUM próprio e não a CrUX. Quando
a amostra decide que o p75 passa do limite, a regra dispara "corrigir os vitais" com a ressalva "RUM
próprio · n visitas". Quando a amostra não decide, a folha diz isso e mostra o n.

**Why this priority**: é o pedido. O coletor só vale quando o número chega à tela que decide o
trabalho.

**Independent Test**: com medidas gravadas para o Sirius, abrir o mapa e ler, em cada uma das quatro
folhas de vital, um de três resultados: medido com veredito, "não decide" com o n, ou "sem visita
registrada". Nenhuma diz mais "a origem não tem visita suficiente na CrUX" como motivo final.

**Acceptance Scenarios**:

1. **Given** a CrUX sem amostra para o vital em todas as origens declaradas e o RUM com amostra que
   decide "acima do limite", **When** o mapa monta, **Then** a folha mostra o p75, o n, a janela, a
   fonte "RUM próprio", e a regra dispara com a ressalva.
2. **Given** o mesmo, com amostra que decide "dentro", **When** o mapa monta, **Then** a folha mostra o
   p75 e o n, e a regra não dispara.
3. **Given** o mesmo, com amostra que não decide, **When** o mapa monta, **Then** a folha diz "◐ sem
   ação · a amostra não decide" com o n e a fração de visitas acima do limite.
4. **Given** a CrUX com amostra para o vital, **When** o mapa monta, **Then** a folha continua lendo a
   CrUX, exatamente como hoje, e o RUM não aparece no lugar dela.
5. **Given** a CrUX falhando agora (erro, não 404) ou sem chave, **When** o mapa monta, **Then** a folha
   continua dizendo que a CrUX falhou ou está sem chave: falha não é ausência de amostra, e trocar de
   fonte num dia de falha mudaria o instrumento sem ninguém ver.
6. **Given** a folha "% de URLs com status Bom" e as URLs prioritárias sem amostra na CrUX, **When** o
   mapa monta, **Then** cada URL recebe o veredito do RUM nos três vitais (LCP, INP, CLS), e a fração
   só aparece quando pelo menos duas URLs estão decididas; senão a folha diz quantas estão decididas
   e por que as outras não estão.

---

### User Story 3 — Só visita real do projeto entra na amostra (Priority: P2)

O endpoint que recebe as medidas é aberto: o navegador do visitante não tem senha. O hub aceita só
medida vinda de um host declarado de um projeto no escopo de campo, com valor plausível, e recusa
execução de laboratório (PageSpeed, Lighthouse) e robôs.

**Why this priority**: uma amostra de dezenas de visitas se envenena com poucas medidas falsas, e um
PageSpeed rodado no site colocaria na tela exatamente o dado de laboratório que a 023 proíbe.

**Independent Test**: mandar uma medida com origem não declarada, uma com valor impossível e uma com
o agente do Lighthouse; nenhuma das três vira linha no banco.

**Acceptance Scenarios**:

1. **Given** uma medida de um host fora dos hosts declarados dos projetos no escopo, **When** chega ao
   hub, **Then** é descartada sem gravar nada.
2. **Given** uma medida de um navegador de laboratório ou robô conhecido, **When** chega ao hub,
   **Then** é descartada.
3. **Given** um valor fora da faixa plausível da métrica (negativo, não numérico ou acima do teto),
   **When** chega ao hub, **Then** é descartado.
4. **Given** uma rajada de medidas da mesma fonte, **When** passa do limite de envio, **Then** o
   excesso é descartado, e o hub não guarda o endereço da fonte para isso.

---

### Edge Cases

- **A CrUX passa a ter amostra do Sirius**: a folha volta para a CrUX sozinha, vital a vital, sem
  mudança de código. As duas fontes nunca se somam nem se misturam numa folha.
- **A CrUX mede alguns vitais e não outros** (estado "parcial" de hoje): cada folha usa a fonte que
  tem o vital, e diz qual é. O RUM entra só nos vitais que a CrUX não tem.
- **Coletor no ar e zero visita na janela**: "∅ sem leitura · nenhuma visita registrada pelo RUM em
  28 dias", distinto de "RUM não instalado neste projeto" e de "sem banco".
- **Banco do hub fora**: "∅ não apurado · sem banco", nunca zero.
- **INP com menos visitas que os outros**: o INP só existe em visita com interação. A folha mostra o n
  do próprio INP, não o da página.
- **Hub fora do ar na madrugada**: as medidas daquela janela se perdem. A amostra fica menor, nunca
  preenchida.
- **Salto de n sem explicação** (rajada que passou pelo filtro): o n aparece em toda leitura, então o
  salto fica visível na tela.
- **Visita que volta do cache de navegação (voltar/avançar)**: não gera segunda medida de
  carregamento da mesma visita.
- **URL prioritária com barra final ou prefixo de idioma diferente do caminho medido**: casa pelo
  caminho que o visitante recebeu depois do redirecionamento; divergência vira "sem amostra" daquela
  URL, nunca reprovação.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: As páginas públicas do Sirius DEVEM medir LCP, INP, CLS e TTFB de cada visita, com a
  mesma definição de métrica que a CrUX usa, e mandar ao hub uma medida por métrica e por visita.
- **FR-002**: O coletor NÃO DEVE rodar na área logada do Sirius.
- **FR-003**: O coletor NÃO DEVE atrasar a página que mede: carrega depois do conteúdo, não bloqueia
  renderização, não grava cookie e não pesa mais de 3 KB comprimido.
- **FR-004**: A medida gravada DEVE conter só: projeto, host, caminho sem `?` nem `#`, métrica, valor
  e data/hora. NÃO DEVE conter IP, cookie, identificador de visitante nem o agente completo do
  navegador.
- **FR-005**: O hub DEVE recusar, sem gravar: host fora dos declarados dos projetos no escopo de
  campo; agente de laboratório ou robô conhecido; valor fora da faixa plausível da métrica; corpo
  acima do tamanho máximo; envio acima do limite por fonte.
- **FR-006**: O endpoint de recebimento DEVE funcionar sem a senha do hub e sem expor nada do hub: a
  resposta não traz dado nenhum, só o status.
- **FR-007**: O mapa DEVE usar o RUM num vital só quando todas as origens declaradas estão sem amostra
  daquele vital na CrUX (404 ou vital ausente). Com a CrUX com amostra, falhando ou sem chave, a folha
  NÃO DEVE mudar em relação a hoje.
- **FR-008**: O veredito do RUM DEVE sair do intervalo de confiança de 95% da fração de visitas acima
  do limite contra 25%, o método da 033: inteiro acima → fora (dispara); inteiro abaixo → dentro;
  cruzando → não decide. Não há piso fixo de visitas.
- **FR-009**: A leitura do RUM DEVE dizer em toda folha a fonte ("RUM próprio"), o p75, o n de
  visitas daquela métrica e a janela. A regra disparada DEVE levar a ressalva "RUM próprio · n
  visitas".
- **FR-010**: Os limites são os de hoje e não mudam: LCP 2,5 s, INP 200 ms, CLS 0,1, TTFB 800 ms. O
  RUM usa as mesmas réguas da CrUX, lidas do mesmo catálogo.
- **FR-011**: A folha "% de URLs com status Bom" DEVE usar, para cada URL prioritária sem amostra na
  CrUX, o veredito do RUM nos três vitais (LCP, INP, CLS). A URL passa com os três dentro, reprova com
  qualquer um fora, e fica sem decisão no resto. A fração exige pelo menos duas URLs decididas, como
  hoje.
- **FR-012**: A janela do RUM DEVE ser de 28 dias, fechada no dia anterior, como a da CrUX.
- **FR-013**: Abrir o mapa NÃO DEVE fazer requisição externa a mais do que antes da feature: o RUM
  vem do banco do próprio hub.
- **FR-014**: O recebimento DEVE aceitar qualquer projeto em `SLUGS_DE_CAMPO` com host declarado, para
  que ligar outro projeto seja instalar o coletor no site dele, sem mudar o hub.
- **FR-015**: Medidas com mais de 90 dias DEVEM ser apagadas.

### Key Entities

- **Medida de campo**: uma métrica de uma visita. Projeto, host, caminho, métrica, valor, data/hora.
  Não identifica a pessoa.
- **Leitura do RUM**: por projeto, métrica e janela (e por URL, na folha de URLs boas). p75, n,
  fração de visitas acima do limite, intervalo dessa fração e veredito (fora, dentro, não decide).
- **Fonte da folha**: CrUX ou RUM próprio, escolhida vital a vital pela FR-007 e sempre impressa.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em até 24 horas depois do coletor no ar no Sirius, o hub tem pelo menos uma medida de
  `siriuscrm.com.br` gravada por visita real.
- **SC-002**: Sete dias depois do coletor no ar, nenhuma das cinco folhas do degrau 2 do Sirius diz
  "sem leitura" pelo motivo da CrUX. Cada uma mostra uma leitura do RUM com veredito, "não decide" com
  o n, ou "nenhuma visita registrada". Com 56 cliques de busca em 28 dias, "não decide" é resultado
  esperado e honesto, não falha.
- **SC-003**: Uma execução do PageSpeed Insights numa página do Sirius não aumenta o n de nenhuma
  métrica.
- **SC-004**: Medidas mandadas com host não declarado, valor impossível ou agente de laboratório
  resultam em zero linhas novas.
- **SC-005**: O mapa da Atma, que lê a CrUX pela origem anterior, fica com as quatro folhas de vital
  iguais às de antes da feature.
- **SC-006**: Nenhuma medida gravada contém IP, cookie, identificador ou parâmetro de URL.
- **SC-007**: A página pública do Sirius com o coletor não ganha nenhum recurso bloqueante de
  renderização, e o coletor pesa até 3 KB comprimido.
- **SC-008**: Abrir o mapa não faz nenhuma requisição externa a mais do que antes da feature.

## Assumptions

- A medida sem IP, cookie ou identificador não é dado pessoal, e o coletor não precisa de
  consentimento. Se o Sirius um dia pedir consentimento para métrica, o coletor passa a respeitá-lo.
- A amostra do RUM inclui todo navegador que reporta a métrica. A CrUX conta só o Chrome. A ressalva
  "RUM próprio" cobre essa diferença de população, e a definição da métrica é a mesma.
- "Visita" é um carregamento de página, a mesma unidade da CrUX.
- As páginas públicas são as que o Google pode indexar: home, preço, soluções, blog, ferramentas e
  páginas institucionais, nos dois idiomas.
- As visitas do próprio dono entram na amostra. Não há como separá-las sem identificar o visitante,
  e FR-004 proíbe isso.
- O limite de envio por fonte é contado em memória, sem gravar o endereço.
- Alguém que forje a origem de propósito consegue mandar medidas. O filtro corta ruído e laboratório,
  não um ataque dirigido. O n visível em toda leitura é o que denuncia um salto.

## Fora do escopo

- Instalar o coletor no site da Atma ou de outro projeto. O hub já aceita (FR-014); o site é outra
  entrega.
- Usar o RUM na ficha de `/okr/sirius/aquisicao` e no Pass Rate de lá. Aquele bloco continua lendo
  só a CrUX.
- Separar por dispositivo (celular e computador). O mapa lê "todos os dispositivos", como a CrUX.
- Diagnóstico de causa (qual elemento é o LCP, qual script atrasa o INP). Esta feature mede.
- Consertar qualquer vital.
- Dado de laboratório, em qualquer forma.
