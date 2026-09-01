import test from "node:test";
import assert from "node:assert/strict";
import { ehApurado } from "../lib/funil.mjs";
import { ancoraDe, projetar } from "../lib/projecao.mjs";

const cel = (v) => ({ valor: v });
const na = (m) => ({ naoApurado: m });

const marco = (chave, celula) => ({ chave, nome: chave, celula });

/** A cadeia sintética do quickstart.md §2 — nunca `atma`, cujo número muda com a janela (D3). */
function fichaBase(overrides = {}) {
  return {
    perfil: "D",
    marcos: [
      { chave: "visitante", nome: "visitante", celula: cel(535) },
      { chave: "lead", nome: "lead", celula: cel(39) },
      { chave: "contatado", nome: "contatado", celula: na("sem coletor") },
      { chave: "agendada", nome: "agendada", celula: na("sem coletor") },
      { chave: "compareceu", nome: "compareceu", celula: na("sem coletor") },
      { chave: "tratamento", nome: "tratamento", celula: cel(0) },
    ],
    taxas: [],
    ...overrides,
  };
}

const CADEIA_FECHADA = fichaBase({
  marcos: [
    { chave: "visitante", nome: "visitante", celula: cel(535) },
    { chave: "lead", nome: "lead", celula: cel(39) },
    { chave: "contatado", nome: "contatado", celula: cel(30) },
    { chave: "agendada", nome: "agendada", celula: cel(20) },
    { chave: "compareceu", nome: "compareceu", celula: cel(15) },
    { chave: "tratamento", nome: "tratamento", celula: cel(10) },
  ],
});

/** G7: veredito é sempre uma das seis etiquetas, nunca undefined. Helper reusado pelas 3 stories. */
function assertVereditoValido(p) {
  assert.ok(
    ["nao-apurado", "cabe", "limite", "impossivel", "multiplo", "folga"].includes(p.veredito),
    `veredito inesperado: ${p.veredito}`
  );
}

const HOJE = "2026-09-01";
const METABASE = { valor: 50000, ticket: 4000, prazo: "2026-09-29", declaradaEm: HOJE }; // 28 dias, 1 janela cheia

test("arquivo registrado em npm test", () => {
  assert.equal(1, 1);
});

test("ancoraDe: degrau apurado depois de um buraco NÃO é âncora — SC-007", () => {
  // atma: visitante, lead apurados; contatado, agendada, compareceu não apurados; tratamento: 0 apurado.
  const marcos = [
    marco("visitante", cel(535)),
    marco("lead", cel(39)),
    marco("contatado", na("sem coletor")),
    marco("agendada", na("sem coletor")),
    marco("compareceu", na("sem coletor")),
    marco("tratamento", cel(0)),
  ];
  const a = ancoraDe(marcos);
  assert.equal(a.chave, "lead");
  assert.equal(a.valor, 39);
  assert.equal(a.indice, 1);
  assert.equal(a.ehFinal, false);
});

test("ancoraDe: cadeia inteira apurada devolve o degrau final com ehFinal true", () => {
  const marcos = [marco("a", cel(100)), marco("b", cel(50)), marco("c", cel(10))];
  const a = ancoraDe(marcos);
  assert.equal(a.chave, "c");
  assert.equal(a.ehFinal, true);
});

test("ancoraDe: nenhum degrau apurado devolve null", () => {
  const marcos = [marco("a", na("sem coletor")), marco("b", na("sem coletor"))];
  assert.equal(ancoraDe(marcos), null);
});

test("ancoraDe: só o degrau final apurado após buraco devolve null", () => {
  const marcos = [marco("a", na("sem coletor")), marco("b", na("sem coletor")), marco("c", cel(0))];
  assert.equal(ancoraDe(marcos), null);
});

// ---------------------------------------------------------------------------------------------
// Phase 2 (Foundational) — guardas de projetar(), uma por vez, na ordem da própria divisão (T009)
// ---------------------------------------------------------------------------------------------

function assertNadaApurado(p) {
  assert.equal(ehApurado(p.n1Total), false);
  assert.equal(ehApurado(p.n1Janela), false);
  assert.equal(ehApurado(p.fatorObrigatorio), false);
  assert.equal(ehApurado(p.multiploNecessario), false);
  assert.equal(ehApurado(p.folga), false);
  assert.equal(ehApurado(p.multiploDeVolume), false);
  assert.equal(p.ancora, null);
  assert.equal(p.normalizacao, null);
  assert.deepEqual(p.degrausAMedir, []);
}

test("guarda 1 — sem perfil declarado", () => {
  const ficha = { semPerfil: na("sem perfil declarado no card"), marcos: [], taxas: [] };
  const p = projetar({ ficha, meta: METABASE, hoje: HOJE });
  assert.equal(p.veredito, "nao-apurado");
  assert.equal(p.motivo, "sem perfil declarado no card");
  assertNadaApurado(p);
  assertVereditoValido(p);
});

