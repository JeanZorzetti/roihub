// O pareamento balizador × real — o terceiro veredito da tela `/gsc/[slug]` (estudo de 19/09/2026).
//
// A §7 (`lib/okr.mjs`) diz QUE um fator está zerado. A régua de mercado (`lib/benchmark.mjs`) diz
// do tamanho de quê, num degrau do FUNIL. Este arquivo faz a mesma pergunta para as folhas do
// board de GSC: para cada KPI, o que a régua espera, o que nós medimos, e qual a distância.
//
// ⚠️ O QUE ESTE ARQUIVO NÃO FAZ, E POR QUÊ
//
// Não soma deltas, não compõe dois KPIs, e não projeta receita. Os degraus de busca NÃO são
// independentes: corrigir CTR muda posição média, que muda impressões, que muda o denominador do
// KPI seguinte. Somar os ganhos individuais — mesmo sem multiplicar nada — já conta o mesmo clique
// duas vezes. É a barra de erro de 56× entrando pela porta da adição em vez da multiplicação.
//
// `ordenar()` devolve uma FILA DE TRABALHO, nunca um total. Não existe função de soma aqui, e a
// ausência é proposital: `test/gsc-delta.test.mjs` reprova quem adicionar uma.
//
// A moeda do delta (decisão do dono, 19/09/2026):
//   `cliques` — só onde a conversão é aritmética de UM degrau, sem coeficiente inventado.
//   `pp`      — pontos percentuais, fiel à métrica, para todo o resto.
// As duas NUNCA na mesma coluna sem rótulo. `moeda` é campo obrigatório de toda linha com delta,
// e a tela imprime a fronteira: `pp` não é ordenável contra `cliques` e não finge ser.
//
// `.mjs` puro por decisão da constituição (III): pareamento testável sem subir o Next.

import { ehApurado } from "./funil.mjs";
import { benchmark as ctrEsperado, cliquesNaoCapturados } from "./kpis-busca.mjs";

/**
 * @typedef {{ tipo: "regua", fonte: string, url: string, acessadoEm: string, recorte: string,
 *             media?: number, elite?: number, limite?: number, unidade?: string,
 *             medidaEm?: string, cadencia?: string, serp?: string, serpDaFonte?: string }} Regua
 * @typedef {{ tipo: "recusa", motivo: string }} Recusa
 * @typedef {{ tipo: "semColetor", motivo: string }} SemColetor
 * @typedef {{ tipo: "norma", motivo: string }} Norma
 * @typedef {{ tipo: "procedimento" }} Procedimento
 *
 * Cinco tipos e não uma flag booleana `temRegua`, pelo mesmo motivo que `benchmark.mjs` separou
 * `Linha` de `Recusa`: sem eles, as 25 folhas sem veredito devolviam a MESMA frase por razões
 * diferentes, e quem lê a tela não distinguiria "ninguém publica isso" de "falta ligar a fonte" —
 * e os dois pedem trabalho oposto. `motivo` é obrigatório em quem não tem régua: é o texto que vai
 * para a tela no lugar do número.
 */

const ACESSO = "2026-09-19";

/**
 * O piso de CTR por posição — e por que ele NÃO é a First Page Sage, embora a cite.
 *
 * A auditoria de 19/09/2026 abriu a fonte e mediu a distância: onde a FPS publica 39,8% na posição
 * 1, `BENCHMARK` cobra 25%. Declarar a FPS como FONTE da régua era afirmar que a régua reproduz a
 * fonte — e ela não reproduz: cobra menos, em toda faixa. Uma URL na posição 1 com 26% passava no
 * hub citando uma página que mede 39,8%.
 *
 * Os dois números medem SERPs diferentes, e é essa a razão de a distância existir e de ela FICAR: a
 * FPS mede SERP limpa (sem AI Overview, sem featured snippet, sem local pack) e a própria FPS
 * reporta AI Overview em ~31% das SERPs. O CTR que o GSC devolve é apurado sobre a SERP real, COM
 * esses elementos. Julgar o CTR real contra o piso da SERP limpa reprovaria o site pelo que o Google
 * pôs acima dele — falso-negativo, a mesma classe de erro que o TTFB 600→800 removeu no mesmo dia.
 *
 * Decisão do dono (19/09/2026): o piso fica onde está; o que muda é parar de creditá-lo à FPS. Ela
 * segue linkada como REFERÊNCIA de ordem de grandeza, com o que de fato publica declarado ao lado —
 * inclusive a data real ("Last Updated: May 28, 2025", não 2025-12-23) e a ausência de país, que a
 * versão anterior deste recorte afirmava sem a fonte sustentar.
 *
 * 033/FR-008 — `medidaEm`, `serp`, `serpDaFonte` e `cadencia` são campos ESTRUTURADOS, não mais só
 * prosa dentro de `recorte`: campo estruturado é o que permite um teste reprovar régua sem
 * `medidaEm`; prosa não. Dois campos de SERP porque são dois FATOS — a que a referência mediu e a
 * que esta régua JULGA — e inverter os dois afirmaria sobre a régua o contrário do que foi medido.
 */
