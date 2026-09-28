import { test } from "node:test";
import assert from "node:assert/strict";
import { ALAVANCAS, REGRAS } from "../lib/proxima-acao.mjs";
import { benchmark } from "../lib/kpis-busca.mjs";
import {
  CABECALHOS,
  ESTADOS,
  PREMISSAS_PADRAO,
  SEMANAS,
  agendaDePaginas,
  agrupar,
  cobreTermo,
  cobrir,
  comparar,
  estadoDaPagina,
  feita,
  kpisDoBoard,
  lerDemanda,
  leiturasDoPlano,
  lerDecisao,
  lerPlano,
  metasExigidas,
  montar,
  normalizar,
  propor,
  semanaComCards,
  semanaDoPrazo,
  vistaDoPlano,
  propostaDeIntencao,
  perguntasPropostas,
  aplicarNucleo,
  lerNucleo,
  lerItem,
} from "../lib/plano.mjs";
import { addDaysISO } from "../lib/agenda.mjs";
import { modificadoresDeIntencao } from "../lib/pagina.mjs";

const SLUGS = ["atma", "sirius", "tapepro"];

// ── T005 · validation of the two forms ─────────────────────────────────────────
const DECISAO = { projeto: "tapepro", versao: "1", chave: "top20", prazo: "90", estado: "aprovada", origem: "demanda", proposto: "0.5", conta: "c", responsavel: "jean" };

test("lerDecisao accepts the contract and keeps the proposed value on approval", () => {
  const d = lerDecisao(DECISAO, { slugs: SLUGS });
  assert.deepEqual(d, { projeto: "tapepro", versao: 1, chave: "top20", prazo: 90, origem: "demanda", proposto: 0.5, valor: 0.5, conta: "c", estado: "aprovada", decididoPor: "jean" });
  assert.equal(lerDecisao({ ...DECISAO, estado: "editada", valor: "0.7" }, { slugs: SLUGS }).valor, 0.7);
  assert.equal(lerDecisao({ ...DECISAO, estado: "recusada" }, { slugs: SLUGS }).valor, null);
  for (const h of CABECALHOS) assert.ok(lerDecisao({ ...DECISAO, chave: h, prazo: "180" }, { slugs: SLUGS }), h);
});

test("lerDecisao rejects everything outside the contract", () => {
  const ruim = [
    { responsavel: "joao" },
    { responsavel: "" },
    { chave: "toString" },
    { chave: "checklistGsc" }, // a procedure has no meta
    { chave: "naoExiste" },
    { prazo: "60" },
    { prazo: "120" },
    { valor: "Infinity", estado: "editada" },
    { valor: "abc", estado: "editada" },
    { proposto: "NaN" },
    { estado: "talvez" },
    { origem: "palpite" },
    { projeto: "outro" },
    { versao: "0" },
    { versao: "1.5" },
  ];
  for (const r of ruim) assert.equal(lerDecisao({ ...DECISAO, ...r }, { slugs: SLUGS }), null, JSON.stringify(r));
});

const PLANO = { projeto: "tapepro", responsavel: "maria", inicio: "2026-09-30", capacidade: "3", semanasAteIndexar: "2", semanasAteEstabilizar: "12" };

test("lerPlano snaps the start to Monday and accepts the bounds", () => {
  assert.deepEqual(lerPlano(PLANO, { slugs: SLUGS }), { projeto: "tapepro", criadoPor: "maria", inicio: "2026-09-28", capacidade: 3, semanasAteIndexar: 2, semanasAteEstabilizar: 12, pisoApoio: 100 });
  assert.ok(lerPlano({ ...PLANO, capacidade: "0" }, { slugs: SLUGS }));
  assert.ok(lerPlano({ ...PLANO, capacidade: "20", semanasAteIndexar: "0", semanasAteEstabilizar: "26" }, { slugs: SLUGS }));
});

test("lerPlano rejects capacity outside 0–20 and premises outside 0–26", () => {
  const ruim = [{ capacidade: "21" }, { capacidade: "-1" }, { capacidade: "2.5" }, { capacidade: "" }, { semanasAteIndexar: "27" }, { semanasAteEstabilizar: "-1" }, { semanasAteEstabilizar: "1.5" }, { responsavel: "x" }, { inicio: "2026-02-31" }, { inicio: "ontem" }, { projeto: "outro" }];
  for (const r of ruim) assert.equal(lerPlano({ ...PLANO, ...r }, { slugs: SLUGS }), null, JSON.stringify(r));
});

// T046 · the support-page floor (FR-005a): an integer 1–100000, 100 when the form does not send it
test("lerPlano: pisoApoio is an integer 1–100000, default 100", () => {
  assert.equal(lerPlano({ ...PLANO, pisoApoio: "1" }, { slugs: SLUGS }).pisoApoio, 1);
  assert.equal(lerPlano({ ...PLANO, pisoApoio: "100000" }, { slugs: SLUGS }).pisoApoio, 100000);
  assert.equal(lerPlano(PLANO, { slugs: SLUGS }).pisoApoio, PREMISSAS_PADRAO.pisoApoio);
  for (const v of ["0", "1.5", "abc", "100001", ""]) assert.equal(lerPlano({ ...PLANO, pisoApoio: v }, { slugs: SLUGS }), null, v);
});

// ── the 18 KPIs ────────────────────────────────────────────────────────────────
test("the board's 18 KPIs: 4 clique, 5 CTR, 4 posição, 5 impressões, every ruled leaf in exactly one", () => {
  const kpis = kpisDoBoard();
  assert.equal(kpis.length, 18);
  const porRamo = Object.groupBy(kpis, (k) => k.ramo);
  assert.deepEqual(Object.fromEntries(Object.entries(porRamo).map(([r, ks]) => [r, ks.length])), { clique: 4, ctr: 5, posicao: 4, impressoes: 5 });
  const folhas = kpis.flatMap((k) => k.folhas);
  assert.deepEqual([...folhas].sort(), Object.keys(REGRAS).filter((k) => REGRAS[k]).sort());
  assert.deepEqual(kpis.find((k) => k.folhas.includes("conformidadeUrls")).folhas, ["ctrGap", "conformidadeUrls"]);
});

// ── T008 · normalizar and agrupar ──────────────────────────────────────────────
const SEMENTES = { produtos: ["fita-gomada", "fita-transparente-personalizada", "fita-transparente"], segmentos: ["e-commerce", "distribuidor"] };

test("normalizar: lowercase, no accents, hyphen → space", () => {
  assert.equal(normalizar("Fita-Gomada  PREÇO"), "fita gomada preco");
  assert.equal(normalizar("e-commerce"), "e commerce");
});

test("agrupar: seed contained, longer seed wins, segment tag, no seed → semCluster, deterministic", () => {
  const termos = [
    { termo: "fita gomada preço", volume: 90 },
    { termo: "fita gomada para e-commerce", volume: 40 },
    { termo: "fita transparente personalizada com logo", volume: 70 },
    { termo: "fita transparente", volume: 500 },
    { termo: "durex colorido", volume: 30 },
    { termo: "fita gomada", volume: null },
  ];
  const r = agrupar(termos, SEMENTES);
  const de = (s) => r.clusters.find((c) => c.semente === s);
  assert.deepEqual(de("fita-gomada").termos.map((t) => t.termo), ["fita gomada preço", "fita gomada para e-commerce", "fita gomada"]);
  assert.equal(de("fita-gomada").termos.find((t) => t.termo === "fita gomada para e-commerce").segmento, "e-commerce");
  assert.deepEqual(de("fita-transparente-personalizada").termos.map((t) => t.termo), ["fita transparente personalizada com logo"]);
  assert.deepEqual(de("fita-transparente").termos.map((t) => t.termo), ["fita transparente"]);
  assert.deepEqual(r.semCluster.map((t) => t.termo), ["durex colorido"]);
  // null volume stays in the cluster and never adds to its volume
  assert.equal(de("fita-gomada").volume, 130);
  assert.deepEqual(de("fita-gomada").segmentos, { "e-commerce": 40 });
  assert.deepEqual(r.clusters.map((c) => c.semente), ["fita-transparente", "fita-gomada", "fita-transparente-personalizada"]);
  assert.deepEqual(agrupar(termos, SEMENTES), r);
});

test("agrupar: a moved term goes to the owner's cluster; a move to an unknown seed is ignored", () => {
  const termos = [{ termo: "durex colorido", volume: 30 }, { termo: "fita gomada kraft", volume: 20 }];
  const r = agrupar(termos, { ...SEMENTES, movidos: { "durex colorido": "fita-transparente", "fita gomada kraft": "outra" } });
  assert.deepEqual(r.clusters.find((c) => c.semente === "fita-transparente").termos.map((t) => t.termo), ["durex colorido"]);
  assert.equal(r.clusters.find((c) => c.semente === "fita-gomada").volume, 20);
  assert.deepEqual(r.semCluster, []);
});

