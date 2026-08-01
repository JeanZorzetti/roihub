// Onde os exports de "Estatísticas de rastreamento" moram no disco e como se lê um deles.
// O PARSE é do `lib/crawl.mjs`; aqui é só achar a pasta e abrir o CSV certo.
//
// Mora em `lib/` desde 01/08 porque tem dois consumidores: a aba `/infra` (que já importava o
// parse daqui) e o apurador de `D-85` em `lib/dourado-estado.mjs`. Duplicar o regex do nome da
// pasta faria a aba e o fato divergirem sobre qual export é o mais novo.
//
// ⚠️ Crawl stats NÃO tem API (lib/crawl.mjs:2): a UI é a única fonte, e o que está no repo é o que
// alguém exportou por último. Por isso todo número derivado daqui carrega a DATA do export —
// [[gsc_crawl_stats_stale_90d_window]]: cada export é uma janela de 90 dias, e uma falha que
// aparece hoje no gráfico pode ser de dois meses atrás.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { classifyResponses, crawlTotals28, mergeExports, parseDailyChart, parseHosts, parseRatios } from "./crawl.mjs";

const NOME = /^(.+)-Crawl-stats-(\d{4}-\d{2}-\d{2})$/i;

/**
 * Convenção: descompactar o export do GSC em docs/ (qualquer subpasta) e dar push. O nome da
 * pasta já identifica tudo: "{host}-Crawl-stats-{AAAA-MM-DD}".
 * @param {string} repoDir
 * @returns {{host:string, exportDate:string, dir:string}[]}
 */
export function acharExports(repoDir) {
  const docs = path.join(repoDir, "docs");
  let entries;
  try {
    entries = readdirSync(docs, { withFileTypes: true, recursive: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const m = e.name.match(NOME);
    if (m) out.push({ host: m[1].toLowerCase(), exportDate: m[2], dir: path.join(e.parentPath, e.name) });
  }
  return out;
}

/**
 * Arquivos internos têm nome localizado ("Gráfico de resumo…", "Tabela de respostas.csv");
 * match por palavra sem acento pra sobreviver a variação de idioma/normalização.
 * @param {string} dir @param {RegExp} padrao @returns {string|null}
 */
export function lerCsv(dir, padrao) {
  try {
    const file = readdirSync(dir).find((f) => padrao.test(f));
    return file ? readFileSync(path.join(dir, file), "utf8") : null;
  } catch {
    return null;
  }
}

/**
 * O status do host na tabela do GSC tem TRÊS estados e o texto é localizado. Grepar por "problem"
 * junta os três: na primeira corrida do fato D-85 a lista de "hosts com problema" saiu com 34
 * linhas, e nenhuma era um problema de agora — 22 diziam "No problems" e 12 "Problemas no
 * passado". Passado é justamente o que [[gsc_crawl_stats_stale_90d_window]] manda datar ANTES de
 * caçar bug: cada export cobre 90 dias.
 * @param {string} status @returns {"ok"|"passado"|"agora"|"outro"}
 */
export function classificarStatusHost(status) {
  if (/\b(sem|no)\s+problem/i.test(status)) return "ok";
  if (/passado|in the past/i.test(status)) return "passado";
  if (/problem/i.test(status)) return "agora";
  return "outro";
}

/**
 * Um resumo por host, do export mais novo de cada um. É o que o fato de `estado` publica: volume
 * de rastreamento nos 28 dias que o export cobre e a distribuição de resposta.
 * @param {string} repoDir
 * @returns {{host:string, ultimoExport:string, fim:string, requests28:number, okRatio:number|null,
 *   erro5xx:number|null, hostsComProblema:string[], hostsProblemaPassado:string[]}[]}
 */
export function resumoCrawl(repoDir) {
  const porHost = new Map();
  for (const e of acharExports(repoDir)) porHost.set(e.host, [...(porHost.get(e.host) ?? []), e]);

  const saida = [];
  for (const [host, exps] of porHost) {
    const days = mergeExports(
      exps.map((e) => ({ exportDate: e.exportDate, days: parseDailyChart(lerCsv(e.dir, /resumo|chart/i) ?? "") })),
    );
    if (days.length === 0) continue;
    const ultimo = [...exps].sort((a, b) => a.exportDate.localeCompare(b.exportDate)).at(-1);
    const fim = days[days.length - 1].date;
    const hosts = parseHosts(lerCsv(ultimo.dir, /hosts/i) ?? "");
    const ratios = parseRatios(lerCsv(ultimo.dir, /respostas|response/i) ?? "");
    const resp = classifyResponses(ratios);
    saida.push({
      host,
      ultimoExport: ultimo.exportDate,
      fim,
      requests28: crawlTotals28(days, fim).current.requests,
      // Sem tabela de respostas a proporção é `null`, nunca 0: 0% de OK e "não olhei" prescrevem
      // ações opostas — é a mesma régua do `n/a` do conformidade. A proporção é da janela do
      // EXPORT (90 dias), não dos 28 dias das requisições ao lado.
      okRatio: ratios.length ? resp.ok : null,
      erro5xx: ratios.length ? resp.serverError : null,
      hostsComProblema: hosts.filter((h) => classificarStatusHost(h.status) === "agora").map((h) => `${h.host} (${h.status})`),
      hostsProblemaPassado: hosts.filter((h) => classificarStatusHost(h.status) === "passado").map((h) => h.host),
    });
  }
  return saida.sort((a, b) => b.requests28 - a.requests28);
}
