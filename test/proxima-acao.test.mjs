import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATALOGO } from "../lib/gsc-delta.mjs";
import { BENCHMARK } from "../lib/kpis-busca.mjs";
import { ALAVANCAS, DEGRAUS, REGRAS, avaliar, etiqueta, metaTexto, plano, regraEmTexto } from "../lib/proxima-acao.mjs";

// The Sirius map as read in production on 22/09/2026 (spec 054, "O fato que abre esta spec").
const F = "fixture";
const SIRIUS = {
  ctrPorPosicao: { valor: 1.1 / 2, texto: "2 faixas abaixo (4 a 6, 7 a 10)", fonte: F },
  penetracaoTop3: { valor: 0, texto: "0% (0 de 18 termos)", fonte: F },
  strikingDistance: { valor: 14, texto: "14 consultas entre 4 e 10,9", fonte: F },
  crescimentoNaoMarca: { valor: 0.248, texto: "+24,8% no mês", fonte: F },
  impressoesTop3: { valor: 0.03, texto: "3% das impressões", fonte: F },
  ctrGap: { valor: 0.001 / 0.02, texto: "6 URLs abaixo, pior CTR 0,1% contra 2%", fonte: F, alvos: ["/en/blog/whatsapp-api-oficial-meta-crm", "/b", "/c", "/d"], nAlvos: 6 },
  conformidadeUrls: { indecisa: "só 6 URLs decididas" },
  schema: { valor: 76 / 84, texto: "90,5% (76 de 84)", fonte: F },
  larguraTitulo: { valor: 86, texto: "86 títulos acima de 580px", fonte: F },
  reescritaTitulo: { ausente: "sem coletor" },
  termoNoTitulo: { valor: 14, texto: "14 URLs sem o termo no início", fonte: F },
  intencao: { valor: 81, texto: "81 títulos sem modificador", fonte: F },
  lcp: { ausente: "sem amostra de campo" },
  inp: { ausente: "sem amostra de campo" },
  cls: { ausente: "sem amostra de campo" },
  ttfb: { ausente: "sem amostra de campo" },
  urlsBoas: { ausente: "0 de 10 URLs prioritárias na CrUX" },
  indexacaoLimpa: { valor: 84 / 114, texto: "73,7% (30 fora)", fonte: F, alvos: ["/x"], nAlvos: 30 },
  rejeicaoRastreio: { valor: 28 / 114, texto: "24,6% (28 de 114)", fonte: F },
  profundidadeClique: { valor: 43, texto: "43 a mais de 3 cliques, 29 órfãs", fonte: F },
  coberturaSemantica: { ausente: "sem coletor" },
  frescor: { valor: 38, texto: "38 vencidas, 64 sem data", fonte: F },
  canibalizacao: { valor: 0, texto: "0 páginas disputadas", fonte: F },
  linksInternos: { valor: 84, texto: "84 páginas com menos de 5", fonte: F, alvos: ["/p1", "/p2", "/p3", "/p4"], nAlvos: 84 },
  referringDomains: { ausente: "sem coletor" },
  buscasDeMarca: { valor: 0, texto: "155 em agosto contra 68 em julho", fonte: F },
  consultasUnicas: { valor: 111 / 42 - 1, texto: "+164% no trimestre", fonte: F, piso: true },
  top20: { valor: 3 / 18, texto: "16,7% (3 de 18 termos)", fonte: F },
  queryToPage: { valor: 1.3, texto: "1,3 por URL", fonte: F, piso: true },
  activeIndexRatio: { valor: 0.75, texto: "75% (63 de 84)", fonte: F },
  tamBusca: { ausente: "sem demanda estimada declarada" },
};

test("one rule per catalog leaf, in both directions", () => {
  assert.deepEqual(Object.keys(REGRAS).sort(), Object.keys(CATALOGO).sort());
  for (const [k, r] of Object.entries(REGRAS)) if (r) assert.ok(r.alavanca in ALAVANCAS, `${k} → ${r.alavanca}`);
  for (const a of Object.values(ALAVANCAS)) assert.ok(DEGRAUS.some((g) => g.id === a.degrau));
});

test("a rule's origin follows the catalog seal: ◆ only where the catalog has a ruler (SC-003)", () => {
  for (const [k, r] of Object.entries(REGRAS)) {
    if (!r) continue;
    const tipo = CATALOGO[k].balizador.tipo;
    assert.equal(r.origem === "regua", tipo === "regua", `${k}: origem ${r.origem}, balizador ${tipo}`);
    if (tipo === "norma") assert.equal(r.origem, "norma", k);
  }
});

test("◆ thresholds are the live ruler, not a copy", () => {
  for (const k of ["lcp", "inp", "cls", "ttfb"]) assert.equal(REGRAS[k].limiar, CATALOGO[k].balizador.limite, k);
  assert.match(metaTexto(REGRAS.larguraTitulo), new RegExp(`${CATALOGO.larguraTitulo.balizador.limite}px`));
  const pisos = BENCHMARK.map((f) => (f.ctr * 100).toLocaleString("pt-BR")).join("/");
  for (const k of ["ctrPorPosicao", "ctrGap"]) assert.ok(regraEmTexto(k).includes(pisos), k);
});

