// OS NÍVEIS DO BOARD QUE O CATÁLOGO NÃO GUARDAVA (032).
//
// `gsc-delta.mjs#CATALOGO` guarda as 32 folhas e o balizador de cada uma — que é o que o hub PRECISA
// para emitir veredito. O board `okr-Saw2eoSKZDPLJAk6xeDBuS` tem mais três coisas que nunca entraram
// em código nenhum, e por isso só existiam dentro do Whimsical:
//
//   1. O TÍTULO NUMERADO. `CATALOGO.penetracaoTop3.nome` é "Taxa de penetração no Top 3"; no board
//      ele é "2. KPI de Distribuição: Taxa de Penetração no Top 3". O número é a ordem de leitura do
//      ramo e o prefixo diz que TIPO de KPI é (eficiência, distribuição, oportunidade, escala).
//   2. O GRUPO. O SVG de `/gsc` pendura as 14 folhas de POSIÇÃO MÉDIA direto no ramo; o board as
//      agrupa em 4 famílias numeradas. Achatar perdeu a família inteira — e é ela que explica por que
//      LCP e Profundidade de Clique moram no mesmo ramo (um é experiência, o outro é rastreabilidade).
//   3. O DETALHE. "O que mede", "Fórmula", "Meta recomendada", "Ação imediata" — a prosa que define o
//      KPI. Sem ela o nome do KPI é um rótulo que cada leitor completa de um jeito.
//
// ⚠️ ESTE ARQUIVO NÃO TEM UMA SEGUNDA LISTA DE FOLHAS, e a ausência é o desenho. As chaves são as do
// `CATALOGO` e nada mais; `test/board-gsc.test.mjs` reprova nos DOIS sentidos — chave aqui que não
// existe lá, e folha de lá sem entrada aqui. Foi assim que o board passou duas semanas sendo
// reconstruído do zero: cada tentativa escrevia a própria lista, e as listas divergiam em silêncio.
//
// ⚠️ A META DO BOARD NÃO É RÉGUA. "20% a 30%", "< 15%", "≥ 95%" estão aqui porque são o que o board
// diz, NÃO porque têm fonte. Quem decide se um número é régua continua sendo `regua()` em
// `gsc-delta.mjs`, e o mapa imprime os dois lados: a meta que o board pediu e o motivo pelo qual 25
// das 32 não sustentam veredito. Copiar a meta para cá sem esse par seria exatamente o defeito que
// `/gsc` existe para acusar — exibir "< 15% de reescrita" com a mesma tipografia de "LCP ≤ 2,5s".
//
// `.mjs` puro pela constituição (III): a montagem da árvore é testável sem subir o Next.

import { CATALOGO, MEDIDO_POR, RESSALVA_DO_COLETOR, limiarEmTexto, regua } from "./gsc-delta.mjs";

/**
 * O nível que o desenho em SVG achatou: a família do KPI dentro do ramo.
 *
 * Caminho, não string, porque POSIÇÃO MÉDIA tem DOIS níveis de agrupamento — os três vitais moram em
 * "Core Web Vitals Pass Rate" dentro de "1. KPIs Técnicas", e o TTFB é irmão do grupo inteiro, não
 * dos vitais. O board separa os dois de propósito: o TTFB não é Core Web Vital, e a própria página do
 * Google diz isso (ver `WEBDEV_TTFB` em `gsc-delta.mjs`). Um campo string perderia a distinção.
 *
 * Chave ausente = folha pendurada direto no ramo, que é o caso de CLIQUE e IMPRESSÕES inteiros.
 *
 * @type {Record<string, string[]>}
 */
export const GRUPOS = {
  // CTR — o board tem UM nó para o título e três metas dentro dele; o catálogo tem TRÊS folhas,
  // porque as três têm natureza diferente (largura tem régua, reescrita e termo não têm). Quem
  // separou foi o levantamento de 19/09/2026, e a separação é a razão de o grupo existir aqui.
  larguraTitulo: ["4. Taxa de Integridade do Título (Sem Truncamento / Sem Reescrita pelo Google)", "Metas recomendadas"],
  reescritaTitulo: ["4. Taxa de Integridade do Título (Sem Truncamento / Sem Reescrita pelo Google)", "Metas recomendadas"],
  termoNoTitulo: ["4. Taxa de Integridade do Título (Sem Truncamento / Sem Reescrita pelo Google)", "Metas recomendadas"],

  // POSIÇÃO MÉDIA — as 4 famílias numeradas do board, que o SVG não tinha.
  lcp: ["1. KPIs Técnicas de Experiência e Performance (Core Web Vitals & TTFB)", "Core Web Vitals Pass Rate"],
  inp: ["1. KPIs Técnicas de Experiência e Performance (Core Web Vitals & TTFB)", "Core Web Vitals Pass Rate"],
  cls: ["1. KPIs Técnicas de Experiência e Performance (Core Web Vitals & TTFB)", "Core Web Vitals Pass Rate"],
  urlsBoas: ["1. KPIs Técnicas de Experiência e Performance (Core Web Vitals & TTFB)", "Core Web Vitals Pass Rate"],
  ttfb: ["1. KPIs Técnicas de Experiência e Performance (Core Web Vitals & TTFB)"],

  indexacaoLimpa: ["2. KPIs de Rastreabilidade e Saúde do Índice (Index Health)"],
  rejeicaoRastreio: ["2. KPIs de Rastreabilidade e Saúde do Índice (Index Health)"],
  profundidadeClique: ["2. KPIs de Rastreabilidade e Saúde do Índice (Index Health)"],

  coberturaSemantica: ["3. KPIs de Relevância On-Page e Cobertura de Entidades"],
  frescor: ["3. KPIs de Relevância On-Page e Cobertura de Entidades"],
  canibalizacao: ["3. KPIs de Relevância On-Page e Cobertura de Entidades"],

  linksInternos: ["4. KPIs de Autoridade e Conexões (PageRank Interno e Externo)"],
  referringDomains: ["4. KPIs de Autoridade e Conexões (PageRank Interno e Externo)"],
  buscasDeMarca: ["4. KPIs de Autoridade e Conexões (PageRank Interno e Externo)"],
};