const CTR_PISO = {
  fonte: "piso do hub, aferido contra a First Page Sage — que publica mais",
  url: "https://firstpagesage.com/reports/google-click-through-rates-ctrs-by-ranking-position/",
  acessadoEm: ACESSO,
  medidaEm: "2025-05-28",
  cadencia: "mensal",
  serp: "SERP real do Search Console, com resposta gerada por IA em ~31% das buscas",
  serpDaFonte: "SERP limpa, sem resposta gerada por IA",
  recorte:
    "a referência mede SERP LIMPA e publica 39,8% na posição 1, 18,7% na 2 e 10,2% na 3 (atualizada em 2025-05-28, sem país declarado); o hub cobra 25/13/8% de propósito, porque o CTR do GSC é apurado na SERP real, com AI Overview em ~31% delas · sem segmentação por vertical",
};

const WEBDEV = {
  fonte: "Google / web.dev — Core Web Vitals",
  url: "https://web.dev/articles/vitals",
  acessadoEm: ACESSO,
  recorte: "dados de campo (CrUX) · percentil 75 de carregamentos · por URL",
};

/**
 * O TTFB tem página e limiar próprios, separados dos três Core Web Vitals — e a separação é do
 * Google, não nossa: a própria página diz que TTFB NÃO é Core Web Vital e que o limiar é guia
 * aproximado, porque um site renderizado no servidor pode ter TTFB maior e LCP melhor que um SPA.
 *
 * Por isso ele não herda `WEBDEV`: espalhar o recorte dos vitais sobre uma métrica que a fonte
 * classifica de outro jeito seria emprestar autoridade que ela mesma recusou.
 */
const WEBDEV_TTFB = {
  fonte: "Google / web.dev — Time to First Byte",
  url: "https://web.dev/articles/ttfb",
  acessadoEm: ACESSO,
  recorte:
    "percentil 75 · guia aproximado declarado pela própria fonte · NÃO é Core Web Vital · página atualizada em 2025-11-18",
};

const CAMPO =
  "lib/crux.mjs#vitalPorOrigem (as origens declaradas, a atual primeiro) + lib/crux.mjs#celulasDeVitais (a ficha, só a origem do card)";

/**
 * ONDE CADA FOLHA JÁ É MEDIDA HOJE — e, por omissão, quais realmente não têm coletor.
 *
 * Este mapa nasceu de um erro. O inventário de 19/09/2026 marcou `profundidadeClique` e
 * `linksInternos` como "sem coletor" porque o levantamento leu onze arquivos de `lib/` e NÃO leu
 * `grafo.mjs` — que media os dois desde sempre. O rótulo errado mandaria ligar uma fonte já ligada.
 *
 * A proteção não é lembrar de olhar: é `test/gsc-delta.test.mjs` reprovar qualquer folha marcada
 * `semColetor` que apareça aqui. Quem for ligar um coletor descobre no `npm test` que ele existe.
 *
 * O valor é `arquivo#simbolo`, para a tela e para quem vier depois achar sem grep.
 */
