// THE NEXT ACTION OF EACH MAP LEAF (054).
//
// `gsc-delta.mjs#CATALOGO` says what JUDGES a leaf (ruler, seal, class). This module says what to DO
// when the leaf's reading crosses a threshold, and in which order the work comes. The two stay
// apart on purpose: a board target without a source may trigger WORK (owner's decision Q1, 22/09/2026),
// but it still never emits a verdict — mixing both in one field is how "< 15% rewrite" would end up
// printed like "LCP ≤ 2.5 s", the defect `/gsc` exists to flag.
//
// Thresholds with a published ruler are READ from `CATALOGO`/`BENCHMARK`, never written here. Board
// targets without a source live here once; the map page imports `LINKS_DO_BOARD` and
// `PROFUNDIDADE_DO_BOARD` instead of keeping its own copy (FR-002).
//
// Pure `.mjs` (constitution III): no disk, no network, no `process.env`.

import { CATALOGO } from "./gsc-delta.mjs";
import { BENCHMARK } from "./kpis-busca.mjs";
import { TERMO_ATE, TITULO_PX_MAX } from "./grafo.mjs";

export const LINKS_DO_BOARD = /** @type {const} */ ([5, 10]);
export const PROFUNDIDADE_DO_BOARD = 3;

// Attack order: an unindexed page gets zero clicks, so fixing its title first earns nothing.
export const DEGRAUS = [
  { id: "indice", nome: "1 · Índice", porque: "página fora do índice não recebe clique nenhum" },
  { id: "desempenho", nome: "2 · Desempenho", porque: "abaixo do limite atrapalha; acima dele, não rende mais" },
  { id: "pagina", nome: "3 · Página certa para o termo", porque: "a página errada não sobe com reforço" },
  { id: "posicao", nome: "4 · Posição", porque: "impressão só vem com a página nas duas primeiras páginas do Google" },
  { id: "snippet", nome: "5 · Snippet", porque: "CTR só se mede onde já há impressão" },
];

// Declaration order is the tie-break inside a step (research D7).
export const ALAVANCAS = {
  indexacao: { degrau: "indice", curta: "consertar o índice", acao: "Consertar o índice: tirar do sitemap o que não deve indexar e pedir a indexação do resto" },
  poda: { degrau: "indice", curta: "consolidar ou desindexar", acao: "Consolidar (301), enriquecer ou desindexar as páginas recusadas e sem impressão" },
  profundidade: { degrau: "indice", curta: "linkar as fundas", acao: "Linkar as páginas fundas e órfãs a partir da home, do menu ou de um hub" },
  vitais: { degrau: "desempenho", curta: "corrigir os vitais", acao: "Corrigir os vitais reprovados nas URLs prioritárias" },
  canibalizacao: { degrau: "pagina", curta: "consolidar a disputa", acao: "Escolher uma página por consulta disputada e consolidar a outra" },
  intencao: { degrau: "pagina", curta: "modificador no título", acao: "Pôr o modificador de intenção no título: Preço, Planos, Como, Guia" },
  links: { degrau: "posicao", curta: "apontar links internos", acao: "Apontar links contextuais para as páginas dos termos, a partir de páginas com tráfego" },
  cobertura: { degrau: "posicao", curta: "cobrir o termo", acao: "Criar página ou seção para os termos e subtemas sem cobertura" },
  frescor: { degrau: "posicao", curta: "revisar as vencidas", acao: "Revisar dados, preços e ano das páginas vencidas e declarar a data" },
  backlinks: { degrau: "posicao", curta: "conquistar domínios", acao: "Conquistar domínios que linkem para a pasta-alvo" },
  marca: { degrau: "posicao", curta: "gerar busca de marca", acao: "Gerar busca pela marca fora do Google" },
  schema: { degrau: "snippet", curta: "completar o schema", acao: "Adicionar o JSON-LD que falta nas páginas prioritárias" },
  titulo: { degrau: "snippet", curta: "reescrever o título", acao: `Reescrever o título: termo no início, até ${TITULO_PX_MAX}px` },
};

