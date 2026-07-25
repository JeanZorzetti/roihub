// Partes puras do robô de crawl stats (scripts/fetch-crawl-stats.mjs): decidir onde o export
// baixado mora e recusar export que não serve. O browser fica no script, aqui só fs + string,
// que é o que quebra em silêncio — nome de arquivo mudando e ZIP vindo vazio.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseDailyChart } from "./crawl.mjs";

// Mesmo padrão do findExports em app/infra/page.tsx: é ele que decide o que a aba enxerga.
const EXPORT_NAME = /^(.+)-Crawl-stats-(\d{4}-\d{2}-\d{2})$/i;
// Mesmo par do readCsv em app/infra/page.tsx (o header vem localizado).
const SUMMARY_CSV = /resumo|chart/i;

/**
 * Onde descompactar o ZIP que o GSC entregou. O nome do download já vem no formato que a aba
 * espera ("host-Crawl-stats-AAAA-MM-DD.zip"), então ele é a fonte — montar o nome à mão é como
 * se erra o host de propriedade sc-domain. Nome fora do padrão = a UI mudou: devolve null e o
 * chamador aborta em vez de adivinhar.
 * @param {string} suggestedFilename @param {string} repoDir
 * @returns {{host:string, exportDate:string, dir:string}|null}
 */
export function destDirFor(suggestedFilename, repoDir) {
  const base = suggestedFilename.replace(/\.zip$/i, "");
  const m = base.match(EXPORT_NAME);
  if (!m) return null;
  const host = m[1].toLowerCase();
  return { host, exportDate: m[2], dir: path.join(repoDir, "docs", "Crawl-stats", host, base) };
}

/**
 * Export só serve se o gráfico de resumo tiver dia: é dele que saem as séries do /infra, e um ZIP
 * extraído com nível extra de pasta passa em "os arquivos existem" e falha aqui.
 * @param {string} dir @returns {{ok:boolean, days:number, reason?:string}}
 */
export function validateExport(dir) {
  let file;
  try {
    file = readdirSync(dir).find((f) => SUMMARY_CSV.test(f));
  } catch {
    return { ok: false, days: 0, reason: "pasta não existe" };
  }
  if (!file) return { ok: false, days: 0, reason: "sem CSV de resumo (ZIP extraiu em subpasta?)" };
  const days = parseDailyChart(readFileSync(path.join(dir, file), "utf8")).length;
  return days > 0 ? { ok: true, days } : { ok: false, days: 0, reason: "CSV de resumo sem linha de data" };
}