export const MEDIDO_POR = {
  // 032: era `porUrl+benchmark`. `porUrl` foi DELETADA — ela somava as linhas por termo para
  // formar a URL, e era essa soma que alimentava o CTR por posição com 42,1% das impressões do
  // site. Hoje a régua é aplicada linha a linha sobre a leitura por página, dentro de `ctrGap`.
  ctrPorPosicao: "lib/kpis-busca.mjs#conformidadeDeCtr (ctr + veredito por intervalo, linha a linha)",
  // `penetracaoTop3` SAIU em 19/09/2026 e VOLTOU em 20/09 medindo outra coisa. Ela apontava para
  // `impressoesNoTop3`, que soma IMPRESSÕES; a folha conta TERMOS ("termos com posição ≤ 3 ÷ total
  // monitorado"). São grandezas diferentes com metas diferentes — e a prova estava no próprio mapa:
  // `impressoesTop3` credita o MESMO coletor com meta de 40% a 50%, contra os 20% a 30% desta.
  // O que faltava era o denominador, não o coletor: o hub não mantinha inventário monitorado. A 034
  // criou `data/inventario-de-termos.json` (725 termos declarados e congelados para a Atma), e o
  // coletor novo conta TERMO contra ele, na dimensão `query` — a que o Google agrega por termo.
  // A folha segue `◇ sem fonte`: tem número, não tem régua. A meta de 20% a 30% continua sendo do
  // board, não medida de mercado, e `balizador.tipo` continua `recusa`.
  penetracaoTop3: "lib/kpis-busca.mjs#penetracaoNoTop3 (termos do inventário em posição ≤ 3, dimensão query)",
  // 035 — trocou de FUNÇÃO junto com a dimensão. `strikingDistance` lê `["query","page"]` e devolve
  // um par consulta×página por linha; é o que `/okr/atma/aquisicao` consome, porque lá a lista é
  // fila de trabalho e precisa nomear a página a reforçar. A folha do board conta CONSULTA
  // ("número absoluto de consultas entre 4,0 e 10,9"), e consulta se conta na dimensão que o Google
  // agrega por consulta: 344 aqui contra 362 lá, na mesma janela. Apontar para a função que a tela
  // NÃO usa é o defeito que a 034 corrigiu na folha vizinha.
  strikingDistance: "lib/kpis-busca.mjs#strikingDistancePorTermo (consultas na faixa 4,0–10,9, dimensão query, marca fora)",
  crescimentoNaoMarca: "lib/marca.mjs#crescimentoNaoMarca",
  impressoesTop3: "lib/kpis-busca.mjs#impressoesNoTop3",
  ctrGap: "lib/kpis-busca.mjs#conformidadeDeCtr",
  conformidadeUrls: "lib/kpis-busca.mjs#conformidadeDeCtr.porPagina.fracao",
  // 039 — DOIS coletores, e a ordem é a da definição do board. `taxaCobertura` sozinha creditava
  // esta folha ao parser de JSON-LD: ela responde "válido e sem erro de sintaxe", que é a primeira
  // metade, e nunca "elegível a rich snippet" com "0 erros críticos no relatório de Resultados
  // Enriquecidos do Search Console", que é a segunda e é a que dá nome à folha. Na Atma as duas
  // divergem inteiras — 100% por sintaxe, 94,4% por elegibilidade e ZERO contra os tipos que a meta
  // nomeia —, então apontar só para uma creditaria a folha à função que a tela NÃO usa para abrir o
  // nó, que é o defeito que a 034 corrigiu em `penetracaoTop3`.
  schema:
    "lib/indexacao-corrida.mjs#coberturaRich (relatório de resultado enriquecido, URL Inspection) + lib/grafo.mjs#taxaCobertura (sintaxe do JSON-LD servido)",
  larguraTitulo: "lib/grafo.mjs#taxaIntegridadeDoTitulo",
  termoNoTitulo: "lib/pagina.mjs#posicaoDoTermo + lib/grafo.mjs#TERMO_ATE",
  // 041 — DOIS coletores, como a folha do schema. `taxaAlinhamento` sozinha responde "o título tem
  // modificador", que é metade do que o board define: o nome da folha é Search Intent MATCH, e
  // match precisa dos dois lados. `correspondenciaDeIntencao` traz o outro, cruzando a intenção da
  // consulta que traz a impressão com a do título. Creditar só a primeira apontaria para a função
  // que não responde ao nome da folha — o defeito que a 034 corrigiu em `penetracaoTop3`.
  intencao:
    "lib/grafo.mjs#taxaAlinhamento (modificador no título) + lib/grafo.mjs#correspondenciaDeIntencao (intenção da busca × do título)",
  // 042 — os quatro vitais creditados à função que ABRE o nó no mapa. `celulasDeVitais` pergunta
  // só pela origem do card, e desde a troca de domínio de 11/09 a do card dá 404 enquanto a
  // anterior tem 28 dias de campo: creditar só a ela apontaria para a leitura que o mapa NÃO usa,
  // o defeito que a 034 corrigiu em `penetracaoTop3`. A ficha continua nela, e o crédito diz isso.
  lcp: CAMPO,
  inp: CAMPO,
  cls: CAMPO,
  urlsBoas: "lib/crux.ts#lerPassRate (URLs prioritárias) + lib/crux.mjs#passRate (a fração)",
  ttfb: CAMPO,
  indexacaoLimpa: "lib/indexacao.mjs#estaIndexada",
  profundidadeClique: "lib/grafo.mjs#profundidades",
  frescor: "lib/grafo.mjs#cadencia",
  canibalizacao: "lib/kpis-busca.mjs#canibalizacao",
  linksInternos: "lib/grafo.mjs#densidades",
  buscasDeMarca: "lib/marca.mjs#razaoDeMarca",
  consultasUnicas: "lib/kpis-busca.mjs#consultasUnicas",
  top20: "lib/kpis-busca.mjs#noTop20",
  queryToPage: "lib/kpis-busca.mjs#queryToPageRatio",
  activeIndexRatio: "lib/kpis-busca.mjs#activeIndexRatio",
};