// The same words the leaf seal already prints (`board-gsc.mjs#selo`): no second seal taxonomy.
// Only the ◆ origin ever says "régua".
export const ORIGEM = {
  regua: "◆ régua publicada",
  norma: "◇ norma, não régua",
  meta: "◇ meta do board, sem fonte",
  politica: "◇ política do dono, sem fonte",
};
const PALAVRA = { regua: "régua", norma: "norma", meta: "meta", politica: "política" };

const pct = (v) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const num = (v) => v.toLocaleString("pt-BR");
const limite = (chave) => CATALOGO[chave].balizador.limite;
const PISOS = BENCHMARK.map((f) => (f.ctr * 100).toLocaleString("pt-BR")).join("/") + "%";

/**
 * One rule per catalog leaf. `valor` is what the page hands in (see data-model §3); `op` compares it
 * with `limiar`, and `critico` is a second threshold on the same scale. `null` = procedure, no number.
 *
 * @typedef {{alavanca: keyof typeof ALAVANCAS, origem: keyof typeof ORIGEM, op: "<"|">"|">=",
 *            limiar: number, critico?: number, unidade: "%"|"n"|"ms"|"cls"|"razao",
 *            meta?: string, se: (r: Regra) => string}} Regra
 * @type {Record<string, Regra|null>}
 */