test("lerDemanda regroups the frozen file with its recorded seeds and moves", () => {
  const entrada = {
    procedencia: { fonte: "dataforseo google_ads keywords_for_keywords", sementes: ["fita-gomada"], segmentos: [], movidos: { "fita de goma": "fita-gomada" }, semVolume: ["fita transparente comum"] },
    termos: { "fita gomada": 100, "fita de goma": 20 },
  };
  const d = lerDemanda(entrada, { produtos: ["outra"] });
  assert.equal(d.paga, true);
  assert.deepEqual(d.clusters.map((c) => [c.semente, c.volume, c.termos.length]), [["fita-gomada", 120, 2]]);
  assert.deepEqual(d.semCluster, [{ termo: "fita transparente comum", volume: null }]);
  assert.equal(lerDemanda(undefined, null), null);
  assert.equal(lerDemanda({ procedencia: {}, termos: { a: 5 } }, null).paga, false);
});

// ── T009 · cobrir ──────────────────────────────────────────────────────────────
test("cobrir: the seed as a path segment sequence or in the title covers; otherwise null", () => {
  const { clusters } = agrupar(
    [
      { termo: "fita gomada kraft", volume: 50 },
      { termo: "fita transparente barata", volume: 20 },
      { termo: "fita transparente personalizada logo", volume: 20 },
      { termo: "fita gomada para e-commerce", volume: 15 },
    ],
    SEMENTES,
  );
  const crawl = [
    { url: "https://tapepro.roilabs.com.br/produtos/fita-gomada/", titulo: "Fita Gomada | Tapepro" },
    { url: "https://tapepro.roilabs.com.br/blog/embalagem", titulo: "Fita transparente personalizada: guia" },
    { url: "https://tapepro.roilabs.com.br/segmentos/e-commerce/fita-gomada", titulo: null },
    { url: "https://tapepro.roilabs.com.br/fita-gomadas", titulo: null },
  ];
  const c = cobrir(clusters, crawl);
  const de = (s) => c.find((x) => x.semente === s);
  assert.equal(de("fita-gomada").pagina, "https://tapepro.roilabs.com.br/produtos/fita-gomada/");
  assert.equal(de("fita-transparente-personalizada").pagina, "https://tapepro.roilabs.com.br/blog/embalagem");
  // "fita transparente" is inside that title too, as a word sequence
  assert.equal(de("fita-transparente").pagina, "https://tapepro.roilabs.com.br/blog/embalagem");
  assert.equal(de("fita-gomada").apoios["e-commerce"], "https://tapepro.roilabs.com.br/segmentos/e-commerce/fita-gomada");
  assert.equal(cobrir(clusters, [{ url: "https://x.com/fita-gomadas", titulo: "" }]).find((x) => x.semente === "fita-gomada").pagina, null);
  assert.equal(cobrir(clusters, null).every((x) => x.pagina === null), true);
});

// ── T010 · propor ──────────────────────────────────────────────────────────────
// Three clusters: fita-gomada has an ativa page whose title covers only "fita gomada" (week 0, D14);
// the other two are to create. 10 terms with volume in total.
function demo({ coberto = true } = {}) {
  const { clusters, semCluster } = agrupar(
    [
      { termo: "fita gomada", volume: 400 },
      { termo: "fita gomada preço", volume: 100 },
      { termo: "fita gomada kraft", volume: 50 },
      { termo: "fita gomada para e-commerce", volume: 30 },
      { termo: "fita transparente", volume: 200 },
      { termo: "fita transparente larga", volume: 60 },
      { termo: "fita transparente 48mm", volume: 40 },
      { termo: "fita transparente personalizada", volume: 90 },
      { termo: "fita transparente personalizada logo", volume: 30 },
      { termo: "durex", volume: 100 },
      { termo: "fita gomada rolo", volume: null },
    ],
    SEMENTES,
  );
  const url = "https://t.com/produtos/fita-gomada";
  const crawl = coberto ? [{ url, titulo: "Fita gomada", h1: null }] : [];
  return { clusters: cobrir(clusters, crawl, { estados: { [url]: { estado: "ativa", classe: "indexada", motivo: null } } }), semCluster };
}
const INICIO = "2026-09-28";
const meta = (ms, chave, prazo) => ms.find((m) => m.chave === chave && m.prazo === prazo);

test("propor: every REGRAS leaf gets its own limiar and seal; the checklist gets none", () => {
  const { clusters, semCluster } = demo();
  const ms = propor(clusters, { premissas: PREMISSAS_PADRAO, inicio: INICIO, semCluster });
  for (const [k, r] of Object.entries(REGRAS)) {
    if (!r) {
      assert.equal(ms.filter((m) => m.chave === k).length, 0, k);
      continue;
    }
    if (k === "top20" || k === "tamBusca") continue;
    const m = meta(ms, k, 90);
    assert.ok(m, k);
    assert.equal(m.valor, r.limiar, k);
    assert.equal(m.op, r.op, k);
    assert.equal(m.origem, r.origem, k);
  }
  // strikingDistance is a queue: it keeps the 054 meta, no demand meta
  assert.equal(meta(ms, "strikingDistance", 90).origem, REGRAS.strikingDistance.origem);
  assert.equal(ms.filter((m) => m.chave === "strikingDistance").length, 1);
  for (const k of ["crescimentoNaoMarca", "consultasUnicas"]) assert.match(meta(ms, k, 90).aviso, /base zero/);
});

test("propor: demand math counts terms by covering page; an ativa page is week 0 (D2, D14)", () => {
  const { clusters, semCluster } = demo();
  const ms = propor(clusters, { premissas: PREMISSAS_PADRAO, inicio: INICIO, semCluster });
  // 10 terms with volume (the null one is out of both sides); the ativa page's title covers 1 of them.
  const t20 = meta(ms, "top20", 90);
  assert.equal(t20.origem, "demanda");
  assert.equal(t20.valor, 1 / 10);
  // defaults: no page created by the plan matures by week 12
  assert.equal(t20.aviso, "nenhuma página nova amadurece antes deste prazo com estas premissas");
  // by week 25 the week-1 pages mature, each counting what its label covers: «fita transparente»,
  // «fita transparente personalizada» and the apoio-termo «fita gomada preco» → 1 + 3 of 10
  const p1 = meta(ms, "pagina1", 180);
  assert.equal(p1.valor, 4 / 10);
  assert.equal(p1.aviso, undefined);
  const volTotal = 400 + 100 + 50 + 30 + 200 + 60 + 40 + 90 + 30 + 100;
  const volMaduro = 400 + 100 + 200 + 90;
  assert.equal(meta(ms, "tamBusca", 180).valor, volMaduro / volTotal);
  assert.equal(meta(ms, "impressoes", 180).valor, volMaduro);
  // clicks: mature volume × the ruler's 7–10 floor, imported, never retyped
  assert.equal(meta(ms, "cliques", 180).valor, Math.round(volMaduro * benchmark(7)));
  // 90 d: page 2 has no ruler → absent with a reason, never 0
  for (const h of ["cliques", "impressoes"]) {
    const m = meta(ms, h, 90);
    assert.equal(m.valor, null, h);
    assert.match(m.ausente, /régua/, h);
  }
  const conta = meta(ms, "cliques", 180).conta;
  assert.match(conta, /buscas\/mês/);
  assert.match(conta, /posição 7 a 10/);
  assert.match(conta, /2%/);
  assert.match(conta, /180 dias/);
  assert.match(t20.conta, /Top 20/);
  assert.match(t20.conta, /90 dias/);
});

test("propor: a week-1 page counts at 90 d only when stabilization fits", () => {
  const { clusters, semCluster } = demo();
  const curto = propor(clusters, { premissas: { ...PREMISSAS_PADRAO, semanasAteEstabilizar: 4 }, inicio: INICIO, semCluster });
  assert.equal(meta(curto, "top20", 90).valor, 4 / 10);
  assert.equal(meta(curto, "top20", 90).aviso, undefined);
});

test("propor: starting point and distance on demand metas; absent without a reading, never 0 (D11)", () => {
  const { clusters, semCluster } = demo();
  const com = propor(clusters, { premissas: PREMISSAS_PADRAO, inicio: INICIO, semCluster, partida: { top20: 0.1, tamBusca: 0.05, pagina1: 0 } });
  assert.equal(meta(com, "top20", 90).partida, 0.1);
  assert.equal(meta(com, "top20", 90).distancia, meta(com, "top20", 90).valor - 0.1);
  assert.equal(meta(com, "pagina1", 180).partida, 0);
  const sem = propor(clusters, { premissas: PREMISSAS_PADRAO, inicio: INICIO, semCluster, partida: null });
  assert.equal("partida" in meta(sem, "top20", 90), false);
  assert.equal("distancia" in meta(sem, "top20", 90), false);
});

