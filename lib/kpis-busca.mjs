// Os KPIs de busca do board de OKR (021), na janela de descoberta.
//
// 032 — DUAS famílias, duas leituras. As medidas que afirmam algo sobre uma CONSULTA (`kpisPorTermo`)
// leem as linhas de query+page; as que afirmam algo sobre uma URL (`kpisPorPagina`) leem a leitura
// por página. Não é preferência de forma: a dimensão `query` do Search Console OMITE as consultas
// raras, e medido na Atma em 19/09/2026 ela devolvia 10.395 das 24.664 impressões do site (42,1%) e
// 14 das 29 URLs. Com a família por URL alimentada por ela, o Índice de Conformidade publicava 0%
// sobre 6 URLs avaliadas — porque a home saía na posição 11,82 (fora da faixa do balizador, que
// acaba em 10,9) em vez dos 6,93 reais, e era a única página que atingia o piso.
//
// 033 — o veredito por URL deixou de ser "acima/abaixo de um piso fixo de impressões" e passou a
// ser "o intervalo de confiança de 95% da própria amostra exclui a régua". Ver `lib/intervalo.mjs`.
//
// Módulo PURO: sem process.env, sem pg, sem fetch. Deixou de ser "zero imports" ao passar a
// importar `lib/intervalo.mjs` — que é folha e não arrasta nada além dele mesmo, então
// `scripts/` continua importando este arquivo sem `pg` nem `google-auth-library`. Recebe as
// linhas que a borda já buscou e devolve números — é o que permite testar cada borda de faixa sem
// subir o Next e sem gastar uma requisição no Search Console.

import { wilson, vereditoContraRegua } from "./intervalo.mjs";

/** @typedef {{query: string, page: string, cliques: number, impressoes: number, posicao: number}} LinhaBusca */
/**
 * 032 — a linha da leitura por PÁGINA: uma por caminho, já somada entre os hosts declarados.
 *
 * O campo é `pagina` (e NÃO existe `query`), então as duas formas são disjuntas para o
 * compilador: passar a lista de termos para uma função da família por URL deixa de compilar no
 * chamador tipado, em vez de devolver um número plausível. Era exatamente esse silêncio que
 * publicava "0% das URLs atingem o CTR mínimo" sobre 42,1% das impressões do site.
 */
/** @typedef {{pagina: string, cliques: number, impressoes: number, posicao: number, hosts?: string[]}} LinhaPagina */
/** @typedef {LinhaBusca & {ctr: number|null, benchmark: number|null}} Candidata */

/**
 * CTR mínimo esperado por faixa de posição, direto do board.
 *
 * `ate` é EXCLUSIVO e as faixas são contíguas de propósito: a posição do GSC é uma MÉDIA, então
 * 3,95 e 6,5 existem de verdade. Faixas escritas por inteiro ("4 a 10") deixariam 10,5 fora de
 * tudo, e uma linha sem faixa vira uma linha sem régua.
 */
export const BENCHMARK = [
  { ate: 2, ctr: 0.25 },
  { ate: 3, ctr: 0.13 },
  { ate: 4, ctr: 0.08 },
  { ate: 7, ctr: 0.045 },
  { ate: 11, ctr: 0.02 },
];

/**
 * O piso da posição, ou `null` acima de 10,9.
 *
 * O board DEFINE um piso para a página 2 — "~ 1,5%" para as posições 11 a 20, transcrito em
 * `lib/board-gsc.mjs`. Ele não entra aqui, e a omissão é decisão, não esquecimento: o número não
 * tem fonte (a referência de CTR do hub não publica página 2), e um piso sem fonte aplicado à
 * cauda longa reprovaria a cauda inteira — o CTR Gap passaria a medir o palpite, não o site.
 *
 * `null` e não um número inventado, pelo mesmo motivo que `ctr()` devolve `null` sem impressão:
 * "não há régua aqui" e "está abaixo da régua" pedem trabalho oposto.
 *
 * @param {number} posicao
 */
export function benchmark(posicao) {
  if (!Number.isFinite(posicao) || posicao < 1) return null;
  return BENCHMARK.find((f) => posicao < f.ate)?.ctr ?? null;
}

/**
 * 033 — as seis faixas de posição do board `/gsc/mapa`, DERIVADAS de `BENCHMARK`: nenhum número
 * de `de`/`ate`/`regua` é escrito duas vezes, pelo mesmo motivo de `lib/board-gsc.mjs` documentar
 * que uma segunda lista diverge em silêncio no primeiro limiar novo.
 *
 * A sexta é a única DECLARADA — existe no board e não em `BENCHMARK`, porque o piso de "~1,5%" da
 * página 2 não tem fonte (aplicá-lo à cauda longa mediria o palpite, não o site). `rotulo` é dado
 * AUTORAL em toda faixa, nunca derivável de `BENCHMARK`.
 *
 * @type {{rotulo:string, de:number, ate:number, regua:number|null}[]}
 */