/**
 * A prosa que o board pendura no GRUPO, não na folha.
 *
 * Só existe onde o board de fato escreveu algo no nó do grupo. Grupo sem entrada aqui é agrupamento
 * puro — e isso é informação, não lacuna: dizer "sem descrição no board" é diferente de deixar o nó
 * mudo, porque o primeiro afirma que fomos olhar.
 *
 * @type {Record<string, string>}
 */
export const NOTA_DO_GRUPO = {
  "4. Taxa de Integridade do Título (Sem Truncamento / Sem Reescrita pelo Google)":
    "O que mede: Snippets que são exibidos exatamente com a copy pensada para conversão.",
};

/**
 * O título numerado e o detalhe de cada folha, na íntegra do board.
 *
 * `rotulo` é o nó — curto, uma ideia, como manda a forma. `nota` é o parágrafo inteiro do board,
 * literal, que a tela mostra no painel ao selecionar o nó. A divisão não é estética: um mapa mental
 * cujos nós são parágrafos de cinco linhas deixa de irradiar e vira uma lista com curvas, e foi o que
 * o Whimsical virou — 2.139 × 5.614 px para 32 KPIs.
 *
 * Onde o `rotulo` já diz tudo o que o board dizia, `nota` não existe. Nota igual ao rótulo seria
 * ruído com cara de conteúdo.
 *
 * @type {Record<string, {titulo: string, detalhe: Detalhe[]}>}
 * @typedef {{rotulo: string, nota?: string, filhos?: Detalhe[]}} Detalhe
 */
