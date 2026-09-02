import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { apurado, naoApurado as naoApuradoF, ehApurado } from "../lib/funil.mjs";
import { PERFIS, montarFicha, posicaoDeAtaque } from "../lib/okr.mjs";
import { projetar } from "../lib/projecao.mjs";
import { mergeProjects } from "../lib/projects.mjs";
import {
  estadoDeApurado,
  declarada,
  naoApurada,
  combinar,
  avaliarN2,
  montarN4,
  escolherFamilia,
  montarN5,
  validarKrs,
  montarNiveis,
  CANAIS,
  MEDIDORES,
} from "../lib/ficha.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A cadeia real da atma: 535 cliques → 39 leads, os três degraus do meio sem coletor, 0 tratamentos. */
const fichaAtma = () =>
  montarFicha({ slug: "atma", perfil: "D", coletado: { cliques: apurado(535), leads: apurado(39), vendas: apurado(0) } });

const entradaBase = (overrides = {}) => ({
  slug: "atma",
  ficha: fichaAtma(),
  meta: { valor: 50000, ticket: 4000, prazo: "2026-12-31", declaradaEm: "2026-09-01" },
  hoje: "2026-09-01",
  itensAgenda: [],
  erroAgenda: null,
  datasDono: new Map(),
  disponiveisN5: {},
  janela: { inicio: "2026-08-04", fim: "2026-08-29" },
  ...overrides,
});

const projecaoDe = (ficha, meta) => projetar({ ficha, meta, hoje: "2026-09-01" });
const vereditoDe = (ficha) => posicaoDeAtaque(ficha);

function fichaCompleta(overrides = {}) {
  const ficha = overrides.ficha ?? fichaAtma();
  const meta = "meta" in overrides ? overrides.meta : { valor: 50000, ticket: 4000, prazo: "2026-12-31", declaradaEm: "2026-09-01" };
  return entradaBase({
    ...overrides,
    ficha,
    meta,
    veredito: vereditoDe(ficha),
    projecao: projecaoDe(ficha, meta),
  });
}

// ── G1 — sempre 7 níveis, na ordem, para qualquer entrada ───────────────────

test("G1 — 7 níveis N0-N6 na ordem, para qualquer entrada", () => {
  const niveis = montarNiveis(fichaCompleta());
  assert.deepEqual(niveis.map((n) => n.id), ["N0", "N1", "N2", "N3", "N4", "N5", "N6"]);
  for (const n of niveis) assert.ok(n.celulas.length >= 1 || n.itens?.length >= 0, `${n.id} sem célula`);
});

test("G1 — projeto sem perfil, sem meta e sem ficha continua com 7 níveis", () => {
  const semPerfil = montarFicha({ slug: "x", perfil: null, coletado: {} });
  const niveis = montarNiveis(
    entradaBase({
      ficha: semPerfil,
      meta: null,
      veredito: posicaoDeAtaque(semPerfil),
      projecao: projetar({ ficha: semPerfil, meta: null, hoje: "2026-09-01" }),
      declarada: null,
    }),
  );
  assert.deepEqual(niveis.map((n) => n.id), ["N0", "N1", "N2", "N3", "N4", "N5", "N6"]);
});

// ── G2 — nenhuma célula fora dos três estados, nenhuma incompleta ───────────

function todasAsCelulas(niveis) {
  const out = [];
  for (const n of niveis) {
    out.push(...n.celulas);
    for (const kr of n.krs ?? []) if (kr.celulaAlvo) out.push(kr.celulaAlvo);
    for (const item of n.itens ?? []) out.push(item.data);
  }
  return out;
}