export const FAIXAS = [
  { rotulo: "Posição 1", de: 1, ate: BENCHMARK[0].ate, regua: BENCHMARK[0].ctr },
  { rotulo: "Posição 2", de: BENCHMARK[0].ate, ate: BENCHMARK[1].ate, regua: BENCHMARK[1].ctr },
  { rotulo: "Posição 3", de: BENCHMARK[1].ate, ate: BENCHMARK[2].ate, regua: BENCHMARK[2].ctr },
  { rotulo: "Posições 4 a 6", de: BENCHMARK[2].ate, ate: BENCHMARK[3].ate, regua: BENCHMARK[3].ctr },
  { rotulo: "Posições 7 a 10", de: BENCHMARK[3].ate, ate: BENCHMARK[4].ate, regua: BENCHMARK[4].ctr },
  { rotulo: "Página 2 (11 a 20)", de: 11, ate: 21, regua: null },
];

/**
 * A faixa de uma posição, por fronteira EXCLUSIVA — nunca por re-agregação (031/032). `posicao`
 * pode chegar como `11,000000000000002`: por isso a comparação é `>= de && < ate`, igual a
 * `benchmark()`, e não um `Math.round`.
 *
 * Acima de 20,0 devolve `null`: as seis faixas do board cobrem só até a página 2. O guard
 * dedicado (em vez de deixar `ate: 21` da sexta faixa decidir sozinho) é o que faz
 * `faixaDaPosicao(20.5)` ser `null` mesmo com `ate: 21` guardado no objeto para exclusividade
 * interna — a distinção entre "onde a faixa termina, contígua com o board" e "onde o board não
 * cobre mais nada" são dois fatos, e por isso dois números.
 *
 * @param {number} posicao
 * @returns {{rotulo:string, de:number, ate:number, regua:number|null} | null}
 */
export function faixaDaPosicao(posicao) {
  if (!Number.isFinite(posicao) || posicao < 1 || posicao > 20) return null;
  return FAIXAS.find((f) => posicao >= f.de && posicao < f.ate) ?? null;
}

/** Cliques ÷ impressões, ou `null` quando não houve impressão. NUNCA 0: exibir 0% para uma
 *  página que ninguém viu inventa desempenho ruim onde não houve medição.
 *  @param {number} cliques
 *  @param {number} impressoes */
export function ctr(cliques, impressoes) {
  return impressoes > 0 ? cliques / impressoes : null;
}

/** Consultas distintas com impressão. Sempre acompanhada de `piso: true` — a dimensão `query`
 *  do GSC OMITE as raras (5 contra 33 medidos no tapepro), então este número é um piso e nunca
 *  o total. A flag não é opcional: sem ela a tela publicaria o piso como se fosse a contagem.
 *  @param {LinhaBusca[]} linhas */
export function consultasUnicas(linhas) {
  return { valor: new Set(linhas.filter((l) => l.impressoes > 0).map((l) => l.query)).size, piso: true };
}

/** Consultas distintas posicionadas de 1,0 a 20,0.
 *  @param {LinhaBusca[]} linhas */
export function noTop20(linhas) {
  return new Set(linhas.filter((l) => l.posicao >= 1 && l.posicao <= 20).map((l) => l.query)).size;
}

/**
 * 033 — abaixo disto nenhum dos dois índices de `conformidadeDeCtr()` é o elemento de maior peso
 * da tela (FR-012): a página nomeada assume o nível 1 no lugar deles.
 *
 * DERIVADO, não escolhido: a meta do board tem 5 pontos de largura (75% a 80%). Com `n` páginas
 * decididas, uma página mudar de veredito move o índice em `1/n`; para o índice ser comparável à
 * faixa, uma página sozinha não pode ATRAVESSÁ-LA (alcançar a borda vale, cruzar não) —
 * `1/n <= 0,05` → `n >= 20`.
 *
 * ⚠️ Deliberadamente MAIS FROUXO que o precedente da 026 (o piso fixo de 100 impressões, removido
 * do repositório inteiro nesta feature — FR-009): aquele piso exigia ~10 unidades para atravessar
 * a faixa de 40-50% do Top 3, e a mesma exigência aqui pediria 200 páginas decididas — nenhum projeto do
 * portfólio tem isso nem somando todas as URLs com impressão. Adotar 200 tornaria o índice
 * permanentemente não publicável, o que é mentir por omissão. Medido na Atma em 20/09/2026: 4
 * decididas, e uma página vale 25 pontos — cinco vezes a faixa inteira.
 */
export const LIMIAR_PAGINAS_DECIDIDAS = 20;

/** Total de impressões das linhas — o denominador que acompanha toda fração desta família.
 *  Serve às DUAS leituras de propósito: só lê `impressoes`, e a base de cada família (032/FR-003)
 *  é a mesma conta sobre a lista dela.
 *  @param {{impressoes: number}[]|null|undefined} linhas */
export function totalImpressoes(linhas) {
  return (linhas ?? []).reduce((a, l) => a + l.impressoes, 0);
}