export const BOARD = {
  // ---------- ramo CLIQUE ----------
  ctrPorPosicao: {
    titulo: "1. KPI de Eficiência: CTR Relativo por Posição",
    detalhe: [
      {
        rotulo: "Posição no Google",
        filhos: [
          { rotulo: "Posição 1 · > 30%", nota: "> 30% (ou > 50% para termos de marca)." },
          { rotulo: "Posição 2 · > 18%" },
          { rotulo: "Posição 3 · > 12%" },
          { rotulo: "Posições 4 a 6 · > 7%" },
          { rotulo: "Posições 7 a 10 · > 4%" },
          { rotulo: "Página 2 (11 a 20) · ~ 1,5%" },
        ],
      },
    ],
  },
  penetracaoTop3: {
    titulo: "2. KPI de Distribuição: Taxa de Penetração no Top 3",
    detalhe: [
      {
        rotulo: "Fórmula: termos com posição ≤ 3 ÷ total monitorado × 100",
        nota: "(Termos estratégicos com Posição ≤ 3) ÷ (Total de termos monitorados) × 100",
      },
      {
        rotulo: "Meta: 20% a 30% do inventário",
        nota: "Meta recomendada: Ter pelo menos 20% a 30% do seu inventário de palavras-chave principais posicionado entre as 3 primeiras colocações.",
      },
    ],
  },
  strikingDistance: {
    titulo: "3. KPI de Oportunidade Imediata: Volume em Striking Distance (Posições 4 a 10)",
    detalhe: [
      {
        rotulo: "Métrica: consultas entre as posições 4,0 e 10,9",
        nota: "Número absoluto de consultas com impressões relevantes situadas entre as posições 4,0 e 10,9.",
      },
      {
        rotulo: "Meta de execução: converter 15% a 25% ao trimestre",
        nota: "Manter uma rotina de otimização trimestral com meta de conversão de 15% a 25% dessas palavras para o Top 3 via otimização on-page, expansão semântica e link building interno.",
      },
    ],
  },
  crescimentoNaoMarca: {
    titulo: "4. KPI de Escala: Crescimento de Impressões Não-Marca (Non-Branded)",
    detalhe: [
      {
        rotulo: "Fórmula: MoM de impressões sem o nome da empresa",
        nota: "Crescimento mensal (MoM) de impressões filtrando consultas que não contêm o nome da sua empresa/produto.",
      },
      {
        rotulo: "Meta: 5% a 10% ao mês",
        nota: "Crescimento contínuo de 5% a 10% ao mês em impressões não-marca em setores estáveis, ou > 15% ao mês em fases de tração inicial.",
      },
    ],
  },
  checklistGsc: {
    titulo: "Checklist para auditar seu GSC",
    detalhe: [
      {
        rotulo: "Filtre páginas de alta impressão com CTR abaixo da meta",
        nota: "Filtre por páginas de alta impressão e CTR abaixo da meta da tabela: são os ganhos rápidos de cliques via copy do snippet.",
      },
      {
        rotulo: "Filtre consultas nas posições 4 a 10 com impressão expressiva",
        nota: "Filtre consultas entre as posições 4 e 10 com volume de impressões expressivo: são as candidatas prioritárias para reforço de conteúdo e links internos.",
      },
      {
        rotulo: "Monitore o impacto de recursos da SERP",
        nota: "Em SERPs com painéis ricos ou resumos de IA, o CTR cai para todos; nesses casos, a meta deve ser a inclusão em dados estruturados (Schema.org) para disputar o espaço visual expandido.",
      },
    ],
  },

  // ---------- ramo CTR ----------
  impressoesTop3: {
    titulo: "1. % de Impressões Concentradas no Top 3 (Posicionamento Base)",
    detalhe: [
      {
        rotulo: "O que mede: a fatia do tráfego potencial exibida antes da rolagem",
        nota: "A fatia do seu tráfego potencial que é exibida onde o olho humano realmente foca antes de rolar a página.",
      },
      {
        rotulo: "Meta: 40% a 50% das impressões entre 1,0 e 3,9",
        nota: "Ter pelo menos 40% a 50% das suas impressões totais ocorrendo entre as posições 1,0 e 3,9.",
      },
      {
        rotulo: "Como medir no GSC: ative Posição Média nas páginas estratégicas",
        nota: "Filtre por páginas estratégicas, ative Posição Média e isole as consultas que sustentam a maior parte das impressões.",
      },
    ],
  },
  ctrGap: {
    titulo: "2. Índice de Conformidade com o Benchmark (CTR Gap)",
    detalhe: [
      {
        rotulo: "O que mede: a eficácia do snippet no mesmo degrau da SERP",
        nota: "A eficácia do seu snippet em relação aos concorrentes diretos no mesmo degrau da SERP.",
      },
      {
        rotulo: "Meta: 75% a 80% das URLs no benchmark da posição",
        nota: "Pelo menos 75% a 80% das URLs principais com CTR igual ou superior ao benchmark da posição.",
        filhos: [
          { rotulo: "Posição 1 · ≥ 25%" },
          { rotulo: "Posição 2 · ≥ 13%" },
          { rotulo: "Posição 3 · ≥ 8%" },
          { rotulo: "Posições 4 a 6 · ≥ 4,5%" },
          { rotulo: "Posições 7 a 10 · ≥ 2%" },
        ],
      },
      {
        rotulo: "Ação imediata: CTR Gap negativo grave exige reescrita do Title",
        nota: "Qualquer URL que esteja, por exemplo, na posição 2 com 5% de CTR apresenta um CTR Gap negativo grave e exige reescrita urgente do Title.",
      },
    ],
  },
  conformidadeUrls: {
    titulo: "% de URLs acima do benchmark",
    detalhe: [
      {
        rotulo: "Sai da meta do CTR Gap: 75% a 80% das URLs principais",
        nota: "O board não dá um nó próprio a este KPI — ele é a fração dentro da meta do CTR Gap (\"pelo menos 75% a 80% das URLs principais com CTR igual ou superior ao benchmark da posição\"). O catálogo o separou porque a fração e o gap têm procedência diferente: o benchmark tem fonte, QUANTAS URLs devem superá-lo não tem.",
      },
    ],
  },
  schema: {
    titulo: "3. Taxa de Cobertura de Dados Estruturados (Rich Snippets Elegíveis)",
    detalhe: [
      {
        rotulo: "O que mede: páginas com Schema válido e sem erro de sintaxe",
        nota: "Percentual de páginas transacionais ou editoriais com Schema Markup válido e sem erros de sintaxe.",
      },
      {
        rotulo: "Meta: 100% de cobertura, 0 erro crítico",
        nota: "100% de cobertura de Schema (Product, Article, FAQPage ou SoftwareApplication) nas páginas prioritárias, com 0 erros críticos no relatório de Resultados Enriquecidos do Search Console.",
      },
    ],
  },
  larguraTitulo: {
    titulo: "Comprimento em pixels",
    detalhe: [
      {
        rotulo: "100% dos títulos entre 500px e 580px",
        nota: "100% dos títulos entre 500px e 580px (aproximadamente 50 a 60 caracteres).",
      },
    ],
  },
  reescritaTitulo: {
    titulo: "Taxa de reescrita pelo Google",
    detalhe: [
      {
        rotulo: "Menor que 15% dos títulos alterados",
        nota: "Menor que 15% dos títulos alterados arbitrariamente pelo algoritmo na SERP.",
      },
    ],
  },
  termoNoTitulo: {
    titulo: "Posicionamento da palavra-chave",
    detalhe: [
      {
        rotulo: "Termo nos primeiros 35 caracteres do Title",
        nota: "Termo de busca presente nos primeiros 35 caracteres do Title.",
      },
    ],
  },
  intencao: {
    titulo: "5. Taxa de Alinhamento de Intenção (Search Intent Match)",
    detalhe: [
      {
        rotulo: "O que mede: o modificador de intenção contra o gancho do título",
        nota: "A correspondência entre o modificador de intenção da busca e o gancho do título.",
      },
      {
        rotulo: "Meta: 100% das páginas-chave com modificador explícito no Title",
        filhos: [
          {
            rotulo: "Comercial / Transacional",
            nota: "Inclusão de termos como \"Preço\", \"Comparativo\", \"Melhores\", \"Planos\", \"Grátis\", ano vigente.",
          },
          {
            rotulo: "Informacional",
            nota: "Inclusão de \"Como Fazer\", \"Passo a Passo\", \"Guia Definitivo\", \"Exemplos\".",
          },
        ],
      },
    ],
  },

  // ---------- ramo POSIÇÃO MÉDIA ----------
  lcp: {
    titulo: "LCP (Largest Contentful Paint)",
    detalhe: [{ rotulo: "≤ 2,5s no 75º percentil" }],
  },
  inp: {
    titulo: "INP (Interaction to Next Paint)",
    detalhe: [{ rotulo: "≤ 200ms" }],
  },
  cls: {
    titulo: "CLS (Cumulative Layout Shift)",
    detalhe: [{ rotulo: "≤ 0,1" }],
  },
  urlsBoas: {
    titulo: "Meta do Pass Rate",
    detalhe: [
      {
        rotulo: "90% das URLs prioritárias com status Bom",
        nota: "Pelo menos 90% das URLs prioritárias com status \"Bom\" no relatório de Core Web Vitals do GSC.",
      },
    ],
  },
  ttfb: {
    titulo: "TTFB (Time to First Byte)",
    detalhe: [
      {
        rotulo: "≤ 600ms, idealmente < 300ms em conexões locais",
        nota: "TTFB ≤ 600ms (idealmente < 300ms em conexões locais). Se o crawler do Googlebot encontra latência alta no servidor, ele reduz a profundidade de rastreio e prioriza concorrentes mais rápidos.",
      },
    ],
  },
  indexacaoLimpa: {
    titulo: "Taxa de Indexação Limpa (Sitemap Indexation Ratio)",
    detalhe: [
      {
        rotulo: "Fórmula: URLs indexadas válidas ÷ URLs submetidas via sitemap × 100",
        nota: "(URLs Indexadas Válidas ÷ URLs Submetidas via Sitemap) × 100",
      },
      { rotulo: "Meta: ≥ 95%" },
    ],
  },
  rejeicaoRastreio: {
    titulo: "Taxa de Rejeição de Rastreio",
    detalhe: [
      {
        rotulo: "Meta: < 5% do inventário do site",
        nota: "Meta: < 5% do inventário do site nos status \"Rastreada, mas não indexada\" e \"Descoberta, mas não indexada\". Volumes expressivos nesses status são o sinal clássico de que o Google considera o conteúdo raso, duplicado ou sem autoridade para competir na SERP.",
      },
    ],
  },
  profundidadeClique: {
    titulo: "Profundidade de Clique (Click Depth)",
    detalhe: [
      {
        rotulo: "Meta: transacionais e pilares em ≤ 3 cliques da Home",
        nota: "100% das páginas transacionais e pilares em ≤ 3 cliques de distância da Home. URLs com profundidade 4+ recebem uma fração ínfima do PageRank interno e quase nunca conquistam o Top 3 para termos competitivos.",
      },
    ],
  },
  coberturaSemantica: {
    titulo: "Índice de Cobertura Semântica / Entidades (Topic Coverage)",
    detalhe: [
      {
        rotulo: "O que mede: as entidades do gráfico de conhecimento do tema",
        nota: "Presença das entidades semânticas primárias e secundárias que compõem o gráfico de conhecimento do tema (avaliadas por ferramentas de NLP/TF-IDF ou análise de concorrentes no Top 3).",
      },
      {
        rotulo: "Meta: 100% das sub-intenções mandatórias do Top 3",
        nota: "Conter 100% das sub-intenções mandatórias que os 3 primeiros colocados cobrem na mesma SERP.",
      },
    ],
  },
  frescor: {
    titulo: "Cadência de Atualização e Frescor (Content Freshness Ratio)",
    detalhe: [
      {
        rotulo: "Meta: auditoria dos pilares a cada 6 a 12 meses",
        nota: "Auditoria e atualização técnica/editorial a cada 6 a 12 meses para conteúdos pilares, mantendo dados, fontes e exemplos vigentes (sinal crítico para termos com modificadores temporais ou nichos voláteis).",
      },
    ],
  },
  canibalizacao: {
    titulo: "Taxa de Canibalização Interna",
    detalhe: [
      {
        rotulo: "Meta: 0 páginas competindo pela mesma palavra-chave primária",
        nota: "Se o GSC reportar duas ou mais URLs suas alternando impressões para a mesma consulta com posições flutuantes (ex: 6ª e 14ª), a autoridade foi dividida ao meio.",
      },
    ],
  },
  linksInternos: {
    titulo: "Densidade de Links Internos Contextuais",
    detalhe: [
      {
        rotulo: "Meta: 5 a 10 links internos contextuais por página-alvo",
        nota: "Mínimo de 5 a 10 links internos contextuais (com âncoras exatas ou variações ricas) apontando para cada página que você deseja empurrar para o Top 3, partindo de páginas com alto tráfego orgânico.",
      },
    ],
  },
  referringDomains: {
    titulo: "Velocidade de Domínios Referenciadores (Referring Domains Velocity)",
    detalhe: [
      {
        rotulo: "Meta: +3 a +10 domínios novos por trimestre",
        nota: "Crescimento líquido positivo e constante de domínios únicos de qualidade apontando para a pasta ou categoria alvo (ex: +3 a +10 novos Referring Domains com tráfego real por trimestre).",
      },
    ],
  },
  buscasDeMarca: {
    titulo: "Proporção de Buscas de Marca (Brand Demand Ratio)",
    detalhe: [
      {
        rotulo: "Meta: volume de busca pela marca crescente no GSC",
        nota: "Volume de busca mensal crescente pelo nome da sua marca/empresa no GSC. O algoritmo usa a demanda de marca como um dos maiores validadores de entidade real (E-E-A-T), o que confere estabilidade às posições não-institucionais.",
      },
    ],
  },

  // ---------- ramo IMPRESSÕES ----------
  consultasUnicas: {
    titulo: "1. KPI de Amplitude: Footprint de Consultas Únicas (Total Queries)",
    detalhe: [
      {
        rotulo: "O que mede: termos distintos com ≥ 1 impressão em 28 dias",
        nota: "O número total de termos distintos que geram pelo menos 1 impressão no GSC ao longo de 28 dias.",
      },
      {
        rotulo: "Meta: 10% a 20% ao trimestre",
        nota: "Crescimento contínuo de 10% a 20% ao trimestre no volume total de consultas únicas ativas registradas no Search Console.",
      },
      {
        rotulo: "Por que importa: base concentrada é tráfego frágil",
        nota: "Se o seu site tem 1.000 impressões vindas de apenas 5 termos, seu tráfego é frágil. Se tem 100.000 impressões diluídas em 1.500 termos, sua base semântica é ampla e estável.",
      },
    ],
  },
  top20: {
    titulo: "2. KPI de Limiar: Volume de Palavras-Chave no Top 20 (Posições 1 a 20)",
    detalhe: [
      {
        rotulo: "O que mede: consultas posicionadas entre 1,0 e 20,0",
        nota: "A quantidade absoluta de consultas posicionadas entre 1,0 e 20,0.",
      },
      {
        rotulo: "Meta: 60% do catálogo mapeado dentro do Top 20",
        nota: "Manter pelo menos 60% do seu catálogo de palavras-chave mapeadas dentro do Top 20.",
      },
      {
        rotulo: "Impacto prático: da posição 45 para a 18 a impressão dispara",
        nota: "Uma palavra-chave na posição 45 tem impressões quase nulas. Ao subir para a posição 18, as impressões disparam de imediato, mesmo antes de gerar cliques relevantes.",
      },
    ],
  },
  queryToPage: {
    titulo: "3. KPI de Densidade: Média de Consultas por Página (Query-to-Page Ratio)",
    detalhe: [
      {
        rotulo: "Fórmula: total de consultas no GSC ÷ total de URLs ativas indexadas",
        nota: "(Total de Consultas no GSC) ÷ (Total de URLs Ativas Indexadas)",
      },
      {
        rotulo: "Metas recomendadas",
        filhos: [
          {
            rotulo: "Artigo / Blog / Guias · 30 a 80 consultas por URL",
            nota: "Média de 30 a 80 consultas diferentes gerando impressões por URL.",
          },
          {
            rotulo: "Produto / Landing Pages · 10 a 25 consultas por URL",
            nota: "Média de 10 a 25 consultas diferentes por URL.",
          },
        ],
      },
      {
        rotulo: "Como atingir: cobrir subtemas e perguntas contextuais",
        nota: "Cobrir subtemas, responder a perguntas contextuais (\"como\", \"quando\", \"preço de\") e usar sinônimos naturais no corpo da página.",
      },
    ],
  },
  activeIndexRatio: {
    titulo: "4. KPI de Eficiência do Índice: Taxa de Páginas Geradoras de Impressão (Active Index Ratio)",
    detalhe: [
      {
        rotulo: "Fórmula: URLs com ≥ 1 impressão em 28 dias ÷ total indexado × 100",
        nota: "(URLs com ≥ 1 impressão nos últimos 28 dias) ÷ (Total de URLs Indexadas) × 100",
      },
      { rotulo: "Meta: ≥ 70%" },
      {
        rotulo: "Ação corretiva se estiver baixo: podar as páginas zumbis",
        nota: "Se menos de 50% das suas páginas recebem impressões, você tem excesso de páginas zumbis (thin content). Deve-se podar o site: aplicar noindex, consolidar URLs semelhantes via redirecionamento 301 ou excluir conteúdos mortos.",
      },
    ],
  },
  tamBusca: {
    titulo: "5. KPI de Demanda: Cobertura do Total Addressable Volume (TAM de Busca)",
    detalhe: [
      {
        rotulo: "O que mede: o volume que o site cobre contra a demanda do segmento",
        nota: "A soma do volume mensal de buscas de todas as palavras-chave que seu site cobre ativamente versus a demanda total existente no seu segmento.",
      },
      {
        rotulo: "Meta: 60% a 80% dos clusters de maior volume",
        nota: "Cobrir, no planejamento de conteúdo e arquitetura, pelo menos 60% a 80% dos clusters de busca de maior volume do seu nicho (topos, meios e fundos de funil).",
      },
    ],
  },
};

