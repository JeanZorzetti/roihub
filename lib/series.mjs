// Agregação da série diária do GSC (JS puro com JSDoc, igual score.mjs — node:test sem tooling).
// Dias sem linha no GSC = zero (a API omite datas sem impressão).

/** @typedef {{date:string, clicks:number, impressions:number, position:number}} Day */

const DAY = 864e5;

/** @param {string} iso YYYY-MM-DD @param {number} n @returns {string} iso + n dias */
export function addDays(iso, n) {
  return new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);
}

/**
 * Soma [start..end]; posição média ponderada por impressões (média simples mente).
 * @param {Map<string, Day>} byDate @param {string} start @param {string} end
 * @returns {{clicks:number, impressions:number, position:number|null}}
 */
function sumWindow(byDate, start, end) {
  let clicks = 0;
  let impressions = 0;
  let posWeighted = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const row = byDate.get(d);
    if (!row) continue;
    clicks += row.clicks;
    impressions += row.impressions;
    posWeighted += row.position * row.impressions;
  }
  return { clicks, impressions, position: impressions > 0 ? posWeighted / impressions : null };
}

/**
 * Buckets de 7 dias fechando em `end`, mais antigo primeiro — suaviza o ruído diário.
 * @param {Day[]} days @param {string} end @param {number} [weeks]
 * @returns {{start:string, end:string, clicks:number, impressions:number, position:number|null}[]}
 */
export function bucketWeeks(days, end, weeks = 12) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const bucketEnd = addDays(end, -7 * i);
    const bucketStart = addDays(bucketEnd, -6);
    out.push({ start: bucketStart, end: bucketEnd, ...sumWindow(byDate, bucketStart, bucketEnd) });
  }
  return out;
}

/**
 * Janela atual [end-27..end] vs anterior [end-55..end-28] — o Δ 28d da progressão.
 * @param {Day[]} days @param {string} end
 */
export function totals28(days, end) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  return {
    current: sumWindow(byDate, addDays(end, -27), end),
    previous: sumWindow(byDate, addDays(end, -55), addDays(end, -28)),
  };
}