/**
 * Impressões nas posições 1,0–3,9 contra o total. `null` quando não houve impressão nenhuma —
 * dividir por zero devolveria NaN, que a tela renderizaria como número.
 *
 * 033 — devolve `{ fracao, noTop3, total }`, não mais só a fração: `vereditoContraFaixa()` exige
 * numerador e denominador para julgar a amostra contra os 40% a 50% do board (US3), e antes deste
 * commit a função calculava os dois e descartava ambos. Isto também mata uma segunda fórmula em
 * `app/okr/[slug]/aquisicao/page.tsx`, que recalculava o numerador na tela por falta dele aqui.
 *
 * 037 — o parâmetro é o MÍNIMO que a conta lê (`impressoes` + `posicao`), e não `LinhaBusca[]`,
 * pela mesma razão declarada em `totalImpressoes()` logo acima: a medida serve às DUAS leituras, e
 * a linha da leitura por PÁGINA não tem `query` nem `page`. Sem isto, `/gsc/mapa` não conseguiria
 * exibir, ao lado do número, quanto a mesma conta daria na dimensão de base completa — que é o
 * argumento de por que a dimensão escolhida é a outra.
 *
 * @param {{impressoes: number, posicao: number}[]} linhas
 * @returns {{fracao:number, noTop3:number, total:number} | null}
 */
export function impressoesNoTop3(linhas) {
  const total = linhas.reduce((a, l) => a + l.impressoes, 0);
  if (total === 0) return null;
  const noTop3 = linhas.filter((l) => l.posicao < 4 && l.posicao >= 1).reduce((a, l) => a + l.impressoes, 0);
  return { fracao: noTop3 / total, noTop3, total };
}

/**
 * 034 — A PENETRAÇÃO NO TOP 3: quantos dos termos MONITORADOS estão em posição ≤ 3.
 *
 * Irmã de `impressoesNoTop3` e medida diferente dela, e é por isso que são duas funções. Aquela
 * soma IMPRESSÕES e responde "onde está concentrada a exibição do site"; esta conta TERMOS contra
 * um inventário declarado e responde "que fatia do que eu persigo eu já ganhei". O board dá metas
 * diferentes às duas (40% a 50% contra 20% a 30%), e foi por confundi-las que a folha
 * `penetracaoTop3` passou a apontar para o coletor errado até 19/09/2026.
 *
 * ⚠️ O DENOMINADOR É O INVENTÁRIO INTEIRO, sempre — nunca os termos que a janela devolveu. Termo
 * monitorado sem impressão na janela conta em `total`, não conta em `noTop3`, e aparece na
 * diferença entre `cobertura` e `total`. Medir sobre os apurados daria, na Atma de 20/09/2026,
 * 16,1% em vez de 10,1% — e subiria sozinho conforme o site somem do radar, que é exatamente o
 * movimento que o KPI existe para denunciar.
 *
 * `piso` é `true` sempre que a cobertura não fecha o inventário: a leitura por `query` do Search
 * Console OMITE consultas raras, então um termo ausente da janela não prova estar fora do Top 3.
 * A tela publica o número com o selo; sem ele, um piso leria como total.
 *
 * `null` e nunca `{fracao: 0}` quando não há inventário: 34 dos 35 projetos não têm um, e zero ali
 * seria reprovação fabricada sobre ausência.
 *
 * ⚠️ NÃO ENTRA EM `kpisPorTermo()`, e a ausência é o desenho. Aquele agregador consome a leitura
 * `["query", "page"]`, onde um termo que ranqueia em três páginas é três linhas com três posições.
 * Esta medida consome a leitura `["query"]` sozinha, que é a agregação do próprio Google por termo
 * — outra requisição, outra forma de linha (`termo`, não `query`+`page`). Pendurá-la lá compilaria
 * e devolveria 0 para sempre, porque nenhuma linha de lá tem o campo `termo`.
 *
 * @param {{termo: string, posicao: number|null}[]} linhas leitura na dimensão `query`
 * @param {{termos: string[], total: number}|null|undefined} inventario
 * @returns {{fracao:number, noTop3:number, total:number, cobertura:number, piso:boolean} | null}
 */
export function penetracaoNoTop3(linhas, inventario) {
  const r = penetracaoNoInventario(linhas, inventario, 3);
  return r && { fracao: r.fracao, noTop3: r.dentro, total: r.total, cobertura: r.cobertura, piso: r.piso };
}

/**
 * 047 — a mesma conta com a fronteira como parâmetro: quantos termos do inventário estão em
 * posição de 1,0 a `ate`, inclusive. Existe porque a meta do Top 20 ("60% do catálogo dentro do
 * Top 20") é a penetração com outra fronteira, e uma segunda cópia do corpo divergiria no primeiro
 * conserto de cobertura. Mesmo denominador, mesmo `piso`, mesma leitura por `query` — tudo o que
 * o comentário de `penetracaoNoTop3` diz vale aqui.
 *
 * @param {{termo: string, posicao: number|null}[]} linhas leitura na dimensão `query`
 * @param {{termos: string[], total: number}|null|undefined} inventario
 * @param {number} ate última posição que conta, inclusive
 * @returns {{fracao:number, dentro:number, total:number, cobertura:number, piso:boolean} | null}
 */
export function penetracaoNoInventario(linhas, inventario, ate) {
  if (!inventario?.termos?.length) return null;
  const monitorados = new Set(inventario.termos);
  const naJanela = (linhas ?? []).filter((l) => monitorados.has(l.termo));
  const dentro = naJanela.filter((l) => typeof l.posicao === "number" && l.posicao <= ate && l.posicao >= 1).length;
  const total = inventario.total ?? inventario.termos.length;
  const cobertura = new Set(naJanela.map((l) => l.termo)).size;
  return { fracao: dentro / total, dentro, total, cobertura, piso: cobertura < total };
}