/**
 * ONDE O BOARD E O CÓDIGO DISCORDAM — declarado no nó, não escondido no painel do pai.
 *
 * A auditoria de 19/09/2026 achou a causa-raiz de três achados numa frase só: a transcrição do board
 * entrou como PROSA, e prosa não passa por `regua()`. Todo o aparato de procedência protege o campo
 * `balizador`; nada protegia o texto do nó-filho — que é o que o leitor vê primeiro e em corpo maior.
 *
 * O caso que doeu: o TTFB. O board diz 600ms, o hub julga por 800ms desde o mesmo dia em que esta
 * tela nasceu, e os dois estavam no ar juntos — o 600 no rótulo do nó, grande; o 800 atrás de um
 * clique no pai. O valor SEM fonte publicado acima do valor COM fonte.
 *
 * O desenho aqui não corrige a transcrição, e não corrigir é o ponto: o board é o que o board diz, e
 * reescrevê-lo para caber no código transformaria uma fonte em espelho. O que se acrescenta é a
 * DECLARAÇÃO, no mesmo nó e visível sem clique — exatamente o que `profundidadeClique` já fazia no
 * `motivo` do balizador e em `EDITORIAIS`, e que o TTFB não fazia em lugar nenhum.
 *
 * `hub` é o número que o código usa, copiado aqui de propósito para que `test/board-gsc.test.mjs`
 * possa compará-lo com a constante VIVA. Copiado e travado: se `regua("ttfb").meta` sair de 800, o
 * teste reprova antes da tela. É a trava que faltava — a única que olha para DENTRO da prosa.
 *
 * `no` é o rótulo literal do nó divergente, e o teste exige que ele exista na árvore: mudar a
 * transcrição sem rever a divergência reprova também.
 *
 * @type {Record<string, {no: string, hub: number, tag: string, nota: string}>}
 */
