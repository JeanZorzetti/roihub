import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { janelaDaCorrida, diasParaGravar, DIAS_BACKFILL } from "../lib/serie-gsc.mjs";

const AGORA = Date.parse("2026-09-07T12:00:00Z");
const HOJE = "2026-09-07";

// ── pureza (Princípio III) ──────────────────────────────────────────────────────────────────
test("módulo é puro: sem process.env, e todo Date.now() é default de parâmetro", () => {
  const bruto = readFileSync(fileURLToPath(new URL("../lib/serie-gsc.mjs", import.meta.url)), "utf8");
  const src = bruto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /process\.env/, "módulo puro não pode ler ambiente");
  const total = (src.match(/Date\.now\(\)/g) ?? []).length;
  const comoDefault = (src.match(/=\s*Date\.now\(\)/g) ?? []).length;
  assert.equal(total, comoDefault, "todo Date.now() tem que ser default de parâmetro");
});

// ── janelaDaCorrida ─────────────────────────────────────────────────────────────────────────
test("sem linha gravada, a janela é o backfill dos 16 meses", () => {
  const j = janelaDaCorrida(null, AGORA);
  assert.equal(j.backfill, true);
  assert.equal(j.fim, HOJE);
  assert.equal(j.inicio, new Date(AGORA - DIAS_BACKFILL * 864e5).toISOString().slice(0, 10));
});

test("com linha gravada, a janela começa NO último dia gravado — não no seguinte", () => {
  // O último gravado pode ter sido colhido dentro da janela de D-3, quando o GSC ainda não
  // fechou a contagem. Começar em ultimoDia+1 congelaria o valor provisório para sempre —
  // é o caso medido no atma (30/07 saiu com 30 impressões e fechou em 827).
  const j = janelaDaCorrida("2026-09-05", AGORA);
  assert.equal(j.inicio, "2026-09-05");
  assert.equal(j.fim, HOJE);
  assert.equal(j.backfill, false);
});

test("último dia igual a hoje ainda regrava hoje (janela de um dia, nunca vazia)", () => {
  const j = janelaDaCorrida(HOJE, AGORA);
  assert.equal(j.inicio, HOJE);
  assert.equal(j.fim, HOJE);
});

test("último dia no FUTURO não encolhe a janela para trás", () => {
  // Relógio torto ou fuso do banco não pode fazer a série parar de crescer em silêncio.
  const j = janelaDaCorrida("2026-12-31", AGORA);
  assert.equal(j.inicio, HOJE);
  assert.equal(j.fim, HOJE);
  assert.ok(j.inicio <= j.fim, "início nunca pode passar do fim");
});

test("uma lacuna longa é coberta inteira, não só os últimos dias", () => {
  const j = janelaDaCorrida("2026-06-01", AGORA);
  assert.equal(j.inicio, "2026-06-01");
  assert.equal(j.fim, HOJE);
});

// ── diasParaGravar ──────────────────────────────────────────────────────────────────────────
test("mapeia os dias do GSC para a forma da tabela", () => {
  const dias = diasParaGravar([{ date: "2026-09-01", clicks: 3, impressions: 120, position: 8.4 }]);
  assert.deepEqual(dias, [{ dia: "2026-09-01", impressoes: 120, cliques: 3, posicao: 8.4 }]);
});

test("posição ausente vira null, NUNCA 0", () => {
  // Posição 0 não existe no Google: gravá-la faria a melhor posição possível representar
  // "não medido" — a inversão que `nao_apurado` existe para impedir em toda a casa.
  const [d] = diasParaGravar([{ date: "2026-09-01", clicks: 0, impressions: 0 }]);
  assert.equal(d.posicao, null);
  assert.notEqual(d.posicao, 0);
});

test("linha sem data é descartada", () => {
  assert.equal(diasParaGravar([{ date: "", clicks: 1, impressions: 1, position: 2 }]).length, 0);
});

test("série vazia devolve lista vazia, sem estourar", () => {
  assert.deepEqual(diasParaGravar([]), []);
});
