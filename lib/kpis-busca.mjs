// Os KPIs de busca do board de OKR (021), calculados sobre as linhas de query+page da janela
// de descoberta.
//
// Módulo PURO: zero imports, sem process.env, sem pg, sem fetch. Recebe as linhas que a borda
// já buscou e devolve números — é o que permite testar cada borda de faixa sem subir o Next e
// sem gastar uma requisição no Search Console.

/** @typedef {{query: string, page: string, cliques: number, impressoes: number, posicao: number}} LinhaBusca */
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

/** Acima de 10,9 o board NÃO define piso, e por isso aqui devolve `null` em vez de um número
 *  inventado: com um piso arbitrário a cauda longa inteira apareceria reprovada, o que faria o
 *  CTR Gap medir o palpite e não o site. */
export function benchmark(posicao) {
  if (!Number.isFinite(posicao) || posicao < 1) return null;
  return BENCHMARK.find((f) => posicao < f.ate)?.ctr ?? null;
}

/** Cliques ÷ impressões, ou `null` quando não houve impressão. NUNCA 0: exibir 0% para uma
 *  página que ninguém viu inventa desempenho ruim onde não houve medição. */
export function ctr(cliques, impressoes) {
  return impressoes > 0 ? cliques / impressoes : null;
}

/** Soma as linhas por URL — o board mede CTR Gap por URL, não por par query+page.
 *  A posição da URL é a média PONDERADA por impressões: média simples deixaria uma consulta
 *  rara na posição 90 arrastar a posição de uma página que vive no Top 3. */
export function porUrl(linhas) {
  const mapa = new Map();
  for (const l of linhas) {
    const e = mapa.get(l.page) ?? { url: l.page, cliques: 0, impressoes: 0, somaPos: 0 };
    e.cliques += l.cliques;
    e.impressoes += l.impressoes;
    e.somaPos += l.posicao * l.impressoes;
    mapa.set(l.page, e);
  }
  return [...mapa.values()].map((e) => {
    const posicao = e.impressoes > 0 ? e.somaPos / e.impressoes : null;
    return {
      url: e.url,
      cliques: e.cliques,
      impressoes: e.impressoes,
      posicao,
      ctr: ctr(e.cliques, e.impressoes),
      benchmark: posicao === null ? null : benchmark(posicao),
    };
  });
}

/** Consultas distintas com impressão. Sempre acompanhada de `piso: true` — a dimensão `query`
 *  do GSC OMITE as raras (5 contra 33 medidos no tapepro), então este número é um piso e nunca
 *  o total. A flag não é opcional: sem ela a tela publicaria o piso como se fosse a contagem. */
export function consultasUnicas(linhas) {
  return { valor: new Set(linhas.filter((l) => l.impressoes > 0).map((l) => l.query)).size, piso: true };
}

/** Consultas distintas posicionadas de 1,0 a 20,0. */
export function noTop20(linhas) {
  return new Set(linhas.filter((l) => l.posicao >= 1 && l.posicao <= 20).map((l) => l.query)).size;
}

/** Fração das impressões que acontece nas posições 1,0–3,9. `null` quando não houve impressão
 *  nenhuma — dividir por zero devolveria NaN, que a tela renderizaria como número. */
export function impressoesNoTop3(linhas) {
  const total = linhas.reduce((a, l) => a + l.impressoes, 0);
  if (total === 0) return null;
  return linhas.filter((l) => l.posicao < 4 && l.posicao >= 1).reduce((a, l) => a + l.impressoes, 0) / total;
}

/** URLs distintas com ao menos uma impressão.
 *  CONTAGEM, não razão: o board pede `URLs com impressão ÷ total de URLs indexadas` e o hub não
 *  mantém esse denominador. Publicar a razão seria inventá-la. */
export function urlsComImpressao(linhas) {
  return new Set(linhas.filter((l) => l.impressoes > 0).map((l) => l.page)).size;
}

/** As consultas de 4,0 a 10,9 — as que já rankeiam e que um empurrão leva ao Top 3.
 *  Ordenadas por impressões: o topo da lista é o trabalho que rende mais.
 *  @param {LinhaBusca[]} linhas @returns {Candidata[]} */
export function strikingDistance(linhas) {
  return linhas
    .filter((l) => l.posicao >= 4 && l.posicao < 11 && l.impressoes > 0)
    .map((l) => ({ ...l, ctr: ctr(l.cliques, l.impressoes), benchmark: benchmark(l.posicao) }))
    .sort((a, b) => b.impressoes - a.impressoes);
}

/** Cada consulta com o CTR real, o piso da posição e se atinge.
 *  `atinge` é `null` (não `false`) quando não há benchmark ou não há CTR: "não medido" e
 *  "reprovado" são estados diferentes e colapsá-los reprovaria a cauda longa inteira. */
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
 */
export function ctrGap(linhas) {
  const avaliaveis = porUrl(linhas).filter((u) => u.benchmark !== null && u.ctr !== null);
  if (!avaliaveis.length) return null;
  return {
    fracao: avaliaveis.filter((u) => u.ctr >= u.benchmark).length / avaliaveis.length,
    avaliadas: avaliaveis.length,
    abaixo: avaliaveis.filter((u) => u.ctr < u.benchmark).sort((a, b) => b.impressoes - a.impressoes),
  };
}

/** Consultas atendidas por 2+ URLs do mesmo site — o board pede zero.
 *  Ordenadas por impressões: a canibalização que custa mais aparece primeiro. */
export function canibalizacao(linhas) {
  const mapa = new Map();
  for (const l of linhas) {
    if (l.impressoes <= 0) continue;
    const e = mapa.get(l.query) ?? [];
    e.push({ url: l.page, posicao: l.posicao, impressoes: l.impressoes });
    mapa.set(l.query, e);
  }
  return [...mapa.entries()]
    .filter(([, urls]) => new Set(urls.map((u) => u.url)).size > 1)
    .map(([consulta, urls]) => ({
      consulta,
      urls: [...urls].sort((a, b) => b.impressoes - a.impressoes),
      impressoes: urls.reduce((a, u) => a + u.impressoes, 0),
    }))
    .sort((a, b) => b.impressoes - a.impressoes);
}

/** Tudo de uma vez, para a aba não repetir seis varreduras da mesma lista. */
export function kpisDeBusca(linhas) {
  return {
    consultasUnicas: consultasUnicas(linhas),
    noTop20: noTop20(linhas),
    impressoesNoTop3: impressoesNoTop3(linhas),
    urlsComImpressao: urlsComImpressao(linhas),
    strikingDistance: strikingDistance(linhas),
    ctrGap: ctrGap(linhas),
    canibalizacao: canibalizacao(linhas),
  };
}