export const DIVERGENCIAS = {
  ttfb: {
    no: "≤ 600ms, idealmente < 300ms em conexões locais",
    hub: 800,
    tag: "⚠ o hub julga por 800ms",
    nota:
      "O 600ms é do board e não tem fonte — conferido em 19/09/2026. O hub julga por 800ms, que é o limiar que o Google publica (“most sites should strive to have a TTFB of 0.8 seconds or less”). Entre 600 e 800ms a meta do board REPROVA o que a fonte oficial aprova: falso-negativo, não rigor.",
  },
  ctrPorPosicao: {
    no: "Posição no Google",
    hub: 0.25,
    tag: "⚠ tabela do board — quem julga cada faixa é BENCHMARK, com veredito ao lado (033)",
    nota:
      "Esta tabela é a do board e não emite veredito nenhum. Quem julga é lib/kpis-busca.mjs#BENCHMARK, transcrita no KPI vizinho (“2. Índice de Conformidade com o Benchmark”): 25% na posição 1, 13% na 2, 8% na 3, 4,5% de 4 a 6 e 2% de 7 a 10. A do board cobra mais em quase toda faixa — o DOBRO nas posições 7 a 10 — e usá-la para avaliar uma URL daria o dobro do que o hub cobra. Nenhuma das duas reproduz a referência externa, e o porquê está no recorte da régua. Desde a 033, cada faixa do mapa carrega o veredito da própria amostra contra a régua que julga — não contra esta transcrição.",
  },
  profundidadeClique: {
    no: "Meta: transacionais e pilares em ≤ 3 cliques da Home",
    hub: 4,
    tag: "⚠ o hub usa 4 cliques",
    nota:
      "O board pede ≤ 3 cliques; lib/grafo.mjs#PROFUNDIDADE_MAX usa 4. Nenhum dos dois tem fonte — a direção é documentada (mais fundo, menos rastreio), a faixa não. A divergência já estava declarada no balizador e em EDITORIAIS; agora está também no nó, que é onde ela é lida.",
  },
};

