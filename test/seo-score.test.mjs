import test from "node:test";
import assert from "node:assert/strict";
import { WEIGHTS, rankBySeoScore } from "../lib/seo-score.mjs";

/** @param {Partial<{slug:string, nome:string, clicks:number, ctr:number|null, position:number|null, impressions:number}>} o */
const proj = (o) => ({
  slug: "p",
  nome: "Projeto",
  clicks: 0,
  ctr: 0,
  position: 100,
  impressions: 0,
  ...o,
});

test("WEIGHTS soma 1 e usa os pesos do pedido do usuário", () => {
  assert.deepEqual(WEIGHTS, { clicks: 0.4, ctr: 0.3, position: 0.2, impressions: 0.1 });
  const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(Math.round(sum * 100) / 100, 1);
});

test("cliques dominam impressões: poucos cliques+muitas impressões perde para muitos cliques+poucas impressões", () => {
  const a = proj({ slug: "a", nome: "A", clicks: 500, ctr: 0.05, position: 8, impressions: 1000 });
  const b = proj({ slug: "b", nome: "B", clicks: 10, ctr: 0.001, position: 8, impressions: 50000 });
  const [first, second] = rankBySeoScore([a, b]);
  assert.equal(first.slug, "a");
  assert.equal(second.slug, "b");
});

test("CTR alto com posição pior pode vencer posição ótima com CTR baixo (peso 30% > 20%, cliques e impressões iguais)", () => {
  const bestPosition = proj({ slug: "pos", nome: "Pos", clicks: 100, ctr: 0.01, position: 1, impressions: 5000 });
  const bestCtr = proj({ slug: "ctr", nome: "Ctr", clicks: 100, ctr: 0.5, position: 15, impressions: 5000 });
  const [first] = rankBySeoScore([bestPosition, bestCtr]);
  assert.equal(first.slug, "ctr");
});

test("determinístico independente da ordem de entrada", () => {
  const a = proj({ slug: "a", nome: "A", clicks: 300, ctr: 0.1, position: 5, impressions: 3000 });
  const b = proj({ slug: "b", nome: "B", clicks: 50, ctr: 0.02, position: 20, impressions: 2500 });
  const c = proj({ slug: "c", nome: "C", clicks: 10, ctr: 0.01, position: 30, impressions: 1000 });
  const order1 = rankBySeoScore([a, b, c]).map((r) => r.slug);
  const order2 = rankBySeoScore([c, a, b]).map((r) => r.slug);
  const order3 = rankBySeoScore([b, c, a]).map((r) => r.slug);
  assert.deepEqual(order1, order2);
  assert.deepEqual(order1, order3);
});

test("ctr/position nulos entram como pior valor, sem lançar erro", () => {
  const zero = proj({ slug: "zero", nome: "Zero", clicks: 0, ctr: null, position: null, impressions: 0 });
  const withData = proj({ slug: "with", nome: "With", clicks: 5, ctr: 0.02, position: 20, impressions: 250 });
  const result = rankBySeoScore([zero, withData]);
  assert.equal(result.length, 2);
  assert.equal(result[0].slug, "with");
  assert.equal(result[1].slug, "zero");
  assert.equal(result[1].components.ctr, 0);
  assert.equal(result[1].components.position, 0);
});

test("empate exato de score desempata por cliques brutos, depois por nome", () => {
  const a = proj({ slug: "a", nome: "Zeta", clicks: 100, ctr: 0.1, position: 5, impressions: 1000 });
  const b = proj({ slug: "b", nome: "Alfa", clicks: 100, ctr: 0.1, position: 5, impressions: 1000 });
  const result = rankBySeoScore([a, b]);
  assert.equal(result[0].score, result[1].score);
  assert.equal(result[0].slug, "b"); // mesmo clicks, "Alfa" < "Zeta"
  assert.equal(result[1].slug, "a");
});

test("único projeto no conjunto: components todos 1, sem divisão por zero", () => {
  const only = proj({ slug: "only", nome: "Only", clicks: 42, ctr: 0.03, position: 7, impressions: 900 });
  const [result] = rankBySeoScore([only]);
  assert.deepEqual(result.components, { clicks: 1, ctr: 1, position: 1, impressions: 1 });
  assert.equal(result.score, 100);
  assert.equal(result.rank, 1);
});

test("conjunto vazio retorna array vazio", () => {
  assert.deepEqual(rankBySeoScore([]), []);
});

test("rank é sequência 1-based sem lacunas na ordem retornada", () => {
  const items = [
    proj({ slug: "a", nome: "A", clicks: 300, ctr: 0.1, position: 5, impressions: 3000 }),
    proj({ slug: "b", nome: "B", clicks: 50, ctr: 0.02, position: 20, impressions: 2500 }),
    proj({ slug: "c", nome: "C", clicks: 10, ctr: 0.01, position: 30, impressions: 1000 }),
  ];
  const result = rankBySeoScore(items);
  assert.deepEqual(result.map((r) => r.rank), [1, 2, 3]);
});
