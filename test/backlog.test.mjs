import { test } from "node:test";
import assert from "node:assert/strict";
import { ALAVANCAS, DEGRAUS } from "../lib/proxima-acao.mjs";
import { addDaysISO } from "../lib/agenda.mjs";
import { agendar, alvoDoCard, aplicarEdicoes, chaveDe, deCards, juntar, ordenar } from "../lib/backlog.mjs";

// ── T025 · the map's cards become tasks (research D3, D4, D5) ──────────────────
const disparo = (chave, alavanca, alvos = [], nAlvos = alvos.length) => ({ chave, alavanca, estado: "dispara", alvos, nAlvos });
const SNAPSHOT = {
  disparos: [
    disparo("ctrGap", "titulo", ["/a/ (faltam 12 cliques)", "/b", "/c%C3%A7/", "/d", "/e"]),
    disparo("strikingDistance", "links", ["«fita gomada»"]),
    disparo("indexacaoLimpa", "indexacao", [], 12),
  ],
  semLeitura: [{ chave: "lcp", alavanca: "vitais", motivo: "o CrUX não tem dados desta origem" }],
};
const marca = (alavanca, marcado, reler) => ({ projeto: "tapepro", alavanca, responsavel: "jean", marcado, reler, leituras: {} });

test("deCards: one task per target of the first reason with targets, in full; typed, normalized keys (D4)", () => {
  const { tarefas } = deCards(SNAPSHOT, { marcas: [], hoje: "2026-10-01" });
  assert.deepEqual(tarefas.map((t) => t.chave).sort(), ["indexacao|*", "links|termo:«fita gomada»", "titulo|url:/a", "titulo|url:/b", "titulo|url:/cç", "titulo|url:/d", "titulo|url:/e"].sort());
  assert.equal(tarefas.filter((t) => t.alavanca === "titulo").length, 5, "not plano()'s 3-item cut");
  const a = tarefas.find((t) => t.chave === "titulo|url:/a");
  assert.equal(a.alvo.rotulo, "/a/ (faltam 12 cliques)", "the annotation stays in the label");
  assert.deepEqual(a.origens, ["mapa"]);
  assert.deepEqual(a.kpis, ["ctrGap"], "FR-002: the leaves that fired it");
  assert.equal(tarefas.find((t) => t.chave === "indexacao|*").alvo.rotulo, "12 alvos");
});

test("deCards: a vigente 055 mark drops the lever; past reler it is back (D5)", () => {
  const titulos = (hoje) => deCards(SNAPSHOT, { marcas: [marca("titulo", "2026-09-28", "2026-10-12")], hoje }).tarefas.filter((t) => t.alavanca === "titulo").length;
  assert.equal(titulos("2026-10-01"), 0);
  assert.equal(titulos("2026-10-12"), 5);
});

test("deCards: a leaf that was sem-leitura when the map was read is a falta, never a silent gap (analyze U3)", () => {
  const { faltas } = deCards(SNAPSHOT, { marcas: [], hoje: "2026-10-01" });
  assert.deepEqual(faltas, [{ alavanca: "vitais", folha: "lcp", motivo: "o CrUX não tem dados desta origem" }]);
});

test("alvoDoCard and chaveDe: decoded path without trailing slash or annotation; «termo»; *", () => {
  assert.deepEqual(alvoDoCard("/p/a%C3%A7o/ (faltam 3 cliques)"), { tipo: "url", valor: "/p/aço", rotulo: "/p/a%C3%A7o/ (faltam 3 cliques)" });
  assert.deepEqual(alvoDoCard("https://t.com/p/x/"), { tipo: "url", valor: "/p/x", rotulo: "https://t.com/p/x/" });
  assert.equal(alvoDoCard("/").valor, "/");
  assert.equal(chaveDe("links", alvoDoCard("«fita»")), "links|termo:«fita»");
  assert.equal(chaveDe("indexacao", { tipo: "*", valor: "*", rotulo: "" }), "indexacao|*");
});

// ── T026 · merging (FR-021, D4) ────────────────────────────────────────────────
const tarefa = (alavanca, tipo, valor, extra = {}) => ({
  chave: chaveDe(alavanca, { tipo, valor }),
  alavanca,
  alvo: { tipo, valor, rotulo: valor },
  origens: ["mapa"],
  kpis: [],
  briefing: null,
  paginaNova: false,
  depende: [],
  espera: 0,
  impacto: { naoCalculavel: "x" },
  esforco: { minutos: 1, editado: false },
  ...extra,
});