/**
 * Os quatro ramos, na ordem do board.
 *
 * A cor é POR RAMO e herdada pelos filhos — a única codificação de cor que um mapa mental aceita, e
 * ela é redundante de propósito: a posição no mapa já diz o ramo. Nenhuma é verde nem vermelha,
 * porque neste hub essas duas carregam ESTADO (`--good`, `--crit`) e reusá-las como categoria faria
 * o ramo IMPRESSÕES parecer aprovado.
 */
export const RAMOS = [
  { id: "clique", nome: "CLIQUE", cor: "#1d4ed8" },
  { id: "ctr", nome: "CTR", cor: "#6d28d9" },
  { id: "posicao", nome: "POSIÇÃO MÉDIA", cor: "#0f766e" },
  { id: "impressoes", nome: "IMPRESSÕES", cor: "#a16207" },
];

/**
 * O selo de procedência de uma folha, em FORMA e não em cor — mesma regra do `◆`/`◇` do SVG de
 * `/gsc` e do `.org` da tela de aquisição. Impresso em cinza a distinção sobrevive.
 *
 * @param {string} chave
 * @returns {{marca: string, rotulo: string, detalhe: string, url?: string}}
 */
export function selo(chave) {
  const r = regua(chave);
  if (r.tem) {
    // O limiar sai de `limiarEmTexto()` e não de `r.meta` cru: `ctrPorPosicao` e `ctrGap` têm
    // `meta: null` — a régua das duas é uma TABELA — e a formatação antiga devolvia string VAZIA
    // para as duas. Duas das sete "réguas publicadas" não publicavam limiar nenhum, carregando o
    // mesmo selo das outras cinco. A função também traz a SERP que a régua julga e a idade dela
    // (FR-008), que não apareciam na tela.
    const limiar = ` · ${limiarEmTexto(chave)}`;
    return {
      marca: "◆",
      rotulo: "régua publicada",
      detalhe: `${r.fonte.fonte}${limiar} · ${r.fonte.recorte} · acessado em ${r.fonte.acessadoEm}`,
      url: r.fonte.url,
    };
  }
  const ROTULO = {
    recusa: "sem fonte",
    semColetor: "sem coletor",
    norma: "norma, não régua",
    procedimento: "procedimento",
  };
  // `procedimento` é o único tipo do catálogo SEM campo `motivo` — e a ausência lá é correta: não há
  // o que justificar, um checklist não tem limiar por natureza. Mas um painel mudo é indistinguível
  // de um painel que ninguém preencheu, então a frase nasce aqui, na camada que apresenta, e não
  // como `motivo` inventado em `gsc-delta.mjs`, que outras cinco telas leem.
  const detalhe =
    r.motivo ||
    (r.natureza === "procedimento"
      ? "roteiro de auditoria, não medida: não existe limiar de um checklist — ele é seguido ou não é"
      : "");
  return { marca: "◇", rotulo: ROTULO[r.natureza] ?? r.natureza, detalhe };
}

