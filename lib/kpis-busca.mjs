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
// Módulo PURO: zero imports, sem process.env, sem pg, sem fetch. Recebe as linhas que a borda
// já buscou e devolve números — é o que permite testar cada borda de faixa sem subir o Next e
// sem gastar uma requisição no Search Console.

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
 * Piso de impressões abaixo do qual a fração do Top 3 NÃO ganha veredito do board.
 *
 * 026 — número, não gosto. A faixa do board tem 10 pontos de largura (40% a 50%). Com 100
 * impressões na janela, UMA impressão vale 1 ponto e a faixa é resolvida por 10 delas; com as 26
 * que `usealigner.com` tinha em 18/09, a mesma impressão vale 3,8 pontos e três delas atravessam
 * a faixa inteira. Um veredito assim mede o ruído da amostra, não o site — é a mesma armadilha do
 * `43×` que a 2ª corrida desta tela removeu, entrando por outra porta.
 *
 * Abaixo do piso a fração continua na tela, COM a base ao lado: o que sai é a régua, não o número.
 */
export const PISO_IMPRESSOES_VEREDITO = 100;

/** Total de impressões das linhas — o denominador que acompanha toda fração desta família.
 *  Serve às DUAS leituras de propósito: só lê `impressoes`, e a base de cada família (032/FR-003)
 *  é a mesma conta sobre a lista dela.
 *  @param {{impressoes: number}[]|null|undefined} linhas */
export function totalImpressoes(linhas) {
  return (linhas ?? []).reduce((a, l) => a + l.impressoes, 0);
}

/** Fração das impressões que acontece nas posições 1,0–3,9. `null` quando não houve impressão
 *  nenhuma — dividir por zero devolveria NaN, que a tela renderizaria como número.
 *  @param {LinhaBusca[]} linhas */
export function impressoesNoTop3(linhas) {
  const total = linhas.reduce((a, l) => a + l.impressoes, 0);
  if (total === 0) return null;
  return linhas.filter((l) => l.posicao < 4 && l.posicao >= 1).reduce((a, l) => a + l.impressoes, 0) / total;
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
 * Fração de URLs cujo CTR alcança o piso da própria posição — o CTR Gap do board (meta 75-80%).
 *
 * URLs sem benchmark (posição acima de 10,9) ou sem impressão ficam FORA do denominador, não
 * contam como falha: o board não define piso lá, e contá-las como reprovadas faria todo site com
 * cauda longa parecer quebrado.
 *
 * `null` quando nenhuma URL sobra — sem denominador não há fração, e 0% mentiria.
 *
 * 032 — lê a leitura por PÁGINA e aplica a régua LINHA A LINHA. Cada linha já É uma URL, somada
 * entre os hosts na borda: re-agregar aqui (`posição × impressões ÷ impressões`) devolveria a
 * deriva de ponto flutuante que a 031 removeu, e a faixa do balizador acaba em 10,9 — um
 * `11,000000000000002` cai fora dela e a página some do denominador sem nada ter mudado.
 *
 * O campo de saída continua `url` (e não `pagina`): é o nome que a lista "abaixo do benchmark" já
 * renderiza, e trocá-lo por simetria mexeria na tela sem mudar um número.
 *
 * @param {LinhaPagina[]} paginas
 */
export function ctrGap(paginas) {
  const avaliaveis = paginas
    .map((p) => ({
      url: p.pagina,
      cliques: p.cliques,
      impressoes: p.impressoes,
      posicao: p.posicao,
      ctr: ctr(p.cliques, p.impressoes),
      benchmark: benchmark(p.posicao),
    }))
    .filter((u) => u.benchmark !== null && u.ctr !== null);
  if (!avaliaveis.length) return null;
  return {
    fracao: avaliaveis.filter((u) => u.ctr >= u.benchmark).length / avaliaveis.length,
    avaliadas: avaliaveis.length,
    abaixo: avaliaveis.filter((u) => u.ctr < u.benchmark).sort((a, b) => b.impressoes - a.impressoes),
  };
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
 *  As três medidas daqui afirmam algo sobre uma PÁGINA, e a leitura por termo não tem metade
 *  delas. Elas moram num agregador próprio, e não num campo a mais do de cima, porque a assinatura
 *  é onde a fronteira da 032 é cobrável: `kpisPorPagina(linhasPorTermo)` não compila no chamador.
 *
 *  `indexadas` continua INJETADO e vindo do banco — nenhuma das duas leituras o conhece.
 *  @param {LinhaPagina[]} paginas
 *  @param {number|null} [indexadas] */
export function kpisPorPagina(paginas, indexadas = null) {
  return {
    urlsComImpressao: urlsComImpressao(paginas),
    ctrGap: ctrGap(paginas),
    activeIndexRatio: activeIndexRatio(paginas, indexadas),
  };
}
