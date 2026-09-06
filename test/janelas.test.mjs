import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { descoberta, comportamento, conversao, hoje, descobertaLonga, comportamentoLongo } from "../lib/janelas.mjs";

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

// ── 019/US5 — as JANELAS LONGAS (FR-023, FR-025, SC-007) ────────────────────────────────────────
// Elas vivem SÓ em `/okr/[slug]/aquisicao`. A ficha e o ranking continuam nas curtas: esticar a
// janela da ficha trocaria a célula `visitante` dos 17 projetos e o placar do portfólio inteiro.

test("019/T037 — descobertaLonga() é 8 meses fechando em D-3, no MESMO formato das curtas", () => {
  const d = descobertaLonga(AGORA);
  assert.equal(d.nome, "DESCOBERTA_LONGA");
  assert.equal(d.fim, new Date(AGORA - 3 * DIA).toISOString().slice(0, 10));
  // 8 meses de CALENDÁRIO a partir do fim — nunca "240 dias", que não é o que a tela promete.
  const fim = new Date(`${d.fim}T00:00:00Z`);
  const esperado = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth() - 8, fim.getUTCDate()));
  assert.equal(d.inicio, esperado.toISOString().slice(0, 10));
  assert.ok(d.porque.length > 0, "toda janela declara POR QUE fecha onde fecha");
});

test("019/T037 — comportamentoLongo() é 12 meses fechando em D-3", () => {
  const c = comportamentoLongo(AGORA);
  assert.equal(c.nome, "COMPORTAMENTO_LONGO");
  assert.equal(c.fim, new Date(AGORA - 3 * DIA).toISOString().slice(0, 10));
  const fim = new Date(`${c.fim}T00:00:00Z`);
  const esperado = new Date(Date.UTC(fim.getUTCFullYear() - 1, fim.getUTCMonth(), fim.getUTCDate()));
  assert.equal(c.inicio, esperado.toISOString().slice(0, 10));
});

test("019/T037 — as longas CONTÊM as curtas, e são estritamente maiores", () => {
  for (const [longa, curta] of [
    [descobertaLonga(AGORA), descoberta(AGORA)],
    [comportamentoLongo(AGORA), comportamento(AGORA)],
  ]) {
    assert.ok(longa.inicio < curta.inicio, "a longa começa antes");
    assert.equal(longa.fim, curta.fim, "as duas fecham no mesmo D-3 — o atraso do GSC é o mesmo");
  }
});

test("019/T037/SC-007 — as três janelas CURTAS saem byte a byte iguais às de antes da 019", () => {
  // A trava da não-regressão dos 17 projetos: acrescentar as longas não pode mover as curtas.
  assert.deepEqual(descoberta(AGORA), {
    nome: "DESCOBERTA",
    inicio: new Date(AGORA - 30 * DIA).toISOString().slice(0, 10),
    fim: new Date(AGORA - 3 * DIA).toISOString().slice(0, 10),
    porque: "o Search Console fecha o dia com ~3 dias de atraso",
  });
  assert.deepEqual(comportamento(AGORA), {
    nome: "COMPORTAMENTO",
    inicio: new Date(AGORA - 30 * DIA).toISOString().slice(0, 10),
    fim: new Date(AGORA - 3 * DIA).toISOString().slice(0, 10),
    porque: "mesma janela da Descoberta até a 019",
  });
  assert.deepEqual(conversao(AGORA, null), {
    nome: "CONVERSAO",
    inicio: new Date(AGORA - 30 * DIA).toISOString().slice(0, 10),
    fim: new Date(AGORA - 3 * DIA).toISOString().slice(0, 10),
    porque: "sem época declarada no card",
  });
});

test("019/T037 — as longas são puras: mesmo `agora`, mesmo resultado; inicio <= fim sempre", () => {
  for (const agora of [AGORA, AGORA - 400 * DIA, AGORA + 30 * DIA]) {
    assert.deepEqual(descobertaLonga(agora), descobertaLonga(agora));
    assert.deepEqual(comportamentoLongo(agora), comportamentoLongo(agora));
    assert.ok(descobertaLonga(agora).inicio <= descobertaLonga(agora).fim);
    assert.ok(comportamentoLongo(agora).inicio <= comportamentoLongo(agora).fim);
  }
});

// ── 019/T045/FR-029/SC-008 — NENHUMA taxa cruza as duas séries de aquisição ─────────────────────
// Cliques (Search Console, só orgânico) e sessões (GA4, todo canal) medem coisas diferentes: na
// época da atma são 599 contra 1.140. Uma razão entre elas mede a diferença entre os INSTRUMENTOS,
// não o negócio. Esta asserção é do mesmo tipo da I1 acima — lê o fonte, porque a regra é sobre o
// que a tela NÃO pode conter, e `.tsx` não se testa sem subir o Next (Princípio III).
test("019/T045 — a tela de aquisição não divide cliques (GSC) por sessões (GA4), nem o contrário", () => {
  const bruto = readFileSync(fileURLToPath(new URL("../app/okr/[slug]/aquisicao/page.tsx", import.meta.url)), "utf8");
  const src = bruto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/.*$/gm, "");
  for (const proibida of [/cliques\s*\/\s*sess/i, /sess\w*\s*\/\s*cliques/i, /impressoes\s*\/\s*sess/i, /sess\w*\s*\/\s*impressoes/i]) {
    assert.doesNotMatch(src, proibida, "razão cruzando GSC e GA4 — FR-029 proíbe");
  }
});