test("juntar: same key is one task with both origins; * is absorbed by a concrete task of its lever; no mutation", () => {
  const entrada = [
    tarefa("indexacao", "url", "/a", { origens: ["pagina-existente"], kpis: ["indexacaoLimpa"] }),
    tarefa("indexacao", "url", "/a", { kpis: ["rejeicaoRastreio"] }),
    tarefa("indexacao", "*", "*"),
    tarefa("poda", "*", "*"),
  ];
  const copia = structuredClone(entrada);
  const r = juntar(entrada);
  assert.deepEqual(entrada, copia);
  assert.deepEqual(r.map((t) => t.chave), ["indexacao|url:/a", "poda|*"]);
  assert.deepEqual(r[0].origens, ["pagina-existente", "mapa"]);
  assert.deepEqual(r[0].kpis, ["indexacaoLimpa", "rejeicaoRastreio"]);
});

// ── T027 · order (D7, SC-006) ──────────────────────────────────────────────────
const comImpacto = (t, cliques, minutos = 1) => ({ ...t, impacto: cliques === null ? { naoCalculavel: "x" } : { cliques, conta: "" }, esforco: { minutos, editado: false } });
const ORDEM_054 = (a) => DEGRAUS.findIndex((g) => g.id === ALAVANCAS[a].degrau) * 100 + Object.keys(ALAVANCAS).indexOf(a);

test("ordenar: impact ÷ effort descending; null impact last, in 054 order, then by key", () => {
  const r = ordenar([
    comImpacto(tarefa("titulo", "url", "/a"), 10, 10), // 1
    comImpacto(tarefa("links", "url", "/b"), 30, 3), // 10
    comImpacto(tarefa("schema", "url", "/c"), null),
    comImpacto(tarefa("indexacao", "url", "/d"), null),
    comImpacto(tarefa("frescor", "url", "/e"), 5, 1), // 5
  ]);
  assert.deepEqual(r.map((t) => t.chave), ["links|url:/b", "frescor|url:/e", "titulo|url:/a", "indexacao|url:/d", "schema|url:/c"]);
});

test("ordenar: on one target, the earlier step comes first whatever the impact; a planned page is born first (SC-006)", () => {
  const r = ordenar([
    comImpacto(tarefa("titulo", "url", "/a"), 100),
    comImpacto(tarefa("links", "url", "/a"), 50),
    comImpacto(tarefa("indexacao", "url", "/a"), 1),
    comImpacto(tarefa("indexacao", "planejada", "«x»"), 90),
    comImpacto(tarefa("cobertura", "planejada", "«x»", { paginaNova: true }), 90, 10),
  ]);
  const deA = r.filter((t) => t.alvo.valor === "/a").map((t) => t.alavanca);
  assert.deepEqual(deA, ["indexacao", "links", "titulo"]);
  const deX = r.filter((t) => t.alvo.valor === "«x»").map((t) => t.alavanca);
  assert.deepEqual(deX, ["cobertura", "indexacao"]);
});