export const REGRAS = {
  // ---------- CLIQUE ----------
  // `valor` = worst ratio (CI upper bound ÷ floor) among the bands the CI already puts below.
  ctrPorPosicao: { alavanca: "titulo", origem: "regua", op: "<", limiar: 1, critico: 0.5, unidade: "razao", meta: "régua: piso da posição", se: () => `uma faixa de posição fica abaixo do piso de CTR (${PISOS})` },
  penetracaoTop3: { alavanca: "links", origem: "meta", op: "<", limiar: 0.2, critico: 0.1, unidade: "%", se: (r) => `menos de ${pct(r.limiar)} do inventário está em posição ≤ 3` },
  strikingDistance: { alavanca: "links", origem: "meta", op: ">", limiar: 0, unidade: "n", meta: "meta: 15% a 25% delas no Top 3 por trimestre", se: () => "há consultas entre as posições 4,0 e 10,9" },
  crescimentoNaoMarca: { alavanca: "cobertura", origem: "meta", op: "<", limiar: 0.05, critico: 0, unidade: "%", se: (r) => `as impressões não-marca crescem menos de ${pct(r.limiar)} no mês` },
  checklistGsc: null,

  // ---------- CTR ----------
  impressoesTop3: { alavanca: "links", origem: "meta", op: "<", limiar: 0.4, unidade: "%", se: (r) => `menos de ${pct(r.limiar)} das impressões acontecem entre as posições 1,0 e 3,9` },
  // `valor` = worst CTR ÷ floor among the URLs below; below half the floor is the board's "grave" gap.
  ctrGap: { alavanca: "titulo", origem: "regua", op: "<", limiar: 1, critico: 0.5, unidade: "razao", meta: "régua: piso da posição", se: () => `uma URL fica abaixo do piso de CTR da posição dela (${PISOS})` },
  conformidadeUrls: { alavanca: "titulo", origem: "meta", op: "<", limiar: 0.75, unidade: "%", se: (r) => `menos de ${pct(r.limiar)} das URLs decididas atingem o piso` },
  schema: { alavanca: "schema", origem: "norma", op: "<", limiar: 1, unidade: "%", se: () => "alguma URL no índice não tem resultado enriquecido" },
  larguraTitulo: { alavanca: "titulo", origem: "regua", op: ">", limiar: 0, unidade: "n", meta: `régua ≤ ${limite("larguraTitulo")}px`, se: () => `algum título passa de ${limite("larguraTitulo")}px` },
  reescritaTitulo: { alavanca: "titulo", origem: "meta", op: ">", limiar: 0.15, unidade: "%", se: (r) => `o Google reescreve mais de ${pct(r.limiar)} dos títulos` },
  termoNoTitulo: { alavanca: "titulo", origem: "meta", op: ">", limiar: 0, unidade: "n", meta: `meta: termo nos ${TERMO_ATE} primeiros caracteres`, se: () => `o termo principal de alguma URL não está nos ${TERMO_ATE} primeiros caracteres do título` },
  intencao: { alavanca: "intencao", origem: "norma", op: ">", limiar: 0, unidade: "n", meta: "norma: modificador em todo título", se: () => "algum título não traz modificador de intenção" },

  // ---------- POSIÇÃO MÉDIA ----------
  lcp: { alavanca: "vitais", origem: "regua", op: ">", limiar: limite("lcp"), unidade: "ms", se: (r) => `o LCP p75 passa de ${num(r.limiar)} ms` },
  inp: { alavanca: "vitais", origem: "regua", op: ">", limiar: limite("inp"), unidade: "ms", se: (r) => `o INP p75 passa de ${num(r.limiar)} ms` },
  cls: { alavanca: "vitais", origem: "regua", op: ">", limiar: limite("cls"), unidade: "cls", se: (r) => `o CLS p75 passa de ${num(r.limiar)}` },
  ttfb: { alavanca: "vitais", origem: "regua", op: ">", limiar: limite("ttfb"), unidade: "ms", se: (r) => `o TTFB p75 passa de ${num(r.limiar)} ms` },
  urlsBoas: { alavanca: "vitais", origem: "meta", op: "<", limiar: 0.9, unidade: "%", se: (r) => `menos de ${pct(r.limiar)} das URLs prioritárias têm os três vitais bons` },
  indexacaoLimpa: { alavanca: "indexacao", origem: "meta", op: "<", limiar: 0.95, unidade: "%", se: (r) => `menos de ${pct(r.limiar)} das URLs do sitemap estão no índice` },
  rejeicaoRastreio: { alavanca: "poda", origem: "meta", op: ">=", limiar: 0.05, unidade: "%", se: (r) => `${pct(r.limiar)} ou mais do sitemap está "descoberta" ou "rastreada, mas não indexada"` },
  profundidadeClique: { alavanca: "profundidade", origem: "meta", op: ">", limiar: 0, unidade: "n", meta: `meta ≤ ${PROFUNDIDADE_DO_BOARD} cliques`, se: () => `alguma página está a mais de ${PROFUNDIDADE_DO_BOARD} cliques da home, ou órfã` },
  coberturaSemantica: { alavanca: "cobertura", origem: "meta", op: "<", limiar: 1, unidade: "%", se: () => "o Top 3 da SERP cobre subtema que a página não cobre" },
  frescor: { alavanca: "frescor", origem: "politica", op: ">", limiar: 0, unidade: "n", meta: "política: 6 meses (comercial), 12 (informacional)", se: () => "alguma página passou do prazo de revisão da intenção dela" },
  canibalizacao: { alavanca: "canibalizacao", origem: "norma", op: ">", limiar: 0, unidade: "n", se: () => "duas ou mais URLs dividem a mesma palavra-chave primária" },
  linksInternos: { alavanca: "links", origem: "meta", op: ">", limiar: 0, unidade: "n", meta: `meta ${LINKS_DO_BOARD[0]} a ${LINKS_DO_BOARD[1]} links por página`, se: () => `alguma página recebe menos de ${LINKS_DO_BOARD[0]} links contextuais` },
  referringDomains: { alavanca: "backlinks", origem: "meta", op: "<", limiar: 3, unidade: "n", se: (r) => `entram menos de ${r.limiar} domínios referenciadores novos no trimestre` },
  buscasDeMarca: { alavanca: "marca", origem: "meta", op: ">=", limiar: 2, unidade: "n", meta: "meta: busca de marca crescente", se: (r) => `a busca pela marca cai ${r.limiar} meses fechados seguidos` },

  // ---------- IMPRESSÕES ----------
  consultasUnicas: { alavanca: "cobertura", origem: "meta", op: "<", limiar: 0.1, critico: 0, unidade: "%", se: (r) => `as consultas únicas crescem menos de ${pct(r.limiar)} no trimestre` },
  top20: { alavanca: "cobertura", origem: "meta", op: "<", limiar: 0.6, unidade: "%", se: (r) => `menos de ${pct(r.limiar)} do inventário está entre as posições 1 e 20` },
  // 10 is the lower of the board's two targets (10–25 landing, 30–80 blog): the hub does not classify page type.
  queryToPage: { alavanca: "cobertura", origem: "meta", op: "<", limiar: 10, unidade: "n", se: (r) => `cada URL indexada atrai menos de ${r.limiar} consultas` },
  activeIndexRatio: { alavanca: "poda", origem: "meta", op: "<", limiar: 0.7, critico: 0.5, unidade: "%", se: (r) => `menos de ${pct(r.limiar)} das URLs indexadas têm impressão em 28 dias` },
  tamBusca: { alavanca: "cobertura", origem: "meta", op: "<", limiar: 0.6, unidade: "%", se: (r) => `o site cobre menos de ${pct(r.limiar)} dos clusters de maior volume` },
};

