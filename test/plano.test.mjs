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
  cobrir,
  comparar,
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
  semanaDoPrazo,
} from "../lib/plano.mjs";

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
// Two clusters: one already covered (week 0), one to create. 10 terms with volume in total.
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
  const crawl = coberto ? [{ url: "https://t.com/produtos/fita-gomada", titulo: "Fita gomada" }] : [];
  return { clusters: cobrir(clusters, crawl), semCluster };
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

test("propor: demand math follows maturation; existing pages are week 0 (D2)", () => {
  const { clusters, semCluster } = demo();
  const ms = propor(clusters, { premissas: PREMISSAS_PADRAO, inicio: INICIO, semCluster });
  // 10 terms with volume (the null one is out of both sides); 4 in the covered cluster.
  const t20 = meta(ms, "top20", 90);
  assert.equal(t20.origem, "demanda");
  assert.equal(t20.valor, 4 / 10);
  // defaults: no page created by the plan matures by week 12
  assert.equal(t20.aviso, "nenhuma página nova amadurece antes deste prazo com estas premissas");
  // by week 25 the two new cluster pages (weeks 1) mature: 4 + 3 + 2 of 10 (semCluster never)
  const p1 = meta(ms, "pagina1", 180);
  assert.equal(p1.valor, 9 / 10);
  assert.equal(p1.aviso, undefined);
  const volTotal = 400 + 100 + 50 + 30 + 200 + 60 + 40 + 90 + 30 + 100;
  const volMaduro = volTotal - 100;
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

test("propor: a created-in-week-0 cluster counts at 90 d only when stabilization fits", () => {
  const { clusters, semCluster } = demo();
  const curto = propor(clusters, { premissas: { ...PREMISSAS_PADRAO, semanasAteEstabilizar: 4 }, inicio: INICIO, semCluster });
  assert.equal(meta(curto, "top20", 90).valor, 9 / 10);
  assert.equal(meta(curto, "top20", 90).aviso, undefined);
});

test("propor: starting point and distance on demand metas; absent without a reading, never 0 (D11)", () => {
  const { clusters, semCluster } = demo();
  const com = propor(clusters, { premissas: PREMISSAS_PADRAO, inicio: INICIO, semCluster, partida: { top20: 0.1, tamBusca: 0.05, pagina1: 0 } });
  assert.equal(meta(com, "top20", 90).partida, 0.1);
  assert.equal(meta(com, "top20", 90).distancia, 0.4 - 0.1);
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
    ag.map((p) => [p.tipo, p.semente, p.segmento ?? null, p.semana]),
    [
      ["cluster", "fita-gomada", null, 1],
      ["cluster", "fita-transparente", null, 1],
      ["cluster", "fita-transparente-personalizada", null, 2],
      ["apoio", "fita-gomada", "e-commerce", 2],
    ],
  );
  assert.deepEqual(agendaDePaginas(clusters, { capacidade: 0 }).map((p) => p.semana), [null, null, null, null]);
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
  assert.equal(criadaEm.size, 4);
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