/** URLs distintas com ao menos uma impressão.
 *  CONTAGEM, não razão: o board pede `URLs com impressão ÷ total de URLs indexadas` e o hub não
 *  mantém esse denominador. Publicar a razão seria inventá-la.
 *
 *  032: conta a leitura por PÁGINA. Contar URL na leitura por termo é contar só as que têm alguma
 *  consulta NÃO rara — 14 das 29 da Atma na janela medida.
 *  @param {LinhaPagina[]} paginas */
export function urlsComImpressao(paginas) {
  return new Set(paginas.filter((p) => p.impressoes > 0).map((p) => p.pagina)).size;
}

/**
 * Active Index Ratio (022): `URLs com impressão ÷ URLs indexadas`, meta do board ≥ 70%.
 *
 * O denominador é INJETADO, nunca buscado: ele vem da apuração de indexação gravada em
 * `hub_indexacao`, e um módulo puro que fosse atrás dele deixaria de ser puro e passaria a gastar
 * quota da URL Inspection API a cada render.
 *
 * `null` sem denominador — e a tela volta a exibir a CONTAGEM com o motivo. A 021 deixou este KPI
 * como contagem exatamente para não inventar o denominador; exibi-lo agora com um número chutado
 * seria trocar uma ausência honesta por uma razão falsa.
 *
 * 032: o numerador é por URL e vem da leitura por PÁGINA, junto com `urlsComImpressao`. A ressalva
 * de piso da dimensão `query` deixou de valer para esta folha — ver `RESSALVA_DO_COLETOR` em
 * `lib/gsc-delta.mjs`. O denominador continua vindo do banco, não da leitura.
 *
 * @param {LinhaPagina[]} paginas
 * @param {number|null|undefined} indexadas
 */
export function activeIndexRatio(paginas, indexadas) {
  if (!Number.isFinite(indexadas) || indexadas <= 0) return null;
  const comImpressao = urlsComImpressao(paginas);
  // 032 — o numerador passou a ser do SITE INTEIRO e o denominador continua sendo o que a apuração
  // DECLAROU. Quando o site tem mais URLs com impressão do que URLs declaradas, a razão passa de 1
  // e deixa de medir o que o nome dela diz: medido na Atma em 20/09/2026, 29 ÷ 18 = 161,1% — ao
  // lado de uma meta de "≥ 70%", isso publica uma aprovação folgada onde a verdade é que o
  // denominador não cobre o numerador. `null` pelo MESMO motivo da guarda de cima: a tela volta à
  // contagem COM o motivo, e um veredito falso por excesso é tão ruim quanto o 0% que esta feature
  // removeu. Antes da 032 isso ficava escondido porque a leitura por termo subcontava o numerador.
  if (comImpressao > indexadas) return null;
  return comImpressao / indexadas;
}

/**
 * Query-to-Page Ratio (022): consultas distintas por URL indexada. Faixas do board: 30-80 para
 * artigo/blog, 10-25 para produto/landing.
 *
 * Herda o `piso` de `consultasUnicas` e o carrega no retorno pelo mesmo motivo que ela: o GSC OMITE
 * as consultas raras da dimensão `query`, então este número é um piso e nunca o total. Devolver só
 * o número deixaria a flag opcional, e a tela publicaria o piso como se fosse a razão real.
 *
 * @param {LinhaBusca[]} linhas
 * @param {number|null|undefined} indexadas
 */
export function queryToPageRatio(linhas, indexadas) {
  if (!Number.isFinite(indexadas) || indexadas <= 0) return null;
  return { valor: consultasUnicas(linhas).valor / indexadas, piso: true };
}

/**
 * As consultas de 4,0 a 10,9 — as que já rankeiam e que um empurrão leva ao Top 3.
 * Ordenadas por impressões: o topo da lista é o trabalho que rende mais.
 *
 * 027 — `ehMarca` filtra a MARCA para fora, com a MESMA régua declarada no card que
 * `canibalizacao()` já usava. As duas são listas de TRABALHO e a guarda estava só numa delas.
 * Medido na atma em 18/09, na propriedade nova de `usealigner.com`: a ÚNICA linha da faixa era
 * `atma aligner` (posição 4,2, 6 impressões) — o nome da empresa, em primeiro lugar numa fila que
 * se apresenta como "a que rende mais". Reforço de conteúdo e link interno não movem a própria
 * marca, então a fila apontava para um trabalho que não existe. É a mesma frase que a 025 escreveu
 * sobre a lista vizinha, e ela valia aqui desde então.
 *
 * Devolve `{ lista, removidas }` e não só a lista pelo mesmo motivo da vizinha (FR-011): sumir em
 * silêncio é indistinguível de um filtro largo demais que também comeu consulta genérica. E
 * `removidas: null` (marca não declarada) não é `0` (declarada, nada casou) — dois estados com
 * consertos diferentes.
 *
 * @param {LinhaBusca[]} linhas
 * @param {((consulta: string) => boolean)|null} [ehMarca]
 * @returns {{lista: Candidata[], removidas: number|null}}
 */