const compara = (v, op, l) => (op === "<" ? v < l : op === ">" ? v > l : v >= l);

function fmt(v, unidade) {
  if (unidade === "%") return pct(v);
  if (unidade === "ms") return `${num(v)} ms`;
  return num(v);
}

/** The threshold as printed next to the reading: "meta ≥ 95%", "régua ≤ 2.500 ms", "norma 0". */
export function metaTexto(regra) {
  if (regra.meta) return regra.meta;
  const p = PALAVRA[regra.origem];
  if (regra.op === ">" && regra.limiar === 0) return `${p} 0`;
  const sinal = regra.op === "<" ? "≥" : regra.op === ">" ? "≤" : "<";
  return `${p} ${sinal} ${fmt(regra.limiar, regra.unidade)}`;
}

/** "Se X, fazer Y. Origem: Z." — the whole rule, for the leaf note and the list version (US3). */
export function regraEmTexto(chave) {
  if (!(chave in REGRAS)) throw new Error(`folha fora do catálogo: ${chave}`);
  const r = REGRAS[chave];
  if (!r) return "Sem regra: é procedimento, não número. Os filtros dele alimentam as regras do CTR Gap, do striking distance e dos dados estruturados.";
  const acao = ALAVANCAS[r.alavanca].acao;
  return `Regra: se ${r.se(r)}, ${acao.charAt(0).toLowerCase()}${acao.slice(1)}. Origem do limiar: ${ORIGEM[r.origem]}.`;
}

/**
 * @typedef {{valor: number, texto: string, fonte: string, alvos?: string[], nAlvos?: number, piso?: boolean, ressalva?: string}
 *          | {ausente: string} | {indecisa: string}} Leitura
 */

/**
 * @typedef {{chave: string, estado: "critica"|"dispara"|"sem-acao"|"nao-decide"|"sem-leitura",
 *            alavanca: string|null, origem: keyof typeof ORIGEM|null, meta: string|null, texto: string|null,
 *            fonte: string|null, alvos: string[], nAlvos: number, piso: boolean, ressalva: string|null,
 *            motivo: string|null}} Disparo
 */

/** @param {string} chave @param {Leitura|undefined} l @returns {Disparo} */
function disparo(chave, l) {
  const regra = REGRAS[chave];
  const base = { chave, alavanca: regra?.alavanca ?? null, origem: regra?.origem ?? null, meta: regra ? metaTexto(regra) : null, texto: null, fonte: null, alvos: [], nAlvos: 0, piso: false, ressalva: null, motivo: null };
  if (!regra) return { ...base, estado: "sem-acao", motivo: "procedimento, sem número" };
  // A missing reading is a wiring gap on the page, never "no action": it must stay visible.
  if (!l) return { ...base, estado: "sem-leitura", motivo: "leitura não ligada nesta tela" };
  if ("ausente" in l) return { ...base, estado: "sem-leitura", motivo: l.ausente };
  if ("indecisa" in l) return { ...base, estado: "nao-decide", motivo: l.indecisa };
  // A string that looks numeric passes every "has value" test and compares wrong (ehApurado, 2026-09).
  if (typeof l.valor !== "number" || !Number.isFinite(l.valor)) return { ...base, estado: "sem-leitura", motivo: "valor não numérico na leitura" };
  const lido = { ...base, texto: l.texto, fonte: l.fonte, alvos: l.alvos ?? [], nAlvos: l.nAlvos ?? l.alvos?.length ?? 0, ressalva: l.ressalva ?? null };
  if (!compara(l.valor, regra.op, regra.limiar)) return { ...lido, estado: "sem-acao" };
  // A floor only errs downward: below the threshold it cannot prove "below", so it fires flagged
  // and never as critical (research D5).
  const piso = Boolean(l.piso) && regra.op === "<";
  const critica = !piso && regra.critico !== undefined && compara(l.valor, regra.op, regra.critico);
  return { ...lido, piso, estado: critica ? "critica" : "dispara" };
}