test("G2 — toda CelulaFicha respeita o envelope de três estados", () => {
  const niveis = montarNiveis(
    fichaCompleta({
      declarada: { declaradaEm: "2026-09-01", objetivo: "objetivo sem número", krs: [{ kpi: "leads", baseline: 39, meta: 120, prazo: "2026-12-31", dono: "jean", celula: "n3:lead" }] },
      itensAgenda: [{ key: "acao:atma:aaaa1111", occ: "1970-01-01", titulo: "fazer X", projeto: "atma", meta: "#1 · score 10", desc: null, tipo: "execucao", rank: 0, seguranca: false, responsavel: "jean" }],
      datasDono: new Map([["acao:atma:aaaa1111", "2026-08-20"]]),
    }),
  );
  for (const c of todasAsCelulas(niveis)) {
    assert.ok(["apurado", "declarado", "nao-apurado"].includes(c.estado), `estado inválido: ${c.estado}`);
    if (c.estado === "apurado") assert.ok(c.fonte, "apurado sem fonte");
    if (c.estado === "declarado") assert.ok(c.declaradoEm, "declarado sem declaradoEm");
    if (c.estado === "nao-apurado") {
      assert.ok(c.motivo, "não apurado sem motivo");
      assert.ok(c.consultar, "não apurado sem consultar");
      assert.equal(c.valor, undefined, "não apurado com valor");
    }
  }
});

// ── G3 — herança: insumo declarado contamina o produto ──────────────────────

test("G3 — 0 tratamentos × R$ 4.000 declarados é DECLARADO, nunca apurado", () => {
  const c = combinar(
    [estadoDeApurado(apurado(0), "extrato do gateway"), declarada(4000, { em: "2026-09-01", oQue: "meta.ticket" })],
    ([qtd, ticket]) => qtd * ticket,
  );
  assert.equal(c.estado, "declarado");
  assert.equal(c.valor, 0);
});

test("G3 — N1 da atma sai declarado em R$, mesmo com a contagem apurada", () => {
  const niveis = montarNiveis(fichaCompleta());
  const n1 = niveis.find((n) => n.id === "N1");
  const [contagem, reais] = n1.celulas;
  assert.equal(contagem.estado, "apurado");
  assert.equal(contagem.valor, 0); // tratamento = 0 na atma
  assert.equal(reais.estado, "declarado");
  assert.equal(reais.valor, 0);
});

// ── G4 — fator de cadeia: um degrau não apurado no trecho basta ─────────────

test("G4 — fator de cadeia com um degrau não apurado sai nao-apurado mesmo com os outros do trecho apurados", () => {
  const marcos = [
    { chave: "a", nome: "a", celula: apurado(10), fonte: "fa" },
    { chave: "b", nome: "b", celula: naoApuradoF("sem coletor b"), fonte: "fb" },
    { chave: "c", nome: "c", celula: apurado(5), fonte: "fc" },
  ];
  const fatores = [{ nome: "F(a→c)", tipo: "cadeia", cobertura: ["a", "b", "c"] }];
  const { fatores: out } = avaliarN2(fatores, marcos, [], {});
  assert.equal(out[0].estado, "nao-apurado");
});

// ── G5 — buraco/sobreposição vira erro; degraus acima do 1º fator não ───────

test("G5 — cobertura da atma (perfil D real) é contígua e não produz erro", () => {
  const ficha = fichaAtma();
  const { erroDeDefinicao } = avaliarN2(PERFIS.D.fatores, ficha.marcos, ficha.taxas, { ticket: 4000 });
  assert.equal(erroDeDefinicao, null);
});

test("G5 — buraco no meio da cobertura vira erro de definição", () => {
  const marcos = [
    { chave: "a", nome: "a", celula: apurado(10), fonte: "fa" },
    { chave: "b", nome: "b", celula: apurado(8), fonte: "fb" },
    { chave: "c", nome: "c", celula: apurado(5), fonte: "fc" },
  ];
  // cobertura pula "b": buraco entre "a" e "c".
  const fatores = [{ nome: "F1", tipo: "cadeia", cobertura: ["a"] }, { nome: "F2", tipo: "cadeia", cobertura: ["c"] }];
  const { erroDeDefinicao } = avaliarN2(fatores, marcos, [], {});
  assert.match(erroDeDefinicao, /buraco ou sobreposição/);
});

test("G5 — degraus acima do primeiro fator (a entrada) não produzem erro", () => {
  const marcos = [
    { chave: "visitante", nome: "visitante", celula: apurado(535), fonte: "gsc" },
    { chave: "lead", nome: "lead", celula: apurado(39), fonte: "crm" },
    { chave: "venda", nome: "venda", celula: apurado(0), fonte: "gateway" },
  ];
  // cobertura só cobre lead→venda; "visitante" fica de fora — é a entrada (N4).
  const fatores = [{ nome: "F", tipo: "cadeia", cobertura: ["lead", "venda"] }];
  const { erroDeDefinicao } = avaliarN2(fatores, marcos, [], {});
  assert.equal(erroDeDefinicao, null);
});

