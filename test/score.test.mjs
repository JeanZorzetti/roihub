import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScore, seoScoreFromClicks, decayFromHealth, WEIGHTS, ordemDoRanking } from "../lib/score.mjs";

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

test("decayFromHealth: saúde fresca vira decay invertido", () => {
  const now = new Date("2026-07-11");
  assert.equal(decayFromHealth(30, "2026-07-10", now), 7);
  assert.equal(decayFromHealth(100, "2026-07-10", now), 0);
  assert.equal(decayFromHealth(0, "2026-07-10", now), 10);
  assert.equal(decayFromHealth(150, "2026-07-10", now), 0); // clamp
});

test("decayFromHealth: velho, ausente ou inválido → null (cai no manual)", () => {
  const now = new Date("2026-07-11");
  assert.equal(decayFromHealth(30, "2026-06-01", now), null); // >10 dias
  assert.equal(decayFromHealth(null, "2026-07-10", now), null);
  assert.equal(decayFromHealth(30, undefined, now), null);
  assert.equal(decayFromHealth(30, "não-é-data", now), null);
});

test("seoScoreFromClicks: crescimento mapeado e clampado", () => {
  assert.equal(seoScoreFromClicks(100, 100), 5); // estável
  assert.equal(seoScoreFromClicks(200, 100), 10); // +100%
  assert.equal(seoScoreFromClicks(0, 100), 0); // -100%
  assert.equal(seoScoreFromClicks(500, 100), 10); // clamp topo
  assert.equal(seoScoreFromClicks(5, 0), 8); // saiu do zero
  assert.equal(seoScoreFromClicks(0, 0), 2); // parado no zero
});

test("ordemDoRanking: stand-by cai pro fim mesmo com o maior score", () => {
  const projetos = [
    { slug: "parado", standby: "⏸ decisão do Jean", score: 99, curated: true },
    { slug: "curado", score: 40, curated: true },
    { slug: "cru", score: 40, curated: false }, // mesmo score: curado empata acima
    { slug: "foco", score: 55, curated: true },
  ];
  assert.deepEqual([...projetos].sort(ordemDoRanking).map((p) => p.slug), ["foco", "curado", "cru", "parado"]);
  // é isto que impede o projeto parado de virar foco do dia sozinho quando o site dele cai
  // (health falso força decayEff 10 em evaluate.ts)
  assert.notEqual([...projetos].sort(ordemDoRanking)[0].slug, "parado");
  // campo ausente = não está em stand-by; não pode virar `undefined` mandando pro fim
  assert.deepEqual([{ score: 1 }, { score: 2 }].sort(ordemDoRanking).map((p) => p.score), [2, 1]);
});
