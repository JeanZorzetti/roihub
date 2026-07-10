// Parse dos exports manuais de "Estatísticas de rastreamento" do Search Console
// (a API do GSC NÃO expõe crawl stats — só export da UI, 90 dias por export).
// JS puro com JSDoc, igual score.mjs/series.mjs — node:test sem tooling.
// Headers são localizados (pt-BR) e UTF-8: parse por POSIÇÃO de coluna, nunca por nome.

import { addDays } from "./series.mjs";

/** @typedef {{date:string, requests:number, bytes:number, ms:number}} CrawlDay */

/** CSV mínimo com aspas ("a,b" e "" escapada). @param {string} text @returns {string[][]} */
export function parseCsv(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  return lines.map((line) => {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQ = false;
        } else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
    out.push(cur);
    return out;
  });
}

/** "Gráfico de resumo": Data, total de solicitações, bytes, tempo médio (ms). @returns {CrawlDay[]} */
export function parseDailyChart(text) {
  return parseCsv(text)
    .slice(1)
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r[0]))
    .map((r) => ({ date: r[0], requests: +r[1] || 0, bytes: +r[2] || 0, ms: +r[3] || 0 }));
}

/** Tabelas label→proporção (respostas, finalidades…). @returns {{label:string, ratio:number}[]} */
export function parseRatios(text) {
  return parseCsv(text)
    .slice(1)
    .map((r) => ({ label: r[0], ratio: +r[1] || 0 }));
}

/** "Tabela de hosts": host, solicitações, status. */
export function parseHosts(text) {
  return parseCsv(text)
    .slice(1)
    .map((r) => ({ host: r[0], requests: +r[1] || 0, status: r[2] ?? "" }));
}

/**
 * Agrupa a tabela de respostas por classe. O label localizado traz "(200)", "(404)"
 * ou classe agrupada "(5xx)"; sem código (Falha de DNS, robots.txt, timeout…) → other.
 * 2xx e 304 = ok; 3xx = redirect; 404/410 = notFound; 5xx = serverError; demais 4xx = other.
 * @param {{label:string, ratio:number}[]} ratios
 */
export function classifyResponses(ratios) {
  const out = { ok: 0, redirect: 0, notFound: 0, serverError: 0, other: 0 };
  for (const { label, ratio } of ratios) {
    const code = label.match(/\((\d[\dx]{2})\)/i)?.[1]?.toLowerCase();
    if (!code) out.other += ratio;
    else if (code.startsWith("2") || code === "304") out.ok += ratio;
    else if (code.startsWith("3")) out.redirect += ratio;
    else if (code === "404" || code === "410") out.notFound += ratio;
    else if (code.startsWith("5")) out.serverError += ratio;
    else out.other += ratio;
  }
  return out;
}

/**
 * Junta séries diárias de vários exports do mesmo host (cada export cobre 90 dias,
 * então semanas consecutivas se sobrepõem): dedupe por data, export mais novo vence.
 * @param {{exportDate:string, days:CrawlDay[]}[]} exps
 * @returns {CrawlDay[]} ordenado por data asc
 */
export function mergeExports(exps) {
  const byDate = new Map();
  for (const e of [...exps].sort((a, b) => a.exportDate.localeCompare(b.exportDate)))
    for (const d of e.days) byDate.set(d.date, d);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** @param {Map<string, CrawlDay>} byDate @param {string} start @param {string} end */
function sumWindow(byDate, start, end) {
  let requests = 0;
  let msWeighted = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const row = byDate.get(d);
    if (!row) continue;
    requests += row.requests;
    msWeighted += row.ms * row.requests;
  }
  return { requests, ms: requests > 0 ? msWeighted / requests : null };
}

/**
 * Buckets de 7 dias fechando em `end` (tempo de resposta ponderado por requisições).
 * @param {CrawlDay[]} days @param {string} end @param {number} [weeks]
 * @returns {{start:string, end:string, requests:number, ms:number|null}[]}
 */
export function bucketCrawlWeeks(days, end, weeks = 12) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const bucketEnd = addDays(end, -7 * i);
    const bucketStart = addDays(bucketEnd, -6);
    out.push({ start: bucketStart, end: bucketEnd, ...sumWindow(byDate, bucketStart, bucketEnd) });
  }
  return out;
}

/** Janela atual [end-27..end] vs anterior [end-55..end-28]. @param {CrawlDay[]} days @param {string} end */
export function crawlTotals28(days, end) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  return {
    current: sumWindow(byDate, addDays(end, -27), end),
    previous: sumWindow(byDate, addDays(end, -55), addDays(end, -28)),
  };
}