// ── G6 — veredito de N2 nunca "fecha" derivado de ausência ──────────────────

test("G6 — veredito nao-apurado nomeia os fatores faltando, nunca finge fechar", () => {
  const ficha = fichaAtma(); // contatado/agendada/compareceu sem coletor
  const { veredito } = avaliarN2(PERFIS.D.fatores, ficha.marcos, ficha.taxas, { ticket: 4000 });
  assert.equal(veredito.estado, "nao-apurado");
  assert.match(veredito.motivo, /CR\(lead→consulta\)/);
});

// ── G7 — N4 sem total, diferença nao-apurado, perfil C marca organico sem elo ─

test("G7 — N4 nunca soma; a diferença sai nao-apurado", () => {
  const marcos = [{ chave: "visitante", nome: "visitante", celula: apurado(535) }];
  const canais = montarN4(CANAIS, apurado(535), marcos);
  const organico = canais.find((c) => c.id === "organico");
  assert.equal(organico.celula.estado, "apurado");
  for (const c of canais.filter((c) => c.id !== "organico")) assert.equal(c.celula.estado, "nao-apurado");
});

test("G7 — perfil C (cadeia começa em contato) marca organico como sem elo", () => {
  const marcos = [{ chave: "contato", nome: "contato", celula: apurado(10) }];
  const canais = montarN4(CANAIS, apurado(10), marcos);
  assert.equal(canais.find((c) => c.id === "organico").semElo, true);
});

test("G7 — perfil D (cadeia começa em visitante) organico TEM elo", () => {
  const marcos = [{ chave: "visitante", nome: "visitante", celula: apurado(535) }];
  const canais = montarN4(CANAIS, apurado(535), marcos);
  assert.equal(canais.find((c) => c.id === "organico").semElo, false);
});

// ── G8 — N5 devolve uma família só; posição média sempre nao-apurado ────────

test("G8 — N5 devolve só os medidores da família escolhida", () => {
  const medidores = montarN5("D4", {});
  assert.deepEqual(medidores.map((m) => m.id).sort(), [...MEDIDORES.D4].sort());
});

test("G8 — posicao-media-com-corte-pais é sempre nao-apurado, mesmo disponível", () => {
  const medidores = montarN5("D1", { "posicao-media-com-corte-pais": apurado(4.2) });
  const m = medidores.find((x) => x.id === "posicao-media-com-corte-pais");
  assert.equal(m.celula.estado, "nao-apurado");
});

// ── G9 — KR sobre célula apurada x não apurada ───────────────────────────────

test("G9 — KR sobre célula não apurada vira nao-verificavel; sobre apurada, sem marca", () => {
  const espacos = {
    "n3:": { lead: { estado: "apurado", valor: 39, fonte: "crm" }, agendada: { estado: "nao-apurado", motivo: "sem coletor", consultar: "agenda" } },
  };
  const krs = [
    { kpi: "leads", baseline: 39, meta: 120, prazo: "2026-12-31", dono: "jean", celula: "n3:lead" },
    { kpi: "agendadas", baseline: null, meta: 30, prazo: "2026-12-31", dono: "jean", celula: "n3:agendada" },
  ];
  const [comApurada, comNaoApurada] = validarKrs(krs, espacos);
  assert.equal(comApurada.marca, null);
  assert.equal(comNaoApurada.marca, "nao-verificavel");
});

// ── G10 — chave inexistente no espaço do prefixo, zero aproximação ──────────

test("G10 — chave inexistente no nível do prefixo vira chave-invalida, sem busca em outro nível", () => {
  const espacos = { "n3:": { lead: { estado: "apurado", valor: 1, fonte: "x" } }, "n4:": { organico: { estado: "apurado", valor: 1, fonte: "x" } } };
  const [r] = validarKrs([{ kpi: "x", baseline: null, meta: 1, prazo: "2026-12-31", dono: "jean", celula: "n3:organico" }], espacos);
  assert.equal(r.marca, "chave-invalida");
  assert.match(r.texto, /organico/);
});

