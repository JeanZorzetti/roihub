// FIELD VITALS FROM OUR OWN VISITORS (056), for origins the CrUX does not publish.
//
// The CrUX answers 404 below a traffic threshold it does not disclose, and Sirius sits below it (56
// search clicks in 28 days, 26/09/2026). Lab data stays refused (023/SC-003): the board's ruler is
// the FIELD p75. So the site measures each visit with Google's own `web-vitals`, and the hub judges
// the sample with the 033 interval instead of a fixed visit floor: "p75 above the limit" is the same
// statement as "more than 25% of visits above the limit", and that is a proportion Wilson can bound.
//
// Pure `.mjs` (constitution III): no disk, no network, no `process.env`.

import { VITAIS } from "./crux.mjs";
import { vereditoContraRegua, wilson } from "./intervalo.mjs";

// Anything slower than a minute is a broken measurement, not a slow page.
const TETO = { lcp: 60_000, inp: 60_000, ttfb: 60_000, cls: 10 };
export const CORPO_MAX = 512;
const CAMINHO_MAX = 300;
export const FRACAO_DO_P75 = 0.25;

// Lab runs would bring back exactly the number 023 refuses, and crawlers render JS too. An empty
// agent is refused: every real browser sends one.
const AGENTE_RECUSADO = /bot|crawl|spider|lighthouse|headless|pagespeed|inspectiontool|gtmetrix|pingdom/i;
/** @param {string|null|undefined} agente */
export const agenteRecusado = (agente) => !agente || AGENTE_RECUSADO.test(agente);

/** "/blog/" and "/blog" are the same page to the GSC list and to the visitor. */
export const normalizarCaminho = (c) => (c.length > 1 ? c.replace(/\/+$/, "") || "/" : c);
const semWww = (h) => h.toLowerCase().replace(/^www\./, "");

/**
 * One beacon → one row, or `null`. Every refusal is the same `null` on purpose: the route answers
 * 204 either way, so a prober never learns which filter caught it (research D6).
 *
 * The project comes from the `Origin` header, never from the body: the body is the visitor's to
 * write, the header is the browser's.
 *
 * @param {string} corpo raw body, JSON `{m, v, p}`
 * @param {{origem: string, agente: string}} cab
 * @param {(host: string) => string|null} slugDoHost
 * @returns {{projeto: string, host: string, caminho: string, metrica: string, valor: number} | null}
 */