test("metasExigidas is exactly what propor proposes with a value", () => {
  const { clusters, semCluster } = demo();
  const ms = propor(clusters, { premissas: PREMISSAS_PADRAO, inicio: INICIO, semCluster });
  const chave = (m) => `${m.chave}@${m.prazo}`;
  assert.deepEqual(ms.filter((m) => m.valor !== null).map(chave).sort(), metasExigidas().map(chave).sort());
});

// ── agenda + T022 · montar ─────────────────────────────────────────────────────
test("agendaDePaginas: uncovered clusters by volume first, then support pages, capacity per week", () => {
  const { clusters } = demo({ coberto: false });
  const ag = agendaDePaginas(clusters, { capacidade: 2 });
  assert.deepEqual(
    ag.map((p) => [p.tipo, p.semente, p.segmento ?? p.termo ?? null, p.semana]),
    [
      ["cluster", "fita-gomada", null, 1],
      ["cluster", "fita-transparente", null, 1],
      ["cluster", "fita-transparente-personalizada", null, 2],
      ["apoio-termo", "fita-gomada", "fita gomada preço", 2],
      ["apoio-segmento", "fita-gomada", "e-commerce", 3],
    ],
  );
  assert.deepEqual(agendaDePaginas(clusters, { capacidade: 0 }).map((p) => p.semana), [null, null, null, null, null]);
});

function plano(opts = {}) {
  const { clusters, semCluster } = demo({ coberto: opts.coberto ?? true });
  const premissas = { ...PREMISSAS_PADRAO, ...(opts.premissas ?? {}) };
  const propostas = propor(clusters, { premissas, inicio: INICIO, semCluster });
  const metas = (opts.metas ?? propostas).filter((m) => m.valor !== null).map((m) => ({ chave: m.chave, prazo: m.prazo, valor: m.valor }));
  return { m: montar({ inicio: INICIO, ...premissas, clusters, semCluster, metas, responsavel: "jean" }), propostas };
}

test("montar: capacity per week, nothing before its page, indexing at +N, same lever merged (SC-004)", () => {
  const { m } = plano({ coberto: false, premissas: { capacidade: 1 } });
  assert.equal(m.semanas.length, SEMANAS);
  const criadaEm = new Map();
  for (const s of m.semanas) {
    const cob = s.tarefas.filter((t) => t.alavanca === "cobertura");
    assert.ok(cob.length <= 1, `semana ${s.n}: ${cob.length} tarefas de cobertura`);
    const paginas = cob.flatMap((t) => t.alvos);
    assert.ok(paginas.length <= 1, `semana ${s.n}: ${paginas.length} páginas`);
    for (const p of paginas) criadaEm.set(p, s.n);
    for (const t of s.tarefas) {
      assert.ok(t.alavanca in ALAVANCAS, t.alavanca);
      assert.equal(s.tarefas.filter((x) => x.alavanca === t.alavanca).length, 1, `${t.alavanca} duplicada na semana ${s.n}`);
      if (["links", "titulo", "schema", "indexacao"].includes(t.alavanca))
        for (const a of t.alvos) assert.ok(criadaEm.has(a) && criadaEm.get(a) <= s.n, `${t.alavanca} de ${a} antes da página`);
      if (t.alavanca === "indexacao") for (const a of t.alvos) assert.equal(s.n, criadaEm.get(a) + PREMISSAS_PADRAO.semanasAteIndexar);
      assert.equal(t.responsavel, "jean");
      assert.ok(t.kpis.length > 0);
    }
  }
  assert.equal(criadaEm.size, 5);
  for (const s of m.semanas) if (s.tarefas.some((t) => t.alavanca === "cobertura")) assert.equal(s.tarefas[0].alavanca, "cobertura", `semana ${s.n}`);
});

test("montar: a covered cluster, including one created outside the plan, emits no coverage", () => {
  const { m } = plano({ coberto: true });
  const alvos = m.semanas.flatMap((s) => s.tarefas.filter((t) => t.alavanca === "cobertura").flatMap((t) => t.alvos));
  assert.ok(!alvos.includes("«fita gomada»"));
});

test("montar: capacity 0 → first-line aviso and no coverage milestone (FR-018)", () => {
  const { m } = plano({ premissas: { capacidade: 0 } });
  assert.match(m.avisos[0], /capacidade 0/i);
  assert.ok(m.semanas.every((s) => !s.tarefas.some((t) => t.alavanca === "cobertura")));
  assert.ok(m.semanas.every((s) => !("paginas" in s.marcos)));
});

test("montar: the milestone at each deadline is the approved meta; raising it flips to 'não cabe' (D11)", () => {
  const { m, propostas } = plano();
  const s12 = m.semanas[semanaDoPrazo(90) - 1];
  const s25 = m.semanas[semanaDoPrazo(180) - 1];
  assert.equal(s12.marcos.top20, meta(propostas, "top20", 90).valor);
  assert.equal(s25.marcos.pagina1, meta(propostas, "pagina1", 180).valor);
  assert.deepEqual(m.naoCabe, []);
  const editadas = propostas.map((x) => (x.chave === "pagina1" ? { ...x, valor: 1 } : x));
  const { m: m2 } = plano({ metas: editadas });
  assert.equal(m2.semanas[semanaDoPrazo(180) - 1].marcos.pagina1, 1);
  assert.deepEqual(m2.naoCabe, [{ chave: "pagina1", prazo: 180, texto: "não cabe no prazo com esta capacidade" }]);
  assert.match(m2.avisos.join(" "), /não cabe no prazo/);
});

test("montar: a refused meta leaves no milestone", () => {
  const { propostas } = plano();
  const { m } = plano({ metas: propostas.filter((x) => x.chave !== "top20") });
  assert.ok(m.semanas.every((s) => !("top20" in s.marcos)));
});

// ── T023 · feita ───────────────────────────────────────────────────────────────
test("feita: the 055 mark counts from the week start on", () => {
  const t = { alavanca: "cobertura" };
  const s = { inicio: "2026-10-05" };
  assert.equal(feita(t, s, [{ alavanca: "cobertura", marcado: "2026-10-05" }]), true);
  assert.equal(feita(t, s, [{ alavanca: "cobertura", marcado: "2026-10-09" }]), true);
  assert.equal(feita(t, s, [{ alavanca: "cobertura", marcado: "2026-10-04" }]), false);
  assert.equal(feita(t, s, [{ alavanca: "links", marcado: "2026-10-09" }]), false);
  assert.equal(feita(t, s, []), false);
});

// ── T028 · comparar ────────────────────────────────────────────────────────────
const SEMANAS_DEMO = [
  { n: 1, marcos: { top20: null } },
  { n: 2, marcos: { top20: 0.5 } },
  { n: 3, marcos: { top20: 0.5 } },
];

test("comparar: future milestone, missing reading, and the three edges", () => {
  const r = (v) => ({ valor: v, texto: String(v), fonte: "f" });
  assert.equal(comparar(SEMANAS_DEMO, { top20: r(0.9) }, 1)[0].estado, "nao-chegou");
  const sem = comparar(SEMANAS_DEMO, { top20: { ausente: "sem inventário" } }, 2)[0];
  assert.equal(sem.estado, "sem-leitura");
  assert.equal(sem.motivo, "sem inventário");
  assert.equal(comparar(SEMANAS_DEMO, {}, 2)[0].estado, "sem-leitura");
  assert.equal(comparar(SEMANAS_DEMO, { top20: { indecisa: "amostra" } }, 2)[0].estado, "sem-leitura");
  assert.equal(comparar(SEMANAS_DEMO, { top20: r(0.5) }, 2)[0].estado, "no-marco");
  assert.equal(comparar(SEMANAS_DEMO, { top20: r(0.49951) }, 2)[0].estado, "no-marco"); // equal as printed
  assert.equal(comparar(SEMANAS_DEMO, { top20: r(0.4994) }, 2)[0].estado, "abaixo");
  assert.equal(comparar(SEMANAS_DEMO, { top20: r(0.5006) }, 2)[0].estado, "acima");
});

test("comparar: no state label says ok, ✓ or dentro (055 glossary)", () => {
  for (const e of Object.values(ESTADOS)) assert.doesNotMatch(`${e.glifo} ${e.texto}`, /\bok\b|✓|dentro/i);
  assert.equal(Object.keys(ESTADOS).length, 5);
});

test("comparar: below two weeks in a row suggests redoing the proposal, never guessing the previous week", () => {
  const r = (v) => ({ valor: v, texto: String(v), fonte: "f" });
  assert.equal(comparar(SEMANAS_DEMO, { top20: r(0.3) }, 3, { top20: r(0.4) })[0].sugerirRefazer, true);
  assert.equal(comparar(SEMANAS_DEMO, { top20: r(0.3) }, 3, { top20: r(0.6) })[0].sugerirRefazer, false);
  assert.equal(comparar(SEMANAS_DEMO, { top20: r(0.3) }, 3, { top20: { ausente: "falhou" } })[0].sugerirRefazer, false);
  assert.equal(comparar(SEMANAS_DEMO, { top20: r(0.3) }, 3, null)[0].sugerirRefazer, false);
  // week 2's previous milestone had not arrived: nothing to compare against
  assert.equal(comparar(SEMANAS_DEMO, { top20: r(0.3) }, 2, { top20: r(0.1) })[0].sugerirRefazer, false);
});