/** One dispatch per catalog leaf, wired or not. @param {Record<string, Leitura>} leituras @returns {Record<string, Disparo>} */
export function avaliar(leituras) {
  return Object.fromEntries(Object.keys(REGRAS).map((k) => [k, disparo(k, leituras[k])]));
}

/** The node tag. Read out of context it still says what to do and why (ux-writing test 4). */
export function etiqueta(d) {
  const extra = [d.piso ? "piso" : null, d.ressalva].filter(Boolean).map((x) => ` · ${x}`).join("");
  if (d.estado === "critica" || d.estado === "dispara") {
    const corpo = `→ ${ALAVANCAS[d.alavanca].curta} · ${d.texto} · ${d.meta}${extra}`;
    return d.estado === "critica" ? `‼ crítica ${corpo}` : corpo;
  }
  if (d.estado === "nao-decide") return `◐ sem ação · ${d.motivo}`;
  if (d.estado === "sem-leitura") return `∅ sem ação · ${d.motivo}`;
  return `sem ação · ${d.texto ?? d.motivo}`;
}

const ORDEM_DAS_FOLHAS = Object.keys(REGRAS);
const ORDEM_DAS_ALAVANCAS = Object.keys(ALAVANCAS);
const ativo = (d) => d.estado === "critica" || d.estado === "dispara";
// Among non-critical reasons, the lever's own leaf (hygiene or lever class) comes before result leaves.
const propria = (d) => (CATALOGO[d.chave].classe === "resultado" ? 0 : 1);

/**
 * The panel: fired dispatches grouped by lever (one entry per lever, FR-009), steps in attack order.
 * Across entries there is no impact order: entries in one step carry different currencies (pages,
 * terms, clicks), and the 051 queue already refused to compare currencies.
 *
 * @param {Record<string, Disparo>} disparos
 */
export function plano(disparos) {
  /** @type {Disparo[]} */
  const ds = Object.values(disparos);
  /** @type {Map<string, Disparo[]>} */
  const porAlavanca = new Map();
  for (const d of ds.filter(ativo)) porAlavanca.set(d.alavanca, [...(porAlavanca.get(d.alavanca) ?? []), d]);

  const entradas = [...porAlavanca].map(([id, motivos]) => {
    // Critical first: it is why the entry leads its step, and its targets are the ones the 051 queue
    // ordered by clicks (CTR Gap), which the owner kept as the order inside the step (Q2).
    motivos.sort(
      (a, b) =>
        Number(b.estado === "critica") - Number(a.estado === "critica") ||
        propria(b) - propria(a) ||
        ORDEM_DAS_FOLHAS.indexOf(a.chave) - ORDEM_DAS_FOLHAS.indexOf(b.chave),
    );
    const comAlvos = motivos.find((m) => m.alvos.length);
    return {
      alavanca: id,
      acao: ALAVANCAS[id].acao,
      critica: motivos.some((m) => m.estado === "critica"),
      motivos,
      // Which leaf the targets come from: "/contact" under "links" means "fewest incoming links",
      // not "the page of a term", and the panel must say so.
      alvosDe: comAlvos ? comAlvos.chave : null,
      alvos: comAlvos ? comAlvos.alvos.slice(0, 3) : [],
      nAlvos: comAlvos ? Math.max(comAlvos.nAlvos, comAlvos.alvos.length) : 0,
    };
  });

  const degraus = DEGRAUS.map((g) => ({
    ...g,
    entradas: entradas
      .filter((e) => ALAVANCAS[e.alavanca].degrau === g.id)
      .sort(
        (a, b) =>
          Number(b.critica) - Number(a.critica) ||
          b.motivos.length - a.motivos.length ||
          ORDEM_DAS_ALAVANCAS.indexOf(a.alavanca) - ORDEM_DAS_ALAVANCAS.indexOf(b.alavanca),
      ),
  })).filter((g) => g.entradas.length);

  return {
    degraus,
    semAcao: ds.filter((d) => d.estado === "sem-acao"),
    naoDecide: ds.filter((d) => d.estado === "nao-decide"),
    semLeitura: ds.filter((d) => d.estado === "sem-leitura"),
  };
}
