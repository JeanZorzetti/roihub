import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCsv,
  parseDailyChart,
  parseRatios,
  classifyResponses,
  mergeExports,
  bucketCrawlWeeks,
  crawlTotals28,
} from "../lib/crawl.mjs";

test("parseCsv: aspas, vírgula interna e BOM", () => {
  assert.deepEqual(parseCsv('﻿a,"b,c","d""e"\n1,2,3'), [
    ["a", "b,c", 'd"e'],
    ["1", "2", "3"],
  ]);
});

test("parseDailyChart ignora header e linha inválida", () => {
  const csv = "Data,Total,Bytes,Ms\n2026-07-01,923,9736711,209\nlixo,x,y,z";
  assert.deepEqual(parseDailyChart(csv), [{ date: "2026-07-01", requests: 923, bytes: 9736711, ms: 209 }]);
});

test("classifyResponses agrupa por classe e joga sem-código em other", () => {
  const r = classifyResponses(
    parseRatios(
      "Resposta,Relação\nOK (200),0.80\nNão modificado (304),0.05\nMovido permanentemente (301),0.04\nNão encontrado (404),0.06\nErro do servidor (5xx),0.02\nFalha de DNS,0.03"
    )
  );
  const round = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v * 1e4) / 1e4]));
  assert.deepEqual(round, { ok: 0.85, redirect: 0.04, notFound: 0.06, serverError: 0.02, other: 0.03 });
});

test("mergeExports: export mais novo vence no dia sobreposto", () => {
  const day = (date, requests) => ({ date, requests, bytes: 0, ms: 100 });
  const merged = mergeExports([
    { exportDate: "2026-07-10", days: [day("2026-07-01", 999), day("2026-07-02", 5)] },
    { exportDate: "2026-07-03", days: [day("2026-06-30", 1), day("2026-07-01", 2)] },
  ]);
  assert.deepEqual(
    merged.map((d) => [d.date, d.requests]),
    [
      ["2026-06-30", 1],
      ["2026-07-01", 999],
      ["2026-07-02", 5],
    ]
  );
});

test("bucketCrawlWeeks pondera ms por requisições; semana vazia → ms null", () => {
  const days = [
    { date: "2026-07-06", requests: 10, bytes: 0, ms: 100 },
    { date: "2026-07-07", requests: 30, bytes: 0, ms: 200 },
  ];
  const weeks = bucketCrawlWeeks(days, "2026-07-07", 2);
  assert.equal(weeks[1].requests, 40);
  assert.equal(weeks[1].ms, (100 * 10 + 200 * 30) / 40); // 175
  assert.deepEqual([weeks[0].requests, weeks[0].ms], [0, null]);
});

test("crawlTotals28 separa as janelas no dia certo", () => {
  const days = [
    { date: "2026-06-10", requests: 3, bytes: 0, ms: 90 }, // end-27 → atual
    { date: "2026-06-09", requests: 5, bytes: 0, ms: 50 }, // end-28 → anterior
  ];
  const t = crawlTotals28(days, "2026-07-07");
  assert.deepEqual([t.current.requests, t.current.ms], [3, 90]);
  assert.deepEqual([t.previous.requests, t.previous.ms], [5, 50]);
});