test("leiturasDoPlano: the map's functions over one read; a missing read or inventory is absent, never 0", () => {
  const inv = { termos: ["a", "b", "c", "d"], total: 4 };
  const linhas = [
    { termo: "a", cliques: 3, impressoes: 100, posicao: 2 },
    { termo: "b", cliques: 1, impressoes: 50, posicao: 15 },
    { termo: "x", cliques: 9, impressoes: 900, posicao: 1 },
  ];
  const r = leiturasDoPlano(linhas, inv, { termos: { a: 200, b: 100, c: 100, d: 100 }, paga: true });
  assert.equal(r.top20.valor, 2 / 4);
  assert.equal(r.pagina1.valor, 1 / 4);
  assert.equal(r.tamBusca.valor, 150 / 500);
  assert.equal(r.impressoes.valor, 150);
  assert.equal(r.cliques.valor, 4);
  // a GSC-floor ceiling at or above the meta decides nothing
  assert.ok("indecisa" in leiturasDoPlano(linhas, inv, { termos: { a: 100, b: 50 }, paga: false }).tamBusca);
  for (const v of Object.values(leiturasDoPlano(null, inv, null, "a leitura falhou"))) assert.deepEqual(v, { ausente: "a leitura falhou" });
  assert.ok("ausente" in leiturasDoPlano(linhas, null, null).top20);
});

// ── Clarification of 2026-09-28 (research D12–D16) ─────────────────────────────

// T047 · estadoDaPagina: indexing verdict × impression reading (D13)
const URL_A = "https://t.com/produtos/fita-gomada/";
const classes = (classe) => ({ [URL_A]: { classe, dia: "2026-09-27" } });
const LEITURA = (impressoes) => ({ paginas: [{ pagina: "https://t.com/produtos/fita-gomada", impressoes, cliques: 0, posicao: 30, hosts: ["t.com"] }], hosts: ["t.com"], encerrados: [], truncado: false });
const VAZIA = { paginas: [], hosts: ["t.com"], encerrados: [], truncado: false };

test("estadoDaPagina: one row per line of the D13 table", () => {
  assert.equal(estadoDaPagina(URL_A, { classes: classes("indexada"), impressoes: LEITURA(3) }).estado, "ativa");
  assert.equal(estadoDaPagina(URL_A, { classes: classes("indexada"), impressoes: VAZIA }).estado, "indexada-sem-impressao");
  for (const c of ["rastreada_nao_indexada", "descoberta_nao_indexada", "outra"]) {
    assert.equal(estadoDaPagina(URL_A, { classes: classes(c), impressoes: LEITURA(3) }).estado, "fora-do-indice", c);
    assert.equal(estadoDaPagina(URL_A, { classes: classes(c), impressoes: { erro: "timeout" } }).estado, "fora-do-indice", c);
  }
  // a 429 is not a verdict; no run, or a URL past the cota, is not "out of the index"
  for (const cl of [classes("falha"), null, { "https://t.com/outra": { classe: "indexada", dia: "2026-09-27" } }]) {
    const e = estadoDaPagina(URL_A, { classes: cl, impressoes: LEITURA(3) });
    assert.equal(e.estado, "sem-leitura", JSON.stringify(cl));
    assert.ok(e.motivo, "sem-leitura always says why");
    assert.notEqual(e.classe, "indexada");
  }
  // indexed, but the impression reading failed or was truncated: absence proves nothing
  for (const imp of [{ erro: "timeout" }, null, { ...VAZIA, truncado: true }]) {
    const e = estadoDaPagina(URL_A, { classes: classes("indexada"), impressoes: imp });
    assert.equal(e.estado, "sem-leitura", JSON.stringify(imp));
    assert.equal(e.classe, "indexada");
    assert.ok(e.motivo);
  }
});

test("estadoDaPagina: matched by decoded path without the trailing slash; /pt-BR/x does not lend to /x", () => {
  const cl = { "https://t.com/p/a%C3%A7o/": { classe: "indexada", dia: "2026-09-27" } };
  const imp = { ...VAZIA, paginas: [{ pagina: "https://t.com/p/aço", impressoes: 2, cliques: 0, posicao: 9, hosts: ["t.com"] }] };
  assert.equal(estadoDaPagina("https://t.com/p/aço", { classes: cl, impressoes: imp }).estado, "ativa");
  const prefixada = { ...VAZIA, paginas: [{ pagina: "https://t.com/pt-BR/p/aço", impressoes: 50, cliques: 0, posicao: 9, hosts: ["t.com"] }] };
  assert.equal(estadoDaPagina("https://t.com/p/aço", { classes: cl, impressoes: prefixada }).estado, "indexada-sem-impressao");
});

// T048 · cobreTermo and coverage by title OR H1 (D14)
test("cobreTermo: every word of the term in the text, any order, no accents, no case", () => {
  assert.equal(cobreTermo("fita gomada kraft", "Fita Gomada Kraft 70mm"), true);
  assert.equal(cobreTermo("fita gomada kraft", "Kraft Fita Gomada"), true);
  assert.equal(cobreTermo("fita gomada reforçada", "FITA GOMADA REFORCADA"), true);
  assert.equal(cobreTermo("fita gomada kraft", "Fita Gomada"), false);
  assert.equal(cobreTermo("fitas gomadas", "fita gomada"), false, "fitas ≠ fita");
  assert.equal(cobreTermo("fita gomada para caixa", "fita gomada caixa"), false, "para counts");
  assert.equal(cobreTermo("fita gomada", null), false);
  assert.equal(cobreTermo("", "fita"), false);
});

test("cobrir: a term is covered by the title OR the H1, each alone; each term gets cobertoPor", () => {
  const { clusters } = agrupar(
    [
      { termo: "fita gomada kraft", volume: 50 },
      { termo: "fita gomada branca", volume: 40 },
      { termo: "fita gomada nylon", volume: 30 },
      { termo: "fita gomada kraft branca", volume: 20 },
    ],
    SEMENTES,
  );
  const crawl = [
    { url: "https://t.com/produtos/fita-gomada/", titulo: "Fita Gomada Kraft 70mm", h1: "Fita gomada branca" },
    { url: "https://t.com/blog/fios-de-nylon-na-embalagem", titulo: "Fios de nylon na fita gomada", h1: null },
  ];
  const c = cobrir(clusters, crawl, { estados: { [crawl[0].url]: { estado: "ativa", classe: "indexada", motivo: null } } })[0];
  const por = (t) => c.termos.find((x) => x.termo === t).cobertoPor;
  assert.equal(por("fita gomada kraft"), crawl[0].url, "title");
  assert.equal(por("fita gomada branca"), crawl[0].url, "H1");
  assert.equal(por("fita gomada nylon"), crawl[1].url);
  assert.equal(por("fita gomada kraft branca"), null, "half in the title, half in the H1 is not coverage");
  assert.equal(c.estadoDaPagina.estado, "ativa");
  assert.equal(c.estados[crawl[1].url].estado, "sem-leitura", "a page with no state read is sem-leitura, never ativa");
});

// T049 · agendaDePaginas with apoio-termo (FR-005a)
function comTermos(termos, crawl = [], estados = {}) {
  const { clusters } = agrupar(termos, SEMENTES);
  return cobrir(clusters, crawl, { estados });
}

test("agendaDePaginas: an uncovered term ≥ pisoApoio becomes an apoio-termo; below, covered or queued, it does not", () => {
  const cl = comTermos(
    [
      { termo: "fita gomada", volume: 1000 },
      { termo: "fita gomada personalizada", volume: 300 },
      { termo: "fita gomada branca", volume: 99 },
      { termo: "fita gomada kraft", volume: 200 },
    ],
    [{ url: "https://t.com/blog/kraft", titulo: "Kraft: a fita gomada", h1: null }],
  );
  const ag = agendaDePaginas(cl, { capacidade: 3, pisoApoio: 100 });
  assert.deepEqual(
    ag.map((p) => [p.tipo, p.termo ?? null, p.semana]),
    [["apoio-termo", "fita gomada personalizada", 1]],
    "the blog page covers the seed (title), so the cluster has a page; kraft is covered; branca is below the floor",
  );
  const t = ag[0];
  assert.deepEqual(t.cobre, ["fita", "gomada", "personalizada"]);
  assert.equal(t.alvo, "«fita gomada personalizada»");
  // the seed of a cluster with no page is covered by the queued cluster page, never an apoio-termo
  const semPagina = agendaDePaginas(comTermos([{ termo: "fita gomada", volume: 1000 }]), { capacidade: 3, pisoApoio: 100 });
  assert.deepEqual(semPagina.map((p) => p.tipo), ["cluster"]);
});