/**
 * O que o coletor NÃO entrega, por folha — a ressalva que viaja junto com o "Medido em".
 *
 * `consultasUnicas` e `queryToPageRatio` devolvem `{ valor, piso: true }` porque a dimensão `query`
 * do GSC OMITE as consultas raras: o número é sempre um piso, nunca o total. O código carrega a
 * flag justamente para a tela não publicar o piso como se fosse a contagem — e até 19/09/2026 a
 * flag morria na borda: `/gsc` e `/gsc/mapa` imprimiam "Medido em …#consultasUnicas" e paravam aí.
 *
 * `noTop20` não carrega a flag no retorno e herda a MESMA limitação: ele conta sobre as linhas que
 * a dimensão `query` devolveu.
 *
 * 032 — `activeIndexRatio` SAIU dessa lista. Ele conta URLs, e desde a 032 conta sobre a leitura por
 * página, que é completa: a omissão das raras não o alcança mais. Deixá-lo citando a dimensão
 * `query` mandaria o próximo consertar um piso que não existe — e mapa que descreve o coletor
 * errado manda ligar coletor que já está ligado. O que continua verdadeiro para ele é só a janela.
 *
 * A segunda ressalva é de JANELA: o board define "≥ 1 impressão em 28 dias" para duas destas
 * folhas, e as funções apontadas são PURAS — não conhecem janela nenhuma, quem recorta é a borda
 * que as chama. Creditar o coletor sem isso é publicar a janela do board como se a função a
 * garantisse.
 */
const DIMENSAO_QUERY = "devolve um PISO, nunca o total: a dimensão `query` do GSC omite as consultas raras";
const A_JANELA = "a janela de 28 dias do board é recortada pela borda, não pela função pura";
const E_A_JANELA = ` — e ${A_JANELA}`;
export const RESSALVA_DO_COLETOR = {
  consultasUnicas: DIMENSAO_QUERY + E_A_JANELA,
  queryToPage: DIMENSAO_QUERY + " — o numerador é `consultasUnicas` e herda o piso dele",
  top20: DIMENSAO_QUERY,
  // 032 — só a janela sobrou: a omissão das raras não alcança a leitura por página.
  activeIndexRatio: A_JANELA,
};

/**
 * Os números que JÁ estão no código sem nenhuma fonte por trás — herdados do board, não de estudo.
 *
 * Não estão errados: estão SEM ORIGEM, que é diferente. Ficam listados para que a tela possa
 * marcá-los como editoriais em vez de exibi-los com a mesma tipografia de LCP 2,5s, e para que
 * mudá-los seja decisão consciente em vez de ajuste fino de constante.
 */
export const EDITORIAIS = {
  "lib/grafo.mjs#TITULO_PX_MIN": "500px: o teto (580) tem fonte, o piso não — título curto demais é prevenição, não medição",
  "lib/grafo.mjs#TERMO_ATE": "35 caracteres: sem origem; o estudo de títulos mede correspondência com o H1, nunca posição",
  "lib/grafo.mjs#LINKS_POR_MIL_MIN": "3 links por 1.000 palavras: piso editorial do dono (19/09/2026) — nenhum estudo prescreve contagem",
  "lib/grafo.mjs#LINKS_POR_MIL_MAX": "10 por 1.000 palavras: teto editorial — existe para acusar excesso, que o piso sozinho não via",
  "lib/grafo.mjs#LINKS_MINIMO_ABSOLUTO": "1 link: página curta que a densidade absolveria (250 palavras × 3/mil = 0,75) segue sendo folha do grafo",
  "lib/grafo.mjs#LINKS_CONTEXTUAIS_MIN": "5 links: limiar antigo, mantido para a ordenação da periferia — o veredito passou para a densidade",
  "lib/grafo.mjs#CADENCIA_POR_INTENCAO": "6 meses para comercial, 12 para informacional: política editorial do dono (19/09/2026), não régua de mercado",
  "lib/grafo.mjs#PROFUNDIDADE_MAX": "4 cliques: o board disse 3 — divergência não decidida, e nenhum dos dois tem fonte",
  "lib/grafo.mjs#CADENCIA_MESES": "12 meses: piso conservador, usado quando a página não tem intenção classificada",
  "lib/crux.mjs#VITAIS.ttfb.ideal": "300ms como ‘ideal’: o limite de 800ms tem fonte, o ideal não — o Google não publica alvo abaixo do limiar",
};

/**
 * As 32 folhas do board `okr-Saw2eoSKZDPLJAk6xeDBuS`, na íntegra.
 *
 * Nenhuma foi omitida, INCLUSIVE as que nunca vão emitir veredito. Folha ausente do catálogo é
 * indistinguível de folha esquecida, e foi assim que o board passou duas semanas sendo reconstruído
 * do zero a cada tentativa. O que não tem régua aparece na tela dizendo por que não tem.
 *
 * Os VALORES de CTR não moram aqui: `ctrEsperado()` é importado de `kpis-busca.mjs`. Duas tabelas
 * de CTR no mesmo repo seria uma delas ficando para trás na primeira correção — a mesma frase que
 * `okr.mjs` escreveu sobre a regra de `0/0`. Este arquivo acrescenta a FONTE que faltava lá, não
 * uma segunda cópia dos números.
 *
 * @type {Record<string, {nome: string, ramo: string, balizador: Regua|Recusa|SemColetor|Norma|Procedimento}>}
 */