export function strikingDistance(linhas, ehMarca = null) {
  const faixa = linhas
    .filter((l) => l.posicao >= 4 && l.posicao < 11 && l.impressoes > 0)
    .map((l) => ({ ...l, ctr: ctr(l.cliques, l.impressoes), benchmark: benchmark(l.posicao) }))
    .sort((a, b) => b.impressoes - a.impressoes);
  if (!ehMarca) return { lista: faixa, removidas: null };
  const lista = faixa.filter((c) => !ehMarca(c.query));
  return { lista, removidas: faixa.length - lista.length };
}

/**
 * 035 — a MESMA faixa da função acima, na dimensão que conta CONSULTA.
 *
 * Por que não é `strikingDistance()` recebendo outra leitura: aquela filtra a marca por `c.query`, e
 * a leitura por termo (`mesclarPorTermo`) devolve o campo como `termo`. A chamada compila,
 * `ehMarca(undefined)` não casa com nada, e a guarda da 027 desliga em SILÊNCIO. Medido na Atma em
 * 20/09/2026, janela 2026-08-21 → 2026-09-17, hosts somados: 347 consultas e 113 cliques com a
 * guarda desligada, contra 344 e 41 com ela. `atma aligner` sozinha (posição 4,4, 423 impressões)
 * carrega 70 dos 113 cliques e encabeçaria a fila — uma fila que existe para apontar reforço de
 * conteúdo e link interno, e nenhum dos dois move a própria marca.
 *
 * Mesma razão que fez a 034 criar `penetracaoNoTop3` ao lado de `impressoesNoTop3` em vez de
 * parametrizar uma das duas: a forma de linha é a assinatura, e é ela que reprova o chamador.
 * Mapear `{termo} → {query}` no chamador funcionaria HOJE e reporia a guarda no chamador, que é o
 * padrão que este repositório já pagou seis vezes.
 *
 * ⚠️ NÃO ENTRA em `kpisPorTermo()`, pelo motivo espelhado da vizinha de baixo: aquele agregador
 * consome a leitura `["query", "page"]`, onde nenhuma linha tem `termo`.
 *
 * `null` — e nunca um número — quando NENHUMA linha carrega `termo`: é a única coisa que impede a
 * dimensão errada de virar medida. Lista vazia devolve `{total: 0}`, que É uma medida; os dois
 * estados pedem conserto oposto (bug de código × site sem nada na faixa).
 *
 * `base` e `cauda` saem daqui e não do chamador porque recalculá-los na tela seria a segunda
 * travessia das mesmas linhas, escrita à mão — e duas versões do mesmo fato divergem na primeira
 * edição. Quem conta é quem declara sobre o que contou.
 *
 * `lista` sai junto do total para o chamador poder recortá-la (a tela cruza com o inventário da 034)
 * sem reescrever o filtro da faixa — que é o mesmo motivo de `base` e `cauda`.
 *
 * @param {{termo: string, cliques: number, impressoes: number, posicao: number|null}[]} linhas
 * @param {((termo: string) => boolean)|null} [ehMarca]
 * @returns {{total:number, impressoes:number, cliques:number, removidas:number|null, base:number, cauda:number, lista:object[]}|null}
 */
export function strikingDistancePorTermo(linhas, ehMarca = null) {
  const lidas = linhas ?? [];
  if (lidas.length > 0 && !lidas.some((l) => typeof l.termo === "string")) return null;
  // `typeof` antes de comparar: `null >= 4` é `false` por coerção, e uma medida não pode depender
  // de acidente de coerção para excluir a linha que não votou na posição.
  const faixa = lidas.filter(
    (l) => typeof l.posicao === "number" && l.posicao >= 4 && l.posicao < 11 && l.impressoes > 0,
  );
  const lista = ehMarca ? faixa.filter((l) => !ehMarca(l.termo)) : faixa;
  return {
    total: lista.length,
    impressoes: lista.reduce((t, l) => t + l.impressoes, 0),
    cliques: lista.reduce((t, l) => t + l.cliques, 0),
    removidas: ehMarca ? faixa.length - lista.length : null,
    base: lidas.length,
    cauda: lista.filter((l) => l.impressoes === 1).length,
    lista,
  };
}

/** Cada consulta com o CTR real, o piso da posição e se atinge.
 *  `atinge` é `null` (não `false`) quando não há benchmark ou não há CTR: "não medido" e
 *  "reprovado" são estados diferentes e colapsá-los reprovaria a cauda longa inteira.
 *  @param {LinhaBusca[]} linhas */
export function ctrPorConsulta(linhas) {
  return linhas
    .map((l) => {
      const c = ctr(l.cliques, l.impressoes);
      const b = benchmark(l.posicao);
      return { ...l, ctr: c, benchmark: b, atinge: c === null || b === null ? null : c >= b };
    })
    .sort((a, b) => b.impressoes - a.impressoes);
}

/**
 * Os cliques que a SERP ofereceu e o snippet não pegou, numa URL abaixo da régua da posição.
 *
 * `impressões × (régua − ctr)` é aritmética de UM degrau: carrega a barra de erro do CTR sozinho,
 * nada é multiplicado por nada de outro degrau, e nenhum coeficiente é inventado.
 *
 * 033 — MIGRADA de `lib/gsc-delta.mjs:444` (T016). Ela não tinha consumidor em produção, só o
 * próprio teste; `paginaNomeada()` é o primeiro consumidor real, e `gsc-delta.mjs` importa este
 * módulo (não o contrário), então a função desce para cá e `gsc-delta.mjs` passa a apenas
 * re-exportar o mesmo binding, como já fazia com `ctrEsperado`. Uma fórmula, um lugar.
 *
 * @param {{impressoes:number, ctr:number, benchmark:number}} u
 * @returns {number|null} cliques não capturados, ou null quando a URL já cobre a régua
 */