test("guarda 2 — meta ausente", () => {
  for (const meta of [undefined, null]) {
    const p = projetar({ ficha: fichaBase(), meta, hoje: HOJE });
    assert.equal(p.veredito, "nao-apurado");
    assert.equal(p.motivo, "sem meta declarada");
    assertNadaApurado(p);
  }
});

test("guarda 3 — sem valor de meta (ausente ou <= 0)", () => {
  for (const valor of [undefined, 0, -10]) {
    const p = projetar({ ficha: fichaBase(), meta: { ...METABASE, valor }, hoje: HOJE });
    assert.equal(p.veredito, "nao-apurado");
    assert.equal(p.motivo, "sem valor de meta declarado");
    assertNadaApurado(p);
  }
});

test("guarda 4 — sem ticket declarado, NUNCA 0 nem 100% (SC-009)", () => {
  for (const ticket of [undefined, 0, -1]) {
    const p = projetar({ ficha: fichaBase(), meta: { ...METABASE, ticket }, hoje: HOJE });
    assert.equal(p.veredito, "nao-apurado");
    assert.equal(p.motivo, "sem ticket declarado — R$ não vira contagem sem valor por unidade");
    assertNadaApurado(p);
  }
});

test("guarda 5 — prazo ausente ou inválido", () => {
  for (const prazo of [undefined, "", "não é data", "2026-13-40"]) {
    const p = projetar({ ficha: fichaBase(), meta: { ...METABASE, prazo }, hoje: HOJE });
    assert.equal(p.veredito, "nao-apurado");
    assert.equal(p.motivo, "prazo ausente ou inválido");
    assertNadaApurado(p);
  }
});

test("guarda 6 — prazo vencido, sem dividir por janela negativa nem por zero", () => {
  const p = projetar({ ficha: fichaBase(), meta: { ...METABASE, prazo: "2026-08-01" }, hoje: HOJE });
  assert.equal(p.veredito, "nao-apurado");
  assert.equal(p.motivo, "prazo vencido em 2026-08-01");
  assertNadaApurado(p);

  // prazo === hoje: zero dias restantes, mesma guarda, nunca divisão por zero.
  const p2 = projetar({ ficha: fichaBase(), meta: { ...METABASE, prazo: HOJE }, hoje: HOJE });
  assert.equal(p2.veredito, "nao-apurado");
  assert.match(p2.motivo, /^prazo vencido em/);
});

test("guarda 7 — sem âncora, nenhum degrau medido", () => {
  const ficha = fichaBase({
    marcos: [
      { chave: "visitante", nome: "visitante", celula: na("sem coletor") },
      { chave: "lead", nome: "lead", celula: na("sem coletor") },
    ],
  });
  const p = projetar({ ficha, meta: METABASE, hoje: HOJE });
  assert.equal(p.veredito, "nao-apurado");
  assert.equal(p.motivo, "sem âncora — nenhum degrau medido para dividir");
  assertNadaApurado(p);
});

test("guarda 8 — âncora zerada, meta não se divide por volume nenhum (G5)", () => {
  const ficha = fichaBase({
    marcos: [
      { chave: "visitante", nome: "visitante", celula: cel(0) },
      { chave: "lead", nome: "lead", celula: na("sem coletor") },
    ],
  });
  const p = projetar({ ficha, meta: METABASE, hoje: HOJE });
  assert.equal(p.veredito, "nao-apurado");
  assert.equal(p.motivo, "âncora zerada — meta não se divide por volume nenhum");
  assertNadaApurado(p);
});

test("G10 — declaradaEm nunca entra em conta nem invalida a meta", () => {
  const antiga = projetar({ ficha: fichaBase(), meta: { ...METABASE, declaradaEm: "2025-01-01" }, hoje: HOJE });
  const nova = projetar({ ficha: fichaBase(), meta: { ...METABASE, declaradaEm: "2026-09-01" }, hoje: HOJE });
  assert.deepEqual(antiga, nova);
});

// ---------------------------------------------------------------------------------------------
// Phase 3 — US1: quanto cada fator precisa valer (T010, T011)
// ---------------------------------------------------------------------------------------------

test("US1: n1Total apurado e uma janela cheia (28 dias) deixa n1Janela === n1Total", () => {
  const p = projetar({ ficha: fichaBase(), meta: METABASE, hoje: HOJE });
  assert.equal(ehApurado(p.n1Total), true);
  assert.equal(p.n1Total.valor, 50000 / 4000);
  assert.equal(p.n1Janela.valor, p.n1Total.valor);
});