export const CATALOGO = {
  // ---------- ramo CLIQUE ----------
  ctrPorPosicao: {
    nome: "CTR relativo por posição",
    ramo: "clique",
    balizador: { tipo: "regua", ...CTR_PISO, media: null, elite: null, unidade: "ctr-por-posicao" },
  },
  penetracaoTop3: {
    nome: "Taxa de penetração no Top 3",
    ramo: "clique",
    balizador: {
      tipo: "recusa",
      motivo:
        "inventário de palavras-chave é definido por quem mede; sem denominador comum entre sites, nenhuma amostra publica a distribuição",
    },
  },
  strikingDistance: {
    nome: "Volume em striking distance (4 a 10)",
    ramo: "clique",
    balizador: {
      tipo: "recusa",
      motivo:
        "a taxa de promoção ao Top 3 depende da dificuldade do termo e do esforço aplicado; nenhum estudo público controla as duas variáveis",
    },
  },
  crescimentoNaoMarca: {
    nome: "Crescimento de impressões não-marca",
    ramo: "clique",
    balizador: {
      tipo: "recusa",
      motivo:
        "taxa de crescimento é função da base, não do mercado: 1.000 e 1.000.000 de impressões não compartilham faixa — e é previsão, que a R6 recusa por natureza",
    },
  },
  checklistGsc: { nome: "Checklist para auditar o GSC", ramo: "clique", balizador: { tipo: "procedimento" } },

  // ---------- ramo CTR ----------
  impressoesTop3: {
    nome: "% de impressões concentradas no Top 3",
    ramo: "ctr",
    balizador: {
      tipo: "recusa",
      motivo:
        "mede concentração, que depende do mix de termos de marca: marca forte bate a meta sem nenhum mérito de SEO",
    },
  },
  ctrGap: {
    nome: "Conformidade com o benchmark de CTR",
    ramo: "ctr",
    balizador: { tipo: "regua", ...CTR_PISO, unidade: "cliques" },
  },
  conformidadeUrls: {
    nome: "% de URLs acima do benchmark",
    ramo: "ctr",
    balizador: {
      tipo: "recusa",
      motivo:
        "o benchmark entra (ctrGap); QUANTAS URLs devem superá-lo exigiria o GSC de terceiros, que ninguém publica",
    },
  },
  schema: {
    nome: "Cobertura de dados estruturados",
    ramo: "ctr",
    balizador: { tipo: "norma", motivo: "válido ou inválido: não existe média…elite de binário — é validador, não régua" },
  },
  larguraTitulo: {
    nome: "Integridade do título (largura)",
    ramo: "ctr",
    balizador: {
      tipo: "regua",
      fonte: "largura de truncamento — 580px é a margem, não o número do estudo linkado",
      url: "https://zyppy.com/seo/google-title-rewrite-study/",
      acessadoEm: ACESSO,
      // O estudo linkado diz "Google typically limits titles to 600 pixels". O 580 é a zona segura
      // abaixo do corte, convergente entre fontes secundárias — defensável como número, mas a URL
      // que a tela oferece como "ver a fonte" NÃO o contém, e dizer "convergente entre fontes"
      // linkando a única que diverge era a tela emprestando autoridade que a página não dá.
      recorte:
        "desktop · móvel comporta um pouco mais · o estudo linkado publica o corte em 600px e o 580 é a margem abaixo dele · piso de 500px do board é editorial, não tem fonte",
      limite: 580,
      unidade: "px",
    },
  },
  reescritaTitulo: {
    nome: "Taxa de reescrita pelo Google",
    ramo: "ctr",
    balizador: {
      tipo: "recusa",
      motivo:
        "a meta do board (<15%) está abaixo do melhor caso mundial: Zyppy mediu 61,6% de base em 80.959 títulos, e o piso observado é 39% na faixa de 51-60 caracteres",
    },
  },
  termoNoTitulo: {
    nome: "Termo nos 35 primeiros caracteres",
    ramo: "ctr",
    balizador: {
      tipo: "recusa",
      motivo: "número sem origem: o estudo de títulos mede correspondência com o H1, nunca posição em caracteres",
    },
  },
  intencao: {
    nome: "Alinhamento de intenção",
    ramo: "ctr",
    balizador: { tipo: "norma", motivo: "tem ou não tem o modificador: sem faixa de mercado por trás" },
  },

  // ---------- ramo POSIÇÃO MÉDIA ----------
  lcp: { nome: "LCP", ramo: "posicao", balizador: { tipo: "regua", ...WEBDEV, limite: 2500, unidade: "ms" } },
  inp: { nome: "INP", ramo: "posicao", balizador: { tipo: "regua", ...WEBDEV, limite: 200, unidade: "ms" } },
  cls: { nome: "CLS", ramo: "posicao", balizador: { tipo: "regua", ...WEBDEV, limite: 0.1, unidade: null } },
  urlsBoas: {
    nome: "% de URLs com status Bom",
    ramo: "posicao",
    balizador: {
      tipo: "recusa",
      motivo:
        "agregação inventada: o Google define p75 por URL; 'percentual de URLs aprovadas' é outra métrica e não tem limiar publicado",
    },
  },
  ttfb: {
    nome: "TTFB",
    ramo: "posicao",
    balizador: { tipo: "regua", ...WEBDEV_TTFB, limite: 800, unidade: "ms" },
  },
  indexacaoLimpa: {
    nome: "Taxa de indexação limpa",
    ramo: "posicao",
    balizador: {
      tipo: "recusa",
      motivo:
        "o denominador é o que você submete no sitemap: quem submete só o que já indexa bate 100% sem fazer nada",
    },
  },
  rejeicaoRastreio: {
    nome: "Taxa de rejeição de rastreio",
    ramo: "posicao",
    balizador: { tipo: "semColetor", motivo: "o hub não lê o relatório de cobertura do GSC — e a faixa também não é publicada" },
  },
  profundidadeClique: {
    nome: "Profundidade de clique",
    ramo: "posicao",
    balizador: {
      tipo: "recusa",
      motivo:
        "a direção é documentada (mais fundo, menos rastreio), mas a faixa não: o 3 do board é heurística de vendor sem distribuição — e `grafo.mjs` usa 4, uma divergência board × código que ninguém decidiu",
    },
  },
  coberturaSemantica: {
    nome: "Cobertura semântica / entidades",
    ramo: "posicao",
    balizador: { tipo: "recusa", motivo: "'sub-intenção mandatória' não tem definição operacional: sem definição não há o que medir" },
  },
  frescor: {
    nome: "Cadência de atualização",
    ramo: "posicao",
    balizador: {
      tipo: "recusa",
      motivo:
        "a cadência aceitável depende da volatilidade do tema e nenhum estudo publica faixa — desde 19/09/2026 o hub usa política editorial por intenção (6 meses para comercial, 12 para informacional), que é decisão declarada e não régua",
    },
  },
  canibalizacao: {
    nome: "Canibalização interna",
    ramo: "posicao",
    balizador: { tipo: "norma", motivo: "zero não é elite, é ausência de defeito: não há quartil de binário" },
  },
  linksInternos: {
    nome: "Densidade de links internos contextuais",
    ramo: "posicao",
    balizador: {
      tipo: "recusa",
      motivo:
        "armadilha de recorte: o maior estudo (23 milhões de links) mede DIVERSIDADE DE ÂNCORA, não contagem — citá-lo aqui seria dado real sustentando número inventado, com a URL conferindo; desde 19/09/2026 a faixa é por 1.000 palavras e segue editorial, e a variedade de âncora é CONTADA sem limiar",
    },
  },
  referringDomains: {
    nome: "Velocidade de domínios referenciadores",
    ramo: "posicao",
    balizador: { tipo: "semColetor", motivo: "não existe fonte de backlink no hub: nem balizador, nem lado real" },
  },
  buscasDeMarca: {
    nome: "Proporção de buscas de marca",
    ramo: "posicao",
    balizador: { tipo: "recusa", motivo: "'crescente' é direção, não faixa: medimos a razão, não há contra o que compará-la" },
  },

  // ---------- ramo IMPRESSÕES ----------
  consultasUnicas: {
    nome: "Footprint de consultas únicas",
    ramo: "impressoes",
    balizador: { tipo: "recusa", motivo: "função da base: site novo cresce 200% e maduro cresce 3%, e os dois podem ir bem" },
  },
  top20: {
    nome: "Palavras-chave no Top 20",
    ramo: "impressoes",
    balizador: { tipo: "recusa", motivo: "'catálogo' é definido por quem mede: mesma objeção estrutural da penetração no Top 3" },
  },
  queryToPage: {
    nome: "Consultas por página",
    ramo: "impressoes",
    balizador: {
      tipo: "recusa",
      motivo:
        "as duas pontas da divisão variam juntas (URLs indexadas e tamanho do nicho), então a faixa é instável mesmo dentro de um único site",
    },
  },
  activeIndexRatio: {
    nome: "Taxa de páginas geradoras de impressão",
    ramo: "impressoes",
    balizador: {
      tipo: "recusa",
      motivo: "muda com a idade do site: quem publica rápido carrega URLs novas ainda sem impressão e é reprovado por estar crescendo",
    },
  },
  tamBusca: {
    nome: "Cobertura do TAM de busca",
    ramo: "impressoes",
    balizador: { tipo: "semColetor", motivo: "o GSC informa o que o site recebeu, nunca o volume do mercado" },
  },
};