test("agendaDePaginas: an excluded term never enters (the frozen file does not carry it)", () => {
  const d = lerDemanda(
    { procedencia: { fonte: "dataforseo", sementes: ["fita-gomada"], excluidos: { "fita gomada 3m": "marca de concorrente" } }, termos: { "fita gomada": 500, "fita gomada preço": 300 } },
    null,
  );
  const ag = agendaDePaginas(cobrir(d.clusters, []), { capacidade: 3, pisoApoio: 100 });
  assert.ok(!ag.some((p) => p.termo === "fita gomada 3m"));
  assert.ok(ag.some((p) => p.termo === "fita gomada preço"));
});

test("agendaDePaginas: the seed missing from its existing page's title and H1 is a titulo task, not an apoio-termo", () => {
  const url = "https://t.com/produtos/fita-gomada/";
  const cl = comTermos([{ termo: "fita gomada", volume: 1000 }, { termo: "fita gomada larga", volume: 150 }], [{ url, titulo: "Fitas de papel | Loja", h1: "Rolo de papel" }]);
  assert.equal(cl[0].pagina, url, "found by path");
  assert.equal(cl[0].termos.find((t) => t.termo === "fita gomada").cobertoPor, null, "but its title and H1 do not cover the seed");
  const ag = agendaDePaginas(cl, { capacidade: 3, pisoApoio: 100 });
  assert.deepEqual(ag.map((p) => p.termo), ["fita gomada larga"]);
  const m = montar({ inicio: INICIO, ...PREMISSAS_PADRAO, clusters: cl, metas: [], responsavel: "jean" });
  const titulo = m.semanas[0].tarefas.find((t) => t.alavanca === "titulo");
  assert.ok(titulo?.alvos.includes(url), "week-1 titulo on the existing page");
});

test("agendaDePaginas: cluster pages first, then apoio-segmento and apoio-termo together by volume, capacity per week", () => {
  const cl = comTermos([
    { termo: "fita gomada", volume: 100 },
    { termo: "fita transparente", volume: 50 },
    { termo: "fita gomada para e-commerce", volume: 30 },
    { termo: "fita gomada branca", volume: 200 },
    { termo: "fita gomada larga", volume: 120 },
  ]);
  const ag = agendaDePaginas(cl, { capacidade: 2, pisoApoio: 100 });
  assert.deepEqual(
    ag.map((p) => [p.tipo, p.semana]),
    [
      ["cluster", 1],
      ["cluster", 1],
      ["apoio-termo", 2],
      ["apoio-termo", 2],
      ["apoio-segmento", 3],
    ],
  );
  assert.deepEqual(ag.slice(2, 4).map((p) => p.termo), ["fita gomada branca", "fita gomada larga"]);
});

