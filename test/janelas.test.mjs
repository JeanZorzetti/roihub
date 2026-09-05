import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { descoberta, comportamento, conversao, hoje } from "../lib/janelas.mjs";

const DIA = 864e5;
const AGORA = Date.parse("2026-09-05T12:00:00Z");

// ── I1 — pureza: sem process.env, sem Date.now() fora de default de parâmetro (FR-001) ─────────
test("I1 — lib/janelas.mjs não referencia process.env, e todo Date.now() é default de parâmetro", () => {
  const bruto = readFileSync(fileURLToPath(new URL("../lib/janelas.mjs", import.meta.url)), "utf8");
  // Tira comentários de linha e de bloco antes de checar código — comentários citando `process.env`
  // em prosa (explicando a regra) não podem derrubar o teste que prova a regra.
  const src = bruto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /process\.env/, "módulo puro não pode ler ambiente");
  const total = (src.match(/Date\.now\(\)/g) ?? []).length;
  const comoDefault = (src.match(/=\s*Date\.now\(\)/g) ?? []).length;
  assert.equal(total, comoDefault, "todo Date.now() tem que ser default de parâmetro, nunca relógio escondido no corpo");
});

test("I1 — chamar duas vezes com o MESMO `agora` devolve o MESMO resultado (nenhum relógio interno)", () => {
  assert.deepEqual(descoberta(AGORA), descoberta(AGORA));
  assert.deepEqual(comportamento(AGORA), comportamento(AGORA));
  assert.deepEqual(conversao(AGORA, { data: "2026-07-31", porque: "x" }), conversao(AGORA, { data: "2026-07-31", porque: "x" }));
  assert.equal(hoje(AGORA), hoje(AGORA));
});

// ── I2 — inicio <= fim sempre, para qualquer agora e qualquer época passada ─────────────────────
test("I2 — inicio <= fim em toda janela, para vários `agora` e épocas passadas", () => {
  const agoras = [AGORA, AGORA - 100 * DIA, AGORA + 30 * DIA];
  // Época sempre no PASSADO em relação a todo `agora` testado — época futura é erro de card, não
  // a invariante que este teste cobre (o contrato nomeia isso à parte: "época futura é erro").
  const epocas = [null, { data: "2020-01-01", porque: "x" }, { data: "2025-01-01", porque: "y" }];
  for (const agora of agoras) {
    assert.ok(descoberta(agora).inicio <= descoberta(agora).fim);
    assert.ok(comportamento(agora).inicio <= comportamento(agora).fim);
    for (const epoca of epocas) {
      const c = conversao(agora, epoca);
      assert.ok(c.inicio <= c.fim, `conversao(${new Date(agora).toISOString()}, ${JSON.stringify(epoca)}) inicio>fim`);
    }
  }
});

// ── I3 — conversao(agora, null) é BYTE A BYTE a janela de hoje (28d/D-3) — SC-007 ───────────────
test("I3 — conversao(agora, null) é idêntica, byte a byte, a 28d fechando em D-3", () => {
  const c = conversao(AGORA, null);
  assert.equal(c.nome, "CONVERSAO");
  assert.equal(c.inicio, new Date(AGORA - 30 * DIA).toISOString().slice(0, 10));
  assert.equal(c.fim, new Date(AGORA - 3 * DIA).toISOString().slice(0, 10));
});

test("I3 — omitir `epoca` (nenhum segundo argumento) se comporta como null", () => {
  assert.deepEqual(conversao(AGORA), conversao(AGORA, null));
});

// ── I4 — conversao(agora, epoca) cresce quando `agora` avança e a época fica parada ─────────────
test("I4 — conversao com época cresce com o tempo: inicio fixo na época, fim acompanha `agora`", () => {
  const epoca = { data: "2026-07-31", porque: "sociedade desfeita" };
  const cedo = conversao(AGORA, epoca);
  const tarde = conversao(AGORA + 10 * DIA, epoca);
  assert.equal(cedo.inicio, "2026-07-31");
  assert.equal(tarde.inicio, "2026-07-31");
  assert.ok(tarde.fim > cedo.fim, "a janela tem que crescer conforme o tempo passa, com a época parada");
  assert.equal(cedo.porque, "sociedade desfeita");
});

// ── I5 — descoberta e comportamento são idênticas entre si e à janela de hoje (FR-003) ──────────
test("I5 — descoberta e comportamento são idênticas entre si (inicio/fim), e nunca mudam nesta spec", () => {
  const d = descoberta(AGORA);
  const c = comportamento(AGORA);
  assert.equal(d.inicio, c.inicio);
  assert.equal(d.fim, c.fim);
  assert.equal(d.nome, "DESCOBERTA");
  assert.equal(c.nome, "COMPORTAMENTO");
  // mesmo tamanho da CONVERSAO sem época — as três só divergem em `nome`/`porque` até a 019.
  const semEpoca = conversao(AGORA, null);
  assert.equal(d.inicio, semEpoca.inicio);
  assert.equal(d.fim, semEpoca.fim);
});

// ── hoje() — YYYY-MM-DD de D-0 ───────────────────────────────────────────────────────────────────
test("hoje() devolve YYYY-MM-DD de D-0, calendário puro", () => {
  assert.equal(hoje(AGORA), new Date(AGORA).toISOString().slice(0, 10));
});

// ── T012/US1-AC3/FR-003/SC-007 — projeto SEM época: só CONVERSAO existe hoje, nada muda de tamanho
test("T012 — projeto sem `epoca`: CONVERSAO é 28d/D-3 byte a byte; só ELA teria trocado de tamanho com época, DESCOBERTA/COMPORTAMENTO ficam onde estão", () => {
  const semEpoca = conversao(AGORA, null);
  const comEpoca = conversao(AGORA, { data: "2026-07-31", porque: "x" });
  assert.deepEqual(semEpoca, conversao(AGORA)); // omitir é o mesmo que null
  assert.notDeepEqual(semEpoca, comEpoca, "só a CONVERSAO muda de tamanho quando o card declara época");
  assert.deepEqual(descoberta(AGORA), descoberta(AGORA));
  assert.deepEqual(comportamento(AGORA), comportamento(AGORA));
});