export function cliquesNaoCapturados(u) {
  if (!u || !Number.isFinite(u.impressoes) || !Number.isFinite(u.ctr) || !Number.isFinite(u.benchmark)) return null;
  // Zero impressão devolve `null`, NUNCA `0` — mesma regra de `ctr()`: `0` entraria na fila de
  // trabalho parecendo "já cobre a régua".
  if (u.impressoes <= 0) return null;
  const falta = u.benchmark - u.ctr;
  return falta > 0 ? u.impressoes * falta : null;
}

/**
 * A resposta de nível 1 quando `decididas.length < LIMIAR_PAGINAS_DECIDIDAS` (FR-012): a URL de
 * MAIOR impressão entre as decididas — não a de pior desempenho. Se a maior atinge, a frase diz
 * isso: inverter para "a pior" faria a tela procurar problema onde não há.
 *
 * Empate resolve pela URL alfabeticamente menor (mesma regra de `termoPrincipal()`), para a mesma
 * janela não devolver páginas diferentes em duas leituras seguidas.
 *
 * @param {{url:string, cliques:number, impressoes:number, posicao:number, ctr:number,
 *          regua:number, veredito:"atinge"|"abaixo"}[]} decididas
 * @param {number} impressoesDecididas denominador de `participacao` — impressões de TODAS as
 *   páginas decididas, não só desta
 * @returns {{url:string, impressoes:number, participacao:number, ctr:number, regua:number,
 *            posicao:number, veredito:"atinge"|"abaixo", cliquesFaltantes:number|null} | null}
 */
export function paginaNomeada(decididas, impressoesDecididas) {
  if (!decididas.length) return null;
  const maior = decididas.reduce((a, b) => (b.impressoes > a.impressoes || (b.impressoes === a.impressoes && b.url < a.url) ? b : a));
  return {
    url: maior.url,
    impressoes: maior.impressoes,
    participacao: maior.impressoes / impressoesDecididas,
    ctr: maior.ctr,
    regua: maior.regua,
    posicao: maior.posicao,
    veredito: maior.veredito,
    cliquesFaltantes: cliquesNaoCapturados({ impressoes: maior.impressoes, ctr: maior.ctr, benchmark: maior.regua }),
  };
}

/**
 * O Índice de Conformidade nas DUAS leituras da FR-010 — por página (com a meta do board) e por
 * tráfego (sem meta, o board nunca definiu uma) — mais a contagem de indecisas/sem régua/sem
 * impressão e a página nomeada. Um objeto só porque separar as duas leituras em funções distintas
 * as deixaria sair de sincronia, e é o PAR que a FR-011 precisa para explicar variação por
 * denominador.
 *
 * 033 — substitui `ctrGap()` (RENOMEADA, não ajustada: o nome muda com o conteúdo para o `tsc`
 * apontar os dois pontos de uso, em vez de a aba compilar calada medindo outra coisa — mesmo
 * padrão que a 032 já aplicou aqui). O veredito por página sai de `vereditoContraRegua()` sobre o
 * intervalo de Wilson da amostra, não de `ctr >= benchmark`: FR-009, o piso fixo de impressões
 * deixa de decidir quem entra no denominador.
 *
 * A régua é aplicada LINHA A LINHA (032/D3): cada linha já é uma URL, somada entre os hosts na
 * borda. Re-agregar devolveria a deriva de ponto flutuante que a 031 removeu.
 *
 * @param {LinhaPagina[]} paginas
 * @param {import("./janelas.mjs").Janela} janela FR-004 — propagada, nunca recomputada pela tela
 * @returns {{
 *   porPagina: {fracao:number|null, atingem:number, decididas:number, meta:[number,number]},
 *   porTrafego: {fracao:number|null, impressoesQueAtingem:number, impressoesDecididas:number, meta:null},
 *   indecisas:number, semRegua:number, semImpressao:number,
 *   abaixo: {url:string, cliques:number, impressoes:number, posicao:number, ctr:number|null, regua:number, veredito:"abaixo"}[],
 *   nomeada: ReturnType<typeof paginaNomeada>,
 *   janela: import("./janelas.mjs").Janela,
 * }}
 */