/**
 * O selo de uma leitura, na taxonomia da 028 (`app/okr/[slug]/aquisicao/page.tsx`).
 *
 * NENHUM selo novo nasce aqui. A primeira versão deste arquivo inventou oito estados próprios
 * (`cobre`, `abaixo`, `naoApurado`, `semRegua`…) antes de ler a tela — uma segunda taxonomia para
 * o mesmo lugar, que é o defeito que `lib/janelas.mjs` proibiu para janelas. Os selos são dela; a
 * nuance vai em `palavra`, como a tela já faz (`"piso, não total"`, `"contagem, não razão"`).
 *
 * @typedef {"dado"|"fim"|"piso"|"sem"|"cega"} Selo
 */

/**
 * O estado da MEDIDA — e só dele. Os cinco selos da 028 descrevem o lado real: `sem` é sem amostra,
 * `piso` é amostra rasa, `cega` é instrumento quebrado. Nenhum deles fala do lado RÉGUA, e é por
 * isso que "o board mandou 20-30% mas ninguém publica essa faixa" não cabe em nenhum: é eixo
 * ortogonal, e sai por `regua()`, não por selo.
 *
 * `cega` fica reservado ao que a tela já marca assim — crawl cego, consulta que falhou — e NUNCA
 * é usado para coletor inexistente: `cega` é o único vermelho da tela, e "não existe fonte de
 * backlink no hub" é decisão de produto, não instrumento com defeito.
 *
 * 033/FR-009 — o ramo de piso fixo de amostra SAIU do repositório inteiro. A suficiência de
 * amostra de `ctrPorPosicao`/`ctrGap` agora é decidida pelo intervalo de confiança da própria
 * amostra (`lib/intervalo.mjs`), no veredito que `lib/kpis-busca.mjs#conformidadeDeCtr` já
 * devolve — não pelo selo desta função. Ver o histórico do commit para o nome da constante e da
 * função que saíram.
 *
 * @param {import("./funil.mjs").Celula|null} celula
 * @param {{falha?:string|null}} [ctx]
 * @returns {{selo: Selo, palavra?: string}}
 */
