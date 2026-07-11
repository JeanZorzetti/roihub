import test from "node:test";
import assert from "node:assert/strict";
import { addDays, bucketWeeks, totals28 } from "../lib/series.mjs";

/** @param {string} date */
const day = (date, clicks, impressions, position) => ({ date, clicks, impressions, position });

test("addDays cruza mês e ano", () => {
  assert.equal(addDays("2026-06-30", 1), "2026-07-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
});

test("bucketWeeks: 14 dias viram 2 semanas com bordas certas", () => {
  const days = [];
  for (let i = 0; i < 14; i++) days.push(day(addDays("2026-06-24", i), 1, 10, 5));
  const weeks = bucketWeeks(days, "2026-07-07", 2);
  assert.equal(weeks.length, 2);
  assert.deepEqual(
    weeks.map((w) => [w.start, w.end, w.clicks, w.impressions, w.position]),
    [
      ["2026-06-24", "2026-06-30", 7, 70, 5],
      ["2026-07-01", "2026-07-07", 7, 70, 5],
    ]
  );
});

test("posição ponderada por impressões; sem impressão = null", () => {
  const weeks = bucketWeeks(
    [day("2026-07-06", 0, 10, 10), day("2026-07-07", 0, 30, 2)],
    "2026-07-07",
    2
  );
  assert.equal(weeks[1].position, (10 * 10 + 2 * 30) / 40); // 4
  assert.equal(weeks[0].position, null);
  assert.equal(weeks[0].clicks, 0); // dias ausentes contam como zero
});

test("ctr agregado = cliques/impressões da janela; sem impressão = null", () => {
  const weeks = bucketWeeks(
    [day("2026-07-06", 2, 10, 5), day("2026-07-07", 1, 30, 5)],
    "2026-07-07",
    2
  );
  assert.equal(weeks[1].ctr, 3 / 40);
  assert.equal(weeks[0].ctr, null);
  const t = totals28([day("2026-06-10", 3, 30, 8)], "2026-07-07");
  assert.equal(t.current.ctr, 0.1);
  assert.equal(t.previous.ctr, null);
});

test("totals28 separa as janelas no dia certo", () => {
  const days = [
    day("2026-06-10", 3, 30, 8), // end-27 → primeira data da janela atual
    day("2026-06-09", 5, 50, 4), // end-28 → última data da janela anterior
  ];
  const t = totals28(days, "2026-07-07");
  assert.deepEqual([t.current.clicks, t.current.impressions], [3, 30]);
  assert.deepEqual([t.previous.clicks, t.previous.impressions], [5, 50]);
});