export function conformidadeDeCtr(paginas, janela) {
  let atingem = 0;
  let decididasN = 0;
  let indecisas = 0;
  let semRegua = 0;
  let semImpressao = 0;
  let impressoesQueAtingem = 0;
  let impressoesDecididas = 0;
  const decididas = [];
  for (const p of paginas) {
    if (!(p.impressoes > 0)) {
      semImpressao++;
      continue;
    }
    const reguaCtr = benchmark(p.posicao);
    if (reguaCtr === null) {
      semRegua++;
      continue;
    }
    const veredito = vereditoContraRegua(p.cliques, p.impressoes, reguaCtr);
    if (veredito === "indecisa") {
      indecisas++;
      continue;
    }
    decididasN++;
    impressoesDecididas += p.impressoes;
    if (veredito === "atinge") {
      atingem++;
      impressoesQueAtingem += p.impressoes;
    }
    decididas.push({ url: p.pagina, cliques: p.cliques, impressoes: p.impressoes, posicao: p.posicao, ctr: ctr(p.cliques, p.impressoes), regua: reguaCtr, veredito });
  }
  return {
    porPagina: { fracao: decididasN === 0 ? null : atingem / decididasN, atingem, decididas: decididasN, meta: [0.75, 0.8] },
    porTrafego: { fracao: impressoesDecididas === 0 ? null : impressoesQueAtingem / impressoesDecididas, impressoesQueAtingem, impressoesDecididas, meta: null },
    indecisas,
    semRegua,
    semImpressao,
    abaixo: decididas.filter((d) => d.veredito === "abaixo").sort((a, b) => b.impressoes - a.impressoes),
    nomeada: paginaNomeada(decididas, impressoesDecididas),
    janela,
  };
}

/**
 * As seis faixas de posição do mapa (`FAIXAS`), com a amostra somada e o veredito de cada uma
 * contra a régua que julga (FR-005) — nunca a tabela transcrita do board.
 *
 * Devolve SEMPRE as seis, mesmo sem impressão: faixa que desaparece da saída é indistinguível de
 * faixa que o site não alcança, e "o site não aparece aqui" é justamente o estado que precisa
 * aparecer. `janela` vai em CADA faixa (FR-004/FR-007) — o nó do mapa é lido isolado, e uma janela
 * só no cabeçalho não acompanha o nó; a função recebe uma única janela e não tem parâmetro para
 * uma segunda.
 *
 * @param {LinhaPagina[]} paginas
 * @param {import("./janelas.mjs").Janela} janela
 */
export function porFaixaDePosicao(paginas, janela) {
  return FAIXAS.map((faixa) => {
    const dentro = paginas.filter((p) => faixaDaPosicao(p.posicao) === faixa);
    const impressoes = dentro.reduce((a, p) => a + p.impressoes, 0);
    const cliques = dentro.reduce((a, p) => a + p.cliques, 0);
    return {
      rotulo: faixa.rotulo,
      de: faixa.de,
      ate: faixa.ate,
      regua: faixa.regua,
      amostra: { impressoes, cliques, posicao: dentro.length ? dentro.reduce((a, p) => a + p.posicao * p.impressoes, 0) / (impressoes || 1) : faixa.de, ctr: ctr(cliques, impressoes) },
      intervalo: wilson(cliques, impressoes),
      veredito: vereditoContraRegua(cliques, impressoes, faixa.regua),
      paginas: dentro.length,
      janela,
    };
  });
}

/**
 * Consultas atendidas por 2+ URLs do mesmo site — o board pede zero.
 * Ordenadas por impressões: a canibalização que custa mais aparece primeiro.
 *
 * 025 — `ehMarca` filtra as consultas de MARCA para fora da lista. Medido na atma em 07/09:
 * `atma aligner` lista 8 URLs e não é canibalização nenhuma — buscar o nome da empresa traz o site
 * inteiro por construção, e a lista de trabalho apontava para um trabalho que não existe.
 *
 * Devolve `{ lista, removidas }` e não só a lista porque sumir em silêncio é indistinguível de um
 * filtro largo demais: a tela precisa poder dizer QUANTAS saíram (FR-011). E `removidas: null` (não
 * declarada) não é `0` (declarada, nada casou) — dois estados com consertos diferentes.
 *
 * UMA função, com o filtro dentro. Uma `canibalizacaoFiltrada()` ao lado sairia de sincronia na
 * primeira mudança de ordenação, e a lista filtrada é a que vai para a tela.
 *
 * @param {LinhaBusca[]} linhas
 * @param {((consulta: string) => boolean)|null} [ehMarca]
 */
export function canibalizacao(linhas, ehMarca = null) {
  const mapa = new Map();
  for (const l of linhas) {
    if (l.impressoes <= 0) continue;
    const e = mapa.get(l.query) ?? [];
    e.push({ url: l.page, posicao: l.posicao, impressoes: l.impressoes });
    mapa.set(l.query, e);
  }
  const disputadas = [...mapa.entries()]
    .filter(([, urls]) => new Set(urls.map((u) => u.url)).size > 1)
    .map(([consulta, urls]) => ({
      consulta,
      urls: [...urls].sort((a, b) => b.impressoes - a.impressoes),
      impressoes: urls.reduce((a, u) => a + u.impressoes, 0),
    }))
    .sort((a, b) => b.impressoes - a.impressoes);
  if (!ehMarca) return { lista: disputadas, removidas: null };
  const lista = disputadas.filter((c) => !ehMarca(c.consulta));
  return { lista, removidas: disputadas.length - lista.length };
}