export function seloDaMedida(celula, { falha = null } = {}) {
  if (falha) return { selo: "cega", palavra: falha };
  if (!ehApurado(celula)) return { selo: "sem" };
  return { selo: "dado" };
}

/**
 * O estado da RÉGUA — o eixo que a 028 ainda não tinha, porque até 19/09/2026 todo número do board
 * entrava na tela como se fosse régua. O estudo mostrou que 25 das 32 folhas não são.
 *
 * `meta` sai no formato que `<Leitura>` JÁ aceita: número vira tique, par vira faixa na trilha. A
 * tela não precisa de componente novo para exibir faixa — ela já sabe, desde a 028.
 *
 * @param {string} chave
 * @returns {{tem: true, meta: number|[number,number]|null, fonte: Regua}
 *          | {tem: false, motivo: string, natureza: "recusa"|"semColetor"|"norma"|"procedimento"}}
 */
export function regua(chave) {
  const item = CATALOGO[chave];
  if (!item) throw new Error(`KPI fora do catálogo do board: ${chave}`);
  const b = item.balizador;
  if (b.tipo !== "regua") return { tem: false, motivo: b.motivo ?? "", natureza: b.tipo };
  const meta =
    Number.isFinite(b.media) && Number.isFinite(b.elite)
      ? /** @type {[number,number]} */ ([b.media, b.elite])
      : Number.isFinite(b.limite)
        ? b.limite
        : null;
  return { tem: true, meta, fonte: b };
}

/**
 * O limiar da régua em UMA frase — escalar, faixa, ou a tabela quando a régua não é um número.
 *
 * Nasceu porque `/gsc` e `/gsc/mapa` montavam a MESMA string ("· limiar N") cada uma por conta, e as
 * duas calavam no mesmo buraco: `ctrPorPosicao` e `ctrGap` têm `meta: null` — a régua das duas é uma
 * TABELA (`benchmark()`), não um escalar — e nenhuma das telas imprimia limiar algum, enquanto o
 * selo `◆ régua publicada` as igualava às outras cinco. Das 7 folhas com régua, só 5 carregavam um
 * número visível.
 *
 * 033/FR-008 — o sufixo de piso de impressões SAIU (FR-009). No lugar entra a condição sob a qual
 * a régua vale de verdade: a SERP que ela JULGA (`serp`), quando ela foi reconstruída (`medidaEm`)
 * e a idade DERIVADA disso — nunca armazenada, porque idade gravada envelhece em silêncio. Régua
 * publicada sem a condição sob a qual vale é régua de dois anos atrás julgando a busca de hoje.
 *
 * @param {string} chave
 * @returns {string|null} o texto do limiar, ou `null` quando a folha não tem régua
 */
