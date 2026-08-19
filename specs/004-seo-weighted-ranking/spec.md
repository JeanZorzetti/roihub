# Feature Specification: Ranking Ponderado de Projetos na Página SEO

**Feature Branch**: `004-seo-weighted-ranking`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "Ordenar visualmente de forma hierárquica os projetos na página /seo do roihub segundo um score ponderado: Cliques 40%, CTR 30%, Posição Média 20%, Impressões 10%. Justificativa de negócio: cliques são a métrica soberana (tráfego real convertido), CTR é sinal de relevância/qualidade do título-meta, posição é potencial (métrica traiçoeira em média), impressões são topo de funil (menor peso, não geram receita direta). Hoje (app/seo/page.tsx linha 31) a ordenação é só por impressões brutas — trocar por esse score composto e refletir a hierarquia visualmente nos cards (não só a ordem da lista, mas destaque/proeminência dos projetos mais bem colocados)."

## Clarifications

### Session 2026-08-19

- Q: Como deve ser o destaque visual dos projetos mais bem colocados (FR-005/SC-002), dado que os cards já são densos (4 stats + 2 gráficos, grid uniforme)? → A: Badge de rank (#1, #2...) + acento de cor/borda nos melhores colocados, sem alterar o tamanho do card — mantém o grid uniforme e a densidade de dados intacta.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver os projetos que realmente performam primeiro (Priority: P1)

Como responsável por decidir onde investir esforço de SEO entre os projetos do portfólio, ao abrir a página `/seo` eu quero ver primeiro os projetos que geram tráfego real (cliques), não os que só aparecem muito no Google (impressões), para que minha atenção vá para onde o resultado comercial já está acontecendo.

**Why this priority**: É o núcleo do pedido — a ordenação atual (só impressões) engana ao colocar no topo projetos com muita exposição e zero conversão em clique. Sem essa mudança, nenhuma outra parte da feature faz sentido.

**Independent Test**: Abrir `/seo` com o conjunto real de projetos e confirmar que a ordem dos cards muda de "maior impressão primeiro" para "maior score composto primeiro" — validável comparando a nova ordem com um cálculo manual do score para 2-3 projetos.

**Acceptance Scenarios**:

1. **Given** dois projetos A (poucas impressões, muitos cliques) e B (muitas impressões, poucos cliques), **When** a página `/seo` é carregada, **Then** o projeto A aparece antes do projeto B.
2. **Given** um projeto com posição média ótima mas CTR baixo e outro com CTR alto mas posição pior, **When** os scores são calculados, **Then** o projeto com maior score composto (não a maior posição isolada) aparece primeiro.
3. **Given** a mesma página recarregada sem mudança nos dados do Search Console, **When** a ordenação é recalculada, **Then** a ordem dos projetos permanece idêntica (determinística).

---

### User Story 2 - Perceber a diferença de importância entre os projetos sem ler números (Priority: P2)

Como visitante da página que faz uma varredura visual rápida (não lê todos os números), eu quero que os projetos mais bem colocados se destaquem visualmente dos demais, para identificar o "quem está indo bem" e o "quem precisa de atenção" só pela forma dos cards.

**Why this priority**: É a parte "hierarquia visual" do pedido — sem ela, a mudança fica invisível (é só uma reordenação de lista que ninguém percebe). Depende da User Story 1 já existir (o score precisa existir antes de ser representado visualmente).

**Independent Test**: Com os olhos semicerrados (teste de hierarquia do design system), o card de maior score deve ser identificável em menos de 2 segundos sem ler texto.

**Acceptance Scenarios**:

1. **Given** a lista de projetos ordenada por score, **When** a página é renderizada, **Then** cada card exibe um badge de posição (#1, #2, #3...) e os projetos de melhor score recebem acento visual (cor/borda de destaque) distinto do restante, sem alterar o tamanho do card.
2. **Given** um projeto sem dados do GSC (`t === null`, só `seoSeed` manual), **When** a página é renderizada, **Then** esse projeto aparece visualmente marcado como "sem dados suficientes para ranquear" e posicionado após todos os projetos com dados reais — nunca competindo por destaque com eles.
3. **Given** a janela é redimensionada para mobile, **When** a página é renderizada, **Then** a hierarquia visual (destaque dos melhores) continua perceptível, sem quebrar o layout responsivo existente.

---

### User Story 3 - Entender por que um projeto está numa posição (Priority: P3)

Como usuário que quer auditar o critério, eu quero conseguir ver o motivo de um projeto estar em determinada posição (os pesos e valores que geraram o score), para confiar no ranking e não achar que é arbitrário.

**Why this priority**: É valor incremental — a feature já entrega valor completo com P1+P2. P3 é transparência/confiança, não bloqueia o uso do ranking.

**Independent Test**: Localizar, para qualquer projeto, uma forma de ver o score final e/ou os componentes que o formaram (sem precisar olhar o código-fonte).

**Acceptance Scenarios**:

1. **Given** um projeto com dados GSC, **When** o usuário inspeciona o card (hover, tooltip, ou texto visível), **Then** consegue ver o score composto ou os valores das 4 métricas usadas no cálculo.

---

### Edge Cases

- Projeto com métricas parcialmente nulas: CTR e posição só são `null` quando impressões=0 na janela de 28 dias — o que implica cliques também 0. Nesse caso as duas métricas nulas contam como o pior valor normalizado (0), consistente com cliques e impressões já naturalmente zerados; nenhuma exclusão especial é necessária.
- Empate exato de score entre dois ou mais projetos — desempate por maior número de cliques absolutos (a métrica de maior peso), e em último caso por ordem alfabética do nome do projeto, garantindo ordem estável entre reloads.
- Um único projeto tem dado GSC (todos os outros são `SEED`) — a hierarquia visual não deve implicar falsa comparação entre um projeto real e vários sem dado.
- Projeto novo com poucos dias de histórico GSC (métricas de 28 dias ainda incompletas) — não deve ser artificialmente favorecido ou penalizado só por ter poucos dias de amostra ainda cobrindo a janela.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE calcular, para cada projeto com dados do Search Console, um score composto usando os pesos: Cliques (28d) 40%, CTR (28d) 30%, Posição Média (28d) 20% (invertida — menor posição é melhor), Impressões (28d) 10%.
- **FR-002**: O sistema DEVE normalizar as quatro métricas para uma escala comparável antes de aplicar os pesos, já que elas usam unidades e magnitudes diferentes (cliques/impressões em contagem absoluta, CTR em fração 0–1, posição em ranking 1+).
- **FR-003**: O sistema DEVE ordenar a lista de projetos na página `/seo` pelo score composto, do maior para o menor, substituindo a ordenação atual por impressões brutas.
- **FR-004**: O sistema DEVE excluir da comparação de score os projetos sem dados do Search Console (`t === null`) e exibi-los ao final da lista, sem interferir no cálculo de normalização dos projetos com dados reais.
- **FR-005**: O sistema DEVE exibir em cada card um badge com a posição no ranking (#1, #2, #3...) e aplicar acento visual (cor/borda de destaque) aos projetos mais bem colocados pelo score, distinguível numa varredura visual rápida, sem alterar o tamanho do card nem o grid uniforme existente.
- **FR-006**: O sistema DEVE manter a ordenação estável e determinística entre reloads quando os dados subjacentes não mudam, usando cliques absolutos como critério de desempate primário e nome do projeto como critério final.
- **FR-007**: O sistema DEVE continuar exibindo os projetos sem dado GSC com o rótulo `SEED` e a explicação existente (`O ranking usa o seoSeed manual`), agora coerente com o fato de eles não entrarem no score composto.
- **FR-008**: O sistema DEVE tornar visível, para qualquer projeto com dados, o valor do score composto ou dos componentes que o formaram.

### Key Entities

- **Score composto do projeto**: valor derivado das 4 métricas normalizadas (cliques, CTR, posição, impressões) da janela de 28 dias, ponderadas 40/30/20/10, usado como critério único de ordenação e de destaque visual.
- **Projeto sem dado (SEED)**: projeto sem série do Search Console; não participa do cálculo de score, mantém posição fixa após os projetos com dado, mantém o `seoSeed` manual apenas como contexto informativo (não como score).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ao abrir `/seo`, o projeto com mais cliques nos últimos 28 dias entre os que têm dado GSC nunca aparece depois de um projeto com menos da metade dos seus cliques, exceto quando o score composto dos demais componentes (CTR/posição/impressões) justificar a inversão.
- **SC-002**: Um usuário consegue apontar, sem ler nenhum número, qual projeto está em melhor posição no ranking em até 2 segundos de observação da tela.
- **SC-003**: Recarregar a página com os mesmos dados subjacentes produz exatamente a mesma ordem em 100% das vezes.
- **SC-004**: Projetos sem dado GSC nunca aparecem misturados/destacados entre os projetos com dado real — sempre depois, sempre sem o tratamento visual de destaque.

## Assumptions

- Normalização das métricas será relativa ao conjunto de projetos exibido no momento (min-max entre os projetos com dado GSC na página), já que não existe um valor absoluto de referência de mercado para "cliques bons" ou "CTR bom" cadastrado no sistema hoje.
- "Posição Média" entra invertida na normalização (posição menor = melhor = mais próxima de 1.0 no score), consistente com o texto já existente no rodapé da página ("cair é melhor").
- Projetos sem dado GSC (`t === null`) ficam fora do cálculo de score e são sempre listados após os projetos com score, mantendo o comportamento atual de exibição (`SEED`).
- O destaque visual dos melhores projetos usa badge de posição + acento de cor/borda, sem alterar o tamanho do card ou o grid uniforme existente (decisão tomada na sessão de clarificação de 2026-08-19).
- Não há requisito de persistência histórica do score (ele é recalculado a cada carregamento da página, assim como as demais métricas hoje, que rodam ao vivo via `force-dynamic`).
