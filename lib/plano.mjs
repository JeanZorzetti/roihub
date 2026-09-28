// THE SEO PLAN OF A PROJECT WITH A MAP (057).
//
// The map (051–055) reacts to what was already read: "if below X, do Y". A site with no impressions
// has nothing to react to, and every leaf either fires at once or has no reading. This module answers
// the other question: where to get to, by when, and in which order to build.
//
// Nothing here declares a threshold. The metas of 29 of the 31 ruled leaves ARE `REGRAS[k].limiar`
// (FR-002 of 054: a limiar is written once). Only `top20` and `tamBusca` get a meta from the niche's
// search volume, plus three headline projections no leaf counts (impressões, cliques, `pagina1`). The
// click fraction is `benchmark(7)`, imported from the ruler that already judges CTR.
//
// The frozen demand (`data/demanda-estimada.json`, written by `scripts/consultar-demanda.mjs`) is the
// input; the owner's decisions live in `hub_plano`/`hub_plano_meta`; tasks and milestones are derived
// here and never stored (research D5).
//
// Pure `.mjs` (constitution III): no disk, no network, no `process.env`, no `Date.now()`.

import { CATALOGO } from "./gsc-delta.mjs";
import { BOARD, GRUPOS } from "./board-gsc.mjs";
import { ALAVANCAS, DEGRAUS, ORIGEM, REGRAS, metaTexto } from "./proxima-acao.mjs";
import { benchmark, coberturaDaDemanda, penetracaoNoInventario } from "./kpis-busca.mjs";
import { RESPONSAVEL_IDS, addDaysISO } from "./agenda.mjs";

/** The two fixed deadlines (clarify Q2): Top 20 at 90 days, positions 7–10 at 180. The owner moves
 *  the plan's start, never the deadline (FR-008). */
export const PRAZOS = [90, 180];
/** Headline projections: no catalog leaf counts them, so they are not leaves (D1). */
export const CABECALHOS = ["impressoes", "cliques", "pagina1"];
/** "◇ política do dono, sem fonte" (FR-013, clarify): the owner's estimate, editable, never a ruler. */
export const PREMISSAS_PADRAO = { capacidade: 3, semanasAteIndexar: 2, semanasAteEstabilizar: 12, pisoApoio: 100 };
/** Minimum monthly volume for a term to enter the demand, and for a support page to be scheduled. */
export const PISO_VOLUME = 10;
/** The plan's calendar: every week up to the 180-day deadline. */
export const SEMANAS = Math.ceil(PRAZOS[1] / 7);
/** Where the headline `pagina1` stops: the last position of page 1, the same 10.9 the ruler uses. */
export const ATE_PAGINA1 = 10.9;
/** The position whose CTR floor counts the 180-day clicks (clarify Q2: band 7–10). */
const POSICAO_ALVO_180 = 7;

/** A deadline's week: a page created in week w counts once `w + semanasAteEstabilizar` ≤ this.
 *  `floor`, because 90 days is week 12.9 and a page maturing in week 13 did not make it (D2). */
export const semanaDoPrazo = (prazo) => Math.floor(prazo / 7);

/** The demand metas: the only ones `montar` turns into weekly milestones. */
const DEMANDA = { top20: 90, tamBusca: 180, pagina1: 180, impressoes: 180, cliques: 180 };
/** Fractions compare at display precision (0.1 pp); counts at the unit. */
const FRACOES = new Set(["top20", "tamBusca", "pagina1"]);

export const NOMES = {
  impressoes: "Impressões do inventário",
  cliques: "Cliques do inventário",
  pagina1: "Termos do inventário na página 1 (1,0–10,9)",
  paginas: "Páginas novas acumuladas",
};

const pct = (v) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const num = (v) => v.toLocaleString("pt-BR");
const tem = (obj, k) => Object.hasOwn(obj, k);

// ── The 18 KPIs of the board ──────────────────────────────────────────────────

/**
 * The board's 18 KPIs, derived from what `board-gsc.mjs` already declares: a leaf whose board title
 * is numbered is a KPI; a leaf with a `GRUPOS` path belongs to its first group; an unnumbered leaf
 * belongs to the numbered leaf before it in the same branch (`conformidadeUrls` under the CTR Gap).
 * No second list of KPIs is written here — that is how the board was rebuilt three times.
 * The checklist has no rule and no meta, so it belongs to no KPI.
 *
 * @returns {{id: string, nome: string, ramo: string, folhas: string[]}[]}
 */
export function kpisDoBoard() {
  /** @type {Map<string, {id: string, nome: string, ramo: string, folhas: string[]}>} */
  const kpis = new Map();
  let anterior = null;
  for (const [chave, folha] of Object.entries(CATALOGO)) {
    if (!REGRAS[chave]) continue;
    const grupo = GRUPOS[chave]?.[0];
    const numerado = /^\d+\./.test(BOARD[chave].titulo);
    const id = grupo ?? (numerado || !anterior || kpis.get(anterior)?.ramo !== folha.ramo ? chave : anterior);
    if (!kpis.has(id)) kpis.set(id, { id, nome: grupo ?? BOARD[chave].titulo, ramo: folha.ramo, folhas: [] });
    kpis.get(id).folhas.push(chave);
    if (!grupo) anterior = id;
  }
  return [...kpis.values()];
}

// ── Clusters (D4) ──────────────────────────────────────────────────────────────