// T050 · propor counts terms by covering page, and existing pages only when ativa or marked (D14, D15)
test("propor: a term counts once its covering page matures; a non-ativa page without marca counts nothing", () => {
  const url = "https://t.com/produtos/fita-gomada/";
  const termos = [
    { termo: "fita gomada", volume: 1000 },
    { termo: "fita gomada kraft", volume: 200 },
    { termo: "fita gomada branca", volume: 50 },
  ];
  const crawl = [{ url, titulo: "Fita Gomada Kraft", h1: null }];
  const premissas = { ...PREMISSAS_PADRAO, semanasAteEstabilizar: 4 };
  const t20 = (estado, marcas = []) => meta(propor(comTermos(termos, crawl, { [url]: estado }), { premissas, inicio: INICIO, marcas }), "top20", 90);

  // ativa: week 0, both covered terms by 90 d
  const ativa = t20({ estado: "ativa", classe: "indexada", motivo: null });
  assert.equal(ativa.valor, 2 / 3);
  assert.match(ativa.conta, /\/produtos\/fita-gomada\/ cobre 2 termos, 1\.200 buscas\/mês/);
  // not ativa, no marca: the page adds nothing
  const parada = t20({ estado: "indexada-sem-impressao", classe: "indexada", motivo: null });
  assert.equal(parada.valor, 0);
  assert.match(parada.conta, /só conta depois que a tarefa da página for feita: \/produtos\/fita-gomada\//i);
  // a posição marca in week 3 matures it at 3 + 4 = 7 ≤ 12
  assert.equal(t20({ estado: "indexada-sem-impressao", classe: "indexada", motivo: null }, [{ alavanca: "links", marcado: "2026-10-13" }]).valor, 2 / 3);
  // a marca of another page's lever does not start the clock
  assert.equal(t20({ estado: "fora-do-indice", classe: "rastreada_nao_indexada", motivo: null }, [{ alavanca: "links", marcado: "2026-10-13" }]).valor, 0);
});

test("propor: a term covered by an existing page and a planned one takes the earliest maturity", () => {
  const url = "https://t.com/blog/branca";
  const termos = [{ termo: "fita gomada", volume: 1000 }, { termo: "fita gomada branca", volume: 300 }];
  const crawl = [{ url, titulo: "Fita gomada branca", h1: null }];
  // the blog page covers both terms; ativa → week 0 wins over nothing else
  const ms = propor(comTermos(termos, crawl, { [url]: { estado: "ativa", classe: "indexada", motivo: null } }), { premissas: PREMISSAS_PADRAO, inicio: INICIO, marcas: [] });
  assert.equal(meta(ms, "top20", 90).valor, 1);
});

// T051 · montar emits week-1 tasks for existing pages that are not ativa (D15)
const POSICAO_DA_PAGINA = Object.keys(ALAVANCAS).filter((a) => ALAVANCAS[a].degrau === "posicao" && a !== "cobertura" && a !== "marca");
const G = "https://t.com/produtos/fita-gomada/";
const T = "https://t.com/produtos/fita-transparente/";

function semana1(estados, extra = {}) {
  const termos = [{ termo: "fita gomada", volume: 1000 }, { termo: "fita transparente", volume: 500 }];
  const crawl = [
    { url: G, titulo: "Fita gomada", h1: null },
    { url: T, titulo: "Fita transparente", h1: null },
  ];
  return montar({ inicio: INICIO, ...PREMISSAS_PADRAO, clusters: comTermos(termos, crawl, estados), metas: [], responsavel: "jean", ...extra });
}

test("montar: fora-do-indice or unread index → week-1 indexacao with the URL; indexada-sem-impressao → the posição levers", () => {
  const m = semana1({ [G]: { estado: "fora-do-indice", classe: "outra", motivo: null }, [T]: { estado: "sem-leitura", classe: null, motivo: "sem corrida" } });
  const idx = m.semanas[0].tarefas.filter((t) => t.alavanca === "indexacao");
  assert.equal(idx.length, 1, "two pages, one task per lever (054 FR-009)");
  assert.deepEqual([...idx[0].alvos].sort(), [G, T]);
  const pos = semana1({ [G]: { estado: "indexada-sem-impressao", classe: "indexada", motivo: null }, [T]: { estado: "ativa", classe: "indexada", motivo: null } });
  assert.deepEqual(pos.semanas[0].tarefas.map((t) => t.alavanca).sort(), [...POSICAO_DA_PAGINA].sort());
  for (const t of pos.semanas[0].tarefas) assert.deepEqual(t.alvos, [G]);
  assert.ok(pos.semanas[0].tarefas.every((t) => t.origem.includes("calendario")));
});

test("montar: indexed but the impression reading failed → no task, a first-line aviso, and no milestone", () => {
  const lido = { estado: "sem-leitura", classe: "indexada", motivo: "leitura de impressões truncada" };
  const m = semana1({ [G]: lido, [T]: lido }, { metas: [{ chave: "top20", prazo: 90, valor: 0 }] });
  assert.deepEqual(m.semanas[0].tarefas, []);
  assert.equal(m.avisos[0], "2 páginas existentes não contam nas metas até a próxima leitura de impressões.");
  assert.ok(m.semanas.slice(0, semanaDoPrazo(90) - 1).every((s) => s.marcos.top20 === null));
});

test("montar: no marca → the page enters no milestone; a marca in week 3 matures it at 3 + semanasAteEstabilizar", () => {
  const fora = { estado: "fora-do-indice", classe: "outra", motivo: null };
  const metas = [{ chave: "pagina1", prazo: 180, valor: 1 }];
  const sem = semana1({ [G]: fora, [T]: fora }, { metas });
  assert.ok(sem.semanas.every((s, i) => i === semanaDoPrazo(180) - 1 || s.marcos.pagina1 === null));
  assert.deepEqual(sem.naoCabe.map((x) => x.chave), ["pagina1"]);
  const com = semana1({ [G]: fora, [T]: fora }, { metas, marcas: [{ alavanca: "indexacao", marcado: "2026-10-14" }] });
  const madura = 3 + PREMISSAS_PADRAO.semanasAteEstabilizar;
  assert.equal(com.semanas[madura - 2].marcos.pagina1, null);
  assert.equal(com.semanas[madura - 1].marcos.pagina1, 1);
  assert.deepEqual(com.naoCabe, []);
});

// T052 · SC-008: Tape Pro on 28/09/2026. Title and H1 read ONCE from the live HTML on 2026-09-28
// through titulo()/h1() and pasted here as literals. No network in the test.
test("SC-008: Tape Pro 28/09 — week 1 not empty, the pages without marca count 0, page 1 below 100%", async () => {
  const { default: DEMANDAS } = await import("../data/demanda-estimada.json", { with: { type: "json" } });
  // 70 frozen, 24 out of the catalog (third-party brands, colors, widths, other products): 46
  assert.equal(Object.keys(DEMANDAS.tapepro.termos).length, 46);
  const d = lerDemanda(DEMANDAS.tapepro, null);
  const crawl = [
    { url: "https://tapepro.roilabs.com.br/produtos/fita-gomada/", titulo: "Fita Gomada Kraft Reforçada com Fios de Nylon 70mm | TapePro", h1: "Fita gomada kraft reforçada com fios de nylon" },
    { url: "https://tapepro.roilabs.com.br/produtos/fita-transparente-personalizada/", titulo: "Fita Adesiva Transparente Personalizada com Sua Marca | TapePro", h1: "Fita adesiva transparente personalizada" },
    { url: "https://tapepro.roilabs.com.br/produtos/fita-transparente-comum/", titulo: "Fita Adesiva Transparente Comum 48mm × 100m por Volume | TapePro", h1: "Fita adesiva transparente comum" },
  ];
  // 0 impressions since 07/08: indexed or not, never ativa
  const impressoes = { paginas: [], hosts: ["tapepro.roilabs.com.br"], encerrados: [], truncado: false };
  const semPaginas = propor(cobrir(d.clusters, []), { premissas: PREMISSAS_PADRAO, inicio: INICIO, semCluster: d.semCluster, marcas: [] });
  for (const classe of ["indexada", "rastreada_nao_indexada"]) {
    const cls = Object.fromEntries(crawl.map((p) => [p.url, { classe, dia: "2026-09-28" }]));
    const estados = Object.fromEntries(crawl.map((p) => [p.url, estadoDaPagina(p.url, { classes: cls, impressoes })]));
    const clusters = cobrir(d.clusters, crawl, { estados });
    assert.ok(clusters.some((c) => c.termos.some((t) => t.cobertoPor)), "the live titles do cover some terms");
    const ms = propor(clusters, { premissas: PREMISSAS_PADRAO, inicio: INICIO, semCluster: d.semCluster, marcas: [] });
    const metas = ms.filter((x) => x.valor !== null);
    const m = montar({ inicio: INICIO, ...PREMISSAS_PADRAO, clusters, semCluster: d.semCluster, metas, marcas: [], responsavel: "jean" });

    assert.ok(m.semanas[0].tarefas.length > 0, `${classe}: semana 1 vazia`);
    // the existing pages add 0 terms: no demand meta is above what the planned pages alone deliver
    for (const x of ms.filter((x) => x.origem === "demanda" && x.valor !== null))
      assert.ok(x.valor <= meta(semPaginas, x.chave, x.prazo).valor + 1e-9, `${classe}: ${x.chave}@${x.prazo} counts pages without marca`);
    assert.equal(meta(ms, "top20", 90).valor, 0, `${classe}: top20 at 90 d`);
    // the ceiling: terms covered by the labels of pages scheduled up to week SEMANAS − estab
    const ate = SEMANAS - PREMISSAS_PADRAO.semanasAteEstabilizar;
    const rotulos = m.agenda.filter((p) => p.semana !== null && p.semana <= ate).map((p) => p.cobre.join(" "));
    const comVolume = d.clusters.flatMap((c) => c.termos).filter((t) => typeof t.volume === "number");
    const teto = comVolume.filter((t) => rotulos.some((r) => cobreTermo(t.termo, r))).length / comVolume.length;
    const p1 = meta(ms, "pagina1", 180).valor;
    assert.ok(p1 <= teto + 1e-9, `${classe}: pagina1 ${p1} > ${teto}`);
    assert.ok(p1 < 1, `${classe}: 100% na página 1`);
  }
});

// T063 · semanaComCards (D16)
test("semanaComCards: same lever → one task with the union; card-only in 054 order; aguardando out; no mutation", () => {
  const semana = { n: 1, inicio: INICIO, marcos: {}, tarefas: [{ alavanca: "links", alvos: ["«fita gomada»"], kpis: ["linksInternos"], responsavel: "jean", origem: ["calendario"] }] };
  const copia = structuredClone(semana);
  const entrada = (alavanca, apresentacao, alvos, chaves) => ({ alavanca, apresentacao, alvos, motivos: chaves.map((chave) => ({ chave })), marca: null });
  const s = semanaComCards(semana, [
    entrada("links", "ativa", ["/blog/x"], ["orfas"]),
    entrada("titulo", "voltou", ["/a"], ["ctrGap"]),
    entrada("indexacao", "ativa", ["/b"], ["indexacao"]),
    entrada("schema", "aguardando", ["/c"], ["schema"]),
  ]);
  assert.deepEqual(semana, copia);
  assert.deepEqual(s.tarefas.map((t) => t.alavanca), ["links", "indexacao", "titulo"]);
  const links = s.tarefas[0];
  assert.deepEqual(links.alvos, ["«fita gomada»", "/blog/x"]);
  assert.deepEqual(links.kpis, ["linksInternos", "orfas"]);
  assert.deepEqual(links.origem, ["calendario", "mapa"]);
  assert.deepEqual(s.tarefas[1].origem, ["mapa"]);
  assert.equal(s.tarefas[2].voltou, true);
});

// ── 058 US1 · the plan only speaks of the future ───────────────────────────────

/** SC-001: every key, version, week and meta text the screen receives, walked recursively. */
function presenteNaVista(v, semanaAtual) {
  const proibidas = ["partida", "distancia", "estadoDaPagina", "estados", "decididoPor", "decididoEm", "marcado", "planos"];
  const palavras = [/\bativa\b/, /fora do índice/, /indexada, sem impressão/, /sem leitura/, /marca de feito/, /\bsemana 1\b/];
  const achados = [];
  const anda = (x, caminho) => {
    if (Array.isArray(x)) return x.forEach((y, i) => anda(y, `${caminho}[${i}]`));
    if (!x || typeof x !== "object") return;
    for (const [k, y] of Object.entries(x)) {
      if (proibidas.includes(k)) achados.push(`${caminho}.${k}`);
      if (k === "n" && typeof y === "number" && y < Math.max(1, semanaAtual)) achados.push(`${caminho}.n = ${y}`);
      if (k === "estado" && y === "encerrado") achados.push(`${caminho}: versão encerrada`);
      if (k === "conta" && typeof y === "string") for (const p of palavras) if (p.test(y)) achados.push(`${caminho}.conta: ${p}`);
      anda(y, `${caminho}.${k}`);
    }
  };
  anda(v, "vista");
  return achados;
}

const PLANOS_3 = [
  { versao: 3, estado: "rascunho", criadoPor: "jean" },
  { versao: 2, estado: "ativo", criadoPor: "jean" },
  { versao: 1, estado: "encerrado", criadoPor: "maria" },
];

async function vistaDaTapePro(semanaAtual) {
  const { default: DEMANDAS } = await import("../data/demanda-estimada.json", { with: { type: "json" } });
  const d = lerDemanda(DEMANDAS.tapepro, null);
  const crawl = [
    { url: "https://tapepro.roilabs.com.br/produtos/fita-gomada/", titulo: "Fita Gomada Kraft Reforçada com Fios de Nylon 70mm | TapePro", h1: "Fita gomada kraft reforçada com fios de nylon" },
    { url: "https://tapepro.roilabs.com.br/produtos/fita-transparente-comum/", titulo: "Fita Adesiva Transparente Comum 48mm × 100m por Volume | TapePro", h1: "Fita adesiva transparente comum" },
  ];
  const estados = { [crawl[0].url]: { estado: "fora-do-indice", classe: "outra", motivo: null }, [crawl[1].url]: { estado: "indexada-sem-impressao", classe: "indexada", motivo: null } };
  const clusters = cobrir(d.clusters, crawl, { estados });
  const marcas = [{ alavanca: "indexacao", responsavel: "jean", marcado: "2026-09-28", reler: "2026-10-12" }];
  const propostas = propor(clusters, { premissas: PREMISSAS_PADRAO, inicio: INICIO, semCluster: d.semCluster, marcas, partida: { top20: 0, tamBusca: 0, pagina1: 0 } });
  const decisoes = [
    { chave: "top20", prazo: 90, estado: "aprovada", valor: meta(propostas, "top20", 90).valor, decididoPor: "jean", decididoEm: "2026-09-28 10:00" },
    { chave: "pagina1", prazo: 180, estado: "editada", valor: 0.5, decididoPor: "maria", decididoEm: "2026-09-28 10:01" },
    { chave: "lcp", prazo: 90, estado: "recusada", valor: null, decididoPor: "jean", decididoEm: "2026-09-28 10:02" },
  ];
  const metas = propostas.filter((m) => m.valor !== null).map((m) => ({ chave: m.chave, prazo: m.prazo, valor: m.valor }));
  const montado = montar({ inicio: INICIO, ...PREMISSAS_PADRAO, clusters, semCluster: d.semCluster, metas, marcas, responsavel: "jean" });
  const hoje = addDaysISO(INICIO, 7 * (semanaAtual - 1) + 2);
  return vistaDoPlano({ propostas, decisoes, montado, planos: PLANOS_3, clusters, marcas, hoje, semanaAtual, inicio: INICIO });
}

test("SC-001: the Tape Pro view carries no starting point, page state, mark, author, old version or past week", async () => {
  const v = await vistaDaTapePro(5);
  assert.deepEqual(presenteNaVista(v, 5), []);
  assert.deepEqual(v.versoes, { ativo: 2, rascunho: 3 });
  assert.ok(v.semanas.length > 0);
  assert.ok(v.metas.some((m) => m.origem === "demanda"));
  assert.ok(v.clusters.every((c) => c.termos.every((t) => "cobertoPor" in t)), "cobertoPor stays: it is the input of the future pages");
});

// Synthetic weeks: week 3 has a titulo task, week 5 a links task.
const tarefaDe = (alavanca, alvo) => ({ alavanca, alvos: [alvo], kpis: ["x"], responsavel: "jean", origem: ["calendario"] });
const MONTADO = {
  avisos: [],
  naoCabe: [],
  agenda: [],
  semanas: Array.from({ length: SEMANAS }, (_, i) => ({
    n: i + 1,
    inicio: addDaysISO(INICIO, 7 * i),
    tarefas: i + 1 === 3 ? [tarefaDe("titulo", "/a")] : i + 1 === 5 ? [tarefaDe("links", "/b")] : [],
    marcos: {},
  })),
};
const SEMANA5 = addDaysISO(INICIO, 28);
const vista = (over = {}) => vistaDoPlano({ propostas: [], decisoes: [], montado: MONTADO, planos: [], clusters: [], marcas: [], hoje: addDaysISO(SEMANA5, 2), semanaAtual: 5, inicio: INICIO, ...over });

test("vistaDoPlano: the calendar starts at the current week, or at week 1 before the start (FR-005)", () => {
  assert.equal(vista().semanas[0].n, 5);
  assert.equal(vista().comecaEm, null);
  for (const semanaAtual of [0, -3]) {
    const v = vista({ semanaAtual, hoje: "2026-09-20" });
    assert.equal(v.semanas[0].n, 1);
    assert.equal(v.semanas.length, SEMANAS);
    assert.equal(v.comecaEm, INICIO);
  }
});

test("vistaDoPlano: a vigente 055 mark drops the task; past reler it is back; an undone past task joins this week (FR-004)", () => {
  const marca = (alavanca, marcado, reler) => [{ alavanca, responsavel: "jean", marcado, reler }];
  const alavancas = (v) => v.semanas[0].tarefas.map((t) => t.alavanca).sort();
  assert.deepEqual(alavancas(vista()), ["links", "titulo"], "week 3's undone titulo is still future work");
  assert.deepEqual(alavancas(vista({ marcas: marca("links", SEMANA5, addDaysISO(SEMANA5, 14)) })), ["titulo"]);
  assert.deepEqual(alavancas(vista({ marcas: marca("links", SEMANA5, addDaysISO(SEMANA5, 1)) })), ["links", "titulo"], "past reler");
  // a mark made before the task's week does not close it
  assert.deepEqual(alavancas(vista({ marcas: marca("links", addDaysISO(SEMANA5, -1), addDaysISO(SEMANA5, 14)) })), ["links", "titulo"]);
  // week 3's titulo, marked in week 4 and still waiting, stays out
  assert.deepEqual(alavancas(vista({ marcas: marca("titulo", addDaysISO(INICIO, 22), addDaysISO(SEMANA5, 14)) })), ["links"]);
  assert.equal(MONTADO.semanas[4].tarefas.length, 1, "no mutation");
});

test("vistaDoPlano: each meta keeps its state word and final value, with no author and no date (FR-006)", () => {
  const propostas = [
    { chave: "top20", prazo: 90, origem: "demanda", valor: 0.3, op: "<", conta: "c", partida: 0, distancia: 0.3 },
    { chave: "pagina1", prazo: 180, origem: "demanda", valor: 0.4, op: "<", conta: "c" },
    { chave: "lcp", prazo: 90, origem: "regua", valor: 2500, op: ">", conta: "c" },
    { chave: "inp", prazo: 90, origem: "regua", valor: 200, op: ">", conta: "c" },
  ];
  const decisoes = [
    { chave: "top20", prazo: 90, estado: "aprovada", valor: 0.3, decididoPor: "jean", decididoEm: "2026-09-28 10:00" },
    { chave: "pagina1", prazo: 180, estado: "editada", valor: 0.5, decididoPor: "maria", decididoEm: "2026-09-28 10:00" },
    { chave: "lcp", prazo: 90, estado: "recusada", valor: null, decididoPor: "jean", decididoEm: "2026-09-28 10:00" },
  ];
  const v = vista({ propostas, decisoes });
  assert.deepEqual(
    v.metas.map((m) => [m.chave, m.estado, m.valorFinal]),
    [
      ["top20", "aprovada", 0.3],
      ["pagina1", "editada", 0.5],
      ["lcp", "recusada", null],
      ["inp", "proposta", null],
    ],
  );
  assert.deepEqual(presenteNaVista(v, 5), []);
});

// ── 058 US2 · the core (núcleo) ────────────────────────────────────────────────

test("propostaDeIntencao: the hub's own classifier, weighted by volume; no declaring term → null (D11)", async () => {
  const { default: DEMANDAS } = await import("../data/demanda-estimada.json", { with: { type: "json" } });
  const gomada = lerDemanda(DEMANDAS.tapepro, null).clusters.find((c) => c.semente === "fita-gomada");
  const declarado = gomada.termos.filter((t) => modificadoresDeIntencao(t.termo, 2026) !== "ausente").reduce((a, t) => a + (t.volume ?? 0), 0);
  assert.ok(declarado > 0);
  assert.deepEqual(propostaDeIntencao(gomada, 2026), { classe: "comercial", volumeDeclarado: declarado, volumeTotal: gomada.volume });
  assert.equal(propostaDeIntencao({ volume: 100, termos: [{ termo: "fita gomada", volume: 100 }] }, 2026), null);
  const c = (info, com) => ({ volume: info + com, termos: [{ termo: "guia da fita", volume: info }, { termo: "fita preço", volume: com }] });
  assert.equal(propostaDeIntencao(c(10, 30), 2026).classe, "comercial");
  assert.equal(propostaDeIntencao(c(30, 10), 2026).classe, "informacional");
  assert.equal(propostaDeIntencao(c(20, 20), 2026).classe, "ambos");
});

test("perguntasPropostas: frozen terms that start with an interrogative word, with their volume (D12)", async () => {
  const c = {
    termos: [
      { termo: "como aplicar fita gomada", volume: 50 },
      { termo: "o que é fita gomada", volume: 20 },
      { termo: "Quanto custa fita gomada", volume: null },
      { termo: "pra que serve fita kraft", volume: 10 },
      { termo: "fita gomada", volume: 900 },
      { termo: "fita gomada preço", volume: 70 },
      { termo: "comoda de fita", volume: 5 },
    ],
  };
  assert.deepEqual(perguntasPropostas(c), [
    { texto: "como aplicar fita gomada", volume: 50 },
    { texto: "o que é fita gomada", volume: 20 },
    { texto: "Quanto custa fita gomada", volume: null },
    { texto: "pra que serve fita kraft", volume: 10 },
  ]);
  const { default: DEMANDAS } = await import("../data/demanda-estimada.json", { with: { type: "json" } });
  assert.deepEqual(lerDemanda(DEMANDAS.tapepro, null).clusters.flatMap(perguntasPropostas), []);
});

const TP = "https://t.com/produtos/fita-gomada/";
const APONTADA = "https://t.com/blog/transparente";
const TERMOS_NUCLEO = [
  { termo: "fita gomada", volume: 1000 },
  { termo: "fita gomada kraft", volume: 200 },
  { termo: "fita transparente", volume: 500 },
  { termo: "como usar fita transparente", volume: 40 },
  { termo: "fita transparente personalizada", volume: 90 },
];
const DECISOES_NUCLEO = [
  { semente: "fita-transparente", intencao: "informacional", pagina: APONTADA },
  { semente: "nao-existe", intencao: "comercial", pagina: null },
];
const ITENS_NUCLEO = [
  { semente: "fita-transparente", tipo: "pergunta", texto: "como usar fita transparente", detalhe: null, estado: "removida" },
  { semente: "fita-gomada", tipo: "pergunta", texto: "qual a largura da fita gomada", detalhe: "https://t.com/blog/largura", estado: "aceita" },
  { semente: "fita-gomada", tipo: "pergunta", texto: "fita gomada gruda em plástico", detalhe: null, estado: "respondida" },
  { semente: "fita-gomada", tipo: "entidade", texto: "papel kraft", detalhe: "material", estado: "aceita" },
  { semente: "fita-gomada", tipo: "entidade", texto: "3M", detalhe: "outra", estado: "removida" },
  { semente: "nao-existe", tipo: "entidade", texto: "x", detalhe: "outra", estado: "aceita" },
];
const ESTADOS_NUCLEO = { [TP]: { estado: "ativa", classe: "indexada", motivo: null }, [APONTADA]: { estado: "fora-do-indice", classe: "outra", motivo: null } };
const nucleoDe = (termos) => aplicarNucleo(comTermos(termos, [{ url: TP, titulo: "Fita gomada kraft", h1: null }], ESTADOS_NUCLEO), { decisoes: DECISOES_NUCLEO, itens: ITENS_NUCLEO, estados: ESTADOS_NUCLEO, ano: 2026 });

test("aplicarNucleo: the owner's decisions win, the defaults fill the rest, terms keep their cobertoPor (D11)", () => {
  const antes = comTermos(TERMOS_NUCLEO, [{ url: TP, titulo: "Fita gomada kraft", h1: null }], ESTADOS_NUCLEO);
  const cs = nucleoDe(TERMOS_NUCLEO);
  const de = (s) => cs.find((c) => c.semente === s);
  assert.equal(cs.length, antes.length, "a row whose seed is not a cluster is ignored");

  const tr = de("fita-transparente");
  assert.deepEqual(tr.intencao, { valor: "informacional", proposta: null, decidida: true });
  assert.equal(tr.pagina, APONTADA);
  assert.deepEqual(tr.paginaResponsavel, { alvo: APONTADA, origem: "dono" });
  assert.equal(tr.estadoDaPagina.estado, "fora-do-indice");
  assert.deepEqual(tr.perguntas, [], "a removida proposal is left out");
  assert.ok(agendaDePaginas(antes, { capacidade: 3 }).some((p) => p.tipo === "cluster" && p.semente === "fita-transparente"));
  assert.ok(!agendaDePaginas(cs, { capacidade: 3 }).some((p) => p.tipo === "cluster" && p.semente === "fita-transparente"), "a pointed page stops the planned cluster page");
  for (const c of cs) assert.deepEqual(c.termos.map((t) => t.cobertoPor), antes.find((a) => a.semente === c.semente).termos.map((t) => t.cobertoPor), c.semente);

  const go = de("fita-gomada");
  assert.deepEqual(go.paginaResponsavel, { alvo: TP, origem: "cobertura" });
  assert.equal(go.intencao.decidida, false);
  assert.deepEqual(go.perguntas, [
    { texto: "qual a largura da fita gomada", origem: "dono", volume: null, pagina: "https://t.com/blog/largura", estado: "aceita" },
    { texto: "fita gomada gruda em plástico", origem: "dono", volume: null, pagina: TP, estado: "respondida" },
  ]);
  assert.deepEqual(go.entidades, [{ nome: "papel kraft", tipo: "material" }]);
  assert.deepEqual(de("fita-transparente-personalizada").paginaResponsavel, { alvo: "«fita transparente personalizada»", origem: "planejada" });
});

test("aplicarNucleo: a proposed question keeps its term's volume and state; decisions survive a regrouped demand (FR-015)", () => {
  const com = [...TERMOS_NUCLEO, { termo: "como aplicar fita gomada", volume: 30 }];
  const go = nucleoDe(com).find((c) => c.semente === "fita-gomada");
  assert.deepEqual(go.perguntas[0], { texto: "como aplicar fita gomada", origem: "termo", volume: 30, pagina: TP, estado: "proposta" });
  const mais = nucleoDe([...com, { termo: "fita gomada larga", volume: 60 }]);
  const base = nucleoDe(com);
  for (const s of ["fita-gomada", "fita-transparente"]) {
    const [a, b] = [base, mais].map((cs) => cs.find((c) => c.semente === s));
    assert.deepEqual([b.intencao.valor, b.paginaResponsavel, b.perguntas, b.entidades], [a.intencao.valor, a.paginaResponsavel, a.perguntas, a.entidades], s);
  }
});

test("SC-001 with the core: the view strips the owner's page state too", () => {
  const cs = nucleoDe(TERMOS_NUCLEO);
  assert.ok(cs.some((c) => c.estadoDaPagina), "aplicarNucleo sets the state: scheduling reads it");
  const v = vistaDoPlano({ propostas: [], montado: null, clusters: cs, hoje: INICIO, semanaAtual: 1, inicio: INICIO });
  assert.deepEqual(presenteNaVista(v, 1), []);
  assert.ok(v.clusters.every((c) => "paginaResponsavel" in c && "intencao" in c && "perguntas" in c && "entidades" in c));
});

const CTX_NUCLEO = { slugs: SLUGS, sementes: ["fita-gomada", "fita-transparente"], hosts: ["t.com"] };
const NUCLEO = { projeto: "tapepro", semente: "fita-gomada", responsavel: "jean" };

test("lerNucleo: intent from the three classes, page on the project's hosts or empty; anything else is null", () => {
  assert.deepEqual(lerNucleo({ ...NUCLEO, intencao: "comercial" }, CTX_NUCLEO), { projeto: "tapepro", semente: "fita-gomada", por: "jean", intencao: "comercial" });
  assert.deepEqual(lerNucleo({ ...NUCLEO, pagina: "https://www.t.com/p/x" }, CTX_NUCLEO), { projeto: "tapepro", semente: "fita-gomada", por: "jean", pagina: "https://www.t.com/p/x" });
  assert.deepEqual(lerNucleo({ ...NUCLEO, pagina: "" }, CTX_NUCLEO), { projeto: "tapepro", semente: "fita-gomada", por: "jean", pagina: null });
  const ruim = [
    { intencao: "transacional" },
    { intencao: "" },
    { semente: "outra", intencao: "comercial" },
    { projeto: "outro", intencao: "comercial" },
    { responsavel: "joao", intencao: "comercial" },
    { pagina: "/p/x" },
    { pagina: "https://outro.com/p/x" },
    { pagina: "javascript:alert(1)" },
    {},
  ];
  for (const r of ruim) assert.equal(lerNucleo({ ...NUCLEO, ...r }, CTX_NUCLEO), null, JSON.stringify(r));
});

test("lerItem: question or entity, text 1–200, kind from the list, answering page on the hosts", () => {
  const P = { ...NUCLEO, tipo: "pergunta", texto: "  como aplicar fita gomada ", estado: "aceita", detalhe: "" };
  assert.deepEqual(lerItem(P, CTX_NUCLEO), { projeto: "tapepro", semente: "fita-gomada", tipo: "pergunta", texto: "como aplicar fita gomada", detalhe: null, estado: "aceita", por: "jean" });
  assert.equal(lerItem({ ...P, estado: "respondida", detalhe: "https://t.com/blog/x" }, CTX_NUCLEO).detalhe, "https://t.com/blog/x");
  const E = { ...NUCLEO, tipo: "entidade", texto: "papel kraft", estado: "aceita", detalhe: "material" };
  assert.equal(lerItem(E, CTX_NUCLEO).detalhe, "material");
  assert.equal(lerItem({ ...E, detalhe: "marca própria" }, CTX_NUCLEO).detalhe, "marca própria");
  assert.equal(lerItem({ ...E, estado: "removida", detalhe: "" }, CTX_NUCLEO).estado, "removida");
  const ruim = [
    { ...P, semente: "outra" },
    { ...P, tipo: "termo" },
    { ...P, texto: "" },
    { ...P, texto: "   " },
    { ...P, texto: "x".repeat(201) },
    { ...P, estado: "talvez" },
    { ...P, detalhe: "https://outro.com/x" },
    { ...P, responsavel: "joao" },
    { ...E, estado: "respondida" },
    { ...E, detalhe: "concorrente" },
    { ...E, detalhe: "" },
  ];
  for (const r of ruim) assert.equal(lerItem(r, CTX_NUCLEO), null, JSON.stringify(r));
});