/**
 * Id estável e curto para um nó — o Mind Elixir exige `id` único e o usa para selecionar.
 *
 * O sufixo de hash não é enfeite. Sem ele, `slice(60)` cortava "1. KPIs Técnicas…" e
 * "1. KPIs Técnicas… › Core Web Vitals Pass Rate" no MESMO prefixo, e o grupo pai e o filho saíam com
 * o id idêntico — dois nós, um id, e o clique num selecionava o outro. Truncar para caber é onde
 * colisão de id nasce, e ela não aparece em build nem em render: aparece no clique.
 */
const id = (...partes) => {
  const cru = partes.join("-");
  let h = 0;
  for (let i = 0; i < cru.length; i++) h = (Math.imul(31, h) + cru.charCodeAt(i)) | 0;
  const legivel = cru.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 48);
  return `${legivel || "n"}-${(h >>> 0).toString(36)}`;
};

/**
 * A forma de um nó do Mind Elixir, declarada aqui e não importada da biblioteca.
 *
 * O tipo real (`NodeObj`) vive em `mind-elixir`, e importá-lo aqui amarraria lógica pura ao pacote
 * — a borda `.tsx` aceita este objeto por estrutura, que é o contrato que importa. `id` e `topic`
 * são obrigatórios: sem eles a lib renderiza um nó anônimo e a seleção não acha o nó de volta.
 *
 * @typedef {{
 *   id: string, topic: string, note?: string, tags?: string[], expanded?: boolean,
 *   branchColor?: string, style?: Record<string, string>,
 *   metadata?: Record<string, unknown>, children?: NoDoMapa[]
 * }} NoDoMapa
 */

/**
 * Converte um nó de detalhe do board na forma do Mind Elixir, recursivamente.
 *
 * @param {Detalhe} d
 * @param {string} prefixo
 * @param {number} i
 * @returns {NoDoMapa}
 */
