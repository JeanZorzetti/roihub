// Prioridade 0-100: quanto MAIOR, mais o projeto precisa do Jean HOJE.
// Pesos definidos em 10/07/2026: receita na mesa > blockers humanos > tração SEO = risco de decair.
export const WEIGHTS = { receita: 0.35, blockers: 0.25, seo: 0.2, decay: 0.2 };

/**
 * @param {{receita:number, blockers:number, seo:number, decay:number}} c cada critério 0-10
 * @returns {number} score 0-100
 */
export function computeScore(c) {
  const clamp10 = (v) => Math.min(10, Math.max(0, v ?? 0));
  const s =
    clamp10(c.receita) * WEIGHTS.receita +
    clamp10(c.blockers) * WEIGHTS.blockers +
    clamp10(c.seo) * WEIGHTS.seo +
    clamp10(c.decay) * WEIGHTS.decay;
  return Math.round(s * 10);
}

/**
 * Converte cliques GSC (28d atuais vs 28d anteriores) em nota 0-10.
 * Nota alta = tração acontecendo = merece atenção. 0% de crescimento = 5.
 * @param {number|null} current @param {number|null} previous
 * @returns {number|null} null quando não há dados GSC
 */
export function seoScoreFromClicks(current, previous) {
  if (current == null || previous == null) return null;
  if (previous === 0) return current > 0 ? 8 : 2;
  const growth = (current - previous) / previous;
  // ponytail: linear ±100% → 0..10; troque a curva se cliques absolutos passarem a importar
  return Math.round(Math.min(10, Math.max(0, 5 + growth * 5)) * 10) / 10;
}