/** Lowercase, no accents, anything that is not a letter or digit → one space. */
export function normalizar(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Word-sequence containment: "fita gomada" is in "fita gomada kraft", not in "fita gomadas". */
const contem = (texto, semente) => ` ${texto} `.includes(` ${semente} `);

/** The longest seed contained in `texto`, declaration order on ties. */
function maisLonga(texto, sementes) {
  let melhor = null;
  for (const s of sementes) if (contem(texto, normalizar(s)) && (!melhor || normalizar(s).length > normalizar(melhor).length)) melhor = s;
  return melhor;
}

const porVolume = (a, b) => (b.volume ?? -1) - (a.volume ?? -1) || (a.termo < b.termo ? -1 : a.termo > b.termo ? 1 : 0);

/**
 * @typedef {{termo: string, volume: number|null, segmento?: string, cobertoPor?: string|null}} Termo
 * @typedef {{semente: string, termos: Termo[], volume: number, segmentos: Record<string, number>,
 *            pagina?: string|null, apoios?: Record<string, string|null>, estadoDaPagina?: EstadoDaPagina|null,
 *            estados?: Record<string, EstadoDaPagina>}} Cluster
 */

/**
 * A fixed rule, free and stable across runs (FR-005, clarify Q4): the term goes to the product seed it
 * contains, the longest one when two match; a segment seed inside it is a tag (a support-page
 * candidate); no seed → `semCluster`. A `null` volume ("below the minimum Google Ads reports") stays in
 * its cluster and never adds. `movidos` is the owner's curation (`--mover`): a term listed there goes to
 * that seed's cluster whatever it contains, and the frozen file records it so every reader regroups the
 * same way.
 *
 * @param {Termo[]} termos @param {{produtos: string[], segmentos?: string[], movidos?: Record<string, string>}} sementes
 * @returns {{clusters: Cluster[], semCluster: Termo[]}}
 */
export function agrupar(termos, { produtos, segmentos = [], movidos = {} }) {
  /** @type {Map<string, Cluster>} */
  const clusters = new Map();
  /** @type {Termo[]} */
  const semCluster = [];
  for (const t of termos) {
    const n = normalizar(t.termo);
    const produto = tem(movidos, t.termo) && produtos.includes(movidos[t.termo]) ? movidos[t.termo] : maisLonga(n, produtos);
    if (!produto) {
      semCluster.push({ termo: t.termo, volume: t.volume });
      continue;
    }
    const segmento = maisLonga(n, segmentos);
    if (!clusters.has(produto)) clusters.set(produto, { semente: produto, termos: [], volume: 0, segmentos: {} });
    const c = clusters.get(produto);
    c.termos.push(segmento ? { termo: t.termo, volume: t.volume, segmento } : { termo: t.termo, volume: t.volume });
    if (typeof t.volume === "number") {
      c.volume += t.volume;
      if (segmento) c.segmentos[segmento] = (c.segmentos[segmento] ?? 0) + t.volume;
    }
  }
  for (const c of clusters.values()) c.termos.sort(porVolume);
  return {
    clusters: [...clusters.values()].sort((a, b) => b.volume - a.volume || (a.semente < b.semente ? -1 : 1)),
    semCluster: semCluster.sort(porVolume),
  };
}

/**
 * The frozen demand of a project, regrouped exactly as the script grouped it: the seeds, segments and
 * moves recorded in `procedencia` win over the project's current seeds, so a later catalog edit does not
 * silently regroup a frozen consultation. A GSC-floor entry (050) has no seeds recorded and falls back
 * to the project's; `null` volumes come back from `semVolume`.
 *
 * @param {{procedencia?: Record<string, any>, termos?: Record<string, number>}|null|undefined} entrada
 * @param {{produtos?: string[], segmentos?: string[]}|null|undefined} projeto
 */
export function lerDemanda(entrada, projeto) {
  if (!entrada?.termos || !Object.keys(entrada.termos).length) return null;
  const p = entrada.procedencia ?? {};
  const termos = [
    ...Object.entries(entrada.termos).map(([termo, volume]) => ({ termo, volume })),
    ...(p.semVolume ?? []).map((termo) => ({ termo, volume: null })),
  ];
  const produtos = p.sementes ?? projeto?.produtos ?? [];
  const segmentos = p.segmentos ?? projeto?.segmentos ?? [];
  return { ...agrupar(termos, { produtos, segmentos, movidos: p.movidos ?? {} }), procedencia: p, produtos, paga: String(p.fonte ?? "").startsWith("dataforseo") };
}

// ── Coverage (D7) ──────────────────────────────────────────────────────────────

/** The URL's path and its title, each normalized: the two places a page names its subject. */
function textosDe(p) {
  let caminho = "";
  try {
    caminho = decodeURIComponent(new URL(p.url).pathname);
  } catch {
    caminho = String(p.url ?? "");
  }
  return [normalizar(caminho), normalizar(p.titulo ?? "")];
}

/**
 * FR-007b: every word of the term is a word of the text, in any order, no accents, no case. Literal
 * on purpose (D14): `fitas` ≠ `fita`, and prepositions count. Stemming would be a second rule.
 */
export function cobreTermo(termo, texto) {
  const t = normalizar(termo).split(" ").filter(Boolean);
  if (!t.length || texto === null || texto === undefined) return false;
  const palavras = new Set(normalizar(texto).split(" "));
  return t.every((w) => palavras.has(w));
}

/** Decoded path without the trailing slash: the key both the verdict and the impressions match on. */
function caminhoDe(url) {
  try {
    return decodeURIComponent(new URL(url).pathname).replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

/**
 * @typedef {"ativa"|"indexada-sem-impressao"|"fora-do-indice"|"sem-leitura"} Estado
 * @typedef {{estado: Estado, classe: string|null, motivo: string|null}} EstadoDaPagina
 */

/**
 * The state of an existing page (D13): the latest index verdict of its URL (`hub_indexacao_url`)
 * × the page impressions of the map's window (`gscPaginas`). Matched by path, so `/pt-BR/x` does
 * not lend its impressions to `/x`. A 429, a URL past the cota and a failed or truncated impression
 * reading are "sem leitura", never "fora do índice" and never "sem impressão".
 *
 * @param {string} url
 * @param {{classes: Record<string, {classe: string, dia: string}>|null,
 *          impressoes: {paginas: {pagina: string, impressoes: number}[], truncado: boolean}|{erro: string}|null}} leituras
 * @returns {EstadoDaPagina}
 */
export function estadoDaPagina(url, { classes, impressoes }) {
  const alvo = caminhoDe(url);
  if (!classes) return { estado: "sem-leitura", classe: null, motivo: "nenhuma corrida de indexação gravou veredito por URL" };
  const lidas = Object.entries(classes).filter(([u]) => caminhoDe(u) === alvo).map(([, v]) => v).sort((a, b) => (a.dia < b.dia ? 1 : -1));
  const classe = lidas[0]?.classe ?? null;
  if (!classe) return { estado: "sem-leitura", classe: null, motivo: "a corrida de indexação ainda não inspecionou esta URL" };
  if (classe === "falha") return { estado: "sem-leitura", classe, motivo: "a inspeção desta URL falhou" };
  if (classe !== "indexada") return { estado: "fora-do-indice", classe, motivo: null };
  if (!impressoes) return { estado: "sem-leitura", classe, motivo: "sem leitura de impressões por página do Search Console" };
  if ("erro" in impressoes) return { estado: "sem-leitura", classe, motivo: `a leitura de impressões por página falhou (${impressoes.erro})` };
  if (impressoes.truncado) return { estado: "sem-leitura", classe, motivo: "a leitura de impressões por página veio truncada" };
  const vistas = impressoes.paginas.filter((p) => caminhoDe(p.pagina) === alvo).reduce((a, p) => a + p.impressoes, 0);
  return { estado: vistas >= 1 ? "ativa" : "indexada-sem-impressao", classe, motivo: null };
}

const SEM_ESTADO = { estado: "sem-leitura", classe: null, motivo: "estado da página não lido" };
/** Which covering page a term names when several cover it: the one closest to counting. */
const RANK = { ativa: 0, "indexada-sem-impressao": 1, "fora-do-indice": 2, "sem-leitura": 3 };

/**
 * Which cluster already has a page in the latest crawl: the seed as a word sequence in the path
 * (`/produtos/fita-gomada`) or in the title. A support page (cluster × segment) needs both. The
 * shortest matching URL wins, so the answer does not depend on crawl order. A page created outside
 * the plan (by hand, or by the robot) covers the same way.
 *
 * 057/D14: finding the cluster page is not counting its terms. Each term gets `cobertoPor`, the page
 * whose title OR H1 covers it (`cobreTermo`, each alone), and each referenced page carries its state
 * (D13), handed in by the caller: a page with no state is "sem leitura", never "ativa".
 *
 * @param {Cluster[]} clusters @param {{url: string, titulo?: string|null, h1?: string|null}[]|null|undefined} crawl
 * @param {{estados?: Record<string, EstadoDaPagina>}} [opts]
 * @returns {Cluster[]}
 */
export function cobrir(clusters, crawl, { estados = {} } = {}) {
  const paginas = [...(crawl ?? [])].sort((a, b) => a.url.length - b.url.length || (a.url < b.url ? -1 : 1)).map((p) => ({ ...p, textos: textosDe(p) }));
  const acha = (...sementes) => paginas.find((p) => p.textos.some((t) => sementes.every((s) => contem(t, normalizar(s)))))?.url ?? null;
  const estadoDe = (url) => estados[url] ?? SEM_ESTADO;
  const porEstado = [...paginas].sort((a, b) => RANK[estadoDe(a.url).estado] - RANK[estadoDe(b.url).estado]);
  const cobridor = (termo) => porEstado.find((p) => cobreTermo(termo, p.titulo) || cobreTermo(termo, p.h1))?.url ?? null;
  return clusters.map((c) => {
    const pagina = acha(c.semente);
    const termos = c.termos.map((t) => ({ ...t, cobertoPor: cobridor(t.termo) }));
    const urls = [...new Set([pagina, ...termos.map((t) => t.cobertoPor)].filter(Boolean))];
    return {
      ...c,
      termos,
      pagina,
      apoios: Object.fromEntries(Object.keys(c.segmentos).map((s) => [s, acha(c.semente, s)])),
      estadoDaPagina: pagina ? estadoDe(pagina) : null,
      estados: Object.fromEntries(urls.map((u) => [u, estadoDe(u)])),
    };
  });
}

// ── Schedule and proposal (D2, D8, D14, D15) ───────────────────────────────────

/** The label a page carries in the calendar: the seed in words, and the segment for a support page. */
export const rotuloDaPagina = (semente, segmento = null) => `«${normalizar(semente)}»${segmento ? ` × ${segmento}` : ""}`;
const palavras = (s) => normalizar(s).split(" ").filter(Boolean);

/**
 * @typedef {{tipo: "cluster"|"apoio-segmento"|"apoio-termo", semente: string, segmento?: string, termo?: string,
 *            volume: number, semana: number|null, alvo: string, cobre: string[]}} PaginaAgendada
 */

/** FR-005a exception: the seed of a cluster that has a page, missing from that page's title and H1.
 *  A second page for the same term would compete with the first; the fix is the title (week 1). */
const sementeSemTitulo = (c, t, pisoApoio) => Boolean(c.pagina) && !t.cobertoPor && normalizar(t.termo) === normalizar(c.semente) && typeof t.volume === "number" && t.volume >= pisoApoio;

/**
 * The pages to create, in order, and the week each one is created: uncovered cluster pages by volume,
 * then, together by volume, support pages per segment (cluster × segment ≥ `PISO_VOLUME`, not covered)
 * and per term (FR-005a: a cluster term ≥ `pisoApoio` that no existing page and no page earlier in the
 * queue covers), at most `capacidade` per week. A planned page covers what its label covers (`cobre`,
 * D14). A page that does not fit before the last week has `semana: null`. `propor` and `montar` both
 * read this, so the metas and the calendar cannot disagree.
 *
 * @param {Cluster[]} clusters @param {{capacidade: number, pisoApoio?: number, semanas?: number}} opts
 * @returns {PaginaAgendada[]}
 */
export function agendaDePaginas(clusters, { capacidade, pisoApoio = PREMISSAS_PADRAO.pisoApoio, semanas = SEMANAS }) {
  /** @type {Omit<PaginaAgendada, "semana"|"alvo">[]} */
  const fila = clusters.filter((c) => !c.pagina && c.volume > 0).map((c) => ({ tipo: "cluster", semente: c.semente, volume: c.volume, cobre: palavras(c.semente) }));
  const segmentos = clusters
    .flatMap((c) => Object.entries(c.segmentos).map(([segmento, volume]) => ({ tipo: "apoio-segmento", semente: c.semente, segmento, volume, cobre: palavras(`${c.semente} ${segmento}`), coberto: c.apoios?.[segmento] })))
    .filter((p) => p.volume >= PISO_VOLUME && !p.coberto)
    .map(({ coberto, ...p }) => p);
  const termos = clusters.flatMap((c) =>
    c.termos
      .filter((t) => typeof t.volume === "number" && t.volume >= pisoApoio && !t.cobertoPor && !sementeSemTitulo(c, t, pisoApoio))
      .map((t) => ({ tipo: "apoio-termo", semente: c.semente, termo: t.termo, volume: t.volume, cobre: palavras(t.termo) })),
  );
  const rotulo = (p) => (p.tipo === "apoio-termo" ? rotuloDaPagina(p.termo) : rotuloDaPagina(p.semente, p.segmento));
  for (const p of [...segmentos, ...termos].sort((a, b) => b.volume - a.volume || (rotulo(a) < rotulo(b) ? -1 : 1)))
    if (p.tipo !== "apoio-termo" || !fila.some((q) => cobreTermo(p.termo, q.cobre.join(" ")))) fila.push(p);
  return fila.map((p, i) => {
    const semana = capacidade > 0 ? Math.floor(i / capacidade) + 1 : null;
    return { ...p, semana: semana !== null && semana <= semanas ? semana : null, alvo: rotulo(p) };
  });
}

/** The posição levers that act on an existing URL (D15): 054's `posicao` step minus `cobertura` (the
 *  page exists) and `marca` (it acts on the brand, not on a page). Derived, never a literal list. */
const POSICAO_DA_PAGINA = Object.keys(ALAVANCAS).filter((a) => ALAVANCAS[a].degrau === "posicao" && a !== "cobertura" && a !== "marca");

/**
 * The week-1 levers of an existing page that is not `ativa` (D15). `[]` for an `ativa` page, which
 * counts from week 0. `null` for an indexed page whose impression reading failed: asking to index an
 * indexed page is the wrong lever, so there is no task, and it counts nowhere until a complete reading.
 *
 * @param {EstadoDaPagina} e @returns {string[]|null}
 */
export function alavancasDaPagina(e) {
  if (e.estado === "ativa") return [];
  if (e.estado === "indexada-sem-impressao") return POSICAO_DA_PAGINA;
  if (e.estado === "sem-leitura" && e.classe === "indexada") return null;
  return ["indexacao"];
}

/** The plan week a date falls in, 1-based from `inicio`. */
const semanaDe = (dia, inicio) => Math.floor((Date.parse(`${dia}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / (7 * 864e5)) + 1;

/**
 * The week an existing page is "created" for maturation (D15): 0 when `ativa`; otherwise the week of
 * the first 055 marca, made on or after the start, on any of its week-1 levers; `Infinity` without one.
 * The marca is per lever per project (055), so one `indexacao` marca starts every page that had it.
 *
 * @param {EstadoDaPagina} e @param {{marcas: {alavanca: string, marcado: string}[], inicio: string}} ctx
 */
export function criacaoDaPagina(e, { marcas, inicio }) {
  const alavancas = alavancasDaPagina(e);
  if (alavancas === null) return Infinity;
  if (!alavancas.length) return 0;
  const semanas = marcas.filter((m) => alavancas.includes(m.alavanca) && m.marcado >= inicio).map((m) => semanaDe(m.marcado, inicio));
  return semanas.length ? Math.min(...semanas) : Infinity;
}

/**
 * The page that makes each cluster term count, and the week it is created: the existing page that
 * covers it by title or H1 (`cobertoPor`, created per `criacaoDaPagina`) or a planned page whose label
 * covers it (its `semana`), the earliest one. `null` when nothing covers the term. The ONE helper both
 * `propor` and `montar` read, so the metas and the calendar cannot disagree.
 *
 * @returns {Map<Termo, {pagina: string, semana: number, existente: boolean}|null>}
 */
function donos(clusters, agenda, { marcas, inicio }) {
  const planejadas = agenda.map((p) => ({ pagina: p.alvo, semana: p.semana ?? Infinity, texto: p.cobre.join(" "), existente: false }));
  /** @type {Map<Termo, {pagina: string, semana: number, existente: boolean}|null>} */
  const r = new Map();
  for (const c of clusters)
    for (const t of c.termos) {
      if (typeof t.volume !== "number") continue;
      const opcoes = [
        ...(t.cobertoPor ? [{ pagina: t.cobertoPor, semana: criacaoDaPagina(c.estados?.[t.cobertoPor] ?? SEM_ESTADO, { marcas, inicio }), existente: true }] : []),
        ...planejadas.filter((p) => cobreTermo(t.termo, p.texto)),
      ];
      r.set(t, opcoes.reduce((melhor, o) => (!melhor || o.semana < melhor.semana ? o : melhor), null));
    }
  return r;
}

/**
 * What the schedule delivers by week `n`: the terms (and their volume) whose covering page has
 * stabilized (D14). Terms with `null` volume and `semCluster` count on neither side of `maduros` and
 * only `semCluster` counts in `total`: the denominator is the frozen inventory, the same one the map reads.
 */
function entrega(clusters, semCluster, dono, agenda, estabilizar, n) {
  const comVolume = (ts) => ts.filter((t) => typeof t.volume === "number");
  const total = clusters.reduce((a, c) => a + comVolume(c.termos).length, 0) + comVolume(semCluster).length;
  const volumeTotal = clusters.reduce((a, c) => a + c.volume, 0) + comVolume(semCluster).reduce((a, t) => a + t.volume, 0);
  /** @type {Map<string, {termos: number, volume: number}>} */
  const porPagina = new Map();
  let termos = 0;
  let volume = 0;
  const clustersMaduros = new Set();
  for (const c of clusters)
    for (const t of comVolume(c.termos)) {
      const d = dono.get(t);
      if (!d || d.semana + estabilizar > n) continue;
      termos += 1;
      volume += t.volume;
      clustersMaduros.add(c.semente);
      const p = porPagina.get(d.pagina) ?? { termos: 0, volume: 0 };
      porPagina.set(d.pagina, { termos: p.termos + 1, volume: p.volume + t.volume });
    }
  const novas = agenda.filter((p) => p.semana !== null && p.semana + estabilizar <= n).length;
  return { total, volumeTotal, termos, volume, novas, clusters: clustersMaduros.size, porPagina };
}

/** The value of each demand key from an `entrega`. One function for the proposal and the calendar. */
function valores(e) {
  return {
    top20: e.total ? e.termos / e.total : 0,
    pagina1: e.total ? e.termos / e.total : 0,
    tamBusca: e.volumeTotal ? e.volume / e.volumeTotal : 0,
    impressoes: e.volume,
    cliques: Math.round(e.volume * benchmark(POSICAO_ALVO_180)),
  };
}

/**
 * @typedef {{chave: string, prazo: number, origem: string, valor: number|null, op: string, conta: string,
 *            aviso?: string, ausente?: string, partida?: number, distancia?: number}} MetaProposta
 */

/** Every meta that needs a decision before a version can be activated: one per ruled leaf at 90 days,
 *  one per demand key at its deadline. The 90-day headline clicks/impressions are absent by design. */
export function metasExigidas() {
  return [
    ...Object.keys(REGRAS).filter((k) => REGRAS[k] && !tem(DEMANDA, k)).map((chave) => ({ chave, prazo: PRAZOS[0] })),
    ...Object.entries(DEMANDA).map(([chave, prazo]) => ({ chave, prazo })),
  ];
}

const SEM_NOVA = "nenhuma página nova amadurece antes deste prazo com estas premissas";
const BASE_ZERO = "base zero: a meta relativa só vale quando a base tiver leitura";
/** How a page reads in a `conta`: the path for an existing URL, the label for a planned page. */
function nomeDaPagina(p) {
  if (p.startsWith("«")) return p;
  try {
    return decodeURIComponent(new URL(p).pathname);
  } catch {
    return p;
  }
}
/** D13, in words: the state is never color alone (FR-020). The map prints it; the plan never does (058). */
export const ESTADO_PAGINA = {
  ativa: "ativa: indexada e com impressão",
  "indexada-sem-impressao": "indexada, sem impressão",
  "fora-do-indice": "fora do índice",
  "sem-leitura": "sem leitura",
};
/** A `conta` stays well under the 2,000 characters `lerDecisao` accepts. */
const ATE_PAGINAS = 6;

/** FR-007b: per page, the terms and volume it covers by the deadline; then the existing pages that
 *  cover terms but do not count yet, by what they wait for (058 FR-001: the future, never the state). */
function contaPorPagina(e, paradas) {
  const lista = [...e.porPagina].sort((a, b) => b[1].volume - a[1].volume || (a[0] < b[0] ? -1 : 1));
  const txt = lista.slice(0, ATE_PAGINAS).map(([p, x]) => `${nomeDaPagina(p)} cobre ${num(x.termos)} ${x.termos === 1 ? "termo" : "termos"}, ${num(x.volume)} buscas/mês`);
  if (lista.length > ATE_PAGINAS) txt.push(`mais ${num(lista.length - ATE_PAGINAS)} páginas`);
  const porPagina = txt.length ? `Por página: ${txt.join("; ")}.` : "Nenhuma página cobre termo maduro neste prazo.";
  const nomes = (ps) => ps.slice(0, ATE_PAGINAS).map(([url]) => nomeDaPagina(url)).join(", ");
  const comTarefa = paradas.filter(([, est]) => alavancasDaPagina(est) !== null);
  const semImpressao = paradas.filter(([, est]) => alavancasDaPagina(est) === null);
  return [
    porPagina,
    ...(comTarefa.length ? [`Só conta depois que a tarefa da página for feita: ${nomes(comTarefa)}.`] : []),
    ...(semImpressao.length ? [`Só conta depois da próxima leitura de impressões: ${nomes(semImpressao)}.`] : []),
  ].join(" ");
}

/** The existing covering pages that count in no deadline yet: a task not done, or no impression read. */
function paginasParadas(clusters, ctx) {
  const r = new Map();
  for (const c of clusters)
    for (const t of c.termos) {
      const est = t.cobertoPor ? (c.estados?.[t.cobertoPor] ?? SEM_ESTADO) : null;
      if (est && criacaoDaPagina(est, ctx) === Infinity) r.set(t.cobertoPor, est);
    }
  return [...r];
}

/**
 * One meta per ruled leaf, and the demand metas (D1, D2). REGRAS leaves keep their limiar and seal
 * (deadline 90: the rule applies from the first week). `top20` (90 d) and `tamBusca` (180 d) get the
 * demand math instead; `strikingDistance` does not — it is a queue, and a term climbing into the Top 3
 * would read as a loss (analyze I1). The page-1 target lives in the headline `pagina1`.
 *
 * 057/D14–D15: a term counts once the page that covers it by title or H1 (or by label, if planned)
 * has stabilized; an existing page counts from week 0 only when `ativa`, otherwise from its 055 marca.
 *
 * @param {Cluster[]} clusters with `pagina`, `cobertoPor` and `estados` from `cobrir`
 * @param {{premissas: typeof PREMISSAS_PADRAO, inicio: string, semCluster?: Termo[], marcas?: {alavanca: string, marcado: string}[],
 *          partida?: {top20?: number|null, tamBusca?: number|null, pagina1?: number|null}|null}} opts
 * @returns {MetaProposta[]}
 */
export function propor(clusters, { premissas, inicio, semCluster = [], partida = null, marcas = [] }) {
  const { capacidade, semanasAteEstabilizar: estab, pisoApoio = PREMISSAS_PADRAO.pisoApoio } = premissas;
  const agenda = agendaDePaginas(clusters, { capacidade, pisoApoio });
  const dono = donos(clusters, agenda, { marcas, inicio });
  /** @type {MetaProposta[]} */
  const metas = [];

  for (const [chave, r] of Object.entries(REGRAS)) {
    if (!r || tem(DEMANDA, chave)) continue;
    const m = { chave, prazo: PRAZOS[0], origem: r.origem, valor: r.limiar, op: r.op, conta: `Limiar da regra do mapa (054): ${metaTexto(r)}. ${ORIGEM[r.origem]}.` };
    if (chave === "crescimentoNaoMarca" || chave === "consultasUnicas") m.aviso = BASE_ZERO;
    metas.push(m);
  }

  const semanaFinal = (prazo) => semanaDoPrazo(prazo);
  const regra = (prazo) =>
    `Um termo conta quando a página que tem todas as palavras dele no título ou no H1 estabiliza: ${estab} semanas depois de criada (uma página existente sem tarefa pendente conta desde o início; uma com tarefa, a partir da semana em que a tarefa for feita). ${capacidade} páginas novas por semana. Prazo ${prazo} dias (semana ${semanaFinal(prazo)} a partir de ${inicio}).`;
  const pos = (prazo) => (prazo === PRAZOS[0] ? "posição-alvo Top 20" : "posição-alvo 7 a 10");
  const paradas = paginasParadas(clusters, { marcas, inicio });

  for (const [chave, prazo] of Object.entries(DEMANDA)) {
    const e = entrega(clusters, semCluster, dono, agenda, estab, semanaFinal(prazo));
    const v = valores(e)[chave];
    const volume = `${num(e.volume)} de ${num(e.volumeTotal)} buscas/mês`;
    const porPagina = contaPorPagina(e, paradas);
    const conta = {
      top20: `${num(e.termos)} de ${num(e.total)} termos do inventário (${pct(v)}) com página estabilizada · ${volume} · ${pos(prazo)}. ${porPagina} ${regra(prazo)}`,
      pagina1: `${num(e.termos)} de ${num(e.total)} termos do inventário (${pct(v)}) com página estabilizada · ${volume} · ${pos(prazo)}. ${porPagina} ${regra(prazo)}`,
      tamBusca: `${volume} (${pct(v)}) nos termos com página estabilizada · ${pos(prazo)}: na página 1, cada busca é uma impressão. ${porPagina} ${regra(prazo)}`,
      impressoes: `${volume} nos termos com página estabilizada · ${pos(prazo)}: na página 1, cada busca é uma impressão. ${porPagina} ${regra(prazo)}`,
      cliques: `${num(e.volume)} buscas/mês × ${pct(benchmark(POSICAO_ALVO_180))} (piso de CTR da régua na posição 7 a 10) = ${num(v)} cliques/mês. ${porPagina} ${regra(prazo)}`,
    }[chave];
    /** @type {MetaProposta} */
    const m = { chave, prazo, origem: "demanda", valor: v, op: "<", conta };
    if (!e.novas) m.aviso = SEM_NOVA;
    const p = partida?.[chave];
    if (typeof p === "number" && Number.isFinite(p)) Object.assign(m, { partida: p, distancia: v - p });
    metas.push(m);
  }
  // 90 days is Top 20, which is page 2 for most terms: there is no CTR ruler there
  // (`benchmark(>10.9)` is null), so no click or impression is projected. Absent, never 0.
  for (const chave of ["impressoes", "cliques"])
    metas.push({ chave, prazo: PRAZOS[0], origem: "demanda", valor: null, op: "<", conta: "", ausente: "aos 90 dias a posição-alvo é o Top 20, e a página 2 não tem régua de CTR: o hub não projeta clique nem impressão ali" });
  return metas;
}

// ── Calendar (D8) ──────────────────────────────────────────────────────────────

const ORDEM_DAS_ALAVANCAS = Object.keys(ALAVANCAS);
const ORDEM_DOS_DEGRAUS = DEGRAUS.map((g) => g.id);
/** The leaves each lever moves, read from the rules (054), plus the headlines for coverage. */
const kpisDa = (alavanca) => [...Object.keys(REGRAS).filter((k) => REGRAS[k]?.alavanca === alavanca), ...(alavanca === "cobertura" ? CABECALHOS : [])];
/** Making a page right happens the week it is born; none of these can precede it (FR-012). */
const JUNTO_DA_PAGINA = ["links", "titulo", "schema"];
/** 054 order: step, then lever declaration. */
const ordem054 = (a, b) =>
  ORDEM_DOS_DEGRAUS.indexOf(ALAVANCAS[a].degrau) - ORDEM_DOS_DEGRAUS.indexOf(ALAVANCAS[b].degrau) || ORDEM_DAS_ALAVANCAS.indexOf(a) - ORDEM_DAS_ALAVANCAS.indexOf(b);

/**
 * @typedef {{alavanca: string, alvos: string[], kpis: string[], responsavel: string|null, origem: string[], voltou?: boolean}} Tarefa
 * @typedef {{n: number, inicio: string, tarefas: Tarefa[], marcos: Record<string, number|null>}} Semana
 */

/**
 * The weekly plan. Each created page emits `cobertura`, then `links`/`titulo`/`schema` the same week,
 * then `indexacao` `semanasAteIndexar` later. An existing covering page that is not `ativa` emits its
 * D15 levers in week 1, and a cluster page missing its seed in the title gets `titulo` in week 1
 * (FR-005a exception). The same lever in one week is one task with every target (054 FR-009).
 * Milestones are what the schedule delivers each week; at a deadline, the milestone is the APPROVED
 * meta (analyze I3), and a meta the schedule does not reach is "não cabe".
 *
 * @param {{inicio: string, capacidade: number, semanasAteIndexar: number, semanasAteEstabilizar: number, pisoApoio?: number,
 *          clusters: Cluster[], semCluster?: Termo[], metas: {chave: string, prazo: number, valor: number}[],
 *          marcas?: {alavanca: string, marcado: string}[], responsavel: string}} p
 * @returns {{avisos: string[], naoCabe: {chave: string, prazo: number, texto: string}[], semanas: Semana[], agenda: PaginaAgendada[]}}
 */
export function montar({ inicio, capacidade, semanasAteIndexar, semanasAteEstabilizar, pisoApoio = PREMISSAS_PADRAO.pisoApoio, clusters, semCluster = [], metas, marcas = [], responsavel }) {
  const agenda = agendaDePaginas(clusters, { capacidade, pisoApoio });
  const dono = donos(clusters, agenda, { marcas, inicio });
  const aprovada = new Map(metas.filter((m) => tem(DEMANDA, m.chave) && m.prazo === DEMANDA[m.chave]).map((m) => [m.chave, m.valor]));

  /** @type {Map<number, Map<string, Set<string>>>} */
  const porSemana = new Map();
  const poe = (n, alavanca, alvo) => {
    if (n > SEMANAS) return;
    if (!porSemana.has(n)) porSemana.set(n, new Map());
    const s = porSemana.get(n);
    if (!s.has(alavanca)) s.set(alavanca, new Set());
    s.get(alavanca).add(alvo);
  };
  for (const p of agenda) {
    if (p.semana === null) continue;
    poe(p.semana, "cobertura", p.alvo);
    for (const a of JUNTO_DA_PAGINA) poe(p.semana, a, p.alvo);
    poe(p.semana + semanasAteIndexar, "indexacao", p.alvo);
  }
  // D15: the existing covering pages that are not ativa. An indexed page whose impression reading
  // failed gets no task: the first line says what it waits for (058: the reading's failure is on the map).
  /** @type {Set<string>} */
  const semImpressao = new Set();
  for (const c of clusters) {
    for (const [url, e] of Object.entries(c.estados ?? {})) {
      if (url === c.pagina && !c.termos.some((t) => t.cobertoPor === url)) continue; // covers nothing yet: only its titulo task
      const alavancas = alavancasDaPagina(e);
      if (alavancas === null) semImpressao.add(url);
      else for (const a of alavancas) poe(1, a, url);
    }
    for (const t of c.termos) if (sementeSemTitulo(c, t, pisoApoio)) poe(1, "titulo", c.pagina);
  }

  let primeiraMaturacao = Infinity;
  for (const d of dono.values()) if (d) primeiraMaturacao = Math.min(primeiraMaturacao, d.semana + semanasAteEstabilizar);

  const semanas = Array.from({ length: SEMANAS }, (_, i) => {
    const n = i + 1;
    const tarefas = [...(porSemana.get(n) ?? new Map())]
      .map(([alavanca, alvos]) => ({ alavanca, alvos: [...alvos], kpis: kpisDa(alavanca), responsavel, origem: ["calendario"] }))
      // The page is born first: every other task of its week works on it (FR-012).
      .sort((a, b) => Number(b.alavanca === "cobertura") - Number(a.alavanca === "cobertura") || ordem054(a.alavanca, b.alavanca));
    const v = valores(entrega(clusters, semCluster, dono, agenda, semanasAteEstabilizar, n));
    /** @type {Record<string, number|null>} */
    const marcos = {};
    for (const chave of aprovada.keys()) {
      // Before the first page stabilizes there is nothing to expect: the milestone has not arrived.
      marcos[chave] = n === semanaDoPrazo(DEMANDA[chave]) ? aprovada.get(chave) : n < primeiraMaturacao ? null : v[chave];
    }
    if (capacidade > 0) marcos.paginas = agenda.filter((p) => p.semana !== null && p.semana <= n).length;
    return { n, inicio: addDaysISO(inicio, 7 * i), tarefas, marcos };
  });

  const naoCabe = [...aprovada]
    .filter(([chave, valor]) => {
      const entregue = valores(entrega(clusters, semCluster, dono, agenda, semanasAteEstabilizar, semanaDoPrazo(DEMANDA[chave])))[chave];
      return !(igual(chave, entregue, valor) || entregue > valor);
    })
    .map(([chave]) => ({ chave, prazo: DEMANDA[chave], texto: "não cabe no prazo com esta capacidade" }));

  const avisos = [];
  if (semImpressao.size)
    avisos.push(`${num(semImpressao.size)} ${semImpressao.size === 1 ? "página existente não conta" : "páginas existentes não contam"} nas metas até a próxima leitura de impressões.`);
  if (capacidade === 0) avisos.push("Capacidade 0: nenhuma página nova entra no plano, e nenhum marco de cobertura é alcançável.");
  for (const x of naoCabe) avisos.push(`${nomeDe(x.chave)} em ${x.prazo} dias: ${x.texto}.`);
  const fora = agenda.filter((p) => p.semana === null).length;
  if (capacidade > 0 && fora) avisos.push(`${num(fora)} ${fora === 1 ? "página não cabe" : "páginas não cabem"} nas ${SEMANAS} semanas com ${capacidade} por semana.`);
  return { avisos, naoCabe, semanas, agenda };
}

/**
 * The current week with the map's cards (FR-011a, D16): the 054 `plano()` entries that fire today and
 * have no vigente marca (`ativa`) or came back past `reler` (`voltou`, "ainda dispara"). A lever in
 * both becomes one task with the union of targets and KPIs; a card-only lever is appended in 054 order.
 * No 054 rule or text is copied: the entries come in as `plano()` built them. Called for the current
 * week only; a future week has no reading to fire a card.
 *
 * @param {Semana} semana @param {{alavanca: string, apresentacao: string, alvos: string[], motivos: {chave: string}[],
 *   marca?: {responsavel: string}|null}[]} entradas
 * @returns {Semana}
 */
export function semanaComCards(semana, entradas) {
  const uniao = (a, b) => [...new Set([...a, ...b])];
  const tarefas = semana.tarefas.map((t) => ({ ...t, alvos: [...t.alvos], kpis: [...t.kpis], origem: [...(t.origem ?? ["calendario"])] }));
  const soCards = [];
  for (const e of entradas.filter((e) => e.apresentacao === "ativa" || e.apresentacao === "voltou")) {
    const kpis = [...new Set(e.motivos.map((m) => m.chave))];
    const voltou = e.apresentacao === "voltou";
    const t = tarefas.find((x) => x.alavanca === e.alavanca);
    if (t) Object.assign(t, { alvos: uniao(t.alvos, e.alvos), kpis: uniao(t.kpis, kpis), origem: uniao(t.origem, ["mapa"]), ...(voltou && { voltou }) });
    else soCards.push({ alavanca: e.alavanca, alvos: [...e.alvos], kpis, responsavel: e.marca?.responsavel ?? null, origem: ["mapa"], ...(voltou && { voltou }) });
  }
  soCards.sort((a, b) => ordem054(a.alavanca, b.alavanca));
  return { ...semana, tarefas: [...tarefas, ...soCards] };
}

/** The leaf or headline name, for a sentence. */
export const nomeDe = (chave) => NOMES[chave] ?? CATALOGO[chave]?.nome ?? chave;

/**
 * A task is done when the 055 mark of its lever was made on or after the week's start. No new
 * mechanism (FR-016): the map's "Marcar como feito" is the only way to mark.
 *
 * @param {{alavanca: string}} tarefa @param {{inicio: string}} semana @param {{alavanca: string, marcado: string}[]} marcas
 */
export function feita(tarefa, semana, marcas) {
  return (marcas ?? []).some((m) => m.alavanca === tarefa.alavanca && m.marcado >= semana.inicio);
}

// ── What /plano renders (058) ──────────────────────────────────────────────────

/**
 * The plan's screen, and the only thing `plano/page.tsx` renders from (058 FR-001, SC-001): the
 * future only. What leaves it lives on the map (research D1, D15): the metas' starting point and
 * distance, the page states, the marks, who decided and when, old versions and past weeks. The
 * present still decides what is scheduled (FR-002); it just never comes out here as a reading.
 *
 * `montar` keeps all 26 weeks (the map's `comparar()` indexes them); this view cuts the past.
 *
 * @param {{propostas: MetaProposta[], decisoes?: {chave: string, prazo: number, estado: string, valor: number|null}[],
 *          montado: ReturnType<typeof montar>|null, planos?: {versao: number, estado: string}[], clusters?: Cluster[],
 *          marcas?: {alavanca: string, marcado: string, reler: string}[], hoje: string, semanaAtual: number, inicio: string}} p
 */
export function vistaDoPlano({ propostas, decisoes = [], montado, planos = [], clusters = [], marcas = [], hoje, semanaAtual, inicio }) {
  const decisao = new Map(decisoes.map((d) => [`${d.chave}@${d.prazo}`, d]));
  const metas = propostas.map(({ partida, distancia, ...m }) => {
    const d = decisao.get(`${m.chave}@${m.prazo}`);
    return { ...m, estado: d?.estado ?? "proposta", valorFinal: d ? d.valor : null };
  });

  // ponytail: the mark filter and the carry-over live only until the backlog schedules from the current
  // week (T037); then marks act through each origin's ending rule (research D5).
  const vigente = (t, s) => marcas.some((m) => m.alavanca === t.alavanca && m.marcado >= s.inicio && hoje < m.reler);
  const todas = montado?.semanas ?? [];
  const primeira = Math.max(1, semanaAtual);
  const semanas = todas
    .filter((s) => s.n >= primeira)
    .map((s) => {
      const doPassado = s.n === semanaAtual ? todas.filter((p) => p.n < s.n).flatMap((p) => p.tarefas.filter((t) => !vigente(t, p))) : [];
      /** @type {Map<string, Tarefa>} */
      const porAlavanca = new Map();
      for (const t of [...s.tarefas.filter((t) => !vigente(t, s)), ...doPassado]) {
        const x = porAlavanca.get(t.alavanca);
        const uniao = (a, b) => [...new Set([...a, ...b])];
        porAlavanca.set(t.alavanca, x ? { ...x, alvos: uniao(x.alvos, t.alvos), kpis: uniao(x.kpis, t.kpis), origem: uniao(x.origem, t.origem) } : t);
      }
      const tarefas = [...porAlavanca.values()].sort((a, b) => Number(b.alavanca === "cobertura") - Number(a.alavanca === "cobertura") || ordem054(a.alavanca, b.alavanca));
      return { ...s, tarefas };
    });

  return {
    versoes: { ativo: planos.find((p) => p.estado === "ativo")?.versao ?? null, rascunho: planos.find((p) => p.estado === "rascunho")?.versao ?? null },
    metas,
    faltam: metasExigidas().filter((m) => !decisao.has(`${m.chave}@${m.prazo}`)).length,
    semanas,
    comecaEm: semanaAtual < 1 ? inicio : null,
    avisos: montado?.avisos ?? [],
    naoCabe: montado?.naoCabe ?? [],
    // `cobertoPor` stays: it is the input of the future pages (contracts/ui.md §8).
    clusters: clusters.map(({ estadoDaPagina, estados, ...c }) => c),
  };
}

// ── Weekly comparison (FR-015) ─────────────────────────────────────────────────

/** The five states, in glyph AND words (FR-020). The 055 glossary: no "ok", no ✓, no "dentro". */
export const ESTADOS = {
  "nao-chegou": { glifo: "○", texto: "marco não chegou" },
  "no-marco": { glifo: "●", texto: "no marco" },
  abaixo: { glifo: "▼", texto: "abaixo do marco" },
  acima: { glifo: "▲", texto: "acima do marco" },
  "sem-leitura": { glifo: "∅", texto: "sem leitura" },
};

/** Equal as printed: fractions at 0.1 pp, counts at the unit. Not a tolerance anyone invented. */
function igual(chave, a, b) {
  const r = (v) => (FRACOES.has(chave) ? Math.round(v * 1000) : Math.round(v));
  return r(a) === r(b);
}

function estadoDe(chave, marco, leitura) {
  if (marco === null || marco === undefined) return { estado: "nao-chegou" };
  if (!leitura) return { estado: "sem-leitura", motivo: "leitura não ligada nesta tela" };
  if ("ausente" in leitura) return { estado: "sem-leitura", motivo: leitura.ausente };
  if ("indecisa" in leitura) return { estado: "sem-leitura", motivo: leitura.indecisa };
  if (typeof leitura.valor !== "number" || !Number.isFinite(leitura.valor)) return { estado: "sem-leitura", motivo: "valor não numérico na leitura" };
  if (igual(chave, leitura.valor, marco)) return { estado: "no-marco", lido: leitura.valor };
  return { estado: leitura.valor < marco ? "abaixo" : "acima", lido: leitura.valor };
}

/**
 * Each milestone of week `n` against the map's reading. `anteriores` is the reading of the same
 * window shifted 7 days back (D11): below now and below last week → suggest redoing that meta's
 * proposal, never change it (FR-017). A previous reading that is absent never guesses.
 *
 * @param {Semana[]|{n: number, marcos: Record<string, number|null>}[]} semanas
 * @param {Record<string, any>} leituras @param {number} n
 * @param {Record<string, any>|null} [anteriores]
 */
export function comparar(semanas, leituras, n, anteriores = null) {
  const atual = semanas[n - 1];
  const antes = n > 1 ? semanas[n - 2] : null;
  if (!atual) return [];
  return Object.keys(atual.marcos)
    .filter((k) => k !== "paginas")
    .map((chave) => {
      const marco = atual.marcos[chave];
      const e = estadoDe(chave, marco, leituras?.[chave]);
      const prev = antes && anteriores ? estadoDe(chave, antes.marcos[chave], anteriores[chave]) : null;
      return { chave, marco, lido: e.lido ?? null, estado: e.estado, motivo: e.motivo ?? null, sugerirRefazer: e.estado === "abaixo" && prev?.estado === "abaixo" };
    });
}

/**
 * The readings `comparar` needs for the demand keys, from one query-dimension read of the Search
 * Console. The same functions the map uses for its leaves (`penetracaoNoInventario`,
 * `coberturaDaDemanda`), so the plan block and the leaf print the same number; the map calls it twice,
 * for the current window and for the one shifted 7 days back (D11).
 *
 * @param {{termo: string, cliques?: number, impressoes: number, posicao: number|null}[]|null} linhas
 * @param {{termos: string[], total: number}|null} inventario
 * @param {{termos: Record<string, number>, paga: boolean}|null} demanda
 * @param {string} [semLinhas] why there are no lines
 */
export function leiturasDoPlano(linhas, inventario, demanda, semLinhas = "sem leitura por termo do Search Console") {
  const chaves = ["top20", "pagina1", "tamBusca", "impressoes", "cliques"];
  if (!linhas) return Object.fromEntries(chaves.map((k) => [k, { ausente: semLinhas }]));
  const semInventario = { ausente: "inventário de termos não declarado" };
  const lido = (valor, texto) => ({ valor, texto, fonte: "Search Console, leitura por termo" });
  const fracao = (ate) => {
    const r = penetracaoNoInventario(linhas, inventario, ate);
    return r ? lido(r.fracao, `${pct(r.fracao)} (${num(r.dentro)} de ${num(r.total)} termos)`) : semInventario;
  };
  const cob = demanda ? coberturaDaDemanda(linhas, demanda.termos) : null;
  const monitorados = new Set(inventario?.termos ?? []);
  const cliques = linhas.filter((l) => monitorados.has(l.termo)).reduce((a, l) => a + (l.cliques ?? 0), 0);
  return {
    top20: fracao(20),
    pagina1: fracao(ATE_PAGINA1),
    // The GSC-floor estimate (050) is a ceiling: at or above the meta it proves nothing, as on the map.
    tamBusca: !cob
      ? { ausente: "sem demanda congelada" }
      : !demanda.paga && cob.fracao >= REGRAS.tamBusca.limiar
        ? { indecisa: "a estimativa é teto e passa da meta" }
        : lido(cob.fracao, `${pct(cob.fracao)} da demanda`),
    impressoes: cob ? lido(cob.impressoes, `${num(cob.impressoes)} impressões em 28 dias`) : { ausente: "sem demanda congelada" },
    cliques: inventario ? lido(cliques, `${num(cliques)} cliques em 28 dias`) : semInventario,
  };
}

// ── Form validation (like `lerMarca`, 055) ─────────────────────────────────────

const ESTADOS_DA_META = ["aprovada", "editada", "recusada"];
const ORIGENS = ["demanda", ...Object.keys(ORIGEM)];
const inteiro = (v, min, max) => {
  const s = String(v ?? "").trim();
  if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
};
const finito = (v) => {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const ehChave = (k) => CABECALHOS.includes(k) || (tem(REGRAS, k) && REGRAS[k] !== null);

/**
 * The whole validation of a meta decision. Input outside the contract returns `null` and nothing is
 * written. On approval the final value is the proposed one; on refusal it is `null`.
 *
 * @param {Record<string, unknown>} c @param {{slugs: string[]}} ctx
 */
export function lerDecisao(c, { slugs }) {
  const projeto = String(c.projeto ?? "");
  const chave = String(c.chave ?? "");
  const estado = String(c.estado ?? "");
  const origem = String(c.origem ?? "");
  const versao = inteiro(c.versao, 1, 1e6);
  const prazo = Number(c.prazo);
  const proposto = finito(c.proposto);
  const conta = String(c.conta ?? "");
  if (!slugs.includes(projeto) || versao === null || !ehChave(chave) || !PRAZOS.includes(prazo)) return null;
  if (!ESTADOS_DA_META.includes(estado) || !ORIGENS.includes(origem) || proposto === null || conta.length > 2000) return null;
  if (!RESPONSAVEL_IDS.includes(String(c.responsavel))) return null;
  const valor = estado === "recusada" ? null : estado === "aprovada" ? proposto : finito(c.valor);
  if (estado === "editada" && valor === null) return null;
  return { projeto, versao, chave, prazo, origem, proposto, valor, conta, estado, decididoPor: String(c.responsavel) };
}

/** Monday of the ISO date's week, or `null` for a string that is not a real date. */
export function segundaDe(iso) {
  const s = String(iso ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null;
  return addDaysISO(s, -((d.getUTCDay() + 6) % 7));
}

/**
 * The plan's premises form: capacity 0–20 pages a week, the two maturation premises 0–26 weeks, the
 * support-page floor 1–100000 searches/month (absent → the default), and the start snapped to its
 * Monday. Outside the contract → `null`.
 *
 * @param {Record<string, unknown>} c @param {{slugs: string[]}} ctx
 */
export function lerPlano(c, { slugs }) {
  const projeto = String(c.projeto ?? "");
  const inicio = segundaDe(c.inicio);
  const capacidade = inteiro(c.capacidade, 0, 20);
  const semanasAteIndexar = inteiro(c.semanasAteIndexar, 0, 26);
  const semanasAteEstabilizar = inteiro(c.semanasAteEstabilizar, 0, 26);
  const pisoApoio = c.pisoApoio === undefined ? PREMISSAS_PADRAO.pisoApoio : inteiro(c.pisoApoio, 1, 100000);
  if (!slugs.includes(projeto) || !RESPONSAVEL_IDS.includes(String(c.responsavel)) || !inicio) return null;
  if (capacidade === null || semanasAteIndexar === null || semanasAteEstabilizar === null || pisoApoio === null) return null;
  return { projeto, criadoPor: String(c.responsavel), inicio, capacidade, semanasAteIndexar, semanasAteEstabilizar, pisoApoio };
}