/**
 * 044 — a canibalização na unidade do BOARD: "0 PÁGINAS competindo pela mesma palavra-chave
 * primária". `canibalizacao()` conta CONSULTAS, e 73 consultas disputadas na Atma (20/09/2026)
 * saíam de 5 páginas — publicar só a contagem de consultas mediria o critério com outro
 * instrumento.
 *
 * A primária é `termoPrincipal()`, a mesma da integridade do título (024/D10): uma segunda
 * definição de "termo principal" divergiria da primeira em silêncio. Página cuja primária é a
 * MARCA fica fora do numerador E do denominador, pelo motivo de `canibalizacao()` filtrar marca:
 * buscar o nome da empresa traz o site inteiro por construção.
 *
 * As linhas precisam chegar CANONIZADAS: `/x` e `/x/` são duas páginas para a mescla por caminho,
 * e sem canonizar a mesma página disputaria consigo mesma.
 *
 * @param {LinhaBusca[]} linhas
 * @param {((consulta: string) => boolean)|null} [ehMarca]
 */
export function canibalizacaoPorPagina(linhas, ehMarca = null) {
  const disputa = new Map(canibalizacao(linhas, ehMarca).lista.map((c) => [c.consulta, c]));
  const urls = [...new Set(linhas.filter((l) => l.impressoes > 0).map((l) => l.page))];
  let avaliadas = 0;
  const disputadas = [];
  for (const url of urls) {
    const termo = termoPrincipal(linhas, url);
    if (!termo || ehMarca?.(termo)) continue;
    avaliadas++;
    const c = disputa.get(termo);
    if (c) disputadas.push({ url, termo, rivais: c.urls.map((u) => u.url).filter((u) => u !== url) });
  }
  return { avaliadas, disputadas };
}

/**
 * 024/D10 — o termo principal de uma URL: a consulta de MAIOR IMPRESSÃO daquela URL, na janela que
 * a aba já carrega.
 *
 * Vem do GSC na LEITURA, não da corrida de crawl: gravar o termo congelaria na semana da corrida
 * uma coisa que muda toda semana. E URL sem consulta com impressão devolve `null` — que a tela lê
 * como "sem termo apurado", NUNCA como "termo ausente do título". São dois diagnósticos com
 * consertos opostos: um é "o GSC ainda não vê essa página", o outro é "reescreva o título".
 *
 * Empate resolve pela consulta alfabeticamente menor, para a mesma janela não devolver termos
 * diferentes em duas leituras seguidas.
 *
 * @param {LinhaBusca[]|null|undefined} linhas
 * @param {string} url
 */
export function termoPrincipal(linhas, url) {
  const candidatas = (linhas ?? []).filter((l) => l.page === url && l.impressoes > 0);
  if (!candidatas.length) return null;
  return candidatas.reduce((a, b) =>
    b.impressoes > a.impressoes || (b.impressoes === a.impressoes && b.query < a.query) ? b : a,
  ).query;
}

/** A família por TERMO, de uma vez, para a aba não repetir cinco varreduras da mesma lista.
 *  `ehMarca` só é REPASSADO — filtrar aqui daria uma terceira régua de marca ao lado das de
 *  `strikingDistance()` e `canibalizacao()`, e as três divergiriam na primeira variante nova.
 *  027: ele vai para as DUAS listas de trabalho. Repassar a uma só foi como a marca voltou a
 *  encabeçar a fila do Striking distance depois de já ter sido tirada da vizinha.
 *
 *  032 — o nome mudou junto com o conteúdo, e é isso que força a revisão do chamador: manter
 *  o nome antigo com duas medidas a menos deixaria a aba compilando e medindo menos.
 *  `impressoesNoTop3` FICA aqui por decisão do dono: a medida afirma onde as CONSULTAS aparecem, e
 *  consulta só existe nesta leitura. A base parcial dela continua declarada pelo selo de piso.
 *  @param {LinhaBusca[]} linhas
 *  @param {((consulta: string) => boolean)|null} [ehMarca] */
export function kpisPorTermo(linhas, ehMarca = null) {
  return {
    consultasUnicas: consultasUnicas(linhas),
    noTop20: noTop20(linhas),
    impressoesNoTop3: impressoesNoTop3(linhas),
    strikingDistance: strikingDistance(linhas, ehMarca),
    canibalizacao: canibalizacao(linhas, ehMarca),
  };
}

/** 032 — a família por URL, toda ela sobre a leitura por página.
 *
 *  As medidas daqui afirmam algo sobre uma PÁGINA, e a leitura por termo não tem metade delas.
 *  Elas moram num agregador próprio, e não num campo a mais do de cima, porque a assinatura
 *  é onde a fronteira da 032 é cobrável: `kpisPorPagina(linhasPorTermo)` não compila no chamador.
 *
 *  `indexadas` continua INJETADO e vindo do banco — nenhuma das duas leituras o conhece.
 *
 *  033 — `janela` é OBRIGATÓRIA e sem default: janela com valor padrão é a porta por onde um
 *  número perde a declaração dela (FR-004), e `ctrGap` sai em favor de `conformidade` + `faixas`.
 *  @param {LinhaPagina[]} paginas
 *  @param {number|null} indexadas
 *  @param {import("./janelas.mjs").Janela} janela */
export function kpisPorPagina(paginas, indexadas, janela) {
  return {
    urlsComImpressao: urlsComImpressao(paginas),
    conformidade: conformidadeDeCtr(paginas, janela),
    faixas: porFaixaDePosicao(paginas, janela),
    activeIndexRatio: activeIndexRatio(paginas, indexadas),
  };
}
