// Score composto da aba SEO — pesos definidos pelo usuário em 19/08/2026: cliques são a métrica
// soberana (tráfego real), CTR é sinal de relevância, posição é potencial (métrica traiçoeira em
// média), impressões são topo de funil. Substitui a ordenação anterior por impressões brutas.
// Padrão de módulo igual lib/score.mjs (JS puro + JSDoc, testável com node:test sem tooling).

export const WEIGHTS = { clicks: 0.4, ctr: 0.3, position: 0.2, impressions: 0.1 };

/**
 * Min-max normalization relativa ao próprio conjunto — não existe um teto de mercado cadastrado
 * no sistema, então "bom" é sempre "melhor que os outros projetos do portfólio agora".
 * @param {number[]} values
 * @returns {number[]} cada valor em [0,1]; se todos iguais, todos viram 1 (sem divisão por zero)
 */
function normalizeAll(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return values.map((v) => (max === min ? 1 : (v - min) / (max - min)));
}

/**
 * Como normalizeAll, mas ignora `null` no cálculo do min/max e mapeia `null` para 0 (pior valor) —
 * ctr/position só são `null` quando impressions=0 na janela (lib/series.mjs), o que já implica
 * clicks=0 também, então tratar como pior valor apenas completa o mesmo sinal.
 * @param {(number|null)[]} values
 * @returns {number[]}
 */
function normalizeNullable(values) {
  const present = values.filter((v) => v != null);
  if (present.length === 0) return values.map(() => 0);
  const min = Math.min(...present);
  const max = Math.max(...present);
  return values.map((v) => (v == null ? 0 : max === min ? 1 : (v - min) / (max - min)));
}

/**
 * @typedef {{slug: string, nome: string, clicks: number, ctr: number|null, position: number|null, impressions: number}} SeoScoreInput
 * @typedef {{slug: string, score: number, components: {clicks:number, ctr:number, position:number, impressions:number}, rank: number}} SeoScoreResult
 */

/**
 * Ordena projetos com dado GSC pelo score composto ponderado (40/30/20/10). Determinístico:
 * mesma entrada (em qualquer ordem) sempre produz o mesmo resultado. Desempate: cliques brutos
 * desc, depois nome asc.
 * @param {SeoScoreInput[]} inputs
 * @returns {SeoScoreResult[]}
 */
export function rankBySeoScore(inputs) {
  if (inputs.length === 0) return [];

  const clicksNorm = normalizeAll(inputs.map((i) => i.clicks));
  const impressionsNorm = normalizeAll(inputs.map((i) => i.impressions));
  const ctrNorm = normalizeNullable(inputs.map((i) => i.ctr));
  // posição invertida: menor posição bruta = melhor = maior valor normalizado
  const positionNorm = normalizeNullable(inputs.map((i) => (i.position == null ? null : -i.position)));

  const scored = inputs.map((input, idx) => {
    const components = {
      clicks: clicksNorm[idx],
      ctr: ctrNorm[idx],
      position: positionNorm[idx],
      impressions: impressionsNorm[idx],
    };
    const raw =
      components.clicks * WEIGHTS.clicks +
      components.ctr * WEIGHTS.ctr +
      components.position * WEIGHTS.position +
      components.impressions * WEIGHTS.impressions;
    return { slug: input.slug, nome: input.nome, clicksRaw: input.clicks, score: Math.round(raw * 100), components };
  });

  scored.sort(
    (a, b) => b.score - a.score || b.clicksRaw - a.clicksRaw || a.nome.localeCompare(b.nome)
  );

  return scored.map(({ nome, clicksRaw, ...rest }, idx) => ({ ...rest, rank: idx + 1 }));
}
