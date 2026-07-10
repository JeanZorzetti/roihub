import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScore, seoScoreFromClicks, WEIGHTS } from "../lib/score.mjs";

test("pesos somam 1", () => {
  const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test("score nos limites", () => {
  assert.equal(computeScore({ receita: 0, blockers: 0, seo: 0, decay: 0 }), 0);
  assert.equal(computeScore({ receita: 10, blockers: 10, seo: 10, decay: 10 }), 100);
});

test("score clampa entradas fora de 0-10 e valores ausentes", () => {
  assert.equal(computeScore({ receita: 99, blockers: -5, seo: 10, decay: 10 }), 75);
  assert.equal(computeScore({}), 0);
});

test("receita pesa mais que seo", () => {
  const soReceita = computeScore({ receita: 10, blockers: 0, seo: 0, decay: 0 });
  const soSeo = computeScore({ receita: 0, blockers: 0, seo: 10, decay: 0 });
  assert.ok(soReceita > soSeo);
});

test("seoScoreFromClicks: sem dados → null", () => {
  assert.equal(seoScoreFromClicks(null, null), null);
  assert.equal(seoScoreFromClicks(10, null), null);
});

test("seoScoreFromClicks: crescimento mapeado e clampado", () => {
  assert.equal(seoScoreFromClicks(100, 100), 5); // estável
  assert.equal(seoScoreFromClicks(200, 100), 10); // +100%
  assert.equal(seoScoreFromClicks(0, 100), 0); // -100%
  assert.equal(seoScoreFromClicks(500, 100), 10); // clamp topo
  assert.equal(seoScoreFromClicks(5, 0), 8); // saiu do zero
  assert.equal(seoScoreFromClicks(0, 0), 2); // parado no zero
});