test("SC-020 — a mesma chave válida em n4: vira erro quando declarada em n5:", () => {
  const espacos = { "n4:": { organico: { estado: "apurado", valor: 1, fonte: "x" } }, "n5:": { "lead-gravado": { estado: "apurado", valor: 1, fonte: "x" } } };
  const [r] = validarKrs([{ kpi: "x", baseline: null, meta: 1, prazo: "2026-12-31", dono: "jean", celula: "n5:organico" }], espacos);
  assert.equal(r.marca, "chave-invalida");
});

// ── G11 — KR sem dono visível; 4º KR excedente visível ───────────────────────

test("G11 — KR sem dono fica marcado e VISÍVEL; 4º KR vira excedente e VISÍVEL", () => {
  const espacos = { "n3:": { a: { estado: "apurado", valor: 1, fonte: "x" }, b: { estado: "apurado", valor: 1, fonte: "x" }, c: { estado: "apurado", valor: 1, fonte: "x" }, d: { estado: "apurado", valor: 1, fonte: "x" } } };
  const krs = [
    { kpi: "1", baseline: null, meta: 1, prazo: "2026-12-31", celula: "n3:a" }, // sem dono
    { kpi: "2", baseline: null, meta: 1, prazo: "2026-12-31", dono: "jean", celula: "n3:b" },
    { kpi: "3", baseline: null, meta: 1, prazo: "2026-12-31", dono: "jean", celula: "n3:c" },
    { kpi: "4", baseline: null, meta: 1, prazo: "2026-12-31", dono: "jean", celula: "n3:d" },
  ];
  const out = validarKrs(krs, espacos);
  assert.equal(out.length, 4); // nenhum truncado
  assert.equal(out[0].marca, "sem-dono");
  assert.equal(out[3].marca, "excedente");
});

// ── G12 — sem perfil: N1-N5 nao-apurado, zero números; N0/N6 continuam ──────

test("G12 — sem perfil, N1-N5 saem nao-apurado com zero números; N0 e N6 continuam válidos", () => {
  const semPerfil = montarFicha({ slug: "x", perfil: null, coletado: {} });
  const niveis = montarNiveis(
    entradaBase({
      ficha: semPerfil,
      meta: null,
      veredito: posicaoDeAtaque(semPerfil),
      projecao: projetar({ ficha: semPerfil, meta: null, hoje: "2026-09-01" }),
      declarada: { declaradaEm: "2026-09-01", objetivo: "objetivo", krs: [] },
    }),
  );
  for (const id of ["N1", "N2", "N3", "N4", "N5"]) {
    const n = niveis.find((x) => x.id === id);
    for (const c of n.celulas) {
      assert.equal(c.estado, "nao-apurado", `${id} tem célula que não é nao-apurado`);
      assert.equal(c.valor, undefined);
    }
  }
  const n0 = niveis.find((n) => n.id === "N0");
  assert.equal(n0.celulas[0].estado, "declarado");
  const n6 = niveis.find((n) => n.id === "N6");
  assert.ok(n6.celulas.length || n6.itens.length >= 0);
});

// ── G13 — perfil A/B/C: só N2 cai, os outros seis normais ───────────────────

test("G13 — perfil A (sem `fatores`): N2 inteiro nao-apurado, os outros seis normais", () => {
  const fichaA = montarFicha({ slug: "x", perfil: "A", coletado: { cliques: apurado(100) } });
  const niveis = montarNiveis(
    entradaBase({
      ficha: fichaA,
      meta: null,
      veredito: posicaoDeAtaque(fichaA),
      projecao: projetar({ ficha: fichaA, meta: null, hoje: "2026-09-01" }),
      declarada: null,
    }),
  );
  const n2 = niveis.find((n) => n.id === "N2");
  assert.equal(n2.celulas.length, 1);
  assert.equal(n2.celulas[0].estado, "nao-apurado");
  assert.match(n2.celulas[0].motivo, /fatores do perfil ainda não declarados/);
  // N1 segue a cadeia normalmente — não cai por causa de N2, e o motivo (quando não apurado)
  // é do COLETOR daquele degrau, nunca "sem perfil declarado".
  const n1 = niveis.find((n) => n.id === "N1");
  if (n1.celulas[0].estado === "nao-apurado") assert.doesNotMatch(n1.celulas[0].motivo, /sem perfil declarado/);
});