test("the map page keeps no copy of the board targets it now imports", () => {
  const pagina = readFileSync(new URL("../app/gsc/mapa/[slug]/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(pagina, /const (CLIQUES_DO_BOARD|LINKS_DO_BOARD)\s*=/);
});

test("the five states at the edges", () => {
  const e = (k, l) => avaliar({ [k]: l })[k].estado;
  assert.equal(e("indexacaoLimpa", { valor: 0.95, texto: "", fonte: F }), "sem-acao");
  assert.equal(e("indexacaoLimpa", { valor: 0.9499, texto: "", fonte: F }), "dispara");
  assert.equal(e("rejeicaoRastreio", { valor: 0.05, texto: "", fonte: F }), "dispara");
  assert.equal(e("activeIndexRatio", { valor: 0.49, texto: "", fonte: F }), "critica");
  assert.equal(e("ctrGap", { valor: 0.5, texto: "", fonte: F }), "dispara");
  assert.equal(e("ctrGap", { valor: 0.49, texto: "", fonte: F }), "critica");
  assert.equal(e("lcp", { valor: CATALOGO.lcp.balizador.limite, texto: "", fonte: F }), "sem-acao");
  assert.equal(e("lcp", { ausente: "sem amostra" }), "sem-leitura");
  assert.equal(e("conformidadeUrls", { indecisa: "a amostra não decide" }), "nao-decide");
  assert.equal(e("checklistGsc", undefined), "sem-acao");
});

test("a missing or non-numeric reading is never 'no action'", () => {
  const d = avaliar({}).top20;
  assert.equal(d.estado, "sem-leitura");
  assert.match(d.motivo, /não ligada/);
  assert.equal(avaliar({ top20: { valor: "0.2", texto: "", fonte: F } }).top20.estado, "sem-leitura");
});

test("a floor below the threshold fires flagged and never as critical; above it, no action", () => {
  const baixo = avaliar({ consultasUnicas: { valor: -0.5, texto: "", fonte: F, piso: true } }).consultasUnicas;
  assert.equal(baixo.estado, "dispara");
  assert.equal(baixo.piso, true);
  assert.match(etiqueta(baixo), /piso/);
  assert.equal(avaliar({ consultasUnicas: { valor: 0.5, texto: "", fonte: F, piso: true } }).consultasUnicas.estado, "sem-acao");
});

test("a ◇ tag never borrows the verdict glyph or the word 'régua' (FR-006)", () => {
  for (const [k, r] of Object.entries(REGRAS)) {
    if (!r || r.origem === "regua") continue;
    const valor = r.op === "<" ? r.limiar - 1 : r.limiar + 1;
    const t = etiqueta(avaliar({ [k]: { valor, texto: "x", fonte: F } })[k]);
    assert.match(t, /^(‼ crítica )?→ /, k);
    assert.doesNotMatch(t, /▼|régua/, `${k}: ${t}`);
  }
});

test("every leaf has its rule in words (US3)", () => {
  for (const k of Object.keys(REGRAS)) assert.match(regraEmTexto(k), /^(Regra: se |Sem regra)/, k);
  assert.match(regraEmTexto("canibalizacao"), /escolher uma página por consulta disputada/);
});

test("Sirius, 22/09: 32 states, index first, links once, title in the snippet step (SC-001/002/006)", () => {
  const ds = avaliar(SIRIUS);
  assert.equal(Object.keys(ds).length, 32);
  assert.equal(Object.values(ds).filter((d) => d.estado === "dispara" || d.estado === "critica").length, 16);

  const p = plano(ds);
  assert.deepEqual(p.degraus.map((g) => g.id), ["indice", "pagina", "posicao", "snippet"]);
  assert.equal(p.degraus[0].entradas[0].alavanca, "indexacao");

  const todas = p.degraus.flatMap((g) => g.entradas.map((e) => e.alavanca));
  assert.equal(new Set(todas).size, todas.length);

  const posicao = p.degraus.find((g) => g.id === "posicao");
  const links = posicao.entradas[0];
  assert.equal(links.alavanca, "links");
  assert.equal(links.critica, true);
  assert.deepEqual(links.motivos.map((m) => m.chave), ["penetracaoTop3", "linksInternos", "strikingDistance", "impressoesTop3"]);
  assert.deepEqual(links.alvos, ["/p1", "/p2", "/p3"]);
  assert.equal(links.alvosDe, "linksInternos");

  const titulo = p.degraus.find((g) => g.id === "snippet").entradas.find((e) => e.alavanca === "titulo");
  assert.equal(titulo.critica, true);
  assert.equal(titulo.alvos[0], "/en/blog/whatsapp-api-oficial-meta-crm");

  assert.deepEqual(p.naoDecide.map((d) => d.chave), ["conformidadeUrls"]);
  assert.equal(p.semLeitura.length, 9);
});