test("US1: cadeia sintética do quickstart §2 — âncora lead=39, cabe, fator ≈ 0,3205, 4 degraus nomeados", () => {
  const p = projetar({ ficha: fichaBase(), meta: METABASE, hoje: HOJE });
  assert.equal(p.ancora.chave, "lead");
  assert.equal(p.ancora.valor, 39);
  assert.equal(p.veredito, "cabe");
  assert.ok(Math.abs(p.fatorObrigatorio.valor - 0.3205) < 0.0001);
  assert.equal(p.degrausAMedir.length, 4);
  assert.deepEqual(p.degrausAMedir, [
    { de: "lead", para: "contatado" },
    { de: "contatado", para: "agendada" },
    { de: "agendada", para: "compareceu" },
    { de: "compareceu", para: "tratamento" },
  ]);
  assertVereditoValido(p);
});

test("US1: fator exatamente 1 vira limite, não impossível (R-h)", () => {
  const p = projetar({ ficha: fichaBase(), meta: { ...METABASE, valor: 39 * 4000 }, hoje: HOJE });
  assert.equal(p.veredito, "limite");
  assert.equal(p.fatorObrigatorio.valor, 1);
  assert.equal(p.motivo, "100% em todos os degraus restantes — limite, não meta");
  assert.doesNotMatch(p.motivo, /imposs[íi]v/);
});

// ---------------------------------------------------------------------------------------------
// Phase 4 — US2: meta impossível e cadeia fechada (T017, T018)
// ---------------------------------------------------------------------------------------------

test("US2: meta impossível — fator > 1 apurado, multiploDeVolume ≈ 2,6, prova nomeia volume e ticket", () => {
  const p = projetar({ ficha: fichaBase(), meta: { ...METABASE, valor: 400000 }, hoje: HOJE });
  assert.equal(p.veredito, "impossivel");
  assert.equal(ehApurado(p.fatorObrigatorio), true);
  assert.ok(p.fatorObrigatorio.valor > 1);
  assert.ok(Math.abs(p.multiploDeVolume.valor - 2.6) < 0.05);
  assert.match(p.motivo, /taxa não passa de 100%/);
  assert.match(p.motivo, /volume/);
  assert.match(p.motivo, /ticket/);
  assert.doesNotMatch(p.motivo, /copy|performance|indexa[çc][ãa]o/i);
  assertVereditoValido(p);
});

test("US2: cadeia fechada — múltiplo necessário, NUNCA impossível (G4, G9, D9)", () => {
  const p = projetar({ ficha: CADEIA_FECHADA, meta: { ...METABASE, valor: 400000 }, hoje: HOJE });
  assert.equal(p.ancora.chave, "tratamento");
  assert.equal(p.ancora.ehFinal, true);
  assert.equal(ehApurado(p.fatorObrigatorio), false);
  assert.equal(p.fatorObrigatorio.naoApurado, "âncora é o próprio N1 — não há trecho a exigir");
  assert.ok(Math.abs(p.multiploNecessario.valor - 10) < 0.01);
  assert.equal(p.veredito, "multiplo");
  assert.deepEqual(p.degrausAMedir, []);
  assert.notEqual(p.veredito, "impossivel");
  assert.doesNotMatch(p.motivo, /imposs[íi]v/);
  // as duas nunca apuradas juntas
  assert.ok(!(ehApurado(p.fatorObrigatorio) && ehApurado(p.multiploNecessario)));

  const folga = projetar({ ficha: CADEIA_FECHADA, meta: { ...METABASE, valor: 20000 }, hoje: HOJE });
  assert.equal(folga.veredito, "folga");
  assert.ok(Math.abs(folga.multiploNecessario.valor - 0.5) < 0.01);
  assert.equal(folga.folga.valor, 1 / folga.multiploNecessario.valor);
});

// ---------------------------------------------------------------------------------------------
// Phase 5 — US3: normalização de prazo para janela (T022, T023)
// ---------------------------------------------------------------------------------------------

test("US3: mesma meta com prazo de 28 e de 112 dias produz fatores na razão 4:1 (SC-006, G8)", () => {
  const p28 = projetar({ ficha: fichaBase(), meta: { ...METABASE, prazo: "2026-09-29" }, hoje: HOJE });
  const p112 = projetar({ ficha: fichaBase(), meta: { ...METABASE, prazo: "2026-12-22" }, hoje: HOJE });
  assert.ok(Math.abs(p28.fatorObrigatorio.valor - 0.3205) < 0.0001);
  assert.ok(Math.abs(p112.fatorObrigatorio.valor - 0.0801) < 0.0001);
  assert.ok(Math.abs(p28.fatorObrigatorio.valor / p112.fatorObrigatorio.valor - 4) < 0.001);
});

test("US3: prazo restante menor que uma janela vira encurtada, e n1Janela > n1Total (direção da fórmula)", () => {
  const p = projetar({ ficha: fichaBase(), meta: { ...METABASE, prazo: "2026-09-08" }, hoje: HOJE }); // 7 dias
  assert.equal(p.normalizacao.diasRestantes, 7);
  assert.equal(p.normalizacao.encurtada, true);
  assert.ok(p.n1Janela.valor > p.n1Total.valor);
  assert.ok(Math.abs(p.n1Janela.valor / p.n1Total.valor - 4) < 0.001); // 28/7 = 4×
});