export function lerMedida(corpo, { origem, agente }, slugDoHost) {
  if (typeof corpo !== "string" || corpo.length > CORPO_MAX || agenteRecusado(agente)) return null;
  let host;
  try {
    host = semWww(new URL(origem).hostname);
  } catch {
    return null;
  }
  const projeto = slugDoHost(host);
  if (!projeto) return null;
  let d;
  try {
    d = JSON.parse(corpo);
  } catch {
    return null;
  }
  const metrica = typeof d?.m === "string" ? d.m.toLowerCase() : "";
  if (!Object.hasOwn(TETO, metrica)) return null;
  const valor = d.v;
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0 || valor > TETO[metrica]) return null;
  if (typeof d.p !== "string" || !d.p.startsWith("/")) return null;
  // The query string can carry an e-mail or a token (FR-004): only the path is ever stored.
  const caminho = normalizarCaminho(d.p.split(/[?#]/)[0]);
  if (caminho.length > CAMINHO_MAX) return null;
  return { projeto, host, caminho, metrica, valor };
}

/**
 * @typedef {{n: number, p75: number|null, acima: number, fracaoAcima: number|null,
 *            intervalo: {inferior: number, superior: number}|null,
 *            veredito: "fora"|"dentro"|"nao-decide"|null}} LeituraRum
 */

/**
 * p75 by nearest rank (the value at position ⌈0.75·n⌉) and the verdict from the interval of the
 * share of visits above the limit. The two never disagree: a decided "fora" means the share is
 * above 25%, and then the nearest-rank p75 is above the limit too, so `proxima-acao.mjs` comparing
 * p75 with the limit fires exactly when the interval says so.
 *
 * @param {number[]} valores @param {string} id `lcp` | `inp` | `cls` | `ttfb` @returns {LeituraRum}
 */
export function leituraRum(valores, id) {
  const vital = VITAIS.find((v) => v.id === id);
  if (!vital) throw new Error(`vital fora do catálogo: ${id}`);
  const n = valores.length;
  if (!n) return { n: 0, p75: null, acima: 0, fracaoAcima: null, intervalo: null, veredito: null };
  const ord = [...valores].sort((a, b) => a - b);
  const acima = ord.filter((v) => v > vital.limite).length;
  const r = vereditoContraRegua(acima, n, FRACAO_DO_P75);
  const { inferior, superior } = wilson(acima, n);
  return {
    n,
    p75: ord[Math.ceil(0.75 * n) - 1],
    acima,
    fracaoAcima: acima / n,
    intervalo: { inferior, superior },
    veredito: r === "atinge" ? "fora" : r === "abaixo" ? "dentro" : "nao-decide",
  };
}

/** @param {{metrica: string, valor: number}[]} medidas @param {string} id */
export const valoresDe = (medidas, id) => medidas.filter((m) => m.metrica === id).map((m) => m.valor);

const DO_PASS_RATE = VITAIS.filter((v) => !v.chaveCrux.startsWith("experimental_"));
const chaveDaUrl = (host, caminho) => `${semWww(host)}${normalizarCaminho(caminho)}`;

/**
 * 056/D9 — the CrUX Pass Rate with every `sem-amostra` URL judged by the RUM instead. A URL passes
 * with LCP, INP and CLS decided "dentro", fails with any decided "fora", and stays undecided
 * otherwise. The fraction needs two decided URLs, as `passRate()` does: one URL is never 100%.
 *
 * @param {{consultadas: number, porUrl: {url: string, estado: string}[], naoConsultadas?: number}} pass `passRate()` + `lerPassRate()`
 * @param {{host: string, caminho: string, metrica: string, valor: number}[]} medidas the window
 */
export function passRateMisto(pass, medidas) {
  /** @type {Map<string, {host: string, caminho: string, metrica: string, valor: number}[]>} */
  const porUrl = new Map();
  for (const m of medidas) {
    const k = chaveDaUrl(m.host, m.caminho);
    porUrl.set(k, [...(porUrl.get(k) ?? []), m]);
  }
  let rum = 0;
  const urls = pass.porUrl.map((u) => {
    if (u.estado !== "sem-amostra") return u;
    let chave;
    try {
      const x = new URL(u.url);
      chave = chaveDaUrl(x.hostname, x.pathname);
    } catch {
      return u;
    }
    const doRum = porUrl.get(chave) ?? [];
    if (!doRum.length) return u;
    const tres = DO_PASS_RATE.map((v) => leituraRum(valoresDe(doRum, v.id), v.id).veredito);
    const estado = tres.includes("fora") ? "reprova" : tres.every((v) => v === "dentro") ? "passa" : "indecisa";
    if (estado !== "indecisa") rum += 1;
    return { url: u.url, estado };
  });
  const comDado = urls.filter((u) => u.estado === "passa" || u.estado === "reprova").length;
  const passam = urls.filter((u) => u.estado === "passa").length;
  const indecisas = urls.filter((u) => u.estado === "indecisa").length;
  const semAmostra = urls.filter((u) => u.estado === "sem-amostra").length;
  const base = { ...pass, porUrl: urls, comDado, passam, rum };
  if (comDado >= 2) return { ...base, fracao: passam / comDado, motivo: null };
  const tem = comDado === 1 ? "tem" : "têm";
  return {
    ...base,
    fracao: null,
    motivo:
      `Pass Rate por URL não é apurável: das ${pass.consultadas} URLs consultadas, ${comDado} ${tem} veredito nos três vitais, pela CrUX ou pelo RUM próprio.` +
      (indecisas ? ` ${indecisas} ${indecisas === 1 ? "tem" : "têm"} visita no RUM próprio, mas a amostra ainda não decide os três.` : "") +
      (semAmostra ? ` ${semAmostra} sem amostra na CrUX nem visita no RUM próprio.` : "") +
      " A fração precisa de pelo menos duas URLs decididas: uma amostra de uma nunca é 100%.",
  };
}