/** Deterministic pseudo-random numbers: the generated cases must fail the same way twice. */
function sorteio(semente) {
  let s = semente;
  return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

test("ordenar: generated — no task comes before one of an earlier step on the same target (SC-006)", () => {
  const r = sorteio(7);
  for (let rodada = 0; rodada < 50; rodada++) {
    const ts = [];
    for (const a of Object.keys(ALAVANCAS))
      for (const alvo of ["/x", "/y", "/z"]) if (r() < 0.6) ts.push(comImpacto(tarefa(a, "url", alvo), r() < 0.2 ? null : Math.round(r() * 500), 1 + Math.floor(r() * 60)));
    const o = ordenar(ts);
    for (let i = 0; i < o.length; i++)
      for (let j = i + 1; j < o.length; j++)
        if (o[i].alvo.valor === o[j].alvo.valor) assert.ok(ORDEM_054(o[i].alavanca) <= ORDEM_054(o[j].alavanca), `${o[i].chave} antes de ${o[j].chave}`);
  }
});

// ── T028 · scheduling (D8, SC-007a) ────────────────────────────────────────────
const INICIO = "2026-09-28";
const segunda = (n) => addDaysISO(INICIO, 7 * (n - 1));
const pagina = (rotulo, extra = {}) => tarefa("cobertura", "planejada", rotulo, { paginaNova: true, ...extra });
const deps = (alavanca, rotulo, extra = {}) => tarefa(alavanca, "planejada", rotulo, { depende: [chaveDe("cobertura", { tipo: "planejada", valor: rotulo })], ...extra });
const AG = { capacidade: 3, semanaAtual: 2, semanas: 26, inicio: INICIO };
const por = (r, chave) => r.find((t) => t.chave === chave);

test("agendar: capacity 3 and 4 pages → three this week, the fourth next week; others take no capacity", () => {
  const r = agendar([pagina("«a»"), pagina("«b»"), pagina("«c»"), pagina("«d»"), deps("titulo", "«d»"), deps("indexacao", "«a»", { espera: 2 }), tarefa("links", "url", "/x")], AG);
  assert.deepEqual(["«a»", "«b»", "«c»", "«d»"].map((x) => por(r, `cobertura|planejada:${x}`).semana), [2, 2, 2, 3]);
  assert.equal(por(r, "titulo|planejada:«d»").semana, 3, "the same week as its page");
  assert.equal(por(r, "indexacao|planejada:«a»").semana, 4, "not before the page week + semanasAteIndexar");
  assert.equal(por(r, "indexacao|planejada:«a»").naoAntes, 4);
  assert.equal(por(r, "links|url:/x").semana, 2);
  assert.ok(r.every((t) => t.estado === "agendada"));
});

test("agendar: a fixed date wins the order when it fits; a full week makes the page a fazer, with the reason (FR-028)", () => {
  const cheia = agendar([pagina("«a»"), pagina("«b»"), pagina("«c»"), pagina("«d»", { prazoFixo: segunda(2) })], AG);
  assert.equal(por(cheia, "cobertura|planejada:«d»").semana, 2, "the fixed page goes ahead of pages earlier in the order");
  assert.equal(por(cheia, "cobertura|planejada:«c»").semana, 3);
  const r = agendar([pagina("«a»", { prazoFixo: segunda(4) }), pagina("«b»", { prazoFixo: segunda(4) }), pagina("«c»", { prazoFixo: segunda(4) }), pagina("«d»", { prazoFixo: segunda(4) })], AG);
  const d = por(r, "cobertura|planejada:«d»");
  assert.equal(d.estado, "a-fazer");
  assert.equal(d.semana, null);
  assert.equal(d.motivo, `a data fixada não cabe: a semana ${segunda(4).slice(8, 10)}/${segunda(4).slice(5, 7)} já tem 3 páginas novas`);
});

test("agendar: a non-page task with a fixed date goes to it, or is bloqueada when its dependency lands later", () => {
  const ok = agendar([tarefa("links", "url", "/x", { prazoFixo: segunda(6) })], AG);
  assert.equal(ok[0].semana, 6);
  const r = agendar([pagina("«a»", { prazoFixo: segunda(5) }), deps("titulo", "«a»", { prazoFixo: segunda(3) })], AG);
  assert.equal(por(r, "titulo|planejada:«a»").estado, "bloqueada");
  assert.match(por(r, "titulo|planejada:«a»").motivo, /«a»/);
});

test("agendar: a fixed date already past is read as this week and says 'data fixada vencida', printing no past date", () => {
  const r = agendar([tarefa("links", "url", "/x", { prazoFixo: segunda(1) }), pagina("«a»", { prazoFixo: segunda(1) })], AG);
  for (const t of r) {
    assert.equal(t.semana, 2);
    assert.equal(t.motivo, "data fixada vencida");
  }
});

test("agendar: a page past week 26 is a fazer, and what depends on it is bloqueada, naming it; capacity 0 schedules no page", () => {
  const muitas = Array.from({ length: 80 }, (_, i) => pagina(`«p${String(i).padStart(2, "0")}»`));
  const r = agendar([...muitas, deps("titulo", "«p79»")], AG);
  assert.equal(por(r, "cobertura|planejada:«p79»").estado, "a-fazer");
  assert.equal(por(r, "titulo|planejada:«p79»").estado, "bloqueada");
  assert.match(por(r, "titulo|planejada:«p79»").motivo, /«p79»/);
  const zero = agendar([pagina("«a»"), deps("titulo", "«a»"), tarefa("links", "url", "/x")], { ...AG, capacidade: 0 });
  assert.equal(por(zero, "cobertura|planejada:«a»").estado, "a-fazer");
  assert.equal(por(zero, "titulo|planejada:«a»").estado, "bloqueada");
  assert.equal(por(zero, "links|url:/x").semana, 2);
});

test("agendar: generated — no week over capacity, no week before the current one, only new pages a fazer (SC-007a)", () => {
  const r = sorteio(11);
  for (let rodada = 0; rodada < 50; rodada++) {
    const capacidade = Math.floor(r() * 4);
    const semanaAtual = 1 + Math.floor(r() * 20);
    const ts = [];
    for (let i = 0; i < 40; i++) {
      const rot = `«p${i}»`;
      if (r() < 0.5) ts.push(pagina(rot, r() < 0.2 ? { prazoFixo: segunda(1 + Math.floor(r() * 26)) } : {}));
      if (r() < 0.5) ts.push(deps(["titulo", "links", "schema", "indexacao"][Math.floor(r() * 4)], rot, r() < 0.3 ? { espera: 2 } : {}));
      if (r() < 0.3) ts.push(tarefa(Object.keys(ALAVANCAS)[Math.floor(r() * 13)], "url", `/u${i}`, r() < 0.2 ? { prazoFixo: segunda(1 + Math.floor(r() * 26)) } : {}));
    }
    const o = agendar(juntar(ts), { ...AG, capacidade, semanaAtual });
    const porSemana = new Map();
    for (const t of o) {
      if (t.semana !== null) assert.ok(t.semana >= Math.max(1, semanaAtual) && t.semana <= 26, `${t.chave} na semana ${t.semana}`);
      if (t.estado === "a-fazer") assert.ok(t.paginaNova, `${t.chave} a fazer sem ser página nova`);
      if (t.paginaNova && t.semana !== null) porSemana.set(t.semana, (porSemana.get(t.semana) ?? 0) + 1);
    }
    for (const [s, n] of porSemana) assert.ok(n <= capacidade, `semana ${s}: ${n} páginas com capacidade ${capacidade}`);
  }
});

// ── T029 · the owner's edits survive (D13, SC-007) ─────────────────────────────
test("aplicarEdicoes: responsible, effort and fixed date survive a rebuild with other premises; unknown keys are ignored", () => {
  const edicoes = new Map([
    ["links|url:/x", { responsavel: "maria", esforco: 30, prazo: segunda(5) }],
    ["poda|url:/sumiu", { responsavel: "maria", esforco: 9, prazo: null }],
  ]);
  const base = [tarefa("links", "url", "/x"), tarefa("titulo", "url", "/y"), tarefa("cobertura", "url", "/z", { perguntas: ["a", "b"] }), tarefa("cobertura", "planejada", "«p»", { paginaNova: true })];
  const v1 = aplicarEdicoes(base, edicoes, { responsavel: "jean", esforco: { links: 3, titulo: 2, cobertura: 10, pergunta: 5 } });
  const v2 = aplicarEdicoes(base, edicoes, { responsavel: "jean", esforco: { links: 7, titulo: 4, cobertura: 20, pergunta: 6 } });
  for (const v of [v1, v2]) {
    const x = v.find((t) => t.chave === "links|url:/x");
    assert.deepEqual([x.responsavel, x.esforco, x.prazoFixo], [{ id: "maria", editado: true }, { minutos: 30, editado: true }, segunda(5)]);
  }
  const y = v2.find((t) => t.chave === "titulo|url:/y");
  assert.deepEqual([y.responsavel, y.esforco, y.prazoFixo], [{ id: "jean", editado: false }, { minutos: 4, editado: false }, null]);
  assert.equal(v2.find((t) => t.chave === "cobertura|url:/z").esforco.minutos, 12, "pergunta × the task's questions");
  assert.equal(v2.find((t) => t.chave === "cobertura|planejada:«p»").esforco.minutos, 20);
  assert.equal(v2.length, base.length);
});