export function limiarEmTexto(chave) {
  const r = regua(chave);
  if (!r.tem) return null;
  const sufixo = r.fonte.serp ? `, julgada contra: ${r.fonte.serp}` + (r.fonte.medidaEm ? ` (régua reconstruída em ${r.fonte.medidaEm}, ${idadeEmMeses(r.fonte.medidaEm)} meses atrás)` : "") : "";
  if (r.meta === null) return "limiar por faixa de posição, em lib/kpis-busca.mjs#BENCHMARK" + sufixo;
  const un = r.fonte.unidade === "ms" || r.fonte.unidade === "px" ? r.fonte.unidade : "";
  const n = (v) => v + un;
  return "limiar " + (Array.isArray(r.meta) ? n(r.meta[0]) + " a " + n(r.meta[1]) : n(r.meta)) + sufixo;
}

/** A idade de uma régua, em meses inteiros, entre `medidaEm` e agora — derivada, nunca gravada
 *  (`data-model.md` §3): idade armazenada envelhece em silêncio. @param {string} medidaEm
 *  @param {number} [agora] */
export function idadeEmMeses(medidaEm, agora = Date.now()) {
  const d = new Date(`${medidaEm}T00:00:00Z`);
  const hoje = new Date(agora);
  let meses = (hoje.getUTCFullYear() - d.getUTCFullYear()) * 12 + (hoje.getUTCMonth() - d.getUTCMonth());
  if (hoje.getUTCDate() < d.getUTCDate()) meses--;
  return Math.max(0, meses);
}

/**
 * Uma linha pareada: medida de um lado, régua do outro, distância no meio quando os DOIS existem.
 *
 * `delta` continua exigindo `moeda` — a fronteira A/B do dono (19/09/2026) não pode ficar
 * implícita. E `delta` só nasce com selo `dado`: amostra rasa ou ausente não emite distância
 * (trava 2 — benchmark não preenche buraco de medição).
 *
 * @param {string} chave
 * @param {import("./funil.mjs").Celula|null} celula
 * @param {{delta?:number, moeda?:"cliques"|"pp"|"ms"|"px"|null, base?:number, falha?:string|null}} [medida]
 */
export function linha(chave, celula, medida = {}) {
  const item = CATALOGO[chave];
  if (!item) throw new Error(`KPI fora do catálogo do board: ${chave}`);
  const { delta = null, moeda = null, base = null, falha = null } = medida;
  const r = regua(chave);
  const { selo, palavra } = seloDaMedida(celula, { falha });

  if (delta !== null && moeda === null) throw new Error(`delta sem moeda em ${chave}: a fronteira A/B não pode ficar implícita`);
  const vale = selo === "dado" && r.tem;
  return {
    chave,
    nome: item.nome,
    ramo: item.ramo,
    real: celula ?? null,
    base,
    selo,
    palavra,
    regua: r,
    delta: vale ? delta : null,
    moeda: vale && delta !== null ? moeda : null,
  };
}

/**
 * A fila de trabalho: o que dói mais primeiro, DENTRO de cada moeda.
 *
 * Não existe ordenação global entre moedas, e a omissão é o ponto: `-8pp` de CTR e `-22pp` de
 * indexação não são comparáveis entre si, e `pp` não é comparável a `cliques` de jeito nenhum.
 * Ordenar tudo numa lista só devolveria uma fila com aparência de prioridade e nenhuma prioridade
 * dentro. A tela imprime os blocos separados, com a fronteira à vista.
 *
 * @param {ReturnType<typeof linha>[]} linhas
 */
export function ordenar(linhas) {
  const porMoeda = new Map();
  for (const l of linhas) {
    if (l.delta === null) continue;
    const e = porMoeda.get(l.moeda) ?? [];
    e.push(l);
    porMoeda.set(l.moeda, e);
  }
  for (const [, e] of porMoeda) e.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const semDelta = linhas.filter((l) => l.delta === null);
  return { porMoeda, semDelta };
}

/** Quantas folhas caem em cada selo, e quantas estão sem régua — os DOIS eixos, separados.
 *  Um número só esconderia que "sem amostra" e "sem régua" pedem trabalho oposto: apurar ×
 *  procurar fonte (ou aceitar que ninguém publica). */
export function resumo(linhas) {
  const porSelo = {};
  const porRegua = {};
  for (const l of linhas) {
    porSelo[l.selo] = (porSelo[l.selo] ?? 0) + 1;
    const k = l.regua.tem ? "comRegua" : l.regua.natureza;
    porRegua[k] = (porRegua[k] ?? 0) + 1;
  }
  return { porSelo, porRegua };
}

export { ctrEsperado, cliquesNaoCapturados };