// ── G14 — N6: banco fora x sem ação, textos diferentes ───────────────────────

test("G14 — N6 com itensAgenda null e erroAgenda vira nao-apurado nomeando o motivo", () => {
  const niveis = montarNiveis(fichaCompleta({ itensAgenda: null, erroAgenda: "ECONNREFUSED" }));
  const n6 = niveis.find((n) => n.id === "N6");
  assert.equal(n6.celulas[0].estado, "nao-apurado");
  assert.match(n6.celulas[0].motivo, /ECONNREFUSED/);
});

test("G14 — N6 com itensAgenda [] vira 'sem ação declarada', texto DIFERENTE do banco fora", () => {
  const niveis = montarNiveis(fichaCompleta({ itensAgenda: [], erroAgenda: null }));
  const n6 = niveis.find((n) => n.id === "N6");
  assert.match(n6.celulas[0].motivo, /sem ação declarada/);
  const semAcao = n6.celulas[0].motivo;
  const bancoFora = montarNiveis(fichaCompleta({ itensAgenda: null, erroAgenda: "x" })).find((n) => n.id === "N6").celulas[0].motivo;
  assert.notEqual(semAcao, bancoFora);
});

// ── G15 — celulaQueMove nunca inferida do texto ──────────────────────────────

test("G15 — celulaQueMove é sempre nao-declarada, mesmo quando o título cita um degrau", () => {
  const niveis = montarNiveis(
    fichaCompleta({
      itensAgenda: [{ key: "acao:atma:x", occ: "1970-01-01", titulo: "consertar o degrau lead da cadeia", projeto: "atma", meta: "#1 · score 10", desc: null, tipo: "execucao", rank: 0, seguranca: false, responsavel: "jean" }],
    }),
  );
  const n6 = niveis.find((n) => n.id === "N6");
  assert.equal(n6.itens[0].celulaQueMove, "nao-declarada");
});

// ── R2 — fração SEMPRE colada no percentual, em N2 e N3 ─────────────────────

test("R2 — N3 cola a fração no percentual, nunca devolve o número cru 0..1", () => {
  const niveis = montarNiveis(fichaCompleta());
  const n3 = niveis.find((n) => n.id === "N3");
  const primeira = n3.celulas[0]; // visitante → lead: 39/535
  assert.equal(primeira.estado, "apurado");
  assert.match(String(primeira.valor), /^\d+,\d\d% \(\d+\/\d+\)$/);
});

test("R2 — o 1º fator de cadeia de N2 é VOLUME (não taxa); os seguintes são CR(...) com fração colada", () => {
  const ficha = fichaAtma();
  const { fatores } = avaliarN2(PERFIS.D.fatores, ficha.marcos, ficha.taxas, { ticket: 4000 });
  // "Leads" — 1º fator de cadeia: o count bruto de `lead` (39), não uma razão.
  assert.equal(fatores[0].estado, "apurado");
  assert.equal(fatores[0].valor, 39);
  // "CR(consulta→tratamento)" — cobertura de UM degrau só (["tratamento"]); tem que ser a TAXA
  // tratamento/compareceu, nunca o valor cru do marco (era o bug: virava "0" em vez de "0,00%").
  const crConsultaTratamento = fatores.find((f) => f.rotulo === "CR(consulta→tratamento)");
  if (crConsultaTratamento.estado === "apurado") assert.match(String(crConsultaTratamento.valor), /%/);
});

// ── T010 — invariante: listFichas() ⊆ listProjects() por slug ───────────────

test("invariante — todo projeto com `ficha` curada existe em listProjects()", () => {
  const curated = JSON.parse(readFileSync(join(RAIZ, "data/projects.json"), "utf8"));
  const comFicha = curated.filter((p) => p.ficha).map((p) => p.slug);
  assert.ok(comFicha.length > 0, "nenhum projeto curado com `ficha` — o teste não prova nada");
  const todos = new Set(mergeProjects(curated, []).map((p) => p.slug));
  for (const slug of comFicha) assert.ok(todos.has(slug), `${slug} tem ficha mas não está em listProjects()`);
});