function noDeDetalhe(d, prefixo, i, div) {
  /** @type {NoDoMapa} */
  const no = { id: id(prefixo, "d", String(i)), topic: d.rotulo };
  if (d.nota) no.note = d.nota;
  // A divergência entra como TAG, não só como nota: tag a lib desenha ao lado do rótulo, nota exige
  // clique. O defeito que isto conserta era exatamente esse — o número do board visível em corpo
  // grande e o do hub atrás de um clique no pai.
  if (div && d.rotulo === div.no) {
    no.tags = [div.tag];
    no.note = no.note ? `${no.note} — ${div.nota}` : div.nota;
  }
  if (d.filhos?.length) no.children = d.filhos.map((f, j) => noDeDetalhe(f, `${prefixo}-${i}`, j, div));
  return no;
}

/**
 * O board inteiro na forma que o Mind Elixir consome (`MindElixirData`).
 *
 * A raiz é GSC e não OKR — o board tem OKR acima, com GSC como filho ÚNICO. Um anel com um filho só
 * não codifica nada e ainda empurra os quatro ramos um nível para fora, que num mapa radial é o
 * espaço que mais custa. A relação com o OKR fica escrita na tela, onde ela informa; no desenho ela
 * só gastaria raio.
 *
 * Cada folha carrega, ALÉM do nome do board: o selo de procedência como tag visível, o motivo no
 * `note`, e `metadata` com a chave do catálogo — é por ela que a tela liga o nó selecionado ao
 * veredito, sem ter que casar por string de rótulo.
 *
 * @returns {{nodeData: NoDoMapa}}
 */
export function mapaDoBoard() {
  const chaves = Object.keys(CATALOGO);

  const ramos = RAMOS.map((ramo) => {
    const doRamo = chaves.filter((k) => CATALOGO[k].ramo === ramo.id);

    // Os grupos nascem do CAMINHO declarado em GRUPOS, na ordem em que a primeira folha de cada um
    // aparece no catálogo. Ordem de irmão é informação (a numeração do board é a ordem de leitura),
    // e uma ordenação alfabética aqui embaralharia "1. KPIs Técnicas" com "4. KPIs de Autoridade".
    /** @type {NoDoMapa[]} */
    const filhos = [];
    /** @type {Map<string, NoDoMapa>} */
    const porCaminho = new Map();

    for (const chave of doRamo) {
      const caminho = GRUPOS[chave] ?? [];
      let destino = filhos;
      let acumulado = "";

      for (const nome of caminho) {
        acumulado = acumulado ? `${acumulado} › ${nome}` : nome;
        let grupo = porCaminho.get(acumulado);
        if (!grupo) {
          // Grupo nasce FECHADO. Medido em 19/09/2026: com os 4 grupos de POSIÇÃO MÉDIA abertos o
          // ramo sozinho empilhava 14 folhas e o mapa abria com 12 dos 44 nós dentro da caixa.
          // Fechado, o ramo cabe em 4 rótulos e o primeiro quadro vira o esqueleto do board — que é
          // o que alguém que chega aqui está procurando: achar o KPI, não ler os 113 de uma vez.
          grupo = { id: id(ramo.id, "g", acumulado), topic: nome, expanded: false, children: [] };
          const nota = NOTA_DO_GRUPO[nome];
          if (nota) grupo.note = nota;
          porCaminho.set(acumulado, grupo);
          destino.push(grupo);
        }
        destino = /** @type {NoDoMapa[]} */ (grupo.children);
      }

      const s = selo(chave);
      const b = BOARD[chave];
      destino.push({
        id: chave,
        topic: b.titulo,
        tags: [`${s.marca} ${s.rotulo}`, ...(DIVERGENCIAS[chave] ? [DIVERGENCIAS[chave].tag] : [])],
        // O `note` da folha é o VEREDITO do hub, nunca a prosa do board: a prosa vive nos filhos,
        // e repeti-la aqui faria o painel dizer duas vezes a mesma coisa no caminho de leitura.
        note: [s.detalhe, RESSALVA_DO_COLETOR[chave] && `⚠ o coletor ${RESSALVA_DO_COLETOR[chave]}`]
          .filter(Boolean)
          .join(" · "),
        // Tudo o que o painel precisa viaja NO NÓ. A alternativa seria o painel casar o nó
        // selecionado com uma segunda tabela por rótulo — e rótulo é o que mais muda. `medidoPor`
        // ausente é informação, não lacuna: é a folha que nenhum coletor do hub mede.
        metadata: {
          chave,
          ramo: ramo.id,
          selo: s.rotulo,
          marca: s.marca,
          url: s.url ?? null,
          medidoPor: MEDIDO_POR[chave] ?? null,
        },
        expanded: false,
        children: b.detalhe.map((d, i) => noDeDetalhe(d, chave, i, DIVERGENCIAS[chave])),
      });
    }

    return {
      id: ramo.id,
      topic: ramo.nome,
      branchColor: ramo.cor,
      style: { color: ramo.cor, fontWeight: "600" },
      expanded: true,
      children: filhos,
    };
  });

  return { nodeData: { id: "gsc", topic: "GSC", children: ramos } };
}
